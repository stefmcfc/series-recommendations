package uk.co.stefirby.seriestracker.controller

import uk.co.stefirby.seriestracker.dto.SeriesLookupCandidateDto
import uk.co.stefirby.seriestracker.dto.SeriesLookupDto
import uk.co.stefirby.seriestracker.dto.TmdbLookupCandidateDto
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import uk.co.stefirby.seriestracker.service.SeriesLookupService
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

  def "SERIES-005-AC-13/AC-14: GET /api/v1/series/lookup returns 200 with the ApiResponse envelope"() {
    given: "the lookup service resolves a full result for the requested title"
        def dto = new SeriesLookupDto(
          title: "Breaking Bad",
          year: 2008,
          genres: "Crime, Drama, Thriller",
          totalSeasons: 5,
          totalEpisodes: 62,
          imdbRating: 9.5,
          metacriticRating: 87,
          rottenTomatoesRating: 96,
          posterUrl: "https://example.com/poster.jpg"
        )
        when(seriesLookupService.lookup("Breaking Bad")).thenReturn(dto)

    when: "the lookup endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup").param("title", "Breaking Bad"))

    then: "the mapped fields are returned under the data envelope"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data.title').value("Breaking Bad"))
        result.andExpect(jsonPath('$.data.year').value(2008))
        result.andExpect(jsonPath('$.data.totalEpisodes').value(62))
        result.andExpect(jsonPath('$.data.posterUrl').value("https://example.com/poster.jpg"))
  }

  def "SERIES-005-AC-18: a blank title query param returns 400 without calling the lookup service"() {
    when: "the lookup endpoint is invoked with a blank title"
        def result = mockMvc.perform(get("/api/v1/series/lookup").param("title", "  "))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())

    and: "the lookup service is never invoked"
        verifyNoInteractions(seriesLookupService)
  }

  def "SERIES-005-AC-18: a missing title query param returns 400"() {
    when: "the lookup endpoint is invoked with no title param at all"
        def result = mockMvc.perform(get("/api/v1/series/lookup"))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
  }

  def "SERIES-011-AC-12/14: GET /api/v1/series/lookup/search returns 200 with a list of candidates"() {
    given: "the lookup service resolves two candidates for the requested title"
        def candidates = [
            new SeriesLookupCandidateDto(title: "Spooks", year: 2002, imdbId: "tt0290403", posterUrl: "https://example.com/spooks.jpg"),
        ]
        when(seriesLookupService.search("Spooks")).thenReturn(candidates)

    when: "the search endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search").param("title", "Spooks"))

    then: "the candidates are returned under the data envelope"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data[0].title').value("Spooks"))
        result.andExpect(jsonPath('$.data[0].imdbId').value("tt0290403"))
  }

  def "SERIES-011-AC-14: zero matches still returns 200 with an empty array"() {
    given: "the lookup service resolves no candidates"
        when(seriesLookupService.search("Nonexistent")).thenReturn([])

    when: "the search endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search").param("title", "Nonexistent"))

    then: "the response is 200 with an empty data array, not a 404"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data').isArray())
        result.andExpect(jsonPath('$.data.length()').value(0))
  }

  def "SERIES-011-AC-13: a blank title on the search endpoint returns 400 without calling the service"() {
    when: "the search endpoint is invoked with a blank title"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search").param("title", "  "))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())

    and: "the lookup service is never invoked"
        verifyNoInteractions(seriesLookupService)
  }

  def "SERIES-011-AC-13: a missing title on the search endpoint returns 400"() {
    when: "the search endpoint is invoked with no title param at all"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search"))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
  }

  def "SERIES-011-AC-16: supplying neither title nor imdbId returns 400"() {
    when: "the lookup endpoint is invoked with neither param"
        def result = mockMvc.perform(get("/api/v1/series/lookup"))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
  }

  def "SERIES-011-AC-16: supplying both title and imdbId returns 400"() {
    when: "the lookup endpoint is invoked with both params"
        def result = mockMvc.perform(
            get("/api/v1/series/lookup").param("title", "Spooks").param("imdbId", "tt0290403"))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
  }

  def "SERIES-011-AC-16: a blank imdbId with no title still returns 400 (blank counts as not supplied)"() {
    when: "the lookup endpoint is invoked with a blank imdbId and no title"
        def result = mockMvc.perform(get("/api/v1/series/lookup").param("imdbId", "   "))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
  }

  def "SERIES-011-AC-17: an imdbId-only request delegates to lookupByImdbId and returns 200"() {
    given: "the lookup service resolves a full result for the requested imdbId"
        def dto = new SeriesLookupDto(title: "Spooks", imdbId: "tt0290403")
        when(seriesLookupService.lookupByImdbId("tt0290403")).thenReturn(dto)

    when: "the lookup endpoint is invoked with only imdbId"
        def result = mockMvc.perform(get("/api/v1/series/lookup").param("imdbId", "tt0290403"))

    then: "the mapped fields are returned under the data envelope"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data.title').value("Spooks"))
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

  def "SERIES-012-AC-22: zero matches still returns 200 with an empty array"() {
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

  def "SERIES-012-AC-23/25: GET /api/v1/series/lookup/resolve-tmdb delegates and returns 200, including a degraded result"() {
    given: "the lookup service resolves a degraded (TMDB-only) result for the requested tmdbId"
        def dto = new SeriesLookupDto(title: "Spooks", imdbId: "tt0160904", genres: "Action & Adventure, Drama")
        when(seriesLookupService.resolveTmdbCandidate(4046)).thenReturn(dto)

    when: "the resolve-tmdb endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/resolve-tmdb").param("tmdbId", "4046"))

    then: "the mapped fields are returned under the data envelope, with a normal 200 despite absent ratings"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data.title').value("Spooks"))
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
