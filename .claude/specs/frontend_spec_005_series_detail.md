# Frontend Spec 005: Series Detail View

**Status**: Implemented. `src/services/seriesApi.ts` (`getById`/`create`/`update` now unwrap `{ data: Series }`, fixing the pre-existing latent bug), `src/services/__tests__/seriesApi.test.ts` (SH-002/003/004 mocks corrected to the real double-wrapped shape), `src/components/SeriesDetail.tsx` + `SeriesDetail.module.css` + `SeriesDetail.test.tsx` (new), `src/App.tsx` (full-view swap between `SeriesList`/`SeriesDetail`, `seriesDetailKey` remount wiring), `src/App.test.tsx` (navigation + edit-from-detail coverage added). All work done red/green TDD. `npm test` (120/120 passing), `npm run lint` (clean — required switching the `id`-change reset logic from an in-effect `setState` to the React-recommended render-time "adjust state" pattern to satisfy `react-hooks/set-state-in-effect`), `npm run build` (clean) all verified on 2026-08-18. No real-browser pass done for this stage (not called out as required — see PR notes).
**Priority**: P1 (third write-path-adjacent UI — first read view beyond the list)
**Depends on**: Frontend Spec 001 (Types & API Service Layer) ✅, Frontend Spec 002 (`SeriesList`) ✅, Frontend Spec 004 (`EditSeriesForm`, delete-confirmation pattern) ✅, Backend Spec 002 (CRUD) ✅
**Frontend Stage**: 5 of N

---

## Overview

This spec covers `SeriesDetail` — a dedicated view showing a single series' full record, including `personalNotes` and `personalRating`, which `SeriesList` deliberately excludes (Frontend Spec 002, Requirement 9). Today, clicking a row calls `onSeriesClick(id)` and `App.tsx` renders a throwaway `<p>Selected series id: {id}</p>` stub alongside the still-visible list. This spec replaces that stub with a real view, and — while building it — fixes a pre-existing response-unwrapping bug in `seriesApi.ts` that this view is the first component to actually expose (see Requirement 1).

**Deliverables**:
- Fix to `src/services/seriesApi.ts`: `getById`, `create`, and `update` currently don't unwrap the backend's `{ data: SeriesDto }` envelope (Requirement 1 — a correctness prerequisite, not new behavior)
- Fix to `src/services/__tests__/seriesApi.test.ts`: SH-002/003/004 mocks currently encode the wrong (flat) response shape; corrected to match the real backend contract
- `src/components/SeriesDetail.tsx` — a container component that fetches a single series and renders its full record, with Edit and Delete actions
- `src/components/SeriesDetail.module.css`
- `src/components/SeriesDetail.test.tsx`
- Amendment to `src/App.tsx`: replace the `selectedSeriesId` stub with a real `SeriesDetail` render, mutually exclusive with `SeriesList`; wire its `onEditClick` into the same `editingSeries`/`EditSeriesForm` state `SeriesList` already uses; add a `SeriesDetail`-specific remount key so an edit made from the detail view refreshes it in place
- `src/App.test.tsx` amendments covering the new navigation and edit-from-detail wiring

