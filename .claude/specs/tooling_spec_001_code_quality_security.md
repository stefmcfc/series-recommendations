# Tooling Spec 001: Code Quality & Security Hardening

**Status**: ✅ Req 1-8 done (AC-01–AC-17)
**Priority**: P2 (repo hygiene — doesn't block product feature work)
**Depends on**: none
**Area**: Tooling (cross-cutting — backend, frontend, and CI)

---

## Overview

A set of code-quality and security follow-ups identified while comparing this repo's tooling against two sibling projects (`java-features`, `document-converter`). Unlike `series_spec_*`/`frontend_spec_*`, this isn't product feature work — it's build/CI/lint configuration. Each requirement below can be picked up independently; there's no need to implement this spec front-to-back in one pass.

---

## Requirements

### Requirement 1: Catch-All Exception Handler

**User story**: As a developer, I want every unexpected backend exception to return a safe, generic response, so that internals are never accidentally exposed.

`GlobalExceptionHandler` currently handles `EntityNotFoundException`, `IllegalArgumentException`, and `MethodArgumentNotValidException` explicitly. Anything else (a `NullPointerException`, a database error, anything unmapped) falls through to Spring Boot's default `/error` handling instead of this class — an implicit path whose behaviour depends on unset `server.error.*` properties, not a verified-safe one.

#### Acceptance Criteria

- **TOOLING-001-AC-01** `[AUTO]`: If an unhandled exception occurs during a request, then the `GlobalExceptionHandler` shall catch it via `@ExceptionHandler(Exception.class)` and return HTTP 500 with an `ApiResponse.error(...)` body containing a generic message (e.g. `"Internal server error"`), never the exception's own message or stack trace.
- **TOOLING-001-AC-02** `[AUTO]`: When the catch-all handler runs, the `GlobalExceptionHandler` shall log the full exception (message + stack trace) server-side before returning the generic response.

**Test Case (Red)**:
```groovy
def "TOOLING-001-AC-01: unhandled exception returns generic 500, no internals leaked"() {
    given: "a controller call that throws an unexpected RuntimeException"
        // mock a service to throw new RuntimeException("db connection string: ...")

    when: "the endpoint is invoked"
        def response = client.get().uri("/api/v1/series").exchange()

    then: "the response is 500 with a generic error body"
        response.expectStatus().is5xxServerError()

    and: "the real exception message is not present in the response body"
        !response.expectBody(String).returnResult().responseBody.contains("db connection string")
}
```

---

### Requirement 2: Backend Code Coverage Gate (JaCoCo)

**User story**: As a developer, I want a coverage floor enforced on the backend build, so that untested logic doesn't creep in silently.

Not currently in `build.gradle.kts`. This backend is fully implemented (unlike `java-features`, which explicitly deferred coverage until real logic existed) — a coverage gate is immediately meaningful here.

#### Acceptance Criteria

- **TOOLING-001-AC-03** `[AUTO]`: The `JaCoCo` Gradle plugin shall be added to `backend/build.gradle.kts` and wired into `gradlew check`.
- **TOOLING-001-AC-04** `[AUTO]`: `gradlew check` shall fail if backend line coverage drops below 80% (starting threshold — adjust once a real baseline is measured; classes with no meaningful logic, e.g. DTOs/exceptions, may be excluded via an explicit exclusion list rather than padded with vacuous tests).

---

### Requirement 3: Backend Static Analysis

**User story**: As a developer, I want common Java bug patterns caught automatically, so that issues surface before review.

#### Acceptance Criteria

- **TOOLING-001-AC-05** `[AUTO]`: A static-analysis tool (SpotBugs or Error Prone) shall be added to `backend/build.gradle.kts` and run as part of `gradlew check`.
- **TOOLING-001-AC-06** `[AUTO]`: The CI backend job (`.github/workflows/ci.yml`) shall run this check and fail the job on new high-priority findings.

---

### Requirement 4: Frontend Formatting (Prettier)

**User story**: As a developer, I want consistent formatting enforced automatically, so that style isn't just "whatever the last edit left."

No formatter is currently installed — only ESLint, which doesn't own formatting well on its own.

#### Acceptance Criteria

- **TOOLING-001-AC-07** `[AUTO]`: `prettier` and `eslint-config-prettier` shall be added to `frontend/package.json`, with `eslint-config-prettier` disabling ESLint's formatting-related rules so the two tools don't conflict.
- **TOOLING-001-AC-08** `[AUTO]`: `frontend/package.json` shall gain `format` (write) and `format:check` (CI-safe, non-mutating) scripts.
- **TOOLING-001-AC-09** `[AUTO]`: `.lintstagedrc.json`'s frontend entry shall run Prettier in addition to ESLint `--fix` on staged files.
- **TOOLING-001-AC-10** `[AUTO]`: The CI frontend job shall run `npm run format:check`.

---

### Requirement 5: Frontend Accessibility Linting

**User story**: As a developer, I want accessibility regressions caught by lint, not only by remembering to test for them.

`frontend_spec_002` already has explicit accessibility acceptance criteria (`role="status"`, `aria-label`, `role="alert"`). A lint plugin catches regressions automatically instead of relying on every future change remembering to preserve them.

#### Acceptance Criteria

- **TOOLING-001-AC-11** `[AUTO]`: `eslint-plugin-jsx-a11y` shall be added to `frontend/eslint.config.js` with its recommended ruleset, after confirming it supports this repo's ESLint 10 (document-converter skipped it for capping at ESLint 9 — check whether that's since been resolved).
- **TOOLING-001-AC-12** `[AUTO]`: CI's `npm run lint` shall fail on `jsx-a11y` violations.

