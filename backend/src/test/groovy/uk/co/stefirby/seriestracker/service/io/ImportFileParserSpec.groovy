package uk.co.stefirby.seriestracker.service.io

import org.springframework.mock.web.MockMultipartFile
import spock.lang.Specification
import tools.jackson.databind.ObjectMapper
import uk.co.stefirby.seriestracker.dto.SeriesDto

/**
 * Unit-level coverage for series_spec_038_import.md (SERIES-038-AC-01/02), extracted out of
 * SeriesController (chore/sonar-cleanup) -- mirrors SeriesControllerImportSpec's HTTP-level ACs
 * at the unit level; that spec stays as-is covering the full HTTP contract.
 */
class ImportFileParserSpec extends Specification {

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
}
