package uk.co.stefirby.seriestracker.dto;

/**
 * A single lightweight candidate from {@code GET /api/v1/series/lookup/search-tmdb}, used to
 * let a user pick the correct show from TMDB's own search results -- per
 * {@code series_spec_017_tmdb_primary_lookup.md}, TMDB search is this app's sole search path
 * (OMDb's own {@code s=} search, with no AKA/alternate-title support, was removed outright).
 * Carries {@code tmdbId}, not yet resolved to an IMDb id -- that's exactly what
 * {@code SeriesLookupService.resolveTmdbCandidate} does.
 */
public class TmdbLookupCandidateDto {

    private int tmdbId;
    private String title;
    private Integer year;
    private String originalTitle;
    private String posterUrl;

    // series_spec_021_origin_country.md (SERIES-021-AC-03): the candidate's first
    // origin_country entry, letting a user disambiguate same-title remakes before picking one.
    private String originCountry;

    public TmdbLookupCandidateDto() {
        // Explicit no-arg constructor: fields are populated field-by-field via setters afterward.
    }

    public int getTmdbId() { return tmdbId; }
    public void setTmdbId(int tmdbId) { this.tmdbId = tmdbId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }

    public String getOriginalTitle() { return originalTitle; }
    public void setOriginalTitle(String originalTitle) { this.originalTitle = originalTitle; }

    public String getPosterUrl() { return posterUrl; }
    public void setPosterUrl(String posterUrl) { this.posterUrl = posterUrl; }

    public String getOriginCountry() { return originCountry; }
    public void setOriginCountry(String originCountry) { this.originCountry = originCountry; }
}
