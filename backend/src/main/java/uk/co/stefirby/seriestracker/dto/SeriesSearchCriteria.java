package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;
import java.util.List;

public class SeriesSearchCriteria {
    private String title;
    private List<String> genres;
    // series_spec_019_keyword_tracking.md (SERIES-019-AC-18): mirrors genres' shape/OR-logic
    // exactly, but matched exactly (case-insensitively) rather than by substring -- see
    // SeriesSearchService.matchesKeywords.
    private List<String> keywords;
    private String status;
    private Integer minPersonalRating;
    private Integer maxPersonalRating;
    private BigDecimal minImdbRating;
    private BigDecimal maxImdbRating;
    private Boolean startedNotFinished;
    // series_spec_008_series_lifecycle_data.md (SERIES-008-AC-20): same nullable-boolean-filter
    // shape as startedNotFinished above -- when non-null and true, restricts results to only
    // series with flaggedForRewatch == true. No server-side status restriction (SERIES-008-AC-21).
    private Boolean flaggedForRewatch;
    // series_spec_009_rating_sort.md (SERIES-009-AC-01/07): dateAdded (default) |
    // personalRating | title | year | imdbRating | tmdbRating.
    private String sortBy;
    // series_spec_009_rating_sort.md (SERIES-009-AC-01): asc | desc, default desc.
    private String sortDirection;

    public SeriesSearchCriteria() {}

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public List<String> getGenres() { return genres; }
    public void setGenres(List<String> genres) { this.genres = genres; }
    public List<String> getKeywords() { return keywords; }
    public void setKeywords(List<String> keywords) { this.keywords = keywords; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getMinPersonalRating() { return minPersonalRating; }
    public void setMinPersonalRating(Integer minPersonalRating) { this.minPersonalRating = minPersonalRating; }
    public Integer getMaxPersonalRating() { return maxPersonalRating; }
    public void setMaxPersonalRating(Integer maxPersonalRating) { this.maxPersonalRating = maxPersonalRating; }
    public BigDecimal getMinImdbRating() { return minImdbRating; }
    public void setMinImdbRating(BigDecimal minImdbRating) { this.minImdbRating = minImdbRating; }
    public BigDecimal getMaxImdbRating() { return maxImdbRating; }
    public void setMaxImdbRating(BigDecimal maxImdbRating) { this.maxImdbRating = maxImdbRating; }
    public Boolean getStartedNotFinished() { return startedNotFinished; }
    public void setStartedNotFinished(Boolean startedNotFinished) { this.startedNotFinished = startedNotFinished; }
    public Boolean getFlaggedForRewatch() { return flaggedForRewatch; }
    public void setFlaggedForRewatch(Boolean flaggedForRewatch) { this.flaggedForRewatch = flaggedForRewatch; }
    public String getSortBy() { return sortBy; }
    public void setSortBy(String sortBy) { this.sortBy = sortBy; }
    public String getSortDirection() { return sortDirection; }
    public void setSortDirection(String sortDirection) { this.sortDirection = sortDirection; }
}