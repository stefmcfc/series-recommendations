package uk.co.stefirby.seriestracker.service.recommendation

import uk.co.stefirby.seriestracker.client.tmdb.DiscoverFilters
import uk.co.stefirby.seriestracker.client.tmdb.TmdbCandidate
import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.model.SeriesStatus
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import uk.co.stefirby.seriestracker.service.TmdbGenreTable
import spock.lang.Specification

import java.time.Clock
import java.time.LocalDateTime

class RecommendationSourcingServiceSpec extends Specification {

    SeriesRepository seriesRepository = Mock()
    TmdbClient tmdbClient = Mock()

    RecommendationSourcingService sourcingService =
        new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20, 200,
            new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50))

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

    private static TmdbCandidate candidate(int tmdbId, String title = "Candidate ${tmdbId}", Integer year = 2020,
                                            BigDecimal voteAverage = new BigDecimal("8.0"), List<Integer> genreIds = [18],
                                            Integer voteCount = 100, String originalLanguage = "en") {
        new TmdbCandidate(tmdbId, title, year, "overview", "/poster.jpg", voteAverage, genreIds, voteCount, originalLanguage, [])
    }

    // -- Automatic pool sourcing (SERIES-006-AC-14/15/16/17/20, SERIES-008-AC-04/05) --

    def "SERIES-006-AC-20: empty watched pool returns an empty list without calling TMDB"() {
        given: "no COMPLETED series with imdbId exist"
            seriesRepository.findAll() >> []

        when: "sourceFromPool is called"
            def result = sourcingService.sourceFromPool(new RecommendationCriteria(), 20)

        then: "no TmdbClient sourcing calls are made, and the result is empty"
            0 * tmdbClient.findTvIdByImdbId(_)
            0 * tmdbClient.recommendations(_)
            0 * tmdbClient.similar(_)
            0 * tmdbClient.discover(_, _, _, _)
            result.isEmpty()
    }

    def "SERIES-006-AC-20: a watched pool with only non-COMPLETED or imdbId-less series is treated as empty"() {
        given: "one WATCHING series with an imdbId, and one COMPLETED series with no imdbId"
            def watching = completedSeries("Watching Show", "tt1111111", LocalDateTime.now())
            watching.status = SeriesStatus.WATCHING
            def noImdb = completedSeries("No Imdb Show", null, LocalDateTime.now())
            seriesRepository.findAll() >> [watching, noImdb]

        when: "sourceFromPool is called"
            def result = sourcingService.sourceFromPool(new RecommendationCriteria(), 20)

        then: "no TmdbClient sourcing calls are made"
            0 * tmdbClient.findTvIdByImdbId(_)
            result.isEmpty()
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

        when: "sourceFromPool is called"
            sourcingService.sourceFromPool(new RecommendationCriteria(), 20)

        then: "only the 20 most recently completed series are used as sources"
            20 * tmdbClient.findTvIdByImdbId(_) >> Optional.of(1)
            20 * tmdbClient.recommendations(_) >> []
            20 * tmdbClient.similar(_) >> []
    }

    def "SERIES-008-AC-04: a COMPLETED series with excludeFromRecommendations=true is skipped by the automatic pool"() {
        given: "one eligible COMPLETED series and one excluded COMPLETED series, both with an imdbId"
            def eligible = completedSeries("Eligible Show", "tt1111111", LocalDateTime.now())
            def excluded = completedSeries("Excluded Show", "tt2222222", LocalDateTime.now())
            excluded.excludeFromRecommendations = true
            seriesRepository.findAll() >> [eligible, excluded]
            tmdbClient.recommendations(1) >> []
            tmdbClient.similar(1) >> []

        when: "sourceFromPool is called with no source override"
            sourcingService.sourceFromPool(new RecommendationCriteria(), 20)

        then: "only the non-excluded series is consulted as a source"
            1 * tmdbClient.findTvIdByImdbId("tt1111111") >> Optional.of(1)
            0 * tmdbClient.findTvIdByImdbId("tt2222222")
    }

    def "SERIES-034-AC-01: an explicit seriesIds selection IS filtered by excludeFromRecommendations"() {
        given: "a COMPLETED series with excludeFromRecommendations=true"
            def excluded = completedSeries("Excluded Show", "tt3333333", LocalDateTime.now())
            excluded.excludeFromRecommendations = true
            excluded.id = UUID.randomUUID()
            seriesRepository.findAllById([excluded.id]) >> [excluded]

        and: "criteria explicitly selects that series"
            def criteria = new RecommendationCriteria(seriesIds: [excluded.id.toString()])

        when: "sourceFromPool is called"
            def result = sourcingService.sourceFromPool(criteria, 20)

        then: "the excluded series is NOT consulted, and the pool is empty"
            0 * tmdbClient.findTvIdByImdbId("tt3333333")
            result.isEmpty()
    }

    def "SERIES-034-AC-02: an all-excluded seriesIds selection yields an empty pool, not an error"() {
        given: "two excluded COMPLETED series"
            def a = completedSeries("A", "tt1111111", LocalDateTime.now())
            a.excludeFromRecommendations = true
            a.id = UUID.randomUUID()
            def b = completedSeries("B", "tt2222222", LocalDateTime.now())
            b.excludeFromRecommendations = true
            b.id = UUID.randomUUID()
            seriesRepository.findAllById([a.id, b.id]) >> [a, b]
            def criteria = new RecommendationCriteria(seriesIds: [a.id.toString(), b.id.toString()])

        when: "sourceFromPool is called"
            def result = sourcingService.sourceFromPool(criteria, 20)

        then: "no exception is thrown and the result is empty"
            result.isEmpty()
            0 * tmdbClient.findTvIdByImdbId(_)
    }

    def "SERIES-034-AC-03: a mixed seriesIds selection sources only the non-excluded series"() {
        given: "one excluded and one eligible COMPLETED series, both explicitly selected"
            def excluded = completedSeries("Excluded", "tt1111111", LocalDateTime.now())
            excluded.excludeFromRecommendations = true
            excluded.id = UUID.randomUUID()
            def eligible = completedSeries("Eligible", "tt2222222", LocalDateTime.now())
            eligible.id = UUID.randomUUID()
            seriesRepository.findAllById([excluded.id, eligible.id]) >> [excluded, eligible]
            def criteria = new RecommendationCriteria(seriesIds: [excluded.id.toString(), eligible.id.toString()])

        when: "sourceFromPool is called"
            sourcingService.sourceFromPool(criteria, 20)

        then: "only the eligible series is consulted"
            0 * tmdbClient.findTvIdByImdbId("tt1111111")
            1 * tmdbClient.findTvIdByImdbId("tt2222222") >> Optional.empty()
    }

    def "SERIES-006-AC-16: falls back to similar() when recommendations() is empty"() {
        given: "one completed series with an imdbId resolvable to a tmdb id"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]

        and: "recommendations() returns nothing, forcing a similar() fallback"
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(42)
            tmdbClient.recommendations(42) >> []
            tmdbClient.similar(42) >> [candidate(100)]

        when: "sourceFromPool is called"
            sourcingService.sourceFromPool(new RecommendationCriteria(), 20)

        then: "similar() is called for that source series"
            1 * tmdbClient.similar(42) >> [candidate(100)]
    }

    def "SERIES-006-AC-15: title-sourced candidates are linked to the source series"() {
        given: "one completed series"
            def source = completedSeries("Breaking Bad", "tt0903747", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.recommendations(1396) >> [candidate(2316, "Better Call Saul")]

        when: "sourceFromPool is called"
            def result = sourcingService.sourceFromPool(new RecommendationCriteria(), 20)

        then: "the raw candidate is tagged with the source series"
            result.size() == 1
            result[0].sourceSeries().title == "Breaking Bad"
            result[0].candidate().title() == "Better Call Saul"
    }

    def "SERIES-006-AC-17: a source series whose imdbId cannot be resolved to a tmdb id is skipped, not fatal"() {
        given: "one completed series whose imdbId cannot be resolved"
            def source = completedSeries("Unresolvable Show", "tt0000001", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt0000001") >> Optional.empty()

        when: "sourceFromPool is called"
            def result = sourcingService.sourceFromPool(new RecommendationCriteria(), 20)

        then: "no recommendations/similar calls are made for that series, and no exception is thrown"
            0 * tmdbClient.recommendations(_)
            0 * tmdbClient.similar(_)
            result.isEmpty()
    }

    def "SERIES-006-AC-18/19: supplements with genre-based discovery only when short on title-based candidates"() {
        given: "one completed series (genres: 'Drama, Crime') whose title-based sourcing yields 1 candidate"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now(), "Drama, Crime")
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> [candidate(10)]

        when: "sourceFromPool(criteria, 20) is called (limit 20, only 1 title-based candidate)"
            def result = sourcingService.sourceFromPool(new RecommendationCriteria(), 20)

        then: "discover is called with the TMDB ids for Drama (18) and Crime (80), no keywords, and DiscoverFilters.NONE (genreBasedSupplement never applies a floor, SERIES-029-AC-08/SERIES-031-AC-06)"
            1 * tmdbClient.discover([18, 80], [], "popularity.desc", DiscoverFilters.NONE) >> [candidate(20)]

        and: "both the title-based and genre-based candidates are present"
            result.size() == 2
    }

    def "SERIES-006-AC-18: genre names with no TMDB mapping are skipped, not an error"() {
        given: "one completed series whose only genre has no TMDB mapping"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now(), "Thriller")
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> []
            tmdbClient.similar(1) >> []

        when: "sourceFromPool is called"
            def result = sourcingService.sourceFromPool(new RecommendationCriteria(), 20)

        then: "discover is never called, and no exception is thrown"
            0 * tmdbClient.discover(_, _, _, _)
            result.isEmpty()
    }

    // -- Requirement 1 (SERIES-007-AC-01): configurable max-source-series --

    def "SERIES-007-AC-01: max-source-series cap is configurable via constructor"() {
        given: "a sourcing service configured with maxSourceSeries=2, and 3 eligible COMPLETED series"
            def svc = new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 2, 200,
                new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50))
            def now = LocalDateTime.now()
            def sources = (1..3).collect {
                completedSeries("Show ${it}", "tt${it.toString().padLeft(7, '0')}", now.minusDays(it))
            }
            seriesRepository.findAll() >> sources
            tmdbClient.findTvIdByImdbId(_) >> Optional.empty()

        when: "sourceFromPool is called"
            svc.sourceFromPool(new RecommendationCriteria(), 20)

        then: "only 2 series are used as sources"
            2 * tmdbClient.findTvIdByImdbId(_) >> Optional.empty()
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

        when: "sourceFromPool is called"
            sourcingService.sourceFromPool(criteria, 20)

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

        when: "sourceFromPool is called"
            def result = sourcingService.sourceFromPool(criteria, 20)

        then: "no TMDB sourcing call is made for that series and the request doesn't fail"
            0 * tmdbClient.findTvIdByImdbId(_)
            result.isEmpty()
    }

    def "SERIES-007-AC-09: an unknown series id in seriesIds is rejected"() {
        given: "seriesIds references an id that doesn't exist"
            def missingId = UUID.randomUUID()
            seriesRepository.findAllById([missingId]) >> []
            def criteria = new RecommendationCriteria(seriesIds: [missingId.toString()])

        when: "sourceFromPool is called"
            sourcingService.sourceFromPool(criteria, 20)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-007-AC-09: a malformed seriesIds entry is rejected"() {
        given: "seriesIds contains a non-UUID string"
            def criteria = new RecommendationCriteria(seriesIds: ["not-a-uuid"])

        when: "sourceFromPool is called"
            sourcingService.sourceFromPool(criteria, 20)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-007-AC-11: an explicit seriesIds pool larger than max-source-series is ordered and truncated"() {
        given: "a sourcing service configured with maxSourceSeries=1, and two selected series with different personalRatings"
            def svc = new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 1, 200,
                new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50))
            def low = completedSeries("Low", "tt0000001", LocalDateTime.now(), null, 2)
            low.id = UUID.randomUUID()
            def high = completedSeries("High", "tt0000002", LocalDateTime.now(), null, 5)
            high.id = UUID.randomUUID()
            seriesRepository.findAllById([low.id, high.id]) >> [low, high]
            tmdbClient.findTvIdByImdbId(_) >> Optional.empty()
            def criteria = new RecommendationCriteria(seriesIds: [low.id.toString(), high.id.toString()])

        when: "sourceFromPool is called"
            svc.sourceFromPool(criteria, 20)

        then: "only the higher-rated series (High) is consulted"
            1 * tmdbClient.findTvIdByImdbId("tt0000002") >> Optional.empty()
            0 * tmdbClient.findTvIdByImdbId("tt0000001")
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

        when: "sourceFromPool is called"
            sourcingService.sourceFromPool(new RecommendationCriteria(), 20)

        then: "B (highest rating) is consulted first"
            1 * tmdbClient.findTvIdByImdbId("tt0000002") >> Optional.empty()

        then: "A (rating 3) is consulted next"
            1 * tmdbClient.findTvIdByImdbId("tt0000001") >> Optional.empty()

        then: "C (null rating) is consulted last"
            1 * tmdbClient.findTvIdByImdbId("tt0000003") >> Optional.empty()
    }

    def "SERIES-045-AC-02: a low-rated series is no longer excluded from the automatic pool"() {
        given: "a COMPLETED series with a low personalRating and an imdbId"
            def series = completedSeries("Low Rated Show", "tt0000001", LocalDateTime.now(), null, 1)
            seriesRepository.findAll() >> [series]

        when: "sourceFromPool is called with no rating-related criteria set"
            sourcingService.sourceFromPool(new RecommendationCriteria(), 20)

        then: "the low-rated series is still used as a source"
            1 * tmdbClient.findTvIdByImdbId("tt0000001") >> Optional.empty()
    }

    def "SERIES-045-AC-02: an explicitly-selected low-rated series is never dropped"() {
        given: "a low-rated series explicitly named in seriesIds"
            def series = completedSeries("Low Rated Show", "tt0000002", LocalDateTime.now(), null, 1)
            series.id = UUID.randomUUID()
            seriesRepository.findAllById([series.id]) >> [series]
            def criteria = new RecommendationCriteria(seriesIds: [series.id.toString()])

        when: "sourceFromPool is called"
            sourcingService.sourceFromPool(criteria, 20)

        then: "the series is consulted regardless of its rating"
            1 * tmdbClient.findTvIdByImdbId("tt0000002") >> Optional.empty()
    }

    // -- Requirement 5 (SERIES-007-AC-12..18): directed sourcing via genres/keywords --

    def "SERIES-007-AC-13/14/16: genres param bypasses the watched pool, skips unmapped genre names, tags candidate with no source"() {
        given: "criteria requests Drama and Spy (Spy has no TMDB genre mapping)"
            def criteria = new RecommendationCriteria(genres: ["Drama", "Spy"])

        when: "sourceByGenreOrKeyword is called"
            def result = sourcingService.sourceByGenreOrKeyword(criteria)

        then: "discover() is called with Drama's id (18) only -- Spy has no genre mapping"
            1 * tmdbClient.discover([18], [], "popularity.desc", new DiscoverFilters(200, null, null, null, null, null, [])) >> [candidate(50, "Drama Show")]

        and: "the candidate has no linked source series"
            result.size() == 1
            result[0].sourceSeries() == null
    }

    // -- Spec 044 (SERIES-044-AC-04/05/06): excludeGenres resolved and forwarded as DiscoverFilters.excludeGenreIds --

    def "SERIES-044-AC-04: sourceByGenreOrKeyword resolves excludeGenres and passes them to discover"() {
        given: "criteria with genres=[Drama] and excludeGenres=[Comedy]"
            def criteria = new RecommendationCriteria(genres: ["Drama"], excludeGenres: ["Comedy"])

        when: "sourceByGenreOrKeyword is called"
            sourcingService.sourceByGenreOrKeyword(criteria)

        then: "discover is called with with_genres resolving Drama (18) and without_genres resolving Comedy (35)"
            1 * tmdbClient.discover([18], [], _, { DiscoverFilters f -> f.excludeGenreIds() == [35] }) >> []
    }

    def "SERIES-044-AC-05: an unrecognized excludeGenres entry doesn't reach DiscoverFilters"() {
        given: "criteria with an excludeGenres entry TMDB's fixed genre table doesn't cover"
            def criteria = new RecommendationCriteria(excludeGenres: ["NotARealGenre"])

        when: "sourceByGenreOrKeyword is called"
            sourcingService.sourceByGenreOrKeyword(criteria)

        then: "discover is called with an empty excludeGenreIds, not an error"
            1 * tmdbClient.discover(_, _, _, { DiscoverFilters f -> f.excludeGenreIds().isEmpty() }) >> []
    }

    def "SERIES-044-AC-06: no excludeGenres means an empty excludeGenreIds is sent"() {
        given: "criteria with genres set but no excludeGenres"
            def criteria = new RecommendationCriteria(genres: ["Drama"])

        when: "sourceByGenreOrKeyword is called"
            sourcingService.sourceByGenreOrKeyword(criteria)

        then: "discover is called with an empty excludeGenreIds"
            1 * tmdbClient.discover(_, _, _, { DiscoverFilters f -> f.excludeGenreIds().isEmpty() }) >> []
    }

    def "SERIES-007-AC-15: genres and keywords are combined into a single discover() call"() {
        given: "criteria requests genre Drama and keyword Spy"
            def criteria = new RecommendationCriteria(genres: ["Drama"], keywords: ["Spy"])

        when: "sourceByGenreOrKeyword is called"
            sourcingService.sourceByGenreOrKeyword(criteria)

        then: "searchKeyword resolves Spy, and discover is called with both resolved ids"
            1 * tmdbClient.searchKeyword("Spy") >> Optional.of(9720)
            1 * tmdbClient.discover([18], [9720], "popularity.desc", new DiscoverFilters(200, null, null, null, null, null, [])) >> []
    }

    def "SERIES-007-AC-14: an unresolvable keyword is skipped, not an error"() {
        given: "criteria requests a keyword that TMDB has no match for"
            def criteria = new RecommendationCriteria(keywords: ["nonexistent"])

        when: "sourceByGenreOrKeyword is called"
            def result = sourcingService.sourceByGenreOrKeyword(criteria)

        then: "discover is called with an empty keyword id list, and no exception is thrown"
            1 * tmdbClient.searchKeyword("nonexistent") >> Optional.empty()
            1 * tmdbClient.discover([], [], "popularity.desc", new DiscoverFilters(200, null, null, null, null, null, [])) >> []
            result.isEmpty()
    }

    // -- Spec 022, Requirement 2 (SERIES-022-AC-07): directed sourcing -- trending --

    def "SERIES-022-AC-07: trendingWindow defaults to 'week' when not supplied"() {
        given: "criteria requests trending mode with no trendingWindow"
            def criteria = new RecommendationCriteria(sourceMode: "trending")

        when: "sourceTrending is called"
            sourcingService.sourceTrending(criteria)

        then: "TmdbClient.trending is called with 'week'"
            1 * tmdbClient.trending("week") >> []
    }

    def "SERIES-022-AC-07: an explicit trendingWindow is passed through to TmdbClient.trending"() {
        given: "criteria requests trending mode with trendingWindow=day"
            def criteria = new RecommendationCriteria(sourceMode: "trending", trendingWindow: "day")

        when: "sourceTrending is called"
            sourcingService.sourceTrending(criteria)

        then: "TmdbClient.trending is called with 'day'"
            1 * tmdbClient.trending("day") >> []
    }

    // -- Spec 022, Requirement 3 (SERIES-022-AC-11..15) / Spec 024 (SERIES-024-AC-09/10): directed sourcing -- top rated --

    def "SERIES-024-AC-10: topRated mode sources via discoverTopRated with the mode-aware 200 default when minVoteCount is unset"() {
        given: "no explicit minVoteCount (defaults to 200 for topRated, superseding SERIES-022-AC-11's 20)"
            def criteria = new RecommendationCriteria(sourceMode: "topRated")

        when: "sourceTopRated is called"
            sourcingService.sourceTopRated(criteria)

        then: "discoverTopRated is called with 200, not 20"
            1 * tmdbClient.discoverTopRated(200, "vote_average.desc") >> []
    }

    def "SERIES-022-AC-11/SERIES-024-AC-13: an explicit minVoteCount overrides the topRated 200 default"() {
        given: "criteria sets minVoteCount to 100"
            def criteria = new RecommendationCriteria(sourceMode: "topRated", minVoteCount: 100)

        when: "sourceTopRated is called"
            sourcingService.sourceTopRated(criteria)

        then: "discoverTopRated is called with the explicit 100, not the 200 default"
            1 * tmdbClient.discoverTopRated(100, "vote_average.desc") >> []
    }

    // -- Spec 025: TMDB-native sort_by for topRated/genre modes --

    def "SERIES-025-AC-05: topRated defaults discoverSortBy to vote_average.desc"() {
        given: "criteria with sourceMode=topRated and no discoverSortBy"
            def criteria = new RecommendationCriteria(sourceMode: "topRated")

        when: "sourceTopRated is called"
            sourcingService.sourceTopRated(criteria)

        then: "discoverTopRated is called with vote_average.desc"
            1 * tmdbClient.discoverTopRated(200, "vote_average.desc") >> []
    }

    def "SERIES-025-AC-05: topRated forwards an explicit discoverSortBy"() {
        given: "criteria requesting popularity.desc"
            def criteria = new RecommendationCriteria(sourceMode: "topRated", discoverSortBy: "popularity.desc")

        when: "sourceTopRated is called"
            sourcingService.sourceTopRated(criteria)

        then: "discoverTopRated is called with popularity.desc"
            1 * tmdbClient.discoverTopRated(200, "popularity.desc") >> []
    }

    def "SERIES-025-AC-06: genre-directed sourcing defaults discoverSortBy to popularity.desc"() {
        given: "criteria requesting genres, no discoverSortBy"
            def criteria = new RecommendationCriteria(genres: ["Drama"])

        when: "sourceByGenreOrKeyword is called"
            sourcingService.sourceByGenreOrKeyword(criteria)

        then: "discover is called with popularity.desc"
            1 * tmdbClient.discover([18], [], "popularity.desc", new DiscoverFilters(200, null, null, null, null, null, [])) >> []
    }

    def "SERIES-025-AC-06: genre-directed sourcing forwards an explicit discoverSortBy"() {
        given: "criteria requesting genres and an explicit discoverSortBy"
            def criteria = new RecommendationCriteria(genres: ["Drama"], discoverSortBy: "vote_count.desc")

        when: "sourceByGenreOrKeyword is called"
            sourcingService.sourceByGenreOrKeyword(criteria)

        then: "discover is called with vote_count.desc"
            1 * tmdbClient.discover([18], [], "vote_count.desc", new DiscoverFilters(200, null, null, null, null, null, [])) >> []
    }

    // -- Spec 029, Requirement 2 (SERIES-029-AC-06..09): genre-directed sourcing vote-count floor --

    def "SERIES-029-AC-07: sourceByGenreOrKeyword sources via discover with the configured 200 default when minVoteCount is unset"() {
        given: "a sourcing service with defaultMinVoteCount=200"
            def svc = new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20, 200,
                new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50))
            def criteria = new RecommendationCriteria(genres: ["Crime"])

        when: "sourceByGenreOrKeyword is called with genres=['Crime'], no minVoteCount"
            svc.sourceByGenreOrKeyword(criteria)

        then: "discover is called with minVoteCount=200"
            1 * tmdbClient.discover(_, _, _, { DiscoverFilters f -> f.minVoteCount() == 200 }) >> []
    }

    def "SERIES-029-AC-07/SERIES-029-AC-09: an explicit minVoteCount overrides the 200 default"() {
        given: "a sourcing service with defaultMinVoteCount=200"
            def svc = new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20, 200,
                new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50))
            def criteria = new RecommendationCriteria(genres: ["Crime"], minVoteCount: 5)

        when: "sourceByGenreOrKeyword is called with genres=['Crime'], minVoteCount=5"
            svc.sourceByGenreOrKeyword(criteria)

        then: "discover is called with the explicit value, not the 200 default"
            1 * tmdbClient.discover(_, _, _, { DiscoverFilters f -> f.minVoteCount() == 5 }) >> []
    }

    def "SERIES-029-AC-08: genreBasedSupplement still calls discover with minVoteCount=0"() {
        given: "a sourcing service and a completed series whose title-based sourcing yields nothing"
            seriesRepository.findAll() >> [completedSeries("Show", "tt0000001", LocalDateTime.now(), "Crime")]
            tmdbClient.findTvIdByImdbId(_) >> Optional.empty()

        when: "sourceFromPool falls back to the genre-frequency supplement"
            sourcingService.sourceFromPool(new RecommendationCriteria(), 20)

        then: "discover is called with minVoteCount=0, unchanged from before this spec"
            1 * tmdbClient.discover(_, [], RecommendationDefaults.DEFAULT_GENRE_SORT_BY, DiscoverFilters.NONE) >> []
    }

    // -- Spec 031, Requirement 2 (SERIES-031-AC-05..07): Custom Search pre-fetch minTmdbRating/year filters --

    def "SERIES-031-AC-05: Custom Search sourcing passes minTmdbRating/year to discover"() {
        given: "criteria directed by genre with minTmdbRating and a year range set"
            def criteria = new RecommendationCriteria(genres: ["Comedy"], minTmdbRating: new BigDecimal("7.0"),
                yearMin: 2020, yearMax: 2024)

        when: "sourceByGenreOrKeyword runs"
            sourcingService.sourceByGenreOrKeyword(criteria)

        then: "TmdbClient.discover was called with a DiscoverFilters carrying the same values"
            1 * tmdbClient.discover(_, _, _, { DiscoverFilters f ->
                f.minTmdbRating() == new BigDecimal("7.0") && f.yearMin() == 2020 && f.yearMax() == 2024
            }) >> []
    }

    def "SERIES-031-AC-06: the genre-based top-up is unaffected by this spec"() {
        given: "a Use My Series request with minTmdbRating/year set (should never reach the top-up call)"
            def criteria = new RecommendationCriteria(minTmdbRating: new BigDecimal("8.0"), yearMin: 2020)
            seriesRepository.findAll() >> [completedSeries("Show", "tt0000001", LocalDateTime.now(), "Comedy")]
            tmdbClient.findTvIdByImdbId(_) >> Optional.empty()

        when: "the genre-based top-up fires (title-based sourcing came up short)"
            sourcingService.sourceFromPool(criteria, 20)

        then: "discover was called with DiscoverFilters.NONE, exactly as before this spec"
            1 * tmdbClient.discover(_, [], "popularity.desc", DiscoverFilters.NONE) >> []
    }

    def "SERIES-031-AC-07: Popular Right Now and Highest Rated are unaffected"() {
        given: "criteria for topRated mode with minTmdbRating/year set"
            def criteria = new RecommendationCriteria(sourceMode: "topRated",
                minTmdbRating: new BigDecimal("8.0"), yearMin: 2020)

        when: "sourceTopRated runs"
            sourcingService.sourceTopRated(criteria)

        then: "discoverTopRated was called with its existing two-arg signature, unchanged"
            1 * tmdbClient.discoverTopRated(_, _) >> []
    }

    // -- Spec 032, Requirement 2 (SERIES-032-AC-05..07): Custom Search pre-fetch language/countries filters --

    def "SERIES-032-AC-05: Custom Search sourcing passes language/countries to discover"() {
        given: "criteria directed by genre with language and countries set"
            def criteria = new RecommendationCriteria(genres: ["Comedy"], language: "en", countries: ["US", "GB"])

        when: "sourceByGenreOrKeyword runs"
            sourcingService.sourceByGenreOrKeyword(criteria)

        then: "TmdbClient.discover was called with a DiscoverFilters carrying the same values"
            1 * tmdbClient.discover(_, _, _, { DiscoverFilters f ->
                f.language() == "en" && f.countries() == ["US", "GB"]
            }) >> []
    }

    def "SERIES-032-AC-06: the genre-based top-up is unaffected by this spec"() {
        given: "a Use My Series request with language/countries set (should never reach the top-up call)"
            def criteria = new RecommendationCriteria(language: "en", countries: ["US"])
            seriesRepository.findAll() >> [completedSeries("Show", "tt0000001", LocalDateTime.now(), "Comedy")]
            tmdbClient.findTvIdByImdbId(_) >> Optional.empty()

        when: "the genre-based top-up fires (title-based sourcing came up short)"
            sourcingService.sourceFromPool(criteria, 20)

        then: "discover was called with DiscoverFilters.NONE, exactly as before this spec"
            1 * tmdbClient.discover(_, [], "popularity.desc", DiscoverFilters.NONE) >> []
    }

    def "SERIES-032-AC-07: Popular Right Now and Highest Rated are unaffected"() {
        given: "criteria for topRated mode with language/countries set"
            def criteria = new RecommendationCriteria(sourceMode: "topRated", language: "en", countries: ["US"])

        when: "sourceTopRated runs"
            sourcingService.sourceTopRated(criteria)

        then: "discoverTopRated was called with its existing two-arg signature, unchanged"
            1 * tmdbClient.discoverTopRated(_, _) >> []
    }

    // -- Spec 033, Requirement 3 (SERIES-033-AC-09): Custom Search handles a genuinely empty query correctly --

    def "SERIES-033-AC-09: an empty Custom Search request produces an unfiltered discover/tv call"() {
        given: "criteria with nothing set"
            def criteria = new RecommendationCriteria()

        when: "sourceByGenreOrKeyword runs"
            sourcingService.sourceByGenreOrKeyword(criteria)

        then: "discover was called with empty genre/keyword lists and DiscoverFilters carrying only the sourcing-time minVoteCount default"
            1 * tmdbClient.discover([], [], "popularity.desc", { DiscoverFilters f ->
                f.minTmdbRating() == null && f.yearMin() == null && f.yearMax() == null
            }) >> []
    }

    // -- Spec 035, Requirement 2 (SERIES-035-AC-06/07/08): sourceFromPool resolves through the pool cache --

    def "SERIES-035-AC-06: sourceFromPool resolves its result through the pool cache"() {
        given: "a real pool cache and one eligible COMPLETED series"
            def poolCache = new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50)
            def sourcing = new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20, 200, poolCache)
            def source = completedSeries("Breaking Bad", "tt0903747", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.recommendations(1396) >> [candidate(2316)]

        when: "sourceFromPool is called twice with an identical criteria/limit"
            sourcing.sourceFromPool(new RecommendationCriteria(), 20)
            sourcing.sourceFromPool(new RecommendationCriteria(), 20)

        then: "TMDB is only consulted once -- the second call was a cache hit"
            1 * tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
    }

    def "SERIES-035-AC-07: a sortBy-only change is a cache hit, not a re-fetch"() {
        given: "a real pool cache and one eligible COMPLETED series"
            def poolCache = new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50)
            def sourcing = new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20, 200, poolCache)
            def source = completedSeries("Breaking Bad", "tt0903747", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
            tmdbClient.recommendations(1396) >> [candidate(2316)]

        when: "sourceFromPool is called with sortBy=score, then again with sortBy=recommendationCount"
            sourcing.sourceFromPool(new RecommendationCriteria(sortBy: "score"), 20)
            sourcing.sourceFromPool(new RecommendationCriteria(sortBy: "recommendationCount"), 20)

        then: "TMDB is only consulted on the first call"
            1 * tmdbClient.findTvIdByImdbId("tt0903747") >> Optional.of(1396)
    }

    def "SERIES-035-AC-08: trending/topRated/genre-directed sourcing remain uncached (regression guard)"() {
        given: "a real pool cache shared with the sourcing service under test"
            def poolCache = new RecommendationPoolCache(Clock.systemDefaultZone(), 10, 50)
            def sourcing = new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20, 200, poolCache)
            def criteria = new RecommendationCriteria(genres: ["Drama"])

        when: "sourceByGenreOrKeyword is called twice with identical criteria"
            sourcing.sourceByGenreOrKeyword(criteria)
            sourcing.sourceByGenreOrKeyword(criteria)

        then: "TMDB is consulted on every call -- no caching leaked into this path"
            2 * tmdbClient.discover([18], [], "popularity.desc", new DiscoverFilters(200, null, null, null, null, null, [])) >> []
    }
}
