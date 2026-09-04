package uk.co.stefirby.seriestracker.controller

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification
import spock.util.concurrent.PollingConditions
import uk.co.stefirby.seriestracker.dto.SeriesDto
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import uk.co.stefirby.seriestracker.service.SeriesService

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

/**
 * Controller-level (MockMvc) coverage for series_spec_038_import.md -- mirrors
 * SeriesControllerRefreshSpec's shape for the sibling async-job endpoints.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesControllerImportSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @Autowired
    SeriesRepository seriesRepository

    @Autowired
    SeriesService seriesService

    PollingConditions conditions = new PollingConditions(timeout: 5)

    def cleanup() {
        // Let any in-flight import job from this test drain before the next test's data is
        // torn down/recreated, since BulkImportService is a shared singleton across this class.
        conditions.eventually {
            def json = mockMvc.perform(get("/api/v1/series/import/status"))
                .andReturn().response.contentAsString
            assert !json.contains('"status":"IN_PROGRESS"')
        }
        seriesRepository.deleteAll()
    }

    def "SERIES-038-AC-01: a valid export file starts an import job"() {
        given: "a valid export-shaped JSON file"
            def file = new MockMultipartFile("file", "export.json", "application/json",
                '{"exportDate":"2026-08-29T10:00:00","series":[{"title":"Show","imdbId":"tt1234567"}],"count":1}'.bytes)

        when: "POST /api/v1/series/import is called"
            def result = mockMvc.perform(multipart("/api/v1/series/import").file(file))

        then: "202 Accepted with an IN_PROGRESS status"
            result.andExpect(status().isAccepted())
            result.andExpect(jsonPath('$.data.status').value("IN_PROGRESS"))
            result.andExpect(jsonPath('$.data.totalCount').value(1))
    }

    def "SERIES-038-AC-02: a malformed (non-JSON) file is rejected with 400 before any job starts"() {
        given: "not valid JSON"
            def file = new MockMultipartFile("file", "bad.json", "application/json", "not json".bytes)

        when: "POST /api/v1/series/import is called"
            def result = mockMvc.perform(multipart("/api/v1/series/import").file(file))

        then: "400, no job started"
            result.andExpect(status().isBadRequest())
    }

    def "SERIES-038-AC-02: valid JSON missing the series array is rejected with 400"() {
        given: "valid JSON, but no 'series' array"
            def file = new MockMultipartFile("file", "bad.json", "application/json",
                '{"exportDate":"2026-08-29T10:00:00","count":0}'.bytes)

        when: "POST /api/v1/series/import is called"
            def result = mockMvc.perform(multipart("/api/v1/series/import").file(file))

        then: "400, no job started"
            result.andExpect(status().isBadRequest())
    }

    def "SERIES-038-AC-03/04: importing a file with a duplicate and a new series completes with the expected counts"() {
        given: "one series already tracked by imdbId, and an import file with that duplicate plus a new one"
            seriesService.create(new SeriesDto(title: "Already Tracked", imdbId: "tt9999999"))
            def file = new MockMultipartFile("file", "export.json", "application/json", ("""
                {"series":[
                    {"title":"New Show","imdbId":"tt1111111"},
                    {"title":"Already Tracked","imdbId":"tt9999999"}
                ]}
            """).bytes)

        when: "the file is imported"
            def started = mockMvc.perform(multipart("/api/v1/series/import").file(file))
            started.andExpect(status().isAccepted())

        then: "the status endpoint eventually reports COMPLETED with one imported, one skipped"
            conditions.eventually {
                def result = mockMvc.perform(get("/api/v1/series/import/status"))
                result.andExpect(status().isOk())
                result.andExpect(jsonPath('$.data.status').value("COMPLETED"))
                result.andExpect(jsonPath('$.data.totalCount').value(2))
                result.andExpect(jsonPath('$.data.importedCount').value(1))
                result.andExpect(jsonPath('$.data.skippedCount').value(1))
                result.andExpect(jsonPath('$.data.errorCount').value(0))
            }
    }

    def "a second POST /import while one is in progress returns 409"() {
        given: "enough rows that app.tmdb.refresh-delay-ms keeps the first job IN_PROGRESS briefly"
            def rows = (1..3).collect { "{\"title\":\"Show ${it}\",\"imdbId\":\"tt000000${it}\"}" }.join(",")
            def file = new MockMultipartFile("file", "export.json", "application/json",
                "{\"series\":[${rows}]}".bytes)
            mockMvc.perform(multipart("/api/v1/series/import").file(file)).andExpect(status().isAccepted())

        when: "a second import is requested immediately"
            def secondFile = new MockMultipartFile("file", "export.json", "application/json",
                '{"series":[{"title":"Another Show"}]}'.bytes)
            def result = mockMvc.perform(multipart("/api/v1/series/import").file(secondFile))

        then: "409, no second job starts"
            result.andExpect(status().isConflict())
    }
}
