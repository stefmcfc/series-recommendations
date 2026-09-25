# Series Spec 066: OpenAPI/Swagger Dependency (springdoc-openapi)

**Status**: Implemented
**Priority**: P3
**Depends on**: none (net-new dependency, no existing spec touches this area)
**Area**: Backend (`backend/build.gradle.kts`, new `config/OpenApiConfig.java`, `.claude/steering/tech.md`, `RUNBOOK.md`)

## Overview

`.claude/steering/tech.md`'s own "API Documentation" section already flags this gap directly: *"Not currently wired up. `springdoc-openapi` is **not** a dependency in `build.gradle.kts` — there is no `/swagger-ui.html` available today... Add `springdoc-openapi-starter-webmvc-ui` if interactive API docs are wanted."* This spec fulfills that note. Adding the dependency gets a live, interactive Swagger UI and a machine-readable OpenAPI spec (JSON/YAML) for all ~25 endpoints across the 9 controllers, generated straight from the actual method signatures and DTOs — so the request/response *shape* (param names, types, required-vs-optional, response field types) stays automatically correct as the code changes, unlike `API.md`, which only stays correct if a PR remembers to update it.

This spec covers the dependency and its minimal metadata only. It deliberately does **not** cover writing `@Operation`/`@Parameter` descriptions that explain what each parameter *means* (e.g. what values `sourceMode` accepts) — that's `series_spec_067`, a separate, larger, independently-shippable pass that depends on this one landing first.

## Design Decisions

