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

        // series_spec_062_rating_sort_missing_value_exclusion.md (SERIES-062-AC-04): a series
        // missing the sorted-on rating is excluded entirely, applied after every other filter.
        return filteredEntities(criteria).stream()
            .filter(s -> !SeriesSortResolver.isMissingRatingForSort(s, criteria.getSortBy()))
            .sorted(sortComparator)
            .map(seriesService::entityToDto)
            .toList();
    }

    /**
     * series_spec_062_rating_sort_missing_value_exclusion.md (SERIES-062-AC-04/06): every filter
     * stage {@link #search} already applied, extracted so both {@code search} (drops entries
     * missing the sorted-on rating, returns the rest) and {@link #countMissingForSort} (counts
     * exactly those dropped entries) operate over the identical pre-sort, post-every-other-filter
     * population. Pure extraction -- no behavior change to the filter chain itself.
     */
    private List<SeriesEntity> filteredEntities(SeriesSearchCriteria criteria) {
        return repository.findAll().stream()
            .filter(s -> matchesTitle(s, criteria.getTitle()))
            .filter(s -> matchesGenres(s, criteria.getGenres()))
            .filter(s -> matchesExcludeGenres(s, criteria.getExcludeGenres()))
            .filter(s -> matchesKeywords(s, criteria.getKeywords()))
            .filter(s -> matchesStatus(s, criteria.getStatus()))
            .filter(s -> matchesPersonalRating(s, criteria.getMinPersonalRating()))
            .filter(s -> matchesImdbRating(s, criteria.getMinImdbRating()))
            .filter(s -> matchesTmdbRating(s, criteria.getMinTmdbRating()))
            .filter(s -> matchesYearRange(s, criteria.getYearMin(), criteria.getYearMax()))
            .filter(s -> matchesFlaggedForRewatch(s, criteria.getFlaggedForRewatch()))
            .filter(s -> matchesMissingRatings(s, criteria))
            .toList();
    }

    /**
     * series_spec_062_rating_sort_missing_value_exclusion.md (SERIES-062-AC-06): the count of
     * criteria-matching series {@link #search} drops for {@code criteria.getSortBy()} -- {@code
     * 0} for every non-droppable value.
     */
    @Transactional(readOnly = true)
    public long countMissingForSort(SeriesSearchCriteria criteria) {
        return filteredEntities(criteria).stream()
            .filter(s -> SeriesSortResolver.isMissingRatingForSort(s, criteria.getSortBy()))
            .count();
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

    // series_spec_042_exclude_genres_search.md (SERIES-042-AC-02/03/04/05): a negated,
    // any-match mirror of matchesGenres above. A genre-less series (null/blank genres) is never
    // excluded -- there's nothing to match against, same null-handling convention matchesGenres
    // uses for include. Applied as an independent filter stage alongside matchesGenres, so a
    // series matching both an included and an excluded genre is excluded (exclude wins).
    private boolean matchesExcludeGenres(SeriesEntity s, List<String> excludeGenres) {
        if (excludeGenres == null || excludeGenres.isEmpty()) return true;
        if (s.getGenres() == null || s.getGenres().isBlank()) return true;
        String lower = s.getGenres().toLowerCase(Locale.ROOT);
        return excludeGenres.stream().noneMatch(g -> lower.contains(g.toLowerCase(Locale.ROOT)));
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

    // series_spec_039_last_air_year.md (SERIES-039-AC-05): true interval-overlap matching --
    // supersedes series_spec_037's SERIES-037-AC-03 stopgap (see that spec for the superseded
    // note), which compared only against the series' single stored SeriesEntity.year. A
    // series' known airing span runs from its year to its lastAirYear, or just its year if
    // lastAirYear is unset. A match requires the span's start to be at or before yearMax
    // (when set) and the span's end to be at or after yearMin (when set) -- the standard
    // interval-overlap test. A series with no year at all still never matches when either
    // bound is set, unchanged from series_spec_037's existing null-handling.
    private boolean matchesYearRange(SeriesEntity s, Integer yearMin, Integer yearMax) {
        if (s.getYear() == null) return yearMin == null && yearMax == null;
        if (yearMax != null && s.getYear() > yearMax) return false;
        Integer effectiveEnd = s.getLastAirYear() != null ? s.getLastAirYear() : s.getYear();
        return yearMin == null || effectiveEnd >= yearMin;
    }

    // SERIES-008-AC-20/21: same nullable-boolean-filter shape as matchesStartedNotFinished --
    // a null or false criteria value is a no-op, and no status restriction is applied.
    private boolean matchesFlaggedForRewatch(SeriesEntity s, Boolean flaggedForRewatch) {
        if (flaggedForRewatch == null || !flaggedForRewatch) return true;
        return s.isFlaggedForRewatch();
    }

    // series_spec_060_missing_ratings_filter.md (SERIES-060-AC-03/04/05/06): unlike every other
    // filter stage in this pipeline, these four criteria fields are deliberately OR'd together
    // rather than each being its own independently-ANDed filter stage -- checking a second
    // "missing" box is meant to broaden the to-do list of series needing manual attention, not
    // narrow it to only series missing every checked rating simultaneously. When none of the
    // four is true this is a no-op, consistent with every other unset criteria field. This
    // combined predicate still ANDs with every other filter stage as normal via its own single
    // .filter(...) call above.
    private boolean matchesMissingRatings(SeriesEntity s, SeriesSearchCriteria criteria) {
        boolean any = Boolean.TRUE.equals(criteria.getMissingImdbRating())
            || Boolean.TRUE.equals(criteria.getMissingTmdbRating())
            || Boolean.TRUE.equals(criteria.getMissingRottenTomatoesRating())
            || Boolean.TRUE.equals(criteria.getMissingRottenTomatoesPopcornmeter());
        if (!any) return true;

        return (Boolean.TRUE.equals(criteria.getMissingImdbRating()) && s.getImdbRating() == null)
            || (Boolean.TRUE.equals(criteria.getMissingTmdbRating()) && s.getTmdbRating() == null)
            || (Boolean.TRUE.equals(criteria.getMissingRottenTomatoesRating()) && s.getRottenTomatoesRating() == null)
            || (Boolean.TRUE.equals(criteria.getMissingRottenTomatoesPopcornmeter())
                && s.getRottenTomatoesPopcornmeter() == null);
    }
}
