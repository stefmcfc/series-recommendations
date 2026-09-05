package uk.co.stefirby.seriestracker.service.keyword;

import uk.co.stefirby.seriestracker.dto.KeywordStatDto;
import uk.co.stefirby.seriestracker.model.KeywordEntity;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import uk.co.stefirby.seriestracker.service.RatingBlendUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

/**
 * Backs {@code GET /api/v1/series/keywords} (Requirement 4, {@code
 * series_spec_019_keyword_tracking.md}): one {@link KeywordStatDto} per distinct keyword
 * actually present across the user's tracked series, computed via in-memory aggregation over
 * {@code seriesRepository.findAll()} -- matching {@code SeriesSearchService}'s own established
 * "fine at this app's scale" precedent (SERIES-019-AC-14) rather than a custom repository
 * query.
 *
 * <p>series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md extends this with a
 * {@code name}/{@code averageBlendedRating} sort, an {@code asc}/{@code desc} direction toggle
 * applying to every {@code sortBy} field, and AND-combined minimum-value filters
 * (SERIES-047-AC-04 through AC-13) -- all applied in-memory, post-aggregation, for the same
 * "fine at this app's scale" reason.
 */
@Service
public class KeywordStatsService {

    private static final String SORT_BY_AVERAGE_RATING = "averagePersonalRating";
    private static final String SORT_BY_AVERAGE_BLENDED_RATING = "averageBlendedRating";
    private static final String SORT_BY_NAME = "name";
    private static final String SORT_DIRECTION_ASC = "asc";
    private static final String SORT_DIRECTION_DESC = "desc";

    private final SeriesRepository seriesRepository;

    public KeywordStatsService(SeriesRepository seriesRepository) {
        this.seriesRepository = seriesRepository;
    }

    /** Pre-series_spec_047 signature, kept for backward compatibility (SERIES-047-AC-12). */
    @Transactional(readOnly = true)
    public List<KeywordStatDto> getStats(String sortBy) {
        return getStats(sortBy, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<KeywordStatDto> getStats(
            String sortBy,
            String sortDirection,
            Integer minSeriesCount,
            BigDecimal minAveragePersonalRating,
            BigDecimal minAverageBlendedRating) {
        Map<String, List<SeriesEntity>> seriesByKeyword = new LinkedHashMap<>();
        for (SeriesEntity series : seriesRepository.findAll()) {
            for (KeywordEntity keyword : series.getKeywords()) {
                seriesByKeyword.computeIfAbsent(keyword.getName(), k -> new ArrayList<>()).add(series);
            }
        }

        List<KeywordStatDto> stats = new ArrayList<>();
        for (Map.Entry<String, List<SeriesEntity>> entry : seriesByKeyword.entrySet()) {
            stats.add(toStat(entry.getKey(), entry.getValue()));
        }

        stats.removeIf(stat -> !passesFilters(stat, minSeriesCount, minAveragePersonalRating, minAverageBlendedRating));
        stats.sort(comparatorFor(sortBy, sortDirection));
        return stats;
    }

    private boolean passesFilters(
            KeywordStatDto stat,
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

    private KeywordStatDto toStat(String name, List<SeriesEntity> carryingSeries) {
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

        return new KeywordStatDto(name, carryingSeries.size(), averagePersonalRating, averageBlendedRating);
    }

    private BigDecimal averageOfInts(List<Integer> ratings) {
        BigDecimal sum = ratings.stream()
            .map(BigDecimal::valueOf)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(ratings.size()), 1, RoundingMode.HALF_UP);
    }

    private BigDecimal averageOfDecimals(List<BigDecimal> ratings) {
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
    private Comparator<KeywordStatDto> comparatorFor(String sortBy, String sortDirection) {
        if (SORT_BY_NAME.equals(sortBy)) {
            Comparator<KeywordStatDto> byName = Comparator.comparing(stat -> stat.name().toLowerCase());
            return isDescending(sortDirection, false) ? byName.reversed() : byName;
        }
        if (SORT_BY_AVERAGE_RATING.equals(sortBy)) {
            return nullsLastComparator(KeywordStatDto::averagePersonalRating, isDescending(sortDirection, true));
        }
        if (SORT_BY_AVERAGE_BLENDED_RATING.equals(sortBy)) {
            return nullsLastComparator(KeywordStatDto::averageBlendedRating, isDescending(sortDirection, true));
        }
        Comparator<KeywordStatDto> bySeriesCount = Comparator.comparing(KeywordStatDto::seriesCount);
        return isDescending(sortDirection, true) ? bySeriesCount.reversed() : bySeriesCount;
    }

    private Comparator<KeywordStatDto> nullsLastComparator(
            Function<KeywordStatDto, BigDecimal> extractor, boolean descending) {
        Comparator<BigDecimal> naturalDirection = descending ? Comparator.reverseOrder() : Comparator.naturalOrder();
        return Comparator.comparing(extractor, Comparator.nullsLast(naturalDirection));
    }

    private boolean isDescending(String sortDirection, boolean defaultDescending) {
        if (SORT_DIRECTION_ASC.equalsIgnoreCase(sortDirection)) {
            return false;
        }
        if (SORT_DIRECTION_DESC.equalsIgnoreCase(sortDirection)) {
            return true;
        }
        return defaultDescending;
    }
}
