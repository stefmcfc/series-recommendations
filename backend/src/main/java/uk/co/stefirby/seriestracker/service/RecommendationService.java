package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.TmdbCandidate;
import uk.co.stefirby.seriestracker.client.TmdbClient;
import uk.co.stefirby.seriestracker.client.TmdbKeyword;
import uk.co.stefirby.seriestracker.client.TmdbWatchProvider;
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.model.SeriesStatus;
import uk.co.stefirby.seriestracker.repository.IgnoredSeriesRepository;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Backs {@code GET /api/v1/series/recommendations}. Sources candidates from TMDB using
 * either an automatic "watched" pool of the user's own {@code COMPLETED} series or an
 * explicitly directed selection (specific series, and/or genre/keyword independent of watch
 * history), ranks them by a blend of TMDB's own rating and the source series' {@code
 * personalRating}, applies a set of output-quality filters and a per-source diversity cap,
 * then filters out anything already added or already ignored and deduplicates. See
 * {@code series_spec_006_recommendations.md} and {@code
 * series_spec_007_recommendation_sourcing.md} for the full design rationale.
 */
@Service
public class RecommendationService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationService.class);

    /**
     * Default for {@code maxSourcesShown} when {@link RecommendationCriteria#getMaxSourcesShown()}
     * is unset (SERIES-015-AC-13).
     */
    private static final int DEFAULT_MAX_SOURCES_SHOWN = 3;

    /**
     * Canonical per-candidate ordering of contributing source series (SERIES-015-AC-05):
     * {@code personalRating} descending (nulls last), then {@code dateCompleted} descending
     * (nulls last). Shared, unmodified, by {@link #resolveSourcePool}'s pool ordering, {@link
     * #dedupeAndExclude}'s per-candidate ordering (which feeds scoring, {@code best-source}
     * diversity-cap mode, and {@code RecommendationDto.sourceTitles}), so all three can never
     * disagree about which source is "best" for a given candidate (SERIES-015-AC-06).
     */
    private static final Comparator<SeriesEntity> SOURCE_ORDER_COMPARATOR = Comparator
        .comparing(SeriesEntity::getPersonalRating, Comparator.nullsLast(Comparator.reverseOrder()))
        .thenComparing(SeriesEntity::getDateCompleted, Comparator.nullsLast(Comparator.reverseOrder()));

    /**
     * Default for the {@code minVoteCount} output filter when unset -- the one filter in
     * this spec that isn't a no-op by default (SERIES-007-AC-25). A high {@code voteAverage}
     * from a handful of votes is closer to noise than signal.
     */
    private static final int DEFAULT_MIN_VOTE_COUNT = 20;

    /**
     * Mode-aware override of {@link #DEFAULT_MIN_VOTE_COUNT} applied only when {@code
     * sourceMode == "topRated"} (SERIES-024-AC-09), at both the sourcing-time call site ({@link
     * #sourceTopRated}, SERIES-024-AC-10) and the post-hoc output-filter call site ({@link
     * #applyOutputFilters}, SERIES-024-AC-11). Every other mode keeps {@link
     * #DEFAULT_MIN_VOTE_COUNT} (SERIES-024-AC-12) -- a global bump would over-filter
     * Automatic/Specific/Genre recommendations, which don't need as high a confidence bar as
     * "show me TMDB's objectively highest-rated shows" does.
     */
    private static final int DEFAULT_MIN_VOTE_COUNT_TOP_RATED = 200;

    /**
     * TMDB's full confirmed {@code discover/tv} {@code sort_by} enum (SERIES-025-AC-04),
     * validated in {@link #validate} whenever {@link RecommendationCriteria#getDiscoverSortBy()}
     * is non-blank. Deliberately the complete 12-value enum, not just the subset a given
     * frontend release exposes -- see {@code series_spec_025_discover_native_sort.md}'s Design
     * Decisions.
     */
    private static final Set<String> VALID_DISCOVER_SORT_BY = Set.of(
        "first_air_date.asc", "first_air_date.desc",
        "name.asc", "name.desc",
        "original_name.asc", "original_name.desc",
        "popularity.asc", "popularity.desc",
        "vote_average.asc", "vote_average.desc",
        "vote_count.asc", "vote_count.desc"
    );

    /** {@link #sourceTopRated}'s default {@code discoverSortBy} when unset (SERIES-025-AC-05) -- preserves pre-spec-025 behavior exactly. */
    private static final String DEFAULT_TOP_RATED_SORT_BY = "vote_average.desc";

    /**
     * {@link #sourceByGenreOrKeyword}'s default {@code discoverSortBy} when unset
     * (SERIES-025-AC-06) -- TMDB's own {@code discover/tv} default, so an unset {@code
     * discoverSortBy} is functionally identical to the pre-spec-025 behavior of sending no
     * {@code sort_by} at all.
     */
    private static final String DEFAULT_GENRE_SORT_BY = "popularity.desc";

    private final SeriesRepository seriesRepository;
    private final IgnoredSeriesRepository ignoredSeriesRepository;
    private final TmdbClient tmdbClient;
    private final TmdbGenreTable genreTable;

    /**
     * Upper bound on how many source series (the automatic {@code COMPLETED} pool, or an
     * explicit {@code seriesIds} selection) feed title-based sourcing (SERIES-007-AC-01,
     * superseding the previously hardcoded {@code TMDB_MAX_SOURCE_SERIES = 20}).
     */
    private final int maxSourceSeries;

    /**
     * Upper bound on the combined raw candidate pool before {@code external_ids} is resolved
     * for each one (SERIES-007-AC-02, superseding the previously hardcoded {@code
     * TMDB_MAX_CANDIDATES = 50}).
     */
    private final int maxCandidates;

    /**
     * Selects the {@link #applyDiversityCap} strategy (SERIES-015-AC-14): {@code "best-source"}
     * (default) caps on each candidate's single best contributing source only; {@code
     * "all-sources"} caps on every contributing source. Any value other than exactly {@code
     * "all-sources"} is treated as {@code "best-source"} -- no startup validation/rejection of
     * an unrecognized value (SERIES-015-AC-18).
     */
    private final String diversityCapMode;

    /**
     * Default for {@link #maxPerSource} when {@link RecommendationCriteria#getMaxPerSource()}
     * is unset (SERIES-007-AC-22, superseding the previously hardcoded {@code
     * DEFAULT_MAX_PER_SOURCE = 3}). Upper bound on how many recommendations can come from any
     * single source series in "Specific Series" mode's diversity cap.
     */
    private final int maxPerSource;

    /**
     * Region passed to {@link TmdbClient#watchProviders(int, String)} for every candidate
     * (SERIES-020-AC-05) -- a single configured value, not a per-request parameter, per {@code
     * series_spec_020_watch_providers.md}'s Design Decisions (this is a single-user personal
     * app with one household's viewing region).
     */
    private final String watchRegion;

    public RecommendationService(SeriesRepository seriesRepository,
                                  IgnoredSeriesRepository ignoredSeriesRepository,
                                  TmdbClient tmdbClient,
                                  TmdbGenreTable genreTable,
                                  @Value("${app.tmdb.max-source-series:20}") int maxSourceSeries,
                                  @Value("${app.tmdb.max-candidates:50}") int maxCandidates,
                                  @Value("${app.recommendations.diversity-cap-mode:best-source}") String diversityCapMode,
                                  @Value("${app.tmdb.max-per-source:8}") int maxPerSource,
                                  @Value("${app.tmdb.watch-region:GB}") String watchRegion) {
        this.seriesRepository = seriesRepository;
        this.ignoredSeriesRepository = ignoredSeriesRepository;
        this.tmdbClient = tmdbClient;
        this.genreTable = genreTable;
        this.maxSourceSeries = maxSourceSeries;
        this.maxCandidates = maxCandidates;
        this.diversityCapMode = diversityCapMode;
        this.maxPerSource = maxPerSource;
        this.watchRegion = watchRegion;
    }

    /** Convenience overload -- equivalent to {@code recommend(limit, new RecommendationCriteria())}. */
    @Transactional(readOnly = true)
    public List<RecommendationDto> recommend(int limit) {
        return recommend(limit, new RecommendationCriteria());
    }

    @Transactional(readOnly = true)
    public List<RecommendationDto> recommend(int limit, RecommendationCriteria criteria) {
        validate(criteria);

        boolean trendingMode = "trending".equals(criteria.getSourceMode());
        boolean topRatedMode = "topRated".equals(criteria.getSourceMode());
        boolean genreOrKeywordDirected = isDirectedByGenreOrKeyword(criteria);

        List<RawCandidate> raw;
        if (trendingMode) {
            raw = sourceTrending(criteria);
        } else if (topRatedMode) {
            raw = sourceTopRated(criteria);
        } else if (genreOrKeywordDirected) {
            raw = sourceByGenreOrKeyword(criteria);
        } else {
            raw = sourceFromPool(criteria, limit);
        }

        List<RawCandidate> capped = raw.size() > maxCandidates
            ? raw.subList(0, maxCandidates)
            : raw;

        List<DedupedCandidate> deduped = dedupeAndExclude(capped);
        List<DedupedCandidate> filtered = applyOutputFilters(deduped, criteria);

        if (trendingMode || topRatedMode || genreOrKeywordDirected) {
            // SERIES-022-AC-08 (trending), generalized by SERIES-025-AC-07 to topRated and
            // genre/keyword-directed sourcing: none of the three ever link a candidate to a
            // source series, so Requirement 7's ranking/diversity-cap step is a full no-op for
            // them (rankScore always equals tmdbRating, and the diversity cap never caps a
            // candidate with no contributing sources -- SERIES-015-AC-15). Rather than run that
            // no-op and silently discard TMDB's own (now sort_by-driven) order, these three
            // modes keep TMDB's own returned order. Output filters still run above, unaffected.
            int effectiveMaxSourcesShown = criteria.getMaxSourcesShown() != null
                ? criteria.getMaxSourcesShown() : DEFAULT_MAX_SOURCES_SHOWN;
            return filtered.stream()
                .map(dc -> toDto(dc, effectiveMaxSourcesShown))
                .limit(limit)
                .collect(Collectors.toList());
        }

        int effectiveMaxSourcesShown = criteria.getMaxSourcesShown() != null
            ? criteria.getMaxSourcesShown() : DEFAULT_MAX_SOURCES_SHOWN;

        List<ScoredCandidate> ranked = filtered.stream()
            .map(dc -> score(dc, effectiveMaxSourcesShown))
            .sorted(resolveSortComparator(criteria))
            .collect(Collectors.toList());

        int effectiveMaxPerSource = criteria.getMaxPerSource() != null ? criteria.getMaxPerSource() : maxPerSource;
        List<ScoredCandidate> diversified = applyDiversityCap(ranked, effectiveMaxPerSource);

        return diversified.stream()
            .map(ScoredCandidate::dto)
            .limit(limit)
            .collect(Collectors.toList());
    }

    private void validate(RecommendationCriteria c) {
        boolean hasSeriesIds = c.getSeriesIds() != null && !c.getSeriesIds().isEmpty();
        boolean hasGenreOrKeyword = isDirectedByGenreOrKeyword(c);
        boolean hasSourceMode = c.getSourceMode() != null && !c.getSourceMode().isBlank();

        if (hasSourceMode && !"trending".equals(c.getSourceMode()) && !"topRated".equals(c.getSourceMode())) {
            throw new IllegalArgumentException("sourceMode must be one of: trending, topRated");
        }
        if (hasSeriesIds && hasGenreOrKeyword) {
            throw new IllegalArgumentException(
                "seriesIds cannot be combined with genres/keywords -- these are mutually exclusive request modes");
        }
        if (hasSourceMode && (hasSeriesIds || hasGenreOrKeyword)) {
            throw new IllegalArgumentException(
                "sourceMode cannot be combined with seriesIds/genres/keywords -- these are mutually exclusive request modes");
        }
        if (c.getMinSourceRating() != null && (c.getMinSourceRating() < 1 || c.getMinSourceRating() > 5)) {
            throw new IllegalArgumentException("minSourceRating must be between 1 and 5");
        }
        String trendingWindow = c.getTrendingWindow();
        if (trendingWindow != null && !trendingWindow.isBlank()
            && !"day".equals(trendingWindow) && !"week".equals(trendingWindow)) {
            throw new IllegalArgumentException("trendingWindow must be one of: day, week");
        }
        String discoverSortBy = c.getDiscoverSortBy();
        if (discoverSortBy != null && !discoverSortBy.isBlank() && !VALID_DISCOVER_SORT_BY.contains(discoverSortBy)) {
            throw new IllegalArgumentException("discoverSortBy must be one of: " + VALID_DISCOVER_SORT_BY);
        }
    }

    private boolean isDirectedByGenreOrKeyword(RecommendationCriteria c) {
        return (c.getGenres() != null && !c.getGenres().isEmpty())
            || (c.getKeywords() != null && !c.getKeywords().isEmpty());
    }

    // -- Requirement 2 (SERIES-022-AC-07..10): directed sourcing -- trending, bypassing the watched pool entirely --

    private List<RawCandidate> sourceTrending(RecommendationCriteria c) {
        String window = c.getTrendingWindow() != null && !c.getTrendingWindow().isBlank()
            ? c.getTrendingWindow() : "week";
        return tmdbClient.trending(window).stream()
            .map(candidate -> new RawCandidate(candidate, null))
            .collect(Collectors.toList());
    }

    // -- Requirement 3 (SERIES-022-AC-11..15): directed sourcing -- top rated, bypassing the watched pool entirely --

    private List<RawCandidate> sourceTopRated(RecommendationCriteria c) {
        // SERIES-024-AC-10: topRated's sourcing-time default is 200, not the shared 20.
        int effectiveMinVoteCount = c.getMinVoteCount() != null ? c.getMinVoteCount() : DEFAULT_MIN_VOTE_COUNT_TOP_RATED;
        // SERIES-025-AC-05: resolve discoverSortBy to vote_average.desc when unset.
        String effectiveSortBy = resolveDiscoverSortBy(c, DEFAULT_TOP_RATED_SORT_BY);
        return tmdbClient.discoverTopRated(effectiveMinVoteCount, effectiveSortBy).stream()
            .map(candidate -> new RawCandidate(candidate, null))
            .collect(Collectors.toList());
    }

    // -- Requirement 5: directed sourcing by genre/keyword, bypassing the watched pool entirely --

    private List<RawCandidate> sourceByGenreOrKeyword(RecommendationCriteria c) {
        List<Integer> genreIds = resolveGenreIds(c.getGenres());
        List<Integer> keywordIds = resolveKeywordIds(c.getKeywords());
        // SERIES-025-AC-06: resolve discoverSortBy to popularity.desc when unset.
        String effectiveSortBy = resolveDiscoverSortBy(c, DEFAULT_GENRE_SORT_BY);
        return tmdbClient.discover(genreIds, keywordIds, effectiveSortBy).stream()
            .map(candidate -> new RawCandidate(candidate, null))
            .collect(Collectors.toList());
    }

    /** Shared by {@link #sourceTopRated}/{@link #sourceByGenreOrKeyword}: an explicit, non-blank {@code discoverSortBy} wins; otherwise the mode's own default. */
    private String resolveDiscoverSortBy(RecommendationCriteria c, String modeDefault) {
        String discoverSortBy = c.getDiscoverSortBy();
        return discoverSortBy != null && !discoverSortBy.isBlank() ? discoverSortBy : modeDefault;
    }

    private List<Integer> resolveGenreIds(List<String> genres) {
        if (genres == null) {
            return List.of();
        }
        return genres.stream()
            .map(genreTable::idFor)
            .filter(Objects::nonNull)
            .distinct()
            .collect(Collectors.toList());
    }

    private List<Integer> resolveKeywordIds(List<String> keywords) {
        if (keywords == null) {
            return List.of();
        }
        return keywords.stream()
            .map(tmdbClient::searchKeyword)
            .filter(Optional::isPresent)
            .map(Optional::get)
            .distinct()
            .collect(Collectors.toList());
    }

    // -- Requirement 4 (Spec 006) / Requirement 4+6 (Spec 007): pool-based (title + genre supplement) sourcing --

    private List<RawCandidate> sourceFromPool(RecommendationCriteria c, int limit) {
        List<SeriesEntity> pool = resolveSourcePool(c);
        if (pool.isEmpty()) {
            log.debug("Source pool is empty; skipping recommendation sourcing entirely");
            return List.of();
        }

        List<RawCandidate> raw = new ArrayList<>();
        for (SeriesEntity source : pool) {
            sourceTitleBased(source, raw);
        }

        long distinctTitleBased = raw.stream().map(r -> r.candidate().tmdbId()).distinct().count();
        if (distinctTitleBased < limit) {
            raw.addAll(genreBasedSupplement(pool));
        }
        return raw;
    }

    private List<SeriesEntity> resolveSourcePool(RecommendationCriteria c) {
        List<SeriesEntity> pool = (c.getSeriesIds() != null && !c.getSeriesIds().isEmpty())
            ? explicitPool(c.getSeriesIds())
            : automaticPool();

        return pool.stream()
            .filter(e -> c.getMinSourceRating() == null
                || (e.getPersonalRating() != null && e.getPersonalRating() >= c.getMinSourceRating()))
            .sorted(SOURCE_ORDER_COMPARATOR)
            .limit(maxSourceSeries)
            .collect(Collectors.toList());
    }

    /**
     * Automatic "watched" pool (SERIES-006-AC-14): every {@code COMPLETED} series with a
     * resolvable {@code imdbId}, excluding any series with {@code excludeFromRecommendations
     * == true} (SERIES-008-AC-04) -- this filter applies here, not in {@link #explicitPool},
     * so an explicit {@code seriesIds} selection is deliberately unaffected by it
     * (SERIES-008-AC-05). Because {@link #genreBasedSupplement} is derived from this same
     * pool, excluding a series here also removes it from the genre frequency count.
     */
    private List<SeriesEntity> automaticPool() {
        return seriesRepository.findAll().stream()
            .filter(e -> e.getStatus() == SeriesStatus.COMPLETED
                && e.getImdbId() != null
                && !e.getImdbId().isBlank()
                && !e.isExcludeFromRecommendations())
            .collect(Collectors.toList());
    }

    /**
     * Explicit selection pool (SERIES-007-AC-08): every requested series regardless of
     * status. Rejects the request (SERIES-007-AC-09) if any requested id is malformed or
     * doesn't match an existing {@link SeriesEntity}.
     */
    private List<SeriesEntity> explicitPool(List<String> rawSeriesIds) {
        List<UUID> ids = rawSeriesIds.stream().map(this::parseUuid).distinct().collect(Collectors.toList());
        List<SeriesEntity> found = seriesRepository.findAllById(ids);
        if (found.size() != ids.size()) {
            Set<UUID> foundIds = found.stream().map(SeriesEntity::getId).collect(Collectors.toSet());
            List<UUID> missing = ids.stream().filter(id -> !foundIds.contains(id)).collect(Collectors.toList());
            throw new IllegalArgumentException("Unknown series id(s) in seriesIds: " + missing);
        }
        return found;
    }

    private UUID parseUuid(String raw) {
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid seriesIds entry (not a UUID): " + raw);
        }
    }

    private void sourceTitleBased(SeriesEntity source, List<RawCandidate> raw) {
        if (source.getImdbId() == null || source.getImdbId().isBlank()) {
            log.debug("'{}' has no imdbId; skipping for title-based sourcing", source.getTitle());
            return;
        }

        Optional<Integer> tmdbIdOpt = tmdbClient.findTvIdByImdbId(source.getImdbId());
        if (tmdbIdOpt.isEmpty()) {
            log.debug("Could not resolve a TMDB id for '{}' (imdbId={}); skipping for title-based sourcing",
                source.getTitle(), source.getImdbId());
            return;
        }

        int tmdbId = tmdbIdOpt.get();
        List<TmdbCandidate> candidates = tmdbClient.recommendations(tmdbId);
        if (candidates.isEmpty()) {
            candidates = tmdbClient.similar(tmdbId);
        }
        for (TmdbCandidate c : candidates) {
            raw.add(new RawCandidate(c, source));
        }
    }

    private List<RawCandidate> genreBasedSupplement(List<SeriesEntity> pool) {
        Map<String, Long> genreCounts = pool.stream()
            .flatMap(e -> splitGenres(e.getGenres()).stream())
            .collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()));

        if (genreCounts.isEmpty()) {
            return List.of();
        }

        long max = genreCounts.values().stream().mapToLong(Long::longValue).max().orElse(0);
        List<Integer> genreIds = genreCounts.entrySet().stream()
            .filter(e -> e.getValue() == max)
            .map(Map.Entry::getKey)
            .map(genreTable::idFor)
            .filter(Objects::nonNull)
            .distinct()
            .collect(Collectors.toList());

        if (genreIds.isEmpty()) {
            return List.of();
        }

        // Not a directed-sourcing call (RecommendationCriteria.discoverSortBy doesn't apply
        // here -- this candidate pool still flows through Requirement 7's ranking/diversity
        // cap normally, unlike sourceByGenreOrKeyword's bypassed path), so TMDB's own default
        // is used directly rather than resolving discoverSortBy.
        return tmdbClient.discover(genreIds, List.of(), DEFAULT_GENRE_SORT_BY).stream()
            .map(c -> new RawCandidate(c, null))
            .collect(Collectors.toList());
    }

    private static List<String> splitGenres(String genres) {
        if (genres == null || genres.isBlank()) {
            return List.of();
        }
        return Arrays.stream(genres.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toList());
    }

    // -- Requirement 6 (Spec 006): filtering & deduplication --

    private List<DedupedCandidate> dedupeAndExclude(List<RawCandidate> raw) {
        Map<String, TmdbCandidate> candidateByImdbId = new LinkedHashMap<>();
        Map<String, List<SeriesEntity>> sourcesByImdbId = new LinkedHashMap<>();

        for (RawCandidate rc : raw) {
            Optional<String> imdbIdOpt = tmdbClient.externalIds(rc.candidate().tmdbId());
            if (imdbIdOpt.isEmpty()) {
                continue;
            }
            String imdbId = imdbIdOpt.get();

            if (candidateByImdbId.containsKey(imdbId)) {
                // SERIES-015-AC-02: a duplicate's source series is accumulated, not discarded.
                if (rc.sourceSeries() != null) {
                    sourcesByImdbId.get(imdbId).add(rc.sourceSeries());
                }
                continue;
            }

            if (seriesRepository.existsByImdbId(imdbId) || ignoredSeriesRepository.existsByImdbId(imdbId)) {
                continue;
            }

            candidateByImdbId.put(imdbId, rc.candidate());
            List<SeriesEntity> sources = new ArrayList<>();
            if (rc.sourceSeries() != null) {
                // SERIES-015-AC-04: the first-seen source seeds the accumulated list.
                sources.add(rc.sourceSeries());
            }
            sourcesByImdbId.put(imdbId, sources);
        }

        return candidateByImdbId.entrySet().stream()
            .map(e -> new DedupedCandidate(e.getValue(), orderSources(sourcesByImdbId.get(e.getKey())), e.getKey()))
            .collect(Collectors.toList());
    }

    /**
     * Applies the canonical per-candidate source ordering (SERIES-015-AC-05) once, so scoring,
     * {@code best-source} diversity-cap mode, and {@code RecommendationDto.sourceTitles} all
     * read the same order (SERIES-015-AC-06). A genre/keyword-only candidate's empty list
     * (SERIES-015-AC-03) sorts to another empty list.
     */
    private List<SeriesEntity> orderSources(List<SeriesEntity> sources) {
        return sources.stream().sorted(SOURCE_ORDER_COMPARATOR).collect(Collectors.toList());
    }

    // -- Requirement 8: output filters (SERIES-007-AC-23..29) --

    private List<DedupedCandidate> applyOutputFilters(List<DedupedCandidate> candidates, RecommendationCriteria c) {
        // SERIES-024-AC-11/12: the post-hoc default is likewise 200 for topRated, 20 otherwise.
        int defaultMinVoteCount = "topRated".equals(c.getSourceMode())
            ? DEFAULT_MIN_VOTE_COUNT_TOP_RATED : DEFAULT_MIN_VOTE_COUNT;
        int effectiveMinVoteCount = c.getMinVoteCount() != null ? c.getMinVoteCount() : defaultMinVoteCount;
        return candidates.stream()
            .filter(dc -> matchesMinTmdbRating(dc.candidate(), c.getMinTmdbRating()))
            .filter(dc -> matchesMinVoteCount(dc.candidate(), effectiveMinVoteCount))
            .filter(dc -> matchesYearRange(dc.candidate(), c.getYearMin(), c.getYearMax()))
            .filter(dc -> matchesExcludeGenres(dc.candidate(), c.getExcludeGenres()))
            .filter(dc -> matchesLanguage(dc.candidate(), c.getLanguage()))
            // SERIES-024-AC-05: run last -- the only filter with a per-candidate extra call,
            // so it only ever runs against the smallest possible remaining pool.
            .filter(dc -> matchesExcludeKeywords(dc.candidate(), c.getExcludeKeywords()))
            .collect(Collectors.toList());
    }

    private boolean matchesMinTmdbRating(TmdbCandidate c, BigDecimal minTmdbRating) {
        if (minTmdbRating == null) {
            return true;
        }
        return c.voteAverage() != null && c.voteAverage().compareTo(minTmdbRating) >= 0;
    }

    private boolean matchesMinVoteCount(TmdbCandidate c, int effectiveMinVoteCount) {
        int voteCount = c.voteCount() != null ? c.voteCount() : 0;
        return voteCount >= effectiveMinVoteCount;
    }

    /** A null {@code year} can't be verified to satisfy an active range, so it's excluded rather than assumed to pass. */
    private boolean matchesYearRange(TmdbCandidate c, Integer yearMin, Integer yearMax) {
        if (yearMin == null && yearMax == null) {
            return true;
        }
        if (c.year() == null) {
            return false;
        }
        if (yearMin != null && c.year() < yearMin) {
            return false;
        }
        return yearMax == null || c.year() <= yearMax;
    }

    private boolean matchesExcludeGenres(TmdbCandidate c, List<String> excludeGenres) {
        if (excludeGenres == null || excludeGenres.isEmpty()) {
            return true;
        }
        String genresDisplay = joinGenres(c.genreIds());
        if (genresDisplay == null) {
            return true;
        }
        Set<String> candidateGenres = Arrays.stream(genresDisplay.split(","))
            .map(String::trim)
            .collect(Collectors.toSet());
        return excludeGenres.stream().noneMatch(excluded ->
            candidateGenres.stream().anyMatch(g -> g.equalsIgnoreCase(excluded.trim())));
    }

    private boolean matchesLanguage(TmdbCandidate c, String language) {
        if (language == null || language.isBlank()) {
            return true;
        }
        return c.originalLanguage() != null && language.equalsIgnoreCase(c.originalLanguage());
    }

    /**
     * SERIES-024-AC-03/04/06/07: a true no-op (zero {@code TmdbClient} calls) when {@code
     * excludeKeywords} is null/empty. Otherwise fetches the candidate's TMDB keywords via
     * {@link TmdbClient#showKeywords(int)} and excludes it if any keyword name
     * case-insensitively matches an entry in {@code excludeKeywords}. A {@code
     * showKeywords} failure fails this one candidate open (not excluded) rather than
     * propagating, mirroring {@code KeywordSyncService.syncKeywords}'s degrade-gracefully
     * pattern around the same {@code TmdbClient} method.
     */
    private boolean matchesExcludeKeywords(TmdbCandidate c, List<String> excludeKeywords) {
        if (excludeKeywords == null || excludeKeywords.isEmpty()) {
            return true;
        }
        List<TmdbKeyword> candidateKeywords;
        try {
            candidateKeywords = tmdbClient.showKeywords(c.tmdbId());
        } catch (ExternalServiceException e) {
            log.info("TMDB keyword lookup unavailable for candidate tmdbId={}, excludeKeywords filter fails open: {}",
                c.tmdbId(), e.getMessage());
            return true;
        }
        return excludeKeywords.stream().noneMatch(excluded ->
            candidateKeywords.stream().anyMatch(k -> k.name() != null && k.name().equalsIgnoreCase(excluded.trim())));
    }

    // -- Requirement 7: output ranking & diversity cap (SERIES-007-AC-21/22) --

    private ScoredCandidate score(DedupedCandidate dc, int effectiveMaxSourcesShown) {
        double tmdbRating = dc.candidate().voteAverage() != null ? dc.candidate().voteAverage().doubleValue() : 0.0;
        RecommendationDto dto = toDto(dc, effectiveMaxSourcesShown);

        double rankScore;
        if (!dc.sourceSeries().isEmpty()) {
            // SERIES-015-AC-07: the max personalRating across all contributing sources --
            // equivalently the first entry's personalRating under the canonical ordering
            // (SERIES-015-AC-05), since that ordering is personalRating-descending.
            Integer maxPersonalRating = dc.sourceSeries().get(0).getPersonalRating();
            double personalRatingTerm = maxPersonalRating != null ? maxPersonalRating * 2 : 0;
            rankScore = (tmdbRating * 0.5) + (personalRatingTerm * 0.5);
        } else {
            rankScore = tmdbRating;
        }

        List<String> allSourceTitles = dc.sourceSeries().stream()
            .map(SeriesEntity::getTitle)
            .collect(Collectors.toList());
        return new ScoredCandidate(dto, rankScore, allSourceTitles);
    }

    /**
     * Branches the ranking sort on {@link RecommendationCriteria#getSortBy()}
     * (SERIES-015-AC-19/20/21): {@code "score"} (default) sorts by {@code rankScore}
     * descending; {@code "recommendationCount"} sorts by {@code totalSourceCount} descending,
     * with {@code rankScore} descending as a tiebreaker. Any other value falls back to {@code
     * "score"}.
     */
    private Comparator<ScoredCandidate> resolveSortComparator(RecommendationCriteria c) {
        if ("recommendationCount".equals(c.getSortBy())) {
            return Comparator
                .comparingInt((ScoredCandidate sc) -> sc.dto().totalSourceCount())
                .thenComparingDouble(ScoredCandidate::rankScore)
                .reversed();
        }
        return Comparator.comparingDouble(ScoredCandidate::rankScore).reversed();
    }

    /**
     * SERIES-015-AC-15/16/17/18: either mode never caps a candidate with no contributing
     * sources. {@code "best-source"} (default, and the fallback for any unrecognized {@link
     * #diversityCapMode} value) checks/increments only the candidate's best contributing
     * source (the first entry under the canonical ordering); {@code "all-sources"}
     * checks/increments every contributing source.
     */
    private List<ScoredCandidate> applyDiversityCap(List<ScoredCandidate> ranked, int maxPerSource) {
        boolean allSourcesMode = "all-sources".equals(diversityCapMode);
        Map<String, Integer> perSourceCount = new HashMap<>();
        List<ScoredCandidate> result = new ArrayList<>();
        for (ScoredCandidate sc : ranked) {
            List<String> sourceTitles = sc.allSourceTitles();
            if (sourceTitles.isEmpty()) {
                result.add(sc);
                continue;
            }

            if (allSourcesMode) {
                boolean anySourceAtCap = sourceTitles.stream()
                    .anyMatch(title -> perSourceCount.getOrDefault(title, 0) >= maxPerSource);
                if (!anySourceAtCap) {
                    result.add(sc);
                    for (String title : sourceTitles) {
                        perSourceCount.merge(title, 1, Integer::sum);
                    }
                }
            } else {
                String bestSourceTitle = sourceTitles.get(0);
                int count = perSourceCount.getOrDefault(bestSourceTitle, 0);
                if (count < maxPerSource) {
                    result.add(sc);
                    perSourceCount.put(bestSourceTitle, count + 1);
                }
            }
        }
        return result;
    }

    private RecommendationDto toDto(DedupedCandidate dc, int effectiveMaxSourcesShown) {
        TmdbCandidate c = dc.candidate();
        List<String> sourceTitles = dc.sourceSeries().stream()
            .map(SeriesEntity::getTitle)
            .limit(effectiveMaxSourcesShown)
            .collect(Collectors.toList());
        return new RecommendationDto(
            c.title(),
            c.year(),
            joinGenres(c.genreIds()),
            c.overview(),
            c.posterPath() != null ? TmdbClient.POSTER_BASE_URL + c.posterPath() : null,
            c.voteAverage(),
            c.voteCount(),
            streamingProviders(c.tmdbId()),
            dc.imdbId(),
            sourceTitles,
            dc.sourceSeries().size(),
            c.originCountry(),
            c.tmdbId()
        );
    }

    /**
     * SERIES-020-AC-05/06: resolves a candidate's currently-available flatrate streaming
     * providers in {@link #watchRegion}, mapping each {@link TmdbWatchProvider} to a {@link
     * RecommendationDto.StreamingProvider} with a fully-built {@code logoUrl}. A lookup
     * failure (any reason) is caught, logged, and yields an empty list for that one candidate
     * -- it never fails or omits the candidate from the overall response, matching every other
     * upstream-call posture in this service. {@code watchProviders} itself never returns
     * {@code null} (SERIES-020-AC-02); the extra null-guard here is defense-in-depth only.
     */
    private List<RecommendationDto.StreamingProvider> streamingProviders(int tmdbId) {
        List<TmdbWatchProvider> providers;
        try {
            providers = tmdbClient.watchProviders(tmdbId, watchRegion);
        } catch (ExternalServiceException e) {
            log.info("TMDB watch-provider lookup unavailable for candidate tmdbId={}, streamingProviders left empty: {}",
                tmdbId, e.getMessage());
            return List.of();
        }
        if (providers == null) {
            return List.of();
        }
        return providers.stream()
            .map(p -> new RecommendationDto.StreamingProvider(
                p.providerName(),
                p.logoPath() != null ? TmdbClient.PROVIDER_LOGO_BASE_URL + p.logoPath() : null))
            .collect(Collectors.toList());
    }

    /**
     * Backs {@code GET /api/v1/series/recommendations/{tmdbId}/keywords} (SERIES-023-AC-04/05):
     * an on-demand, single-candidate keyword lookup, deliberately not folded into {@link
     * #recommend(int, RecommendationCriteria)} itself -- fetching keywords for every card in a
     * 10-20-result list would cost a TMDB call per card the user never asked to expand (see
     * {@code series_spec_023_recommendation_metadata_and_overview.md}'s Overview). A TMDB
     * failure or an unresolvable {@code tmdbId} both yield an empty list, never an exception
     * (SERIES-023-AC-06) -- there's no persisted entity here for a "leave unchanged" posture to
     * apply to, so this is simply "no keywords available right now".
     */
    @Transactional(readOnly = true)
    public List<String> getKeywordsForCandidate(int tmdbId) {
        try {
            return tmdbClient.showKeywords(tmdbId).stream()
                .map(TmdbKeyword::name)
                .collect(Collectors.toList());
        } catch (ExternalServiceException e) {
            log.info("TMDB keywords unavailable for tmdbId={}: {}", tmdbId, e.getMessage());
            return List.of();
        }
    }

    private String joinGenres(List<Integer> genreIds) {
        if (genreIds == null || genreIds.isEmpty()) {
            return null;
        }
        String joined = genreIds.stream()
            .map(genreTable::displayNameFor)
            .filter(Objects::nonNull)
            .distinct()
            .collect(Collectors.joining(", "));
        return joined.isEmpty() ? null : joined;
    }

    /** A raw TMDB candidate paired with the pool series it was sourced from, if any (null for genre/keyword-sourced). */
    private record RawCandidate(TmdbCandidate candidate, SeriesEntity sourceSeries) {}

    /**
     * A raw candidate that survived dedupe/already-added/already-ignored filtering, with its
     * resolved imdb_id. {@code sourceSeries} accumulates every distinct watched series that
     * recommended this candidate (SERIES-015-AC-01/02/04), ordered by the canonical
     * per-candidate ordering (SERIES-015-AC-05) -- an empty list, never {@code null}, for a
     * candidate sourced only via genre/keyword discovery (SERIES-015-AC-03).
     */
    private record DedupedCandidate(TmdbCandidate candidate, List<SeriesEntity> sourceSeries, String imdbId) {}

    /**
     * A final candidate paired with its computed {@code rankScore} (SERIES-007-AC-21),
     * pre-diversity-cap, and the full (uncapped, canonically-ordered) list of contributing
     * source titles -- needed by {@code all-sources} diversity-cap mode (SERIES-015-AC-16),
     * which must see every contributing source even beyond {@code dto.sourceTitles()}'s
     * {@code maxSourcesShown} cap.
     */
    private record ScoredCandidate(RecommendationDto dto, double rankScore, List<String> allSourceTitles) {}
}
