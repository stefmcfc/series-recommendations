package uk.co.stefirby.seriestracker.service

import uk.co.stefirby.seriestracker.dto.RecommendationCriteria
import spock.lang.Specification

class RecommendationCriteriaValidatorSpec extends Specification {

    RecommendationCriteriaValidator validator = new RecommendationCriteriaValidator()

    def "SERIES-007-AC-17: seriesIds combined with genres is rejected"() {
        given: "criteria sets both seriesIds and genres"
            def criteria = new RecommendationCriteria(seriesIds: [UUID.randomUUID().toString()], genres: ["Drama"])

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-007-AC-17: seriesIds combined with keywords is rejected"() {
        given: "criteria sets both seriesIds and keywords"
            def criteria = new RecommendationCriteria(seriesIds: [UUID.randomUUID().toString()], keywords: ["Spy"])

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-007-AC-20: minSourceRating out of range (1-5) is rejected"() {
        given: "an out-of-range minSourceRating"
            def criteria = new RecommendationCriteria(minSourceRating: 9)

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    // -- Spec 022, Requirement 4 (SERIES-022-AC-16..19): mutual exclusivity & validation --

    def "SERIES-022-AC-16: sourceMode combined with seriesIds is rejected"() {
        given: "criteria sets both sourceMode and seriesIds"
            def criteria = new RecommendationCriteria(sourceMode: "trending", seriesIds: [UUID.randomUUID().toString()])

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-022-AC-16: sourceMode combined with genres is rejected"() {
        given: "criteria sets both sourceMode and genres"
            def criteria = new RecommendationCriteria(sourceMode: "topRated", genres: ["Drama"])

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-022-AC-16: sourceMode combined with keywords is rejected"() {
        given: "criteria sets both sourceMode and keywords"
            def criteria = new RecommendationCriteria(sourceMode: "trending", keywords: ["Spy"])

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-022-AC-17: an unrecognized sourceMode value is rejected"() {
        given: "criteria sets an unrecognized sourceMode"
            def criteria = new RecommendationCriteria(sourceMode: "bogus")

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-022-AC-18: an unrecognized trendingWindow value is rejected"() {
        given: "criteria sets an unrecognized trendingWindow"
            def criteria = new RecommendationCriteria(sourceMode: "trending", trendingWindow: "month")

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    // -- Spec 025: TMDB-native sort_by for topRated/genre modes --

    def "SERIES-025-AC-04: rejects an unrecognized discoverSortBy"() {
        given: "criteria with an invalid discoverSortBy"
            def criteria = new RecommendationCriteria(sourceMode: "topRated", discoverSortBy: "not-a-real-value")

        when: "validate is called"
            validator.validate(criteria)

        then: "IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-025-AC-04: accepts every documented TMDB sort_by value"() {
        expect: "no exception for any of the 12 documented values"
            ["first_air_date.asc", "first_air_date.desc", "name.asc", "name.desc",
             "original_name.asc", "original_name.desc", "popularity.asc", "popularity.desc",
             "vote_average.asc", "vote_average.desc", "vote_count.asc", "vote_count.desc"].each { value ->
                validator.validate(new RecommendationCriteria(sourceMode: "topRated", discoverSortBy: value))
            }
    }

    def "SERIES-025-AC-04: discoverSortBy is validated even under automatic sourcing, matching trendingWindow's existing mode-independent validation convention"() {
        given: "no sourceMode/genres/keywords set (automatic sourcing), but a bogus discoverSortBy"
            def criteria = new RecommendationCriteria(discoverSortBy: "not-a-real-value")

        when: "validate is called"
            validator.validate(criteria)

        then: "IllegalArgumentException is thrown regardless of mode"
            thrown(IllegalArgumentException)
    }
}
