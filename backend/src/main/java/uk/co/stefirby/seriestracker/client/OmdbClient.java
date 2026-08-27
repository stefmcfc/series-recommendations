package uk.co.stefirby.seriestracker.client;

import uk.co.stefirby.seriestracker.exception.EntityNotFoundException;
import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Client for the OMDb API (<a href="https://www.omdbapi.com/">omdbapi.com</a>), narrowed by
 * {@code series_spec_017_tmdb_primary_lookup.md} to a single best-effort rating-enrichment
 * call ({@link #ratingsForImdbId(String)}) -- TMDB is now this app's sole source for
 * title/year/genres/season-episode counts (see {@code TmdbClient}); OMDb only ever supplies
 * {@code imdbRating}/{@code rottenTomatoesRating} on top of a TMDB-resolved {@code imdbId}.
 *
 * <p>Built on Spring's {@link RestClient} (not {@code RestTemplate}, which is in
 * maintenance mode). A {@link RestClient.Builder} is constructor-injected rather than an
 * already-built {@code RestClient} so tests can bind a
 * {@code org.springframework.test.web.client.MockRestServiceServer} to it -- see
 * {@code OmdbClientSpec}.
 *
 * <p>Deliberately does <em>not</em> call {@code RestClient.Builder#requestFactory(...)}
 * itself: bounded connect/read timeouts (SERIES-005-AC-08) are instead configured via the
 * {@code spring.http.clients.connect-timeout}/{@code read-timeout} properties (see
 * {@code application.yml}), which Spring Boot applies to the auto-configured
 * {@code RestClient.Builder} this class is given. Setting a factory here directly would
 * silently overwrite whatever a test had already configured on the same builder via
 * {@code MockRestServiceServer.bindTo(...)}, since both mutate the same builder property
 * and whichever call happens last wins.
 */
@Component
public class OmdbClient {

    private static final String NOT_AVAILABLE = "N/A";

    private final String apiKey;
    private final RestClient restClient;

    public OmdbClient(RestClient.Builder restClientBuilder,
                       @Value("${app.omdb.api-key:}") String apiKey,
                       @Value("${app.omdb.base-url:https://www.omdbapi.com/}") String baseUrl) {
        this.apiKey = apiKey;
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
    }

    /**
     * Looks up {@code imdbRating}/{@code rottenTomatoesRating} for a series by its exact
     * IMDb id, via OMDb's {@code i=} parameter (SERIES-017-AC-09).
     *
     * @throws EntityNotFoundException  if OMDb reports no match ({@code Response: False})
     * @throws ExternalServiceException if the OMDb API key is unset, or the call fails for
     *                                  any other reason (network error, timeout, unexpected
     *                                  non-200, unparseable response)
     */
    public OmdbRatings ratingsForImdbId(String imdbId) {
        ExternalApiSupport.requireApiKey(apiKey, "OMDb", "app.omdb.api-key");

        Map<String, Object> body = fetch(uriBuilder -> uriBuilder
            .queryParam("apikey", apiKey)
            .queryParam("type", "series")
            .queryParam("i", imdbId)
            .build());

        if (body == null || isFalseResponse(body)) {
            throw new EntityNotFoundException("No OMDb results for imdbId: " + imdbId);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> ratings = (List<Map<String, Object>>) body.getOrDefault("Ratings", List.of());

        return new OmdbRatings(
            parseBigDecimal(body.get("imdbRating")),
            parseRatingFromSource(ratings, "Rotten Tomatoes")
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetch(Function<UriBuilder, URI> uriFunction) {
        try {
            return restClient.get()
                .uri(uriFunction)
                .retrieve()
                .body(Map.class);
        } catch (RestClientException e) {
            throw ExternalApiSupport.wrapFailure(e, "OMDb request failed");
        }
    }

    private static boolean isFalseResponse(Map<String, Object> body) {
        return "False".equalsIgnoreCase(str(body.get("Response")));
    }

    private static BigDecimal parseBigDecimal(Object value) {
        return ExternalApiSupport.toBigDecimal(str(value));
    }

    private static Integer parseRatingFromSource(List<Map<String, Object>> ratings, String sourceName) {
        if (ratings == null) {
            return null;
        }
        for (Map<String, Object> rating : ratings) {
            if (sourceName.equalsIgnoreCase(str(rating.get("Source")))) {
                String value = str(rating.get("Value"));
                if (value == null) {
                    return null;
                }
                String numeric = value.split("[/%]")[0].trim();
                try {
                    return Integer.valueOf(numeric);
                } catch (NumberFormatException _) {
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * Converts an OMDb JSON field value to a normalized string via {@link
     * ExternalApiSupport#str(Object)}, additionally treating the literal {@code "N/A"} as
     * absent per SERIES-005-AC-10 -- an OMDb-specific business rule layered on top of the
     * shared blank-handling, not part of it.
     */
    private static String str(Object value) {
        String s = ExternalApiSupport.str(value);
        return NOT_AVAILABLE.equalsIgnoreCase(s) ? null : s;
    }
}
