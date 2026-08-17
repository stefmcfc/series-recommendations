# Frontend Spec 002: SeriesList Component

**Status**: ✅ Done. Depends on Frontend Spec 001, which is done.
**Priority**: P0 (core UI)
**Depends on**: Frontend Spec 001 (Types & API Service Layer) ✅, Backend Spec 002 ✅
**Frontend Stage**: 2 of N

---

## Overview

This spec covers the `SeriesList` component — the main view that fetches and displays
the user's full series collection. It is a container component that owns its own data
fetching, state, and loading/error/empty UI states.

**Deliverables**:
- `src/components/SeriesList.tsx` — Container component (fetches + displays)
- `src/components/SeriesList.test.tsx` — Vitest + React Testing Library tests

**Design decisions captured here**:
- Container (not presentational): fetches data internally via `seriesApi.getAll()`
- Null IMDb rating displays as "—"
- Error state includes a manual Retry button
- Each series row is clickable (link target deferred to Stage 5)
- No sorting/filtering (deferred to Stage 3 SearchFilter component)
- Loading indicator: spinner SVG + "Loading series..." text
- Standard rendering (no virtualisation for MVP)

**Styling decision**: CSS Modules (see `.claude/steering/frontend_conventions.md`) — `SeriesList.module.css` colocated with the component, no Tailwind. The class-less implementation skeleton below predates this decision; apply `styles.*` classNames from the module where sensible (structure/spacing), not a hard 1:1 mapping.

---

## Glossary

| Term | Definition |
|------|-----------|
| Container component | A component that owns state and data fetching, not just rendering |
| Loading state | UI shown while `seriesApi.getAll()` is in flight |
| Error state | UI shown when `seriesApi.getAll()` rejects |
| Empty state | UI shown when the API returns an empty array |
| Retry | User-triggered re-fetch after an error |

---

## Requirements

### Requirement 1: Data Fetching on Mount

**User Story:** As a user, I want to see my series list when I open the app, so that I can immediately review my collection.

#### Acceptance Criteria

1. WHEN the `SeriesList` component mounts, it SHALL call `seriesApi.getAll()` exactly once.
2. The component SHALL NOT require any props to initiate the fetch (self-contained).
3. WHEN `seriesApi.getAll()` resolves, the component SHALL store the result in local state and render it.
4. The component SHALL use `useEffect` with an empty dependency array to trigger the fetch on mount only.

---

### Requirement 2: Loading State

**User Story:** As a user, I want to see a loading indicator while my series are being fetched, so that I know the app is working.

#### Acceptance Criteria

1. WHILE `seriesApi.getAll()` is in flight, the component SHALL display a spinner and the text "Loading series...".
2. The loading indicator SHALL be visible immediately on mount (before the fetch resolves).
3. WHEN the fetch completes (success or error), the loading indicator SHALL be removed.
4. The series list SHALL NOT be rendered while loading is true.
5. The spinner SHALL have `role="status"` and `aria-label="Loading"` for screen readers.

---

### Requirement 3: Rendering Series Data

**User Story:** As a user, I want to see my series displayed with key information, so that I can scan my collection at a glance.

#### Acceptance Criteria

1. WHEN series data is loaded, the component SHALL render each series in the list.
2. For each series, the component SHALL display the `title`.
3. For each series, the component SHALL display the `status` (WATCHING, COMPLETED, DROPPED, BACKLOG).
4. For each series, the component SHALL display the IMDb rating as a number (e.g., "8.4").
5. IF a series has `imdbRating: null`, the component SHALL display "—" in the rating column.
6. Each series row SHALL be wrapped in an element with `data-testid="series-row"` for testing.
7. The component SHALL render series in the order returned by the API (no client-side sorting).

---

### Requirement 4: Empty State

**User Story:** As a new user with no series, I want to see a helpful empty state, so that I understand how to get started.

#### Acceptance Criteria

1. IF `seriesApi.getAll()` returns an empty array, the component SHALL display the text "No series yet.".
2. The empty state SHALL include an "Add your first series" button.
3. The empty state button SHALL have `data-testid="add-series-btn"`.
4. The series list container SHALL NOT be rendered in the empty state.
5. The loading indicator SHALL NOT be visible in the empty state.

---

### Requirement 5: Error State

**User Story:** As a user, I want to see a clear error message if loading fails, so that I know something went wrong and can try again.

#### Acceptance Criteria

