package uk.co.stefirby.seriestracker.config

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpHeaders
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CorsConfigSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  def "TOOLING-001-AC-16: allowed origin receives Access-Control-Allow-Origin header"() {
    given: "a request to an /api/** endpoint from the configured frontend dev origin"
        def allowedOrigin = "http://localhost:5173"

    when: "the request is made with an Origin header matching the configured allow-list"
        def result = mockMvc.perform(
          get("/api/v1/series").header(HttpHeaders.ORIGIN, allowedOrigin)
        )

    then: "the response is successful and echoes back the allowed origin"
        result.andExpect(status().isOk())
        result.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
          .header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, allowedOrigin))
  }

  def "TOOLING-001-AC-16: disallowed origin does not receive a CORS allow header"() {
    given: "a request to an /api/** endpoint from an origin that is not on the allow-list"
        def disallowedOrigin = "http://evil.example.com"

    when: "the request is made with a non-configured Origin header"
        def result = mockMvc.perform(
          get("/api/v1/series").header(HttpHeaders.ORIGIN, disallowedOrigin)
        )

    then: "no Access-Control-Allow-Origin header is present, proving the config is not permissive/wildcard"
        result.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
          .header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN))
  }

  def "TOOLING-001-AC-17: cross-origin request to the export endpoint exposes Content-Disposition"() {
    given: "a request to the export endpoint from the configured frontend dev origin"
        def allowedOrigin = "http://localhost:5173"

    when: "the request is made with an Origin header matching the configured allow-list"
        def result = mockMvc.perform(
          get("/api/v1/series/export").header(HttpHeaders.ORIGIN, allowedOrigin)
        )

    then: "the response declares Content-Disposition as exposed to cross-origin JavaScript"
        result.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
          .header().string(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, "Content-Disposition"))
  }
}
