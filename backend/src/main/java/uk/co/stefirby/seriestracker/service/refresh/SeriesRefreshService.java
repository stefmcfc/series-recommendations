package uk.co.stefirby.seriestracker.service.refresh;

import uk.co.stefirby.seriestracker.client.omdb.OmdbClient;
import uk.co.stefirby.seriestracker.client.omdb.OmdbRatings;
import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient;
import uk.co.stefirby.seriestracker.client.tmdb.TmdbSeriesDetail;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException;
import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.model.SeriesStatus;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import uk.co.stefirby.seriestracker.service.KeywordSyncService;
import uk.co.stefirby.seriestracker.service.SeriesService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Backs {@code POST /api/v1/series/{id}/refresh} (Requirement 1) and is reused, series by
 * series, by {@link BulkRefreshService} (Requirement 3) -- see
 * {@code series_spec_018_series_refresh.md}.
 *
 * <p>Re-fetches TMDB detail (deriving {@code tmdbId} from the entity's {@code imdbId} via
 * {@link TmdbClient#findTvIdByImdbId(String)}, since {@code SeriesEntity} never caches a
 * {@code tmdbId}) and the narrowed OMDb ratings-only call, updating only the external-data
 * fields each source owns. Either source failing is independently non-fatal
 * (SERIES-018-AC-05/AC-06) -- a partial success is saved, not rolled back
 * (SERIES-018-AC-08). {@code title}, {@code genres}, {@code posterUrl}, {@code
 * personalRating}, {@code personalNotes}, {@code status}, {@code currentSeason}, {@code
 * currentEpisode}, {@code imdbId}, {@code dateAdded}, and {@code dateCompleted} are never
 * touched (SERIES-018-AC-04).
 */
@Service
public class SeriesRefreshService {

    private static final Logger log = LoggerFactory.getLogger(SeriesRefreshService.class);

    private final SeriesRepository repository;
    private final TmdbClient tmdbClient;
    private final OmdbClient omdbClient;
    private final SeriesService seriesService;
    private final KeywordSyncService keywordSyncService;
    private final Clock clock;

    public SeriesRefreshService(SeriesRepository repository, TmdbClient tmdbClient,
                                 OmdbClient omdbClient, SeriesService seriesService,
                                 KeywordSyncService keywordSyncService, Clock clock) {
        this.repository = repository;
        this.tmdbClient = tmdbClient;
        this.omdbClient = omdbClient;
        this.seriesService = seriesService;
        this.keywordSyncService = keywordSyncService;
        this.clock = clock;
    }

    @Transactional
    public RefreshResult refresh(UUID id) {
        log.info("Refreshing series: {}", id);
        SeriesEntity entity = repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Series not found with id: " + id));

        // SERIES-018-AC-24/26: captured before the TMDB fetch overwrites these fields, so they
        // represent the "previous" value the fresh result is compared against.
        Integer preSeasons = entity.getTotalSeasons();
        Integer preEpisodes = entity.getTotalEpisodes();
        SeriesStatus preStatus = entity.getStatus();

        boolean tmdbRefreshed = refreshFromTmdb(entity);
        boolean omdbRefreshed = refreshFromOmdb(entity);

        if (tmdbRefreshed || omdbRefreshed) {
            entity.setLastRefreshedAt(LocalDateTime.now(clock));
        }

        applyNewContentDetection(entity, preSeasons, preEpisodes, preStatus);

        entity = repository.save(entity);
        return new RefreshResult(seriesService.entityToDto(entity), omdbRefreshed, tmdbRefreshed);
    }

    /**
     * SERIES-018-AC-24/25/26: sets {@code newContentDetectedAt} when the freshly-fetched
     * {@code totalSeasons}/{@code totalEpisodes} strictly increased over the pre-refresh
     * values captured before the TMDB fetch -- a pre-refresh {@code null} is never treated as
     * having "increased" (AC-26), and no increase leaves an existing flag exactly as it was
     * (AC-25, never auto-cleared here). Requirement 6 (SERIES-018-AC-35/36/37/39): when
     * detection fires and the pre-refresh status was {@code COMPLETED}, also reactivates the
     * series to {@code BACKLOG} and clears {@code dateCompleted}, in the same save.
     */
    private void applyNewContentDetection(SeriesEntity entity, Integer preSeasons, Integer preEpisodes,
                                           SeriesStatus preStatus) {
        boolean increased =
            (preSeasons != null && entity.getTotalSeasons() != null && entity.getTotalSeasons() > preSeasons)
            || (preEpisodes != null && entity.getTotalEpisodes() != null && entity.getTotalEpisodes() > preEpisodes);

        if (!increased) {
            return;
        }

        entity.setNewContentDetectedAt(LocalDateTime.now(clock));

        if (preStatus == SeriesStatus.COMPLETED) {
            entity.setStatus(SeriesStatus.BACKLOG);
            entity.setDateCompleted(null);
        }
    }

    /**
     * Backs {@code POST /api/v1/series/{id}/acknowledge-new-content} (SERIES-018-AC-27) --
     * clears {@code newContentDetectedAt} and persists. Never reverses a status change already
     * made by {@link #applyNewContentDetection} (SERIES-018-AC-38); it only clears the flag.
     */
    @Transactional
    public SeriesDto acknowledgeNewContent(UUID id) {
        log.info("Acknowledging new content for series: {}", id);
        SeriesEntity entity = repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Series not found with id: " + id));
        entity.setNewContentDetectedAt(null);
        entity = repository.save(entity);
        return seriesService.entityToDto(entity);
    }

    /**
     * Updates {@code totalSeasons}/{@code totalEpisodes}/{@code tmdbRating}/{@code
     * tmdbVoteCount}/{@code productionStatus}/{@code originCountry}/{@code overview}/{@code
     * lastAirYear} from a fresh TMDB detail lookup (SERIES-018-AC-02, {@code originCountry} per
     * SERIES-021-AC-09, {@code overview} per SERIES-023-AC-13, {@code lastAirYear} per
     * SERIES-039-AC-04), and reconciles
     * {@code keywords} via {@link KeywordSyncService#syncKeywords} using the same resolved
     * {@code tmdbId} (SERIES-019-AC-08). Returns {@code false} without attempting a lookup
     * when the entity has no {@code imdbId} to resolve a {@code tmdbId} from, or when TMDB is
     * otherwise unresolvable/unreachable (SERIES-018-AC-05) -- never throws.
     */
    private boolean refreshFromTmdb(SeriesEntity entity) {
        String imdbId = entity.getImdbId();
        if (imdbId == null || imdbId.isBlank()) {
            return false;
        }
        try {
            Integer tmdbId = tmdbClient.findTvIdByImdbId(imdbId).orElse(null);
            if (tmdbId == null) {
                return false;
            }
            TmdbSeriesDetail detail = tmdbClient.details(tmdbId);
            // SERIES-027-AC-07: a null value from TMDB for any of these fields leaves the
            // entity's existing value unchanged rather than wiping it -- a refresh should never
            // be able to blank out data that's already been recorded, just because today's
            // response happens not to include it.
            if (detail.numberOfSeasons() != null) {
                entity.setTotalSeasons(detail.numberOfSeasons());
            }
            if (detail.numberOfEpisodes() != null) {
                entity.setTotalEpisodes(detail.numberOfEpisodes());
            }
            if (detail.voteAverage() != null) {
                entity.setTmdbRating(detail.voteAverage());
            }
            if (detail.voteCount() != null) {
                entity.setTmdbVoteCount(detail.voteCount());
            }
            if (detail.productionStatus() != null) {
                entity.setProductionStatus(detail.productionStatus());
            }
            if (detail.originCountry() != null) {
                entity.setOriginCountry(detail.originCountry());
            }
            if (detail.overview() != null) {
                entity.setOverview(detail.overview());
            }
            // series_spec_039_last_air_year.md (SERIES-039-AC-04): unlike productionStatus/
            // originCountry, a running show's lastAirYear genuinely changes as new episodes
            // air, so it's re-resolved on every refresh, same null-preserving posture as the
            // fields above.
            if (detail.lastAirYear() != null) {
                entity.setLastAirYear(detail.lastAirYear());
            }
            // series_spec_019_keyword_tracking.md (SERIES-019-AC-08): reconciles this series'
            // keyword set against TMDB's current data using the same tmdbId just resolved
            // above -- non-fatal on its own (KeywordSyncService never throws).
            keywordSyncService.syncKeywords(entity, tmdbId);
            return true;
        } catch (ExternalServiceException e) {
            log.info("TMDB refresh unavailable for series {} (imdbId={}): {}", entity.getId(), imdbId, e.getMessage());
            return false;
        }
    }

    /**
     * Updates {@code imdbRating}/{@code rottenTomatoesRating} from a fresh narrowed OMDb
     * ratings-only call (SERIES-018-AC-03). Returns {@code false} without attempting a call
     * when the entity has no {@code imdbId}, or when OMDb has no record or is otherwise
     * unreachable (SERIES-018-AC-06) -- never throws.
     */
    private boolean refreshFromOmdb(SeriesEntity entity) {
        String imdbId = entity.getImdbId();
        if (imdbId == null || imdbId.isBlank()) {
            return false;
        }
        try {
            OmdbRatings ratings = omdbClient.ratingsForImdbId(imdbId);
            // SERIES-027-AC-06: OMDb's "Rotten Tomatoes" rating is absent from most of its TV
            // records (see OmdbRatings) -- a null value for either field here must leave the
            // entity's existing value unchanged rather than wiping it.
            if (ratings.imdbRating() != null) {
                entity.setImdbRating(ratings.imdbRating());
            }
            if (ratings.rottenTomatoesRating() != null) {
                entity.setRottenTomatoesRating(ratings.rottenTomatoesRating());
            }
            return true;
        } catch (EntityNotFoundException | ExternalServiceException e) {
            log.info("OMDb refresh unavailable for series {} (imdbId={}): {}", entity.getId(), imdbId, e.getMessage());
            return false;
        }
    }
}