1. IF `seriesApi.getAll()` rejects, the component SHALL display the message "Failed to load series. Please try again.".
2. The error state SHALL include a "Retry" button.
3. WHEN the user clicks "Retry", the component SHALL call `seriesApi.getAll()` again.
4. WHEN a retry is in progress, the loading state SHALL be shown (error message hidden).
5. IF the retry also fails, the error message SHALL be shown again.
6. The error message container SHALL have `role="alert"` for screen reader accessibility.
7. The series list SHALL NOT be rendered while in the error state.

---

### Requirement 6: Add Series Button (Header)

**User Story:** As a user, I want an "Add Series" button always visible in the list header, so that I can add to my collection at any time.

#### Acceptance Criteria

1. The component SHALL render an "Add Series" button in the list header, visible in all states (loading, error, empty, and populated).
2. The button SHALL have `data-testid="add-series-btn"` (same ID used in empty state).
3. The button SHALL be a `<button>` element (not a link) — wiring up the action is deferred to Stage 4.
4. The button SHALL have `aria-label="Add new series"`.

---

### Requirement 7: Series Row Clickability

**User Story:** As a user, I want to click a series to view its details, so that I can see the full information.

#### Acceptance Criteria

1. Each series row SHALL be wrapped in a clickable element.
2. The clickable element SHALL have `data-testid="series-row"` and `role="button"` (or be an `<a>` tag — navigation target deferred to Stage 5).
3. The component SHALL accept an optional `onSeriesClick?: (id: string) => void` prop.
4. WHEN a series row is clicked, IF `onSeriesClick` is provided, it SHALL be called with the series `id`.
5. The clickable element SHALL have a visible hover state.

---

### Requirement 8: Accessibility

**User Story:** As a user relying on assistive technology, I want the series list to be navigable, so that I can use the app without a mouse.

#### Acceptance Criteria

1. The series list container SHALL use a `<ul>` element with each series in an `<li>`.
2. The component SHALL have a visible heading "My Series" (`<h1>` or `<h2>`).
3. Loading spinner SHALL have `role="status"` and `aria-label="Loading"`.
4. Error container SHALL have `role="alert"`.
5. The "Add Series" button SHALL have `aria-label="Add new series"`.
6. `[MANUAL]` `@axe-core/react` SHALL be added as a frontend devDependency and wired into the dev-mode entry point (`main.tsx`, gated to `import.meta.env.DEV` so it never ships to production) as of this component's implementation — it's the first component available to run it against. It runs axe-core against the live DOM and logs violations to the browser console; this complements (doesn't replace) the static `eslint-plugin-jsx-a11y` checks from `tooling_spec_001_code_quality_security.md` Requirement 5, since it catches runtime-only issues (computed contrast, post-render ARIA/DOM state) that static analysis can't. Package note: the spec originally named `react-axe`, but that package is deprecated upstream — `@axe-core/react` is Deque's maintained successor with the same `default(React, ReactDOM, timeout)` API, so it was used instead. Verified by inspection — temporarily rendered `<SeriesList />` in `App.tsx` with the dev server running and checked the browser console; it caught a real color-contrast violation (`SeriesList.module.css` used hardcoded light-theme grays that failed against this app's dark theme), which was fixed by switching the module to the app's `--text`/`--text-h`/`--border`/`--accent`/`--social-bg` CSS custom properties (see `src/index.css`) instead of hardcoded hex colors. The `landmark-one-main`/`region` violations axe previously reported came from `App.tsx`'s unmodified Vite scaffold (no `<main>` landmark anywhere on the page) and were pre-existing/out of scope for this component-only spec. They were resolved when `SeriesList` was wired into `App.tsx` (see `App.tsx`, which now wraps the rendered content in a single `<main>` landmark) — verified by reasoning against axe-core's `landmark-one-main`/`region` rule definitions directly. No CI check exists for this (it's a dev-console tool, not a lint rule).

---

### Requirement 9: Shall Not — No Sensitive Data Exposure

**User Story:** As a developer, I want to ensure the component does not leak internal data, so that the app is safe.

#### Acceptance Criteria

1. The component SHALL NOT render internal database UUIDs (the `id` field) as visible text.
2. The component SHALL NOT render `personalNotes` or `personalRating` in the list view (detail view only).
3. The component SHALL NOT log series data to the console.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `seriesApi.getAll()` | Frontend Spec 001, Requirement 4 |
| `Series` interface | `src/types/series.ts` (Spec 001) |
| `ApiError` class | `src/types/api.ts` (Spec 001) |
| `GET /api/v1/series` response | Backend Spec 002: `{ data: Series[], count: number }` |
| `SeriesStatus` enum | `src/types/series.ts` — WATCHING, COMPLETED, DROPPED, BACKLOG |

