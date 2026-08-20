# Frontend Spec 023: Series Refresh — Single & Bulk

**Status**: Not started
**Depends on**: Frontend Spec 002 (`SeriesList`) ✅, Frontend Spec 005 (`SeriesDetail`) ✅, Series Spec 018 (`POST /series/{id}/refresh`, `POST`/`GET /series/refresh-all`, `RefreshResult`, `RefreshJobStatus`, `lastRefreshedAt`)
**Frontend Stage**: 23 of N
**Supersedes**: `frontend_spec_012_series_lifecycle_controls.md` Requirement 4 (Refresh Action) in full — see that spec's own note.

## Overview

Surfaces Series Spec 018's refresh capability: a per-series "Refresh" button on `SeriesDetail` (carried forward from the original design in `frontend_spec_012`, re-scoped to the current backend contract), plus a new "Refresh All" button on `SeriesList` that kicks off and tracks a bulk background job, and "last refreshed" timestamps in both places.

**Design decisions**:
- **Bulk refresh state is tracked via polling, not a push mechanism.** The backend job status endpoint (`SERIES-018-AC-18`) is a plain poll target — no WebSocket/SSE infrastructure exists in this app, and a personal collection's refresh batch is short enough (seconds to low minutes) that a 2–3 second poll interval is simple and sufficient.
- **The "Refresh All" button's disabled state survives a page reload.** `SeriesList` checks job status once on mount specifically so that reloading mid-batch doesn't let a user fire a second bulk job against the same already-running one (which the backend would reject with `409` anyway, but showing a stale enabled button inviting that click is worse UX than just reflecting reality on mount).
- **"Last refreshed" (single series) and "Last full refresh" (bulk) are two different timestamps, shown in two different places.** `series.lastRefreshedAt` (per-row/detail) answers "when was *this* series' data last touched, by any means" (creation, single refresh, or a bulk run that happened to include it); the bulk status endpoint's `finishedAt` answers "when did I last run a refresh over the whole list." Conflating them would misrepresent a series that's never been individually refreshed but was swept up in an old bulk run, or vice versa.
- **A relative-time formatter is introduced as a small shared utility** (`src/utils/relativeTime.ts`) rather than inlined in each component — both `SeriesDetail` and `SeriesList` need "X ago" formatting from an ISO timestamp, and no such utility exists yet in this codebase.

---

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the refresh actions and their result shapes typed centrally, so every consuming component shares one contract.

#### Acceptance Criteria

- **FRONTEND-023-AC-01** [AUTO]: `src/types/series.ts` shall gain `lastRefreshedAt: string | null` on `Series`.
- **FRONTEND-023-AC-02** [AUTO]: `src/types/series.ts` shall gain a `RefreshResult` interface (`series: Series`, `omdbRefreshed: boolean`, `tmdbRefreshed: boolean`) and a `RefreshJobStatus` interface (`status: 'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'`, `totalCount: number`, `completedCount: number`, `startedAt: string | null`, `finishedAt: string | null`).
- **FRONTEND-023-AC-03** [AUTO]: `seriesApi` shall gain `refresh: (id: string) => Promise<RefreshResult>` (`POST /series/{id}/refresh`), `refreshAll: () => Promise<RefreshJobStatus>` (`POST /series/refresh-all`), and `getRefreshStatus: () => Promise<RefreshJobStatus>` (`GET /series/refresh-all/status`), each unwrapping the `{ data: ... }` envelope.
- **FRONTEND-023-AC-04** [AUTO]: A new `src/utils/relativeTime.ts` shall export `formatRelativeTime(isoTimestamp: string): string`, producing human-readable output at second/minute/hour/day granularity (e.g. "just now", "5 minutes ago", "3 hours ago", "7 days ago").

---

### Requirement 2: Single-Series Refresh (`SeriesDetail`)

**User story**: As a user, I want to refresh one series' data and see how recently it was last refreshed, so stale data doesn't linger indefinitely.

#### Acceptance Criteria

