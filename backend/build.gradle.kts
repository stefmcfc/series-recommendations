plugins {
    java
    id("org.springframework.boot") version "4.0.0"
    id("io.spring.dependency-management") version "1.1.7"
    groovy
    jacoco
    id("com.github.spotbugs") version "6.5.10"
}

group = "com.example"
version = "0.0.1-SNAPSHOT"

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

    // SQLite
    implementation("org.xerial:sqlite-jdbc:3.46.1.3")
    implementation("org.hibernate.orm:hibernate-community-dialects:7.0.0.Final")

    // Flyway. spring-boot-flyway is required in addition to flyway-core: Boot 4 split
    // Flyway's autoconfiguration out of spring-boot-autoconfigure into its own module,
    // and without it migrations silently never run (no error, no log output).
    implementation("org.springframework.boot:spring-boot-flyway")
    implementation("org.flywaydb:flyway-core")

    // Test - Groovy 5 supports Java 25 class files
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.spockframework:spock-core:2.4-groovy-5.0")
    testImplementation("org.spockframework:spock-spring:2.4-groovy-5.0")
    testImplementation("org.apache.groovy:groovy:5.0.0")
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
    "com/example/seriestracker/SeriesTrackerApplication*",
    "com/example/seriestracker/dto/**",
    "com/example/seriestracker/model/SeriesEntity*",
    "com/example/seriestracker/model/SeriesStatus*",
    "com/example/seriestracker/model/ValidSeries*",
    "com/example/seriestracker/exception/EntityNotFoundException*"
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
