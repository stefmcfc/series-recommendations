package uk.co.stefirby.seriestracker.service

import uk.co.stefirby.seriestracker.client.omdb.OmdbClient
import uk.co.stefirby.seriestracker.client.omdb.OmdbRatings
import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient
import uk.co.stefirby.seriestracker.client.tmdb.TmdbSearchCandidate
import uk.co.stefirby.seriestracker.client.tmdb.TmdbSeriesDetail
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import uk.co.stefirby.seriestracker.model.ProductionStatus
import spock.lang.Specification

class SeriesLookupServiceSpec extends Specification {

    OmdbClient omdbClient = Mock()
    TmdbClient tmdbClient = Mock()
    TmdbGenreTable genreTable = new TmdbGenreTable()
    SeriesLookupService lookupService = new SeriesLookupService(omdbClient, tmdbClient, genreTable)

    def "SERIES-012-AC-12: maps each TmdbSearchCandidate onto a TmdbLookupCandidateDto, prepending the poster base URL"() {
        given: "TmdbClient resolves one candidate for the requested title"
            tmdbClient.search("Spooks") >> [
                new TmdbSearchCandidate(4046, "Spooks", null, 2002, "/spooks.jpg", [10759, 18], "GB"),
            ]

        when: "the title is searched via TMDB"
            def dtos = lookupService.searchTmdb("Spooks")

        then: "the candidate is mapped, with the poster path resolved to a full URL"
            dtos.size() == 1
            dtos[0].tmdbId == 4046
            dtos[0].title == "Spooks"
            dtos[0].posterUrl == TmdbClient.POSTER_BASE_URL + "/spooks.jpg"
    }

    def "SERIES-021-AC-03: TMDB search candidates carry originCountry through to the picker DTO"() {
        given: "TmdbClient.search returns a candidate with originCountry"
            tmdbClient.search("The Office") >> [
                new TmdbSearchCandidate(2996, "The Office", null, 2001, "/poster.jpg", [], "GB")
            ]

        when: "searchTmdb(\"The Office\") is called"
            def results = lookupService.searchTmdb("The Office")

        then: "the picker DTO carries originCountry"
            results[0].originCountry == "GB"
    }

    def "SERIES-012-AC-13/SERIES-017-AC-03: an empty TMDB candidate list maps to an empty DTO list"() {
        given: "TmdbClient resolves no candidates"
            tmdbClient.search("Nonexistent Show") >> []

        when: "the title is searched via TMDB"
            def dtos = lookupService.searchTmdb("Nonexistent Show")

        then: "the result is an empty list"
            dtos == []
    }

    def "SERIES-017-AC-04/06: resolve builds from TMDB detail, merges OMDb ratings when available"() {
        given: "TMDB detail for tmdbId=4046 and a resolvable imdbId"
            tmdbClient.details(4046) >> new TmdbSeriesDetail(
                "Spooks", 2002, [10759, 18], "/poster.jpg", 10, 81, new BigDecimal("7.8"), 245, null, "GB", null, null)
            tmdbClient.externalIds(4046) >> Optional.of("tt0160904")
            omdbClient.ratingsForImdbId("tt0160904") >> new OmdbRatings(new BigDecimal("8.3"), null)

        when: "resolveTmdbCandidate(4046) is called"
            def result = lookupService.resolveTmdbCandidate(4046)

        then: "TMDB fields are the base, OMDb ratings are merged on top"
            result.title == "Spooks"
            result.year == 2002
            result.genres == "Action & Adventure, Drama"
            result.totalSeasons == 10
            result.totalEpisodes == 81
            result.posterUrl == TmdbClient.POSTER_BASE_URL + "/poster.jpg"
            result.tmdbRating == new BigDecimal("7.8")
            result.tmdbVoteCount == 245
            result.imdbId == "tt0160904"
            result.imdbRating == new BigDecimal("8.3")
            result.rottenTomatoesRating == null
    }

    def "SERIES-021-AC-04/07: resolve carries originCountry and productionStatus through from TMDB detail"() {
        given: "TmdbClient.details resolves a full detail with originCountry and productionStatus"
            tmdbClient.details(2996) >> new TmdbSeriesDetail(
                "The Office", 2001, [35], "/poster.jpg", 2, 14,
                new BigDecimal("7.7"), 450, ProductionStatus.ENDED, "GB", null, null)
            tmdbClient.externalIds(2996) >> Optional.empty()

        when: "resolveTmdbCandidate(2996) is called"
            def result = lookupService.resolveTmdbCandidate(2996)

        then: "both fields are present on the result"
            result.originCountry == "GB"
            result.productionStatus == "ENDED"
    }

    def "SERIES-023-AC-09: resolve carries overview through from TMDB detail"() {
        given: "TmdbClient.details resolves a full detail including overview"
            tmdbClient.details(2996) >> new TmdbSeriesDetail(
                "The Office", 2001, [35], "/poster.jpg", 2, 14,
                new BigDecimal("7.7"), 450, ProductionStatus.ENDED, "GB", "A mockumentary sitcom.", null)
            tmdbClient.externalIds(2996) >> Optional.empty()

        when: "resolveTmdbCandidate(2996) is called"
            def result = lookupService.resolveTmdbCandidate(2996)

        then: "overview is present on the result"
            result.overview == "A mockumentary sitcom."
    }

