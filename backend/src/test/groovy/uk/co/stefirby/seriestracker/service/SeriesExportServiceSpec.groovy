package uk.co.stefirby.seriestracker.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import spock.lang.Specification
import tools.jackson.databind.ObjectMapper
import uk.co.stefirby.seriestracker.dto.SeriesDto
import uk.co.stefirby.seriestracker.repository.SeriesRepository

import java.time.LocalDateTime

@SpringBootTest
@ActiveProfiles("test")
class SeriesExportServiceSpec extends Specification {

    @Autowired
    SeriesService seriesService

    @Autowired
    SeriesExportService exportService

    @Autowired
    SeriesRepository seriesRepository

    def setup() {
        seriesRepository.deleteAll()

        seriesService.create(new SeriesDto(
            title: "The Office",
            year: 2005,
            genres: "Comedy",
            totalSeasons: 9,
            totalEpisodes: 201,
            currentSeason: 8,
            currentEpisode: 12,
            status: "WATCHING",
            imdbRating: 9.0,
            rottenTomatoesRating: 90,
            tmdbRating: 8.5,
            tmdbVoteCount: 3200,
            personalRating: 5,
            personalNotes: "Absolutely love this show",
            posterUrl: "https://example.com/the-office-poster.jpg"
        ))
        seriesService.create(new SeriesDto(
            title: "Game of Thrones",
            genres: "Drama,Fantasy,Thriller",
            status: "COMPLETED",
            imdbRating: 9.2,
            personalRating: 4,
            personalNotes: "Great until the ending"
        ))
    }

    def "exportAsJson returns valid JSON string"() {
        given: "all series have been retrieved"
            def series = seriesService.getAll()

        when: "the series are exported as JSON"
            def json = exportService.exportAsJson(series, LocalDateTime.now())
            def parsed = new ObjectMapper().readTree(json)

        then: "the JSON contains the export date, series list, and count"
            parsed != null
            parsed.get('exportDate') != null
            parsed.get('series').size() == 2
            parsed.get('count').intValue() == 2
    }

    def "exportAsJson includes all series fields"() {
        given: "all series have been retrieved"
            def series = seriesService.getAll()

        when: "the series are exported as JSON"
            def json = exportService.exportAsJson(series, LocalDateTime.now())
            def parsed = new ObjectMapper().readTree(json)
            def office = parsed.get('series').find { it.get('title').stringValue() == 'The Office' }

        then: "the exported JSON includes all fields for a series"
            office != null
            office.get('year').intValue() == 2005
            office.get('genres').stringValue() == 'Comedy'
            office.get('totalSeasons').intValue() == 9
            office.get('imdbRating').doubleValue() == 9.0
            office.get('personalNotes').stringValue() == 'Absolutely love this show'
            office.get('posterUrl').stringValue() == 'https://example.com/the-office-poster.jpg'
    }

    def "exportAsJson handles null fields without error"() {
        given: "a series with only a title and no other fields, among the retrieved series"
            seriesService.create(new SeriesDto(title: "Minimal Show"))
            def series = seriesService.getAll()

        when: "the series are exported as JSON"
            def json = exportService.exportAsJson(series, LocalDateTime.now())
            def parsed = new ObjectMapper().readTree(json)

        then: "the export succeeds and includes the minimal series"
            json != null
            parsed.get('series').find { it.get('title').stringValue() == 'Minimal Show' } != null
    }

    def "exportAsCsv returns CSV with header row"() {
        given: "all series have been retrieved"
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)
            def lines = csv.trim().split("\n")

