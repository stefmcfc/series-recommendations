package uk.co.stefirby.seriestracker.service.recommendation

import uk.co.stefirby.seriestracker.client.tmdb.TmdbCandidate
import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.model.SeriesStatus
import uk.co.stefirby.seriestracker.repository.IgnoredSeriesRepository
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import spock.lang.Specification

import java.time.LocalDateTime

class RecommendationDeduplicationServiceSpec extends Specification {

    SeriesRepository seriesRepository = Mock()
    IgnoredSeriesRepository ignoredSeriesRepository = Mock()
    TmdbClient tmdbClient = Mock()

    RecommendationDeduplicationService deduplicationService =
        new RecommendationDeduplicationService(seriesRepository, ignoredSeriesRepository, tmdbClient)

    private static SeriesEntity completedSeries(String title, String imdbId, LocalDateTime dateCompleted,
                                                 String genres = null, Integer personalRating = null) {
        new SeriesEntity(title: title, imdbId: imdbId, status: SeriesStatus.COMPLETED,
            dateCompleted: dateCompleted, genres: genres, personalRating: personalRating)
    }

    private static TmdbCandidate candidate(int tmdbId, String title = "Candidate ${tmdbId}") {
        new TmdbCandidate(tmdbId, title, 2020, "overview", "/poster.jpg", new BigDecimal("8.0"), [18], 100, "en", [])
    }

    def "SERIES-006-AC-22/23/24: excludes unresolvable, already-added, and already-ignored candidates, and dedupes"() {
        given: "one source series producing four raw candidates"
            def source = completedSeries("Show", "tt1234567", LocalDateTime.now())
            def raw = [
                new RawCandidate(candidate(10), source),
                new RawCandidate(candidate(20), source),
                new RawCandidate(candidate(30), source),
                new RawCandidate(candidate(40), source),
            ]

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

        when: "dedupeAndExclude is called"
            def result = deduplicationService.dedupeAndExclude(raw, SourceOrderComparator.INSTANCE, false)

        then: "only the one valid candidate remains"
            result.size() == 1
            result[0].imdbId() == "tt4000000"
    }

    def "SERIES-006-AC-24: the same candidate recommended by two source series is deduplicated"() {
        given: "two source series recommending the same tmdb candidate"
            def source1 = completedSeries("Show 1", "tt0000001", LocalDateTime.now())
            def source2 = completedSeries("Show 2", "tt0000002", LocalDateTime.now())
            def raw = [new RawCandidate(candidate(99), source1), new RawCandidate(candidate(99), source2)]
            tmdbClient.externalIds(99) >> Optional.of("tt9999999")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "dedupeAndExclude is called"
            def result = deduplicationService.dedupeAndExclude(raw, SourceOrderComparator.INSTANCE, false)

        then: "the candidate appears once"
            result.size() == 1
    }

    def "SERIES-015-AC-02/04: a candidate recommended by two watched series accumulates both as sources"() {
        given: "two source series recommending the same candidate (same resolved imdbId)"
            def alice = completedSeries("Show A", "tt1000001", LocalDateTime.now(), null, 5)
            def bob = completedSeries("Show B", "tt1000002", LocalDateTime.now(), null, 3)
            def raw = [new RawCandidate(candidate(999, "Shared Candidate"), alice), new RawCandidate(candidate(999, "Shared Candidate"), bob)]
            tmdbClient.externalIds(999) >> Optional.of("tt9999999")
            seriesRepository.existsByImdbId("tt9999999") >> false
            ignoredSeriesRepository.existsByImdbId("tt9999999") >> false

        when: "dedupeAndExclude is called"
            def result = deduplicationService.dedupeAndExclude(raw, SourceOrderComparator.INSTANCE, false)

        then: "the candidate appears once, attributed to both series"
            result.size() == 1
            result[0].sourceSeries().size() == 2
            result[0].sourceSeries()*.title.containsAll(["Show A", "Show B"])
    }

    def "SERIES-015-AC-03: a candidate with no source series has an empty sourceSeries list, not null"() {
        given: "a raw candidate with no source series (genre/keyword-sourced)"
            def raw = [new RawCandidate(candidate(500), null)]
            tmdbClient.externalIds(500) >> Optional.of("tt5005005")
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "dedupeAndExclude is called"
            def result = deduplicationService.dedupeAndExclude(raw, SourceOrderComparator.INSTANCE, false)

        then: "sourceSeries is empty, not null"
            result[0].sourceSeries() == []
    }

