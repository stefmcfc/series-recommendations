package com.example.seriestracker.service

import com.example.seriestracker.client.OmdbClient
import com.example.seriestracker.client.OmdbLookupResult
import com.example.seriestracker.exception.EntityNotFoundException
import com.example.seriestracker.exception.ExternalServiceException
import spock.lang.Specification

class SeriesLookupServiceSpec extends Specification {

    OmdbClient omdbClient = Mock()
    SeriesLookupService lookupService = new SeriesLookupService(omdbClient)

    def "SERIES-005-AC-14/AC-15: maps a successful OmdbClient lookup onto a SeriesLookupDto"() {
        given: "OmdbClient resolves a full result for the requested title"
            def omdbResult = new OmdbLookupResult(
                "Breaking Bad", 2008, "Crime, Drama, Thriller", 5, 62,
                new BigDecimal("9.5"), 87, 96, "https://example.com/poster.jpg"
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
}
