package uk.co.stefirby.seriestracker.service.refresh

import spock.lang.Specification
import uk.co.stefirby.seriestracker.client.omdb.OmdbClient
import uk.co.stefirby.seriestracker.client.omdb.OmdbRatings
import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient
import uk.co.stefirby.seriestracker.client.tmdb.TmdbSeriesDetail
import uk.co.stefirby.seriestracker.exception.EntityNotFoundException
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import uk.co.stefirby.seriestracker.model.ProductionStatus
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.model.SeriesStatus
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import uk.co.stefirby.seriestracker.service.keyword.KeywordSyncService
import uk.co.stefirby.seriestracker.service.SeriesService
import uk.co.stefirby.seriestracker.service.tmdb.TmdbGenreTable

import java.time.Clock
import java.time.LocalDateTime

class SeriesRefreshServiceSpec extends Specification {

    SeriesRepository repository = Mock()
    TmdbClient tmdbClient = Mock()
    OmdbClient omdbClient = Mock()
    KeywordSyncService keywordSyncService = Mock()
    SeriesService seriesService = new SeriesService(repository, keywordSyncService, Clock.systemDefaultZone())
    TmdbGenreTable genreTable = new TmdbGenreTable()

    SeriesRefreshService refreshService =
        new SeriesRefreshService(repository, tmdbClient, omdbClient, seriesService, keywordSyncService, genreTable, Clock.systemDefaultZone())

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
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
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
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("9.4"), 96)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "originCountry reflects the fresh TMDB value"
            result.series().originCountry == "US"
    }

    def "SERIES-046-AC-11: a refresh updates originCountry to the fresh multi-country value"() {
        given: "an existing series and a fresh TMDB detail with two origin countries"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.originCountry = "GB"
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["GB", "US"], null, null)
            omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("9.4"), 96)

        when: "the series is refreshed"
            def result = refreshService.refresh(id)

        then: "originCountry reflects the fresh, joined multi-country value"
            result.series().originCountry == "GB,US"
    }

    def "SERIES-039-AC-04: refresh re-resolves lastAirYear"() {
        given: "an existing series and a fresh TMDB detail lookup with a newer lastAirYear"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.lastAirYear = 2022
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, 2024)
            omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "lastAirYear is updated"
            result.series().lastAirYear == 2024
    }

    def "SERIES-023-AC-13: a successful TMDB refresh updates overview"() {
        given: "an existing series and a fresh TMDB detail with an updated overview"
            def id = UUID.randomUUID()
            def entity = existing(id)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], "Updated overview.", null)
            omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "overview reflects the fresh TMDB value"
            result.series().overview == "Updated overview."
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

    def "SERIES-018-AC-04: posterUrl/personalRating/personalNotes/status/currentSeason/currentEpisode/imdbId/dateAdded/dateCompleted are untouched"() {
        given: "an existing series with user-owned fields set"
            def id = UUID.randomUUID()
            def entity = existing(id)
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
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "user-/system-owned fields are unchanged"
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

    def "SERIES-040-AC-04: refresh overwrites title/year/genres from a fresh TMDB result"() {
        given: "an existing series with a stale title/year/genres"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.title = "Old Title"
            entity.year = 2018
            entity.genres = "Crime, Drama"
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2019, [18, 10765], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "the series is refreshed"
            def result = refreshService.refresh(id)

        then: "title/year/genres are all overwritten from the fresh TMDB result"
            result.series().title == "Breaking Bad"
            result.series().year == 2019
            result.series().genres == "Drama, Sci-Fi & Fantasy"
    }

    def "SERIES-040-AC-05: a null title/year and empty genreIds from TMDB never blank the existing values"() {
        given: "an existing series with title/year/genres already set"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.title = "Breaking Bad"
            entity.year = 2008
            entity.genres = "Crime, Drama"
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                null, null, [], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "the series is refreshed"
            def result = refreshService.refresh(id)

        then: "title/year/genres remain unchanged"
            result.series().title == "Breaking Bad"
            result.series().year == 2008
            result.series().genres == "Crime, Drama"
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

    def "SERIES-027-AC-04: a refresh never touches rottenTomatoesPopcornmeter"() {
        given: "an existing series with a manually-entered Popcornmeter score"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.rottenTomatoesPopcornmeter = 91
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "the series is refreshed"
            def result = refreshService.refresh(id)

        then: "rottenTomatoesPopcornmeter is untouched"
            result.series().rottenTomatoesPopcornmeter == 91
    }

    def "SERIES-027-AC-06: OMDb returning a null rottenTomatoesRating does not overwrite an existing value"() {
        given: "an existing series with a manually-entered Rotten Tomatoes rating"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.rottenTomatoesRating = 85
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId(_) >> { throw new ExternalServiceException("TMDB down") }
            omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("7.2"), null)

        when: "the series is refreshed"
            def result = refreshService.refresh(id)

        then: "imdbRating updates, but rottenTomatoesRating is untouched"
            result.series().imdbRating == new BigDecimal("7.2")
            result.series().rottenTomatoesRating == 85

        and: "omdbRefreshed is still reported true -- OMDb did respond successfully"
            result.omdbRefreshed()
    }

    def "SERIES-027-AC-06: OMDb returning a null imdbRating does not overwrite an existing value"() {
        given: "an existing series with a manually-entered IMDb rating"
            def id = UUID.randomUUID()
            def entity = existing(id)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId(_) >> { throw new ExternalServiceException("TMDB down") }
            omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(null, 98)

        when: "the series is refreshed"
            def result = refreshService.refresh(id)

        then: "rottenTomatoesRating updates, but imdbRating is untouched"
            result.series().rottenTomatoesRating == 98
            result.series().imdbRating == new BigDecimal("9.4")
    }

    def "SERIES-027-AC-07: TMDB returning a null overview does not overwrite an existing value"() {
        given: "an existing series with a persisted overview"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.overview = "A drug-money-laundering saga."
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "the series is refreshed"
            def result = refreshService.refresh(id)

        then: "overview is untouched, other fields still update"
            result.series().overview == "A drug-money-laundering saga."
            result.series().totalSeasons == 6
    }

    def "SERIES-027-AC-07/SERIES-039-AC-04: TMDB returning null totalSeasons/totalEpisodes/tmdbRating/tmdbVoteCount/productionStatus/originCountry/lastAirYear does not overwrite existing values"() {
        given: "an existing series with all TMDB-sourced fields already populated"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.productionStatus = ProductionStatus.RETURNING_SERIES
            entity.lastAirYear = 2021
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", null, null,
                null, null, null, [], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "the series is refreshed"
            def result = refreshService.refresh(id)

        then: "every TMDB-sourced field remains unchanged, yet tmdbRefreshed is still true"
            result.tmdbRefreshed()
            result.series().totalSeasons == 5
            result.series().totalEpisodes == 62
            result.series().tmdbRating == new BigDecimal("8.5")
            result.series().tmdbVoteCount == 900
            result.series().productionStatus == "RETURNING_SERIES"
            result.series().originCountry == null
            result.series().lastAirYear == 2021
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
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> { throw new ExternalServiceException("OMDb down") }

        when: "refresh is called"
            refreshService.refresh(id)

        then: "the entity is saved exactly once"
            1 * repository.save(entity) >> entity
    }

    def "SERIES-019-AC-08: a successful TMDB refresh also syncs keywords for the resolved tmdbId"() {
        given: "an existing series, TMDB resolves fine"
            def id = UUID.randomUUID()
            def entity = existing(id)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            refreshService.refresh(id)

        then: "keyword syncing is delegated for the resolved tmdbId"
            1 * keywordSyncService.syncKeywords(entity, 1396)
    }

    def "SERIES-019-AC-08: when no tmdbId is resolved, keyword syncing is not attempted"() {
        given: "an existing series, TMDB fails to resolve a tmdbId"
            def id = UUID.randomUUID()
            def entity = existing(id)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.empty()
            omdbClient.ratingsForImdbId("tt0903747") >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            refreshService.refresh(id)

        then: "no keyword sync is attempted"
            0 * keywordSyncService.syncKeywords(_, _)
    }

    def "SERIES-018-AC-24: an increased totalSeasons sets newContentDetectedAt"() {
        given: "an existing series with totalSeasons 5, TMDB now reports 6"
            def id = UUID.randomUUID()
            def entity = existing(id)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 62,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "newContentDetectedAt is set"
            result.series().newContentDetectedAt != null
    }

    def "SERIES-018-AC-24: an increased totalEpisodes (unchanged totalSeasons) also sets newContentDetectedAt"() {
        given: "an existing series with totalEpisodes 62, TMDB now reports 63"
            def id = UUID.randomUUID()
            def entity = existing(id)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 5, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "newContentDetectedAt is set"
            result.series().newContentDetectedAt != null
    }

    def "SERIES-018-AC-25: an unchanged season/episode count leaves an existing flag untouched"() {
        given: "a series already flagged, TMDB now reports the same totalSeasons/totalEpisodes"
            def id = UUID.randomUUID()
            def entity = existing(id)
            def priorFlag = LocalDateTime.now().minusDays(2)
            entity.newContentDetectedAt = priorFlag
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 5, 62,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "newContentDetectedAt is unchanged, not cleared"
            result.series().newContentDetectedAt == priorFlag
    }

    def "SERIES-018-AC-25: a decreased totalSeasons does not set newContentDetectedAt"() {
        given: "an existing series with totalSeasons 5, TMDB now reports 4"
            def id = UUID.randomUUID()
            def entity = existing(id)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 4, 60,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "newContentDetectedAt remains null"
            result.series().newContentDetectedAt == null
    }

    def "SERIES-018-AC-25: a failed TMDB fetch does not set newContentDetectedAt"() {
        given: "an existing series, TMDB fetch fails"
            def id = UUID.randomUUID()
            def entity = existing(id)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId(_) >> { throw new ExternalServiceException("TMDB down") }
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "newContentDetectedAt remains null"
            result.series().newContentDetectedAt == null
    }

    def "SERIES-018-AC-26: a null-to-populated totalSeasons is not treated as an increase"() {
        given: "a manually-added series with totalSeasons/totalEpisodes null, TMDB now reports values"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.totalSeasons = null
            entity.totalEpisodes = null
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 3, 30,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "newContentDetectedAt remains null"
            result.series().newContentDetectedAt == null
    }

    def "SERIES-018-AC-27: acknowledging clears the flag"() {
        given: "a series with newContentDetectedAt set"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.newContentDetectedAt = LocalDateTime.now()
            repository.findById(id) >> Optional.of(entity)

        when: "acknowledgeNewContent is called"
            def dto = refreshService.acknowledgeNewContent(id)

        then: "newContentDetectedAt is cleared and persisted"
            dto.newContentDetectedAt == null
            1 * repository.save({ SeriesEntity e -> e.newContentDetectedAt == null }) >> { SeriesEntity e -> e }
    }

    def "SERIES-018-AC-27: acknowledging an unknown id throws EntityNotFoundException"() {
        given: "no series exists for the given id"
            def id = UUID.randomUUID()
            repository.findById(id) >> Optional.empty()

        when: "acknowledgeNewContent is called"
            refreshService.acknowledgeNewContent(id)

        then: "an EntityNotFoundException is thrown"
            thrown(EntityNotFoundException)
    }

    def "SERIES-018-AC-35/36: new content on a COMPLETED series flips it to BACKLOG and clears dateCompleted"() {
        given: "a COMPLETED series with totalSeasons 5, dateCompleted set, TMDB now reports 6"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.status = SeriesStatus.COMPLETED
            def dateCompleted = LocalDateTime.now().minusDays(1)
            entity.dateCompleted = dateCompleted
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "status is now BACKLOG and dateCompleted is null, newContentDetectedAt is set"
            result.series().status == "BACKLOG"
            result.series().dateCompleted == null
            result.series().newContentDetectedAt != null
    }

    def "SERIES-018-AC-37: a WATCHING series gaining new content is left WATCHING"() {
        given: "a WATCHING series with totalSeasons 5, TMDB now reports 6"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.status = SeriesStatus.WATCHING
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "status is unchanged"
            result.series().status == "WATCHING"
    }

    def "SERIES-018-AC-37: a DROPPED series gaining new content stays DROPPED"() {
        given: "a DROPPED series with totalSeasons 5, TMDB now reports 6"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.status = SeriesStatus.DROPPED
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "status is unchanged"
            result.series().status == "DROPPED"
    }

    def "SERIES-018-AC-38: acknowledging the flag never reverses a status change already made"() {
        given: "a COMPLETED series whose refresh just flipped it to BACKLOG with content detected"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.status = SeriesStatus.COMPLETED
            entity.dateCompleted = LocalDateTime.now().minusDays(1)
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 6, 63,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)
            refreshService.refresh(id)

        when: "acknowledgeNewContent is called afterwards"
            def dto = refreshService.acknowledgeNewContent(id)

        then: "the status change made by refresh remains, only the flag is cleared"
            dto.status == "BACKLOG"
            dto.newContentDetectedAt == null
    }

    def "SERIES-018-AC-39: no reactivation when the null-to-populated exception applies"() {
        given: "a COMPLETED series with totalSeasons null, TMDB now reports a value"
            def id = UUID.randomUUID()
            def entity = existing(id)
            entity.status = SeriesStatus.COMPLETED
            def dateCompleted = LocalDateTime.now().minusDays(1)
            entity.dateCompleted = dateCompleted
            entity.totalSeasons = null
            entity.totalEpisodes = null
            repository.findById(id) >> Optional.of(entity)
            repository.save(_) >> { SeriesEntity e -> e }
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.details(1396) >> new TmdbSeriesDetail(
                "Breaking Bad", 2008, [18], "/poster.jpg", 3, 30,
                new BigDecimal("8.9"), 1200, ProductionStatus.ENDED, ["US"], null, null)
            omdbClient.ratingsForImdbId(_) >> new OmdbRatings(new BigDecimal("9.5"), 97)

        when: "refresh is called"
            def result = refreshService.refresh(id)

        then: "status and dateCompleted are untouched, no detection fired"
            result.series().status == "COMPLETED"
            result.series().dateCompleted == dateCompleted
            result.series().newContentDetectedAt == null
    }
}
