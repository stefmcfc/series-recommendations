# Frontend Spec 041: Global Navigation — Menu Bar, Logo/Home Link, Top-Level Routing

**Status**: Not started
**Priority**: P3 (cosmetic/IA improvement — no functional bug being fixed)
**Depends on**: Frontend Spec 005 (`frontend_spec_005_series_detail.md`, the "No router" design decision this
spec supersedes at the top level only) ✅, Frontend Spec 010 (`frontend_spec_010_recommendations.md`, the
original `mainView` nav toggle this spec replaces) ✅, Frontend Spec 024 (`frontend_spec_024_keyword_tracking.md`,
the Keywords nav toggle) ✅
**Area**: Frontend (global — `App.tsx`, new `App.module.css`) — no backend change needed.

## Overview

`App.tsx`'s top nav is currently three unstyled `<button aria-pressed={...}>` elements toggling a `mainView`
`useState` — no CSS class on the `<nav>` or buttons at all (default browser button chrome), no URL, no browser
history. This spec restyles that nav as a proper menu bar, adds a plain placeholder logo/wordmark at its start
that links back to "My Series" (the app's home view), and introduces real client-side routing for the three
top-level views only: `/my-series`, `/recommendations`, `/keywords`. This is the first of two related specs — a
follow-up spec will reorganize `RecommendationControls`' own "Recommendation Source" mode selector into a
tab-style widget that visually matches the menu bar this spec establishes; get the visual language right here
since that spec will explicitly reuse it.

This requires adding a router dependency — none exists today (confirmed: no `react-router`/`react-router-dom` in
`frontend/package.json`; `frontend_structure.md` lists `src/pages/` as "not yet created" for exactly this reason;
`frontend_spec_005`'s own "No router" design decision cites the same absence). `react-router-dom` (`^7`) is the
natural default for this stack and is what this spec adds.

## Design Decisions

- **Top-level routing only — deliberately shallow.** Three routes: `/my-series`, `/recommendations`,
  `/keywords`. No deeper routes (no `/recommendations/popular`, no per-mode sub-routes) and no route for
  `SeriesDetail`'s selected-series view. `SeriesDetail` stays exactly as it is today: reached only by clicking a
  row, shown via the existing `selectedSeriesId` component state, no URL change, no browser history entry. Adding
  a shareable/deep-linkable URL for a specific series is a separate, already-tracked idea
  (`.claude/ideas/future_ideas.md`, "No router / no shareable URL for a specific series") — this spec does not
  resolve it, though it does make the underlying "no router installed" premise of that note partially stale (see
  Implementation Notes).
- **`react-router-dom` in declarative mode** (`<BrowserRouter>`/`<Routes>`/`<Route>`/`<NavLink>`), not the data
  router (`createBrowserRouter`, loaders/actions). This app has no need for route-level data loading — every view
  already fetches its own data via its own `useEffect` (`SeriesList`, `RecommendationsList`, `KeywordsView` all
  do this today, unaffected by this spec) — so the data router's extra machinery would be pure overhead against
  this project's "Keep It Simple: MVP features only, no over-engineering" principle (`frontend_conventions.md`).
- **`<BrowserRouter>` lives inside `App.tsx`** (wrapping the existing return value), not in `main.tsx` — keeps
  `App` a fully self-contained root component, matching today's shape where `main.tsx` only does
  `createRoot(...).render(<App />)` with no additional providers. No change needed to `main.tsx`.
- **An unmatched path redirects to `/my-series`** rather than rendering a dedicated 404 view — this is a
  single-user personal app with exactly three real destinations; a bespoke not-found page is unwarranted
  complexity for this scope. `/` itself also redirects to `/my-series` (same target, same mechanism) — "My
  Series" is unambiguously this app's home view (`README.md`'s own framing, and where the logo link points).
- **Active-link indication switches from `aria-pressed` to `aria-current="page"`.** Today's nav items are
  `<button aria-pressed={mainView === 'x'}>`; once they're real links (`<NavLink>`), the correct ARIA idiom for
  "this link represents the current page" is `aria-current="page"` (which `react-router-dom`'s `NavLink` sets
  automatically via its `className`/`aria-current` prop support), not `aria-pressed` (that's for toggle buttons,
  not navigation).
- **Existing `App.test.tsx` nav-toggle tests will break and need updating, not just new tests added.** Nav items
  change accessible role from `button` to `link` (a real `<a href>` via `NavLink`), so every existing
  `screen.getByRole('button', { name: /recommendations/i })`-style query against a nav item stops matching.
  Confirmed affected: the `FRONTEND-010-AC-18/19` "Recommendations nav toggle" test, `FRONTEND-011-AC-10`
  "RecommendationControls only renders in the Recommendations view" test, and the `FRONTEND-024-AC-10`
  "Keywords nav toggle" test (all in `App.test.tsx`) — each queries a nav item via `getByRole('button', ...)`.
  These need their queries changed to `getByRole('link', ...)` as part of implementing this spec, not left
  broken. Their underlying assertions (which view renders, `data-testid`s present/absent) don't need to change.
- **Route-seeding convention for tests**: since `<BrowserRouter>` is internal to `App`, a test controls the
  starting route via `window.history.pushState({}, '', '/recommendations')` *before* `render(<App />)` — a
  standard, well-established RTL/react-router testing technique — rather than exporting a separate
  `MemoryRouter`-wrapped test build of `App`. Every new test below follows this convention.
- **Logo is a plain placeholder** (e.g. the text "TV Series Tracker" or a simple generic mark styled as a
  wordmark) — no real visual identity design. Actual logo/branding design is deliberately deferred, tracked in
  `.claude/ideas/future_ideas.md` under "Real logo / visual branding design."
- **Code-splitting (`React.lazy`/`Suspense`) is out of scope.** `frontend_conventions.md`'s own Performance
  section already frames this as a "once routing exists" future optimization, not a day-one requirement, and
  explicitly says this app's scale (~50 series) doesn't need it yet.

---

## Requirement 1: Menu-bar visual redesign

**User story**: As a user, I want the top navigation to look like a real, intentional menu bar rather than three
unstyled default buttons, so the app looks and feels finished.

### FRONTEND-041-AC-01 [AUTO]
**Statement**: The `App` root shall render exactly three navigation links — "My Series", "Recommendations",
"Keywords" — as `<NavLink>` elements (accessible role `link`), replacing today's `<button aria-pressed>` elements.

**References**: `App.tsx`'s current `<nav>` block (three `<button>` elements).

**Test Case (Red)**:
```typescript
describe('FRONTEND-041-AC-01: nav items are links, not buttons', () => {
  it('renders My Series/Recommendations/Keywords as links', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('add-series-btn')

    expect(screen.getByRole('link', { name: /my series/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /recommendations/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^keywords$/i })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: replace the `<button>` nav items with `react-router-dom`'s `<NavLink to="...">`, styled via
a new `App.module.css`.

---

### FRONTEND-041-AC-02 [MANUAL]
**Statement**: When viewed in a real browser in both light and dark `prefers-color-scheme`, the nav shall read as
a cohesive, styled menu bar (distinct background/border from the page body, clear spacing between items, a visible
active-item indicator) — not default browser button chrome.

**Verification**: Manual browser check (jsdom doesn't render CSS — see this project's own "Vitest/jsdom can't
validate real CSS rendering" convention). Check both `prefers-color-scheme: light` and `dark`, using this app's
existing `--text`/`--bg`/`--border`/`--accent` custom properties (`index.css`) rather than hardcoded colors, per
that same convention. No realistic path to automating this — visual truth requires an actual render.

---

## Requirement 2: Logo links to "My Series" (home)

**User story**: As a user, I want a clickable logo in the top-left that takes me back to my series list from
anywhere in the app, matching a conventional app layout.

### FRONTEND-041-AC-03 [AUTO]
**Statement**: The `App` root shall render a placeholder logo/wordmark element as the first item in the nav bar,
rendered as a link to `/my-series`.

**References**: `.claude/ideas/future_ideas.md`'s "Real logo / visual branding design" (the placeholder-now,
design-later split this AC implements the "now" half of).

**Test Case (Red)**:
```typescript
describe('FRONTEND-041-AC-03: logo links home', () => {
  it('renders a logo link pointing at /my-series', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('add-series-btn')

    const logo = screen.getByTestId('app-logo')
    expect(logo.closest('a')).toHaveAttribute('href', '/my-series')
  })
})
```
**Test Case (Green)**: add a `<NavLink to="/my-series" data-testid="app-logo">` (or an inner element carrying the
test id) before the three nav items.

---

### FRONTEND-041-AC-04 [AUTO]
**Statement**: When the logo is clicked while on `/recommendations` or `/keywords`, the app shall navigate to
`/my-series`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-041-AC-04: logo click navigates home from any view', () => {
  it('navigates to My Series from Recommendations', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRecommendations.mockResolvedValue([])
    mockGetGenreOptions.mockResolvedValue([])
    window.history.pushState({}, '', '/recommendations')

    render(<App />)
    await screen.findByTestId('recommendations-list')

    fireEvent.click(screen.getByTestId('app-logo'))

    await screen.findByTestId('series-list')
    expect(window.location.pathname).toBe('/my-series')
  })
})
```
**Test Case (Green)**: no additional logic beyond AC-03's `<NavLink>` — this is a regression guard confirming
navigation actually occurs, not just that the `href` is correct.

---

## Requirement 3: Top-level routing for the three main views

**User story**: As a user, I want each main view to have its own URL, so the browser's back/forward buttons work
and I can bookmark/refresh into a specific view.

### FRONTEND-041-AC-05 [AUTO]
**Statement**: When the app loads at `/`, it shall redirect to `/my-series`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-041-AC-05: root redirects to /my-series', () => {
  it('shows the series list when loaded at /', async () => {
    mockGetAll.mockResolvedValue([])
    window.history.pushState({}, '', '/')

    render(<App />)

    await screen.findByTestId('series-list')
    expect(window.location.pathname).toBe('/my-series')
  })
})
```
**Test Case (Green)**: `<Route path="/" element={<Navigate to="/my-series" replace />} />`.

---

### FRONTEND-041-AC-06 [AUTO]
**Statement**: When the app is at `/my-series`, it shall render `SearchFilter`, `ExportControls`, and `SeriesList`
— today's "list" view content, unchanged.

**Test Case (Red)**:
```typescript
describe('FRONTEND-041-AC-06: /my-series renders the list view', () => {
  it('renders SeriesList content at /my-series', async () => {
    mockGetAll.mockResolvedValue([])
    window.history.pushState({}, '', '/my-series')

    render(<App />)

    expect(await screen.findByTestId('series-list')).toBeInTheDocument()
    expect(screen.getByTestId('export-json-btn')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `<Route path="/my-series" element={<>{/* existing list-view JSX */}</>} />`.

---

### FRONTEND-041-AC-07 [AUTO]
**Statement**: When the app is at `/recommendations`, it shall render `RecommendationControls` and
`RecommendationsList` — today's "recommendations" view content, unchanged.

**Test Case (Red)**:
```typescript
describe('FRONTEND-041-AC-07: /recommendations renders the recommendations view', () => {
  it('renders RecommendationsList content at /recommendations', async () => {
    mockGetRecommendations.mockResolvedValue([])
    mockGetGenreOptions.mockResolvedValue([])
    window.history.pushState({}, '', '/recommendations')

    render(<App />)

    expect(await screen.findByTestId('recommendations-list')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `<Route path="/recommendations" element={<>{/* existing recommendations-view JSX */}</>} />`.

---

### FRONTEND-041-AC-08 [AUTO]
**Statement**: When the app is at `/keywords`, it shall render `KeywordsView` — today's "keywords" view content,
unchanged.

**Test Case (Red)**:
```typescript
describe('FRONTEND-041-AC-08: /keywords renders the keywords view', () => {
  it('renders KeywordsView content at /keywords', async () => {
    mockGetAll.mockResolvedValue([])
    window.history.pushState({}, '', '/keywords')

    render(<App />)

    expect(await screen.findByTestId('keywords-view')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `<Route path="/keywords" element={<KeywordsView />} />`.

---

### FRONTEND-041-AC-09 [AUTO]
**Statement**: When a nav link is clicked, the browser URL shall update to match, and the browser Back button
shall return to the previously active view.

**References**: supersedes `FRONTEND-010-AC-18/19`'s and `FRONTEND-024-AC-10`'s nav-toggle tests in
`App.test.tsx` — those need their `getByRole('button', ...)` queries changed to `getByRole('link', ...)` per this
spec's Design Decisions, not rewritten from scratch.

**Test Case (Red)**:
```typescript
describe('FRONTEND-041-AC-09: nav updates the URL and supports Back', () => {
  it('navigates and supports browser Back', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRecommendations.mockResolvedValue([])
    mockGetGenreOptions.mockResolvedValue([])
    window.history.pushState({}, '', '/my-series')

    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.click(screen.getByRole('link', { name: /recommendations/i }))
    await screen.findByTestId('recommendations-list')
    expect(window.location.pathname).toBe('/recommendations')

    window.history.back()
    await waitFor(() => expect(window.location.pathname).toBe('/my-series'))
    expect(await screen.findByTestId('series-list')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: comes for free from `react-router-dom`'s `<NavLink>`/`<BrowserRouter>` — this is a
regression guard confirming routing genuinely drives the view (not leftover `mainView` state).

---

### FRONTEND-041-AC-10 [AUTO]
**Statement**: When the app loads at any path other than `/`, `/my-series`, `/recommendations`, or `/keywords`,
it shall redirect to `/my-series`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-041-AC-10: unmatched path redirects to /my-series', () => {
  it('redirects an unknown path to /my-series', async () => {
    mockGetAll.mockResolvedValue([])
    window.history.pushState({}, '', '/does-not-exist')

    render(<App />)

    await screen.findByTestId('series-list')
    expect(window.location.pathname).toBe('/my-series')
  })
})
```
**Test Case (Green)**: `<Route path="*" element={<Navigate to="/my-series" replace />} />`.

---

## Requirement 4: `SeriesDetail` is unaffected — stays in-page state, not a route

**User story**: As a user, I want opening a series' detail view to behave exactly as it does today — this spec
shouldn't change that flow at all.

### FRONTEND-041-AC-11 [AUTO]
**Statement**: While a series is selected (`selectedSeriesId` is set), the menu bar shall not render — exactly
matching current behavior, unaffected by this spec.

**References**: `App.tsx`'s existing `selectedSeriesId ? <SeriesDetail .../> : <>...</>` ternary — preserved,
not modified in shape, only relocated to render inside the routed content rather than replacing it.

**Test Case (Red)**:
```typescript
describe('FRONTEND-041-AC-11: menu bar hides behind SeriesDetail', () => {
  it('hides the nav when a series is selected', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    window.history.pushState({}, '', '/my-series')

    render(<App />)
    await screen.findByTestId('series-row')
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))

    await screen.findByTestId('back-btn')
    expect(screen.queryByRole('link', { name: /my series/i })).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: no new logic — confirms the existing ternary's behavior survives the routing refactor
unchanged.

---

### FRONTEND-041-AC-12 [AUTO]
**Statement**: Selecting or deselecting a series shall not change the URL — it stays at `/my-series` throughout.

**Test Case (Red)**:
```typescript
describe('FRONTEND-041-AC-12: selecting a series does not change the URL', () => {
  it('keeps the URL at /my-series through select and back', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    window.history.pushState({}, '', '/my-series')

    render(<App />)
    await screen.findByTestId('series-row')
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    await screen.findByTestId('back-btn')
    expect(window.location.pathname).toBe('/my-series')

    fireEvent.click(screen.getByTestId('back-btn'))
    await screen.findByTestId('series-row')
    expect(window.location.pathname).toBe('/my-series')
  })
})
```
**Test Case (Green)**: no new logic — `selectedSeriesId` remains plain component state, never written to the URL.

---

## Implementation Notes

- **Add `react-router-dom` (`^7`) to `frontend/package.json`** — the first router dependency this project has
  ever had.
- **Update `.claude/ideas/future_ideas.md`'s "No router / no shareable URL for a specific series" entry** as
  part of implementing this spec — its premise ("no `react-router` dependency... no deep-linking, no browser
  history entry") is now half-stale: a router exists app-wide after this spec, but `SeriesDetail` specifically
  still isn't routed (Requirement 4, deliberately). Reword the entry to reflect that narrower remaining gap
  rather than leaving it implying no router exists anywhere in the app.
- **`App.test.tsx`**: update the three existing nav-toggle tests identified in Design Decisions
  (`FRONTEND-010-AC-18/19`, `FRONTEND-011-AC-10`, `FRONTEND-024-AC-10`) to query nav items via
  `getByRole('link', ...)` instead of `getByRole('button', ...)`, and to seed their starting route via
  `window.history.pushState` rather than relying on default mount state. Their actual assertions (which
  `data-testid` appears/disappears) don't need to change.
- **`App.module.css`** is a new file — this project's styling convention (`frontend_conventions.md`) is one CSS
  Module per component, colocated; `App.tsx` has never had one until now since it previously had no component-
  specific styling to speak of.

## Cross-References

| This spec | Source |
|---|---|
| `App.tsx`'s current `mainView` state/`<nav>` toggle being replaced | `frontend_spec_010_recommendations.md` (introduced the nav toggle), `frontend_spec_024_keyword_tracking.md` (added the Keywords toggle) |
| "No router" rationale this spec supersedes at the top level only | `frontend_spec_005_series_detail.md`'s Design Decisions |
| `src/pages/` placeholder this spec doesn't yet populate (still no per-page component split — routes render existing inline JSX blocks) | `frontend_structure.md` |
| Real logo/branding design, deferred | `.claude/ideas/future_ideas.md`, "Real logo / visual branding design" |
| Deep-linking `SeriesDetail`, still not resolved | `.claude/ideas/future_ideas.md`, "No router / no shareable URL for a specific series" |
| Follow-up spec reusing this spec's menu-bar visual language for the Recommendation Source mode selector | to be written next (Recommendation Source mode reorganization) |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-041-AC-01: nav items render as links, not buttons
- [ ] FRONTEND-041-AC-02: menu bar reads as a cohesive styled bar in both themes (manual visual check)
- [ ] FRONTEND-041-AC-03: placeholder logo renders, links to `/my-series`
- [ ] FRONTEND-041-AC-04: clicking the logo navigates home from any view
- [ ] FRONTEND-041-AC-05: `/` redirects to `/my-series`
- [ ] FRONTEND-041-AC-06: `/my-series` renders the list view
- [ ] FRONTEND-041-AC-07: `/recommendations` renders the recommendations view
- [ ] FRONTEND-041-AC-08: `/keywords` renders the keywords view
- [ ] FRONTEND-041-AC-09: nav updates the URL; browser Back works
- [ ] FRONTEND-041-AC-10: an unmatched path redirects to `/my-series`
- [ ] FRONTEND-041-AC-11: menu bar hides while `SeriesDetail` is shown, unaffected
- [ ] FRONTEND-041-AC-12: selecting/deselecting a series never changes the URL
