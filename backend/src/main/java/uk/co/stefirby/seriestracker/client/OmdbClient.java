package uk.co.stefirby.seriestracker.client;

import uk.co.stefirby.seriestracker.exception.EntityNotFoundException;
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
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Client for the OMDb API (<a href="https://www.omdbapi.com/">omdbapi.com</a>), isolating
 * its raw JSON response shape behind {@link OmdbLookupResult}.
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

    private static final Logger log = LoggerFactory.getLogger(OmdbClient.class);

    /**
     * Upper bound on {@code totalSeasons} for which per-season episode-count aggregation
     * (Requirement 4) is attempted, guarding against unbounded fan-out from a data-quality
     * anomaly in OMDb's {@code totalSeasons} value.
     */
    static final int OMDB_MAX_SEASONS_FOR_EPISODE_COUNT = 30;

    private static final Pattern YEAR_PATTERN = Pattern.compile("\\d{4}");
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
     * Looks up a series by title.
     *
     * @throws EntityNotFoundException  if OMDb reports no match ({@code Response: False})
     * @throws ExternalServiceException if the OMDb API key is unset, or the call fails for
     *                                  any other reason (network error, timeout, unexpected
     *                                  non-200, unparseable response)
     */
    public OmdbLookupResult lookup(String title) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("OMDb lookup requested but app.omdb.api-key is not configured");
            throw new ExternalServiceException("OMDb API key is not configured");
        }

        Map<String, Object> body = fetch(uriBuilder -> uriBuilder
            .queryParam("apikey", apiKey)
            .queryParam("type", "series")
            .queryParam("t", title)
            .build());

        if (body == null || isFalseResponse(body)) {
            throw new EntityNotFoundException("No OMDb results for title: " + title);
        }

        Integer totalSeasons = parseInt(body.get("totalSeasons"));
        Integer totalEpisodes = totalSeasons != null
            ? aggregateEpisodeCount(title, totalSeasons)
            : null;

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> ratings = (List<Map<String, Object>>) body.getOrDefault("Ratings", List.of());

        return new OmdbLookupResult(
            str(body.get("Title")),
            extractYear(str(body.get("Year"))),
            str(body.get("Genre")),
            totalSeasons,
            totalEpisodes,
            parseBigDecimal(body.get("imdbRating")),
            parseRatingFromSource(ratings, "Metacritic"),
            parseRatingFromSource(ratings, "Rotten Tomatoes"),
            str(body.get("Poster")),
            str(body.get("imdbID"))
        );
    }

    /**
     * Sums episode counts across {@code Season=1..totalSeasons}. Degrades to {@code null}
     * (rather than failing the whole lookup) if {@code totalSeasons} exceeds the cap, or if
     * any individual season call fails or returns something unparseable (SERIES-005-AC-12).
     */
    private Integer aggregateEpisodeCount(String title, int totalSeasons) {
        if (totalSeasons > OMDB_MAX_SEASONS_FOR_EPISODE_COUNT) {
            log.warn("totalSeasons ({}) for '{}' exceeds the aggregation cap ({}); "
                + "skipping episode count aggregation", totalSeasons, title, OMDB_MAX_SEASONS_FOR_EPISODE_COUNT);
            return null;
        }

        int sum = 0;
        for (int season = 1; season <= totalSeasons; season++) {
            final int currentSeason = season;
            Map<String, Object> seasonBody;
            try {
                seasonBody = fetch(uriBuilder -> uriBuilder
                    .queryParam("apikey", apiKey)
                    .queryParam("t", title)
                    .queryParam("Season", currentSeason)
                    .build());
            } catch (RuntimeException e) {
                log.warn("Failed to fetch season {} for '{}'; episode count aggregation abandoned",
                    currentSeason, title, e);
                return null;
            }

            if (seasonBody == null || isFalseResponse(seasonBody)) {
                return null;
            }

            Object episodes = seasonBody.get("Episodes");
            if (!(episodes instanceof List<?> episodeList)) {
                return null;
            }
            sum += episodeList.size();
        }
        return sum;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetch(Function<UriBuilder, URI> uriFunction) {
        try {
            return restClient.get()
                .uri(uriFunction)
                .retrieve()
                .body(Map.class);
        } catch (RestClientException e) {
            throw new ExternalServiceException("OMDb request failed", e);
        }
    }

    private static boolean isFalseResponse(Map<String, Object> body) {
        return "False".equalsIgnoreCase(str(body.get("Response")));
    }

    private static Integer extractYear(String yearRaw) {
        if (yearRaw == null) {
            return null;
        }
        Matcher matcher = YEAR_PATTERN.matcher(yearRaw);
        return matcher.find() ? Integer.valueOf(matcher.group()) : null;
    }

    private static Integer parseInt(Object value) {
        String s = str(value);
        if (s == null) {
            return null;
        }
        try {
            return Integer.valueOf(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static BigDecimal parseBigDecimal(Object value) {
        String s = str(value);
        if (s == null) {
            return null;
        }
        try {
            return new BigDecimal(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
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
                } catch (NumberFormatException e) {
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * Converts an OMDb JSON field value to a normalized string, treating the literal
     * {@code "N/A"} (and blank values) as absent per SERIES-005-AC-10.
     */
    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value).trim();
        if (s.isEmpty() || NOT_AVAILABLE.equalsIgnoreCase(s)) {
            return null;
        }
        return s;
    }
}
