package uk.co.stefirby.seriestracker.dto;

import tools.jackson.databind.JsonNode;
import uk.co.stefirby.seriestracker.model.FilterProfileArea;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Request/response shape for {@code /api/v1/filter-profiles} -- see
 * series_spec_055_filter_profiles.md. Reused for both request and response bodies, like
 * {@link IgnoredSeriesDto}: on the {@code POST} request side only {@code area}/{@code name}/
 * {@code criteria} are populated (by Jackson, from the request body); on the {@code PATCH}
 * request side only {@code name}/{@code criteria} are populated, both optional -- a {@code null}
 * field there means "leave unchanged", per {@code FilterProfileService.update}. On the response
 * side it's built fully, in one place ({@code FilterProfileService.toDto}), and never mutated
 * afterward.
 */
public record FilterProfileDto(
    UUID id,
    FilterProfileArea area,
    String name,
    JsonNode criteria,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {

    /** Convenience constructor for the {@code POST} request side, where {@code id}/{@code createdAt}/{@code updatedAt} are always server-assigned. */
    public FilterProfileDto(FilterProfileArea area, String name, JsonNode criteria) {
        this(null, area, name, criteria, null, null);
    }
}
