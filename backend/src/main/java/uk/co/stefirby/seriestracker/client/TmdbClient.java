package uk.co.stefirby.seriestracker.client;

import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
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

    private static final Pattern YEAR_PATTERN = Pattern.compile("\\d{4}");

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
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public List<TmdbCandidate> discover(List<Integer> genreIds, List<Integer> keywordIds) {
        Map<String, Object> body = fetch(uriBuilder -> {
            UriBuilder b = uriBuilder.path("discover/tv");
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
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public Optional<String> externalIds(int tmdbId) {
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder.path("tv/" + tmdbId + "/external_ids"));
        return Optional.ofNullable(str(body.get("imdb_id")));
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
                str(item.get("original_language"))
            ));
        }
        return candidates;
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
