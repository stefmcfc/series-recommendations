# Frontend Spec 055: `SearchFilter` Overhaul — Field Changes, Genre Checkboxes, Collapsible Panel

**Status**: Amended (2026-08-29, pre-merge review feedback on the still-open PR) — Requirements 1-3
implemented and unaffected; Requirement 4's default flipped, and Requirements 5-7 added below.
Files: `frontend/src/components/SearchFilter.tsx`,
`frontend/src/components/SearchFilter.module.css`,
`frontend/src/components/SearchFilter.test.tsx`, `frontend/src/types/series.ts`,
`frontend/src/services/seriesApi.ts`,
`frontend/src/services/__tests__/seriesApi.test.ts`, `frontend/src/App.test.tsx`, new
`frontend/src/utils/yearBounds.ts`
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
- **The filter disclosure defaults to closed (`filtersOpen: false`)** — reverses this spec's
  original decision (which defaulted it open, reasoning `SearchFilter` was the primary filter
  surface). Per direct instruction, it now matches `RecommendationControls.tsx`'s own default
  exactly, for both panels to behave consistently.
- **Field-level HTML validation bounds mirror `RecommendationControls`' Custom Search fields
  exactly** (Requirement 5) — `min="0" max="10" step="0.1"` for rating fields, `min`/`max` of
  `1900`/`current year + 1` for year fields. `RecommendationControls.tsx` already hardcodes these as
  local `MIN_VALID_YEAR`/`MAX_VALID_YEAR` constants; this spec extracts them to a new shared
  `frontend/src/utils/yearBounds.ts` (now two components need the identical values, so duplicating
  the two-line consts a second time would just be drift waiting to happen) and has
  `RecommendationControls.tsx` import from there too, rather than leaving its own copy in place.
- **Min Personal Rating becomes the interactive `StarRating` component** (Requirement 6), replacing
  the plain number input — `StarRating` already supports this exact interactive mode (`onChange`
  provided → 5 buttons, click-to-set/click-again-to-clear), already used identically in
  `AddSeriesForm`/`EditSeriesForm`. `FormState.minPersonalRating` changes type from `string` to
  `number | null` to match `StarRating`'s own `value`/`onChange` shape directly — no string
  parsing needed for this field anymore.
- **The Status dropdown is removed entirely** (Requirement 7), pulled forward from
  `frontend_spec_056_series_list_status_tabs.md`'s own `FRONTEND-056-AC-04` (which will replace it
  with status-based tabs) — per direct instruction, since that spec makes the dropdown redundant.
  **This leaves a real, temporary gap**: until `frontend_spec_056` actually ships, there is no
  frontend way to filter by status at all (the backend `status` param still exists and works, only
  the UI control is gone). Accepted deliberately, not overlooked.
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
(`aria-expanded={filtersOpen}`), defaulting to `filtersOpen: false`. The filter fields shall render
inside a `data-testid="filters-body"` container shown only when `filtersOpen`.

**References**: `RecommendationControls.tsx`'s existing `filtersOpen`/`aria-expanded`/
`.filtersBody` pattern, reused exactly including the default value (amended — originally specced
to default open; see Design Decisions for why that changed).

**Test Case (Red)**:
```typescript
it('FRONTEND-055-AC-04: filters are hidden by default and can be expanded', async () => {
  render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
  expect(screen.queryByTestId('filters-body')).not.toBeInTheDocument()
  const toggle = screen.getByRole('button', { name: /show filters/i })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')

  fireEvent.click(toggle)
  expect(screen.getByTestId('filters-body')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /hide filters/i })).toHaveAttribute('aria-expanded', 'true')
})
```
**Test Case (Green)**: `const [filtersOpen, setFiltersOpen] = useState(false)`; wrap the existing
field block in the conditional `.filtersBody` container; toggle button label switches between "Show
Filters"/"Hide Filters" based on state.

---

## Requirement 5: Field-level validation bounds

**User story**: As a user, I don't want to be able to type an out-of-range rating or a nonsense
year into a filter field.

### FRONTEND-055-AC-05 [AUTO]
**Statement**: Min IMDb Rating and Min TMDB Rating inputs shall carry `min="0" max="10"
step="0.1"`. Min Year and Max Year inputs shall carry `min={MIN_VALID_YEAR}
max={MAX_VALID_YEAR}` from the new shared `frontend/src/utils/yearBounds.ts`
(`MIN_VALID_YEAR = 1900`, `MAX_VALID_YEAR = new Date().getFullYear() + 1`) — identical bounds to
`RecommendationControls.tsx`'s Custom Search fields.

**References**: `RecommendationControls.tsx`'s existing `min="0" max="10" step="0.1"` rating
inputs and `MIN_VALID_YEAR`/`MAX_VALID_YEAR` constants (relocated to the new shared util, imported
by both components).