    def "SERIES-059-AC-07: the cache-aware overload memoizes externalIds across separate calls sharing the same cache"() {
        given: "two separate raw candidate lists, both containing tmdbId 42, and a shared externalIdCache"
            def firstPage = [new RawCandidate(candidate(42), null)]
            def secondPage = [new RawCandidate(candidate(42), null)]
            def cache = [:]
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "dedupeAndExclude(raw, cache) is called twice, sharing the same cache"
            def firstResult = deduplicationService.dedupeAndExclude(firstPage, cache, SourceOrderComparator.INSTANCE, false)
            def secondResult = deduplicationService.dedupeAndExclude(secondPage, cache, SourceOrderComparator.INSTANCE, false)

        then: "externalIds(42) is resolved only once across both calls"
            1 * tmdbClient.externalIds(42) >> Optional.of("tt0000042")

        and: "both calls' own result still surfaces the resolved candidate"
            firstResult.size() == 1
            secondResult.size() == 1
    }

    def "SERIES-059-AC-07: the single-arg overload doesn't share memoization across separate calls"() {
        given: "two separate calls to the single-arg dedupeAndExclude, both containing tmdbId 42"
            def firstPage = [new RawCandidate(candidate(42), null)]
            def secondPage = [new RawCandidate(candidate(42), null)]
            seriesRepository.existsByImdbId(_) >> false
            ignoredSeriesRepository.existsByImdbId(_) >> false

        when: "dedupeAndExclude(raw) is called twice, with no shared cache"
            deduplicationService.dedupeAndExclude(firstPage, SourceOrderComparator.INSTANCE, false)
            deduplicationService.dedupeAndExclude(secondPage, SourceOrderComparator.INSTANCE, false)

        then: "externalIds(42) is resolved once per call -- no cross-call memoization for the no-cache overload"
            2 * tmdbClient.externalIds(42) >> Optional.of("tt0000042")
    }

    def "SERIES-015-AC-05: contributing sources are ordered personalRating desc, dateCompleted desc"() {
        given: "three source series recommending the same candidate: rating 2, rating 5, rating null"
            def low = completedSeries("Low Rated", "tt2000001", LocalDateTime.now().minusDays(1), null, 2)
            def high = completedSeries("High Rated", "tt2000002", LocalDateTime.now().minusDays(2), null, 5)
            def unrated = completedSeries("Unrated", "tt2000003", LocalDateTime.now(), null, null)
            def raw = [
                new RawCandidate(candidate(999, "Shared Candidate"), low),
                new RawCandidate(candidate(999, "Shared Candidate"), high),
                new RawCandidate(candidate(999, "Shared Candidate"), unrated),
            ]
            tmdbClient.externalIds(999) >> Optional.of("tt9999999")
            seriesRepository.existsByImdbId("tt9999999") >> false
            ignoredSeriesRepository.existsByImdbId("tt9999999") >> false

        when: "dedupeAndExclude is called"
            def result = deduplicationService.dedupeAndExclude(raw, SourceOrderComparator.INSTANCE, false)

        then: "sourceSeries is ordered High Rated, Low Rated, Unrated"
            result[0].sourceSeries()*.title == ["High Rated", "Low Rated", "Unrated"]
    }

    // -- Spec 068, Requirement 1 (SERIES-068-AC-07): orderSources honors a caller-supplied comparator --

    // -- Spec 071, Requirement 2/3 (SERIES-071-AC-02/03/04): includeAlreadyTracked --

    def "SERIES-071-AC-02: includeAlreadyTracked=true surfaces an already-tracked candidate"() {
        given: "a candidate whose resolved imdbId matches an existing tracked series"
            def raw = [new RawCandidate(candidate(10, "Tracked"), null)]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            seriesRepository.existsByImdbId("tt1000010") >> true
            ignoredSeriesRepository.existsByImdbId("tt1000010") >> false
            def tracked = completedSeries("Tracked", "tt1000010", LocalDateTime.now())
            seriesRepository.findByImdbId("tt1000010") >> Optional.of(tracked)

        when: "dedupeAndExclude is called with includeAlreadyTracked=true"
            def result = deduplicationService.dedupeAndExclude(raw, SourceOrderComparator.INSTANCE, true)

        then: "the already-tracked candidate is present"
            result.size() == 1
            result[0].imdbId() == "tt1000010"
    }

