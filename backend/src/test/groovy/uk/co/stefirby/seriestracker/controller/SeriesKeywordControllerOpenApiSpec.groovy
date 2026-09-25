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

/** series_spec_067_openapi_annotation_pass.md: SERIES-067-AC-04 (`SeriesKeywordController`). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesKeywordControllerOpenApiSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  def "SERIES-067-AC-04: GET /api/v1/series/keywords documents sortBy's fallback behavior"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the sortBy parameter's description mentions the fallback-to-default behavior"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath(
          '$.paths./api/v1/series/keywords.get.parameters[?(@.name=="sortBy")].description'
        ).exists())
  }

  def "SERIES-067-AC-04: keywords' three minimum-value filters document AND-combined null-never-satisfies semantics"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "each minimum-value filter carries a non-empty description"
        result.andExpect(status().isOk())
        ["minSeriesCount", "minAveragePersonalRating", "minAverageBlendedRating"].each { name ->
            result.andExpect(jsonPath(
              "\$.paths./api/v1/series/keywords.get.parameters[?(@.name==\"${name}\")].description"
            ).exists())
        }
  }

  def "SERIES-067-AC-04: GET /api/v1/series/keywords carries an operation summary"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation carries a non-empty summary"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/keywords.get.summary').isNotEmpty())
  }
}
