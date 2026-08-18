# Frontend Spec 006: Search & Filter UI

**Status**: Not started
**Priority**: P1 (surfaces the backend's existing search endpoint, unused by the frontend today)
**Depends on**: Frontend Spec 001 (Types & API Service Layer) ✅, Frontend Spec 002 (`SeriesList`) ✅, Backend Spec 003 (Search & Filtering) ✅
**Frontend Stage**: 6 of N

---

## Overview

This spec wires up search/filtering, which the backend has fully supported since `series_spec_003_search.md` but the frontend has never exposed — `seriesApi.search()` and the `SearchCriteria` type already exist (Frontend Spec 001) and are unused by any component. It adds a new `SearchFilter` form and a small amendment to `SeriesList` so it can fetch via `seriesApi.search(criteria)` instead of `seriesApi.getAll()` when filters are active.

**Deliverables**:
- `src/components/SearchFilter.tsx` — a presentational filter form (no API calls of its own)
- `src/components/SearchFilter.module.css`
- `src/components/SearchFilter.test.tsx`
- Amendment to `src/components/SeriesList.tsx`: a new optional `criteria?: SearchCriteria` prop that switches its data source between `seriesApi.getAll()` and `seriesApi.search(criteria)`, plus a distinct empty-state message when a filter yields no results
- Amendment to `src/App.tsx`: own the active `criteria` state, render `SearchFilter` above `SeriesList`, wire `criteria` through
- `src/App.test.tsx` amendments covering the end-to-end wiring

**Design decisions captured here**:
- **`SearchFilter` doesn't call `seriesApi` itself.** It's a controlled emitter: local form state, and `onSearch(criteria)` / `onClear()` callbacks on submit/clear. `SeriesList` already owns all the fetch/loading/error/retry machinery (Frontend Spec 002) — reusing it for both data sources (`getAll`/`search`) avoids duplicating that machinery in a second component, and keeps `SearchFilter` itself small and easy to test in isolation.
- **Filtering is submit-triggered, not live-as-you-type.** Matches the project's existing form UX (`AddSeriesForm`'s "validation runs on submit, not on every keystroke" decision, Frontend Spec 003) and avoids needing to build debounce infrastructure that doesn't exist yet.
- **Genres are entered as a single comma-separated text field**, split and trimmed into the `string[]` `SearchCriteria.genres` expects. Building a tag/multi-select input is out of scope for this MVP pass — revisit if genre filtering sees real use and the UX friction matters.
- **No client-side range validation on filter fields** (unlike `AddSeriesForm`/`EditSeriesForm`). An inverted or out-of-domain range (e.g. `minPersonalRating` > `maxPersonalRating`) isn't a validation error here, it's just a filter that happens to match nothing — the backend doesn't reject search params, it only filters with them (`series_spec_003_search.md`). Blank/non-numeric fields are simply omitted from the built criteria, same convention as `AddSeriesForm`'s `buildPayload`.
- **This amends Frontend Spec 002's `SeriesList` Requirement 1.4** ("`useEffect` with an empty dependency array... mount only"): the fetch effect's dependency array now also includes `criteria`, so a criteria change triggers a re-fetch. This is a deliberate, documented supersession, not a regression — `SeriesList` remains self-contained and requires no props to fetch (Requirement 1.2 is unaffected; `criteria` is optional).
- **An empty/all-blank criteria object is treated identically to no criteria at all** — both result in `seriesApi.getAll()`. `SearchFilter` always calls `onSearch` on submit (even if every field was left blank), so `SeriesList` — not `SearchFilter` — is the single place that decides what "no active filter" means.
- **A newly added series that doesn't match the currently-active filter won't appear in the list** after `AddSeriesForm` succeeds, until filters are cleared. This is correct search behavior (the refresh-via-remount re-runs `seriesApi.search(criteria)` with the same active criteria), not a gap — noting it here so it isn't mistaken for a bug.

---

## Glossary

| Term | Definition |
|------|-----------|
| `SearchFilter` | The filter form component this spec delivers |
| Active criteria | A non-empty `SearchCriteria` object currently applied to `SeriesList` |
| Filtered empty state | The state shown when active criteria produce zero results (distinct from the true empty-collection state) |

---

## Requirements

