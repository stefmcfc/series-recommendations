package uk.co.stefirby.seriestracker.client

import uk.co.stefirby.seriestracker.exception.EntityNotFoundException
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
 * Unit tests for {@link OmdbClient}. Per SERIES-005's testing guidance, {@link OmdbClient}
 * is constructed directly (not via the Spring context) with a plain {@code RestClient.Builder}
 * bound to {@link MockRestServiceServer}, so no real network call is ever made and no real
 * OMDb API key is required.
 */
class OmdbClientSpec extends Specification {

    private static final String BASE_URL = "http://localhost/omdb-test"
    private static final String API_KEY = "test-api-key"

    RestClient.Builder builder
    MockRestServiceServer mockServer

    def setup() {
        builder = RestClient.builder()
        mockServer = MockRestServiceServer.bindTo(builder).build()
    }

    private OmdbClient client(String apiKey = API_KEY) {
        new OmdbClient(builder, apiKey, BASE_URL)
    }

    private static String episodesJson(int count) {
        def episodes = (1..count).collect { "{\"Episode\":\"${it}\"}" }.join(",")
        return "[${episodes}]"
    }

    def "SERIES-005-AC-10/AC-11: maps a full OMDb response, including all three rating sources and aggregated episodes"() {
        given: "OMDb responds with a fully-populated series, including a closed year range"
            def body = '''
                {
                  "Response": "True",
                  "Title": "Breaking Bad",
                  "Year": "2008–2013",
                  "Genre": "Crime, Drama, Thriller",
                  "totalSeasons": "5",
                  "imdbRating": "9.5",
                  "Ratings": [
                    {"Source":"Internet Movie Database","Value":"9.5/10"},
                    {"Source":"Rotten Tomatoes","Value":"96%"},
                    {"Source":"Metacritic","Value":"87/100"}
                  ],
                  "Poster": "https://example.com/poster.jpg"
                }
            '''
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("apikey", API_KEY))
                .andExpect(queryParam("type", "series"))
                .andExpect(queryParam("t", "Breaking%20Bad"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        and: "each of the 5 seasons resolves with a distinct episode count"
            [1, 2, 3, 4, 5].eachWithIndex { season, idx ->
                def count = idx + 1
                mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                    .andExpect(method(HttpMethod.GET))
                    .andExpect(queryParam("Season", season as String))
                    .andRespond(withSuccess(
                        "{\"Response\":\"True\",\"Episodes\":${episodesJson(count)}}",
                        MediaType.APPLICATION_JSON))
            }

        when: "OmdbClient.lookup('Breaking Bad') is called"
            def result = client().lookup("Breaking Bad")

        then: "every field is mapped and parsed correctly, including the summed episode count"
            result.title() == "Breaking Bad"
            result.year() == 2008
            result.genres() == "Crime, Drama, Thriller"
            result.totalSeasons() == 5
            result.totalEpisodes() == 15 // 1 + 2 + 3 + 4 + 5
            result.imdbRating() == 9.5
            result.rottenTomatoesRating() == 96
            result.metacriticRating() == 87
            result.posterUrl() == "https://example.com/poster.jpg"

        and:
            mockServer.verify()
    }

    def "SERIES-005-AC-10: extracts the first year from an open-ended year range"() {
        given: "OMDb responds with an ongoing series (open-ended Year range)"
            def body = '{"Response":"True","Title":"Ongoing Show","Year":"2019–","Genre":"Drama"}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "OmdbClient.lookup(...) is called"
            def result = client().lookup("Ongoing Show")

        then: "the year is the first 4-digit number in the range"
            result.year() == 2019
    }

    def "SERIES-005-AC-10: treats N/A as null for every field"() {
        given: "an OMDb response where imdbRating, totalSeasons, Poster, and Genre are all N/A"
            def body = '''
                {
                  "Response": "True",
                  "Title": "Obscure Show",
                  "Year": "N/A",
                  "Genre": "N/A",
                  "totalSeasons": "N/A",
                  "imdbRating": "N/A",
                  "Poster": "N/A"
                }
            '''
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "OmdbClient.lookup(...) is called"
            def result = client().lookup("Obscure Show")

        then: "N/A fields map to null, not the literal string, and totalEpisodes is null (no seasons to aggregate)"
            result.title() == "Obscure Show"
            result.year() == null
            result.genres() == null
            result.imdbRating() == null
            result.totalSeasons() == null
            result.totalEpisodes() == null
            result.posterUrl() == null
    }

    def "SERIES-005-AC-10: maps to null when a rating source is absent from the Ratings array"() {
        given: "an OMDb response with only an IMDb rating in the Ratings array"
            def body = '''
                {
                  "Response": "True",
                  "Title": "Partial Ratings Show",
                  "Ratings": [
                    {"Source":"Internet Movie Database","Value":"7.0/10"}
                  ]
                }
            '''
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "OmdbClient.lookup(...) is called"
            def result = client().lookup("Partial Ratings Show")

        then: "the missing sources map to null rather than raising an error"
            result.metacriticRating() == null
            result.rottenTomatoesRating() == null
    }

    def "SERIES-005-AC-09: Response=False raises a not-found outcome"() {
        given: "an OMDb response of Response=False"
            def body = '{"Response":"False","Error":"Series not found!"}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "OmdbClient.lookup('Nonexistent Show 12345') is called"
            client().lookup("Nonexistent Show 12345")

        then: "a not-found signal is raised, identifying the searched title"
            def ex = thrown(EntityNotFoundException)
            ex.message.contains("Nonexistent Show 12345")
    }

    def "SERIES-005-AC-11/12: aggregates episode counts across seasons, tolerating one failed season by degrading to null"() {
        given: "totalSeasons=3, with Season=1 and Season=3 succeeding and Season=2 failing"
            def body = '{"Response":"True","Title":"Some Show","totalSeasons":"3"}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andExpect(queryParam("t", "Some%20Show"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andExpect(queryParam("Season", "1"))
                .andRespond(withSuccess(
                    "{\"Response\":\"True\",\"Episodes\":${episodesJson(4)}}", MediaType.APPLICATION_JSON))
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andExpect(queryParam("Season", "2"))
                .andRespond(withServerError())
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andExpect(queryParam("Season", "3"))
                .andRespond(withSuccess(
                    "{\"Response\":\"True\",\"Episodes\":${episodesJson(6)}}", MediaType.APPLICATION_JSON))

        when: "OmdbClient.lookup(...) is called"
            def result = client().lookup("Some Show")

        then: "totalEpisodes is null because not every season could be summed, but the rest of the result is intact"
            result.totalEpisodes() == null
            result.title() != null
    }

    def "SERIES-005-AC-12: totalSeasons above the 30-season cap skips aggregation entirely (totalEpisodes null)"() {
        given: "an OMDb response reporting more seasons than the aggregation cap"
            def body = '{"Response":"True","Title":"Anomalous Show","totalSeasons":"31"}'
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))
        // Deliberately no Season=N expectations registered: if the cap logic is broken and
        // OmdbClient attempts a season call anyway, MockRestServiceServer raises an
        // AssertionError for the unmatched request, failing this test loudly.

