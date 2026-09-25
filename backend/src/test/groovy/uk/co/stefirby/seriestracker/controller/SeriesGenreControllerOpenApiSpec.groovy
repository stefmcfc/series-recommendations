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

/** series_spec_067_openapi_annotation_pass.md: SERIES-067-AC-02 (`SeriesGenreController`). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesGenreControllerOpenApiSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  def "SERIES-067-AC-02: GET /api/v1/series/genres documents the alias vocabulary"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation carries a non-empty summary"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/genres.get.summary').isNotEmpty())
  }

  def "SERIES-067-AC-02: GET /api/v1/series/genres/stats documents averageBlendedRating"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the minAverageBlendedRating parameter carries a non-empty description"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath(
          '$.paths./api/v1/series/genres/stats.get.parameters[?(@.name=="minAverageBlendedRating")].description'
        ).exists())
  }

  def "SERIES-067-AC-02: genreStats' sortBy/minSeriesCount/onlyCompleted parameters each carry a description"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "each parameter carries a non-empty description"
        result.andExpect(status().isOk())
        ["sortBy", "minSeriesCount", "minAveragePersonalRating", "onlyCompleted"].each { name ->
            result.andExpect(jsonPath(
              "\$.paths./api/v1/series/genres/stats.get.parameters[?(@.name==\"${name}\")].description"
            ).exists())
        }
  }
}
