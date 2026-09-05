package uk.co.stefirby.seriestracker.service.keyword

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import uk.co.stefirby.seriestracker.model.KeywordEntity
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.repository.KeywordRepository
import uk.co.stefirby.seriestracker.repository.SeriesRepository

@SpringBootTest
@ActiveProfiles("test")
class KeywordStatsServiceSpec extends Specification {

    @Autowired
    KeywordStatsService keywordStatsService

    @Autowired
    KeywordRepository keywordRepository

    @Autowired
    SeriesRepository seriesRepository

    def cleanup() {
        seriesRepository.deleteAll()
        keywordRepository.deleteAll()
    }

    def "SERIES-019-AC-17: no tracked series with keywords yields an empty list"() {
        expect:
            keywordStatsService.getStats(null) == []
    }

    def "SERIES-019-AC-15: seriesCount and averagePersonalRating are computed correctly, excluding unrated series from the average"() {
        given: "three series carrying 'spy': rated 5, rated 3, and unrated"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            seriesRepository.save(new SeriesEntity(title: "A", personalRating: 5, keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", personalRating: 3, keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "C", personalRating: null, keywords: [spy] as Set))

        when: "getStats(null) is called"
            def stats = keywordStatsService.getStats(null)

        then: "spy has seriesCount 3 and averagePersonalRating 4.0 (excluding the unrated series)"
            def spyStat = stats.find { it.name() == "spy" }
            spyStat.seriesCount() == 3
            spyStat.averagePersonalRating() == 4.0G
    }

    def "SERIES-019-AC-15: a keyword with no rated series has a null average, not zero"() {
        given: "one series carrying 'mi5', unrated"
            def mi5 = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 190904, name: "mi5"))
            seriesRepository.save(new SeriesEntity(title: "A", personalRating: null, keywords: [mi5] as Set))

        when: "getStats(null) is called"
            def stats = keywordStatsService.getStats(null)

        then: "averagePersonalRating is null"
            stats.find { it.name() == "mi5" }.averagePersonalRating() == null
            stats.find { it.name() == "mi5" }.seriesCount() == 1
    }

