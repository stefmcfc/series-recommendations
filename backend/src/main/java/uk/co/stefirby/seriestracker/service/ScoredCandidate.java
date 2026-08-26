package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.RecommendationDto;

import java.util.List;

/**
 * A final candidate paired with its computed {@code rankScore} (SERIES-007-AC-21),
 * pre-diversity-cap, and the full (uncapped, canonically-ordered) list of contributing
 * source titles -- needed by {@code all-sources} diversity-cap mode (SERIES-015-AC-16),
 * which must see every contributing source even beyond {@code dto.sourceTitles()}'s
 * {@code maxSourcesShown} cap.
 */
record ScoredCandidate(RecommendationDto dto, double rankScore, List<String> allSourceTitles) {
}
