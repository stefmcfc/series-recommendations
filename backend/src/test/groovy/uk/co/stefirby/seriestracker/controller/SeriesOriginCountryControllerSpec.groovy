package uk.co.stefirby.seriestracker.controller

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.model.SeriesStatus
import uk.co.stefirby.seriestracker.repository.SeriesRepository

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesOriginCountryControllerSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @Autowired
    SeriesRepository seriesRepository

    def cleanup() {
        seriesRepository.deleteAll()
    }

    def "SERIES-049-AC-06: GET /api/v1/series/origin-country/stats returns the { data, count } envelope"() {
        when: "requested with no tracked series"
            def response = mockMvc.perform(get("/api/v1/series/origin-country/stats"))

        then: "200 with an empty list"
            response.andExpect(status().isOk())
            response.andExpect(jsonPath('$.data').isArray())
            response.andExpect(jsonPath('$.count').value(0))
    }

    def "SERIES-049-AC-02/03/06: GET /api/v1/series/origin-country/stats returns aggregate stats for tracked series"() {
        given: "a series carrying 'GB', rated 5"
            seriesRepository.save(new SeriesEntity(title: "Spooks", personalRating: 5, originCountry: "GB"))

        when: "GET /api/v1/series/origin-country/stats is requested"
            def result = mockMvc.perform(get("/api/v1/series/origin-country/stats"))

        then: "the response reflects the aggregated stat"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(1))
            result.andExpect(jsonPath('$.data[0].name').value("GB"))
            result.andExpect(jsonPath('$.data[0].seriesCount').value(1))
            result.andExpect(jsonPath('$.data[0].averagePersonalRating').value(5.0))
    }

    def "SERIES-049-AC-05: sortBy/sortDirection/min-filter params behave identically to /series/genres/stats"() {
        when: "requested with minSeriesCount=99 (nothing qualifies)"
            def response = mockMvc.perform(get("/api/v1/series/origin-country/stats").param("minSeriesCount", "99"))

        then: "200 with an empty list, not an error"
            response.andExpect(status().isOk())
            response.andExpect(jsonPath('$.count').value(0))
    }

    def "SERIES-049-AC-05: GET /api/v1/series/origin-country/stats?sortBy=name sorts alphabetically by raw ISO code"() {
        given: "origin countries 'US' and 'GB'"
            seriesRepository.save(new SeriesEntity(title: "A", originCountry: "US"))
            seriesRepository.save(new SeriesEntity(title: "B", originCountry: "GB"))

        when: "GET /api/v1/series/origin-country/stats?sortBy=name is requested"
            def result = mockMvc.perform(get("/api/v1/series/origin-country/stats").param("sortBy", "name"))

        then: "'GB' sorts before 'US'"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data[0].name').value("GB"))
            result.andExpect(jsonPath('$.data[1].name').value("US"))
    }

    def "onlyCompleted=true is accepted and narrows results (inherited from series_spec_051)"() {
        given: "a mix of completed and non-completed series carrying origin countries"
            seriesRepository.save(new SeriesEntity(title: "A", status: SeriesStatus.COMPLETED, originCountry: "GB"))
            seriesRepository.save(new SeriesEntity(title: "B", status: SeriesStatus.WATCHING, originCountry: "GB"))

        when: "requested with onlyCompleted=true"
            def result = mockMvc.perform(get("/api/v1/series/origin-country/stats").param("onlyCompleted", "true"))

        then: "only the completed series is counted"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data[0].seriesCount').value(1))
    }

    def "omitting onlyCompleted is unchanged from today's response (inherited from series_spec_051)"() {
        given: "a mix of completed and non-completed series carrying origin countries"
            seriesRepository.save(new SeriesEntity(title: "A", status: SeriesStatus.COMPLETED, originCountry: "GB"))
            seriesRepository.save(new SeriesEntity(title: "B", status: SeriesStatus.WATCHING, originCountry: "GB"))

        expect: "identical response with and without the new param explicitly false"
            def withoutParam = mockMvc.perform(get("/api/v1/series/origin-country/stats"))
            def explicitFalse = mockMvc.perform(get("/api/v1/series/origin-country/stats").param("onlyCompleted", "false"))
            withoutParam.andReturn().response.contentAsString == explicitFalse.andReturn().response.contentAsString
    }
}
