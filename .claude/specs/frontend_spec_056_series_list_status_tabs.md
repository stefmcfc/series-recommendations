# Frontend Spec 056: `SeriesList` Status-Based Tabs (with Real URLs)

**Status**: Not started
**Priority**: P3 (navigation/browse improvement — quicker access to a status subset than the
existing dropdown filter)
**Depends on**: Frontend Spec 055 (`frontend_spec_055_search_filter_overhaul.md`) ✅ **build after,
not because of a logical dependency, but because both specs edit `SearchFilter.tsx` — sequencing
avoids two specs conflicting on the same file**, per this project's one-pair-in-flight convention,
Frontend Spec 041 (`frontend_spec_041_global_navigation.md`, owns the `react-router-dom` routing/
`NavLink` pattern this spec extends with the app's first dynamic route param) ✅
**No backend spec or backend change is required.** `SeriesSearchCriteria.status` already exists and
is already filterable — this spec only changes how the frontend sets it.
**Area**: Frontend (`App.tsx`, `components/SearchFilter.tsx`)

## Overview

Confirmed (2026-08-29): today's only status filtering is `SearchFilter`'s single-select Status
dropdown (Any/Watching/Completed/Dropped/Backlog); `SeriesList` itself has no tabs, and none of this
app's routes have a URL parameter (`App.tsx`'s only dynamic route today is the catch-all `*`). This
spec adds a status tab bar above `SeriesList`, each tab with its own URL
(`/my-series`, `/my-series/watching`, `/my-series/completed`, `/my-series/backlog`,
`/my-series/dropped`), and **removes** `SearchFilter`'s Status dropdown, since the tab bar now owns
status selection exclusively.

**Deviation from the original idea's literal tab list**: the idea as raised named "All/Completed/
Watching/Backlog" — four tabs, omitting Dropped. Since this spec removes the Status dropdown
entirely (the only other way to reach Dropped-status series), a fifth **Dropped** tab is added so no
existing filtering capability is lost. This is a deliberate, documented deviation, not an oversight.

## Design Decisions

- **Status is now derived purely from the URL, owned by `App.tsx`, not by `SearchFilter`.**
  `SearchFilter`'s `FormState`/`buildCriteria` drops `status` entirely; `App.tsx` reads the active
  tab from the route param and merges it into the criteria object passed to `SeriesList`/
  `ExportControls`: `{ ...criteriaFromSearchFilter, status: statusFromRoute }`. Changing any other
  `SearchFilter` field never resets or overrides the active tab, and vice versa — the two are
  independent inputs merged at the `App.tsx` level.
- **Two literal routes, not one optional-param route**: `path="/my-series"` (All, `status`
  `undefined`) and `path="/my-series/:statusTab"` (a specific tab), both rendering the same element
  and reading `useParams().statusTab` (`undefined` on the bare route) — chosen over a single
  optional-param route (`:statusTab?`) for simplicity and to avoid relying on optional-param syntax
  this codebase has never used before (no other route here has a `:param` at all yet).
  `statusTab` path segments are lowercase (`watching`/`completed`/`backlog`/`dropped`), mapped to
  the uppercase `SeriesStatus` enum values `SeriesSearchCriteria.status` expects.