        when: "OmdbClient.lookup(...) is called"
            def result = client().lookup("Anomalous Show")

        then: "the lookup still succeeds overall, with totalEpisodes null"
            result.title() == "Anomalous Show"
            result.totalSeasons() == 31
            result.totalEpisodes() == null
    }

    def "SERIES-005-AC-17: a non-2xx response from OMDb raises ExternalServiceException"() {
        given: "OMDb responds with a server error"
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andRespond(withServerError())

        when: "OmdbClient.lookup(...) is called"
            client().lookup("Any Show")

        then: "an ExternalServiceException is raised, not an EntityNotFoundException"
            thrown(ExternalServiceException)
    }

    def "SERIES-005-AC-17: a network failure reaching OMDb raises ExternalServiceException"() {
        given: "the underlying request fails with an IOException, simulating a network error"
            mockServer.expect(requestTo(org.hamcrest.Matchers.containsString(BASE_URL)))
                .andRespond({ request -> throw new IOException("Connection refused") })

        when: "OmdbClient.lookup(...) is called"
            client().lookup("Any Show")

        then: "an ExternalServiceException is raised"
            thrown(ExternalServiceException)
    }

    def "SERIES-005-AC-17: an unset/blank API key raises ExternalServiceException without calling OMDb"() {
        when: "OmdbClient.lookup(...) is called with no API key configured"
            client(apiKey).lookup("Any Show")

        then: "an ExternalServiceException is raised, and no HTTP request is attempted"
            thrown(ExternalServiceException)

        where:
            apiKey << [null, "", "   "]
    }
}
