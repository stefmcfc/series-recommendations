package uk.co.stefirby.seriestracker.service

import uk.co.stefirby.seriestracker.client.OmdbClient
import uk.co.stefirby.seriestracker.client.OmdbLookupResult
import uk.co.stefirby.seriestracker.client.OmdbSearchCandidate
import uk.co.stefirby.seriestracker.client.TmdbClient
import uk.co.stefirby.seriestracker.client.TmdbSearchCandidate
import uk.co.stefirby.seriestracker.client.TmdbSeriesDetail
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import spock.lang.Specification

class SeriesLookupServiceSpec extends Specification {

    OmdbClient omdbClient = Mock()
    TmdbClient tmdbClient = Mock()
    TmdbGenreTable genreTable = new TmdbGenreTable()
    SeriesLookupService lookupService = new SeriesLookupService(omdbClient, tmdbClient, genreTable)

    def "SERIES-005-AC-14/AC-15: maps a successful OmdbClient lookup onto a SeriesLookupDto"() {
        given: "OmdbClient resolves a full result for the requested title"
            def omdbResult = new OmdbLookupResult(
                "Breaking Bad", 2008, "Crime, Drama, Thriller", 5, 62,
                new BigDecimal("9.5"), 87, 96, "https://example.com/poster.jpg", "tt0903747"
            )
            omdbClient.lookup("Breaking Bad") >> omdbResult

        when: "the title is looked up"
            def dto = lookupService.lookup("Breaking Bad")

        then: "every OmdbLookupResult field is mapped onto the SeriesLookupDto"
            dto.title == "Breaking Bad"
            dto.year == 2008
            dto.genres == "Crime, Drama, Thriller"
            dto.totalSeasons == 5
            dto.totalEpisodes == 62
            dto.imdbRating == new BigDecimal("9.5")
            dto.metacriticRating == 87
            dto.rottenTomatoesRating == 96
            dto.posterUrl == "https://example.com/poster.jpg"
            dto.imdbId == "tt0903747"
    }

    def "SERIES-005-AC-16: propagates EntityNotFoundException from OmdbClient"() {
        given: "OmdbClient reports no match for the title"
            omdbClient.lookup("Nonexistent Show") >> { throw new EntityNotFoundException("No OMDb results for title: Nonexistent Show") }

        when: "the title is looked up"
            lookupService.lookup("Nonexistent Show")

        then: "the not-found exception propagates unchanged"
            def ex = thrown(EntityNotFoundException)
            ex.message.contains("Nonexistent Show")
    }

    def "SERIES-005-AC-17: propagates ExternalServiceException from OmdbClient"() {
        given: "OmdbClient fails to reach OMDb"
            omdbClient.lookup("Any Show") >> { throw new ExternalServiceException("OMDb request failed") }

        when: "the title is looked up"
            lookupService.lookup("Any Show")

        then: "the external-service exception propagates unchanged"
            thrown(ExternalServiceException)
    }

    def "SERIES-011-AC-10: maps each OmdbSearchCandidate onto a SeriesLookupCandidateDto"() {
        given: "OmdbClient resolves two candidates for the requested title"
            def candidates = [
                new OmdbSearchCandidate("Spooks", 2002, "tt0290403", "https://example.com/spooks.jpg"),
                new OmdbSearchCandidate("Spooks: Code 9", 2008, "tt1219342", null),
            ]
            omdbClient.search("Spooks") >> candidates

        when: "the title is searched"
            def dtos = lookupService.search("Spooks")

        then: "each candidate is mapped onto a SeriesLookupCandidateDto"
            dtos.size() == 2
            dtos[0].title == "Spooks"
            dtos[0].imdbId == "tt0290403"
            dtos[1].posterUrl == null
    }

    def "SERIES-011-AC-10: an empty candidate list maps to an empty DTO list"() {
        given: "OmdbClient resolves no candidates"
            omdbClient.search("Nonexistent Show") >> []

        when: "the title is searched"
            def dtos = lookupService.search("Nonexistent Show")

        then: "the result is an empty list"
            dtos == []
    }

    def "SERIES-011-AC-11: maps a successful lookupByImdbId onto a SeriesLookupDto"() {
        given: "OmdbClient resolves a full result for the requested imdbId"
            def omdbResult = new OmdbLookupResult(
                "Spooks", 2002, "Action, Drama, Thriller", 10, 86,
                new BigDecimal("7.9"), null, null, "https://example.com/spooks.jpg", "tt0290403"
            )
            omdbClient.lookupByImdbId("tt0290403") >> omdbResult

        when: "the imdbId is looked up"
            def dto = lookupService.lookupByImdbId("tt0290403")

        then: "every field is mapped, matching lookup(title)'s existing mapping"
            dto.title == "Spooks"
            dto.imdbId == "tt0290403"
    }

    def "SERIES-011-AC-11: propagates EntityNotFoundException from OmdbClient"() {
        given: "OmdbClient reports no match for the imdbId"
            omdbClient.lookupByImdbId("tt9999999") >> { throw new EntityNotFoundException("No OMDb results for imdbId: tt9999999") }

        when: "the imdbId is looked up"
            lookupService.lookupByImdbId("tt9999999")

        then: "the not-found exception propagates unchanged"
            thrown(EntityNotFoundException)
    }

