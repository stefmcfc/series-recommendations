package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class SeriesDto {

    private UUID id;
    private String title;
    private Integer year;
    private String genres;
    private Integer totalSeasons;
    private Integer totalEpisodes;
    private Integer currentSeason;
    private Integer currentEpisode;
    private String status;
    private BigDecimal imdbRating;
    private Integer rottenTomatoesRating;

    // series_spec_027_rotten_tomatoes_popcornmeter_and_refresh_safety.md (SERIES-027-AC-02):
    // Rotten Tomatoes' audience (Popcornmeter) score, distinct from rottenTomatoesRating above
    // (the critics' Tomatometer score) -- same partial-update-capable shape, purely
    // user-entered, never touched by SeriesRefreshService.
    private Integer rottenTomatoesPopcornmeter;

    private BigDecimal tmdbRating;
    private Integer tmdbVoteCount;
    private Integer personalRating;
    private String personalNotes;
    private String posterUrl;
    private String tags;
    private String imdbId;
    private LocalDateTime dateAdded;
    private LocalDateTime dateCompleted;

    // series_spec_018_series_refresh.md: output-only, like dateAdded/dateCompleted -- never
    // read from the incoming DTO in create/update (SERIES-018-AC-11).
    private LocalDateTime lastRefreshedAt;

    // series_spec_018_series_refresh.md (SERIES-018-AC-02), minimal prerequisite of
    // series_spec_008's Requirement 2 -- output-only, same convention as dateAdded/
    // dateCompleted/productionStatus's own SERIES-008-AC-09 design.
    private String productionStatus;

    // series_spec_021_origin_country.md (SERIES-021-AC-05): the raw ISO 3166-1 alpha-2 code(s)
    // TMDB reports for this series' origin_country array, comma-joined when there's more than
    // one (series_spec_046_multi_origin_country.md, SERIES-046-AC-07) -- read at create time
    // (SERIES-021-AC-06), same direct flow-through precedent as tmdbRating/tmdbVoteCount.
    private String originCountry;

    // series_spec_023_recommendation_metadata_and_overview.md (SERIES-023-AC-10): read at
    // create time (SERIES-023-AC-11) and refreshed alongside every other TMDB-sourced field --
    // same direct flow-through precedent as originCountry above.
    private String overview;

    // series_spec_039_last_air_year.md (SERIES-039-AC-02): the year component of TMDB's
    // last_air_date for this series' most recently aired episode -- read at create time
    // (round-tripped from SeriesLookupDto, same as originCountry/productionStatus/overview
    // above) and re-resolved on every refresh (SeriesRefreshService).
    private Integer lastAirYear;

    // series_spec_018_series_refresh.md: output-only, like lastRefreshedAt -- never read from
    // the incoming DTO in create/update (SERIES-018-AC-23). Non-null means a refresh detected
    // new content not yet acknowledged (POST /series/{id}/acknowledge-new-content).
    private LocalDateTime newContentDetectedAt;

    // series_spec_019_keyword_tracking.md (SERIES-019-AC-23): input-only, mirroring
    // dateAdded/lastRefreshedAt's output-only convention in the opposite direction -- read by
    // SeriesService.create to trigger KeywordSyncService.syncKeywords (SERIES-019-AC-24), never
    // persisted on SeriesEntity (which has no tmdbId column) and never set by entityToDto.
    private Integer tmdbId;

    // series_spec_008_series_lifecycle_data.md (SERIES-008-AC-02): boxed Boolean, not
    // primitive -- must represent "omitted from the request" (null) distinctly from
    // "explicitly set to false", the same partial-update-capable shape as every other
    // PATCH-able field on this class (SeriesEntity's own field stays a plain primitive; see
    // its own javadoc).
    private Boolean excludeFromRecommendations;

    // series_spec_008_series_lifecycle_data.md (SERIES-008-AC-19): same boxed-Boolean,
    // partial-update-capable shape as excludeFromRecommendations above.
    private Boolean flaggedForRewatch;

    // series_spec_019_keyword_tracking.md / frontend_spec_024_keyword_tracking.md
    // (FRONTEND-024-AC-02): output-only flattened KeywordEntity.name values for this series,
    // sorted alphabetically for stable ordering -- never read from the incoming DTO (there is
    // no user-authored keyword concept; keywords are populated wholesale by
    // KeywordSyncService.syncKeywords). Never null, empty list when a series has none.
    private List<String> keywords = List.of();

    // series_spec_030_clear_optional_fields.md (SERIES-030-AC-01): input-only, mirroring
    // tmdbId's existing input-only convention (SERIES-019-AC-23) but on the opposite side of
    // the create/update split -- read only by SeriesService.update to explicitly null out the
    // named optional fields (SeriesService.CLEARABLE_FIELDS), never persisted on SeriesEntity
    // and never set by entityToDto. SeriesService.create has nothing to clear, so it never
    // reads this field.
    private List<String> clearedFields;

    public SeriesDto() {
        // Explicit no-arg constructor: fields are populated field-by-field via setters afterward.
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }

    public String getGenres() { return genres; }
    public void setGenres(String genres) { this.genres = genres; }

    public Integer getTotalSeasons() { return totalSeasons; }
    public void setTotalSeasons(Integer totalSeasons) { this.totalSeasons = totalSeasons; }

    public Integer getTotalEpisodes() { return totalEpisodes; }
    public void setTotalEpisodes(Integer totalEpisodes) { this.totalEpisodes = totalEpisodes; }

    public Integer getCurrentSeason() { return currentSeason; }
    public void setCurrentSeason(Integer currentSeason) { this.currentSeason = currentSeason; }

    public Integer getCurrentEpisode() { return currentEpisode; }
    public void setCurrentEpisode(Integer currentEpisode) { this.currentEpisode = currentEpisode; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public BigDecimal getImdbRating() { return imdbRating; }
    public void setImdbRating(BigDecimal imdbRating) { this.imdbRating = imdbRating; }

    public Integer getRottenTomatoesRating() { return rottenTomatoesRating; }
    public void setRottenTomatoesRating(Integer rottenTomatoesRating) { this.rottenTomatoesRating = rottenTomatoesRating; }

    public Integer getRottenTomatoesPopcornmeter() { return rottenTomatoesPopcornmeter; }
    public void setRottenTomatoesPopcornmeter(Integer rottenTomatoesPopcornmeter) { this.rottenTomatoesPopcornmeter = rottenTomatoesPopcornmeter; }

    public BigDecimal getTmdbRating() { return tmdbRating; }
    public void setTmdbRating(BigDecimal tmdbRating) { this.tmdbRating = tmdbRating; }

    public Integer getTmdbVoteCount() { return tmdbVoteCount; }
    public void setTmdbVoteCount(Integer tmdbVoteCount) { this.tmdbVoteCount = tmdbVoteCount; }

    public Integer getPersonalRating() { return personalRating; }
    public void setPersonalRating(Integer personalRating) { this.personalRating = personalRating; }

    public String getPersonalNotes() { return personalNotes; }
    public void setPersonalNotes(String personalNotes) { this.personalNotes = personalNotes; }

    public String getPosterUrl() { return posterUrl; }
    public void setPosterUrl(String posterUrl) { this.posterUrl = posterUrl; }

    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }

    public String getImdbId() { return imdbId; }
    public void setImdbId(String imdbId) { this.imdbId = imdbId; }

    public LocalDateTime getDateAdded() { return dateAdded; }
    public void setDateAdded(LocalDateTime dateAdded) { this.dateAdded = dateAdded; }

    public LocalDateTime getDateCompleted() { return dateCompleted; }
    public void setDateCompleted(LocalDateTime dateCompleted) { this.dateCompleted = dateCompleted; }

    public LocalDateTime getLastRefreshedAt() { return lastRefreshedAt; }
    public void setLastRefreshedAt(LocalDateTime lastRefreshedAt) { this.lastRefreshedAt = lastRefreshedAt; }

    public String getProductionStatus() { return productionStatus; }
    public void setProductionStatus(String productionStatus) { this.productionStatus = productionStatus; }

    public String getOriginCountry() { return originCountry; }
    public void setOriginCountry(String originCountry) { this.originCountry = originCountry; }

    public String getOverview() { return overview; }
    public void setOverview(String overview) { this.overview = overview; }

    public Integer getLastAirYear() { return lastAirYear; }
    public void setLastAirYear(Integer lastAirYear) { this.lastAirYear = lastAirYear; }

    public LocalDateTime getNewContentDetectedAt() { return newContentDetectedAt; }
    public void setNewContentDetectedAt(LocalDateTime newContentDetectedAt) { this.newContentDetectedAt = newContentDetectedAt; }

    public Integer getTmdbId() { return tmdbId; }
    public void setTmdbId(Integer tmdbId) { this.tmdbId = tmdbId; }

    public List<String> getKeywords() { return keywords; }
    public void setKeywords(List<String> keywords) { this.keywords = keywords; }

    public Boolean getExcludeFromRecommendations() { return excludeFromRecommendations; }
    public void setExcludeFromRecommendations(Boolean excludeFromRecommendations) { this.excludeFromRecommendations = excludeFromRecommendations; }

    public Boolean getFlaggedForRewatch() { return flaggedForRewatch; }
    public void setFlaggedForRewatch(Boolean flaggedForRewatch) { this.flaggedForRewatch = flaggedForRewatch; }

    public List<String> getClearedFields() { return clearedFields; }
    public void setClearedFields(List<String> clearedFields) { this.clearedFields = clearedFields; }
}