---

## TDD Test Cases

**File**: `src/components/SeriesList.test.tsx`

### Setup

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SeriesList } from './SeriesList'
import { seriesApi } from '../services/seriesApi'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'test-id',
    title: 'Test Show',
    year: null,
    genres: null,
    totalSeasons: null,
    totalEpisodes: null,
    currentSeason: null,
    currentEpisode: null,
    status: SeriesStatus.BACKLOG,
    imdbRating: null,
    metacriticRating: null,
    rottenTomatoesRating: null,
    personalRating: null,
    personalNotes: null,
    dateAdded: '2026-01-01T00:00:00Z',
    dateCompleted: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})
```

### SH-001: Fetch on mount
```typescript
describe('SH-001: Fetch on mount', () => {
  it('should call seriesApi.getAll() once on mount', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1))
  })
})
```

### SH-002: Loading state
```typescript
describe('SH-002: Loading state', () => {
  it('should show loading indicator while fetch is in flight', () => {
    mockGetAll.mockReturnValue(new Promise(() => undefined))
    render(<SeriesList />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/loading series/i)).toBeInTheDocument()
  })

  it('should hide loading indicator after fetch completes', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    )
  })
})
```

### SH-003: Render series data
```typescript
describe('SH-003: Render series data', () => {
  it('should render title and status for each series', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'The Office', status: SeriesStatus.WATCHING }),
      makeSeries({ id: '2', title: 'Breaking Bad', status: SeriesStatus.COMPLETED }),
    ])
    render(<SeriesList />)
    await waitFor(() => {
      expect(screen.getByText('The Office')).toBeInTheDocument()
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
      expect(screen.getByText('WATCHING')).toBeInTheDocument()
      expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    })
  })

  it('should render IMDb rating when present', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show', imdbRating: 8.4 })])
    render(<SeriesList />)
    await waitFor(() => expect(screen.getByText('8.4')).toBeInTheDocument())
  })

  it('should display "—" when imdbRating is null', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show', imdbRating: null })])
    render(<SeriesList />)
    await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument())
  })

  it('should render one series-row per series', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Show 1' }),
      makeSeries({ id: '2', title: 'Show 2' }),
    ])
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.getAllByTestId('series-row')).toHaveLength(2)
    )
  })
})
```

### IF-004: Empty state
```typescript
describe('IF-004: Empty state', () => {
  it('should show "No series yet." when list is empty', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.getByText(/no series yet/i)).toBeInTheDocument()
    )
  })

  it('should show "Add your first series" button in empty state', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.getByText(/add your first series/i)).toBeInTheDocument()
    )
  })

  it('should not render any series rows in empty state', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.queryAllByTestId('series-row')).toHaveLength(0)
    )
  })
})
```

### IF-005: Error state
```typescript
describe('IF-005: Error state', () => {
  it('should show error message when fetch fails', async () => {
    mockGetAll.mockRejectedValue(new Error('Network error'))
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.getByText(/failed to load series/i)).toBeInTheDocument()
    )
  })

  it('should show Retry button in error state', async () => {
    mockGetAll.mockRejectedValue(new Error('Network error'))
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    )
  })

  it('should re-fetch when Retry is clicked', async () => {
    mockGetAll
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue([makeSeries({ title: 'Loaded on retry' })])

    render(<SeriesList />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() =>
      expect(screen.getByText('Loaded on retry')).toBeInTheDocument()
    )
    expect(mockGetAll).toHaveBeenCalledTimes(2)
  })

  it('should show error state again if retry also fails', async () => {
    mockGetAll.mockRejectedValue(new Error('Still broken'))
    render(<SeriesList />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() =>
      expect(screen.getByText(/failed to load series/i)).toBeInTheDocument()
    )
    expect(mockGetAll).toHaveBeenCalledTimes(2)
  })

  it('error container should have role="alert"', async () => {
    mockGetAll.mockRejectedValue(new Error('Network error'))
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    )
  })
})
```

### SH-006: Add Series button always visible
```typescript
describe('SH-006: Add Series button', () => {
  it('should show Add Series button when list is populated', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.getByTestId('add-series-btn')).toBeInTheDocument()
    )
  })
})
```

### SH-007: Series row click
```typescript
describe('SH-007: Series row click', () => {
  it('should call onSeriesClick with series id when row is clicked', async () => {
    const onSeriesClick = vi.fn()
    mockGetAll.mockResolvedValue([
      makeSeries({ id: 'abc-123', title: 'Clickable Show' }),
    ])
    render(<SeriesList onSeriesClick={onSeriesClick} />)

    await waitFor(() =>
      expect(screen.getByTestId('series-row')).toBeInTheDocument()
    )

    fireEvent.click(screen.getByTestId('series-row'))
    expect(onSeriesClick).toHaveBeenCalledWith('abc-123')
  })

  it('should not throw if onSeriesClick is not provided', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)

    await waitFor(() =>
      expect(screen.getByTestId('series-row')).toBeInTheDocument()
    )

    fireEvent.click(screen.getByTestId('series-row'))
  })
})
```

### SN-008: No sensitive data exposed
```typescript
describe('SN-008: No sensitive data exposed', () => {
  it('should not render the series UUID as visible text', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: 'secret-uuid-123', title: 'Show' }),
    ])
    render(<SeriesList />)
    await waitFor(() => screen.getByText('Show'))
    expect(screen.queryByText('secret-uuid-123')).not.toBeInTheDocument()
  })

  it('should not render personalNotes in the list view', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ title: 'Show', personalNotes: 'My private note' }),
    ])
    render(<SeriesList />)
    await waitFor(() => screen.getByText('Show'))
    expect(screen.queryByText('My private note')).not.toBeInTheDocument()
  })
})
```

---

## Implementation Skeleton

### `src/components/SeriesList.tsx`

```typescript
import { useState, useEffect, useCallback } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { Series } from '../types/series'

