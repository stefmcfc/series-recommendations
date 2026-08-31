package uk.co.stefirby.seriestracker.client.omdb

import org.hamcrest.Matchers
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.web.client.RestClient
import spock.lang.Specification
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException
import uk.co.stefirby.seriestracker.exception.ExternalServiceException

import static org.springframework.test.web.client.match.MockRestRequestMatchers.*
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess

/**
 * Unit tests for {@link OmdbClient}, narrowed by series_spec_017_tmdb_primary_lookup.md to
 * its single remaining method, {@link OmdbClient#ratingsForImdbId(String)}. Per SERIES-005's
 * testing guidance, {@link OmdbClient} is constructed directly (not via the Spring context)
 * with a plain {@code RestClient.Builder} bound to {@link MockRestServiceServer}, so no real
 * network call is ever made and no real OMDb API key is required.
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

    def "SERIES-017-AC-09: ratingsForImdbId parses only imdbRating and rottenTomatoesRating"() {
        given: "OMDb returns a full response for tt0160904, including a Ratings array"
            def body = '''
                {
                  "Response": "True",
                  "Title": "Spooks",
                  "imdbRating": "8.3",
                  "Ratings": [
                    {"Source":"Internet Movie Database","Value":"8.3/10"},
                    {"Source":"Metacritic","Value":"75/100"}
                  ],
                  "imdbID": "tt0160904"
                }
            '''
            mockServer.expect(requestTo(Matchers.containsString(BASE_URL)))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("apikey", API_KEY))
                .andExpect(queryParam("type", "series"))
                .andExpect(queryParam("i", "tt0160904"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "ratingsForImdbId(\"tt0160904\") is called"
            def result = client().ratingsForImdbId("tt0160904")

        then: "only the two rating fields are populated, Metacritic is not parsed"
            result.imdbRating() == new BigDecimal("8.3")
            result.rottenTomatoesRating() == null

        and:
            mockServer.verify()
    }

    def "SERIES-017-AC-09: maps a populated Rotten Tomatoes rating from the Ratings array"() {
        given: "an OMDb response including a Rotten Tomatoes entry"
            def body = '''
                {
                  "Response": "True",
                  "Title": "Some Show",
                  "imdbRating": "7.0",
                  "Ratings": [
                    {"Source":"Rotten Tomatoes","Value":"96%"}
                  ]
                }
            '''
            mockServer.expect(requestTo(Matchers.containsString(BASE_URL)))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "ratingsForImdbId(...) is called"
            def result = client().ratingsForImdbId("tt0000000")

        then: "the percentage is parsed to a plain integer"
            result.rottenTomatoesRating() == 96
    }

    def "SERIES-017-AC-09: treats N/A imdbRating as null"() {
        given: "an OMDb response with imdbRating: N/A"
            def body = '{"Response":"True","Title":"Obscure Show","imdbRating":"N/A"}'
            mockServer.expect(requestTo(Matchers.containsString(BASE_URL)))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "ratingsForImdbId(...) is called"
            def result = client().ratingsForImdbId("tt0000000")

        then: "imdbRating is null, not a parse failure"
            result.imdbRating() == null
    }

    def "SERIES-017-AC-09: Response=False raises a not-found outcome identifying the imdbId"() {
        given: "an OMDb response of Response=False"
            def body = '{"Response":"False","Error":"Incorrect IMDb ID."}'
            mockServer.expect(requestTo(Matchers.containsString(BASE_URL)))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "ratingsForImdbId('tt9999999') is called"
            client().ratingsForImdbId("tt9999999")

        then: "a not-found signal is raised, identifying the searched imdbId"
            def ex = thrown(EntityNotFoundException)
            ex.message.contains("tt9999999")
    }

    def "SERIES-017-AC-09: a non-2xx response from OMDb raises ExternalServiceException"() {
        given: "OMDb responds with a server error"
            mockServer.expect(requestTo(Matchers.containsString(BASE_URL)))
                .andRespond(withServerError())

        when: "ratingsForImdbId(...) is called"
            client().ratingsForImdbId("tt0160904")

        then: "an ExternalServiceException is raised, not an EntityNotFoundException"
            thrown(ExternalServiceException)
    }

    def "SERIES-017-AC-09: a network failure reaching OMDb raises ExternalServiceException"() {
        given: "the underlying request fails with an IOException, simulating a network error"
            mockServer.expect(requestTo(Matchers.containsString(BASE_URL)))
                .andRespond({ request -> throw new IOException("Connection refused") })

        when: "ratingsForImdbId(...) is called"
            client().ratingsForImdbId("tt0160904")

        then: "an ExternalServiceException is raised"
            thrown(ExternalServiceException)
    }

    def "SERIES-017-AC-09: an unset/blank API key raises ExternalServiceException without calling OMDb"() {
        when: "ratingsForImdbId(...) is called with no API key configured"
            client(apiKey).ratingsForImdbId("tt0160904")

        then: "an ExternalServiceException is raised, and no HTTP request is attempted"
            thrown(ExternalServiceException)

        where:
            apiKey << [null, "", "   "]
    }
}
