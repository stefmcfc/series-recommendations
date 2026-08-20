# Spec 005: OMDb Lookup & Poster Field

**Status**: ✅ Implemented — `posterUrl` added via `backend/src/main/resources/db/migration/V002__add_poster_url_to_series.sql`, `model/SeriesEntity.java`, `dto/SeriesDto.java`, `service/SeriesService.java`, and `service/SeriesExportService.java`. OMDb config in `application.yml` (`app.omdb.api-key`/`base-url`, `spring.http.clients.connect-timeout`/`read-timeout`). New `client/OmdbClient.java` (Spring `RestClient`) + `client/OmdbLookupResult.java`, `dto/SeriesLookupDto.java`, `service/SeriesLookupService.java`, `exception/ExternalServiceException.java`, and the `GET /api/v1/series/lookup` endpoint in `controller/SeriesController.java` with new `GlobalExceptionHandler` cases for `ExternalServiceException` (→502) and `MissingServletRequestParameterException` (→400). Tests: `client/OmdbClientSpec.groovy`, `client/OmdbClientTimeoutConfigSpec.groovy`, `service/SeriesLookupServiceSpec.groovy`, `controller/SeriesControllerLookupSpec.groovy`, plus additions to `controller/SeriesControllerSpec.groovy`, `exception/GlobalExceptionHandlerSpec.groovy`, `service/SeriesServiceSpec.groovy`, `service/SeriesExportServiceSpec.groovy`, and `model/SeriesEntitySpec.groovy`. Full suite green (`gradlew.bat test`) and `gradlew.bat check` (JaCoCo coverage gate + SpotBugs) passes; see the deviations noted below for two implementation details that diverged from this spec's original assumptions (the `spring-boot-restclient` dependency and the `spring.http.clients.*` timeout properties, and an added `MissingServletRequestParameterException` handler). **Superseded by `series_spec_017_tmdb_primary_lookup.md`**: OMDb is no longer the primary lookup source — `OmdbClient`/`OmdbLookupResult` are narrowed to a single ratings-only enrichment call, and `GET /api/v1/series/lookup` is removed. Kept for historical/traceability reference; no AC here is renumbered or deleted.
**Priority**: P2 (quality-of-life for adding series — not core CRUD)
**Depends on**: Spec 002 (CRUD)
**Backend Task**

## Overview