**Test Case (Red)**:
```typescript
it('FRONTEND-055-AC-05: rating and year fields carry the same bounds as Custom Search', () => {
  render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /show filters/i }))

  const minImdb = screen.getByLabelText(/min imdb rating/i)
  expect(minImdb).toHaveAttribute('min', '0')
  expect(minImdb).toHaveAttribute('max', '10')
  expect(minImdb).toHaveAttribute('step', '0.1')

  const minTmdb = screen.getByLabelText(/min tmdb rating/i)
  expect(minTmdb).toHaveAttribute('min', '0')
  expect(minTmdb).toHaveAttribute('max', '10')

  const yearMin = screen.getByLabelText(/min year/i)
  expect(yearMin).toHaveAttribute('min', '1900')
  expect(yearMin).toHaveAttribute('max', String(new Date().getFullYear() + 1))
})
```
**Test Case (Green)**: add the `min`/`max`/`step` attributes to each input; extract
`MIN_VALID_YEAR`/`MAX_VALID_YEAR` out of `RecommendationControls.tsx` into
`frontend/src/utils/yearBounds.ts`, update `RecommendationControls.tsx` to import from there
(regression guard: its own existing tests must keep passing unmodified).

---

## Requirement 6: Min Personal Rating via `StarRating`

**User story**: As a user, I want to set a minimum personal-rating filter the same way I rate a
series elsewhere in the app — by clicking stars, not typing a number.

### FRONTEND-055-AC-06 [AUTO]
**Statement**: The Min Personal Rating field shall render as an interactive `<StarRating value={form.minPersonalRating} onChange={...} />` (5 clickable stars), replacing the number input.
`FormState.minPersonalRating` changes type to `number | null`. Clicking an already-selected star
clears it (`StarRating`'s existing click-to-clear semantics — `onChange(n === value ? null : n)`).

**References**: `StarRating.tsx`'s existing interactive mode, already used identically in
`AddSeriesForm`/`EditSeriesForm`.

**Test Case (Red)**:
```typescript
it('FRONTEND-055-AC-06: Min Personal Rating is set via stars', async () => {
  const onSearch = vi.fn()
  render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /show filters/i }))

  fireEvent.click(screen.getByRole('button', { name: 'Rate 3 star(s)' }))
  fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

  expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ minPersonalRating: 3 }))
})
```
**Test Case (Green)**: swap the number `<input>` for `<StarRating value={form.minPersonalRating}
onChange={(v) => setForm((prev) => ({ ...prev, minPersonalRating: v }))} />`; `buildCriteria` sends
`form.minPersonalRating` directly (already `number | null`, no string parsing).

---

## Requirement 7: Remove the Status dropdown

**User story**: As a developer, I want `SearchFilter` to stop owning status filtering now that
status-based tabs are taking over that job.

### FRONTEND-055-AC-07 [AUTO]
**Statement**: `SearchFilter` shall no longer render the Status `<select>`. `buildCriteria` shall
no longer set `status` on the resulting `SearchCriteria`. `FormState.status` is removed.

**References**: Pulled forward from `frontend_spec_056_series_list_status_tabs.md`'s
`FRONTEND-056-AC-04` (identical AC text) — that spec's own copy should be treated as already
satisfied once this ships; don't re-implement it a second time when `frontend_spec_056` is picked
up.

**Test Case (Red)**:
```typescript
it('FRONTEND-055-AC-07: no longer renders a Status field', () => {
  render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /show filters/i }))
  expect(screen.queryByLabelText(/^status$/i)).not.toBeInTheDocument()
})
```
**Test Case (Green)**: remove the `status` `FormState` field, its `<select>` JSX, and its
`buildCriteria` line.

---

## Cross-References

| This spec | Source |
|---|---|
| `SeriesSearchCriteria`/`GET /series/search` changes this spec's fields map to | `series_spec_037_search_filter_overhaul.md` |
| Genre checkbox pattern reused | `frontend_spec_014_genre_dropdown.md`, `RecommendationControls.tsx` |
| Collapsible-panel pattern reused | `RecommendationControls.tsx`'s `filtersOpen` disclosure |
| The free-text Genres gap this spec resolves | `.claude/ideas/future_ideas.md` ("`SearchFilter`'s Genres field is free-text...") |
| The bigger, still-open layout idea this spec partially satisfies | `.claude/ideas/future_ideas.md` ("Redo cluttered filter panels as a collapsible left-hand panel or slide-out sheet") |
| `min`/`max`/`step` bounds mirrored exactly | `RecommendationControls.tsx`'s Custom Search fields |
| `StarRating`, reused interactively | `frontend_spec_013_star_ratings.md` |
| Status dropdown removal, pulled forward from | `frontend_spec_056_series_list_status_tabs.md` (`FRONTEND-056-AC-04`) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-055-AC-01: Max Personal Rating/Max IMDb Rating/Started-not-finished removed
- [x] FRONTEND-055-AC-02: Min TMDB Rating and Min/Max Year submit correctly
- [x] FRONTEND-055-AC-03: Genres render and submit as checkboxes
- [ ] FRONTEND-055-AC-04: the filter panel is collapsible, **closed** by default (amended)
- [ ] FRONTEND-055-AC-05: rating/year fields carry the same validation bounds as Custom Search
- [ ] FRONTEND-055-AC-06: Min Personal Rating is set via `StarRating`
- [ ] FRONTEND-055-AC-07: the Status dropdown is removed
