# Frontend Spec 072: Settings Gains Export and Refresh All

**Status**: Not started
**Priority**: P3
**Depends on**: Frontend Spec 070 (`frontend_spec_070_settings_menu.md`, owns the `SettingsPage` shell this spec adds real content to) ✅ required
**Area**: Frontend (`components/SettingsPage.tsx`, `components/SeriesList.tsx`, `App.tsx`)

## Overview

`frontend_spec_070` shipped the Settings page as an empty shell. This spec gives it its first real content by relocating two existing, working features off the My Series page entirely: Export (JSON/CSV) and Refresh All. Both are global, filter-independent actions today in spirit — Refresh All already operates over the user's whole library regardless of any active filter, and Export is the only one of the two that currently *does* respect the active filter, which this spec deliberately changes (see Design Decisions).

This is a relocation of already-working logic, not a redesign — `ExportControls` and the Refresh All button/polling/progress-display code move essentially verbatim into `SettingsPage`.

## Design Decisions

- **Export becomes unfiltered.** `ExportControls`'s `criteria` prop is already optional (`ExportControls.tsx:7-9`) — moved into `SettingsPage`, it's simply not passed, so `seriesApi.export(format, criteria)` is called with `criteria: undefined`, exporting the whole library. This is a deliberate behavior change, confirmed directly: the filtered-export capability is not preserved or duplicated anywhere else. `ExportControls.tsx` itself needs no code changes — only its call site moves.
- **Refresh All moves wholesale, same pattern, new home.** All of its state (`jobStatus`, `refreshAllError`), the on-mount `getRefreshStatus()` resync effect, the poll-while-in-progress effect (`REFRESH_POLL_INTERVAL_MS`), `handleRefreshAllClick`, and the progress/last-refreshed text move from `SeriesList.tsx` into `SettingsPage.tsx` unchanged in behavior. This already mirrors what happens today when `SeriesList` unmounts/remounts (e.g., navigating away from and back to My Series) — the mount-time resync is exactly how a page-relocation is supposed to behave, so no new architecture is introduced.
- **Nothing about Refresh All's job semantics changes** — it's the same `POST /series/refresh-all` / `GET /series/refresh-status` pair, same 2.5s poll cadence, same 409-means-already-running handling. Only the UI's location changes.
- **My Series' header shrinks accordingly** — once these two are gone, `SeriesList`'s header row keeps only: heading, Sort by, view-mode toggle, the Filters funnel icon, and Add Series.

## Requirements

### Requirement 1: Export relocates to Settings, unfiltered

**User Story**: As a user, I want to export my whole library from one place, without needing an active view/filter to do it from.

#### FRONTEND-072-AC-01 [AUTO]: `ExportControls` no longer renders on My Series
**Statement**: `MySeriesView` (`App.tsx`) shall no longer render `<ExportControls>`.

**Rationale**: The control is relocating, not duplicating.

