package uk.co.stefirby.seriestracker.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A series the user has dismissed from recommendations -- see
 * {@code series_spec_006_recommendations.md} Requirement 8. Deliberately a separate table
 * from {@link SeriesEntity} rather than a new {@link SeriesStatus} value: a dismissed
 * recommendation was never watched or added, so it has none of {@code SeriesEntity}'s
 * progress/rating fields.
 */
@Entity
@Table(name = "ignored_series")
public class IgnoredSeriesEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID id;

    @Column(nullable = false, length = 20)
    @NotBlank(message = "imdbId is required")
    private String imdbId;

    @Column(nullable = false, length = 255)
    @NotBlank(message = "title is required")
    private String title;

    @Column(nullable = true, columnDefinition = "TEXT")
    private String reason;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime ignoredAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getImdbId() { return imdbId; }
    public void setImdbId(String imdbId) { this.imdbId = imdbId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public LocalDateTime getIgnoredAt() { return ignoredAt; }
    public void setIgnoredAt(LocalDateTime ignoredAt) { this.ignoredAt = ignoredAt; }
}
