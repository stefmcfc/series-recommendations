package uk.co.stefirby.seriestracker.dto;

import java.math.BigDecimal;

/**
 * Result of a TMDB-primary series lookup ({@code GET /api/v1/series/lookup/resolve-tmdb}),
 * used to autofill the add-series form. Deliberately distinct from {@link SeriesDto}: a
 * lookup result is not a persisted series and has no {@code id}, {@code dateAdded},
 * {@code status}, etc.
 *
 * <p>Per {@code series_spec_017_tmdb_primary_lookup.md}: {@code title}/{@code year}/
 * {@code genres}/{@code totalSeasons}/{@code totalEpisodes}/{@code posterUrl}/
 * {@code tmdbRating}/{@code tmdbVoteCount} are always sourced from TMDB; {@code imdbRating}/
 * {@code rottenTomatoesRating} are optional OMDb enrichment, populated only when TMDB
 * resolves an {@code imdbId} and OMDb has a record for it.
 */
public class SeriesLookupDto {

    // series_spec_019_keyword_tracking.md (SERIES-019-AC-22): round-tripped by
    // resolveTmdbCandidate from its own tmdbId parameter, so the add-series form (and
    // eventually SeriesDto.create, Requirement 6) can populate keywords at creation time
    // without a second TMDB lookup.
    private Integer tmdbId;

    private String title;
    private Integer year;
    private String genres;
    private Integer totalSeasons;
    private Integer totalEpisodes;
    private BigDecimal imdbRating;
    private Integer rottenTomatoesRating;
    private BigDecimal tmdbRating;
    private Integer tmdbVoteCount;
    private String posterUrl;
    private String imdbId;

    // series_spec_021_origin_country.md (SERIES-021-AC-04): the resolved candidate's first
    // origin_country entry, sourced from TmdbSeriesDetail.originCountry().
    private String originCountry;

    // series_spec_021_origin_country.md (SERIES-021-AC-07): closes a gap left by
    // series_spec_018 -- TmdbSeriesDetail.productionStatus() was already available on every
    // resolve-tmdb call but was never copied onto this DTO until now.
    private String productionStatus;

    // series_spec_023_recommendation_metadata_and_overview.md (SERIES-023-AC-09): the resolved
    // candidate's TMDB description, sourced from TmdbSeriesDetail.overview() -- round-tripped
    // so the add-series form can carry it into the create payload (SERIES-023-AC-11), same
    // precedent as originCountry/productionStatus above.
    private String overview;

    public SeriesLookupDto() {
        // Explicit no-arg constructor: fields are populated field-by-field via setters afterward.
    }

    public Integer getTmdbId() { return tmdbId; }
    public void setTmdbId(Integer tmdbId) { this.tmdbId = tmdbId; }

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

    public BigDecimal getImdbRating() { return imdbRating; }
    public void setImdbRating(BigDecimal imdbRating) { this.imdbRating = imdbRating; }

    public Integer getRottenTomatoesRating() { return rottenTomatoesRating; }
    public void setRottenTomatoesRating(Integer rottenTomatoesRating) { this.rottenTomatoesRating = rottenTomatoesRating; }

    public BigDecimal getTmdbRating() { return tmdbRating; }
    public void setTmdbRating(BigDecimal tmdbRating) { this.tmdbRating = tmdbRating; }

    public Integer getTmdbVoteCount() { return tmdbVoteCount; }
    public void setTmdbVoteCount(Integer tmdbVoteCount) { this.tmdbVoteCount = tmdbVoteCount; }

    public String getPosterUrl() { return posterUrl; }
    public void setPosterUrl(String posterUrl) { this.posterUrl = posterUrl; }

    public String getImdbId() { return imdbId; }
    public void setImdbId(String imdbId) { this.imdbId = imdbId; }

    public String getOriginCountry() { return originCountry; }
    public void setOriginCountry(String originCountry) { this.originCountry = originCountry; }

    public String getProductionStatus() { return productionStatus; }
    public void setProductionStatus(String productionStatus) { this.productionStatus = productionStatus; }

    public String getOverview() { return overview; }
    public void setOverview(String overview) { this.overview = overview; }
}
