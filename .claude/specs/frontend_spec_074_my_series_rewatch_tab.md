# Frontend Spec 074: "Flagged for Rewatch" Becomes a Tab

**Status**: Implemented — `App.tsx`, `App.test.tsx`, `components/SearchFilter.tsx`, `components/SearchFilter.test.tsx`
**Priority**: P3
**Depends on**: Frontend Spec 056 (`frontend_spec_056_series_list_status_tabs.md`, owns the `/my-series/:statusTab` route and tab-bar pattern this spec extends) ✅ required, Frontend Spec 071 (owns the sheet this spec removes a field from) ✅ required
**Area**: Frontend (`App.tsx`, `components/SearchFilter.tsx`)

## Overview

"Flagged for rewatch" is currently a checkbox inside the filter sheet (`SearchFilter.tsx`), but it behaves more like a view a user switches into than a filter they compose with others — the same reasoning that turned Status into tabs in `frontend_spec_056`. This spec adds a "Rewatch" tab alongside the existing All/Watching/Completed/Backlog/Dropped tabs, reusing the same `/my-series/:statusTab` route, and removes the checkbox from the sheet.

## Design Decisions

- **Reuses the existing generic `/my-series/:statusTab` route** rather than adding a new route — `rewatch` becomes a recognized value of the same `:statusTab` path param, alongside `watching`/`completed`/`backlog`/`dropped`.
- **`rewatch` is not a `SeriesStatus` value** — selecting it sets `flaggedForRewatch: true` in the effective criteria and leaves `status` undefined (showing flagged series across every status), rather than mapping to one of the existing enum values. This requires `statusFromTabParam`'s single `SeriesStatus | undefined` return shape to become two independently-derived values (a status and a rewatch flag) from the one path param, since one tab selection can no longer be represented by a single enum.
- **Mutually exclusive with status tabs**, matching every other tab today — selecting "Rewatch" is a distinct URL (`/my-series/rewatch`) from `/my-series/watching` etc.; there is no way to combine "Rewatch" with a specific status tab in this spec (e.g. no "Watching + flagged for rewatch" tab) — that composition, if wanted later, is a separate idea.
- **The checkbox is removed entirely from the sheet** (`SearchFilter.tsx`'s `FormState.flaggedForRewatch`, `buildCriteria`'s corresponding line, and the checkbox JSX) — there is no other way to filter by this flag once this ships except via the new tab.
- **The per-series "Rewatch" toggle button is unchanged** — `SeriesList`'s existing `handleRewatchToggle`/`toggleRewatchFlag` (used on completed series to flag them for a future rewatch) is data entry, not filtering, and this spec doesn't touch it.

## Requirements

### Requirement 1: "Rewatch" tab

**User Story**: As a user, I want to jump straight to series I've flagged for rewatch, the same way I jump to "Watching" or "Completed".

#### FRONTEND-074-AC-01 [AUTO]: Rewatch tab renders alongside the status tabs
**Statement**: `MySeriesView` shall render a "Rewatch" `NavLink` to `/my-series/rewatch`, alongside the existing All/Watching/Completed/Backlog/Dropped tabs.

**Rationale**: Consistent with the existing tab-bar pattern.

**References**:
- Component: `App.tsx`, `MySeriesView` (status `<nav>`, lines 93-109)

