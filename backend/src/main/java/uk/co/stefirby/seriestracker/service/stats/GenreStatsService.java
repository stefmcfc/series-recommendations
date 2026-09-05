package uk.co.stefirby.seriestracker.service.stats;

import uk.co.stefirby.seriestracker.dto.GenreStatDto;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import uk.co.stefirby.seriestracker.service.stats.NameStatAggregator.NameStat;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

/**
 * Backs {@code GET /api/v1/series/genres/stats} (series_spec_048_genre_stats.md, Requirement 1):
 * one {@link GenreStatDto} per distinct genre name actually present across the user's tracked
 * series, computed via in-memory aggregation over {@code seriesRepository.findAll()} -- the same
 * "fine at this app's scale" precedent {@link uk.co.stefirby.seriestracker.service.stats.KeywordStatsService}
 * already establishes for keywords (SERIES-019-AC-14), applied here to the delimited {@code
 * genres} column instead of a normalized join table (a deliberate choice -- see the spec's
 * Design Decisions).
 *
 * <p>The {@code sortBy}/{@code sortDirection}/min-filter contract, comparator logic (including
 * the nulls-last-under-both-directions handling), and null-averaging semantics live in {@link
 * NameStatAggregator}, shared unchanged with {@code KeywordStatsService}, per SERIES-048-AC-04/
 * AC-05.
 */
@Service
public class GenreStatsService {

    private final SeriesRepository seriesRepository;

    public GenreStatsService(SeriesRepository seriesRepository) {
        this.seriesRepository = seriesRepository;
    }

    @Transactional(readOnly = true)
    public List<GenreStatDto> getStats(
            String sortBy,
            String sortDirection,
            Integer minSeriesCount,
            BigDecimal minAveragePersonalRating,
            BigDecimal minAverageBlendedRating) {
        // SERIES-048-AC-03: a series listing the same genre more than once (a malformed
        // duplicate entry in the delimited string) contributes to that genre's seriesCount only
        // once -- de-duplicated per series inside NameStatAggregator itself, unlike keywords
        // where the Set<KeywordEntity> relationship already guarantees uniqueness.
        List<NameStat> stats = NameStatAggregator.aggregate(
            seriesRepository.findAll(),
            series -> splitGenres(series.getGenres()),
            sortBy,
            sortDirection,
            minSeriesCount,
            minAveragePersonalRating,
            minAverageBlendedRating);

        return stats.stream()
            .map(stat -> new GenreStatDto(
                stat.name(), stat.seriesCount(), stat.averagePersonalRating(), stat.averageBlendedRating()))
            .toList();
    }

    // Mirrors RecommendationSourcingService.splitGenres exactly (SERIES-048-AC-02): comma-
    // delimited, no space, each value trimmed, empty segments dropped.
    private static List<String> splitGenres(String genres) {
        if (genres == null || genres.isBlank()) {
            return List.of();
        }
        return Arrays.stream(genres.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
    }
}
