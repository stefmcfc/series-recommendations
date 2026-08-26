package uk.co.stefirby.seriestracker.controller;

/**
 * Constrains a {@code {id}} path variable to an actual UUID shape (SERIES-017-AC-01/05) so a
 * non-UUID literal path segment (e.g. the now-removed "lookup") doesn't ambiguously match ahead
 * of falling through to "no mapping found" -- without this, GET /lookup would be routed to an
 * {@code {id}}-shaped endpoint and fail UUID conversion with a 400, instead of correctly
 * 404ing as an unmapped path. Shared by every controller that maps an {@code {id}} path
 * variable under {@code /api/v1/series} (TOOLING-002-AC-01/02).
 */
final class UuidPathPattern {

    static final String PATTERN =
        "{id:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}}";

    private UuidPathPattern() {
    }
}
