# Series Spec 066: OpenAPI/Swagger Dependency (springdoc-openapi)

**Status**: Not started
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
- **One small, static `OpenAPI` metadata bean, not a full `buildInfo()` wiring.** A bare title ("TV Series Tracker API") and a one-line description (paraphrased from `README.md`'s own opening line: *"A personal app for logging TV series you're watching, tracking your viewing progress, and storing ratings from multiple sources (IMDb, TMDB, Rotten Tomatoes)."*) is enough to make the Swagger UI's landing page read as intentional rather than a bare default. Deliberately **no** dynamic version binding (e.g. via Spring Boot's `springBoot { buildInfo() }` Gradle task) — that's an unrelated piece of build tooling this spec has no reason to introduce, and the app is already versioned elsewhere (`CHANGELOG.md`, both `build.gradle.kts`/`package.json` `version` fields) for anyone who needs it.
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

## Cross-References

| This spec | Source |
|-----------|--------|
| The gap this spec closes, stated verbatim | `.claude/steering/tech.md`'s "API Documentation" section |
| `config/` package's one-bean-per-file convention (`ClockConfig`, `CorsConfig`) this spec's `OpenApiConfig` follows | `.claude/steering/structure.md` |
| `CorsConfig`'s `/api/**`-scoped allow-list this spec explicitly does not touch | `uk.co.stefirby.seriestracker.config.CorsConfig` |
| App description this spec's OpenAPI title/description paraphrases | `README.md` |
| Depended on by | `series_spec_067_openapi_annotation_pass.md` (needs this dependency present before annotations have any effect) |

---

## Acceptance Criteria Summary

- [ ] SERIES-066-AC-01: `springdoc-openapi-starter-webmvc-ui:3.1.1` added; `/v3/api-docs` returns the generated spec
- [ ] SERIES-066-AC-02: `/swagger-ui.html` serves the interactive UI
- [ ] SERIES-066-AC-03: the generated spec carries this app's title and a real description, not springdoc's default
