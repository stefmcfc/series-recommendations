package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient;
import uk.co.stefirby.seriestracker.client.tmdb.TmdbWatchProvider;
import uk.co.stefirby.seriestracker.dto.RecommendationDto;
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException;
import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Streaming-availability lookup, extracted from {@code RecommendationService}
 * (TOOLING-003-AC-07..10): a per-candidate helper reused by both recommendation DTO assembly
 * and the standalone per-series {@code GET /api/v1/series/{id}/watch-providers} endpoint --
 * not itself recommendation logic, so it doesn't belong on {@code RecommendationService}.
 */
@Service
public class WatchProviderService {

    private static final Logger log = LoggerFactory.getLogger(WatchProviderService.class);

    private final SeriesRepository seriesRepository;
    private final TmdbClient tmdbClient;

    /**
     * Region passed to {@link TmdbClient#watchProviders(int, String)} for every candidate
     * (SERIES-020-AC-05) -- a single configured value, not a per-request parameter, per {@code
     * series_spec_020_watch_providers.md}'s Design Decisions (this is a single-user personal
     * app with one household's viewing region).
     */
    private final String watchRegion;

    public WatchProviderService(SeriesRepository seriesRepository,
                                 TmdbClient tmdbClient,
                                 @Value("${app.tmdb.watch-region:GB}") String watchRegion) {
        this.seriesRepository = seriesRepository;
        this.tmdbClient = tmdbClient;
        this.watchRegion = watchRegion;
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
    public List<RecommendationDto.StreamingProvider> streamingProviders(int tmdbId) {
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
            .toList();
    }

    /**
     * Backs {@code GET /api/v1/series/{id}/watch-providers} (SERIES-026-AC-01..05): an
     * on-demand streaming-availability check for a <em>tracked</em> series, never persisted.
     * A genuinely unknown {@code id} is the only error case (404, matching {@code
     * getById}/{@code update}/{@code delete}/{@code refresh}); a missing/unresolvable {@code
     * imdbId} both yield an empty list rather than an error (SERIES-026-AC-03/04), and once a
     * {@code tmdbId} is resolved this delegates straight to {@link #streamingProviders(int)}
     * (Series Spec 020), reusing its own graceful degradation on a {@code watchProviders}
     * failure verbatim (SERIES-026-AC-05).
     */
    @Transactional(readOnly = true)
    public List<RecommendationDto.StreamingProvider> getStreamingProvidersForSeries(UUID id) {
        SeriesEntity series = seriesRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Series not found with id: " + id));

        String imdbId = series.getImdbId();
        if (imdbId == null || imdbId.isBlank()) {
            return List.of();
        }

        return tmdbClient.findTvIdByImdbId(imdbId)
            .map(this::streamingProviders)
            .orElse(List.of());
    }
}
