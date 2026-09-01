# Frontend Spec 071: My Series Filter Sheet

**Status**: Not started
**Priority**: P3
**Depends on**: Frontend Spec 055 (`frontend_spec_055_search_filter_overhaul.md`, owns the
`SearchFilter` fields and inline disclosure this spec relocates and supersedes) ✅ required
**Area**: Frontend (`components/SearchFilter.tsx`, `components/SeriesList.tsx`, `App.tsx`'s
`MySeriesView`)

## Overview

`SearchFilter`'s panel has grown to 8 fields (Title, Genres, Keywords, Min Personal/IMDb/TMDB
Rating, Min/Max Year, Flagged for rewatch) and, even with `frontend_spec_055`'s show/hide
disclosure, still pushes the My Series page down whenever it's opened. This is the remaining open
half of `.claude/ideas/future_ideas.md`'s "Redo cluttered filter panels as a collapsible left-hand
panel or slide-out sheet" entry (the "collapsible" half was resolved by `frontend_spec_055`; the
"dedicated left-hand panel or slide-out sheet" layout question was explicitly left for later).

This spec replaces `SearchFilter`'s inline collapsible panel with a slide-out sheet, opened via a
new funnel icon placed next to `SeriesList`'s existing view-mode icons (expanded/compact/poster).
The sheet reuses this app's existing dialog a11y pattern (`role="dialog"`, `aria-modal`, Escape-to-
close) — same semantics already shipped for `AddSeriesForm`/`EditSeriesForm`/the "Browse all
keywords" modal, just presented as a slide-in panel rather than a centered overlay.

Scoped to `SearchFilter`/My Series only. `RecommendationControls`' equivalent filter panel is the
same underlying idea but is explicitly out of scope here — a separate future spec if wanted.

## Design Decisions

- **Sheet, not a modal, and not user-configurable.** Confirmed choice: a slide-out sheet (not a
  centered modal), with no settings toggle to switch between the two. A11y cost is identical either
  way (same dialog semantics); the sheet keeps the series list visible at the edge and suits a
  growing field list better than a centered box that keeps growing taller.
- **Trigger lives in `SeriesList`, not `SearchFilter`.** The funnel button sits in `SeriesList`'s
  header row as a new sibling of `div.viewModeToggle` (not merged into that button group — view mode
  is a mutually-exclusive 3-way toggle; Filters is a single button that opens a sheet, a different
  interaction, so it gets its own wrapper rather than a 4th `aria-pressed` option in that group).
- **Open/close state is lifted to `MySeriesView`** (`App.tsx`), the shared parent that already
  composes `SearchFilter` and `SeriesList` as siblings. `MySeriesView` owns `isFiltersOpen`, passing
  `isOpen`/`onClose` into `SearchFilter` and `isFiltersOpen`/`onOpenFilters`/`hasActiveFilters` into
  `SeriesList`. `hasActiveFilters` is derived from the existing `criteria` state
  (`criteria != null && Object.keys(criteria).length > 0`) — no new state needed for it.
- **Supersedes `frontend_spec_055`'s inline disclosure entirely**, not just its default. The "Show
  Filters"/"Hide Filters" toggle button and the `filtersSection`/`filtersBody` wrapper are removed
  from `SearchFilter`; `FRONTEND-055-AC-04`'s toggle button is replaced outright by the new funnel
  button living in `SeriesList`. `SearchFilter.test.tsx`'s `openFilters()` test helper (which clicks
  that now-removed button) must be updated to instead render with `isOpen` set, as part of this
  spec's implementation, not left broken.
