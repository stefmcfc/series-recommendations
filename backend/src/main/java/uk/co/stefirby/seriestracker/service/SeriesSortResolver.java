package uk.co.stefirby.seriestracker.service;

import uk.co.stefirby.seriestracker.model.SeriesEntity;

import java.util.Comparator;
import java.util.List;
import java.util.function.Function;

// series_spec_009_rating_sort.md (SERIES-009-AC-05): the sortBy/sortDirection -> Comparator
// resolution is written once here and shared by SeriesService.getAll() and
// SeriesSearchService.search() rather than duplicated -- both listing endpoints need the
// identical behaviour for the same params. Package-private: only those two services use it.
final class SeriesSortResolver {

    // SERIES-009-AC-01/07: dateAdded/personalRating (Requirement 1) plus title/year/
    // imdbRating/tmdbRating (Requirement 2). series_spec_062_rating_sort_missing_value_exclusion.md
    // (SERIES-062-AC-01) adds rottenTomatoesRating/rottenTomatoesPopcornmeter.
    private static final List<String> VALID_SORT_BY =
        List.of("dateAdded", "personalRating", "title", "year", "imdbRating", "tmdbRating",
            "rottenTomatoesRating", "rottenTomatoesPopcornmeter");
    private static final List<String> VALID_SORT_DIRECTION = List.of("asc", "desc");

    // series_spec_062_rating_sort_missing_value_exclusion.md (SERIES-062-AC-02): the four
    // externally-sourced rating fields for which a missing value now means "excluded from the
    // list" (SeriesService/SeriesSearchService) rather than "sorted last but still shown".
    // personalRating is deliberately not in this set -- see the spec's Overview.
    private static final List<String> DROPPABLE_SORT_BY =
        List.of("imdbRating", "tmdbRating", "rottenTomatoesRating", "rottenTomatoesPopcornmeter");

    private SeriesSortResolver() {}

    // SERIES-009-AC-03: a null/blank sortDirection defaults to "desc".
    private static String resolveEffectiveDirection(String sortDirection) {
        return (sortDirection == null || sortDirection.isBlank()) ? "desc" : sortDirection;
    }

    // SERIES-009-AC-01: a null/blank sortBy defaults to "dateAdded". Extracted (SERIES-062
    // Design Decisions) so resolve() and isMissingRatingForSort() apply this rule identically.
    private static String resolveEffectiveSortBy(String sortBy) {
        return (sortBy == null || sortBy.isBlank()) ? "dateAdded" : sortBy;
    }

    static Comparator<SeriesEntity> resolve(String sortBy, String sortDirection) {
        String effectiveSortBy = resolveEffectiveSortBy(sortBy);
        String effectiveDirection = resolveEffectiveDirection(sortDirection);

        // SERIES-009-AC-02/11: any value outside the accepted set is rejected.
        if (!VALID_SORT_BY.contains(effectiveSortBy)) {
            throw new IllegalArgumentException("Invalid sortBy: " + sortBy
                + ". Must be one of: dateAdded, personalRating, title, year, imdbRating, tmdbRating, "
                + "rottenTomatoesRating, rottenTomatoesPopcornmeter");
        }
        // SERIES-009-AC-03: same style as the sortBy validation above.
        if (!VALID_SORT_DIRECTION.contains(effectiveDirection)) {
            throw new IllegalArgumentException("Invalid sortDirection: " + sortDirection
                + ". Must be one of: asc, desc");
        }

        boolean descending = effectiveDirection.equals("desc");

        return switch (effectiveSortBy) {
            case "personalRating" -> comparingNullsLast(SeriesEntity::getPersonalRating, descending);
            case "title" -> titleComparator(descending);
            case "year" -> comparingNullsLast(SeriesEntity::getYear, descending);
            case "imdbRating" -> comparingNullsLast(SeriesEntity::getImdbRating, descending);
            case "tmdbRating" -> tmdbRatingComparator(descending);
            case "rottenTomatoesRating" -> comparingNullsLast(SeriesEntity::getRottenTomatoesRating, descending);
            case "rottenTomatoesPopcornmeter" ->
                comparingNullsLast(SeriesEntity::getRottenTomatoesPopcornmeter, descending);
            default -> comparingNullsLast(SeriesEntity::getDateAdded, descending);
        };
    }

    /**
     * series_spec_062_rating_sort_missing_value_exclusion.md (SERIES-062-AC-02): true only when
     * the effective {@code sortBy} is one of the four droppable rating fields and this entity's
     * corresponding value is null. Package-private, alongside {@link #resolve}, so both
     * {@code SeriesService} and {@code SeriesSearchService} apply the identical rule.
     */
    static boolean isMissingRatingForSort(SeriesEntity entity, String sortBy) {
        String effectiveSortBy = resolveEffectiveSortBy(sortBy);
        if (!DROPPABLE_SORT_BY.contains(effectiveSortBy)) {
            return false;
        }
        return switch (effectiveSortBy) {
            case "imdbRating" -> entity.getImdbRating() == null;
            case "tmdbRating" -> entity.getTmdbRating() == null;
            case "rottenTomatoesRating" -> entity.getRottenTomatoesRating() == null;
            case "rottenTomatoesPopcornmeter" -> entity.getRottenTomatoesPopcornmeter() == null;
            default -> false;
        };
    }

    // SERIES-009-AC-08: titles compare case-insensitively -- SeriesEntity.title is not-null,
    // so no nulls-last handling is needed here (unlike every other field below).
    private static Comparator<SeriesEntity> titleComparator(boolean descending) {
        Comparator<SeriesEntity> cmp = Comparator.comparing(SeriesEntity::getTitle, String::compareToIgnoreCase);
        return descending ? cmp.reversed() : cmp;
    }

    // SERIES-009-AC-04/09: a null value for the chosen field always sorts last, regardless of
    // sortDirection -- Comparator.nullsLast short-circuits null handling ahead of delegating to
    // the (possibly reversed) natural-order comparator, so this holds for either direction.
    private static <T extends Comparable<T>> Comparator<SeriesEntity> comparingNullsLast(
            Function<SeriesEntity, T> extractor, boolean descending) {
        Comparator<T> order = descending ? Comparator.reverseOrder() : Comparator.naturalOrder();
        return Comparator.comparing(extractor, Comparator.nullsLast(order));
    }

    // SERIES-009-AC-10: tmdbVoteCount descending is the tiebreaker when tmdbRating is equal
    // (including both null) -- the tiebreak direction does not flip with sortDirection.
    private static Comparator<SeriesEntity> tmdbRatingComparator(boolean descending) {
        Comparator<SeriesEntity> byRating = comparingNullsLast(SeriesEntity::getTmdbRating, descending);
        Comparator<SeriesEntity> byVoteCountDesc = comparingNullsLast(SeriesEntity::getTmdbVoteCount, true);
        return byRating.thenComparing(byVoteCountDesc);
    }
}
