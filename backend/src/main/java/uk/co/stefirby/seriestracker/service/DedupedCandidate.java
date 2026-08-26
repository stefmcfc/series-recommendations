package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.TmdbCandidate;
import uk.co.stefirby.seriestracker.model.SeriesEntity;

import java.util.List;

/**
 * A raw candidate that survived dedupe/already-added/already-ignored filtering, with its
 * resolved imdb_id. {@code sourceSeries} accumulates every distinct watched series that
 * recommended this candidate (SERIES-015-AC-01/02/04), ordered by the canonical
 * per-candidate ordering (SERIES-015-AC-05) -- an empty list, never {@code null}, for a
 * candidate sourced only via genre/keyword discovery (SERIES-015-AC-03).
 */
record DedupedCandidate(TmdbCandidate candidate, List<SeriesEntity> sourceSeries, String imdbId) {
}
