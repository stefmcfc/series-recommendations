package uk.co.stefirby.seriestracker.service.recommendation

import uk.co.stefirby.seriestracker.client.tmdb.TmdbCandidate
import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient
import uk.co.stefirby.seriestracker.client.tmdb.TmdbKeyword
import uk.co.stefirby.seriestracker.dto.RecommendationCriteria
import uk.co.stefirby.seriestracker.exception.ExternalServiceException
import uk.co.stefirby.seriestracker.service.tmdb.TmdbGenreTable
import spock.lang.Specification

class RecommendationOutputFilterServiceSpec extends Specification {

    TmdbClient tmdbClient = Mock()

    RecommendationOutputFilterService outputFilterService = new RecommendationOutputFilterService(tmdbClient, new TmdbGenreTable(), 200)

    // Default voteCount (300) is deliberately >= the SERIES-029-AC-05 default minVoteCount
    // (200, superseding the old SERIES-007-AC-25 default of 20), so tests exercising other
    // output filters aren't inadvertently affected by the minVoteCount filter.
    private static TmdbCandidate candidate(int tmdbId, String title = "Candidate ${tmdbId}", Integer year = 2020,
                                            BigDecimal voteAverage = new BigDecimal("8.0"), List<Integer> genreIds = [18],
                                            Integer voteCount = 300, String originalLanguage = "en") {
        new TmdbCandidate(tmdbId, title, year, "overview", "/poster.jpg", voteAverage, genreIds, voteCount, originalLanguage, [])
    }

    private static DedupedCandidate dc(TmdbCandidate c) {
        new DedupedCandidate(c, [], "tt" + c.tmdbId())
    }

    private static DedupedCandidate candidateWithRating(BigDecimal voteAverage) {
        dc(candidate(1, "Show", 2020, voteAverage))
    }

    private static DedupedCandidate candidateWithYear(Integer year) {
        dc(candidate(1, "Show", year))
    }

    private static DedupedCandidate candidateWithOriginCountry(String originCountry) {
        new DedupedCandidate(
            new TmdbCandidate(1, "Show", 2020, "overview", "/poster.jpg", new BigDecimal("8.0"), [18], 300, "en", [originCountry]),
            [], "tt1")
    }

