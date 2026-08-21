package uk.co.stefirby.seriestracker.model

import spock.lang.Specification
import spock.lang.Unroll

/**
 * SERIES-018-AC-02 depends on a {@code ProductionStatus} concept from
 * {@code series_spec_008_series_lifecycle_data.md} Requirement 2 -- at the time this spec was
 * implemented, spec 008 itself had not shipped (`Status: Not started`), so this enum and its
 * TMDB-string mapping are introduced here as a minimal prerequisite, scoped to what spec 018's
 * refresh logic actually needs (see series_spec_018's Acceptance Criteria Summary note).
 */
class ProductionStatusSpec extends Specification {

    @Unroll
    def "SERIES-008-AC-06/08: maps TMDB status string '#tmdbStatus' to #expected"() {
        expect:
            ProductionStatus.fromTmdbStatus(tmdbStatus) == Optional.ofNullable(expected)

        where:
            tmdbStatus         || expected
            "Returning Series" || ProductionStatus.RETURNING_SERIES
            "Planned"          || ProductionStatus.PLANNED
            "In Production"    || ProductionStatus.IN_PRODUCTION
            "Ended"            || ProductionStatus.ENDED
            "Canceled"         || ProductionStatus.CANCELED
            "Pilot"            || ProductionStatus.PILOT
    }

    def "SERIES-008-AC-08: an unrecognized status value returns empty, not an error"() {
        expect:
            ProductionStatus.fromTmdbStatus("SomeNewValueTmdbAddedLater") == Optional.empty()
    }

    def "SERIES-008-AC-08: a null status value returns empty"() {
        expect:
            ProductionStatus.fromTmdbStatus(null) == Optional.empty()
    }
}
