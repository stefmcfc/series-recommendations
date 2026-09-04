# Frontend Spec 079: Series List Browsing Polish

**Status**: Implemented — `components/SeriesList.tsx`/`components/SeriesList.module.css` (Requirement 1), `components/SearchFilter.tsx` (Requirement 2), `components/SeriesCompactGrid.module.css`/`components/SeriesPosterGrid.module.css` (Requirement 3). AC-02/AC-05/AC-06 (`[MANUAL]`) were verified in a real browser (Chrome, via `/my-series/rewatch` with its single flagged series): Compact and Poster views both render the lone card at natural width, not stretched full-row; the tooltip renders correctly on `:hover` and on genuine keyboard `:focus-visible` (confirmed via direct `element.focus()` + `matches(':focus-visible')`, not just click-then-hover).
**Priority**: P3
**Depends on**: none
**Area**: Frontend (`components/SeriesList.tsx`, `components/SeriesList.module.css`, `components/SearchFilter.tsx`, `components/SeriesCompactGrid.module.css`, `components/SeriesPosterGrid.module.css`)

## Overview

Three small, unrelated `SeriesList`/`SearchFilter` browsing-experience fixes, bundled into one spec since they all touch the same page. First: the toolbar's icon-only buttons (sort direction, the three view-mode toggles, Filters) have no visible label, only an `aria-label` — a sighted mouse or keyboard user has to guess what each icon does. Second: the filter sheet only closes via its Close button or Escape — clicking the backdrop outside the sheet does nothing. Third: a real bug found in manual testing — `SeriesCompactGrid`/`SeriesPosterGrid` stretch a single card to fill the entire row width instead of keeping its normal card size, whenever a filtered/tabbed view (e.g. a status tab, or the new Rewatch tab) narrows the list down to fewer series than fit one row.

## Design Decisions

- **Tooltips show on hover AND keyboard focus, not hover-only.** `.claude/SPEC_CANDIDATES.md` already has a precedent decision against a hover-only tooltip elsewhere in this app (the `RecommendationControls` info-box candidate), specifically because hover-only "fails outright on touch, unreliable for keyboard/screen-reader users." That candidate is about longer explanatory disclosures and was resolved as click-to-toggle instead of a tooltip at all — a materially different, bigger UI element. This spec's tooltips are short labels restating an already-present `aria-label` (not new information), and are shown on `:focus-visible` as well as `:hover`, so the keyboard-exclusion objection that ruled out a tooltip there doesn't apply here. Screen reader users already get the label via the existing `aria-label` — this only adds a *visible* echo of it for sighted users.
- **CSS-only implementation, no native `title` attribute.** Native `title` tooltips only appear on mouse hover (not keyboard focus) in most browsers, and their timing/styling isn't controllable — exactly the gap this spec needs to close. Instead, each icon-only button gets a `data-tooltip="<label text>"` attribute (reusing the same string already passed to `aria-label`, so the two can't drift), and CSS renders it via a `::after` pseudo-element shown on `:hover`/`:focus-visible`.
- **Scope is icon-only controls**: the sort-direction toggle, the three view-mode buttons (Expanded/Compact/Poster-only), and the Filters button. "Add Series" already has a visible text label and is out of scope.
- **jsdom cannot verify real CSS-triggered visibility** (`prefers-color-scheme`/`:hover`/`:focus-visible` pseudo-classes aren't rendered — see this project's own CLAUDE.md note on jsdom's CSS limitations). The tooltip *markup* (the `data-tooltip` attribute carrying the right text) is `[AUTO]`-tested; the actual visual hover/focus appearance is `[MANUAL]`, verified in a real browser.
- **Click-outside-to-close targets `SearchFilter`'s sheet overlay specifically**, not a generic outside-click utility. The existing `sheetOverlay` div already wraps the sheet `<form>` as its only child, so a plain `onClick` on the overlay checking `event.target === event.currentTarget` is sufficient — a click lands as the overlay itself only when it hits the backdrop area outside the form, since any click on the form or its descendants reports that descendant as `event.target`, not the overlay. No ref-based outside-click detection needed.
- **The single-item grid stretch is a CSS bug, not new behavior.** `SeriesCompactGrid.module.css` and `SeriesPosterGrid.module.css` both use `grid-template-columns: repeat(auto-fit, minmax(Xrem, 1fr))`. With `auto-fit`, empty leftover tracks collapse to zero width, so a lone item's `1fr` track expands to fill the whole row. Switching `auto-fit` → `auto-fill` keeps empty tracks at their `minmax` minimum instead of collapsing them, so cards keep their natural size regardless of how many items are in the list — the standard fix for this well-known CSS Grid behavior. No other property needs to change; multi-item layouts are visually unaffected (`auto-fit`/`auto-fill` only differ when there's leftover row space).
- **This bug isn't specific to any one tab or filter** — it reproduces on any view (a status tab, the Rewatch tab, an active search) that narrows the list to fewer series than fit one row, in either Compact or Poster view. List (Expanded) view is unaffected since it isn't a CSS grid.

