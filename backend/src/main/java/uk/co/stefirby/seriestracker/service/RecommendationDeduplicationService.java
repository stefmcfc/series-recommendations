package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.TmdbCandidate;
import uk.co.stefirby.seriestracker.client.TmdbClient;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.repository.IgnoredSeriesRepository;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
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

    public List<DedupedCandidate> dedupeAndExclude(List<RawCandidate> raw) {
        Map<String, TmdbCandidate> candidateByImdbId = new LinkedHashMap<>();
        Map<String, List<SeriesEntity>> sourcesByImdbId = new LinkedHashMap<>();

        for (RawCandidate rc : raw) {
            accumulateCandidate(rc, candidateByImdbId, sourcesByImdbId);
        }

        return candidateByImdbId.entrySet().stream()
            .map(e -> new DedupedCandidate(e.getValue(), orderSources(sourcesByImdbId.get(e.getKey())), e.getKey()))
            .toList();
    }

    /**
     * Resolves {@code rc}'s imdb_id and folds it into {@code candidateByImdbId}/{@code
     * sourcesByImdbId} -- extracted from {@link #dedupeAndExclude}'s loop so each early-exit
     * case below is a {@code return} rather than a {@code continue} (java:S135).
     */
    private void accumulateCandidate(RawCandidate rc,
                                      Map<String, TmdbCandidate> candidateByImdbId,
                                      Map<String, List<SeriesEntity>> sourcesByImdbId) {
        Optional<String> imdbIdOpt = tmdbClient.externalIds(rc.candidate().tmdbId());
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

        if (seriesRepository.existsByImdbId(imdbId) || ignoredSeriesRepository.existsByImdbId(imdbId)) {
            return;
        }

        candidateByImdbId.put(imdbId, rc.candidate());
        List<SeriesEntity> sources = new ArrayList<>();
        if (rc.sourceSeries() != null) {
            // SERIES-015-AC-04: the first-seen source seeds the accumulated list.
            sources.add(rc.sourceSeries());
        }
        sourcesByImdbId.put(imdbId, sources);
    }

    /**
     * Applies the canonical per-candidate source ordering (SERIES-015-AC-05) once, so scoring,
     * {@code best-source} diversity-cap mode, and {@code RecommendationDto.sourceTitles} all
     * read the same order (SERIES-015-AC-06). A genre/keyword-only candidate's empty list
     * (SERIES-015-AC-03) sorts to another empty list.
     */
    private List<SeriesEntity> orderSources(List<SeriesEntity> sources) {
        return sources.stream().sorted(SourceOrderComparator.INSTANCE).toList();
    }
}
