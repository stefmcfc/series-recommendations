# Frontend Spec 054: `SeriesList` Compact/Grid View

**Status**: Not started
**Priority**: P3 (quality-of-life — an alternative, denser display for a growing collection; today's
expanded row view stays the default, unaffected)
**Depends on**: Frontend Spec 002 (`frontend_spec_002.md`, owns `SeriesList.tsx`) ✅, Frontend Spec
008 (`frontend_spec_008_accessible_row_interactions.md`, the nested-interactive-controls lesson this
spec's card button reuses) ✅, Frontend Spec 013 (`frontend_spec_013_star_ratings.md`, owns
`StarRating`, reused here read-only, unchanged) ✅
**No backend spec or backend change is required.** The compact view renders the exact same
already-fetched, already-filtered, already-sorted `series` array `SeriesList.tsx` already holds —
this is a pure display-mode toggle, no new data.
**Area**: Frontend (`components/SeriesList.tsx`, new `components/SeriesCompactGrid.tsx`)

## Overview

Confirmed (2026-08-29): `SeriesList.tsx` renders a single-column `<ul>`/flexbox list of expanded
rows (poster, title+year, status, badges, Edit/Delete/rewatch actions) with no alternative view.
This spec adds a second, opt-in "Compact" view — poster, title (year), and a read-only personal-
rating star display, nothing else, laid out as a responsive multi-column grid — clickable straight
through to `SeriesDetail`, where all the actions the expanded view shows inline already live.
Per discussion: the New Content and (once `frontend_spec_050` ships) Excluded From Recommendations
badges do **not** show in compact cards — the whole point of the compact view is minimal chrome.

## Design Decisions

- **Purely a rendering-mode toggle over existing state — no new fetch, no new filter/sort logic.**
  `viewMode` (`'expanded' | 'compact'`) is new local state in `SeriesList.tsx`; switching it just
  chooses which of two render paths runs over the same `series` array. Filtering (`SearchFilter`)
  and sorting (the existing Sort by control) apply identically to both views, since neither view
  changes what's fetched.
- **The compact card is a single real `<button>`, not a `div`/`role="button"`** — directly reusing
  the lesson `frontend_spec_008_accessible_row_interactions.md` already paid for (a clickable
  container holding other interactive elements triggers axe violations). The compact card has no
  nested interactive elements at all (no inline actions, by design), so there's nothing to conflict
  with — but the card itself is still built as a real, focusable `<button>` from the start, not a
  `div` with a manually-wired `onClick`/`role`/`tabIndex`.
- **The button carries an explicit `aria-label`** (`"View details for {title} ({year})"`) rather
  than relying on its visual contents for the accessible name — an explicit `aria-label` on the
  button wins the accessible-name computation regardless of what's nested inside, so the poster
  `<img>` inside it is `alt=""` (decorative, redundant with the label) and `StarRating`'s own nested
  `aria-label="Personal rating"` doesn't produce a confusing concatenated name.
- **`StarRating` is reused exactly as-is**, read-only (`<StarRating value={s.personalRating} />`,
  `onChange` omitted) — no changes to that component.
- **View mode persists to `localStorage`** (key `seriesListViewMode`), read on mount and written on
  every change, both wrapped so a read/write failure (private browsing, quota, storage disabled)
  degrades silently to the `'expanded'` default rather than erroring — this app's first
  `localStorage`-persisted UI preference. If/when the still-unspecced "Light/dark mode toggle" idea
  (`.claude/ideas/future_ideas.md`, Navigation section) gets specced, it should follow this same
  pattern rather than establishing a second one.
- **The toggle is two `aria-pressed` icon buttons** (a list/rows icon for Expanded, a grid icon for
  Compact), matching this file's own existing `aria-pressed` convention for the Rewatch toggle
  button, rather than introducing a new toggle idiom (a `<select>` or radio group) for a single
  binary choice. Per discussion: icons, not visible text labels.
- **Icon-only buttons carry an explicit `aria-label`** ("Expanded view"/"Compact view") — an icon
  glyph (SVG or icon font) has no accessible name on its own; WCAG 4.1.2 (Name, Role, Value)
  requires one to be programmatically available regardless of how the button looks. `aria-pressed`
  still reflects state exactly as it would with text buttons — icon-only vs. text-labeled is purely
  a visual choice, orthogonal to the state contract. Two more requirements this choice brings, both
  implementer-verified rather than unit-testable: the icon graphic itself needs ≥3:1 contrast
  against its background (WCAG 1.4.11, Non-text Contrast — the same rule any UI icon/graphic is
  held to, not unique to this button), and the clickable hit area should stay ≥24×24 CSS px even if
  the icon glyph itself is drawn smaller (WCAG 2.5.8, Target Size Minimum) — achieved via button
  padding, not by scaling the icon up.
