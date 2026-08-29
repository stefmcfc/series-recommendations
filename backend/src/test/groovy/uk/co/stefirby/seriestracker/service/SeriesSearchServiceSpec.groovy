package uk.co.stefirby.seriestracker.service

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import uk.co.stefirby.seriestracker.dto.SeriesDto
import uk.co.stefirby.seriestracker.dto.SeriesSearchCriteria
import uk.co.stefirby.seriestracker.model.KeywordEntity
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.repository.KeywordRepository
import uk.co.stefirby.seriestracker.repository.SeriesRepository

@SpringBootTest
@ActiveProfiles("test")
class SeriesSearchServiceSpec extends Specification {

    @Autowired
    SeriesService seriesService

    @Autowired
    SeriesSearchService searchService

    @Autowired
    SeriesRepository seriesRepository

    @Autowired
    KeywordRepository keywordRepository

    def setup() {
        seriesRepository.deleteAll()
        keywordRepository.deleteAll()

        seriesService.create(new SeriesDto(
            title: "The Office",
            genres: "Comedy",
            status: "COMPLETED",
            imdbRating: 9.0,
            personalRating: 5
        ))
        seriesService.create(new SeriesDto(
            title: "Game of Thrones",
            genres: "Drama,Fantasy,Thriller",
            status: "COMPLETED",
            imdbRating: 9.2,
            personalRating: 4
        ))
        seriesService.create(new SeriesDto(
            title: "Breaking Bad",
            genres: "Drama,Crime",
            status: "WATCHING",
            currentSeason: 4,
            imdbRating: 9.5,
            personalRating: 5
        ))
        seriesService.create(new SeriesDto(
            title: "Stranger Things",
            genres: "Drama,Sci-Fi",
            status: "DROPPED",
            currentSeason: 1,
            imdbRating: 8.7
        ))
    }

    def "search by title substring is case-insensitive"() {
        given: "search criteria filtering by a lowercase title substring"
            def criteria = new SeriesSearchCriteria(title: "office")

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "only the matching series is returned"
            results.size() == 1
            results[0].title == "The Office"
    }

    def "search by title uppercase still matches"() {
        given: "search criteria filtering by an uppercase title"
            def criteria = new SeriesSearchCriteria(title: "OFFICE")

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "the matching series is returned regardless of case"
            results.size() == 1
            results[0].title == "The Office"
    }

    def "search by single genre"() {
        given: "search criteria filtering by a single genre"
            def criteria = new SeriesSearchCriteria(genres: ["Comedy"])

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "only the series with that genre is returned"
            results.size() == 1
            results[0].title == "The Office"
    }

    def "search by genre matches series with that genre among many"() {
        given: "search criteria filtering by the Drama genre"
            def criteria = new SeriesSearchCriteria(genres: ["Drama"])

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "all series containing the Drama genre are returned"
            results.size() == 3  // GoT, Breaking Bad, Stranger Things
            results.every { it.genres.contains("Drama") }
    }

    def "search by multiple genres uses OR logic"() {
        given: "search criteria filtering by two genres"
            def criteria = new SeriesSearchCriteria(genres: ["Comedy", "Sci-Fi"])

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "series matching either genre are returned"
            results.size() == 2  // The Office, Stranger Things
            results.any { it.title == "The Office" }
            results.any { it.title == "Stranger Things" }
    }

    def "search by status"() {
        given: "search criteria filtering by the COMPLETED status"
            def criteria = new SeriesSearchCriteria(status: "COMPLETED")

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "only completed series are returned"
            results.size() == 2
            results.every { it.status == "COMPLETED" }
    }

    def "search by personal rating floor"() {
        given: "search criteria filtering by a minimum personal rating of 5"
            def criteria = new SeriesSearchCriteria(minPersonalRating: 5)

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "only series with a personal rating of at least 5 are returned"
            results.size() == 2  // The Office, Breaking Bad
            results.every { it.personalRating == 5 }
    }

    def "search by IMDb rating floor"() {
        given: "search criteria filtering by a minimum IMDb rating"
            def criteria = new SeriesSearchCriteria(minImdbRating: 9.2)

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "only series at or above the rating floor are returned"
            results.size() == 2  // GoT (9.2), Breaking Bad (9.5)
            results.every { it.imdbRating >= 9.2 }
    }

