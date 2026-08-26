package uk.co.stefirby.seriestracker.service

import uk.co.stefirby.seriestracker.client.TmdbCandidate
import uk.co.stefirby.seriestracker.client.TmdbClient
import uk.co.stefirby.seriestracker.client.TmdbKeyword
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import spock.lang.Specification

class RecommendationOutputFilterServiceSpec extends Specification {

    TmdbClient tmdbClient = Mock()

    RecommendationOutputFilterService outputFilterService = new RecommendationOutputFilterService(tmdbClient, new TmdbGenreTable())

    private static TmdbCandidate candidate(int tmdbId, String title = "Candidate ${tmdbId}", Integer year = 2020,
                                            BigDecimal voteAverage = new BigDecimal("8.0"), List<Integer> genreIds = [18],
                                            Integer voteCount = 100, String originalLanguage = "en") {
        new TmdbCandidate(tmdbId, title, year, "overview", "/poster.jpg", voteAverage, genreIds, voteCount, originalLanguage, null)
    }

    private static DedupedCandidate dc(TmdbCandidate c) {
        new DedupedCandidate(c, [], "tt" + c.tmdbId())
    }

    def "SERIES-007-AC-24: minTmdbRating excludes candidates below the threshold"() {
        given: "two candidates: tmdbRating 5.0 and 8.0"
            def candidates = [dc(candidate(10, "Low", 2020, new BigDecimal("5.0"))), dc(candidate(20, "High", 2020, new BigDecimal("8.0")))]
            def criteria = new RecommendationCriteria(minTmdbRating: new BigDecimal("6.0"))

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "only the high-rated candidate remains"
            result.size() == 1
            result[0].candidate().title() == "High"
    }

    def "SERIES-007-AC-25: minVoteCount defaults to 20 when not supplied"() {
        given: "candidate with voteCount 5, candidate with voteCount 25"
            def candidates = [dc(candidate(10, "Low Votes", 2020, new BigDecimal("8.0"), [18], 5)), dc(candidate(20, "High Votes", 2020, new BigDecimal("8.0"), [18], 25))]

        when: "applyOutputFilters is called with no minVoteCount param"
            def result = outputFilterService.applyOutputFilters(candidates, new RecommendationCriteria())

        then: "only the voteCount-25 candidate is present"
            result.size() == 1
            result[0].candidate().title() == "High Votes"
    }

    def "SERIES-007-AC-25: minVoteCount=0 explicitly disables the filter"() {
        given: "a candidate with voteCount 5, below the default of 20"
            def candidates = [dc(candidate(10, "Low Votes", 2020, new BigDecimal("8.0"), [18], 5))]
            def criteria = new RecommendationCriteria(minVoteCount: 0)

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "the low-vote-count candidate is not excluded"
            result.size() == 1
    }

    def "SERIES-007-AC-26: a null year is excluded once yearMin/yearMax is set"() {
        given: "candidate with year null, candidate with year 2020"
            def candidates = [dc(candidate(10, "No Year", null)), dc(candidate(20, "Has Year", 2020))]
            def criteria = new RecommendationCriteria(yearMin: 2015)

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "only the year-2020 candidate is present"
            result.size() == 1
            result[0].candidate().title() == "Has Year"
    }

    def "SERIES-007-AC-26: yearMin/yearMax exclude candidates outside the inclusive range"() {
        given: "candidates with year 2010, 2015, 2020"
            def candidates = [dc(candidate(10, "Old", 2010)), dc(candidate(20, "Mid", 2015)), dc(candidate(30, "New", 2020))]
            def criteria = new RecommendationCriteria(yearMin: 2012, yearMax: 2018)

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "only Mid (2015) is within the inclusive range"
            result.size() == 1
            result[0].candidate().title() == "Mid"
    }

    def "SERIES-007-AC-27: excludeGenres excludes candidates matching any resolved display genre"() {
        given: "candidates with Drama (18) and Comedy (35) genres"
            def candidates = [dc(candidate(10, "Drama Show", 2020, new BigDecimal("8.0"), [18])), dc(candidate(20, "Comedy Show", 2020, new BigDecimal("8.0"), [35]))]
            def criteria = new RecommendationCriteria(excludeGenres: ["Drama"])

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "the Drama-genre candidate is excluded"
            result.size() == 1
            result[0].candidate().title() == "Comedy Show"
    }