### Requirement 1: Filter Fields

**User Story:** As a user, I want to filter my series by the criteria I care about, so that I can find what I'm looking for in a large collection.

#### Acceptance Criteria

- **FRONTEND-006-AC-01** [AUTO]: `SearchFilter` shall render one labelled control per `SearchCriteria` field: `title` (text), `genres` (text, comma-separated), `status` (select), `minPersonalRating`/`maxPersonalRating` (number), `minImdbRating`/`maxImdbRating` (number, step 0.1), `startedNotFinished` (checkbox).
- **FRONTEND-006-AC-02** [AUTO]: The `status` select shall include an "Any status" option representing no filter, selected by default, in addition to `WATCHING`/`COMPLETED`/`DROPPED`/`BACKLOG`.

---

### Requirement 2: Building & Submitting Criteria

**User Story:** As a user, I want to apply the filters I've entered, so that the list updates to match.

#### Acceptance Criteria

- **FRONTEND-006-AC-03** [AUTO]: `SearchFilter` shall accept a required `onSearch: (criteria: SearchCriteria) => void` prop.
- **FRONTEND-006-AC-04** [AUTO]: On submit, `SearchFilter` shall build a `SearchCriteria` containing only the fields currently non-blank (same omit-if-blank convention as `AddSeriesForm`'s `buildPayload`, Frontend Spec 003) and call `onSearch` with it, even if the result is an empty object.
- **FRONTEND-006-AC-05** [AUTO]: The `genres` field's comma-separated text shall be split into a trimmed, non-empty-entry `string[]` before being included in the built criteria.
- **FRONTEND-006-AC-06** [AUTO]: `SearchFilter` shall not call `onSearch` on mount — only in response to an explicit submit.

---

### Requirement 3: Clearing Filters

**User Story:** As a user, I want a quick way to remove all filters, so that I can get back to my full list.

#### Acceptance Criteria

- **FRONTEND-006-AC-07** [AUTO]: `SearchFilter` shall render a "Clear Filters" button (`data-testid="clear-filters-btn"`).
- **FRONTEND-006-AC-08** [AUTO]: `SearchFilter` shall accept a required `onClear: () => void` prop; when "Clear Filters" is clicked, it shall reset every field to blank/unset and call `onClear`, and shall not call `onSearch`.

---

### Requirement 4: `SeriesList` — Criteria-Driven Fetching

**User Story:** As a user, I want the list I'm looking at to reflect my applied filters, so that search actually narrows what I see.

#### Acceptance Criteria

- **FRONTEND-006-AC-09** [AUTO]: `SeriesList` shall accept an optional `criteria?: SearchCriteria` prop.
- **FRONTEND-006-AC-10** [AUTO]: When `criteria` is `undefined`, or is an object with no defined/non-empty fields, `SeriesList` shall fetch via `seriesApi.getAll()`.
- **FRONTEND-006-AC-11** [AUTO]: When `criteria` has at least one defined/non-empty field, `SeriesList` shall fetch via `seriesApi.search(criteria)` instead of `seriesApi.getAll()`.
- **FRONTEND-006-AC-12** [AUTO]: `SeriesList` shall re-fetch whenever the `criteria` prop changes (amends Frontend Spec 002, Requirement 1.4 — the fetch effect's dependency array now includes `criteria` alongside the existing retry mechanism).
- **FRONTEND-006-AC-13** [AUTO]: When Retry is clicked while `criteria` is active, `SeriesList` shall retry via `seriesApi.search(criteria)`, not `seriesApi.getAll()`.

---

### Requirement 5: `SeriesList` — Filtered Empty State

**User Story:** As a user, I want to know my filters simply matched nothing, so that I don't mistake it for having no series at all.

#### Acceptance Criteria

- **FRONTEND-006-AC-14** [AUTO]: When `criteria` is active and the fetch resolves to an empty array, `SeriesList` shall display "No series match your filters." instead of "No series yet." (Frontend Spec 002, Requirement 4.1).
- **FRONTEND-006-AC-15** [AUTO]: In the filtered empty state, `SeriesList` shall not render the "Add your first series" button (Frontend Spec 002, Requirement 4.2–4.3) — the header "Add Series" button (Requirement 6) remains visible regardless.

---

### Requirement 6: App Integration

**User Story:** As a user, I want to see the filter controls above my list and have them actually affect it, so that the feature is usable end-to-end.

#### Acceptance Criteria

- **FRONTEND-006-AC-16** [AUTO]: `App.tsx` shall own a `criteria: SearchCriteria | null` state, initialised to `null`.
- **FRONTEND-006-AC-17** [AUTO]: `App.tsx` shall render `SearchFilter` above `SeriesList`, with `onSearch` setting the `criteria` state and `onClear` setting it to `null`.
- **FRONTEND-006-AC-18** [AUTO]: `App.tsx` shall pass its `criteria` state into `SeriesList`'s `criteria` prop.

---

### Requirement 7: Shall Not — Data Handling

**User Story:** As a developer, I want to be sure filter values aren't leaked or applied unexpectedly, so that the feature behaves predictably.

#### Acceptance Criteria

- **FRONTEND-006-AC-19** [AUTO]: `SearchFilter` shall not log entered filter values to the console.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `SearchCriteria` | `src/types/series.ts` (Frontend Spec 001) |
| `seriesApi.search()`, `seriesApi.getAll()` | `src/services/seriesApi.ts` (Frontend Spec 001) |
| `GET /api/v1/series/search` contract, filtering semantics (title substring, genre OR logic, rating ranges, `startedNotFinished`) | `series_spec_003_search.md` |
| `SeriesList` fetch/loading/error/retry/empty-state conventions | `src/components/SeriesList.tsx` (Frontend Spec 002) |
| Omit-if-blank payload convention | `src/components/AddSeriesForm.tsx` `buildPayload` (Frontend Spec 003) |

---

## TDD Test Case Sketches

### `src/components/SearchFilter.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SearchFilter } from './SearchFilter'
import { SeriesStatus } from '../types/series'

beforeEach(() => {
  vi.clearAllMocks()
})

function renderFilter(overrides: Partial<{ onSearch: (c: unknown) => void; onClear: () => void }> = {}) {
  const onSearch = overrides.onSearch ?? vi.fn()
  const onClear = overrides.onClear ?? vi.fn()
  render(<SearchFilter onSearch={onSearch} onClear={onClear} />)
  return { onSearch, onClear }
}
```

```typescript
describe('FRONTEND-006-AC-01/02: fields', () => {
  it('renders a labelled control per SearchCriteria field, status defaulting to Any', () => {
    renderFilter()
    for (const label of [
      /title/i, /genres/i, /status/i, /min personal rating/i, /max personal rating/i,
      /min imdb rating/i, /max imdb rating/i, /started.*not finished/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByLabelText(/status/i)).toHaveValue('')
  })
})
```

```typescript
describe('FRONTEND-006-AC-03/04/05: submit builds criteria', () => {
  it('calls onSearch with only populated fields, genres split and trimmed', () => {
    const { onSearch } = renderFilter()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'office' } })
    fireEvent.change(screen.getByLabelText(/genres/i), { target: { value: 'Drama, Comedy ,' } })
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: SeriesStatus.WATCHING } })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'office',
        genres: ['Drama', 'Comedy'],
        status: SeriesStatus.WATCHING,
      }),
    )
    const payload = onSearch.mock.calls[0][0]
    expect(payload).not.toHaveProperty('minPersonalRating')
  })

  it('calls onSearch with an empty object when every field is blank', () => {
    const { onSearch } = renderFilter()
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalledWith({})
  })
})
```

```typescript
describe('FRONTEND-006-AC-06: no auto-search on mount', () => {
  it('does not call onSearch just from rendering', () => {
    const { onSearch } = renderFilter()
    expect(onSearch).not.toHaveBeenCalled()
  })
})
```

```typescript
describe('FRONTEND-006-AC-07/08: clearing', () => {
  it('resets fields and calls onClear, not onSearch', () => {
    const { onSearch, onClear } = renderFilter()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'office' } })

    fireEvent.click(screen.getByTestId('clear-filters-btn'))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/title/i)).toHaveValue('')
  })
})
```

### `src/components/SeriesList.test.tsx` (additions)

```typescript
describe('FRONTEND-006-AC-09/10/11: criteria-driven fetching', () => {
  it('calls getAll when no criteria is provided', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1))
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('calls getAll when criteria is an empty object', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList criteria={{}} />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1))
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('calls search with the given criteria when non-empty', async () => {
    mockSearch.mockResolvedValue([])
    render(<SeriesList criteria={{ title: 'office' }} />)
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith({ title: 'office' }))
    expect(mockGetAll).not.toHaveBeenCalled()
  })
})
```

```typescript
describe('FRONTEND-006-AC-12: re-fetch on criteria change', () => {
  it('re-fetches when criteria changes', async () => {
    mockSearch.mockResolvedValue([])
    const { rerender } = render(<SeriesList criteria={{ title: 'a' }} />)
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith({ title: 'a' }))

    rerender(<SeriesList criteria={{ title: 'b' }} />)
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith({ title: 'b' }))
    expect(mockSearch).toHaveBeenCalledTimes(2)
  })
})
```

```typescript
describe('FRONTEND-006-AC-13: retry uses search when criteria active', () => {
  it('retries via search, not getAll', async () => {
    mockSearch.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce([])
    render(<SeriesList criteria={{ title: 'office' }} />)
    await waitFor(() => screen.getByRole('button', { name: /retry/i }))

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2))
    expect(mockGetAll).not.toHaveBeenCalled()
  })
})
```

```typescript
describe('FRONTEND-006-AC-14/15: filtered empty state', () => {
  it('shows "No series match your filters." without the add-first-series button', async () => {
    mockSearch.mockResolvedValue([])
    render(<SeriesList criteria={{ title: 'nonexistent' }} />)
    await waitFor(() => expect(screen.getByText(/no series match your filters/i)).toBeInTheDocument())
    expect(screen.queryByText(/add your first series/i)).not.toBeInTheDocument()
  })
})
```

### `src/App.test.tsx` (additions)

```typescript
describe('FRONTEND-006-AC-16/17/18: search wiring', () => {
  it('applies a search from SearchFilter to the rendered list', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'The Office' } as Series])
    mockSearch.mockResolvedValue([{ id: '1', title: 'The Office' } as Series])

    render(<App />)
    await waitFor(() => screen.getByText('The Office'))

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'office' } })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ title: 'office' })))
  })

  it('reverts to getAll after Clear Filters', async () => {
    mockGetAll.mockResolvedValue([])
    mockSearch.mockResolvedValue([])
    render(<App />)
    await waitFor(() => screen.getByTestId('clear-filters-btn'))

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'office' } })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByTestId('clear-filters-btn'))
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
  })
})
```

---

## Acceptance Criteria Summary

- [ ] FRONTEND-006-AC-01: labelled control per `SearchCriteria` field
- [ ] FRONTEND-006-AC-02: status select has "Any status" default
- [ ] FRONTEND-006-AC-03: `onSearch` required prop
- [ ] FRONTEND-006-AC-04: submit builds criteria from populated fields only
- [ ] FRONTEND-006-AC-05: genres split/trimmed into `string[]`
- [ ] FRONTEND-006-AC-06: no `onSearch` call on mount
- [ ] FRONTEND-006-AC-07: "Clear Filters" button rendered
- [ ] FRONTEND-006-AC-08: Clear resets fields and calls `onClear`, not `onSearch`
- [ ] FRONTEND-006-AC-09: `SeriesList` accepts optional `criteria` prop
- [ ] FRONTEND-006-AC-10: empty/undefined criteria → `getAll()`
- [ ] FRONTEND-006-AC-11: non-empty criteria → `search(criteria)`
- [ ] FRONTEND-006-AC-12: re-fetch on criteria change
- [ ] FRONTEND-006-AC-13: Retry uses `search` when criteria active
- [ ] FRONTEND-006-AC-14: filtered empty state message
- [ ] FRONTEND-006-AC-15: no "Add your first series" button in filtered empty state
- [ ] FRONTEND-006-AC-16: `App.tsx` owns `criteria` state
- [ ] FRONTEND-006-AC-17: `SearchFilter` rendered above `SeriesList`, wired to state
- [ ] FRONTEND-006-AC-18: `criteria` passed into `SeriesList`
- [ ] FRONTEND-006-AC-19: no filter values logged to console
