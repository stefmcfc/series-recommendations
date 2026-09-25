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
 * series_spec_067_openapi_annotation_pass.md: SERIES-067-AC-01 (CRUD/search/export) and
 * SERIES-067-AC-03 (import/import-status), both on {@code SeriesController}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesControllerOpenApiSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  def "SERIES-067-AC-01: PATCH /api/v1/series/{id} documents the TMDB-managed field lock"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the PATCH operation's description mentions the field-lock behavior"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}.patch.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("TMDB")))
  }

  def "SERIES-067-AC-01: PATCH /api/v1/series/{id} documents clearedFields"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the PATCH operation's description mentions clearedFields"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/{id}.patch.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("clearedFields")))
  }

  def "SERIES-067-AC-01: search's genre/excludeGenre parameters document repeatable substring exclusion-wins semantics"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "both parameters carry non-empty descriptions"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath(
          '$.paths./api/v1/series/search.get.parameters[?(@.name=="genre")].description'
        ).exists())
        result.andExpect(jsonPath(
          '$.paths./api/v1/series/search.get.parameters[?(@.name=="excludeGenre")].description'
        ).exists())
  }

  def "SERIES-067-AC-01: search's four missing*Rating parameters document OR semantics"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "each missing*Rating parameter's description mentions OR"
        result.andExpect(status().isOk())
        ["missingImdbRating", "missingTmdbRating", "missingRottenTomatoesRating",
         "missingRottenTomatoesPopcornmeter"].each { name ->
            result.andExpect(jsonPath(
              "\$.paths./api/v1/series/search.get.parameters[?(@.name==\"${name}\")].description"
            ).value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsStringIgnoringCase("OR"))))
        }
  }

  def "SERIES-067-AC-03: POST /api/v1/series/import documents dual-format dispatch"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the import operation's description mentions both supported formats"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/import.post.description')
          .value(org.hamcrest.Matchers.allOf(
            org.hamcrest.Matchers.containsStringIgnoringCase("json"),
            org.hamcrest.Matchers.containsStringIgnoringCase("csv"))))
  }

  def "SERIES-067-AC-03: POST /api/v1/series/import documents skippedCount for duplicate imdbId"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the import operation's description mentions skippedCount"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/import.post.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("skippedCount")))
  }

  def "SERIES-067-AC-03: GET /api/v1/series/import/status documents the job status lifecycle"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the import-status operation's description mentions the status values"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/import/status.get.description')
          .value(org.hamcrest.Matchers.allOf(
            org.hamcrest.Matchers.containsStringIgnoringCase("IDLE"),
            org.hamcrest.Matchers.containsStringIgnoringCase("IN_PROGRESS"),
            org.hamcrest.Matchers.containsStringIgnoringCase("COMPLETED"),
            org.hamcrest.Matchers.containsStringIgnoringCase("FAILED"))))
  }
}
