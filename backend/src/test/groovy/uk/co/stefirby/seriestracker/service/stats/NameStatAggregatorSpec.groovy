package uk.co.stefirby.seriestracker.service.stats

import spock.lang.Specification
import uk.co.stefirby.seriestracker.model.SeriesEntity

/**
 * Direct unit coverage of the shared aggregation/sort/filter logic behind KeywordStatsService
 * and GenreStatsService, now that it lives in one reusable place. Doesn't re-cover ground
 * KeywordStatsServiceSpec/GenreStatsServiceSpec already exercise end-to-end (via a real
 * SeriesRepository) -- focused instead on the aggregator's own contract in isolation: per-series
 * name de-duplication regardless of what the caller's extractor returns, and that filtering/
 * sorting behave correctly directly against NameStat.
 */
class NameStatAggregatorSpec extends Specification {

    def "de-duplicates names an extractor returns more than once for the same series"() {
        given: "one series whose extractor yields 'spy' twice"
            def series = new SeriesEntity(title: "A", personalRating: 4)

        when:
            def stats = NameStatAggregator.aggregate(
                [series], { s -> ["spy", "spy"] }, null, null, null, null, null)

        then: "the series is only counted once toward 'spy'"
            stats.size() == 1
            stats[0].name() == "spy"
            stats[0].seriesCount() == 1
    }

    def "groups distinct series under the names their extractor returns, computing per-name averages"() {
        given: "two series both carrying 'spy', one rated 5 and one rated 3"
            def a = new SeriesEntity(title: "A", personalRating: 5)
            def b = new SeriesEntity(title: "B", personalRating: 3)

        when:
            def stats = NameStatAggregator.aggregate(
                [a, b], { s -> ["spy"] }, null, null, null, null, null)

        then:
            stats.size() == 1
            stats[0].seriesCount() == 2
            stats[0].averagePersonalRating() == 4.0G
    }

    def "sortBy=name sorts case-insensitively ascending"() {
        given:
            def a = new SeriesEntity(title: "A")
            def b = new SeriesEntity(title: "B")

        when:
            def stats = NameStatAggregator.aggregate(
                [a, b], { s -> s.title == "A" ? ["spy"] : ["Drama"] }, "name", "asc", null, null, null)

        then:
            stats*.name() == ["Drama", "spy"]
    }

    def "an unrecognized sortBy falls back to seriesCount descending"() {
        given: "'spy' on two series, 'drama' on one"
            def a = new SeriesEntity(title: "A")
            def b = new SeriesEntity(title: "B")
            def c = new SeriesEntity(title: "C")

        when:
            def stats = NameStatAggregator.aggregate(
                [a, b, c],
                { s -> s.title == "C" ? ["drama"] : ["spy"] },
                "bogus", null, null, null, null)

        then:
            stats*.name() == ["spy", "drama"]
    }

    def "minSeriesCount filters out names below the threshold"() {
        given: "'spy' on two series, 'drama' on one"
            def a = new SeriesEntity(title: "A")
            def b = new SeriesEntity(title: "B")
            def c = new SeriesEntity(title: "C")

        when:
            def stats = NameStatAggregator.aggregate(
                [a, b, c],
                { s -> s.title == "C" ? ["drama"] : ["spy"] },
                null, null, 2, null, null)

        then:
            stats*.name() == ["spy"]
    }

    def "sortBy=averageBlendedRating sorts descending by default with null averages last under both directions"() {
        given: "'spy' blended 7.0, 'drama' unrated"
            def spySeries = new SeriesEntity(title: "A", imdbRating: 7.0G)
            def dramaSeries = new SeriesEntity(title: "B")

        when: "default direction (desc)"
            def descStats = NameStatAggregator.aggregate(
                [spySeries, dramaSeries],
                { s -> s.title == "A" ? ["spy"] : ["drama"] },
                "averageBlendedRating", null, null, null, null)

        and: "explicit ascending"
            def ascStats = NameStatAggregator.aggregate(
                [spySeries, dramaSeries],
                { s -> s.title == "A" ? ["spy"] : ["drama"] },
                "averageBlendedRating", "asc", null, null, null)

        then: "'drama' (null average) sorts last regardless of direction"
            descStats*.name() == ["spy", "drama"]
            ascStats*.name() == ["spy", "drama"]
    }
}