    def "SERIES-019-AC-16: default sortBy (seriesCount) sorts descending"() {
        given: "'spy' carried by two series, 'mi5' carried by one"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def mi5 = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 190904, name: "mi5"))
            seriesRepository.save(new SeriesEntity(title: "A", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "C", keywords: [mi5] as Set))

        when: "getStats(null) is called"
            def stats = keywordStatsService.getStats(null)

        then: "'spy' (count 2) sorts before 'mi5' (count 1)"
            stats*.name() == ["spy", "mi5"]
    }

    def "SERIES-019-AC-16: sortBy=averagePersonalRating sorts descending with null-averages last"() {
        given: "'spy' averaging 4.0, 'drama' with no rated series"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def drama = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 18, name: "drama"))
            seriesRepository.save(new SeriesEntity(title: "A", personalRating: 4, keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", personalRating: null, keywords: [drama] as Set))

        when: "getStats('averagePersonalRating') is called"
            def stats = keywordStatsService.getStats("averagePersonalRating")

        then: "'spy' is first, 'drama' (null average) is last"
            stats*.name() == ["spy", "drama"]
    }

    def "SERIES-019-AC-16: an unrecognized sortBy value soft-falls-back to the default (seriesCount)"() {
        given: "'spy' carried by two series, 'mi5' carried by one"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def mi5 = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 190904, name: "mi5"))
            seriesRepository.save(new SeriesEntity(title: "A", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "C", keywords: [mi5] as Set))

        when: "getStats is called with an unrecognized sortBy value"
            def stats = keywordStatsService.getStats("bogus")

        then: "the result falls back to the default seriesCount-descending sort, not an error"
            stats*.name() == ["spy", "mi5"]
    }

    def "SERIES-047-AC-03: averageBlendedRating excludes series with no blended rating"() {
        given: "'spy' carried by a rated series and an unrated one"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            seriesRepository.save(new SeriesEntity(title: "A", imdbRating: 8.0G, tmdbRating: 6.0G, keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", keywords: [spy] as Set))

        when: "getStats is called"
            def spyStat = keywordStatsService.getStats(null, null, null, null, null).find { it.name() == "spy" }

        then: "the average reflects only the rated series"
            spyStat.averageBlendedRating() == 7.0G
    }

    def "SERIES-047-AC-03: a keyword with no series carrying a blended rating has a null average"() {
        given: "one series carrying 'mi5', with neither imdbRating nor tmdbRating set"
            def mi5 = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 190904, name: "mi5"))
            seriesRepository.save(new SeriesEntity(title: "A", keywords: [mi5] as Set))

        expect:
            keywordStatsService.getStats(null, null, null, null, null).find { it.name() == "mi5" }.averageBlendedRating() == null
    }

    def "SERIES-047-AC-04: sortBy=name sorts alphabetically, case-insensitively"() {
        given: "keywords 'spy' and 'Drama'"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def drama = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 18, name: "Drama"))
            seriesRepository.save(new SeriesEntity(title: "A", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", keywords: [drama] as Set))

        when: "getStats('name', 'asc', null, null, null) is called"
            def stats = keywordStatsService.getStats('name', 'asc', null, null, null)

        then: "'Drama' sorts before 'spy'"
            stats*.name() == ['Drama', 'spy']
    }

    def "SERIES-047-AC-04/AC-07: sortBy=name with no sortDirection defaults ascending"() {
        given: "keywords 'spy' and 'Drama'"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def drama = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 18, name: "Drama"))
            seriesRepository.save(new SeriesEntity(title: "A", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", keywords: [drama] as Set))

        expect: "default is ascending"
            keywordStatsService.getStats('name', null, null, null, null)*.name() == ['Drama', 'spy']

        and: "sortDirection=desc reverses it"
            keywordStatsService.getStats('name', 'desc', null, null, null)*.name() == ['spy', 'Drama']
    }

    def "SERIES-047-AC-05/AC-06: sortBy=averageBlendedRating sorts descending by default, nulls last under both directions"() {
        given: "'spy' blended 7.0, 'drama' blended 5.0, 'unrated' with no ratings"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def drama = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 18, name: "drama"))
            def unrated = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 99, name: "unrated"))
            seriesRepository.save(new SeriesEntity(title: "A", imdbRating: 7.0G, keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", imdbRating: 5.0G, keywords: [drama] as Set))
            seriesRepository.save(new SeriesEntity(title: "C", keywords: [unrated] as Set))

        expect: "default (desc) sorts spy, drama, unrated (null) last"
            keywordStatsService.getStats('averageBlendedRating', null, null, null, null)*.name() == ['spy', 'drama', 'unrated']

        and: "sortDirection=asc reverses the rated entries but still sorts the null-average entry last"
            keywordStatsService.getStats('averageBlendedRating', 'asc', null, null, null)*.name() == ['drama', 'spy', 'unrated']
    }

    def "SERIES-047-AC-06/07: sortDirection reverses seriesCount, defaults to desc when omitted"() {
        given: "'spy' on 3 series, 'drama' on 1"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def drama = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 18, name: "drama"))
            seriesRepository.save(new SeriesEntity(title: "A", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "C", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "D", keywords: [drama] as Set))

        expect: "default (no sortDirection) is descending"
            keywordStatsService.getStats('seriesCount', null, null, null, null)*.name() == ['spy', 'drama']

        and: "sortDirection=asc reverses it"
            keywordStatsService.getStats('seriesCount', 'asc', null, null, null)*.name() == ['drama', 'spy']
    }

    def "SERIES-047-AC-06/07: sortDirection reverses averagePersonalRating, nulls stay last under asc too"() {
        given: "'spy' rated 4, 'drama' unrated"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def drama = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 18, name: "drama"))
            seriesRepository.save(new SeriesEntity(title: "A", personalRating: 4, keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", keywords: [drama] as Set))

        expect: "default (desc) is spy then drama (null last)"
            keywordStatsService.getStats('averagePersonalRating', null, null, null, null)*.name() == ['spy', 'drama']

        and: "sortDirection=asc still keeps the null-average 'drama' last"
            keywordStatsService.getStats('averagePersonalRating', 'asc', null, null, null)*.name() == ['spy', 'drama']
    }

    def "SERIES-047-AC-08: an unrecognized sortDirection value soft-falls-back to the field's default direction"() {
        given: "'spy' on 2 series, 'drama' on 1"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def drama = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 18, name: "drama"))
            seriesRepository.save(new SeriesEntity(title: "A", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "C", keywords: [drama] as Set))

        expect: "an unrecognized sortDirection behaves as if omitted (seriesCount desc)"
            keywordStatsService.getStats('seriesCount', 'bogus', null, null, null)*.name() == ['spy', 'drama']
    }

    def "SERIES-047-AC-09/10: minSeriesCount excludes keywords below the threshold"() {
        given: "'spy' on 2 series, 'drama' on 1"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def drama = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 18, name: "drama"))
            seriesRepository.save(new SeriesEntity(title: "A", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "C", keywords: [drama] as Set))

        expect: "only 'spy' clears minSeriesCount=2"
            keywordStatsService.getStats(null, null, 2, null, null)*.name() == ['spy']
    }

    def "SERIES-047-AC-10/11: minAveragePersonalRating excludes null averages even at threshold 0"() {
        given: "'spy' unrated, 'drama' rated 4.0"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def drama = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 18, name: "drama"))
            seriesRepository.save(new SeriesEntity(title: "A", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", personalRating: 4, keywords: [drama] as Set))

        when: "getStats(null, null, null, 0, null) is called"
            def stats = keywordStatsService.getStats(null, null, null, 0 as BigDecimal, null)

        then: "only 'drama' passes"
            stats*.name() == ['drama']
    }

    def "SERIES-047-AC-10/11: minAverageBlendedRating excludes null averages and applies >= threshold"() {
        given: "'spy' blended 7.0, 'drama' unrated"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def drama = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 18, name: "drama"))
            seriesRepository.save(new SeriesEntity(title: "A", imdbRating: 7.0G, keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", keywords: [drama] as Set))

        expect: "only 'spy' clears minAverageBlendedRating=7.0"
            keywordStatsService.getStats(null, null, null, null, 7.0 as BigDecimal)*.name() == ['spy']

        and: "raising the threshold above 7.0 excludes it too"
            keywordStatsService.getStats(null, null, null, null, 7.1 as BigDecimal) == []
    }

    def "SERIES-047-AC-10: multiple filters are AND-combined"() {
        given: "'spy' on 2 series rated 4.0 average, 'drama' on 2 series but unrated"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def drama = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 18, name: "drama"))
            seriesRepository.save(new SeriesEntity(title: "A", personalRating: 4, keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "B", personalRating: 4, keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "C", keywords: [drama] as Set))
            seriesRepository.save(new SeriesEntity(title: "D", keywords: [drama] as Set))

        expect: "only 'spy' satisfies both minSeriesCount=2 and minAveragePersonalRating=3"
            keywordStatsService.getStats(null, null, 2, 3 as BigDecimal, null)*.name() == ['spy']
    }

    def "SERIES-047-AC-12: omitting all filters is unchanged from today's behavior"() {
        given: "a mix of rated and unrated series carrying keywords"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            seriesRepository.save(new SeriesEntity(title: "A", personalRating: 4, keywords: [spy] as Set))

        expect:
            keywordStatsService.getStats(null, null, null, null, null).size() == keywordStatsService.getStats(null).size()
    }
}
