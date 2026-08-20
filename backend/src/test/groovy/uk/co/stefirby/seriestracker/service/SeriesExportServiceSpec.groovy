package uk.co.stefirby.seriestracker.service

import spock.lang.Specification
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import uk.co.stefirby.seriestracker.dto.SeriesDto
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode

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
            metacriticRating: 82,
            rottenTomatoesRating: 90,
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
            def json = exportService.exportAsJson(series, java.time.LocalDateTime.now())
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
            def json = exportService.exportAsJson(series, java.time.LocalDateTime.now())
            def parsed = new ObjectMapper().readTree(json)
            def office = parsed.get('series').find { it.get('title').textValue() == 'The Office' }

        then: "the exported JSON includes all fields for a series"
            office != null
            office.get('year').intValue() == 2005
            office.get('genres').textValue() == 'Comedy'
            office.get('totalSeasons').intValue() == 9
            office.get('imdbRating').doubleValue() == 9.0
            office.get('personalNotes').textValue() == 'Absolutely love this show'
            office.get('posterUrl').textValue() == 'https://example.com/the-office-poster.jpg'
    }

    def "exportAsJson handles null fields without error"() {
        given: "a series with only a title and no other fields, among the retrieved series"
            seriesService.create(new SeriesDto(title: "Minimal Show"))
            def series = seriesService.getAll()

        when: "the series are exported as JSON"
            def json = exportService.exportAsJson(series, java.time.LocalDateTime.now())
            def parsed = new ObjectMapper().readTree(json)

        then: "the export succeeds and includes the minimal series"
            json != null
            parsed.get('series').find { it.get('title').textValue() == 'Minimal Show' } != null
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
            // 17 original fields + alternateTitle (SERIES-013) + tags (SERIES-014)
            headerCols == 19
    }

    def "SERIES-005-AC-04: exportAsCsv includes posterUrl values"() {
        given: "all series have been retrieved"
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)

        then: "the CSV contains the poster URL"
            csv.contains("https://example.com/the-office-poster.jpg")
    }

    def "SERIES-013-AC-04: exportAsJson includes alternateTitle"() {
        given: "a series with an alternateTitle, among the retrieved series"
            seriesService.create(new SeriesDto(title: "MI-5", alternateTitle: "Spooks"))
            def series = seriesService.getAll()

        when: "the series are exported as JSON"
            def json = exportService.exportAsJson(series, java.time.LocalDateTime.now())
            def parsed = new ObjectMapper().readTree(json)
            def mi5 = parsed.get('series').find { it.get('title').textValue() == 'MI-5' }

        then: "alternateTitle is present in the exported JSON"
            mi5 != null
            mi5.get('alternateTitle').textValue() == 'Spooks'
    }

    def "SERIES-013-AC-04: exportAsCsv includes alternateTitle values and header"() {
        given: "a series with an alternateTitle, among the retrieved series"
            seriesService.create(new SeriesDto(title: "MI-5", alternateTitle: "Spooks"))
            def series = seriesService.getAll()

        when: "the series are exported as CSV"
            def csv = exportService.exportAsCsv(series)
            def lines = csv.trim().split("\n")

        then: "the header includes alternateTitle and the row includes its value"
            lines[0].contains("alternateTitle")
            csv.contains("Spooks")
    }

    def "SERIES-013-AC-04: exportAsCsv represents a null alternateTitle as an empty cell, not the literal 'null'"() {
        given: "a series with no alternateTitle, among the retrieved series"
            seriesService.create(new SeriesDto(title: "No Alternate Title Show"))
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
            def json = exportService.exportAsJson(series, java.time.LocalDateTime.now())
            def parsed = new ObjectMapper().readTree(json)
            def office = parsed.get('series').find { it.get('title').textValue() == 'The Office 2' }

        then: "the exported JSON includes the tags field"
            office.get('tags').textValue() == 'background watching'
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
}