## Requirements

### Requirement 1: Visible tooltips on icon-only toolbar buttons

**User Story**: As a user on desktop, I want to hover or focus a toolbar icon and see what it does, without guessing from the icon alone.

#### FRONTEND-079-AC-01 [AUTO]: Icon-only buttons carry a tooltip label
**Statement**: The sort-direction, Expanded view, Compact view, Poster-only view, and Filters buttons in `SeriesList`'s toolbar shall each carry a `data-tooltip` attribute whose value matches that button's `aria-label`.

**Rationale**: A single source of truth for the label text — the visible tooltip can't drift from the accessible name.

**References**:
- Component: `components/SeriesList.tsx` (`sortDirectionButton` ~line 353, `viewModeButton`×3 ~lines 365-432, `filtersButton` ~line 435)

**Test Case (Red)**:
```typescript
describe('FRONTEND-079-AC-01: icon buttons carry a tooltip label', () => {
  it('sets data-tooltip to match aria-label on each icon-only toolbar button', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList onAddClick={vi.fn()} onEditClick={vi.fn()} onSeriesClick={vi.fn()} />)
    await screen.findByTestId('series-list')

    const compactButton = screen.getByRole('button', { name: 'Compact view' })
    expect(compactButton).toHaveAttribute('data-tooltip', 'Compact view')

    const filtersButton = screen.getByRole('button', { name: 'Filters' })
    expect(filtersButton).toHaveAttribute('data-tooltip', 'Filters')
  })
})
```

**Test Case (Green)**: add `data-tooltip={...}` alongside each button's existing `aria-label`, same string.

#### FRONTEND-079-AC-02 [MANUAL]: Tooltip is visible on hover and on keyboard focus
**Statement**: While an icon-only toolbar button is hovered or holds keyboard focus, `SeriesList` shall visually display that button's tooltip text near the button.

**Rationale**: The actual point of the feature — a visible label, reachable without a mouse.

**Verification**: manual browser check — hover each of the five icon buttons with a mouse and confirm the tooltip appears; then `Tab` to each one and confirm the same tooltip appears on focus. jsdom does not render `:hover`/`:focus-visible`-triggered CSS, so this can't be asserted by Vitest — see this spec's Design Decisions.

**Test Case (Green)**: CSS `::after` on `[data-tooltip]`, `content: attr(data-tooltip)`, shown via `opacity`/`visibility` on `:hover` and `:focus-visible`.

### Requirement 2: Click outside closes the filter sheet

**User Story**: As a user, I want clicking away from the open filter sheet to close it, the way most slide-out panels behave.

#### FRONTEND-079-AC-03 [AUTO]: Clicking the sheet backdrop closes it
**Statement**: When a click occurs on the filter sheet's overlay outside the sheet panel itself, `SearchFilter` shall call `onClose`.

**Rationale**: The explicit request — today only the Close button and Escape work.

**References**:
- Component: `components/SearchFilter.tsx` (`sheetOverlay` div, line ~185)

**Test Case (Red)**:
```typescript
describe('FRONTEND-079-AC-03: clicking the backdrop closes the sheet', () => {
  it('calls onClose when the overlay itself is clicked', () => {
    const onClose = vi.fn()
    render(<SearchFilter isOpen={true} onClose={onClose} onSearch={vi.fn()} onClear={vi.fn()} />)

    fireEvent.click(screen.getByRole('dialog'))

    expect(onClose).toHaveBeenCalled()
  })
})
```

**Test Case (Green)**: `onClick={(e) => { if (e.target === e.currentTarget) onClose() }}` on `sheetOverlay`.

