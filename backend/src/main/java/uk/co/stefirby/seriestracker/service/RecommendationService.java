package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.TmdbCandidate;
import uk.co.stefirby.seriestracker.client.TmdbClient;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.model.SeriesStatus;
import uk.co.stefirby.seriestracker.repository.IgnoredSeriesRepository;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Backs {@code GET /api/v1/series/recommendations}. Sources candidates from TMDB using two
 * signals -- series similar/recommended-alongside the user's own completed series
 * (title-based, Requirement 4), supplemented by genre-based discovery when title-based
 * sourcing comes up short (Requirement 5) -- then filters out anything already added or
 * already ignored and deduplicates (Requirement 6). See
 * {@code series_spec_006_recommendations.md} for the full design rationale.
 */
@Service
public class RecommendationService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationService.class);

    /**
     * Upper bound on how many {@code COMPLETED} series (with a resolvable {@code imdbId})
     * are used as the title-based "watched" signal (SERIES-006-AC-14), guarding against a
     * data anomaly (e.g. hundreds of completed series) turning one request into hundreds of
     * outbound TMDB calls.
     */
    static final int TMDB_MAX_SOURCE_SERIES = 20;

    /**
     * Upper bound on the combined raw candidate pool (title- + genre-based) before
     * {@code external_ids} is resolved for each one (SERIES-006-AC-21), bounding the number
     * of subsequent outbound TMDB calls.
     */
    static final int TMDB_MAX_CANDIDATES = 50;

    /**
     * Static genre name -&gt; TMDB TV genre id mapping, per
     * {@code series_spec_006_recommendations.md} Requirement 5. Genre names OMDb/this app
     * writes that have no equivalent in TMDB's fixed 16 TV genres (e.g. {@code Thriller},
     * {@code Horror}, {@code Biography}) are simply absent -- skipped, not an error
     * (SERIES-006-AC-18).
     */
    private static final Map<String, Integer> GENRE_NAME_TO_TMDB_ID = Map.ofEntries(
        Map.entry("Action", 10759),
        Map.entry("Adventure", 10759),
        Map.entry("Animation", 16),
        Map.entry("Comedy", 35),
        Map.entry("Crime", 80),
        Map.entry("Documentary", 99),
        Map.entry("Drama", 18),
        Map.entry("Family", 10751),
        Map.entry("Kids", 10762),
        Map.entry("Mystery", 9648),
        Map.entry("News", 10763),
        Map.entry("Reality", 10764),
        Map.entry("Sci-Fi", 10765),
        Map.entry("Fantasy", 10765),
        Map.entry("Soap", 10766),
        Map.entry("Talk-Show", 10767),
        Map.entry("War", 10768),
        Map.entry("Western", 37)
    );

    /**
     * Reverse of {@link #GENRE_NAME_TO_TMDB_ID}, using TMDB's own canonical TV genre names
     * (e.g. {@code 10759 -> "Action & Adventure"}) rather than this app's OMDb-derived
     * vocabulary -- used only to render {@link RecommendationDto#genres()} from a TMDB
     * candidate's {@code genre_ids}, which is informational display text, not a value that
     * needs to round-trip through {@link #GENRE_NAME_TO_TMDB_ID}.
     */
    private static final Map<Integer, String> TMDB_ID_TO_GENRE_NAME = Map.ofEntries(
        Map.entry(10759, "Action & Adventure"),
        Map.entry(16, "Animation"),
        Map.entry(35, "Comedy"),
        Map.entry(80, "Crime"),
        Map.entry(99, "Documentary"),
        Map.entry(18, "Drama"),
        Map.entry(10751, "Family"),
        Map.entry(10762, "Kids"),
        Map.entry(9648, "Mystery"),
        Map.entry(10763, "News"),
        Map.entry(10764, "Reality"),
        Map.entry(10765, "Sci-Fi & Fantasy"),
        Map.entry(10766, "Soap"),
        Map.entry(10767, "Talk"),
        Map.entry(10768, "War & Politics"),
        Map.entry(37, "Western")
    );

    private static final String POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

    private final SeriesRepository seriesRepository;
    private final IgnoredSeriesRepository ignoredSeriesRepository;
    private final TmdbClient tmdbClient;

    public RecommendationService(SeriesRepository seriesRepository,
                                  IgnoredSeriesRepository ignoredSeriesRepository,
                                  TmdbClient tmdbClient) {
        this.seriesRepository = seriesRepository;
        this.ignoredSeriesRepository = ignoredSeriesRepository;
        this.tmdbClient = tmdbClient;
    }

    @Transactional(readOnly = true)
    public List<RecommendationDto> recommend(int limit) {
        List<SeriesEntity> watchedPool = watchedPool();
        if (watchedPool.isEmpty()) {
            log.debug("No COMPLETED series with an imdbId yet; skipping recommendation sourcing entirely");
            return List.of();
        }

        List<RawCandidate> raw = new ArrayList<>();
        for (SeriesEntity source : watchedPool) {
            sourceTitleBased(source, raw);
        }

        long distinctTitleBased = raw.stream().map(r -> r.candidate().tmdbId()).distinct().count();
        if (distinctTitleBased < limit) {
            raw.addAll(genreBased(watchedPool));
        }

        List<RawCandidate> capped = raw.size() > TMDB_MAX_CANDIDATES
            ? raw.subList(0, TMDB_MAX_CANDIDATES)
            : raw;

        return filterAndDedupe(capped, limit);
    }

    private List<SeriesEntity> watchedPool() {
        return seriesRepository.findAll().stream()
            .filter(e -> e.getStatus() == SeriesStatus.COMPLETED
                && e.getImdbId() != null
                && !e.getImdbId().isBlank())
            .sorted(Comparator.comparing(SeriesEntity::getDateCompleted,
                Comparator.nullsLast(Comparator.reverseOrder())))
            .limit(TMDB_MAX_SOURCE_SERIES)
            .collect(Collectors.toList());
    }

    private void sourceTitleBased(SeriesEntity source, List<RawCandidate> raw) {
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
            raw.add(new RawCandidate(c, source.getTitle()));
        }
    }

    private List<RawCandidate> genreBased(List<SeriesEntity> watchedPool) {
        Map<String, Long> genreCounts = watchedPool.stream()
            .flatMap(e -> splitGenres(e.getGenres()).stream())
            .collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()));

        if (genreCounts.isEmpty()) {
            return List.of();
        }

        long max = genreCounts.values().stream().mapToLong(Long::longValue).max().orElse(0);
        List<Integer> genreIds = genreCounts.entrySet().stream()
            .filter(e -> e.getValue() == max)
            .map(Map.Entry::getKey)
            .map(GENRE_NAME_TO_TMDB_ID::get)
            .filter(Objects::nonNull)
            .distinct()
            .collect(Collectors.toList());

        if (genreIds.isEmpty()) {
            return List.of();
        }

        return tmdbClient.discoverByGenre(genreIds).stream()
            .map(c -> new RawCandidate(c, null))
            .collect(Collectors.toList());
    }

    private List<RecommendationDto> filterAndDedupe(List<RawCandidate> raw, int limit) {
        Map<String, RecommendationDto> deduped = new LinkedHashMap<>();
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
            deduped.put(imdbId, toDto(rc, imdbId));
        }

        return deduped.values().stream().limit(limit).collect(Collectors.toList());
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

    private static RecommendationDto toDto(RawCandidate rc, String imdbId) {
        TmdbCandidate c = rc.candidate();
        return new RecommendationDto(
            c.title(),
            c.year(),
            joinGenres(c.genreIds()),
            c.overview(),
            c.posterPath() != null ? POSTER_BASE_URL + c.posterPath() : null,
            c.voteAverage(),
            imdbId,
            rc.sourceTitle()
        );
    }

    private static String joinGenres(List<Integer> genreIds) {
        if (genreIds == null || genreIds.isEmpty()) {
            return null;
        }
        String joined = genreIds.stream()
            .map(TMDB_ID_TO_GENRE_NAME::get)
            .filter(Objects::nonNull)
            .distinct()
            .collect(Collectors.joining(", "));
        return joined.isEmpty() ? null : joined;
    }

    /** A raw TMDB candidate paired with the watched-pool series it was sourced from, if any. */
    private record RawCandidate(TmdbCandidate candidate, String sourceTitle) {}
}
