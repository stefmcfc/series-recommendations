# Frontend Spec 055: `SearchFilter` Overhaul — Field Changes, Genre Checkboxes, Collapsible Panel

**Status**: Not started
**Priority**: P3 (paired UI half of `series_spec_037`, plus two independent UI improvements — genre
as checkboxes, a collapsible panel)
**Depends on**: Series Spec 037 (`series_spec_037_search_filter_overhaul.md`, owns the
`SeriesSearchCriteria`/`GET /series/search` changes this spec's form fields map to) ✅ required,
Frontend Spec 014 (`frontend_spec_014_genre_dropdown.md`, owns the genre-checkbox-list pattern this
spec reuses, via `seriesApi.getGenreOptions()`) ✅
**Area**: Frontend (`components/SearchFilter.tsx`)

## Overview

Confirmed (2026-08-29) via reading `SearchFilter.tsx`: **Keywords already use `KeywordPicker`
(chip/pill format with a "Browse all keywords" modal) today — no change needed for that field.**
This spec covers what's actually not yet done:

1. Remove the Max Personal Rating, Max IMDb Rating, and "Started, not finished" fields (per
   `series_spec_037`'s backend removal).
2. Add Min TMDB Rating and Min/Max Year fields (per `series_spec_037`'s new filter fields).
3. Replace the free-text Genres input with a checkbox list, reusing the exact pattern
   `RecommendationControls.tsx` already has for its own Genre & Keyword mode (`genreOptions` fetched
   via `seriesApi.getGenreOptions()`, one checkbox per genre) — directly resolving the
   `future_ideas.md` entry "`SearchFilter`'s Genres field is free-text, not a tag/multi-select."
4. Make the whole filter panel collapsible ("Show Filters"/"Hide Filters"), reusing
   `RecommendationControls.tsx`'s existing `filtersOpen`/`aria-expanded`/`.filtersBody` disclosure
   pattern exactly — the same basic mechanism that spec already has, applied to `SearchFilter` for
   the first time. This satisfies the "collapsible" half of the `future_ideas.md` entry "Redo
   cluttered filter panels as a collapsible left-hand panel or slide-out sheet" for `SearchFilter`
   specifically; that entry's more ambitious "dedicated left-hand panel or slide-out sheet" layout
   redesign (for both `SearchFilter` and `RecommendationControls`) remains separately unspecced —
   this spec is the smaller, immediately-actionable piece of it.

## Design Decisions

- **Genre checkbox list mirrors `RecommendationControls.tsx`'s existing implementation exactly** —
  same `seriesApi.getGenreOptions()` fetch, same `genreOptions.map(...)` checkbox rendering,
  `id={`genre-checkbox-${genre}`}` naming. `form.genres` changes from a comma-separated `string` to
  `string[]` (`genresSelected`), matching `SearchCriteria.genres`'s existing `string[]` shape on the
  wire — `buildCriteria` already sends it as a list today, so this is a pure input-method change, no
  criteria-shape change.
- **The filter disclosure defaults to open (`filtersOpen: true`)**, unlike
  `RecommendationControls.tsx`'s own default of `false` — a deliberate deviation, not an
  inconsistency: `SearchFilter` is the primary, most-used filtering surface on the main "My Series"
  page, and collapsing it by default would hide functionality users already expect to see
  immediately, whereas `RecommendationControls`' Filters section is a secondary refinement panel.
  Both reuse the identical toggle mechanism; only the starting state differs, for a stated reason.
- **Field removal/addition maps directly to `series_spec_037`**: `maxPersonalRating`/
  `maxImdbRating`/`startedNotFinished` form fields and their `buildCriteria` lines are deleted;
  `minTmdbRating` (number input, `step="0.1"`, mirroring the existing Min IMDb Rating field) and
  `yearMin`/`yearMax` (number inputs) are added, sent as `criteria.minTmdbRating`/`yearMin`/`yearMax`
  — new `SearchCriteria` type fields matching `series_spec_037`'s new query params 1:1.
- **No change to Keywords.** Explicitly confirmed already pill/chip-based (`KeywordPicker`) —
  included here only as a documented "already done" note so a future session doesn't re-attempt it.

---

## Requirement 1: Remove Max Personal Rating, Max IMDb Rating, Started-Not-Finished

### FRONTEND-055-AC-01 [AUTO]
**Statement**: `SearchFilter` shall no longer render the Max Personal Rating, Max IMDb Rating, or
"Started, not finished" fields. `buildCriteria` shall no longer set
`maxPersonalRating`/`maxImdbRating`/`startedNotFinished` on the resulting `SearchCriteria`.

**Test Case (Red)**:
```typescript
it('FRONTEND-055-AC-01: no longer renders the removed fields', () => {
  render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
  expect(screen.queryByLabelText(/max personal rating/i)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/max imdb rating/i)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/started, not finished/i)).not.toBeInTheDocument()
})
```
**Test Case (Green)**: delete the three `FormState` fields, their JSX blocks, and their
`buildCriteria` lines.

---

## Requirement 2: Add Min TMDB Rating and Min/Max Year

### FRONTEND-055-AC-02 [AUTO]
**Statement**: `SearchFilter` shall render a "Min TMDB Rating" number input (`step="0.1"`,
mirroring the existing Min IMDb Rating field's shape) and "Min Year"/"Max Year" number inputs,
sending `minTmdbRating`/`yearMin`/`yearMax` on `SearchCriteria` when non-blank.

**Test Case (Red)**:
```typescript
it('FRONTEND-055-AC-02: submits minTmdbRating and yearMin/yearMax', async () => {
  const onSearch = vi.fn()
  render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)

  fireEvent.change(screen.getByLabelText(/min tmdb rating/i), { target: { value: '7.5' } })
  fireEvent.change(screen.getByLabelText(/min year/i), { target: { value: '2015' } })
  fireEvent.change(screen.getByLabelText(/max year/i), { target: { value: '2025' } })
  fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

  expect(onSearch).toHaveBeenCalledWith(
    expect.objectContaining({ minTmdbRating: 7.5, yearMin: 2015, yearMax: 2025 }),
  )
})
```
**Test Case (Green)**: new `FormState` fields + JSX inputs + `buildCriteria` lines, mirroring the
existing Min IMDb Rating field's number-parsing pattern exactly.

---

## Requirement 3: Genre checkbox list

### FRONTEND-055-AC-03 [AUTO]
**Statement**: The Genres field shall render as a checkbox list (one checkbox per genre from
`seriesApi.getGenreOptions()`), replacing the free-text input. Selected genres shall be sent as
`SearchCriteria.genres: string[]`, unchanged in shape from what `buildCriteria` already sends
today.

**References**: `RecommendationControls.tsx`'s existing genre checkbox list (`genreOptions.map`,
`id={`genre-checkbox-${genre}`}`).

**Test Case (Red)**:
```typescript
it('FRONTEND-055-AC-03: renders genres as checkboxes and submits selected ones', async () => {
  mockGetGenreOptions.mockResolvedValue(['Drama', 'Comedy', 'Crime'])
  const onSearch = vi.fn()
  render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)

  fireEvent.click(await screen.findByLabelText('Drama'))
  fireEvent.click(screen.getByLabelText('Crime'))
  fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

  expect(onSearch).toHaveBeenCalledWith(
    expect.objectContaining({ genres: ['Drama', 'Crime'] }),
  )
})
```
**Test Case (Green)**: fetch `genreOptions` on mount (mirroring the existing `keywordOptions`
fetch's `useEffect` shape), render a checkbox per option, track `genresSelected: string[]` in
`FormState`.

---

## Requirement 4: Collapsible filter panel

### FRONTEND-055-AC-04 [AUTO]
**Statement**: `SearchFilter` shall render a "Hide Filters"/"Show Filters" toggle button
(`aria-expanded={filtersOpen}`), defaulting to `filtersOpen: true`. The filter fields shall render
inside a `data-testid="filters-body"` container shown only when `filtersOpen`.

**References**: `RecommendationControls.tsx`'s existing `filtersOpen`/`aria-expanded`/
`.filtersBody` pattern, reused exactly except for the default value.

**Test Case (Red)**:
```typescript
it('FRONTEND-055-AC-04: filters are visible by default and can be collapsed', async () => {
  render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
  expect(screen.getByTestId('filters-body')).toBeInTheDocument()
  const toggle = screen.getByRole('button', { name: /hide filters/i })
  expect(toggle).toHaveAttribute('aria-expanded', 'true')

  fireEvent.click(toggle)
  expect(screen.queryByTestId('filters-body')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /show filters/i })).toHaveAttribute('aria-expanded', 'false')
})
```
**Test Case (Green)**: `const [filtersOpen, setFiltersOpen] = useState(true)`; wrap the existing
field block in the conditional `.filtersBody` container; toggle button label switches between "Show
Filters"/"Hide Filters" based on state.

---

## Cross-References

| This spec | Source |
|---|---|
| `SeriesSearchCriteria`/`GET /series/search` changes this spec's fields map to | `series_spec_037_search_filter_overhaul.md` |
| Genre checkbox pattern reused | `frontend_spec_014_genre_dropdown.md`, `RecommendationControls.tsx` |
| Collapsible-panel pattern reused | `RecommendationControls.tsx`'s `filtersOpen` disclosure |
| The free-text Genres gap this spec resolves | `.claude/ideas/future_ideas.md` ("`SearchFilter`'s Genres field is free-text...") |
| The bigger, still-open layout idea this spec partially satisfies | `.claude/ideas/future_ideas.md` ("Redo cluttered filter panels as a collapsible left-hand panel or slide-out sheet") |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-055-AC-01: Max Personal Rating/Max IMDb Rating/Started-not-finished removed
- [ ] FRONTEND-055-AC-02: Min TMDB Rating and Min/Max Year submit correctly
- [ ] FRONTEND-055-AC-03: Genres render and submit as checkboxes
- [ ] FRONTEND-055-AC-04: the filter panel is collapsible, open by default
