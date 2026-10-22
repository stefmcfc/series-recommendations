package uk.co.stefirby.seriestracker.service.recommendation;

import uk.co.stefirby.seriestracker.client.tmdb.TmdbCandidate;
import uk.co.stefirby.seriestracker.model.SeriesEntity;

import java.util.List;

/**
 * A raw candidate that survived dedupe/already-added/already-ignored filtering, with its
 * resolved imdb_id. {@code sourceSeries} accumulates every distinct watched series that
 * recommended this candidate (SERIES-015-AC-01/02/04), ordered by the canonical
 * per-candidate ordering (SERIES-015-AC-05) -- an empty list, never {@code null}, for a
 * candidate sourced only via genre/keyword discovery (SERIES-015-AC-03).
 *
 * <p>{@code trackedSeries} (SERIES-071-AC-04) is the matched {@link SeriesEntity} when this
 * candidate's imdb_id resolved to a series the user already tracks AND {@code
 * includeAlreadyTracked} was {@code true} for this request -- {@code null} in every other
 * case (the already-tracked check excluded the candidate entirely, {@code
 * includeAlreadyTracked} was unset/{@code false}, or there was simply no match). The
 * 3-argument constructor below is kept for every pre-existing caller that never deals with
 * already-tracked candidates (they all predate series_spec_071) -- it defaults {@code
 * trackedSeries} to {@code null} rather than requiring every one of them to pass an explicit
 * {@code null}.
 */
record DedupedCandidate(TmdbCandidate candidate, List<SeriesEntity> sourceSeries, String imdbId, SeriesEntity trackedSeries) {

    DedupedCandidate(TmdbCandidate candidate, List<SeriesEntity> sourceSeries, String imdbId) {
        this(candidate, sourceSeries, imdbId, null);
    }
}