    def "SERIES-008-AC-20: flaggedForRewatch=true filters to only flagged series"() {
        given: "one series flagged for rewatch, on top of the four unflagged series from setup()"
            seriesService.create(new SeriesDto(title: "Rewatch Me", flaggedForRewatch: true))

        when: "search is called with flaggedForRewatch: true"
            def criteria = new SeriesSearchCriteria(flaggedForRewatch: true)
            def results = searchService.search(criteria)

        then: "only the flagged series is returned"
            results*.title == ["Rewatch Me"]
    }

    def "SERIES-008-AC-20: flaggedForRewatch unset returns everything, same as today"() {
        given: "one series flagged for rewatch, on top of the four unflagged series from setup()"
            seriesService.create(new SeriesDto(title: "Rewatch Me", flaggedForRewatch: true))

        when: "search is called with no flaggedForRewatch criteria"
            def results = searchService.search(new SeriesSearchCriteria())

        then: "all five series are returned"
            results.size() == 5
    }

    def "SERIES-008-AC-21: flaggedForRewatch is not restricted by status"() {
        given: "a BACKLOG series flagged for rewatch"
            seriesService.create(new SeriesDto(title: "Backlog Rewatch", status: "BACKLOG", flaggedForRewatch: true))

        when: "search is called with flaggedForRewatch: true"
            def results = searchService.search(new SeriesSearchCriteria(flaggedForRewatch: true))

        then: "the flagged BACKLOG series is returned regardless of status"
            results*.title == ["Backlog Rewatch"]
    }

    def "search combines multiple filters"() {
        given: "search criteria combining title, status, and rating filters"
            def criteria = new SeriesSearchCriteria(
                title: "game",
                status: "COMPLETED",
                minImdbRating: 9.0
            )

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "only the series matching all filters is returned"
            results.size() == 1
            results[0].title == "Game of Thrones"
    }

    def "search with no matches returns empty list"() {
        given: "search criteria that matches no series"
            def criteria = new SeriesSearchCriteria(title: "nonexistent xyz")

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "an empty list is returned"
            results.isEmpty()
    }

    def "invalid status throws IllegalArgumentException"() {
        given: "search criteria with an invalid status value"
            def criteria = new SeriesSearchCriteria(status: "INVALID")

        when: "the search is executed"
            searchService.search(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "null personal rating is excluded when rating filter is set"() {
        given: "search criteria filtering by a minimum personal rating"
            // Stranger Things has no personalRating
            def criteria = new SeriesSearchCriteria(minPersonalRating: 4)

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "series without a personal rating are excluded from the results"
            results.every { it.personalRating != null }
            !results.any { it.title == "Stranger Things" }
    }

    def "results are sorted by dateAdded descending"() {
        when: "all series are searched with no filters"
            def results = searchService.search(new SeriesSearchCriteria())

        then: "results are returned sorted by dateAdded descending"
            results.size() == 4
            // Most recently added first (Stranger Things was added last in setup)
            results[0].title == "Stranger Things"
            results[-1].title == "The Office"
    }

    def "SERIES-019-AC-19: keyword filter matches exactly (case-insensitive), not by substring"() {
        given: "a series carrying 'spy', another carrying 'espionage'"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def espionage = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 5265, name: "espionage"))
            seriesRepository.save(new SeriesEntity(title: "Spooks", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "Homeland", keywords: [espionage] as Set))

        when: "search is called with keywords: ['spy']"
            def results = searchService.search(new SeriesSearchCriteria(keywords: ["spy"]))

        then: "only the exact match is returned -- 'espionage' does not match 'spy'"
            results*.title == ["Spooks"]
    }

    def "SERIES-019-AC-19: keyword filter is case-insensitive"() {
        given: "a series carrying 'spy'"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            seriesRepository.save(new SeriesEntity(title: "Spooks", keywords: [spy] as Set))

        when: "search is called with a differently-cased keyword"
            def results = searchService.search(new SeriesSearchCriteria(keywords: ["SPY"]))

        then: "the series is still matched"
            results*.title == ["Spooks"]
    }

