package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Optional sourcing/ranking/filtering overrides for {@code GET /api/v1/series/recommendations}
 * (see {@code series_spec_007_recommendation_sourcing.md}). Mirrors {@link
 * SeriesSearchCriteria}'s shape and rationale -- a filter/criteria object assembled by the
 * controller from request params and read field-by-field by {@code RecommendationService},
 * where every {@code null}/absent field means "no override, fall back to default behavior"
 * (the one deliberate exception being {@code minVoteCount}, which defaults to a non-zero
 * value when unset -- see SERIES-007-AC-25).
 *
 * <p>{@code seriesIds} is kept as raw {@code List<String>} rather than {@code List<UUID>}:
 * parsing/validating each entry as a UUID is business logic ("is this a well-formed,
 * existing series id?"), not request-shape translation, so it belongs in {@code
 * RecommendationService} (SERIES-007-AC-09), following this app's existing "validation lives
 * in the service layer" convention (mirrors {@code SeriesSearchService}'s own {@code status}
 * validation).
 */
public class RecommendationCriteria {

    private List<String> seriesIds;
    private List<String> genres;
    private List<String> keywords;
    private Integer minSourceRating;
    private BigDecimal minTmdbRating;
    private Integer minVoteCount;
    private Integer yearMin;
    private Integer yearMax;
    private List<String> excludeGenres;
    private List<String> excludeKeywords;
    private String language;
    private Integer maxPerSource;
    private Integer maxSourcesShown;
    private String sortBy;
    private String sourceMode;
    private String trendingWindow;
    private String discoverSortBy;

    public RecommendationCriteria() {}

    public List<String> getSeriesIds() { return seriesIds; }
    public void setSeriesIds(List<String> seriesIds) { this.seriesIds = seriesIds; }

    public List<String> getGenres() { return genres; }
    public void setGenres(List<String> genres) { this.genres = genres; }

    public List<String> getKeywords() { return keywords; }
    public void setKeywords(List<String> keywords) { this.keywords = keywords; }

    public Integer getMinSourceRating() { return minSourceRating; }
    public void setMinSourceRating(Integer minSourceRating) { this.minSourceRating = minSourceRating; }

    public BigDecimal getMinTmdbRating() { return minTmdbRating; }
    public void setMinTmdbRating(BigDecimal minTmdbRating) { this.minTmdbRating = minTmdbRating; }

    public Integer getMinVoteCount() { return minVoteCount; }
    public void setMinVoteCount(Integer minVoteCount) { this.minVoteCount = minVoteCount; }

    public Integer getYearMin() { return yearMin; }
    public void setYearMin(Integer yearMin) { this.yearMin = yearMin; }

    public Integer getYearMax() { return yearMax; }
    public void setYearMax(Integer yearMax) { this.yearMax = yearMax; }

    public List<String> getExcludeGenres() { return excludeGenres; }
    public void setExcludeGenres(List<String> excludeGenres) { this.excludeGenres = excludeGenres; }

    /**
     * {@code List<String>} of TMDB keyword names to exclude a candidate on a match
     * (SERIES-024-AC-01), following the exact null/empty-means-no-op convention {@code
     * excludeGenres} already uses. Unlike {@code excludeGenres}, checking this filter requires
     * a per-candidate {@code TmdbClient.showKeywords} call -- see {@code
     * RecommendationService#matchesExcludeKeywords}.
     */
    public List<String> getExcludeKeywords() { return excludeKeywords; }
    public void setExcludeKeywords(List<String> excludeKeywords) { this.excludeKeywords = excludeKeywords; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public Integer getMaxPerSource() { return maxPerSource; }
    public void setMaxPerSource(Integer maxPerSource) { this.maxPerSource = maxPerSource; }

    public Integer getMaxSourcesShown() { return maxSourcesShown; }
    public void setMaxSourcesShown(Integer maxSourcesShown) { this.maxSourcesShown = maxSourcesShown; }

    public String getSortBy() { return sortBy; }
    public void setSortBy(String sortBy) { this.sortBy = sortBy; }

    /**
     * {@code "trending"} or {@code "topRated"} (SERIES-022-AC-06) -- a third directed-sourcing
     * mode alongside {@code seriesIds}/{@code genres}/{@code keywords}, mutually exclusive with
     * all three (SERIES-022-AC-16).
     */
    public String getSourceMode() { return sourceMode; }
    public void setSourceMode(String sourceMode) { this.sourceMode = sourceMode; }

    /**
     * {@code "day"} or {@code "week"} (SERIES-022-AC-07), read only when {@code sourceMode} is
     * {@code "trending"} -- ignored, not an error, otherwise (SERIES-022-AC-18).
     */
    public String getTrendingWindow() { return trendingWindow; }
    public void setTrendingWindow(String trendingWindow) { this.trendingWindow = trendingWindow; }

    /**
     * TMDB's native {@code discover/tv} {@code sort_by} value (SERIES-025-AC-03), read only
     * when {@code sourceMode} is {@code "topRated"} or the request is genre/keyword-directed
     * -- ignored, not an error, otherwise (SERIES-025-AC-04's Design Decisions), matching
     * {@code trendingWindow}'s existing mode-scoped-param convention. Validated in {@code
     * RecommendationService#validate} against TMDB's full confirmed {@code sort_by} enum when
     * non-blank.
     */
    public String getDiscoverSortBy() { return discoverSortBy; }
    public void setDiscoverSortBy(String discoverSortBy) { this.discoverSortBy = discoverSortBy; }
}