**Design decisions captured here**:
- **No router.** `frontend_structure.md` lists `src/pages/` as "if routing is added (not yet created)", and no router package is installed (`package.json` has none). Adding one is a real architectural decision (deep-linking, history, code-splitting) that this spec doesn't need to make — `SeriesDetail` is reachable only by clicking a row, and "Back" is the only way out. Revisit if/when a requirement needs a shareable URL for a specific series.
- **Full-view swap, not a third modal type.** `AddSeriesForm` and `EditSeriesForm` are modals for short, focused write operations. Viewing a series' full record is closer to navigating to a page. `App.tsx` renders `SeriesDetail` *instead of* `SeriesList` (not both, and not `SeriesDetail` as an overlay) while a series is selected — consistent with the existing state-driven conditional-render pattern already used for the two modals, just without stacking a third overlay type on screen.
- **This swap needs no explicit refresh mechanism for `SeriesList`.** Because the two views are mutually exclusive, returning to the list via `onBack`/`onDeleted` unmounts `SeriesDetail` and mounts a brand-new `SeriesList`, which fetches on mount per its own existing contract (Frontend Spec 002, Requirement 1) — no `key` bump needed, unlike the add/edit-from-list success paths (which bump `SeriesList`'s `key` because it *stays mounted* under a modal). This spec's ACs assert the observable effect (`seriesApi.getAll` called again), not a redundant mechanism.
- **Editing from the detail view *does* need an explicit remount**, because `SeriesDetail` stays mounted underneath `EditSeriesForm` (same relationship `SeriesList` has to it). `App.tsx` gets a second remount key, bumped alongside the existing `SeriesList` key on every `EditSeriesForm` success, so whichever view is currently showing reflects the edit.
- **Delete reuses the exact inline-confirmation pattern from `SeriesList`** (Frontend Spec 004, Requirement 2): Delete → row/view swaps its Edit/Delete buttons for Confirm/Cancel → Confirm calls the API. Same `data-testid`s (`confirm-delete-btn`/`cancel-delete-btn`) are reused since only one instance of either component is ever mounted at a time.
- **404 is a distinct state from a generic fetch error.** `GET /api/v1/series/{id}` returns 404 when the id doesn't exist (`series_spec_002_crud.md`). A 404 means "this series is gone, offer a way back," not "something went wrong, try again" — so it gets its own state (no Retry button, since retrying a 404 can't succeed).
- **Dates are formatted for display but not asserted exactly in tests.** `dateAdded`/`dateCompleted` are ISO timestamps from the backend; `SeriesDetail` renders them via `toLocaleDateString()` for readability. Tests assert the field is *present and non-empty*, not an exact string, to avoid timezone-dependent flakiness in CI.

---

## Glossary

| Term | Definition |
|------|-----------|
| `SeriesDetail` | The full-record view component this spec delivers |
| Not-found state | The state shown when `seriesApi.getById` rejects with a 404 `ApiError` |
| Full-view swap | `App.tsx` rendering `SeriesDetail` in place of `SeriesList` (not alongside it) while a series is selected |

---

## Requirements

### Requirement 1: Fix `seriesApi` Response Unwrapping (Pre-Existing Bug)

**User Story:** As a developer, I want `seriesApi.getById`/`create`/`update` to actually return the series the backend sent, so that `SeriesDetail` (and any future consumer that reads fields off their results) doesn't silently render blanks.

`SeriesController` (`backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesController.java`) wraps every single-entity response in `ApiResponse<SeriesDto>` — `POST /api/v1/series`, `GET /api/v1/series/{id}`, and `PATCH /api/v1/series/{id}` all return `{ "data": { ...series... } }`, exactly like `GET /api/v1/series` wraps its list in `{ data: [...], count }`. `seriesApi.getAll`/`search` correctly unwrap this (`.then((res) => res.data)`); `getById`/`create`/`update` do not — they type the raw axios `response.data` (which is the whole `{ data: SeriesDto }` envelope) directly as `Series`. This has been latent because `AddSeriesForm`/`EditSeriesForm` never read fields off the object `onSuccess` receives (they just close the form and remount `SeriesList`), and the existing `seriesApi.test.ts` mocks for `getById`/`create`/`update` bake in the wrong, already-unwrapped shape, so no test catches it.

#### Acceptance Criteria

- **FRONTEND-005-AC-01** [AUTO]: `seriesApi.getById` shall unwrap the `{ data: SeriesDto }` envelope from `GET /api/v1/series/{id}` and resolve to the bare `Series`, matching the unwrapping `seriesApi.getAll` already performs for its own envelope.
- **FRONTEND-005-AC-02** [AUTO]: `seriesApi.create` shall likewise unwrap the `{ data: SeriesDto }` envelope from `POST /api/v1/series`.
- **FRONTEND-005-AC-03** [AUTO]: `seriesApi.update` shall likewise unwrap the `{ data: SeriesDto }` envelope from `PATCH /api/v1/series/{id}`.

---

### Requirement 2: Data Fetching

**User Story:** As a user, I want the detail view to load the series I clicked, so that I see its current information.

#### Acceptance Criteria

- **FRONTEND-005-AC-04** [AUTO]: `SeriesDetail` shall accept a required `id: string` prop and call `seriesApi.getById(id)` when it mounts.
- **FRONTEND-005-AC-05** [AUTO]: `SeriesDetail` shall call `seriesApi.getById` again whenever the `id` prop changes.

---

### Requirement 3: Loading State

**User Story:** As a user, I want to see that the series details are loading, so that I know the app is working.

#### Acceptance Criteria

- **FRONTEND-005-AC-06** [AUTO]: While the fetch is in flight, `SeriesDetail` shall display a loading indicator with `role="status"` and the text "Loading series details...", following the same pattern as `SeriesList` (Frontend Spec 002, Requirement 2).

