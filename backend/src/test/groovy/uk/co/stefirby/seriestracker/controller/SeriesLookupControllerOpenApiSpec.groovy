package uk.co.stefirby.seriestracker.controller

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

/** series_spec_067_openapi_annotation_pass.md: SERIES-067-AC-05 (`SeriesLookupController`). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesLookupControllerOpenApiSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  def "SERIES-067-AC-05: GET .../lookup/search-tmdb documents TMDB as the sole search source"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the search-tmdb operation's description mentions TMDB"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/lookup/search-tmdb.get.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("TMDB")))
  }

  def "SERIES-067-AC-05: GET .../lookup/resolve-tmdb documents the OMDb merge"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the resolve-tmdb operation's description mentions OMDb"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/lookup/resolve-tmdb.get.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("OMDb")))
  }
}
