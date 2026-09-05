package uk.co.stefirby.seriestracker.service.stats

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.repository.SeriesRepository

@SpringBootTest
@ActiveProfiles("test")
class GenreStatsServiceSpec extends Specification {

    @Autowired
    GenreStatsService genreStatsService

    @Autowired
    SeriesRepository seriesRepository

    def cleanup() {
        seriesRepository.deleteAll()
    }

    def "SERIES-048-AC-06: no tracked series with genres yields an empty list"() {
        expect:
            genreStatsService.getStats(null, null, null, null, null) == []
    }

    def "SERIES-048-AC-02/03: aggregates genres from the delimited column, de-duplicated per series"() {
        given: "two series, one carrying Drama+Sci-Fi, one carrying Drama twice (malformed)"
            seriesRepository.save(new SeriesEntity(title: "A", genres: "Drama,Sci-Fi"))
            seriesRepository.save(new SeriesEntity(title: "B", genres: "Drama,Drama"))

        when: "getStats(null, null, null, null, null) is called"
            def stats = genreStatsService.getStats(null, null, null, null, null)

        then: "Drama has seriesCount 2 (not 3), Sci-Fi has seriesCount 1"
            stats.find { it.name() == "Drama" }.seriesCount() == 2
            stats.find { it.name() == "Sci-Fi" }.seriesCount() == 1
    }

    def "SERIES-048-AC-02: split/trim/filter-empty logic mirrors RecommendationSourcingService.splitGenres"() {
        given: "a series with extra whitespace and an empty trailing segment"
            seriesRepository.save(new SeriesEntity(title: "A", genres: " Drama , Sci-Fi ,"))

        when: "getStats(null, null, null, null, null) is called"
            def stats = genreStatsService.getStats(null, null, null, null, null)

        then: "the genre names are trimmed and no empty-string genre is produced"
            stats*.name().sort() == ["Drama", "Sci-Fi"]
    }

    def "SERIES-048-AC-02: a series with a blank/null genres column contributes no stats"() {
        given: "one series with no genres and one with an empty genres string"
            seriesRepository.save(new SeriesEntity(title: "A", genres: null))
            seriesRepository.save(new SeriesEntity(title: "B", genres: ""))

        expect:
            genreStatsService.getStats(null, null, null, null, null) == []
    }

    def "SERIES-048-AC-04: averages exclude unrated/unblended series, mirroring keyword stats"() {
        given: "two Drama series, one rated and blended, one neither"
            seriesRepository.save(new SeriesEntity(title: "A", genres: "Drama", personalRating: 4, imdbRating: 8.0G))
            seriesRepository.save(new SeriesEntity(title: "B", genres: "Drama"))

        when: "getStats(null, null, null, null, null) is called"
            def drama = genreStatsService.getStats(null, null, null, null, null).find { it.name() == "Drama" }

        then: "both averages reflect only the one qualifying series"
            drama.averagePersonalRating() == 4.0G
            drama.averageBlendedRating() == 8.0G
    }

    def "SERIES-048-AC-04: a genre with no rated series has a null average, not zero"() {
        given: "one Drama series, unrated and unblended"
            seriesRepository.save(new SeriesEntity(title: "A", genres: "Drama"))

        when: "getStats(null, null, null, null, null) is called"
            def drama = genreStatsService.getStats(null, null, null, null, null).find { it.name() == "Drama" }

        then: "both averages are null"
            drama.averagePersonalRating() == null
            drama.averageBlendedRating() == null
            drama.seriesCount() == 1
    }

    def "SERIES-048-AC-05: default sortBy (seriesCount) sorts descending"() {
        given: "'Drama' carried by two series, 'Comedy' by one"
            seriesRepository.save(new SeriesEntity(title: "A", genres: "Drama"))
            seriesRepository.save(new SeriesEntity(title: "B", genres: "Drama"))
            seriesRepository.save(new SeriesEntity(title: "C", genres: "Comedy"))

        expect:
            genreStatsService.getStats(null, null, null, null, null)*.name() == ["Drama", "Comedy"]
    }

    def "SERIES-048-AC-05: sortBy=name sorts alphabetically, case-insensitively"() {
        given: "genres 'Sci-Fi' and 'drama'"
            seriesRepository.save(new SeriesEntity(title: "A", genres: "Sci-Fi"))
            seriesRepository.save(new SeriesEntity(title: "B", genres: "drama"))

        expect:
            genreStatsService.getStats('name', 'asc', null, null, null)*.name() == ['drama', 'Sci-Fi']
    }

