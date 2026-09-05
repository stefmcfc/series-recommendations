# Frontend Spec 064: Sort Direction Defaults on Field Selection

**Status**: Fully implemented. Requirement 2 (`UseMySeriesPanel`'s picker sort,
FRONTEND-064-AC-04/AC-05) was implemented via `frontend_spec_081_use_my_series_page_restructure.md`
(`components/UseMySeriesPanel.tsx`, `components/UseMySeriesPanel.test.tsx`). Requirement 1
(`SeriesList`'s own sort, FRONTEND-064-AC-01/AC-02/AC-03) was implemented in
`components/SeriesList.tsx`'s `handleSortByChange` and covered in `components/SeriesList.test.tsx`.
**Priority**: P4
**Depends on**: Frontend Spec 013 (`frontend_spec_013_star_ratings.md`, owns `SeriesList`'s
`sortBy`/`sortDirection` state and `SORT_BY_OPTIONS`) ✅, Frontend Spec 035
(`frontend_spec_035_specific_series_picker.md`, owns `UseMySeriesPanel`'s
`specificSeriesSortBy`/`specificSeriesSortDirection` state and `SPECIFIC_SERIES_SORT_BY_OPTIONS`)
✅
**Area**: Frontend (`components/SeriesList.tsx`, `components/UseMySeriesPanel.tsx`)

## Overview

Confirmed by reading the code: every sort control in this app (`SeriesList`'s My Series sort,
`UseMySeriesPanel`'s series-picker sort) uses one shared asc/desc toggle that's seeded once at
mount and never reset when the sort *field* itself changes — switching from "Title" to "Personal
Rating" just keeps whichever direction was last left. This spec adds that reset: the first time a
sort field is newly selected, its direction defaults to descending, except Title/series-name,
which defaults to ascending. A direction the user then manually toggles for that field is left
alone until the field changes again.

## Design Decisions

- **Reset triggers on sort *field* change, not on every render or on direction toggle.** Only the
  `handleSortByChange`/`handleSpecificSeriesSortByChange` handlers gain the new default-setting
  behavior; `handleSortDirectionToggle`/`handleSpecificSeriesSortDirectionToggle` are unchanged —
  a user can still freely toggle away from the default for whichever field is currently selected.
- **Title/series-name is the sole ascending default; every other field defaults descending** —
  matches the idea as raised: newest/highest-first reads naturally for dates and ratings, while
  alphabetical A→Z reads naturally for a name field.
- **No change to the initial mount defaults** — `SeriesList`'s `DEFAULT_SORT_BY`/
  `DEFAULT_SORT_DIRECTION` (`dateAdded`/`desc`) and `UseMySeriesPanel`'s initial
  `specificSeriesSortBy`/`specificSeriesSortDirection` (`title`/`asc`) already happen to match this
  rule for their respective default fields, so mount behavior is unaffected — only what happens
  when the *field* is changed afterward.
- **Both components get the same rule, implemented independently** — `SeriesList`'s sort is a
  request parameter (server-side), `UseMySeriesPanel`'s is a pure client-side array sort
  (`RecommendationControls.tsx`'s own comment on `SPECIFIC_SERIES_SORT_BY_OPTIONS` notes this
  explicitly). No shared hook is introduced here since the two already have entirely separate
  state shapes and change handlers; a future shared abstraction is out of scope (see
  `.claude/SPEC_CANDIDATES.md`'s "Share filter/sort logic..." candidate for that larger question).

## Requirements

### Requirement 1: `SeriesList`'s sort direction defaults per newly-selected field

**User Story**: As a user of the My Series list, when I pick a new field to sort by, I want a
sensible default direction (newest/highest first, or A→Z for Title) so I don't have to manually
flip it every time.

#### FRONTEND-064-AC-01 [AUTO]: selecting a non-Title field defaults direction to descending
**Statement**: When the user selects a `sortBy` value other than `'title'` in `SeriesList`'s sort
dropdown, the `SeriesList` component shall set `sortDirection` to `'desc'`.

**Rationale**: Core behavior for the majority of fields (dates, ratings, year).

**References**:
- Component: `components/SeriesList.tsx` `handleSortByChange` (line 317)

**Test Case (Red)**:
```typescript
describe('FRONTEND-064-AC-01: selecting a non-Title field defaults to descending', () => {
  it('sets sortDirection to desc when switching to Personal Rating', async () => {
    render(<SeriesList />)
    fireEvent.click(screen.getByLabelText('Sort ascending')) // start from asc, to prove the reset
    fireEvent.change(screen.getByLabelText('Sort by'), {
      target: { value: 'personalRating' },
    })
    expect(screen.getByLabelText('Sort descending')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: `handleSortByChange` calls both `setSortBy` and
`setSortDirection(newField === 'title' ? 'asc' : 'desc')`.

#### FRONTEND-064-AC-02 [AUTO]: selecting Title defaults direction to ascending
**Statement**: When the user selects `sortBy: 'title'` in `SeriesList`'s sort dropdown, the
`SeriesList` component shall set `sortDirection` to `'asc'`.

**Rationale**: Title/series-name is the sole field that reads more naturally ascending.

**References**:
- Component: `components/SeriesList.tsx` `handleSortByChange`
- Related: `FRONTEND-064-AC-01`

**Test Case (Red)**:
```typescript
describe('FRONTEND-064-AC-02: selecting Title defaults to ascending', () => {
  it('sets sortDirection to asc when switching to Title from a descending field', async () => {
    render(<SeriesList />)
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'year' } })
    expect(screen.getByLabelText('Sort descending')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'title' } })
    expect(screen.getByLabelText('Sort ascending')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: same `handleSortByChange` branch as `FRONTEND-064-AC-01` covers this case.

#### FRONTEND-064-AC-03 [AUTO]: a manual direction toggle is preserved until the field changes again
**Statement**: While the user has manually toggled `sortDirection` for the currently-selected
`sortBy` field, the `SeriesList` component shall not revert that direction until a different
`sortBy` value is selected.

**Rationale**: Regression guard — the new default-on-change behavior must not fight a user's
explicit toggle by resetting on every re-render.

**References**:
- Component: `components/SeriesList.tsx` `handleSortDirectionToggle` (line 321, unchanged)

**Test Case (Red)**:
```typescript
describe('FRONTEND-064-AC-03: manual toggle survives re-renders for the same field', () => {
  it('keeps ascending after toggling, without re-selecting the field', async () => {
    render(<SeriesList />)
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'year' } })
    fireEvent.click(screen.getByLabelText('Sort descending')) // toggle to asc
    expect(screen.getByLabelText('Sort ascending')).toBeInTheDocument()
    // some unrelated state change / re-render trigger here, e.g. a prop update
    expect(screen.getByLabelText('Sort ascending')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: no new code — confirms `handleSortDirectionToggle` remains the only setter
for a manual toggle and `handleSortByChange` only fires on an actual field change.

### Requirement 2: `UseMySeriesPanel`'s series-picker sort direction defaults per newly-selected field

**User Story**: As a user narrowing the "Use My Series" candidate pool, when I pick a new field to
sort the picker by, I want the same sensible default direction as the My Series list.

#### FRONTEND-064-AC-04 [AUTO]: selecting a non-Title field defaults direction to descending
**Statement**: When the user selects a `specificSeriesSortBy` value other than `'title'` in
`UseMySeriesPanel`'s sort dropdown, the `UseMySeriesPanel` component shall set
`specificSeriesSortDirection` to `'desc'`.

**Rationale**: Same rule as Requirement 1, applied to the independently-implemented picker sort.

**References**:
- Component: `components/UseMySeriesPanel.tsx` `handleSpecificSeriesSortByChange` (line 64)

**Test Case (Red)**:
```typescript
describe('FRONTEND-064-AC-04: picker sort defaults to descending for non-Title fields', () => {
  it('sets specificSeriesSortDirection to desc when switching to IMDb Rating', async () => {
    render(<UseMySeriesPanel state={state} updateState={vi.fn()} allSeries={series} genreOptions={[]} />)
    fireEvent.change(screen.getByLabelText(/sort by/i), { target: { value: 'imdbRating' } })
    expect(screen.getByLabelText('Sort descending')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: `handleSpecificSeriesSortByChange` calls both `setSpecificSeriesSortBy` and
`setSpecificSeriesSortDirection(newField === 'title' ? 'asc' : 'desc')`.

#### FRONTEND-064-AC-05 [AUTO]: selecting Title defaults direction to ascending
**Statement**: When the user selects `specificSeriesSortBy: 'title'` in `UseMySeriesPanel`'s sort
dropdown, the `UseMySeriesPanel` component shall set `specificSeriesSortDirection` to `'asc'`.

**Rationale**: Same rule as `FRONTEND-064-AC-02`, applied to the picker sort.

**References**:
- Component: `components/UseMySeriesPanel.tsx` `handleSpecificSeriesSortByChange`
- Related: `FRONTEND-064-AC-04`

**Test Case (Red)**:
```typescript
describe('FRONTEND-064-AC-05: picker sort defaults to ascending for Title', () => {
  it('sets specificSeriesSortDirection to asc when switching to Title from a descending field', async () => {
    render(<UseMySeriesPanel state={state} updateState={vi.fn()} allSeries={series} genreOptions={[]} />)
    fireEvent.change(screen.getByLabelText(/sort by/i), { target: { value: 'year' } })
    fireEvent.change(screen.getByLabelText(/sort by/i), { target: { value: 'title' } })
    expect(screen.getByLabelText('Sort ascending')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: same `handleSpecificSeriesSortByChange` branch as `FRONTEND-064-AC-04`
covers this case.

## Cross-References

| Concept | Location |
|---|---|
| `SeriesList` sort state | `frontend/src/components/SeriesList.tsx` |
| `UseMySeriesPanel` picker sort state | `frontend/src/components/UseMySeriesPanel.tsx` |
| `SPECIFIC_SERIES_SORT_BY_OPTIONS` | `frontend/src/components/RecommendationControls.tsx` |
| Backend sort default precedent (global desc, not per-field) | `series_spec_009_rating_sort.md` |
| Larger shared filter/sort-logic question (not addressed here) | `.claude/SPEC_CANDIDATES.md`, "Share filter/sort logic between `SeriesList`/`SearchFilter`..." |

## Acceptance Criteria Summary

- [x] FRONTEND-064-AC-01: `SeriesList` — selecting a non-Title field defaults direction to descending
- [x] FRONTEND-064-AC-02: `SeriesList` — selecting Title defaults direction to ascending
- [x] FRONTEND-064-AC-03: `SeriesList` — a manual direction toggle is preserved until the field changes again
- [x] FRONTEND-064-AC-04: `UseMySeriesPanel` — selecting a non-Title field defaults direction to descending
- [x] FRONTEND-064-AC-05: `UseMySeriesPanel` — selecting Title defaults direction to ascending
