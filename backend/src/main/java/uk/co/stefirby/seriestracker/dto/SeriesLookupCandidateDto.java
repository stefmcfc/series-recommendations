package uk.co.stefirby.seriestracker.dto;

/**
 * A single lightweight candidate from {@code GET /api/v1/series/lookup/search}, used to let a
 * user disambiguate between OMDb's matches for a title before resolving one to full lookup
 * detail via {@code GET /api/v1/series/lookup?imdbId=}. Deliberately distinct from
 * {@link SeriesLookupDto}: a search candidate carries even less data than a full lookup result
 * (no {@code genres}/ratings/season counts).
 */
public class SeriesLookupCandidateDto {

    private String title;
    private Integer year;
    private String imdbId;
    private String posterUrl;

    public SeriesLookupCandidateDto() {}

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }

    public String getImdbId() { return imdbId; }
    public void setImdbId(String imdbId) { this.imdbId = imdbId; }

    public String getPosterUrl() { return posterUrl; }
    public void setPosterUrl(String posterUrl) { this.posterUrl = posterUrl; }
}
