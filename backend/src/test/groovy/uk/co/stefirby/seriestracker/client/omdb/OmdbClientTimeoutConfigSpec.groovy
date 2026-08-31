package uk.co.stefirby.seriestracker.client.omdb

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import spock.lang.Specification

/**
 * Verifies SERIES-005-AC-08: OMDb calls use a bounded connect and read timeout.
 *
 * <p>Configured via the Boot-native {@code spring.http.clients.connect-timeout}/
 * {@code read-timeout} properties (applied by Spring Boot's auto-configured
 * {@code RestClient.Builder}, which {@link OmdbClient} builds its client from), rather than
 * a manual {@code ClientHttpRequestFactory} set inside {@link OmdbClient} itself -- see the
 * comment in {@code application.yml} for why: a manual, in-code
 * {@code RestClient.Builder#requestFactory(...)} call would silently overwrite whatever
 * {@code MockRestServiceServer.bindTo(RestClient.Builder)} had already configured for
 * {@link OmdbClientSpec}'s tests, since both mutate the same builder property.
 */
@SpringBootTest
@ActiveProfiles("test")
class OmdbClientTimeoutConfigSpec extends Specification {

    @Value('${spring.http.clients.connect-timeout}')
    String connectTimeout

    @Value('${spring.http.clients.read-timeout}')
    String readTimeout

    def "SERIES-005-AC-08: a bounded connect and read timeout are configured for outbound OMDb calls"() {
        expect: "both timeouts are set to a finite, bounded duration"
            connectTimeout == "5s"
            readTimeout == "10s"
    }
}
