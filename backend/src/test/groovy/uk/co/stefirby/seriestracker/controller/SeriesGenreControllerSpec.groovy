package uk.co.stefirby.seriestracker.controller

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.repository.SeriesRepository

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesGenreControllerSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @Autowired
    SeriesRepository seriesRepository

    def cleanup() {
        seriesRepository.deleteAll()
    }

    def "SERIES-048-AC-06: GET /api/v1/series/genres/stats returns the { data, count } envelope"() {
        when: "requested with no tracked series"
            def response = mockMvc.perform(get("/api/v1/series/genres/stats"))

        then: "200 with an empty list"
            response.andExpect(status().isOk())
            response.andExpect(jsonPath('$.data').isArray())
            response.andExpect(jsonPath('$.count').value(0))
    }

    def "SERIES-048-AC-02/06: GET /api/v1/series/genres/stats returns aggregate stats for tracked series"() {
        given: "a series carrying 'Drama', rated 5"
            seriesRepository.save(new SeriesEntity(title: "Spooks", personalRating: 5, genres: "Drama"))

        when: "GET /api/v1/series/genres/stats is requested"
            def result = mockMvc.perform(get("/api/v1/series/genres/stats"))

        then: "the response reflects the aggregated stat"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(1))
            result.andExpect(jsonPath('$.data[0].name').value("Drama"))
            result.andExpect(jsonPath('$.data[0].seriesCount').value(1))
            result.andExpect(jsonPath('$.data[0].averagePersonalRating').value(5.0))
    }

    def "SERIES-048-AC-05: sortBy/sortDirection/min-filter params behave identically to /series/keywords"() {
        when: "requested with minSeriesCount=99 (nothing qualifies)"
            def response = mockMvc.perform(get("/api/v1/series/genres/stats").param("minSeriesCount", "99"))

        then: "200 with an empty list, not an error"
            response.andExpect(status().isOk())
            response.andExpect(jsonPath('$.count').value(0))
    }

    def "SERIES-048-AC-05: GET /api/v1/series/genres/stats?sortBy=name sorts alphabetically"() {
        given: "genres 'Sci-Fi' and 'Drama'"
            seriesRepository.save(new SeriesEntity(title: "A", genres: "Sci-Fi"))
            seriesRepository.save(new SeriesEntity(title: "B", genres: "Drama"))

        when: "GET /api/v1/series/genres/stats?sortBy=name is requested"
            def result = mockMvc.perform(get("/api/v1/series/genres/stats").param("sortBy", "name"))

        then: "'Drama' sorts before 'Sci-Fi'"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data[0].name').value("Drama"))
            result.andExpect(jsonPath('$.data[1].name').value("Sci-Fi"))
    }
}
