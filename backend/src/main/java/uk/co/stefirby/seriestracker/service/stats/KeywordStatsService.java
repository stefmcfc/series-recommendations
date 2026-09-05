package uk.co.stefirby.seriestracker.service.stats;

import uk.co.stefirby.seriestracker.dto.KeywordStatDto;
import uk.co.stefirby.seriestracker.model.KeywordEntity;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import uk.co.stefirby.seriestracker.service.stats.NameStatAggregator.NameStat;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

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
 *
 * <p>The actual grouping/sorting/filtering logic lives in {@link NameStatAggregator}, shared
 * with {@code GenreStatsService}.
 *
 * <p>series_spec_051_stats_status_scope_filter.md (SERIES-051-AC-04) adds an {@code
 * onlyCompleted} pass-through, restricting aggregation to {@code SeriesStatus.COMPLETED} series
 * -- the filter itself lives in {@link NameStatAggregator#aggregate}, not here.
 */
@Service
public class KeywordStatsService {

    private final SeriesRepository seriesRepository;

    public KeywordStatsService(SeriesRepository seriesRepository) {
        this.seriesRepository = seriesRepository;
    }

    /** Pre-series_spec_047 signature, kept for backward compatibility (SERIES-047-AC-12). */
    @Transactional(readOnly = true)
    public List<KeywordStatDto> getStats(String sortBy) {
        return getStats(sortBy, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<KeywordStatDto> getStats(
            String sortBy,
            String sortDirection,
            Integer minSeriesCount,
            BigDecimal minAveragePersonalRating,
            BigDecimal minAverageBlendedRating,
            Boolean onlyCompleted) {
        List<NameStat> stats = NameStatAggregator.aggregate(
            seriesRepository.findAll(),
            series -> series.getKeywords().stream().map(KeywordEntity::getName).toList(),
            sortBy,
            sortDirection,
            minSeriesCount,
            minAveragePersonalRating,
            minAverageBlendedRating,
            onlyCompleted);

        return stats.stream()
            .map(stat -> new KeywordStatDto(
                stat.name(), stat.seriesCount(), stat.averagePersonalRating(), stat.averageBlendedRating()))
            .toList();
    }
}
