package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;
import java.util.List;

public class SeriesSearchCriteria {
    private String title;
    private List<String> genres;
    // series_spec_042_exclude_genres_search.md (SERIES-042-AC-01): mirrors genres' shape exactly;
    // matched by SeriesSearchService.matchesExcludeGenres, a negated version of matchesGenres.
    private List<String> excludeGenres;
    // series_spec_019_keyword_tracking.md (SERIES-019-AC-18): mirrors genres' shape/OR-logic
    // exactly, but matched exactly (case-insensitively) rather than by substring -- see
    // SeriesSearchService.matchesKeywords.
    private List<String> keywords;
    private String status;
    private Integer minPersonalRating;
    private BigDecimal minImdbRating;
    // series_spec_037_search_filter_overhaul.md (SERIES-037-AC-02): mirrors minImdbRating's
    // shape exactly, matched against SeriesEntity.tmdbRating.
    private BigDecimal minTmdbRating;
    // series_spec_037_search_filter_overhaul.md (SERIES-037-AC-03): matched against the series'
    // single stored SeriesEntity.year -- a documented stopgap, not a true episode-air-date range
    // (see the spec's Design Decisions).
    private Integer yearMin;
    private Integer yearMax;
    // series_spec_008_series_lifecycle_data.md (SERIES-008-AC-20): same nullable-boolean-filter
    // shape as startedNotFinished above -- when non-null and true, restricts results to only
    // series with flaggedForRewatch == true. No server-side status restriction (SERIES-008-AC-21).
    private Boolean flaggedForRewatch;
    // series_spec_009_rating_sort.md (SERIES-009-AC-01/07): dateAdded (default) |
    // personalRating | title | year | imdbRating | tmdbRating.
    private String sortBy;
    // series_spec_009_rating_sort.md (SERIES-009-AC-01): asc | desc, default desc.
    private String sortDirection;


    public SeriesSearchCriteria() {
        // Explicit no-arg constructor: fields are populated field-by-field via setters afterward.
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public List<String> getGenres() { return genres; }
    public void setGenres(List<String> genres) { this.genres = genres; }
    public List<String> getExcludeGenres() { return excludeGenres; }
    public void setExcludeGenres(List<String> excludeGenres) { this.excludeGenres = excludeGenres; }
    public List<String> getKeywords() { return keywords; }
    public void setKeywords(List<String> keywords) { this.keywords = keywords; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getMinPersonalRating() { return minPersonalRating; }
    public void setMinPersonalRating(Integer minPersonalRating) { this.minPersonalRating = minPersonalRating; }
    public BigDecimal getMinImdbRating() { return minImdbRating; }
    public void setMinImdbRating(BigDecimal minImdbRating) { this.minImdbRating = minImdbRating; }
    public BigDecimal getMinTmdbRating() { return minTmdbRating; }
    public void setMinTmdbRating(BigDecimal minTmdbRating) { this.minTmdbRating = minTmdbRating; }
    public Integer getYearMin() { return yearMin; }
    public void setYearMin(Integer yearMin) { this.yearMin = yearMin; }
    public Integer getYearMax() { return yearMax; }
    public void setYearMax(Integer yearMax) { this.yearMax = yearMax; }
    public Boolean getFlaggedForRewatch() { return flaggedForRewatch; }
    public void setFlaggedForRewatch(Boolean flaggedForRewatch) { this.flaggedForRewatch = flaggedForRewatch; }
    public String getSortBy() { return sortBy; }
    public void setSortBy(String sortBy) { this.sortBy = sortBy; }
    public String getSortDirection() { return sortDirection; }
    public void setSortDirection(String sortDirection) { this.sortDirection = sortDirection; }
}
