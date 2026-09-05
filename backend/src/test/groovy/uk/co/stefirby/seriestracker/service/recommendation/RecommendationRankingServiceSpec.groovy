package uk.co.stefirby.seriestracker.service.recommendation

import uk.co.stefirby.seriestracker.client.tmdb.TmdbCandidate
import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.model.SeriesStatus
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import uk.co.stefirby.seriestracker.service.tmdb.TmdbGenreTable
import uk.co.stefirby.seriestracker.service.tmdb.WatchProviderService
import spock.lang.Specification

class RecommendationRankingServiceSpec extends Specification {

    SeriesRepository seriesRepository = Mock()
    TmdbClient tmdbClient = Mock()
    RecommendationDtoAssembler dtoAssembler =
        new RecommendationDtoAssembler(new TmdbGenreTable(), new WatchProviderService(seriesRepository, tmdbClient, "GB"))

    RecommendationRankingService rankingService = new RecommendationRankingService(dtoAssembler, "best-source")

    private static SeriesEntity completedSeries(String title, Integer personalRating = null) {
        new SeriesEntity(title: title, status: SeriesStatus.COMPLETED, personalRating: personalRating)
    }

    private static TmdbCandidate candidate(int tmdbId, String title = "Candidate ${tmdbId}", BigDecimal voteAverage = new BigDecimal("8.0")) {
        new TmdbCandidate(tmdbId, title, 2020, "overview", "/poster.jpg", voteAverage, [18], 100, "en", [])
    }

    private static DedupedCandidate dc(TmdbCandidate c, List<SeriesEntity> sources = []) {
        new DedupedCandidate(c, sources, "tt" + c.tmdbId())
    }

    def "SERIES-007-AC-21: candidates from a 5-star source outrank otherwise-similar candidates from a 3-star source"() {
        given: "two candidates, sourced from a 5-star and a 3-star series, same tmdbRating"
            def x = dc(candidate(10, "X", new BigDecimal("7.0")), [completedSeries("Five Star", 5)])
            def y = dc(candidate(20, "Y", new BigDecimal("7.0")), [completedSeries("Three Star", 3)])

        when: "each is scored and sorted"
            def results = [x, y].collect { rankingService.score(it, 3) }
                .toSorted(rankingService.resolveSortComparator(new RecommendationCriteria()))

        then: "X (from the 5-star source) is ranked ahead of Y (from the 3-star source)"
            results*.dto()*.title() == ["X", "Y"]
    }

    def "SERIES-007-AC-21: a candidate sourced from a null-personalRating source contributes 0 for that term"() {
        given: "two candidates, one from an unrated source, one from a rated source, same tmdbRating"
            def fromUnrated = dc(candidate(10, "FromUnrated", new BigDecimal("7.0")), [completedSeries("Unrated", null)])
            def fromRated = dc(candidate(20, "FromRated", new BigDecimal("7.0")), [completedSeries("Rated", 4)])

        when: "each is scored and sorted"
            def results = [fromUnrated, fromRated].collect { rankingService.score(it, 3) }
                .toSorted(rankingService.resolveSortComparator(new RecommendationCriteria()))

        then: "the candidate from the rated source outranks the one from the unrated source"
            results*.dto()*.title() == ["FromRated", "FromUnrated"]
    }

    def "SERIES-007-AC-22: maxPerSource caps candidates attributed to one source series (default 8)"() {
        given: "10 candidates all attributed to the same source series"
            def source = completedSeries("Breaking Bad")
            def scored = (1..10).collect { rankingService.score(dc(candidate(it), [source]), 3) }

        when: "applyDiversityCap is called with maxPerSource=8"
            def result = rankingService.applyDiversityCap(scored, 8)

        then: "at most 8 of the results are attributed to that source"
            result.size() == 8
            result.every { it.allSourceTitles() == ["Breaking Bad"] }
    }

    def "SERIES-007-AC-22: candidates with a null sourceTitle are not subject to the diversity cap"() {
        given: "5 candidates with no source (genre-sourced), exceeding maxPerSource=3"
            def scored = (1..5).collect { rankingService.score(dc(candidate(it)), 3) }

        when: "applyDiversityCap is called with maxPerSource=3"
            def result = rankingService.applyDiversityCap(scored, 3)

        then: "none are dropped by the diversity cap"
            result.size() == 5
    }

    def "SERIES-015-AC-07: the personal-rating scoring term uses the max rating among all contributing sources"() {
        given: "a candidate recommended by a 5-star and a 2-star source (canonically high-first); a control from a single 3-star source"
            def shared = dc(candidate(999, "Shared", new BigDecimal("5.0")), [completedSeries("High", 5), completedSeries("Low", 2)])
            def control = dc(candidate(888, "Control", new BigDecimal("5.0")), [completedSeries("Control", 3)])

        when: "each is scored and sorted"
            def results = [control, shared].collect { rankingService.score(it, 3) }
                .toSorted(rankingService.resolveSortComparator(new RecommendationCriteria()))

        then: "Shared (max contributing rating 5) outranks Control (single source rating 3)"
            results*.dto()*.title().indexOf("Shared") < results*.dto()*.title().indexOf("Control")
    }