    private static DedupedCandidate candidateWithOriginCountries(List<String> originCountries) {
        new DedupedCandidate(
            new TmdbCandidate(1, "Show", 2020, "overview", "/poster.jpg", new BigDecimal("8.0"), [18], 300, "en", originCountries),
            [], "tt1")
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

    def "SERIES-029-AC-05: minVoteCount defaults to 200 (superseding SERIES-007-AC-25's old default of 20) when not supplied"() {
        given: "candidate with voteCount 150 (below the new 200 default), candidate with voteCount 250 (above it)"
            def candidates = [dc(candidate(10, "Low Votes", 2020, new BigDecimal("8.0"), [18], 150)), dc(candidate(20, "High Votes", 2020, new BigDecimal("8.0"), [18], 250))]

        when: "applyOutputFilters is called with no minVoteCount param"
            def result = outputFilterService.applyOutputFilters(candidates, new RecommendationCriteria())

        then: "only the voteCount-250 candidate is present"
            result.size() == 1
            result[0].candidate().title() == "High Votes"
    }

    def "SERIES-029-AC-05: a candidate with voteCount 50 passes the old default (20) but not the new one (200)"() {
        given: "a fresh output filter service configured with the spec's own explicit 200 default"
            def freshOutputFilterService = new RecommendationOutputFilterService(tmdbClient, new TmdbGenreTable(), 200)
            def candidateWithFiftyVotes = dc(candidate(1, "Show", 2020, new BigDecimal("8.0"), [18], 50))

        when: "applyOutputFilters runs with no sourceMode/minVoteCount supplied"
            def results = freshOutputFilterService.applyOutputFilters([candidateWithFiftyVotes], new RecommendationCriteria())

        then: "the candidate is filtered out under the new 200 default"
            results.isEmpty()
    }

    def "SERIES-007-AC-25: minVoteCount=0 explicitly disables the filter"() {
        given: "a candidate with voteCount 5, below the default of 200"
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

    // -- Spec 043, Requirement 1 (SERIES-043-AC-01..04): excludeGenres resolves via the alias
    // vocabulary (TmdbGenreTable.idFor), not TMDB's canonical display names --

    def "SERIES-043-AC-01: excludeGenres=['Action'] excludes a candidate whose genreIds include 10759 (Action & Adventure)"() {
        given: "a candidate carrying TMDB genre id 10759 (canonical display name 'Action & Adventure')"
            def candidates = [dc(candidate(10, "Action Show", 2020, new BigDecimal("8.0"), [10759]))]
            def criteria = new RecommendationCriteria(excludeGenres: ["Action"])

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "the candidate is excluded, even though its canonical display name is never literally 'Action'"
            result.isEmpty()
    }

    def "SERIES-043-AC-02: an unrecognized excludeGenres entry is silently ignored"() {
        given: "a candidate, and excludeGenres containing a name TMDB's fixed genre table doesn't cover"
            def candidates = [dc(candidate(10, "Show", 2020, new BigDecimal("8.0"), [18]))]
            def criteria = new RecommendationCriteria(excludeGenres: ["NotARealGenre"])

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "no exception is thrown and the candidate is not excluded"
            result.size() == 1
    }

    def "SERIES-043-AC-03: a candidate with no genreIds is not excluded"() {
        given: "a candidate with an empty genreIds list"
            def candidates = [dc(candidate(10, "Show", 2020, new BigDecimal("8.0"), []))]
            def criteria = new RecommendationCriteria(excludeGenres: ["Comedy"])

        when: "applyOutputFilters is called"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "the candidate survives"
            result.size() == 1
    }

    def "SERIES-043-AC-04: no excludeGenres means no candidate is excluded on that basis"() {
        given: "a candidate with genreIds"
            def candidates = [dc(candidate(10, "Show", 2020, new BigDecimal("8.0"), [35]))]

        when: "applyOutputFilters is called with no excludeGenres set"
            def result = outputFilterService.applyOutputFilters(candidates, new RecommendationCriteria())

        then: "the candidate survives"
            result.size() == 1
    }

    def "SERIES-007-AC-28: language excludes candidates whose originalLanguage doesn't case-insensitively match"() {
        given: "candidates with originalLanguage en and fr"
            def candidates = [
                dc(candidate(10, "English Show", 2020, new BigDecimal("8.0"), [18], 300, "en")),
                dc(candidate(20, "French Show", 2020, new BigDecimal("8.0"), [18], 300, "fr")),
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

    // -- Spec 031, Requirement 3 (SERIES-031-AC-08..10): post-fetch minTmdbRating/year consistency --

    def "SERIES-031-AC-08: post-fetch minTmdbRating check is unaffected"() {
        given: "a candidate below the minTmdbRating threshold, and directed-by-genre criteria"
            def criteria = new RecommendationCriteria(genres: ["Comedy"], minTmdbRating: new BigDecimal("8.0"))
            def candidate = candidateWithRating(new BigDecimal("6.0"))

        when: "output filters run"
            def result = outputFilterService.applyOutputFilters([candidate], criteria)

        then: "the candidate is still excluded, exactly as before this spec"
            result.isEmpty()
    }

    def "SERIES-031-AC-09: post-fetch year check is skipped for Custom Search"() {
        given: "a candidate whose first air year predates yearMin, but is a genre/keyword-directed request"
            def criteria = new RecommendationCriteria(genres: ["Comedy"], yearMin: 2020, yearMax: 2024)
            def candidate = candidateWithYear(1989) // e.g. The Simpsons -- still airing, TMDB's air_date
                                                      // pre-filter already confirmed a match

        when: "output filters run"
            def result = outputFilterService.applyOutputFilters([candidate], criteria)

        then: "the candidate survives -- the year check trusted TMDB's own pre-filter instead of re-checking"
            result.size() == 1
    }

    def "SERIES-031-AC-10: post-fetch year check still runs for every other mode"() {
        given: "a candidate outside the year range, and criteria NOT directed by genre/keyword"
            def criteria = new RecommendationCriteria(yearMin: 2020, yearMax: 2024) // "Use My Series"
            def candidate = candidateWithYear(1989)

        when: "output filters run"
            def result = outputFilterService.applyOutputFilters([candidate], criteria)

        then: "the candidate is excluded, exactly as before this spec"
            result.isEmpty()
    }

    // -- Spec 032, Requirement 3 (SERIES-032-AC-08/09): matchesCountries post-fetch check, unconditional --

    def "SERIES-032-AC-08: matchesCountries excludes a non-matching candidate"() {
        given: "criteria filtering to US/GB, and a candidate originating from Japan"
            def criteria = new RecommendationCriteria(countries: ["US", "GB"])
            def candidate = candidateWithOriginCountry("JP")

        when: "output filters run"
            def result = outputFilterService.applyOutputFilters([candidate], criteria)

        then: "the candidate is excluded"
            result.isEmpty()
    }

    def "SERIES-032-AC-08: matchesCountries case-insensitively matches any entry"() {
        given: "criteria filtering to us/gb, and a candidate originating from GB"
            def criteria = new RecommendationCriteria(countries: ["us", "gb"])
            def candidate = candidateWithOriginCountry("GB")

        when: "output filters run"
            def result = outputFilterService.applyOutputFilters([candidate], criteria)

        then: "the candidate passes"
            result.size() == 1
    }

    def "SERIES-032-AC-08: a null countries list is a no-op"() {
        given: "criteria with no countries filter"
            def criteria = new RecommendationCriteria()
            def candidate = candidateWithOriginCountry("JP")

        when: "output filters run"
            def result = outputFilterService.applyOutputFilters([candidate], criteria)

        then: "the candidate passes"
            result.size() == 1
    }

    def "SERIES-032-AC-08: applies unconditionally regardless of source mode"() {
        given: "a trending-mode candidate whose originCountry doesn't match"
            def criteria = new RecommendationCriteria(sourceMode: "trending", countries: ["US"])
            def candidate = candidateWithOriginCountry("JP")

        when: "output filters run"
            def result = outputFilterService.applyOutputFilters([candidate], criteria)

        then: "the candidate is excluded despite trending's ranking-bypass"
            result.isEmpty()
    }

    def "SERIES-046-AC-10: a candidate matches on a non-first origin country"() {
        given: "a candidate whose second origin country matches the filter, but whose first doesn't"
            def criteria = new RecommendationCriteria(countries: ["US"])
            def candidate = candidateWithOriginCountries(["GB", "US"])

        when: "output filtering runs with countries: [\"US\"]"
            def result = outputFilterService.applyOutputFilters([candidate], criteria)

        then: "the candidate is included, not wrongly excluded"
            result.contains(candidate)
    }

    def "SERIES-032-AC-09: post-fetch language check is unaffected, still runs unconditionally"() {
        given: "candidates with originalLanguage en and fr, and directed-by-genre criteria"
            def candidates = [
                dc(candidate(10, "English Show", 2020, new BigDecimal("8.0"), [18], 300, "en")),
                dc(candidate(20, "French Show", 2020, new BigDecimal("8.0"), [18], 300, "fr")),
            ]
            def criteria = new RecommendationCriteria(genres: ["Comedy"], language: "EN")

        when: "output filters run"
            def result = outputFilterService.applyOutputFilters(candidates, criteria)

        then: "only the English-language candidate is present, exactly as before this spec"
            result.size() == 1
            result[0].candidate().title() == "English Show"
    }
}