---

### Requirement 4: Rendering Full Series Data

**User Story:** As a user, I want to see every detail I've recorded about a series, so that I have the full picture, not just the list summary.

#### Acceptance Criteria

- **FRONTEND-005-AC-07** [AUTO]: When the fetch resolves, `SeriesDetail` shall display every field of the returned `Series`: `title`, `year`, `genres`, `status`, `totalSeasons`, `totalEpisodes`, `currentSeason`, `currentEpisode`, `imdbRating`, `metacriticRating`, `rottenTomatoesRating`, `personalRating`, `personalNotes`, `dateAdded`, `dateCompleted`.
- **FRONTEND-005-AC-08** [AUTO]: Any field whose value is `null` shall display as "—" (mirrors `SeriesList`'s `imdbRating` convention, Frontend Spec 002, Requirement 3.5).
- **FRONTEND-005-AC-09** [AUTO]: `dateAdded`, and `dateCompleted` when non-`null`, shall be rendered as a human-readable formatted date rather than the raw ISO timestamp.
- **FRONTEND-005-AC-10** [AUTO]: `SeriesDetail` shall not render the series' `id` (UUID) as visible text (same convention as `SeriesList`, Frontend Spec 002, Requirement 9).

---

### Requirement 5: Not-Found State

**User Story:** As a user, I want a clear message if the series I'm trying to view no longer exists, so that I'm not stuck looking at a blank or broken page.

#### Acceptance Criteria

- **FRONTEND-005-AC-11** [AUTO]: If `seriesApi.getById` rejects with an `ApiError` whose `status` is `404`, `SeriesDetail` shall display "Series not found." and shall not display a Retry control.

---

### Requirement 6: Error State

**User Story:** As a user, I want a clear message and a way to retry if loading the details fails for a reason other than the series being gone, so that a network hiccup doesn't strand me.

#### Acceptance Criteria

- **FRONTEND-005-AC-12** [AUTO]: If `seriesApi.getById` rejects with anything other than a 404 `ApiError`, `SeriesDetail` shall display "Failed to load series. Please try again." in a `role="alert"` region with a Retry button.
- **FRONTEND-005-AC-13** [AUTO]: When Retry is clicked, `SeriesDetail` shall call `seriesApi.getById` again.

---

### Requirement 7: Back Navigation

**User Story:** As a user, I want a clear way back to my list from any state of the detail view, so that I'm never stuck.

#### Acceptance Criteria

- **FRONTEND-005-AC-14** [AUTO]: `SeriesDetail` shall render a "Back to series list" control (`data-testid="back-btn"`) in every state (loading, not-found, error, populated).
- **FRONTEND-005-AC-15** [AUTO]: `SeriesDetail` shall accept a required `onBack: () => void` prop; when the Back control is clicked, it shall call `onBack`.

---

### Requirement 8: Edit From Detail

**User Story:** As a user, I want to edit a series directly from its detail view, so that I don't have to go back to the list to fix something I just noticed.

#### Acceptance Criteria

- **FRONTEND-005-AC-16** [AUTO]: `SeriesDetail` shall accept an optional `onEditClick?: (series: Series) => void` prop.
- **FRONTEND-005-AC-17** [AUTO]: When populated, `SeriesDetail` shall render an "Edit" button (`data-testid="edit-series-btn"`); when clicked, if `onEditClick` is provided, it shall be called with the fetched `Series`.
- **FRONTEND-005-AC-18** [AUTO]: `SeriesDetail` shall not throw if Edit is clicked while `onEditClick` is not provided.

---

### Requirement 9: Delete From Detail

**User Story:** As a user, I want to delete a series directly from its detail view, so that I don't have to go back to the list to remove something I'm looking right at.

#### Acceptance Criteria

- **FRONTEND-005-AC-19** [AUTO]: When populated, `SeriesDetail` shall render a "Delete" button (`data-testid="delete-series-btn"`).
- **FRONTEND-005-AC-20** [AUTO]: When Delete is clicked, `SeriesDetail` shall replace the Edit/Delete buttons with a confirmation prompt (`data-testid="confirm-delete-btn"` / `"cancel-delete-btn"`), mirroring `SeriesList`'s inline delete confirmation (Frontend Spec 004, Requirement 2).
- **FRONTEND-005-AC-21** [AUTO]: When the confirmation's Cancel is clicked, `SeriesDetail` shall restore the Edit/Delete buttons and shall not call `seriesApi.delete`.
- **FRONTEND-005-AC-22** [AUTO]: When Confirm is clicked, `SeriesDetail` shall call `seriesApi.delete(id)`; while the call is in flight, Confirm shall be disabled and read "Deleting...", and Cancel shall be disabled.
- **FRONTEND-005-AC-23** [AUTO]: `SeriesDetail` shall accept a required `onDeleted: () => void` prop; when `seriesApi.delete` resolves, `SeriesDetail` shall call `onDeleted`.
- **FRONTEND-005-AC-24** [AUTO]: If `seriesApi.delete` rejects, `SeriesDetail` shall display `ApiError.message` in a `role="alert"` region, keep the confirmation controls visible and re-enabled for retry, and shall not call `onDeleted`.

---

### Requirement 10: App Integration — Navigation

**User Story:** As a user, I want clicking a series to take me to its details and clicking Back (or deleting it) to take me back to my list, so that navigation feels natural.

#### Acceptance Criteria

- **FRONTEND-005-AC-25** [AUTO]: `App.tsx` shall render `SeriesDetail` (with `id={selectedSeriesId}`) instead of `SeriesList` while `selectedSeriesId` is non-`null`, and shall render `SeriesList` otherwise (initial state `null`).
- **FRONTEND-005-AC-26** [AUTO]: When `SeriesList`'s `onSeriesClick` fires, `App.tsx` shall set `selectedSeriesId` to the clicked id.
- **FRONTEND-005-AC-27** [AUTO]: When `SeriesDetail`'s `onBack` or `onDeleted` fires, `App.tsx` shall set `selectedSeriesId` to `null`, causing `SeriesList` to mount fresh and re-fetch (verified by `seriesApi.getAll` being called again).

---

### Requirement 11: App Integration — Edit From Detail

**User Story:** As a user, I want an edit I make from the detail view to show up immediately on that same view, so that I get confirmation it worked without extra navigation.

#### Acceptance Criteria

- **FRONTEND-005-AC-28** [AUTO]: `SeriesDetail`'s `onEditClick` shall be wired to the same editing-series state and `EditSeriesForm` instance `App.tsx` already uses for `SeriesList`'s `onEditClick` (Frontend Spec 004, Requirement 11).
- **FRONTEND-005-AC-29** [AUTO]: When `EditSeriesForm`'s `onSuccess` fires, in addition to the existing `SeriesList` key bump (Frontend Spec 004, AC-37), `App.tsx` shall also change a `SeriesDetail`-specific key, forcing `SeriesDetail` to remount and re-fetch if it is currently rendered.

---

### Requirement 12: Shall Not — Data Handling

**User Story:** As a developer, I want to be sure the detail view doesn't leak series data, so that the app stays safe and predictable.

#### Acceptance Criteria

- **FRONTEND-005-AC-30** [AUTO]: `SeriesDetail` shall not log series data (including `personalNotes`) to the console.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `Series` | `src/types/series.ts` |
| `ApiResponse<T>`, `ApiError` | `src/types/api.ts` (Frontend Spec 001) |
| `seriesApi.getById()`, `seriesApi.delete()` (fixed here) | `src/services/seriesApi.ts` (Frontend Spec 001, amended by Requirement 1) |
| `GET /api/v1/series/{id}` contract, `{ data: SeriesDto }` envelope, 404 response shape | `series_spec_002_crud.md`, `SeriesController.java` |
| `onSeriesClick(id)` | `src/components/SeriesList.tsx` (Frontend Spec 002, Requirement 7) |
| `onEditClick(series)`, inline delete-confirmation pattern, `EditSeriesForm` | `src/components/SeriesList.tsx` / `EditSeriesForm.tsx` (Frontend Spec 004) |
| Refresh-via-remount pattern | `frontend_spec_003_add_series_form.md` |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (corrections)

```typescript
describe('SH-002: getById', () => {
  it('should unwrap { data: Series } and return the bare Series', async () => {
    const mock = makeSeries({ id: 'abc-123', title: 'Breaking Bad' })
    client.get.mockResolvedValue({ data: { data: mock } })

    const result = await seriesApi.getById('abc-123')

    expect(client.get).toHaveBeenCalledWith('/series/abc-123')
    expect(result.title).toBe('Breaking Bad')
    expect(result).not.toHaveProperty('data')
  })
})

describe('SH-003: create', () => {
  it('should unwrap { data: Series } and return the created Series', async () => {
    const mockCreated = makeSeries({ id: 'new-id', title: 'Severance' })
    client.post.mockResolvedValue({ data: { data: mockCreated } })

    const result = await seriesApi.create({ title: 'Severance' })

    expect(result.id).toBe('new-id')
    expect(result).not.toHaveProperty('data')
  })
})

describe('SH-004: update', () => {
  it('should unwrap { data: Series } and return the updated Series', async () => {
    const mockUpdated = makeSeries({ id: 'abc-123', currentSeason: 3 })
    client.patch.mockResolvedValue({ data: { data: mockUpdated } })

    const result = await seriesApi.update('abc-123', { currentSeason: 3 })

    expect(result.currentSeason).toBe(3)
    expect(result).not.toHaveProperty('data')
  })
})
```

### `src/components/SeriesDetail.test.tsx`

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SeriesDetail } from './SeriesDetail'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockGetById = vi.mocked(seriesApi.getById)
const mockDelete = vi.mocked(seriesApi.delete)

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'abc-123',
    title: 'The Office',
    year: 2005,
    genres: 'Comedy',
    totalSeasons: 9,
    totalEpisodes: 201,
    currentSeason: 4,
    currentEpisode: 10,
    status: SeriesStatus.WATCHING,
    imdbRating: 8.9,
    metacriticRating: null,
    rottenTomatoesRating: null,
    personalRating: 5,
    personalNotes: 'Rewatch of the year',
    dateAdded: '2026-01-01T00:00:00Z',
    dateCompleted: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})
