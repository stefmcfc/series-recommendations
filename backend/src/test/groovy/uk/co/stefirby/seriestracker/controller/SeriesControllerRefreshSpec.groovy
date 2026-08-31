package uk.co.stefirby.seriestracker.controller

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification
import spock.util.concurrent.PollingConditions
import uk.co.stefirby.seriestracker.client.omdb.OmdbClient
import uk.co.stefirby.seriestracker.client.omdb.OmdbRatings
import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient
import uk.co.stefirby.seriestracker.client.tmdb.TmdbSeriesDetail
import uk.co.stefirby.seriestracker.dto.SeriesDto
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import uk.co.stefirby.seriestracker.model.ProductionStatus
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import uk.co.stefirby.seriestracker.service.SeriesService

import static org.mockito.ArgumentMatchers.anyString
import static org.mockito.Mockito.when
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

/**
 * Controller-level (MockMvc) coverage for series_spec_018_series_refresh.md, filling the
 * "no controller-level tests exist yet" gap noted for /search and /export -- this spec covers
 * both the single-refresh and bulk-refresh-job routes end to end through real HTTP dispatch.
 *
 * <p>{@code BulkRefreshService} is a Spring singleton, so "before any job has ever run" (AC-19)
 * is exercised only at the unit level ({@code BulkRefreshServiceSpec}, a fresh instance per
 * test) -- at this level, tests only assert the shape/transitions a POST triggers, not a
 * pristine startup state that a shared bean across test methods in this class can't guarantee.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesControllerRefreshSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @Autowired
    SeriesRepository seriesRepository

    @Autowired
    SeriesService seriesService

    @MockitoBean
    TmdbClient tmdbClient

    @MockitoBean
    OmdbClient omdbClient

    PollingConditions conditions = new PollingConditions(timeout: 5)

    def cleanup() {
        // Let any in-flight bulk job from this test drain before the next test's data is torn
        // down/recreated, since BulkRefreshService is a shared singleton across this class.
        conditions.eventually {
            def json = mockMvc.perform(get("/api/v1/series/refresh-all/status"))
                .andReturn().response.contentAsString
            assert !json.contains('"status":"IN_PROGRESS"')
        }
        seriesRepository.deleteAll()
    }

    def "SERIES-018-AC-01: POST /api/v1/series/{id}/refresh returns 404 for an unknown id"() {
        when: "an unknown id is refreshed"
            def result = mockMvc.perform(post("/api/v1/series/${UUID.randomUUID()}/refresh"))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "SERIES-018-AC-02/03/07/09: a successful refresh returns 200 with updated fields and outcome flags"() {
        given: "an existing series with an imdbId, TMDB and OMDb both resolve fresh data"
            def created = seriesService.create(new SeriesDto(title: "Breaking Bad", imdbId: "tt0903747", totalSeasons: 5))
            when(tmdbClient.findTvIdByImdbId("tt0903747")).thenReturn(Optional.of(1396))
            when(tmdbClient.details(1396)).thenReturn(new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, "US", null, null))
            when(omdbClient.ratingsForImdbId("tt0903747")).thenReturn(new OmdbRatings(new BigDecimal("9.5"), 97))

        when: "POST /refresh is requested"
            def result = mockMvc.perform(post("/api/v1/series/${created.id}/refresh"))

        then: "the response reflects the refreshed fields and outcome"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data.series.totalSeasons').value(6))
            result.andExpect(jsonPath('$.data.series.totalEpisodes').value(63))
            result.andExpect(jsonPath('$.data.series.tmdbVoteCount').value(1200))
            result.andExpect(jsonPath('$.data.series.productionStatus').value("ENDED"))
            result.andExpect(jsonPath('$.data.series.originCountry').value("US"))
            result.andExpect(jsonPath('$.data.series.imdbRating').value(9.5))
            result.andExpect(jsonPath('$.data.tmdbRefreshed').value(true))
            result.andExpect(jsonPath('$.data.omdbRefreshed').value(true))
            result.andExpect(jsonPath('$.data.series.lastRefreshedAt').exists())
    }

    def "SERIES-018-AC-05/06: both sources failing still returns 200 with false outcome flags"() {
        given: "an existing series, both TMDB and OMDb calls fail"
            def created = seriesService.create(new SeriesDto(title: "Some Show", imdbId: "tt1234567"))
            when(tmdbClient.findTvIdByImdbId("tt1234567")).thenThrow(new ExternalServiceException("TMDB down"))
            when(omdbClient.ratingsForImdbId("tt1234567")).thenThrow(new ExternalServiceException("OMDb down"))

        when: "POST /refresh is requested"
            def result = mockMvc.perform(post("/api/v1/series/${created.id}/refresh"))

        then: "the response is still 200, with both outcome flags false"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data.tmdbRefreshed').value(false))
            result.andExpect(jsonPath('$.data.omdbRefreshed').value(false))
    }

    def "SERIES-018-AC-13: POST /refresh-all returns 202 with an IN_PROGRESS status"() {
        given: "one series exists"
            seriesService.create(new SeriesDto(title: "Show"))

        when: "POST /refresh-all is requested"
            def result = mockMvc.perform(post("/api/v1/series/refresh-all"))

        then: "the response is 202 with an IN_PROGRESS status reflecting the initial state"
            result.andExpect(status().isAccepted())
            result.andExpect(jsonPath('$.data.status').value("IN_PROGRESS"))
            result.andExpect(jsonPath('$.data.totalCount').value(1))
    }

    def "SERIES-018-AC-18/21: GET /refresh-all/status reports COMPLETED with counts/timestamps once the job finishes"() {
        given: "two series exist"
            (1..2).each { seriesService.create(new SeriesDto(title: "Show ${it}")) }

        when: "the bulk job is started"
            mockMvc.perform(post("/api/v1/series/refresh-all")).andExpect(status().isAccepted())

        then: "the status endpoint eventually reports COMPLETED with populated counts/timestamps"
            conditions.eventually {
                def result = mockMvc.perform(get("/api/v1/series/refresh-all/status"))
                result.andExpect(status().isOk())
                result.andExpect(jsonPath('$.data.status').value("COMPLETED"))
                result.andExpect(jsonPath('$.data.totalCount').value(2))
                result.andExpect(jsonPath('$.data.completedCount').value(2))
                result.andExpect(jsonPath('$.data.startedAt').exists())
                result.andExpect(jsonPath('$.data.finishedAt').exists())
            }

        and: "the completed status is still visible on a later read"
            def again = mockMvc.perform(get("/api/v1/series/refresh-all/status"))
            again.andExpect(jsonPath('$.data.status').value("COMPLETED"))
    }

    def "SERIES-018-AC-14: a second POST /refresh-all while one is in progress returns 409"() {
        given: "enough series that app.tmdb.refresh-delay-ms keeps the first job IN_PROGRESS briefly"
            (1..3).each { seriesService.create(new SeriesDto(title: "Show ${it}")) }
            mockMvc.perform(post("/api/v1/series/refresh-all")).andExpect(status().isAccepted())

        when: "a second POST /refresh-all is requested immediately"
            def result = mockMvc.perform(post("/api/v1/series/refresh-all"))

        then: "the response is 409, and no second job starts"
            result.andExpect(status().isConflict())
    }

    def "SERIES-018-AC-24/27: a refresh detecting new content is acknowledged via POST /acknowledge-new-content"() {
        given: "an existing series, TMDB now reports more seasons than before"
            def created = seriesService.create(new SeriesDto(title: "Breaking Bad", imdbId: "tt0903747", totalSeasons: 5))
            when(tmdbClient.findTvIdByImdbId("tt0903747")).thenReturn(Optional.of(1396))
            when(tmdbClient.details(1396)).thenReturn(new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, "US", null, null))
            when(omdbClient.ratingsForImdbId("tt0903747")).thenReturn(new OmdbRatings(new BigDecimal("9.5"), 97))
            mockMvc.perform(post("/api/v1/series/${created.id}/refresh")).andExpect(status().isOk())
                .andExpect(jsonPath('$.data.series.newContentDetectedAt').exists())

        when: "POST /acknowledge-new-content is requested"
            def result = mockMvc.perform(post("/api/v1/series/${created.id}/acknowledge-new-content"))

        then: "the response is 200 with the flag cleared"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data.newContentDetectedAt').doesNotExist())
    }

    def "SERIES-018-AC-27: acknowledging an unknown id returns 404"() {
        when: "an unknown id is acknowledged"
            def result = mockMvc.perform(post("/api/v1/series/${UUID.randomUUID()}/acknowledge-new-content"))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }
}