**Test Case (Red)**:
```typescript
describe('FRONTEND-074-AC-01: Rewatch tab renders', () => {
  it('renders a Rewatch link alongside the status tabs', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    expect(screen.getByRole('link', { name: 'Rewatch' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `<NavLink to="/my-series/rewatch" className={navLinkClassName}>Rewatch</NavLink>` to the status `<nav>`.

#### FRONTEND-074-AC-02 [AUTO]: selecting Rewatch filters by the flag, not status
**Statement**: When `/my-series/rewatch` is navigated to, `MySeriesView`'s effective criteria shall have `flaggedForRewatch: true` and `status: undefined`.

**Rationale**: Core routing behavior — this is the whole point of the tab.

**References**:
- Component: `App.tsx`, `statusFromTabParam`/`effectiveCriteria` construction (lines 36-49, 81-84)

**Test Case (Red)**:
```typescript
describe('FRONTEND-074-AC-02: Rewatch tab filters by flaggedForRewatch', () => {
  it('fetches with flaggedForRewatch true and no status when on the Rewatch tab', async () => {
    mockGetAll.mockResolvedValue([])
    mockSearch.mockResolvedValue([])
    window.history.pushState({}, '', '/my-series/rewatch')
    render(<App />)

    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ flaggedForRewatch: true, status: undefined }),
        undefined,
      ),
    )
  })
})
```

**Test Case (Green)**: extend the tab-param handling so `statusTab === 'rewatch'` yields `{ status: undefined, flaggedForRewatch: true }`, merged into `effectiveCriteria` instead of the plain `status` value used by every other tab.

#### FRONTEND-074-AC-03 [AUTO]: Rewatch tab shows active state correctly
**Statement**: While on `/my-series/rewatch`, the "Rewatch" `NavLink` shall carry the active nav-link styling, and no other status tab shall.

**Rationale**: Matches the existing active-tab convention (`FRONTEND-056-AC-03`).

**References**:
- Component: `App.tsx`, `navLinkClassName`

**Test Case (Red)**:
```typescript
describe('FRONTEND-074-AC-03: Rewatch tab shows active state', () => {
  it('marks only Rewatch active when on /my-series/rewatch', async () => {
    mockGetAll.mockResolvedValue([])
    window.history.pushState({}, '', '/my-series/rewatch')
    render(<App />)
    await screen.findByTestId('series-list')

    expect(screen.getByRole('link', { name: 'Rewatch' })).toHaveClass('navLinkActive')
    expect(screen.getByRole('link', { name: 'All' })).not.toHaveClass('navLinkActive')
  })
})
```

**Test Case (Green)**: no special-casing needed — `react-router-dom`'s `NavLink` already derives `isActive` from the current path against `to="/my-series/rewatch"`, same as every other tab.

### Requirement 2: checkbox removed from the sheet

**User Story**: As a developer, I want `SearchFilter` to stop owning rewatch filtering now that a tab covers it.

#### FRONTEND-074-AC-04 [AUTO]: sheet no longer has a "Flagged for rewatch" field
**Statement**: `SearchFilter`'s sheet shall no longer render the "Flagged for rewatch" checkbox, and `buildCriteria` shall no longer set `flaggedForRewatch` on the resulting `SearchCriteria`.

**Rationale**: Pulled forward from this spec — the tab now owns this filter exclusively.

**References**:
- Component: `components/SearchFilter.tsx` (`FormState.flaggedForRewatch`, checkbox JSX at lines 329-339, `buildCriteria` line 74)

**Test Case (Red)**:
```typescript
describe('FRONTEND-074-AC-04: sheet no longer has a rewatch checkbox', () => {
  it('does not render a Flagged for rewatch checkbox', () => {
    render(<SearchFilter isOpen={true} onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)
    expect(screen.queryByLabelText(/flagged for rewatch/i)).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: remove `flaggedForRewatch` from `FormState`/`initialFormState`/`buildCriteria`, delete the checkbox JSX.

## Cross-References

| Concept | Location |
|---|---|
| Tab-bar pattern reused | `frontend_spec_056_series_list_status_tabs.md` |
| Sheet field removed | `frontend_spec_071_my_series_filter_sheet.md` |
| `SearchCriteria.flaggedForRewatch`, unchanged server-side matching | `series_spec_012`/existing `SeriesSearchService` |
| Per-series Rewatch toggle, unaffected | `components/SeriesList.tsx`, `handleRewatchToggle`/`utils/rewatchToggle.ts` |

## Acceptance Criteria Summary

- [x] FRONTEND-074-AC-01: Rewatch tab renders alongside the status tabs
- [x] FRONTEND-074-AC-02: selecting Rewatch filters by the flag, not status
- [x] FRONTEND-074-AC-03: Rewatch tab shows active state correctly
- [x] FRONTEND-074-AC-04: sheet no longer has a "Flagged for rewatch" field
