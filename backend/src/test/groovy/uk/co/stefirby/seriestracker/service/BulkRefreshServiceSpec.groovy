package uk.co.stefirby.seriestracker.service

import spock.lang.Specification
import spock.util.concurrent.PollingConditions
import uk.co.stefirby.seriestracker.exception.ConflictException
import uk.co.stefirby.seriestracker.model.SeriesEntity
import uk.co.stefirby.seriestracker.repository.SeriesRepository

import java.util.UUID

class BulkRefreshServiceSpec extends Specification {

    SeriesRepository repository = Mock()
    SeriesRefreshService refreshService = Mock()
    PollingConditions conditions = new PollingConditions(timeout: 5)

    // A near-zero delay keeps these tests fast without changing the production default
    // (app.tmdb.refresh-delay-ms, 250) -- see series_spec_018's Design Decisions.
    BulkRefreshService bulkRefreshService = new BulkRefreshService(repository, refreshService, 5L)

    private static SeriesEntity series(UUID id) {
        new SeriesEntity(id: id, title: "Show ${id}")
    }

    def "SERIES-018-AC-19: before any job has run, status is IDLE with zeroed counts"() {
        expect: "the default status is IDLE"
            def status = bulkRefreshService.status()
            status.status() == "IDLE"
            status.totalCount() == 0
            status.completedCount() == 0
            status.startedAt() == null
            status.finishedAt() == null
    }

    def "SERIES-018-AC-13: starting a job returns its initial IN_PROGRESS state"() {
        given: "three series exist"
            def ids = [UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID()]
            repository.count() >> 3L
            repository.findAll() >> ids.collect { series(it) }

        when: "start is called"
            def started = bulkRefreshService.start()

        then: "the initial state reflects IN_PROGRESS"
            started.status() == "IN_PROGRESS"
            started.totalCount() == 3
            started.completedCount() == 0
            started.startedAt() != null
            started.finishedAt() == null

        cleanup:
            conditions.eventually { bulkRefreshService.status().status() == "COMPLETED" }
    }

    def "SERIES-018-AC-14: starting a second job while one is in progress throws ConflictException"() {
        given: "a bulk job already in progress (a slow first item keeps it IN_PROGRESS)"
            def ids = [UUID.randomUUID(), UUID.randomUUID()]
            repository.count() >> 2L
            repository.findAll() >> ids.collect { series(it) }
            refreshService.refresh(_) >> { UUID id -> Thread.sleep(500); null }
            bulkRefreshService.start()

        when: "a second start is requested immediately"
            bulkRefreshService.start()

        then: "a ConflictException is thrown, and no second job is started"
            thrown(ConflictException)

        cleanup:
            conditions.eventually { bulkRefreshService.status().status() == "COMPLETED" }
    }

    def "SERIES-018-AC-15/16: processes every series sequentially via SeriesRefreshService, without blocking the caller"() {
        given: "three series exist, and each refresh call records the id it was called with"
            def ids = [UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID()]
            def refreshedIds = Collections.synchronizedList([])
            repository.count() >> 3L
            repository.findAll() >> ids.collect { series(it) }
            refreshService.refresh(_) >> { UUID id -> refreshedIds << id; null }

        when: "start is called"
            def before = System.currentTimeMillis()
            bulkRefreshService.start()
            def elapsed = System.currentTimeMillis() - before

        then: "the call returns immediately, well before three items x delay could have elapsed"
            elapsed < 400

        and: "eventually every series is refreshed exactly once, and the job completes"
            conditions.eventually {
                bulkRefreshService.status().status() == "COMPLETED"
                refreshedIds.size() == 3
            }
            refreshedIds.toSet() == ids.toSet()
    }

    def "SERIES-018-AC-17/20: one series' failure does not stop the batch, completedCount reflects progress"() {
        given: "three series, the second's refresh throws"
            def ids = [UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID()]
            repository.count() >> 3L
            repository.findAll() >> ids.collect { series(it) }
            refreshService.refresh(ids[0]) >> null
            refreshService.refresh(ids[1]) >> { throw new RuntimeException("upstream failure") }
            refreshService.refresh(ids[2]) >> null

        when: "the bulk job runs to completion"
            bulkRefreshService.start()

        then: "the job completes, and completedCount is 3, not 1"
            conditions.eventually {
                def status = bulkRefreshService.status()
                status.status() == "COMPLETED"
                status.completedCount() == 3
                status.totalCount() == 3
            }
    }

    def "SERIES-018-AC-18/21: status stays COMPLETED with the finished job's data until a new job starts"() {
        given: "two series"
            def ids = [UUID.randomUUID(), UUID.randomUUID()]
            repository.count() >> 2L
            repository.findAll() >> ids.collect { series(it) }

        when: "a job runs to completion"
            bulkRefreshService.start()

        then: "status eventually reports COMPLETED with a finishedAt timestamp"
            conditions.eventually {
                def status = bulkRefreshService.status()
                status.status() == "COMPLETED"
                status.finishedAt() != null
                status.completedCount() == 2
            }

        and: "the completed status is still visible on a later read, without reverting to IDLE"
            bulkRefreshService.status().status() == "COMPLETED"
    }

    def "SERIES-018-AC-22: an unexpected exception in the batch loop itself sets status to FAILED"() {
        given: "the series list itself cannot be fetched once the job starts running"
            repository.count() >> 5L
            repository.findAll() >> { throw new RuntimeException("DB connection lost") }

        when: "start is called"
            bulkRefreshService.start()

        then: "the job eventually reports FAILED with a finishedAt timestamp, without propagating"
            conditions.eventually {
                def status = bulkRefreshService.status()
                status.status() == "FAILED"
                status.finishedAt() != null
            }
    }
}
