# Spec 007: Recommendation Sourcing, Weighting & Filtering

**Status**: ✅ Implemented — `RecommendationService`'s sourcing caps are now read from `app.tmdb.max-source-series`/`app.tmdb.max-candidates` (constructor-injected `@Value`, defaults 20/50), documented in `application.yml`. The two independently-maintained genre maps were replaced by a single `service/TmdbGenreTable.java` (`TmdbGenre(id, canonicalName, aliases)` records, forward/reverse lookups derived from one list). `client/TmdbClient.java` gained `searchKeyword(String)` and `discover(List<Integer> genreIds, List<Integer> keywordIds)`, which supersedes and replaces `discoverByGenre` (its only caller, `RecommendationService`, was already being touched); `client/TmdbCandidate.java` gained `voteCount`/`originalLanguage` fields, populated by `TmdbClient`'s response mapping. A new `dto/RecommendationCriteria.java` (mirroring `SeriesSearchCriteria`'s mutable-class shape) carries every new optional request field; `RecommendationService.recommend(int limit)` is now a convenience overload of `recommend(int limit, RecommendationCriteria criteria)`, which implements directed sourcing (explicit `seriesIds`, or `genres`/`keywords` bypassing the watched pool — mutually exclusive, `400` if both are set), `personalRating`-weighted pool ordering with a `minSourceRating` hard cutoff, a `rankScore`-based ranking pass with a `maxPerSource` diversity cap, and the new `minTmdbRating`/`minVoteCount` (defaults to 20)/`yearMin`/`yearMax`/`excludeGenres`/`language` output filters. `controller/SeriesController.java`'s `GET /api/v1/series/recommendations` endpoint gained all eleven new optional query params. `exception/GlobalExceptionHandler.java` gained a `MethodArgumentTypeMismatchException` → `400` handler so a malformed typed param (e.g. non-numeric `yearMin`) is rejected cleanly rather than falling through to the `500` catch-all. Tests: new `service/TmdbGenreTableSpec.groovy`; substantial additions to `service/RecommendationServiceSpec.groovy`, `client/TmdbClientSpec.groovy`, and `controller/SeriesControllerRecommendationsSpec.groovy` (including updating pre-existing Spec 006 tests for the `discoverByGenre` → `discover` rename and the new default `maxPerSource`/`minVoteCount` filters, so they remain valid rather than coincidentally passing). Full suite green (`gradlew.bat build`: 211 tests, 0 failures, JaCoCo coverage gate and SpotBugs both pass with zero findings). No `frontend/` files, `CHANGELOG.md`, or version numbers were touched — see the Implementation Notes below for judgment calls made in the absence of a live `APP_TMDB_API_KEY`. **Amendment (2026-08-24, live review)**: `RecommendationService`'s `SERIES-007-AC-22` diversity cap default (`DEFAULT_MAX_PER_SOURCE`) was found too restrictive during a live review of "Specific Series" mode — a hardcoded `3` meant only a handful of results ever surfaced per selected source title. It's now constructor-injected via `@Value("${app.tmdb.max-per-source:8}")`, matching the pattern `maxSourceSeries`/`maxCandidates` already used (`SERIES-007-AC-01`/`AC-02`), with the default bumped from `3` to `8`. Overridable via `APP_TMDB_MAX_PER_SOURCE` without a code change; `RecommendationCriteria.maxPerSource` still wins when explicitly set, unchanged. **Amendment (2026-09-03)**: `SERIES-007-AC-20`'s `minSourceRating` hard cutoff is retired — see `series_spec_045_retire_min_source_rating.md`. `SERIES-007-AC-19` (pool ordering) is unaffected.
**No `frontend/` files are touched by this spec** — the frontend controls for source selection and filters are `frontend_spec_011_recommendation_controls.md`, a separate follow-up task.
**Priority**: P2 (quality-of-life improvement to an existing discovery feature — not core CRUD)
**Depends on**: Spec 006 (Recommendations — this spec extends `RecommendationService`, `TmdbClient`, `TmdbCandidate`, and `GET /api/v1/series/recommendations` in place)
**Backend Task**

## Overview

Extends the recommendations feature (Spec 006) along four axes agreed with the user: (1) the two hardcoded sourcing caps become configurable, (2) TMDB's genre map is consolidated into one source-of-truth table and supplemented with keyword-based discovery for concepts TMDB's fixed 16-genre TV taxonomy has no entry for (e.g. "Spy"), (3) a user can direct sourcing explicitly — by picking specific tracked series, and/or by genre/keyword directly, independent of watch history — instead of always sourcing from every `COMPLETED` series, and (4) `personalRating` becomes a first-class signal: it prioritizes which series get to source recommendations, blends into how candidates are ranked, and (together with a new set of output-quality filters) lets a user tune what comes back. No database schema changes are required — this spec only touches sourcing/ranking/filtering logic and `TmdbClient`'s request/response shape.

**Design decisions**:
- **Explicitly-selected series (Requirement 4) are not restricted to `COMPLETED` status.** The automatic watched-pool (Spec 006) only trusts `COMPLETED` series because status is the only signal available that the user actually finished and (implicitly) liked it. When the user explicitly names series to source from, they're vouching for that choice directly — the entity's own status doesn't need to independently corroborate it. This wasn't pinned down explicitly during discussion, so it's called out here as this spec's resolution; revisit if that's not the intended behavior.
- **`seriesIds` and `genres`/`keywords` are mutually exclusive request modes, not combinable.** Picking specific series ("base it on what I picked") and directing by genre/keyword independent of watch history ("ignore what I've watched, just show me Spy") are two different intents; letting both be set at once would require an arbitrary precedence rule instead of a clear contract. A request with both is rejected (`400`).
- **Genre/keyword direct-sourcing (Requirement 5) bypasses the watched pool entirely** — it does not merge with or supplement title-based sourcing. This mirrors Spec 006's existing genre-based supplement being a fallback, not a parallel source: mixing "recommend me some Spy shows" with "and also whatever's similar to my completed list" would muddy a request that's explicitly trying to ignore watch history.
- **The new `minVoteCount` output filter (Requirement 8) defaults to a non-zero value (20) even when the query param is omitted** — the one deliberate exception to this spec's "every filter is a no-op unless explicitly set" rule. A `voteAverage` of 9.0 from 3 votes is closer to noise than signal; leaving this filter off by default would make `minTmdbRating` easy to satisfy vacuously. It remains fully overridable (including down to `0` to disable it) via the query param.
- **The new `TMDB TV genre → id` table (Requirement 2) and the new `TmdbClient.searchKeyword`/`discover` methods (Requirement 3) are, like Spec 006's original genre table, based on TMDB's publicly documented API reference, not verified against a live call while writing this spec** (no `APP_TMDB_API_KEY` available in this environment — same caveat Spec 006 raised, and Spec 006's Implementation Notes record it also went unverified there). `backend-dev` should verify against the real API early during implementation, in particular: (a) that `/search/keyword` returns results in the shape assumed here, and (b) that `/discover/tv` accepts `with_genres` and `with_keywords` together in one call.
- **`TmdbClient.discoverByGenre` (`SERIES-006-AC-11`) is superseded by `TmdbClient.discover`, not kept alongside it.** Its only caller is `RecommendationService`'s internal genre-based sourcing, which this spec already has to touch to add keyword support — TMDB's real `/discover/tv` endpoint accepts `with_genres` and `with_keywords` as two params on the *same* call, so one general method matches the real API shape better than two near-duplicate ones. `SERIES-006-AC-11` stays in Spec 006's record as documentation of what was originally built; it isn't renumbered or deleted.
- **The output-ranking blend (Requirement 7) normalizes `personalRating` (1–5) onto TMDB's 0–10 `voteAverage` scale via `× 2`** — the simplest possible common scale, chosen over a more elaborate weighting scheme so the behavior stays easy to reason about and explain. Revisit the 50/50 blend weighting once there's real usage to tune it against.

---

## Requirements

### Requirement 1: Configurable Sourcing Caps

**User story**: As a user, I want to tune how many of my series and how many raw candidates feed a recommendation request, so I can trade off breadth against request latency/TMDB call volume without a code change.

#### Acceptance Criteria

- **SERIES-007-AC-01** [AUTO]: `RecommendationService`'s watched-pool cap (`SERIES-006-AC-14`, currently the hardcoded constant `TMDB_MAX_SOURCE_SERIES = 20`) shall instead be read from `app.tmdb.max-source-series` (constructor-injected `@Value`, default `20`), following the same pattern as `app.tmdb.api-key`/`base-url`.
- **SERIES-007-AC-02** [AUTO]: `RecommendationService`'s raw-candidate-pool cap (`SERIES-006-AC-21`, currently the hardcoded constant `TMDB_MAX_CANDIDATES = 50`) shall instead be read from `app.tmdb.max-candidates` (constructor-injected `@Value`, default `50`).

---

### Requirement 2: Genre Table Consolidation

**User story**: As a developer, I want the TMDB genre name/id mapping defined in exactly one place, so a future edit can't update one direction and forget the other.

#### Acceptance Criteria

- **SERIES-007-AC-03** [AUTO]: `RecommendationService`'s two independently-maintained maps (`GENRE_NAME_TO_TMDB_ID`, `TMDB_ID_TO_GENRE_NAME`) shall be replaced by a single static table of `(tmdbId, tmdbCanonicalName, List<storedAliasNames>)` entries (e.g. a small record `TmdbGenre(int id, String canonicalName, List<String> aliases)` and a `List<TmdbGenre>` constant), from which both a forward (alias name → id) and reverse (id → canonical display name) lookup are derived.
- **SERIES-007-AC-04** [AUTO]: The derived forward and reverse lookups shall preserve Spec 006's existing many-to-one collapsing behavior unchanged — `Action`/`Adventure` both resolve to id `10759`, rendered back as `"Action & Adventure"`; `Sci-Fi`/`Fantasy` both resolve to id `10765`, rendered back as `"Sci-Fi & Fantasy"` — this is a pure internal refactor with no observable behavior change to `SERIES-006-AC-18`/`AC-28`.

---

### Requirement 3: TMDB Keyword Support (`TmdbClient`)

**User story**: As a developer, I want to resolve a free-text keyword to a TMDB keyword id and discover series by genre and/or keyword together, so niche concepts TMDB's fixed 16-genre TV list can't express (e.g. "Spy") are still usable for sourcing.

#### Acceptance Criteria

- **SERIES-007-AC-05** [AUTO]: `TmdbClient` shall gain `searchKeyword(String name)`, calling `GET /search/keyword?query={name}` and returning the first result's `id` (`Optional<Integer>`), or empty if the response's `results[]` is absent or empty.
- **SERIES-007-AC-06** [AUTO]: `TmdbClient.discoverByGenre(List<Integer> genreIds)` (`SERIES-006-AC-11`) shall be replaced by `discover(List<Integer> genreIds, List<Integer> keywordIds)`, calling `GET /discover/tv` with `with_genres={comma-joined ids}` included only when `genreIds` is non-empty, and `with_keywords={comma-joined ids}` included only when `keywordIds` is non-empty (both may be present on the same call), mapped to `TmdbCandidate` the same way as `SERIES-006-AC-09` plus the new fields from `SERIES-007-AC-23`.

---

### Requirement 4: Directed Sourcing — Explicit Series Selection

**User story**: As a user, I want to say "base recommendations on series A, C, and F specifically," so a handful of shows I know represent the taste I'm after don't get diluted by my whole watch history.

#### Acceptance Criteria

- **SERIES-007-AC-07** [AUTO]: `GET /api/v1/series/recommendations` shall accept an optional `seriesIds` parameter (comma-separated UUIDs).
- **SERIES-007-AC-08** [AUTO]: When `seriesIds` is supplied, `RecommendationService` shall source exclusively from the corresponding `SeriesEntity` records (looked up by id, regardless of `status` — see Design Decisions) instead of the automatic `COMPLETED`-only watched pool (`SERIES-006-AC-14`).
- **SERIES-007-AC-09** [AUTO]: If `seriesIds` contains an id that does not match any existing `SeriesEntity`, the endpoint shall respond `400 Bad Request` (via `IllegalArgumentException`, following `SeriesSearchService`'s existing invalid-`status` validation style) rather than silently dropping it.
- **SERIES-007-AC-10** [AUTO]: If a selected series has no resolvable `imdbId`/TMDB id, it shall be skipped for title-based sourcing — same graceful degradation as `SERIES-006-AC-17` — without failing the request.
- **SERIES-007-AC-11** [AUTO]: If `seriesIds` resolves to more entries than `app.tmdb.max-source-series` (`SERIES-007-AC-01`), the pool shall be ordered per `SERIES-007-AC-19` and truncated to the cap, the same as the automatic pool.

---

### Requirement 5: Directed Sourcing — Genre/Keyword Selection

**User story**: As a user, I want to say "recommend me Drama/Crime/Spy" without reference to anything I've watched, so I can explore a genre I haven't necessarily seen before.

#### Acceptance Criteria

- **SERIES-007-AC-12** [AUTO]: `GET /api/v1/series/recommendations` shall accept optional `genres` and `keywords` parameters (each comma-separated free text).
- **SERIES-007-AC-13** [AUTO]: When either `genres` or `keywords` is supplied, `RecommendationService` shall bypass title-based sourcing and the watched pool entirely (Requirement 4/`SERIES-006-AC-14` do not run) and source directly via `TmdbClient.discover(...)` (`SERIES-007-AC-06`) using the resolved genre and/or keyword ids.
- **SERIES-007-AC-14** [AUTO]: `genres` values shall be resolved via the table from `SERIES-007-AC-03`; `keywords` values shall each be resolved via `TmdbClient.searchKeyword` (`SERIES-007-AC-05`). An unrecognized genre name or an unresolvable keyword shall be skipped, not treated as an error — same posture as `SERIES-006-AC-18`.
- **SERIES-007-AC-15** [AUTO]: `genres` and `keywords` may be supplied together in one request, resolved and passed to a single `discover(...)` call.
- **SERIES-007-AC-16** [AUTO]: Candidates sourced via Requirement 5 shall have a `null` `sourceTitle` — same convention as `SERIES-006-AC-19`.
- **SERIES-007-AC-17** [AUTO]: If `seriesIds` (Requirement 4) is supplied together with `genres` and/or `keywords`, the endpoint shall respond `400 Bad Request` — the two are mutually exclusive request modes (see Design Decisions).
- **SERIES-007-AC-18** [AUTO]: When none of `seriesIds`, `genres`, or `keywords` is supplied, behavior shall be unchanged from Spec 006 — automatic watched-pool sourcing, as today.

---

### Requirement 6: Personal-Rating-Weighted Source Prioritization

**User story**: As a user, I want recommendations sourced more heavily from the series I rated highly, so my favorites drive more of what I see than everything I've merely finished.

#### Acceptance Criteria

- **SERIES-007-AC-19** [AUTO]: Whenever sourcing from a watched pool (the automatic pool, `SERIES-006-AC-14`, or an explicit `seriesIds` selection, `SERIES-007-AC-08`), `RecommendationService` shall order that pool by `personalRating` descending, then `dateCompleted` descending as a tiebreaker (superseding `SERIES-006-AC-14`'s `dateCompleted`-only ordering) — series with a null `personalRating` sort after every rated series, in `dateCompleted` order among themselves.
- **SERIES-007-AC-20** [AUTO] — **superseded by `series_spec_045`, 2026-09-03**: `GET /api/v1/series/recommendations` shall accept an optional `minSourceRating` parameter (integer `1`–`5`). When supplied, a series with a `personalRating` below it, or with a null `personalRating`, shall be excluded from the source pool entirely (a hard cutoff, distinct from the ordering in `SERIES-007-AC-19`). Ignored (no-op) when Requirement 5's direct genre/keyword mode is used, since there is no source pool in that mode. **`minSourceRating` is retired entirely as of `series_spec_045`** — an explicit `seriesIds` pick must never be silently dropped by a rating threshold; a personal-rating filter reappears later only as a client-side, non-backend-reaching picker-narrowing field (`frontend_spec_081`). This ID is preserved per this project's immutable-reference-ID rule, not deleted.

---

### Requirement 7: Output Ranking & Diversity Cap

**User story**: As a user, I want candidates from a favorite show to appear more prominently than candidates from a merely-okay one, and I don't want one show's recommendations to flood the whole list.

#### Acceptance Criteria

- **SERIES-007-AC-21** [AUTO]: After filtering/deduplication (Requirement 8), `RecommendationService` shall compute a `rankScore` per candidate and sort the result list by it descending: for a candidate with a non-null `sourceTitle`, `rankScore = (tmdbRating × 0.5) + (sourceSeries.personalRating × 2 × 0.5)`; for a candidate with a null `sourceTitle` (genre/keyword-sourced), `rankScore = tmdbRating`. A source series with a null `personalRating` contributes `0` for that term.
- **SERIES-007-AC-22** [AUTO]: `GET /api/v1/series/recommendations` shall accept an optional `maxPerSource` parameter (integer, default `8` — read from `app.tmdb.max-per-source`, constructor-injected `@Value`, overridable via `APP_TMDB_MAX_PER_SOURCE`; originally a hardcoded default of `3`, bumped per the 2026-08-24 live-review amendment above). After ranking (`SERIES-007-AC-21`), at most `maxPerSource` candidates attributed to the same `sourceTitle` shall appear in the final result — lower-`rankScore` excess candidates from an over-represented source are dropped in favor of candidates from other sources, before the result is truncated to the requested `limit`. Candidates with a null `sourceTitle` are not subject to this cap (they aren't attributable to one series to over-represent).

---

### Requirement 8: Output Filters

**User story**: As a user, I want to exclude low-confidence or otherwise-unwanted candidates from my results — too obscure, too old, a genre I don't want mixed in, or the wrong language.

#### Acceptance Criteria

- **SERIES-007-AC-23** [AUTO]: `TmdbCandidate` shall gain `voteCount` (`Integer`, TMDB's `vote_count`) and `originalLanguage` (`String`, TMDB's `original_language`) fields, populated from the same `/recommendations`, `/similar`, and `/discover/tv` responses already consumed — both fields are present on every result object per TMDB's documented response shape.
- **SERIES-007-AC-24** [AUTO]: `GET /api/v1/series/recommendations` shall accept an optional `minTmdbRating` parameter (decimal). When supplied, a candidate with `tmdbRating` below it shall be excluded.
- **SERIES-007-AC-25** [AUTO]: `GET /api/v1/series/recommendations` shall accept an optional `minVoteCount` parameter (integer), **defaulting to `20` when not supplied** (see Design Decisions — the one filter in this spec that is not a no-op by default). A candidate with `voteCount` below the effective value shall be excluded. Passing `minVoteCount=0` explicitly disables the filter.
- **SERIES-007-AC-26** [AUTO]: `GET /api/v1/series/recommendations` shall accept optional `yearMin`/`yearMax` parameters (integers). A candidate shall be excluded if its `year` falls outside an inclusive `[yearMin, yearMax]` range, or if either bound is set and the candidate's `year` is null (a null year can't be verified to satisfy the filter, so it's excluded rather than assumed to pass).
- **SERIES-007-AC-27** [AUTO]: `GET /api/v1/series/recommendations` shall accept an optional `excludeGenres` parameter (comma-separated names). A candidate shall be excluded if any of its resolved display genres (`SERIES-006-AC-28`'s `genres` string) matches an entry in this list.
- **SERIES-007-AC-28** [AUTO]: `GET /api/v1/series/recommendations` shall accept an optional `language` parameter (ISO 639-1 code, e.g. `en`). A candidate shall be excluded if its `originalLanguage` does not case-insensitively match.
- **SERIES-007-AC-29** [AUTO]: All Requirement 8 filters are AND-combined and applied after Spec 006's existing dedupe/already-added/already-ignored filtering (`SERIES-006-AC-22`–`AC-24`) and before the ranking/diversity-cap stage (Requirement 7).

---

### Requirement 9: Endpoint Parameter Validation

**User story**: As a developer, I want malformed recommendation-request parameters rejected clearly, so a typo doesn't silently produce a nonsensical or empty result.

#### Acceptance Criteria

- **SERIES-007-AC-30** [AUTO]: `GET /api/v1/series/recommendations` shall accept, in addition to the existing `limit` (`SERIES-006-AC-26`): `seriesIds`, `genres`, `keywords`, `minSourceRating`, `minTmdbRating`, `minVoteCount`, `yearMin`, `yearMax`, `excludeGenres`, `language`, `maxPerSource` — all optional.
- **SERIES-007-AC-31** [AUTO]: A malformed value for any typed parameter (a non-UUID entry in `seriesIds`; `minSourceRating` outside `1`–`5`; a non-numeric `minTmdbRating`/`minVoteCount`/`yearMin`/`yearMax`/`maxPerSource`) shall result in `400 Bad Request`, following the existing `MethodArgumentNotValidException`/`IllegalArgumentException` → 400 handling in `GlobalExceptionHandler`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationService`, `TmdbClient`, `TmdbCandidate`, `RecommendationDto`, watched-pool/genre-supplement/dedupe design, `GET /api/v1/series/recommendations` base contract | `series_spec_006_recommendations.md` |
| `app.tmdb.*`/`APP_TMDB_*` config pattern, `ExternalServiceException`, server-side-only API key policy | `series_spec_005_omdb_lookup.md`, `series_spec_006_recommendations.md` Requirement 2 |
| `SeriesEntity.personalRating` (`1`–`5`, nullable), `genres` comma-separated string convention, `SeriesStatus` enum | `series_spec_001_entity.md` |
| Invalid-parameter → `400` validation style (`SeriesSearchService`'s `status` check) | `series_spec_003_search.md`, `SeriesSearchService.java` |
| Never-leak-internals policy for upstream failures | `tooling_spec_001_code_quality_security.md` Requirement 1 |
| Future frontend consumer: source-selection UI (series/genre/keyword pickers) and filter controls | `frontend_spec_011_recommendation_controls.md` (not yet written) |
| Deferred to a later spec in this grouping: `excludeFromRecommendations` flag on `SeriesEntity`, which will add one more filter predicate into this spec's source-pool logic | `series_spec_008_series_lifecycle_data.md` (not yet written) |

---

## TDD Test Case Sketches

### `application.yml` / `TmdbClientSpec.groovy` (Requirement 1)

```groovy
def "SERIES-007-AC-01/02: sourcing caps are read from app.tmdb.max-source-series/max-candidates"() {
    given: "app.tmdb.max-source-series=5 and app.tmdb.max-candidates=10 are configured"
        // ...

    when: "recommend(20) is called with more than 5 eligible source series"
        // ...

    then: "only 5 series are used as sources, and the raw candidate pool is capped at 10"
        // ...
}
```

### `RecommendationServiceSpec.groovy` (Requirement 2)

```groovy
def "SERIES-007-AC-03/04: genre lookup table collapses Action/Adventure and Sci-Fi/Fantasy exactly as before"() {
    expect: "the forward lookup maps both aliases to the same TMDB id"
        genreTable.idFor("Action") == 10759
        genreTable.idFor("Adventure") == 10759

    and: "the reverse lookup renders TMDB's own canonical combined name"
        genreTable.displayNameFor(10759) == "Action & Adventure"
}
```

### `TmdbClientSpec.groovy` (Requirement 3)

```groovy
def "SERIES-007-AC-05: resolves a keyword name to a TMDB keyword id"() {
    given: "TMDB /search/keyword?query=spy returns one result with id 9720"
        // ...

    when: "TmdbClient.searchKeyword('spy') is called"
        def result = tmdbClient.searchKeyword("spy")

    then: "the keyword id is returned"
        result.get() == 9720
}

def "SERIES-007-AC-06: discover() sends both with_genres and with_keywords when both are provided"() {
    given: "a mocked TMDB server expecting GET /discover/tv?with_genres=18&with_keywords=9720"
        // ...

    when: "TmdbClient.discover([18], [9720]) is called"
        tmdbClient.discover([18], [9720])

    then: "the expected request was made"
        // MockRestServiceServer verification
}
```

### `RecommendationServiceSpec.groovy` (Requirement 4 — explicit series selection)

```groovy
def "SERIES-007-AC-08/10: sources exclusively from explicitly-selected series regardless of status"() {
    given: "a WATCHING series with a resolvable imdbId, and 5 unrelated COMPLETED series"
        // ...

    when: "recommend(20, seriesIds: [watchingSeries.id]) is called"
        def results = recommendationService.recommend(20, [seriesIds: [watchingSeries.id]])

    then: "only the WATCHING series is used as a source; the 5 COMPLETED series are not consulted"
        // ...
}

def "SERIES-007-AC-09: an unknown series id in seriesIds is rejected"() {
    when: "GET /api/v1/series/recommendations?seriesIds={random UUID} is requested"
        def response = client.get().uri("/api/v1/series/recommendations?seriesIds=" + UUID.randomUUID()).exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()
}
```

### `RecommendationServiceSpec.groovy` (Requirement 5 — genre/keyword direct sourcing)

```groovy
def "SERIES-007-AC-13/16: genres param bypasses the watched pool entirely and tags sourceTitle null"() {
    given: "3 COMPLETED series exist (would normally source title-based candidates)"
        // ...

    when: "recommend(20, genres: ['Drama', 'Spy']) is called"
        def results = recommendationService.recommend(20, [genres: ["Drama", "Spy"]])

    then: "no title-based sourcing occurs; discover() is called with Drama's id only (Spy has no genre mapping)"
        0 * tmdbClient.recommendations(_)
        1 * tmdbClient.discover([18], []) >> [...]

    and: "results have sourceTitle == null"
        results.every { it.sourceTitle == null }
}

def "SERIES-007-AC-17: seriesIds combined with genres is rejected"() {
    when: "GET /api/v1/series/recommendations?seriesIds={id}&genres=Drama is requested"
        def response = client.get().uri("/api/v1/series/recommendations?seriesIds=" + validId + "&genres=Drama").exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()
}
```

### `RecommendationServiceSpec.groovy` (Requirement 6 — rating-weighted sourcing)

```groovy
def "SERIES-007-AC-19: source pool is ordered by personalRating descending, dateCompleted as tiebreaker"() {
    given: "3 COMPLETED series: A (rating 3), B (rating 5), C (rating null)"
        // ...

    when: "recommend(20) is called"
        recommendationService.recommend(20)

    then: "sources are consulted in order B, A, C"
        // verify TmdbClient call order
}

def "SERIES-007-AC-20: minSourceRating excludes series below the threshold, including null ratings"() {
    given: "series A (rating 2), B (rating 4), C (rating null)"
        // ...

    when: "recommend(20, minSourceRating: 3) is called"
        recommendationService.recommend(20, [minSourceRating: 3])

    then: "only B is used as a source"
        // ...
}
```

### `RecommendationServiceSpec.groovy` (Requirement 7 — ranking & diversity cap)

```groovy
def "SERIES-007-AC-21: candidates from a 5-star source outrank otherwise-similar candidates from a 3-star source"() {
    given: "candidate X (tmdbRating 7.0) sourced from a 5-star series, candidate Y (tmdbRating 7.0) sourced from a 3-star series"
        // ...

    when: "recommend(20) is called"
        def results = recommendationService.recommend(20)

    then: "X is ranked ahead of Y"
        results.indexOf(x) < results.indexOf(y)
}

def "SERIES-007-AC-22: maxPerSource caps candidates attributed to one source series"() {
    given: "one source series producing 6 raw candidates, maxPerSource default 3"
        // ...

    when: "recommend(20) is called"
        def results = recommendationService.recommend(20)

    then: "at most 3 of the results are attributed to that sourceTitle"
        results.count { it.sourceTitle == "Breaking Bad" } <= 3
}
```

### `RecommendationServiceSpec.groovy` (Requirement 8 — output filters)

```groovy
def "SERIES-007-AC-25: minVoteCount defaults to 20 when not supplied"() {
    given: "candidate with voteCount 5, candidate with voteCount 25"
        // ...

    when: "recommend(20) is called with no minVoteCount param"
        def results = recommendationService.recommend(20)

    then: "only the voteCount-25 candidate is present"
        results.size() == 1
}

def "SERIES-007-AC-26: a null year is excluded once yearMin/yearMax is set"() {
    given: "candidate with year null, candidate with year 2020"
        // ...

    when: "recommend(20, yearMin: 2015) is called"
        def results = recommendationService.recommend(20, [yearMin: 2015])

    then: "only the year-2020 candidate is present"
        results.size() == 1
}
```

### `SeriesControllerRecommendationsSpec.groovy` (Requirement 9)

```groovy
def "SERIES-007-AC-31: a malformed minSourceRating returns 400"() {
    when: "GET /api/v1/series/recommendations?minSourceRating=9 is requested"
        def response = client.get().uri("/api/v1/series/recommendations?minSourceRating=9").exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()
}
```

---

## Implementation Notes (Deviations From / Extensions To Original Assumptions)

As flagged in Design Decisions, this spec's new genre table (Requirement 2) and the new
`TmdbClient.searchKeyword`/`discover` request/response shapes (Requirement 3) were, like
Spec 006's original genre table, based on TMDB's publicly documented API reference, not
verified against a live call — **no `APP_TMDB_API_KEY` was available in this environment**.
Points worth flagging explicitly:

1. **`TmdbClient.discover`'s `with_genres`/`with_keywords` co-occurrence on one call** is
   implemented exactly as documented (both included as separate query params when both id
   lists are non-empty), per SERIES-007-AC-06. This is the one point this spec's Design
   Decisions section specifically asked to be verified early against a live call
   ("that `/discover/tv` accepts `with_genres` and `with_keywords` together in one call") —
   still unverified here for the same no-API-key reason as everything else in this note.
2. **`TmdbClient.searchKeyword` assumes `/search/keyword`'s response shape mirrors every
   other TMDB search/list endpoint** (`{"results": [{"id": ..., "name": ...}, ...]}`), taking
   the first result's `id` per SERIES-007-AC-05. This matches TMDB's documented general
   "search" response envelope (the same `results[]` shape `TmdbClient.mapResults` already
   relies on for `/tv/{id}/recommendations`, `/tv/{id}/similar`, and `/discover/tv`), so no
   new parsing helper was needed beyond a bespoke `listOfMaps(body, "results")` extraction —
   worth spot-checking against a real API key before shipping the frontend consumer
   (`frontend_spec_011_recommendation_controls.md`).
3. **`minTmdbRating`/`yearMin`/`yearMax` treat a candidate whose relevant field is `null` as
   failing that specific filter once it's active**, not just `yearMin`/`yearMax` as
   SERIES-007-AC-26 explicitly states. SERIES-007-AC-24 doesn't say what happens when
   `tmdbRating` (TMDB's `vote_average`) is itself `null` and `minTmdbRating` is set; this
   spec's own AC-26 rationale for years ("a null value can't be verified to satisfy the
   filter, so it's excluded rather than assumed to pass") generalizes cleanly to
   `minTmdbRating`, so `RecommendationService.matchesMinTmdbRating` applies the same
   null-excludes-when-active posture. `minVoteCount` doesn't need this treatment since it
   already defaults a `null` `voteCount` to `0` (which then legitimately fails almost any
   non-zero threshold on its own, including the default).
4. **`excludeGenres`/genre-name comparisons throughout Requirement 8 are case-insensitive**
   (`String.equalsIgnoreCase`), even though the spec text doesn't state this explicitly for
   `excludeGenres` the way SERIES-007-AC-28 states it for `language`. Genre display names are
   user-typed free text matched against TMDB's own canonical display strings (e.g.
   `"Action & Adventure"`); requiring exact-case input would make the filter needlessly
   brittle for what's meant to be a convenience filter, and case-insensitivity is already the
   stated behavior one field over (`language`) in the same requirement.
5. **`RecommendationCriteria.seriesIds`/`genres`/`keywords`/`excludeGenres` are `List<String>`,
   not `List<UUID>`, on the DTO itself** — see the class-level Javadoc. Parsing/validating each
   `seriesIds` entry as a UUID is treated as business logic (SERIES-007-AC-09's "is this a
   well-formed, existing series id?" question), so it happens in `RecommendationService`, not
   at the controller's request-binding boundary — consistent with `SeriesSearchService`'s own
   `status` validation, which this spec's cross-references call out as the precedent to follow.

Additionally, two pre-existing Spec 006 tests needed adjusting for newly-default-on
Spec 007 behavior, not just mechanical renames: `RecommendationServiceSpec`'s
"SERIES-006-AC-25: caps results at the requested limit" test sourced all 40 test candidates
from a single source series, which the new default `maxPerSource` cap (3) would otherwise
truncate before the original test's limit-of-5 assertion ever ran — the test now passes an
explicit `RecommendationCriteria(maxPerSource: 40)` so it continues to isolate exactly what
it was written to test (limit truncation, not the diversity cap). No other pre-existing
assertions needed behavior-level changes; the `discoverByGenre` → `discover` and
`TmdbCandidate` constructor-arity renames elsewhere were purely mechanical.

---

## Acceptance Criteria Summary

- [x] SERIES-007-AC-01: `app.tmdb.max-source-series` config (default 20)
- [x] SERIES-007-AC-02: `app.tmdb.max-candidates` config (default 50)
- [x] SERIES-007-AC-03: single source-of-truth genre table replaces the two maps
- [x] SERIES-007-AC-04: forward/reverse lookups preserve existing collapsing behavior
- [x] SERIES-007-AC-05: `TmdbClient.searchKeyword`
- [x] SERIES-007-AC-06: `TmdbClient.discover(genreIds, keywordIds)` supersedes `discoverByGenre`
- [x] SERIES-007-AC-07: `seriesIds` request param
- [x] SERIES-007-AC-08: explicit series selection sources regardless of status
- [x] SERIES-007-AC-09: unknown `seriesIds` entry → 400
- [x] SERIES-007-AC-10: unresolvable selected series skipped, not fatal
- [x] SERIES-007-AC-11: `seriesIds` pool still capped/ordered per Requirement 1/6
- [x] SERIES-007-AC-12: `genres`/`keywords` request params
- [x] SERIES-007-AC-13: genre/keyword mode bypasses watched-pool sourcing entirely
- [x] SERIES-007-AC-14: genre/keyword resolution, unresolvable entries skipped
- [x] SERIES-007-AC-15: genres + keywords combinable in one `discover()` call
- [x] SERIES-007-AC-16: genre/keyword-sourced candidates have `sourceTitle == null`
- [x] SERIES-007-AC-17: `seriesIds` + `genres`/`keywords` together → 400
- [x] SERIES-007-AC-18: no override params → unchanged Spec 006 behavior
- [x] SERIES-007-AC-19: source pool ordered by `personalRating` desc, `dateCompleted` tiebreak
- [x] SERIES-007-AC-20: `minSourceRating` hard cutoff (no-op in genre/keyword mode) — **superseded by `series_spec_045`** (field retired)
- [x] SERIES-007-AC-21: `rankScore` blends `tmdbRating` + source `personalRating`
- [x] SERIES-007-AC-22: `maxPerSource` diversity cap (default 8, `app.tmdb.max-per-source` — bumped from the original hardcoded default of 3 per the 2026-08-24 live-review amendment)
- [x] SERIES-007-AC-23: `TmdbCandidate.voteCount`/`originalLanguage` added
- [x] SERIES-007-AC-24: `minTmdbRating` filter
- [x] SERIES-007-AC-25: `minVoteCount` filter, defaults to 20
- [x] SERIES-007-AC-26: `yearMin`/`yearMax` filter, null year excluded when active
- [x] SERIES-007-AC-27: `excludeGenres` filter
- [x] SERIES-007-AC-28: `language` filter
- [x] SERIES-007-AC-29: Requirement 8 filters AND-combined, ordered before ranking
- [x] SERIES-007-AC-30: full endpoint parameter list
- [x] SERIES-007-AC-31: malformed parameter → 400