- **The top-level "My Series" `NavLink` loses its `end` prop.** Today it's `<NavLink to="/my-series"
  end>`, active only on the exact bare path — with sub-routes now existing under `/my-series/*`, the
  top-level nav item should stay visually active while on any status tab, matching how a user would
  expect "I'm still in the My Series section" to read. Removing `end` achieves this (react-router's
  default prefix-match behavior).
- **Active tab gets `aria-current="page"`** — react-router's `NavLink` already applies this
  automatically to whichever link matches the current route, the same mechanism the existing
  top-level nav already relies on; no new ARIA wiring needed, just more `NavLink`s.
- **No per-tab filter hiding in this spec.** Every other `SearchFilter` field remains visible
  regardless of which tab is active — a Completed-only tab showing a field that's less meaningful
  there (there are none left after `frontend_spec_055`'s "Started, not finished" removal) is not a
  bug this spec needs to solve.

---

## Requirement 1: Status tab bar with real URLs

**User story**: As a user, I want quick tabs to jump straight to Watching/Completed/Backlog/Dropped
(or everything), with a URL I can bookmark or share for that view.

### FRONTEND-056-AC-01 [AUTO]
**Statement**: A tab bar above `SeriesList` shall render five `NavLink`s — "All" (`/my-series`),
"Watching" (`/my-series/watching`), "Completed" (`/my-series/completed`), "Backlog"
(`/my-series/backlog`), "Dropped" (`/my-series/dropped`) — using the same `navLinkClassName`/active-
state pattern as the existing top-level nav.

**Test Case (Red)**:
```typescript
it('FRONTEND-056-AC-01: renders five status tabs', async () => {
  renderApp() // wraps App with MemoryRouter at /my-series
  expect(await screen.findByRole('link', { name: 'All' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Watching' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Completed' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Backlog' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Dropped' })).toBeInTheDocument()
})
```
**Test Case (Green)**: new tab bar JSX in `App.tsx`'s `/my-series` element block, five `NavLink`s.

---

### FRONTEND-056-AC-02 [AUTO]
**Statement**: `App.tsx` shall register `path="/my-series/:statusTab"` alongside the existing
`path="/my-series"`, both rendering the same `SearchFilter`/`ExportControls`/`SeriesList` block.
Navigating directly to `/my-series/completed` shall render `SeriesList` filtered to
`status: 'COMPLETED'`.

**Test Case (Red)**:
```typescript
it('FRONTEND-056-AC-02: deep-linking to a status tab filters SeriesList', async () => {
  mockSearch.mockResolvedValue([makeSeries({ title: 'Completed Show', status: 'COMPLETED' })])
  renderApp({ initialRoute: '/my-series/completed' })

  expect(await screen.findByText('Completed Show')).toBeInTheDocument()
  expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }))
  expect(screen.getByRole('link', { name: 'Completed' })).toHaveAttribute('aria-current', 'page')
})
```
**Test Case (Green)**: new `<Route path="/my-series/:statusTab" element={...} />`; a small
`statusTab → SeriesStatus` mapping function; `useParams()` read where the element is rendered.

---

### FRONTEND-056-AC-03 [AUTO]
**Statement**: The top-level "My Series" `NavLink` shall remain visually active (`aria-current`)
while any status tab is active, not just the bare `/my-series` path.

**Test Case (Red)**:
```typescript
it('FRONTEND-056-AC-03: top-level My Series nav stays active on a status tab', async () => {
  renderApp({ initialRoute: '/my-series/watching' })
  const topLevelLink = screen.getAllByRole('link', { name: 'My Series' })[0]
  expect(topLevelLink).toHaveAttribute('aria-current', 'page')
})
```
**Test Case (Green)**: remove the `end` prop from the top-level `<NavLink to="/my-series">`.

---

## Requirement 2: `SearchFilter` drops the Status dropdown; `App.tsx` merges tab-derived status

### FRONTEND-056-AC-04 [AUTO]
**Statement**: `SearchFilter` shall no longer render the Status `<select>`. `buildCriteria` shall no
longer set `status` on the resulting `SearchCriteria`.

**Already satisfied (2026-08-29)** — this was pulled forward into
`frontend_spec_055_search_filter_overhaul.md`'s pre-merge amendments as its own
`FRONTEND-055-AC-07` (identical statement/test), implemented and merged to `main` in PR #117
before this spec was picked up. Nothing to do here — don't re-implement it. Kept as its own AC
(not deleted) per this project's ID-immutability convention; it's simply satisfied by a sibling
spec's AC rather than its own test.

---

### FRONTEND-056-AC-05 [AUTO]
**Statement**: `App.tsx` shall merge the route-derived status into the criteria object passed to
`SeriesList`/`ExportControls`, combined with whatever `SearchFilter` itself produces (e.g. a title
filter set while on the Watching tab produces `{ title: '...', status: 'WATCHING' }`).

**Test Case (Red)**:
```typescript
it('FRONTEND-056-AC-05: SearchFilter criteria and tab-derived status combine', async () => {
  renderApp({ initialRoute: '/my-series/watching' })
  fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'test' } })
  fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

  expect(mockSearch).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'test', status: 'WATCHING' }),
  )
})
```
**Test Case (Green)**: `App.tsx` builds the effective criteria as `{ ...criteria, status:
statusFromRoute }` before passing it down, rather than `SearchFilter` owning `status` itself.

---

### FRONTEND-056-AC-06 [AUTO] (regression guard)
**Statement**: Switching tabs shall not clear whatever other `SearchFilter` criteria is currently
set, and changing `SearchFilter`'s other fields shall not navigate away from the active tab.

**Test Case (Green)**: `criteria` (from `SearchFilter`) and `statusTab` (from the route) are
independent React state/values, merged only at render time — neither setter touches the other.

---

## Cross-References

| This spec | Source |
|---|---|
| `SeriesSearchCriteria.status`, already filterable, unchanged | `series_spec_003_search.md` |
| `react-router-dom`/`NavLink` routing pattern this spec extends | `frontend_spec_041_global_navigation.md` |
| `SearchFilter.tsx`, edited by both this spec and its predecessor | `frontend_spec_055_search_filter_overhaul.md` |
| The original idea, including its "which filters make sense per tab" open question (resolved here: none, after `frontend_spec_055`) | `.claude/ideas/future_ideas.md` ("Status-based tabs...") |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-056-AC-01: five status tabs render
- [ ] FRONTEND-056-AC-02: deep-linking to a status tab filters `SeriesList` correctly
- [ ] FRONTEND-056-AC-03: the top-level "My Series" nav stays active on any status tab
- [x] FRONTEND-056-AC-04: `SearchFilter`'s Status dropdown is removed (already satisfied via `frontend_spec_055`'s `FRONTEND-055-AC-07`, merged in PR #117)
- [ ] FRONTEND-056-AC-05: `App.tsx` merges `SearchFilter` criteria with the tab-derived status
- [ ] FRONTEND-056-AC-06: tabs and other filters don't clear/override each other
