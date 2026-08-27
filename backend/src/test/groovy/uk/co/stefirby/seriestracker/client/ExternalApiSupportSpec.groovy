package uk.co.stefirby.seriestracker.client

import org.springframework.web.client.RestClientException
import spock.lang.Specification
import uk.co.stefirby.seriestracker.exception.ExternalServiceException

/**
 * Unit tests for {@link ExternalApiSupport}, the shared static helpers extracted from
 * {@code TmdbClient}/{@code OmdbClient} by tooling_spec_004_external_api_client_shared_helpers.md.
 * {@code OmdbClient}'s own {@code "N/A"}-as-absent behavior (TOOLING-004-AC-03) is exercised via
 * the existing {@code OmdbClientSpec} rather than duplicated here -- that rule stays OMDb-specific,
 * layered on top of {@link ExternalApiSupport#str(Object)}, not part of this shared class itself.
 */
class ExternalApiSupportSpec extends Specification {

    def "TOOLING-004-AC-01: toInteger/toBigDecimal/str match TmdbClient's existing semantics"() {
        expect: "Number and String inputs both coerce correctly"
            ExternalApiSupport.toInteger(42) == 42
            ExternalApiSupport.toInteger("42") == 42
            ExternalApiSupport.toInteger("not a number") == null
            ExternalApiSupport.toBigDecimal(8.4d) == BigDecimal.valueOf(8.4d)
            ExternalApiSupport.toBigDecimal("8.4") == new BigDecimal("8.4")
            ExternalApiSupport.str("  hello  ") == "hello"
            ExternalApiSupport.str("   ") == null
            ExternalApiSupport.str(null) == null
    }

    def "TOOLING-004-AC-05: requireApiKey throws for blank/null, no-ops for a real value"() {
        when: "the key is blank"
            ExternalApiSupport.requireApiKey("", "TMDB", "app.tmdb.api-key")
        then:
            thrown(ExternalServiceException)

        when: "the key is null"
            ExternalApiSupport.requireApiKey(null, "TMDB", "app.tmdb.api-key")
        then:
            thrown(ExternalServiceException)

        when: "the key is present"
            ExternalApiSupport.requireApiKey("real-key", "TMDB", "app.tmdb.api-key")
        then: "no exception"
            noExceptionThrown()
    }

    def "TOOLING-004-AC-05: requireApiKey's thrown message names the service"() {
        when:
            ExternalApiSupport.requireApiKey("", "TMDB", "app.tmdb.api-key")

        then:
            def ex = thrown(ExternalServiceException)
            ex.message == "TMDB API key is not configured"
    }

    def "TOOLING-004-AC-06: wrapFailure preserves the cause and message"() {
        given:
            def cause = new RestClientException("boom")

        when:
            def wrapped = ExternalApiSupport.wrapFailure(cause, "TMDB request failed")

        then:
            wrapped.message == "TMDB request failed"
            wrapped.cause == cause
    }
}
