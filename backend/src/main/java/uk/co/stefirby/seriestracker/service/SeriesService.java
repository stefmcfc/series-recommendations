package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.model.SeriesStatus;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SeriesService {

    private static final Logger log = LoggerFactory.getLogger(SeriesService.class);

    private final SeriesRepository repository;

    public SeriesService(SeriesRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public SeriesDto create(SeriesDto dto) {
        log.info("Creating series: {}", dto.getTitle());

        if (dto.getTitle() == null || dto.getTitle().isBlank()) {
            throw new IllegalArgumentException("Title is required");
        }

        if (dto.getImdbRating() != null) {
            BigDecimal rating = dto.getImdbRating();
            if (rating.compareTo(BigDecimal.ZERO) < 0 || rating.compareTo(new BigDecimal("10.0")) > 0) {
                throw new IllegalArgumentException("IMDb rating must be between 0.0 and 10.0");
            }
        }

        SeriesEntity entity = new SeriesEntity();
        entity.setTitle(dto.getTitle());
        entity.setAlternateTitle(dto.getAlternateTitle());
        entity.setYear(dto.getYear());
        entity.setGenres(dto.getGenres());
        entity.setTotalSeasons(dto.getTotalSeasons());
        entity.setTotalEpisodes(dto.getTotalEpisodes());
        entity.setCurrentSeason(dto.getCurrentSeason());
        entity.setCurrentEpisode(dto.getCurrentEpisode());
        entity.setImdbRating(dto.getImdbRating());
        entity.setMetacriticRating(dto.getMetacriticRating());
        entity.setRottenTomatoesRating(dto.getRottenTomatoesRating());
        entity.setPersonalRating(dto.getPersonalRating());
        entity.setPersonalNotes(dto.getPersonalNotes());
        entity.setPosterUrl(dto.getPosterUrl());
        entity.setTags(dto.getTags());
        entity.setImdbId(dto.getImdbId());

        // Set dateAdded explicitly so it's available immediately after save
        entity.setDateAdded(LocalDateTime.now());

        SeriesStatus status = SeriesStatus.BACKLOG;
        if (dto.getStatus() != null && !dto.getStatus().isBlank()) {
            status = SeriesStatus.valueOf(dto.getStatus());
        }
        entity.setStatus(status);

        if (status == SeriesStatus.COMPLETED) {
            entity.setDateCompleted(LocalDateTime.now());
        }

        entity = repository.save(entity);
        return entityToDto(entity);
    }

    @Transactional(readOnly = true)
    public SeriesDto getById(UUID id) {
        log.debug("Fetching series by id: {}", id);
        SeriesEntity entity = repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Series not found with id: " + id));
        return entityToDto(entity);
    }

    @Transactional(readOnly = true)
    public List<SeriesDto> getAll() {
        log.debug("Fetching all series");
        return repository.findAll().stream()
            .map(this::entityToDto)
            .collect(Collectors.toList());
    }

    @Transactional
    public SeriesDto update(UUID id, SeriesDto dto) {
        log.info("Updating series: {}", id);
        SeriesEntity entity = repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Series not found with id: " + id));

        if (dto.getTitle() != null) {
            entity.setTitle(dto.getTitle());
        }
        if (dto.getAlternateTitle() != null) {
            entity.setAlternateTitle(dto.getAlternateTitle());
        }
        if (dto.getYear() != null) {
            entity.setYear(dto.getYear());
        }
        if (dto.getGenres() != null) {
            entity.setGenres(dto.getGenres());
        }
        if (dto.getTotalSeasons() != null) {
            entity.setTotalSeasons(dto.getTotalSeasons());
        }
        if (dto.getTotalEpisodes() != null) {
            entity.setTotalEpisodes(dto.getTotalEpisodes());
        }
        if (dto.getCurrentSeason() != null) {
            Integer newCurrentSeason = dto.getCurrentSeason();
            Integer totalSeasons = entity.getTotalSeasons();
            if (totalSeasons != null && newCurrentSeason > totalSeasons) {
                throw new IllegalArgumentException(
                    "currentSeason (" + newCurrentSeason + ") cannot exceed totalSeasons (" + totalSeasons + ")");
            }
            entity.setCurrentSeason(newCurrentSeason);
        }
        if (dto.getCurrentEpisode() != null) {
            entity.setCurrentEpisode(dto.getCurrentEpisode());
        }
        if (dto.getImdbRating() != null) {
            entity.setImdbRating(dto.getImdbRating());
        }
        if (dto.getMetacriticRating() != null) {
            entity.setMetacriticRating(dto.getMetacriticRating());
        }
        if (dto.getRottenTomatoesRating() != null) {
            entity.setRottenTomatoesRating(dto.getRottenTomatoesRating());
        }
        if (dto.getPersonalRating() != null) {
            entity.setPersonalRating(dto.getPersonalRating());
        }
        if (dto.getPersonalNotes() != null) {
            entity.setPersonalNotes(dto.getPersonalNotes());
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

        if (dto.getStatus() != null) {
            SeriesStatus newStatus = SeriesStatus.valueOf(dto.getStatus());
            SeriesStatus oldStatus = entity.getStatus();
            entity.setStatus(newStatus);

            if (newStatus == SeriesStatus.COMPLETED && oldStatus != SeriesStatus.COMPLETED) {
                entity.setDateCompleted(LocalDateTime.now());
            } else if (newStatus != SeriesStatus.COMPLETED) {
                entity.setDateCompleted(null);
            }
        }

        entity = repository.save(entity);
        return entityToDto(entity);
    }

    @Transactional
    public void delete(UUID id) {
        log.info("Deleting series: {}", id);
        SeriesEntity entity = repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Series not found with id: " + id));
        repository.delete(entity);
    }

    public SeriesDto entityToDto(SeriesEntity entity) {
        SeriesDto dto = new SeriesDto();
        dto.setId(entity.getId());
        dto.setTitle(entity.getTitle());
        dto.setAlternateTitle(entity.getAlternateTitle());
        dto.setYear(entity.getYear());
        dto.setGenres(entity.getGenres());
        dto.setTotalSeasons(entity.getTotalSeasons());
        dto.setTotalEpisodes(entity.getTotalEpisodes());
        dto.setCurrentSeason(entity.getCurrentSeason());
        dto.setCurrentEpisode(entity.getCurrentEpisode());
        dto.setStatus(entity.getStatus() != null ? entity.getStatus().name() : null);
        dto.setImdbRating(entity.getImdbRating());
        dto.setMetacriticRating(entity.getMetacriticRating());
        dto.setRottenTomatoesRating(entity.getRottenTomatoesRating());
        dto.setPersonalRating(entity.getPersonalRating());
        dto.setPersonalNotes(entity.getPersonalNotes());
        dto.setPosterUrl(entity.getPosterUrl());
        dto.setTags(entity.getTags());
        dto.setImdbId(entity.getImdbId());
        dto.setDateAdded(entity.getDateAdded());
        dto.setDateCompleted(entity.getDateCompleted());
        return dto;
    }
}


