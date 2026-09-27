package uk.co.stefirby.seriestracker.config

import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
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

  @Autowired
  ObjectMapper objectMapper

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

  def "SERIES-070-AC-01: /v3/api-docs registers the 4 shared error-response components"() {
    when: "the generated OpenAPI spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "components.responses contains all 4 named responses, each with an example"
        result.andExpect(status().isOk())
        for (name in ['BadRequest', 'NotFound', 'Conflict', 'BadGateway']) {
            result.andExpect(jsonPath("\$.components.responses.${name}").exists())
            result.andExpect(jsonPath(
              "\$.components.responses.${name}.content.application/json.example"
            ).exists())
        }
  }

  // series_spec_070: the actual bug class this guards against -- an @ExampleObject
  // text block that mixed """ delimiters, \ line-continuation, and + concatenation
  // compiled fine and passed every jsonPath(...).exists() check while its *value*
  // was literally invalid JSON (a stray + and an embedded raw newline mid-string).
  // Asserting existence of the examples node was never enough; this parses every
  // Example Object's value string across the whole spec as real JSON.
  def "SERIES-070: every documented Example Object's value string is valid JSON"() {
    when: "the generated OpenAPI spec is requested and parsed"
        def result = mockMvc.perform(get("/v3/api-docs")).andReturn()
        def spec = objectMapper.readTree(result.response.contentAsString)
        def badExamples = [:]
        collectExampleValues(spec, '$', badExamples)

    then: "no Example Object's value string fails to parse as JSON"
        badExamples.isEmpty()
  }

  private static final List<String> EXAMPLE_OBJECT_KEYS =
      ['summary', 'description', 'value', 'externalValue']

  private void collectExampleValues(JsonNode node, String path, Map<String, String> badExamples) {
    if (node.isObject()) {
      def fieldNames = node.propertyNames()
      if (node.has('value') && node.get('value').isTextual() && fieldNames.every { it in EXAMPLE_OBJECT_KEYS }) {
        def rawValue = node.get('value').asText()
        try {
          objectMapper.readTree(rawValue)
        } catch (Exception e) {
          badExamples[path] = "${e.class.simpleName}: ${e.message} -- value was: ${rawValue}"
        }
      }
      fieldNames.each { name -> collectExampleValues(node.get(name), "${path}.${name}", badExamples) }
    } else if (node.isArray()) {
      node.eachWithIndex { JsonNode v, int i -> collectExampleValues(v, "${path}[${i}]", badExamples) }
    }
  }
}
