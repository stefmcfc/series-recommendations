package uk.co.stefirby.seriestracker.service.recommendation

import uk.co.stefirby.seriestracker.client.tmdb.TmdbCandidate
import uk.co.stefirby.seriestracker.client.tmdb.TmdbClient
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.model.SeriesStatus
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import uk.co.stefirby.seriestracker.service.tmdb.TmdbGenreTable
import uk.co.stefirby.seriestracker.service.tmdb.WatchProviderService
import spock.lang.Specification

import java.time.LocalDateTime

class RecommendationDtoAssemblerSpec extends Specification {

    SeriesRepository seriesRepository = Mock()
    TmdbClient tmdbClient = Mock()

    RecommendationDtoAssembler dtoAssembler =
        new RecommendationDtoAssembler(new TmdbGenreTable(), new WatchProviderService(seriesRepository, tmdbClient, "GB"))

    private static SeriesEntity completedSeries(String title, String imdbId, LocalDateTime dateCompleted,
                                                 String genres = null, Integer personalRating = null) {
        new SeriesEntity(title: title, imdbId: imdbId, status: SeriesStatus.COMPLETED,
            dateCompleted: dateCompleted, genres: genres, personalRating: personalRating)
    }

    private static TmdbCandidate candidate(int tmdbId, String title = "Candidate ${tmdbId}", Integer year = 2020,
                                            BigDecimal voteAverage = new BigDecimal("8.0"), List<Integer> genreIds = [18],
                                            Integer voteCount = 100, String originalLanguage = "en") {
        new TmdbCandidate(tmdbId, title, year, "overview", "/poster.jpg", voteAverage, genreIds, voteCount, originalLanguage, [])
    }

    def "SERIES-016-AC-02: toDto populates voteCount from the TMDB candidate verbatim"() {
        given: "a deduped candidate with voteCount 1500"
            def dc = new DedupedCandidate(candidate(500, "Genre Candidate", 2020, new BigDecimal("8.0"), [18], 1500), [], "tt5005005")

        when: "toDto is called"
            def result = dtoAssembler.toDto(dc, 3)

        then: "voteCount is passed through unchanged"
            result.voteCount() == 1500
    }

    def "SERIES-023-AC-02/03: toDto carries originCountry and tmdbId from the candidate"() {
        given: "a deduped candidate with originCountry/tmdbId set"
            def dc = new DedupedCandidate(
                new TmdbCandidate(2, "Show", 2020, "overview", null, new BigDecimal("7.0"), [], 100, "en", ["US"]),
                [], "tt0000002")

        when: "toDto is called"
            def result = dtoAssembler.toDto(dc, 3)

        then: "the result carries both new fields"
            result.originCountry == "US"
            result.tmdbId == 2
    }

    def "SERIES-046-AC-09: assembled RecommendationDto carries every origin country, comma-joined"() {
        given: "a DedupedCandidate wrapping a TmdbCandidate with two origin countries"
            def candidate = new TmdbCandidate(2996, "MobLand", 2025, "overview", "/poster.jpg",
                new BigDecimal("7.5"), [80], 200, "en", ["GB", "US"])
            def dc = new DedupedCandidate(candidate, [], null)

        when: "toDto(dc, 5) is called"
            def dto = dtoAssembler.toDto(dc, 5)

        then: "originCountry is both entries, comma-joined"
            dto.originCountry == "GB,US"
    }

    def "SERIES-012-AC-02: candidate poster URLs are built from TmdbClient.POSTER_BASE_URL"() {
        given: "a TMDB candidate with a poster_path"
            def dc = new DedupedCandidate(
                new TmdbCandidate(99, "Discovered Show", 2020, "overview", "/poster.jpg",
                    new BigDecimal("7.5"), [18], 100, "en", []),
                [], "tt0000099")

        when: "toDto is called"
            def result = dtoAssembler.toDto(dc, 3)

        then: "the poster URL is built from TmdbClient's own constant, not a private duplicate"
            result.posterUrl() == TmdbClient.POSTER_BASE_URL + "/poster.jpg"
    }

    def "SERIES-015-AC-10/13: sourceTitles is capped to the effective maxSourcesShown, best-first"() {
        given: "5 canonically-ordered contributing sources"
            def now = LocalDateTime.now()
            def sources = (5..1).collect { rating -> completedSeries("Source ${rating}", "tt400000${rating}", now, null, rating) }
            def dc = new DedupedCandidate(candidate(999, "Shared Candidate"), sources, "tt9999999")

        when: "toDto is called with the default maxSourcesShown (3)"
            def result = dtoAssembler.toDto(dc, 3)

        then: "sourceTitles contains only the 3 best-rated sources' titles, in order"
            result.sourceTitles() == ["Source 5", "Source 4", "Source 3"]

        and: "totalSourceCount reflects the true uncapped count"
            result.totalSourceCount() == 5
    }

    def "SERIES-015-AC-12/13: maxSourcesShown overrides the default cap on sourceTitles only"() {
        given: "the same 5-source candidate as above"
            def now = LocalDateTime.now()
            def sources = (5..1).collect { rating -> completedSeries("Source ${rating}", "tt500000${rating}", now, null, rating) }
            def dc = new DedupedCandidate(candidate(999, "Shared Candidate"), sources, "tt9999999")

        when: "toDto is called with maxSourcesShown 2"
            def result = dtoAssembler.toDto(dc, 2)

        then: "sourceTitles is capped to 2, but totalSourceCount is still 5"
            result.sourceTitles().size() == 2
            result.totalSourceCount() == 5
    }
}