---

### Requirement 6: Commit Message Enforcement

**User story**: As a developer, I want the Conventional Commits rule in `CLAUDE.md` mechanically enforced, so it doesn't rely on remembering.

Husky is already installed for `pre-commit`/`pre-push` (see git hooks setup). A `commit-msg` hook is a natural extension.

#### Acceptance Criteria

- **TOOLING-001-AC-13** `[AUTO]`: `commitlint` (with `@commitlint/config-conventional`) shall be added as a root devDependency, configured via `commitlint.config.js`.
- **TOOLING-001-AC-14** `[AUTO]`: A `.husky/commit-msg` hook shall run `commitlint --edit "$1"` and reject non-conforming commit messages.

---

### Requirement 7: Editor Consistency

**User story**: As a developer, I want consistent line endings/indentation across the Java/Groovy and TypeScript files, regardless of editor.

#### Acceptance Criteria

- **TOOLING-001-AC-15** `[MANUAL]`: An `.editorconfig` shall exist at the repo root specifying indentation, line-ending, and final-newline rules for `.java`, `.groovy`, `.ts`, `.tsx` files. Verified by inspection (checking a file saved in each language respects it) — no CI check exists yet; consider `editorconfig-checker` in CI if drift becomes a real problem.

---

### Requirement 8: CORS Configuration

**User story**: As a developer, I want CORS configured so the frontend can call the backend directly in a real browser, so requests aren't silently blocked or, worse, permissively allowed from anywhere.

Originally deferred as "not urgent" because the Vite dev proxy covered local work. A real-browser verification pass (done while implementing `frontend_spec_003_add_series_form.md`) confirmed this was a real, currently-blocking gap: loading the frontend dev server in an actual browser and letting it call the backend directly failed with `No 'Access-Control-Allow-Origin' header is present` (confirmed both with and without VPN — not network-related). This is now implemented and verified.

Implementation: `uk.co.stefirby.seriestracker.config.CorsConfig`, a `WebMvcConfigurer` bean (chosen over a standalone `CorsConfigurationSource` bean because this app has no Spring Security on the classpath — `WebMvcConfigurer.addCorsMappings` is the simpler, current, fully-supported mechanism for plain Spring MVC). Scoped to `/api/**`, allows `GET`/`POST`/`PATCH`/`DELETE` and the `Content-Type` header, no `allowCredentials` (no auth/cookies in this app). The allowed origin(s) are read from `app.cors.allowed-origins` in `application.yml` (default `http://localhost:5173,http://127.0.0.1:5173`), overridable via `APP_CORS_ALLOWED_ORIGINS` — never a wildcard `*`.

