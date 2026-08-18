package com.example.seriestracker.dto;

import java.math.BigDecimal;

/**
 * Result of an OMDb title lookup ({@code GET /api/v1/series/lookup}), used to autofill the
 * add-series form. Deliberately distinct from {@link SeriesDto}: a lookup result is not a
 * persisted series and has no {@code id}, {@code dateAdded}, {@code status}, etc.
 */
public class SeriesLookupDto {

    private String title;
    private Integer year;
    private String genres;
    private Integer totalSeasons;
    private Integer totalEpisodes;
    private BigDecimal imdbRating;
    private Integer metacriticRating;
    private Integer rottenTomatoesRating;
    private String posterUrl;

    public SeriesLookupDto() {}

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

    public Integer getMetacriticRating() { return metacriticRating; }
    public void setMetacriticRating(Integer metacriticRating) { this.metacriticRating = metacriticRating; }

    public Integer getRottenTomatoesRating() { return rottenTomatoesRating; }
    public void setRottenTomatoesRating(Integer rottenTomatoesRating) { this.rottenTomatoesRating = rottenTomatoesRating; }

    public String getPosterUrl() { return posterUrl; }
    public void setPosterUrl(String posterUrl) { this.posterUrl = posterUrl; }
}
