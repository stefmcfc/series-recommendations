# Series Spec 071: Include Already-Tracked Series in Recommendations

**Status**: Not started
**Priority**: P3 (new discovery feature, no existing behavior broken if unused — the new criteria
field defaults to today's exact behavior when absent)
**Depends on**: `series_spec_006_recommendations.md` (base recommendation pipeline),
`series_spec_015_multi_source_recommendations.md` (`DedupedCandidate`/source attribution shape),
`series_spec_059_incremental_backfill_dedup.md` (per-page dedup in the three backfill-sourced
modes) — extends all of these rather than replacing any of them
**Backend Task**: yes — pairs with `frontend_spec_138_recommendation_include_already_tracked_toggle.md`

## Overview

`GET /api/v1/series/recommendations` currently drops any candidate the user already has tracked
(any status) or has ignored, unconditionally and silently, inside
`RecommendationDeduplicationService.dedupeAndExclude`:

```java
if (seriesRepository.existsByImdbId(imdbId) || ignoredSeriesRepository.existsByImdbId(imdbId)) {
    return;
}
```

There is no way to ask "what would this sourcing mode have recommended, including series I
already have?" — useful for sanity-checking why a title isn't showing up (it's not missing, it's
already tracked), or just browsing "Use My Series"/Custom Search/Trending/Highest Rated results
with full context. This spec adds an opt-in `includeAlreadyTracked` request flag that bypasses
*only* the already-tracked half of that check (the already-ignored half stays absolute — ignored
series remain permanently excluded regardless, per `series_spec_034_exclude_from_recommendations_
enforcement.md`'s existing "ignored is an absolute rule" precedent) and attaches enough of the
matched series' own data (`id`, `status`, `personalRating`) to the response for the frontend to
render it distinctly rather than as an indistinguishable normal candidate.

Because the already-tracked/already-ignored check lives in exactly one shared method
(`RecommendationDeduplicationService.dedupeAndExclude`), called by every sourcing path (`Use My
Series`'s `sourceAndFilterFromPool`, and all three backfill-sourced modes' `sourceWithBackfill`
via `RecommendationSourcingService`), this flag works identically across all four Discover/Use My
Series modes with no per-mode special-casing.

## Design Decisions

- **Bypasses only the already-tracked check, never the already-ignored check.** Ignored series are
  an intentional, user-initiated "never show me this again" — `series_spec_034` already made that
  rule absolute even for explicit hand-picking. This flag is about surfacing your own tracked
  library, not resurfacing dismissed suggestions; those are different, unrelated pieces of user
  intent and this spec doesn't touch the ignored-exclusion branch at all.
- **Already-tracked candidates still flow through every existing filter/ranking/diversity-cap
  step unchanged** — `RecommendationOutputFilterService`'s quality filters (`minTmdbRating`,
  `excludeGenres`, `excludeKeywords`, etc.), `RecommendationRankingService`'s scoring/sort/
  diversity cap, and `maxCandidates` truncation all apply exactly as they do to any other
  candidate. Exempting already-tracked candidates from filtering would need a second parallel
  code path through the entire pipeline for no clear benefit — a candidate you already have that
  also happens to fail your own quality bar isn't especially interesting to resurface either.
- **The matched `SeriesEntity` is carried through the pipeline as a new nullable field on
  `DedupedCandidate`, not fetched again at DTO-assembly time.** `dedupeAndExclude` already does
  the `imdbId` lookup to decide inclusion/exclusion; when `includeAlreadyTracked` is true and a
  match exists, it fetches the entity once (via a new `SeriesRepository.findByImdbId`, mirroring
  the existing `existsByImdbId` derived-query convention) and threads it straight through — no
  second per-candidate query later in `RecommendationDtoAssembler`.
- **Three new `RecommendationDto` fields (`trackedSeriesId`, `trackedStatus`,
  `trackedPersonalRating`), all `null` unless the flag was set and this specific candidate matched
  — never a separate boolean "isTracked" field.** A consumer can already test
  `trackedSeriesId != null`; a fourth field would just be redundant. Types/serialization mirror
  `SeriesDto`'s own existing conventions exactly (`status` as its enum name `String`,
  `personalRating` as `Integer`) rather than inventing a new representation for the same data.
- **`includeAlreadyTracked` is a plain `Boolean` on `RecommendationCriteria`, absent/`false` means
  today's exact existing behavior** — no migration concern, no behavior change for any existing
  caller that doesn't set it.
- **No new validation needed in `RecommendationCriteriaValidator`.** A boolean has no invalid
  values, and it has no mutual-exclusivity interaction with `sourceMode`/`genres`/`keywords`/
  `seriesIds` — it's an orthogonal, always-applicable modifier to the exclusion step every mode
  already shares.

