package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.client.TmdbCandidate;
import uk.co.stefirby.seriestracker.model.SeriesEntity;

/** A raw TMDB candidate paired with the pool series it was sourced from, if any (null for genre/keyword-sourced). */
record RawCandidate(TmdbCandidate candidate, SeriesEntity sourceSeries) {
}