    def "SERIES-019-AC-19: multiple requested keywords use OR logic"() {
        given: "one series carrying 'spy', another carrying 'mi5', a third carrying neither"
            def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
            def mi5 = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 190904, name: "mi5"))
            seriesRepository.save(new SeriesEntity(title: "Spooks", keywords: [spy] as Set))
            seriesRepository.save(new SeriesEntity(title: "Homeland", keywords: [mi5] as Set))
            seriesRepository.save(new SeriesEntity(title: "The Office"))

        when: "search is called with both keywords"
            def results = searchService.search(new SeriesSearchCriteria(keywords: ["spy", "mi5"]))

        then: "both matching series are returned"
            results*.title as Set == ["Spooks", "Homeland"] as Set
    }

    def "SERIES-019-AC-21: an empty keywords list applies no filtering"() {
        given: "two series, neither carrying any keyword"
            seriesRepository.save(new SeriesEntity(title: "No Keywords One"))
            seriesRepository.save(new SeriesEntity(title: "No Keywords Two"))

        when: "search is called with no keywords criteria"
            def results = searchService.search(new SeriesSearchCriteria())

        then: "both series are returned (plus the four from setup)"
            results.size() == 6
    }

    def "SERIES-009-AC-01/04: sorts by personalRating descending, nulls last"() {
        given: "three additional series: rating 3, rating 5, rating null"
            seriesService.create(new SeriesDto(title: "Rating Test Three", personalRating: 3))
            seriesService.create(new SeriesDto(title: "Rating Test Five", personalRating: 5))
            seriesService.create(new SeriesDto(title: "Rating Test Null"))

        when: "search is called with sortBy=personalRating, sortDirection=desc, scoped to these three"
            def results = searchService.search(new SeriesSearchCriteria(
                title: "Rating Test", sortBy: "personalRating", sortDirection: "desc"))

        then: "order is 5, 3, null"
            results*.personalRating == [5, 3, null]
    }

    def "SERIES-009-AC-04: nulls stay last even under ascending order"() {
        given: "three additional series: rating 3, rating 5, rating null"
            seriesService.create(new SeriesDto(title: "Rating Test Three", personalRating: 3))
            seriesService.create(new SeriesDto(title: "Rating Test Five", personalRating: 5))
            seriesService.create(new SeriesDto(title: "Rating Test Null"))

        when: "search is called with sortBy=personalRating, sortDirection=asc, scoped to these three"
            def results = searchService.search(new SeriesSearchCriteria(
                title: "Rating Test", sortBy: "personalRating", sortDirection: "asc"))

        then: "order is 3, 5, null -- not null, 3, 5"
            results*.personalRating == [3, 5, null]
    }

    def "SERIES-009-AC-02: an invalid sortBy value is rejected"() {
        when: "search is called with sortBy=notAField"
            searchService.search(new SeriesSearchCriteria(sortBy: "notAField"))

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-009-AC-03: an invalid sortDirection value is rejected"() {
        when: "search is called with sortDirection=sideways"
            searchService.search(new SeriesSearchCriteria(sortDirection: "sideways"))

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-009-AC-08: sortBy=title compares case-insensitively"() {
        given: "two additional series: 'the Office Redux' and 'Archer Redux'"
            seriesService.create(new SeriesDto(title: "the Office Redux"))
            seriesService.create(new SeriesDto(title: "Archer Redux"))

        when: "search is called with sortBy=title, sortDirection=asc, scoped to these two"
            def results = searchService.search(new SeriesSearchCriteria(
                title: "Redux", sortBy: "title", sortDirection: "asc"))

        then: "'Archer Redux' sorts before 'the Office Redux' despite the lowercase 't'"
            results*.title == ["Archer Redux", "the Office Redux"]
    }

    def "SERIES-009-AC-09: sortBy=year sorts nulls last regardless of direction"() {
        given: "three additional series: year 2020, year 2010, year null"
            seriesService.create(new SeriesDto(title: "Year Test A", year: 2020))
            seriesService.create(new SeriesDto(title: "Year Test B", year: 2010))
            seriesService.create(new SeriesDto(title: "Year Test C"))

        when: "search is called with sortBy=year, sortDirection=asc"
            def results = searchService.search(new SeriesSearchCriteria(
                title: "Year Test", sortBy: "year", sortDirection: "asc"))

        then: "oldest year first, null last -- not first"
            results*.year == [2010, 2020, null]
    }

    def "SERIES-009-AC-09: sortBy=imdbRating sorts nulls last regardless of direction"() {
        given: "two additional series: one rated, one unrated"
            seriesService.create(new SeriesDto(title: "Imdb Sort Test A", imdbRating: 7.0))
            seriesService.create(new SeriesDto(title: "Imdb Sort Test B"))

        when: "search is called with sortBy=imdbRating, sortDirection=desc"
            def results = searchService.search(new SeriesSearchCriteria(
                title: "Imdb Sort Test", sortBy: "imdbRating", sortDirection: "desc"))

        then: "the rated series comes first, the unrated one last"
            results*.title == ["Imdb Sort Test A", "Imdb Sort Test B"]
    }

    def "SERIES-009-AC-09: sortBy=tmdbRating sorts nulls last regardless of direction"() {
        given: "two additional series: one rated, one unrated"
            seriesService.create(new SeriesDto(title: "Tmdb Sort Test A", tmdbRating: 7.0, tmdbVoteCount: 10))
            seriesService.create(new SeriesDto(title: "Tmdb Sort Test B"))

        when: "search is called with sortBy=tmdbRating, sortDirection=asc"
            def results = searchService.search(new SeriesSearchCriteria(
                title: "Tmdb Sort Test", sortBy: "tmdbRating", sortDirection: "asc"))

        then: "the rated series comes first (ascending order among the non-null values), the unrated one last"
            results*.title == ["Tmdb Sort Test A", "Tmdb Sort Test B"]
    }

    def "SERIES-009-AC-10: tmdbRating ties break on tmdbVoteCount descending"() {
        given: "two series both with tmdbRating 8.5: one with voteCount 50, one with voteCount 5000"
            seriesService.create(new SeriesDto(title: "Tmdb Tie A", tmdbRating: 8.5, tmdbVoteCount: 50))
            seriesService.create(new SeriesDto(title: "Tmdb Tie B", tmdbRating: 8.5, tmdbVoteCount: 5000))

        when: "search is called with sortBy=tmdbRating, sortDirection=desc"
            def results = searchService.search(new SeriesSearchCriteria(
                title: "Tmdb Tie", sortBy: "tmdbRating", sortDirection: "desc"))

        then: "the higher-vote-count series comes first"
            results[0].title == "Tmdb Tie B"
            results[0].tmdbVoteCount == 5000
    }

    def "SERIES-009-AC-10: the tmdbVoteCount tiebreak direction does not flip with sortDirection=asc"() {
        given: "two series both with tmdbRating 8.5: one with voteCount 50, one with voteCount 5000"
            seriesService.create(new SeriesDto(title: "Tmdb Tie C", tmdbRating: 8.5, tmdbVoteCount: 50))
            seriesService.create(new SeriesDto(title: "Tmdb Tie D", tmdbRating: 8.5, tmdbVoteCount: 5000))

        when: "search is called with sortBy=tmdbRating, sortDirection=asc"
            def results = searchService.search(new SeriesSearchCriteria(
                title: "Tmdb Tie", sortBy: "tmdbRating", sortDirection: "asc"))

        then: "the higher-vote-count series still comes first among the tied pair"
            def tieC = results.find { it.title == "Tmdb Tie C" }
            def tieD = results.find { it.title == "Tmdb Tie D" }
            results.indexOf(tieD) < results.indexOf(tieC)
    }

    def "SERIES-009-AC-11: an invalid sortBy value is still rejected under the enlarged enum"() {
        when: "search is called with sortBy=notAField"
            searchService.search(new SeriesSearchCriteria(sortBy: "notAField"))

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-037-AC-01: maxPersonalRating/maxImdbRating/startedNotFinished no longer filter results"() {
        given: "a series with personalRating=5, imdbRating=9.5, status=WATCHING"
            seriesRepository.save(new SeriesEntity(title: "Show", personalRating: 5, imdbRating: new BigDecimal("9.5"),
                status: uk.co.stefirby.seriestracker.model.SeriesStatus.WATCHING, currentSeason: 1))

        when: "search is called with only minPersonalRating set (no max, no startedNotFinished)"
            def criteria = new SeriesSearchCriteria(minPersonalRating: 3)
            def results = searchService.search(criteria)

        then: "the series is returned -- min-only filtering still works, removed fields have no getters to even set"
            results*.title.contains("Show")
    }

    def "SERIES-037-AC-02: minTmdbRating filters out series below the threshold"() {
        given: "two series, one above and one below the threshold"
            seriesRepository.save(new SeriesEntity(title: "High Tmdb", tmdbRating: new BigDecimal("8.5")))
            seriesRepository.save(new SeriesEntity(title: "Low Tmdb", tmdbRating: new BigDecimal("5.0")))

        when: "search is called with minTmdbRating=7.0, scoped to these two"
            def results = searchService.search(new SeriesSearchCriteria(title: "Tmdb", minTmdbRating: new BigDecimal("7.0")))

        then: "only the high-rated series is returned"
            results*.title == ["High Tmdb"]
    }

    def "SERIES-037-AC-02: a series with no tmdbRating never matches a minTmdbRating filter"() {
        given: "a series with tmdbRating unset"
            seriesRepository.save(new SeriesEntity(title: "Unrated Tmdb"))

        when: "search is called with minTmdbRating set, scoped to this series"
            def results = searchService.search(new SeriesSearchCriteria(title: "Unrated Tmdb", minTmdbRating: new BigDecimal("1.0")))

        then: "it's excluded"
            results.isEmpty()
    }

    def "SERIES-037-AC-03: yearMin/yearMax filters against the stored year field"() {
        given: "three series with different years"
            seriesRepository.save(new SeriesEntity(title: "Old Year", year: 2005))
            seriesRepository.save(new SeriesEntity(title: "InRange Year", year: 2020))
            seriesRepository.save(new SeriesEntity(title: "New Year", year: 2026))

        when: "search is called with yearMin=2015, yearMax=2025, scoped to these three"
            def results = searchService.search(new SeriesSearchCriteria(title: "Year", yearMin: 2015, yearMax: 2025))

        then: "only the in-range series is returned"
            results*.title == ["InRange Year"]
    }

    def "SERIES-037-AC-03: a series with no year never matches a yearMin/yearMax filter"() {
        given: "a series with year unset"
            seriesRepository.save(new SeriesEntity(title: "Unyeared Series"))

        when: "search is called with yearMin set, scoped to this series"
            def results = searchService.search(new SeriesSearchCriteria(title: "Unyeared", yearMin: 2000))

        then: "it's excluded"
            results.isEmpty()
    }

    def "SERIES-039-AC-05: a running show matches a range it started before but is still airing through"() {
        given: "a show that started in 2018, most recently aired in 2024, still running"
            seriesRepository.save(new SeriesEntity(title: "Long Runner", year: 2018, lastAirYear: 2024))

        when: "search is called with yearMin=2022, yearMax=2023"
            def results = searchService.search(new SeriesSearchCriteria(title: "Long Runner", yearMin: 2022, yearMax: 2023))

        then: "it matches -- its aired span (2018-2024) overlaps 2022-2023, even though it started earlier"
            results*.title == ["Long Runner"]
    }

    def "SERIES-039-AC-05: a series with no lastAirYear falls back to matching on year alone"() {
        given: "a series with year but no lastAirYear (not yet resolved)"
            seriesRepository.save(new SeriesEntity(title: "Unresolved", year: 2020))

        when: "search is called with yearMin=2020, yearMax=2020"
            def results = searchService.search(new SeriesSearchCriteria(title: "Unresolved", yearMin: 2020, yearMax: 2020))

        then: "it matches via the year-only fallback"
            results*.title == ["Unresolved"]
    }

    def "SERIES-039-AC-05: a show whose entire aired span ends before yearMin does not match"() {
        given: "a show that aired 2010-2012, well before the requested range"
            seriesRepository.save(new SeriesEntity(title: "Long Gone", year: 2010, lastAirYear: 2012))

        when: "search is called with yearMin=2015"
            def results = searchService.search(new SeriesSearchCriteria(title: "Long Gone", yearMin: 2015))

        then: "it's excluded -- its aired span never reaches yearMin"
            results.isEmpty()
    }

    def "SERIES-039-AC-05: a show whose entire aired span starts after yearMax does not match"() {
        given: "a show that started in 2026, after the requested range's upper bound"
            seriesRepository.save(new SeriesEntity(title: "Too New", year: 2026, lastAirYear: 2026))

        when: "search is called with yearMax=2020"
            def results = searchService.search(new SeriesSearchCriteria(title: "Too New", yearMax: 2020))

        then: "it's excluded -- its aired span never reaches yearMax"
            results.isEmpty()
    }
}
