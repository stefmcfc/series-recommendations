package uk.co.stefirby.seriestracker.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Maps {@link FilterProfileEntity#criteria} (an opaque {@link JsonNode} blob the backend never
 * validates or queries into -- see series_spec_055_filter_profiles.md's Design Decisions) to a
 * {@code TEXT} column, so it round-trips as real nested JSON over the API rather than forcing the
 * frontend to double-encode (a raw {@code String} column) or relying on a SQLite JSON column type
 * this stack's community dialect doesn't support.
 *
 * <p>Instantiates {@code new ObjectMapper()} directly, matching {@code SeriesExportService}'s
 * existing pattern -- this converter has no Spring context to be constructor-injected from.
 */
@Converter
public class JsonNodeConverter implements AttributeConverter<JsonNode, String> {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(JsonNode attribute) {
        if (attribute == null) {
            return null;
        }
        return objectMapper.writeValueAsString(attribute);
    }

    @Override
    public JsonNode convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        return objectMapper.readTree(dbData);
    }
}