**References**:
- Component: `App.tsx`, `MySeriesView` (currently renders `<ExportControls criteria={effectiveCriteria} />` between `SearchFilter` and `SeriesList`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-072-AC-01: Export controls no longer render on My Series', () => {
  it('does not render Export JSON/CSV buttons on the My Series page', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    expect(screen.queryByTestId('export-json-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('export-csv-btn')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: remove the `<ExportControls>` line and its now-unused import from `App.tsx`.

#### FRONTEND-072-AC-02 [AUTO]: Settings renders unfiltered Export controls
**Statement**: `SettingsPage` shall render `<ExportControls>` with no `criteria` prop, so `seriesApi.export` is called with `criteria: undefined` when either button is clicked.

**Rationale**: Settings has no filter context — the export it offers is the whole library.

**References**:
- Component: `components/SettingsPage.tsx`
- Component: `components/ExportControls.tsx` (unchanged — `criteria` is already optional)

**Test Case (Red)**:
```typescript
// SettingsPage.test.tsx
describe('FRONTEND-072-AC-02: Settings renders unfiltered Export controls', () => {
  it('calls seriesApi.export with no criteria when Export JSON is clicked', async () => {
    mockExport.mockResolvedValue({ blob: new Blob(), filename: 'series.json' })
    render(<SettingsPage />)

    fireEvent.click(screen.getByTestId('export-json-btn'))

    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledWith('json', undefined)
    })
  })
})
```

**Test Case (Green)**: add `<ExportControls />` (no props) to `SettingsPage.tsx`.

### Requirement 2: Refresh All relocates to Settings

**User Story**: As a user, I want to trigger and monitor a full-library refresh as a maintenance action in Settings, not from the list I'm browsing.

#### FRONTEND-072-AC-03 [AUTO]: `SeriesList` no longer renders Refresh All
**Statement**: `SeriesList` shall no longer render the "Refresh All" button, its progress text, its "last full refresh" text, or the `refreshAllError` banner. `SeriesList` shall no longer own `jobStatus`/`refreshAllError`/`refreshAllInProgress` state or the associated effects (`getRefreshStatus` on-mount resync, poll-while-in-progress).

**Rationale**: Full relocation, not duplication — `SeriesList` sheds all of this logic.

**References**:
- Component: `components/SeriesList.tsx` (`REFRESH_POLL_INTERVAL_MS`, `buildRefreshProgressText`, `buildLastFullRefreshText`, `jobStatus`/`refreshAllError` state, the two `useEffect`s at lines 214-231 and 236-257, `handleRefreshAllClick` at 259-288, the button/progress/error JSX at 528-547 and 560-564)

**Test Case (Red)**:
```typescript
describe('FRONTEND-072-AC-03: Refresh All no longer renders on SeriesList', () => {
  it('does not render the Refresh All button', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList onSeriesClick={vi.fn()} onAddClick={vi.fn()} onEditClick={vi.fn()} />)
    await screen.findByTestId('series-list')

    expect(screen.queryByTestId('refresh-all-btn')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: delete the state, effects, handler, and JSX listed above from `SeriesList.tsx`.

#### FRONTEND-072-AC-04 [AUTO]: Settings renders Refresh All, resyncing on mount
**Statement**: `SettingsPage` shall render the "Refresh All" button and, on mount, call `seriesApi.getRefreshStatus()` to resume mid-batch state (e.g. a disabled button with progress text) if a job is already `IN_PROGRESS`.

**Rationale**: Preserves the existing page-reload-resumes-state behavior (`FRONTEND-023-AC-11`), now on the page where the control lives.

**References**:
- Component: `components/SettingsPage.tsx`

**Test Case (Red)**:
```typescript
// SettingsPage.test.tsx
describe('FRONTEND-072-AC-04: Settings resyncs Refresh All state on mount', () => {
  it('shows in-progress state when a job is already running server-side', async () => {
    mockGetRefreshStatus.mockResolvedValue({
      status: 'IN_PROGRESS', totalCount: 10, completedCount: 3,
      skippedCount: 0, startedAt: '2026-09-01T00:00:00', finishedAt: null,
    })
    render(<SettingsPage />)

    expect(await screen.findByText(/Refreshing 3 of 10/)).toBeInTheDocument()
    expect(screen.getByTestId('refresh-all-btn')).toBeDisabled()
  })
})
```

**Test Case (Green)**: move `jobStatus`/`refreshAllError` state, the on-mount resync effect, the poll-while-in-progress effect, `handleRefreshAllClick`, and the button/progress/last-refreshed JSX into `SettingsPage.tsx` verbatim.

#### FRONTEND-072-AC-05 [AUTO]: clicking Refresh All in Settings starts a job and polls to completion
**Statement**: When the Refresh All button in `SettingsPage` is clicked, it shall call `seriesApi.refreshAll()`, then poll `seriesApi.getRefreshStatus()` every 2.5s while `status === 'IN_PROGRESS'`, updating the progress text each tick and stopping once the job completes.

**Rationale**: End-to-end regression coverage that the relocated logic still works, not just renders.

**References**:
- Function: `components/SettingsPage.tsx`, relocated `handleRefreshAllClick`/polling effect

**Test Case (Red)**:
```typescript
// SettingsPage.test.tsx
describe('FRONTEND-072-AC-05: Refresh All starts a job and polls to completion', () => {
  it('polls until the job completes', async () => {
    vi.useFakeTimers()
    mockGetRefreshStatus.mockResolvedValue({
      status: 'IDLE', totalCount: 0, completedCount: 0, skippedCount: 0,
      startedAt: null, finishedAt: null,
    })
    mockRefreshAll.mockResolvedValue({
      status: 'IN_PROGRESS', totalCount: 5, completedCount: 0,
      skippedCount: 0, startedAt: '2026-09-01T00:00:00', finishedAt: null,
    })
    mockGetRefreshStatus.mockResolvedValueOnce({
      status: 'COMPLETED', totalCount: 5, completedCount: 5, skippedCount: 0,
      startedAt: '2026-09-01T00:00:00', finishedAt: '2026-09-01T00:01:00',
    })
    render(<SettingsPage />)

    fireEvent.click(await screen.findByTestId('refresh-all-btn'))
    await vi.advanceTimersByTimeAsync(2500)

    expect(await screen.findByText(/Last full refresh/)).toBeInTheDocument()
    vi.useRealTimers()
  })
})
```

**Test Case (Green)**: covered by the relocated logic from `FRONTEND-072-AC-04`/`AC-05` — this AC is the scenario-level regression test.

## Cross-References

| Concept | Location |
|---|---|
| Settings shell this adds content to | `frontend_spec_070_settings_menu.md` |
| `ExportControls` (unchanged) | `components/ExportControls.tsx` |
| Refresh All logic relocated from | `components/SeriesList.tsx` (`REFRESH_POLL_INTERVAL_MS`, `handleRefreshAllClick`, related effects/JSX) |
| Original mount-resync behavior preserved | `frontend_spec_023` (`FRONTEND-023-AC-11/12/13/14`) |
| Originating idea | `.claude/ideas/future_ideas.md`, Configuration section — "Refresh All" relocation and "Move Export JSON/CSV into a dropdown menu, once a site/user config UI exists" |

## Acceptance Criteria Summary

- [ ] FRONTEND-072-AC-01: `ExportControls` no longer renders on My Series
- [ ] FRONTEND-072-AC-02: Settings renders unfiltered Export controls
- [ ] FRONTEND-072-AC-03: `SeriesList` no longer renders Refresh All
- [ ] FRONTEND-072-AC-04: Settings renders Refresh All, resyncing on mount
- [ ] FRONTEND-072-AC-05: clicking Refresh All in Settings starts a job and polls to completion
