package uk.co.stefirby.seriestracker.controller

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification
import uk.co.stefirby.seriestracker.model.KeywordEntity
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.repository.KeywordRepository
import uk.co.stefirby.seriestracker.repository.SeriesRepository

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesControllerKeywordsSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @Autowired
    SeriesRepository seriesRepository

    @Autowired
    KeywordRepository keywordRepository

    def cleanup() {
        seriesRepository.deleteAll()
        keywordRepository.deleteAll()
    }

    def "SERIES-019-AC-17: GET /api/v1/series/keywords returns 200 with the envelope shape, empty when nothing tracked has keywords"() {
        when: "GET /api/v1/series/keywords is requested with no tracked series"
            def result = mockMvc.perform(get("/api/v1/series/keywords"))

        then: "the response is 200 with an empty list"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data').isArray())
            result.andExpect(jsonPath('$.count').value(0))
    }

    def "SERIES-019-AC-17: GET /api/v1/series/keywords returns aggregate stats for tracked series"() {
        given: "a series carrying 'spy', rated 5"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            seriesRepository.save(new SeriesEntity(title: "Spooks", personalRating: 5, keywords: [spy] as Set))

        when: "GET /api/v1/series/keywords is requested"
            def result = mockMvc.perform(get("/api/v1/series/keywords"))

        then: "the response reflects the aggregated stat"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(1))
            result.andExpect(jsonPath('$.data[0].name').value("spy"))
            result.andExpect(jsonPath('$.data[0].seriesCount').value(1))
            result.andExpect(jsonPath('$.data[0].averagePersonalRating').value(5.0))
    }

    def "SERIES-019-AC-20: GET /api/v1/series/search accepts a repeatable keyword query param"() {
        given: "one series carrying 'spy', another carrying no keywords"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            seriesRepository.save(new SeriesEntity(title: "Spooks", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "The Office"))

        when: "GET /api/v1/series/search?keyword=spy is requested"
            def result = mockMvc.perform(get("/api/v1/series/search").param("keyword", "spy"))

        then: "only the series carrying that keyword is returned"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(1))
            result.andExpect(jsonPath('$.data[0].title').value("Spooks"))
    }

    def "SERIES-019-AC-21: GET /api/v1/series/search with no keyword param behaves exactly as today"() {
        given: "two series, neither filtered by keyword"
            seriesRepository.save(new SeriesEntity(title: "Spooks"))
            seriesRepository.save(new SeriesEntity(title: "The Office"))

        when: "GET /api/v1/series/search is requested with no keyword param"
            def result = mockMvc.perform(get("/api/v1/series/search"))

        then: "both series are returned"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(2))
    }
}