        then: "the header row contains the expected column names"
            lines[0].contains("title")
            lines[0].contains("status")
            lines[0].contains("imdbRating")
            lines[0].contains("genres")
            lines[0].contains("posterUrl")
    }

    def "exportAsCsv contains all series titles"() {
        given: "all series have been retrieved"
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)

        then: "the CSV contains the title of each series"
            csv.contains("The Office")
            csv.contains("Game of Thrones")
    }

    def "exportAsCsv quotes genres containing commas"() {
        given: "all series have been retrieved"
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)

        then: "genre values containing commas are quoted"
            // "Drama,Fantasy,Thriller" must be quoted in CSV
            csv.contains('"Drama,Fantasy,Thriller"')
    }

    def "exportAsCsv represents null values as empty strings, not 'null'"() {
        given: "a series with no ratings, among the retrieved series"
            seriesService.create(new SeriesDto(title: "No Ratings Show"))
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)

        then: "null fields are rendered as empty strings rather than the literal 'null'"
            !csv.contains("null")
    }

    def "exportAsCsv has correct number of columns per row"() {
        given: "all series have been retrieved"
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)
            def lines = csv.trim().split("\n")
            def headerCols = lines[0].split(",").size()

        then: "the header row has one column per series field"
            // 17 original fields (minus metacriticRating, which was removed by SERIES-017)
            // + tags (SERIES-014) + tmdbRating/tmdbVoteCount (SERIES-017) + originCountry
            // (SERIES-021) + rottenTomatoesPopcornmeter (SERIES-027)
            headerCols == 21
    }

    def "SERIES-005-AC-04: exportAsCsv includes posterUrl values"() {
        given: "all series have been retrieved"
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)

        then: "the CSV contains the poster URL"
            csv.contains("https://example.com/the-office-poster.jpg")
    }

    def "SERIES-017-AC-13: exportAsJson includes tmdbRating/tmdbVoteCount, excludes metacriticRating/alternateTitle"() {
        given: "a series with tmdbRating/tmdbVoteCount, among the retrieved series"
            seriesService.create(new SeriesDto(title: "Spooks", tmdbRating: 7.8, tmdbVoteCount: 245))
            def series = seriesService.getAll()

        when: "the series are exported as JSON"
            def json = exportService.exportAsJson(series, LocalDateTime.now())
            def parsed = new ObjectMapper().readTree(json)
            def spooks = parsed.get('series').find { it.get('title').stringValue() == 'Spooks' }

        then: "tmdbRating/tmdbVoteCount are present, and the removed fields are absent"
            spooks != null
            spooks.get('tmdbRating').doubleValue() == 7.8
            spooks.get('tmdbVoteCount').intValue() == 245
            !spooks.has('metacriticRating')
            !spooks.has('alternateTitle')
    }

    def "SERIES-017-AC-13/14: exportAsCsv includes a tmdbRating/tmdbVoteCount header and values, excludes metacriticRating/alternateTitle"() {
        given: "a series with tmdbRating/tmdbVoteCount, among the retrieved series"
            seriesService.create(new SeriesDto(title: "Spooks", tmdbRating: 7.8, tmdbVoteCount: 245))
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)
            def lines = csv.trim().split("\n")

        then: "the header includes tmdbRating/tmdbVoteCount and excludes the removed columns"
            lines[0].contains("tmdbRating")
            lines[0].contains("tmdbVoteCount")
            !lines[0].contains("metacriticRating")
            !lines[0].contains("alternateTitle")
            csv.contains("7.8")
            csv.contains("245")
    }

    def "SERIES-017-AC-13: exportAsCsv represents a null tmdbRating/tmdbVoteCount as an empty cell, not the literal 'null'"() {
        given: "a series with no tmdbRating/tmdbVoteCount, among the retrieved series"
            seriesService.create(new SeriesDto(title: "No TMDB Rating Show"))
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)

        then: "the export succeeds without a literal 'null' anywhere"
            !csv.contains("null")
    }

    def "SERIES-014-AC-11: exportAsJson includes tags"() {
        given: "a series with a tags value, among the retrieved series"
            seriesService.create(new SeriesDto(title: "The Office 2", tags: "background watching"))
            def series = seriesService.getAll()

        when: "the series are exported as JSON"
            def json = exportService.exportAsJson(series, LocalDateTime.now())
            def parsed = new ObjectMapper().readTree(json)
            def office = parsed.get('series').find { it.get('title').stringValue() == 'The Office 2' }

        then: "the exported JSON includes the tags field"
            office.get('tags').stringValue() == 'background watching'
    }

    def "SERIES-014-AC-12: exportAsCsv includes a tags column"() {
        given: "all series have been retrieved"
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)
            def lines = csv.trim().split("\n")

        then: "the header row contains the tags column"
            lines[0].contains("tags")
    }

    def "SERIES-014-AC-13: exportAsCsv quotes tags containing commas"() {
        given: "a series with a comma-separated tags value, among the retrieved series"
            seriesService.create(new SeriesDto(
                title: "Vikings",
                tags: "rewatch candidate,watch with partner"
            ))
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)

        then: "the tags value containing commas is quoted"
            csv.contains('"rewatch candidate,watch with partner"')
    }

    def "SERIES-014-AC-14: exportAsCsv represents a null tags value as an empty string"() {
        given: "a series with no tags, among the retrieved series"
            seriesService.create(new SeriesDto(title: "No Tags Show"))
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)

        then: "the row does not contain the literal string null"
            !csv.contains("null")
    }

    def "SERIES-021-AC-10: CSV headers include originCountry"() {
        when: "a CSV export is generated"
            def csv = exportService.exportAsCsv([])

        then: "the header row includes originCountry"
            csv.readLines().first().contains("originCountry")
    }

    def "SERIES-021-AC-10: exportAsCsv includes an originCountry value"() {
        given: "a series with an originCountry value, among the retrieved series"
            seriesService.create(new SeriesDto(title: "The Office (UK)", originCountry: "GB"))
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)
            def lines = csv.trim().split("\n")

        then: "the header includes originCountry and a row contains its value"
            lines[0].contains("originCountry")
            csv.contains("GB")
    }

    def "SERIES-046-AC-12: CSV export includes a multi-country originCountry value unchanged"() {
        given: "a series with a comma-joined multi-country originCountry, among the retrieved series"
            seriesService.create(new SeriesDto(title: "MobLand", originCountry: "GB,US"))
            def series = seriesService.getAll()

        when: "a CSV export is generated"
            def csv = exportService.exportAsCsv(series)
            def lines = csv.trim().split("\n")
            def dataRow = lines.find { it.contains("MobLand") }

        then: "the data row includes the full value, not truncated to one country"
            dataRow.contains("GB,US")
    }

    def "SERIES-027-AC-05: exportAsCsv includes a rottenTomatoesPopcornmeter header and value"() {
        given: "a series with a rottenTomatoesPopcornmeter value, among the retrieved series"
            seriesService.create(new SeriesDto(title: "Ozark", rottenTomatoesPopcornmeter: 91))
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)
            def lines = csv.trim().split("\n")

        then: "the header includes rottenTomatoesPopcornmeter and a row contains its value"
            lines[0].contains("rottenTomatoesPopcornmeter")
            csv.contains("91")
    }

    def "SERIES-027-AC-05: exportAsJson includes rottenTomatoesPopcornmeter"() {
        given: "a series with a rottenTomatoesPopcornmeter value, among the retrieved series"
            seriesService.create(new SeriesDto(title: "Ozark 2", rottenTomatoesPopcornmeter: 91))
            def series = seriesService.getAll()

        when: "the series are exported as JSON"
            def json = exportService.exportAsJson(series, LocalDateTime.now())
            def parsed = new ObjectMapper().readTree(json)
            def ozark = parsed.get('series').find { it.get('title').stringValue() == 'Ozark 2' }

        then: "the exported JSON includes the rottenTomatoesPopcornmeter field"
            ozark.get('rottenTomatoesPopcornmeter').intValue() == 91
    }

    def "SERIES-021-AC-10: exportAsJson includes originCountry"() {
        given: "a series with an originCountry value, among the retrieved series"
            seriesService.create(new SeriesDto(title: "The Office (UK) 2", originCountry: "GB"))
            def series = seriesService.getAll()

        when: "the series are exported as JSON"
            def json = exportService.exportAsJson(series, LocalDateTime.now())
            def parsed = new ObjectMapper().readTree(json)
            def office = parsed.get('series').find { it.get('title').stringValue() == 'The Office (UK) 2' }

        then: "the exported JSON includes the originCountry field"
            office.get('originCountry').stringValue() == 'GB'
    }
}
