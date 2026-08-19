package uk.co.stefirby.seriestracker.service

import uk.co.stefirby.seriestracker.client.TmdbCandidate
import uk.co.stefirby.seriestracker.client.TmdbClient
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.model.SeriesStatus
import uk.co.stefirby.seriestracker.repository.IgnoredSeriesRepository
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import spock.lang.Specification

import java.time.LocalDateTime

class RecommendationServiceSpec extends Specification {

    SeriesRepository seriesRepository = Mock()
    IgnoredSeriesRepository ignoredSeriesRepository = Mock()
    TmdbClient tmdbClient = Mock()

    RecommendationService recommendationService =
        new RecommendationService(seriesRepository, ignoredSeriesRepository, tmdbClient)

    private static SeriesEntity completedSeries(String title, String imdbId, LocalDateTime dateCompleted,
                                                 String genres = null) {
        def entity = new SeriesEntity(
            title: title,
            imdbId: imdbId,
            status: SeriesStatus.COMPLETED,
            dateCompleted: dateCompleted,
            genres: genres
        )
        return entity
    }

    private static TmdbCandidate candidate(int tmdbId, String title = "Candidate ${tmdbId}") {
        new TmdbCandidate(tmdbId, title, 2020, "overview", "/poster.jpg", new BigDecimal("8.0"), [18])
    }

    def "SERIES-006-AC-20: empty watched pool returns an empty list without calling TMDB"() {
        given: "no COMPLETED series with imdbId exist"
            seriesRepository.findAll() >> []

        when: "recommend(20) is called"
            def results = recommendationService.recommend(20)

        then: "no TmdbClient sourcing calls are made, and the result is empty"
            0 * tmdbClient.findTvIdByImdbId(_)
            0 * tmdbClient.recommendations(_)
            0 * tmdbClient.similar(_)
            0 * tmdbClient.discoverByGenre(_)
            results.isEmpty()
    }

    def "SERIES-006-AC-20: a watched pool with only non-COMPLETED or imdbId-less series is treated as empty"() {
        given: "one WATCHING series with an imdbId, and one COMPLETED series with no imdbId"
            def watching = completedSeries("Watching Show", "tt1111111", LocalDateTime.now())
            watching.status = SeriesStatus.WATCHING
            def noImdb = completedSeries("No Imdb Show", null, LocalDateTime.now())
            seriesRepository.findAll() >> [watching, noImdb]

        when: "recommend(20) is called"
            def results = recommendationService.recommend(20)

        then: "no TmdbClient sourcing calls are made"
            0 * tmdbClient.findTvIdByImdbId(_)
            results.isEmpty()
    }

    def "SERIES-006-AC-14/15: sources candidates from up to 20 completed series with an imdbId, newest first"() {
        given: "21 COMPLETED series with imdbId, plus 1 BACKLOG series with imdbId"
            def now = LocalDateTime.now()
            def completedEntities = (1..21).collect {
                completedSeries("Show ${it}", "tt${it.toString().padLeft(7, '0')}", now.minusDays(it))
            }
            def backlog = completedSeries("Backlog Show", "tt9999999", now)
            backlog.status = SeriesStatus.BACKLOG
            seriesRepository.findAll() >> (completedEntities + [backlog])

        when: "recommend(20) is called"
            recommendationService.recommend(20)

        then: "only the 20 most recently completed series are used as sources"
            20 * tmdbClient.findTvIdByImdbId(_) >> Optional.of(1)
            20 * tmdbClient.recommendations(_) >> []
            20 * tmdbClient.similar(_) >> []
    }

    def "SERIES-006-AC-16: falls back to similar() when recommendations() is empty"() {
        given: "one completed series with an imdbId resolvable to a tmdb id"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]

        and: "recommendations() returns nothing, forcing a similar() fallback"
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(42)
            tmdbClient.recommendations(42) >> []
            tmdbClient.similar(42) >> [candidate(100)]

        and: "every resolved candidate is excluded (no imdb_id resolvable) to keep this test focused"
            tmdbClient.externalIds(_) >> Optional.empty()

        when: "recommend(20) is called"
            recommendationService.recommend(20)

