# Frontend Spec 013: Star Ratings & Sort

**Status**: Requirements 1-3 (`StarRating` component, display/input integration) not started. **Requirements 4 and 5 implemented together (2026-08-23)**: when Requirement 5 work began, Requirement 4's sort control (`SortOptions` type, `seriesApi.getAll`/`search` sort params, `SeriesList`'s field selector + direction toggle) turned out not to actually exist yet in the codebase despite this file's structure implying it was a separate prior step — so, following the same reasoning `series_spec_009_rating_sort.md` used for its own Requirements 1+2 (Requirement 2 can't stand on its own), both were built in one pass directly to the full six-field enum (`dateAdded`/`personalRating`/`title`/`year`/`imdbRating`/`tmdbRating`). **Design decision**: the sort control passes `sort: undefined` to `getAll()`/`search()` whenever the control is at its default (`dateAdded`/`desc`, matching the backend's own default), and only a populated `{ sortBy, sortDirection }` object once the user changes it away from default — this keeps a no-sort caller's request wire-identical to before the control existed. Files touched: `src/types/series.ts` (`SortOptions`), `src/services/seriesApi.ts` (`getAll(sort?)`, `search(criteria, sort?)`, `buildSortParams`), `src/components/SeriesList.tsx` (sort field `<select>` + direction toggle `<button>`, local `sortBy`/`sortDirection` state), plus test updates in `SeriesList.test.tsx`, `App.test.tsx`, and `seriesApi.test.ts` (three pre-existing `search(...)`-argument assertions needed a second `sort` argument added to stay accurate to the new two-argument signature).
**Depends on**: Frontend Spec 002 (`SeriesList`) ✅, Frontend Spec 003 (`AddSeriesForm`) ✅, Frontend Spec 004 (`EditSeriesForm`) ✅, Frontend Spec 005 (`SeriesDetail`) ✅, Series Spec 009 (`sortBy`/`sortDirection` on `GET /series`/`GET /series/search`, including its Requirement 2 amendment)
**Frontend Stage**: 13 of N

## Overview

Replaces every numeric `personalRating` display/input in the app with a shared `StarRating` component, adds a `personalRating` column to `SeriesList`, and adds a sort control so a user can order their list by rating instead of only `dateAdded`. Self-contained from the other two groups in this round of work — no dependency on Series Spec 007/008 or their frontend companions.

**Design decisions**:
- **One `StarRating` component, two modes** — read-only (display) when no `onChange` is passed, interactive when one is. `SeriesDetail` and the new `SeriesList` column use it read-only; `AddSeriesForm`/`EditSeriesForm` use it interactively. This avoids a separate `StarRatingDisplay`/`StarRatingInput` pair for what's fundamentally one visual component with a prop-gated behavior difference.
- **Clicking the currently-selected star clears the rating** back to unset, rather than requiring a separate "Clear" control — `personalRating` is optional (`1`–`5` or unset), and this is the standard star-widget convention for expressing "no rating" without extra chrome.
- **`SearchFilter`'s existing min/max personal rating range inputs stay plain number inputs, not stars.** A star widget is well-suited to picking one value; expressing a *range* (two bounds) via two independent star pickers is more UI than a `1`–`5` numeric range needs. Out of scope for this spec.
- **Sort state lives inside `SeriesList` itself**, not lifted into `App.tsx`/`SearchFilter`. Sorting is "how do I want to view this same list," a display concern local to the list — unlike filter `criteria`, which `ExportControls` also reads to scope an export. Keeping the two separate avoids conflating "what's included" with "what order it's shown in" inside one shared object.

---

## Requirements

### Requirement 1: `StarRating` Component

**User story**: As a developer, I want one shared star-rating component, so display and input treatments never drift apart.

#### Acceptance Criteria

- **FRONTEND-013-AC-01** [AUTO]: A new `StarRating` component shall accept `value: number | null` (`1`–`5`) and an optional `onChange?: (value: number | null) => void`. When `onChange` is omitted, it renders read-only (no interactive elements). When provided, it renders 5 buttons.
- **FRONTEND-013-AC-02** [AUTO]: In interactive mode, clicking star `n` (where the current `value !== n`) shall call `onChange(n)`. Clicking the star matching the current `value` shall call `onChange(null)` (clears the rating — see Design Decisions).
- **FRONTEND-013-AC-03** [AUTO]: Each star button shall carry `aria-label="Rate {n} star(s)"` and `aria-pressed={n <= (value ?? 0)}`, and the group a wrapping `aria-label="Personal rating"`.
- **FRONTEND-013-AC-04** [AUTO]: When `value` is `null`, `StarRating` shall render all 5 stars in their unfilled state (read-only mode: no numeric fallback text; interactive mode: `aria-pressed="false"` on every button).

---

### Requirement 2: Display Integration

**User story**: As a user, I want to see personal ratings as stars everywhere they already appear, so they're easier to scan than a bare number.

#### Acceptance Criteria

- **FRONTEND-013-AC-05** [AUTO]: `SeriesDetail`'s "Personal Rating" field shall render `<StarRating value={series.personalRating} />` (read-only) in place of the current `formatValue(series.personalRating)` text.
- **FRONTEND-013-AC-06** [AUTO]: `SeriesList` shall gain a `personalRating` column (read-only `StarRating`), rendered alongside the existing `imdbRating` column in each row.

---

### Requirement 3: Input Integration

**User story**: As a user, I want to set my personal rating by clicking stars when adding or editing a series, so entering a rating doesn't require typing a number I have to look up the meaning of (1–5).

#### Acceptance Criteria

- **FRONTEND-013-AC-07** [AUTO]: `AddSeriesForm`'s "Personal Rating" field shall replace the numeric `<input type="number">` with an interactive `<StarRating>`, wired to the same `personalRating` form-state slot (`buildPayload`'s existing omit-when-empty behavior is unchanged — a `null` value omits the field from `CreateSeriesRequest`).
- **FRONTEND-013-AC-08** [AUTO]: `EditSeriesForm`'s "Personal Rating" field shall replace the numeric input the same way, initialized from `series.personalRating` (`toFormState`'s existing conversion), and always included in `UpdateSeriesRequest` (consistent with every other rating-like field already sent unconditionally by this form once a value or explicit clear is present).
- **FRONTEND-013-AC-09** [AUTO]: The existing client-side `1`–`5` range validation (`validate`'s `personalRating` check in both forms) is no longer reachable through normal interaction once the numeric input is removed (`StarRating` can only ever produce `1`–`5` or `null`) and shall be deleted rather than left as dead code.

---

### Requirement 4: Sort Control

**User story**: As a user, I want to sort my series list by my own rating, so my favorites surface without filtering.

#### Acceptance Criteria

- **FRONTEND-013-AC-10** [AUTO]: `src/types/series.ts` shall gain a `SortOptions` interface: `sortBy?: 'dateAdded' | 'personalRating'`, `sortDirection?: 'asc' | 'desc'`.
- **FRONTEND-013-AC-11** [AUTO]: `seriesApi.getAll` and `seriesApi.search` shall each accept an additional optional `sort?: SortOptions` argument, passed through as `sortBy`/`sortDirection` query params when present.
- **FRONTEND-013-AC-12** [AUTO]: `SeriesList` shall render a sort control (a field selector — "Date Added" / "Personal Rating" — plus a direction toggle), owning `sortBy`/`sortDirection` as local state defaulting to `dateAdded`/`desc` (matching the backend's own default, `SERIES-009-AC-06`).
- **FRONTEND-013-AC-13** [AUTO]: Changing the sort control shall re-fetch via whichever of `getAll()`/`search()` is currently active (per existing `criteriaActive` branching), passing the current `sortBy`/`sortDirection` to it.

---

### Requirement 5: Additional Sort Options

**User story**: As a user, I want to sort my series list by title, year, IMDb rating, or TMDB rating from the same sort control, so I'm not limited to date-added or my own rating when deciding how to view my collection.

#### Acceptance Criteria

- **FRONTEND-013-AC-14** [AUTO]: `SortOptions.sortBy` (`FRONTEND-013-AC-10`) shall be extended to `'dateAdded' | 'personalRating' | 'title' | 'year' | 'imdbRating' | 'tmdbRating'`, matching `series_spec_009_rating_sort.md`'s enlarged `sortBy` enum (`SERIES-009-AC-07`).
- **FRONTEND-013-AC-15** [AUTO]: The sort control's field selector (`FRONTEND-013-AC-12`) shall gain four additional options — "Title", "Year", "IMDb Rating", "TMDB Rating" — alongside the existing "Date Added"/"Personal Rating". The existing direction toggle applies uniformly across all six fields; no field gets bespoke direction UI.
- **FRONTEND-013-AC-16** [AUTO]: Changing the sort control to any of the four new fields re-fetches via whichever of `getAll()`/`search()` is currently active, passing the selected `sortBy` and current `sortDirection` — the same re-fetch behavior `FRONTEND-013-AC-13` already established, applied unchanged to the new options.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `sortBy`/`sortDirection` params on both listing endpoints, null-`personalRating`-sorts-last | `series_spec_009_rating_sort.md` |
| Enlarged `sortBy` enum (`title`/`year`/`imdbRating`/`tmdbRating`), `tmdbRating`/`tmdbVoteCount` tiebreak | `series_spec_009_rating_sort.md` Requirement 2 (`SERIES-009-AC-07`–`AC-10`) |
| `SeriesEntity.personalRating` (`1`–`5`, nullable) | `series_spec_001_entity.md` |
| `SeriesDetail`'s `formatValue` field pattern being replaced for this one field | `frontend_spec_005_series_detail.md` |
| `AddSeriesForm`/`EditSeriesForm`'s existing `personalRating` field, validation, and omit-when-empty payload convention | `frontend_spec_003_add_series_form.md`, `frontend_spec_004_edit_delete_series.md` |
| `SeriesList`'s existing `criteriaActive` branching between `getAll()`/`search()` | `frontend_spec_002.md`, `frontend_spec_006_search_filter.md` |

---

## TDD Test Case Sketches

### `src/components/StarRating.test.tsx`

```typescript
describe('FRONTEND-013-AC-01/04: read-only mode', () => {
  it('renders no interactive elements when onChange is omitted', () => {
    render(<StarRating value={3} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-013-AC-02: interactive mode', () => {
  it('calls onChange(n) when clicking an unselected star', () => {
    const onChange = vi.fn()
    render(<StarRating value={2} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Rate 4 star(s)'))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('calls onChange(null) when clicking the currently-selected star', () => {
    const onChange = vi.fn()
    render(<StarRating value={3} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Rate 3 star(s)'))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
```

### `src/components/SeriesList.test.tsx` (additions)

```typescript
describe('FRONTEND-013-AC-06: personalRating column', () => {
  it('renders a read-only StarRating per row', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ personalRating: 4 })])
    render(<SeriesList />)

    expect(await screen.findByLabelText('Personal rating')).toBeInTheDocument()
  })
})

describe('FRONTEND-013-AC-12/13: sort control', () => {
  it('re-fetches getAll with sort params on change', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledWith(undefined))

    fireEvent.change(screen.getByLabelText(/sort by/i), { target: { value: 'personalRating' } })

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenLastCalledWith({ sortBy: 'personalRating', sortDirection: 'desc' }),
    )
  })
})
```

### `src/components/AddSeriesForm.test.tsx` (addition)

```typescript
describe('FRONTEND-013-AC-07: star input replaces numeric input', () => {
  it('sets personalRating via star click, omits from payload when never clicked', async () => {
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Ozark' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(seriesApi.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ personalRating: expect.anything() }),
      ),
    )
  })
})
```

### `src/components/SeriesList.test.tsx` (addition, Requirement 5)

```typescript
describe('FRONTEND-013-AC-15/16: additional sort options re-fetch correctly', () => {
  it('re-fetches with sortBy=tmdbRating when that option is selected', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledWith(undefined))

    fireEvent.change(screen.getByLabelText(/sort by/i), { target: { value: 'tmdbRating' } })

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenLastCalledWith({ sortBy: 'tmdbRating', sortDirection: 'desc' }),
    )
  })
})
```

---

## Acceptance Criteria Summary

- [ ] FRONTEND-013-AC-01: `StarRating` component, read-only vs. interactive modes
- [ ] FRONTEND-013-AC-02: click-to-set, click-selected-to-clear
- [ ] FRONTEND-013-AC-03: accessible labels/`aria-pressed`
- [ ] FRONTEND-013-AC-04: null value renders all-unfilled
- [ ] FRONTEND-013-AC-05: `SeriesDetail` uses `StarRating`
- [ ] FRONTEND-013-AC-06: `SeriesList` gains a `personalRating` column
- [ ] FRONTEND-013-AC-07: `AddSeriesForm` star input
- [ ] FRONTEND-013-AC-08: `EditSeriesForm` star input
- [ ] FRONTEND-013-AC-09: dead numeric-range validation removed
- [x] FRONTEND-013-AC-10: `SortOptions` type
- [x] FRONTEND-013-AC-11: `getAll`/`search` accept `sort`
- [x] FRONTEND-013-AC-12: `SeriesList` sort control + local state
- [x] FRONTEND-013-AC-13: changing sort re-fetches with current params
- [x] FRONTEND-013-AC-14: `SortOptions.sortBy` extended with `title`/`year`/`imdbRating`/`tmdbRating`
- [x] FRONTEND-013-AC-15: sort control gains four new field options
- [x] FRONTEND-013-AC-16: re-fetch behavior applies unchanged to the new options
