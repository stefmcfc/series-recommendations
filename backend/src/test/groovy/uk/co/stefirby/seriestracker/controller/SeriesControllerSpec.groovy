package uk.co.stefirby.seriestracker.controller

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import uk.co.stefirby.seriestracker.dto.SeriesDto
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import tools.jackson.databind.ObjectMapper

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesControllerSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  @Autowired
  ObjectMapper objectMapper

  @Autowired
  SeriesRepository seriesRepository

  def cleanup() {
    seriesRepository.deleteAll()
  }

  def "POST /api/v1/series should create a series"() {
    given: "a valid series DTO"
        def dto = new SeriesDto(title: "The Office")
        def json = objectMapper.writeValueAsString(dto)

    when: "a POST request is made to create the series"
        def result = mockMvc.perform(
          post("/api/v1/series")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json)
        )

    then: "the series is created and returned in the response"
        result.andExpect(status().isCreated())
        result.andExpect(jsonPath('$.data.title').value("The Office"))
        result.andExpect(jsonPath('$.data.id').isNotEmpty())
  }

  def "SERIES-005-AC-03: POST /api/v1/series should accept and return posterUrl"() {
    given: "a series DTO with a posterUrl"
        def dto = new SeriesDto(title: "The Wire", posterUrl: "https://example.com/the-wire.jpg")
        def json = objectMapper.writeValueAsString(dto)

    when: "a POST request is made to create the series"
        def result = mockMvc.perform(
          post("/api/v1/series")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json)
        )

    then: "the series is created with the posterUrl included"
        result.andExpect(status().isCreated())
        result.andExpect(jsonPath('$.data.posterUrl').value("https://example.com/the-wire.jpg"))
  }

  def "POST /api/v1/series should reject invalid data"() {
    given: "a series DTO with a blank title and an invalid IMDb rating"
        def dto = new SeriesDto(title: "", imdbRating: 15.0)
        def json = objectMapper.writeValueAsString(dto)

    when: "a POST request is made to create the series"
        def result = mockMvc.perform(
          post("/api/v1/series")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json)
        )

    then: "the request is rejected as a bad request"
        result.andExpect(status().isBadRequest())
  }

  def "GET /api/v1/series should return all series"() {
    when: "a GET request is made for all series"
        def result = mockMvc.perform(get("/api/v1/series"))

    then: "the response contains an array of series"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data').isArray())
  }

  def "GET /api/v1/series/{id} should return a series"() {
    given: "a series DTO to create"
        def createDto = new SeriesDto(title: "Test Show")
        def createJson = objectMapper.writeValueAsString(createDto)

    and: "the series has been created via a POST request"
        def createResult = mockMvc.perform(
          post("/api/v1/series")
            .contentType(MediaType.APPLICATION_JSON)
            .content(createJson)
        ).andReturn()

    and: "the created series's ID is extracted from the response"
        def responseBody = objectMapper.readTree(createResult.response.contentAsString)
        def id = responseBody.get("data").get("id").asText()

    when: "a GET request is made for that series ID"
        def result = mockMvc.perform(get("/api/v1/series/" + id))

    then: "the matching series is returned"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data.title').value("Test Show"))
  }

  def "GET /api/v1/series/{id} should return 404 for non-existent series"() {
    when: "a GET request is made for a non-existent series ID"
        def result = mockMvc.perform(get("/api/v1/series/00000000-0000-0000-0000-000000000000"))

    then: "a 404 Not Found response is returned"
        result.andExpect(status().isNotFound())
  }

  def "PATCH /api/v1/series/{id} should update a series"() {
    given: "a series DTO to create"
        def createDto = new SeriesDto(title: "Show", totalSeasons: 5)
        def createJson = objectMapper.writeValueAsString(createDto)

    and: "the series has been created via a POST request"
        def createResult = mockMvc.perform(
          post("/api/v1/series")
            .contentType(MediaType.APPLICATION_JSON)
            .content(createJson)
        ).andReturn()

    and: "the created series's ID is extracted from the response"
        def responseBody = objectMapper.readTree(createResult.response.contentAsString)
        def id = responseBody.get("data").get("id").asText()

    and: "an update DTO with a new current season"
        def updateDto = new SeriesDto(currentSeason: 3)
        def updateJson = objectMapper.writeValueAsString(updateDto)

    when: "a PATCH request is made to update the series"
        def result = mockMvc.perform(
          patch("/api/v1/series/" + id)
            .contentType(MediaType.APPLICATION_JSON)
            .content(updateJson)
        )

    then: "the series is updated and the new value is returned"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data.currentSeason').value(3))
  }

  def "PATCH /api/v1/series/{id} should return 404 for non-existent series"() {
    given: "an update DTO"
        def updateDto = new SeriesDto(title: "Updated")
        def json = objectMapper.writeValueAsString(updateDto)

    when: "a PATCH request is made for a non-existent series ID"
        def result = mockMvc.perform(
          patch("/api/v1/series/00000000-0000-0000-0000-000000000000")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json)
        )

    then: "a 404 Not Found response is returned"
        result.andExpect(status().isNotFound())
  }

  def "DELETE /api/v1/series/{id} should delete a series"() {
    given: "a series DTO to create"
        def createDto = new SeriesDto(title: "Delete Me")
        def createJson = objectMapper.writeValueAsString(createDto)

    and: "the series has been created via a POST request"
        def createResult = mockMvc.perform(
          post("/api/v1/series")
            .contentType(MediaType.APPLICATION_JSON)
            .content(createJson)
        ).andReturn()

    and: "the created series's ID is extracted from the response"
        def responseBody = objectMapper.readTree(createResult.response.contentAsString)
        def id = responseBody.get("data").get("id").asText()

    when: "a DELETE request is made for that series"
        def result = mockMvc.perform(delete("/api/v1/series/" + id))

    then: "a 204 No Content response is returned"
        result.andExpect(status().isNoContent())

    and: "the deleted series can no longer be retrieved"
        when: "a GET request is made for the deleted series"
            mockMvc.perform(get("/api/v1/series/" + id))

        then: "a 404 Not Found response is returned"
            status().isNotFound()
  }

  def "DELETE /api/v1/series/{id} should return 404 for non-existent series"() {
    when: "a DELETE request is made for a non-existent series ID"
        def result = mockMvc.perform(delete("/api/v1/series/00000000-0000-0000-0000-000000000000"))

    then: "a 404 Not Found response is returned"
        result.andExpect(status().isNotFound())
  }

  def "SERIES-005-AC-17: GET /api/v1/series/lookup returns 502 when app.omdb.api-key is not configured"() {
    when: "the lookup endpoint is invoked against the real OmdbClient/SeriesLookupService chain"
        // The test profile deliberately leaves app.omdb.api-key unset (see
        // src/test/resources/application.yml), so this exercises the real "key not
        // configured" path end-to-end without calling the live OMDb API.
        def result = mockMvc.perform(get("/api/v1/series/lookup").param("title", "Any Show"))

    then: "the response is a 502 Bad Gateway with a generic message"
        result.andExpect(status().isBadGateway())
        result.andExpect(jsonPath('$.error').value("Unable to reach the series lookup service. Please try again."))
  }
}
