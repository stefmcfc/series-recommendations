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

    def "search by personal rating range"() {
        given: "search criteria filtering by a personal rating of 5"
            def criteria = new SeriesSearchCriteria(minPersonalRating: 5, maxPersonalRating: 5)

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "only series with a personal rating of 5 are returned"
            results.size() == 2  // The Office, Breaking Bad
            results.every { it.personalRating == 5 }
    }

    def "search by IMDb rating range"() {
        given: "search criteria filtering by an IMDb rating range"
            def criteria = new SeriesSearchCriteria(minImdbRating: 9.2, maxImdbRating: 10.0)

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "only series within the rating range are returned"
            results.size() == 2  // GoT (9.2), Breaking Bad (9.5)
            results.every { it.imdbRating >= 9.2 }
    }

    def "search started but not finished"() {
        given: "search criteria filtering for series started but not finished"
            def criteria = new SeriesSearchCriteria(startedNotFinished: true)

        when: "the search is executed"
            def results = searchService.search(criteria)

        then: "only series with in-progress or dropped status are returned"
            results.size() == 2  // Breaking Bad (WATCHING + progress), Stranger Things (DROPPED + progress)
            results.every { it.status in ["WATCHING", "DROPPED"] }
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
        given: "search criteria filtering by personal rating range"
            // Stranger Things has no personalRating
            def criteria = new SeriesSearchCriteria(minPersonalRating: 4, maxPersonalRating: 5)

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
}
