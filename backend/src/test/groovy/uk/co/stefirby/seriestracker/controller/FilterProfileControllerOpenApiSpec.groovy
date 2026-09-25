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

/** series_spec_067_openapi_annotation_pass.md: SERIES-067-AC-09 (`FilterProfileController`). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FilterProfileControllerOpenApiSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  def "SERIES-067-AC-09: GET /api/v1/filter-profiles documents the five valid area values"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the area parameter's description lists at least one valid value"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath(
          '$.paths./api/v1/filter-profiles.get.parameters[?(@.name=="area")].description'
        ).value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsStringIgnoringCase("MY_SERIES"))))
  }

  def "SERIES-067-AC-09: POST /api/v1/filter-profiles documents (area, name)-scoped uniqueness"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the create operation's description mentions area-scoped uniqueness"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/filter-profiles.post.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("area")))
  }

  def "SERIES-067-AC-09: PATCH /api/v1/filter-profiles/{id} documents (area, name)-scoped uniqueness"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the update operation's description mentions area-scoped uniqueness"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/filter-profiles/{id}.patch.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("area")))
  }

  def "SERIES-067-AC-09: list/create/update/delete each carry an operation summary"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "each operation carries a non-empty summary"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/filter-profiles.get.summary').isNotEmpty())
        result.andExpect(jsonPath('$.paths./api/v1/filter-profiles.post.summary').isNotEmpty())
        result.andExpect(jsonPath('$.paths./api/v1/filter-profiles/{id}.patch.summary').isNotEmpty())
        result.andExpect(jsonPath('$.paths./api/v1/filter-profiles/{id}.delete.summary').isNotEmpty())
  }
}
