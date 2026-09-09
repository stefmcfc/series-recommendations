package uk.co.stefirby.seriestracker.controller

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification
import tools.jackson.databind.ObjectMapper
import uk.co.stefirby.seriestracker.model.FilterProfileArea
import uk.co.stefirby.seriestracker.repository.FilterProfileRepository

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FilterProfileControllerSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @Autowired
    FilterProfileRepository filterProfileRepository

    ObjectMapper objectMapper = new ObjectMapper()

    def cleanup() {
        filterProfileRepository.deleteAll()
    }

    def "SERIES-055-AC-04: POST creates and returns 201, criteria round-trips as real JSON"() {
        when: "POST /api/v1/filter-profiles is requested"
            def response = mockMvc.perform(post("/api/v1/filter-profiles")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"area":"MY_SERIES","name":"Weeknight","criteria":{"genres":["Comedy"]}}'))

        then: "201 with the created profile, criteria as a nested object"
            response.andExpect(status().isCreated())
            response.andExpect(jsonPath('$.data.name').value("Weeknight"))
            response.andExpect(jsonPath('$.data.area').value("MY_SERIES"))
            response.andExpect(jsonPath('$.data.criteria.genres[0]').value("Comedy"))
            response.andExpect(jsonPath('$.data.id').exists())
    }

    def "SERIES-055-AC-01/AC-03: GET ?area= returns that area's profiles sorted by name, empty when none"() {
        given: "no saved profiles"

        expect: "an empty list, not a 404"
            def empty = mockMvc.perform(get("/api/v1/filter-profiles").param("area", "MY_SERIES"))
            empty.andExpect(status().isOk())
            empty.andExpect(jsonPath('$.count').value(0))

        when: "two profiles are created in the same area, out of alphabetical order"
            mockMvc.perform(post("/api/v1/filter-profiles")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"area":"MY_SERIES","name":"Zebra","criteria":{}}'))
            mockMvc.perform(post("/api/v1/filter-profiles")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"area":"MY_SERIES","name":"Apple","criteria":{}}'))
            def response = mockMvc.perform(get("/api/v1/filter-profiles").param("area", "MY_SERIES"))

        then: "both are returned sorted by name"
            response.andExpect(status().isOk())
            response.andExpect(jsonPath('$.count').value(2))
            response.andExpect(jsonPath('$.data[0].name').value("Apple"))
            response.andExpect(jsonPath('$.data[1].name').value("Zebra"))
    }

    def "SERIES-055-AC-02: an invalid area returns 400"() {
        when: "GET /api/v1/filter-profiles?area=NOT_REAL is requested"
            def response = mockMvc.perform(get("/api/v1/filter-profiles").param("area", "NOT_REAL"))

        then: "400 Bad Request"
            response.andExpect(status().isBadRequest())
    }

    def "SERIES-055-AC-05: POST with a blank name returns 400"() {
        when: "POST with a blank name is requested"
            def response = mockMvc.perform(post("/api/v1/filter-profiles")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"area":"MY_SERIES","name":"   ","criteria":{}}'))

        then: "400 Bad Request"
            response.andExpect(status().isBadRequest())
    }

    def "SERIES-055-AC-06: POST with a duplicate (area, name) returns 409"() {
        given: "an existing profile"
            mockMvc.perform(post("/api/v1/filter-profiles")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"area":"MY_SERIES","name":"Weeknight","criteria":{}}'))

        when: "POSTing another with the same area and name"
            def response = mockMvc.perform(post("/api/v1/filter-profiles")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"area":"MY_SERIES","name":"Weeknight","criteria":{}}'))

        then: "409 Conflict"
            response.andExpect(status().isConflict())
    }

    def "SERIES-055-AC-09/AC-13: PATCH updates only the fields present, and sets updatedAt"() {
        given: "an existing profile"
            def created = mockMvc.perform(post("/api/v1/filter-profiles")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"area":"MY_SERIES","name":"Original","criteria":{"a":1}}'))
                .andReturn().response.contentAsString
            def id = objectMapper.readTree(created).get("data").get("id").asString()

        when: "PATCHing only the name"
            def response = mockMvc.perform(patch("/api/v1/filter-profiles/${id}")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"name":"Renamed"}'))

        then: "the name changed, criteria is unchanged"
            response.andExpect(status().isOk())
            response.andExpect(jsonPath('$.data.name').value("Renamed"))
            response.andExpect(jsonPath('$.data.criteria.a').value(1))
    }

    def "SERIES-055-AC-10: PATCH for a nonexistent id returns 404"() {
        when: "PATCH on a nonexistent id"
            def response = mockMvc.perform(patch("/api/v1/filter-profiles/${UUID.randomUUID()}")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"name":"Renamed"}'))

        then: "404 Not Found"
            response.andExpect(status().isNotFound())
    }

    def "SERIES-055-AC-11: PATCH renaming to a same-area collision returns 409"() {
        given: "two existing profiles in the same area"
            mockMvc.perform(post("/api/v1/filter-profiles")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"area":"MY_SERIES","name":"A","criteria":{}}'))
            def created = mockMvc.perform(post("/api/v1/filter-profiles")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"area":"MY_SERIES","name":"B","criteria":{}}'))
                .andReturn().response.contentAsString
            def id = objectMapper.readTree(created).get("data").get("id").asString()

        when: "renaming B to A"
            def response = mockMvc.perform(patch("/api/v1/filter-profiles/${id}")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"name":"A"}'))

        then: "409 Conflict"
            response.andExpect(status().isConflict())
    }

    def "SERIES-055-AC-14/15: DELETE returns 204, then 404 on a second attempt"() {
        given: "an existing profile"
            def created = mockMvc.perform(post("/api/v1/filter-profiles")
                .contentType(MediaType.APPLICATION_JSON)
                .content('{"area":"MY_SERIES","name":"ToDelete","criteria":{}}'))
                .andReturn().response.contentAsString
            def id = objectMapper.readTree(created).get("data").get("id").asString()

        expect: "first delete succeeds"
            mockMvc.perform(delete("/api/v1/filter-profiles/${id}"))
                .andExpect(status().isNoContent())

        and: "second delete 404s"
            mockMvc.perform(delete("/api/v1/filter-profiles/${id}"))
                .andExpect(status().isNotFound())
    }
}
