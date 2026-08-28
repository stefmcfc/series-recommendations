package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.DiscoverFilters;
import uk.co.stefirby.seriestracker.client.TmdbCandidate;
import uk.co.stefirby.seriestracker.client.TmdbClient;
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.model.SeriesStatus;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
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
 * All four candidate-sourcing strategies (trending, top-rated, genre/keyword-directed,
 * pool-based title+genre-supplement) plus source-pool resolution, extracted from {@code
 * RecommendationService} (TOOLING-003-AC-17/18).
 */
@Service
public class RecommendationSourcingService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationSourcingService.class);

    private final SeriesRepository seriesRepository;
    private final TmdbClient tmdbClient;
    private final TmdbGenreTable genreTable;

    /**
     * Upper bound on how many source series (the automatic {@code COMPLETED} pool, or an
     * explicit {@code seriesIds} selection) feed title-based sourcing (SERIES-007-AC-01,
     * superseding the previously hardcoded {@code TMDB_MAX_SOURCE_SERIES = 20}).
     */
    private final int maxSourceSeries;

    /**
     * Default {@code minVoteCount} sourcing-time floor for {@link #sourceByGenreOrKeyword}
     * (SERIES-029-AC-02/07), replacing the former hardcoded {@code
     * RecommendationDefaults.DEFAULT_MIN_VOTE_COUNT = 20}. Overridable via
     * {@code APP_TMDB_DEFAULT_MIN_VOTE_COUNT} without a code change.
     */
    private final int defaultMinVoteCount;

    public RecommendationSourcingService(SeriesRepository seriesRepository,
                                          TmdbClient tmdbClient,
                                          TmdbGenreTable genreTable,
                                          @Value("${app.tmdb.max-source-series:20}") int maxSourceSeries,
                                          @Value("${app.tmdb.default-min-vote-count:200}") int defaultMinVoteCount) {
        this.seriesRepository = seriesRepository;
        this.tmdbClient = tmdbClient;
        this.genreTable = genreTable;
        this.maxSourceSeries = maxSourceSeries;
        this.defaultMinVoteCount = defaultMinVoteCount;
    }

    // -- Requirement 2 (SERIES-022-AC-07..10): directed sourcing -- trending, bypassing the watched pool entirely --

    public List<RawCandidate> sourceTrending(RecommendationCriteria c) {
        String window = c.getTrendingWindow() != null && !c.getTrendingWindow().isBlank()
            ? c.getTrendingWindow() : "week";
        return tmdbClient.trending(window).stream()
            .map(candidate -> new RawCandidate(candidate, null))
            .toList();
    }

    // -- Requirement 3 (SERIES-022-AC-11..15): directed sourcing -- top rated, bypassing the watched pool entirely --

    public List<RawCandidate> sourceTopRated(RecommendationCriteria c) {
        // SERIES-024-AC-10: topRated's sourcing-time default is 200, not the shared 20.
        int effectiveMinVoteCount = c.getMinVoteCount() != null ? c.getMinVoteCount() : RecommendationDefaults.DEFAULT_MIN_VOTE_COUNT_TOP_RATED;
        // SERIES-025-AC-05: resolve discoverSortBy to vote_average.desc when unset.
        String effectiveSortBy = resolveDiscoverSortBy(c, RecommendationDefaults.DEFAULT_TOP_RATED_SORT_BY);
        return tmdbClient.discoverTopRated(effectiveMinVoteCount, effectiveSortBy).stream()
            .map(candidate -> new RawCandidate(candidate, null))
            .toList();
    }

    // -- Requirement 5: directed sourcing by genre/keyword, bypassing the watched pool entirely --

    public List<RawCandidate> sourceByGenreOrKeyword(RecommendationCriteria c) {
        List<Integer> genreIds = resolveGenreIds(c.getGenres());
        List<Integer> keywordIds = resolveKeywordIds(c.getKeywords());
        // SERIES-025-AC-06: resolve discoverSortBy to popularity.desc when unset.
        String effectiveSortBy = resolveDiscoverSortBy(c, RecommendationDefaults.DEFAULT_GENRE_SORT_BY);
        // SERIES-029-AC-07/09: resolve a sourcing-time minVoteCount floor (mirroring
        // sourceTopRated's own effective-minVoteCount resolution) so TMDB itself only returns
        // candidates worth considering, instead of relying solely on the post-hoc output filter.
        int effectiveMinVoteCount = c.getMinVoteCount() != null ? c.getMinVoteCount() : defaultMinVoteCount;
        // SERIES-031-AC-05/SERIES-032-AC-05: minTmdbRating/yearMin/yearMax/language/countries
        // are read straight from criteria (all already null-means-unset) and sent to TMDB
        // itself, for the same "don't rely solely on a post-hoc filter against one ~20-result
        // page" reason as minVoteCount above.
        DiscoverFilters filters = new DiscoverFilters(effectiveMinVoteCount, c.getMinTmdbRating(), c.getYearMin(),
            c.getYearMax(), c.getLanguage(), c.getCountries());
        return tmdbClient.discover(genreIds, keywordIds, effectiveSortBy, filters).stream()
            .map(candidate -> new RawCandidate(candidate, null))
            .toList();
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
            .toList();
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
            .toList();
    }

    // -- Requirement 4 (Spec 006) / Requirement 4+6 (Spec 007): pool-based (title + genre supplement) sourcing --

    public List<RawCandidate> sourceFromPool(RecommendationCriteria c, int limit) {
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
            .sorted(SourceOrderComparator.INSTANCE)
            .limit(maxSourceSeries)
            .toList();
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
            .toList();
    }

    /**
     * Explicit selection pool (SERIES-007-AC-08): every requested series regardless of
     * status. Rejects the request (SERIES-007-AC-09) if any requested id is malformed or
     * doesn't match an existing {@link SeriesEntity}.
     */
    private List<SeriesEntity> explicitPool(List<String> rawSeriesIds) {
        List<UUID> ids = rawSeriesIds.stream().map(this::parseUuid).distinct().toList();
        List<SeriesEntity> found = seriesRepository.findAllById(ids);
        if (found.size() != ids.size()) {
            Set<UUID> foundIds = found.stream().map(SeriesEntity::getId).collect(Collectors.toSet());
            List<UUID> missing = ids.stream().filter(id -> !foundIds.contains(id)).toList();
            throw new IllegalArgumentException("Unknown series id(s) in seriesIds: " + missing);
        }
        return found;
    }

    private UUID parseUuid(String raw) {
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException _) {
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
            .toList();

        if (genreIds.isEmpty()) {
            return List.of();
        }

        // Not a directed-sourcing call (RecommendationCriteria.discoverSortBy doesn't apply
        // here -- this candidate pool still flows through Requirement 7's ranking/diversity
        // cap normally, unlike sourceByGenreOrKeyword's bypassed path), so TMDB's own default
        // is used directly rather than resolving discoverSortBy. SERIES-029-AC-08/SERIES-031-
        // AC-06: DiscoverFilters.NONE is passed deliberately -- this supplementary pool doesn't
        // have the obscure/brand-new-show problem sourceByGenreOrKeyword's user-selectable sort
        // does, so its request stays byte-identical to before specs 029/031.
        return tmdbClient.discover(genreIds, List.of(), RecommendationDefaults.DEFAULT_GENRE_SORT_BY, DiscoverFilters.NONE).stream()
            .map(c -> new RawCandidate(c, null))
            .toList();
    }

    private static List<String> splitGenres(String genres) {
        if (genres == null || genres.isBlank()) {
            return List.of();
        }
        return Arrays.stream(genres.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
    }
}
