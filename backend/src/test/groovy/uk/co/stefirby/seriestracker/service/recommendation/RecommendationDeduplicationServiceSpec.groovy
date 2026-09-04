package uk.co.stefirby.seriestracker.service.recommendation

import uk.co.stefirby.seriestracker.client.tmdb.TmdbCandidate
import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient
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
            def result = deduplicationService.dedupeAndExclude(raw)

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
            def result = deduplicationService.dedupeAndExclude(raw)

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
            def result = deduplicationService.dedupeAndExclude(raw)

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
            def result = deduplicationService.dedupeAndExclude(raw)

        then: "sourceSeries is empty, not null"
            result[0].sourceSeries() == []
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
            def result = deduplicationService.dedupeAndExclude(raw)

        then: "sourceSeries is ordered High Rated, Low Rated, Unrated"
            result[0].sourceSeries()*.title == ["High Rated", "Low Rated", "Unrated"]
    }
}
