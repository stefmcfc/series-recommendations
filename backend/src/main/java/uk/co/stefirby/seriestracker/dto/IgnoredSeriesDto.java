package uk.co.stefirby.seriestracker.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Request/response shape for {@code POST /api/v1/series/ignored} -- reused for both, like
 * {@link SeriesDto}.
 *
 * <p>A record: on the request side only {@code imdbId}/{@code title}/{@code reason} are ever
 * populated (by Jackson, from the request body); on the response side it's built fully, in
 * one place ({@code IgnoredSeriesService.toDto}), and never mutated afterward -- unlike
 * {@link SeriesDto}, nothing here does a partial-update/PATCH-style merge. See the "Records
 * over classes" guidance in this project's Java conventions.
 */
public record IgnoredSeriesDto(
    UUID id,
    String imdbId,
    String title,
    String reason,
    LocalDateTime ignoredAt
) {

    /** Convenience constructor for the request side, where {@code id}/{@code ignoredAt} are always server-assigned. */
    public IgnoredSeriesDto(String imdbId, String title, String reason) {
        this(null, imdbId, title, reason, null);
    }
}