- **FRONTEND-023-AC-05** [AUTO]: `SeriesDetail` shall render a "Refresh" button (alongside the existing Edit/Delete actions) that calls `seriesApi.refresh(id)`.
- **FRONTEND-023-AC-06** [AUTO]: While the refresh call is in flight, the button shall show a busy state ("Refreshing...") and be disabled.
- **FRONTEND-023-AC-07** [AUTO]: On success, `SeriesDetail` shall update its displayed data from `RefreshResult.series` and show an inline summary built from `omdbRefreshed`/`tmdbRefreshed` (e.g. both true → "Ratings and production status updated."; one true → naming only that one; both false → "No new data available.").
- **FRONTEND-023-AC-08** [AUTO]: If `seriesApi.refresh` rejects, `SeriesDetail` shall display an error message (`role="alert"`) and leave the currently-displayed data unchanged.
- **FRONTEND-023-AC-09** [AUTO]: `SeriesDetail` shall display "Last refreshed {relative time}" (via `formatRelativeTime`) next to the Refresh button when `series.lastRefreshedAt` is non-null, or no such text when `null`.

---

### Requirement 3: Bulk Refresh (`SeriesList`)

**User story**: As a user, I want to refresh my entire list in one action and see its progress, so I don't have to refresh each series individually or wonder whether it's still running.

#### Acceptance Criteria

