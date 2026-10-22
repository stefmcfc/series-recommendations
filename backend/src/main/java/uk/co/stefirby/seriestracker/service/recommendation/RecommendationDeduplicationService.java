package uk.co.stefirby.seriestracker.service.recommendation;

import uk.co.stefirby.seriestracker.client.tmdb.TmdbCandidate;
import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.repository.IgnoredSeriesRepository;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Dedup/already-added/already-ignored exclusion (Requirement 6, Spec 006), extracted from
 * {@code RecommendationService} (TOOLING-003-AC-13/14).
 */
@Service
public class RecommendationDeduplicationService {

    private final SeriesRepository seriesRepository;
    private final IgnoredSeriesRepository ignoredSeriesRepository;
    private final TmdbClient tmdbClient;

    public RecommendationDeduplicationService(SeriesRepository seriesRepository,
                                               IgnoredSeriesRepository ignoredSeriesRepository,
                                               TmdbClient tmdbClient) {
        this.seriesRepository = seriesRepository;
        this.ignoredSeriesRepository = ignoredSeriesRepository;
        this.tmdbClient = tmdbClient;
    }

    /**
     * SERIES-068-AC-07: {@code sourceOrderComparator} is resolved once by whichever caller has
     * {@code RecommendationCriteria} in scope ({@code SourceOrderComparator.forStrategy(criteria)}
     * for "Use My Series", or the unparameterized {@code SourceOrderComparator.INSTANCE} for the
     * 3 discover-backfill modes, which never have a non-empty {@code sourceSeries} to reorder --
     * see this spec's Design Decisions) and threaded through to {@link #orderSources}.
     */
    List<DedupedCandidate> dedupeAndExclude(List<RawCandidate> raw, Comparator<SeriesEntity> sourceOrderComparator,
                                             boolean includeAlreadyTracked) {
        // SERIES-059-AC-07: a fresh, call-scoped cache when there's no shared cache to pass in
        // (e.g. sourceFromPool's single dedupeAndExclude call) -- equivalent to no memoization
        // at all for a single call, but lets sourceWithBackfill's multi-page loop share one
        // cache across several calls via the overload below.
        return dedupeAndExclude(raw, new HashMap<>(), sourceOrderComparator, includeAlreadyTracked);
    }

    /**
     * SERIES-059-AC-07: overload accepting a caller-supplied {@code externalIdCache}, keyed by
     * {@code tmdbId}, so a {@code tmdbId} already resolved earlier in the same request (whether
     * by an earlier element of {@code raw} itself or an earlier call sharing the same map, as
     * {@code RecommendationSourcingService.sourceWithBackfill} does across pages) is never
     * re-resolved via {@link TmdbClient#externalIds(int)}.
     *
     * <p>{@code includeAlreadyTracked} (SERIES-071-AC-02) bypasses only the already-tracked
     * half of the exclusion check in {@link #accumulateCandidate} when {@code true} -- the
     * already-ignored half stays absolute regardless (SERIES-071-AC-03).
     */
    List<DedupedCandidate> dedupeAndExclude(List<RawCandidate> raw, Map<Integer, Optional<String>> externalIdCache,
                                             Comparator<SeriesEntity> sourceOrderComparator, boolean includeAlreadyTracked) {
        Map<String, TmdbCandidate> candidateByImdbId = new LinkedHashMap<>();
        Map<String, List<SeriesEntity>> sourcesByImdbId = new LinkedHashMap<>();
        Map<String, SeriesEntity> trackedSeriesByImdbId = new LinkedHashMap<>();

        for (RawCandidate rc : raw) {
            accumulateCandidate(rc, candidateByImdbId, sourcesByImdbId, trackedSeriesByImdbId, externalIdCache, includeAlreadyTracked);
        }

        return candidateByImdbId.entrySet().stream()
            .map(e -> new DedupedCandidate(e.getValue(), orderSources(sourcesByImdbId.get(e.getKey()), sourceOrderComparator),
                e.getKey(), trackedSeriesByImdbId.get(e.getKey())))
            .toList();
    }

    /**
     * Resolves {@code rc}'s imdb_id and folds it into {@code candidateByImdbId}/{@code
     * sourcesByImdbId}/{@code trackedSeriesByImdbId} -- extracted from {@link
     * #dedupeAndExclude}'s loop so each early-exit case below is a {@code return} rather than a
     * {@code continue} (java:S135).
     *
     * <p>SERIES-071-AC-02/03/04: the already-ignored check stays an absolute, unconditional
     * exclusion. The already-tracked check only excludes when {@code includeAlreadyTracked} is
     * {@code false}; when it's {@code true} and a match exists, the matched {@link SeriesEntity}
     * is fetched once (via {@link SeriesRepository#findByImdbId}) and recorded in {@code
     * trackedSeriesByImdbId} rather than re-queried later at DTO-assembly time.
     */
    private void accumulateCandidate(RawCandidate rc,
                                      Map<String, TmdbCandidate> candidateByImdbId,
                                      Map<String, List<SeriesEntity>> sourcesByImdbId,
                                      Map<String, SeriesEntity> trackedSeriesByImdbId,
                                      Map<Integer, Optional<String>> externalIdCache,
                                      boolean includeAlreadyTracked) {
        Optional<String> imdbIdOpt = externalIdCache.computeIfAbsent(rc.candidate().tmdbId(), tmdbClient::externalIds);
        if (imdbIdOpt.isEmpty()) {
            return;
        }
        String imdbId = imdbIdOpt.get();

        if (candidateByImdbId.containsKey(imdbId)) {
            // SERIES-015-AC-02: a duplicate's source series is accumulated, not discarded.
            if (rc.sourceSeries() != null) {
                sourcesByImdbId.get(imdbId).add(rc.sourceSeries());
            }
            return;
        }

        if (ignoredSeriesRepository.existsByImdbId(imdbId)) {
            return;
        }

        SeriesEntity trackedSeries = null;
        if (seriesRepository.existsByImdbId(imdbId)) {
            if (!includeAlreadyTracked) {
                return;
            }
            trackedSeries = seriesRepository.findByImdbId(imdbId).orElse(null);
        }

        candidateByImdbId.put(imdbId, rc.candidate());
        List<SeriesEntity> sources = new ArrayList<>();
        if (rc.sourceSeries() != null) {
            // SERIES-015-AC-04: the first-seen source seeds the accumulated list.
            sources.add(rc.sourceSeries());
        }
        sourcesByImdbId.put(imdbId, sources);
        trackedSeriesByImdbId.put(imdbId, trackedSeries);
    }

    /**
     * Applies the per-candidate source ordering (SERIES-015-AC-05, parameterized by
     * SERIES-068-AC-07) once, so scoring, {@code best-source} diversity-cap mode, and {@code
     * RecommendationDto.sourceTitles} all read the same order (SERIES-015-AC-06). A
     * genre/keyword-only candidate's empty list (SERIES-015-AC-03) sorts to another empty list.
     * Package-private (not {@code private}) so {@code SourceOrderComparatorSpec}/direct callers
     * can exercise it against an explicit comparator without going through the whole {@link
     * #dedupeAndExclude} pipeline.
     */
    List<SeriesEntity> orderSources(List<SeriesEntity> sources, Comparator<SeriesEntity> sourceOrderComparator) {
        return sources.stream().sorted(sourceOrderComparator).toList();
    }
}
