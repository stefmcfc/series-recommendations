package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.model.SeriesEntity;

import java.util.Comparator;

/**
 * Canonical per-candidate ordering of contributing source series (SERIES-015-AC-05):
 * {@code personalRating} descending (nulls last), then {@code dateCompleted} descending
 * (nulls last). Shared, unmodified, by sourcing's pool ordering and dedup's per-candidate
 * ordering (which feeds scoring, {@code best-source} diversity-cap mode, and {@code
 * RecommendationDto.sourceTitles}), so all three can never disagree about which source is
 * "best" for a given candidate (SERIES-015-AC-06). TOOLING-003-AC-03.
 */
final class SourceOrderComparator {

    static final Comparator<SeriesEntity> INSTANCE = Comparator
        .comparing(SeriesEntity::getPersonalRating, Comparator.nullsLast(Comparator.reverseOrder()))
        .thenComparing(SeriesEntity::getDateCompleted, Comparator.nullsLast(Comparator.reverseOrder()));

    private SourceOrderComparator() {
    }
}
