package uk.co.stefirby.seriestracker.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "series")
@ValidSeries
public class SeriesEntity {

    // Hibernate 6+ defaults UUID columns to BINARY, but the Flyway migration declares
    // `id` as TEXT (and the API serializes it as a string) — force VARCHAR to match.
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID id;

    @Column(nullable = false, length = 255)
    @NotBlank(message = "Title is required")
    private String title;

    // series_spec_041_year_validation_bounds.md (SERIES-041-AC-03): the floor (1900) is a
    // legitimate static bound and stays here, but the dynamic upper bound (current year + 1)
    // can't be expressed as a compile-time @Max constant -- it's enforced imperatively by
    // SeriesService.validateYearRange instead.
    @Column(nullable = true)
    @Min(value = 1900, message = "Year must be >= 1900")
    private Integer year;

    @Column(nullable = true, length = 500)
    private String genres;

    @Column(nullable = true)
    @Min(value = 1, message = "Total seasons must be > 0")
    private Integer totalSeasons;

    @Column(nullable = true)
    @Min(value = 1, message = "Total episodes must be > 0")
    private Integer totalEpisodes;

    @Column(nullable = true)
    @Min(value = 1, message = "Current season must be > 0")
    private Integer currentSeason;

    @Column(nullable = true)
    @Min(value = 1, message = "Current episode must be > 0")
    private Integer currentEpisode;

    @Column(nullable = true)
    @Enumerated(EnumType.STRING)
    private SeriesStatus status = SeriesStatus.BACKLOG;

    @Column(nullable = true, precision = 3, scale = 1)
    @DecimalMin(value = "0.0", message = "IMDb rating must be >= 0")
    @DecimalMax(value = "10.0", message = "IMDb rating must be <= 10")
    private BigDecimal imdbRating;

    @Column(nullable = true)
    @Min(value = 0, message = "Rotten Tomatoes rating must be >= 0")
    @Max(value = 100, message = "Rotten Tomatoes rating must be <= 100")
    private Integer rottenTomatoesRating;

    // series_spec_027_rotten_tomatoes_popcornmeter_and_refresh_safety.md (SERIES-027-AC-01):
    // Rotten Tomatoes' audience (Popcornmeter) score, distinct from rottenTomatoesRating above
    // (the critics' Tomatometer score, sourced from OMDb). Purely user-entered -- there is no
    // external source for it, so it is never touched by SeriesRefreshService. Same shape as
    // rottenTomatoesRating (nullable, 0-100).
    @Column(nullable = true)
    @Min(value = 0, message = "Rotten Tomatoes Popcornmeter must be >= 0")
    @Max(value = 100, message = "Rotten Tomatoes Popcornmeter must be <= 100")
    private Integer rottenTomatoesPopcornmeter;

    // SERIES-017-AC-10: TMDB's own community rating/vote count, populated at create time
    // from TmdbClient.details() -- an independent third rating source alongside imdbRating/
    // rottenTomatoesRating, named to match RecommendationDto.tmdbRating/voteCount
    // (series_spec_016) for the same TMDB concept.
    @Column(nullable = true, precision = 3, scale = 1)
    @DecimalMin(value = "0.0", message = "TMDB rating must be >= 0")
    @DecimalMax(value = "10.0", message = "TMDB rating must be <= 10")
    private BigDecimal tmdbRating;

    @Column(nullable = true)
    @Min(value = 0, message = "TMDB vote count must be >= 0")
    private Integer tmdbVoteCount;

    @Column(nullable = true)
    @Min(value = 1, message = "Personal rating must be >= 1")
    @Max(value = 5, message = "Personal rating must be <= 5")
    private Integer personalRating;

    @Column(nullable = true, columnDefinition = "TEXT")
    private String personalNotes;

    @Column(nullable = true, length = 1000)
    private String posterUrl;

