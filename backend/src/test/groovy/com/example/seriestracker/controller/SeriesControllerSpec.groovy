package com.example.seriestracker.controller

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import com.example.seriestracker.dto.SeriesDto
import com.example.seriestracker.repository.SeriesRepository
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
    given:
    def dto = new SeriesDto(title: "The Office")
    def json = objectMapper.writeValueAsString(dto)

    when:
    def result = mockMvc.perform(
      post("/api/v1/series")
        .contentType(MediaType.APPLICATION_JSON)
        .content(json)
    )

    then:
    result.andExpect(status().isCreated())
    result.andExpect(jsonPath('$.data.title').value("The Office"))
    result.andExpect(jsonPath('$.data.id').isNotEmpty())
  }

  def "POST /api/v1/series should reject invalid data"() {
    given:
    def dto = new SeriesDto(title: "", imdbRating: 15.0)
    def json = objectMapper.writeValueAsString(dto)

    when:
    def result = mockMvc.perform(
      post("/api/v1/series")
        .contentType(MediaType.APPLICATION_JSON)
        .content(json)
    )

    then:
    result.andExpect(status().isBadRequest())
  }

  def "GET /api/v1/series should return all series"() {
    when:
    def result = mockMvc.perform(get("/api/v1/series"))

    then:
    result.andExpect(status().isOk())
    result.andExpect(jsonPath('$.data').isArray())
  }

  def "GET /api/v1/series/{id} should return a series"() {
    given:
    def createDto = new SeriesDto(title: "Test Show")
    def createJson = objectMapper.writeValueAsString(createDto)

    and:
    def createResult = mockMvc.perform(
      post("/api/v1/series")
        .contentType(MediaType.APPLICATION_JSON)
        .content(createJson)
    ).andReturn()

    and:
    def responseBody = objectMapper.readTree(createResult.response.contentAsString)
    def id = responseBody.get("data").get("id").asText()

    when:
    def result = mockMvc.perform(get("/api/v1/series/" + id))

    then:
    result.andExpect(status().isOk())
    result.andExpect(jsonPath('$.data.title').value("Test Show"))
  }

  def "GET /api/v1/series/{id} should return 404 for non-existent series"() {
    when:
    def result = mockMvc.perform(get("/api/v1/series/00000000-0000-0000-0000-000000000000"))

    then:
    result.andExpect(status().isNotFound())
  }

  def "PATCH /api/v1/series/{id} should update a series"() {
    given:
    def createDto = new SeriesDto(title: "Show", totalSeasons: 5)
    def createJson = objectMapper.writeValueAsString(createDto)

    and:
    def createResult = mockMvc.perform(
      post("/api/v1/series")
        .contentType(MediaType.APPLICATION_JSON)
        .content(createJson)
    ).andReturn()

    and:
    def responseBody = objectMapper.readTree(createResult.response.contentAsString)
    def id = responseBody.get("data").get("id").asText()

    and:
    def updateDto = new SeriesDto(currentSeason: 3)
    def updateJson = objectMapper.writeValueAsString(updateDto)

    when:
    def result = mockMvc.perform(
      patch("/api/v1/series/" + id)
        .contentType(MediaType.APPLICATION_JSON)
        .content(updateJson)
    )

    then:
    result.andExpect(status().isOk())
    result.andExpect(jsonPath('$.data.currentSeason').value(3))
  }

  def "PATCH /api/v1/series/{id} should return 404 for non-existent series"() {
    given:
    def updateDto = new SeriesDto(title: "Updated")
    def json = objectMapper.writeValueAsString(updateDto)

    when:
    def result = mockMvc.perform(
      patch("/api/v1/series/00000000-0000-0000-0000-000000000000")
        .contentType(MediaType.APPLICATION_JSON)
        .content(json)
    )

    then:
    result.andExpect(status().isNotFound())
  }

  def "DELETE /api/v1/series/{id} should delete a series"() {
    given:
    def createDto = new SeriesDto(title: "Delete Me")
    def createJson = objectMapper.writeValueAsString(createDto)

    and:
    def createResult = mockMvc.perform(
      post("/api/v1/series")
        .contentType(MediaType.APPLICATION_JSON)
        .content(createJson)
    ).andReturn()

    and:
    def responseBody = objectMapper.readTree(createResult.response.contentAsString)
    def id = responseBody.get("data").get("id").asText()

    when:
    def result = mockMvc.perform(delete("/api/v1/series/" + id))

    then:
    result.andExpect(status().isNoContent())

    and:
    when:
    mockMvc.perform(get("/api/v1/series/" + id))

    then:
    status().isNotFound()
  }

  def "DELETE /api/v1/series/{id} should return 404 for non-existent series"() {
    when:
    def result = mockMvc.perform(delete("/api/v1/series/00000000-0000-0000-0000-000000000000"))

    then:
    result.andExpect(status().isNotFound())
  }
}
