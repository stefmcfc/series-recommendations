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

/**
 * series_spec_067_openapi_annotation_pass.md: SERIES-067-AC-08
 * (`SeriesWatchProviderController`/`SeriesRefreshController`).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesWatchProviderRefreshOpenApiSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  def "SERIES-067-AC-08: watchProviders documents its never-502 behavior"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's description mentions the empty-list fallback"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}/watch-providers.get.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("empty")))
  }

  def "SERIES-067-AC-08: refresh documents that it ignores the skip threshold"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's description mentions the skip threshold"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}/refresh.post.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("skip")))
  }

  def "SERIES-067-AC-08: refresh documents the new-content-detection/status-reactivation side effect"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's description mentions new content"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}/refresh.post.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("new content")))
  }

  def "SERIES-067-AC-08: refreshAll's request body documents skipThresholdMinutesOverride's per-run-only override"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the refresh-all operation's request body description mentions the override"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/refresh-all.post.requestBody.description')
          .value(org.hamcrest.Matchers.allOf(
            org.hamcrest.Matchers.containsStringIgnoringCase("skipThresholdMinutesOverride"),
            org.hamcrest.Matchers.containsStringIgnoringCase("this one run"))))
  }

  def "SERIES-067-AC-08: acknowledgeNewContent and refreshAllStatus each carry an operation summary"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "each operation carries a non-empty summary"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}/acknowledge-new-content.post.summary').isNotEmpty())
        result.andExpect(jsonPath('$.paths./api/v1/series/refresh-all/status.get.summary').isNotEmpty())
        result.andExpect(jsonPath('$.paths./api/v1/series/refresh-all.post.summary').isNotEmpty())
  }

  def "SERIES-070-AC-08: watchProviders documents both a present and an empty-list example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the 200 response carries examples (plural) rather than a single example"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}/watch-providers.get.responses.200.content.application/json.examples.length()')
          .value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)))
  }

  def "SERIES-070-AC-08: watchProviders references NotFound"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the 404 response is present"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}/watch-providers.get.responses.404').exists())
  }

  def "SERIES-070-AC-08: GET .../watch-providers documents id and region parameter examples"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the id and region parameters carry example values"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath("\$.paths./api/v1/series/{id}/watch-providers.get.parameters[?(@.name=='id')].example").exists())
        result.andExpect(jsonPath("\$.paths./api/v1/series/{id}/watch-providers.get.parameters[?(@.name=='region')].example").value("US"))
  }

  def "SERIES-070-AC-08: refresh documents a 200 example and references NotFound"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the 200 example and 404 reference are both present"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}/refresh.post.responses.200.content.application/json.examples').exists())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}/refresh.post.responses.404').exists())
  }

  def "SERIES-070-AC-08: acknowledgeNewContent references NotFound"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the 404 response is present"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}/acknowledge-new-content.post.responses.404').exists())
  }

  def "SERIES-070-AC-08: refreshAll documents a request-body example, a 202 response example, and references Conflict"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the request body example, 202 response example, and 409 reference are all present"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/refresh-all.post.requestBody.content.application/json.examples').exists())
        result.andExpect(jsonPath('$.paths./api/v1/series/refresh-all.post.responses.202.content.application/json.examples').exists())
        result.andExpect(jsonPath('$.paths./api/v1/series/refresh-all.post.responses.409').exists())
  }

  def "SERIES-070-AC-08: refreshAllStatus documents a 200 response example"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the 200 response carries an example"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/refresh-all/status.get.responses.200.content.application/json.examples').exists())
  }
}