- **Artifact: `org.springdoc:springdoc-openapi-starter-webmvc-ui:3.1.1`.** This app uses `spring-boot-starter-web` (Spring MVC, not WebFlux — confirmed in `build.gradle.kts`), so the `-webmvc-ui` starter is the correct one (not `-webflux-ui`). Version `3.1.1` is springdoc's current major line and its own release notes explicitly state support for "Spring-boot v4 (Java 17 & Jakarta EE 9)" — this app runs Spring Boot 4.1.1 on a Java 25 toolchain, both covered.
- **No configuration is required for the dependency itself to work.** Per springdoc's own documentation: *"For the integration between spring-boot and swagger-ui, add the library to the list of your project dependencies (No additional configuration is needed)."* Adding the dependency alone makes `/swagger-ui.html` (interactive UI), `/v3/api-docs` (JSON spec), and `/v3/api-docs.yaml` (YAML spec) available immediately.
- **No Spring Security exists in this project** (`grep -i security backend/build.gradle.kts` returns nothing) — there is nothing to unlock or permit for the new endpoints to be reachable; they work the same as every other endpoint today, with no auth gate.
- **`CorsConfig.java` is deliberately not touched.** Its allow-list (`WebMvcConfigurer.addCorsMappings`, per `tech.md`'s CORS note) is scoped to `/api/**` only. `/swagger-ui.html`/`/v3/api-docs` are opened directly in a browser at `localhost:8080` (same-origin), never fetched cross-origin from the Vite dev server — so this spec has zero CORS surface to add. Called out explicitly so a future reader doesn't wonder why `CorsConfig` wasn't part of this change.
- **A title, description, and dynamically-bound version on the `OpenAPI` metadata bean.** A bare title ("TV Series Tracker API") and a one-line description (paraphrased from `README.md`'s own opening line: *"A personal app for logging TV series you're watching, tracking your viewing progress, and storing ratings from multiple sources (IMDb, TMDB, Rotten Tomatoes)."*) is enough to make the Swagger UI's landing page read as intentional rather than a bare default.
  **Revised (2026-09-25)**: this spec originally deferred dynamic version binding as out of scope ("the app is already versioned elsewhere for anyone who needs it"). Reversed after discussion — that reasoning undersells the point of this spec, which is a doc surface that stays automatically correct as the code changes (this Overview's own words); a version field that's either missing (springdoc's default, since the original plan never called `.version(...)` at all) or hand-maintained separately would undercut that in the one place a consumer is actually looking. `springBoot { buildInfo() }` (Spring Boot Gradle plugin DSL, already available — `org.springframework.boot` is already a plugin in this build) generates `META-INF/build-info.properties` at build time; Spring Boot's own `ProjectInfoAutoConfiguration` then auto-wires a `BuildProperties` bean from it with zero extra config. `OpenApiConfig` injects that bean and calls `.version(buildProperties.getVersion())`, so the Swagger-displayed version always matches whatever `version` is set in `build.gradle.kts` at build time — the same field this project already bumps at every release (`CHANGELOG.md`'s own versioning convention). See Requirement 3, below.
- **New file, not an addition to an existing one**: `config/OpenApiConfig.java`, matching this package's established one-bean-per-file convention (`ClockConfig.java`, `CorsConfig.java` are each their own file).
- **Docs currency, not a formal AC of its own**: once implemented, whoever picks this up should update `tech.md`'s "API Documentation" section (it currently states springdoc is *not* wired up — that becomes false) and add a one-line mention to `RUNBOOK.md` of where to find the new Swagger UI during local dev (`http://localhost:8080/swagger-ui.html`), per this project's Definition of Done rule that `RUNBOOK.md` needs updating whenever how the project is run/verified changes. Not written as its own AC since it's project-documentation hygiene, not a testable behavior — but don't skip it when implementing.

---

## Requirement 1: springdoc-openapi is on the classpath and its default endpoints work

**User story**: As a developer working on this backend, I want a live Swagger UI and a machine-readable OpenAPI spec available locally, so I can explore and try out every endpoint without hand-writing curl commands or trusting `API.md` to be current.

### SERIES-066-AC-01 [AUTO]
**Statement**: `backend/build.gradle.kts` shall declare `implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.1.1")`; when the application is running, `GET /v3/api-docs` shall return `200 OK` with a JSON body describing every controller's endpoints.

**References**: `backend/build.gradle.kts` (`dependencies` block, alongside the existing `spring-boot-starter-web` line). `backend/src/main/java/uk/co/stefirby/seriestracker/controller/` (9 controllers whose endpoints must appear in the generated spec).

**Test Case (Red)**:
```groovy
package uk.co.stefirby.seriestracker.config

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpenApiConfigSpec extends Specification {

  @Autowired
  MockMvc mockMvc

  def "SERIES-066-AC-01: /v3/api-docs returns 200 with the generated OpenAPI spec"() {
    when: "the generated OpenAPI JSON spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the response is successful and describes a known endpoint path"
        result.andExpect(status().isOk())
        result.andExpect(content().contentTypeCompatibleWith("application/json"))
        result.andExpect(MockMvcResultMatchers.jsonPath('$.paths./api/v1/series').exists())
  }
}
```
**Test Case (Green)**: add the dependency; no further code is needed for this AC — springdoc auto-configures itself from the classpath alone.

---

### SERIES-066-AC-02 [AUTO]
**Statement**: `GET /swagger-ui.html` shall return `200 OK` and serve the interactive Swagger UI.

**References**: Same dependency as `SERIES-066-AC-01` — this endpoint is auto-registered by the same starter.

**Test Case (Red)**:
```groovy
def "SERIES-066-AC-02: /swagger-ui.html returns 200"() {
    when: "the Swagger UI page is requested"
        def result = mockMvc.perform(get("/swagger-ui.html"))

    then: "the response redirects to or serves the UI successfully"
        result.andExpect(status().is3xxRedirection().or(status().isOk()))
}
```
**Test Case (Green)**: covered by the same dependency addition as AC-01 — springdoc's default `/swagger-ui.html` redirects to `/swagger-ui/index.html`, so this test should assert whichever of a 200 or a 3xx redirect springdoc actually returns (confirm the exact status during implementation and adjust the assertion — don't guess it in the spec).

---

## Requirement 2: the generated docs carry app-identifying metadata, not a bare default

**User story**: As a developer opening the Swagger UI for the first time, I want it to clearly identify this app, not show springdoc's generic default title.

### SERIES-066-AC-03 [AUTO]
**Statement**: A new `config/OpenApiConfig.java` shall declare an `OpenAPI` `@Bean` setting the spec's title to `"TV Series Tracker API"` and a one-line description paraphrased from `README.md`'s opening line; `GET /v3/api-docs` shall reflect both values.

**References**: New file `backend/src/main/java/uk/co/stefirby/seriestracker/config/OpenApiConfig.java`, matching `ClockConfig.java`/`CorsConfig.java`'s one-bean-per-file convention in the same package. Source text: `README.md` line 3 ("A personal app for logging TV series you're watching, tracking your viewing progress, and storing ratings from multiple sources (IMDb, TMDB, Rotten Tomatoes).").

**Test Case (Red)**:
```groovy
def "SERIES-066-AC-03: the OpenAPI spec carries the app's title and description"() {
    when: "the generated OpenAPI JSON spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the info block carries the configured title and a non-empty description"
        result.andExpect(status().isOk())
        result.andExpect(MockMvcResultMatchers.jsonPath('$.info.title')
          .value("TV Series Tracker API"))
        result.andExpect(MockMvcResultMatchers.jsonPath('$.info.description').isNotEmpty())
}
```
**Test Case (Green)**: implement `OpenApiConfig` per the Statement above — a single `@Bean public OpenAPI customOpenAPI() { return new OpenAPI().info(new Info().title(...).description(...)); }`-shaped method.

---

## Requirement 3: the generated docs carry the app's real build version, kept current automatically

**User story**: As a developer looking at the Swagger UI, I want it to show the actual running app
version, so I don't have to cross-check `CHANGELOG.md` to know whether I'm looking at docs for the
version I think I'm running.

### SERIES-066-AC-04 [AUTO]
**Statement**: `backend/build.gradle.kts` shall enable `springBoot { buildInfo() }`; `OpenApiConfig`
shall inject the auto-configured `BuildProperties` bean and set the `OpenAPI` `Info`'s `version` to
`buildProperties.getVersion()`; `GET /v3/api-docs`'s `$.info.version` shall equal the project's
current `version` (`build.gradle.kts`), not springdoc's default.

**References**: `backend/build.gradle.kts` (new `springBoot { buildInfo() }` block, placed near the
existing `plugins`/`group`/`version` declarations); `config/OpenApiConfig.java` (constructor-injects
`org.springframework.boot.info.BuildProperties`); Spring Boot's `ProjectInfoAutoConfiguration`
(already on the classpath via `spring-boot-starter`, auto-configures the `BuildProperties` bean from
`META-INF/build-info.properties` with no further config once that file exists).

**Test Case (Red)**:
```groovy
def "SERIES-066-AC-04: the OpenAPI spec carries the real build version"() {
    when: "the generated OpenAPI JSON spec is requested"
        def result = mockMvc.perform(get("/v3/api-docs"))

    then: "the info block's version matches the project's actual version, not a default/placeholder"
        result.andExpect(status().isOk())
        result.andExpect(MockMvcResultMatchers.jsonPath('$.info.version').isNotEmpty())
        // exact value assertion left to implementation -- inject BuildProperties into the spec
        // itself (or read backend/build.gradle.kts's `version` at test time) rather than
        // hardcoding today's version string into this test, which would go stale at the next bump
}
```
**Test Case (Green)**: add `springBoot { buildInfo() }` to `build.gradle.kts`; add a
`BuildProperties buildProperties` constructor param to `OpenApiConfig`; call
`.version(buildProperties.getVersion())` on the `Info` bean alongside the existing
`title(...)`/`description(...)` calls. Confirm locally that a Gradle build actually produces
`META-INF/build-info.properties` (a full build is required — an IDE incremental compile alone may
not run the `bootBuildInfo` task) before trusting the test green.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| The gap this spec closes, stated verbatim | `.claude/steering/tech.md`'s "API Documentation" section |
| `config/` package's one-bean-per-file convention (`ClockConfig`, `CorsConfig`) this spec's `OpenApiConfig` follows | `.claude/steering/structure.md` |
| `CorsConfig`'s `/api/**`-scoped allow-list this spec explicitly does not touch | `uk.co.stefirby.seriestracker.config.CorsConfig` |
| App description this spec's OpenAPI title/description paraphrases | `README.md` |
| `BuildProperties`/`springBoot { buildInfo() }` — Spring Boot Gradle plugin DSL, autoconfigured by `ProjectInfoAutoConfiguration` | [Spring Boot Gradle plugin docs](https://docs.spring.io/spring-boot/gradle-plugin/integrating-with-actuator.html#integrating-with-actuator.build-info) |
| Depended on by | `series_spec_067_openapi_annotation_pass.md` (needs this dependency present before annotations have any effect) |

---

## Acceptance Criteria Summary

- [x] SERIES-066-AC-01: `springdoc-openapi-starter-webmvc-ui:3.1.1` added; `/v3/api-docs` returns the generated spec
- [x] SERIES-066-AC-02: `/swagger-ui.html` serves the interactive UI
- [x] SERIES-066-AC-03: the generated spec carries this app's title and a real description, not springdoc's default
- [x] SERIES-066-AC-04: `buildInfo()` enabled; the generated spec's version is bound to the real build version via `BuildProperties`, not a default
