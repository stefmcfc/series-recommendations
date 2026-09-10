# Spec 057: Filter Profiles — Two New Areas (Custom Search, Analysis Filters)

**Status**: Implemented — `FilterProfileArea.java`, `FilterProfileEntitySpec.groovy`,
`FilterProfileControllerSpec.groovy`
**Priority**: P3 (extends an existing quality-of-life feature to two more contexts)
**Depends on**: `series_spec_055_filter_profiles.md` (the generic CRUD/entity/endpoints this
extends — already implemented and merged)
**Backend Task**

## Overview

`series_spec_055` established `FilterProfileArea` as a fixed three-value enum (`MY_SERIES`,
`USE_MY_SERIES`, `RECOMMENDATION_FILTERS`), each corresponding to one frontend filter context.
Two more frontend contexts now want the same saved-profile capability — Recommendations' Custom
Search mode (deliberately excluded from `frontend_spec_107`'s original scope, see that spec's
Overview: "Custom Search is fully excluded — the selector is hidden while `isCustomSearch`") and
the Analysis/Trends filters (`frontend_spec_096`'s shared `useNameStatsFilters`, which didn't exist
when `series_spec_055` was written). This spec adds two enum constants; nothing else in the
backend needs to change.

**Confirmed via reading the code that this really is that small**: `FilterProfileEntity.area` is
`@Enumerated(EnumType.STRING) @Column(nullable = false, length = 40)` — a plain `VARCHAR(40)`, no
DB-level `CHECK` constraint restricting it to the three current values (confirmed via
`V011__create_filter_profile_table.sql`, which declares `area VARCHAR(40) NOT NULL` with no
`CHECK`). `criteria` is already a fully opaque `JsonNode` blob the backend never interprets
(`series_spec_055`'s own Design Decisions: "One generic table, not three typed ones... the backend
never filters, sorts, or joins on individual criteria fields"). `FilterProfileService`/
`FilterProfileController`/`FilterProfileRepository` all operate generically on `FilterProfileArea`
with no per-area branching anywhere. Adding two more enum constants makes the existing generic CRUD
immediately work for both new areas, with no migration, no new endpoint, and no service/controller
change.

## Design Decisions

- **No new DB migration.** The `area` column was already a plain unconstrained `VARCHAR(40)` — a
  new enum constant is a pure Java-side change (`@Enumerated(EnumType.STRING)` serializes/
  deserializes by name automatically). `RECOMMENDATION_FILTERS` (18 chars) is the longest existing
  value; `ANALYSIS_FILTERS` (16 chars) and `CUSTOM_SEARCH` (13 chars) both fit within the existing
  `length = 40` bound with room to spare.
- **One `ANALYSIS_FILTERS` area, not three (one per Analysis tab).** Confirmed via reading
  `AnalysisView.tsx`: `useNameStatsFilters()` is instantiated exactly **once** and shared across
  all three `/analysis` sub-tabs (Keywords/Genres/Country-of-Origin) — `frontend_spec_096`'s own
  Design Decision for why filter/sort state survives a tab switch instead of being discarded per
  tab. Since the underlying state genuinely is one shared thing today, not three independent ones,
  a single saved-profile area matches the real architecture — three areas would imply three
  independent states that don't actually exist.
- **`CUSTOM_SEARCH` is a new, dedicated area — not a reuse of `RECOMMENDATION_FILTERS`.** Custom
  Search shares some `ControlsState` field *slots* with `RECOMMENDATION_FILTERS` (`minTmdbRating`/
  `yearMin`/`yearMax`/`language`/`countriesSelected`, per `frontend_spec_107`'s own Overview) but
  the two are never rendered at the same time — `RecommendationFiltersBox`'s own fields are hidden
  while `isCustomSearch` (confirmed via reading `RecommendationFiltersBox.tsx`'s `!isCustomSearch`
  gates), and the equivalent UI for those shared slots lives in `CustomSearchPanel.tsx` instead
  while in that mode. A dedicated area keeps the two profile pickers — and their saved-profile
  lists — fully independent, exactly mirroring how the existing three areas already don't share
  profiles despite some overlapping field *concepts* (e.g. "Genres" exists in both `MY_SERIES` and
  `RECOMMENDATION_FILTERS` today as unrelated, independently-scoped fields).

---

## Requirement 1: `FilterProfileArea` gains two new values

**User story**: As a developer wiring up saved profiles for Custom Search and Analysis filters, I
want the backend to already accept and store profiles tagged with their area, with zero new
backend logic to write.

### SERIES-057-AC-01 [AUTO]
**Statement**: `FilterProfileArea` shall gain two new enum constants: `CUSTOM_SEARCH` and
`ANALYSIS_FILTERS`, alongside the existing `MY_SERIES`/`USE_MY_SERIES`/`RECOMMENDATION_FILTERS`.

**References**: `FilterProfileArea.java` (the file this modifies — a five-line enum, no other
change needed).

**Test Case (Red)**:
```groovy
// FilterProfileEntitySpec.groovy (or wherever FilterProfileArea's values are asserted, if no
// dedicated spec exists yet -- confirm before writing this test)
def "FilterProfileArea includes the two new areas alongside the existing three"() {
    expect:
    FilterProfileArea.values() as Set == [
        FilterProfileArea.MY_SERIES,
        FilterProfileArea.USE_MY_SERIES,
        FilterProfileArea.RECOMMENDATION_FILTERS,
        FilterProfileArea.CUSTOM_SEARCH,
        FilterProfileArea.ANALYSIS_FILTERS,
    ] as Set
}
```
**Test Case (Green)**: add the two constants until the spec above passes.

---

### SERIES-057-AC-02 [AUTO]
**Statement**: `FilterProfileController`'s existing endpoints (`GET`/`POST`/`PUT`/`DELETE
/api/v1/filter-profiles`) shall accept `area=CUSTOM_SEARCH` and `area=ANALYSIS_FILTERS` exactly as
they already accept the three existing values — no new branch, validation, or endpoint — confirmed
by extending existing `FilterProfileControllerSpec.groovy` coverage with the two new values rather
than writing new endpoint tests from scratch.

**References**: `FilterProfileControllerSpec.groovy` (existing area-parameterized test cases to
extend, if the suite already runs its assertions across all known areas in a single parameterized
block — confirm the actual test shape before writing this addition, don't assume).

**Test Case (Red)**:
```groovy
def "create/list/update/delete all work for the CUSTOM_SEARCH and ANALYSIS_FILTERS areas"() {
    // Mirrors whichever existing FilterProfileControllerSpec.groovy test already exercises the
    // full CRUD lifecycle for one of the three original areas (e.g. MY_SERIES) -- same body,
    // parameterized (or duplicated, matching that spec's existing style) across
    // FilterProfileArea.CUSTOM_SEARCH and FilterProfileArea.ANALYSIS_FILTERS.
}
```
**Test Case (Green)**: no controller/service code changes should be required at all — if this test
fails, that itself is the signal something was accidentally area-specific and needs generalizing
(unexpected; not believed to be the case per this spec's Overview, but the test exists to catch it
if wrong).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Generic CRUD/entity this spec extends with two more enum values, no other change | `series_spec_055_filter_profiles.md` |
| Custom Search's original exclusion from filter profiles, now reversed by this spec + its frontend pairing | `frontend_spec_107_filter_profile_ui.md`'s Overview |
| `AnalysisView.tsx`'s single shared `useNameStatsFilters()` instance, the reason this spec adds one `ANALYSIS_FILTERS` area, not three | `frontend_spec_096_analysis_filters_consistency_and_persistence.md` |
| Frontend pairing that consumes these two new areas | `frontend_spec_112_filter_profiles_custom_search_and_analysis.md` (not yet written at time of this spec) |

---

## Acceptance Criteria Summary

- [x] SERIES-057-AC-01: `FilterProfileArea` gains `CUSTOM_SEARCH` and `ANALYSIS_FILTERS`
- [x] SERIES-057-AC-02: existing CRUD endpoints work for both new areas with zero controller/service changes