Adds a `posterUrl` field to `Series`, and a new `GET /api/v1/series/lookup` endpoint that queries the [OMDb API](https://www.omdbapi.com/) by title and returns a normalized set of fields (year, genres, season/episode counts, ratings, poster) the frontend can use to autofill the add-series form. OMDb's free tier (1,000 requests/day, registration required, no cost) conveniently aggregates ratings from IMDb, Rotten Tomatoes, and Metacritic in one response — a close match for this app's three separate rating fields.

**Design decisions**:
- **Store the poster as a URL, not a downloaded/hosted image.** OMDb's `Poster` field is already a stable, long-lived URL (Amazon-hosted). Downloading, storing, and serving the binary ourselves would add real scope (storage, MIME handling, cache invalidation) for no benefit at this app's scale — the frontend just renders it as `<img src>`. Revisit only if hot-linking to OMDb's poster CDN ever becomes unreliable.
- **`genres` needs no transformation.** OMDb's `Genre` field is already a comma-separated string (`"Drama, Action, Sci-Fi"`), which is exactly this app's existing storage format for `genres` (see `series_spec_001_entity.md`) — it can be copied through as-is.
- **`totalEpisodes` requires extra calls OMDb's basic title lookup doesn't provide directly.** OMDb's `t=`-based lookup returns `totalSeasons` but not a total episode count — that requires a separate `&Season=N` call per season (each returns that season's episode list) and summing the results. This is `O(totalSeasons)` additional HTTP calls per lookup; capped at a sane maximum (`OMDB_MAX_SEASONS_FOR_EPISODE_COUNT = 30`) so a data-quality anomaly in OMDb's `totalSeasons` value can't trigger an unbounded fan-out. If any season call fails or the cap is exceeded, `totalEpisodes` is simply omitted (null) from the result rather than failing the whole lookup — a partial autofill is still useful; failing outright over one missing number is not.
- **New `ExternalServiceException` (→ 502), distinct from the existing `EntityNotFoundException` (→ 404).** "OMDb has no result for this title" is a normal, expected outcome (404 — nothing to find). "OMDb is unreachable, timed out, or returned something we can't parse" is a different failure mode with different semantics (502 Bad Gateway — the upstream dependency is the problem, not the request). Reusing `EntityNotFoundException` for both would blur that distinction and give the frontend the wrong signal (a 404 invites "try a different title"; a 502 invites "try again shortly").
- **The OMDb API key is server-side only**, read from `app.omdb.api-key` (env var override `APP_OMDB_API_KEY`), following the exact pattern `CorsConfig`/`app.cors.allowed-origins` already established. It is never included in any response body and never logged (mirrors `TOOLING-001` Requirement 1's "never leak internals" principle).
- **Field mappings below are based on OMDb's documented, stable public API shape** (not verified against a live call while writing this spec, since that requires a registered API key). `backend-dev` should verify the exact response shape against the real API early during implementation and adjust parsing if OMDb's actual response differs from what's documented here — flag any discrepancy rather than silently guessing.

---

## Requirements

### Requirement 1: `posterUrl` Field

**User story**: As a user, I want to see a poster image for each series, so that my collection is visually recognizable, not just a list of titles.

#### Acceptance Criteria

- **SERIES-005-AC-01** [AUTO]: `SeriesEntity` shall gain a nullable `posterUrl` column (`VARCHAR`, reasonable length — e.g. 1000 — to accommodate long CDN URLs), added via a new Flyway migration (`V002__add_poster_url_to_series.sql`).
- **SERIES-005-AC-02** [AUTO]: `SeriesDto` shall gain a `posterUrl` field (getter/setter), following the existing plain-getter/setter style (no Lombok, per this repo's convention).
- **SERIES-005-AC-03** [AUTO]: `POST /api/v1/series`, `GET /api/v1/series`, `GET /api/v1/series/{id}`, and `PATCH /api/v1/series/{id}` shall accept and return `posterUrl` like any other optional field, following the same null-if-unset semantics as `genres`/`personalNotes` (no format validation on the URL itself — same policy as those two).
- **SERIES-005-AC-04** [AUTO]: CSV/JSON export (`series_spec_004_export.md`) shall include `posterUrl` as an additional column/field, following the same null-handling rules already specified there.

---

### Requirement 2: OMDb Configuration

**User story**: As a developer, I want the OMDb API key and endpoint configurable without a code change, so that the key never has to be committed and the integration can point at a different base URL if needed (e.g. a test double).

#### Acceptance Criteria

- **SERIES-005-AC-05** [AUTO]: `application.yml` shall gain `app.omdb.api-key` (no default — must be supplied via the `APP_OMDB_API_KEY` env var; see Requirement 5 for behavior when unset) and `app.omdb.base-url` (default `https://www.omdbapi.com/`, overridable via `APP_OMDB_BASE_URL`), read via constructor-injected `@Value` exactly like `CorsConfig.allowedOrigins`.
- **SERIES-005-AC-06** [AUTO]: The OMDb API key shall never appear in any HTTP response body, and shall never be logged (including in `DEBUG`-level request logging, if any is added later).

---

### Requirement 3: `OmdbClient` — External API Integration

**User story**: As a developer, I want OMDb's raw response shape isolated behind a dedicated client, so that the rest of the app deals in this app's own DTOs, not a third party's field-naming quirks.

#### Acceptance Criteria

- **SERIES-005-AC-07** [AUTO]: An `OmdbClient` component (`config`/`client` package — new) shall use Spring's `RestClient` (the current, Spring-6.1+-idiomatic synchronous HTTP client already available transitively via `spring-boot-starter-web`; not `RestTemplate`, which is in maintenance mode) to call `GET {base-url}/?apikey={key}&type=series&t={title}`.
- **SERIES-005-AC-08** [AUTO]: `OmdbClient` shall configure a bounded connect and read timeout (e.g. 5s connect / 10s read) so a slow or hanging OMDb response can't hang the request thread indefinitely.
- **SERIES-005-AC-09** [AUTO]: When OMDb's response has `"Response": "False"`, `OmdbClient` shall surface this as a not-found outcome (see Requirement 5, AC-16).
- **SERIES-005-AC-10** [AUTO]: `OmdbClient` shall map OMDb's response fields onto an internal `OmdbLookupResult` per the field-mapping table below, treating the literal string `"N/A"` as absent (`null`) for every field, not as literal text.

**Field mapping** (OMDb raw → `OmdbLookupResult`):

| OMDb field | Example raw value | Mapped field | Parsing notes |
|---|---|---|---|
| `Title` | `"Breaking Bad"` | `title` | passthrough |
| `Year` | `"2008–2013"` or `"2019–"` | `year` | extract the first 4-digit number (handles both a closed range and an ongoing series' open-ended range) |
| `Genre` | `"Crime, Drama, Thriller"` | `genres` | passthrough (see design decision above) |
| `totalSeasons` | `"5"` | `totalSeasons` | parse to `Integer`; `null` if `"N/A"` |
| *(computed — see Requirement 4)* | — | `totalEpisodes` | sum of per-season episode counts, capped/best-effort per the design decision above |
| `imdbRating` | `"9.5"` | `imdbRating` | parse to `BigDecimal`; `null` if `"N/A"` |
| `Ratings[]` where `Source == "Metacritic"` | `{"Source":"Metacritic","Value":"87/100"}` | `metacriticRating` | parse the integer before `/`; `null` if the source is absent from the array (OMDb doesn't guarantee all three sources are present) |
| `Ratings[]` where `Source == "Rotten Tomatoes"` | `{"Source":"Rotten Tomatoes","Value":"96%"}` | `rottenTomatoesRating` | parse the integer before `%`; `null` if absent |
| `Poster` | `"https://m.media-amazon.com/..."` or `"N/A"` | `posterUrl` | passthrough; `null` if `"N/A"` |

---

### Requirement 4: Episode Count Aggregation

**User story**: As a user, I want the total episode count filled in too, not just seasons, so the autofill is actually useful for the fields I'd otherwise have to look up myself.

#### Acceptance Criteria

- **SERIES-005-AC-11** [AUTO]: When `totalSeasons` is present and `<= 30` (`OMDB_MAX_SEASONS_FOR_EPISODE_COUNT`), `OmdbClient` shall call `GET {base-url}/?apikey={key}&t={title}&Season={n}` for each `n` from 1 to `totalSeasons`, summing the length of each response's `Episodes` array into `totalEpisodes`.
- **SERIES-005-AC-12** [AUTO]: If `totalSeasons` is absent, `> 30`, or any individual season call fails (non-200, timeout, unparseable body), `totalEpisodes` shall be `null` in the result — the lookup as a whole shall still succeed with whatever other fields were resolved (this AC's failure does not raise `ExternalServiceException`).

---

### Requirement 5: `GET /api/v1/series/lookup` Endpoint

**User story**: As a user, I want to type a series title and get back the fields I'd otherwise fill in by hand, so that adding a series I already know is fast.

#### Acceptance Criteria

- **SERIES-005-AC-13** [AUTO]: `SeriesController` shall expose `GET /api/v1/series/lookup?title={title}` (required query param), delegating to a new `SeriesLookupService.lookup(String title)`.
- **SERIES-005-AC-14** [AUTO]: On success, the endpoint shall return `200 OK` with `ApiResponse<SeriesLookupDto>` (mirroring the `{ "data": {...} }` envelope every other single-entity endpoint uses).
- **SERIES-005-AC-15** [AUTO]: `SeriesLookupDto` shall contain `title`, `year`, `genres`, `totalSeasons`, `totalEpisodes`, `imdbRating`, `metacriticRating`, `rottenTomatoesRating`, `posterUrl` — the same shape `OmdbLookupResult` produces, exposed as its own DTO (not `SeriesDto` itself) since a lookup result is not a persisted series and has no `id`/`dateAdded`/`status`/etc.
- **SERIES-005-AC-16** [AUTO]: If OMDb reports no match (`"Response": "False"`), `SeriesLookupService` shall throw `EntityNotFoundException` with a message identifying the searched title (e.g. `"No OMDb results for title: {title}"`), which `GlobalExceptionHandler` already maps to `404`.
- **SERIES-005-AC-17** [AUTO]: If the OMDb call fails for any other reason (network error, timeout, unexpected non-200, unparseable body) or `app.omdb.api-key` is unset, `SeriesLookupService` shall throw a new `ExternalServiceException`, mapped by a new `GlobalExceptionHandler` case to `502 Bad Gateway` with a generic message (e.g. `"Unable to reach the series lookup service. Please try again."`) — never the underlying exception's message or stack trace, consistent with `TOOLING-001-AC-01`'s "never leak internals" policy.
- **SERIES-005-AC-18** [AUTO]: A blank or missing `title` query param shall return `400 Bad Request` (standard Spring `@RequestParam` required-param validation, no custom handling needed).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `posterUrl` on `SeriesEntity`/`SeriesDto`, CRUD contract it extends | `series_spec_001_entity.md`, `series_spec_002_crud.md` |
| `genres` comma-separated string convention | `series_spec_001_entity.md` |
| Export format extension | `series_spec_004_export.md` |
| `ApiResponse<T>` envelope, `EntityNotFoundException` → 404, catch-all → 500 pattern | `series_spec_002_crud.md`, `GlobalExceptionHandler.java` |
| `app.*`/`APP_*`-prefixed config + env var override pattern | `CorsConfig.java`, `tooling_spec_001_code_quality_security.md` Requirement 8 |
| Frontend consumer of this endpoint | `frontend_spec_009_omdb_autofill.md` |

---

## TDD Test Case Sketches

### `OmdbClientSpec.groovy`

```groovy
def "SERIES-005-AC-10: maps a full OMDb response, including all three rating sources"() {
    given: "a mocked OMDb response with Title, Year range, Genre, totalSeasons, and all three Ratings sources"
        // stub RestClient (e.g. MockRestServiceServer or a wrapped test double) to return
        // { "Response": "True", "Title": "Breaking Bad", "Year": "2008–2013", "Genre": "Crime, Drama, Thriller",
        //   "totalSeasons": "5", "imdbRating": "9.5",
        //   "Ratings": [ {"Source":"Internet Movie Database","Value":"9.5/10"},
        //                {"Source":"Rotten Tomatoes","Value":"96%"},
        //                {"Source":"Metacritic","Value":"87/100"} ],
        //   "Poster": "https://example.com/poster.jpg" }

    when: "OmdbClient.lookup('Breaking Bad') is called"
        def result = omdbClient.lookup("Breaking Bad")

    then: "every field is mapped and parsed correctly"
        result.title == "Breaking Bad"
        result.year == 2008
        result.genres == "Crime, Drama, Thriller"
        result.totalSeasons == 5
        result.imdbRating == 9.5
        result.rottenTomatoesRating == 96
        result.metacriticRating == 87
        result.posterUrl == "https://example.com/poster.jpg"
}

def "SERIES-005-AC-10: treats N/A as null for every field"() {
    given: "an OMDb response where imdbRating, totalSeasons, and Poster are all the literal string N/A"
        // ...

    when: "OmdbClient.lookup(...) is called"
        def result = omdbClient.lookup("Obscure Show")

    then: "N/A fields map to null, not the literal string"
        result.imdbRating == null
        result.totalSeasons == null
        result.posterUrl == null
}

def "SERIES-005-AC-09: Response=False raises a not-found outcome"() {
    given: "an OMDb response of { \"Response\": \"False\", \"Error\": \"Series not found!\" }"
        // ...

    when: "OmdbClient.lookup('Nonexistent Show 12345') is called"
        omdbClient.lookup("Nonexistent Show 12345")

    then: "a not-found signal is raised"
        thrown(EntityNotFoundException)
}

def "SERIES-005-AC-11/12: aggregates episode counts across seasons, tolerating one failed season"() {
    given: "totalSeasons=3, with Season=1 and Season=3 succeeding (4 and 6 episodes) and Season=2 failing"
        // ...

    when: "OmdbClient.lookup(...) is called"
        def result = omdbClient.lookup("Some Show")

    then: "totalEpisodes is null because not every season could be summed, but the rest of the result is intact"
        result.totalEpisodes == null
        result.title != null
}
```

### `SeriesLookupServiceSpec.groovy` / `SeriesControllerSpec.groovy` (lookup endpoint)

```groovy
def "SERIES-005-AC-14: successful lookup returns 200 with the envelope"() {
    given: "OmdbClient resolves a valid OmdbLookupResult for the requested title"
        // ...

    when: "GET /api/v1/series/lookup?title=Breaking+Bad is requested"
        def response = client.get().uri("/api/v1/series/lookup?title=Breaking Bad").exchange()

    then: "the response is 200 with the mapped fields under data"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("$.data.title").isEqualTo("Breaking Bad")
}

def "SERIES-005-AC-16: no OMDb match returns 404"() {
    given: "OmdbClient throws EntityNotFoundException for an unmatched title"
        // ...

    when: "GET /api/v1/series/lookup?title=Nonexistent is requested"
        def response = client.get().uri("/api/v1/series/lookup?title=Nonexistent").exchange()

    then: "the response is 404"
        response.expectStatus().isNotFound()
}

def "SERIES-005-AC-17: upstream failure returns 502 with a generic message"() {
    given: "OmdbClient throws ExternalServiceException (e.g. simulated timeout)"
        // ...

    when: "GET /api/v1/series/lookup?title=Anything is requested"
        def response = client.get().uri("/api/v1/series/lookup?title=Anything").exchange()

    then: "the response is 502 and does not leak the underlying exception message"
        response.expectStatus().value() == 502
        !response.expectBody(String).returnResult().responseBody.contains("Connection refused")
}

def "SERIES-005-AC-18: missing title returns 400"() {
    when: "GET /api/v1/series/lookup (no title param) is requested"
        def response = client.get().uri("/api/v1/series/lookup").exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()
}
```

---

## Implementation Notes (Deviations From Original Assumptions)

Three implementation details diverged from what this spec originally assumed, discovered during `backend-dev` implementation:

1. **`spring-boot-restclient` had to be added as an explicit dependency.** This spec's Requirement 3 assumed `RestClient` support (specifically the `RestClient.Builder` bean needed for constructor injection) was already available transitively via `spring-boot-starter-web`. In this repo's actual Spring Boot 4.1.0 dependency graph it is not — Boot 4 split `RestClient`'s autoconfiguration (including the `RestClient.Builder` bean) out of `spring-boot-starter-web` into its own module, mirroring how `spring-boot-flyway` was already split out of `spring-boot-starter-data-jpa` (see the existing comment in `build.gradle.kts`). Without it, `OmdbClient`'s constructor fails to autowire with `NoSuchBeanDefinitionException`. Added `implementation("org.springframework.boot:spring-boot-restclient")` to `backend/build.gradle.kts` (version managed by the existing Spring Boot BOM, consistent with how `spring-boot-flyway` is already declared).
2. **Bounded connect/read timeouts (AC-08) are configured via `spring.http.clients.connect-timeout`/`read-timeout` in `application.yml`, not an in-code `RestClient.Builder#requestFactory(...)` call inside `OmdbClient`.** The spec's mandated test pattern is `MockRestServiceServer.bindTo(RestClient.Builder)` — this call mutates the builder's `requestFactory` property in place. Since `OmdbClient`'s constructor also needs to set a factory to configure timeouts, and both calls target the same builder property, whichever call happens last wins — and the test necessarily calls `bindTo(...)` *before* constructing `OmdbClient` (since `OmdbClient` is what's under test). An in-code `.requestFactory(...)` call inside `OmdbClient`'s constructor would therefore silently overwrite the mock server's factory and break every `OmdbClientSpec` test (confirmed by hitting this directly during TDD). Configuring the timeout via Spring Boot's global `spring.http.clients.*` properties (applied to the auto-configured `RestClient.Builder` before it reaches application code) avoids the conflict entirely while still satisfying the "bounded, not infinite" intent of AC-08. Today OMDb is the only outbound HTTP client in this app, so the effective scope is identical to an OMDb-specific timeout; see the comment in `application.yml` and the Javadoc on `OmdbClient` for the full rationale.
3. **Added a `MissingServletRequestParameterException` → 400 handler to `GlobalExceptionHandler`**, which AC-18 described as unnecessary ("standard Spring `@RequestParam` required-param validation, no custom handling needed"). That's true for a controller with no other exception handling — but this app's `GlobalExceptionHandler` already has a catch-all `@ExceptionHandler(Exception.class)` (`TOOLING-001-AC-01`), which is matched by Spring's `ExceptionHandlerExceptionResolver` ahead of Spring MVC's built-in default 400 handling for a missing required parameter. Without an explicit, more-specific handler, a missing `title` query param was actually being turned into a `500` by the existing catch-all (confirmed via a failing `SeriesControllerLookupSpec` test before this handler was added), not the `400` AC-18 requires.

## Acceptance Criteria Summary

- [x] SERIES-005-AC-01: `posterUrl` column added via `V002` migration
- [x] SERIES-005-AC-02: `SeriesDto.posterUrl`
- [x] SERIES-005-AC-03: `posterUrl` flows through create/get/update like other optional fields
- [x] SERIES-005-AC-04: export includes `posterUrl`
- [x] SERIES-005-AC-05: `app.omdb.api-key`/`app.omdb.base-url` config
- [x] SERIES-005-AC-06: API key never in a response body or logs
- [x] SERIES-005-AC-07: `OmdbClient` uses `RestClient`
- [x] SERIES-005-AC-08: bounded connect/read timeouts (see Implementation Notes above for how this is configured)
- [x] SERIES-005-AC-09: `Response: False` → not-found outcome
- [x] SERIES-005-AC-10: full field mapping, `N/A` → `null`
- [x] SERIES-005-AC-11: per-season episode aggregation up to 30 seasons
- [x] SERIES-005-AC-12: partial/failed aggregation degrades to `null`, doesn't fail the lookup
- [x] SERIES-005-AC-13: `GET /api/v1/series/lookup?title=` endpoint
- [x] SERIES-005-AC-14: 200 + `ApiResponse<SeriesLookupDto>` envelope on success
- [x] SERIES-005-AC-15: `SeriesLookupDto` shape
- [x] SERIES-005-AC-16: not-found → 404
- [x] SERIES-005-AC-17: upstream failure / missing key → 502, generic message
- [x] SERIES-005-AC-18: missing `title` param → 400 (see Implementation Notes above)
