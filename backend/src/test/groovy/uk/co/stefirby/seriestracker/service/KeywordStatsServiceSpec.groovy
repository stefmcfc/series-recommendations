package uk.co.stefirby.seriestracker.service

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
}
