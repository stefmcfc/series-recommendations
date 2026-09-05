package uk.co.stefirby.seriestracker.service.stats;

import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.model.SeriesStatus;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

/**
 * Shared aggregation/sort/filter logic behind {@code KeywordStatsService} and {@code
 * GenreStatsService}: both group the user's tracked series by a name extracted from each series
 * (keyword name, genre name), compute per-name {@link NameStat} rows (series count, average
 * personal rating, average blended rating), apply AND-combined minimum-value filters, and sort by
 * the same {@code sortBy}/{@code sortDirection} contract. This class holds that logic once,
 * parameterized by how each caller extracts its collection of names off a {@link SeriesEntity}.
 *
 * <p>Not instantiable -- every member is static.
 */
public final class NameStatAggregator {

    private static final String SORT_BY_AVERAGE_RATING = "averagePersonalRating";
    private static final String SORT_BY_AVERAGE_BLENDED_RATING = "averageBlendedRating";
    private static final String SORT_BY_NAME = "name";
    private static final String SORT_DIRECTION_ASC = "asc";
    private static final String SORT_DIRECTION_DESC = "desc";

    private NameStatAggregator() {
    }

    /** One aggregated row: a distinct name plus its series count and average ratings. */
    public record NameStat(
            String name,
            Integer seriesCount,
            BigDecimal averagePersonalRating,
            BigDecimal averageBlendedRating) {
    }

    /**
     * Groups {@code allSeries} by the names {@code namesExtractor} pulls off each series
     * (de-duplicating per-series via a {@code LinkedHashSet} before grouping -- a no-op when the
     * extractor already returns a unique collection, such as keyword names sourced from a
     * {@code Set<KeywordEntity>}), computes a {@link NameStat} per distinct name, applies the
     * AND-combined minimum-value filters, and sorts the result per {@code sortBy}/{@code
     * sortDirection}.
     *
     * <p>series_spec_051_stats_status_scope_filter.md (SERIES-051-AC-01/02/03): when {@code
     * onlyCompleted} is {@link Boolean#TRUE}, {@code allSeries} is first restricted to series
     * whose {@code getStatus() == SeriesStatus.COMPLETED} before the per-series grouping loop
     * below -- series excluded this way contribute to no name's {@code seriesCount} or averages
     * at all. {@code null} or {@link Boolean#FALSE} applies no restriction, matching today's
     * behavior exactly.
     */
    public static List<NameStat> aggregate(
            List<SeriesEntity> allSeries,
            Function<SeriesEntity, Collection<String>> namesExtractor,
            String sortBy,
            String sortDirection,
            Integer minSeriesCount,
            BigDecimal minAveragePersonalRating,
            BigDecimal minAverageBlendedRating,
            Boolean onlyCompleted) {
        List<SeriesEntity> scopedSeries = Boolean.TRUE.equals(onlyCompleted)
            ? allSeries.stream().filter(series -> series.getStatus() == SeriesStatus.COMPLETED).toList()
            : allSeries;

        Map<String, List<SeriesEntity>> seriesByName = new LinkedHashMap<>();
        for (SeriesEntity series : scopedSeries) {
            Set<String> names = new LinkedHashSet<>(namesExtractor.apply(series));
            for (String name : names) {
                seriesByName.computeIfAbsent(name, n -> new ArrayList<>()).add(series);
            }
        }

        List<NameStat> stats = new ArrayList<>();
        for (Map.Entry<String, List<SeriesEntity>> entry : seriesByName.entrySet()) {
            stats.add(toStat(entry.getKey(), entry.getValue()));
        }

        stats.removeIf(stat -> !passesFilters(stat, minSeriesCount, minAveragePersonalRating, minAverageBlendedRating));
        stats.sort(comparatorFor(sortBy, sortDirection));
        return stats;
    }

