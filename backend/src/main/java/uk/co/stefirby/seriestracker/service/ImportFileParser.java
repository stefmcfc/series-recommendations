package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.SeriesDto;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * Extracted out of {@code SeriesController} (chore/sonar-cleanup) -- JSON parsing/validation of
 * an uploaded import file is real business logic, not something a thin controller should own.
 * See series_spec_038_import.md (SERIES-038-AC-01/02): reads the same {@code { series:
 * SeriesDto[] } } shape {@code SeriesExportService.exportAsJson} produces, ignoring
 * {@code exportDate}/{@code count} if present so a re-uploaded, unmodified export file works
 * unchanged.
 */
@Component
public class ImportFileParser {

    private static final String SERIES_FIELD = "series";

    private final ObjectMapper objectMapper;

    public ImportFileParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<SeriesDto> parse(MultipartFile file) {
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException _) {
            throw new IllegalArgumentException("Unable to read the uploaded file");
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(bytes);
        } catch (JacksonException _) {
            throw new IllegalArgumentException("Uploaded file is not valid JSON");
        }

        if (root == null || !root.has(SERIES_FIELD) || !root.get(SERIES_FIELD).isArray()) {
            throw new IllegalArgumentException("Uploaded file must contain a 'series' array");
        }

        return objectMapper.convertValue(root.get(SERIES_FIELD), new TypeReference<List<SeriesDto>>() { });
    }
}
