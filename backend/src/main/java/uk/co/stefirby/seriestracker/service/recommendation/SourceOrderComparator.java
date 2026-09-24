package uk.co.stefirby.seriestracker.service.recommendation;

import uk.co.stefirby.seriestracker.dto.RecommendationCriteria;
import uk.co.stefirby.seriestracker.model.SeriesEntity;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.Set;

/**
 * Canonical per-candidate ordering of contributing source series (SERIES-015-AC-05):
 * {@code personalRating} descending (nulls last), then {@code dateCompleted} descending
 * (nulls last), by default. Shared, unmodified, by sourcing's pool ordering and dedup's
 * per-candidate ordering (which feeds scoring, {@code best-source} diversity-cap mode, and
 * {@code RecommendationDto.sourceTitles}), so all three can never disagree about which source
 * is "best" for a given candidate (SERIES-015-AC-06). TOOLING-003-AC-03.
 *
 * <p>SERIES-068-AC-01/03/07: {@link #forStrategy(RecommendationCriteria)} resolves one of 3
 * comparators from {@code RecommendationCriteria#getSourceRankingStrategy()} -- the
 * unparameterized {@link #INSTANCE} remains available for the 3 discover-backfill call sites
 * ({@code sourceTrending}/{@code sourceTopRated}/{@code sourceByGenreOrKeyword}) whose raw
 * candidates never carry a non-empty {@code sourceSeries}, so a strategy there would be a
 * harmless no-op (see this spec's Design Decisions) -- those call sites deliberately keep using
 * {@link #INSTANCE} directly rather than threading {@code criteria} through code that can never
 * use it.
 */
final class SourceOrderComparator {

    static final Comparator<SeriesEntity> INSTANCE = Comparator
        .comparing(SeriesEntity::getPersonalRating, Comparator.nullsLast(Comparator.reverseOrder()))
        .thenComparing(SeriesEntity::getDateCompleted, Comparator.nullsLast(Comparator.reverseOrder()));

    private SourceOrderComparator() {
    }

    /**
     * SERIES-068-AC-01/03/07: resolves the comparator for {@code criteria.getSourceRankingStrategy()}
     * -- an unset/unrecognized/{@code "personalRatingThenDate"} value falls back to {@link
     * #INSTANCE}; {@code "personalRatingThenCustomBlend"}/{@code "customBlendThenPersonalRating"}
     * order by {@code personalRating} and the {@link SourceRatingBlend} result (from {@code
     * criteria.getSourceRatingBlendSources()}) in the stated precedence, both descending with
     * nulls last (mirroring {@link #INSTANCE}'s existing null-handling convention).
     */
    static Comparator<SeriesEntity> forStrategy(RecommendationCriteria criteria) {
        String strategy = criteria.getSourceRankingStrategy();
        if (RecommendationDefaults.SOURCE_RANKING_STRATEGY_PERSONAL_THEN_CUSTOM_BLEND.equals(strategy)) {
            return personalRatingThenBlend(criteria);
        }
        if (RecommendationDefaults.SOURCE_RANKING_STRATEGY_CUSTOM_BLEND_THEN_PERSONAL.equals(strategy)) {
            return blendThenPersonalRating(criteria);
        }
        return INSTANCE;
    }

    private static Comparator<SeriesEntity> personalRatingThenBlend(RecommendationCriteria criteria) {
        Set<String> blendSources = SourceRatingBlend.resolveSources(criteria);
        return Comparator
            .comparing(SeriesEntity::getPersonalRating, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(s -> SourceRatingBlend.compute(s, blendSources), Comparator.nullsLast(Comparator.reverseOrder()));
    }

    private static Comparator<SeriesEntity> blendThenPersonalRating(RecommendationCriteria criteria) {
        Set<String> blendSources = SourceRatingBlend.resolveSources(criteria);
        return Comparator
            .<SeriesEntity, BigDecimal>comparing(s -> SourceRatingBlend.compute(s, blendSources), Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(SeriesEntity::getPersonalRating, Comparator.nullsLast(Comparator.reverseOrder()));
    }
}
