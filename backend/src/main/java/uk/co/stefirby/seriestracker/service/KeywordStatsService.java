package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.KeywordStatDto;
import uk.co.stefirby.seriestracker.model.KeywordEntity;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
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

/**
 * Backs {@code GET /api/v1/series/keywords} (Requirement 4, {@code
 * series_spec_019_keyword_tracking.md}): one {@link KeywordStatDto} per distinct keyword
 * actually present across the user's tracked series, computed via in-memory aggregation over
 * {@code seriesRepository.findAll()} -- matching {@code SeriesSearchService}'s own established
 * "fine at this app's scale" precedent (SERIES-019-AC-14) rather than a custom repository
 * query.
 */
@Service
public class KeywordStatsService {

    private static final String SORT_BY_AVERAGE_RATING = "averagePersonalRating";

    private final SeriesRepository seriesRepository;

    public KeywordStatsService(SeriesRepository seriesRepository) {
        this.seriesRepository = seriesRepository;
    }

    @Transactional(readOnly = true)
    public List<KeywordStatDto> getStats(String sortBy) {
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

        stats.sort(comparatorFor(sortBy));
        return stats;
    }

    private KeywordStatDto toStat(String name, List<SeriesEntity> carryingSeries) {
        List<Integer> ratings = carryingSeries.stream()
            .map(SeriesEntity::getPersonalRating)
            .filter(Objects::nonNull)
            .toList();
        BigDecimal average = ratings.isEmpty() ? null : average(ratings);
        return new KeywordStatDto(name, carryingSeries.size(), average);
    }

    private BigDecimal average(List<Integer> ratings) {
        BigDecimal sum = ratings.stream()
            .map(BigDecimal::valueOf)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(ratings.size()), 1, RoundingMode.HALF_UP);
    }

    // SERIES-019-AC-16: descending by default; sortBy=averagePersonalRating sorts descending
    // with null-averages always last regardless of direction; an unrecognized value soft-
    // falls-back to the seriesCount default rather than a 400.
    private Comparator<KeywordStatDto> comparatorFor(String sortBy) {
        if (SORT_BY_AVERAGE_RATING.equals(sortBy)) {
            return Comparator.comparing(KeywordStatDto::averagePersonalRating,
                Comparator.nullsLast(Comparator.reverseOrder()));
        }
        return Comparator.comparing(KeywordStatDto::seriesCount, Comparator.reverseOrder());
    }
}
