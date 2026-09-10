# Frontend Spec 113: Shareable URL for `SeriesDetail`

**Status**: Implemented — `App.tsx`, `components/SeriesDetail.tsx` (`components/SeriesList.tsx` itself was
unchanged; only how `App.tsx` wires its `onSeriesClick` prop changed)
**Priority**: P4 (navigation/UX completeness gap, no data or correctness risk)
**Depends on**: `frontend_spec_041_global_navigation.md` (installs `react-router-dom`, the
`BrowserRouter`/`Routes` this spec extends), `frontend_spec_056_series_list_status_tabs.md` (owns
the existing `/my-series/:statusTab` route this spec's new route must not collide with),
`frontend_spec_005_series_detail.md` (`SeriesDetail` itself, unchanged data-fetching behavior)
**Area**: Frontend (`App.tsx`, `components/SeriesList.tsx`, `components/SeriesDetail.tsx`)

## Overview

`frontend_spec_041` gave the app's three top-level views real URLs (`/my-series`,
`/recommendations`, `/keywords`/`/analysis`) but deliberately left `SeriesDetail` out of scope
(that spec's own Requirement 4). Today, `App.tsx` holds a plain `selectedSeriesId` `useState`;
when a `SeriesList` row is clicked, `App` sets that state and renders `SeriesDetail` in place of
the *entire* nav+routed tree via a ternary — not a nested route. The URL never changes, no browser
history entry is created, and "Back" is the only way out. A user cannot bookmark, refresh, share,
or use the browser's own Back/Forward buttons to reach a specific series.

`SeriesDetail` already fetches its own data by id (`seriesApi.getById(id)` inside its own
`useEffect`, keyed on `[id, refreshIndex]`) — it has never depended on a pre-fetched `Series`
object from `SeriesList`. This means the fix is purely a routing/wiring change: no new API call is
needed.

## Design Decisions

- **New route is `/my-series/view/:id`, not `/my-series/:id`.** `frontend_spec_056` already
  registered `/my-series/:statusTab`, matched against five literal values
  (`watching|completed|backlog|dropped|rewatch`). A second, sibling dynamic segment at that same
  path shape (`/my-series/:id`) would be ambiguous for `react-router` to resolve against a real
  series id — only one route can own that path. A distinct `view` segment avoids this cleanly,
  rather than making `MySeriesView` runtime-inspect its param against five reserved words (fragile,
  and would silently misroute if a series id ever happened to equal one of those five strings).
- **`SeriesDetail`'s data-fetching is unchanged.** It already self-fetches via `seriesApi.getById`;
  this spec only changes *how it gets mounted* (a route instead of a ternary) and *how navigation
  in/out of it happens* (`useNavigate` instead of `setSelectedSeriesId`).
- **Accepted side effect, not a new requirement**: because `SeriesDetail` becomes a real nested
  route inside the app's routed tree instead of a full-page ternary swap-out, the persistent top
  nav and My Series status tabs (`frontend_spec_092`) now remain visible while viewing a series'
  detail page, where before they were hidden entirely. This is a natural consequence of switching
  away from the ternary hijack, not a design goal — noted here so it isn't mistaken for a
  regression during review.
- **No change to `SeriesDetail`'s own Edit/Delete/Recommendations actions.** They're already
  self-contained (`editingSeries` state, the delete confirmation, `SeriesRecommendationsModal`) and
  don't depend on `selectedSeriesId`/route state except for what happens *after* a delete
  completes.

## Requirements

### Requirement 1: `/my-series/view/:id` route renders `SeriesDetail`

**User Story**: As a user, I want a specific series' page to have its own URL, so I can bookmark it,
share it, refresh the page, or use the browser's Back/Forward buttons.

#### FRONTEND-113-AC-01 [AUTO]: new route renders `SeriesDetail` for the given id
**Statement**: `App.tsx`'s route tree shall register `/my-series/view/:id`, rendering `SeriesDetail`
with `id` taken from the route param via `useParams`.

**Rationale**: This is the actual URL a user bookmarks or shares.

**References**:
- `App.tsx` (existing `Routes`/`Route` block, `frontend_spec_056`'s `/my-series/:statusTab`
  registration to mirror the sibling-route style of)
- `components/SeriesDetail.tsx` (`id` prop, existing `seriesApi.getById` self-fetch)

**Test Case (Red)**:
```typescript
describe('FRONTEND-113-AC-01: /my-series/view/:id renders SeriesDetail', () => {
  it('fetches and displays the series for the id in the URL', async () => {
    vi.mocked(seriesApi.getById).mockResolvedValue(mockSeries({ id: 'abc-123', title: 'Show A' }))
    renderWithRouter(<App />, { route: '/my-series/view/abc-123' })

    expect(await screen.findByText('Show A')).toBeInTheDocument()
    expect(seriesApi.getById).toHaveBeenCalledWith('abc-123')
  })
})
```

**Test Case (Green)**: add `<Route path="/my-series/view/:id" element={<SeriesDetailRoute />} />`
(a thin wrapper reading `useParams` and rendering `<SeriesDetail id={id} ... />`) to `App.tsx`'s
route tree.

---

#### FRONTEND-113-AC-02 [AUTO]: `/my-series/:statusTab` is unaffected
**Statement**: The existing `/my-series/:statusTab` route (values `watching`, `completed`,
`backlog`, `dropped`, `rewatch`) shall continue to render `MySeriesView` exactly as before this
spec — the new route is additive.

**Rationale**: Regression guard against the exact ambiguity this spec's Design Decisions call out.

**Test Case (Red)**:
```typescript
describe('FRONTEND-113-AC-02: existing status-tab route is unaffected', () => {
  it('still renders MySeriesView for /my-series/watching', () => {
    renderWithRouter(<App />, { route: '/my-series/watching' })
    expect(screen.getByRole('tab', { name: /watching/i })).toHaveAttribute('aria-selected', 'true')
  })
})
```

**Test Case (Green)**: covered automatically once the new route uses a distinct `view` path
segment rather than overloading `/my-series/:statusTab`'s own shape.

---

### Requirement 2: Navigating to/from a series uses real routing, not local state

**User Story**: As a user, I want clicking a series, going "Back", and deleting a series to behave
like real navigation (URL changes, browser history works), not a component swap that leaves the URL
untouched.

#### FRONTEND-113-AC-03 [AUTO]: clicking a `SeriesList` row navigates to the new route
**Statement**: When a user clicks a row in `SeriesList`, `App` shall call
`navigate('/my-series/view/${id}')` (via `useNavigate`) instead of `setSelectedSeriesId(id)`.

**Rationale**: This is what actually changes the URL/creates the history entry.

**References**: `components/SeriesList.tsx` (`onSeriesClick` prop), `App.tsx` (current
`setSelectedSeriesId` call site)

**Test Case (Red)**:
```typescript
describe('FRONTEND-113-AC-03: row click navigates to the series URL', () => {
  it('changes the URL to /my-series/view/:id on row click', async () => {
    renderWithRouter(<App />, { route: '/my-series' })
    await userEvent.click(screen.getByText('Show A'))
    expect(window.location.pathname).toBe('/my-series/view/abc-123')
  })
})
```

**Test Case (Green)**: replace `setSelectedSeriesId` with `navigate(...)` at the `onSeriesClick`
call site.

---

#### FRONTEND-113-AC-04 [AUTO]: "Back" and a successful delete navigate to `/my-series`
**Statement**: `SeriesDetail`'s "Back" action and its `onDeleted` callback (fired after a successful
delete) shall each call `navigate('/my-series')` instead of `setSelectedSeriesId(null)`.