    def "SERIES-071-AC-02: includeAlreadyTracked=false (the default) still excludes an already-tracked candidate"() {
        given: "a candidate whose resolved imdbId matches an existing tracked series"
            def raw = [new RawCandidate(candidate(10, "Tracked"), null)]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            seriesRepository.existsByImdbId("tt1000010") >> true
            ignoredSeriesRepository.existsByImdbId("tt1000010") >> false

        when: "dedupeAndExclude is called with includeAlreadyTracked=false"
            def result = deduplicationService.dedupeAndExclude(raw, SourceOrderComparator.INSTANCE, false)

        then: "the already-tracked candidate is absent, as today"
            result.isEmpty()
    }

    def "SERIES-071-AC-03: includeAlreadyTracked=true does not surface an ignored candidate"() {
        given: "a candidate whose resolved imdbId matches an ignored series, not a tracked one"
            def raw = [new RawCandidate(candidate(30, "Ignored"), null)]
            tmdbClient.externalIds(30) >> Optional.of("tt1000030")
            seriesRepository.existsByImdbId("tt1000030") >> false
            ignoredSeriesRepository.existsByImdbId("tt1000030") >> true

        when: "dedupeAndExclude is called with includeAlreadyTracked=true"
            def result = deduplicationService.dedupeAndExclude(raw, SourceOrderComparator.INSTANCE, true)

        then: "the ignored candidate is still absent"
            result.isEmpty()
    }

    def "SERIES-071-AC-04: a matched already-tracked candidate carries the resolved SeriesEntity as trackedSeries"() {
        given: "a candidate whose resolved imdbId matches an existing tracked series"
            def raw = [new RawCandidate(candidate(10, "Tracked"), null)]
            tmdbClient.externalIds(10) >> Optional.of("tt1000010")
            seriesRepository.existsByImdbId("tt1000010") >> true
            ignoredSeriesRepository.existsByImdbId("tt1000010") >> false
            def tracked = completedSeries("Tracked", "tt1000010", LocalDateTime.now())
            seriesRepository.findByImdbId("tt1000010") >> Optional.of(tracked)

        when: "dedupeAndExclude is called with includeAlreadyTracked=true"
            def result = deduplicationService.dedupeAndExclude(raw, SourceOrderComparator.INSTANCE, true)

        then: "the result's trackedSeries is the resolved entity"
            result[0].trackedSeries() == tracked
    }

    def "SERIES-071-AC-04: an ordinary (not already-tracked) candidate's trackedSeries is null"() {
        given: "a valid candidate matching neither a tracked nor an ignored series"
            def raw = [new RawCandidate(candidate(40, "New"), null)]
            tmdbClient.externalIds(40) >> Optional.of("tt1000040")
            seriesRepository.existsByImdbId("tt1000040") >> false
            ignoredSeriesRepository.existsByImdbId("tt1000040") >> false

        when: "dedupeAndExclude is called with includeAlreadyTracked=true"
            def result = deduplicationService.dedupeAndExclude(raw, SourceOrderComparator.INSTANCE, true)

        then: "trackedSeries is null, never queried"
            result[0].trackedSeries() == null
            0 * seriesRepository.findByImdbId(_)
    }

    def "SERIES-068-AC-07: customBlendThenPersonalRating orders by blend first, personal rating as tiebreak"() {
        given: "two source series with the same personalRating but different Custom Rating Blend results"
            def seriesA = completedSeries("Series A", "tt3000001", LocalDateTime.now(), null, 4)
            seriesA.imdbRating = 9.0G
            seriesA.tmdbRating = 9.0G
            def seriesB = completedSeries("Series B", "tt3000002", LocalDateTime.now(), null, 4)
            seriesB.imdbRating = 1.0G
            seriesB.tmdbRating = 1.0G
            def criteria = new RecommendationCriteria(sourceRankingStrategy: "customBlendThenPersonalRating")
            def comparator = SourceOrderComparator.forStrategy(criteria)

        when: "orderSources is called with the resolved comparator"
            def ordered = deduplicationService.orderSources([seriesB, seriesA], comparator)

        then: "series A (higher blend) sorts first despite equal personalRating"
            ordered.first() == seriesA
    }
}
