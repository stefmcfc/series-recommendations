package uk.co.stefirby.seriestracker.service.io

import org.springframework.mock.web.MockMultipartFile
import spock.lang.Specification
import tools.jackson.databind.ObjectMapper
import uk.co.stefirby.seriestracker.dto.SeriesDto

import java.time.LocalDateTime

/**
 * Unit-level coverage for series_spec_038_import.md (SERIES-038-AC-01/02) and
 * series_spec_058_csv_import.md (SERIES-058-AC-01..05), extracted out of SeriesController
 * (chore/sonar-cleanup) -- mirrors SeriesControllerImportSpec's HTTP-level ACs at the unit level;
 * that spec stays as-is covering the full HTTP contract.
 */
class ImportFileParserSpec extends Specification {

    private static final String CSV_HEADER_ROW =
        "id,title,year,genres,totalSeasons,totalEpisodes,currentSeason,currentEpisode,status," +
        "imdbRating,rottenTomatoesRating,rottenTomatoesPopcornmeter,tmdbRating,tmdbVoteCount," +
        "personalRating,personalNotes,posterUrl,tags,originCountry,originalLanguage,dateAdded," +
        "dateCompleted"

    ImportFileParser parser = new ImportFileParser(new ObjectMapper())

    def "SERIES-038-AC-01: a valid export-shaped file parses to the expected list of SeriesDto"() {
        given: "a valid export-shaped JSON file"
            def file = new MockMultipartFile("file", "export.json", "application/json",
                '{"exportDate":"2026-08-29T10:00:00","series":[{"title":"Show","imdbId":"tt1234567"}],"count":1}'.bytes)

        when: "the file is parsed"
            List<SeriesDto> result = parser.parse(file)

        then: "the series array is mapped to SeriesDto entries, ignoring exportDate/count"
            result.size() == 1
            result[0].title == "Show"
            result[0].imdbId == "tt1234567"
    }

    def "SERIES-038-AC-02: a malformed (non-JSON) file throws IllegalArgumentException"() {
        given: "not valid JSON"
            def file = new MockMultipartFile("file", "bad.json", "application/json", "not json".bytes)

        when: "the file is parsed"
            parser.parse(file)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-038-AC-02: valid JSON missing the series array throws IllegalArgumentException"() {
        given: "valid JSON, but no 'series' array"
            def file = new MockMultipartFile("file", "bad.json", "application/json",
                '{"exportDate":"2026-08-29T10:00:00","count":0}'.bytes)

        when: "the file is parsed"
            parser.parse(file)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-058-AC-01: a valid CSV export file is parsed into SeriesDto entries"() {
        given: "a valid CSV file matching SeriesExportService's own column order"
            def csv = CSV_HEADER_ROW + "\n" +
                ",Show A,2020,Drama,3,24,,,WATCHING,8.5,,,,,,,,,,,,\n"
            def file = new MockMultipartFile("file", "export.csv", "text/csv", csv.bytes)

        when: "parse is called"
            def entries = parser.parse(file)

        then: "one SeriesDto is returned with the expected fields"
            entries.size() == 1
            entries[0].title == "Show A"
            entries[0].year == 2020
    }

    def "SERIES-058-AC-01: a valid .CSV file (uppercase extension) is also parsed via Commons CSV"() {
        given: "a valid CSV file with an uppercase extension"
            def csv = CSV_HEADER_ROW + "\n" +
                ",Show A,2020,Drama,,,,,,,,,,,,,,,,,,\n"
            def file = new MockMultipartFile("file", "EXPORT.CSV", "text/csv", csv.bytes)

        when: "parse is called"
            def entries = parser.parse(file)

        then: "the CSV branch handled it"
            entries.size() == 1
            entries[0].title == "Show A"
    }

