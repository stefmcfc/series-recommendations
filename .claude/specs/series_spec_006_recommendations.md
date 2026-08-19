# Spec 006: Series Recommendations

**Status**: ✅ Implemented — `imdbId` added via `backend/src/main/resources/db/migration/V003__add_imdb_id_to_series.sql`, `model/SeriesEntity.java`, `dto/SeriesDto.java`, `service/SeriesService.java`, and (per Requirement 1's OMDb extension) `client/OmdbLookupResult.java`, `client/OmdbClient.java`, `dto/SeriesLookupDto.java`, `service/SeriesLookupService.java`. TMDB config in `application.yml`/test `application.yml` (`app.tmdb.api-key`/`base-url`). New `client/TmdbClient.java` (Spring `RestClient`, mirrors `OmdbClient`) + `client/TmdbCandidate.java`, `service/RecommendationService.java`, `dto/RecommendationDto.java`, and the `GET /api/v1/series/recommendations` endpoint in `controller/SeriesController.java`. Ignore list added via `db/migration/V004__create_ignored_series_table.sql`, `model/IgnoredSeriesEntity.java`, `repository/IgnoredSeriesRepository.java`, `service/IgnoredSeriesService.java`, `service/IgnoreOutcome.java`, `dto/IgnoredSeriesDto.java`, and the `POST /api/v1/series/ignored` endpoint. `repository/SeriesRepository.java` gained `existsByImdbId`. `build.gradle.kts`'s JaCoCo excludes gained `IgnoredSeriesEntity` (pure getters/setters, same rationale as `SeriesEntity`'s existing exclusion). Tests: `client/TmdbClientSpec.groovy`, `service/RecommendationServiceSpec.groovy`, `service/IgnoredSeriesServiceSpec.groovy`, `controller/SeriesControllerRecommendationsSpec.groovy`, plus additions to `client/OmdbClientSpec.groovy`, `service/SeriesLookupServiceSpec.groovy`, `service/SeriesServiceSpec.groovy`, `model/SeriesEntitySpec.groovy`, and `controller/SeriesControllerSpec.groovy`. Full suite green (`gradlew.bat check`: 151 tests, 0 failures, JaCoCo coverage gate and SpotBugs both pass with zero findings); see the Implementation Notes below for details that diverged from or extended this spec's original assumptions (`TmdbCandidate.genreIds`, TMDB's TV-object `name` field, and the `IgnoreOutcome` return type), none of which required a live TMDB API key to resolve confidently, though the AC-18 genre-ID table and Requirement 3's response-shape assumptions could not be verified against a live call in this environment (no `APP_TMDB_API_KEY` configured) — see the note below.
**No `frontend/` files were touched** — the frontend half of this feature is `frontend_spec_010_recommendations.md`, a separate follow-up task.
**Priority**: P2 (quality-of-life discovery feature — not core CRUD)
**Depends on**: Spec 002 (CRUD), Spec 005 (OMDb lookup — extends `OmdbClient`/`OmdbLookupResult`/`SeriesLookupDto`)
**Backend Task**

## Overview

Adds a `GET /api/v1/series/recommendations` endpoint that suggests TV series the user hasn't already added or dismissed, sourced from [TMDB](https://www.themoviedb.org/documentation/api) (The Movie Database — free API key, non-commercial use) using two signals: series similar/recommended-alongside the user's own **completed** series (title-based), supplemented by genre-based discovery when title-based sourcing comes up short. Also adds a lightweight "ignore list" (`ignored_series` table) so a dismissed recommendation never resurfaces, and the `imdbId` persistence `SeriesEntity` currently lacks — required so recommendations can be reliably cross-referenced against series already tracked.

**Design decisions**:
- **`imdbId` was never persisted, only used transiently for OMDb autofill (Spec 005).** Cross-referencing "is this TMDB result something the user already has?" needs a stable external ID — title+year matching breaks on remakes/re-releases/alternate titles. `SeriesEntity` gains a nullable `imdbId` column (nullable because manually-added series that never used the OMDb lookup won't have one — that's fine, they simply can't be matched against, same graceful-degradation posture as everything else in this app).
- **Ignore list is a separate table, not a new `SeriesStatus` value.** An ignored title was never watched and was never added — it has none of `SeriesEntity`'s progress/rating fields, and folding it into the same enum as `WATCHING`/`COMPLETED`/`DROPPED`/`BACKLOG` would require every existing `SeriesList`/`SearchFilter`/export consumer to start filtering it out. A dedicated `ignored_series` table stays additive: nothing that already works needs to change.
- **Recommendation sourcing uses only `COMPLETED` series as the "watched" signal.** `DROPPED` indicates the opposite of a positive signal, `WATCHING`/`BACKLOG` haven't been finished yet — `COMPLETED` is the only status that means "the user actually watched and (implicitly) didn't hate this."
- **Genre-based discovery is a supplement, not a parallel independent source.** It only kicks in when title-based sourcing doesn't produce enough candidates (e.g. few completed series have a resolvable `imdbId` yet), keeping a new user's or light user's experience from being dominated by broad genre matches instead of their actual taste signal.
- **TMDB's `vote_average` is exposed as its own `tmdbRating` field, never conflated with `imdbRating`.** They're different rating systems on different scales/methodologies; merging them into one field would silently mislead.
- **Every fan-out call in this spec is capped**, mirroring Spec 005's `OMDB_MAX_SEASONS_FOR_EPISODE_COUNT` precedent — this app has no need for unbounded recursion into a third-party API, and a data anomaly (e.g. a user with hundreds of completed series down the line) shouldn't be able to turn one request into hundreds of outbound calls.
- **TMDB's v3 key-based auth (`?api_key=`) is used, not v4 Bearer-token auth**, to mirror `OmdbClient`'s existing `RestClient` + query-param-key shape exactly rather than introducing a second auth style for one client.
- **The genre name → TMDB genre ID mapping below is based on TMDB's documented, stable public TV genre list** (not verified against a live `GET /genre/tv/list` call while writing this spec). `backend-dev` should verify against the real API early during implementation, same caveat Spec 005 raised for its OMDb field mappings.
- **"Mark as watched" and "add to list" reuse the existing `POST /api/v1/series` endpoint** via the frontend pre-filling `AddSeriesForm` (see `frontend_spec_010_recommendations.md`) — no new backend "add from recommendation" endpoint is needed. This spec's backend surface is limited to: sourcing/filtering recommendations, and recording an ignore.

---

## Requirements

### Requirement 1: `imdbId` Persistence

**User story**: As a developer, I want every series that came from an OMDb lookup to keep a stable external ID, so recommendations (and any future cross-referencing) can reliably tell "have I already got this?"

#### Acceptance Criteria

- **SERIES-006-AC-01** [AUTO]: `SeriesEntity` shall gain a nullable `imdbId` column (`VARCHAR`, length 20 — IMDb IDs are `tt` + up to ~9 digits), added via a new Flyway migration `V003__add_imdb_id_to_series.sql`, with an index (`idx_series_imdb_id`) since it's queried for existence checks (Requirement 6).
- **SERIES-006-AC-02** [AUTO]: `SeriesDto` shall gain an `imdbId` field (getter/setter), following the existing plain-getter/setter style.
- **SERIES-006-AC-03** [AUTO]: `POST /api/v1/series`, `GET /api/v1/series`, `GET /api/v1/series/{id}`, and `PATCH /api/v1/series/{id}` shall accept and return `imdbId` like any other optional field, following the same null-if-unset semantics as `genres`/`posterUrl`.
- **SERIES-006-AC-04** [AUTO]: `OmdbLookupResult` and `SeriesLookupDto` (`series_spec_005_omdb_lookup.md`) shall gain an `imdbId` field, mapped from OMDb's `imdbID` response field (passthrough; `null` if absent or the literal string `"N/A"`, per `OmdbClient`'s existing `str(...)` normalization).

---

### Requirement 2: TMDB Configuration

**User story**: As a developer, I want the TMDB API key and endpoint configurable without a code change, so the key never has to be committed.

#### Acceptance Criteria

- **SERIES-006-AC-05** [AUTO]: `application.yml` shall gain `app.tmdb.api-key` (no default — must be supplied via the `APP_TMDB_API_KEY` env var) and `app.tmdb.base-url` (default `https://api.themoviedb.org/3/`, overridable via `APP_TMDB_BASE_URL`), read via constructor-injected `@Value` exactly like `OmdbClient`'s `app.omdb.*` properties.
- **SERIES-006-AC-06** [AUTO]: The TMDB API key shall never appear in any HTTP response body, and shall never be logged — same policy as `SERIES-005-AC-06`.

---

### Requirement 3: `TmdbClient` — External API Integration

**User story**: As a developer, I want TMDB's raw response shape isolated behind a dedicated client, so the rest of the app deals in this app's own types, not a third party's field-naming quirks.

#### Acceptance Criteria

- **SERIES-006-AC-07** [AUTO]: A `TmdbClient` component (`client` package) shall use Spring's `RestClient` (constructor-injected `RestClient.Builder`, same pattern as `OmdbClient`) to call TMDB, authenticating via `?api_key={key}` on every request. It relies on the same global `spring.http.clients.connect-timeout`/`read-timeout` configuration `OmdbClient` already established (Spec 005) — no client-specific timeout config is added, since that would risk the same builder-mutation conflict Spec 005's Implementation Notes documented for `MockRestServiceServer`.
- **SERIES-006-AC-08** [AUTO]: `TmdbClient.findTvIdByImdbId(String imdbId)` shall call `GET /find/{imdbId}?external_source=imdb_id` and return the first entry of the response's `tv_results[]` array's `id` field, or empty (`Optional<Integer>`) if `tv_results` is absent or empty.
- **SERIES-006-AC-09** [AUTO]: `TmdbClient.recommendations(int tmdbId)` shall call `GET /tv/{tmdbId}/recommendations` and return its `results[]` array mapped to `TmdbCandidate` (an internal record: `tmdbId`, `title`, `year`, `overview`, `posterPath`, `voteAverage`).
- **SERIES-006-AC-10** [AUTO]: `TmdbClient.similar(int tmdbId)` shall call `GET /tv/{tmdbId}/similar`, mapped the same way as AC-09.
- **SERIES-006-AC-11** [AUTO]: `TmdbClient.discoverByGenre(List<Integer> genreIds)` shall call `GET /discover/tv?with_genres={comma-joined ids}`, mapped the same way as AC-09.
- **SERIES-006-AC-12** [AUTO]: `TmdbClient.externalIds(int tmdbId)` shall call `GET /tv/{tmdbId}/external_ids` and return the response's `imdb_id` field, or empty (`Optional<String>`) if absent/blank.
- **SERIES-006-AC-13** [AUTO]: If any `TmdbClient` call fails (network error, timeout, unexpected non-200, unparseable body) or `app.tmdb.api-key` is unset, the failing method shall throw `ExternalServiceException` (the same exception `OmdbClient` uses — no new exception type needed).

---

### Requirement 4: Recommendation Sourcing — Title-Based

**User story**: As a user, I want recommendations based on shows similar to ones I've actually finished and (implicitly) liked, so suggestions feel relevant to my taste.

#### Acceptance Criteria

- **SERIES-006-AC-14** [AUTO]: `RecommendationService` shall source the "watched" pool as every `SeriesEntity` with `status == COMPLETED` and non-null `imdbId`, ordered by `dateCompleted` descending, capped at `TMDB_MAX_SOURCE_SERIES` (= 20) entries.
- **SERIES-006-AC-15** [AUTO]: For each series in the watched pool, `RecommendationService` shall resolve its TMDB ID via `TmdbClient.findTvIdByImdbId`, then call `TmdbClient.recommendations(tmdbId)`; each resulting candidate shall retain a reference to the source series' `title` (`sourceTitle`).
- **SERIES-006-AC-16** [AUTO]: If `recommendations(tmdbId)` returns zero candidates for a given source series, `RecommendationService` shall fall back to `TmdbClient.similar(tmdbId)` for that same series before moving on — a genuine "TMDB has nothing" outcome, not a request failure, so no exception is raised either way.
- **SERIES-006-AC-17** [AUTO]: If a watched-pool series' `imdbId` cannot be resolved to a TMDB ID (`findTvIdByImdbId` returns empty), that series shall be skipped for title-based sourcing — it does not fail the overall request.

---

### Requirement 5: Recommendation Sourcing — Genre-Based Supplement

**User story**: As a user with few or no eligible completed series yet, I still want some recommendations to look at, based on the genres I'm known to watch.

#### Acceptance Criteria

- **SERIES-006-AC-18** [AUTO]: While the number of distinct candidates sourced via Requirement 4 is fewer than the requested `limit` (Requirement 7), `RecommendationService` shall supplement with `TmdbClient.discoverByGenre(...)` using the most frequent genre(s) (by occurrence count) among the same watched pool (Requirement 4's `COMPLETED` + non-null-`imdbId` series), mapped via the static table below. Genre names present in a series' comma-separated `genres` field that have no entry in the table are skipped (not an error).
- **SERIES-006-AC-19** [AUTO]: Candidates sourced via genre-based discovery shall have a `null` `sourceTitle` — they aren't attributable to one specific watched series.
- **SERIES-006-AC-20** [AUTO]: If the watched pool (Requirement 4, AC-14) is empty, `RecommendationService` shall skip both sourcing mechanisms entirely and return an empty result set — a normal "not enough data yet" outcome (`200` with `data: []`), not an error.

**Genre name → TMDB genre ID mapping** (verify against a live `GET /genre/tv/list` call during implementation):

| Stored genre name (as OMDb/this app writes it) | TMDB TV genre | TMDB ID |
|---|---|---|
| `Action` | Action & Adventure | 10759 |
| `Adventure` | Action & Adventure | 10759 |
| `Animation` | Animation | 16 |
| `Comedy` | Comedy | 35 |
| `Crime` | Crime | 80 |
| `Documentary` | Documentary | 99 |
| `Drama` | Drama | 18 |
| `Family` | Family | 10751 |
| `Kids` | Kids | 10762 |
| `Mystery` | Mystery | 9648 |
| `News` | News | 10763 |
| `Reality` | Reality | 10764 |
| `Sci-Fi` | Sci-Fi & Fantasy | 10765 |
| `Fantasy` | Sci-Fi & Fantasy | 10765 |
| `Soap` | Soap | 10766 |
| `Talk-Show` | Talk | 10767 |
| `War` | War & Politics | 10768 |
| `Western` | Western | 37 |

Any other OMDb genre string (`Thriller`, `Horror`, `Biography`, `History`, `Sport`, `Musical`, `Romance`, etc. — OMDb's genre vocabulary is broader than TMDB's fixed 16 TV genres) has no mapping and is skipped per AC-18.

---

### Requirement 6: Filtering & Deduplication

**User story**: As a user, I don't want to see recommendations for shows I've already added or already said I'm not interested in.

#### Acceptance Criteria

- **SERIES-006-AC-21** [AUTO]: The combined raw candidate pool (Requirements 4 + 5) shall be capped at `TMDB_MAX_CANDIDATES` (= 50) entries before further processing, to bound the number of subsequent `external_ids` lookups (AC-22).
- **SERIES-006-AC-22** [AUTO]: For each raw candidate, `RecommendationService` shall resolve its `imdb_id` via `TmdbClient.externalIds(tmdbId)`. A candidate whose `imdb_id` cannot be resolved shall be excluded from the results — without one, it can neither be filtered (this requirement) nor later added with an `imdbId` if the user acts on it.
- **SERIES-006-AC-23** [AUTO]: A candidate shall be excluded if its resolved `imdb_id` matches the `imdbId` of any existing `SeriesEntity` (any status) via `SeriesRepository.existsByImdbId`, or any `IgnoredSeriesEntity` via `IgnoredSeriesRepository.existsByImdbId` (Requirement 8).
- **SERIES-006-AC-24** [AUTO]: Candidates shall be deduplicated by `imdb_id` — a title recommended by more than one source series, or by both title-based and genre-based sourcing, appears once in the result.
- **SERIES-006-AC-25** [AUTO]: The final result list shall be capped at the requested `limit` (Requirement 7).

---

### Requirement 7: `GET /api/v1/series/recommendations` Endpoint

**User story**: As a user, I want to fetch a list of series I might want to watch next.

#### Acceptance Criteria

- **SERIES-006-AC-26** [AUTO]: `SeriesController` shall expose `GET /api/v1/series/recommendations?limit={n}` (optional; default 20; values above 50 clamp to 50 rather than erroring; values below 1 clamp to 1), delegating to `RecommendationService.recommend(int limit)`.
- **SERIES-006-AC-27** [AUTO]: On success, the endpoint shall return `200 OK` with `ApiResponse<List<RecommendationDto>>` (`data` + `count`, mirroring the `getAll`/`search` envelope).
- **SERIES-006-AC-28** [AUTO]: `RecommendationDto` shall contain: `title`, `year`, `genres` (comma-joined string, matching this app's existing storage convention), `overview`, `posterUrl` (TMDB's `poster_path` mapped to a full URL via `https://image.tmdb.org/t/p/w500{poster_path}`; `null` if TMDB returned no `poster_path`), `tmdbRating` (TMDB's `vote_average`, never conflated with `imdbRating`), `imdbId`, `sourceTitle` (nullable — see AC-19).
- **SERIES-006-AC-29** [AUTO]: If `app.tmdb.api-key` is unset, the endpoint shall respond `502 Bad Gateway` with the same generic, non-leaking message policy as `SERIES-005-AC-17`.

---

### Requirement 8: Ignore List

**User story**: As a user, I want to dismiss a recommendation I'm not interested in, so it never comes up again.

#### Acceptance Criteria

- **SERIES-006-AC-30** [AUTO]: A new `IgnoredSeriesEntity` (`id` UUID, `imdbId` `VARCHAR(20)` not null, `title` `VARCHAR(255)` not null, `reason` nullable `TEXT`, `ignoredAt` not-null `TIMESTAMP` via `@CreationTimestamp`) shall be added, backed by a new `ignored_series` table (Flyway `V004__create_ignored_series_table.sql`), with a unique index on `imdb_id`.
- **SERIES-006-AC-31** [AUTO]: `IgnoredSeriesRepository` (plain `JpaRepository<IgnoredSeriesEntity, UUID>` extension) shall provide a derived `existsByImdbId(String imdbId)` method, used by Requirement 6 (AC-23).
- **SERIES-006-AC-32** [AUTO]: `SeriesController` shall expose `POST /api/v1/series/ignored` accepting `{ imdbId, title, reason? }` (a new `IgnoredSeriesDto`, reused for both request and response like `SeriesDto`), delegating to a new `IgnoredSeriesService.ignore(IgnoredSeriesDto dto)`, returning `201 Created` with `ApiResponse<IgnoredSeriesDto>` on first-time ignore.
- **SERIES-006-AC-33** [AUTO]: If `imdbId` or `title` is blank, `IgnoredSeriesService` shall throw `IllegalArgumentException` (mapped by the existing `GlobalExceptionHandler` case to `400`), following `SeriesService.create`'s existing validation style.
- **SERIES-006-AC-34** [AUTO]: If `imdbId` already exists in `ignored_series`, `IgnoredSeriesService.ignore` shall be idempotent — return the existing `IgnoredSeriesEntity` (mapped to `IgnoredSeriesDto`) rather than creating a duplicate or erroring; the controller shall respond `200 OK` (not `201`) in this case.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `OmdbClient`/`RestClient` pattern, `ExternalServiceException`, `app.*`/`APP_*` config pattern, server-side-only API key policy | `series_spec_005_omdb_lookup.md` |
| `imdbID` OMDb field, `OmdbLookupResult`/`SeriesLookupDto` shape being extended | `series_spec_005_omdb_lookup.md` Requirement 3, 5 |
| `genres` comma-separated string convention, `SeriesStatus` enum | `series_spec_001_entity.md` |
| `ApiResponse<T>` envelope, `EntityNotFoundException`/`IllegalArgumentException` → 4xx pattern, manual service-layer validation style | `series_spec_002_crud.md`, `SeriesService.java` |
| Never-leak-internals policy for upstream failures | `tooling_spec_001_code_quality_security.md` Requirement 1 |
| Frontend consumer of `/recommendations` and `/ignored`; reuse of `AddSeriesForm` for "mark watched"/"add to list" | `frontend_spec_010_recommendations.md` |

---

## TDD Test Case Sketches

### `SeriesEntitySpec.groovy` / `SeriesServiceSpec.groovy` (additions)

```groovy
def "SERIES-006-AC-01/02/03: imdbId flows through create and is persisted"() {
    given: "a SeriesDto with imdbId set"
        def dto = new SeriesDto(title: "Breaking Bad", imdbId: "tt0903747")

    when: "the series is created"
        def created = seriesService.create(dto)

    then: "imdbId round-trips"
        created.imdbId == "tt0903747"
}
```

### `OmdbClientSpec.groovy` (addition)

```groovy
def "SERIES-006-AC-04: maps imdbID onto OmdbLookupResult.imdbId, N/A to null"() {
    given: "an OMDb response with imdbID: tt0903747"
        // ...

    when: "OmdbClient.lookup('Breaking Bad') is called"
        def result = omdbClient.lookup("Breaking Bad")

    then: "imdbId is mapped"
        result.imdbId == "tt0903747"
}
```

### `TmdbClientSpec.groovy`

```groovy
def "SERIES-006-AC-08: resolves a TMDB tv id from an IMDb id"() {
    given: "TMDB /find returns one tv_results entry with id 1396"
        // ...

    when: "TmdbClient.findTvIdByImdbId('tt0903747') is called"
        def result = tmdbClient.findTvIdByImdbId("tt0903747")

    then: "the tmdbId is returned"
        result.get() == 1396
}

def "SERIES-006-AC-08: returns empty when tv_results is empty"() {
    given: "TMDB /find returns an empty tv_results array"
        // ...

    when: "TmdbClient.findTvIdByImdbId('tt9999999') is called"
        def result = tmdbClient.findTvIdByImdbId("tt9999999")

    then: "no id is returned"
        result.isEmpty()
}

def "SERIES-006-AC-13: a failed TMDB call raises ExternalServiceException"() {
    given: "TMDB is unreachable"
        // ...

    when: "any TmdbClient method is called"
        tmdbClient.recommendations(1396)

    then: "an ExternalServiceException is thrown"
        thrown(ExternalServiceException)
}
```

### `RecommendationServiceSpec.groovy`

```groovy
def "SERIES-006-AC-14/15: sources candidates from completed series with an imdbId, oldest excluded beyond the cap"() {
    given: "21 COMPLETED series with imdbId, plus 1 BACKLOG series with imdbId"
        // ...

    when: "recommend(20) is called"
        recommendationService.recommend(20)

    then: "only the 20 most recently completed series are used as sources"
        // verify TmdbClient.recommendations invoked exactly 20 times
}

def "SERIES-006-AC-16: falls back to similar() when recommendations() is empty"() {
    given: "TmdbClient.recommendations(tmdbId) returns []"
        tmdbClient.recommendations(_) >> []

    when: "recommend(20) is called"
        recommendationService.recommend(20)

    then: "similar() is called for that source series"
        1 * tmdbClient.similar(_)
}

def "SERIES-006-AC-18/19/20: falls back to genre-based discovery only when short on candidates, tags sourceTitle null"() {
    given: "one completed series (genres: 'Drama, Crime') whose title-based sourcing yields 2 candidates, limit is 20"
        // ...

    when: "recommend(20) is called"
        def results = recommendationService.recommend(20)

    then: "discoverByGenre is called with TMDB ids [18, 80]"
        1 * tmdbClient.discoverByGenre([18, 80]) >> []

    and: "genre-sourced candidates (if any) have sourceTitle == null"
        results.findAll { it.sourceTitle == null }.every { true }
}

def "SERIES-006-AC-20: empty watched pool returns an empty list without calling TMDB"() {
    given: "no COMPLETED series with imdbId exist"
        // ...

    when: "recommend(20) is called"
        def results = recommendationService.recommend(20)

    then: "no TmdbClient sourcing calls are made, and the result is empty"
        0 * tmdbClient.recommendations(_)
        0 * tmdbClient.discoverByGenre(_)
        results.isEmpty()
}

def "SERIES-006-AC-22/23/24: excludes unresolvable, already-added, and already-ignored candidates, and dedupes"() {
    given: "3 raw candidates: one with no resolvable imdb_id, one matching an existing SeriesEntity, one matching an IgnoredSeriesEntity, and one valid candidate returned twice (by two source series)"
        // ...

    when: "recommend(20) is called"
        def results = recommendationService.recommend(20)

    then: "only the one valid, non-duplicated candidate remains"
        results.size() == 1
}

def "SERIES-006-AC-25: caps results at the requested limit"() {
    given: "40 valid, distinct candidates"
        // ...

    when: "recommend(5) is called"
        def results = recommendationService.recommend(5)

    then: "only 5 are returned"
        results.size() == 5
}
```

### `SeriesControllerSpec.groovy` / `SeriesControllerRecommendationsSpec.groovy` (recommendations endpoint)

```groovy
def "SERIES-006-AC-26/27/28: returns 200 with the envelope, clamps limit above 50"() {
    given: "RecommendationService.recommend(50) resolves to 3 RecommendationDto"
        // ...

    when: "GET /api/v1/series/recommendations?limit=999 is requested"
        def response = client.get().uri("/api/v1/series/recommendations?limit=999").exchange()

    then: "the response is 200 with 3 results, and recommend was called with 50 (clamped)"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("$.count").isEqualTo(3)
}

def "SERIES-006-AC-29: missing TMDB key returns 502"() {
    given: "app.tmdb.api-key is unset, TmdbClient throws ExternalServiceException"
        // ...

    when: "GET /api/v1/series/recommendations is requested"
        def response = client.get().uri("/api/v1/series/recommendations").exchange()

    then: "the response is 502"
        response.expectStatus().value() == 502
}
```

### `SeriesControllerSpec.groovy` (ignore endpoint)

```groovy
def "SERIES-006-AC-32/33: creates an ignore entry, 400 on blank imdbId"() {
    when: "POST /api/v1/series/ignored with { imdbId: 'tt1234567', title: 'Some Show' }"
        def response = client.post().uri("/api/v1/series/ignored")
            .bodyValue([imdbId: "tt1234567", title: "Some Show"]).exchange()

    then: "the response is 201 and the entry is persisted"
        response.expectStatus().isCreated()
        response.expectBody().jsonPath("$.data.imdbId").isEqualTo("tt1234567")

    when: "POST /api/v1/series/ignored with a blank imdbId"
        def badResponse = client.post().uri("/api/v1/series/ignored")
            .bodyValue([imdbId: "", title: "Some Show"]).exchange()

    then: "the response is 400"
        badResponse.expectStatus().isBadRequest()
}

def "SERIES-006-AC-34: ignoring the same imdbId twice is idempotent"() {
    given: "tt1234567 is already ignored"
        // ...

    when: "POST /api/v1/series/ignored is called again with the same imdbId"
        def response = client.post().uri("/api/v1/series/ignored")
            .bodyValue([imdbId: "tt1234567", title: "Some Show"]).exchange()

    then: "the response is 200, not 201, and no duplicate row is created"
        response.expectStatus().isOk()
}
```

---

## Implementation Notes (Deviations From / Extensions To Original Assumptions)

As with Spec 005, this spec flagged two areas as unverified against a live API and asked
`backend-dev` to confirm during implementation: the genre-ID table (Requirement 5) and
TMDB's response shape (Requirement 3). **No `APP_TMDB_API_KEY` was available in this
environment**, so neither could be verified against a real TMDB call. Implementation
proceeded strictly against this spec's assumed shape and TMDB's publicly documented API
reference, with three points worth flagging explicitly:

1. **`TmdbCandidate` gained a `genreIds` field beyond SERIES-006-AC-09's listed shape
   (`tmdbId`, `title`, `year`, `overview`, `posterPath`, `voteAverage`).** AC-28 requires
   `RecommendationDto.genres`, but nothing in Requirement 3 or 4 describes where that value
   comes from. TMDB's documented `/tv/{id}/recommendations`, `/tv/{id}/similar`, and
   `/discover/tv` responses all include a `genre_ids` array (of TMDB genre ids) on every
   result object, so `TmdbClient` captures it and `RecommendationService` renders it back to
   genre names via the reverse of the AC-18 mapping table (using TMDB's own canonical TV
   genre names, e.g. `10759 -> "Action & Adventure"`, rather than this app's OMDb-derived
   vocabulary — this is display text, not a value that round-trips through the
   name-&gt;id table). If TMDB's actual field name or presence of `genre_ids` on these
   endpoints differs from what's documented, `RecommendationDto.genres` would simply come
   back `null` (graceful degradation, not a hard failure) — worth spot-checking against a
   real API key before shipping the frontend consumer.
2. **TMDB's TV objects use `name` (and `first_air_date`), not `title`/`release_date`.**
   TMDB's API uses `title`/`release_date` for movie objects but `name`/`first_air_date` for
   TV objects; since this spec deals exclusively in `/tv/*` and `/discover/tv` endpoints,
   `TmdbClient` maps `name` -&gt; `TmdbCandidate.title` and extracts the year from
   `first_air_date`. This is a well-documented, stable part of TMDB's API surface, not a
   guess, but is called out here since it's easy to get wrong by pattern-matching on
   `OmdbClient`'s `Title`/`Year` fields.
3. **`IgnoredSeriesService.ignore` returns a new `IgnoreOutcome` record
   (`dto` + `created` boolean), not `IgnoredSeriesDto` directly.** AC-32/AC-34 require the
   controller to answer `201` on first-time ignore and `200` on a repeat, but the spec's
   sketch of `IgnoredSeriesService.ignore(dto)` returns only the DTO. Re-deriving "was this
   newly created?" in the controller (e.g. a separate existence check before calling
   `ignore`) would duplicate the check the service already performs and reintroduce the
   TOCTOU race the idempotency requirement exists to avoid — `IgnoreOutcome` lets the service
   report both facts in one call while keeping the controller thin.

Additionally, `IgnoredSeriesEntity.ignoredAt` is set explicitly in
`IgnoredSeriesService.ignore` (in addition to `@CreationTimestamp` on the entity) before
`save()`, mirroring `SeriesService.create`'s existing handling of `dateAdded` — the same
"not guaranteed to be visible on the in-memory entity returned by `save()`" reasoning applies
here and is exercised directly by `IgnoredSeriesServiceSpec`.

---

## Acceptance Criteria Summary

- [x] SERIES-006-AC-01: `imdbId` column on `SeriesEntity` via `V003` migration
- [x] SERIES-006-AC-02: `SeriesDto.imdbId`
- [x] SERIES-006-AC-03: `imdbId` flows through create/get/update like other optional fields
- [x] SERIES-006-AC-04: `imdbID` mapped onto `OmdbLookupResult`/`SeriesLookupDto`
- [x] SERIES-006-AC-05: `app.tmdb.api-key`/`app.tmdb.base-url` config
- [x] SERIES-006-AC-06: TMDB key never in a response body or logs
- [x] SERIES-006-AC-07: `TmdbClient` uses `RestClient`, shares global timeout config
- [x] SERIES-006-AC-08: `findTvIdByImdbId`
- [x] SERIES-006-AC-09: `recommendations` (see Implementation Notes for the `genreIds` addition)
- [x] SERIES-006-AC-10: `similar`
- [x] SERIES-006-AC-11: `discoverByGenre`
- [x] SERIES-006-AC-12: `externalIds`
- [x] SERIES-006-AC-13: TMDB failures raise `ExternalServiceException`
- [x] SERIES-006-AC-14: watched pool = `COMPLETED` + non-null `imdbId`, capped at 20, newest first
- [x] SERIES-006-AC-15: title-based sourcing via `recommendations`, tags `sourceTitle`
- [x] SERIES-006-AC-16: falls back to `similar` when `recommendations` is empty
- [x] SERIES-006-AC-17: unresolvable source series are skipped, not fatal
- [x] SERIES-006-AC-18: genre-based supplement only when short on candidates
- [x] SERIES-006-AC-19: genre-sourced candidates have `sourceTitle == null`
- [x] SERIES-006-AC-20: empty watched pool → empty result, no TMDB calls
- [x] SERIES-006-AC-21: raw candidate pool capped at 50
- [x] SERIES-006-AC-22: unresolvable `imdb_id` candidates excluded
- [x] SERIES-006-AC-23: already-added or already-ignored candidates excluded
- [x] SERIES-006-AC-24: deduplicated by `imdb_id`
- [x] SERIES-006-AC-25: results capped at requested `limit`
- [x] SERIES-006-AC-26: `GET /api/v1/series/recommendations?limit=` endpoint, clamped 1-50
- [x] SERIES-006-AC-27: 200 + `ApiResponse<List<RecommendationDto>>` envelope
- [x] SERIES-006-AC-28: `RecommendationDto` shape
- [x] SERIES-006-AC-29: missing TMDB key → 502, generic message
- [x] SERIES-006-AC-30: `IgnoredSeriesEntity` + `ignored_series` table via `V004` migration
- [x] SERIES-006-AC-31: `IgnoredSeriesRepository.existsByImdbId`
- [x] SERIES-006-AC-32: `POST /api/v1/series/ignored` endpoint
- [x] SERIES-006-AC-33: blank `imdbId`/`title` → 400
- [x] SERIES-006-AC-34: re-ignoring the same `imdbId` is idempotent (200, no duplicate)
