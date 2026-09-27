package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.FilterProfileDto;
import uk.co.stefirby.seriestracker.model.FilterProfileArea;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
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
            + "404.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "profiles",
                    summary = "Two saved MY_SERIES filter profiles",
                    value = """
                        {
                          "data": [
                            {
                              "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                              "area": "MY_SERIES",
                              "name": "No animation",
                              "criteria": {
                                "excludeGenre": ["Animation"]
                              },
                              "createdAt": "2026-01-10T09:00:00",
                              "updatedAt": "2026-01-10T09:00:00"
                            },
                            {
                              "id": "5a1e3b3a-8f0d-4c2e-9c1a-2b3c4d5e6f70",
                              "area": "MY_SERIES",
                              "name": "High personal rating",
                              "criteria": {
                                "minPersonalRating": 8
                              },
                              "createdAt": "2026-01-11T09:00:00",
                              "updatedAt": "2026-01-11T09:00:00"
                            }
                          ],
                          "error": null,
                          "count": 2,
                          "excludedCount": 0
                        }"""))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400",
                ref = "#/components/responses/BadRequest")
        })
    @GetMapping
    ResponseEntity<ApiResponse<List<FilterProfileDto>>> list(
            @Parameter(description = "One of MY_SERIES, USE_MY_SERIES, "
                + "RECOMMENDATION_FILTERS, CUSTOM_SEARCH, ANALYSIS_FILTERS -- identifies which "
                + "of five unrelated frontend contexts this profile belongs to. An unrecognized "
                + "value returns 400.", example = "MY_SERIES")
            @RequestParam FilterProfileArea area);

    @Operation(summary = "Create a filter profile",
        description = "{ area, name, criteria }. Returns 201 with the created profile. A "
            + "blank/missing name returns 400. Uniqueness is scoped to (area, name), not name "
            + "alone -- the same name can exist once per area; a duplicate within the same area "
            + "returns 409.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201",
                content = @Content(mediaType = "application/json", examples = @ExampleObject(
                    name = "created-profile",
                    summary = "The newly created filter profile",
                    value = """
                        {
                          "data": {
                            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                            "area": "MY_SERIES",
                            "name": "No animation",
                            "criteria": {
                              "excludeGenre": ["Animation"]
                            },
                            "createdAt": "2026-01-15T10:30:00",
                            "updatedAt": "2026-01-15T10:30:00"
                          },
                          "error": null,
                          "count": 1,
                          "excludedCount": 0
                        }"""))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400",
                ref = "#/components/responses/BadRequest"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409",
                ref = "#/components/responses/Conflict")
        })
    @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "area is one of "
        + "MY_SERIES, USE_MY_SERIES, RECOMMENDATION_FILTERS, CUSTOM_SEARCH, ANALYSIS_FILTERS. "
        + "criteria is an opaque JSON object the backend never validates or queries into -- it's "
        + "stored and returned exactly as submitted.",
        content = @Content(mediaType = "application/json", examples = @ExampleObject(
            name = "new-profile",
            summary = "Request body to create a MY_SERIES filter profile",
            value = """
                {
                  "area": "MY_SERIES",
                  "name": "No animation",
                  "criteria": {
                    "excludeGenre": ["Animation"]
                  }
                }""")))
    @PostMapping
    ResponseEntity<ApiResponse<FilterProfileDto>> create(@RequestBody FilterProfileDto dto);

    @Operation(summary = "Partially update a filter profile",
        description = "{ name?, criteria? } -- only fields present in the body change, the "
            + "other stays as-is. area cannot be changed via this endpoint. Renaming to a name "
            + "that collides with another profile in the same area returns 409 (uniqueness is "
            + "scoped to (area, name), not name alone); renaming to the profile's own current "
            + "name is a no-op and succeeds. 404 for an unknown id.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404",
                ref = "#/components/responses/NotFound"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409",
                ref = "#/components/responses/Conflict")
        })
    @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
        mediaType = "application/json", examples = @ExampleObject(name = "rename-profile",
            summary = "Request body to rename a filter profile",
            value = "{\"name\":\"No animation or reality TV\"}")))
    @PatchMapping("/" + UuidPathPattern.PATTERN)
    ResponseEntity<ApiResponse<FilterProfileDto>> update(
            @Parameter(description = "The filter profile's id.",
                example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
            @PathVariable UUID id,
            @RequestBody FilterProfileDto dto);

    @Operation(summary = "Remove a filter profile",
        description = "204 on success, 404 for an unknown id.",
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404",
                ref = "#/components/responses/NotFound")
        })
    @DeleteMapping("/" + UuidPathPattern.PATTERN)
    ResponseEntity<Void> delete(
            @Parameter(description = "The filter profile's id.",
                example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
            @PathVariable UUID id);
}
