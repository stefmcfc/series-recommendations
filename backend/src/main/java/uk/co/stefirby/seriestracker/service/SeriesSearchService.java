package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.dto.SeriesSearchCriteria;
import uk.co.stefirby.seriestracker.model.SeriesEntity;
import uk.co.stefirby.seriestracker.model.SeriesStatus;
import uk.co.stefirby.seriestracker.repository.SeriesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class SeriesSearchService {

    private static final Logger log = LoggerFactory.getLogger(SeriesSearchService.class);

    private final SeriesRepository repository;
    private final SeriesService seriesService;

    public SeriesSearchService(SeriesRepository repository, SeriesService seriesService) {
        this.repository = repository;
        this.seriesService = seriesService;
    }

    @Transactional(readOnly = true)
    public List<SeriesDto> search(SeriesSearchCriteria criteria) {
        log.debug("Searching series with criteria: title={}, status={}", criteria.getTitle(), criteria.getStatus());

        if (criteria.getStatus() != null && !criteria.getStatus().isBlank()) {
            try {
                SeriesStatus.valueOf(criteria.getStatus());
            } catch (IllegalArgumentException _) {
                throw new IllegalArgumentException("Invalid status: " + criteria.getStatus()
                    + ". Must be one of: WATCHING, COMPLETED, DROPPED, BACKLOG");
            }
        }

        // SERIES-009-AC-01/02/03/07/11: also validates sortBy/sortDirection, throwing
        // IllegalArgumentException (-> 400) for an unrecognized value.
        Comparator<SeriesEntity> sortComparator =
            SeriesSortResolver.resolve(criteria.getSortBy(), criteria.getSortDirection());

        return repository.findAll().stream()
            .filter(s -> matchesTitle(s, criteria.getTitle()))
            .filter(s -> matchesGenres(s, criteria.getGenres()))
            .filter(s -> matchesKeywords(s, criteria.getKeywords()))
            .filter(s -> matchesStatus(s, criteria.getStatus()))
            .filter(s -> matchesPersonalRating(s, criteria.getMinPersonalRating()))
            .filter(s -> matchesImdbRating(s, criteria.getMinImdbRating()))
            .filter(s -> matchesTmdbRating(s, criteria.getMinTmdbRating()))
            .filter(s -> matchesYearRange(s, criteria.getYearMin(), criteria.getYearMax()))
            .filter(s -> matchesFlaggedForRewatch(s, criteria.getFlaggedForRewatch()))
            .sorted(sortComparator)
            .map(seriesService::entityToDto)
            .toList();
    }

    private boolean matchesTitle(SeriesEntity s, String title) {
        if (title == null || title.isBlank()) return true;
        return s.getTitle().toLowerCase(Locale.ROOT).contains(title.toLowerCase(Locale.ROOT));
    }

    private boolean matchesGenres(SeriesEntity s, List<String> genres) {
        if (genres == null || genres.isEmpty()) return true;
        if (s.getGenres() == null || s.getGenres().isBlank()) return false;
        String lower = s.getGenres().toLowerCase(Locale.ROOT);
        return genres.stream().anyMatch(g -> lower.contains(g.toLowerCase(Locale.ROOT)));
    }

    // SERIES-019-AC-19: exact (case-insensitive) match against the normalized keyword set,
    // not the substring match matchesGenres uses -- keyword names come from a real,
    // spelling-stable TMDB vocabulary rather than free text.
    private boolean matchesKeywords(SeriesEntity s, List<String> keywords) {
        if (keywords == null || keywords.isEmpty()) return true;
        if (s.getKeywords() == null || s.getKeywords().isEmpty()) return false;
        return s.getKeywords().stream()
            .anyMatch(k -> keywords.stream().anyMatch(requested -> requested.equalsIgnoreCase(k.getName())));
    }

    private boolean matchesStatus(SeriesEntity s, String status) {
        if (status == null || status.isBlank()) return true;
        return s.getStatus() != null && s.getStatus().name().equals(status);
    }

    private boolean matchesPersonalRating(SeriesEntity s, Integer min) {
        if (s.getPersonalRating() == null) return min == null;
        return min == null || s.getPersonalRating() >= min;
    }

    private boolean matchesImdbRating(SeriesEntity s, BigDecimal min) {
        if (s.getImdbRating() == null) return min == null;
        return min == null || s.getImdbRating().compareTo(min) >= 0;
    }

    // series_spec_037_search_filter_overhaul.md (SERIES-037-AC-02): mirrors matchesImdbRating's
    // exact null-handling shape for SeriesEntity.tmdbRating.
    private boolean matchesTmdbRating(SeriesEntity s, BigDecimal min) {
        if (s.getTmdbRating() == null) return min == null;
        return min == null || s.getTmdbRating().compareTo(min) >= 0;
    }

    // series_spec_037_search_filter_overhaul.md (SERIES-037-AC-03): mirrors the old
    // matchesPersonalRating's min/max null-handling shape, matched against the series' single
    // stored SeriesEntity.year -- a documented stopgap, not a true episode-air-date range.
    private boolean matchesYearRange(SeriesEntity s, Integer yearMin, Integer yearMax) {
        if (s.getYear() == null) return yearMin == null && yearMax == null;
        if (yearMin != null && s.getYear() < yearMin) return false;
        return yearMax == null || s.getYear() <= yearMax;
    }

    // SERIES-008-AC-20/21: same nullable-boolean-filter shape as matchesStartedNotFinished --
    // a null or false criteria value is a no-op, and no status restriction is applied.
    private boolean matchesFlaggedForRewatch(SeriesEntity s, Boolean flaggedForRewatch) {
        if (flaggedForRewatch == null || !flaggedForRewatch) return true;
        return s.isFlaggedForRewatch();
    }
}
