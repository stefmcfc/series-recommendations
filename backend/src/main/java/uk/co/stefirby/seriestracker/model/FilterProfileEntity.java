package uk.co.stefirby.seriestracker.model;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import tools.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A named, saved filter/criteria snapshot for one of three unrelated frontend contexts (see
 * {@link FilterProfileArea}) -- see series_spec_055_filter_profiles.md. {@code criteria} is an
 * opaque JSON blob the backend never interprets or queries into; uniqueness is scoped to
 * {@code (area, name)}, not {@code name} alone (enforced by a unique index -- V011).
 */
@Entity
@Table(name = "filter_profile")
public class FilterProfileEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private FilterProfileArea area;

    @Column(nullable = false, length = 255)
    @NotBlank(message = "name is required")
    private String name;

    @Convert(converter = JsonNodeConverter.class)
    @Column(nullable = false, columnDefinition = "TEXT")
    private JsonNode criteria;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public FilterProfileArea getArea() { return area; }
    public void setArea(FilterProfileArea area) { this.area = area; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public JsonNode getCriteria() { return criteria; }
    public void setCriteria(JsonNode criteria) { this.criteria = criteria; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
