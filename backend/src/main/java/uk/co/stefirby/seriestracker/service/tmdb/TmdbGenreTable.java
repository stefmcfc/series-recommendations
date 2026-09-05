package uk.co.stefirby.seriestracker.service.tmdb;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Single source-of-truth TMDB TV genre name/id table (SERIES-007-AC-03), replacing the two
 * independently-maintained maps ({@code GENRE_NAME_TO_TMDB_ID}/{@code TMDB_ID_TO_GENRE_NAME})
 * {@code RecommendationService} previously held. Both a forward lookup (this app's stored
 * genre name -&gt; TMDB genre id, used to resolve sourcing/filter genre names) and a reverse
 * lookup (TMDB genre id -&gt; TMDB's own canonical display name, used to render a candidate's
 * {@code genre_ids} back to display text) are derived from one {@link #GENRES} list, so a
 * future edit to the mapping can't update one direction and forget the other
 * (SERIES-007-AC-04).
 *
 * <p>Preserves Spec 006's existing many-to-one collapsing behavior unchanged: {@code Action}
 * and {@code Adventure} both resolve to TMDB id {@code 10759}, rendered back as
 * {@code "Action & Adventure"}; {@code Sci-Fi} and {@code Fantasy} both resolve to
 * {@code 10765}, rendered back as {@code "Sci-Fi & Fantasy"}.
 */
@Component
public final class TmdbGenreTable {

    /**
     * One TMDB TV genre: its id, TMDB's own canonical display name, and every stored alias
     * name (this app's/OMDb's genre vocabulary) that collapses onto it.
     */
    public record TmdbGenre(int id, String canonicalName, List<String> aliases) {
    }

    public static final List<TmdbGenre> GENRES = List.of(
        new TmdbGenre(10759, "Action & Adventure", List.of("Action", "Adventure")),
        new TmdbGenre(16, "Animation", List.of("Animation")),
        new TmdbGenre(35, "Comedy", List.of("Comedy")),
        new TmdbGenre(80, "Crime", List.of("Crime")),
        new TmdbGenre(99, "Documentary", List.of("Documentary")),
        new TmdbGenre(18, "Drama", List.of("Drama")),
        new TmdbGenre(10751, "Family", List.of("Family")),
        new TmdbGenre(10762, "Kids", List.of("Kids")),
        new TmdbGenre(9648, "Mystery", List.of("Mystery")),
        new TmdbGenre(10763, "News", List.of("News")),
        new TmdbGenre(10764, "Reality", List.of("Reality")),
        new TmdbGenre(10765, "Sci-Fi & Fantasy", List.of("Sci-Fi", "Fantasy")),
        new TmdbGenre(10766, "Soap", List.of("Soap")),
        new TmdbGenre(10767, "Talk", List.of("Talk-Show")),
        new TmdbGenre(10768, "War & Politics", List.of("War")),
        new TmdbGenre(37, "Western", List.of("Western"))
    );

    private final Map<String, Integer> forward;
    private final Map<Integer, String> reverse;
    private final List<String> allAliasNames;

    public TmdbGenreTable() {
        Map<String, Integer> f = new LinkedHashMap<>();
        Map<Integer, String> r = new LinkedHashMap<>();
        for (TmdbGenre genre : GENRES) {
            for (String alias : genre.aliases()) {
                f.put(alias, genre.id());
            }
            r.put(genre.id(), genre.canonicalName());
        }
        this.forward = Map.copyOf(f);
        this.reverse = Map.copyOf(r);
        this.allAliasNames = GENRES.stream()
            .flatMap(genre -> genre.aliases().stream())
            .sorted()
            .toList();
    }

    /**
     * Resolves a stored alias genre name (e.g. {@code "Action"}, {@code "Sci-Fi"}) to its
     * TMDB genre id, or {@code null} if unrecognized -- TMDB's fixed 16 TV genres don't cover
     * every genre name OMDb/this app writes (e.g. {@code Thriller}, {@code Horror}), and an
     * unrecognized name is skipped by callers, not treated as an error.
     */
    public Integer idFor(String name) {
        return forward.get(name);
    }

    /**
     * Renders a TMDB genre id back to TMDB's own canonical display name, or {@code null} if
     * unrecognized.
     */
    public String displayNameFor(int id) {
        return reverse.get(id);
    }

    /**
     * Returns the flattened list of every alias name across all {@link #GENRES} entries --
     * the same strings {@link #idFor(String)} matches against -- sorted alphabetically
     * (SERIES-010-AC-01/02). Distinct from the 16 canonical display names {@link
     * #displayNameFor(int)} renders (e.g. {@code "Action & Adventure"}); this is the 18-item
     * alias vocabulary a caller like the "Genres" recommendation-sourcing field must match
     * against to guarantee a resolvable value.
     */
    public List<String> allAliasNames() {
        return allAliasNames;
    }

    /**
     * Maps a candidate's TMDB {@code genre_ids} to their canonical display names and joins
     * them with {@code ", "}, or {@code null} if {@code genreIds} is null/empty or none
     * resolve. Shared by {@code RecommendationDtoAssembler} (a candidate's displayed genres)
     * and {@code RecommendationOutputFilterService} (comparing against {@code excludeGenres})
     * so the two can't drift apart on how a candidate's genres are rendered.
     */
    public String joinDisplayNames(List<Integer> genreIds) {
        if (genreIds == null || genreIds.isEmpty()) {
            return null;
        }
        String joined = genreIds.stream()
            .map(this::displayNameFor)
            .filter(Objects::nonNull)
            .distinct()
            .collect(Collectors.joining(", "));
        return joined.isEmpty() ? null : joined;
    }
}
