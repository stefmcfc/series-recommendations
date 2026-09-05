plugins {
    java
    id("org.springframework.boot") version "4.1.1"
    id("io.spring.dependency-management") version "1.1.7"
    groovy
    jacoco
    id("com.github.spotbugs") version "6.5.11"
}

group = "uk.co.stefirby"
version = "3.23.2"

// Centralized here (kotlin:S6624) rather than inline in the dependencies block below --
// single place to bump each, and easier for dependabot's version-bump PRs to reason about.
val sqliteJdbcVersion = "3.53.4.0"
val spockVersion = "2.4-groovy-5.0"
val groovyVersion = "5.1.1"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // Spring Boot
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-web")

    // RestClient support (OmdbClient). Boot 4 split RestClient's autoconfiguration --
    // including the RestClient.Builder bean -- out of spring-boot-starter-web into its own
    // module (spring-boot-restclient, mirroring how spring-boot-flyway was split out below).
    // Without it, RestClient.Builder has no autoconfigured bean and fails to inject.
    implementation("org.springframework.boot:spring-boot-restclient")

    // SQLite. hibernate-community-dialects version is intentionally NOT pinned here --
    // Spring Boot's dependency-management BOM constrains it independently of
    // hibernate-core (e.g. still 7.0.0.Final under Boot 4.1.0's hibernate-core
    // 7.4.1.Final), and a manually-pinned newer version can be binary-incompatible
    // with whatever hibernate-core the BOM actually resolves (NoSuchMethodError at
    // runtime in SQLiteDialect). Let the BOM manage it so bumps only happen when
    // Spring Boot has actually validated the pairing.
    implementation("org.xerial:sqlite-jdbc:$sqliteJdbcVersion")
    implementation("org.hibernate.orm:hibernate-community-dialects")

    // Flyway. spring-boot-flyway is required in addition to flyway-core: Boot 4 split
    // Flyway's autoconfiguration out of spring-boot-autoconfigure into its own module,
    // and without it migrations silently never run (no error, no log output).
    implementation("org.springframework.boot:spring-boot-flyway")
    implementation("org.flywaydb:flyway-core")

    // Test - Groovy 5 supports Java 25 class files
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.spockframework:spock-core:$spockVersion")
    testImplementation("org.spockframework:spock-spring:$spockVersion")
    testImplementation("org.apache.groovy:groovy:$groovyVersion")
}

tasks.withType<Test> {
    useJUnitPlatform()
    finalizedBy(tasks.jacocoTestReport)
}

jacoco {
    toolVersion = "0.8.13"
}

// Classes with no meaningful logic (DTOs, exceptions, entities that are pure
// getters/setters, the Spring Boot entry point) are excluded from the coverage
// gate rather than padded with vacuous tests. Anything with real conditional
// logic (services, the validator, the catch-all exception handler, controllers)
// stays in scope.
val jacocoExcludes = listOf(
    "uk/co/stefirby/seriestracker/SeriesTrackerApplication*",
    "uk/co/stefirby/seriestracker/dto/**",
    "uk/co/stefirby/seriestracker/model/SeriesEntity*",
    "uk/co/stefirby/seriestracker/model/SeriesStatus*",
    "uk/co/stefirby/seriestracker/model/ValidSeries*",
    "uk/co/stefirby/seriestracker/model/IgnoredSeriesEntity*",
    "uk/co/stefirby/seriestracker/model/KeywordEntity*",
    "uk/co/stefirby/seriestracker/exception/EntityNotFoundException*",
    "uk/co/stefirby/seriestracker/exception/ExternalServiceException*"
)

// classDirectories is reassigned below (to apply jacocoExcludes) via the eager
// `.files.map` pattern, which loses the implicit task dependency Gradle would
// otherwise infer from the original provider -- dependsOn(tasks.classes) restores
// it explicitly so Gradle doesn't flag compileJava/compileGroovy/processResources
// as undeclared inputs.
tasks.jacocoTestReport {
    dependsOn(tasks.test, tasks.classes)
    reports {
        xml.required = true
        html.required = true
    }
    classDirectories.setFrom(
        files(classDirectories.files.map {
            fileTree(it) { exclude(jacocoExcludes) }
        })
    )
}

tasks.jacocoTestCoverageVerification {
    dependsOn(tasks.test, tasks.classes)
    classDirectories.setFrom(
        files(classDirectories.files.map {
            fileTree(it) { exclude(jacocoExcludes) }
        })
    )
    violationRules {
        rule {
            limit {
                counter = "LINE"
                minimum = "0.80".toBigDecimal()
            }
        }
    }
}

tasks.check {
    dependsOn(tasks.jacocoTestCoverageVerification)
}

// Static analysis (SpotBugs). `effort = MAX` runs the deepest analysis; `reportLevel =
// HIGH` means only high-priority findings are reported/fail the build — low/medium
// findings are still visible in the HTML report but don't break `check`, avoiding
// low-priority noise turning into a hard build failure per TOOLING-001-AC-06.
spotbugs {
    toolVersion = "4.10.3"
    effort = com.github.spotbugs.snom.Effort.MAX
    reportLevel = com.github.spotbugs.snom.Confidence.HIGH
}

tasks.spotbugsMain {
    reports.create("html") {
        required = true
        setStylesheet("fancy-hist.xsl")
    }
    reports.create("xml") {
        required = true
    }
}

// No Java sources exist under src/test (tests are Groovy specs) — SpotBugs has
// nothing to analyze there, so skip it rather than run a no-op task.
tasks.spotbugsTest {
    enabled = false
}
