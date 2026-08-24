package uk.co.stefirby.seriestracker.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

/**
 * A single TMDB keyword (e.g. {@code "spy"}, {@code "mi5"}), shared across every
 * {@link SeriesEntity} that carries it via the {@code series_keyword} join table -- see
 * {@code series_spec_019_keyword_tracking.md}. Looked up/created by {@code tmdbKeywordId}
 * (never by {@code name}) so an already-known TMDB keyword is never duplicated
 * (SERIES-019-AC-09).
 */
@Entity
@Table(name = "keyword")
public class KeywordEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID id;

    @Column(name = "tmdb_keyword_id", nullable = false, unique = true)
    @NotNull
    private Integer tmdbKeywordId;

    @Column(nullable = false, length = 255)
    @NotBlank
    private String name;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Integer getTmdbKeywordId() { return tmdbKeywordId; }
    public void setTmdbKeywordId(Integer tmdbKeywordId) { this.tmdbKeywordId = tmdbKeywordId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
