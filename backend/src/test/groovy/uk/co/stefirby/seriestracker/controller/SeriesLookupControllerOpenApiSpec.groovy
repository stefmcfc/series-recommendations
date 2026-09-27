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

  def "SERIES-070-AC-05: GET .../lookup/search-tmdb documents a 200 response example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the search-tmdb operation's 200 response carries an example"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/lookup/search-tmdb.get.responses.200.content.application/json.examples').exists())
  }

  def "SERIES-070-AC-05: GET .../lookup/resolve-tmdb documents a 200 example and references BadGateway, not NotFound"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the 200 example and the 502 reference are present; no 404 is documented"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/lookup/resolve-tmdb.get.responses.200.content.application/json.examples').exists())
        result.andExpect(jsonPath('$.paths./api/v1/series/lookup/resolve-tmdb.get.responses.502').exists())
        result.andExpect(jsonPath('$.paths./api/v1/series/lookup/resolve-tmdb.get.responses.404').doesNotExist())
  }

  def "SERIES-070-AC-05: GET .../lookup/search-tmdb documents a title parameter example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the title parameter carries an example value"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/lookup/search-tmdb.get.parameters[?(@.name=='title')].example").value("The Office"))
  }

  def "SERIES-070-AC-05: GET .../lookup/resolve-tmdb documents a real tmdbId parameter example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the tmdbId parameter carries The Office's real, live-verified TMDB id"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/lookup/resolve-tmdb.get.parameters[?(@.name=='tmdbId')].example").value(2316))
  }
}
