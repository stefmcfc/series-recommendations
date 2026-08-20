package uk.co.stefirby.seriestracker.client;

/**
 * A single lightweight candidate from an {@link OmdbClient#search(String)} call -- OMDb's raw
 * {@code Search[]} entry fields mapped onto this app's own naming, per the field-mapping table
 * in {@code series_spec_011_omdb_search_candidates.md} Requirement 1. Deliberately carries far
 * less data than {@link OmdbLookupResult}: OMDb's {@code s=} search parameter itself only
 * returns title/year/imdbId/poster per candidate, not genres/ratings/season counts.
 */
public record OmdbSearchCandidate(
    String title,
    Integer year,
    String imdbId,
    String posterUrl
) {
}
