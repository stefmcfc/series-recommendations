package uk.co.stefirby.seriestracker.controller

import uk.co.stefirby.seriestracker.dto.SeriesLookupDto
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
}
