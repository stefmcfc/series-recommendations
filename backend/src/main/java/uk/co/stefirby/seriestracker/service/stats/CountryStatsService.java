package uk.co.stefirby.seriestracker.service.stats;

import uk.co.stefirby.seriestracker.dto.CountryStatDto;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import uk.co.stefirby.seriestracker.service.stats.NameStatAggregator.NameStat;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

/**
 * Backs {@code GET /api/v1/series/origin-country/stats} (series_spec_049_country_of_origin_stats.md,
 * Requirement 1): one {@link CountryStatDto} per distinct ISO 3166-1 alpha-2 origin-country code
 * actually present across the user's tracked series, computed via in-memory aggregation over
 * {@code seriesRepository.findAll()} -- the same precedent {@link GenreStatsService} and {@link
 * KeywordStatsService} already establish, applied here to the comma-joined {@code originCountry}
 * column instead (series_spec_046_multi_origin_country.md).
 *
 * <p>The {@code sortBy}/{@code sortDirection}/min-filter contract, comparator logic, and
 * null-averaging semantics live in {@link NameStatAggregator}, shared unchanged with {@code
 * KeywordStatsService}/{@code GenreStatsService}, per SERIES-049-AC-04/AC-05.
 *
 * <p>series_spec_051_stats_status_scope_filter.md (SERIES-051-AC-05) adds an {@code
 * onlyCompleted} pass-through, restricting aggregation to {@code SeriesStatus.COMPLETED} series
 * -- the filter itself lives in {@link NameStatAggregator#aggregate}, not here. This parameter is
 * not among series_spec_049's own acceptance criteria (which predate series_spec_051) but is
 * required to match the current shared aggregator signature -- see the spec's own note near the
 * top of the Design Decisions section.
 */
@Service
public class CountryStatsService {

    private final SeriesRepository seriesRepository;

    public CountryStatsService(SeriesRepository seriesRepository) {
        this.seriesRepository = seriesRepository;
    }

    @Transactional(readOnly = true)
    public List<CountryStatDto> getStats(
            String sortBy,
            String sortDirection,
            Integer minSeriesCount,
            BigDecimal minAveragePersonalRating,
            BigDecimal minAverageBlendedRating,
            Boolean onlyCompleted) {
        // SERIES-049-AC-03: a series listing more than one origin-country code contributes once
        // to each listed code's seriesCount -- de-duplicated per series inside
        // NameStatAggregator itself, same as genres.
        List<NameStat> stats = NameStatAggregator.aggregate(
            seriesRepository.findAll(),
            series -> splitOriginCountry(series.getOriginCountry()),
            sortBy,
            sortDirection,
            minSeriesCount,
            minAveragePersonalRating,
            minAverageBlendedRating,
            onlyCompleted);

        return stats.stream()
            .map(stat -> new CountryStatDto(
                stat.name(), stat.seriesCount(), stat.averagePersonalRating(), stat.averageBlendedRating()))
            .toList();
    }

    // SERIES-049-AC-02: a bare comma split, no per-segment trimming -- originCountry has never
    // contained embedded whitespace (series_spec_046's no-space storage convention), unlike
    // genres, which does defensively trim.
    private static List<String> splitOriginCountry(String originCountry) {
        if (originCountry == null || originCountry.isBlank()) {
            return List.of();
        }
        return Arrays.stream(originCountry.split(","))
            .filter(s -> !s.isEmpty())
            .toList();
    }
}
