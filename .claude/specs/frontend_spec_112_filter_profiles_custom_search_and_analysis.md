# Frontend Spec 112: Saved Filter Profiles for Custom Search and Analysis Filters

**Status**: Not started
**Priority**: P3 (extends an existing quality-of-life feature to two more contexts)
**Depends on**: `series_spec_057_filter_profile_new_areas.md` (the two new `FilterProfileArea`
values this spec consumes — must merge first), `frontend_spec_107_filter_profile_ui.md` (the
`FilterProfileSelector` component and `describeFilterCriteria` utility this spec reuses and
extends, not re-derives), `frontend_spec_109_filter_profile_polish.md` (the toggle-off-on-reclick,
disabled-when-empty, and end-of-fields placement conventions this spec follows for both new
integrations)
**Area**: Frontend (`types/filterProfile.ts`, `utils/describeFilterCriteria.ts`,
`components/CustomSearchPanel.tsx`, `hooks/useNameStatsFilters.ts`,
`components/AnalysisView.tsx`, `components/AnalysisView.module.css`, and each affected file's
tests)

## Overview

`frontend_spec_107` wired the reusable `FilterProfileSelector` into three areas but **explicitly
excluded Custom Search** (shares `ControlsState` field slots with the other Discover modes, no
resolution designed at the time) and never covered the Analysis/Trends filters (which didn't exist
until `frontend_spec_086`–`089`/`095`/`096`, all shipped after `frontend_spec_107`). This spec adds
both, consuming the two new `FilterProfileArea` values `series_spec_057` adds
(`CUSTOM_SEARCH`/`ANALYSIS_FILTERS`).

**Custom Search's exclusion, now resolved**: confirmed via reading `RecommendationFiltersBox.tsx`
that its own fields are hidden (`!isCustomSearch` gates) whenever Custom Search is active — the
equivalent UI for those shared slots (`minTmdbRating`/`yearMin`/`yearMax`/`language`/
`countriesSelected`) lives in `CustomSearchPanel.tsx` instead, which also has two fields of its own
`RecommendationFiltersBox` doesn't (`genresSelected`, `keywordsSelected` — include, not
exclude-only). Since `RecommendationFiltersBox`'s own `FilterProfileSelector` is already `disabled`
while `isCustomSearch` (the existing exclusion mechanism, unchanged by this spec), and this spec's
new Custom Search picker only ever renders while `isCustomSearch` is true, the two pickers are
mutually exclusive by construction — no runtime collision over the shared `ControlsState` slots is
possible, because only one of the two pickers is ever visible/interactive at a time. Custom Search
does **not** have its own exclude-keywords field today (confirmed via grep — that gap is
pre-existing and unrelated to this spec, not something this spec adds or fixes).

**Analysis Filters — one area, not three**: `AnalysisView.tsx` instantiates `useNameStatsFilters()`
exactly once and shares it across all three `/analysis` sub-tabs (`series_spec_057`'s own Design
Decisions explain why) — so this spec's new picker renders once in `AnalysisView.tsx`, not inside
`NameStatsTable.tsx` (which is instantiated three times, once per tab, and would triple-render a
per-instance picker).

## Design Decisions

- **`CustomSearchFilterCriteria` is a new, dedicated type — not a reuse of
  `RecommendationFiltersCriteria`.** Mirrors this spec's backend pairing's own reasoning: the two
  areas' profile lists must stay fully independent. Fields: `genresSelected`,
  `excludeGenresSelected`, `keywordsSelected`, `minTmdbRating`, `yearMin`, `yearMax`, `language`,
  `countriesSelected` — the 8 fields `CustomSearchPanel.tsx` actually renders (confirmed via
  reading the component; no `excludeKeywordsSelected`, since Custom Search has no such field).
- **Custom Search's `FilterProfileSelector` renders at the end of `CustomSearchPanel.tsx`'s field
  list**, matching `frontend_spec_109`'s established "Save moves to the end of each filter view"
  convention for the other three areas — not at the top.