---

## Requirement 1: `includeAlreadyTracked` request flag

**User story**: As a user, I want to optionally see recommendations for series I already have
tracked, so I can sanity-check a sourcing mode's results or just browse with full context.

### SERIES-071-AC-01 [AUTO]
**Statement**: `RecommendationCriteria` shall expose a `Boolean includeAlreadyTracked` field,
read from `GET /api/v1/series/recommendations`'s `includeAlreadyTracked` query parameter;
absent/`null`/`false` shall behave identically to today (already-tracked candidates excluded).

**References**: `RecommendationCriteria` (existing boolean-shaped fields have no precedent yet on
this DTO — mirrors `SeriesSearchCriteria`'s general "absent means no override" convention this
class's own Javadoc already states).

**Test Case (Red)**:
```groovy
def "SERIES-071-AC-01: includeAlreadyTracked defaults to excluding already-tracked candidates"() {
    given: "a tracked series exists whose imdbId matches a would-be TMDB candidate"
        // ... seed SeriesEntity + stub TMDB response sharing the same imdb_id

    when: "GET /api/v1/series/recommendations is requested with no includeAlreadyTracked param"
        // ...

    then: "the already-tracked candidate is absent from the response, as today"
        // ...
}
```
**Test Case (Green)**: add the field to `RecommendationCriteria`, bound by
`SeriesController`/`SeriesRecommendationController`'s existing query-param-to-criteria mapping.

---

## Requirement 2: Bypass already-tracked exclusion, keep already-ignored exclusion absolute

**User story**: As a user, I want the toggle to only affect series I've added, never series I've
explicitly dismissed.

### SERIES-071-AC-02 [AUTO]
**Statement**: While `includeAlreadyTracked` is `true`, `RecommendationDeduplicationService.
dedupeAndExclude` shall not exclude a candidate solely because `seriesRepository.
existsByImdbId(imdbId)` is `true`.

**References**: `RecommendationDeduplicationService.accumulateCandidate` (the method containing
today's unconditional early-return).

**Test Case (Red)**:
```groovy
def "SERIES-071-AC-02: includeAlreadyTracked=true surfaces an already-tracked candidate"() {
    given: "a tracked series exists whose imdbId matches a would-be TMDB candidate"
        // ...

    when: "GET /api/v1/series/recommendations?includeAlreadyTracked=true is requested"
        // ...

    then: "the already-tracked candidate is present in the response"
        // ...
}
```
**Test Case (Green)**: thread `criteria.getIncludeAlreadyTracked()` into `dedupeAndExclude`
(both call sites already have `criteria` in scope — `sourceAndFilterFromPool` directly,
`sourceWithBackfill` via its own `RecommendationCriteria c` parameter), replacing the
unconditional `existsByImdbId` short-circuit with one gated by the flag.

---

### SERIES-071-AC-03 [AUTO]
**Statement**: Regardless of `includeAlreadyTracked`, `RecommendationDeduplicationService.
dedupeAndExclude` shall continue to exclude any candidate where `ignoredSeriesRepository.
existsByImdbId(imdbId)` is `true`.

**References**: `series_spec_034_exclude_from_recommendations_enforcement.md` — the precedent this
AC re-affirms rather than changes.

**Test Case (Red)**:
```groovy
def "SERIES-071-AC-03: includeAlreadyTracked=true does not surface an ignored candidate"() {
    given: "an ignored series exists whose imdbId matches a would-be TMDB candidate"
        // ...

    when: "GET /api/v1/series/recommendations?includeAlreadyTracked=true is requested"
        // ...

    then: "the ignored candidate is still absent from the response"
        // ...
}
```
**Test Case (Green)**: no code change beyond AC-02's — the ignored-check branch is untouched.

---

## Requirement 3: Attach tracked-series data to the response

**User story**: As a user, I want an already-tracked recommendation to show my existing status and
rating for it, so I can tell at a glance it's not a new suggestion.

### SERIES-071-AC-04 [AUTO]
**Statement**: `DedupedCandidate` shall carry a new nullable `SeriesEntity trackedSeries` field,
populated (via a new `SeriesRepository.findByImdbId(String imdbId)`) exactly when
`includeAlreadyTracked` was `true` and the candidate matched an existing tracked series;
`null` otherwise.

**References**: `DedupedCandidate` record; new `SeriesRepository.findByImdbId`, mirroring the
existing `existsByImdbId` derived-query convention.

**Test Case (Red)**:
```groovy
def "SERIES-071-AC-04: findByImdbId resolves the tracked entity for a matched candidate"() {
    given: "a tracked series with a known imdbId"
        // ...

    expect: "findByImdbId returns that entity"
        seriesRepository.findByImdbId(knownImdbId).isPresent()
}
```
**Test Case (Green)**: add `Optional<SeriesEntity> findByImdbId(String imdbId)` to
`SeriesRepository`; populate `DedupedCandidate.trackedSeries` in `accumulateCandidate` when
matched under the flag.

---

### SERIES-071-AC-05 [AUTO]
**Statement**: `RecommendationDto` shall expose `String trackedSeriesId`, `String trackedStatus`,
and `Integer trackedPersonalRating`, populated from `DedupedCandidate.trackedSeries()` (`id.
toString()`, `status.name()`, `personalRating` respectively) when non-null, and `null` for all
three otherwise — mirroring `SeriesDto`'s existing `status`/`personalRating` serialization
conventions exactly.

**References**: `RecommendationDto`; `RecommendationDtoAssembler.toDto`; `SeriesDto` (the
serialization convention being mirrored).

**Test Case (Red)**:
```groovy
def "SERIES-071-AC-05: an already-tracked candidate's response carries its tracked fields"() {
    given: "a tracked series (WATCHING, personalRating 8) whose imdbId matches a candidate"
        // ...

    when: "GET /api/v1/series/recommendations?includeAlreadyTracked=true is requested"
        // ...

    then: "the matching result has trackedSeriesId/trackedStatus/trackedPersonalRating set"
        // trackedStatus == "WATCHING", trackedPersonalRating == 8

    and: "an ordinary (untracked) result in the same response has all three fields null"
        // ...
}
```
**Test Case (Green)**: extend `RecommendationDto`'s record components and
`RecommendationDtoAssembler.toDto`'s construction.

---

## Requirement 4: No exemption from existing filters/ranking

**User story**: As a user, I want already-tracked results to obey the same quality/ranking rules
as everything else, so the toggle doesn't flood results with low-quality matches just because
they're mine.

### SERIES-071-AC-06 [AUTO]
**Statement**: An already-tracked candidate surfaced via `includeAlreadyTracked=true` shall still
be subject to `RecommendationOutputFilterService`'s existing filters (`minTmdbRating`,
`excludeGenres`, `excludeKeywords`, `minVoteCount`, etc.) and, for "Use My Series" mode,
`RecommendationRankingService`'s scoring/diversity cap — identically to an untracked candidate.

**References**: `RecommendationOutputFilterService`, `RecommendationRankingService` — both
untouched by this spec; this AC pins down that they're untouched, not that new code is added.

**Test Case (Red)**:
```groovy
def "SERIES-071-AC-06: an already-tracked candidate below minTmdbRating is still excluded"() {
    given: "a tracked series whose candidate has a tmdbRating below the requested minTmdbRating"
        // ...

    when: "GET /api/v1/series/recommendations?includeAlreadyTracked=true&minTmdbRating=7 is requested"
        // ...

    then: "the low-rated already-tracked candidate is absent, same as any other low-rated candidate"
        // ...
}
```
**Test Case (Green)**: no code change — confirms the flag's implementation (AC-02) sits before,
not instead of, the existing output-filter/ranking stages already in the pipeline.

---

## Cross-References

| This spec | Source |
|---|---|
| The single shared exclusion method this spec modifies | `RecommendationDeduplicationService.dedupeAndExclude`/`accumulateCandidate` |
| Both call sites already having `RecommendationCriteria` in scope | `RecommendationService.sourceAndFilterFromPool`, `RecommendationSourcingService.sourceWithBackfill` |
| Precedent: ignored-series exclusion is an absolute rule, not overridable | `series_spec_034_exclude_from_recommendations_enforcement.md` |
| `status`/`personalRating` serialization convention mirrored by the new DTO fields | `SeriesDto` |
| Frontend pairing — toggle UI, card rendering, navigation | `frontend_spec_138_recommendation_include_already_tracked_toggle.md` |

---

## Acceptance Criteria Summary

- [ ] SERIES-071-AC-01: `RecommendationCriteria.includeAlreadyTracked`, absent/false = today's behavior
- [ ] SERIES-071-AC-02: `true` bypasses the already-tracked exclusion only
- [ ] SERIES-071-AC-03: already-ignored exclusion stays absolute regardless of the flag
- [ ] SERIES-071-AC-04: `DedupedCandidate.trackedSeries` + `SeriesRepository.findByImdbId`
- [ ] SERIES-071-AC-05: `RecommendationDto.trackedSeriesId`/`trackedStatus`/`trackedPersonalRating`
- [ ] SERIES-071-AC-06: already-tracked candidates still obey existing filters/ranking/diversity cap
