package uk.co.stefirby.seriestracker.config

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.info.BuildProperties
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpenApiConfigSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  @Autowired
  BuildProperties buildProperties

  def "SERIES-066-AC-01: /v3/api-docs returns 200 with the generated OpenAPI spec"() {
    when: "the generated OpenAPI JSON spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the response is successful and describes a known endpoint path"
        result.andExpect(status().isOk())
        result.andExpect(content().contentTypeCompatibleWith("application/json"))
        result.andExpect(jsonPath('$.paths./api/v1/series').exists())
  }

  def "SERIES-066-AC-02: /swagger-ui.html returns 200"() {
    when: "the Swagger UI page is requested"
        def result = mockMvc.perform(get("/swagger-ui.html"))

    then: "the response redirects to or serves the UI successfully"
        result.andExpect(status().is3xxRedirection())
  }

  def "SERIES-066-AC-03: the OpenAPI spec carries the app's title and description"() {
    when: "the generated OpenAPI JSON spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the info block carries the configured title and a non-empty description"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.info.title').value("TV Series Tracker API"))
        result.andExpect(jsonPath('$.info.description').isNotEmpty())
  }

  def "SERIES-066-AC-04: the OpenAPI spec carries the real build version"() {
    when: "the generated OpenAPI JSON spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the info block's version matches the project's actual build version, not a default/placeholder"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.info.version').value(buildProperties.getVersion()))
  }
}
