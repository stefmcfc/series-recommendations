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
}
