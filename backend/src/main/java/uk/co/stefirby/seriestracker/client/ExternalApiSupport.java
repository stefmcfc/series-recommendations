package uk.co.stefirby.seriestracker.client;

import uk.co.stefirby.seriestracker.exception.ExternalServiceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;

/**
 * Shared static helpers for {@code TmdbClient}/{@code OmdbClient}
 * (tooling_spec_004_external_api_client_shared_helpers.md) -- both classes are thin
 * {@code RestClient} wrappers around one external HTTP API, and hand-rolled near-identical
 * private copies of "coerce this JSON value to an Integer/BigDecimal/String,"
 * "guard a blank api key," and "wrap a transport failure" before this class existed.
 *
 * <p>Deliberately a plain final class of static methods, not a Spring bean -- it holds no
 * state and needs no dependency injection.
 *
 * <p>What's <em>not</em> here, on purpose: {@code OmdbClient}'s extra "N/A" (case-insensitive)
 * -as-absent rule on top of {@link #str(Object)} is genuine OMDb-specific business behavior
 * (SERIES-005-AC-10), not duplicated logic -- it stays in {@code OmdbClient} itself, layered on
 * top of this class's {@code str}. Likewise {@code TmdbClient}'s null-body-to-{@code Map.of()}
 * normalization in its own {@code fetch} is specific to how its many callers consume the
 * result and is not shared here.
 */
public final class ExternalApiSupport {

    private static final Logger log = LoggerFactory.getLogger(ExternalApiSupport.class);

    private ExternalApiSupport() {
    }

    public static Integer toInteger(Object value) {
        if (value instanceof Number n) {
            return n.intValue();
        }
        if (value instanceof String s) {
            try {
                return Integer.valueOf(s.trim());
            } catch (NumberFormatException _) {
                return null;
            }
        }
        return null;
    }

    public static BigDecimal toBigDecimal(Object value) {
        if (value instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue());
        }
        if (value instanceof String s) {
            try {
                return new BigDecimal(s.trim());
            } catch (NumberFormatException _) {
                return null;
            }
        }
        return null;
    }

    public static String str(Object value) {
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    /**
     * Guards a call requiring an external API key: throws {@link ExternalServiceException} and
     * logs an error naming {@code propertyKey} when {@code apiKey} is {@code null}/blank;
     * returns normally, with no side effect, otherwise.
     */
    public static void requireApiKey(String apiKey, String serviceName, String propertyKey) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("{} call requested but {} is not configured", serviceName, propertyKey);
            throw new ExternalServiceException(serviceName + " API key is not configured");
        }
    }

    /**
     * Wraps a caught {@link RestClientException} as an {@link ExternalServiceException},
     * preserving the caller-supplied message and the original exception as the cause.
     */
    public static ExternalServiceException wrapFailure(RestClientException cause, String message) {
        return new ExternalServiceException(message, cause);
    }
}
