package uk.co.stefirby.seriestracker.service

import uk.co.stefirby.seriestracker.client.TmdbCandidate
import uk.co.stefirby.seriestracker.client.TmdbClient
import uk.co.stefirby.seriestracker.client.TmdbKeyword
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
        new RecommendationService(tmdbClient,
            new RecommendationCriteriaValidator(), new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20), new RecommendationDeduplicationService(seriesRepository, ignoredSeriesRepository, tmdbClient), new RecommendationOutputFilterService(tmdbClient, new TmdbGenreTable()), new RecommendationRankingService(new RecommendationDtoAssembler(new TmdbGenreTable(), new WatchProviderService(seriesRepository, tmdbClient, "GB")), "best-source"), new RecommendationDtoAssembler(new TmdbGenreTable(), new WatchProviderService(seriesRepository, tmdbClient, "GB")), 50, 8)

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
        new TmdbCandidate(tmdbId, title, year, "overview", "/poster.jpg", voteAverage, genreIds, voteCount, originalLanguage, null)
    }

    def "SERIES-023-AC-05: getKeywordsForCandidate maps TmdbKeyword names to plain strings"() {
        given: "TMDB returns two keywords for tmdbId 4046"
            tmdbClient.showKeywords(4046) >> [
                new uk.co.stefirby.seriestracker.client.TmdbKeyword(470, "spy"),
                new uk.co.stefirby.seriestracker.client.TmdbKeyword(190904, "mi5")
            ]

        when: "getKeywordsForCandidate(4046) is called"
            def result = recommendationService.getKeywordsForCandidate(4046)

        then: "the plain names are returned, in TMDB's own order"
            result == ["spy", "mi5"]
    }

    def "SERIES-023-AC-06: a TMDB failure returns an empty list, not an exception"() {
        given: "TMDB fails for tmdbId 999"
            tmdbClient.showKeywords(999) >> {
                throw new uk.co.stefirby.seriestracker.exception.ExternalServiceException("TMDB down")
            }

        when: "getKeywordsForCandidate(999) is called"
            def result = recommendationService.getKeywordsForCandidate(999)

        then: "an empty list is returned, no exception propagates"
            result == []
    }

    def "SERIES-023-AC-06: an empty TMDB keyword result returns an empty list"() {
        given: "TMDB has no keywords for tmdbId 1"
            tmdbClient.showKeywords(1) >> []

        when: "getKeywordsForCandidate(1) is called"
            def result = recommendationService.getKeywordsForCandidate(1)

        then: "an empty list is returned"
            result == []
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

        and: "maxPerSource is raised so the SERIES-007-AC-22 diversity cap (default 8) doesn't interfere with this limit-only test"
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

    def "SERIES-007-AC-02: max-candidates cap is configurable via constructor"() {
        given: "a service configured with maxCandidates=3, one source series recommending 5 candidates"
            def svc = new RecommendationService(tmdbClient, new RecommendationCriteriaValidator(), new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20), new RecommendationDeduplicationService(seriesRepository, ignoredSeriesRepository, tmdbClient), new RecommendationOutputFilterService(tmdbClient, new TmdbGenreTable()), new RecommendationRankingService(new RecommendationDtoAssembler(new TmdbGenreTable(), new WatchProviderService(seriesRepository, tmdbClient, "GB")), "best-source"), new RecommendationDtoAssembler(new TmdbGenreTable(), new WatchProviderService(seriesRepository, tmdbClient, "GB")), 3, 8)
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

    // -- Requirement 7 (SERIES-007-AC-21/22): output ranking & diversity cap --

    def "SERIES-007-AC-22: maxPerSource is configurable via the constructor's app.tmdb.max-per-source default"() {
        given: "a service configured with maxPerSource=2, and one source series producing 5 raw candidates"
            def svc = new RecommendationService(tmdbClient, new RecommendationCriteriaValidator(), new RecommendationSourcingService(seriesRepository, tmdbClient, new TmdbGenreTable(), 20), new RecommendationDeduplicationService(seriesRepository, ignoredSeriesRepository, tmdbClient), new RecommendationOutputFilterService(tmdbClient, new TmdbGenreTable()), new RecommendationRankingService(new RecommendationDtoAssembler(new TmdbGenreTable(), new WatchProviderService(seriesRepository, tmdbClient, "GB")), "best-source"), new RecommendationDtoAssembler(new TmdbGenreTable(), new WatchProviderService(seriesRepository, tmdbClient, "GB")), 50, 2)
            def source = completedSeries("Breaking Bad", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            def candidates = (1..5).collect { candidate(it) }
            tmdbClient.recommendations(1) >> candidates
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            (1..5).each { i -> tmdbClient.externalIds(i) >> Optional.of("tt" + i.toString().padLeft(7, '0')) }

        when: "recommend(20) is called with no maxPerSource override in criteria"
            def results = svc.recommend(20)

        then: "the constructor-injected default of 2 is applied, not the property default of 8"
            results.size() == 2
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

    // -- Requirement 8 (SERIES-007-AC-23..29): output filters --

    def "SERIES-007-AC-29: Requirement 8 filters are applied before the diversity cap"() {
        given: "one source producing 4 candidates, 2 of which fail minTmdbRating; maxPerSource default is 8"
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

    // -- Spec 015, Requirement 1 (SERIES-015-AC-01..04): accumulate every contributing source --

    // -- Spec 015, Requirement 3 (SERIES-015-AC-07/08): scoring uses the best-rated contributing source --

    // -- Spec 015, Requirement 4 (SERIES-015-AC-09..13): sourceTitles/totalSourceCount/maxSourcesShown --

    // -- Spec 015, Requirement 5 (SERIES-015-AC-14..18): two diversity-cap modes --

    // -- Spec 015, Requirement 6 (SERIES-015-AC-19..22): sortBy --

    // -- Spec 022, Requirement 2 (SERIES-022-AC-07..10): directed sourcing -- trending --

    def "SERIES-022-AC-07/08/09: trending mode bypasses the watched pool, preserves TMDB order, sourceTitle null"() {
        given: "3 COMPLETED series exist (would normally source title-based candidates)"
            seriesRepository.findAll() >> [
                completedSeries("A", "tt0000001", LocalDateTime.now()),
                completedSeries("B", "tt0000002", LocalDateTime.now()),
                completedSeries("C", "tt0000003", LocalDateTime.now())
            ]
            def criteria = new RecommendationCriteria(sourceMode: "trending")

        and: "TMDB trending returns candidates in a fixed order, higher-rated candidate second"
            tmdbClient.trending("week") >> [candidate(10, "Second Place", 2020, new BigDecimal("9.9")),
                                             candidate(20, "First Place", 2020, new BigDecimal("1.0"))]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "no title-based or genre-based sourcing occurs"
            0 * tmdbClient.findTvIdByImdbId(_)
            0 * tmdbClient.recommendations(_)
            0 * tmdbClient.discover(_, _, _)

        and: "results preserve TMDB's returned order (not re-ranked by rating) and have a null sourceTitle"
            results*.title() == ["Second Place", "First Place"]
            results*.sourceTitles().every { it == [] }
    }

    def "SERIES-022-AC-08: output filters still apply to trending candidates, in TMDB's returned order"() {
        given: "trending returns a low-vote-count candidate and a high-vote-count candidate"
            def criteria = new RecommendationCriteria(sourceMode: "trending")
            tmdbClient.trending("week") >> [
                candidate(10, "Low Votes", 2020, new BigDecimal("8.0"), [18], 5),
                candidate(20, "High Votes", 2020, new BigDecimal("8.0"), [18], 25)
            ]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(20, criteria) is called (default minVoteCount 20)"
            def results = recommendationService.recommend(20, criteria)

        then: "only the high-vote-count candidate survives the existing output filter"
            results.size() == 1
            results[0].title() == "High Votes"
    }

    def "SERIES-022-AC-10: an already-tracked/ignored trending candidate is excluded"() {
        given: "trending returns two candidates, one already tracked and one already ignored"
            def criteria = new RecommendationCriteria(sourceMode: "trending")
            tmdbClient.trending("week") >> [candidate(10, "Tracked"), candidate(20, "Ignored"), candidate(30, "New")]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            tmdbClient.externalIds(30) >> Optional.of("tt1000030")
            seriesRepository.existsByImdbId("tt1000010") >> true
            seriesRepository.existsByImdbId("tt1000020") >> false
            seriesRepository.existsByImdbId("tt1000030") >> false
            ignoredSeriesRepository.existsByImdbId("tt1000020") >> true
            ignoredSeriesRepository.existsByImdbId("tt1000030") >> false

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "only the new candidate remains"
            results.size() == 1
            results[0].title() == "New"
    }

    // -- Spec 022, Requirement 3 (SERIES-022-AC-11..15): directed sourcing -- top rated --

    def "SERIES-022-AC-13: topRated candidates have a null sourceTitle"() {
        given: "discoverTopRated returns one candidate"
            def criteria = new RecommendationCriteria(sourceMode: "topRated")
            tmdbClient.discoverTopRated(200, "vote_average.desc") >> [candidate(10, "Acclaimed Show", 2020, new BigDecimal("8.0"), [18], 300)]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "sourceTitles is empty and totalSourceCount is 0"
            results[0].sourceTitles() == []
            results[0].totalSourceCount() == 0
    }

    def "SERIES-022-AC-14: an already-tracked/ignored topRated candidate is excluded"() {
        given: "discoverTopRated returns two candidates, one already tracked"
            def criteria = new RecommendationCriteria(sourceMode: "topRated")
            tmdbClient.discoverTopRated(200, "vote_average.desc") >> [
                candidate(10, "Tracked", 2020, new BigDecimal("8.0"), [18], 300),
                candidate(20, "New", 2020, new BigDecimal("8.0"), [18], 300)
            ]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId("tt1000010") >> true
            seriesRepository.existsByImdbId("tt1000020") >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "only the new candidate remains"
            results.size() == 1
            results[0].title() == "New"
    }

    def "SERIES-025-AC-07: topRated candidates keep TMDB's own returned order (supersedes SERIES-022-AC-15)"() {
        given: "discoverTopRated returns candidates in a specific, non-tmdbRating-sorted order"
            def criteria = new RecommendationCriteria(sourceMode: "topRated")
            tmdbClient.discoverTopRated(200, "vote_average.desc") >> [
                candidate(10, "Mid Rated", 2020, new BigDecimal("6.0"), [18], 300),
                candidate(20, "Highest Rated", 2020, new BigDecimal("9.0"), [18], 300),
                candidate(30, "High Rated", 2020, new BigDecimal("7.5"), [18], 300)
            ]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            tmdbClient.externalIds(30) >> Optional.of("tt1000030")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(20, criteria) is called"
            def results = recommendationService.recommend(20, criteria)

        then: "the result preserves TMDB's own order, not tmdbRating-descending"
            results*.title() == ["Mid Rated", "Highest Rated", "High Rated"]
    }

    // -- Spec 022, Requirement 4 (SERIES-022-AC-16..19): mutual exclusivity & validation --

    def "SERIES-022-AC-18: trendingWindow is ignored (no-op) when sourceMode is not trending"() {
        given: "criteria sets a valid trendingWindow but sourceMode is topRated"
            def criteria = new RecommendationCriteria(sourceMode: "topRated", trendingWindow: "day")

        when: "recommend(20, criteria) is called"
            recommendationService.recommend(20, criteria)

        then: "discoverTopRated is used, trending() is never called"
            1 * tmdbClient.discoverTopRated(200, "vote_average.desc") >> []
            0 * tmdbClient.trending(_)
    }

    def "SERIES-022-AC-19: no sourceMode leaves existing behavior unchanged (automatic watched pool sourcing)"() {
        given: "one completed series, no sourceMode supplied"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(1)
            tmdbClient.recommendations(1) >> [candidate(10, "Recommended")]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(20) is called with the default (no-sourceMode) criteria"
            def results = recommendationService.recommend(20)

        then: "the normal automatic pool sourcing runs, unaffected"
            results.size() == 1
            results[0].title() == "Recommended"
    }

    def "SERIES-015-AC-22: the diversity cap and limit still apply after a recommendationCount sort"() {
        given: "one source producing 6 raw candidates, sortBy=recommendationCount"
            def source = completedSeries("Breaking Bad", "tt1234568", LocalDateTime.now())
            seriesRepository.findAll() >> [source]
            tmdbClient.findTvIdByImdbId("tt1234568") >> Optional.of(1)
            def candidates = (1..6).collect { candidate(it + 300) }
            tmdbClient.recommendations(1) >> candidates
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false
            (1..6).each { i -> tmdbClient.externalIds(i + 300) >> Optional.of("tt" + (i + 300).toString().padLeft(7, '0')) }
            def criteria = new RecommendationCriteria(sortBy: "recommendationCount")

        when: "recommend(2, criteria) is called"
            def results = recommendationService.recommend(2, criteria)

        then: "the diversity cap is still enforced and the result is still truncated to 2"
            results.size() <= 2
    }

    // -- Spec 025: TMDB-native sort_by for topRated/genre modes --

    def "SERIES-025-AC-07: genre-directed candidates keep TMDB's own returned order"() {
        given: "discover returns candidates in a specific, non-tmdbRating-sorted order"
            def criteria = new RecommendationCriteria(genres: ["Drama"])
            tmdbClient.discover([18], [], "popularity.desc") >> [
                candidate(10, "Low Rated", 2020, new BigDecimal("6.0"), [18], 300),
                candidate(20, "High Rated", 2020, new BigDecimal("9.0"), [18], 300)
            ]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(10, criteria) is called"
            def results = recommendationService.recommend(10, criteria)

        then: "the result preserves TMDB's own order"
            results*.title() == ["Low Rated", "High Rated"]
    }

    def "SERIES-025-AC-08: legacy sortBy has no effect under topRated"() {
        given: "criteria with sourceMode=topRated and sortBy=recommendationCount"
            def criteria = new RecommendationCriteria(sourceMode: "topRated", sortBy: "recommendationCount")
            tmdbClient.discoverTopRated(200, "vote_average.desc") >> [
                candidate(10, "A", 2020, new BigDecimal("6.0"), [18], 300),
                candidate(20, "B", 2020, new BigDecimal("9.0"), [18], 300)
            ]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(10, criteria) is called, compared against the same criteria without sortBy"
            def withLegacySortBy = recommendationService.recommend(10, criteria)
            def withoutLegacySortBy = recommendationService.recommend(10, new RecommendationCriteria(sourceMode: "topRated"))

        then: "the legacy sortBy has no effect -- both results are identical, in TMDB's own order"
            withLegacySortBy*.title() == withoutLegacySortBy*.title()
            withLegacySortBy*.title() == ["A", "B"]
    }

    def "SERIES-025-AC-08: legacy sortBy has no effect under genre-directed sourcing"() {
        given: "criteria with genres set and sortBy=recommendationCount"
            def criteria = new RecommendationCriteria(genres: ["Drama"], sortBy: "recommendationCount")
            tmdbClient.discover([18], [], "popularity.desc") >> [
                candidate(10, "A", 2020, new BigDecimal("6.0"), [18], 300),
                candidate(20, "B", 2020, new BigDecimal("9.0"), [18], 300)
            ]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            tmdbClient.externalIds(20) >> Optional.of("tt1000020")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "recommend(10, criteria) is called"
            def results = recommendationService.recommend(10, criteria)

        then: "the result is in TMDB's own returned order, unaffected by the legacy sortBy"
            results*.title() == ["A", "B"]
    }
}
