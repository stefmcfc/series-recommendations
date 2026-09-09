package uk.co.stefirby.seriestracker.service;

import tools.jackson.databind.JsonNode;
import uk.co.stefirby.seriestracker.dto.FilterProfileDto;
import uk.co.stefirby.seriestracker.exception.ConflictException;
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException;
import uk.co.stefirby.seriestracker.model.FilterProfileArea;
import uk.co.stefirby.seriestracker.model.FilterProfileEntity;
import uk.co.stefirby.seriestracker.repository.FilterProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Backs {@code /api/v1/filter-profiles} -- see series_spec_055_filter_profiles.md. CRUD keyed by
 * {@code (area, name)}; {@code criteria} is stored and returned as an opaque JSON blob, never
 * interpreted here.
 */
@Service
public class FilterProfileService {

    private final FilterProfileRepository repository;
    private final Clock clock;

    public FilterProfileService(FilterProfileRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    public List<FilterProfileDto> list(FilterProfileArea area) {
        return repository.findByAreaOrderByNameAsc(area).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public FilterProfileDto create(FilterProfileArea area, String name, JsonNode criteria) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (repository.findByAreaAndName(area, name).isPresent()) {
            throw new ConflictException("A filter profile named '" + name + "' already exists for area " + area);
        }

        FilterProfileEntity entity = new FilterProfileEntity();
        entity.setArea(area);
        entity.setName(name);
        entity.setCriteria(criteria);
        LocalDateTime now = now();
        // Set explicitly so it's available immediately after save, mirroring
        // IgnoredSeriesService.ignore's handling of ignoredAt (@CreationTimestamp alone isn't
        // guaranteed to be reflected on the in-memory entity returned by save()).
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity = repository.save(entity);
        return toDto(entity);
    }

    @Transactional
    public FilterProfileDto update(UUID id, String name, JsonNode criteria) {
        FilterProfileEntity entity = repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Filter profile not found: " + id));

        if (name != null && !name.isBlank() && !name.equals(entity.getName())) {
            Optional<FilterProfileEntity> collision = repository.findByAreaAndName(entity.getArea(), name);
            if (collision.isPresent() && !collision.get().getId().equals(id)) {
                throw new ConflictException(
                    "A filter profile named '" + name + "' already exists for area " + entity.getArea());
            }
            entity.setName(name);
        }
        if (criteria != null) {
            entity.setCriteria(criteria);
        }
        entity.setUpdatedAt(now());

        entity = repository.save(entity);
        return toDto(entity);
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id)) {
            throw new EntityNotFoundException("Filter profile not found: " + id);
        }
        repository.deleteById(id);
    }

    // Truncated to milliseconds: SQLite's TIMESTAMP column (via hibernate-community-dialects)
    // only round-trips millisecond precision, so a nanosecond-precision LocalDateTime.now()
    // held in-memory would silently differ from the same instant re-read from the DB by a later
    // call (e.g. update()'s repository.findById after create()'s own transaction committed) --
    // truncating at the source keeps every in-memory/reloaded comparison consistent.
    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MILLIS);
    }

    private FilterProfileDto toDto(FilterProfileEntity entity) {
        return new FilterProfileDto(
            entity.getId(),
            entity.getArea(),
            entity.getName(),
            entity.getCriteria(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }
}