    // SERIES-014-AC-01/03/04/05: nullable, comma-separated, user-supplied labels for
    // organizing a collection. Same storage shape as genres exactly (column type,
    // nullable/length convention, verbatim no-parsing policy) -- just sourced from the
    // user rather than an external API, with no fixed vocabulary.
    @Column(nullable = true, length = 500)
    private String tags;

    // SERIES-006-AC-01: nullable -- manually-added series that never went through the OMDb
    // lookup won't have one. Indexed (idx_series_imdb_id, V003 migration) since it's queried
    // for existence checks by RecommendationService.
    @Column(nullable = true, length = 20)
    private String imdbId;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime dateAdded;

    @Column(nullable = true)
    private LocalDateTime dateCompleted;

    // series_spec_018_series_refresh.md (SERIES-018-AC-10/12): when this series' TMDB/IMDb/RT
    // ratings were last refreshed from upstream, either by an explicit refresh or at create
    // time (a just-added series is as fresh as it will ever be without a refresh).
    @Column(nullable = true)
    private LocalDateTime lastRefreshedAt;

    // series_spec_018_series_refresh.md (SERIES-018-AC-02), a minimal prerequisite of
    // series_spec_008's own Requirement 2 (not yet otherwise implemented -- see
    // ProductionStatus's own javadoc). Nullable: unresolved until the first successful
    // refresh that has a resolvable imdbId.
    @Column(nullable = true)
    @Enumerated(EnumType.STRING)
    private ProductionStatus productionStatus;

    // series_spec_021_origin_country.md (SERIES-021-AC-05): the raw ISO 3166-1 alpha-2 code(s)
    // TMDB reports for this series' origin_country array, comma-joined when there's more than
    // one (series_spec_046_multi_origin_country.md, SERIES-046-AC-07/08) -- nullable
    // (manually-added series never went through a TMDB lookup won't have one), no format
    // validation, same posture as imdbId (see the spec's Design Decisions). length widened
    // from 2 to 50 by SERIES-046-AC-08 (entity-annotation only, no Flyway migration -- see that
    // spec's Design Decisions for why SQLite makes a real ALTER COLUMN migration inexpressible
    // here).
    @Column(nullable = true, length = 50)
    private String originCountry;

    // series_spec_023_recommendation_metadata_and_overview.md (SERIES-023-AC-10): a series'
    // TMDB description, sourced from TmdbSeriesDetail.overview() -- nullable (a manually-added
    // series with no tmdbId, or one whose TMDB lookup never resolved a detail, has no
    // overview), same TEXT storage shape as personalNotes since it's a long free-text
    // paragraph, not a short delimited field.
    @Column(nullable = true, columnDefinition = "TEXT")
    private String overview;

    // series_spec_039_last_air_year.md (SERIES-039-AC-02): the year component of TMDB's
    // last_air_date for this series' most recently aired episode -- for an ended show, its
    // true end year; for a still-running show, the year of the most recent episode aired so
    // far. Nullable (manually-added series, or one whose TMDB lookup/refresh never resolved a
    // detail, has no value), same posture as productionStatus/originCountry. Re-resolved on
    // every refresh (SeriesRefreshService), unlike productionStatus/originCountry, since it's
    // expected to change over a running show's lifetime.
    @Column(nullable = true)
    private Integer lastAirYear;

    // series_spec_018_series_refresh.md (SERIES-018-AC-23): non-null means a refresh found
    // totalSeasons/totalEpisodes had increased since the prior refresh, not yet acknowledged.
    // Never auto-cleared by a subsequent refresh that finds no further increase
    // (SERIES-018-AC-25) -- only POST /series/{id}/acknowledge-new-content clears it
    // (SERIES-018-AC-27).
    @Column(nullable = true)
    private LocalDateTime newContentDetectedAt;