- **Clear Filters and Search both close the sheet after acting.** Previously these two actions sat
  outside the collapsible panel and stayed visible regardless of `filtersOpen`; now they live inside
  the sheet and both close it once they run (`onSearch`/`onClear` fire, then `onClose`) — a filter
  sheet's whole point is "adjust, then get out of the way." This is a deliberate behavior change from
  today (where Search/Clear didn't require the panel to be open at all), recorded here rather than
  silently changed.
- **No new draft/revert behavior.** Closing the sheet via Escape or the close button without
  submitting does not reset or revert in-progress field edits — identical to today's behavior when
  collapsing the inline panel (field state is untouched by open/closed transitions; only Search/Clear
  change it). Not introducing a "cancel reverts to last-applied criteria" feature here — out of
  scope.
- **All 8 existing fields relocate unchanged.** No field is added, removed, or altered in behavior —
  this is a container/access-pattern change only. `frontend_spec_055`'s own ACs for individual field
  behavior (validation bounds, `StarRating`, genre picker, etc.) still hold and aren't re-tested here
  beyond a single smoke-test AC confirming nothing was dropped in the move.
- **Active-filter indicator on the funnel icon.** Since fields are no longer visible at a glance once
  tucked into a sheet, the funnel button shows a small visual indicator (a dot) and an updated
  accessible name when `hasActiveFilters` is true. Flagged as an addition beyond a strict 1:1
  relocation — worth a quick sanity check if it reads as scope creep once seen in review.

## Requirements

### Requirement 1: Funnel icon trigger in `SeriesList`

**User Story**: As a user browsing My Series, I want a quick, discoverable way to open filters
without them permanently taking up space on the page.

#### FRONTEND-071-AC-01 [AUTO]: Filters button renders next to the view-mode icons
**Statement**: `SeriesList` shall render a "Filters" button (bespoke inline SVG funnel icon,
matching the existing view-mode buttons' stroke/size/`currentColor` convention) immediately
alongside `div.viewModeToggle`, with `data-testid="open-filters-btn"` and `aria-label="Filters"`.

**Rationale**: Discoverable, consistent placement per the confirmed design (near compact/expanded/
poster view icons), using the icon convention already established in this file.

**References**:
- Component: `components/SeriesList.tsx`, `div.viewModeToggle` (lines 417-486)

**Test Case (Red)**:
```typescript
describe('FRONTEND-071-AC-01: Filters button renders', () => {
  it('renders a Filters button next to the view-mode toggle', async () => {
    mockGetAll.mockResolvedValue([])
    render(
      <SeriesList
        onSeriesClick={vi.fn()} onAddClick={vi.fn()} onEditClick={vi.fn()}
        isFiltersOpen={false} onOpenFilters={vi.fn()} hasActiveFilters={false}
      />,
    )
    expect(await screen.findByTestId('open-filters-btn')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add a new `div` sibling to `viewModeToggle` containing a single button with
a funnel `<svg>` (following the existing `aria-hidden="true"` + stroke-based convention).

#### FRONTEND-071-AC-02 [AUTO]: clicking Filters calls `onOpenFilters`
**Statement**: When the Filters button is clicked, `SeriesList` shall call its `onOpenFilters` prop.

**Rationale**: Wires the trigger to the lifted open state in `MySeriesView`.

**References**:
- Component: `components/SeriesList.tsx`

**Test Case (Red)**:
```typescript
describe('FRONTEND-071-AC-02: Filters button opens the sheet', () => {
  it('calls onOpenFilters when clicked', async () => {
    mockGetAll.mockResolvedValue([])
    const onOpenFilters = vi.fn()
    render(
      <SeriesList
        onSeriesClick={vi.fn()} onAddClick={vi.fn()} onEditClick={vi.fn()}
        isFiltersOpen={false} onOpenFilters={onOpenFilters} hasActiveFilters={false}
      />,
    )
    fireEvent.click(await screen.findByTestId('open-filters-btn'))
    expect(onOpenFilters).toHaveBeenCalledTimes(1)
  })
})
```

**Test Case (Green)**: `onClick={onOpenFilters}` on the new button; `aria-expanded={isFiltersOpen}`
reflects the passed-in prop.

#### FRONTEND-071-AC-03 [AUTO]: active-filter indicator
**Statement**: While `hasActiveFilters` is `true`, `SeriesList` shall render a visual indicator (a
`data-testid="filters-active-dot"` element) on the Filters button and its accessible name shall be
"Filters (active)"; while `false`, neither shall be present and the accessible name shall be
"Filters".

**Rationale**: Fields are no longer visible at a glance once inside a sheet — users need a way to
tell filters are applied without opening it.

**References**:
- Component: `components/SeriesList.tsx`

**Test Case (Red)**:
```typescript
describe('FRONTEND-071-AC-03: active-filter indicator', () => {
  it('shows a dot and updated label when filters are active', async () => {
    mockGetAll.mockResolvedValue([])
    render(
      <SeriesList
        onSeriesClick={vi.fn()} onAddClick={vi.fn()} onEditClick={vi.fn()}
        isFiltersOpen={false} onOpenFilters={vi.fn()} hasActiveFilters={true}
      />,
    )
    expect(await screen.findByTestId('filters-active-dot')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filters (active)' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: conditionally render the dot span and switch the `aria-label` based on
`hasActiveFilters`.

### Requirement 2: `SearchFilter` renders as an externally-controlled sheet

**User Story**: As a user, I want opening Filters to show me all the filter fields in a focused
panel, and closing it to get them out of my way again.

#### FRONTEND-071-AC-04 [AUTO]: closed sheet renders nothing
**Statement**: While the new `isOpen` prop is `false`, `SearchFilter` shall render nothing (no
inline panel, no toggle button — the previous always-rendered toggle from `frontend_spec_055` is
removed entirely).

**Rationale**: The trigger has moved to `SeriesList`; `SearchFilter` no longer needs its own
visible affordance when closed.

**References**:
- Component: `components/SearchFilter.tsx` (removes `filtersOpen` state, the toggle button, and
  `filtersSection`/`filtersBody` wrapper from `frontend_spec_055`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-071-AC-04: closed sheet renders nothing', () => {
  it('renders no dialog and no toggle button when isOpen is false', () => {
    render(<SearchFilter isOpen={false} onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show filters/i })).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: `SearchFilter` returns `null` (aside from the still-conditionally-rendered
"Browse all keywords" modal, which only ever shows while the sheet itself is open) when `!isOpen`.

#### FRONTEND-071-AC-05 [AUTO]: open sheet renders as an accessible dialog with all fields
**Statement**: While `isOpen` is `true`, `SearchFilter` shall render its fields inside a
`role="dialog" aria-modal="true" aria-labelledby="my-series-filters-heading"` container with a
"Filters" heading and a close control; pressing Escape or clicking the close control shall call
`onClose`.

**Rationale**: Reuses the exact dialog a11y pattern already shipped elsewhere (`AddSeriesForm`,
`EditSeriesForm`, the Keywords-browse modal) rather than inventing a new one — Escape-to-close via
an `onKeyDown` handler on the dialog root, no focus trap, matching convention exactly.

**References**:
- Pattern: `components/AddSeriesForm.tsx`, `components/SearchFilter.tsx`'s existing
  "Browse all keywords" modal (`role="dialog"`/`aria-modal`/`onKeyDown` Escape handling)

**Test Case (Red)**:
```typescript
describe('FRONTEND-071-AC-05: open sheet is an accessible dialog', () => {
  it('renders a labelled dialog and closes on Escape', () => {
    const onClose = vi.fn()
    render(<SearchFilter isOpen={true} onClose={onClose} onSearch={vi.fn()} onClear={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: /filters/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the close control is clicked', () => {
    const onClose = vi.fn()
    render(<SearchFilter isOpen={true} onClose={onClose} onSearch={vi.fn()} onClear={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

**Test Case (Green)**: wrap the existing field markup in a `role="dialog"` sheet container (new
`.sheetOverlay`/`.sheet` CSS classes, visually a slide-in panel rather than a centered box); add a
heading `<h2 id="my-series-filters-heading">Filters</h2>` with an adjacent close button; wire
`onKeyDown` for Escape, matching the existing `handleModalKeyDown` pattern.

#### FRONTEND-071-AC-06 [AUTO]: Search applies criteria and closes the sheet
**Statement**: When the Search button is clicked (or the form submitted), `SearchFilter` shall call
`onSearch` with the built criteria, then call `onClose`.

**Rationale**: A filter sheet's job is to apply and get out of the way.

**References**:
- Function: `components/SearchFilter.tsx`, `handleSubmit`/`buildCriteria` (unchanged logic)

**Test Case (Red)**:
```typescript
describe('FRONTEND-071-AC-06: Search applies and closes', () => {
  it('calls onSearch then onClose on submit', () => {
    const onSearch = vi.fn()
    const onClose = vi.fn()
    render(<SearchFilter isOpen={true} onClose={onClose} onSearch={onSearch} onClear={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'office' } })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ title: 'office' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

**Test Case (Green)**: `handleSubmit` calls `onSearch(buildCriteria(form))` (unchanged) followed by
`onClose()`.

#### FRONTEND-071-AC-07 [AUTO]: Clear Filters resets and closes the sheet
**Statement**: When Clear Filters is clicked, `SearchFilter` shall reset its form to
`initialFormState`, call `onClear`, then call `onClose`.

**Rationale**: Same close-after-acting behavior as Search, for consistency.

**References**:
- Function: `components/SearchFilter.tsx`, `handleClear` (unchanged reset logic)

**Test Case (Red)**:
```typescript
describe('FRONTEND-071-AC-07: Clear Filters resets and closes', () => {
  it('calls onClear then onClose', () => {
    const onClear = vi.fn()
    const onClose = vi.fn()
    render(<SearchFilter isOpen={true} onClose={onClose} onSearch={vi.fn()} onClear={onClear} />)

    fireEvent.click(screen.getByTestId('clear-filters-btn'))

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

**Test Case (Green)**: `handleClear` calls `setForm(initialFormState)`, `onClear()`, then
`onClose()`.

#### FRONTEND-071-AC-08 [AUTO]: all existing fields still render inside the sheet
**Statement**: While `isOpen` is `true`, `SearchFilter` shall render every field it rendered before
this spec (Title, Genres, Keywords, Min Personal/IMDb/TMDB Rating, Min/Max Year, Flagged for
rewatch) — a relocation smoke test guarding against a dropped field.

**Rationale**: This spec relocates the panel; it must not silently lose a field in the process.

**References**:
- Related: `frontend_spec_055_search_filter_overhaul.md` (owns each field's own individual
  behavior/tests, unchanged and not re-verified here)

**Test Case (Red)**:
```typescript
describe('FRONTEND-071-AC-08: all fields still present', () => {
  it('renders every pre-existing field when open', () => {
    render(<SearchFilter isOpen={true} onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)
    for (const label of [/title/i, /min imdb rating/i, /min tmdb rating/i, /min year/i, /max year/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('Min Personal Rating')).toBeInTheDocument()
    expect(screen.getByLabelText(/flagged for rewatch/i)).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: no change to field JSX beyond moving it inside the new dialog container.

### Requirement 3: Composition wiring in `MySeriesView`

**User Story**: As a developer, I need the trigger (in `SeriesList`) and the panel (in
`SearchFilter`) — two sibling components — to share one open/closed state.

#### FRONTEND-071-AC-09 [AUTO]: `MySeriesView` lifts and wires filter-sheet state
**Statement**: `MySeriesView` shall own `isFiltersOpen` state, passing `isOpen={isFiltersOpen}`/
`onClose={() => setIsFiltersOpen(false)}` into `SearchFilter`, and
`isFiltersOpen={isFiltersOpen}`/`onOpenFilters={() => setIsFiltersOpen(true)}`/
`hasActiveFilters={criteria != null && Object.keys(criteria).length > 0}` into `SeriesList`.

**Rationale**: `SearchFilter` and `SeriesList` are composed as siblings in `MySeriesView`
(`App.tsx`, lines 104-112) — this is the minimal state-lifting needed to connect them.

**References**:
- Component: `App.tsx`, `MySeriesView` (lines 66-115)

**Test Case (Red)**:
```typescript
describe('FRONTEND-071-AC-09: opening Filters from SeriesList shows the sheet', () => {
  it('opens the SearchFilter sheet when the Filters button is clicked', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.click(screen.getByTestId('open-filters-btn'))

    expect(await screen.findByRole('dialog', { name: /filters/i })).toBeInTheDocument()
  })

  it('closes the sheet and reflects an active filter after a search', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetGenreOptions.mockResolvedValue([])
    mockGetKeywordStats.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.click(screen.getByTestId('open-filters-btn'))
    fireEvent.change(await screen.findByLabelText(/title/i), { target: { value: 'office' } })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(screen.queryByRole('dialog', { name: /filters/i })).not.toBeInTheDocument()
    expect(await screen.findByTestId('filters-active-dot')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `const [isFiltersOpen, setIsFiltersOpen] = useState(false)` to
`MySeriesView`; pass the props above to `SearchFilter`/`SeriesList` at their existing call sites
(lines 104/106-112).

## Cross-References

| Concept | Location |
|---|---|
| Fields and their individual behavior (unchanged) | `frontend_spec_055_search_filter_overhaul.md` |
| Inline disclosure this spec removes/supersedes | `frontend_spec_055_search_filter_overhaul.md` (`FRONTEND-055-AC-04`) |
| Dialog a11y pattern reused | `components/AddSeriesForm.tsx`, `SearchFilter.tsx`'s existing "Browse all keywords" modal |
| View-mode icon convention matched | `components/SeriesList.tsx`, `div.viewModeToggle` (lines 417-486) |
| Composition point | `App.tsx`, `MySeriesView` (lines 66-115) |
| Originating idea | `.claude/ideas/future_ideas.md`, Navigation section, "Redo cluttered filter panels as a collapsible left-hand panel or slide-out sheet" |

## Acceptance Criteria Summary

- [ ] FRONTEND-071-AC-01: Filters button renders next to the view-mode icons
- [ ] FRONTEND-071-AC-02: clicking Filters calls `onOpenFilters`
- [ ] FRONTEND-071-AC-03: active-filter indicator (dot + accessible name) reflects `hasActiveFilters`
- [ ] FRONTEND-071-AC-04: closed sheet renders nothing
- [ ] FRONTEND-071-AC-05: open sheet renders as an accessible dialog, closes on Escape/close control
- [ ] FRONTEND-071-AC-06: Search applies criteria and closes the sheet
- [ ] FRONTEND-071-AC-07: Clear Filters resets and closes the sheet
- [ ] FRONTEND-071-AC-08: all pre-existing fields still render inside the sheet
- [ ] FRONTEND-071-AC-09: `MySeriesView` lifts and wires filter-sheet state between the two components
