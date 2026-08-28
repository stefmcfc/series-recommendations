package uk.co.stefirby.seriestracker.client

import org.hamcrest.Matchers
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.web.client.RestClient
import spock.lang.Specification
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import uk.co.stefirby.seriestracker.model.ProductionStatus

import static org.springframework.test.web.client.match.MockRestRequestMatchers.*
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
            mockServer.expect(requestTo(Matchers.containsString("find/tt0903747")))
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
            mockServer.expect(requestTo(Matchers.containsString("find/tt9999999")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.findTvIdByImdbId('tt9999999') is called"
            def result = client().findTvIdByImdbId("tt9999999")

        then: "no id is returned"
            result.isEmpty()
    }

    def "SERIES-006-AC-08: returns empty when tv_results is absent"() {
        given: "TMDB /find returns a body with no tv_results field at all"
            def body = '{}'
            mockServer.expect(requestTo(Matchers.containsString("find/tt0000000")))
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
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/recommendations")))
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
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/recommendations")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.recommendations(1396) is called"
            def result = client().recommendations(1396)

        then: "voteCount and originalLanguage are mapped"
            result[0].voteCount() == 1500
            result[0].originalLanguage() == "en"
    }

    def "SERIES-023-AC-01: recommendations() maps origin_country's first entry onto TmdbCandidate"() {
        given: "a TMDB recommendations response with an origin_country array"
            def body = '{"results": [{"id": 2, "name": "Show", "origin_country": ["US"]}]}'
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/recommendations")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "recommendations(1396) is called"
            def results = client().recommendations(1396)

        then: "originCountry is the array's first entry"
            results[0].originCountry() == "US"
    }

    def "SERIES-023-AC-01: an absent origin_country maps to a null originCountry on TmdbCandidate"() {
        given: "a TMDB recommendations result with no origin_country field"
            def body = '{"results": [{"id": 2, "name": "Show"}]}'
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/recommendations")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "recommendations(1396) is called"
            def results = client().recommendations(1396)

        then: "originCountry is null"
            results[0].originCountry() == null
    }

    def "SERIES-007-AC-23: vote_count/original_language are null when absent"() {
        given: "TMDB /tv/1396/recommendations returns a result with neither field"
            def body = '{"results":[{"id":2316,"name":"The Office"}]}'
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/recommendations")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.recommendations(1396) is called"
            def result = client().recommendations(1396)

        then: "both fields are null"
            result[0].voteCount() == null
            result[0].originalLanguage() == null
    }

    def "SERIES-006-AC-09: an absent results array maps to an empty list"() {
        given: "TMDB returns a body with no results field"
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/recommendations")))
                .andRespond(withSuccess('{}', MediaType.APPLICATION_JSON))

        when: "TmdbClient.recommendations(1396) is called"
            def result = client().recommendations(1396)

        then: "an empty list is returned"
            result.isEmpty()
    }

    def "SERIES-006-AC-10: similar() calls /tv/{id}/similar, mapped the same way"() {
        given: "TMDB /tv/1396/similar returns one result"
            def body = '{"results":[{"id":42,"name":"Better Call Saul","first_air_date":"2015-02-08","vote_average":8.8,"genre_ids":[18,80]}]}'
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/similar")))
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
            mockServer.expect(requestTo(Matchers.containsString("discover/tv")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("with_genres", "18,80"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.discover([18, 80], [], 'popularity.desc', DiscoverFilters.NONE) is called"
            def result = client().discover([18, 80], [], "popularity.desc", DiscoverFilters.NONE)

        then: "with_genres is sent and with_keywords is omitted; the result is mapped to a TmdbCandidate"
            result.size() == 1
            result[0].tmdbId() == 99
    }

    def "SERIES-007-AC-06: discover() sends both with_genres and with_keywords when both are provided"() {
        given: "a mocked TMDB server expecting GET /discover/tv?with_genres=18&with_keywords=9720"
            def body = '{"results":[{"id":100,"name":"Spy Show"}]}'
            mockServer.expect(requestTo(Matchers.containsString("discover/tv")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("with_genres", "18"))
                .andExpect(queryParam("with_keywords", "9720"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.discover([18], [9720], 'popularity.desc', DiscoverFilters.NONE) is called"
            def result = client().discover([18], [9720], "popularity.desc", DiscoverFilters.NONE)

        then: "the expected request was made and the result is mapped"
            result.size() == 1
            result[0].tmdbId() == 100
    }

    def "SERIES-007-AC-06: discover() omits with_genres when genreIds is empty, sending only with_keywords"() {
        given: "TMDB /discover/tv returns one result"
            def body = '{"results":[{"id":101,"name":"Keyword-only Show"}]}'
            mockServer.expect(requestTo(Matchers.containsString("discover/tv")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("with_keywords", "9720"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.discover([], [9720], 'popularity.desc', DiscoverFilters.NONE) is called"
            def result = client().discover([], [9720], "popularity.desc", DiscoverFilters.NONE)

        then: "the result is mapped"
            result.size() == 1
            result[0].tmdbId() == 101
    }

    def "SERIES-029-AC-06: discover sends vote_count.gte only when minVoteCount is positive"() {
        given: "TMDB /discover/tv returns one result"
            def body = '{"results":[{"id":18,"name":"Crime Show"}]}'
            mockServer.expect(requestTo(Matchers.containsString("discover/tv")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("vote_count.gte", "200"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "discover is called with minVoteCount=200"
            def result = client().discover([18], [], "vote_average.desc", new DiscoverFilters(200, null, null, null))

        then: "the request included vote_count.gte=200, and the result is mapped"
            result.size() == 1
    }

    def "SERIES-029-AC-06: discover omits vote_count.gte entirely when minVoteCount is 0"() {
        given: "TMDB /discover/tv returns one result, and the mocked request asserts vote_count.gte is absent"
            def body = '{"results":[{"id":28,"name":"Action Show"}]}'
            mockServer.expect(requestTo(Matchers.allOf(
                Matchers.containsString("discover/tv"),
                Matchers.not(Matchers.containsString("vote_count.gte")))))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "discover is called with minVoteCount=0"
            def result = client().discover([28], [], "popularity.desc", DiscoverFilters.NONE)

        then: "no vote_count.gte param was sent, and the result is mapped"
            result.size() == 1
    }

    // -- SERIES-031: DiscoverFilters -- minTmdbRating/yearMin/yearMax sent as real discover/tv params --

    def "SERIES-031-AC-01: sends vote_average.gte when minTmdbRating is set"() {
        given: "a mocked TMDB response"
            mockServer.expect(requestTo(Matchers.containsString("vote_average.gte=7.5")))
                .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

        when: "discover is called with minTmdbRating=7.5"
            client().discover([35], [], "popularity.desc", new DiscoverFilters(0, new BigDecimal("7.5"), null, null))

        then: "the request included vote_average.gte=7.5"
            mockServer.verify()
    }

    def "SERIES-031-AC-01: omits vote_average.gte when minTmdbRating is null"() {
        given: "a mocked TMDB response"
            mockServer.expect(requestTo(Matchers.not(Matchers.containsString("vote_average.gte"))))
                .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

        when: "discover is called with no minTmdbRating"
            client().discover([35], [], "popularity.desc", DiscoverFilters.NONE)

        then: "no vote_average.gte param was sent"
            mockServer.verify()
    }

    def "SERIES-031-AC-02: sends air_date.gte formatted as yearMin-01-01"() {
        given: "a mocked TMDB response"
            mockServer.expect(requestTo(Matchers.containsString("air_date.gte=2020-01-01")))
                .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

        when: "discover is called with yearMin=2020"
            client().discover([35], [], "popularity.desc", new DiscoverFilters(0, null, 2020, null))

        then: "the request included air_date.gte=2020-01-01"
            mockServer.verify()
    }

    def "SERIES-031-AC-02: omits air_date.gte when yearMin is null"() {
        given: "a mocked TMDB response"
            mockServer.expect(requestTo(Matchers.not(Matchers.containsString("air_date.gte"))))
                .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

        when: "discover is called with no yearMin"
            client().discover([35], [], "popularity.desc", DiscoverFilters.NONE)

        then: "no air_date.gte param was sent"
            mockServer.verify()
    }

    def "SERIES-031-AC-03: sends air_date.lte formatted as yearMax-12-31"() {
        given: "a mocked TMDB response"
            mockServer.expect(requestTo(Matchers.containsString("air_date.lte=2024-12-31")))
                .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

        when: "discover is called with yearMax=2024"
            client().discover([35], [], "popularity.desc", new DiscoverFilters(0, null, null, 2024))

        then: "the request included air_date.lte=2024-12-31"
            mockServer.verify()
    }

    def "SERIES-031-AC-03: omits air_date.lte when yearMax is null"() {
        given: "a mocked TMDB response"
            mockServer.expect(requestTo(Matchers.not(Matchers.containsString("air_date.lte"))))
                .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

        when: "discover is called with no yearMax"
            client().discover([35], [], "popularity.desc", DiscoverFilters.NONE)

        then: "no air_date.lte param was sent"
            mockServer.verify()
    }

    def "SERIES-031-AC-04: vote_count.gte behavior is unchanged by the DiscoverFilters refactor"() {
        given: "a mocked TMDB response"
            mockServer.expect(requestTo(Matchers.containsString("vote_count.gte=200")))
                .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

        when: "discover is called with minVoteCount=200"
            client().discover([35], [], "popularity.desc", new DiscoverFilters(200, null, null, null))

        then: "the request included vote_count.gte=200, unchanged from before this spec"
            mockServer.verify()
    }

    def "SERIES-031-AC-01/02/03: all three new filters can be sent together on the same call"() {
        given: "a mocked TMDB response asserting all three params are present at once"
            mockServer.expect(requestTo(Matchers.allOf(
                Matchers.containsString("vote_average.gte=7.5"),
                Matchers.containsString("air_date.gte=2020-01-01"),
                Matchers.containsString("air_date.lte=2024-12-31"))))
                .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

        when: "discover is called with minTmdbRating, yearMin and yearMax all set"
            client().discover([35], [], "popularity.desc",
                new DiscoverFilters(0, new BigDecimal("7.5"), 2020, 2024))

        then: "all three params were sent on the same request"
            mockServer.verify()
    }

    def "SERIES-007-AC-05: resolves a keyword name to a TMDB keyword id"() {
        given: "TMDB /search/keyword?query=spy returns one result with id 9720"
            def body = '{"results":[{"id":9720,"name":"spy"}]}'
            mockServer.expect(requestTo(Matchers.containsString("search/keyword")))
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
            mockServer.expect(requestTo(Matchers.containsString("search/keyword")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.searchKeyword('nonexistent') is called"
            def result = client().searchKeyword("nonexistent")

        then: "no keyword id is returned"
            result.isEmpty()
    }

    def "SERIES-007-AC-05: returns empty when /search/keyword results is absent"() {
        given: "TMDB /search/keyword returns a body with no results field"
            mockServer.expect(requestTo(Matchers.containsString("search/keyword")))
                .andRespond(withSuccess('{}', MediaType.APPLICATION_JSON))

        when: "TmdbClient.searchKeyword('spy') is called"
            def result = client().searchKeyword("spy")

        then: "no keyword id is returned"
            result.isEmpty()
    }

    def "SERIES-006-AC-12: externalIds() returns the imdb_id field"() {
        given: "TMDB /tv/1396/external_ids returns an imdb_id"
            def body = '{"imdb_id":"tt0903747"}'
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/external_ids")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.externalIds(1396) is called"
            def result = client().externalIds(1396)

        then: "the imdb_id is returned"
            result.get() == "tt0903747"
    }

    def "SERIES-006-AC-12: externalIds() returns empty when imdb_id is absent or blank"() {
        given: "TMDB /tv/1397/external_ids returns no imdb_id"
            mockServer.expect(requestTo(Matchers.containsString("tv/1397/external_ids")))
                .andRespond(withSuccess('{"imdb_id":""}', MediaType.APPLICATION_JSON))

        when: "TmdbClient.externalIds(1397) is called"
            def result = client().externalIds(1397)

        then: "no imdb_id is returned"
            result.isEmpty()
    }

    def "SERIES-006-AC-13: a failed TMDB call raises ExternalServiceException"() {
        given: "TMDB is unreachable"
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/recommendations")))
                .andRespond(withServerError())

        when: "any TmdbClient method is called"
            client().recommendations(1396)

        then: "an ExternalServiceException is thrown"
            thrown(ExternalServiceException)
    }

    def "SERIES-006-AC-13: a network failure reaching TMDB raises ExternalServiceException"() {
        given: "the underlying request fails with an IOException, simulating a network error"
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/similar")))
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

    def "SERIES-012-AC-01: exposes the poster base URL as a public static final constant"() {
        expect:
            TmdbClient.POSTER_BASE_URL == "https://image.tmdb.org/t/p/w500"
    }

    def "SERIES-012-AC-03/04/05: search maps every entry of results[] onto TmdbSearchCandidate, omitting a redundant originalTitle"() {
        given: "TMDB responds to a search with two results, one with a differing original_name"
            def body = '''
                {
                  "results": [
                    {"id": 4046, "name": "Spooks", "original_name": "Spooks",
                     "first_air_date": "2002-05-13", "poster_path": "/spooks.jpg",
                     "genre_ids": [10759, 18]},
                    {"id": 65327, "name": "Money Heist", "original_name": "La Casa de Papel",
                     "first_air_date": "2017-05-02", "poster_path": null, "genre_ids": []}
                  ]
                }
            '''
            mockServer.expect(requestTo(Matchers.containsString("search/tv")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("query", "Spooks"))
                .andExpect(queryParam("api_key", API_KEY))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.search('Spooks') is called"
            def result = client().search("Spooks")

        then: "both entries are mapped, originalTitle omitted only when identical to title"
            result.size() == 2
            result[0].tmdbId() == 4046
            result[0].title() == "Spooks"
            result[0].originalTitle() == null
            result[0].year() == 2002
            result[0].posterPath() == "/spooks.jpg"
            result[0].genreIds() == [10759, 18]
            result[1].tmdbId() == 65327
            result[1].title() == "Money Heist"
            result[1].originalTitle() == "La Casa de Papel"
            result[1].posterPath() == null
    }

    def "SERIES-021-AC-01: search maps origin_country's first entry onto TmdbSearchCandidate"() {
        given: "TMDB search results include an origin_country array"
            def body = '{"results": [{"id": 2996, "name": "The Office", "origin_country": ["GB"]}]}'
            mockServer.expect(requestTo(Matchers.containsString("search/tv")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "search('The Office') is called"
            def results = client().search("The Office")

        then: "originCountry is the array's first entry"
            results[0].originCountry() == "GB"
    }

    def "SERIES-021-AC-01: an absent origin_country maps to a null originCountry"() {
        given: "a TMDB search result with no origin_country field"
            def body = '{"results": [{"id": 1, "name": "Show"}]}'
            mockServer.expect(requestTo(Matchers.containsString("search/tv")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "search('Show') is called"
            def results = client().search("Show")

        then: "originCountry is null"
            results[0].originCountry() == null
    }

    def "SERIES-012-AC-06: an absent or empty results array maps to an empty list, no exception"() {
        given: "TMDB responds with no matches"
            mockServer.expect(requestTo(Matchers.containsString("search/tv")))
                .andRespond(withSuccess('{"results":[]}', MediaType.APPLICATION_JSON))

        when: "TmdbClient.search(...) is called"
            def result = client().search("Nonexistent Show 12345")

        then: "the result is an empty list, no exception is thrown"
            result == []
    }

    def "SERIES-012-AC-07: a non-2xx response from TMDB search raises ExternalServiceException"() {
        given: "TMDB responds with a server error"
            mockServer.expect(requestTo(Matchers.containsString("search/tv")))
                .andRespond(withServerError())

        when: "TmdbClient.search(...) is called"
            client().search("Any Show")

        then: "an ExternalServiceException is raised"
            thrown(ExternalServiceException)
    }

    def "SERIES-012-AC-08/09 / SERIES-017-AC-11 / SERIES-018-AC-02: details maps /tv/{id}, extracting genre ids from the {id,name} object array shape, vote_average/vote_count, and productionStatus"() {
        given: "TMDB responds to /tv/4046 with the full detail shape"
            def body = '''
                {
                  "name": "Spooks",
                  "first_air_date": "2002-05-13",
                  "genres": [{"id": 10759, "name": "Action & Adventure"}, {"id": 18, "name": "Drama"}],
                  "poster_path": "/spooks.jpg",
                  "number_of_seasons": 10,
                  "number_of_episodes": 108,
                  "vote_average": 7.8,
                  "vote_count": 245,
                  "status": "Ended"
                }
            '''
            mockServer.expect(requestTo(Matchers.containsString("tv/4046")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("api_key", API_KEY))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.details(4046) is called"
            def result = client().details(4046)

        then: "every field is mapped, genreIds extracted from the genres[].id shape, not a flat array"
            result.title() == "Spooks"
            result.year() == 2002
            result.genreIds() == [10759, 18]
            result.posterPath() == "/spooks.jpg"
            result.numberOfSeasons() == 10
            result.numberOfEpisodes() == 108
            result.voteAverage() == 7.8
            result.voteCount() == 245
            result.productionStatus() == ProductionStatus.ENDED
    }

    def "SERIES-017-AC-11: details maps absent vote_average/vote_count to null"() {
        given: "TMDB responds to /tv/4047 with no vote fields"
            def body = '{"name":"Obscure Show","number_of_seasons":1,"number_of_episodes":6}'
            mockServer.expect(requestTo(Matchers.containsString("tv/4047")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.details(4047) is called"
            def result = client().details(4047)

        then: "both vote fields are null"
            result.voteAverage() == null
            result.voteCount() == null
    }

    def "SERIES-018-AC-02: details maps an absent or unrecognized status field to a null productionStatus"() {
        given: "TMDB responds to /tv/4048 with no status field"
            def body = '{"name":"Obscure Show","number_of_seasons":1,"number_of_episodes":6}'
            mockServer.expect(requestTo(Matchers.containsString("tv/4048")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.details(4048) is called"
            def result = client().details(4048)

        then: "productionStatus is null, not an error"
            result.productionStatus() == null
    }

    def "SERIES-021-AC-02: details maps origin_country's first entry onto TmdbSeriesDetail"() {
        given: "a TMDB detail response with an origin_country array"
            def body = '{"name": "The Office", "origin_country": ["GB"], "genres": []}'
            mockServer.expect(requestTo(Matchers.containsString("tv/2996")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "details(2996) is called"
            def result = client().details(2996)

        then: "originCountry is the array's first entry"
            result.originCountry() == "GB"
    }

    def "SERIES-021-AC-02: an absent origin_country maps to a null originCountry on TmdbSeriesDetail"() {
        given: "a TMDB detail response with no origin_country field"
            def body = '{"name": "Obscure Show", "genres": []}'
            mockServer.expect(requestTo(Matchers.containsString("tv/2997")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "details(2997) is called"
            def result = client().details(2997)

        then: "originCountry is null"
            result.originCountry() == null
    }

    def "SERIES-023-AC-08: details maps overview onto TmdbSeriesDetail"() {
        given: "a TMDB detail response with an overview field"
            def body = '{"name": "The Office", "overview": "A mockumentary sitcom.", "genres": []}'
            mockServer.expect(requestTo(Matchers.containsString("tv/2998")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "details(2998) is called"
            def result = client().details(2998)

        then: "overview is parsed"
            result.overview() == "A mockumentary sitcom."
    }

    def "SERIES-023-AC-08: an absent overview maps to null on TmdbSeriesDetail"() {
        given: "a TMDB detail response with no overview field"
            def body = '{"name": "Obscure Show", "genres": []}'
            mockServer.expect(requestTo(Matchers.containsString("tv/2999")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "details(2999) is called"
            def result = client().details(2999)

        then: "overview is null"
            result.overview() == null
    }

    def "SERIES-012-AC-10: a non-2xx response from TMDB details raises ExternalServiceException"() {
        given: "TMDB responds with a server error"
            mockServer.expect(requestTo(Matchers.containsString("tv/4046")))
                .andRespond(withServerError())

        when: "TmdbClient.details(...) is called"
            client().details(4046)

        then: "an ExternalServiceException is raised"
            thrown(ExternalServiceException)
    }

    def "SERIES-008-AC-08: showStatus maps TMDB's status field to ProductionStatus"() {
        given: "TMDB /tv/1396 returns status: 'Ended'"
            def body = '{"status":"Ended"}'
            mockServer.expect(requestTo(Matchers.containsString("tv/1396")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("api_key", API_KEY))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.showStatus(1396) is called"
            def result = client().showStatus(1396)

        then: "ProductionStatus.ENDED is returned"
            result.get() == ProductionStatus.ENDED
    }

    def "SERIES-008-AC-08: an unrecognized status value returns empty, not an error"() {
        given: "TMDB /tv/1397 returns a status value with no matching ProductionStatus constant"
            def body = '{"status":"SomeNewValueTmdbAddedLater"}'
            mockServer.expect(requestTo(Matchers.containsString("tv/1397")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.showStatus(1397) is called"
            def result = client().showStatus(1397)

        then: "no exception is thrown, and the result is empty"
            result.isEmpty()
    }

    def "SERIES-008-AC-08: an absent status field returns empty, not an error"() {
        given: "TMDB /tv/1398 returns a body with no status field"
            mockServer.expect(requestTo(Matchers.containsString("tv/1398")))
                .andRespond(withSuccess('{}', MediaType.APPLICATION_JSON))

        when: "TmdbClient.showStatus(1398) is called"
            def result = client().showStatus(1398)

        then: "the result is empty"
            result.isEmpty()
    }

    def "SERIES-008-AC-08: a non-2xx response from TMDB raises ExternalServiceException"() {
        given: "TMDB responds with a server error"
            mockServer.expect(requestTo(Matchers.containsString("tv/1396")))
                .andRespond(withServerError())

        when: "TmdbClient.showStatus(...) is called"
            client().showStatus(1396)

        then: "an ExternalServiceException is raised"
            thrown(ExternalServiceException)
    }

    def "SERIES-019-AC-05: showKeywords maps each results[] entry onto TmdbKeyword"() {
        given: "TMDB /tv/4046/keywords returns two keywords"
            def body = '{"id":4046,"results":[{"id":470,"name":"spy"},{"id":190904,"name":"mi5"}]}'
            mockServer.expect(requestTo(Matchers.containsString("tv/4046/keywords")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("api_key", API_KEY))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.showKeywords(4046) is called"
            def result = client().showKeywords(4046)

        then: "each result is mapped to a TmdbKeyword"
            result.size() == 2
            result[0].id() == 470
            result[0].name() == "spy"
            result[1].id() == 190904
            result[1].name() == "mi5"
    }

    def "SERIES-019-AC-06: an absent results array maps to an empty list, not an error"() {
        given: "TMDB responds with no results field"
            mockServer.expect(requestTo(Matchers.containsString("tv/4046/keywords")))
                .andRespond(withSuccess('{}', MediaType.APPLICATION_JSON))

        when: "TmdbClient.showKeywords(4046) is called"
            def result = client().showKeywords(4046)

        then: "an empty list is returned"
            result == []
    }

    def "SERIES-019-AC-06: a malformed results entry (no id) is skipped, not an error"() {
        given: "TMDB responds with one valid and one malformed entry"
            def body = '{"results":[{"id":470,"name":"spy"},{"name":"missing id"}]}'
            mockServer.expect(requestTo(Matchers.containsString("tv/4046/keywords")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.showKeywords(4046) is called"
            def result = client().showKeywords(4046)

        then: "only the valid entry is mapped"
            result.size() == 1
            result[0].id() == 470
    }

    def "SERIES-019-AC-07: a non-2xx response from TMDB keywords raises ExternalServiceException"() {
        given: "TMDB responds with a server error"
            mockServer.expect(requestTo(Matchers.containsString("tv/4046/keywords")))
                .andRespond(withServerError())

        when: "TmdbClient.showKeywords(...) is called"
            client().showKeywords(4046)

        then: "an ExternalServiceException is raised"
            thrown(ExternalServiceException)
    }

    // -- SERIES-022: trending() / discoverTopRated() --

    def "SERIES-022-AC-01: trending() maps TMDB's trending/tv response to TmdbCandidate, preserving order"() {
        given: "TMDB GET /trending/tv/week returns two results"
            def body = '''
                {
                  "results": [
                    {"id": 95350, "name": "Lanterns", "first_air_date": "2026-08-16",
                     "overview": "Two intergalactic cops.", "poster_path": "/lanterns.jpg",
                     "vote_average": 8.166, "genre_ids": [18, 9648], "vote_count": 145,
                     "original_language": "en"},
                    {"id": 125988, "name": "Silo", "first_air_date": "2023-05-04",
                     "overview": "A giant silo underground.", "poster_path": "/silo.jpg",
                     "vote_average": 8.191, "genre_ids": [10765, 18], "vote_count": 2484,
                     "original_language": "en"}
                  ]
                }
            '''
            mockServer.expect(requestTo(Matchers.containsString("trending/tv/week")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("api_key", API_KEY))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.trending('week') is called"
            def result = client().trending("week")

        then: "both candidates are mapped, in the returned order"
            result.size() == 2
            result[0].tmdbId() == 95350
            result[0].title() == "Lanterns"
            result[0].voteCount() == 145
            result[1].tmdbId() == 125988
            result[1].title() == "Silo"
    }

    def "SERIES-022-AC-01: trending() calls /trending/tv/day when timeWindow is 'day'"() {
        given: "TMDB GET /trending/tv/day returns one result"
            def body = '{"results":[{"id":1,"name":"Daily Show"}]}'
            mockServer.expect(requestTo(Matchers.containsString("trending/tv/day")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.trending('day') is called"
            def result = client().trending("day")

        then: "the result is mapped"
            result.size() == 1
    }

    def "SERIES-022-AC-02: an invalid timeWindow is rejected before any TMDB call"() {
        when: "TmdbClient.trending('month') is called"
            client().trending("month")

        then: "an IllegalArgumentException is thrown, and no TMDB call is made"
            thrown(IllegalArgumentException)
    }

    def "SERIES-022-AC-02: a null timeWindow is rejected before any TMDB call"() {
        when: "TmdbClient.trending(null) is called"
            client().trending(null)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-022-AC-03: discoverTopRated() sends sort_by=vote_average.desc and vote_count.gte"() {
        given: "a mocked TMDB server expecting GET /discover/tv?sort_by=vote_average.desc&vote_count.gte=100"
            def body = '{"results":[{"id":238754,"name":"The Loyal Pin","vote_average":9.648,"vote_count":105}]}'
            mockServer.expect(requestTo(Matchers.containsString("discover/tv")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("sort_by", "vote_average.desc"))
                .andExpect(queryParam("vote_count.gte", "100"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "TmdbClient.discoverTopRated(100, 'vote_average.desc') is called"
            def result = client().discoverTopRated(100, "vote_average.desc")

        then: "the expected request was made and the result mapped"
            result.size() == 1
            result[0].tmdbId() == 238754
            result[0].title() == "The Loyal Pin"
    }

    def "SERIES-022-AC-05: an absent results array maps trending() to an empty list, not an error"() {
        given: "TMDB returns a body with no results field"
            mockServer.expect(requestTo(Matchers.containsString("trending/tv/week")))
                .andRespond(withSuccess('{}', MediaType.APPLICATION_JSON))

        when: "TmdbClient.trending('week') is called"
            def result = client().trending("week")

        then: "an empty list is returned"
            result == []
    }

    def "SERIES-022-AC-05: a failed trending() call raises ExternalServiceException"() {
        given: "TMDB is unreachable"
            mockServer.expect(requestTo(Matchers.containsString("trending/tv/week")))
                .andRespond(withServerError())

        when: "TmdbClient.trending('week') is called"
            client().trending("week")

        then: "an ExternalServiceException is thrown"
            thrown(ExternalServiceException)
    }

    def "SERIES-022-AC-05: a failed discoverTopRated() call raises ExternalServiceException"() {
        given: "TMDB is unreachable"
            mockServer.expect(requestTo(Matchers.containsString("discover/tv")))
                .andRespond(withServerError())

        when: "TmdbClient.discoverTopRated(20, 'vote_average.desc') is called"
            client().discoverTopRated(20, "vote_average.desc")

        then: "an ExternalServiceException is thrown"
            thrown(ExternalServiceException)
    }

    // -- SERIES-025: TMDB-native sort_by on discover()/discoverTopRated() --

    def "SERIES-025-AC-01: discover() sends sort_by as a query parameter"() {
        given: "TMDB /discover/tv returns one result"
            def body = '{"results":[{"id":28,"name":"Action Show"}]}'
            mockServer.expect(requestTo(Matchers.containsString("discover/tv")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("with_genres", "28"))
                .andExpect(queryParam("sort_by", "popularity.desc"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "discover is called with a sortBy value"
            def result = client().discover([28], [], "popularity.desc", DiscoverFilters.NONE)

        then: "the request includes sort_by=popularity.desc, and the result is mapped"
            result.size() == 1
            result[0].tmdbId() == 28
    }

    def "SERIES-025-AC-02: discoverTopRated() sends the given sortBy, not a hardcoded value"() {
        given: "TMDB /discover/tv returns one result"
            def body = '{"results":[{"id":238754,"name":"The Loyal Pin"}]}'
            mockServer.expect(requestTo(Matchers.containsString("discover/tv")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("sort_by", "popularity.desc"))
                .andExpect(queryParam("vote_count.gte", "200"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "discoverTopRated is called with sortBy=popularity.desc"
            def result = client().discoverTopRated(200, "popularity.desc")

        then: "the request's sort_by is popularity.desc, not vote_average.desc"
            result.size() == 1
            result[0].tmdbId() == 238754
    }

    // -- SERIES-020: watchProviders() --

    def "SERIES-020-AC-01: extracts flatrate providers for the given region"() {
        given: "TMDB /tv/1396/watch/providers returns GB flatrate results"
            def body = '''
                {
                  "results": {
                    "GB": {
                      "flatrate": [
                        {"provider_name": "Netflix", "logo_path": "/abc.jpg"}
                      ]
                    }
                  }
                }
            '''
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/watch/providers")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("api_key", API_KEY))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "watchProviders(1396, 'GB') is called"
            def result = client().watchProviders(1396, "GB")

        then: "the Netflix entry is mapped"
            result == [new TmdbWatchProvider("Netflix", "/abc.jpg")]
    }

    def "SERIES-020-AC-02: no entry for the region returns an empty list, not an error"() {
        given: "TMDB /tv/1396/watch/providers returns results with no GB key"
            def body = '{"results": {"US": {"flatrate": [{"provider_name": "Hulu", "logo_path": "/hulu.jpg"}]}}}'
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/watch/providers")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "watchProviders(1396, 'GB') is called"
            def result = client().watchProviders(1396, "GB")

        then: "the result is empty"
            result == []
    }

    def "SERIES-020-AC-02: an absent results field returns an empty list, not an error"() {
        given: "TMDB /tv/1396/watch/providers returns no results field"
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/watch/providers")))
                .andRespond(withSuccess('{}', MediaType.APPLICATION_JSON))

        when: "watchProviders(1396, 'GB') is called"
            def result = client().watchProviders(1396, "GB")

        then: "the result is empty"
            result == []
    }

    def "SERIES-020-AC-02: a region entry with no flatrate array returns an empty list, not an error"() {
        given: "TMDB /tv/1396/watch/providers returns a GB entry with only a rent array"
            def body = '{"results": {"GB": {"rent": [{"provider_name": "Amazon Video", "logo_path": "/amazon.jpg"}]}}}'
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/watch/providers")))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

        when: "watchProviders(1396, 'GB') is called"
            def result = client().watchProviders(1396, "GB")

        then: "the result is empty -- only flatrate is surfaced"
            result == []
    }

    def "SERIES-020-AC-03: exposes the provider logo base URL as a public static final constant"() {
        expect:
            TmdbClient.PROVIDER_LOGO_BASE_URL == "https://image.tmdb.org/t/p/w92"
    }

    def "SERIES-020-AC-04: a non-2xx response from TMDB watch/providers raises ExternalServiceException"() {
        given: "TMDB responds with a server error"
            mockServer.expect(requestTo(Matchers.containsString("tv/1396/watch/providers")))
                .andRespond(withServerError())

        when: "watchProviders(...) is called"
            client().watchProviders(1396, "GB")

        then: "an ExternalServiceException is raised"
            thrown(ExternalServiceException)
    }

    def "SERIES-020-AC-04: an unset/blank API key raises ExternalServiceException without calling TMDB"() {
        when: "watchProviders(...) is called with no API key configured"
            client(apiKey).watchProviders(1396, "GB")

        then: "an ExternalServiceException is raised, and no HTTP request is attempted"
            thrown(ExternalServiceException)

        where:
            apiKey << [null, "", "   "]
    }
}
