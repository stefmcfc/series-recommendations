package uk.co.stefirby.seriestracker.service

import uk.co.stefirby.seriestracker.client.TmdbCandidate
import uk.co.stefirby.seriestracker.client.TmdbClient
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria
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
        new RecommendationService(seriesRepository, ignoredSeriesRepository, tmdbClient, new TmdbGenreTable(), 20, 50)

    private static SeriesEntity completedSeries(String title, String imdbId, LocalDateTime dateCompleted,
                                                 String genres = null, Integer personalRating = null) {
        def entity = new SeriesEntity(
            title: title,
            imdbId: imdbId,
            status: SeriesStatus.COMPLETED,
            dateCompleted: dateCompleted,
            genres: genres,
            personalRating: personalRating
        )
        return entity
    }

    // Default voteCount (100) is deliberately >= the SERIES-007-AC-25 default minVoteCount
    // (20), and originalLanguage defaults to "en", so pre-existing (Spec 006) tests that
    // don't care about the new output filters aren't inadvertently affected by them.
    private static TmdbCandidate candidate(int tmdbId, String title = "Candidate ${tmdbId}", Integer year = 2020,
                                            BigDecimal voteAverage = new BigDecimal("8.0"), List<Integer> genreIds = [18],
                                            Integer voteCount = 100, String originalLanguage = "en") {
        new TmdbCandidate(tmdbId, title, year, "overview", "/poster.jpg", voteAverage, genreIds, voteCount, originalLanguage)
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
            0 * tmdbClient.discover(_, _)
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

        then: "discover is called with the TMDB ids for Drama (18) and Crime (80), no keywords"
            1 * tmdbClient.discover([18, 80], []) >> [candidate(20)]

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

        then: "discover is never called, and no exception is thrown"
            0 * tmdbClient.discover(_, _)
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

        and: "maxPerSource is raised so the SERIES-007-AC-22 diversity cap (default 3) doesn't interfere with this limit-only test"
            def criteria = new RecommendationCriteria(maxPerSource: 40)

        when: "recommend(5, criteria) is called"
            def results = recommendationService.recommend(5, criteria)

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

    // -- Requirement 1 (SERIES-007-AC-01/02): configurable sourcing caps --

    def "SERIES-007-AC-01: max-source-series cap is configurable via constructor"() {
        given: "a service configured with maxSourceSeries=2, and 3 eligible COMPLETED series"
            def svc = new RecommendationService(seriesRepository, ignoredSeriesRepository, tmdbClient, new TmdbGenreTable(), 2, 50)
            def now = LocalDateTime.now()
            def sources = (1..3).collect {
                completedSeries("Show ${it}", "tt${it.toString().padLeft(7, '0')}", now.minusDays(it))
            }
            seriesRepository.findAll() >> sources
            tmdbClient.findTvIdByImdbId(_) >> Optional.empty()

        when: "recommend(20) is called"
            svc.recommend(20)

        then: "only 2 series are used as sources"
            2 * tmdbClient.findTvIdByImdbId(_) >> Optional.empty()
    }

    def "SERIES-007-AC-02: max-candidates cap is configurable via constructor"() {
        given: "a service configured with maxCandidates=3, one source series recommending 5 candidates"
            def svc = new RecommendationService(seriesRepository, ignoredSeriesRepository, tmdbClient, new TmdbGenreTable(), 20, 3)
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> (1..5).collect { candidate(it) }
            tmdbClient.externalIds(_) >> Optional.empty()

        when: "recommend(20) is called"
            svc.recommend(20)

        then: "external_ids is never resolved beyond the 3-candidate cap"
            0 * tmdbClient.externalIds(4)
            0 * tmdbClient.externalIds(5)
    }

    // -- Requirement 4 (SERIES-007-AC-07..11): directed sourcing via explicit seriesIds --

    def "SERIES-007-AC-08/10: sources exclusively from explicitly-selected series regardless of status"() {
        given: "a WATCHING series with a resolvable imdbId"
            def watching = completedSeries("Watching Show", "tt1111111", LocalDateTime.now())
            watching.status = SeriesStatus.WATCHING
            watching.id = UUID.randomUUID()
            seriesRepository.findAllById([watching.id]) >> [watching]
            tmdbClient.findTvIdByImdbId("tt1111111") >> Optional.of(1)
            tmdbClient.recommendations(1) >> []
            tmdbClient.similar(1) >> []

        and: "criteria selects only the WATCHING series"
            def criteria = new RecommendationCriteria(seriesIds: [watching.id.toString()])

        when: "recommend(20, criteria) is called"
            recommendationService.recommend(20, criteria)

        then: "the automatic (COMPLETED-only) pool is never consulted, and the selected series is sourced"
            0 * seriesRepository.findAll()
            1 * tmdbClient.findTvIdByImdbId("tt1111111") >> Optional.of(1)
    }

    def "SERIES-007-AC-10: a selected series with no imdbId is skipped for title-based sourcing, not fatal"() {
        given: "one explicitly-selected series with no imdbId"
            def s = completedSeries("No Imdb", null, LocalDateTime.now())
            s.id = UUID.randomUUID()
            seriesRepository.findAllById([s.id]) >> [s]
            def criteria = new RecommendationCriteria(seriesIds: [s.id.toString()])

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "no TMDB sourcing call is made for that series and the request doesn't fail"
            0 * tmdbClient.findTvIdByImdbId(_)
            results.isEmpty()
    }

    def "SERIES-007-AC-09: an unknown series id in seriesIds is rejected"() {
        given: "seriesIds references an id that doesn't exist"
            def missingId = UUID.randomUUID()
            seriesRepository.findAllById([missingId]) >> []
            def criteria = new RecommendationCriteria(seriesIds: [missingId.toString()])

        when: "recommend(20, criteria) is called"
            recommendationService.recommend(20, criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-007-AC-09: a malformed seriesIds entry is rejected"() {
        given: "seriesIds contains a non-UUID string"
            def criteria = new RecommendationCriteria(seriesIds: ["not-a-uuid"])

        when: "recommend(20, criteria) is called"
            recommendationService.recommend(20, criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-007-AC-11: an explicit seriesIds pool larger than max-source-series is ordered and truncated"() {
        given: "a service configured with maxSourceSeries=1, and two selected series with different personalRatings"
            def svc = new RecommendationService(seriesRepository, ignoredSeriesRepository, tmdbClient, new TmdbGenreTable(), 1, 50)
            def low = completedSeries("Low", "tt0000001", LocalDateTime.now(), null, 2)
            low.id = UUID.randomUUID()
            def high = completedSeries("High", "tt0000002", LocalDateTime.now(), null, 5)
            high.id = UUID.randomUUID()
            seriesRepository.findAllById([low.id, high.id]) >> [low, high]
            tmdbClient.findTvIdByImdbId(_) >> Optional.empty()
            def criteria = new RecommendationCriteria(seriesIds: [low.id.toString(), high.id.toString()])

        when: "recommend(20, criteria) is called"
            svc.recommend(20, criteria)

        then: "only the higher-rated series (High) is consulted"
            1 * tmdbClient.findTvIdByImdbId("tt0000002") >> Optional.empty()
            0 * tmdbClient.findTvIdByImdbId("tt0000001")
    }

    // -- Requirement 5 (SERIES-007-AC-12..18): directed sourcing via genres/keywords --

    def "SERIES-007-AC-13/14/16: genres param bypasses the watched pool, skips unmapped genre names, tags sourceTitle null"() {
        given: "3 COMPLETED series exist (would normally source title-based candidates)"
            seriesRepository.findAll() >> [
                completedSeries("A", "tt0000001", LocalDateTime.now()),
                completedSeries("B", "tt0000002", LocalDateTime.now()),
                completedSeries("C", "tt0000003", LocalDateTime.now())
            ]
            def criteria = new RecommendationCriteria(genres: ["Drama", "Spy"])

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "no title-based sourcing occurs; discover() is called with Drama's id (18) only -- Spy has no genre mapping"
            0 * tmdbClient.recommendations(_)
            0 * tmdbClient.findTvIdByImdbId(_)
            1 * tmdbClient.discover([18], []) >> [candidate(50, "Drama Show")]
            tmdbClient.externalIds(50) >> Optional.of("tt5000000")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        and: "results have sourceTitle == null"
            results.size() == 1
            results[0].sourceTitle() == null
    }

    def "SERIES-007-AC-15: genres and keywords are combined into a single discover() call"() {
        given: "criteria requests genre Drama and keyword Spy"
            def criteria = new RecommendationCriteria(genres: ["Drama"], keywords: ["Spy"])

        when: "recommend(20, criteria) is called"
            recommendationService.recommend(20, criteria)

        then: "searchKeyword resolves Spy, and discover is called with both resolved ids"
            1 * tmdbClient.searchKeyword("Spy") >> Optional.of(9720)
            1 * tmdbClient.discover([18], [9720]) >> []
    }

    def "SERIES-007-AC-14: an unresolvable keyword is skipped, not an error"() {
        given: "criteria requests a keyword that TMDB has no match for"
            def criteria = new RecommendationCriteria(keywords: ["nonexistent"])

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "discover is called with an empty keyword id list, and no exception is thrown"
            1 * tmdbClient.searchKeyword("nonexistent") >> Optional.empty()
            1 * tmdbClient.discover([], []) >> []
            results.isEmpty()
    }

    def "SERIES-007-AC-17: seriesIds combined with genres is rejected"() {
        given: "criteria sets both seriesIds and genres"
            def criteria = new RecommendationCriteria(seriesIds: [UUID.randomUUID().toString()], genres: ["Drama"])

        when: "recommend(20, criteria) is called"
            recommendationService.recommend(20, criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-007-AC-17: seriesIds combined with keywords is rejected"() {
        given: "criteria sets both seriesIds and keywords"
            def criteria = new RecommendationCriteria(seriesIds: [UUID.randomUUID().toString()], keywords: ["Spy"])

        when: "recommend(20, criteria) is called"
            recommendationService.recommend(20, criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    // -- Requirement 6 (SERIES-007-AC-19/20): rating-weighted source prioritization --

    def "SERIES-007-AC-19: source pool is ordered by personalRating descending, dateCompleted as tiebreaker"() {
        given: "3 COMPLETED series: A (rating 3), B (rating 5), C (rating null)"
            def now = LocalDateTime.now()
            def a = completedSeries("A", "tt0000001", now.minusDays(1), null, 3)
            def b = completedSeries("B", "tt0000002", now.minusDays(2), null, 5)
            def c = completedSeries("C", "tt0000003", now.minusDays(3), null, null)
            seriesRepository.findAll() >> [a, b, c]
            tmdbClient.findTvIdByImdbId(_) >> Optional.empty()

        when: "recommend(20) is called"
            recommendationService.recommend(20)

        then: "B (highest rating) is consulted first"
            1 * tmdbClient.findTvIdByImdbId("tt0000002") >> Optional.empty()

        then: "A (rating 3) is consulted next"
            1 * tmdbClient.findTvIdByImdbId("tt0000001") >> Optional.empty()

        then: "C (null rating) is consulted last"
            1 * tmdbClient.findTvIdByImdbId("tt0000003") >> Optional.empty()
    }

    def "SERIES-007-AC-20: minSourceRating excludes series below the threshold, including null ratings"() {
        given: "series A (rating 2), B (rating 4), C (rating null)"
            def a = completedSeries("A", "tt0000001", LocalDateTime.now(), null, 2)
            def b = completedSeries("B", "tt0000002", LocalDateTime.now(), null, 4)
            def c = completedSeries("C", "tt0000003", LocalDateTime.now(), null, null)
            seriesRepository.findAll() >> [a, b, c]
            tmdbClient.findTvIdByImdbId(_) >> Optional.empty()
            def criteria = new RecommendationCriteria(minSourceRating: 3)

        when: "recommend(20, criteria) is called"
            recommendationService.recommend(20, criteria)

        then: "only B is used as a source"
            1 * tmdbClient.findTvIdByImdbId("tt0000002") >> Optional.empty()
            0 * tmdbClient.findTvIdByImdbId("tt0000001")
            0 * tmdbClient.findTvIdByImdbId("tt0000003")
    }

    def "SERIES-007-AC-20: minSourceRating out of range (1-5) is rejected"() {
        given: "an out-of-range minSourceRating"
            def criteria = new RecommendationCriteria(minSourceRating: 9)

        when: "recommend(20, criteria) is called"
            recommendationService.recommend(20, criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-007-AC-20: minSourceRating is a no-op in genre/keyword direct-sourcing mode"() {
        given: "criteria requests genres directly along with a minSourceRating (no source pool to apply it to)"
            def criteria = new RecommendationCriteria(genres: ["Drama"], minSourceRating: 5)

        when: "recommend(20, criteria) is called"
            recommendationService.recommend(20, criteria)

        then: "discover is still called normally, unaffected by minSourceRating"
            1 * tmdbClient.discover([18], []) >> []
    }

    // -- Requirement 7 (SERIES-007-AC-21/22): output ranking & diversity cap --

    def "SERIES-007-AC-21: candidates from a 5-star source outrank otherwise-similar candidates from a 3-star source"() {
        given: "two completed series (personalRating 5 and 3), each producing one candidate with the same tmdbRating"
            def fiveStar = completedSeries("Five Star", "tt0000001", LocalDateTime.now(), null, 5)
            def threeStar = completedSeries("Three Star", "tt0000002", LocalDateTime.now(), null, 3)
            seriesRepository.findAll() >> [fiveStar, threeStar]
            tmdbClient.findTvIdByImdbId("tt0000001") >> Optional.of(1)
            tmdbClient.findTvIdByImdbId("tt0000002") >> Optional.of(2)
            tmdbClient.recommendations(1) >> [candidate(10, "X", 2020, new BigDecimal("7.0"))]
            tmdbClient.recommendations(2) >> [candidate(20, "Y", 2020, new BigDecimal("7.0"))]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(20) is called"
            def results = recommendationService.recommend(20)

        then: "X (from the 5-star source) is ranked ahead of Y (from the 3-star source)"
            results*.title() == ["X", "Y"]
    }

    def "SERIES-007-AC-21: a candidate sourced from a null-personalRating source contributes 0 for that term"() {
        given: "two completed series, one unrated, each producing one candidate with the same tmdbRating"
            def unrated = completedSeries("Unrated", "tt0000001", LocalDateTime.now(), null, null)
            def rated = completedSeries("Rated", "tt0000002", LocalDateTime.now(), null, 4)
            seriesRepository.findAll() >> [rated, unrated]
            tmdbClient.findTvIdByImdbId("tt0000001") >> Optional.of(1)
            tmdbClient.findTvIdByImdbId("tt0000002") >> Optional.of(2)
            tmdbClient.recommendations(1) >> [candidate(10, "FromUnrated", 2020, new BigDecimal("7.0"))]
            tmdbClient.recommendations(2) >> [candidate(20, "FromRated", 2020, new BigDecimal("7.0"))]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(20) is called"
            def results = recommendationService.recommend(20)

        then: "the candidate from the rated source outranks the one from the unrated source"
            results*.title() == ["FromRated", "FromUnrated"]
    }

    def "SERIES-007-AC-22: maxPerSource caps candidates attributed to one source series (default 3)"() {
        given: "one source series producing 6 raw candidates"
            def source = completedSeries("Breaking Bad", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            def candidates = (1..6).collect { candidate(it) }
            tmdbClient.recommendations(1) >> candidates
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            (1..6).each { i -> tmdbClient.externalIds(i) >> Optional.of("tt" + i.toString().padLeft(7, '0')) }

        when: "recommend(20) is called"
            def results = recommendationService.recommend(20)

        then: "at most 3 of the results are attributed to that sourceTitle"
            results.size() == 3
            results.every { it.sourceTitle() == "Breaking Bad" }
    }

    def "SERIES-007-AC-22: maxPerSource is overridable via the criteria param"() {
        given: "the same setup as the default-cap test, but maxPerSource=6"
            def source = completedSeries("Breaking Bad", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            def candidates = (1..6).collect { candidate(it) }
            tmdbClient.recommendations(1) >> candidates
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            (1..6).each { i -> tmdbClient.externalIds(i) >> Optional.of("tt" + i.toString().padLeft(7, '0')) }
            def criteria = new RecommendationCriteria(maxPerSource: 6)

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "all 6 candidates are returned"
            results.size() == 6
    }

    def "SERIES-007-AC-22: candidates with a null sourceTitle are not subject to the diversity cap"() {
        given: "5 genre-sourced (sourceTitle null) candidates, exceeding the default maxPerSource of 3"
            def criteria = new RecommendationCriteria(genres: ["Drama"])
            def candidates = (1..5).collect { candidate(it) }
            (1..5).each { i -> tmdbClient.externalIds(i) >> Optional.of("tt" + i.toString().padLeft(7, '0')) }
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "discover supplies the 5 candidates, and none are dropped by the diversity cap"
            1 * tmdbClient.discover([18], []) >> candidates
            results.size() == 5
    }

    // -- Requirement 8 (SERIES-007-AC-23..29): output filters --

    def "SERIES-007-AC-24: minTmdbRating excludes candidates below the threshold"() {
        given: "one source with two candidates: tmdbRating 5.0 and 8.0"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> [
                candidate(10, "Low", 2020, new BigDecimal("5.0")),
                candidate(20, "High", 2020, new BigDecimal("8.0"))
            ]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            def criteria = new RecommendationCriteria(minTmdbRating: new BigDecimal("6.0"))

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "only the high-rated candidate remains"
            results.size() == 1
            results[0].title() == "High"
    }

    def "SERIES-007-AC-25: minVoteCount defaults to 20 when not supplied"() {
        given: "candidate with voteCount 5, candidate with voteCount 25"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> [
                candidate(10, "Low Votes", 2020, new BigDecimal("8.0"), [18], 5),
                candidate(20, "High Votes", 2020, new BigDecimal("8.0"), [18], 25)
            ]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(20) is called with no minVoteCount param"
            def results = recommendationService.recommend(20)

        then: "only the voteCount-25 candidate is present"
            results.size() == 1
            results[0].title() == "High Votes"
    }

    def "SERIES-007-AC-25: minVoteCount=0 explicitly disables the filter"() {
        given: "a candidate with voteCount 5, below the default of 20"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> [candidate(10, "Low Votes", 2020, new BigDecimal("8.0"), [18], 5)]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            def criteria = new RecommendationCriteria(minVoteCount: 0)

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "the low-vote-count candidate is not excluded"
            results.size() == 1
    }

    def "SERIES-007-AC-26: a null year is excluded once yearMin/yearMax is set"() {
        given: "candidate with year null, candidate with year 2020"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> [
                candidate(10, "No Year", null),
                candidate(20, "Has Year", 2020)
            ]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            def criteria = new RecommendationCriteria(yearMin: 2015)

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "only the year-2020 candidate is present"
            results.size() == 1
            results[0].title() == "Has Year"
    }

    def "SERIES-007-AC-26: yearMin/yearMax exclude candidates outside the inclusive range"() {
        given: "candidates with year 2010, 2015, 2020"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> [
                candidate(10, "Old", 2010),
                candidate(20, "Mid", 2015),
                candidate(30, "New", 2020)
            ]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            tmdbClient.externalIds(30) >> Optional.of("tt1000030")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            def criteria = new RecommendationCriteria(yearMin: 2012, yearMax: 2018)

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "only Mid (2015) is within the inclusive range"
            results.size() == 1
            results[0].title() == "Mid"
    }

    def "SERIES-007-AC-27: excludeGenres excludes candidates matching any resolved display genre"() {
        given: "candidates with Drama (18) and Comedy (35) genres"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> [
                candidate(10, "Drama Show", 2020, new BigDecimal("8.0"), [18]),
                candidate(20, "Comedy Show", 2020, new BigDecimal("8.0"), [35])
            ]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            def criteria = new RecommendationCriteria(excludeGenres: ["Drama"])

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "the Drama-genre candidate is excluded"
            results.size() == 1
            results[0].title() == "Comedy Show"
    }

    def "SERIES-007-AC-28: language excludes candidates whose originalLanguage doesn't case-insensitively match"() {
        given: "candidates with originalLanguage en and fr"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> [
                candidate(10, "English Show", 2020, new BigDecimal("8.0"), [18], 100, "en"),
                candidate(20, "French Show", 2020, new BigDecimal("8.0"), [18], 100, "fr")
            ]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            def criteria = new RecommendationCriteria(language: "EN")

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "only the English-language candidate is present"
            results.size() == 1
            results[0].title() == "English Show"
    }

    def "SERIES-007-AC-29: Requirement 8 filters are applied before the diversity cap"() {
        given: "one source producing 4 candidates, 2 of which fail minTmdbRating; maxPerSource default is 3"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> [
                candidate(10, "A", 2020, new BigDecimal("9.0")),
                candidate(20, "B", 2020, new BigDecimal("9.0")),
                candidate(30, "C", 2020, new BigDecimal("2.0")),
                candidate(40, "D", 2020, new BigDecimal("2.0"))
            ]
            [10, 20, 30, 40].each { i -> tmdbClient.externalIds(i) >> Optional.of("tt" + i.toString().padLeft(7, '0')) }
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            def criteria = new RecommendationCriteria(minTmdbRating: new BigDecimal("5.0"))

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "the two low-rated candidates are filtered out (leaving only 2, well under the diversity cap)"
            results.size() == 2
            results*.title().sort() == ["A", "B"]
    }

    def "SERIES-012-AC-02: candidate poster URLs are built from TmdbClient.POSTER_BASE_URL"() {
        given: "a TMDB candidate with a poster_path"
            tmdbClient.discover(_, _) >> [
                new TmdbCandidate(99, "Discovered Show", 2020, "overview", "/poster.jpg",
                    new BigDecimal("7.5"), [18], 100, "en")
            ]
            tmdbClient.externalIds(99) >> Optional.of("tt0000099")
            def criteria = new RecommendationCriteria(genres: ["Drama"])

        when: "recommendations are requested"
            def result = recommendationService.recommend(10, criteria)

        then: "the poster URL is built from TmdbClient's own constant, not a private duplicate"
            result[0].posterUrl() == TmdbClient.POSTER_BASE_URL + "/poster.jpg"
    }
}