```

```typescript
describe('FRONTEND-005-AC-04/06/07: fetch, loading, render', () => {
  it('shows a loading indicator, then the full record', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent(/loading series details/i)
    await waitFor(() => expect(screen.getByText('The Office')).toBeInTheDocument())
    expect(mockGetById).toHaveBeenCalledWith('abc-123')
    expect(screen.getByText('Rewatch of the year')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
```

```typescript
describe('FRONTEND-005-AC-08/10: null fields and no UUID', () => {
  it('shows "—" for null fields and never renders the id', async () => {
    mockGetById.mockResolvedValue(makeSeries({ metacriticRating: null }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('The Office'))
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText('abc-123')).not.toBeInTheDocument()
  })
})
```

```typescript
describe('FRONTEND-005-AC-11: not-found state', () => {
  it('shows "Series not found." and no Retry on 404', async () => {
    mockGetById.mockRejectedValue(new ApiError(404, 'Series not found'))
    render(<SeriesDetail id="missing-id" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/series not found/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('back-btn')).toBeInTheDocument()
  })
})
```

```typescript
describe('FRONTEND-005-AC-12/13: error state', () => {
  it('shows a generic error with Retry on non-404 failure, and retries on click', async () => {
    mockGetById
      .mockRejectedValueOnce(new ApiError(500, 'Internal server error'))
      .mockResolvedValueOnce(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/failed to load series/i))
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => expect(screen.getByText('The Office')).toBeInTheDocument())
    expect(mockGetById).toHaveBeenCalledTimes(2)
  })
})
```

```typescript
describe('FRONTEND-005-AC-14/15: back navigation', () => {
  it('calls onBack when Back is clicked', async () => {
    const onBack = vi.fn()
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={onBack} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByTestId('back-btn'))
    fireEvent.click(screen.getByTestId('back-btn'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
```

```typescript
describe('FRONTEND-005-AC-16/17/18: edit wiring', () => {
  it('calls onEditClick with the fetched series', async () => {
    const onEditClick = vi.fn()
    const series = makeSeries()
    mockGetById.mockResolvedValue(series)
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} onEditClick={onEditClick} />)

    await waitFor(() => screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByTestId('edit-series-btn'))
    expect(onEditClick).toHaveBeenCalledWith(series)
  })

  it('does not throw when Edit is clicked without onEditClick', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await waitFor(() => screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByTestId('edit-series-btn'))
  })
})
```

```typescript
describe('FRONTEND-005-AC-19..24: delete flow', () => {
  it('confirms, deletes, and calls onDeleted', async () => {
    const onDeleted = vi.fn()
    mockGetById.mockResolvedValue(makeSeries())
    mockDelete.mockResolvedValue(undefined)
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={onDeleted} />)

    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    expect(mockDelete).toHaveBeenCalledWith('abc-123')
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
  })

  it('cancels without deleting', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('cancel-delete-btn'))

    expect(screen.getByTestId('delete-series-btn')).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('shows an alert and stays confirmable on failure', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    mockDelete.mockRejectedValue(new ApiError(500, 'Internal server error'))
    const onDeleted = vi.fn()
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={onDeleted} />)

    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/internal server error/i))
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByTestId('confirm-delete-btn')).not.toBeDisabled()
  })
})
```

### `src/App.test.tsx` (additions)

```typescript
describe('FRONTEND-005-AC-25/26: navigating to detail', () => {
  it('renders SeriesDetail instead of SeriesList when a row is clicked', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    render(<App />)
    await waitFor(() => screen.getByTestId('series-row'))

    fireEvent.click(screen.getByTestId('series-row'))
    await waitFor(() => expect(screen.getByTestId('back-btn')).toBeInTheDocument())
    expect(screen.queryByTestId('series-row')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-27: returning to the list', () => {
  it('re-fetches SeriesList after Back', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    render(<App />)
    await waitFor(() => screen.getByTestId('series-row'))
    fireEvent.click(screen.getByTestId('series-row'))

    await waitFor(() => screen.getByTestId('back-btn'))
    fireEvent.click(screen.getByTestId('back-btn'))

    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('series-row')).toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-28/29: editing from detail refreshes it in place', () => {
  it('stays on SeriesDetail and shows updated data after a successful edit', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById
      .mockResolvedValueOnce({ id: '1', title: 'Show' } as Series)
      .mockResolvedValueOnce({ id: '1', title: 'Updated Show' } as Series)
    mockUpdate.mockResolvedValue({ id: '1', title: 'Updated Show' } as Series)

    render(<App />)
    await waitFor(() => screen.getByTestId('series-row'))
    fireEvent.click(screen.getByTestId('series-row'))
    await waitFor(() => screen.getByTestId('edit-series-btn'))

    fireEvent.click(screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Updated Show')).toBeInTheDocument()
    expect(screen.getByTestId('back-btn')).toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-005-AC-01: `seriesApi.getById` unwraps `{ data: Series }`
- [x] FRONTEND-005-AC-02: `seriesApi.create` unwraps `{ data: Series }`
- [x] FRONTEND-005-AC-03: `seriesApi.update` unwraps `{ data: Series }`
- [x] FRONTEND-005-AC-04: `SeriesDetail` fetches via `getById(id)` on mount
- [x] FRONTEND-005-AC-05: re-fetches on `id` change
- [x] FRONTEND-005-AC-06: loading indicator with role="status"
- [x] FRONTEND-005-AC-07: every Series field rendered
- [x] FRONTEND-005-AC-08: null fields display "—"
- [x] FRONTEND-005-AC-09: dates human-readable
- [x] FRONTEND-005-AC-10: id (UUID) never rendered as visible text
- [x] FRONTEND-005-AC-11: 404 → "Series not found.", no Retry
- [x] FRONTEND-005-AC-12: other errors → alert + Retry
- [x] FRONTEND-005-AC-13: Retry re-fetches
- [x] FRONTEND-005-AC-14: Back control present in every state
- [x] FRONTEND-005-AC-15: Back calls `onBack`
- [x] FRONTEND-005-AC-16: optional `onEditClick` prop
- [x] FRONTEND-005-AC-17: Edit button calls `onEditClick(series)`
- [x] FRONTEND-005-AC-18: no crash without `onEditClick`
- [x] FRONTEND-005-AC-19: Delete button rendered
- [x] FRONTEND-005-AC-20: Delete click shows Confirm/Cancel
- [x] FRONTEND-005-AC-21: confirmation Cancel restores buttons, no delete call
- [x] FRONTEND-005-AC-22: Confirm calls `seriesApi.delete`, loading state shown
- [x] FRONTEND-005-AC-23: required `onDeleted`, called on success
- [x] FRONTEND-005-AC-24: delete failure shows alert, stays confirmable
- [x] FRONTEND-005-AC-25: `App.tsx` swaps `SeriesList`/`SeriesDetail` on `selectedSeriesId`
- [x] FRONTEND-005-AC-26: `onSeriesClick` sets `selectedSeriesId`
- [x] FRONTEND-005-AC-27: `onBack`/`onDeleted` clears selection, `SeriesList` re-fetches
- [x] FRONTEND-005-AC-28: `onEditClick` wired to shared edit state
- [x] FRONTEND-005-AC-29: edit success bumps a `SeriesDetail`-specific key
- [x] FRONTEND-005-AC-30: no series data logged to console
