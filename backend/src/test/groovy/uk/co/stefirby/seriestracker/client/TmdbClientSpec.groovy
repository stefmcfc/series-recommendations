package uk.co.stefirby.seriestracker.client

import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.web.client.RestClient
import spock.lang.Specification

import java.io.IOException

import static org.springframework.test.web.client.match.MockRestRequestMatchers.method
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess

/**
 * Unit tests for {@link TmdbClient}. Mirrors {@code OmdbClientSpec}: constructed directly
 * with a plain {@code RestClient.Builder} bound to {@link MockRestServiceServer}, so no real
 * network call is ever made and no real TMDB API key is required.
 */
class TmdbClientSpec extends Specification {

    private static final String BASE_URL = "http://localhost/tmdb-test/"
    private static final String API_KEY = "test-tmdb-key"

    RestClient.Builder builder
    MockRestServiceServer mockServer

    def setup() {
        builder = RestClient.builder()
        mockServer = MockRestServiceServer.bindTo(builder).build()
    }

    private TmdbClient client(String apiKey = API_KEY) {
        new TmdbClient(builder, apiKey, BASE_URL)
    }

    def "SERIES-006-AC-08: resolves a TMDB tv id from an IMDb id"() {
        given: "TMDB /find returns one tv_results entry with id 1396"
            def body = '{"tv_results":[{"id":1396}]}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("find/tt0903747")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("external_source", "imdb_id"))
                .andExpect(queryParam("api_key", API_KEY))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.findTvIdByImdbId('tt0903747') is called"
            def result = client().findTvIdByImdbId("tt0903747")

        then: "the tmdbId is returned"
            result.get() == 1396
    }

    def "SERIES-006-AC-08: returns empty when tv_results is empty"() {
        given: "TMDB /find returns an empty tv_results array"
            def body = '{"tv_results":[]}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("find/tt9999999")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.findTvIdByImdbId('tt9999999') is called"
            def result = client().findTvIdByImdbId("tt9999999")

        then: "no id is returned"
            result.isEmpty()
    }

    def "SERIES-006-AC-08: returns empty when tv_results is absent"() {
        given: "TMDB /find returns a body with no tv_results field at all"
            def body = '{}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("find/tt0000000")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.findTvIdByImdbId('tt0000000') is called"
            def result = client().findTvIdByImdbId("tt0000000")

        then: "no id is returned"
            result.isEmpty()
    }

    def "SERIES-006-AC-09: maps recommendations() results to TmdbCandidate"() {
        given: "TMDB /tv/1396/recommendations returns two results"
            def body = '''
                {
                  "results": [
                    {"id": 2316, "name": "The Office", "first_air_date": "2005-03-24",
                     "overview": "A mockumentary.", "poster_path": "/poster1.jpg",
                     "vote_average": 8.6, "genre_ids": [35], "vote_count": 1500,
                     "original_language": "en"},
                    {"id": 1668, "name": "Friends", "first_air_date": "1994-09-22",
                     "overview": "Six friends.", "poster_path": "/poster2.jpg",
                     "vote_average": 8.4, "genre_ids": [35, 18], "vote_count": 900,
                     "original_language": "en"}
                  ]
                }
            '''
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/1396/recommendations")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("api_key", API_KEY))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.recommendations(1396) is called"
            def result = client().recommendations(1396)

        then: "each result is mapped to a TmdbCandidate"
            result.size() == 2
            result[0].tmdbId() == 2316
            result[0].title() == "The Office"
            result[0].year() == 2005
            result[0].overview() == "A mockumentary."
            result[0].posterPath() == "/poster1.jpg"
            result[0].voteAverage() == 8.6
            result[0].genreIds() == [35]
            result[1].tmdbId() == 1668
            result[1].genreIds() == [35, 18]
    }

    def "SERIES-007-AC-23: maps vote_count and original_language onto TmdbCandidate"() {
        given: "TMDB /tv/1396/recommendations returns one result with vote_count and original_language"
            def body = '''
                {
                  "results": [
                    {"id": 2316, "name": "The Office", "vote_average": 8.6,
                     "vote_count": 1500, "original_language": "en"}
                  ]
                }
            '''
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/1396/recommendations")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.recommendations(1396) is called"
            def result = client().recommendations(1396)

        then: "voteCount and originalLanguage are mapped"
            result[0].voteCount() == 1500
            result[0].originalLanguage() == "en"
    }

    def "SERIES-007-AC-23: vote_count/original_language are null when absent"() {
        given: "TMDB /tv/1396/recommendations returns a result with neither field"
            def body = '{"results":[{"id":2316,"name":"The Office"}]}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/1396/recommendations")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.recommendations(1396) is called"
            def result = client().recommendations(1396)

        then: "both fields are null"
            result[0].voteCount() == null
            result[0].originalLanguage() == null
    }

    def "SERIES-006-AC-09: an absent results array maps to an empty list"() {
        given: "TMDB returns a body with no results field"
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/1396/recommendations")))
                .andRespond(withSuccess('{}', MediaType.APPLICATION_JSON))

        when: "TmdbClient.recommendations(1396) is called"
            def result = client().recommendations(1396)

        then: "an empty list is returned"
            result.isEmpty()
    }

