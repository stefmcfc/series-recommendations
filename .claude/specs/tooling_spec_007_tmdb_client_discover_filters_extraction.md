# Tooling Spec 007: Extract `TmdbClient.discover()`'s Filter-Param Building

**Status**: Implemented — pending SonarQube re-scan confirmation
**Priority**: P2 (repo hygiene — doesn't block product feature work, but flagged twice now: this
spec exists specifically because SonarQube's 2026-08-28 report notes `TmdbClient` has racked up
repeat Cognitive Complexity flags "across separate sweeps now... TmdbClient specifically has shown
up in this report and the very first backend one")
**Depends on**: none — pure internal refactor of an already-implemented method
**Area**: Backend (`client/TmdbClient.java`)

## Overview

`TmdbClient.discover()` (`backend/src/main/java/uk/co/stefirby/seriestracker/client/TmdbClient.java`,
currently lines 158–188) is flagged by SonarQube (`java:S3776`) at Cognitive Complexity 20 against
the allowed 15. The method builds a `discover/tv` request URI as one long chain inside a single
`UriBuilder` lambda: two conditions for `genreIds`/`keywordIds`, then six more for
`DiscoverFilters`' fields (`minVoteCount`, `minTmdbRating`, `yearMin`, `yearMax`, `language`,
`countries`) — each `if` trivial in isolation (a null/blank/empty check guarding one
`queryParam(...)` call), but the method's complexity score climbs with every filter this app adds,
since each new Custom Search filter spec (`series_spec_031` added 3 conditions, `series_spec_032`
added 2 more) grows this same method further. This is a mechanical, low-risk fix — split the
`DiscoverFilters`-specific conditions into their own private helper, mirroring the pattern this
project already uses on the frontend for the exact same shape of problem
(`RecommendationControls.tsx`'s `applyRatingAndRangeFilters`/`applyExcludeAndMiscFilters`, both
already extracted from `buildQuery` for the same "flat sequence of optional field appends" reason).

**Confirmed via reading the current method** (not assumed): `genreIds`/`keywordIds` are `discover()`
call-site parameters (present since before `DiscoverFilters` existed, from the genre/keyword-directed
sourcing spec), while every other conditional operates on the `DiscoverFilters filters` parameter
introduced by `series_spec_031`. This is a natural, pre-existing seam — no field grouping needs
inventing, `DiscoverFilters` already is exactly the record whose fields drive the six conditions to
extract.

## Design Decisions

- **New private static method `applyDiscoverFilters(UriBuilder b, DiscoverFilters filters)`**,
  returning the `UriBuilder` (matching the existing lambda's own "reassign `b` after each
  `queryParam` call" style — `UriBuilder`'s fluent methods return a new builder, not a mutated one).
  Takes over exactly the six `DiscoverFilters`-derived conditions; `discover()` itself keeps the
  `genreIds`/`keywordIds` conditions (call-site parameters, not part of `DiscoverFilters`) and the
  unconditional `sort_by` param, then delegates the rest to the new method in one call.
- **No behavior change of any kind** — same param names, same value formatting (`air_date.gte`
  formatted as `{yearMin}-01-01`, `with_origin_country` pipe-joined per the `series_spec_032`
  correction), same omit-when-absent conditions for every field. This is purely moving code, not
  changing what it does.
- **Not a `DiscoverFilters` instance method.** `DiscoverFilters` is a plain record (parameter
  object) with no `TmdbClient`/`UriBuilder` dependency today, and giving it one would pull an
  HTTP-client-specific type (`org.springframework.web.util.UriBuilder`) into `client/`'s data
  shape — `applyDiscoverFilters` stays a private static helper on `TmdbClient` itself, alongside
  `joinIds` (the existing private static helper right below `discover()`).

---

## Requirement 1: `discover()`'s filter-building logic is extracted, behavior unchanged

**User story**: As a developer adding a future Custom Search filter, I want `discover()`'s own
complexity to stop growing with every new `DiscoverFilters` field, so this class doesn't keep
resurfacing on every SonarQube sweep.

### TOOLING-007-AC-01 [AUTO]
**Statement**: A new private static `TmdbClient.applyDiscoverFilters(UriBuilder, DiscoverFilters)`
shall apply exactly the six `DiscoverFilters`-derived query params (`vote_count.gte`,
`vote_average.gte`, `air_date.gte`, `air_date.lte`, `with_original_language`,
`with_origin_country`) under their existing omit-when-absent conditions, identical to `discover()`'s
current inline logic.

**References**: `TmdbClient.java`'s current `discover()` body (lines 158–188).

**Test Case (Red)**: none new — this is a pure internal extraction with no new observable behavior;
covered by the regression guard (AC-02) against the existing `TmdbClientSpec.groovy` suite, which
already asserts each of these six params individually (including the `series_spec_032`-corrected
pipe-join test for `with_origin_country`).

**Test Case (Green)**: move the six conditions verbatim into the new method; `discover()` calls
`b = applyDiscoverFilters(b, filters)` once, after its own `genreIds`/`keywordIds` handling.

---

### TOOLING-007-AC-02 [AUTO]
**Statement**: Every existing `TmdbClientSpec.groovy` test covering `discover()` shall pass
unmodified after the extraction — this spec changes no request URI, no param name, no param value
formatting, and no method signature `discover()` callers depend on.

**References**: `backend/src/test/groovy/uk/co/stefirby/seriestracker/client/TmdbClientSpec.groovy`
(the `SERIES-031-AC-*`/`SERIES-032-AC-*` `discover()`-focused tests, plus the pre-existing
`with_genres`/`with_keywords`/`vote_count.gte` tests predating `DiscoverFilters`).

**Test Case (Red)**: none new — regression guard.
**Test Case (Green)**: `gradlew.bat test` — full Spock suite green, zero test file changes needed
for `TmdbClientSpec.groovy`.

---

### TOOLING-007-AC-03 [AUTO]
**Statement**: `discover()`'s own Cognitive Complexity shall drop to within SonarQube's allowed
threshold (≤15, down from the flagged 20).

**References**: SonarQube rule `java:S3776`, flagged at `TmdbClient.java` line 158 in
`.sonar-report/sonar-report-2026-08-28.md`.

**Test Case (Red)**: none — verified via IDE/SonarQube re-scan after implementation, not an
automated test.
**Test Case (Green)**: re-run SonarQube analysis (IDE plugin or next report); `discover()` no
longer appears in the Cognitive Complexity findings.

---

## Cross-References

| This spec | Source |
|---|---|
| `DiscoverFilters` record, its six fields this spec's extraction operates on | `series_spec_031_custom_search_prefetch_filters.md`, `series_spec_032_custom_search_language_country_filters.md` |
| `with_origin_country`'s pipe-join correction, preserved unchanged by this extraction | `series_spec_032_custom_search_language_country_filters.md`'s Status header Verification note |
| The frontend precedent for this exact extraction shape (`applyRatingAndRangeFilters`/`applyExcludeAndMiscFilters`) | `frontend_spec_046_custom_search_prefetch_filters_ui.md` |
| Flagged by | `.sonar-report/sonar-report-2026-08-28.md` |

---

## Acceptance Criteria Summary

- [x] TOOLING-007-AC-01: `applyDiscoverFilters` extracted, identical behavior
- [x] TOOLING-007-AC-02: existing `TmdbClientSpec.groovy` tests pass unmodified
- [ ] TOOLING-007-AC-03: `discover()`'s Cognitive Complexity drops to ≤15