    def "SERIES-048-AC-05: sortBy=averageBlendedRating sorts descending by default, nulls last under both directions"() {
        given: "'Drama' blended 7.0, 'Comedy' blended 5.0, 'Horror' unrated"
            seriesRepository.save(new SeriesEntity(title: "A", genres: "Drama", imdbRating: 7.0G))
            seriesRepository.save(new SeriesEntity(title: "B", genres: "Comedy", imdbRating: 5.0G))
            seriesRepository.save(new SeriesEntity(title: "C", genres: "Horror"))

        expect: "default (desc) sorts Drama, Comedy, Horror (null) last"
            genreStatsService.getStats('averageBlendedRating', null, null, null, null)*.name() == ['Drama', 'Comedy', 'Horror']

        and: "sortDirection=asc reverses the rated entries but still sorts the null-average entry last"
            genreStatsService.getStats('averageBlendedRating', 'asc', null, null, null)*.name() == ['Comedy', 'Drama', 'Horror']
    }

    def "SERIES-048-AC-05: an unrecognized sortBy value soft-falls-back to the default (seriesCount)"() {
        given: "'Drama' carried by two series, 'Comedy' by one"
            seriesRepository.save(new SeriesEntity(title: "A", genres: "Drama"))
            seriesRepository.save(new SeriesEntity(title: "B", genres: "Drama"))
            seriesRepository.save(new SeriesEntity(title: "C", genres: "Comedy"))

        expect:
            genreStatsService.getStats('bogus', null, null, null, null)*.name() == ['Drama', 'Comedy']
    }

    def "SERIES-048-AC-05: minSeriesCount excludes genres below the threshold"() {
        given: "'Drama' on 2 series, 'Comedy' on 1"
            seriesRepository.save(new SeriesEntity(title: "A", genres: "Drama"))
            seriesRepository.save(new SeriesEntity(title: "B", genres: "Drama"))
            seriesRepository.save(new SeriesEntity(title: "C", genres: "Comedy"))

        expect: "only 'Drama' clears minSeriesCount=2"
            genreStatsService.getStats(null, null, 2, null, null)*.name() == ['Drama']
    }

    def "SERIES-048-AC-05: minAveragePersonalRating excludes null averages even at threshold 0"() {
        given: "'Drama' unrated, 'Comedy' rated 4.0"
            seriesRepository.save(new SeriesEntity(title: "A", genres: "Drama"))
            seriesRepository.save(new SeriesEntity(title: "B", genres: "Comedy", personalRating: 4))

        expect:
            genreStatsService.getStats(null, null, null, 0 as BigDecimal, null)*.name() == ['Comedy']
    }

    def "SERIES-048-AC-05: minAverageBlendedRating excludes null averages and applies >= threshold"() {
        given: "'Drama' blended 7.0, 'Comedy' unrated"
            seriesRepository.save(new SeriesEntity(title: "A", genres: "Drama", imdbRating: 7.0G))
            seriesRepository.save(new SeriesEntity(title: "B", genres: "Comedy"))

        expect: "only 'Drama' clears minAverageBlendedRating=7.0"
            genreStatsService.getStats(null, null, null, null, 7.0 as BigDecimal)*.name() == ['Drama']

        and: "raising the threshold above 7.0 excludes it too"
            genreStatsService.getStats(null, null, null, null, 7.1 as BigDecimal) == []
    }

    def "SERIES-048-AC-05: multiple filters are AND-combined"() {
        given: "'Drama' on 2 series rated 4.0 average, 'Comedy' on 2 series but unrated"
            seriesRepository.save(new SeriesEntity(title: "A", genres: "Drama", personalRating: 4))
            seriesRepository.save(new SeriesEntity(title: "B", genres: "Drama", personalRating: 4))
            seriesRepository.save(new SeriesEntity(title: "C", genres: "Comedy"))
            seriesRepository.save(new SeriesEntity(title: "D", genres: "Comedy"))

        expect: "only 'Drama' satisfies both minSeriesCount=2 and minAveragePersonalRating=3"
            genreStatsService.getStats(null, null, 2, 3 as BigDecimal, null)*.name() == ['Drama']
    }
}
