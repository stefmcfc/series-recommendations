package uk.co.stefirby.seriestracker.service

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import uk.co.stefirby.seriestracker.dto.SeriesDto
import uk.co.stefirby.seriestracker.dto.SeriesSearchCriteria
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

    def setup() {
        seriesRepository.deleteAll()

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
}
