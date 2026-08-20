package uk.co.stefirby.seriestracker.dto;

/**
 * A single lightweight candidate from {@code GET /api/v1/series/lookup/search-tmdb}, used to
 * let a user pick the correct show from TMDB's own search results when OMDb's own search
 * (keyed by its {@code s=} title matching, with no AKA/alternate-title support) couldn't find
 * it at all. Deliberately distinct from {@link SeriesLookupCandidateDto}: that one carries
 * {@code imdbId} (an OMDb-search candidate is already keyed by IMDb id), this one carries
 * {@code tmdbId} -- a TMDB-search candidate hasn't yet been resolved to an IMDb id, which is
 * exactly what {@code SeriesLookupService.resolveTmdbCandidate} does.
 */
public class TmdbLookupCandidateDto {

    private int tmdbId;
    private String title;
    private Integer year;
    private String originalTitle;
    private String posterUrl;

    public TmdbLookupCandidateDto() {}

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
}