    // series_spec_008_series_lifecycle_data.md (SERIES-008-AC-01): "don't use me as an
    // automatic taste signal" -- suppresses this series from RecommendationService's automatic
    // watched-pool sourcing only (SERIES-008-AC-04), never an explicit seriesIds selection
    // (SERIES-008-AC-05, see the spec's Design Decisions). NOT NULL DEFAULT FALSE: a series
    // that's never been touched is simply "not excluded", so a primitive boolean is enough here
    // even though SeriesDto's own field is boxed (SERIES-008-AC-02) for partial-update null
    // semantics.
    @Column(nullable = false)
    private boolean excludeFromRecommendations = false;

    // series_spec_008_series_lifecycle_data.md (SERIES-008-AC-18): a persistent "rewatch
    // candidate" marker the user sets while browsing, filtered on via
    // SeriesSearchCriteria.flaggedForRewatch (SERIES-008-AC-20) -- no server-side status
    // restriction (SERIES-008-AC-21). Same NOT NULL DEFAULT FALSE / primitive-vs-boxed-DTO
    // shape as excludeFromRecommendations above.
    @Column(nullable = false)
    private boolean flaggedForRewatch = false;

    // series_spec_019_keyword_tracking.md (SERIES-019-AC-03): a series' TMDB keywords,
    // normalized via a shared `keyword` table plus a `series_keyword` join table -- unlike
    // `genres`/`tags`, this needs COUNT/AVG-style aggregation (KeywordStatsService), which a
    // delimited string column can't support without parsing every row on every query.
    // Populated/replaced wholesale by KeywordSyncService.syncKeywords rather than mutated
    // piecemeal elsewhere.
    //
    // frontend_spec_024_keyword_tracking.md (FRONTEND-024-AC-02): eagerly fetched, not lazy --
    // SeriesService.entityToDto now flattens this collection into SeriesDto.keywords on every
    // read (getById/getAll/create/update), so it needs to be available whenever an entity is
    // loaded, not just within an still-open session. KeywordStatsService already loads every
    // series' full keyword set into memory for GET /series/keywords regardless (see its own
    // javadoc's "fine at this app's scale" precedent), so this doesn't introduce a new class of
    // cost -- it just makes the always-needed case the default instead of a lazy trap.
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "series_keyword",
        joinColumns = @JoinColumn(name = "series_id"),
        inverseJoinColumns = @JoinColumn(name = "keyword_id")
    )
    private Set<KeywordEntity> keywords = new HashSet<>();

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

    public SeriesStatus getStatus() { return status; }
    public void setStatus(SeriesStatus status) { this.status = status; }

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

    public ProductionStatus getProductionStatus() { return productionStatus; }
    public void setProductionStatus(ProductionStatus productionStatus) { this.productionStatus = productionStatus; }

    public String getOriginCountry() { return originCountry; }
    public void setOriginCountry(String originCountry) { this.originCountry = originCountry; }

    public String getOverview() { return overview; }
    public void setOverview(String overview) { this.overview = overview; }

    public Integer getLastAirYear() { return lastAirYear; }
    public void setLastAirYear(Integer lastAirYear) { this.lastAirYear = lastAirYear; }

    public LocalDateTime getNewContentDetectedAt() { return newContentDetectedAt; }
    public void setNewContentDetectedAt(LocalDateTime newContentDetectedAt) { this.newContentDetectedAt = newContentDetectedAt; }

    public Set<KeywordEntity> getKeywords() { return keywords; }
    public void setKeywords(Set<KeywordEntity> keywords) { this.keywords = keywords; }

    public boolean isExcludeFromRecommendations() { return excludeFromRecommendations; }
    public void setExcludeFromRecommendations(boolean excludeFromRecommendations) { this.excludeFromRecommendations = excludeFromRecommendations; }

    public boolean isFlaggedForRewatch() { return flaggedForRewatch; }
    public void setFlaggedForRewatch(boolean flaggedForRewatch) { this.flaggedForRewatch = flaggedForRewatch; }
}