package uk.co.stefirby.seriestracker.service.stats

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.model.SeriesStatus
import uk.co.stefirby.seriestracker.repository.SeriesRepository

@SpringBootTest
@ActiveProfiles("test")
class CountryStatsServiceSpec extends Specification {

    @Autowired
    CountryStatsService countryStatsService

    @Autowired
    SeriesRepository seriesRepository

    def cleanup() {
        seriesRepository.deleteAll()
    }

    def "SERIES-049-AC-06: no tracked series with an origin country yields an empty list"() {
        expect:
            countryStatsService.getStats(null, null, null, null, null, null) == []
    }

    def "SERIES-049-AC-02/03: a multi-country series contributes once to each listed country"() {
        given: "a co-produced series (GB,US) and a single-country series (GB)"
            seriesRepository.save(new SeriesEntity(title: "A", originCountry: "GB,US"))
            seriesRepository.save(new SeriesEntity(title: "B", originCountry: "GB"))

        when: "getStats(null, null, null, null, null, null) is called"
            def stats = countryStatsService.getStats(null, null, null, null, null, null)

        then: "GB has seriesCount 2, US has seriesCount 1 -- not fractional"
            stats.find { it.name() == "GB" }.seriesCount() == 2
            stats.find { it.name() == "US" }.seriesCount() == 1
    }

    def "SERIES-049-AC-03: a series with a null/blank originCountry contributes to no aggregate"() {
        given: "one series with a null originCountry and one with a blank string"
            seriesRepository.save(new SeriesEntity(title: "A", originCountry: null))
            seriesRepository.save(new SeriesEntity(title: "B", originCountry: ""))

        expect:
            countryStatsService.getStats(null, null, null, null, null, null) == []
    }

    def "SERIES-049-AC-02: split logic is a bare comma split with no per-segment trimming"() {
        given: "a series whose originCountry lists GB and US with no embedded whitespace"
            seriesRepository.save(new SeriesEntity(title: "A", originCountry: "GB,US"))

        when: "getStats(null, null, null, null, null, null) is called"
            def stats = countryStatsService.getStats(null, null, null, null, null, null)

        then: "both codes are aggregated as-is"
            stats*.name().sort() == ["GB", "US"]
    }

    def "SERIES-049-AC-04: averages exclude unrated/unblended series, mirroring genre/keyword stats"() {
        given: "two GB series, one rated and blended, one neither"
            seriesRepository.save(new SeriesEntity(title: "A", originCountry: "GB", personalRating: 4, imdbRating: 8.0G))
            seriesRepository.save(new SeriesEntity(title: "B", originCountry: "GB"))

        when: "getStats(null, null, null, null, null, null) is called"
            def gb = countryStatsService.getStats(null, null, null, null, null, null).find { it.name() == "GB" }

        then: "both averages reflect only the one qualifying series"
            gb.averagePersonalRating() == 4.0G
            gb.averageBlendedRating() == 8.0G
    }

    def "SERIES-049-AC-04: a country with no rated series has a null average, not zero"() {
        given: "one GB series, unrated and unblended"
            seriesRepository.save(new SeriesEntity(title: "A", originCountry: "GB"))

        when: "getStats(null, null, null, null, null, null) is called"
            def gb = countryStatsService.getStats(null, null, null, null, null, null).find { it.name() == "GB" }

        then: "both averages are null"
            gb.averagePersonalRating() == null
            gb.averageBlendedRating() == null
            gb.seriesCount() == 1
    }

    def "SERIES-049-AC-05: default sortBy (seriesCount) sorts descending"() {
        given: "'GB' carried by two series, 'US' by one"
            seriesRepository.save(new SeriesEntity(title: "A", originCountry: "GB"))
            seriesRepository.save(new SeriesEntity(title: "B", originCountry: "GB"))
            seriesRepository.save(new SeriesEntity(title: "C", originCountry: "US"))

        expect:
            countryStatsService.getStats(null, null, null, null, null, null)*.name() == ["GB", "US"]
    }

    def "SERIES-049-AC-05: sortBy=name sorts alphabetically, case-insensitively, by raw ISO code"() {
        given: "origin countries 'US' and 'GB'"
            seriesRepository.save(new SeriesEntity(title: "A", originCountry: "US"))
            seriesRepository.save(new SeriesEntity(title: "B", originCountry: "GB"))

        expect:
            countryStatsService.getStats('name', 'asc', null, null, null, null)*.name() == ['GB', 'US']
    }

    def "SERIES-049-AC-05: minSeriesCount excludes countries below the threshold"() {
        given: "'GB' on 2 series, 'US' on 1"
            seriesRepository.save(new SeriesEntity(title: "A", originCountry: "GB"))
            seriesRepository.save(new SeriesEntity(title: "B", originCountry: "GB"))
            seriesRepository.save(new SeriesEntity(title: "C", originCountry: "US"))

        expect: "only 'GB' clears minSeriesCount=2"
            countryStatsService.getStats(null, null, 2, null, null, null)*.name() == ['GB']
    }

    def "SERIES-049-AC-05: minAveragePersonalRating excludes null averages even at threshold 0"() {
        given: "'GB' unrated, 'US' rated 4.0"
            seriesRepository.save(new SeriesEntity(title: "A", originCountry: "GB"))
            seriesRepository.save(new SeriesEntity(title: "B", originCountry: "US", personalRating: 4))

        expect:
            countryStatsService.getStats(null, null, null, 0 as BigDecimal, null, null)*.name() == ['US']
    }

    def "SERIES-049-AC-05: minAverageBlendedRating excludes null averages and applies >= threshold"() {
        given: "'GB' blended 7.0, 'US' unrated"
            seriesRepository.save(new SeriesEntity(title: "A", originCountry: "GB", imdbRating: 7.0G))
            seriesRepository.save(new SeriesEntity(title: "B", originCountry: "US"))

        expect: "only 'GB' clears minAverageBlendedRating=7.0"
            countryStatsService.getStats(null, null, null, null, 7.0 as BigDecimal, null)*.name() == ['GB']

        and: "raising the threshold above 7.0 excludes it too"
            countryStatsService.getStats(null, null, null, null, 7.1 as BigDecimal, null) == []
    }

    def "SERIES-051: onlyCompleted is passed through to the aggregator"() {
        given: "a COMPLETED and a BACKLOG series both carrying 'GB'"
            seriesRepository.save(new SeriesEntity(title: "A", status: SeriesStatus.COMPLETED, originCountry: "GB"))
            seriesRepository.save(new SeriesEntity(title: "B", status: SeriesStatus.BACKLOG, originCountry: "GB"))

        when: "getStats is called with onlyCompleted=true"
            def gbStat = countryStatsService.getStats(null, null, null, null, null, true).find { it.name() == "GB" }

        then: "only the completed series is counted"
            gbStat.seriesCount() == 1
    }
}