    def "SERIES-007-AC-28: language excludes candidates whose originalLanguage doesn't case-insensitively match"() {
        given: "candidates with originalLanguage en and fr"
            def candidates = [
                dc(candidate(10, "English Show", 2020, new BigDecimal("8.0"), [18], 100, "en")),
                dc(candidate(20, "French Show", 2020, new BigDecimal("8.0"), [18], 100, "fr")),
            ]
            def criteria = new RecommendationCriteria(language: "EN")

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "only the English-language candidate is present"
            result.size() == 1
            result[0].candidate().title() == "English Show"
    }

    // -- Spec 024, Requirement 1 (SERIES-024-AC-03..08): excludeKeywords output filter --

    def "SERIES-024-AC-03/04: matchesExcludeKeywords excludes a candidate whose TMDB keywords match, case-insensitively"() {
        given: "a candidate and excludeKeywords=['Zombie']"
            def candidates = [dc(candidate(10, "Undead Show", 2020, new BigDecimal("8.0"), [18], 300))]
            def criteria = new RecommendationCriteria(excludeKeywords: ["Zombie"])
            tmdbClient.showKeywords(10) >> [new TmdbKeyword(1, "zombie")]

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "the candidate is excluded"
            result.isEmpty()
    }

    def "SERIES-024-AC-05: matchesExcludeKeywords only runs its extra call against candidates surviving cheaper filters"() {
        given: "two candidates, one already excluded by minTmdbRating"
            def candidates = [
                dc(candidate(10, "Low Rated", 2020, new BigDecimal("2.0"), [18], 300)),
                dc(candidate(20, "High Rated", 2020, new BigDecimal("9.0"), [18], 300)),
            ]
            def criteria = new RecommendationCriteria(minTmdbRating: new BigDecimal("8.0"), excludeKeywords: ["Zombie"])

        when: "applyOutputFilters is called"
            outputFilterService.applyOutputFilters(candidates, criteria)

        then: "showKeywords is only ever called for the surviving candidate"
            0 * tmdbClient.showKeywords(10)
            1 * tmdbClient.showKeywords(20) >> []
    }

    def "SERIES-024-AC-06: a showKeywords failure fails that candidate open, not the whole request"() {
        given: "TmdbClient.showKeywords throws ExternalServiceException for the candidate"
            def candidates = [dc(candidate(10, "Some Show", 2020, new BigDecimal("8.0"), [18], 300))]
            def criteria = new RecommendationCriteria(excludeKeywords: ["Zombie"])
            tmdbClient.showKeywords(10) >> { throw new ExternalServiceException("boom") }

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "no exception propagates and the candidate is still present"
            noExceptionThrown()
            result*.candidate()*.title() == ["Some Show"]
    }

    def "SERIES-024-AC-07: showKeywords is never called when excludeKeywords is unset"() {
        given: "no excludeKeywords in the request"
            def candidates = [dc(candidate(10, "Some Show"))]

        when: "applyOutputFilters is called"
            outputFilterService.applyOutputFilters(candidates, new RecommendationCriteria())

        then: "no TmdbClient.showKeywords call is made"
            0 * tmdbClient.showKeywords(_)
    }

    def "SERIES-024-AC-08: excludeKeywords applies regardless of sourceMode"() {
        given: "a candidate matching excludeKeywords under sourceMode=trending"
            def candidates = [dc(candidate(10, "Heist Show"))]
            def criteria = new RecommendationCriteria(sourceMode: "trending", excludeKeywords: ["Heist"])
            tmdbClient.showKeywords(10) >> [new TmdbKeyword(1, "heist")]

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "the candidate is excluded despite trending's ranking-bypass"
            result.isEmpty()
    }

    def "SERIES-024-AC-11: applyOutputFilters' post-hoc minVoteCount default is also 200 for topRated when unset"() {
        given: "a topRated candidate whose voteCount (150) is below the mode-aware 200 default"
            def candidates = [dc(candidate(10, "Below New Floor", 2020, new BigDecimal("9.0"), [18], 150))]
            def criteria = new RecommendationCriteria(sourceMode: "topRated")

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "the candidate is filtered out by the post-hoc filter"
            result.isEmpty()
    }

    def "SERIES-022-AC-12: the post-hoc minVoteCount output filter still applies to topRated candidates"() {
        given: "a candidate whose voteCount is below the requested floor"
            def candidates = [dc(candidate(10, "Below Floor", 2020, new BigDecimal("9.0"), [18], 50))]
            def criteria = new RecommendationCriteria(sourceMode: "topRated", minVoteCount: 100)

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "the candidate is filtered out"
            result.isEmpty()
    }
}
