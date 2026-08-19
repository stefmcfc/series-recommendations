package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.IgnoredSeriesDto;
import uk.co.stefirby.seriestracker.model.IgnoredSeriesEntity;
import uk.co.stefirby.seriestracker.repository.IgnoredSeriesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Backs {@code POST /api/v1/series/ignored}. Idempotent on {@code imdbId}
 * (SERIES-006-AC-34): re-ignoring an already-ignored series returns the existing entry
 * rather than creating a duplicate or erroring.
 */
@Service
public class IgnoredSeriesService {

    private static final Logger log = LoggerFactory.getLogger(IgnoredSeriesService.class);

    private final IgnoredSeriesRepository repository;

    public IgnoredSeriesService(IgnoredSeriesRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public IgnoreOutcome ignore(IgnoredSeriesDto dto) {
        if (dto.imdbId() == null || dto.imdbId().isBlank()) {
            throw new IllegalArgumentException("imdbId is required");
        }
        if (dto.title() == null || dto.title().isBlank()) {
            throw new IllegalArgumentException("title is required");
        }

        Optional<IgnoredSeriesEntity> existing = repository.findByImdbId(dto.imdbId());
        if (existing.isPresent()) {
            log.debug("imdbId {} is already ignored; returning the existing entry", dto.imdbId());
            return new IgnoreOutcome(toDto(existing.get()), false);
        }

        log.info("Ignoring series: {} ({})", dto.title(), dto.imdbId());
        IgnoredSeriesEntity entity = new IgnoredSeriesEntity();
        entity.setImdbId(dto.imdbId());
        entity.setTitle(dto.title());
        entity.setReason(dto.reason());
        // Set explicitly so it's available immediately after save, mirroring
        // SeriesService.create's handling of dateAdded (@CreationTimestamp alone isn't
        // guaranteed to be reflected on the in-memory entity returned by save()).
        entity.setIgnoredAt(LocalDateTime.now());
        entity = repository.save(entity);
        return new IgnoreOutcome(toDto(entity), true);
    }

    private IgnoredSeriesDto toDto(IgnoredSeriesEntity entity) {
        return new IgnoredSeriesDto(
            entity.getId(),
            entity.getImdbId(),
            entity.getTitle(),
            entity.getReason(),
            entity.getIgnoredAt()
        );
    }
}
