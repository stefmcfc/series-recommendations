package uk.co.stefirby.seriestracker.service.io;

import uk.co.stefirby.seriestracker.dto.SeriesDto;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Extracted out of {@code SeriesController} (chore/sonar-cleanup) -- parsing/validation of an
 * uploaded import file is real business logic, not something a thin controller should own.
 *
 * <p>series_spec_038_import.md (SERIES-038-AC-01/02): a {@code .json} file must match the same
 * {@code { series: SeriesDto[] } } shape {@code SeriesExportService.exportAsJson} produces,
 * ignoring {@code exportDate}/{@code count} if present so a re-uploaded, unmodified export file
 * works unchanged.
 *
 * <p>series_spec_058_csv_import.md (SERIES-058-AC-01..06): a {@code .csv} file must match
 * {@code SeriesExportService.CSV_HEADERS} exactly (same 21 columns, same order, case-sensitive)
 * and is mapped row-by-row into {@code SeriesDto} entries -- the literal reverse of
 * {@code SeriesExportService.csvRow}/{@code csv()}'s encoding. Any other extension is rejected
 * with {@code 400} before a job starts, same as a structurally invalid {@code .json} file.
 */
@Component
public class ImportFileParser {

    private static final String SERIES_FIELD = "series";

    // Mirrors SeriesExportService.CSV_HEADERS exactly (SERIES-058-AC-02) -- kept as its own copy
    // here (rather than reused from SeriesExportService) since that field is private there and
    // this class's concern is validating an *uploaded* header row, not producing one.
    private static final List<String> CSV_HEADERS = List.of(
        "id", "title", "year", "genres", "totalSeasons", "totalEpisodes",
        "currentSeason", "currentEpisode", "status", "imdbRating",
        "rottenTomatoesRating", "rottenTomatoesPopcornmeter", "tmdbRating", "tmdbVoteCount",
        "personalRating", "personalNotes", "posterUrl", "tags", "originCountry",
        "originalLanguage", "dateAdded", "dateCompleted"
    );

    // Matches SeriesExportService.ISO exactly -- the CSV encoding this parser reverses.
    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'");

    private final ObjectMapper objectMapper;

    public ImportFileParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<SeriesDto> parse(MultipartFile file) {
        String filename = file.getOriginalFilename();
        String lower = filename == null ? "" : filename.toLowerCase(Locale.ROOT);

        if (lower.endsWith(".json")) {
            return parseJson(file);
        }
        if (lower.endsWith(".csv")) {
            return parseCsv(file);
        }
        throw new IllegalArgumentException("Uploaded file must be a .json or .csv file");
    }

    private List<SeriesDto> parseJson(MultipartFile file) {
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

        return objectMapper.convertValue(root.get(SERIES_FIELD), new TypeReference<>() {
        });
    }

    /**
     * series_spec_058: reverses {@code SeriesExportService.exportAsCsv}'s exact encoding. The
     * header row is validated up front against {@link #CSV_HEADERS} (SERIES-058-AC-02); each data
     * row is then mapped field-by-field, mirroring {@code csvRow}'s column order
     * (SERIES-058-AC-04). A row with an unparseable cell doesn't abort the whole file -- it's
     * replaced with a blank {@code SeriesDto} (title left {@code null}), which
     * {@code SeriesService.create} already rejects with "Title is required", routing it into
     * {@code BulkImportService}'s existing per-row error accumulation unchanged
     * (SERIES-058-AC-05/06).
     */
    private List<SeriesDto> parseCsv(MultipartFile file) {
        CSVFormat format = CSVFormat.RFC4180.builder()
            .setHeader()
            .setSkipHeaderRecord(true)
            .get();

        try (CSVParser parser = CSVParser.parse(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8), format)) {

            if (!CSV_HEADERS.equals(parser.getHeaderNames())) {
                throw new IllegalArgumentException(
                    "Uploaded CSV file's header row does not match the expected export format");
            }

            List<SeriesDto> entries = new ArrayList<>();
            for (CSVRecord csvRecord : parser) {
                entries.add(toDto(csvRecord));
            }
            return entries;
        } catch (IOException e) {
            throw new IllegalArgumentException("Unable to read the uploaded file", e);
        }
    }

    private SeriesDto toDto(CSVRecord csvRecord) {
        try {
            SeriesDto dto = new SeriesDto();
            dto.setTitle(cell(csvRecord, "title"));
            dto.setYear(intCell(csvRecord, "year"));
            dto.setGenres(cell(csvRecord, "genres"));
            dto.setTotalSeasons(intCell(csvRecord, "totalSeasons"));
            dto.setTotalEpisodes(intCell(csvRecord, "totalEpisodes"));
            dto.setCurrentSeason(intCell(csvRecord, "currentSeason"));
            dto.setCurrentEpisode(intCell(csvRecord, "currentEpisode"));
            dto.setStatus(cell(csvRecord, "status"));
            dto.setImdbRating(decimalCell(csvRecord, "imdbRating"));
            dto.setRottenTomatoesRating(intCell(csvRecord, "rottenTomatoesRating"));
            dto.setRottenTomatoesPopcornmeter(intCell(csvRecord, "rottenTomatoesPopcornmeter"));
            dto.setTmdbRating(decimalCell(csvRecord, "tmdbRating"));
            dto.setTmdbVoteCount(intCell(csvRecord, "tmdbVoteCount"));
            dto.setPersonalRating(intCell(csvRecord, "personalRating"));
            dto.setPersonalNotes(cell(csvRecord, "personalNotes"));
            dto.setPosterUrl(cell(csvRecord, "posterUrl"));
            dto.setTags(cell(csvRecord, "tags"));
            dto.setOriginCountry(cell(csvRecord, "originCountry"));
            dto.setOriginalLanguage(cell(csvRecord, "originalLanguage"));
            dto.setDateAdded(dateCell(csvRecord, "dateAdded"));
            dto.setDateCompleted(dateCell(csvRecord, "dateCompleted"));
            return dto;
            // id is read but discarded -- SeriesService.create always generates a fresh id
            // regardless of any incoming value, matching JSON import's existing behavior.
        } catch (RuntimeException _) {
            return new SeriesDto();
        }
    }

    private String cell(CSVRecord csvRecord, String column) {
        String value = csvRecord.get(column);
        return (value == null || value.isEmpty()) ? null : value;
    }

    private Integer intCell(CSVRecord csvRecord, String column) {
        String value = cell(csvRecord, column);
        return value == null ? null : Integer.valueOf(value);
    }

    private BigDecimal decimalCell(CSVRecord csvRecord, String column) {
        String value = cell(csvRecord, column);
        return value == null ? null : new BigDecimal(value);
    }

    private LocalDateTime dateCell(CSVRecord csvRecord, String column) {
        String value = cell(csvRecord, column);
        return value == null ? null : LocalDateTime.parse(value, ISO);
    }
}
