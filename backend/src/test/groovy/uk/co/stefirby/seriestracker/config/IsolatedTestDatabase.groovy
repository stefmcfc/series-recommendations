package uk.co.stefirby.seriestracker.config

/**
 * tooling_spec_010_sqlite_test_concurrency_reliability.md (TOOLING-010-AC-03): gives a test class its
 * own SQLite file, derived deterministically from the class's own simple name -- not a random value,
 * so the same class always resolves to the same file and this can't interact unpredictably with
 * Spring's own test-context cache key computation.
 *
 * <p>Used only by the handful of specs that already get their own dedicated {@code ApplicationContext}
 * today (each mocks a unique collaborator via {@code @MockitoBean}) -- see the spec's Design
 * Decisions for why this is deliberately not applied to the rest of the suite, which shares one
 * context (and can safely keep sharing one file, protected by TOOLING-010-AC-01's busy_timeout/
 * pool-size fix) across many specs.
 */
class IsolatedTestDatabase {

  private IsolatedTestDatabase() {
  }

  static String urlFor(Class<?> testClass) {
    def dir = new File("build/test-dbs")
    dir.mkdirs()
    return "jdbc:sqlite:./build/test-dbs/${testClass.simpleName}.db?busy_timeout=30000"
  }
}