    def "SERIES-058-AC-02: a CSV with a missing column throws IllegalArgumentException"() {
        given: "a CSV missing the 'status' column"
            def csv = "id,title,year,genres\nabc,Show A,2020,Drama\n"
            def file = new MockMultipartFile("file", "bad.csv", "text/csv", csv.bytes)

        when: "parse is called"
            parser.parse(file)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-058-AC-02: a CSV with reordered columns throws IllegalArgumentException"() {
        given: "the same 22 columns as CSV_HEADERS, but reordered"
            def csv = "title,id,year,genres,totalSeasons,totalEpisodes,currentSeason,currentEpisode,status,imdbRating,rottenTomatoesRating,rottenTomatoesPopcornmeter,tmdbRating,tmdbVoteCount,personalRating,personalNotes,posterUrl,tags,originCountry,originalLanguage,dateAdded,dateCompleted\n" +
                "Show A,,2020,Drama,,,,,,,,,,,,,,,,,,\n"
            def file = new MockMultipartFile("file", "bad.csv", "text/csv", csv.bytes)

        when: "parse is called"
            parser.parse(file)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-058-AC-03: an unrecognized file extension throws IllegalArgumentException"() {
        given: "a .txt file"
            def file = new MockMultipartFile("file", "export.txt", "text/plain", "irrelevant".bytes)

        when: "parse is called"
            parser.parse(file)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-058-AC-03: a file with no extension throws IllegalArgumentException"() {
        given: "a file with no extension at all"
            def file = new MockMultipartFile("file", "export", "text/plain", "irrelevant".bytes)

        when: "parse is called"
            parser.parse(file)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-058-AC-04: numeric, decimal, date, and empty cells map correctly, id is discarded"() {
        given: "a CSV row exercising every column type, including empty cells"
            def csv = CSV_HEADER_ROW + "\n" +
                "ignored-id,Show A,2020,\"Drama,Comedy\",3,24,1,5,WATCHING,8.5,,,7.9,1200,4,,,,,,2024-01-01T00:00:00Z,\n"
            def file = new MockMultipartFile("file", "export.csv", "text/csv", csv.bytes)

        when: "parse is called"
            def dto = parser.parse(file)[0]

        then: "fields are correctly typed, id is ignored, empty cells are null"
            dto.id == null
            dto.title == "Show A"
            dto.genres == "Drama,Comedy"
            dto.year == 2020
            dto.totalSeasons == 3
            dto.totalEpisodes == 24
            dto.currentSeason == 1
            dto.currentEpisode == 5
            dto.status == "WATCHING"
            dto.imdbRating == new BigDecimal("8.5")
            dto.rottenTomatoesRating == null
            dto.rottenTomatoesPopcornmeter == null
            dto.tmdbRating == new BigDecimal("7.9")
            dto.tmdbVoteCount == 1200
            dto.personalRating == 4
            dto.personalNotes == null
            dto.dateAdded == LocalDateTime.parse("2024-01-01T00:00:00")
            dto.dateCompleted == null
    }

    def "SERIES-061-AC-07: CSV import reads the originalLanguage column"() {
        given: "a CSV row with an originalLanguage value"
            def csv = CSV_HEADER_ROW + "\n" +
                ",The Office,,,,,,,,,,,,,,,,,,en,,\n"
            def file = new MockMultipartFile("file", "export.csv", "text/csv", csv.bytes)

        when: "the file is parsed"
            def dtos = parser.parse(file)

        then: "originalLanguage is carried onto the resulting SeriesDto"
            dtos[0].originalLanguage == "en"
    }

    def "SERIES-058-AC-05: a row with an unparseable numeric cell yields a blank (title-null) SeriesDto"() {
        given: "one valid row and one row with a non-numeric year"
            def csv = CSV_HEADER_ROW + "\n" +
                ",Show A,2020,Drama,,,,,,,,,,,,,,,,,,\n" +
                ",Show B,not-a-year,Drama,,,,,,,,,,,,,,,,,,\n"
            def file = new MockMultipartFile("file", "export.csv", "text/csv", csv.bytes)

        when: "parse is called"
            def entries = parser.parse(file)

        then: "the first row parses normally, the second is a blank placeholder DTO"
            entries.size() == 2
            entries[0].title == "Show A"
            entries[1].title == null
    }
}
