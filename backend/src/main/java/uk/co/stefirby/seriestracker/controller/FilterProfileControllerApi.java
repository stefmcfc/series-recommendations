package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.FilterProfileDto;
import uk.co.stefirby.seriestracker.model.FilterProfileArea;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.UUID;

@RequestMapping("/api/v1/filter-profiles")
public interface FilterProfileControllerApi {

    @Operation(summary = "List every saved filter profile for one area",
        description = "Sorted by name ascending. area is required; an unrecognized value "
            + "returns 400. An area with no saved profiles returns 200 with an empty list, not "
            + "404.")
    @GetMapping
    ResponseEntity<ApiResponse<List<FilterProfileDto>>> list(
            @Parameter(description = "Required. One of MY_SERIES, USE_MY_SERIES, "
                + "RECOMMENDATION_FILTERS, CUSTOM_SEARCH, ANALYSIS_FILTERS -- identifies which "
                + "of five unrelated frontend contexts this profile belongs to. An unrecognized "
                + "value returns 400.")
            @RequestParam FilterProfileArea area);

    @Operation(summary = "Create a filter profile",
        description = "{ area, name, criteria }. Returns 201 with the created profile. A "
            + "blank/missing name returns 400. Uniqueness is scoped to (area, name), not name "
            + "alone -- the same name can exist once per area; a duplicate within the same area "
            + "returns 409.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "area is one of "
        + "MY_SERIES, USE_MY_SERIES, RECOMMENDATION_FILTERS, CUSTOM_SEARCH, ANALYSIS_FILTERS. "
        + "criteria is an opaque JSON object the backend never validates or queries into -- it's "
        + "stored and returned exactly as submitted.")
    @PostMapping
    ResponseEntity<ApiResponse<FilterProfileDto>> create(@RequestBody FilterProfileDto dto);

    @Operation(summary = "Partially update a filter profile",
        description = "{ name?, criteria? } -- only fields present in the body change, the "
            + "other stays as-is. area cannot be changed via this endpoint. Renaming to a name "
            + "that collides with another profile in the same area returns 409 (uniqueness is "
            + "scoped to (area, name), not name alone); renaming to the profile's own current "
            + "name is a no-op and succeeds. 404 for an unknown id.")
    @PatchMapping("/" + UuidPathPattern.PATTERN)
    ResponseEntity<ApiResponse<FilterProfileDto>> update(@PathVariable UUID id, @RequestBody FilterProfileDto dto);

    @Operation(summary = "Remove a filter profile",
        description = "204 on success, 404 for an unknown id.")
    @DeleteMapping("/" + UuidPathPattern.PATTERN)
    ResponseEntity<Void> delete(@PathVariable UUID id);
}
