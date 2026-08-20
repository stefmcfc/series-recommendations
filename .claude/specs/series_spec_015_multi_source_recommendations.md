# Spec 015: Multi-Source Recommendation Attribution

**Status**: Implemented
**Priority**: P2 (correctness fix to an existing discovery feature's attribution data — not core CRUD)
**Depends on**: Spec 006 (Recommendations) ✅, Spec 007 (Recommendation Sourcing, Weighting & Filtering) ✅ — this spec extends `RecommendationService`'s `DedupedCandidate`, `dedupeAndExclude`, `score`, `applyDiversityCap`, and `RecommendationDto`/`RecommendationCriteria` in place
**Backend Task**

## Overview

`RecommendationService` currently tracks only **one** source series per recommended candidate, even when multiple watched series would have recommended the same show. The root cause is in `dedupeAndExclude`: it keys candidates by `imdbId` in a `LinkedHashMap`, and when a candidate's `imdbId` is already present it `continue`s — silently discarding every source after the first one encountered (pool iteration order is `personalRating` descending, then `dateCompleted` descending, per `resolveSourcePool`, `series_spec_007` Requirement 6). In practice this means a recommendation only ever shows "Because you watched X" for one title, even when it was genuinely suggested by several of the user's watched series.

This spec fixes that by changing `DedupedCandidate.sourceSeries` from a single `SeriesEntity` to `List<SeriesEntity>` — every distinct source series that recommended a candidate, accumulated during dedup rather than discarded — and threads that richer data through three places that currently only see the first source: (1) `RecommendationDto` gains `sourceTitles`/`totalSourceCount` so a future frontend label can name multiple sources, capped, with an overflow count (`frontend_spec_019_multi_source_recommendations.md` builds that label; this spec only supplies the data); (2) `score()`'s personal-rating term uses the *best*-rated contributing source rather than whichever happened to be processed first; (3) the per-source diversity cap (`series_spec_007` Requirement 7) gains a second, config-selectable mode that accounts for all contributing sources rather than just one. A new `sortBy` criteria field also lets a request order results by how many sources recommended a candidate, not just by `rankScore`. No database schema changes are required — this is a service-layer/DTO change only.

**Design decisions** (agreed with the user before writing this spec; implement to match, don't re-derive):

- **A single canonical per-candidate source ordering feeds all three downstream uses.** Each candidate's accumulated `List<SeriesEntity>` is sorted once — by `personalRating` descending (nulls last), then `dateCompleted` descending (nulls last), reusing the exact comparator `resolveSourcePool` already builds rather than writing a second one — and that one ordered list is read by scoring, `best-source` diversity-cap mode, and the DTO's `sourceTitles`/`totalSourceCount`. This guarantees the three can never disagree about which source is "best" for a given candidate.
- **An empty list, never `null`, represents "no watched-series source."** A candidate sourced only via genre/keyword discovery (`series_spec_007` Requirement 5) has `sourceSeries = List.of()`. This replaces every existing `sourceSeries == null` check in `RecommendationService` with `sourceSeries.isEmpty()`.
- **The diversity-cap mode and the sort key are both backend tuning knobs, not per-request user choices.** `diversityCapMode` is wired via `@Value` (matching how `app.tmdb.max-source-series`/`app.tmdb.max-candidates` are already constructor-injected, `series_spec_007` Requirement 1); `sortBy`, by contrast, *is* a per-request `RecommendationCriteria` field (like `maxPerSource`), because which order a user wants results in is a legitimate per-request choice in a way that "how aggressively do we enforce diversity" is not.
- **Both new soft-configured string fields (`diversityCapMode`, `sortBy`) fall back silently on an unrecognized value** rather than rejecting the request — consistent with this codebase's existing posture toward other soft-configured tunables (e.g. unresolvable genre/keyword names in `series_spec_007` Requirement 5 are skipped, not errors). No startup validation is added for `diversityCapMode` either.
- **`score()`'s blend formula itself is unchanged** (`series_spec_007` Requirement 7's `(tmdbRating × 0.5) + (personalRatingTerm × 0.5)`) — only how `personalRatingTerm` is derived changes, from "the single source's `personalRating`" to "the maximum `personalRating` among all contributing sources, `0` if none have one." This keeps the ranking behavior a strict improvement (a candidate never scores *lower* than it did under single-source attribution) rather than a re-tuning.
- **The "Because you watched X, Y and N more" label itself is out of scope for this spec.** This spec supplies `sourceTitles`/`totalSourceCount` as raw data only; building the actual sentence is `frontend_spec_019_multi_source_recommendations.md`, a separate follow-up task.

---

## Requirements

### Requirement 1: Accumulate Every Contributing Source During Dedup

**User story**: As a user, I want a recommendation to remember every one of my watched series that suggested it, not just the first one processed, so "why was this recommended" reflects the full picture.

#### Acceptance Criteria

- **SERIES-015-AC-01** [AUTO]: `RecommendationService.DedupedCandidate`'s `sourceSeries` field shall change from `SeriesEntity` to `List<SeriesEntity>`.
- **SERIES-015-AC-02** [AUTO]: When `dedupeAndExclude` encounters a `RawCandidate` whose resolved `imdbId` already has an entry in the dedup map, it shall append that raw candidate's `sourceSeries()` (when non-null) to the existing entry's accumulated `List<SeriesEntity>` instead of discarding it via `continue` — superseding the current skip-on-duplicate behavior.
- **SERIES-015-AC-03** [AUTO]: A candidate sourced only via genre/keyword discovery (`series_spec_007` Requirement 5, whose `RawCandidate.sourceSeries()` is always `null`) shall have an empty `List<SeriesEntity>` (`List.of()`), never `null` — every `sourceSeries == null` check elsewhere in `RecommendationService` is replaced by `sourceSeries.isEmpty()`.
- **SERIES-015-AC-04** [AUTO]: A candidate first encountered from a title-based source shall have that source as the sole initial element of its accumulated list (i.e. the first-seen `RawCandidate.sourceSeries()`, when non-null, seeds the list rather than being dropped in favor of only tracking later duplicates).

---

### Requirement 2: Canonical Per-Candidate Source Ordering

**User story**: As a developer, I want one shared, reused ordering rule for a candidate's contributing sources, so scoring, the diversity cap, and the label data can never disagree about which source is "best."

#### Acceptance Criteria

- **SERIES-015-AC-05** [AUTO]: `RecommendationService` shall order each candidate's accumulated `List<SeriesEntity>` by `personalRating` descending (nulls last), then `dateCompleted` descending (nulls last) — reusing the exact `Comparator` `resolveSourcePool` (`series_spec_007` SERIES-007-AC-19) already builds for pool ordering, not a separately-written duplicate comparator.
- **SERIES-015-AC-06** [AUTO]: This ordering shall be computed once per candidate and used, unmodified, by all three of: the scoring term (Requirement 3), `best-source` diversity-cap mode (Requirement 5), and `RecommendationDto.sourceTitles`/`totalSourceCount` (Requirement 4).

---

### Requirement 3: Scoring Uses the Best-Rated Contributing Source

**User story**: As a user, I want a candidate's rank to reflect my highest-rated relevant show, not an arbitrary one, when several of my watched series suggested it.

#### Acceptance Criteria

- **SERIES-015-AC-07** [AUTO]: `score()`'s personal-rating term shall be computed as the maximum `personalRating` among all of a candidate's contributing sources (equivalently, the first entry's `personalRating` under the canonical ordering from `SERIES-015-AC-05`) — `0` if the accumulated source list is empty or none of its entries have a `personalRating` set, matching today's "no rated source → no term" behavior, just now maximized across every contributing source instead of reading whichever single source survived dedup.
- **SERIES-015-AC-08** [AUTO]: `score()`'s blend formula itself — `rankScore = (tmdbRating × 0.5) + (personalRatingTerm × 0.5)` for a candidate with a non-empty source list, `rankScore = tmdbRating` for one with an empty source list (`series_spec_007` SERIES-007-AC-21) — is unchanged; only the derivation of `personalRatingTerm` changes per `SERIES-015-AC-07`.

---

### Requirement 4: `RecommendationDto.sourceTitles`/`totalSourceCount`

**User story**: As a future frontend consumer, I want the raw list of contributing source titles (capped) and the true total count, so I can build a "Because you watched X, Y and N more" label without re-deriving attribution myself.

#### Acceptance Criteria

- **SERIES-015-AC-09** [AUTO]: `RecommendationDto`'s single `sourceTitle: String` field shall be replaced by `sourceTitles: List<String>` and `totalSourceCount: Integer`.
- **SERIES-015-AC-10** [AUTO]: `sourceTitles` shall contain the first `effectiveMaxSourcesShown` (`SERIES-015-AC-13`) titles from the candidate's canonically-ordered source list (`SERIES-015-AC-05`), best-first — an empty list, never `null`, when the candidate's accumulated source list is empty.
- **SERIES-015-AC-11** [AUTO]: `totalSourceCount` shall be the *uncapped* count of distinct contributing sources for the candidate — `0` for a candidate whose accumulated source list is empty. It is unaffected by `maxSourcesShown`/`effectiveMaxSourcesShown`, which only caps `sourceTitles`.
- **SERIES-015-AC-12** [AUTO]: `RecommendationCriteria` shall gain a `maxSourcesShown: Integer` field (nullable; unset means "use the default"), following the same shape/style as the existing `maxPerSource` field.
- **SERIES-015-AC-13** [AUTO]: `RecommendationService` shall gain a `DEFAULT_MAX_SOURCES_SHOWN = 3` constant (matching `DEFAULT_MAX_PER_SOURCE`'s style) and resolve an effective value the same way `maxPerSource` already is resolved: `criteria.getMaxSourcesShown() != null ? criteria.getMaxSourcesShown() : DEFAULT_MAX_SOURCES_SHOWN`.

---

### Requirement 5: Two Diversity-Cap Modes

**User story**: As a developer tuning recommendation diversity, I want to choose whether the per-source cap only looks at each candidate's single best source or at every contributing source, so I can make the cap stricter without a code change.

#### Acceptance Criteria

- **SERIES-015-AC-14** [AUTO]: `RecommendationService`'s constructor shall gain a new parameter, `@Value("${app.recommendations.diversity-cap-mode:best-source}") String diversityCapMode`, following the same constructor-injected `@Value`-with-default pattern already used for `app.tmdb.max-source-series`/`app.tmdb.max-candidates` (`series_spec_007` SERIES-007-AC-01/02).
- **SERIES-015-AC-15** [AUTO]: While `diversityCapMode` resolves to `"best-source"` (the default), `applyDiversityCap` shall check/increment only each candidate's *best* contributing source — the first entry under the canonical ordering (`SERIES-015-AC-05`) — against the per-source count, admitting the candidate if that source's count is below `maxPerSource` and incrementing only that source's count on admission. This is functionally identical to `series_spec_007`'s existing `applyDiversityCap` behavior (SERIES-007-AC-22), now reading the first entry of a list instead of a single field.
- **SERIES-015-AC-16** [AUTO]: While `diversityCapMode` resolves to `"all-sources"`, `applyDiversityCap` shall admit a candidate only if *none* of its contributing sources' titles are already at `maxPerSource`, and on admission shall increment the count for *every* one of that candidate's contributing source titles (not just the best one).
- **SERIES-015-AC-17** [AUTO]: Under either mode, a candidate whose accumulated source list is empty (`SERIES-015-AC-03`) shall not be subject to the diversity cap and shall always be admitted — matching `series_spec_007`'s existing behavior for a `null` `sourceTitle` (SERIES-007-AC-22).
- **SERIES-015-AC-18** [AUTO]: Any `diversityCapMode` value other than exactly `"all-sources"` shall be treated as `"best-source"` — no startup validation/rejection of an unrecognized value.

---

### Requirement 6: `sortBy` — Sorting by Recommendation Count

**User story**: As a user, I want to optionally see the candidates recommended by the most of my watched series first, as an alternative to the default rank-score ordering.

#### Acceptance Criteria

- **SERIES-015-AC-19** [AUTO]: `RecommendationCriteria` shall gain a `sortBy: String` field (nullable), with two recognized values: `"score"` (default — sort by `rankScore` descending, `series_spec_007` SERIES-007-AC-21's existing behavior) and `"recommendationCount"` (sort by `totalSourceCount` descending, using `rankScore` descending as a tiebreaker when counts are equal).
- **SERIES-015-AC-20** [AUTO]: Any `sortBy` value other than exactly `"recommendationCount"` shall be treated as `"score"` — same soft-fallback posture as `diversityCapMode` (`SERIES-015-AC-18`).
- **SERIES-015-AC-21** [AUTO]: The `recommend()` pipeline's single ranking-sort step (currently `.sorted(Comparator.comparingDouble(ScoredCandidate::rankScore).reversed())`) shall branch on `criteria.getSortBy()` per `SERIES-015-AC-19`/`AC-20`, reading `sc.dto().totalSourceCount()` for the `"recommendationCount"` comparator — no new field is added to `ScoredCandidate` for this.
- **SERIES-015-AC-22** [AUTO]: The diversity cap (Requirement 5) and the final `limit` truncation shall still apply, in the same order, after this sort regardless of which `sortBy` mode was used — unaffected by which mode ordered the list beforehand.

---

### Requirement 7: Endpoint Parameter Wiring

**User story**: As an API consumer, I want to control `maxSourcesShown` and `sortBy` per request through the existing recommendations endpoint.

#### Acceptance Criteria

- **SERIES-015-AC-23** [AUTO]: `GET /api/v1/series/recommendations` shall accept, in addition to its existing params (`series_spec_007` SERIES-007-AC-30), optional `maxSourcesShown` (integer) and `sortBy` (string) parameters, wired into `RecommendationCriteria` the same way every other optional param already is.
- **SERIES-015-AC-24** [AUTO]: A malformed (non-numeric) `maxSourcesShown` value shall result in `400 Bad Request`, via the existing `MethodArgumentTypeMismatchException` → 400 handling in `GlobalExceptionHandler` (`series_spec_007` SERIES-007-AC-31). An unrecognized `sortBy` string value is not an error (`SERIES-015-AC-20`).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationService`, `DedupedCandidate`/`RawCandidate`, `dedupeAndExclude`, `resolveSourcePool`'s comparator, `score()`, `applyDiversityCap`, `RecommendationDto`, `RecommendationCriteria.maxPerSource`'s shape/resolution pattern, `GET /api/v1/series/recommendations` base contract | `series_spec_007_recommendation_sourcing.md` |
| `RecommendationService.recommend()`, `RecommendationDto`, `RecommendationCriteria`, watched-pool/dedupe/genre-supplement design | `series_spec_006_recommendations.md` |
| `SeriesEntity.personalRating` (`1`–`5`, nullable), `dateCompleted`, `genres` comma-separated string convention | `series_spec_001_entity.md` |
| `app.tmdb.*`/constructor-injected `@Value`-with-default config pattern this spec's `app.recommendations.diversity-cap-mode` follows | `series_spec_005_omdb_lookup.md`, `series_spec_007_recommendation_sourcing.md` Requirement 1 |
| Invalid/malformed-parameter → `400` validation style, `MethodArgumentTypeMismatchException` handling | `series_spec_003_search.md`, `series_spec_007_recommendation_sourcing.md` Requirement 9 |
| Never-leak-internals policy for upstream failures | `tooling_spec_001_code_quality_security.md` Requirement 1 |
| Paired frontend consumer — builds the "Because you watched X, Y and N more" label from `sourceTitles`/`totalSourceCount` | `frontend_spec_019_multi_source_recommendations.md` (not yet written) |

---

## TDD Test Case Sketches

### `RecommendationServiceSpec.groovy` (Requirement 1 — accumulation during dedup)

```groovy
def "SERIES-015-AC-02/04: a candidate recommended by two watched series accumulates both as sources"() {
    given: "two COMPLETED series, both recommending the same candidate (same resolved imdbId)"
        def alice = completedSeries("Show A", "tt1000001", LocalDateTime.now(), null, 5)
        def bob = completedSeries("Show B", "tt1000002", LocalDateTime.now(), null, 3)
        seriesRepository.findAll() >> [alice, bob]
        tmdbClient.findTvIdByImdbId("tt1000001") >> Optional.of(10)
        tmdbClient.findTvIdByImdbId("tt1000002") >> Optional.of(20)
        tmdbClient.recommendations(10) >> [candidate(999, "Shared Candidate")]
        tmdbClient.recommendations(20) >> [candidate(999, "Shared Candidate")]
        tmdbClient.externalIds(999) >> Optional.of("tt9999999")
        seriesRepository.existsByImdbId("tt9999999") >> false
        ignoredSeriesRepository.existsByImdbId("tt9999999") >> false

    when: "recommend(20) is called"
        def results = recommendationService.recommend(20)

    then: "the candidate appears once, attributed to both series"
        results.size() == 1
        results[0].totalSourceCount() == 2
        results[0].sourceTitles().containsAll(["Show A", "Show B"])
}

def "SERIES-015-AC-03: a genre/keyword-sourced-only candidate has an empty sourceTitles list, not null"() {
    given: "no watched series exist; a genres-directed request"
        def criteria = new RecommendationCriteria(genres: ["Drama"])
        tmdbClient.discover(_, _) >> [candidate(500)]
        tmdbClient.externalIds(500) >> Optional.of("tt5005005")
        seriesRepository.existsByImdbId("tt5005005") >> false
        ignoredSeriesRepository.existsByImdbId("tt5005005") >> false

    when: "recommend(20, criteria) is called"
        def results = recommendationService.recommend(20, criteria)

    then: "the candidate has an empty, non-null sourceTitles and totalSourceCount 0"
        results[0].sourceTitles() == []
        results[0].totalSourceCount() == 0
}
```

### `RecommendationServiceSpec.groovy` (Requirement 2 — canonical ordering)

```groovy
def "SERIES-015-AC-05: contributing sources are ordered personalRating desc, dateCompleted desc, matching resolveSourcePool's comparator"() {
    given: "three watched series recommending the same candidate: rating 2, rating 5, rating null"
        def low = completedSeries("Low Rated", "tt2000001", LocalDateTime.now().minusDays(1), null, 2)
        def high = completedSeries("High Rated", "tt2000002", LocalDateTime.now().minusDays(2), null, 5)
        def unrated = completedSeries("Unrated", "tt2000003", LocalDateTime.now(), null, null)
        seriesRepository.findAll() >> [low, high, unrated]
        // ... each resolves and recommends the same tmdb candidate (999) ...

    when: "recommend(20) is called"
        def results = recommendationService.recommend(20)

    then: "sourceTitles is ordered High Rated, Low Rated, Unrated"
        results[0].sourceTitles() == ["High Rated", "Low Rated", "Unrated"]
}
```

### `RecommendationServiceSpec.groovy` (Requirement 3 — scoring)

```groovy
def "SERIES-015-AC-07: the personal-rating scoring term uses the max rating among all contributing sources"() {
    given: "a candidate recommended by a 2-star series and, separately, a 5-star series"
        def lowRated = completedSeries("Low", "tt3000001", LocalDateTime.now(), null, 2)
        def highRated = completedSeries("High", "tt3000002", LocalDateTime.now(), null, 5)
        seriesRepository.findAll() >> [lowRated, highRated]
        // both resolve and recommend the same candidate (tmdbRating 5.0) ...

    when: "recommend(20) is called"
        def results = recommendationService.recommend(20)

    then: "rankScore reflects the 5-star source, not the 2-star one"
        // (5.0 * 0.5) + (5 * 2 * 0.5) = 7.5, not (5.0 * 0.5) + (2 * 2 * 0.5) = 4.5
        // asserted indirectly via ranking order against a lower-scoring control candidate
}
```

### `RecommendationServiceSpec.groovy` (Requirement 4 — `sourceTitles`/`totalSourceCount`/`maxSourcesShown`)

```groovy
def "SERIES-015-AC-10/13: sourceTitles is capped to the effective maxSourcesShown, best-first"() {
    given: "a candidate recommended by 5 distinct watched series with descending ratings"
        // series rated 5, 4, 3, 2, 1, all recommending the same candidate

    when: "recommend(20) is called with no maxSourcesShown override (default 3)"
        def results = recommendationService.recommend(20)

    then: "sourceTitles contains only the 3 best-rated sources' titles, in order"
        results[0].sourceTitles().size() == 3

    and: "totalSourceCount reflects the true uncapped count"
        results[0].totalSourceCount() == 5
}

def "SERIES-015-AC-12/13: maxSourcesShown overrides the default cap on sourceTitles only"() {
    given: "the same 5-source candidate as above"
        // ...

    when: "recommend(20, criteria: [maxSourcesShown: 2]) is called"
        def results = recommendationService.recommend(20, new RecommendationCriteria(maxSourcesShown: 2))

    then: "sourceTitles is capped to 2, but totalSourceCount is still 5"
        results[0].sourceTitles().size() == 2
        results[0].totalSourceCount() == 5
}
```

### `RecommendationServiceSpec.groovy` (Requirement 5 — diversity-cap modes)

```groovy
def "SERIES-015-AC-15: best-source mode caps on each candidate's best contributing source only (default behavior unchanged)"() {
    given: "diversityCapMode defaults to best-source; one well-represented best source, maxPerSource 1"
        def service = new RecommendationService(seriesRepository, ignoredSeriesRepository, tmdbClient,
            new TmdbGenreTable(), 20, 50, "best-source")
        // a 5-star source producing candidates X and Y, each also co-recommended by a weaker second source

    when: "recommend(20) is called"
        def results = service.recommend(20)

    then: "only 1 of X/Y survives -- the cap keyed off the shared best source"
        results.size() == 1
}

def "SERIES-015-AC-16: all-sources mode excludes a candidate if any contributing source is already at the cap"() {
    given: "diversityCapMode is all-sources; maxPerSource 1"
        def service = new RecommendationService(seriesRepository, ignoredSeriesRepository, tmdbClient,
            new TmdbGenreTable(), 20, 50, "all-sources")
        // candidate A sourced solely by series S (admitted, S's count -> 1)
        // candidate B co-sourced by series S and series T -- S is already at the cap

    when: "recommend(20) is called"
        def results = service.recommend(20)

    then: "candidate B is excluded even though T alone hasn't hit the cap"
        results*.title() == ["Candidate A"]
}

def "SERIES-015-AC-17: a candidate with no watched-series source is never capped, under either mode"() {
    given: "a genre-sourced-only candidate alongside an unrelated capped watched-series candidate"
        // ...

    when: "recommend(20) is called"
        def results = recommendationService.recommend(20)

    then: "the genre-sourced candidate is always present"
        results*.title().contains("Genre-Sourced Candidate")
}

def "SERIES-015-AC-18: an unrecognized diversityCapMode value falls back to best-source"() {
    given: "diversityCapMode is configured as 'bogus-mode'"
        def service = new RecommendationService(seriesRepository, ignoredSeriesRepository, tmdbClient,
            new TmdbGenreTable(), 20, 50, "bogus-mode")
        // same fixture as the best-source test above

    expect: "behavior matches best-source mode, not all-sources"
        service.recommend(20).size() == 1
}
```

### `RecommendationServiceSpec.groovy` (Requirement 6 — `sortBy`)

```groovy
def "SERIES-015-AC-19/21: sortBy=recommendationCount orders by totalSourceCount descending, rankScore as tiebreak"() {
    given: "candidate A recommended by 3 sources (lower rankScore), candidate B recommended by 1 (higher rankScore)"
        // ...

    when: "recommend(20, criteria: [sortBy: 'recommendationCount']) is called"
        def results = recommendationService.recommend(20, new RecommendationCriteria(sortBy: "recommendationCount"))

    then: "candidate A (3 sources) is ranked ahead of candidate B (1 source), despite the lower rankScore"
        results[0].title() == "Candidate A"
}

def "SERIES-015-AC-20: an unrecognized sortBy value falls back to score-based sorting"() {
    given: "the same fixture as above"
        // ...

    when: "recommend(20, criteria: [sortBy: 'bogus']) is called"
        def results = recommendationService.recommend(20, new RecommendationCriteria(sortBy: "bogus"))

    then: "candidate B (higher rankScore) is ranked ahead of candidate A"
        results[0].title() == "Candidate B"
}

def "SERIES-015-AC-22: the diversity cap and limit still apply after a recommendationCount sort"() {
    given: "sortBy=recommendationCount, plus enough candidates from one source to exceed maxPerSource"
        // ...

    when: "recommend(2, criteria: [sortBy: 'recommendationCount']) is called"
        def results = recommendationService.recommend(2, new RecommendationCriteria(sortBy: "recommendationCount"))

    then: "the diversity cap is still enforced and the result is still truncated to 2"
        results.size() <= 2
}
```

### `SeriesControllerRecommendationsSpec.groovy` (Requirement 7 — endpoint wiring)

```groovy
def "SERIES-015-AC-23: maxSourcesShown and sortBy are accepted and passed through to RecommendationCriteria"() {
    when: "GET /api/v1/series/recommendations?maxSourcesShown=2&sortBy=recommendationCount is requested"
        def response = client.get()
            .uri("/api/v1/series/recommendations?maxSourcesShown=2&sortBy=recommendationCount")
            .exchange()

    then: "the request succeeds"
        response.expectStatus().isOk()
}

def "SERIES-015-AC-24: a non-numeric maxSourcesShown returns 400"() {
    when: "GET /api/v1/series/recommendations?maxSourcesShown=abc is requested"
        def response = client.get().uri("/api/v1/series/recommendations?maxSourcesShown=abc").exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()
}
```

---

## Acceptance Criteria Summary

- [x] SERIES-015-AC-01: `DedupedCandidate.sourceSeries` becomes `List<SeriesEntity>`
- [x] SERIES-015-AC-02: `dedupeAndExclude` appends duplicate sources instead of discarding them
- [x] SERIES-015-AC-03: genre/keyword-only candidates get an empty list, never `null`
- [x] SERIES-015-AC-04: first-seen source seeds the accumulated list
- [x] SERIES-015-AC-05: canonical source ordering reuses `resolveSourcePool`'s comparator
- [x] SERIES-015-AC-06: ordering computed once, shared by scoring/diversity-cap/DTO
- [x] SERIES-015-AC-07: personal-rating scoring term uses the max rating across all sources
- [x] SERIES-015-AC-08: `score()`'s blend formula itself is unchanged
- [x] SERIES-015-AC-09: `RecommendationDto.sourceTitle` replaced by `sourceTitles`/`totalSourceCount`
- [x] SERIES-015-AC-10: `sourceTitles` is capped, best-first, never `null`
- [x] SERIES-015-AC-11: `totalSourceCount` is the true uncapped count
- [x] SERIES-015-AC-12: `RecommendationCriteria.maxSourcesShown` field added
- [x] SERIES-015-AC-13: `DEFAULT_MAX_SOURCES_SHOWN = 3` + effective-value resolution
- [x] SERIES-015-AC-14: `app.recommendations.diversity-cap-mode` config (`@Value`, default `best-source`)
- [x] SERIES-015-AC-15: `best-source` mode caps on each candidate's best source only
- [x] SERIES-015-AC-16: `all-sources` mode admits/increments across every contributing source
- [x] SERIES-015-AC-17: candidates with no sources are never capped, under either mode
- [x] SERIES-015-AC-18: unrecognized `diversityCapMode` value falls back to `best-source`
- [x] SERIES-015-AC-19: `RecommendationCriteria.sortBy` field (`score`/`recommendationCount`)
- [x] SERIES-015-AC-20: unrecognized `sortBy` value falls back to `score`
- [x] SERIES-015-AC-21: `recommend()`'s sort step branches on `sortBy`
- [x] SERIES-015-AC-22: diversity cap and `limit` still apply after either sort mode
- [x] SERIES-015-AC-23: `maxSourcesShown`/`sortBy` accepted as endpoint query params
- [x] SERIES-015-AC-24: malformed `maxSourcesShown` → 400

---

## Implementation Notes

- `RecommendationService.ScoredCandidate` gained a third field, `allSourceTitles: List<String>`
  (the full, uncapped, canonically-ordered list of contributing source titles), alongside `dto`
  and `rankScore`. This wasn't explicitly prescribed by the spec, but is necessary: `dto()`'s
  own `sourceTitles` is already capped to `effectiveMaxSourcesShown` (default 3) for display,
  while `"all-sources"` diversity-cap mode (`SERIES-015-AC-16`) must check/increment *every*
  contributing source, including any beyond that display cap. The spec's "no new field is
  added to `ScoredCandidate`" note (under `SERIES-015-AC-21`) is scoped specifically to the
  `sortBy` comparator, which does read `sc.dto().totalSourceCount()` directly as specified;
  it does not preclude a field serving the diversity cap.
- `app.recommendations.diversity-cap-mode` was also added as an explicit (commented) entry in
  `backend/src/main/resources/application.yml`, defaulted to `best-source`, mirroring how
  `app.tmdb.max-source-series`/`app.tmdb.max-candidates` are documented there rather than left
  as bare `@Value` defaults only.