        then: "similar() is called for that source series"
            1 * tmdbClient.similar(42) >> [candidate(100)]
    }

    def "SERIES-006-AC-15: title-sourced candidates retain the source series' title"() {
        given: "one completed series"
            def source = completedSeries("Breaking Bad", "tt0903747", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.recommendations(1396) >> [candidate(2316, "Better Call Saul")]
            tmdbClient.externalIds(2316) >> Optional.of("tt3032476")
            seriesRepository.existsByImdbId("tt3032476") >> false
            ignoredSeriesRepository.existsByImdbId("tt3032476") >> false

        when: "recommend(20) is called"
            def results = recommendationService.recommend(20)

        then: "the candidate is tagged with the source series' title"
            results.size() == 1
            results[0].sourceTitle() == "Breaking Bad"
            results[0].title() == "Better Call Saul"
            results[0].imdbId() == "tt3032476"
    }

    def "SERIES-006-AC-17: a source series whose imdbId cannot be resolved to a tmdb id is skipped, not fatal"() {
        given: "one completed series whose imdbId cannot be resolved"
            def source = completedSeries("Unresolvable Show", "tt0000001", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt0000001") >> Optional.empty()

        when: "recommend(20) is called"
            def results = recommendationService.recommend(20)

        then: "no recommendations/similar calls are made for that series, and no exception is thrown"
            0 * tmdbClient.recommendations(_)
            0 * tmdbClient.similar(_)
            results.isEmpty()
    }

    def "SERIES-006-AC-18/19: supplements with genre-based discovery only when short on title-based candidates"() {
        given: "one completed series (genres: 'Drama, Crime') whose title-based sourcing yields 1 candidate"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now(), "Drama, Crime")
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> [candidate(10)]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        and: "genre-based discovery resolves one additional candidate"
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")

        when: "recommend(20) is called"
            def results = recommendationService.recommend(20)

        then: "discoverByGenre is called with the TMDB ids for Drama (18) and Crime (80)"
            1 * tmdbClient.discoverByGenre([18, 80]) >> [candidate(20)]

        and: "the genre-sourced candidate has a null sourceTitle"
            results.size() == 2
            results.find { it.imdbId() == "tt1000020" }.sourceTitle() == null
    }

    def "SERIES-006-AC-18: genre names with no TMDB mapping are skipped, not an error"() {
        given: "one completed series whose only genre has no TMDB mapping"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now(), "Thriller")
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> []
            tmdbClient.similar(1) >> []

        when: "recommend(20) is called"
            def results = recommendationService.recommend(20)

        then: "discoverByGenre is never called, and no exception is thrown"
            0 * tmdbClient.discoverByGenre(_)
            results.isEmpty()
    }

    def "SERIES-006-AC-22/23/24: excludes unresolvable, already-added, and already-ignored candidates, and dedupes"() {
        given: "one completed series sourcing four raw candidates"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> [candidate(10), candidate(20), candidate(30), candidate(40)]

        and: "candidate 10 has no resolvable imdb_id"
            tmdbClient.externalIds(10) >> Optional.empty()

        and: "candidate 20 matches an existing SeriesEntity"
            tmdbClient.externalIds(20) >> Optional.of("tt2000000")
            seriesRepository.existsByImdbId("tt2000000") >> true

        and: "candidate 30 matches an IgnoredSeriesEntity"
            tmdbClient.externalIds(30) >> Optional.of("tt3000000")
            seriesRepository.existsByImdbId("tt3000000") >> false
            ignoredSeriesRepository.existsByImdbId("tt3000000") >> true

        and: "candidate 40 is valid"
            tmdbClient.externalIds(40) >> Optional.of("tt4000000")
            seriesRepository.existsByImdbId("tt4000000") >> false
            ignoredSeriesRepository.existsByImdbId("tt4000000") >> false

        when: "recommend(20) is called"
            def results = recommendationService.recommend(20)

        then: "only the one valid candidate remains"
            results.size() == 1
            results[0].imdbId() == "tt4000000"
    }

    def "SERIES-006-AC-24: the same candidate recommended by two source series is deduplicated"() {
        given: "two completed series, both recommending the same tmdb candidate"
            def source1 = completedSeries("Show 1", "tt0000001", LocalDateTime.now())
            def source2 = completedSeries("Show 2", "tt0000002", LocalDateTime.now())
            seriesRepository.findAll() >> [source1, source2]
            tmdbClient.findTvIdByImdbId("tt0000001") >> Optional.of(1)
            tmdbClient.findTvIdByImdbId("tt0000002") >> Optional.of(2)
            tmdbClient.recommendations(1) >> [candidate(99)]
            tmdbClient.recommendations(2) >> [candidate(99)]
            tmdbClient.externalIds(99) >> Optional.of("tt9999999")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(20) is called"
            def results = recommendationService.recommend(20)

        then: "the candidate appears once"
            results.size() == 1
    }

    def "SERIES-006-AC-25: caps results at the requested limit"() {
        given: "one completed series recommending 40 distinct valid candidates"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            def candidates = (1..40).collect { candidate(it) }
            tmdbClient.recommendations(1) >> candidates
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            (1..40).each { i ->
                tmdbClient.externalIds(i) >> Optional.of("tt" + i.toString().padLeft(7, '0'))
            }

        when: "recommend(5) is called"
            def results = recommendationService.recommend(5)

        then: "only 5 are returned"
            results.size() == 5
    }

    def "SERIES-006-AC-21: the raw candidate pool is capped at 50 before external_ids is resolved"() {
        given: "one completed series recommending 60 distinct candidates"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            def candidates = (1..60).collect { candidate(it) }
            tmdbClient.recommendations(1) >> candidates
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            (1..60).each { i ->
                tmdbClient.externalIds(i) >> Optional.of("tt" + i.toString().padLeft(7, '0'))
            }

        when: "recommend(50) is called"
            recommendationService.recommend(50)

        then: "external_ids is never resolved for a candidate beyond the 50-candidate cap"
            0 * tmdbClient.externalIds(51)
    }
}
