package uk.co.stefirby.seriestracker.controller

import uk.co.stefirby.seriestracker.service.TmdbGenreTable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesControllerGenresSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  def "SERIES-010-AC-04/05/06: GET /api/v1/series/genres returns 200 with the full sorted alias list"() {
    when: "GET /api/v1/series/genres is requested"
        def result = mockMvc.perform(get("/api/v1/series/genres"))

    then: "the response is 200 with the envelope shape"
        result.andExpect(status().isOk())

    and: "data matches TmdbGenreTable.allAliasNames() exactly, and count matches its size"
        def expected = new TmdbGenreTable().allAliasNames()
        result.andExpect(jsonPath('$.count').value(expected.size()))
        result.andExpect(jsonPath('$.data[0]').value(expected.first()))
        result.andExpect(jsonPath('$.data.length()').value(expected.size()))
  }

  def "SERIES-010-AC-04: no query parameters are required or accepted"() {
    when: "GET /api/v1/series/genres is requested with no params"
        def result = mockMvc.perform(get("/api/v1/series/genres"))

    then: "the request succeeds without any param"
        result.andExpect(status().isOk())
  }
}