interface SeriesListProps {
  onSeriesClick?: (id: string) => void
}

export function SeriesList({ onSeriesClick }: SeriesListProps) {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSeries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await seriesApi.getAll()
      setSeries(data)
    } catch {
      setError('Failed to load series. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSeries()
  }, [fetchSeries])

  return (
    <div>
      <div>
        <h2>My Series</h2>
        <button data-testid="add-series-btn" aria-label="Add new series">
          Add Series
        </button>
      </div>

      {loading && (
        <div role="status" aria-label="Loading">
          <span>Loading series...</span>
        </div>
      )}

      {!loading && error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={fetchSeries}>Retry</button>
        </div>
      )}

      {!loading && !error && series.length === 0 && (
        <div>
          <p>No series yet.</p>
          <button data-testid="add-series-btn">Add your first series</button>
        </div>
      )}

      {!loading && !error && series.length > 0 && (
        <ul>
          {series.map((s) => (
            <li
              key={s.id}
              data-testid="series-row"
              role="button"
              tabIndex={0}
              onClick={() => onSeriesClick?.(s.id)}
              onKeyDown={(e) => e.key === 'Enter' && onSeriesClick?.(s.id)}
            >
              <span>{s.title}</span>
              <span>{s.status}</span>
              <span>{s.imdbRating !== null ? s.imdbRating : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Styling classes are omitted from this skeleton — it predates the CSS Modules decision noted at the top of this spec. The actual implementation applies `styles.*` classNames from `SeriesList.module.css`; see `frontend/src/components/SeriesList.tsx` for the real, styled version.

---

## Acceptance Criteria Summary

- [x] `seriesApi.getAll()` called once on mount
- [x] Loading spinner with `role="status"` shown while fetching
- [x] "Loading series..." text shown while loading
- [x] Loading indicator removed after fetch resolves
- [x] Each series renders title, status, and IMDb rating
- [x] Null `imdbRating` displays as "—"
- [x] Each series row has `data-testid="series-row"`
- [x] "No series yet." shown when list is empty
- [x] "Add your first series" button shown in empty state
- [x] "Failed to load series. Please try again." shown on error
- [x] Error container has `role="alert"`
- [x] "Retry" button shown in error state
- [x] Clicking Retry triggers re-fetch
- [x] If retry fails, error state shown again
- [x] "Add Series" button always visible in header
- [x] Add Series button has `data-testid="add-series-btn"` and `aria-label="Add new series"`
- [x] `@axe-core/react` (successor to the deprecated `react-axe`) added as a devDependency and wired into `main.tsx` (dev-mode only); caught and fixed a real color-contrast violation, no component-level violations remain
- [x] Series rows are clickable; `onSeriesClick(id)` called when clicked
- [x] Component works without `onSeriesClick` prop (no crash)
- [x] Series UUID not rendered as visible text
- [x] `personalNotes` not rendered in list view
- [x] All test cases SH-001 through SN-008 pass (36/36 passing)
