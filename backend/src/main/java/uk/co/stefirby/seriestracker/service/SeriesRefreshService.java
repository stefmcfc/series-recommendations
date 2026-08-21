package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.OmdbClient;
import uk.co.stefirby.seriestracker.client.OmdbRatings;
import uk.co.stefirby.seriestracker.client.TmdbClient;
import uk.co.stefirby.seriestracker.client.TmdbSeriesDetail;
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException;
import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public SeriesRefreshService(SeriesRepository repository, TmdbClient tmdbClient,
                                 OmdbClient omdbClient, SeriesService seriesService,
                                 KeywordSyncService keywordSyncService) {
        this.repository = repository;
        this.tmdbClient = tmdbClient;
        this.omdbClient = omdbClient;
        this.seriesService = seriesService;
        this.keywordSyncService = keywordSyncService;
    }

    @Transactional
    public RefreshResult refresh(UUID id) {
        log.info("Refreshing series: {}", id);
        SeriesEntity entity = repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Series not found with id: " + id));

        boolean tmdbRefreshed = refreshFromTmdb(entity);
        boolean omdbRefreshed = refreshFromOmdb(entity);

        if (tmdbRefreshed || omdbRefreshed) {
            entity.setLastRefreshedAt(LocalDateTime.now());
        }

        entity = repository.save(entity);
        return new RefreshResult(seriesService.entityToDto(entity), omdbRefreshed, tmdbRefreshed);
    }

    /**
     * Updates {@code totalSeasons}/{@code totalEpisodes}/{@code tmdbRating}/{@code
     * tmdbVoteCount}/{@code productionStatus}/{@code originCountry} from a fresh TMDB detail
     * lookup (SERIES-018-AC-02, {@code originCountry} per SERIES-021-AC-09), and reconciles
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
            entity.setTotalSeasons(detail.numberOfSeasons());
            entity.setTotalEpisodes(detail.numberOfEpisodes());
            entity.setTmdbRating(detail.voteAverage());
            entity.setTmdbVoteCount(detail.voteCount());
            entity.setProductionStatus(detail.productionStatus());
            entity.setOriginCountry(detail.originCountry());
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
            entity.setImdbRating(ratings.imdbRating());
            entity.setRottenTomatoesRating(ratings.rottenTomatoesRating());
            return true;
        } catch (EntityNotFoundException | ExternalServiceException e) {
            log.info("OMDb refresh unavailable for series {} (imdbId={}): {}", entity.getId(), imdbId, e.getMessage());
            return false;
        }
    }
}