    private static boolean passesFilters(
            NameStat stat,
            Integer minSeriesCount,
            BigDecimal minAveragePersonalRating,
            BigDecimal minAverageBlendedRating) {
        if (minSeriesCount != null && stat.seriesCount() < minSeriesCount) {
            return false;
        }
        if (minAveragePersonalRating != null
                && (stat.averagePersonalRating() == null
                    || stat.averagePersonalRating().compareTo(minAveragePersonalRating) < 0)) {
            return false;
        }
        return minAverageBlendedRating == null
            || (stat.averageBlendedRating() != null
                && stat.averageBlendedRating().compareTo(minAverageBlendedRating) >= 0);
    }

    private static NameStat toStat(String name, List<SeriesEntity> carryingSeries) {
        List<Integer> ratings = carryingSeries.stream()
            .map(SeriesEntity::getPersonalRating)
            .filter(Objects::nonNull)
            .toList();
        BigDecimal averagePersonalRating = ratings.isEmpty() ? null : averageOfInts(ratings);

        List<BigDecimal> blendedRatings = carryingSeries.stream()
            .map(RatingBlendUtil::blendedRating)
            .filter(Objects::nonNull)
            .toList();
        BigDecimal averageBlendedRating = blendedRatings.isEmpty() ? null : averageOfDecimals(blendedRatings);

        return new NameStat(name, carryingSeries.size(), averagePersonalRating, averageBlendedRating);
    }

    private static BigDecimal averageOfInts(List<Integer> ratings) {
        BigDecimal sum = ratings.stream()
            .map(BigDecimal::valueOf)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(ratings.size()), 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal averageOfDecimals(List<BigDecimal> ratings) {
        BigDecimal sum = ratings.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(ratings.size()), 1, RoundingMode.HALF_UP);
    }

    // SERIES-019-AC-16/SERIES-047-AC-04 through AC-08: an unrecognized sortBy value soft-falls-
    // back to the seriesCount default; an unrecognized sortDirection value soft-falls-back to
    // the active field's own default direction (seriesCount/averagePersonalRating/
    // averageBlendedRating desc, name asc). Note: for the two nullable-average fields, the
    // nulls-last comparator is built directly with the resolved (ascending/descending) natural
    // order baked in -- NOT built ascending-then-.reversed() afterward. Comparator.reversed()
    // on a nullsLast(...) comparator swaps null to the FRONT (a well-known Comparator gotcha:
    // reversed() just swaps the two compare() arguments, which also un-does nullsLast's null
    // placement), which would violate SERIES-047-AC-06's "nulls stay last under both asc and
    // desc" guarantee. seriesCount/name never contain nulls, so reversed() is safe for them.
    private static Comparator<NameStat> comparatorFor(String sortBy, String sortDirection) {
        if (SORT_BY_NAME.equals(sortBy)) {
            Comparator<NameStat> byName = Comparator.comparing(stat -> stat.name().toLowerCase());
            return isDescending(sortDirection, false) ? byName.reversed() : byName;
        }
        if (SORT_BY_AVERAGE_RATING.equals(sortBy)) {
            return nullsLastComparator(NameStat::averagePersonalRating, isDescending(sortDirection, true));
        }
        if (SORT_BY_AVERAGE_BLENDED_RATING.equals(sortBy)) {
            return nullsLastComparator(NameStat::averageBlendedRating, isDescending(sortDirection, true));
        }
        Comparator<NameStat> bySeriesCount = Comparator.comparing(NameStat::seriesCount);
        return isDescending(sortDirection, true) ? bySeriesCount.reversed() : bySeriesCount;
    }

    private static Comparator<NameStat> nullsLastComparator(
            Function<NameStat, BigDecimal> extractor, boolean descending) {
        Comparator<BigDecimal> naturalDirection = descending ? Comparator.reverseOrder() : Comparator.naturalOrder();
        return Comparator.comparing(extractor, Comparator.nullsLast(naturalDirection));
    }

    private static boolean isDescending(String sortDirection, boolean defaultDescending) {
        if (SORT_DIRECTION_ASC.equalsIgnoreCase(sortDirection)) {
            return false;
        }
        if (SORT_DIRECTION_DESC.equalsIgnoreCase(sortDirection)) {
            return true;
        }
        return defaultDescending;
    }
}