    def "SERIES-039-AC-03: resolve carries lastAirYear through from TMDB detail"() {
        given: "TmdbClient.details resolves a lastAirYear"
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Show", 2020, [18], "/p.jpg", 3, 24,
                new BigDecimal("8.0"), 500, ProductionStatus.ENDED, "US", "overview", 2023)
            tmdbClient.externalIds(1396) >> Optional.empty()

        when: "resolveTmdbCandidate(1396) is called"
            def result = lookupService.resolveTmdbCandidate(1396)

        then: "lastAirYear is populated"
            result.lastAirYear == 2023
    }

    def "SERIES-017-AC-07: an EntityNotFoundException from OMDb enrichment never fails the resolve"() {
        given: "TMDB detail resolves fine, but OMDb has no record for the resolved imdbId"
            tmdbClient.details(4046) >> new TmdbSeriesDetail(
                "Spooks", 2002, [10759, 18], "/poster.jpg", 10, 81, new BigDecimal("7.8"), 245, null, "GB", null, null)
            tmdbClient.externalIds(4046) >> Optional.of("tt0160904")
            omdbClient.ratingsForImdbId("tt0160904") >> {
                throw new EntityNotFoundException("No OMDb results for imdbId: tt0160904")
            }

        when: "resolveTmdbCandidate(4046) is called"
            def result = lookupService.resolveTmdbCandidate(4046)

        then: "the call succeeds with null OMDb-sourced ratings, not an exception"
            result.title == "Spooks"
            result.imdbId == "tt0160904"
            result.imdbRating == null
            result.rottenTomatoesRating == null
    }

    def "SERIES-017-AC-07: an ExternalServiceException from OMDb enrichment never fails the resolve"() {
        given: "TMDB detail resolves fine, but OMDb throws ExternalServiceException"
            tmdbClient.details(4046) >> new TmdbSeriesDetail(
                "Spooks", 2002, [10759, 18], "/poster.jpg", 10, 81, new BigDecimal("7.8"), 245, null, "GB", null, null)
            tmdbClient.externalIds(4046) >> Optional.of("tt0160904")
            omdbClient.ratingsForImdbId("tt0160904") >> { throw new ExternalServiceException("OMDb down") }

        when: "resolveTmdbCandidate(4046) is called"
            def result = lookupService.resolveTmdbCandidate(4046)

        then: "the call succeeds with null OMDb-sourced ratings, not an exception"
            result.title == "Spooks"
            result.imdbRating == null
            result.rottenTomatoesRating == null
    }

    def "SERIES-017-AC-08: no imdbId resolved means no OMDb call is attempted"() {
        given: "TMDB has no IMDb cross-reference for this title"
            tmdbClient.details(999) >> new TmdbSeriesDetail(
                "Obscure Show", 2020, [], null, 1, 6, new BigDecimal("6.0"), 12, null, null, null, null)
            tmdbClient.externalIds(999) >> Optional.empty()

        when: "resolveTmdbCandidate(999) is called"
            def result = lookupService.resolveTmdbCandidate(999)

        then: "no OMDb call happens, and ratings are null"
            0 * omdbClient.ratingsForImdbId(_)
            result.imdbId == null
            result.imdbRating == null
            result.rottenTomatoesRating == null
            result.tmdbRating == new BigDecimal("6.0")
            result.tmdbVoteCount == 12
    }

    def "SERIES-019-AC-22: resolve carries tmdbId through onto the lookup result"() {
        given: "TmdbClient.details resolves a full detail"
            tmdbClient.details(4046) >> new TmdbSeriesDetail(
                "Spooks", 2002, [80], "/poster.jpg", 10, 81,
                new BigDecimal("7.8"), 245, ProductionStatus.ENDED, "GB", null, null)
            tmdbClient.externalIds(4046) >> Optional.empty()

        when: "resolveTmdbCandidate(4046) is called"
            def result = lookupService.resolveTmdbCandidate(4046)

        then: "the result carries the same tmdbId"
            result.tmdbId == 4046
    }

    def "SERIES-017-AC-04: a TmdbClient.details failure propagates unchanged"() {
        given: "TMDB's own detail endpoint fails"
            tmdbClient.details(4046) >> { throw new ExternalServiceException("TMDB request failed") }

        when: "the candidate is resolved"
            lookupService.resolveTmdbCandidate(4046)

        then: "the external-service exception propagates, and externalIds/OMDb are never consulted"
            thrown(ExternalServiceException)
            0 * tmdbClient.externalIds(_)
            0 * omdbClient.ratingsForImdbId(_)
    }

    def "SERIES-017-AC-04: a TmdbClient.externalIds failure propagates unchanged"() {
        given: "TMDB detail succeeds but externalIds fails"
            tmdbClient.details(4046) >> new TmdbSeriesDetail(
                "Spooks", 2002, [10759, 18], "/poster.jpg", 10, 81, new BigDecimal("7.8"), 245, null, "GB", null, null)
            tmdbClient.externalIds(4046) >> { throw new ExternalServiceException("TMDB request failed") }

        when: "the candidate is resolved"
            lookupService.resolveTmdbCandidate(4046)

        then: "the external-service exception propagates"
            thrown(ExternalServiceException)
    }
}