    def "SERIES-015-AC-15: best-source mode caps on each candidate's best contributing source only (default behavior unchanged)"() {
        given: "diversityCapMode defaults to best-source; X and Y share the same two sources, maxPerSource 1"
            def sourceA = completedSeries("Source A", 5)
            def sourceB = completedSeries("Source B", 2)
            def x = rankingService.score(dc(candidate(10, "X"), [sourceA, sourceB]), 3)
            def y = rankingService.score(dc(candidate(20, "Y"), [sourceA, sourceB]), 3)

        when: "applyDiversityCap is called with maxPerSource=1"
            def result = rankingService.applyDiversityCap([x, y], 1)

        then: "only 1 of X/Y survives -- the cap keyed off the shared best source"
            result.size() == 1
    }

    def "SERIES-015-AC-16: all-sources mode excludes a candidate if any contributing source is already at the cap"() {
        given: "diversityCapMode is all-sources; maxPerSource 1"
            def allSourcesRanking = new RecommendationRankingService(dtoAssembler, "all-sources")
            def sourceS = completedSeries("Source S", 5)
            def sourceT = completedSeries("Source T", 3)
            def candidateA = allSourcesRanking.score(dc(candidate(10, "Candidate A"), [sourceS]), 3)
            def candidateB = allSourcesRanking.score(dc(candidate(20, "Candidate B"), [sourceS, sourceT]), 3)

        when: "applyDiversityCap is called with maxPerSource=1"
            def result = allSourcesRanking.applyDiversityCap([candidateA, candidateB], 1)

        then: "candidate B is excluded even though T alone hasn't hit the cap"
            result*.dto()*.title() == ["Candidate A"]
    }

    def "SERIES-015-AC-17: a candidate with no watched-series source is never capped, under either mode"() {
        given: "10 same-source candidates (exceeding maxPerSource=8) plus 1 candidate with no source"
            def source = completedSeries("Breaking Bad")
            def sameSource = (1..10).collect { rankingService.score(dc(candidate(it), [source]), 3) }
            def noSource = rankingService.score(dc(candidate(500, "Genre-Sourced Candidate")), 3)

        when: "applyDiversityCap is called with maxPerSource=8"
            def result = rankingService.applyDiversityCap(sameSource + [noSource], 8)

        then: "the no-source candidate is always present, exactly once"
            result.count { it.dto().title() == "Genre-Sourced Candidate" } == 1
    }

    def "SERIES-015-AC-18: an unrecognized diversityCapMode value falls back to best-source"() {
        given: "diversityCapMode is configured as 'bogus-mode'; X and Y share the same two sources, maxPerSource 1"
            def bogusModeRanking = new RecommendationRankingService(dtoAssembler, "bogus-mode")
            def sourceA = completedSeries("Source A", 5)
            def sourceB = completedSeries("Source B", 2)
            def x = bogusModeRanking.score(dc(candidate(10, "X"), [sourceA, sourceB]), 3)
            def y = bogusModeRanking.score(dc(candidate(20, "Y"), [sourceA, sourceB]), 3)

        expect: "behavior matches best-source mode, not all-sources"
            bogusModeRanking.applyDiversityCap([x, y], 1).size() == 1
    }

    def "SERIES-015-AC-19/21: sortBy=recommendationCount orders by totalSourceCount descending, rankScore as tiebreak"() {
        given: "candidate A from 3 low-rated sources (lower rankScore); candidate B from 1 high-rated source (higher rankScore)"
            def aSources = (1..3).collect { completedSeries("A-Source ${it}", 1) }
            def bSource = completedSeries("B-Source", 5)
            def a = rankingService.score(dc(candidate(100, "Candidate A", new BigDecimal("5.0")), aSources), 3)
            def b = rankingService.score(dc(candidate(200, "Candidate B", new BigDecimal("5.0")), [bSource]), 3)

        when: "sorted by the recommendationCount comparator"
            def results = [a, b].toSorted(rankingService.resolveSortComparator(new RecommendationCriteria(sortBy: "recommendationCount")))

        then: "candidate A (3 sources) is ranked ahead of candidate B (1 source), despite the lower rankScore"
            results[0].dto().title() == "Candidate A"
            results[0].dto().totalSourceCount() == 3
            results[1].dto().title() == "Candidate B"
    }

    def "SERIES-015-AC-20: an unrecognized sortBy value falls back to score-based sorting"() {
        given: "the same fixture as above"
            def aSources = (1..3).collect { completedSeries("A-Source ${it}", 1) }
            def bSource = completedSeries("B-Source", 5)
            def a = rankingService.score(dc(candidate(100, "Candidate A", new BigDecimal("5.0")), aSources), 3)
            def b = rankingService.score(dc(candidate(200, "Candidate B", new BigDecimal("5.0")), [bSource]), 3)

        when: "sorted by the (bogus sortBy) comparator"
            def results = [a, b].toSorted(rankingService.resolveSortComparator(new RecommendationCriteria(sortBy: "bogus")))

        then: "candidate B (higher rankScore) is ranked ahead of candidate A"
            results[0].dto().title() == "Candidate B"
    }
}
