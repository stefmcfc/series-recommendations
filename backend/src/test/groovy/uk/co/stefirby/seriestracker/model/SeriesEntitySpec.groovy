package uk.co.stefirby.seriestracker.model

import spock.lang.Specification
import jakarta.validation.Validator
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest

@SpringBootTest
class SeriesEntitySpec extends Specification {

    @Autowired
    Validator validator

    def "should create a series with title only"() {
        when: "a series is created with only a title"
            def series = new SeriesEntity(title: "The Office")

        then: "the title is set and default values are applied"
            series.title == "The Office"
            series.status == SeriesStatus.BACKLOG
            series.id == null
            series.dateAdded == null
    }

    def "should create a series with all fields"() {
        when: "a series is created with all fields populated"
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
                rottenTomatoesRating: 72,
                personalRating: 4,
                personalNotes: "Epic show, some disappointing seasons",
                posterUrl: "https://example.com/got-poster.jpg",
                imdbId: "tt0944947"
            )

        then: "all fields are set correctly"
            series.title == "Game of Thrones"
            series.year == 2011
            series.status == SeriesStatus.WATCHING
            series.personalRating == 4
            series.posterUrl == "https://example.com/got-poster.jpg"
            series.imdbId == "tt0944947"
    }

    def "should reject series with blank title"() {
        given: "a series with a blank title"
            def series = new SeriesEntity(title: "")

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised for the title field"
            !violations.isEmpty()
            violations.any { it.propertyPath.toString() == "title" }
    }

    def "should reject series with null title"() {
        given: "a series with a null title"
            def series = new SeriesEntity(title: null)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised for the title field"
            !violations.isEmpty()
            violations.any { it.propertyPath.toString() == "title" }
    }

    def "should reject IMDb rating > 10"() {
        given: "a series with an IMDb rating above 10"
            def series = new SeriesEntity(title: "Show", imdbRating: 10.1)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised for the imdbRating field"
            !violations.isEmpty()
            violations.any { it.propertyPath.toString() == "imdbRating" }
    }

    def "should reject IMDb rating < 0"() {
        given: "a series with a negative IMDb rating"
            def series = new SeriesEntity(title: "Show", imdbRating: -0.1)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised"
            !violations.isEmpty()
    }

    def "should accept IMDb rating between 0 and 10 inclusive"() {
        given: "a series with an IMDb rating within the valid range"
            def series = new SeriesEntity(title: "Show", imdbRating: rating)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "no validation violations are raised"
            violations.isEmpty()

        where:
        rating << [0.0, 5.0, 10.0]
    }

    def "SERIES-017-AC-10: should reject TMDB rating > 10"() {
        given: "a series with a TMDB rating above 10"
            def series = new SeriesEntity(title: "Show", tmdbRating: 10.1)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised for the tmdbRating field"
            !violations.isEmpty()
            violations.any { it.propertyPath.toString() == "tmdbRating" }
    }

    def "SERIES-017-AC-10: should reject TMDB rating < 0"() {
        given: "a series with a negative TMDB rating"
            def series = new SeriesEntity(title: "Show", tmdbRating: -0.1)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised"
            !violations.isEmpty()
    }

    def "SERIES-017-AC-10: should accept TMDB rating between 0 and 10 inclusive"() {
        given: "a series with a TMDB rating within the valid range"
            def series = new SeriesEntity(title: "Show", tmdbRating: rating)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "no validation violations are raised"
            violations.isEmpty()

        where:
        rating << [0.0, 5.0, 10.0]
    }

    def "SERIES-017-AC-10: should reject a negative TMDB vote count"() {
        given: "a series with a negative tmdbVoteCount"
            def series = new SeriesEntity(title: "Show", tmdbVoteCount: -1)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised for the tmdbVoteCount field"
            !violations.isEmpty()
            violations.any { it.propertyPath.toString() == "tmdbVoteCount" }
    }

    def "SERIES-017-AC-10: should accept a zero or positive TMDB vote count"() {
        given: "a series with a non-negative tmdbVoteCount"
            def series = new SeriesEntity(title: "Show", tmdbVoteCount: count)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "no validation violations are raised"
            violations.isEmpty()

        where:
        count << [0, 245]
    }

    def "should reject Rotten Tomatoes rating > 100"() {
        given: "a series with a Rotten Tomatoes rating above 100"
            def series = new SeriesEntity(title: "Show", rottenTomatoesRating: 101)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised"
            !violations.isEmpty()
    }

    def "should accept personal rating between 1 and 5 inclusive"() {
        given: "a series with a personal rating within the valid range"
            def series = new SeriesEntity(title: "Show", personalRating: rating)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "no validation violations are raised"
            violations.isEmpty()

        where:
        rating << [1, 3, 5]
    }

    def "should reject personal rating < 1"() {
        given: "a series with a personal rating below 1"
            def series = new SeriesEntity(title: "Show", personalRating: 0)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised"
            !violations.isEmpty()
    }

    def "should reject personal rating > 5"() {
        given: "a series with a personal rating above 5"
            def series = new SeriesEntity(title: "Show", personalRating: 6)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised"
            !violations.isEmpty()
    }

    def "should reject year > current year"() {
        given: "a series with a year in the future"
            def series = new SeriesEntity(title: "Show", year: 2099)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised"
            !violations.isEmpty()
    }

    def "should accept year <= current year"() {
        given: "a series with a year no later than the current year"
            def series = new SeriesEntity(title: "Show", year: 2026)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "no validation violations are raised"
            violations.isEmpty()
    }

    def "should reject totalSeasons <= 0"() {
        given: "a series with a non-positive totalSeasons value"
            def series = new SeriesEntity(title: "Show", totalSeasons: 0)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised"
            !violations.isEmpty()
    }

    def "should reject totalEpisodes <= 0"() {
        given: "a series with a non-positive totalEpisodes value"
            def series = new SeriesEntity(title: "Show", totalEpisodes: 0)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised"
            !violations.isEmpty()
    }

    def "should reject currentSeason > totalSeasons"() {
        given: "a series whose currentSeason exceeds its totalSeasons"
            def series = new SeriesEntity(title: "Show", totalSeasons: 5, currentSeason: 6)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised"
            !violations.isEmpty()
    }

    def "should allow currentSeason <= totalSeasons"() {
        given: "a series whose currentSeason equals its totalSeasons"
            def series = new SeriesEntity(title: "Show", totalSeasons: 5, currentSeason: 5)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "no validation violations are raised"
            violations.isEmpty()
    }

    def "should reject currentEpisode <= 0"() {
        given: "a series with a non-positive currentEpisode value"
            def series = new SeriesEntity(title: "Show", currentEpisode: 0)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "a validation violation is raised"
            !violations.isEmpty()
    }

    def "should allow null optional fields"() {
        given: "a series with all optional fields set to null"
            def series = new SeriesEntity(
                title: "Show",
                year: null,
                genres: null,
                imdbRating: null,
                personalNotes: null,
                tmdbRating: null,
                tmdbVoteCount: null,
                tags: null
            )

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "no validation violations are raised"
            violations.isEmpty()
    }

    def "should set status to BACKLOG by default"() {
        when: "a series is created without specifying a status"
            def series = new SeriesEntity(title: "Show")

        then: "the status defaults to BACKLOG"
            series.status == SeriesStatus.BACKLOG
    }

    def "SERIES-017-AC-10: accepts a series with tmdbRating/tmdbVoteCount set"() {
        given: "a series with title, tmdbRating, and tmdbVoteCount all set"
            def series = new SeriesEntity(title: "Spooks", tmdbRating: 7.8, tmdbVoteCount: 245)

        expect: "the entity holds all three values"
            series.title == "Spooks"
            series.tmdbRating == 7.8
            series.tmdbVoteCount == 245
    }

    def "SERIES-017-AC-10: leaves tmdbRating/tmdbVoteCount null when unset, like other optional fields"() {
        given: "a series with only a title"
            def series = new SeriesEntity(title: "Breaking Bad")

        expect: "tmdbRating/tmdbVoteCount default to null"
            series.tmdbRating == null
            series.tmdbVoteCount == null
    }

    def "SERIES-014-AC-03/05: should create a series with tags set and return it verbatim"() {
        when: "a series is created with a comma-separated tags value"
            def series = new SeriesEntity(
                title: "Game of Thrones",
                tags: "rewatch candidate,watch with partner"
            )

        then: "the tags value is stored and returned exactly as given"
            series.tags == "rewatch candidate,watch with partner"
    }

    def "SERIES-014-AC-04: should allow a null tags value"() {
        given: "a series with tags explicitly set to null"
            def series = new SeriesEntity(title: "Show", tags: null)

        when: "the series is validated"
            def violations = validator.validate(series)

        then: "no validation violations are raised"
            violations.isEmpty()
    }

    def "SERIES-008-AC-01: excludeFromRecommendations defaults to false"() {
        given: "a new SeriesEntity with no explicit excludeFromRecommendations value"
            def entity = new SeriesEntity(title: "Some Show")

        expect: "it defaults to false"
            !entity.excludeFromRecommendations
    }

    def "SERIES-008-AC-01: excludeFromRecommendations can be set to true"() {
        given: "a SeriesEntity with excludeFromRecommendations explicitly true"
            def entity = new SeriesEntity(title: "Some Show", excludeFromRecommendations: true)

        expect: "the value is held"
            entity.excludeFromRecommendations
    }

    def "SERIES-008-AC-18: flaggedForRewatch defaults to false"() {
        given: "a new SeriesEntity with no explicit flaggedForRewatch value"
            def entity = new SeriesEntity(title: "Some Show")

        expect: "it defaults to false"
            !entity.flaggedForRewatch
    }

    def "SERIES-008-AC-18: flaggedForRewatch can be set to true"() {
        given: "a SeriesEntity with flaggedForRewatch explicitly true"
            def entity = new SeriesEntity(title: "Some Show", flaggedForRewatch: true)

        expect: "the value is held"
            entity.flaggedForRewatch
    }
}
