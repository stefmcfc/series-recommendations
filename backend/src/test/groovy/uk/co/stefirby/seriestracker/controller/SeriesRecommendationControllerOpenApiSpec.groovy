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

/** series_spec_067_openapi_annotation_pass.md: SERIES-067-AC-07 (`SeriesRecommendationController`). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesRecommendationControllerOpenApiSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  def "SERIES-067-AC-07: GET /api/v1/series/recommendations documents sourceMode"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the sourceMode parameter carries a non-empty description mentioning useMySeries"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath(
          '$.paths./api/v1/series/recommendations.get.parameters[?(@.name=="sourceMode")].description'
        ).exists())
        result.andExpect(jsonPath(
          '$.paths./api/v1/series/recommendations.get.parameters[?(@.name=="sourceMode")].description'
        ).value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsStringIgnoringCase("useMySeries"))))
  }

  def "SERIES-067-AC-07: recommendations' key parameters each carry a description"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "each key parameter carries a non-empty description"
        result.andExpect(status().isOk())
        ["discoverSortBy", "trendingWindow", "countries", "excludeGenres", "excludeKeywords"].each { name ->
            result.andExpect(jsonPath(
              "\$.paths./api/v1/series/recommendations.get.parameters[?(@.name==\"${name}\")].description"
            ).exists())
        }
  }

  def "SERIES-067-AC-07: GET /api/v1/series/recommendations documents the four sourcing modes"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's description mentions each sourcing mode"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/recommendations.get.description')
          .value(org.hamcrest.Matchers.allOf(
            org.hamcrest.Matchers.containsStringIgnoringCase("useMySeries"),
            org.hamcrest.Matchers.containsStringIgnoringCase("trending"),
            org.hamcrest.Matchers.containsStringIgnoringCase("topRated"))))
  }

  def "SERIES-067-AC-07: recommendationKeywords documents its on-demand, per-candidate nature"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's description mentions on-demand lookup"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/recommendations/{tmdbId}/keywords.get.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("on-demand")))
  }

  def "SERIES-067-AC-07: recommendationDetails documents independent field degradation"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's description mentions independent null degradation"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath(
          '$.paths./api/v1/series/recommendations/{tmdbId}/details.get.description'
        ).value(org.hamcrest.Matchers.containsStringIgnoringCase("null")))
  }

  def "SERIES-070-AC-07: GET /api/v1/series/recommendations documents a 200 example and error refs"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the 200 example and both error references are present"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/recommendations.get.responses.200.content.application/json.examples').exists())
        result.andExpect(jsonPath('$.paths./api/v1/series/recommendations.get.responses.502').exists())
        result.andExpect(jsonPath('$.paths./api/v1/series/recommendations.get.responses.400').exists())
  }

  def "SERIES-070-AC-07: recommendationDetails documents a null-field example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the details endpoint's 200 example shows independent degradation"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/recommendations/{tmdbId}/details.get.responses.200.content.application/json.examples').exists())
  }

  def "SERIES-070-AC-07: recommendationKeywords documents a 200 response example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the keywords endpoint's 200 example is present"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/recommendations/{tmdbId}/keywords.get.responses.200.content.application/json.examples').exists())
  }

  def "SERIES-070-AC-07: GET /api/v1/series/recommendations documents parameter examples"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the limit and genres parameters carry example values"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/recommendations.get.parameters[?(@.name=='limit')].example").exists())
        result.andExpect(jsonPath("\$.paths./api/v1/series/recommendations.get.parameters[?(@.name=='genres')].example").exists())
        result.andExpect(jsonPath("\$.paths./api/v1/series/recommendations.get.parameters[?(@.name=='yearMin')].example").exists())
        result.andExpect(jsonPath("\$.paths./api/v1/series/recommendations.get.parameters[?(@.name=='yearMax')].example").exists())
  }

  def "SERIES-070-AC-07: recommendationKeywords/recommendationDetails document a real tmdbId parameter example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the tmdbId path parameter carries The Office's real, live-verified TMDB id"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/recommendations/{tmdbId}/keywords.get.parameters[?(@.name=='tmdbId')].example").value(2316))
        result.andExpect(jsonPath("\$.paths./api/v1/series/recommendations/{tmdbId}/details.get.parameters[?(@.name=='tmdbId')].example").value(2316))
  }

  def "SERIES-070-AC-07: recommendationDetails documents a real imdbId parameter example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the imdbId parameter carries The Office's real, live-verified IMDb id"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/recommendations/{tmdbId}/details.get.parameters[?(@.name=='imdbId')].example").value("tt0386676"))
  }
}
