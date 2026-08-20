package uk.co.stefirby.seriestracker.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.LocalDateTime;
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

    // SERIES-013-AC-01: nullable, mirrors title's own @Column definition minus the
    // @NotBlank/nullable=false constraints -- storage for the "other" name a series is
    // known by (e.g. OMDb's "MI-5" vs. the TMDB-searched "Spooks"). No index -- nothing
    // in this spec's scope filters or looks up by alternateTitle.
    @Column(nullable = true, length = 255)
    private String alternateTitle;

    @Column(nullable = true)
    @Min(value = 1, message = "Year must be greater than 0")
    @Max(value = 2026, message = "Year must be <= current year")
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
    @Min(value = 0, message = "Metacritic rating must be >= 0")
    @Max(value = 100, message = "Metacritic rating must be <= 100")
    private Integer metacriticRating;

    @Column(nullable = true)
    @Min(value = 0, message = "Rotten Tomatoes rating must be >= 0")
    @Max(value = 100, message = "Rotten Tomatoes rating must be <= 100")
    private Integer rottenTomatoesRating;

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

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getAlternateTitle() { return alternateTitle; }
    public void setAlternateTitle(String alternateTitle) { this.alternateTitle = alternateTitle; }

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

    public Integer getMetacriticRating() { return metacriticRating; }
    public void setMetacriticRating(Integer metacriticRating) { this.metacriticRating = metacriticRating; }

    public Integer getRottenTomatoesRating() { return rottenTomatoesRating; }
    public void setRottenTomatoesRating(Integer rottenTomatoesRating) { this.rottenTomatoesRating = rottenTomatoesRating; }

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
}