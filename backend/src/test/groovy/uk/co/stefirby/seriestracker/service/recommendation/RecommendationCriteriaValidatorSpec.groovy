package uk.co.stefirby.seriestracker.service.recommendation

import uk.co.stefirby.seriestracker.dto.RecommendationCriteria
import spock.lang.Specification

import java.time.Clock
import java.time.Year

class RecommendationCriteriaValidatorSpec extends Specification {

    RecommendationCriteriaValidator validator = new RecommendationCriteriaValidator(Clock.systemDefaultZone())

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

    // -- Spec 031, Requirement 3 (SERIES-031-AC-11/12): minTmdbRating/year bounds validation --

    def "SERIES-031-AC-11: a negative minTmdbRating is rejected"() {
        given: "a negative minTmdbRating"
            def criteria = new RecommendationCriteria(minTmdbRating: -0.1)

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-031-AC-11: a minTmdbRating above 10 is rejected"() {
        given: "a minTmdbRating above TMDB's own 0-10 scale"
            def criteria = new RecommendationCriteria(minTmdbRating: 10.1)

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-031-AC-11: minTmdbRating at the 0 and 10 boundaries is accepted"() {
        expect: "no exception at either boundary"
            validator.validate(new RecommendationCriteria(minTmdbRating: 0))
            validator.validate(new RecommendationCriteria(minTmdbRating: 10))
    }

    def "SERIES-031-AC-12: a yearMin below 1900 is rejected"() {
        given: "a yearMin before any TV series existed"
            def criteria = new RecommendationCriteria(yearMin: 1899)

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-031-AC-12: a yearMax more than one year in the future is rejected"() {
        given: "a yearMax past the allowed near-future bound"
            def criteria = new RecommendationCriteria(yearMax: Year.now().value + 2)

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-031-AC-12: a negative year is rejected"() {
        given: "a negative yearMin"
            def criteria = new RecommendationCriteria(yearMin: -5)

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-031-AC-12: yearMin exceeding yearMax is rejected"() {
        given: "yearMin after yearMax"
            def criteria = new RecommendationCriteria(yearMin: 2024, yearMax: 2020)

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-031-AC-12: yearMin/yearMax within bounds is accepted"() {
        expect: "no exception for a valid range, including the current-year+1 boundary"
            validator.validate(new RecommendationCriteria(yearMin: 1900, yearMax: Year.now().value + 1))
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

    // -- Spec 033, Requirement 1 (SERIES-033-AC-01..03): sourceMode=useMySeries --

    def "SERIES-033-AC-01: sourceMode=useMySeries is accepted"() {
        expect: "no exception"
            validator.validate(new RecommendationCriteria(sourceMode: "useMySeries"))
    }

    def "SERIES-033-AC-02: sourceMode=useMySeries combined with genres is rejected"() {
        given: "criteria sets both sourceMode=useMySeries and genres"
            def criteria = new RecommendationCriteria(sourceMode: "useMySeries", genres: ["Drama"])

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-033-AC-02: sourceMode=useMySeries combined with keywords is rejected"() {
        given: "criteria sets both sourceMode=useMySeries and keywords"
            def criteria = new RecommendationCriteria(sourceMode: "useMySeries", keywords: ["Spy"])

        when: "validate is called"
            validator.validate(criteria)

        then: "an IllegalArgumentException is thrown"
            thrown(IllegalArgumentException)
    }

    def "SERIES-033-AC-03: sourceMode=useMySeries combined with seriesIds is allowed"() {
        given: "criteria sets both sourceMode=useMySeries and seriesIds"
            def criteria = new RecommendationCriteria(sourceMode: "useMySeries", seriesIds: [UUID.randomUUID().toString()])

        expect: "no exception"
            validator.validate(criteria)
    }
}
