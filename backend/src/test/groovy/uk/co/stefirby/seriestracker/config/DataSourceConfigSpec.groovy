package uk.co.stefirby.seriestracker.config

import com.zaxxer.hikari.HikariDataSource
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import spock.lang.Specification

/**
 * tooling_spec_010_sqlite_test_concurrency_reliability.md (TOOLING-010-AC-01): the test datasource
 * gets a real SQLite busy_timeout (so a connection contending for the file lock waits/retries
 * instead of failing instantly with SQLITE_BUSY) and a single-connection Hikari pool (SQLite only
 * ever services one writer at a time regardless of pool size, so a larger pool adds collision
 * surface with no concurrency benefit).
 */
@SpringBootTest
@ActiveProfiles("test")
class DataSourceConfigSpec extends Specification {

  @Autowired
  HikariDataSource dataSource

  def "TOOLING-010-AC-01: test datasource has a busy_timeout and a single-connection pool"() {
    expect:
        dataSource.jdbcUrl.contains("busy_timeout=30000")
        dataSource.maximumPoolSize == 1
  }
}
