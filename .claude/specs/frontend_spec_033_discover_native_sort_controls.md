# Frontend Spec 033: TMDB-Native Sort Controls for Highest Rated / Genre & Keyword

**Status**: Implemented (2026-08-24). Files touched: `frontend/src/components/RecommendationControls.tsx` (new
`DiscoverSortByOption` type, `DISCOVER_SORT_BY_DEFAULTS` per-mode default map, `discoverSortBy` field on
`ControlsState`, `handleDiscoverSortByChange`, mode-switch reset in `handleModeChange`, `buildQuery`'s
wire-minimized inclusion, and the `Sort By` fieldset branching on `showDiscoverSortByOptions` to render the four
new radios for `topRated`/`genre` vs. the unchanged legacy pair for every other mode),
`frontend/src/types/series.ts` (`RecommendationQuery.discoverSortBy`), `frontend/src/services/seriesApi.ts`
(`buildRecommendationParams` forwards `discoverSortBy` — not itself named by an AC here, but necessary for the
field to reach the backend at all, mirroring how every other criteria field is already wired through this
function), `frontend/src/services/__tests__/seriesApi.test.ts` (two new cases covering that wiring),
`frontend/src/components/RecommendationControls.test.tsx` (the superseded `FRONTEND-030-AC-13/14/15,
FRONTEND-031-AC-01` describe block replaced with new `FRONTEND-033-AC-01..05` describes covering all five ACs).
**Verification**: `npm test` (15 files / 412 tests, all passing) and `npm run lint` both clean from `frontend/`.
Real browser pass completed against a freshly rebuilt backend (the dev server had to be restarted mid-session —
it was running a stale build from before `series_spec_025` landed, which initially made Highest Rated's four
options all return byte-identical TMDB order; restarting `gradlew.bat bootRun` confirmed this was a stale-process
artifact, not a bug in either half of this feature) — confirmed via a `puppeteer-core` script driving real Chrome
against `localhost:5173`/`:8080`: Highest Rated defaults to "Vote Average" checked with "Best Match" absent, all
four options present under both Highest Rated and Genre & Keyword, selecting "Most Voted"/"Newest" under Highest
Rated changes the actual returned order and content (verified by comparing top-5 titles and by direct `curl`
diffing `discoverSortBy=vote_count.desc` vs. `first_air_date.desc` vs. the omitted default), Genre & Keyword (with
"Action" checked) defaults to "Most Popular" checked, and switching back to Automatic restores exactly
Best Match/Most Recommended with no residual "Vote Average" control. Checked both light and dark
`prefers-color-scheme` via screenshot — no visual regressions on the new controls in either theme. Ran `axe.run()`
directly in-browser on the Highest Rated view: the only violations present (`color-contrast` on
`RecommendationsList`'s `._country_`/`._attribution_` elements, `page-has-heading-one` app-wide) are pre-existing
and unrelated to this spec's new markup — the new radio/label pairs reuse the same `styles.modeOption` class
already used by every other option in this fieldset, and produced zero new violations.
**Priority**: Medium
**Depends on**: `series_spec_025_discover_native_sort.md`, `frontend_spec_030_discover_filters_and_sort_controls.md`
**Area**: Frontend (`RecommendationControls.tsx`)

## Overview

`series_spec_025` gives `topRated` (Highest Rated) and genre/keyword-directed sourcing a real, TMDB-backed
`discoverSortBy` param, replacing the app's own no-op re-ranking. This spec replaces those two modes' existing
`Sort By` control (currently "Best Match"/"Vote Average" — two labels for one identical output, per
`series_spec_025`'s Overview) with real, distinct options backed by that new param.

**Exposed options** (a deliberately small subset of TMDB's full 12-value enum — see Design Decisions):

| Label | `discoverSortBy` value |
|---|---|
| Vote Average | `vote_average.desc` |
| Most Popular | `popularity.desc` |
| Newest | `first_air_date.desc` |
| Most Voted | `vote_count.desc` |

`Automatic` and `Specific Series` modes are **unaffected** — their existing "Best Match"/"Most Recommended"
control is real (both `rankScore`'s personal-rating blend and `totalSourceCount` are meaningful for pool-sourced
candidates) and stays exactly as-is. `Popular Right Now` (Trending) still has no `Sort By` control at all — TMDB's
`/trending/tv/{window}` endpoint has no `sort_by` parameter, so there is still nothing to offer there.

## Design Decisions

- **Only 4 of TMDB's 12 `sort_by` values are exposed**, not all of them. `name`/`original_name` (alphabetical)
  don't serve a recommendation use case — sorting suggestions alphabetically isn't a meaningful "which show
  first" signal the way rating/popularity/recency are. Ascending variants (`*.asc`) are omitted for the same
  reason a user browsing recommendations wants "most X first", not least. The backend (`series_spec_025`
  SERIES-025-AC-04) validates against the full 12-value enum regardless, so exposing more later is a
  frontend-only change.
- **The per-mode default matches each mode's current implicit behavior exactly** (`topRated` → Vote Average,
  `genre` → Most Popular) — a user who never touches this control sees no behavior change from before this
  spec, only from the previous no-op-choice bug being fixed.
- **The genre-mode-with-nothing-selected edge case is not specially handled.** Server-side, `genre` mode with
  no genre/keyword actually selected silently falls back to `automatic` sourcing (`isDirectedByGenreOrKeyword`),
  where the *old* Best Match/Most Recommended semantics would actually apply — but the control's visible option
  set is keyed on `mode` alone here, matching how this component already keys every other mode-conditional
  section (e.g. `minSourceRating`'s visibility) on `mode` alone rather than finer per-field state. The existing
  "falls back to automatic recommendations" hint text already communicates this ambiguity generally; this is a
  pre-existing simplification pattern in this component, not a new one introduced here.
- **The request only sends `discoverSortBy` when it differs from the mode's own default** — mirrors this
  project's established wire-minimization convention (`SeriesList.tsx`'s `buildSortParam`, `series_spec_009`)
  so a client at the default behaves identically to a pre-this-spec client.

## Requirement 1: Real sort options for Highest Rated and Genre & Keyword

**User story**: As a user picking a sort order for Highest Rated or Genre & Keyword recommendations, I want
the options to actually change the result, so choosing between them isn't pointless.

### FRONTEND-033-AC-01 [AUTO]
**Statement**: While `mode` is `'topRated'` or `'genre'`, the `Sort By` fieldset shall render four radio
options labeled "Vote Average", "Most Popular", "Newest", and "Most Voted", replacing the existing "Best
Match"/"Vote Average"(or "Most Recommended") pair for these two modes only.

**References**: `frontend/src/components/RecommendationControls.tsx`, the `sortByFieldset` block and its
`state.mode !== 'trending'` guard.

**Test Case (Red)**:
```typescript
it('FRONTEND-033-AC-01: shows the four TMDB-native sort options under Highest Rated', () => {
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/highest rated/i))
  for (const label of [/vote average/i, /most popular/i, /^newest$/i, /most voted/i]) {
    expect(screen.getByLabelText(label)).toBeInTheDocument()
  }
  expect(screen.queryByLabelText(/^best match$/i)).not.toBeInTheDocument()
})

it('FRONTEND-033-AC-01: shows the same four options under Genre & Keyword', () => {
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/genre & keyword/i))
  for (const label of [/vote average/i, /most popular/i, /^newest$/i, /most voted/i]) {
    expect(screen.getByLabelText(label)).toBeInTheDocument()
  }
})
```

**Test Case (Green)**: branch the `sortByFieldset`'s rendered options on `state.mode`.

### FRONTEND-033-AC-02 [AUTO]
**Statement**: `Automatic` and `Specific Series` modes shall continue to show exactly "Best Match"/"Most
Recommended" (unchanged from `frontend_spec_019`/`frontend_spec_011`).

**Test Case (Red)**:
```typescript
it('FRONTEND-033-AC-02: Automatic and Specific Series are unaffected', () => {
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  expect(screen.getByLabelText(/^best match$/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/most recommended/i)).toBeInTheDocument()

  fireEvent.click(screen.getByLabelText(/specific series/i))
  expect(screen.getByLabelText(/^best match$/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/most recommended/i)).toBeInTheDocument()
})
```

**Test Case (Green)**: no change needed if AC-01's branch is additive — included as an explicit regression
check.

## Requirement 2: Correct per-mode defaults, sent only when non-default

**User story**: As a user who never touches Sort By, I want Highest Rated and Genre & Keyword to behave exactly
as they did before this control became meaningful, so nothing changes under me by surprise.

### FRONTEND-033-AC-03 [AUTO]
**Statement**: While `mode` is `'topRated'`, "Vote Average" shall be selected by default; while `mode` is
`'genre'`, "Most Popular" shall be selected by default.

**Test Case (Red)**:
```typescript
it('FRONTEND-033-AC-03: Vote Average is the default under Highest Rated', () => {
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/highest rated/i))
  expect(screen.getByLabelText(/vote average/i)).toBeChecked()
})

it('FRONTEND-033-AC-03: Most Popular is the default under Genre & Keyword', () => {
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/genre & keyword/i))
  expect(screen.getByLabelText(/most popular/i)).toBeChecked()
})
```

**Test Case (Green)**: mode-switch handler sets the appropriate default `discoverSortBy` state per mode.

### FRONTEND-033-AC-04 [AUTO]
**Statement**: `discoverSortBy` shall be omitted from the built query when the selected option matches the
current mode's default, and included (as the corresponding TMDB value from the table above) when it doesn't.

**References**: `buildQuery`.

**Test Case (Red)**:
```typescript
it('FRONTEND-033-AC-04: omits discoverSortBy at the mode default, includes it otherwise', () => {
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} />)

  fireEvent.click(screen.getByLabelText(/highest rated/i))
  expect(onQueryChange).toHaveBeenLastCalledWith(
    expect.not.objectContaining({ discoverSortBy: expect.anything() }),
  )

  fireEvent.click(screen.getByLabelText(/most popular/i))
  expect(onQueryChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ discoverSortBy: 'popularity.desc' }),
  )
})
```

**Test Case (Green)**: `buildQuery` sets `discoverSortBy` only when it differs from the per-mode default map.

### FRONTEND-033-AC-05 [AUTO]
**Statement**: Switching away from `'topRated'`/`'genre'` to any other mode shall reset the sort selection back
to that other mode's own applicable default (either the legacy "Best Match" for `automatic`/`specific`, or no
selection state relevant for `trending`), never leaking a `discoverSortBy` value into a request for a mode it
doesn't apply to.

**Test Case (Red)**:
```typescript
it('FRONTEND-033-AC-05: switching modes never leaks discoverSortBy into an unrelated request', () => {
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} />)

  fireEvent.click(screen.getByLabelText(/highest rated/i))
  fireEvent.click(screen.getByLabelText(/most voted/i))
  fireEvent.click(screen.getByLabelText(/^automatic$/i))

  expect(onQueryChange).toHaveBeenLastCalledWith(
    expect.not.objectContaining({ discoverSortBy: expect.anything() }),
  )
})
```

**Test Case (Green)**: mode-switch handler clears/resets the relevant sort state, mirroring the existing
`minVoteCount` mode-switch reset pattern (`frontend_spec_030`).

## Cross-references

| Reference | Relationship |
|---|---|
| `series_spec_025_discover_native_sort.md` | Backend half — the `discoverSortBy` param this control drives |
| `frontend_spec_030_discover_filters_and_sort_controls.md` | Establishes the `minVoteCount` mode-switch reset pattern this spec's AC-05 mirrors, and the `topRated` relabel this spec fully replaces |
| `frontend_spec_031_genre_mode_sort_relabel.md` | The `genre` relabel this spec fully replaces |
| `frontend_spec_019_multi_source_recommendations.md`, `frontend_spec_011_recommendation_controls.md` | Establish the "Best Match"/"Most Recommended" control this spec leaves untouched for `automatic`/`specific` |

## Acceptance Criteria Summary

- [x] FRONTEND-033-AC-01: four TMDB-native sort options shown under Highest Rated and Genre & Keyword
- [x] FRONTEND-033-AC-02: Automatic/Specific Series unaffected
- [x] FRONTEND-033-AC-03: correct per-mode default selected (Vote Average / Most Popular)
- [x] FRONTEND-033-AC-04: `discoverSortBy` omitted at the default, included otherwise
- [x] FRONTEND-033-AC-05: switching modes never leaks `discoverSortBy` into an unrelated request
