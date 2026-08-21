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
}