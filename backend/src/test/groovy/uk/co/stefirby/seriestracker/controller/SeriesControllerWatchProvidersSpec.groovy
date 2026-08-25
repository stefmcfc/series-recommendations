package uk.co.stefirby.seriestracker.controller

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification
import uk.co.stefirby.seriestracker.client.TmdbClient
import uk.co.stefirby.seriestracker.client.TmdbWatchProvider
import uk.co.stefirby.seriestracker.dto.SeriesDto
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import uk.co.stefirby.seriestracker.service.SeriesService

import static org.mockito.Mockito.when
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

/**
 * Controller-level (MockMvc) coverage for series_spec_026_series_watch_providers.md's new
 * {@code GET /api/v1/series/{id}/watch-providers} endpoint -- an on-demand, never-persisted
 * streaming-availability check for a tracked series, reusing {@code
 * RecommendationService.streamingProviders(int)} (Series Spec 020) once a {@code tmdbId} is
 * resolved via {@code TmdbClient.findTvIdByImdbId} (Series Spec 018 precedent).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesControllerWatchProvidersSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @Autowired
    SeriesRepository seriesRepository

    @Autowired
    SeriesService seriesService

    @MockitoBean
    TmdbClient tmdbClient

    def cleanup() {
        seriesRepository.deleteAll()
    }

    def "SERIES-026-AC-01: GET /api/v1/series/{id}/watch-providers returns 200 with a StreamingProvider list"() {
        given: "an existing series with a resolvable imdbId"
            def created = seriesService.create(new SeriesDto(title: "Ozark", imdbId: "tt5071412"))
            when(tmdbClient.findTvIdByImdbId("tt5071412")).thenReturn(Optional.of(69740))
            when(tmdbClient.watchProviders(69740, "GB")).thenReturn([new TmdbWatchProvider("Netflix", "/abc.jpg")])

        when: "the endpoint is requested"
            def result = mockMvc.perform(get("/api/v1/series/${created.id}/watch-providers"))

        then: "the response is 200 with the mapped provider"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data[0].name').value("Netflix"))
            result.andExpect(jsonPath('$.count').value(1))
    }

    def "SERIES-026-AC-02: an unknown series id returns 404"() {
        when: "the endpoint is requested with a random UUID"
            def result = mockMvc.perform(get("/api/v1/series/${UUID.randomUUID()}/watch-providers"))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "SERIES-026-AC-03: a series with no imdbId yields an empty list, not an error"() {
        given: "a series with no imdbId"
            def created = seriesService.create(new SeriesDto(title: "No IMDb Link"))

        when: "the endpoint is requested"
            def result = mockMvc.perform(get("/api/v1/series/${created.id}/watch-providers"))

        then: "the response is 200 with an empty list"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(0))
    }

    def "SERIES-026-AC-04: an unresolvable imdbId yields an empty list, not an error"() {
        given: "a series whose imdbId TMDB can't resolve"
            def created = seriesService.create(new SeriesDto(title: "Obscure Show", imdbId: "tt9999999"))
            when(tmdbClient.findTvIdByImdbId("tt9999999")).thenReturn(Optional.empty())

        when: "the endpoint is requested"
            def result = mockMvc.perform(get("/api/v1/series/${created.id}/watch-providers"))

        then: "the response is 200 with an empty list"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(0))
    }

    def "SERIES-026-AC-05: a watchProviders failure yields an empty list, not an error, reusing the existing helper"() {
        given: "a series with a resolvable tmdbId, but TMDB's watch-providers call fails"
            def created = seriesService.create(new SeriesDto(title: "Ozark", imdbId: "tt5071412"))
            when(tmdbClient.findTvIdByImdbId("tt5071412")).thenReturn(Optional.of(69740))
            when(tmdbClient.watchProviders(69740, "GB")).thenThrow(new ExternalServiceException("TMDB down"))

        when: "the endpoint is requested"
            def result = mockMvc.perform(get("/api/v1/series/${created.id}/watch-providers"))

        then: "the response is still 200, with an empty list"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(0))
    }
}