- **Responsive columns via `repeat(auto-fit, minmax(X, 1fr))`**, the same CSS Grid idiom already
  used elsewhere in this app (`SearchFilter.module.css`, `RecommendationControls.module.css`,
  `SeriesDetail.module.css`'s metadata grid) — applied here to a card grid for the first time, but
  not a new pattern for the codebase. Exact `minmax` value is an implementer/visual call, not an AC.

---

## Requirement 1: View mode toggle and persistence

**User story**: As a user with a growing collection, I want a denser display option for my series
list, and I want my choice remembered next time I open the app.

### FRONTEND-054-AC-01 [AUTO]
**Statement**: `SeriesList`'s header (near the existing Sort control) shall render two icon buttons
— a list/rows icon (`data-testid="view-mode-expanded-btn"`, `aria-label="Expanded view"`) and a
grid icon (`data-testid="view-mode-compact-btn"`, `aria-label="Compact view"`) — each with
`aria-pressed` reflecting the current `viewMode`. Neither button renders visible text; the icon
itself is marked `aria-hidden="true"` (decorative — the button's own `aria-label` already carries
the accessible name).

**References**: `SeriesList.tsx`'s existing `.header`/`.sortControl`; the Rewatch toggle button's
existing `aria-pressed` convention in the same file.

**Test Case (Red)**:
```typescript
it('FRONTEND-054-AC-01: renders the icon view mode toggle with correct aria-pressed state and accessible names', async () => {
  render(<SeriesList {...defaultProps} />)
  const expandedBtn = await screen.findByTestId('view-mode-expanded-btn')
  const compactBtn = screen.getByTestId('view-mode-compact-btn')

  expect(expandedBtn).toHaveAttribute('aria-pressed', 'true')
  expect(expandedBtn).toHaveAccessibleName('Expanded view')
  expect(compactBtn).toHaveAttribute('aria-pressed', 'false')
  expect(compactBtn).toHaveAccessibleName('Compact view')
})
```
**Test Case (Green)**: new `viewMode` state, defaulting to `'expanded'`; two icon buttons (SVG or
icon-font glyph, `aria-hidden="true"`) with an `aria-label` each, toggling `viewMode` on click.

---

### FRONTEND-054-AC-02 [AUTO]
**Statement**: Clicking "Compact" shall switch rendering to the compact grid; clicking "Expanded"
shall switch back to today's row list. Neither click shall trigger a new `seriesApi` call — both
views render the same already-fetched `series` array.

**Test Case (Red)**:
```typescript
it('FRONTEND-054-AC-02: switching view mode does not refetch', async () => {
  render(<SeriesList {...defaultProps} />)
  await screen.findByTestId('series-row')
  mockGetAll.mockClear()

  fireEvent.click(screen.getByTestId('view-mode-compact-btn'))

  expect(await screen.findByTestId('compact-series-card')).toBeInTheDocument()
  expect(mockGetAll).not.toHaveBeenCalled()
})
```
**Test Case (Green)**: `viewMode` gates which JSX block renders; no `useEffect` dependency on
`viewMode`.

---

### FRONTEND-054-AC-03 [AUTO]
**Statement**: The chosen view mode shall persist to `localStorage` under the key
`seriesListViewMode`, read once on mount (defaulting to `'expanded'` when unset, unreadable, or an
unrecognized value) and written on every change. A `localStorage` read or write failure shall
degrade silently — no error surfaced to the user, defaulting to `'expanded'` on a read failure.

**Test Case (Red)**:
```typescript
it('FRONTEND-054-AC-03: persists and restores the view mode via localStorage', async () => {
  localStorage.setItem('seriesListViewMode', 'compact')
  render(<SeriesList {...defaultProps} />)
  expect(await screen.findByTestId('view-mode-compact-btn')).toHaveAttribute('aria-pressed', 'true')

  fireEvent.click(screen.getByTestId('view-mode-expanded-btn'))
  expect(localStorage.getItem('seriesListViewMode')).toBe('expanded')
})

it('FRONTEND-054-AC-03: a localStorage read failure defaults to expanded without throwing', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  expect(() => render(<SeriesList {...defaultProps} />)).not.toThrow()
})
```
**Test Case (Green)**: a lazy `useState` initializer reading `localStorage`, wrapped in
`try/catch`; a `useEffect` writing on `viewMode` change, also wrapped in `try/catch`.

---

## Requirement 2: Compact card rendering

**User story**: As a user, I want a dense, no-clutter card per series — poster, title, my rating —
that I can click straight through to the full detail page.

### FRONTEND-054-AC-04 [AUTO]
**Statement**: In compact mode, `series` shall render as a responsive CSS Grid
(`repeat(auto-fit, minmax(...))`) of cards (`data-testid="compact-series-card"`), each showing the
poster, `"{title} ({year})"`, and a read-only `<StarRating value={s.personalRating} />` — no status
text, no New Content badge, no Excluded From Recommendations badge, and no Edit/Delete/rewatch
actions.

**Test Case (Red)**:
```typescript
it('FRONTEND-054-AC-04: compact card shows only poster, title/year, and rating', async () => {
  mockGetAll.mockResolvedValue([makeSeries({ title: 'Ozark', year: 2017, personalRating: 4, newContentDetectedAt: new Date().toISOString() })])
  render(<SeriesList {...defaultProps} />)
  fireEvent.click(await screen.findByTestId('view-mode-compact-btn'))

  const card = await screen.findByTestId('compact-series-card')
  expect(within(card).getByText('Ozark (2017)')).toBeInTheDocument()
  expect(within(card).getByLabelText('Personal rating')).toBeInTheDocument()
  expect(within(card).queryByTestId('new-content-badge')).not.toBeInTheDocument()
  expect(within(card).queryByTestId('edit-series-btn')).not.toBeInTheDocument()
})
```
**Test Case (Green)**: new `SeriesCompactGrid.tsx` component (or an inline block in `SeriesList.tsx`)
rendering one card per series, reusing `StarRating` unchanged.

---

### FRONTEND-054-AC-05 [AUTO]
**Statement**: Each compact card shall be a single `<button>` with `aria-label="View details for
{title} ({year})"`, calling the same navigation `onSeriesClick`/`handleRowClick` the expanded view's
title button already calls. The poster `<img>` inside shall have `alt=""`.

**Test Case (Red)**:
```typescript
it('FRONTEND-054-AC-05: compact card navigates to SeriesDetail via an accessible button', async () => {
  const onSeriesClick = vi.fn()
  mockGetAll.mockResolvedValue([makeSeries({ id: 's1', title: 'Ozark', year: 2017 })])
  render(<SeriesList {...defaultProps} onSeriesClick={onSeriesClick} />)
  fireEvent.click(await screen.findByTestId('view-mode-compact-btn'))

  fireEvent.click(screen.getByRole('button', { name: 'View details for Ozark (2017)' }))
  expect(onSeriesClick).toHaveBeenCalledWith('s1')
})
```
**Test Case (Green)**: the compact card's root element is a `<button type="button">`, not a `div`
with `role="button"` — no nested interactive elements exist inside it to conflict with, matching
`frontend_spec_008`'s established resolution.

---

### FRONTEND-054-AC-06 [AUTO] (regression guard)
**Statement**: Compact and expanded views shall always render the same set of series for the same
underlying `series` state — switching view mode never changes which series are shown, only how.

**Test Case (Red)**:
```typescript
it('FRONTEND-054-AC-06: both views show the same series for the same data', async () => {
  mockGetAll.mockResolvedValue([makeSeries({ title: 'A' }), makeSeries({ title: 'B' })])
  render(<SeriesList {...defaultProps} />)
  await screen.findAllByTestId('series-row')

  fireEvent.click(screen.getByTestId('view-mode-compact-btn'))
  const cards = await screen.findAllByTestId('compact-series-card')
  expect(cards).toHaveLength(2)
})
```
**Test Case (Green)**: both render paths map over the exact same `series` state array — no
duplicated or diverging filtering logic between the two.

---

## Cross-References

| This spec | Source |
|---|---|
| Nested-interactive-controls lesson this spec's card button reuses | `frontend_spec_008_accessible_row_interactions.md` |
| `StarRating`, reused unchanged, read-only | `frontend_spec_013_star_ratings.md` |
| `excludeFromRecommendations` badge this spec deliberately omits from compact cards | `frontend_spec_050_exclude_from_recommendations_ui.md` |
| `repeat(auto-fit, minmax(...))` grid idiom precedent | `SearchFilter.module.css`, `RecommendationControls.module.css`, `SeriesDetail.module.css` |
| First `localStorage`-persisted UI preference — precedent for a future implementer | `.claude/ideas/future_ideas.md` ("Light/dark mode toggle") |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-054-AC-01: the icon Expanded/Compact toggle renders with correct `aria-pressed` state and accessible names
- [ ] FRONTEND-054-AC-02: switching view mode doesn't trigger a new fetch
- [ ] FRONTEND-054-AC-03: view mode persists to `localStorage`, degrading silently on failure
- [ ] FRONTEND-054-AC-04: compact cards show only poster/title-year/rating, no badges or actions
- [ ] FRONTEND-054-AC-05: each compact card is an accessible `<button>` navigating to `SeriesDetail`
- [ ] FRONTEND-054-AC-06: both views always render the same set of series
