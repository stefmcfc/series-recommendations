package uk.co.stefirby.seriestracker.config

import org.yaml.snakeyaml.Yaml
import spock.lang.Specification

/**
 * tooling_spec_010_sqlite_test_concurrency_reliability.md (TOOLING-010-AC-02): asserts the
 * *production* datasource's busy_timeout/single-connection-pool configuration directly from
 * {@code src/main/resources/application.yml}'s raw content, rather than booting a real Spring
 * context under the default profile -- doing that would point a live HikariDataSource (and Flyway,
 * enabled in that profile) at this developer's actual {@code ./data/series.db}, which is exactly
 * the kind of accidental cross-context contention this spec exists to remove, not reintroduce via
 * its own verification.
 */
class ApplicationYmlDatasourceSpec extends Specification {

  def "TOOLING-010-AC-02: production datasource has a busy_timeout and a single-connection pool"() {
    given:
        def yaml = new Yaml().load(new File("src/main/resources/application.yml").text) as Map
        def datasource = yaml.spring.datasource as Map

    expect:
        (datasource.url as String).contains("busy_timeout=30000")
        (datasource.hikari as Map)['maximum-pool-size'] == 1
  }
}