- **Custom Search needs a brand-new clear function.** Confirmed via grep: `CustomSearchPanel.tsx`
  has no existing reset/clear mechanism of any kind today (unlike `RecommendationFiltersBox`'s
  `handleResetFilters` or `UseMySeriesPanel`'s `frontend_spec_109`-added
  `handleClearSpecificSeriesFilters`) — this spec adds `handleClearCustomSearchFilters`, resetting
  all 8 fields to `initialState`'s own values (`genresSelected: []`, `excludeGenresSelected: []`,
  `keywordsSelected: []`, `minTmdbRating: ''`, `yearMin: ''`, `yearMax: ''`, `language: ''`,
  `countriesSelected: []`), shared as both `FilterProfileSelector`'s `onClear` prop
  (`frontend_spec_109-AC-10`'s toggle-off-on-reclick) and a new "Clear Filters" button — the same
  one function, two call sites pattern `frontend_spec_109`'s `UseMySeriesPanel` addition already
  established, not two independently-maintained resets.
- **`AnalysisFilterCriteria`'s `sortBy`/`sortDirection` are `| undefined`, not defaulted strings —
  this sidesteps the exact bug class `frontend_spec_109` found and fixed.** That spec's
  `describeUseMySeriesCriteria` bug existed because `sortBy`/`sortDirection` were *never* actually
  unset (always initialized to `'title'`/`'asc'`), so a bare `!= null` "is it set" check could never
  return false. `useNameStatsFilters`'s `sortBy`/`sortDirection` are genuinely `undefined` until a
  column header is clicked (confirmed via reading the hook) — so `describeFilterCriteria`'s
  existing `!= null` check for these fields works correctly here with **no** special-cased
  default-value comparison needed, unlike Area B. This is called out explicitly so whoever
  implements this doesn't need to re-derive that reasoning or wonder if the same bug applies here
  (it doesn't).
- **Analysis's `currentCriteria` is the *pending* `filterInputs` + live `sortBy`/`sortDirection`,
  not `appliedFilters`.** Mirrors Area A (`SearchFilter`)'s own precedent — `currentCriteria`
  reflects what the user is about to search with (the editable form state), not what's already
  running. `sortBy`/`sortDirection` have no separate "pending" state (column-header clicks apply
  immediately, confirmed via reading `handleSortChange`), so they're read live either way.
- **Selecting a saved Analysis profile applies immediately** (`useNameStatsFilters` gains a new
  `applyFilterProfile(criteria)` method: sets `filterInputs` from the profile, calls
  `setAppliedFilters`/bumps `applyVersion` the same way `handleApplyFilters` already does, and sets
  `sortBy`/`sortDirection`), matching `frontend_spec_107`'s "select-and-apply immediately" Design
  Decision — no separate Apply click required after picking a profile.
- **A new `clearFilterProfile()` method, distinct from the existing `handleResetFilters`.** The
  existing "Reset Filters" button's `handleResetFilters` deliberately leaves `sortBy`/
  `sortDirection` untouched (its own existing comment: "'filters' and 'sort' are separate concerns
  in this component already"). Since this spec's saved criteria *include* sort, the chip
  toggle-off-to-clear behavior needs a different function that resets sort too — added net-new
  rather than changing `handleResetFilters`'s existing, deliberately-scoped behavior.
- **The Analysis `FilterProfileSelector` renders once in `AnalysisView.tsx`**, between the tab
  `<nav>` and whichever tab's view is active — not inside `NameStatsTable.tsx` (see Overview). This
  is a deliberate deviation from the literal "end of fields" placement convention used everywhere
  else in this app: there is no single "end of fields" here, since `NameStatsTable`'s own
  filter-fields UI is re-rendered three times (once per tab) while profile management is a single,
  shared concern above all three.

---

## Requirement 1: Custom Search — types and criteria description

**User story**: As a developer wiring up Custom Search's saved profiles, I want a dedicated
criteria type and a `describeFilterCriteria` case for it, following the same pattern as the
existing three areas.

### FRONTEND-112-AC-01 [AUTO]
**Statement**: `types/filterProfile.ts` shall gain `'CUSTOM_SEARCH'` as a fourth
`FilterProfileArea` value and a new `CustomSearchFilterCriteria` interface: `genresSelected:
string[]`, `excludeGenresSelected: string[]`, `keywordsSelected: string[]`, `minTmdbRating:
string`, `yearMin: string`, `yearMax: string`, `language: string`, `countriesSelected: string[]`.

**References**: `types/filterProfile.ts`'s existing `RecommendationFiltersCriteria` (the sibling
shape this is closest to, though not reused — see Design Decisions); `CustomSearchPanel.tsx` (the
8 fields this mirrors).

**Test Case (Green)**: type-only change, verified by `FRONTEND-112-AC-03`'s component tests
compiling and passing.

---

### FRONTEND-112-AC-02 [AUTO]
**Statement**: `utils/describeFilterCriteria.ts` shall gain a `describeCustomSearchCriteria`
function (dispatched for `area === 'CUSTOM_SEARCH'`), producing one entry per non-empty field:
Genres, Exclude Genres, Keywords (list entries, same `listEntry` helper as every other area), Min
TMDB Rating, Year (from), Year (to) (plain `entry` helper), Language (via the existing
`resolveLanguageLabel`), Countries (via the existing `formatCountryNames`) — reusing every existing
helper this file already has, no new formatting logic.

**References**: `describeFilterCriteria.ts`'s existing `describeRecommendationFiltersCriteria`
(the closest existing sibling — same `resolveLanguageLabel`/`formatCountryNames` reuse, same
`entry`/`listEntry` helpers), extended with the two Custom-Search-only fields
(`genresSelected`/`keywordsSelected` as plain, non-exclude list entries).

**Test Case (Red)**:
```typescript
// src/utils/describeFilterCriteria.test.ts (additions)
describe('FRONTEND-112-AC-02: describeFilterCriteria for CUSTOM_SEARCH', () => {
  it('produces one entry per non-empty field', () => {
    const entries = describeFilterCriteria('CUSTOM_SEARCH', {
      genresSelected: ['Comedy'],
      countriesSelected: ['US'],
    } as Partial<CustomSearchFilterCriteria>)
    expect(entries.find((e) => e.label === 'Genres')?.value).toBe('Comedy')
    expect(entries.find((e) => e.label === 'Countries')?.value).toMatch(/United States/)
  })

  it('returns an empty array when every field is empty', () => {
    expect(describeFilterCriteria('CUSTOM_SEARCH', {})).toEqual([])
  })
})
```
**Test Case (Green)**: implement `describeCustomSearchCriteria` and its dispatch case until the
spec above passes.

---

## Requirement 2: Custom Search — `FilterProfileSelector` wiring

**User story**: As a user of Custom Search, I want to save, apply, update, and clear my search
criteria the same way I already can everywhere else in this app.

### FRONTEND-112-AC-03 [AUTO]
**Statement**: `CustomSearchPanel.tsx` shall render `<FilterProfileSelector area="CUSTOM_SEARCH"
currentCriteria={...} onApply={...} onClear={handleClearCustomSearchFilters} />` as the last
element in its field list (after Countries/Language, before the closing `role="tabpanel"` div's
end), where `currentCriteria` is the live `{ genresSelected, excludeGenresSelected,
keywordsSelected, minTmdbRating, yearMin, yearMax, language, countriesSelected }` slice of `state`,
and `onApply` calls `updateState` with all 8 fields from the selected profile in one call.

**References**: `frontend_spec_109`'s "Save moves to the end of each filter view" convention
(`FRONTEND-109-AC-03/04/05`); `RecommendationFiltersBox.tsx`'s existing `FilterProfileSelector`
usage as the adapter-shape precedent (`currentCriteria`/`onApply` built from `state`/`updateState`
directly, no local component state needed).

**Test Case (Red)**:
```typescript
// src/components/CustomSearchPanel.test.tsx (additions)
describe('FRONTEND-112-AC-03: Custom Search gains a FilterProfileSelector', () => {
  it('renders the profile selector as the last field, applying a selected profile', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'CUSTOM_SEARCH',
        name: 'Sci-Fi 2020s',
        criteria: { genresSelected: ['Sci-Fi & Fantasy'], yearMin: '2020' },
        createdAt: '',
        updatedAt: '',
      },
    ])
    const updateState = vi.fn()
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={updateState}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(await screen.findByText('Sci-Fi 2020s'))
    expect(updateState).toHaveBeenCalledWith(
      expect.objectContaining({ genresSelected: ['Sci-Fi & Fantasy'], yearMin: '2020' }),
    )
  })
})
```
**Test Case (Green)**: add the `FilterProfileSelector` and its adapters until the spec above
passes.

---

### FRONTEND-112-AC-04 [AUTO]
**Statement**: `CustomSearchPanel.tsx` shall gain a new `handleClearCustomSearchFilters` function,
resetting `genresSelected`/`excludeGenresSelected`/`keywordsSelected`/`countriesSelected` to `[]`
and `minTmdbRating`/`yearMin`/`yearMax`/`language` to `''` (matching `initialState`'s own values for
these fields exactly) — used as both `FilterProfileSelector`'s `onClear` prop and a new "Clear
Filters" button, matching `frontend_spec_109-AC-12`'s "one function, two call sites" pattern for
`UseMySeriesPanel`.

**References**: `RecommendationControls.tsx`'s `initialState` (the default values this resets to);
`frontend_spec_109-AC-12`'s `UseMySeriesPanel.handleClearSpecificSeriesFilters` (the pattern this
mirrors — a wholly new function, since none existed before).

**Test Case (Red)**:
```typescript
describe('FRONTEND-112-AC-04: Custom Search gains a Clear Filters button', () => {
  it('resets all 8 fields to their defaults', () => {
    const updateState = vi.fn()
    render(
      <CustomSearchPanel
        state={makeState({ genresSelected: ['Comedy'], yearMin: '2020' })}
        updateState={updateState}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByTestId('reset-custom-search-filters-btn'))
    expect(updateState).toHaveBeenCalledWith(
      expect.objectContaining({ genresSelected: [], yearMin: '' }),
    )
  })
})
```
**Test Case (Green)**: add the function and button until the spec above passes.

---

### FRONTEND-112-AC-05 [AUTO]
**Statement**: `FilterProfileSelector`'s existing `hasActiveCriteria`/disabled-when-empty behavior
(`frontend_spec_109-AC-13`) shall work correctly for `CUSTOM_SEARCH` with no additional changes —
verified explicitly (not assumed) since `frontend_spec_109-AC-13` found a real bug for a
structurally similar case (Area B's `sortBy`/`sortDirection`).

**References**: `frontend_spec_109-AC-13`'s `describeUseMySeriesCriteria` bug and fix — this AC is
the explicit verification that `describeCustomSearchCriteria` has no equivalent trap (it doesn't:
every one of its 8 fields is a plain string/array with a genuinely-empty default, no
always-set-non-empty default the way Area B's sort fields were).

**Test Case (Red)**:
```typescript
describe('FRONTEND-112-AC-05: Save Filters disabled when Custom Search criteria is empty', () => {
  it('disables Save Filters at the default (empty) state', () => {
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    expect(screen.getByRole('button', { name: /save filters/i })).toBeDisabled()
  })
})
```
**Test Case (Green)**: should already pass once `FRONTEND-112-AC-02`/`03` are implemented correctly
— if it doesn't, that's a real bug to fix, not a spec change.

---

## Requirement 3: Analysis Filters — types and criteria description

**User story**: As a developer wiring up Analysis' saved profiles, I want a dedicated criteria type
and a `describeFilterCriteria` case for it, following the same pattern as every other area.

### FRONTEND-112-AC-06 [AUTO]
**Statement**: `types/filterProfile.ts` shall gain `'ANALYSIS_FILTERS'` as a fifth
`FilterProfileArea` value and a new `AnalysisFilterCriteria` interface: `minSeriesCount: string`,
`minAveragePersonalRating: string`, `minAverageBlendedRating: string`, `statusScope: 'all' |
'completed'`, `sortBy: NameStatsSortBy | undefined`, `sortDirection: NameStatsSortDirection |
undefined` (importing `NameStatsSortBy`/`NameStatsSortDirection` from `components/NameStatsTable`,
matching how `hooks/useNameStatsFilters.ts` already imports them).

**References**: `hooks/useNameStatsFilters.ts`'s existing `FilterInputs` interface (the shape this
mirrors, plus `sortBy`/`sortDirection`).

**Test Case (Green)**: type-only change, verified by `FRONTEND-112-AC-09`'s tests compiling and
passing.

---

### FRONTEND-112-AC-07 [AUTO]
**Statement**: `utils/describeFilterCriteria.ts` shall gain a `describeAnalysisFiltersCriteria`
function (dispatched for `area === 'ANALYSIS_FILTERS'`), producing: Min Series Count, Min Avg
Personal Rating, Min Avg Blended Rating (plain `entry` helper, matching `NameStatsTable.tsx`'s
exact field labels: "Min Series Count", "Min Avg Personal Rating", "Min Avg Blended Rating"),
Status (only when `statusScope === 'completed'`, matching `STATUS_FILTER_LABELS`'s existing
"only-when-non-default" pattern — new label `{ completed: 'Completed Only' }`, no entry for
`'all'`), Sort By (only when `sortBy !== undefined`, a new `NAME_STATS_SORT_BY_LABELS` map:
`seriesCount → 'Series Count'`, `averagePersonalRating → 'Avg Personal Rating'`,
`averageBlendedRating → 'Avg Blended Rating'`, `name → 'Name'`), Sort Direction (only when
`sortDirection !== undefined`, reusing the existing `SORT_DIRECTION_LABELS` map — same underlying
`'asc' | 'desc'` string type as `UseMySeriesFilterCriteria['sortDirection']`).

**References**: `describeFilterCriteria.ts`'s existing `describeUseMySeriesCriteria` (the closest
existing sibling — same "only-when-non-default" pattern for status/sort, though this area's
defaults are genuinely `undefined`/`'all'` rather than needing `frontend_spec_109-AC-13`'s explicit
default-value comparison — see this spec's Design Decisions); `NameStatsTable.tsx`'s exact field
labels (the strings this must match).

**Test Case (Red)**:
```typescript
// src/utils/describeFilterCriteria.test.ts (additions)
describe('FRONTEND-112-AC-07: describeFilterCriteria for ANALYSIS_FILTERS', () => {
  it('produces one entry per non-default field', () => {
    const entries = describeFilterCriteria('ANALYSIS_FILTERS', {
      minSeriesCount: '3',
      statusScope: 'completed',
      sortBy: 'averagePersonalRating',
      sortDirection: 'desc',
    } as Partial<AnalysisFilterCriteria>)
    expect(entries.find((e) => e.label === 'Min Series Count')?.value).toBe('3')
    expect(entries.find((e) => e.label === 'Status')?.value).toBe('Completed Only')
    expect(entries.find((e) => e.label === 'Sort By')?.value).toBe('Avg Personal Rating')
  })

  it('returns an empty array at the true defaults (statusScope "all", sortBy/sortDirection undefined)', () => {
    const entries = describeFilterCriteria('ANALYSIS_FILTERS', {
      minSeriesCount: '',
      minAveragePersonalRating: '',
      minAverageBlendedRating: '',
      statusScope: 'all',
      sortBy: undefined,
      sortDirection: undefined,
    } as Partial<AnalysisFilterCriteria>)
    expect(entries).toEqual([])
  })
})
```
**Test Case (Green)**: implement `describeAnalysisFiltersCriteria` and its dispatch case until the
spec above passes.

---

## Requirement 4: Analysis Filters — apply/clear support in `useNameStatsFilters`

**User story**: As a user on the Analysis page, I want to apply a saved profile immediately and
clear back to defaults, matching how every other saved-filter area already behaves.

### FRONTEND-112-AC-08 [AUTO]
**Statement**: `useNameStatsFilters` shall gain two new methods on its returned
`NameStatsFiltersState`:
- `applyFilterProfile(criteria: AnalysisFilterCriteria)`: sets `filterInputs` and `appliedFilters`
  from `criteria`'s filter fields, sets `sortBy`/`sortDirection` from `criteria`, and bumps
  `applyVersion` — applying immediately, no separate Apply click required.
- `clearFilterProfile()`: resets `filterInputs`/`appliedFilters` to `emptyFilterInputs` (matching
  `handleResetFilters`) **and** resets `sortBy`/`sortDirection` to `undefined` (deliberately
  different from `handleResetFilters`, which leaves sort untouched — see this spec's Design
  Decisions), bumping `applyVersion`.

**References**: `useNameStatsFilters.ts`'s existing `handleApplyFilters`/`handleResetFilters` (the
patterns these two new methods are adapted from, not copies of).

**Test Case (Red)**:
```typescript
// src/hooks/useNameStatsFilters.test.ts (additions, if this file exists -- confirm before writing;
// if the hook is only tested indirectly via NameStatsTable.test.tsx today, add these there instead
// following whatever the existing test-location convention for this hook already is)
describe('FRONTEND-112-AC-08: applyFilterProfile / clearFilterProfile', () => {
  it('applyFilterProfile sets filters and sort immediately, bumping applyVersion', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    const versionBefore = result.current.applyVersion
    act(() =>
      result.current.applyFilterProfile({
        minSeriesCount: '3',
        minAveragePersonalRating: '',
        minAverageBlendedRating: '',
        statusScope: 'completed',
        sortBy: 'seriesCount',
        sortDirection: 'desc',
      }),
    )
    expect(result.current.appliedFilters.minSeriesCount).toBe('3')
    expect(result.current.sortBy).toBe('seriesCount')
    expect(result.current.applyVersion).toBeGreaterThan(versionBefore)
  })

  it('clearFilterProfile resets filters AND sort, unlike handleResetFilters', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    act(() => result.current.handleSortChange('name'))
    act(() => result.current.clearFilterProfile())
    expect(result.current.sortBy).toBeUndefined()
  })
})
```
**Test Case (Green)**: add both methods until the spec above passes.

---

## Requirement 5: Analysis Filters — `FilterProfileSelector` in `AnalysisView`

**User story**: As a user browsing any of the three Analysis tabs, I want one saved-filter picker
shared across all of them, matching how the underlying filter/sort state is already shared.

### FRONTEND-112-AC-09 [AUTO]
**Statement**: `AnalysisView.tsx` shall render `<FilterProfileSelector area="ANALYSIS_FILTERS"
currentCriteria={{ ...filters.filterInputs, sortBy: filters.sortBy, sortDirection:
filters.sortDirection }} onApply={filters.applyFilterProfile} onClear={filters.clearFilterProfile}
/>` once, positioned between the tab `<nav>` and the active tab's view — not inside
`NameStatsTable.tsx` (see this spec's Overview/Design Decisions for why).

**References**: `AnalysisView.tsx`'s existing single `useNameStatsFilters()` instantiation
(`frontend_spec_096-AC-10`), the shared-state architecture this placement follows.

**Test Case (Red)**:
```typescript
// src/components/AnalysisView.test.tsx (additions)
describe('FRONTEND-112-AC-09: shared FilterProfileSelector across Analysis tabs', () => {
  it('renders exactly one FilterProfileSelector, positioned above the active tab view', () => {
    render(<AnalysisView />, { route: '/analysis/keywords' })
    expect(screen.getAllByTestId('filter-profile-selector')).toHaveLength(1)
  })

  it('applying a saved profile updates the shared filters, visible after switching tabs', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'ANALYSIS_FILTERS',
        name: 'Top rated only',
        criteria: { minAverageBlendedRating: '8', statusScope: 'completed' },
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(<AnalysisView />, { route: '/analysis/keywords' })
    fireEvent.click(await screen.findByText('Top rated only'))
    fireEvent.click(screen.getByRole('link', { name: /genres/i }))
    // the shared hook instance means the applied filter survives the tab switch --
    // assert via whatever NameStatsTable exposes for its currently-applied filters
  })
})
```
**Test Case (Green)**: add the `FilterProfileSelector` and its adapters until the spec above
passes.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| The two new `FilterProfileArea` values this spec consumes | `series_spec_057_filter_profile_new_areas.md` |
| `FilterProfileSelector` component and `describeFilterCriteria`/`suggestFilterProfileName` utility this spec reuses and extends | `frontend_spec_107_filter_profile_ui.md`, `frontend_spec_108_filter_profile_management_and_save_modal.md` |
| End-of-fields placement, toggle-off-on-reclick (`onClear`), disabled-when-empty conventions this spec follows | `frontend_spec_109_filter_profile_polish.md` |
| Custom Search's original exclusion, now resolved | `frontend_spec_107_filter_profile_ui.md`'s Overview, `RecommendationFiltersBox.tsx`'s `isCustomSearch` gates |
| Analysis' single shared filter/sort state, the reason one area (not three) and one picker instance (in `AnalysisView`, not `NameStatsTable`) | `frontend_spec_096_analysis_filters_consistency_and_persistence.md` |
| `frontend_spec_109-AC-13`'s default-value comparison bug, explicitly verified not to recur here | `frontend_spec_109_filter_profile_polish.md`, `utils/describeFilterCriteria.ts` |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-112-AC-01: `CUSTOM_SEARCH` area + `CustomSearchFilterCriteria` type
- [ ] FRONTEND-112-AC-02: `describeCustomSearchCriteria` dispatch case
- [ ] FRONTEND-112-AC-03: `CustomSearchPanel.tsx` renders `FilterProfileSelector` at the end of its fields
- [ ] FRONTEND-112-AC-04: `CustomSearchPanel.tsx` gains `handleClearCustomSearchFilters` + a Clear Filters button
- [ ] FRONTEND-112-AC-05: Save Filters correctly disables when Custom Search criteria is empty (verified, no bug)
- [ ] FRONTEND-112-AC-06: `ANALYSIS_FILTERS` area + `AnalysisFilterCriteria` type
- [ ] FRONTEND-112-AC-07: `describeAnalysisFiltersCriteria` dispatch case
- [ ] FRONTEND-112-AC-08: `useNameStatsFilters` gains `applyFilterProfile`/`clearFilterProfile`
- [ ] FRONTEND-112-AC-09: `AnalysisView.tsx` renders one shared `FilterProfileSelector` across all three tabs
