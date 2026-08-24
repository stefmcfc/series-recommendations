package uk.co.stefirby.seriestracker.controller

import uk.co.stefirby.seriestracker.dto.RecommendationCriteria
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

import static org.mockito.ArgumentMatchers.any
import static org.mockito.ArgumentMatchers.argThat
import static org.mockito.ArgumentMatchers.eq
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
        given: "RecommendationService.recommend(20, ...) resolves to 3 recommendations"
            def dto = new RecommendationDto(
                "Better Call Saul",
                2015,
                "Crime, Drama",
                "A small-time lawyer.",
                "https://image.tmdb.org/t/p/w500/poster.jpg",
                new BigDecimal("8.7"),
                1500,
                "tt3032476",
                ["Breaking Bad"],
                1
            )
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria))).thenReturn([dto, dto, dto])

        when: "the recommendations endpoint is invoked with no limit param"
            def result = mockMvc.perform(get("/api/v1/series/recommendations"))

        then: "the response is 200 with the mapped fields under data, and count reflects the result size"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(3))
            result.andExpect(jsonPath('$.data[0].title').value("Better Call Saul"))
            result.andExpect(jsonPath('$.data[0].sourceTitles[0]').value("Breaking Bad"))
            result.andExpect(jsonPath('$.data[0].totalSourceCount').value(1))
            result.andExpect(jsonPath('$.data[0].imdbId').value("tt3032476"))
    }

    def "SERIES-016-AC-01: GET /api/v1/series/recommendations includes voteCount"() {
        given: "RecommendationService.recommend(...) resolves a DTO with voteCount 1500"
            def dto = new RecommendationDto(
                "Better Call Saul",
                2015,
                "Crime, Drama",
                "A small-time lawyer.",
                "https://image.tmdb.org/t/p/w500/poster.jpg",
                new BigDecimal("8.7"),
                1500,
                "tt3032476",
                ["Breaking Bad"],
                1
            )
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria))).thenReturn([dto])

        when: "the recommendations endpoint is invoked"
            def result = mockMvc.perform(get("/api/v1/series/recommendations"))

        then: "voteCount is present in the response"
            result.andExpect(jsonPath('$.data[0].voteCount').value(1500))
    }

    def "SERIES-006-AC-26: values above 50 clamp to 50"() {
        given: "RecommendationService resolves an empty list for any limit"
            when(recommendationService.recommend(eq(50), any(RecommendationCriteria))).thenReturn([])

        when: "the recommendations endpoint is invoked with limit=999"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("limit", "999"))

        then: "the response is 200 and recommend was called with 50 (clamped)"
            result.andExpect(status().isOk())
            // Assigned rather than a bare statement: Spock treats a bare non-void
            // expression in a "then:" block as an implicit boolean condition, and
            // verify(...).recommend(50, ...) returns the stubbed (empty, hence falsy) list.
            def unused = verify(recommendationService).recommend(eq(50), any(RecommendationCriteria))
    }

    def "SERIES-006-AC-26: values below 1 clamp to 1"() {
        given: "RecommendationService resolves an empty list for any limit"
            when(recommendationService.recommend(eq(1), any(RecommendationCriteria))).thenReturn([])

        when: "the recommendations endpoint is invoked with limit=0"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("limit", "0"))

        then: "the response is 200 and recommend was called with 1 (clamped)"
            result.andExpect(status().isOk())
            def unused = verify(recommendationService).recommend(eq(1), any(RecommendationCriteria))
    }

    def "SERIES-006-AC-29: an upstream TMDB failure returns 502 with a generic message"() {
        given: "RecommendationService fails because TMDB is unreachable / the key is unset"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria)))
                .thenThrow(new ExternalServiceException("TMDB request failed"))

        when: "the recommendations endpoint is invoked"
            def result = mockMvc.perform(get("/api/v1/series/recommendations"))

        then: "the response is 502 and does not leak the underlying exception message"
            result.andExpect(status().isBadGateway())
            result.andExpect(jsonPath('$.error').value("Unable to reach the series lookup service. Please try again."))
    }

    // -- SERIES-007-AC-30: full endpoint parameter list --

    def "SERIES-007-AC-30: accepts every new optional recommendation param"() {
        given: "RecommendationService resolves an empty list for any criteria"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria))).thenReturn([])

        when: "the recommendations endpoint is invoked with every new param set"
            def id = UUID.randomUUID().toString()
            def result = mockMvc.perform(get("/api/v1/series/recommendations")
                .param("seriesIds", id)
                .param("genres", "Drama")
                .param("keywords", "Spy")
                .param("minSourceRating", "3")
                .param("minTmdbRating", "6.5")
                .param("minVoteCount", "10")
                .param("yearMin", "2010")
                .param("yearMax", "2020")
                .param("excludeGenres", "Horror")
                .param("excludeKeywords", "Zombie")
                .param("language", "en")
                .param("maxPerSource", "5"))

        then: "the response is 200"
            result.andExpect(status().isOk())
    }

    // -- SERIES-024-AC-02: excludeKeywords endpoint wiring --

    def "SERIES-024-AC-02: excludeKeywords query param is bound and passed through to RecommendationCriteria"() {
        given: "RecommendationService resolves an empty list for any criteria"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria))).thenReturn([])

        when: "GET /api/v1/series/recommendations?excludeKeywords=Zombie,Heist is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations")
                .param("excludeKeywords", "Zombie", "Heist"))

        then: "the response is 200 and RecommendationService received excludeKeywords=['Zombie','Heist']"
            result.andExpect(status().isOk())
            def unused = verify(recommendationService).recommend(eq(20), argThat({ RecommendationCriteria c ->
                c.excludeKeywords == ["Zombie", "Heist"]
            }))
    }

    // -- SERIES-007-AC-09/17/20: service-level IllegalArgumentException maps to 400 --

    def "SERIES-007-AC-09: an unknown series id in seriesIds is rejected"() {
        given: "RecommendationService rejects the request as it would for an unknown seriesIds entry"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria)))
                .thenThrow(new IllegalArgumentException("Unknown series id(s) in seriesIds: [...]"))

        when: "GET /api/v1/series/recommendations?seriesIds={a random UUID} is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations")
                .param("seriesIds", UUID.randomUUID().toString()))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }

    def "SERIES-007-AC-17: seriesIds combined with genres is rejected"() {
        given: "RecommendationService rejects the request as it would for combined seriesIds+genres"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria)))
                .thenThrow(new IllegalArgumentException("seriesIds cannot be combined with genres/keywords"))

        when: "GET /api/v1/series/recommendations?seriesIds={id}&genres=Drama is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations")
                .param("seriesIds", UUID.randomUUID().toString())
                .param("genres", "Drama"))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }

    def "SERIES-007-AC-20: minSourceRating outside 1-5 is rejected"() {
        given: "RecommendationService rejects the request as it would for an out-of-range minSourceRating"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria)))
                .thenThrow(new IllegalArgumentException("minSourceRating must be between 1 and 5"))

        when: "GET /api/v1/series/recommendations?minSourceRating=9 is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("minSourceRating", "9"))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }

    // -- SERIES-007-AC-31: malformed typed params -> 400 (real Spring conversion failure, no stub needed) --

    def "SERIES-007-AC-31: a malformed minTmdbRating returns 400"() {
        when: "GET /api/v1/series/recommendations?minTmdbRating=abc is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("minTmdbRating", "abc"))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }

    def "SERIES-007-AC-31: a malformed minVoteCount returns 400"() {
        when: "GET /api/v1/series/recommendations?minVoteCount=abc is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("minVoteCount", "abc"))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }

    def "SERIES-007-AC-31: a malformed yearMin returns 400"() {
        when: "GET /api/v1/series/recommendations?yearMin=abc is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("yearMin", "abc"))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }

    def "SERIES-007-AC-31: a malformed maxPerSource returns 400"() {
        when: "GET /api/v1/series/recommendations?maxPerSource=abc is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("maxPerSource", "abc"))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }

    // -- SERIES-015-AC-23/24: maxSourcesShown/sortBy endpoint wiring --

    def "SERIES-015-AC-23: maxSourcesShown and sortBy are accepted and passed through to RecommendationCriteria"() {
        given: "RecommendationService resolves an empty list for any criteria"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria))).thenReturn([])

        when: "GET /api/v1/series/recommendations?maxSourcesShown=2&sortBy=recommendationCount is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations")
                .param("maxSourcesShown", "2")
                .param("sortBy", "recommendationCount"))

        then: "the request succeeds"
            result.andExpect(status().isOk())
    }

    def "SERIES-015-AC-23: an unrecognized sortBy value is not an error"() {
        given: "RecommendationService resolves an empty list for any criteria"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria))).thenReturn([])

        when: "GET /api/v1/series/recommendations?sortBy=bogus is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("sortBy", "bogus"))

        then: "the request succeeds"
            result.andExpect(status().isOk())
    }

    def "SERIES-015-AC-24: a non-numeric maxSourcesShown returns 400"() {
        when: "GET /api/v1/series/recommendations?maxSourcesShown=abc is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("maxSourcesShown", "abc"))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }

    // -- SERIES-022: sourceMode / trendingWindow endpoint wiring --

    def "SERIES-022-AC-06: sourceMode=trending and trendingWindow are accepted and passed through"() {
        given: "RecommendationService resolves an empty list for any criteria"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria))).thenReturn([])

        when: "GET /api/v1/series/recommendations?sourceMode=trending&trendingWindow=day is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations")
                .param("sourceMode", "trending")
                .param("trendingWindow", "day"))

        then: "the request succeeds"
            result.andExpect(status().isOk())
    }

    def "SERIES-022-AC-06: sourceMode=topRated is accepted"() {
        given: "RecommendationService resolves an empty list for any criteria"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria))).thenReturn([])

        when: "GET /api/v1/series/recommendations?sourceMode=topRated is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("sourceMode", "topRated"))

        then: "the request succeeds"
            result.andExpect(status().isOk())
    }

    def "SERIES-022-AC-16: sourceMode combined with seriesIds is rejected"() {
        given: "RecommendationService rejects the request as it would for a combined sourceMode+seriesIds"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria)))
                .thenThrow(new IllegalArgumentException("sourceMode cannot be combined with seriesIds/genres/keywords"))

        when: "GET /api/v1/series/recommendations?sourceMode=trending&seriesIds={id} is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations")
                .param("sourceMode", "trending")
                .param("seriesIds", UUID.randomUUID().toString()))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }

    def "SERIES-022-AC-17: an unrecognized sourceMode value is rejected"() {
        given: "RecommendationService rejects the request as it would for an unrecognized sourceMode"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria)))
                .thenThrow(new IllegalArgumentException("sourceMode must be one of: trending, topRated"))

        when: "GET /api/v1/series/recommendations?sourceMode=bogus is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations").param("sourceMode", "bogus"))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }

    def "SERIES-022-AC-18: an unrecognized trendingWindow value is rejected"() {
        given: "RecommendationService rejects the request as it would for an unrecognized trendingWindow"
            when(recommendationService.recommend(eq(20), any(RecommendationCriteria)))
                .thenThrow(new IllegalArgumentException("trendingWindow must be one of: day, week"))

        when: "GET /api/v1/series/recommendations?sourceMode=trending&trendingWindow=month is requested"
            def result = mockMvc.perform(get("/api/v1/series/recommendations")
                .param("sourceMode", "trending")
                .param("trendingWindow", "month"))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }
}
