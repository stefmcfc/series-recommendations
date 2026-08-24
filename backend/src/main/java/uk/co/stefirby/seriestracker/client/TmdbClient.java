package uk.co.stefirby.seriestracker.client;

import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import uk.co.stefirby.seriestracker.model.ProductionStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Client for the TMDB API (<a href="https://www.themoviedb.org/documentation/api">The Movie
 * Database</a>), isolating its raw JSON response shape behind {@link TmdbCandidate}.
 *
 * <p>Built on Spring's {@link RestClient}, mirroring {@code OmdbClient} exactly: a
 * {@link RestClient.Builder} is constructor-injected rather than an already-built
 * {@code RestClient} so tests can bind a
 * {@code org.springframework.test.web.client.MockRestServiceServer} to it -- see
 * {@code TmdbClientSpec}. Authenticates via TMDB's v3 key-based auth ({@code ?api_key=} on
 * every request), not v4 Bearer-token auth, to mirror {@code OmdbClient}'s query-param-key
 * shape exactly rather than introducing a second auth style for one client.
 *
 * <p>Deliberately does <em>not</em> call {@code RestClient.Builder#requestFactory(...)}
 * itself, for the same reason documented on {@code OmdbClient}: bounded connect/read
 * timeouts are configured globally via {@code spring.http.clients.connect-timeout}/
 * {@code read-timeout} in {@code application.yml}, shared with {@code OmdbClient}.
 */
@Component
public class TmdbClient {

    private static final Logger log = LoggerFactory.getLogger(TmdbClient.class);

    /**
     * TMDB's poster-image base URL, prepended to a {@code poster_path} to build a displayable
     * poster URL. The single owner of this literal (SERIES-012-AC-01) -- callers such as
     * {@code RecommendationService} and {@code SeriesLookupService} reference this constant
     * rather than holding their own copy.
     */
    public static final String POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

    private static final Pattern YEAR_PATTERN = Pattern.compile("\\d{4}");

    /** Valid {@code timeWindow} values for {@link #trending(String)} (SERIES-022-AC-02). */
    private static final Set<String> VALID_TIME_WINDOWS = Set.of("day", "week");

    private final String apiKey;
    private final RestClient restClient;

    public TmdbClient(RestClient.Builder restClientBuilder,
                       @Value("${app.tmdb.api-key:}") String apiKey,
                       @Value("${app.tmdb.base-url:https://api.themoviedb.org/3/}") String baseUrl) {
        this.apiKey = apiKey;
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
    }

    /**
     * Resolves a TMDB TV id from an IMDb id via {@code GET /find/{imdbId}?external_source=imdb_id}.
     *
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public Optional<Integer> findTvIdByImdbId(String imdbId) {
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder
            .path("find/" + imdbId)
            .queryParam("external_source", "imdb_id"));

        List<Map<String, Object>> tvResults = listOfMaps(body, "tv_results");
        if (tvResults.isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(toInteger(tvResults.getFirst().get("id")));
    }

    /**
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public List<TmdbCandidate> recommendations(int tmdbId) {
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder.path("tv/" + tmdbId + "/recommendations"));
        return mapResults(body);
    }

    /**
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public List<TmdbCandidate> similar(int tmdbId) {
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder.path("tv/" + tmdbId + "/similar"));
        return mapResults(body);
    }

    /**
     * Resolves a free-text keyword to a TMDB keyword id via
     * {@code GET /search/keyword?query={name}} (SERIES-007-AC-05), returning the first
     * result's {@code id}, or empty if {@code results[]} is absent or empty.
     *
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public Optional<Integer> searchKeyword(String name) {
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder
            .path("search/keyword")
            .queryParam("query", name));

        List<Map<String, Object>> results = listOfMaps(body, "results");
        if (results.isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(toInteger(results.getFirst().get("id")));
    }

    /**
     * Discovers TV series by genre and/or keyword id via {@code GET /discover/tv}
     * (SERIES-007-AC-06), superseding {@code discoverByGenre} (SERIES-006-AC-11) -- TMDB's
     * real {@code /discover/tv} endpoint accepts {@code with_genres} and {@code
     * with_keywords} as two params on the same call, so this single method matches the real
     * API shape better than two near-duplicate ones. {@code with_genres} is included only
     * when {@code genreIds} is non-empty, and {@code with_keywords} only when {@code
     * keywordIds} is non-empty; both may be present on the same call.
     *
     * <p>{@code sortBy} is sent as {@code sort_by} on every call (SERIES-025-AC-01) -- a
     * required parameter, not optional/nullable: {@code RecommendationService} always
     * resolves a concrete TMDB {@code sort_by} value (its own mode-aware default, or the
     * caller's explicit choice) before calling this method, so no null-handling is needed
     * here.
     *
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public List<TmdbCandidate> discover(List<Integer> genreIds, List<Integer> keywordIds, String sortBy) {
        Map<String, Object> body = fetch(uriBuilder -> {
            UriBuilder b = uriBuilder.path("discover/tv").queryParam("sort_by", sortBy);
            if (genreIds != null && !genreIds.isEmpty()) {
                b = b.queryParam("with_genres", joinIds(genreIds));
            }
            if (keywordIds != null && !keywordIds.isEmpty()) {
                b = b.queryParam("with_keywords", joinIds(keywordIds));
            }
            return b;
        });
        return mapResults(body);
    }

    private static String joinIds(List<Integer> ids) {
        return ids.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    /**
     * Globally trending TV shows via {@code GET /trending/tv/{timeWindow}} (SERIES-022-AC-01),
     * mapped identically to {@link #recommendations(int)}/{@link #similar(int)}/{@link
     * #discover(List, List)} -- TMDB's own {@code results[]} ordering (its popularity ranking)
     * is preserved, never re-sorted (SERIES-022-AC-04).
     *
     * @throws IllegalArgumentException if {@code timeWindow} is not {@code "day"} or {@code
     *                                  "week"} -- checked before any TMDB call is attempted
     *                                  (SERIES-022-AC-02)
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public List<TmdbCandidate> trending(String timeWindow) {
        if (timeWindow == null || !VALID_TIME_WINDOWS.contains(timeWindow)) {
            throw new IllegalArgumentException("timeWindow must be 'day' or 'week'");
        }
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder.path("trending/tv/" + timeWindow));
        return mapResults(body);
    }

    /**
     * TMDB's highest-rated TV shows overall, with a minimum vote-count floor, via {@code GET
     * /discover/tv?sort_by={sortBy}&vote_count.gte={minVoteCount}} (SERIES-022-AC-03) --
     * mapped identically to {@link #discover(List, List, String)}, preserving TMDB's own
     * returned order (SERIES-022-AC-04).
     *
     * <p>{@code sortBy} was a hardcoded {@code "vote_average.desc"} literal prior to
     * SERIES-025-AC-02; it's now a required parameter for the same reason {@link
     * #discover(List, List, String)}'s is -- {@code RecommendationService} always resolves a
     * concrete default ({@code "vote_average.desc"} for this method) before calling it.
     *
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public List<TmdbCandidate> discoverTopRated(int minVoteCount, String sortBy) {
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder
            .path("discover/tv")
            .queryParam("sort_by", sortBy)
            .queryParam("vote_count.gte", minVoteCount));
        return mapResults(body);
    }

    /**
     * Fetches a show's current TMDB keywords via {@code GET /tv/{tmdbId}/keywords}
     * (SERIES-019-AC-05), used by {@code KeywordSyncService} to populate/reconcile a series'
     * normalized keyword set. An absent/malformed {@code results} field yields an empty list,
     * not an error (SERIES-019-AC-06).
     *
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public List<TmdbKeyword> showKeywords(int tmdbId) {
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder.path("tv/" + tmdbId + "/keywords"));
        return mapKeywords(body);
    }

    /**
     * Resolves a show's current TMDB production status via {@code GET /tv/{tmdbId}}
     * (SERIES-008-AC-08) -- a narrower, single-field counterpart to {@link #details(int)} for
     * callers that only need {@code status}, not a show's full detail. An absent {@code
     * status} field or one with no matching {@link ProductionStatus} constant maps to {@link
     * Optional#empty()}, not an error, via the same {@link ProductionStatus#fromTmdbStatus}
     * mapping {@link #details(int)} itself uses.
     *
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public Optional<ProductionStatus> showStatus(int tmdbId) {
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder.path("tv/" + tmdbId));
        return ProductionStatus.fromTmdbStatus(str(body.get("status")));
    }

    /**
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public Optional<String> externalIds(int tmdbId) {
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder.path("tv/" + tmdbId + "/external_ids"));
        return Optional.ofNullable(str(body.get("imdb_id")));
    }

    /**
     * Full-catalog TV title search via {@code GET /search/tv?query={query}}
     * (SERIES-012-AC-03) -- unlike {@code OmdbClient.search}'s {@code s=}, TMDB's search
     * matches against original, translated, and "also known as" names, so a title OMDb has
     * filed under a different name can still be found this way.
     *
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public List<TmdbSearchCandidate> search(String query) {
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder
            .path("search/tv")
            .queryParam("query", query));
        return mapSearchResults(body);
    }

    /**
     * Full detail lookup for a specific TMDB id via {@code GET /tv/{tmdbId}} (SERIES-012-AC-08),
     * used as the degraded-fallback data source when OMDb has no record for a resolved
     * {@code imdbId}.
     *
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public TmdbSeriesDetail details(int tmdbId) {
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder.path("tv/" + tmdbId));
        return new TmdbSeriesDetail(
            str(body.get("name")),
            extractYear(str(body.get("first_air_date"))),
            genreIdsFromObjects(body.get("genres")),
            str(body.get("poster_path")),
            toInteger(body.get("number_of_seasons")),
            toInteger(body.get("number_of_episodes")),
            toBigDecimal(body.get("vote_average")),
            toInteger(body.get("vote_count")),
            ProductionStatus.fromTmdbStatus(str(body.get("status"))).orElse(null),
            firstOriginCountry(body.get("origin_country")),
            str(body.get("overview"))
        );
    }

    private Map<String, Object> fetch(Function<UriBuilder, UriBuilder> customizer) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("TMDB call requested but app.tmdb.api-key is not configured");
            throw new ExternalServiceException("TMDB API key is not configured");
        }
        try {
            return doFetch(uriBuilder -> customizer.apply(uriBuilder).queryParam("api_key", apiKey).build());
        } catch (RestClientException e) {
            throw new ExternalServiceException("TMDB request failed", e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> doFetch(Function<UriBuilder, URI> uriFunction) {
        return restClient.get()
            .uri(uriFunction)
            .retrieve()
            .body(Map.class);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> listOfMaps(Map<String, Object> body, String key) {
        if (body == null) {
            return List.of();
        }
        Object value = body.get(key);
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object o : list) {
            if (o instanceof Map<?, ?> m) {
                result.add((Map<String, Object>) m);
            }
        }
        return result;
    }

    private static List<TmdbCandidate> mapResults(Map<String, Object> body) {
        List<Map<String, Object>> results = listOfMaps(body, "results");
        List<TmdbCandidate> candidates = new ArrayList<>();
        for (Map<String, Object> item : results) {
            Integer id = toInteger(item.get("id"));
            if (id == null) {
                continue;
            }
            candidates.add(new TmdbCandidate(
                id,
                str(item.get("name")),
                extractYear(str(item.get("first_air_date"))),
                str(item.get("overview")),
                str(item.get("poster_path")),
                toBigDecimal(item.get("vote_average")),
                toIntegerList(item.get("genre_ids")),
                toInteger(item.get("vote_count")),
                str(item.get("original_language")),
                firstOriginCountry(item.get("origin_country"))
            ));
        }
        return candidates;
    }

    private static List<TmdbKeyword> mapKeywords(Map<String, Object> body) {
        List<Map<String, Object>> results = listOfMaps(body, "results");
        List<TmdbKeyword> keywords = new ArrayList<>();
        for (Map<String, Object> item : results) {
            Integer id = toInteger(item.get("id"));
            if (id == null) {
                continue;
            }
            keywords.add(new TmdbKeyword(id, str(item.get("name"))));
        }
        return keywords;
    }

    private static List<TmdbSearchCandidate> mapSearchResults(Map<String, Object> body) {
        List<Map<String, Object>> results = listOfMaps(body, "results");
        List<TmdbSearchCandidate> candidates = new ArrayList<>();
        for (Map<String, Object> item : results) {
            Integer id = toInteger(item.get("id"));
            if (id == null) {
                continue;
            }
            String title = str(item.get("name"));
            String originalTitle = str(item.get("original_name"));
            if (originalTitle != null && originalTitle.equals(title)) {
                originalTitle = null;
            }
            candidates.add(new TmdbSearchCandidate(
                id,
                title,
                originalTitle,
                extractYear(str(item.get("first_air_date"))),
                str(item.get("poster_path")),
                toIntegerList(item.get("genre_ids")),
                firstOriginCountry(item.get("origin_country"))
            ));
        }
        return candidates;
    }

    /**
     * Extracts each entry's {@code id} from an array of {@code {id, name}} genre objects, as
     * returned by {@code GET /tv/{id}}'s {@code genres} field -- a materially different shape
     * from the flat {@code genre_ids} integer array {@link #toIntegerList} handles
     * (SERIES-012-AC-09).
     */
    @SuppressWarnings("unchecked")
    private static List<Integer> genreIdsFromObjects(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        List<Integer> ids = new ArrayList<>();
        for (Object o : list) {
            if (o instanceof Map<?, ?> m) {
                Integer id = toInteger(((Map<String, Object>) m).get("id"));
                if (id != null) {
                    ids.add(id);
                }
            }
        }
        return ids;
    }

    /**
     * Extracts the first entry of TMDB's {@code origin_country} array (SERIES-021-AC-01/02) --
     * only the first entry is kept, per {@code series_spec_021_origin_country.md}'s design
     * decision, mirroring {@link #findTvIdByImdbId(String)}'s own existing precedent of taking
     * an array response's first entry. {@code null} when the field is absent or empty.
     */
    @SuppressWarnings("unchecked")
    private static String firstOriginCountry(Object value) {
        if (!(value instanceof List<?> list) || list.isEmpty()) {
            return null;
        }
        return str(((List<Object>) list).get(0));
    }

    private static List<Integer> toIntegerList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        List<Integer> ids = new ArrayList<>();
        for (Object o : list) {
            Integer i = toInteger(o);
            if (i != null) {
                ids.add(i);
            }
        }
        return ids;
    }

    private static Integer toInteger(Object value) {
        if (value instanceof Number n) {
            return n.intValue();
        }
        if (value instanceof String s) {
            try {
                return Integer.valueOf(s.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static BigDecimal toBigDecimal(Object value) {
        if (value instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue());
        }
        if (value instanceof String s) {
            try {
                return new BigDecimal(s.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static Integer extractYear(String dateRaw) {
        if (dateRaw == null) {
            return null;
        }
        Matcher matcher = YEAR_PATTERN.matcher(dateRaw);
        return matcher.find() ? Integer.valueOf(matcher.group()) : null;
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }
}
