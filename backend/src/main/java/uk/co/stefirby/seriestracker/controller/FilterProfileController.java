package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.FilterProfileDto;
import uk.co.stefirby.seriestracker.model.FilterProfileArea;
import uk.co.stefirby.seriestracker.service.FilterProfileService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Backs {@code /api/v1/filter-profiles} -- see series_spec_055_filter_profiles.md. A new
 * top-level resource, not nested under {@code /series}: a filter profile isn't series data,
 * unlike everything else this app persists.
 */
@RestController
@RequestMapping("/api/v1/filter-profiles")
public class FilterProfileController {

    private final FilterProfileService service;

    public FilterProfileController(FilterProfileService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<FilterProfileDto>>> list(@RequestParam FilterProfileArea area) {
        List<FilterProfileDto> profiles = service.list(area);
        return ResponseEntity.ok(new ApiResponse<>(profiles, profiles.size()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<FilterProfileDto>> create(@RequestBody FilterProfileDto dto) {
        FilterProfileDto created = service.create(dto.area(), dto.name(), dto.criteria());
        return ResponseEntity.status(HttpStatus.CREATED).body(new ApiResponse<>(created));
    }

    @PatchMapping("/" + UuidPathPattern.PATTERN)
    public ResponseEntity<ApiResponse<FilterProfileDto>> update(@PathVariable UUID id, @RequestBody FilterProfileDto dto) {
        FilterProfileDto updated = service.update(id, dto.name(), dto.criteria());
        return ResponseEntity.ok(new ApiResponse<>(updated));
    }

    @DeleteMapping("/" + UuidPathPattern.PATTERN)
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
