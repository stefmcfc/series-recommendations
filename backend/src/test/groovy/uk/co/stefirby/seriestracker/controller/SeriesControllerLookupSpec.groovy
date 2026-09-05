package uk.co.stefirby.seriestracker.controller

import uk.co.stefirby.seriestracker.dto.SeriesLookupDto
import uk.co.stefirby.seriestracker.dto.TmdbLookupCandidateDto
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import uk.co.stefirby.seriestracker.service.tmdb.SeriesLookupService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification

import static org.mockito.Mockito.verifyNoInteractions
import static org.mockito.Mockito.when
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesControllerLookupSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  @MockitoBean
  SeriesLookupService seriesLookupService

  def "SERIES-017-AC-01: GET /api/v1/series/lookup?title= is no longer mapped (404)"() {
    when: "the removed lookup-by-title endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup").param("title", "Ozark"))

    then: "the response is 404, not 400"
        result.andExpect(status().isNotFound())

    and: "the lookup service is never invoked"
        verifyNoInteractions(seriesLookupService)
  }

  def "SERIES-017-AC-01: GET /api/v1/series/lookup/search?title= is no longer mapped (404)"() {
    when: "the removed OMDb-search endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search").param("title", "Ozark"))

    then: "the response is 404"
        result.andExpect(status().isNotFound())

    and: "the lookup service is never invoked"
        verifyNoInteractions(seriesLookupService)
  }

  def "SERIES-017-AC-05: GET /api/v1/series/lookup?imdbId= is no longer mapped (404)"() {
    when: "the removed lookup-by-imdbId endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup").param("imdbId", "tt5071412"))

    then: "the response is 404"
        result.andExpect(status().isNotFound())

    and: "the lookup service is never invoked"
        verifyNoInteractions(seriesLookupService)
  }

  def "SERIES-012-AC-20/22: GET /api/v1/series/lookup/search-tmdb returns 200 with a list of candidates"() {
    given: "the lookup service resolves one TMDB candidate for the requested title"
        def candidates = [
            new TmdbLookupCandidateDto(tmdbId: 4046, title: "Spooks", year: 2002, posterUrl: "https://image.tmdb.org/t/p/w500/spooks.jpg"),
        ]
        when(seriesLookupService.searchTmdb("Spooks")).thenReturn(candidates)

    when: "the search-tmdb endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search-tmdb").param("title", "Spooks"))

    then: "the candidates are returned under the data envelope"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data[0].tmdbId').value(4046))
        result.andExpect(jsonPath('$.data[0].title').value("Spooks"))
  }

  def "SERIES-012-AC-22/SERIES-017-AC-03: zero matches still returns 200 with an empty array"() {
    given: "the lookup service resolves no TMDB candidates"
        when(seriesLookupService.searchTmdb("Nonexistent")).thenReturn([])

    when: "the search-tmdb endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search-tmdb").param("title", "Nonexistent"))

    then: "the response is 200 with an empty data array, not a 404"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data').isArray())
        result.andExpect(jsonPath('$.data.length()').value(0))
  }

  def "SERIES-012-AC-21: a blank title on the search-tmdb endpoint returns 400 without calling the service"() {
    when: "the search-tmdb endpoint is invoked with a blank title"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search-tmdb").param("title", "  "))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())

    and: "the lookup service is never invoked"
        verifyNoInteractions(seriesLookupService)
  }

  def "SERIES-012-AC-21: a missing title on the search-tmdb endpoint returns 400"() {
    when: "the search-tmdb endpoint is invoked with no title param at all"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search-tmdb"))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
  }

  def "SERIES-017-AC-04: GET /api/v1/series/lookup/resolve-tmdb delegates and returns 200, including tmdbRating/tmdbVoteCount"() {
    given: "the lookup service resolves a TMDB-primary result for the requested tmdbId"
        def dto = new SeriesLookupDto(
            title: "Spooks", imdbId: "tt0160904", genres: "Action & Adventure, Drama",
            tmdbRating: new BigDecimal("7.8"), tmdbVoteCount: 245)
        when(seriesLookupService.resolveTmdbCandidate(4046)).thenReturn(dto)

    when: "the resolve-tmdb endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/resolve-tmdb").param("tmdbId", "4046"))

    then: "the mapped fields are returned under the data envelope"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data.title').value("Spooks"))
        result.andExpect(jsonPath('$.data.tmdbRating').value(7.8))
        result.andExpect(jsonPath('$.data.tmdbVoteCount').value(245))
        result.andExpect(jsonPath('$.data.imdbRating').doesNotExist())
  }

  def "SERIES-012-AC-24: a missing tmdbId on the resolve-tmdb endpoint returns 400"() {
    when: "the resolve-tmdb endpoint is invoked with no tmdbId param at all"
        def result = mockMvc.perform(get("/api/v1/series/lookup/resolve-tmdb"))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
  }

  def "SERIES-012-AC-24: a non-numeric tmdbId on the resolve-tmdb endpoint returns 400"() {
    when: "the resolve-tmdb endpoint is invoked with a non-numeric tmdbId"
        def result = mockMvc.perform(get("/api/v1/series/lookup/resolve-tmdb").param("tmdbId", "not-a-number"))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
  }

  def "SERIES-012-AC-26: an upstream failure resolving a TMDB candidate returns 502"() {
    given: "the lookup service reports a genuine upstream failure"
        when(seriesLookupService.resolveTmdbCandidate(4046)).thenThrow(new ExternalServiceException("TMDB request failed"))

    when: "the resolve-tmdb endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/resolve-tmdb").param("tmdbId", "4046"))

    then: "the response is a 502 Bad Gateway"
        result.andExpect(status().isBadGateway())
  }
}
