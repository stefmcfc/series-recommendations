package uk.co.stefirby.seriestracker.controller

import uk.co.stefirby.seriestracker.dto.RecommendationDto
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import uk.co.stefirby.seriestracker.service.RecommendationService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification

import static org.mockito.Mockito.verify
import static org.mockito.Mockito.when
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesControllerRecommendationsSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @MockitoBean
    RecommendationService recommendationService

    def "SERIES-006-AC-26/27/28: returns 200 with the envelope, using the default limit of 20"() {
        given: "RecommendationService.recommend(20) resolves to 3 recommendations"
            def dto = new RecommendationDto(
                "Better Call Saul",
                2015,
                "Crime, Drama",
                "A small-time lawyer.",
                "https://image.tmdb.org/t/p/w500/poster.jpg",
                new BigDecimal("8.7"),
                "tt3032476",
                "Breaking Bad"
            )
            when(recommendationService.recommend(20)).thenReturn([dto, dto, dto])

        when: "the recommendations endpoint is invoked with no limit param"
            def result = mockMvc.perform(get("/api/v1/series/recommendations"))

        then: "the response is 200 with the mapped fields under data, and count reflects the result size"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(3))
            result.andExpect(jsonPath('$.data[0].title').value("Better Call Saul"))
            result.andExpect(jsonPath('$.data[0].sourceTitle').value("Breaking Bad"))
            result.andExpect(jsonPath('$.data[0].imdbId').value("tt3032476"))
    }

    def "SERIES-006-AC-26: values above 50 clamp to 50"() {
        given: "RecommendationService resolves an empty list for any limit"
            when(recommendationService.recommend(50)).thenReturn([])

        when: "the recommendations endpoint is invoked with limit=999"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("limit", "999"))

        then: "the response is 200 and recommend was called with 50 (clamped)"
            result.andExpect(status().isOk())
            // Assigned rather than a bare statement: Spock treats a bare non-void
            // expression in a "then:" block as an implicit boolean condition, and
            // verify(...).recommend(50) returns the stubbed (empty, hence falsy) list.
            def unused = verify(recommendationService).recommend(50)
    }

    def "SERIES-006-AC-26: values below 1 clamp to 1"() {
        given: "RecommendationService resolves an empty list for any limit"
            when(recommendationService.recommend(1)).thenReturn([])

        when: "the recommendations endpoint is invoked with limit=0"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("limit", "0"))

        then: "the response is 200 and recommend was called with 1 (clamped)"
            result.andExpect(status().isOk())
            def unused = verify(recommendationService).recommend(1)
    }

    def "SERIES-006-AC-29: an upstream TMDB failure returns 502 with a generic message"() {
        given: "RecommendationService fails because TMDB is unreachable / the key is unset"
            when(recommendationService.recommend(20)).thenThrow(new ExternalServiceException("TMDB request failed"))

        when: "the recommendations endpoint is invoked"
            def result = mockMvc.perform(get("/api/v1/series/recommendations"))

        then: "the response is 502 and does not leak the underlying exception message"
            result.andExpect(status().isBadGateway())
            result.andExpect(jsonPath('$.error').value("Unable to reach the series lookup service. Please try again."))
    }
}
