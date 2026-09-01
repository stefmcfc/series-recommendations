package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.exception.ConflictException;
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException;
import uk.co.stefirby.seriestracker.model.KeywordEntity;
import uk.co.stefirby.seriestracker.model.ProductionStatus;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.model.SeriesStatus;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class SeriesService {

    private static final Logger log = LoggerFactory.getLogger(SeriesService.class);

    private static final String SERIES_NOT_FOUND = "Series not found with id: ";

    // series_spec_041_year_validation_bounds.md (SERIES-041-AC-04): the same floor already
    // established for RecommendationCriteria.yearMin/yearMax (RecommendationCriteriaValidator,
    // SERIES-031-AC-12) -- safely before any TV series existed.
    private static final int MIN_VALID_YEAR = 1900;

    private final SeriesRepository repository;
    private final KeywordSyncService keywordSyncService;
    private final Clock clock;

    public SeriesService(SeriesRepository repository, KeywordSyncService keywordSyncService, Clock clock) {
        this.repository = repository;
        this.keywordSyncService = keywordSyncService;
        this.clock = clock;
    }

    /**
     * Each independent group (validation, field copy, create-time defaults, keyword sync) is
     * its own method (java:S3776) -- this method's own job is just to run them all in order.
     * The one real order dependency, {@code validateCreate} (which must throw before any entity
     * state exists) running before everything else, is preserved.
     */
    @Transactional
    public SeriesDto create(SeriesDto dto) {
        log.info("Creating series: {}", dto.getTitle());

        validateCreate(dto);

        SeriesEntity entity = buildEntityFromDto(dto);
        applyCreateFlags(entity, dto);
        applyCreateTimestampsAndStatus(entity, dto);
        syncKeywordsIfPresent(entity, dto);

        entity = repository.save(entity);
        return entityToDto(entity);
    }

    private void validateCreate(SeriesDto dto) {
        if (dto.getTitle() == null || dto.getTitle().isBlank()) {
            throw new IllegalArgumentException("Title is required");
        }

        // SERIES-028-AC-01/02: a non-blank imdbId already tracked by another series is
        // rejected outright; a blank/absent imdbId is never subject to duplicate checking (no
        // stable identifier to key it on -- mirrors refreshFromTmdb/refreshFromOmdb's existing
        // no-op-on-missing-imdbId posture).
        if (dto.getImdbId() != null && !dto.getImdbId().isBlank()
                && repository.existsByImdbId(dto.getImdbId())) {
            throw new ConflictException("A series with this IMDb ID is already tracked: " + dto.getTitle());
        }

        if (dto.getImdbRating() != null) {
            BigDecimal rating = dto.getImdbRating();
            if (rating.compareTo(BigDecimal.ZERO) < 0 || rating.compareTo(new BigDecimal("10.0")) > 0) {
                throw new IllegalArgumentException("IMDb rating must be between 0.0 and 10.0");
            }
        }

        validateYearRange(dto.getYear());
    }

    /**
     * series_spec_041_year_validation_bounds.md (SERIES-041-AC-04): mirrors
     * RecommendationCriteriaValidator.validateYearRange's exact pattern -- the upper bound is
     * resolved from the already-injected Clock at request time rather than a hardcoded literal,
     * so it never goes stale. Called from both create (validateCreate) and update
     * (applyMetadataUpdates), closing a gap where update never validated year at all.
     */
    private void validateYearRange(Integer year) {
        int maxValidYear = Year.now(clock).getValue() + 1;
        if (year != null && (year < MIN_VALID_YEAR || year > maxValidYear)) {
            throw new IllegalArgumentException("year must be between " + MIN_VALID_YEAR + " and " + maxValidYear);
        }
    }

    private SeriesEntity buildEntityFromDto(SeriesDto dto) {
        SeriesEntity entity = new SeriesEntity();
        entity.setTitle(dto.getTitle());
        entity.setYear(dto.getYear());
        entity.setGenres(dto.getGenres());
        entity.setTotalSeasons(dto.getTotalSeasons());
        entity.setTotalEpisodes(dto.getTotalEpisodes());
        entity.setCurrentSeason(dto.getCurrentSeason());
        entity.setCurrentEpisode(dto.getCurrentEpisode());
        entity.setImdbRating(dto.getImdbRating());
        entity.setRottenTomatoesRating(dto.getRottenTomatoesRating());
        entity.setRottenTomatoesPopcornmeter(dto.getRottenTomatoesPopcornmeter());
        entity.setTmdbRating(dto.getTmdbRating());
        entity.setTmdbVoteCount(dto.getTmdbVoteCount());
        entity.setPersonalRating(dto.getPersonalRating());
        entity.setPersonalNotes(dto.getPersonalNotes());
        entity.setPosterUrl(dto.getPosterUrl());
        entity.setTags(dto.getTags());
        entity.setImdbId(dto.getImdbId());
        entity.setOriginCountry(dto.getOriginCountry());
        entity.setOverview(dto.getOverview());
        entity.setLastAirYear(dto.getLastAirYear());
        return entity;
    }

    private void applyCreateFlags(SeriesEntity entity, SeriesDto dto) {
        // SERIES-008-AC-03: defaults to false when the dto value is null, same as the
        // entity's own field default.
        entity.setExcludeFromRecommendations(
            dto.getExcludeFromRecommendations() != null && dto.getExcludeFromRecommendations());

        // SERIES-008-AC-19: same create-time default-to-false semantics as
        // excludeFromRecommendations above.
        entity.setFlaggedForRewatch(dto.getFlaggedForRewatch() != null && dto.getFlaggedForRewatch());

        // SERIES-021-AC-08: closes the gap where a freshly added series' productionStatus was
        // always null until its first explicit refresh, even though TmdbSeriesDetail already
        // supplies it for free at create time (same direct flow-through precedent as
        // tmdbRating/tmdbVoteCount, SERIES-017-AC-12).
        if (dto.getProductionStatus() != null && !dto.getProductionStatus().isBlank()) {
            entity.setProductionStatus(ProductionStatus.valueOf(dto.getProductionStatus()));
        }
    }

    private void applyCreateTimestampsAndStatus(SeriesEntity entity, SeriesDto dto) {
        // Set dateAdded explicitly so it's available immediately after save
        entity.setDateAdded(LocalDateTime.now(clock));

        // SERIES-018-AC-12: a freshly added series' data is, by definition, as fresh as it'll
        // ever be without an explicit refresh -- leaving lastRefreshedAt null until the first
        // refresh would misrepresent a just-added series as stale.
        entity.setLastRefreshedAt(LocalDateTime.now(clock));

        SeriesStatus status = SeriesStatus.BACKLOG;
        if (dto.getStatus() != null && !dto.getStatus().isBlank()) {
            status = SeriesStatus.valueOf(dto.getStatus());
        }
        entity.setStatus(status);

        if (status == SeriesStatus.COMPLETED) {
            entity.setDateCompleted(LocalDateTime.now(clock));
        }
    }

    private void syncKeywordsIfPresent(SeriesEntity entity, SeriesDto dto) {
        // SERIES-019-AC-24: when the incoming dto carries a tmdbId (round-tripped from
        // resolveTmdbCandidate, SERIES-019-AC-22), populate this series' keyword set at
        // creation time via the same reconciliation logic refresh already uses -- non-fatal on
        // its own (KeywordSyncService never throws), so no extra error handling here. A
        // manually-added series with no tmdbId is left with an empty keyword set, as today.
        if (dto.getTmdbId() != null) {
            keywordSyncService.syncKeywords(entity, dto.getTmdbId());
        }
    }

    @Transactional(readOnly = true)
    public SeriesDto getById(UUID id) {
        log.debug("Fetching series by id: {}", id);
        SeriesEntity entity = repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException(SERIES_NOT_FOUND + id));
        return entityToDto(entity);
    }

    @Transactional(readOnly = true)
    public List<SeriesDto> getAll() {
        return doGetAll(null, null);
    }

    // SERIES-009-AC-06: getAll() gains an explicit default order (dateAdded descending, via
    // SeriesSortResolver's null-args default) where none existed before -- see
    // series_spec_009_rating_sort.md's Design Decisions for why an undefined findAll() order
    // was worth replacing even though nothing else asked for it.
    @Transactional(readOnly = true)
    public List<SeriesDto> getAll(String sortBy, String sortDirection) {
        return doGetAll(sortBy, sortDirection);
    }

    /**
     * Shared implementation for both {@link #getAll()} and {@link #getAll(String, String)} --
     * kept private (not itself {@code @Transactional}) so neither public overload calls the
     * other via {@code this}, which would bypass Spring's transactional proxy (java:S6809).
     */
    private List<SeriesDto> doGetAll(String sortBy, String sortDirection) {
        log.debug("Fetching all series");
        Comparator<SeriesEntity> comparator = SeriesSortResolver.resolve(sortBy, sortDirection);
        return repository.findAll().stream()
            .sorted(comparator)
            .map(this::entityToDto)
            .toList();
    }

    /**
     * Each independent group of field patches is its own method (java:S3776) -- this method's
     * own job is just to run them all in order. The one real order dependency,
     * {@code applyMetadataUpdates} (which may patch {@code totalSeasons}) running before {@code
     * applyCurrentSeason} (which reads {@code entity.getTotalSeasons()} for its validation), is
     * preserved.
     */
    @Transactional
    public SeriesDto update(UUID id, SeriesDto dto) {
        log.info("Updating series: {}", id);
        SeriesEntity entity = repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException(SERIES_NOT_FOUND + id));

        applyMetadataUpdates(entity, dto);
        applyRatingAndPersonalUpdates(entity, dto);
        applyCurrentSeason(entity, dto);
        applyStatusUpdate(entity, dto);

        entity = repository.save(entity);
        return entityToDto(entity);
    }

    /**
     * series_spec_040_tmdb_managed_field_lock.md (SERIES-040-AC-01/02): title/year/genres/
     * totalSeasons/totalEpisodes/imdbRating are TMDB (or OMDb, for imdbRating)-managed fields --
     * once the entity already carries a non-null value, a manual PATCH can no longer change it
     * (the incoming dto value is silently dropped); only a refresh (SeriesRefreshService) may
     * overwrite it after that point. The guard only withholds a *change* to an already-set
     * value -- a manually-added series with no value yet can still have it set for the first
     * time here.
     */
    private void applyMetadataUpdates(SeriesEntity entity, SeriesDto dto) {
        if (dto.getTitle() != null && entity.getTitle() == null) {
            entity.setTitle(dto.getTitle());
        }
        if (dto.getYear() != null && entity.getYear() == null) {
            validateYearRange(dto.getYear());
            entity.setYear(dto.getYear());
        }
        if (dto.getGenres() != null && entity.getGenres() == null) {
            entity.setGenres(dto.getGenres());
        }
        if (dto.getTotalSeasons() != null && entity.getTotalSeasons() == null) {
            entity.setTotalSeasons(dto.getTotalSeasons());
        }
        if (dto.getTotalEpisodes() != null && entity.getTotalEpisodes() == null) {
            entity.setTotalEpisodes(dto.getTotalEpisodes());
        }
        if (dto.getCurrentEpisode() != null) {
            entity.setCurrentEpisode(dto.getCurrentEpisode());
        }
        if (dto.getPosterUrl() != null) {
            entity.setPosterUrl(dto.getPosterUrl());
        }
        if (dto.getTags() != null) {
            entity.setTags(dto.getTags());
        }
        if (dto.getImdbId() != null) {
            entity.setImdbId(dto.getImdbId());
        }
    }

    private void applyRatingAndPersonalUpdates(SeriesEntity entity, SeriesDto dto) {
        // series_spec_040_tmdb_managed_field_lock.md (SERIES-040-AC-01/02): same
        // "only-when-currently-null" lock as applyMetadataUpdates -- imdbRating is
        // OMDb-managed and only ever changes by hand once, before its first refresh.
        if (dto.getImdbRating() != null && entity.getImdbRating() == null) {
            entity.setImdbRating(dto.getImdbRating());
        }
        if (dto.getRottenTomatoesRating() != null) {
            entity.setRottenTomatoesRating(dto.getRottenTomatoesRating());
        }
        if (dto.getRottenTomatoesPopcornmeter() != null) {
            entity.setRottenTomatoesPopcornmeter(dto.getRottenTomatoesPopcornmeter());
        }
        if (dto.getPersonalRating() != null) {
            entity.setPersonalRating(dto.getPersonalRating());
        }
        if (dto.getPersonalNotes() != null) {
            entity.setPersonalNotes(dto.getPersonalNotes());
        }
        if (dto.getExcludeFromRecommendations() != null) {
            entity.setExcludeFromRecommendations(dto.getExcludeFromRecommendations());
        }
        if (dto.getFlaggedForRewatch() != null) {
            entity.setFlaggedForRewatch(dto.getFlaggedForRewatch());
        }
    }

    private void applyCurrentSeason(SeriesEntity entity, SeriesDto dto) {
        if (dto.getCurrentSeason() == null) {
            return;
        }
        Integer newCurrentSeason = dto.getCurrentSeason();
        Integer totalSeasons = entity.getTotalSeasons();
        if (totalSeasons != null && newCurrentSeason > totalSeasons) {
            throw new IllegalArgumentException(
                "currentSeason (" + newCurrentSeason + ") cannot exceed totalSeasons (" + totalSeasons + ")");
        }
        entity.setCurrentSeason(newCurrentSeason);
    }

    private void applyStatusUpdate(SeriesEntity entity, SeriesDto dto) {
        if (dto.getStatus() == null) {
            return;
        }
        SeriesStatus newStatus = SeriesStatus.valueOf(dto.getStatus());
        SeriesStatus oldStatus = entity.getStatus();
        entity.setStatus(newStatus);

        if (newStatus == SeriesStatus.COMPLETED && oldStatus != SeriesStatus.COMPLETED) {
            entity.setDateCompleted(LocalDateTime.now(clock));
        } else if (newStatus != SeriesStatus.COMPLETED) {
            entity.setDateCompleted(null);
        }
    }

    @Transactional
    public void delete(UUID id) {
        log.info("Deleting series: {}", id);
        SeriesEntity entity = repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException(SERIES_NOT_FOUND + id));
        repository.delete(entity);
    }

    public SeriesDto entityToDto(SeriesEntity entity) {
        SeriesDto dto = new SeriesDto();
        dto.setId(entity.getId());
        dto.setTitle(entity.getTitle());
        dto.setYear(entity.getYear());
        dto.setGenres(entity.getGenres());
        dto.setTotalSeasons(entity.getTotalSeasons());
        dto.setTotalEpisodes(entity.getTotalEpisodes());
        dto.setCurrentSeason(entity.getCurrentSeason());
        dto.setCurrentEpisode(entity.getCurrentEpisode());
        dto.setStatus(entity.getStatus() != null ? entity.getStatus().name() : null);
        dto.setImdbRating(entity.getImdbRating());
        dto.setRottenTomatoesRating(entity.getRottenTomatoesRating());
        dto.setRottenTomatoesPopcornmeter(entity.getRottenTomatoesPopcornmeter());
        dto.setTmdbRating(entity.getTmdbRating());
        dto.setTmdbVoteCount(entity.getTmdbVoteCount());
        dto.setPersonalRating(entity.getPersonalRating());
        dto.setPersonalNotes(entity.getPersonalNotes());
        dto.setPosterUrl(entity.getPosterUrl());
        dto.setTags(entity.getTags());
        dto.setImdbId(entity.getImdbId());
        dto.setDateAdded(entity.getDateAdded());
        dto.setDateCompleted(entity.getDateCompleted());
        dto.setLastRefreshedAt(entity.getLastRefreshedAt());
        dto.setProductionStatus(entity.getProductionStatus() != null ? entity.getProductionStatus().name() : null);
        dto.setOriginCountry(entity.getOriginCountry());
        dto.setOverview(entity.getOverview());
        dto.setLastAirYear(entity.getLastAirYear());
        dto.setNewContentDetectedAt(entity.getNewContentDetectedAt());
        dto.setExcludeFromRecommendations(entity.isExcludeFromRecommendations());
        dto.setFlaggedForRewatch(entity.isFlaggedForRewatch());
        dto.setKeywords(entity.getKeywords().stream()
            .map(KeywordEntity::getName)
            .sorted(Comparator.naturalOrder())
            .toList());
        return dto;
    }
}


