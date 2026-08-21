package uk.co.stefirby.seriestracker.service

import spock.lang.Specification
import uk.co.stefirby.seriestracker.client.OmdbClient
import uk.co.stefirby.seriestracker.client.OmdbRatings
import uk.co.stefirby.seriestracker.client.TmdbClient
import uk.co.stefirby.seriestracker.client.TmdbSeriesDetail
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import uk.co.stefirby.seriestracker.model.ProductionStatus
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.repository.SeriesRepository

import java.time.LocalDateTime
import java.util.UUID

class SeriesRefreshServiceSpec extends Specification {

    SeriesRepository repository = Mock()
    TmdbClient tmdbClient = Mock()
    OmdbClient omdbClient = Mock()
    SeriesService seriesService = new SeriesService(repository)

    SeriesRefreshService refreshService = new SeriesRefreshService(repository, tmdbClient, omdbClient, seriesService)

    private static SeriesEntity existing(UUID id, String imdbId = "tt0903747") {
        new SeriesEntity(
            id: id,
            title: "Breaking Bad",
            imdbId: imdbId,
            totalSeasons: 5,
            totalEpisodes: 62,
            tmdbRating: new BigDecimal("8.5"),
            tmdbVoteCount: 900,
            imdbRating: new BigDecimal("9.4"),
            rottenTomatoesRating: 96
        )
    }

    def "SERIES-018-AC-01: refreshing an unknown id throws EntityNotFoundException"() {
        given: "no series exists for the given id"
            def id = UUID.randomUUID()
            repository.findById(id) >> Optional.empty()

        when: "refresh is called"
            refreshService.refresh(id)

        then: "an EntityNotFoundException is thrown"
            thrown(EntityNotFoundException)
    }

    def "SERIES-018-AC-02/07/09: successful TMDB refresh updates fields, sets lastRefreshedAt, reports tmdbRefreshed=true"() {
        given: "an existing series, TMDB now reports totalSeasons=6, tmdbRating=8.9, voteCount=1200, ENDED"
            def id = UUID.randomUUID()
            def entity = existing(id)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, "US")
            omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "the TMDB-sourced fields are updated and the outcome is reported"
            result.tmdbRefreshed()
            result.series().totalSeasons == 6
            result.series().totalEpisodes == 63
            result.series().tmdbRating == new BigDecimal("8.9")
            result.series().tmdbVoteCount == 1200
            result.series().productionStatus == "ENDED"
            result.series().originCountry == "US"
            result.series().lastRefreshedAt != null
    }

    def "SERIES-021-AC-09: a successful TMDB refresh updates originCountry"() {
        given: "an existing series and a fresh TMDB detail with a different originCountry"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.originCountry = "GB"
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, "US")
            omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("9.4"), 96)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "originCountry reflects the fresh TMDB value"
            result.series().originCountry == "US"
    }

    def "SERIES-018-AC-03: successful OMDb refresh updates imdbRating/rottenTomatoesRating, reports omdbRefreshed=true"() {
        given: "an existing series, OMDb now reports different ratings"
            def id = UUID.randomUUID()
            def entity = existing(id)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId(_) >> { throw new ExternalServiceException("TMDB down") }
            omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("9.6"), 98)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "the OMDb-sourced fields are updated and the outcome is reported"
            result.omdbRefreshed()
            !result.tmdbRefreshed()
            result.series().imdbRating == new BigDecimal("9.6")
            result.series().rottenTomatoesRating == 98
    }

    def "SERIES-018-AC-04: title/genres/posterUrl/personalRating/personalNotes/status/currentSeason/currentEpisode/imdbId/dateAdded/dateCompleted are untouched"() {
        given: "an existing series with user-owned fields set"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.title = "Breaking Bad (Original Title)"
            entity.genres = "Crime, Drama"
            entity.posterUrl = "https://example.com/poster.jpg"
            entity.personalRating = 5
            entity.personalNotes = "Loved it"
            entity.currentSeason = 3
            entity.currentEpisode = 7
            def dateAdded = entity.dateAdded
            def dateCompleted = LocalDateTime.now().minusDays(1)
            entity.dateCompleted = dateCompleted
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId(_) >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Some Other TMDB Title", 2008, [18], "/other.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, "US")
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "user-/system-owned fields are unchanged"
            result.series().title == "Breaking Bad (Original Title)"
            result.series().genres == "Crime, Drama"
            result.series().posterUrl == "https://example.com/poster.jpg"
            result.series().personalRating == 5
            result.series().personalNotes == "Loved it"
            result.series().status == "BACKLOG"
            result.series().currentSeason == 3
            result.series().currentEpisode == 7
            result.series().imdbId == "tt0903747"
            result.series().dateAdded == dateAdded
            result.series().dateCompleted == dateCompleted
    }

    def "SERIES-018-AC-05/09: TMDB failure leaves TMDB-sourced fields and lastRefreshedAt unchanged when OMDb also fails"() {
        given: "an existing series with a known lastRefreshedAt, both TMDB and OMDb calls fail"
            def id = UUID.randomUUID()
            def entity = existing(id)
            def priorRefresh = LocalDateTime.now().minusDays(3)
            entity.lastRefreshedAt = priorRefresh
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId(_) >> { throw new ExternalServiceException("TMDB down") }
            omdbClient.ratingsForImdbId(_) >> { throw new ExternalServiceException("OMDb down") }

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "both outcome flags are false, TMDB-sourced fields and lastRefreshedAt are unchanged"
            !result.tmdbRefreshed()
            !result.omdbRefreshed()
            result.series().totalSeasons == 5
            result.series().totalEpisodes == 62
            result.series().tmdbRating == new BigDecimal("8.5")
            result.series().tmdbVoteCount == 900
            result.series().lastRefreshedAt == priorRefresh
    }

    def "SERIES-018-AC-06: OMDb EntityNotFoundException leaves imdbRating/rottenTomatoesRating unchanged, doesn't fail the request"() {
        given: "an existing series, OMDb no longer has a record for this imdbId"
            def id = UUID.randomUUID()
            def entity = existing(id)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId(_) >> Optional.empty()
            omdbClient.ratingsForImdbId(_) >> { throw new EntityNotFoundException("No OMDb results") }

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "omdbRefreshed is false and prior ratings are unchanged, no exception propagates"
            !result.omdbRefreshed()
            result.series().imdbRating == new BigDecimal("9.4")
            result.series().rottenTomatoesRating == 96
    }

    def "SERIES-018-AC-02: when imdbId is blank, TMDB refresh is skipped without attempting a lookup"() {
        given: "an existing series with no imdbId"
            def id = UUID.randomUUID()
            def entity = existing(id, null)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "no TMDB or OMDb calls are attempted, and both outcomes are false"
            0 * tmdbClient.findTvIdByImdbId(_)
            0 * omdbClient.ratingsForImdbId(_)
            !result.tmdbRefreshed()
            !result.omdbRefreshed()
    }

    def "SERIES-018-AC-08: entity is persisted via repository.save reflecting a partial success"() {
        given: "an existing series, only TMDB succeeds"
            def id = UUID.randomUUID()
            def entity = existing(id)
            repository.findById(id) >> Optional.of(entity)
            tmdbClient.findTvIdByImdbId(_) >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, "US")
            omdbClient.ratingsForImdbId(_) >> { throw new ExternalServiceException("OMDb down") }

        when: "refresh is called"
            refreshService.refresh(id)

        then: "the entity is saved exactly once"
            1 * repository.save(entity) >> entity
    }
}
