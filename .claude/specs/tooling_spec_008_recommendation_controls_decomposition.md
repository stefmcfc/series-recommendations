# Tooling Spec 008: `RecommendationControls` Decomposition

**Status**: Implemented — pending SonarQube re-scan confirmation
**Priority**: P2 (repo hygiene — doesn't block product feature work, but flagged twice now: this
spec exists specifically because SonarQube's 2026-08-28 report notes `RecommendationControls.tsx`
has racked up repeat Cognitive Complexity flags "across separate sweeps now," and three more
frontend specs — `frontend_spec_043`/`044`/`045` — are queued to add further to this same file)
**Depends on**: none — pure internal refactor of already-implemented behavior
**Area**: Frontend (`components/RecommendationControls.tsx`, new sibling panel components)

## Overview

`RecommendationControls.tsx` (1518 lines, 119 existing tests in
`RecommendationControls.test.tsx`) is flagged by SonarQube (`typescript:S3776`) twice: the
`RecommendationControls` component function itself (line 477, complexity 18/15) and
`applySourceModeQuery` (line 238, complexity 17/15). Unlike `TmdbClient.discover()`
(`tooling_spec_007`), the component-function flag isn't one gnarly conditional — it's a symptom of
the file being a single, monolithic component: 12 `useState` calls, 4 `useEffect`s, and a JSX tree
with five clearly-delineated, mode-gated regions all living in one function body. This spec splits
the file along those existing seams into sibling components, each independently testable, while
`RecommendationControls` itself becomes the thin coordinator it should be — no new product
behavior, no new UI.

**Confirmed via reading the current file** (not assumed) — the five extractable JSX regions and
their approximate current boundaries:

1. **"Use My Series" panel** (lines ~770–930, ~160 lines): the Specific Series picker — search
   input, genre/status filter checkboxes, sort controls, "Browse all series" modal trigger, and the
   Min Source Rating hint. Already has its own state kept deliberately separate from
   `ControlsState` (`specificSeriesGenreFilter`/`specificSeriesStatusFilter`/`specificSeriesSortBy`/
   `specificSeriesSortDirection`/`specificSeriesBrowseModalOpen` — `frontend_spec_035`'s own design
   decision, "kept out of `ControlsState`") — this state can move to live *inside* the new
   component entirely, rather than staying lifted in the parent.
2. **Custom Search panel** (lines ~1024–1280, ~250 lines): Genres/Keywords pickers, Min TMDB
   Rating, Year Min/Max, Countries/Language pickers (`frontend_spec_046`/`047`), Sort By.
3. **Trending panel** (lines ~989–1023, ~35 lines): the Trending Window radio group.
4. **Highest Rated panel** (lines ~1146ish–1265, within the Discover tabpanel): the `discoverSortBy`
   radio group.
5. **Filters disclosure box** (lines ~1267–1422, ~155 lines): the shared, mode-gated field set
   (Min Source Rating, Min TMDB Rating, Min Vote Count, Year Min/Max, Exclude Genres/Keywords,
   Country/Language for non-Custom-Search modes, Sort By) plus the Reset Filters button.

The top-level tab chrome itself (the "Use My Series"/"Discover" tablist and the Discover sub-tablist
— `role="tablist"`/`"tab"` markup and their `handleTopLevelModeChange`/`handleModeChange` handlers)
stays in `RecommendationControls` — it's small, and it's the actual coordination logic this
component should keep owning.

## Design Decisions

- **`ControlsState` stays owned by `RecommendationControls`, passed down as `state` +
  `updateState`.** No state lifting/prop-drilling redesign — each new panel component receives the
  full `state: ControlsState` object and the existing `updateState: (patch: Partial<ControlsState>)
  => void` callback, exactly as internal helper functions (`applyRatingAndRangeFilters`, etc.)
  already receive `state` today. This is the lowest-risk boundary: panels read/write the same
  shared state shape they already do, just through props instead of closure.
- **Panel-local UI state moves with its panel, not lifted.** The Specific Series picker's five
  `useState` calls (listed above) move into the new "Use My Series" panel component itself —
  `RecommendationControls` has no reason to hold state only one child ever reads. Same for any
  other panel-scoped-only local state discovered during implementation.
- **Shared helper functions (`buildQuery`, `applySourceModeQuery`, `applyRatingAndRangeFilters`,
  `applyExcludeAndMiscFilters`, and the `specificSeries*` pool/sort/filter functions) stay as
  module-level functions in `RecommendationControls.tsx`**, not moved into the new panel files —
  they're pure functions operating on `ControlsState`/`RecommendationQuery`, not JSX, and multiple
  panels (or `RecommendationControls` itself) may need them. Only JSX and the local state that
  exclusively backs one panel's JSX moves.
- **`applySourceModeQuery`'s own flagged complexity (AC-06 below) is a separate, smaller fix** from
  the component-splitting work — it's already a flat sequence of `if (state.mode === ...)` blocks,
  one per mode, mirroring `applyRatingAndRangeFilters`/`applyExcludeAndMiscFilters`'s existing
  "extract one function per concern" pattern one level further: split each mode's own branch into
  its own small function (`applyUseMySeriesModeQuery`, `applyCustomSearchModeQuery`, etc.),
  called in sequence.
