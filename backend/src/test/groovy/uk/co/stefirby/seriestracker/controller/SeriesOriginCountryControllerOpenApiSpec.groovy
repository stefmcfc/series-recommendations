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

/** series_spec_067_openapi_annotation_pass.md: SERIES-067-AC-06 (`SeriesOriginCountryController`). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesOriginCountryControllerOpenApiSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  def "SERIES-067-AC-06: GET .../origin-country/stats documents multi-country contribution"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's description mentions the raw ISO code, not a display name"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/origin-country/stats.get.description')
          .value(org.hamcrest.Matchers.containsStringIgnoringCase("ISO")))
  }

  def "SERIES-067-AC-06: GET .../origin-country/stats documents that each code contributes once, not fractionally"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the operation's description mentions the per-code contribution behavior"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.paths./api/v1/series/origin-country/stats.get.description')
          .value(org.hamcrest.Matchers.anyOf(
            org.hamcrest.Matchers.containsStringIgnoringCase("each"),
            org.hamcrest.Matchers.containsStringIgnoringCase("fractional"))))
  }
}
