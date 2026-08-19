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
 * {@link org.springframework.test.web.client.MockRestServiceServer} to it -- see
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
        return Optional.ofNullable(toInteger(tvResults.get(0).get("id")));
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
     * @throws ExternalServiceException if the TMDB API key is unset, or the call fails for
     *                                  any other reason
     */
    public List<TmdbCandidate> discoverByGenre(List<Integer> genreIds) {
        String joined = genreIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        Map<String, Object> body = fetch(uriBuilder -> uriBuilder
            .path("discover/tv")
            .queryParam("with_genres", joined));
        return mapResults(body);
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
                toIntegerList(item.get("genre_ids"))
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