- **FRONTEND-023-AC-10** [AUTO]: `SeriesList` shall render a "Refresh All" button that calls `seriesApi.refreshAll()` on click.
- **FRONTEND-023-AC-11** [AUTO]: On mount, `SeriesList` shall call `seriesApi.getRefreshStatus()` once. If the result's `status` is `IN_PROGRESS`, it shall immediately enter the same disabled/polling state as `FRONTEND-023-AC-12` — without the user having clicked anything (see Design Decisions).
- **FRONTEND-023-AC-12** [AUTO]: While a bulk job is `IN_PROGRESS` (whether just started by this click or discovered on mount), the "Refresh All" button shall be disabled and show progress text built from `completedCount`/`totalCount` (e.g. "Refreshing 4 of 15..."), refreshed by polling `seriesApi.getRefreshStatus()` on an interval (2–3s).
- **FRONTEND-023-AC-13** [AUTO]: When polling observes `status` transition away from `IN_PROGRESS` (to `COMPLETED` or `FAILED`), `SeriesList` shall stop polling, re-enable the "Refresh All" button, and re-fetch the list via whichever of `getAll()`/`search()` is currently active (per existing `criteriaActive` branching, `frontend_spec_006_search_filter.md`).
- **FRONTEND-023-AC-14** [AUTO]: If `seriesApi.refreshAll()` rejects with a `409` (a job is already running server-side), `SeriesList` shall enter the same polling/disabled state as `FRONTEND-023-AC-12` rather than surfacing it as a user-facing error — the outcome ("a refresh is in progress") is the same either way.
- **FRONTEND-023-AC-15** [AUTO]: `SeriesList` shall display "Last full refresh: {relative time}" (via `formatRelativeTime`) near the "Refresh All" button whenever the status endpoint's `finishedAt` is non-null, including immediately after mount (from `FRONTEND-023-AC-11`'s status check) and after a batch completes.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `POST /series/{id}/refresh`, `POST`/`GET /series/refresh-all`, `RefreshResult`, `RefreshJobStatus`, `lastRefreshedAt` | `series_spec_018_series_refresh.md` |
| `SeriesDetail`'s existing Edit/Delete action placement, busy-state pattern (Delete confirmation) | `frontend_spec_005_series_detail.md` |
| `SeriesList`'s existing `criteriaActive` branching between `getAll()`/`search()` | `frontend_spec_002.md`, `frontend_spec_006_search_filter.md` |
| Superseded design (single-refresh-only, no polling, no `lastRefreshedAt`) | `frontend_spec_012_series_lifecycle_controls.md` Requirement 4 (see that file's superseded note) |

---

## TDD Test Case Sketches

### `src/utils/relativeTime.test.ts`

```typescript
describe('FRONTEND-023-AC-04: formatRelativeTime', () => {
  it('formats seconds, minutes, hours, and days', () => {
    const now = Date.now()
    expect(formatRelativeTime(new Date(now - 5_000).toISOString())).toBe('just now')
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString())).toBe('5 minutes ago')
    expect(formatRelativeTime(new Date(now - 3 * 3_600_000).toISOString())).toBe('3 hours ago')
    expect(formatRelativeTime(new Date(now - 7 * 86_400_000).toISOString())).toBe('7 days ago')
  })
})
```

### `src/components/SeriesDetail.test.tsx` (additions)

```typescript
describe('FRONTEND-023-AC-05/06/07: refresh action', () => {
  it('shows a busy state, then updates data and a summary on success', async () => {
    mockGetById.mockResolvedValue(makeSeries({ totalSeasons: 5, lastRefreshedAt: null }))
    mockRefresh.mockResolvedValue({
      series: makeSeries({ totalSeasons: 6 }),
      omdbRefreshed: true,
      tmdbRefreshed: false,
    })
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText(/season/i)

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(screen.getByRole('button', { name: /refreshing/i })).toBeDisabled()

    expect(await screen.findByText('6')).toBeInTheDocument()
    expect(screen.getByText(/ratings updated/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-023-AC-08: refresh failure', () => {
  it('shows an alert and leaves data unchanged', async () => {
    mockGetById.mockResolvedValue(makeSeries({ totalSeasons: 5 }))
    mockRefresh.mockRejectedValue(new ApiError(502, 'Unable to reach the series lookup service. Please try again.'))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText(/season/i)

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})

describe('FRONTEND-023-AC-09: last refreshed display', () => {
  it('shows relative time when lastRefreshedAt is set', async () => {
    mockGetById.mockResolvedValue(makeSeries({ lastRefreshedAt: new Date().toISOString() }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    expect(await screen.findByText(/last refreshed/i)).toBeInTheDocument()
  })
})
```

### `src/components/SeriesList.test.tsx` (additions)

```typescript
describe('FRONTEND-023-AC-10/12/13: refresh-all click, polling, completion', () => {
  it('disables the button, shows progress, then re-enables and re-fetches on completion', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRefreshStatus.mockResolvedValueOnce({ status: 'IDLE', totalCount: 0, completedCount: 0, startedAt: null, finishedAt: null })
    mockRefreshAll.mockResolvedValue({ status: 'IN_PROGRESS', totalCount: 15, completedCount: 0, startedAt: new Date().toISOString(), finishedAt: null })
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /refresh all/i }))
    expect(await screen.findByText(/refreshing 0 of 15/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh all/i })).toBeDisabled()

    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED', totalCount: 15, completedCount: 15,
      startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
    })

    await waitFor(() => expect(screen.getByRole('button', { name: /refresh all/i })).not.toBeDisabled())
    expect(mockGetAll).toHaveBeenCalledTimes(2)
  })
})

describe('FRONTEND-023-AC-11: resumes polling on mount if a job is already running', () => {
  it('enters the disabled/polling state without a click', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRefreshStatus.mockResolvedValue({ status: 'IN_PROGRESS', totalCount: 15, completedCount: 4, startedAt: new Date().toISOString(), finishedAt: null })

    render(<SeriesList />)

    expect(await screen.findByText(/refreshing 4 of 15/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh all/i })).toBeDisabled()
  })
})

describe('FRONTEND-023-AC-14: 409 on click is treated as already-in-progress, not an error', () => {
  it('enters polling state instead of showing an error', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRefreshStatus.mockResolvedValueOnce({ status: 'IDLE', totalCount: 0, completedCount: 0, startedAt: null, finishedAt: null })
    mockRefreshAll.mockRejectedValue(new ApiError(409, 'A refresh is already in progress'))
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /refresh all/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /refresh all/i })).toBeDisabled())
  })
})

describe('FRONTEND-023-AC-15: last full refresh display', () => {
  it('shows relative time from the status endpoint finishedAt', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED', totalCount: 15, completedCount: 15,
      startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
    })
    render(<SeriesList />)
    expect(await screen.findByText(/last full refresh/i)).toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [ ] FRONTEND-023-AC-01: `lastRefreshedAt` on `Series`
- [ ] FRONTEND-023-AC-02: `RefreshResult`/`RefreshJobStatus` types
- [ ] FRONTEND-023-AC-03: `seriesApi.refresh`/`refreshAll`/`getRefreshStatus`
- [ ] FRONTEND-023-AC-04: `formatRelativeTime` utility
- [ ] FRONTEND-023-AC-05: `SeriesDetail` Refresh button
- [ ] FRONTEND-023-AC-06: busy/disabled state while refreshing
- [ ] FRONTEND-023-AC-07: success updates data + summary message
- [ ] FRONTEND-023-AC-08: failure shows alert, data unchanged
- [ ] FRONTEND-023-AC-09: "Last refreshed" relative-time display
- [ ] FRONTEND-023-AC-10: `SeriesList` "Refresh All" button
- [ ] FRONTEND-023-AC-11: resumes polling on mount if already in progress
- [ ] FRONTEND-023-AC-12: disabled + progress text while polling
- [ ] FRONTEND-023-AC-13: stops polling, re-enables, re-fetches list on completion
- [ ] FRONTEND-023-AC-14: `409` on click treated as already-in-progress, not an error
- [ ] FRONTEND-023-AC-15: "Last full refresh" relative-time display
