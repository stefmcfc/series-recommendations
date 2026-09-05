package uk.co.stefirby.seriestracker.service.io

import spock.lang.Specification
import uk.co.stefirby.seriestracker.dto.SeriesDto
import uk.co.stefirby.seriestracker.exception.ConflictException
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.repository.SeriesRepository
import uk.co.stefirby.seriestracker.service.SeriesService
import uk.co.stefirby.seriestracker.service.keyword.KeywordSyncService

import java.time.Clock

/**
 * series_spec_038_import.md: unit coverage for {@link BulkImportService}, mirroring
 * {@code BulkRefreshServiceSpec}'s shape but exercising a real {@link SeriesService} (with a
 * mocked repository/keyword sync) underneath, since this spec's whole design is reusing
 * {@code SeriesService.create} per row rather than a bespoke bulk-insert path.
 */
class BulkImportServiceSpec extends Specification {

    SeriesRepository seriesRepository = Mock()
    KeywordSyncService keywordSyncService = Mock()
    SeriesService seriesService = new SeriesService(seriesRepository, keywordSyncService, Clock.systemDefaultZone())

    // A near-zero delay keeps these tests fast without changing the production default
    // (app.tmdb.refresh-delay-ms, 250, reused here per series_spec_038's Design Decisions --
    // no new import-delay-ms property).
    BulkImportService bulkImportService = new BulkImportService(seriesService, Clock.systemDefaultZone(), 5L)

    def setup() {
        seriesRepository.save(_) >> { SeriesEntity e -> e }
    }

    def "SERIES-038-AC-04: before any job has run, status is IDLE with zeroed counts"() {
        expect: "the default status is IDLE"
            def status = bulkImportService.status()
            status.status() == "IDLE"
            status.totalCount() == 0
            status.importedCount() == 0
            status.skippedCount() == 0
            status.errorCount() == 0
            status.errors().isEmpty()
            status.startedAt() == null
            status.completedAt() == null
    }

    def "SERIES-038-AC-01: starting a job returns its initial IN_PROGRESS state, without blocking the caller"() {
        given: "one entry to import"
            def entries = [new SeriesDto(title: "New Show", imdbId: "tt1111111")]

        when: "start is called"
            def before = System.currentTimeMillis()
            def started = bulkImportService.start(entries)
            def elapsed = System.currentTimeMillis() - before

        then: "the initial state reflects IN_PROGRESS, and the call returned immediately"
            started.status() == "IN_PROGRESS"
            started.totalCount() == 1
            started.importedCount() == 0
            started.skippedCount() == 0
            started.errorCount() == 0
            started.startedAt() != null
            started.completedAt() == null
            elapsed < 400

        cleanup:
            bulkImportService.awaitCompletionForTest()
    }

    def "SERIES-038-AC-01: starting a second job while one is in progress throws ConflictException"() {
        given: "a slow save keeps the first job IN_PROGRESS"
            def entries = [new SeriesDto(title: "Show 1"), new SeriesDto(title: "Show 2")]
            seriesRepository.save(_) >> { SeriesEntity e -> Thread.sleep(500); e }
            bulkImportService.start(entries)

        when: "a second start is requested immediately"
            bulkImportService.start(entries)

        then: "a ConflictException is thrown, and no second job is started"
            thrown(ConflictException)

        cleanup:
            bulkImportService.awaitCompletionForTest()
    }

    def "SERIES-038-AC-03: duplicates are skipped, other failures are tracked as errors, both non-fatal"() {
        given: "three entries: one new, one duplicate imdbId, one missing a required title"
            def entries = [
                new SeriesDto(title: "New Show", imdbId: "tt1111111"),
                new SeriesDto(title: "Existing Show", imdbId: "tt2222222"), // already tracked
                new SeriesDto(title: null, imdbId: "tt3333333"),
            ]
            seriesRepository.existsByImdbId("tt2222222") >> true

        when: "the import job runs"
            bulkImportService.start(entries)
            bulkImportService.awaitCompletionForTest()

        then: "one imported, one skipped, one errored -- job still completes"
            def status = bulkImportService.status()
            status.status() == "COMPLETED"
            status.totalCount() == 3
            status.importedCount() == 1
            status.skippedCount() == 1
            status.errorCount() == 1
            status.errors().size() == 1
            status.errors()[0].rowIndex() == 2
            status.completedAt() != null
    }

    def "SERIES-038-AC-03: errors are capped at 20 entries even when more rows fail"() {
        given: "25 entries, all missing a required title"
            def entries = (1..25).collect { new SeriesDto(title: null, imdbId: "tt${it}") }

        when: "the import job runs"
            bulkImportService.start(entries)
            bulkImportService.awaitCompletionForTest()

        then: "every row is counted as an error, but the returned list is capped at 20"
            def status = bulkImportService.status()
            status.status() == "COMPLETED"
            status.totalCount() == 25
            status.errorCount() == 25
            status.errors().size() == 20
    }

    def "SERIES-038-AC-04: status stays COMPLETED with the finished job's data until a new job starts"() {
        given: "two new entries"
            def entries = [
                new SeriesDto(title: "Show A", imdbId: "tt5551111"),
                new SeriesDto(title: "Show B", imdbId: "tt5552222"),
            ]

        when: "a job runs to completion"
            bulkImportService.start(entries)
            bulkImportService.awaitCompletionForTest()

        then: "status reports COMPLETED with a completedAt timestamp and both rows imported"
            def status = bulkImportService.status()
            status.status() == "COMPLETED"
            status.importedCount() == 2
            status.completedAt() != null

        and: "the completed status is still visible on a later read, without reverting to IDLE"
            bulkImportService.status().status() == "COMPLETED"
    }
}
