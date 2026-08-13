package com.example.seriestracker.model

import spock.lang.Specification
import jakarta.validation.Validator
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest

@SpringBootTest
class SeriesEntitySpec extends Specification {

    @Autowired
    Validator validator

    def "should create a series with title only"() {
        when:
        def series = new SeriesEntity(title: "The Office")

        then:
        series.title == "The Office"
        series.status == SeriesStatus.BACKLOG
        series.id == null
        series.dateAdded == null
    }

    def "should create a series with all fields"() {
        when:
        def series = new SeriesEntity(
            title: "Game of Thrones",
            year: 2011,
            genres: "Drama,Fantasy,Thriller",
            totalSeasons: 8,
            totalEpisodes: 73,
            currentSeason: 5,
            currentEpisode: 3,
            status: SeriesStatus.WATCHING,
            imdbRating: 9.2,
            metacriticRating: 71,
            rottenTomatoesRating: 72,
            personalRating: 4,
            personalNotes: "Epic show, some disappointing seasons"
        )

        then:
        series.title == "Game of Thrones"
        series.year == 2011
        series.status == SeriesStatus.WATCHING
        series.personalRating == 4
    }

    def "should reject series with blank title"() {
        when:
        def series = new SeriesEntity(title: "")
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
        violations.any { it.propertyPath.toString() == "title" }
    }

    def "should reject series with null title"() {
        when:
        def series = new SeriesEntity(title: null)
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
        violations.any { it.propertyPath.toString() == "title" }
    }

    def "should reject IMDb rating > 10"() {
        when:
        def series = new SeriesEntity(title: "Show", imdbRating: 10.1)
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
        violations.any { it.propertyPath.toString() == "imdbRating" }
    }

    def "should reject IMDb rating < 0"() {
        when:
        def series = new SeriesEntity(title: "Show", imdbRating: -0.1)
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
    }

    def "should accept IMDb rating between 0 and 10 inclusive"() {
        when:
        def series = new SeriesEntity(title: "Show", imdbRating: rating)
        def violations = validator.validate(series)

        then:
        violations.isEmpty()

        where:
        rating << [0.0, 5.0, 10.0]
    }

    def "should reject Metacritic rating > 100"() {
        when:
        def series = new SeriesEntity(title: "Show", metacriticRating: 101)
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
    }

    def "should accept Metacritic rating between 0 and 100 inclusive"() {
        when:
        def series = new SeriesEntity(title: "Show", metacriticRating: rating)
        def violations = validator.validate(series)

        then:
        violations.isEmpty()

        where:
        rating << [0, 50, 100]
    }

    def "should reject Rotten Tomatoes rating > 100"() {
        when:
        def series = new SeriesEntity(title: "Show", rottenTomatoesRating: 101)
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
    }

    def "should accept personal rating between 1 and 5 inclusive"() {
        when:
        def series = new SeriesEntity(title: "Show", personalRating: rating)
        def violations = validator.validate(series)

        then:
        violations.isEmpty()

        where:
        rating << [1, 3, 5]
    }

    def "should reject personal rating < 1"() {
        when:
        def series = new SeriesEntity(title: "Show", personalRating: 0)
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
    }

    def "should reject personal rating > 5"() {
        when:
        def series = new SeriesEntity(title: "Show", personalRating: 6)
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
    }

    def "should reject year > current year"() {
        when:
        def series = new SeriesEntity(title: "Show", year: 2099)
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
    }

    def "should accept year <= current year"() {
        when:
        def series = new SeriesEntity(title: "Show", year: 2026)
        def violations = validator.validate(series)

        then:
        violations.isEmpty()
    }

    def "should reject totalSeasons <= 0"() {
        when:
        def series = new SeriesEntity(title: "Show", totalSeasons: 0)
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
    }

    def "should reject totalEpisodes <= 0"() {
        when:
        def series = new SeriesEntity(title: "Show", totalEpisodes: 0)
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
    }

    def "should reject currentSeason > totalSeasons"() {
        when:
        def series = new SeriesEntity(title: "Show", totalSeasons: 5, currentSeason: 6)
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
    }

    def "should allow currentSeason <= totalSeasons"() {
        when:
        def series = new SeriesEntity(title: "Show", totalSeasons: 5, currentSeason: 5)
        def violations = validator.validate(series)

        then:
        violations.isEmpty()
    }

    def "should reject currentEpisode <= 0"() {
        when:
        def series = new SeriesEntity(title: "Show", currentEpisode: 0)
        def violations = validator.validate(series)

        then:
        !violations.isEmpty()
    }

    def "should allow null optional fields"() {
        when:
        def series = new SeriesEntity(
            title: "Show",
            year: null,
            genres: null,
            imdbRating: null,
            personalNotes: null
        )
        def violations = validator.validate(series)

        then:
        violations.isEmpty()
    }

    def "should set status to BACKLOG by default"() {
        when:
        def series = new SeriesEntity(title: "Show")

        then:
        series.status == SeriesStatus.BACKLOG
    }
}