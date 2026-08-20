package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.dto.SeriesExportResponse;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class SeriesExportService {

    private static final Logger log = LoggerFactory.getLogger(SeriesExportService.class);

    // SERIES-013-AC-04 / SERIES-014-AC-12: alternateTitle and tags appended alongside the
    // other newer optional fields, before the date columns.
    private static final String[] CSV_HEADERS = {
        "id", "title", "alternateTitle", "year", "genres", "totalSeasons", "totalEpisodes",
        "currentSeason", "currentEpisode", "status", "imdbRating",
        "metacriticRating", "rottenTomatoesRating", "personalRating",
        "personalNotes", "posterUrl", "tags", "dateAdded", "dateCompleted"
    };

    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'");

    private final ObjectMapper objectMapper;

    public SeriesExportService() {
        this.objectMapper = new ObjectMapper();
    }

    public String exportAsJson(List<SeriesDto> series, LocalDateTime exportDate) {
        log.debug("Exporting {} series as JSON", series.size());
        try {
            SeriesExportResponse response = new SeriesExportResponse(exportDate, series, series.size());
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(response);
        } catch (Exception e) {
            throw new RuntimeException("Failed to export as JSON", e);
        }
    }

    public String exportAsCsv(List<SeriesDto> series) {
        log.debug("Exporting {} series as CSV", series.size());
        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", CSV_HEADERS)).append("\n");
        for (SeriesDto s : series) {
            sb.append(csvRow(s)).append("\n");
        }
        return sb.toString();
    }

    private String csvRow(SeriesDto s) {
        return String.join(",",
            csv(s.getId() != null ? s.getId().toString() : null),
            csv(s.getTitle()),
            csv(s.getAlternateTitle()),
            csv(s.getYear() != null ? s.getYear().toString() : null),
            csv(s.getGenres()),
            csv(s.getTotalSeasons() != null ? s.getTotalSeasons().toString() : null),
            csv(s.getTotalEpisodes() != null ? s.getTotalEpisodes().toString() : null),
            csv(s.getCurrentSeason() != null ? s.getCurrentSeason().toString() : null),
            csv(s.getCurrentEpisode() != null ? s.getCurrentEpisode().toString() : null),
            csv(s.getStatus()),
            csv(s.getImdbRating() != null ? s.getImdbRating().toPlainString() : null),
            csv(s.getMetacriticRating() != null ? s.getMetacriticRating().toString() : null),
            csv(s.getRottenTomatoesRating() != null ? s.getRottenTomatoesRating().toString() : null),
            csv(s.getPersonalRating() != null ? s.getPersonalRating().toString() : null),
            csv(s.getPersonalNotes()),
            csv(s.getPosterUrl()),
            csv(s.getTags()),
            csv(s.getDateAdded() != null ? s.getDateAdded().format(ISO) : null),
            csv(s.getDateCompleted() != null ? s.getDateCompleted().format(ISO) : null)
        );
    }

    private String csv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