**Rationale**: Preserves today's exact user-facing outcome (return to the list) while going through
real navigation instead of local state.

**Test Case (Red)**:
```typescript
describe('FRONTEND-113-AC-04: Back and delete return to /my-series', () => {
  it('navigates to /my-series when Back is clicked', async () => {
    renderWithRouter(<App />, { route: '/my-series/view/abc-123' })
    await userEvent.click(await screen.findByRole('button', { name: /back/i }))
    expect(window.location.pathname).toBe('/my-series')
  })

  it('navigates to /my-series after a successful delete', async () => {
    vi.mocked(seriesApi.remove).mockResolvedValue(undefined)
    renderWithRouter(<App />, { route: '/my-series/view/abc-123' })
    await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
    await userEvent.click(await screen.findByRole('button', { name: /confirm/i }))
    expect(window.location.pathname).toBe('/my-series')
  })
})
```

**Test Case (Green)**: wire `SeriesDetail`'s `onBack`/`onDeleted` props (passed from the new route
wrapper) to `navigate('/my-series')`.

---

#### FRONTEND-113-AC-05 [AUTO]: an unresolvable id shows an error with a way back
**Statement**: If `seriesApi.getById` rejects (e.g. the series was deleted, or the URL's id doesn't
exist), then `SeriesDetail` shall display an error message and a link/button back to `/my-series`.

**Rationale**: A shared/bookmarked link can go stale; the user needs a way out that isn't the
browser Back button (which may not even have a prior in-app entry, e.g. on a fresh page load).

**Test Case (Red)**:
```typescript
describe('FRONTEND-113-AC-05: unresolvable id shows an error with a way back', () => {
  it('shows an error and a link to /my-series when getById rejects', async () => {
    vi.mocked(seriesApi.getById).mockRejectedValue(new Error('Not found'))
    renderWithRouter(<App />, { route: '/my-series/view/does-not-exist' })

    expect(await screen.findByText(/could not be found|error/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /my series|back/i })).toHaveAttribute('href', '/my-series')
  })
})
```

**Test Case (Green)**: extend `SeriesDetail`'s existing fetch-error branch (if present) or add one,
rendering a `<Link to="/my-series">` alongside the error message.

## Cross-References

| Concept | Location |
|---|---|
| Router/`BrowserRouter`/`Routes` this spec extends | `frontend_spec_041_global_navigation.md` |
| Existing `/my-series/:statusTab` route this spec's new route must not collide with | `frontend_spec_056_series_list_status_tabs.md` |
| `SeriesDetail`'s existing self-fetch (`seriesApi.getById`), unchanged by this spec | `frontend_spec_005_series_detail.md`, `services/seriesApi.ts` |
| Persistent nav that now stays visible on the detail route (accepted side effect) | `frontend_spec_092_persistent_navigation_and_modal_dismissal.md` |

## Acceptance Criteria Summary

- [x] FRONTEND-113-AC-01: `/my-series/view/:id` renders `SeriesDetail` for the given id
- [x] FRONTEND-113-AC-02: `/my-series/:statusTab` is unaffected
- [x] FRONTEND-113-AC-03: clicking a `SeriesList` row navigates to the new route
- [x] FRONTEND-113-AC-04: "Back" and a successful delete navigate to `/my-series`
- [x] FRONTEND-113-AC-05: an unresolvable id shows an error with a way back to `/my-series`