    def "SERIES-006-AC-10: similar() calls /tv/{id}/similar, mapped the same way"() {
        given: "TMDB /tv/1396/similar returns one result"
            def body = '{"results":[{"id":42,"name":"Better Call Saul","first_air_date":"2015-02-08","vote_average":8.8,"genre_ids":[18,80]}]}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/1396/similar")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.similar(1396) is called"
            def result = client().similar(1396)

        then: "the result is mapped to a TmdbCandidate"
            result.size() == 1
            result[0].tmdbId() == 42
            result[0].title() == "Better Call Saul"
            result[0].year() == 2015
    }

    def "SERIES-007-AC-06: discover() calls /discover/tv with comma-joined genre ids when only genreIds are given"() {
        given: "TMDB /discover/tv returns one result"
            def body = '{"results":[{"id":99,"name":"Discovered Show","genre_ids":[18]}]}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("discover/tv")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("with_genres", "18,80"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.discover([18, 80], []) is called"
            def result = client().discover([18, 80], [])

        then: "with_genres is sent and with_keywords is omitted; the result is mapped to a TmdbCandidate"
            result.size() == 1
            result[0].tmdbId() == 99
    }

    def "SERIES-007-AC-06: discover() sends both with_genres and with_keywords when both are provided"() {
        given: "a mocked TMDB server expecting GET /discover/tv?with_genres=18&with_keywords=9720"
            def body = '{"results":[{"id":100,"name":"Spy Show"}]}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("discover/tv")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("with_genres", "18"))
                .andExpect(queryParam("with_keywords", "9720"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.discover([18], [9720]) is called"
            def result = client().discover([18], [9720])

        then: "the expected request was made and the result is mapped"
            result.size() == 1
            result[0].tmdbId() == 100
    }

    def "SERIES-007-AC-06: discover() omits with_genres when genreIds is empty, sending only with_keywords"() {
        given: "TMDB /discover/tv returns one result"
            def body = '{"results":[{"id":101,"name":"Keyword-only Show"}]}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("discover/tv")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("with_keywords", "9720"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.discover([], [9720]) is called"
            def result = client().discover([], [9720])

        then: "the result is mapped"
            result.size() == 1
            result[0].tmdbId() == 101
    }

    def "SERIES-007-AC-05: resolves a keyword name to a TMDB keyword id"() {
        given: "TMDB /search/keyword?query=spy returns one result with id 9720"
            def body = '{"results":[{"id":9720,"name":"spy"}]}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("search/keyword")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("query", "spy"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.searchKeyword('spy') is called"
            def result = client().searchKeyword("spy")

        then: "the keyword id is returned"
            result.get() == 9720
    }

    def "SERIES-007-AC-05: returns empty when /search/keyword results is empty"() {
        given: "TMDB /search/keyword returns an empty results array"
            def body = '{"results":[]}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("search/keyword")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.searchKeyword('nonexistent') is called"
            def result = client().searchKeyword("nonexistent")

        then: "no keyword id is returned"
            result.isEmpty()
    }

    def "SERIES-007-AC-05: returns empty when /search/keyword results is absent"() {
        given: "TMDB /search/keyword returns a body with no results field"
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("search/keyword")))
                .andRespond(withSuccess('{}', MediaType.APPLICATION_JSON))

        when: "TmdbClient.searchKeyword('spy') is called"
            def result = client().searchKeyword("spy")

        then: "no keyword id is returned"
            result.isEmpty()
    }

    def "SERIES-006-AC-12: externalIds() returns the imdb_id field"() {
        given: "TMDB /tv/1396/external_ids returns an imdb_id"
            def body = '{"imdb_id":"tt0903747"}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/1396/external_ids")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.externalIds(1396) is called"
            def result = client().externalIds(1396)

        then: "the imdb_id is returned"
            result.get() == "tt0903747"
    }

    def "SERIES-006-AC-12: externalIds() returns empty when imdb_id is absent or blank"() {
        given: "TMDB /tv/1397/external_ids returns no imdb_id"
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/1397/external_ids")))
                .andRespond(withSuccess('{"imdb_id":""}', MediaType.APPLICATION_JSON))

        when: "TmdbClient.externalIds(1397) is called"
            def result = client().externalIds(1397)

        then: "no imdb_id is returned"
            result.isEmpty()
    }

    def "SERIES-006-AC-13: a failed TMDB call raises ExternalServiceException"() {
        given: "TMDB is unreachable"
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/1396/recommendations")))
                .andRespond(withServerError())

        when: "any TmdbClient method is called"
            client().recommendations(1396)

        then: "an ExternalServiceException is thrown"
            thrown(ExternalServiceException)
    }

    def "SERIES-006-AC-13: a network failure reaching TMDB raises ExternalServiceException"() {
        given: "the underlying request fails with an IOException, simulating a network error"
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/1396/similar")))
                .andRespond({ request -> throw new IOException("Connection refused") })

        when: "TmdbClient.similar(...) is called"
            client().similar(1396)

        then: "an ExternalServiceException is raised"
            thrown(ExternalServiceException)
    }

    def "SERIES-006-AC-13: an unset/blank API key raises ExternalServiceException without calling TMDB"() {
        when: "any TmdbClient method is called with no API key configured"
            client(apiKey).recommendations(1396)

        then: "an ExternalServiceException is raised, and no HTTP request is attempted"
            thrown(ExternalServiceException)

        where:
            apiKey << [null, "", "   "]
    }
}
