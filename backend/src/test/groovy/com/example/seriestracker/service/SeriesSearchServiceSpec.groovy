package com.example.seriestracker.service

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import com.example.seriestracker.dto.SeriesDto
import com.example.seriestracker.dto.SeriesSearchCriteria
import com.example.seriestracker.repository.SeriesRepository

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
        given:
        def criteria = new SeriesSearchCriteria(title: "office")

        when:
        def results = searchService.search(criteria)

        then:
        results.size() == 1
        results[0].title == "The Office"
    }

    def "search by title uppercase still matches"() {
        given:
        def criteria = new SeriesSearchCriteria(title: "OFFICE")

        when:
        def results = searchService.search(criteria)

        then:
        results.size() == 1
        results[0].title == "The Office"
    }

    def "search by single genre"() {
        given:
        def criteria = new SeriesSearchCriteria(genres: ["Comedy"])

        when:
        def results = searchService.search(criteria)

        then:
        results.size() == 1
        results[0].title == "The Office"
    }

    def "search by genre matches series with that genre among many"() {
        given:
        def criteria = new SeriesSearchCriteria(genres: ["Drama"])

        when:
        def results = searchService.search(criteria)

        then:
        results.size() == 3  // GoT, Breaking Bad, Stranger Things
        results.every { it.genres.contains("Drama") }
    }

    def "search by multiple genres uses OR logic"() {
        given:
        def criteria = new SeriesSearchCriteria(genres: ["Comedy", "Sci-Fi"])

        when:
        def results = searchService.search(criteria)

        then:
        results.size() == 2  // The Office, Stranger Things
        results.any { it.title == "The Office" }
        results.any { it.title == "Stranger Things" }
    }

    def "search by status"() {
        given:
        def criteria = new SeriesSearchCriteria(status: "COMPLETED")

        when:
        def results = searchService.search(criteria)

        then:
        results.size() == 2
        results.every { it.status == "COMPLETED" }
    }

    def "search by personal rating range"() {
        given:
        def criteria = new SeriesSearchCriteria(minPersonalRating: 5, maxPersonalRating: 5)

        when:
        def results = searchService.search(criteria)

        then:
        results.size() == 2  // The Office, Breaking Bad
        results.every { it.personalRating == 5 }
    }

    def "search by IMDb rating range"() {
        given:
        def criteria = new SeriesSearchCriteria(minImdbRating: 9.2, maxImdbRating: 10.0)

        when:
        def results = searchService.search(criteria)

        then:
        results.size() == 2  // GoT (9.2), Breaking Bad (9.5)
        results.every { it.imdbRating >= 9.2 }
    }

    def "search started but not finished"() {
        given:
        def criteria = new SeriesSearchCriteria(startedNotFinished: true)

        when:
        def results = searchService.search(criteria)

        then:
        results.size() == 2  // Breaking Bad (WATCHING + progress), Stranger Things (DROPPED + progress)
        results.every { it.status in ["WATCHING", "DROPPED"] }
    }

    def "search combines multiple filters"() {
        given:
        def criteria = new SeriesSearchCriteria(
            title: "game",
            status: "COMPLETED",
            minImdbRating: 9.0
        )

        when:
        def results = searchService.search(criteria)

        then:
        results.size() == 1
        results[0].title == "Game of Thrones"
    }

    def "search with no matches returns empty list"() {
        given:
        def criteria = new SeriesSearchCriteria(title: "nonexistent xyz")

        when:
        def results = searchService.search(criteria)

        then:
        results.isEmpty()
    }

    def "invalid status throws IllegalArgumentException"() {
        given:
        def criteria = new SeriesSearchCriteria(status: "INVALID")

        when:
        searchService.search(criteria)

        then:
        thrown(IllegalArgumentException)
    }

    def "null personal rating is excluded when rating filter is set"() {
        given:
        // Stranger Things has no personalRating
        def criteria = new SeriesSearchCriteria(minPersonalRating: 4, maxPersonalRating: 5)

        when:
        def results = searchService.search(criteria)

        then:
        results.every { it.personalRating != null }
        !results.any { it.title == "Stranger Things" }
    }

    def "results are sorted by dateAdded descending"() {
        when:
        def results = searchService.search(new SeriesSearchCriteria())

        then:
        results.size() == 4
        // Most recently added first (Stranger Things was added last in setup)
        results[0].title == "Stranger Things"
        results[-1].title == "The Office"
    }
}
