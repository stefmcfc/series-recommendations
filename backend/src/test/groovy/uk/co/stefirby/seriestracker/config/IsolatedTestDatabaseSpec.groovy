package uk.co.stefirby.seriestracker.config

import spock.lang.Specification

class IsolatedTestDatabaseSpec extends Specification {

  def "TOOLING-010-AC-03: url is derived from the class's simple name and creates the parent dir"() {
    given:
        new File("build/test-dbs").deleteDir()

    when:
        def url = IsolatedTestDatabase.urlFor(IsolatedTestDatabaseSpec)

    then:
        url == "jdbc:sqlite:./build/test-dbs/IsolatedTestDatabaseSpec.db?busy_timeout=30000"
        new File("build/test-dbs").exists()
  }

  def "TOOLING-010-AC-03: a different class resolves to a different, equally deterministic url"() {
    expect:
        IsolatedTestDatabase.urlFor(String) ==
          "jdbc:sqlite:./build/test-dbs/String.db?busy_timeout=30000"
        IsolatedTestDatabase.urlFor(String) == IsolatedTestDatabase.urlFor(String)
  }
}