- **No new component library dependency, no CSS changes.** Each new panel imports
  `RecommendationControls.module.css` the same way `RecommendationControls.tsx` does today (CSS
  Modules class names are already scoped per-file at build time, but nothing here requires moving
  styles — the existing single stylesheet stays put and every new file imports from it).
- **File naming**: `UseMySeriesPanel.tsx`, `CustomSearchPanel.tsx`, `TrendingPanel.tsx`,
  `HighestRatedPanel.tsx`, `RecommendationFiltersBox.tsx` (avoiding a bare `FiltersBox` name
  collision with `SearchFilter`'s own unrelated filter concept), colocated in `components/`
  alongside `RecommendationControls.tsx`, each with its own `*.test.tsx`.

---

## Requirement 1: Behavior parity, validated against the existing test suite

**User story**: As a developer splitting this file, I want the existing 119 tests to be the proof
this refactor changed nothing observable, not a new test suite written to match whatever the
refactor happens to produce.

### TOOLING-008-AC-01 [AUTO]
**Statement**: After every panel extraction (Requirements 2–6), every existing test in
`RecommendationControls.test.tsx` shall pass unmodified except for import-path or
`render()`-target changes strictly necessitated by the extraction itself (e.g. a test that now
needs to render a child component directly) — no test's *assertions* change.

**References**: `frontend/src/components/RecommendationControls.test.tsx` (119 tests).

**Test Case (Red)**: none new — regression guard.
**Test Case (Green)**: `npm test` — full Vitest suite green; a diff of
`RecommendationControls.test.tsx` shows only import/render-target mechanical changes, no assertion
changes.

---

## Requirement 2: "Use My Series" panel extraction

**User story**: As a developer, I want the Specific Series picker's search/filter/sort/modal logic
isolated from the rest of the component, so a future change to it (e.g. `frontend_spec_035`-style
work) doesn't require reading 1500 unrelated lines first.

### TOOLING-008-AC-02 [AUTO]
**Statement**: A new `UseMySeriesPanel` component shall render everything currently inside the
`state.mode === 'useMySeries'` tabpanel (lines ~770–930), receiving `state`/`updateState` and the
already-fetched `allSeries`/`genreOptions` as props; the five Specific-Series-scoped `useState`
calls move into this component.

**References**: `RecommendationControls.tsx`'s current `state.mode === 'useMySeries' && (...)`
block; `frontend_spec_035`'s design note on why this state was already kept separate from
`ControlsState`.

**Test Case (Red)**: none new — covered by TOOLING-008-AC-01's regression guard plus whatever
`UseMySeriesPanel.test.tsx` tests are extracted/adapted from the existing Specific-Series-focused
tests in `RecommendationControls.test.tsx` (e.g. `FRONTEND-035-AC-*` describe blocks).
**Test Case (Green)**: `RecommendationControls` renders `<UseMySeriesPanel .../>` in place of the
inline JSX when `state.mode === 'useMySeries'`.

---

## Requirement 3: Custom Search panel extraction

**User story**: As a developer, I want Custom Search's genre/keyword/rating/year/country/language
fields isolated, since this is both the single largest panel and the one most specs
(`frontend_spec_031/046/047`) have already grown and will keep growing.

### TOOLING-008-AC-03 [AUTO]
**Statement**: A new `CustomSearchPanel` component shall render everything currently inside the
`state.discoverMode === 'customSearch'` tabpanel (lines ~1024–1280), receiving `state`/
`updateState` and the already-fetched `genreOptions`/`keywordOptions` as props.

**References**: `RecommendationControls.tsx`'s current `state.discoverMode === 'customSearch' &&
(...)` block within the Discover tabpanel.

**Test Case (Red)**: none new — covered by TOOLING-008-AC-01's regression guard.
**Test Case (Green)**: `RecommendationControls` renders `<CustomSearchPanel .../>` in place of the
inline JSX when `state.discoverMode === 'customSearch'`.

---

## Requirement 4: Trending and Highest Rated panel extraction

**User story**: As a developer, I want the two smaller Discover sub-panels split out too, for the
same reason as Custom Search, even though they're individually low-risk.

### TOOLING-008-AC-04 [AUTO]
**Statement**: New `TrendingPanel` and `HighestRatedPanel` components shall render their
respective existing tabpanel content (Trending Window radio group; `discoverSortBy` radio group),
each receiving `state`/`updateState`.

**References**: `RecommendationControls.tsx`'s current `state.discoverMode === 'trending'`/
`state.discoverMode === 'topRated'` blocks.

**Test Case (Red)**: none new — covered by TOOLING-008-AC-01's regression guard.
**Test Case (Green)**: `RecommendationControls` renders `<TrendingPanel .../>`/
`<HighestRatedPanel .../>` in place of the inline JSX for their respective sub-modes.

---

## Requirement 5: Filters disclosure box extraction

**User story**: As a developer, I want the shared Filters box isolated from the mode-specific
panels above, since it's conceptually a different thing (cross-mode refinements, not one mode's
own primary fields) despite living in the same file today.

### TOOLING-008-AC-05 [AUTO]
**Statement**: A new `RecommendationFiltersBox` component shall render the existing
`filtersSection` block (lines ~1267–1422: the toggle button, every mode-gated field inside
`filtersBody`, and the Reset Filters button), receiving `state`/`updateState`, `filtersOpen`/
`setFiltersOpen`, and whatever mode-derived booleans (`isCustomSearch`, `showMinSourceRating`,
etc.) it needs.

**References**: `RecommendationControls.tsx`'s current `styles.filtersSection` block.

**Test Case (Red)**: none new — covered by TOOLING-008-AC-01's regression guard.
**Test Case (Green)**: `RecommendationControls` renders `<RecommendationFiltersBox .../>` in place
of the inline JSX; `filtersOpen` state may stay in the parent (it also gates nothing else) or move
into the new component — implementer's call, doesn't affect any test's observable behavior either
way.

---

## Requirement 6: `applySourceModeQuery`'s own complexity fix

**User story**: As a developer, I want `applySourceModeQuery` itself under the Cognitive
Complexity threshold, independent of the component-splitting work above (this function isn't JSX
and isn't affected by where the JSX that reads its output lives).

### TOOLING-008-AC-06 [AUTO]
**Statement**: `applySourceModeQuery` shall be split into one small function per `state.mode`/
`state.discoverMode` branch (e.g. `applyUseMySeriesModeQuery`, `applyTrendingModeQuery`,
`applyTopRatedModeQuery`, `applyCustomSearchModeQuery`), called in sequence from
`applySourceModeQuery`, mirroring `applyRatingAndRangeFilters`/`applyExcludeAndMiscFilters`'s
existing extraction pattern. No change to `RecommendationQuery` output for any mode.

**References**: `RecommendationControls.tsx`'s current `applySourceModeQuery` (lines 238–283).

**Test Case (Red)**: none new — regression guard, covered by the existing
`FRONTEND-049-AC-*`/`FRONTEND-042-AC-*` query-building tests in `RecommendationControls.test.tsx`.
**Test Case (Green)**: `applySourceModeQuery`'s own Cognitive Complexity drops to within threshold;
every existing query-shape test (per mode) passes unmodified.

---

## Requirement 7: Final Cognitive Complexity confirmation

### TOOLING-008-AC-07 [AUTO]
**Statement**: After Requirements 2–6, neither `RecommendationControls` nor
`applySourceModeQuery` shall appear in SonarQube's Cognitive Complexity findings for this file.

**References**: SonarQube rule `typescript:S3776`, flagged at `RecommendationControls.tsx` lines
238 and 477 in `.sonar-report/sonar-report-2026-08-28.md`.

**Test Case (Red)**: none — verified via IDE/SonarQube re-scan after implementation, not an
automated test.
**Test Case (Green)**: re-run SonarQube analysis; `RecommendationControls.tsx` no longer appears
in the Cognitive Complexity findings.

---

## Cross-References

| This spec | Source |
|---|---|
| `ControlsState`, `buildQuery`, mode/discoverMode shape this spec's panels all consume | `frontend_spec_042_recommendation_source_mode_reorganization.md` |
| Specific Series picker state kept separate from `ControlsState`, moved into `UseMySeriesPanel` by this spec | `frontend_spec_035_specific_series_picker.md` |
| Custom Search panel's fields (relocated there by these specs, extracted as one unit by this spec) | `frontend_spec_046_custom_search_prefetch_filters_ui.md`, `frontend_spec_047_custom_search_language_country_filters_ui.md` |
| Apply Filters gating pattern (`filtersOpen`, `updateState`/`updateField`) this spec's `RecommendationFiltersBox` preserves | `frontend_spec_040_recommendation_controls_apply_and_lock.md` |
| Specs queued to add further to this file, motivating doing this refactor now rather than later | `frontend_spec_043_confirm_discard_unsaved_changes.md`, `frontend_spec_044_edit_series_clear_fields.md`, `frontend_spec_045_edit_series_lookup.md` |
| Flagged by | `.sonar-report/sonar-report-2026-08-28.md` |

---

## Acceptance Criteria Summary

- [x] TOOLING-008-AC-01: existing `RecommendationControls.test.tsx` suite passes with only mechanical changes
- [x] TOOLING-008-AC-02: `UseMySeriesPanel` extracted, Specific-Series-scoped state moved with it
- [x] TOOLING-008-AC-03: `CustomSearchPanel` extracted
- [x] TOOLING-008-AC-04: `TrendingPanel`/`HighestRatedPanel` extracted
- [x] TOOLING-008-AC-05: `RecommendationFiltersBox` extracted
- [x] TOOLING-008-AC-06: `applySourceModeQuery` split per-mode, complexity reduced
- [ ] TOOLING-008-AC-07: neither flagged function appears in a SonarQube re-scan