    def "SERIES-012-AC-12: maps each TmdbSearchCandidate onto a TmdbLookupCandidateDto, prepending the poster base URL"() {
        given: "TmdbClient resolves one candidate for the requested title"
            tmdbClient.search("Spooks") >> [
                new TmdbSearchCandidate(4046, "Spooks", null, 2002, "/spooks.jpg", [10759, 18]),
            ]

        when: "the title is searched via TMDB"
            def dtos = lookupService.searchTmdb("Spooks")

        then: "the candidate is mapped, with the poster path resolved to a full URL"
            dtos.size() == 1
            dtos[0].tmdbId == 4046
            dtos[0].title == "Spooks"
            dtos[0].posterUrl == TmdbClient.POSTER_BASE_URL + "/spooks.jpg"
    }

    def "SERIES-012-AC-13: an empty TMDB candidate list maps to an empty DTO list"() {
        given: "TmdbClient resolves no candidates"
            tmdbClient.search("Nonexistent Show") >> []

        when: "the title is searched via TMDB"
            def dtos = lookupService.searchTmdb("Nonexistent Show")

        then: "the result is an empty list"
            dtos == []
    }

    def "SERIES-012-AC-14/15: an imdbId resolves and OMDb succeeds -- maps via the existing lookupByImdbId mapping"() {
        given: "TMDB resolves an imdbId, and OMDb has a record for it"
            tmdbClient.externalIds(4046) >> Optional.of("tt0160904")
            def omdbResult = new OmdbLookupResult(
                "Spooks", 2002, "Action, Drama, Thriller", 10, 108,
                new BigDecimal("7.9"), 71, 78, "https://example.com/spooks.jpg", "tt0160904"
            )
            omdbClient.lookupByImdbId("tt0160904") >> omdbResult

        when: "the candidate is resolved"
            def dto = lookupService.resolveTmdbCandidate(4046)

        then: "the OMDb result is mapped, and TMDB's own detail endpoint is never called"
            dto.title == "Spooks"
            dto.imdbId == "tt0160904"
            dto.imdbRating == new BigDecimal("7.9")
            0 * tmdbClient.details(_)
    }

    def "SERIES-012-AC-16/18: OMDb has no record for a resolved imdbId -- falls through to TMDB's own detail"() {
        given: "TMDB resolves an imdbId, but OMDb has no record for it"
            tmdbClient.externalIds(4046) >> Optional.of("tt0160904")
            omdbClient.lookupByImdbId("tt0160904") >> { throw new EntityNotFoundException("No OMDb results for imdbId: tt0160904") }
            tmdbClient.details(4046) >> new TmdbSeriesDetail("Spooks", 2002, [10759, 18], "/spooks.jpg", 10, 108)

        when: "the candidate is resolved"
            def dto = lookupService.resolveTmdbCandidate(4046)

        then: "a SeriesLookupDto is built from TMDB's own detail, ratings absent, imdbId still populated"
            dto.title == "Spooks"
            dto.imdbId == "tt0160904"
            dto.genres == "Action & Adventure, Drama"
            dto.totalSeasons == 10
            dto.totalEpisodes == 108
            dto.imdbRating == null
            dto.metacriticRating == null
            dto.rottenTomatoesRating == null
    }

    def "SERIES-012-AC-17: an OMDb ExternalServiceException propagates unchanged, without falling back to TMDB detail"() {
        given: "TMDB resolves an imdbId, but OMDb itself is unreachable"
            tmdbClient.externalIds(4046) >> Optional.of("tt0160904")
            omdbClient.lookupByImdbId("tt0160904") >> { throw new ExternalServiceException("OMDb request failed") }

        when: "the candidate is resolved"
            lookupService.resolveTmdbCandidate(4046)

        then: "the external-service exception propagates, and TMDB's detail endpoint is never called"
            thrown(ExternalServiceException)
            0 * tmdbClient.details(_)
    }

    def "SERIES-012-AC-18: no imdbId resolves at all -- falls straight to TMDB's own detail, OMDb never called"() {
        given: "TMDB has no IMDb cross-reference for this id"
            tmdbClient.externalIds(4046) >> Optional.empty()
            tmdbClient.details(4046) >> new TmdbSeriesDetail("Spooks", 2002, [10759, 18], "/spooks.jpg", 10, 108)

        when: "the candidate is resolved"
            def dto = lookupService.resolveTmdbCandidate(4046)

        then: "a SeriesLookupDto is built from TMDB's own detail, imdbId null, OMDb never consulted"
            dto.imdbId == null
            dto.title == "Spooks"
            0 * omdbClient.lookupByImdbId(_)
    }

    def "SERIES-012-AC-19: a TmdbClient.externalIds failure propagates unchanged"() {
        given: "TMDB itself is unreachable"
            tmdbClient.externalIds(4046) >> { throw new ExternalServiceException("TMDB request failed") }

        when: "the candidate is resolved"
            lookupService.resolveTmdbCandidate(4046)

        then: "the external-service exception propagates"
            thrown(ExternalServiceException)
    }

    def "SERIES-012-AC-19: a TmdbClient.details failure in the degraded path propagates unchanged"() {
        given: "no imdbId resolves, and TMDB's own detail endpoint then fails"
            tmdbClient.externalIds(4046) >> Optional.empty()
            tmdbClient.details(4046) >> { throw new ExternalServiceException("TMDB request failed") }

        when: "the candidate is resolved"
            lookupService.resolveTmdbCandidate(4046)

        then: "the external-service exception propagates"
            thrown(ExternalServiceException)
    }
}