#### FRONTEND-079-AC-04 [AUTO]: Clicking inside the sheet does not close it
**Statement**: If a click occurs on an element inside the sheet panel, then `SearchFilter` shall not call `onClose` as a result of that click.

**Rationale**: Regression guard — interacting with a field or the sheet's own heading must not be treated as an outside click.

**Test Case (Red)**:
```typescript
describe('FRONTEND-079-AC-04: clicking inside the sheet does not close it', () => {
  it('does not call onClose when a field inside the sheet is clicked', () => {
    const onClose = vi.fn()
    render(<SearchFilter isOpen={true} onClose={onClose} onSearch={vi.fn()} onClear={vi.fn()} />)

    fireEvent.click(screen.getByText('Filters'))

    expect(onClose).not.toHaveBeenCalled()
  })
})
```

**Test Case (Green)**: the `event.target === event.currentTarget` guard in AC-03's handler already satisfies this — no separate code path needed, but the regression test stays explicit.

### Requirement 3: Single-item Compact/Poster grid no longer stretches full width

**User Story**: As a user viewing a narrowed-down list (e.g. the Rewatch tab with one flagged series) in Compact or Poster view, I want the card to render at its normal size, not stretched across the whole page.

#### FRONTEND-079-AC-05 [MANUAL]: Compact view keeps natural card width with few items
**Statement**: While `SeriesCompactGrid` renders fewer series than fit one row, its card(s) shall render at their natural minimum card width rather than stretching to fill the row.

**Rationale**: The bug reported in manual testing — reproduced on `/my-series/rewatch` with a single flagged series.

**References**:
- Style: `components/SeriesCompactGrid.module.css` (`.grid`, line 6 — `auto-fit` → `auto-fill`)

**Verification**: manual browser check — navigate to a tab/filter with exactly one matching series in Compact view, on a viewport wide enough to leave empty row space, and confirm the card renders at its normal (~10rem) width rather than stretching. jsdom does not lay out CSS Grid, so track sizing can't be asserted by Vitest.

**Test Case (Green)**: change `grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr))` to `repeat(auto-fill, minmax(10rem, 1fr))`.

#### FRONTEND-079-AC-06 [MANUAL]: Poster view keeps natural card width with few items
**Statement**: While `SeriesPosterGrid` renders fewer series than fit one row, its card(s) shall render at their natural minimum card width rather than stretching to fill the row.

**Rationale**: Same bug, same root cause, in the sibling poster-only view.

**References**:
- Style: `components/SeriesPosterGrid.module.css` (`.grid`, line 6 — `auto-fit` → `auto-fill`)

**Verification**: same as AC-05, for Poster-only view.

**Test Case (Green)**: change `grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr))` to `repeat(auto-fill, minmax(6rem, 1fr))`.

## Cross-References

| Concept | Location |
|---|---|
| Precedent against hover-only tooltips (different case, distinguished above) | `.claude/SPEC_CANDIDATES.md`, "Info/disclosure boxes..." candidate |
| jsdom cannot render real CSS (`:hover`, grid layout, `prefers-color-scheme`) | `CLAUDE.md`, "Frontend: Vitest/jsdom can't validate real CSS rendering" |
| View-mode grids' origin spec | `frontend_spec_054_series_list_compact_view.md` |
| Filter sheet itself | `frontend_spec_071_my_series_filter_sheet.md` |

## Acceptance Criteria Summary

- [x] FRONTEND-079-AC-01: Icon-only buttons carry a tooltip label
- [x] FRONTEND-079-AC-02: Tooltip is visible on hover and on keyboard focus — confirmed in a real browser: visible on mouse hover, and on genuine `:focus-visible` (verified via `element.focus()` + `matches(':focus-visible')`, not just a mouse click).
- [x] FRONTEND-079-AC-03: Clicking the sheet backdrop closes it
- [x] FRONTEND-079-AC-04: Clicking inside the sheet does not close it
- [x] FRONTEND-079-AC-05: Compact view keeps natural card width with few items — confirmed in a real browser on `/my-series/rewatch` (single flagged series): card renders at natural width, not stretched.
- [x] FRONTEND-079-AC-06: Poster view keeps natural card width with few items — confirmed in a real browser on `/my-series/rewatch`, same as AC-05.
