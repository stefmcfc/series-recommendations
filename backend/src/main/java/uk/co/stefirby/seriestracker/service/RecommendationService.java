package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.TmdbCandidate;
import uk.co.stefirby.seriestracker.client.TmdbClient;
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
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

    /** Default for {@link #maxPerSource} when {@link RecommendationCriteria#getMaxPerSource()} is unset (SERIES-007-AC-22). */
    private static final int DEFAULT_MAX_PER_SOURCE = 3;

    /**
     * Default for the {@code minVoteCount} output filter when unset -- the one filter in
     * this spec that isn't a no-op by default (SERIES-007-AC-25). A high {@code voteAverage}
     * from a handful of votes is closer to noise than signal.
     */
    private static final int DEFAULT_MIN_VOTE_COUNT = 20;

    private static final String POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

    private static final TmdbGenreTable GENRE_TABLE = new TmdbGenreTable();

    private final SeriesRepository seriesRepository;
    private final IgnoredSeriesRepository ignoredSeriesRepository;
    private final TmdbClient tmdbClient;

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

    public RecommendationService(SeriesRepository seriesRepository,
                                  IgnoredSeriesRepository ignoredSeriesRepository,
                                  TmdbClient tmdbClient,
                                  @Value("${app.tmdb.max-source-series:20}") int maxSourceSeries,
                                  @Value("${app.tmdb.max-candidates:50}") int maxCandidates) {
        this.seriesRepository = seriesRepository;
        this.ignoredSeriesRepository = ignoredSeriesRepository;
        this.tmdbClient = tmdbClient;
        this.maxSourceSeries = maxSourceSeries;
        this.maxCandidates = maxCandidates;
    }

    /** Convenience overload -- equivalent to {@code recommend(limit, new RecommendationCriteria())}. */
    @Transactional(readOnly = true)
    public List<RecommendationDto> recommend(int limit) {
        return recommend(limit, new RecommendationCriteria());
    }

    @Transactional(readOnly = true)
    public List<RecommendationDto> recommend(int limit, RecommendationCriteria criteria) {
        validate(criteria);

        List<RawCandidate> raw = isDirectedByGenreOrKeyword(criteria)
            ? sourceByGenreOrKeyword(criteria)
            : sourceFromPool(criteria, limit);

        List<RawCandidate> capped = raw.size() > maxCandidates
            ? raw.subList(0, maxCandidates)
            : raw;

        List<DedupedCandidate> deduped = dedupeAndExclude(capped);
        List<DedupedCandidate> filtered = applyOutputFilters(deduped, criteria);

        List<ScoredCandidate> ranked = filtered.stream()
            .map(this::score)
            .sorted(Comparator.comparingDouble(ScoredCandidate::rankScore).reversed())
            .collect(Collectors.toList());

        int effectiveMaxPerSource = criteria.getMaxPerSource() != null ? criteria.getMaxPerSource() : DEFAULT_MAX_PER_SOURCE;
        List<ScoredCandidate> diversified = applyDiversityCap(ranked, effectiveMaxPerSource);

        return diversified.stream()
            .map(ScoredCandidate::dto)
            .limit(limit)
            .collect(Collectors.toList());
    }

    private void validate(RecommendationCriteria c) {
        boolean hasSeriesIds = c.getSeriesIds() != null && !c.getSeriesIds().isEmpty();
        boolean hasGenreOrKeyword = isDirectedByGenreOrKeyword(c);
        if (hasSeriesIds && hasGenreOrKeyword) {
            throw new IllegalArgumentException(
                "seriesIds cannot be combined with genres/keywords -- these are mutually exclusive request modes");
        }
        if (c.getMinSourceRating() != null && (c.getMinSourceRating() < 1 || c.getMinSourceRating() > 5)) {
            throw new IllegalArgumentException("minSourceRating must be between 1 and 5");
        }
    }

    private boolean isDirectedByGenreOrKeyword(RecommendationCriteria c) {
        return (c.getGenres() != null && !c.getGenres().isEmpty())
            || (c.getKeywords() != null && !c.getKeywords().isEmpty());
    }

    // -- Requirement 5: directed sourcing by genre/keyword, bypassing the watched pool entirely --

    private List<RawCandidate> sourceByGenreOrKeyword(RecommendationCriteria c) {
        List<Integer> genreIds = resolveGenreIds(c.getGenres());
        List<Integer> keywordIds = resolveKeywordIds(c.getKeywords());
        return tmdbClient.discover(genreIds, keywordIds).stream()
            .map(candidate -> new RawCandidate(candidate, null))
            .collect(Collectors.toList());
    }

    private List<Integer> resolveGenreIds(List<String> genres) {
        if (genres == null) {
            return List.of();
        }
        return genres.stream()
            .map(GENRE_TABLE::idFor)
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
            .sorted(Comparator
                .comparing(SeriesEntity::getPersonalRating, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(SeriesEntity::getDateCompleted, Comparator.nullsLast(Comparator.reverseOrder())))
            .limit(maxSourceSeries)
            .collect(Collectors.toList());
    }

    /** Automatic "watched" pool (SERIES-006-AC-14): every {@code COMPLETED} series with a resolvable {@code imdbId}. */
    private List<SeriesEntity> automaticPool() {
        return seriesRepository.findAll().stream()
            .filter(e -> e.getStatus() == SeriesStatus.COMPLETED
                && e.getImdbId() != null
                && !e.getImdbId().isBlank())
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
            .map(GENRE_TABLE::idFor)
            .filter(Objects::nonNull)
            .distinct()
            .collect(Collectors.toList());

        if (genreIds.isEmpty()) {
            return List.of();
        }

        return tmdbClient.discover(genreIds, List.of()).stream()
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
        Map<String, DedupedCandidate> deduped = new LinkedHashMap<>();
        for (RawCandidate rc : raw) {
            Optional<String> imdbIdOpt = tmdbClient.externalIds(rc.candidate().tmdbId());
            if (imdbIdOpt.isEmpty()) {
                continue;
            }
            String imdbId = imdbIdOpt.get();
            if (deduped.containsKey(imdbId)) {
                continue;
            }
            if (seriesRepository.existsByImdbId(imdbId) || ignoredSeriesRepository.existsByImdbId(imdbId)) {
                continue;
            }
            deduped.put(imdbId, new DedupedCandidate(rc.candidate(), rc.sourceSeries(), imdbId));
        }
        return new ArrayList<>(deduped.values());
    }

    // -- Requirement 8: output filters (SERIES-007-AC-23..29) --

    private List<DedupedCandidate> applyOutputFilters(List<DedupedCandidate> candidates, RecommendationCriteria c) {
        int effectiveMinVoteCount = c.getMinVoteCount() != null ? c.getMinVoteCount() : DEFAULT_MIN_VOTE_COUNT;
        return candidates.stream()
            .filter(dc -> matchesMinTmdbRating(dc.candidate(), c.getMinTmdbRating()))
            .filter(dc -> matchesMinVoteCount(dc.candidate(), effectiveMinVoteCount))
            .filter(dc -> matchesYearRange(dc.candidate(), c.getYearMin(), c.getYearMax()))
            .filter(dc -> matchesExcludeGenres(dc.candidate(), c.getExcludeGenres()))
            .filter(dc -> matchesLanguage(dc.candidate(), c.getLanguage()))
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

    // -- Requirement 7: output ranking & diversity cap (SERIES-007-AC-21/22) --

    private ScoredCandidate score(DedupedCandidate dc) {
        double tmdbRating = dc.candidate().voteAverage() != null ? dc.candidate().voteAverage().doubleValue() : 0.0;
        RecommendationDto dto = toDto(dc);

        double rankScore;
        if (dc.sourceSeries() != null) {
            Integer personalRating = dc.sourceSeries().getPersonalRating();
            double personalRatingTerm = personalRating != null ? personalRating * 2 : 0;
            rankScore = (tmdbRating * 0.5) + (personalRatingTerm * 0.5);
        } else {
            rankScore = tmdbRating;
        }

        return new ScoredCandidate(dto, rankScore);
    }

    private List<ScoredCandidate> applyDiversityCap(List<ScoredCandidate> ranked, int maxPerSource) {
        Map<String, Integer> perSourceCount = new HashMap<>();
        List<ScoredCandidate> result = new ArrayList<>();
        for (ScoredCandidate sc : ranked) {
            String sourceTitle = sc.dto().sourceTitle();
            if (sourceTitle == null) {
                result.add(sc);
                continue;
            }
            int count = perSourceCount.getOrDefault(sourceTitle, 0);
            if (count < maxPerSource) {
                result.add(sc);
                perSourceCount.put(sourceTitle, count + 1);
            }
        }
        return result;
    }

    private static RecommendationDto toDto(DedupedCandidate dc) {
        TmdbCandidate c = dc.candidate();
        return new RecommendationDto(
            c.title(),
            c.year(),
            joinGenres(c.genreIds()),
            c.overview(),
            c.posterPath() != null ? POSTER_BASE_URL + c.posterPath() : null,
            c.voteAverage(),
            dc.imdbId(),
            dc.sourceSeries() != null ? dc.sourceSeries().getTitle() : null
        );
    }

    private static String joinGenres(List<Integer> genreIds) {
        if (genreIds == null || genreIds.isEmpty()) {
            return null;
        }
        String joined = genreIds.stream()
            .map(GENRE_TABLE::displayNameFor)
            .filter(Objects::nonNull)
            .distinct()
            .collect(Collectors.joining(", "));
        return joined.isEmpty() ? null : joined;
    }

    /** A raw TMDB candidate paired with the pool series it was sourced from, if any (null for genre/keyword-sourced). */
    private record RawCandidate(TmdbCandidate candidate, SeriesEntity sourceSeries) {}

    /** A raw candidate that survived dedupe/already-added/already-ignored filtering, with its resolved imdb_id. */
    private record DedupedCandidate(TmdbCandidate candidate, SeriesEntity sourceSeries, String imdbId) {}

    /** A final candidate paired with its computed {@code rankScore} (SERIES-007-AC-21), pre-diversity-cap. */
    private record ScoredCandidate(RecommendationDto dto, double rankScore) {}
}