**Update (2026-09-04)**: `http://127.0.0.1:5173` added to the default allow-list alongside the original `http://localhost:5173`. This was a real, live bug, not a preemptive addition: `vite.config.ts` pins `server.host` to `127.0.0.1` (VPN/IPv6 compatibility, see `RUNBOOK.md`'s "Frontend dev server unreachable while on a VPN"), so a browser accessing the dev server at its own documented URL sends `Origin: http://127.0.0.1:5173` on every non-`GET` request — which the allow-list didn't recognize, silently rejecting every real save/refresh/delete from the actual browser with `403 "Invalid CORS request"` while `GET`s (and any `curl` reproduction, which omits `Origin` entirely) worked fine, masking the gap. AC-16's own statement is unaffected — it was and remains origin-list-driven, never a wildcard; only the configured list's contents changed. `CorsConfigSpec` gained a regression-guard test case for this origin.

#### Acceptance Criteria

- **TOOLING-001-AC-16** `[AUTO]`: When a request to `/api/**` includes an `Origin` header matching a configured entry in `app.cors.allowed-origins`, then the backend shall respond with an `Access-Control-Allow-Origin` header echoing that origin (restricted to the configured allow-list — never a wildcard `*`), and when the `Origin` header does not match any configured entry, then the backend shall respond without an `Access-Control-Allow-Origin` header. Automated via a `MockMvc` Spock test (`CorsConfigSpec`) — no longer `[MANUAL]`: the previous deferral reasoning ("no deployment target to test against") no longer applies, since the test targets the known local dev origin (`http://localhost:5173`) that `application.yml` already defaults to.
- **TOOLING-001-AC-17** `[AUTO]`: When a cross-origin request to `/api/**` receives a response containing a `Content-Disposition` header (currently only `GET /api/v1/series/export`), then the backend shall configure CORS to expose that header to browser JavaScript (`Access-Control-Expose-Headers: Content-Disposition`), so a real cross-origin `axios` call can read it — not just a same-origin tool like `curl`, which isn't subject to CORS' header-visibility restriction at all and so can't validate this. Discovered via a real-browser pass verifying `frontend_spec_007_export_trigger.md`: `curl` showed the header present and correctly formatted, but the actual browser download used `ExportControls`' fallback filename (`series-export.json`, no timestamp) instead of the server-computed one, because `CorsConfig` never called `.exposedHeaders(...)` — the header reached the browser's network layer but was invisible to `response.headers['content-disposition']` in JS. `MockMvc` (used by `CorsConfigSpec` for AC-16) doesn't enforce this restriction either, so a controller-level Spock test alone wouldn't have caught it — this needed the real browser.

**Test Case (Red)**:
```groovy
def "TOOLING-001-AC-16: allowed origin receives Access-Control-Allow-Origin header"() {
    given: "a request to an /api/** endpoint from the configured frontend dev origin"
        def allowedOrigin = "http://localhost:5173"

    when: "the request is made with an Origin header matching the configured allow-list"
        def result = mockMvc.perform(get("/api/v1/series").header(HttpHeaders.ORIGIN, allowedOrigin))

    then: "the response echoes back the allowed origin"
        result.andExpect(status().isOk())
        result.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, allowedOrigin))
}

def "TOOLING-001-AC-16: disallowed origin does not receive a CORS allow header"() {
    given: "a request to an /api/** endpoint from an origin not on the allow-list"
        def disallowedOrigin = "http://evil.example.com"

    when: "the request is made with a non-configured Origin header"
        def result = mockMvc.perform(get("/api/v1/series").header(HttpHeaders.ORIGIN, disallowedOrigin))

    then: "no Access-Control-Allow-Origin header is present, proving the config is not permissive/wildcard"
        result.andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN))
}
```

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `GlobalExceptionHandler.java` | `backend/src/main/java/uk/co/stefirby/seriestracker/exception/` |
| `.lintstagedrc.json`, `.husky/` | Git hooks setup (this session) |
| `.github/workflows/ci.yml` | CI workflow (this session) |
| `CorsConfig.java` | `backend/src/main/java/uk/co/stefirby/seriestracker/config/` — see `.claude/steering/tech.md` "Notes" section |
| Accessibility ACs | `.claude/specs/frontend_spec_002.md`, Requirement 8 |

---

## Acceptance Criteria Summary

- [x] TOOLING-001-AC-01: Unhandled exceptions return generic 500, no leaked internals
- [x] TOOLING-001-AC-02: Unhandled exceptions logged server-side
- [x] TOOLING-001-AC-03: JaCoCo added, wired into `gradlew check`
- [x] TOOLING-001-AC-04: `gradlew check` fails below 80% backend line coverage
- [x] TOOLING-001-AC-05: Static analysis tool added, runs in `gradlew check`
- [x] TOOLING-001-AC-06: SpotBugs configured to fail on high-priority findings only (`reportLevel = HIGH`); CI backend job now runs `gradle check`
- [x] TOOLING-001-AC-07: Prettier + eslint-config-prettier added
- [x] TOOLING-001-AC-08: `format`/`format:check` npm scripts added
- [x] TOOLING-001-AC-09: lint-staged runs Prettier + ESLint on staged frontend files
- [x] TOOLING-001-AC-10: CI frontend job runs `npm run format:check`
- [x] TOOLING-001-AC-11: `eslint-plugin-jsx-a11y` added with recommended ruleset (`jsxA11y.flatConfigs.recommended` in `frontend/eslint.config.js`, before `eslintConfigPrettier`). Installed via `npm install --legacy-peer-deps`: latest published version (6.10.2, Oct 2024) declares `peerDependencies.eslint: "^3 || ... || ^9"` and doesn't yet support ESLint 10 (same cap `document-converter` hit, unresolved upstream as of 2026-08-16); verified `npm run lint`/`format:check`/`test` all still pass after the install.
- [x] TOOLING-001-AC-12: CI lint (`npm run lint`) now includes jsx-a11y's recommended ruleset; no `.tsx` components exist yet to violate it, but the gate is live for when `SeriesList` etc. land
- [x] TOOLING-001-AC-13: commitlint + conventional config added
- [x] TOOLING-001-AC-14: `.husky/commit-msg` hook enforces it
- [x] TOOLING-001-AC-15: `.editorconfig` added at repo root
- [x] TOOLING-001-AC-16: CORS configured via `CorsConfig` (`WebMvcConfigurer`) on `/api/**`, allow-list from `app.cors.allowed-origins` (default `http://localhost:5173`, no wildcard); verified with `CorsConfigSpec` (MockMvc) and a real headless-browser pass against the frontend dev server
- [x] TOOLING-001-AC-17: `CorsConfig` exposes `Content-Disposition` via `Access-Control-Expose-Headers` (`.exposedHeaders("Content-Disposition")` added to the `CorsRegistry` mapping) so cross-origin `axios` calls can read it (not just same-origin tools like `curl`); verified with a new `CorsConfigSpec` case asserting `Access-Control-Expose-Headers: Content-Disposition` on a cross-origin request to `/api/v1/series/export`
