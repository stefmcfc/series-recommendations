# Frontend Spec 134: Recommendation Filter Sheets

**Status**: Not yet implemented
**Priority**: P3
**Depends on**:
- `frontend_spec_071_my_series_filter_sheet.md` (direct precedent for slide-out sheet dialog semantics — `role="dialog"`/`aria-modal`/Escape-to-close/backdrop-click) ✅ implemented
- `frontend_spec_123_filter_layout_and_collapsible_sections.md` (owns `CollapsibleSection`, the toggle+badge+conditional-body component this spec adopts inside both new sheets) ✅ implemented
- `frontend_spec_081_use_my_series_page_restructure.md` (owns `UseMySeriesPanel`'s "Filter My Series" fields/layout this spec relocates) ✅ implemented
- `frontend_spec_132_source_ranking_strategy_and_custom_blend.md` (owns the "Source Ranking Strategy" disclosure this spec deliberately leaves untouched) ✅ implemented
**Area**: Frontend (`components/RecommendationFiltersBox.tsx`, `components/UseMySeriesPanel.tsx`, their shared `RecommendationControls.module.css`)

## Overview

`RecommendationFiltersBox`'s "Recommendations Filters" panel (8 fields) and `UseMySeriesPanel`'s
"Filter My Series" panel (13 fields across Status/Sort/Genre/Keyword/Country/Language/five rating-
and-year fields) are both today's original always-in-flow inline disclosures — clicking either
toggle pushes the rest of the "Use My Series" tab down the page, and neither panel currently groups
its own fields into any further substructure. This is the second and final half of
`.claude/ideas/future_ideas.md`'s "Redo cluttered filter panels as a collapsible left-hand panel or
slide-out sheet" entry; the first half (`SearchFilter`/My Series) was resolved by
`frontend_spec_071`, which explicitly left `RecommendationControls`' equivalent panel(s) for a
later spec.

This spec converts both panels into slide-out sheets, reusing `frontend_spec_071`'s established
sheet pattern (`role="dialog"`, `aria-modal`, Escape-to-close, backdrop-click-to-close), and groups
each sheet's fields into `CollapsibleSection` subsections — the same component `SearchFilter.tsx`
already uses for its own 5 sections, but which `CollapsibleSection.tsx`'s own inline comment notes
neither `RecommendationFiltersBox.tsx` nor `UseMySeriesPanel.tsx` has adopted yet. Unlike
`frontend_spec_071` (where the trigger lived in a sibling component, `SeriesList`, and its open
state had to be lifted to a shared parent), both triggers here stay exactly where they already are
— inside the same component that owns the fields — so no state-lifting is needed; only how the
already-open/closed state renders its body changes.

A wizard/step-by-step redesign of the wider "Use My Series" page was explicitly considered and
rejected for this work (see `.claude/ideas/future_ideas.md`'s "'Use My Series' as a step-by-step
wizard" entry, 2026-09-03) — this spec is sheets only, no step scaffolding.

## Design Decisions

- **Trigger stays in place, in the same component.** Unlike `frontend_spec_071`'s `SeriesList`/
  `SearchFilter` split, `RecommendationFiltersBox`'s "Recommendations Filters" button and
  `UseMySeriesPanel`'s "Filter My Series" button already sit in the same component as the fields
  they disclose. No new prop plumbing or lifted state is needed — `filtersOpen`/`filterSectionOpen`
  (both already exist) keep meaning "is the panel open," they just now gate a sheet overlay instead
  of an inline `filtersBody` div. `RecommendationsList` (the results) isn't always mounted (only
  after "Get Recommendations" runs) and was considered as a possible trigger-host component to
  mirror `SeriesList`'s role, but rejected for the same reason: it isn't a reliable, always-visible
  sibling the way `SeriesList` is on the My Series page.
- **"Source Ranking Strategy" stays exactly where it is, untouched.** Per the explicit ask this
  session, it remains its own small, always-visible (non-sheet) inline disclosure between the new
  "Filter My Series" sheet trigger and the section divider/Series picker — unchanged DOM position,
  unchanged hand-rolled toggle/body markup. It's a single 3-option radiogroup (plus a conditional
  `RatingSourceChips` picker), not a multi-field filter panel that benefits from being tucked away;
  tucking it into a sheet too would hide a control that's cheap to glance at and cheap to leave
  visible. This spec introduces no ACs against it — it's included in Requirement 5's DOM-order
  regression guard only.
- **No mutual exclusivity between the two sheets.** `filtersOpen` and `filterSectionOpen` remain two
  fully independent booleans, exactly as their inline-disclosure predecessors were (both panels
  could already be expanded simultaneously before this spec). If a user opens both sheets in
  sequence without closing the first, both overlays render — an edge case, not addressed here; a
  follow-up polish item if it proves confusing in practice, not a blocker for this spec.
- **Active-filter indicator: added for "Filter My Series," reused unchanged for "Recommendations
  Filters."** `RecommendationFiltersBox` already has `countActiveFilters` and a numeric badge on its
  toggle (`FRONTEND-098`/`FRONTEND-094` era) — kept as-is, just now also visible while the sheet is
  closed the same way it always was. `UseMySeriesPanel` has no equivalent today. Decision: add one
  (`countActiveUseMySeriesFilters`), for the same reason `frontend_spec_071-AC-03` added one for
  `SearchFilter` — once fields are tucked into a sheet, there's no other at-a-glance signal that a
  filter is active. It counts every field that narrows the source-series pool (Genre/Exclude
  Genre/Keywords/Country/Language/five rating fields/Year Min/Year Max, plus Status when not its
  `'any'` default) — never `sortBy`/`sortDirection`, which aren't filters.
- **What "closes the sheet" means here, since neither panel has a per-panel "Apply"/"Search"
  concept.** Both panels' fields flow live into `ControlsState`/local `useState` and only ever reach
  the backend via the page's single "Get Recommendations" button (`frontend_spec_040`'s Apply
  Filters gate) — unlike `SearchFilter`, which has its own explicit "Search" submit that
  `frontend_spec_071-AC-06` closes the sheet on. There is no equivalent "Search closes it" moment
  here. What does close each sheet:
  - The Close (X) control (primary, always-available dismissal) — new to both panels.
  - Escape, and clicking the overlay backdrop — matching `frontend_spec_071`/`frontend_spec_079`'s
    established sheet-dismissal conventions exactly.
  - The existing Reset/Clear Filters button inside each sheet (`handleResetFilters`/
    `handleClearSpecificSeriesFilters`, both unchanged) — mirrors `frontend_spec_071-AC-07`'s "Clear
    Filters" closing the sheet after acting.
  - Individual field edits (typing a rating, picking a genre, toggling Status) do **not** close
    either sheet — there's nothing to "submit" per field; a user adjusting several fields in one
    visit needs the sheet to stay open across each edit, unlike `SearchFilter`'s one-shot Search
    action.
- **New sheet CSS lives in `RecommendationControls.module.css`, shared by both files.** Both
  `RecommendationFiltersBox.tsx` and `UseMySeriesPanel.tsx` already import `styles` from that one
  shared module — new `.sheetOverlay`/`.sheet`/`.sheetHeader`/`.sheetHeading`/`.closeButton`/
  `.filterSectionBody`/`.filterSectionHeading` classes are added there, mirroring
  `SearchFilter.module.css`'s equivalent shapes rather than inventing a third divergent set. The
  pre-existing `.overlay`/`.dialog` classes in this same module (the centered "Browse Series"/
  "Browse all keywords" modals) are untouched and keep their own distinct, non-sheet presentation —
  same two-patterns-coexisting shape `SearchFilter.module.css` already has.
- **Focus moves to the Close control when either sheet opens**, mirroring `SearchFilter.tsx`'s
  `closeButtonRef`/`useEffect` pattern exactly — without it, focus stays on the trigger button, and
  since (unlike `frontend_spec_071`) the trigger is a DOM ancestor-adjacent sibling within the same
  render tree here too, an immediate real keyboard Escape still needs a focus target inside the
  dialog for the Escape handler (attached to the dialog root) to reliably receive it via bubbling
  once other interactive content is focused first.
- **Field groupings** (confirmed against the current source, not assumed):
  - **"Recommendations Filters"** (`RecommendationFiltersBox.tsx`) — 4 sections:
    - *Rating & Votes*: Min TMDB Rating (hidden while Custom Search), Min Vote Count (always)
    - *Genre & Keyword*: Exclude Genres (hidden while Custom Search), Exclude Keywords (always)
    - *Country & Language*: Countries, Language (both hidden while Custom Search)
    - *Year*: Year Min, Year Max (both hidden while Custom Search)
  - **"Filter My Series"** (`UseMySeriesPanel.tsx`) — 5 sections:
    - *Status & Sort*: Filter by Status radios, Sort by select + direction toggle, the missing-
      rating notice
    - *Genre & Keyword*: Include/Exclude Genres picker, Keywords picker + "Browse all keywords"
    - *Country & Language*: Country picker, Language picker
    - *Ratings*: Min Personal/IMDb/TMDB Rating (My Series), Min Tomatometer/Popcornmeter Rating
    - *Year*: Year Min/Max (My Series)
  - `SavedFiltersList`/`FilterProfileActions` keep their existing top/bottom positions inside each
    sheet's body, outside any `CollapsibleSection` — unchanged, matching `SearchFilter.tsx`'s own
    placement of the same two components relative to its `CollapsibleSection`s.
- **Each sheet gets a one-line explanatory intro, confirming the pre-rec/post-rec distinction these
  two panels have always had but never stated out loud.** "Filter My Series" narrows the pool of the
  user's own tracked series *before* they're used to source TMDB candidates; "Recommendations
  Filters" narrows the resulting TMDB *output* after sourcing. Both panels already enforce this split
  in behavior (`PoolCacheKey`'s own doc comment lists exactly this: `sortBy`/`excludeGenres`/
  `excludeKeywords`/`minTmdbRating`/etc are deliberately excluded from the sourcing cache key because
  they're "applied strictly after sourcing"), but nothing in the UI ever explained it — a new user
  has no way to know why two differently-scoped filter panels exist at all. Fixed copy, directly
  below each sheet's heading, above `SavedFiltersList`/the first `CollapsibleSection`:
  - "Filter My Series": *"Filter the series that you want to use for recommendations before
    selecting them."*
  - "Recommendations Filters": *"Filter the recommendations to only show series you want to see."*

## Requirements

### Requirement 1: "Recommendations Filters" opens as a slide-out sheet

**User Story**: As a user setting up a recommendation query, I want the Recommendations Filters
panel tucked away until I open it, instead of permanently pushing the rest of the page down once
expanded.

#### FRONTEND-134-AC-01 [AUTO]: closed state is unchanged
**Statement**: While `filtersOpen` is `false`, `RecommendationFiltersBox` shall render only its
"Recommendations Filters" toggle button (carrying its existing `activeFilterCount` badge) — no
sheet, no inline `filtersBody`, present in the document.

**Rationale**: Regression guard — the collapsed appearance must not change, only what happens on
open.

**References**:
- Component: `components/RecommendationFiltersBox.tsx`, lines 188-208 (toggle, unchanged), 43-71
  (`countActiveFilters`, unchanged)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-01: closed state unchanged', () => {
  it('renders only the toggle button while closed', () => {
    renderBox()
    expect(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: no change to the toggle button's own markup; the conditional block it gates
is what changes (AC-02).

#### FRONTEND-134-AC-02 [AUTO]: opening renders an accessible sheet dialog
**Statement**: When the "Recommendations Filters" toggle button is clicked while `filtersOpen` is
`false`, `RecommendationFiltersBox` shall render its fields inside a
`role="dialog" aria-modal="true" aria-labelledby="recommendation-filters-sheet-heading"` sheet
container (a "Recommendations Filters" heading plus a Close control), replacing the former inline
expand.

**Rationale**: Reuses the exact dialog a11y pattern `frontend_spec_071` already shipped for
`SearchFilter`, presented as a slide-in panel per this spec's Design Decisions, rather than
inventing a second shape.

**References**:
- Pattern: `components/SearchFilter.tsx`, lines 418-449 (`.sheetOverlay`/`.sheet`/`.sheetHeader`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-02: opens as an accessible dialog', () => {
  it('renders a labelled dialog when the toggle is clicked', () => {
    renderBox()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    const dialog = screen.getByRole('dialog', { name: /recommendations filters/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})
```

**Test Case (Green)**: wrap the existing field markup (still gated by `filtersOpen`) in the new
sheet container with heading + Close button, replacing the plain `filtersBody` div.

#### FRONTEND-134-AC-03 [AUTO]: focus moves into the sheet on open
**Statement**: When the sheet opens, `RecommendationFiltersBox` shall move focus to its Close
control.

**Rationale**: Matches `SearchFilter.tsx`'s established `closeButtonRef`/`useEffect` pattern —
without it, focus stays on the trigger and a real Escape keypress relies on the dialog root's own
`onKeyDown`, which this AC's sibling (AC-04) still covers independently, but focus movement is
itself the accessible, expected dialog-open behavior.

**References**:
- Pattern: `components/SearchFilter.tsx`, lines 270-286 (`closeButtonRef`, the `isOpen` effect)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-03: focus moves to Close on open', () => {
  it('focuses the Close button once the sheet opens', () => {
    renderBox()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus()
  })
})
```

**Test Case (Green)**: a `closeButtonRef` + `useEffect` keyed on `filtersOpen`, calling
`.focus()` when it becomes `true`.

#### FRONTEND-134-AC-04 [AUTO]: Escape, Close, and backdrop all close the sheet
**Statement**: When Escape is pressed, the Close control is clicked, or the overlay backdrop is
clicked while the sheet is open, `RecommendationFiltersBox` shall close it (`filtersOpen` becomes
`false`).

**Rationale**: Matches `frontend_spec_071-AC-05`'s Escape/Close convention and
`frontend_spec_079`'s backdrop-click convention exactly — no new dismissal pattern introduced.

**References**:
- Hook: `hooks/useEscapeToClose.ts`
- Pattern: `components/SearchFilter.tsx`, lines 427-433 (backdrop-click guard)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-04: Escape/Close/backdrop close the sheet', () => {
  it('closes on Escape', () => {
    renderBox()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the Close control is clicked', () => {
    renderBox()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', () => {
    renderBox()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: `useEscapeToClose(() => setFiltersOpen(false))` on the dialog root's
`onKeyDown`; the Close button's `onClick` sets `filtersOpen(false)` directly; the overlay's
`onClick` guards `e.target === e.currentTarget` before doing the same, mirroring
`SearchFilter.tsx`.

#### FRONTEND-134-AC-05 [AUTO]: Reset Filters closes the sheet after acting
**Statement**: When Reset Filters is clicked inside the sheet, `RecommendationFiltersBox` shall
run its existing `handleResetFilters` (unchanged) and then close the sheet.

**Rationale**: Mirrors `frontend_spec_071-AC-07`'s "Clear Filters resets and closes" — a filter
sheet's whole point is "adjust, then get out of the way," and Reset is this panel's one clear
"I'm done, revert everything" action even without a per-panel Search/Apply.

**References**:
- Function: `components/RecommendationFiltersBox.tsx`, lines 135-147 (`handleResetFilters`,
  unchanged)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-05: Reset Filters resets and closes', () => {
  it('resets fields and closes the sheet', () => {
    const { updateState } = renderBox({
      state: makeState({ minVoteCount: '200' }),
    })
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    fireEvent.click(screen.getByTestId('reset-filters-btn'))

    expect(updateState).toHaveBeenCalledWith(
      expect.objectContaining({ minVoteCount: '' }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: `handleResetFilters`'s body is unchanged; its `onClick` handler additionally
calls `setFiltersOpen(false)` after it runs.

### Requirement 2: "Recommendations Filters" fields group into `CollapsibleSection`s

**User Story**: As a user, I want the sheet's 8 fields grouped into a few clearly-labeled,
independently-collapsible sub-groups, matching the same pattern `SearchFilter`'s own sheet already
uses, rather than one long flat list.

#### FRONTEND-134-AC-06 [AUTO]: fields render inside four labeled subsections
**Statement**: While the sheet is open, `RecommendationFiltersBox` shall group its fields into four
`CollapsibleSection` subsections — "Rating & Votes" (Min TMDB Rating, Min Vote Count), "Genre &
Keyword" (Exclude Genres, Exclude Keywords), "Country & Language" (Countries, Language), and "Year"
(Year Min, Year Max) — each carrying its own active-count badge.

**Rationale**: Adopts `CollapsibleSection` (already built, already used this way by `SearchFilter`'s
5 sections) here for the first time, per this component's own currently-unfulfilled comment in
`CollapsibleSection.tsx`.

**References**:
- Component: `components/CollapsibleSection.tsx`
- Pattern: `components/SearchFilter.tsx`, lines 195-245 (per-section counter functions), 460-768
  (section usage)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-06: fields grouped into subsections', () => {
  it('renders four named CollapsibleSection headings', () => {
    renderBox()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    for (const name of ['Rating & Votes', 'Genre & Keyword', 'Country & Language', 'Year']) {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument()
    }
  })

  it('shows a badge on Rating & Votes once Min Vote Count is set', () => {
    renderBox({ state: makeState({ minVoteCount: '200' }) })
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    const toggle = screen.getByRole('button', { name: /rating & votes/i })
    expect(within(toggle).getByText('1')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: four `countXActive(state, isCustomSearch)` helpers (mirroring
`SearchFilter.tsx`'s per-section counters), each field's existing JSX moved as-is into its matching
`<CollapsibleSection>`.

#### FRONTEND-134-AC-07 [AUTO]: Custom-Search-hidden fields stay hidden inside their sections
**Statement**: While `isCustomSearch` is `true`, the fields already gated behind `!isCustomSearch`
(Min TMDB Rating, Exclude Genres, Countries, Language, Year Min, Year Max) shall remain absent from
their respective subsections, unchanged from today's conditional.

**Rationale**: Regression guard — grouping into subsections must not change which fields are
visible under Custom Search, only how the visible ones are organized.

**References**:
- Component: `components/RecommendationFiltersBox.tsx`, `isCustomSearch` conditionals (unchanged
  logic, relocated into subsections)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-07: Custom Search hides the same fields as before', () => {
  it('omits Min TMDB Rating, Year, Country/Language while isCustomSearch', () => {
    renderBox({ isCustomSearch: true })
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    expect(screen.queryByLabelText(/min tmdb rating/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^year min$/i)).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: no change to any `!isCustomSearch` guard, only which JSX subtree each one
now lives inside.

#### FRONTEND-134-AC-08 [AUTO]: all pre-existing fields still render (relocation smoke test)
**Statement**: While the sheet is open and `isCustomSearch` is `false`, `RecommendationFiltersBox`
shall render every field it rendered before this spec (Min TMDB Rating, Min Vote Count, Year
Min/Max, Exclude Genres, Exclude Keywords, Countries, Language).

**Rationale**: This spec relocates fields into sections; it must not silently drop one in the
process, mirroring `frontend_spec_071-AC-08`'s own relocation guard.

**References**:
- Related: this component's own pre-existing field-level tests (unchanged, not re-verified here)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-08: all fields still present', () => {
  it('renders every pre-existing field when open', () => {
    renderBox()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    for (const label of [/min tmdb rating/i, /min vote count/i, /^year min$/i, /^year max$/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Exclude Genres' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: no change to field JSX beyond moving it inside its `CollapsibleSection`.

### Requirement 3: "Filter My Series" opens as a slide-out sheet, with a new active-filter indicator

**User Story**: As a user narrowing which of my own series feed a recommendation query, I want the
Filter My Series panel tucked away until I open it, with a quick visual sign that a filter is
currently applied.

#### FRONTEND-134-AC-09 [AUTO]: closed state is unchanged
**Statement**: While `filterSectionOpen` is `false`, `UseMySeriesPanel` shall render only its
"Filter My Series" toggle button — no sheet, no inline `filtersBody`, present in the document.

**Rationale**: Regression guard, mirrors AC-01 for the other panel.

**References**:
- Component: `components/UseMySeriesPanel.tsx`, lines 374-383 (toggle, unchanged position)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-09: closed state unchanged', () => {
  it('renders only the toggle button while closed', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    expect(
      screen.getByRole('button', { name: /^filter my series$/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: no change to the toggle button's own markup.

#### FRONTEND-134-AC-10 [AUTO]: opening renders an accessible sheet dialog
**Statement**: When the "Filter My Series" toggle button is clicked while `filterSectionOpen` is
`false`, `UseMySeriesPanel` shall render its filter fields inside a
`role="dialog" aria-modal="true" aria-labelledby="filter-my-series-sheet-heading"` sheet container
(a "Filter My Series" heading plus a Close control), replacing the former inline expand.

**Rationale**: Same sheet pattern as Requirement 1, applied to this panel.

**References**:
- Pattern: `components/RecommendationFiltersBox.tsx` (this spec's own AC-02), `SearchFilter.tsx`

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-10: opens as an accessible dialog', () => {
  it('renders a labelled dialog when the toggle is clicked', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    const dialog = screen.getByRole('dialog', { name: /filter my series/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})
```

**Test Case (Green)**: wrap the existing field markup (still gated by `filterSectionOpen`) in the
new sheet container.

#### FRONTEND-134-AC-11 [AUTO]: focus moves into the sheet on open
**Statement**: When the sheet opens, `UseMySeriesPanel` shall move focus to its Close control.

**Rationale**: Same as AC-03, applied to this panel.

**References**:
- Pattern: `components/SearchFilter.tsx`, lines 270-286

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-11: focus moves to Close on open', () => {
  it('focuses the Close button once the sheet opens', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus()
  })
})
```

**Test Case (Green)**: a `closeButtonRef` + `useEffect` keyed on `filterSectionOpen`.

#### FRONTEND-134-AC-12 [AUTO]: Escape, Close, and backdrop all close the sheet
**Statement**: When Escape is pressed, the Close control is clicked, or the overlay backdrop is
clicked while the sheet is open, `UseMySeriesPanel` shall close it (`filterSectionOpen` becomes
`false`).

**Rationale**: Same as AC-04, applied to this panel.

**References**:
- Hook: `hooks/useEscapeToClose.ts`

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-12: Escape/Close/backdrop close the sheet', () => {
  it('closes on Escape', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: same pattern as AC-04, applied to `filterSectionOpen`.

#### FRONTEND-134-AC-13 [AUTO]: Clear Filters closes the sheet after acting
**Statement**: When Clear Filters is clicked inside the sheet, `UseMySeriesPanel` shall run its
existing `handleClearSpecificSeriesFilters` (unchanged) and then close the sheet.

**Rationale**: Mirrors AC-05/`frontend_spec_071-AC-07`.

**References**:
- Function: `components/UseMySeriesPanel.tsx`, lines 260-283
  (`handleClearSpecificSeriesFilters`, unchanged)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-13: Clear Filters resets and closes', () => {
  it('resets fields and closes the sheet', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={['Drama']}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    fireEvent.click(screen.getByTestId('reset-specific-series-filters-btn'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: `handleClearSpecificSeriesFilters`'s body is unchanged; its `onClick`
handler additionally calls `setFilterSectionOpen(false)` after it runs.

#### FRONTEND-134-AC-14 [AUTO]: active-filter-count badge on the trigger
**Statement**: While any of `UseMySeriesPanel`'s filter fields (Status, Genre, Exclude Genre,
Keywords, Country, Language, Min Personal/IMDb/TMDB/Tomatometer/Popcornmeter Rating, Year Min,
Year Max) is not at its default value, the "Filter My Series" toggle button shall display an
active-count badge (`data-testid="use-my-series-filters-active-count"`); while every field is at
its default, no badge shall be present.

**Rationale**: New capability, per this spec's Design Decisions — mirrors
`RecommendationFiltersBox`'s existing `countActiveFilters` badge and
`frontend_spec_071-AC-03`'s dot indicator, giving a glance-able signal now that fields are hidden
inside a sheet.

**References**:
- Pattern: `components/RecommendationFiltersBox.tsx`, lines 43-71 (`countActiveFilters`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-14: active-filter-count badge', () => {
  it('shows no badge with every field at its default', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    expect(
      screen.queryByTestId('use-my-series-filters-active-count'),
    ).not.toBeInTheDocument()
  })

  it('shows a badge once Status is narrowed from Any', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    fireEvent.click(screen.getByLabelText('Completed Only'))
    expect(
      screen.getByTestId('use-my-series-filters-active-count'),
    ).toHaveTextContent('1')
  })
})
```

**Test Case (Green)**: a new `countActiveUseMySeriesFilters` function (module-level, colocated with
the panel), read on every render and rendered as a badge span next to the toggle label whenever
`> 0`.

### Requirement 4: "Filter My Series" fields group into `CollapsibleSection`s

**User Story**: As a user, I want the sheet's 13 fields grouped into clearly-labeled,
independently-collapsible sub-groups instead of one long flat list.

#### FRONTEND-134-AC-15 [AUTO]: fields render inside five labeled subsections
**Statement**: While the sheet is open, `UseMySeriesPanel` shall group its fields into five
`CollapsibleSection` subsections — "Status & Sort" (Filter by Status, Sort by, the missing-rating
notice), "Genre & Keyword" (Include/Exclude Genres, Keywords), "Country & Language" (Country,
Language), "Ratings" (Min Personal/IMDb/TMDB/Tomatometer/Popcornmeter Rating), and "Year" (Year
Min/Max) — each carrying its own active-count badge.

**Rationale**: Adopts `CollapsibleSection` here too, per this component's own currently-unfulfilled
comment in `CollapsibleSection.tsx`.

**References**:
- Component: `components/CollapsibleSection.tsx`
- Pattern: `components/SearchFilter.tsx`, lines 195-245, 460-768

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-15: fields grouped into subsections', () => {
  it('renders five named CollapsibleSection headings', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={['Drama']}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    for (const name of ['Status & Sort', 'Genre & Keyword', 'Country & Language', 'Ratings', 'Year']) {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument()
    }
  })
})
```

**Test Case (Green)**: five `countXActive` helpers (mirroring `SearchFilter.tsx`'s per-section
counters), each field's existing JSX moved as-is into its matching `<CollapsibleSection>`.

#### FRONTEND-134-AC-16 [AUTO]: all pre-existing fields still render (relocation smoke test)
**Statement**: While the sheet is open, `UseMySeriesPanel` shall render every field it rendered
before this spec (Filter by Status, Sort by, Include/Exclude Genres, Keywords, Country, Language,
Min Personal/IMDb/TMDB/Tomatometer/Popcornmeter Rating, Year Min/Max).

**Rationale**: This spec relocates fields into sections; it must not silently drop one, mirroring
`frontend_spec_071-AC-08`.

**References**:
- Related: this component's own pre-existing field-level tests (unchanged, not re-verified here)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-16: all fields still present', () => {
  it('renders every pre-existing field when open', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={['Drama']}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    expect(screen.getByText('Filter by Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument()
    expect(screen.getByText('Min Personal Rating')).toBeInTheDocument()
    expect(screen.getByLabelText(/year min \(my series\)/i)).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: no change to field JSX beyond moving it inside its `CollapsibleSection`.

### Requirement 5: page composition and ordering are preserved

**User Story**: As a user, I want the rest of the "Use My Series" tab's layout (Source Ranking
Strategy, the Series picker, Sort By, Get Recommendations) to stay exactly where it already is —
only the two filter panels' own presentation should change.

#### FRONTEND-134-AC-17 [AUTO]: DOM order is unchanged around the two new sheet triggers
**Statement**: `RecommendationControls`/`UseMySeriesPanel`/`RecommendationFiltersBox` shall render,
in DOM order: the mode tablist; then, inside the `useMySeries` tabpanel, the "Filter My Series"
sheet trigger, the unchanged "Source Ranking Strategy" disclosure, the section divider, and the
Series picker/bulk-select controls/"Show all series" button; then, unconditionally regardless of
tab, the "Recommendations Filters" sheet trigger; then `HighestRatedPanel`; then the "Get
Recommendations" button.

**Rationale**: This spec changes how the two filter panels present their own content, not the
surrounding page's layout — a regression guard against the reorganization accidentally moving
"Source Ranking Strategy" or the Series picker.

**References**:
- Component: `components/RecommendationControls.tsx`, lines 1151-1287 (composition order,
  unchanged)
- Component: `components/UseMySeriesPanel.tsx`, lines 759-1009 (Source Ranking Strategy/divider/
  Series picker, unchanged)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-17: DOM order preserved', () => {
  it('keeps Source Ranking Strategy and the Series picker between the two sheet triggers', () => {
    mockGetAll.mockResolvedValue({ series: [makeSeries()], excludedCount: 0 })
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    const filterMySeries = screen.getByRole('button', { name: /^filter my series$/i })
    const sourceRanking = screen.getByRole('button', { name: /^source ranking strategy$/i })
    const recommendationFilters = screen.getByRole('button', {
      name: /^recommendations filters$/i,
    })
    const getRecommendations = screen.getByRole('button', { name: /get recommendations/i })

    const order = [filterMySeries, sourceRanking, recommendationFilters, getRecommendations]
    for (let i = 0; i < order.length - 1; i++) {
      expect(
        order[i].compareDocumentPosition(order[i + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
  })
})
```

**Test Case (Green)**: no change to `RecommendationControls.tsx`'s own composition order or to
`UseMySeriesPanel.tsx`'s Source-Ranking-Strategy/divider/Series-picker block — only the two panels'
internal rendering (their own `filtersOpen`/`filterSectionOpen`-gated content) changes.

#### FRONTEND-134-AC-18 [MANUAL]: visual check — sheets render as slide-out panels, both themes
**Statement**: Where a real browser renders either sheet open, it shall present as a slide-in panel
from the edge of the viewport (not a centered modal), consistent with `frontend_spec_071`'s
`SearchFilter` sheet, in both light and dark theme.

**Rationale**: `jsdom` doesn't render CSS (per this project's own steering notes) — the `role`/
`aria-modal`/DOM-structure ACs above are automatable, but the actual slide-in visual presentation
and light/dark contrast need a real-browser pass, same caveat every other sheet/modal spec in this
codebase already carries.

**References**:
- Pattern: `components/SearchFilter.module.css`, `.sheetOverlay`/`.sheet` (the visual shape being
  matched)

**How verified**: open each sheet in a running `npm run dev` session, in both the light and dark
theme (Settings > theme toggle), confirming a slide-in-from-the-edge presentation with readable
contrast in both. Route to automate later: a visual-regression tool (e.g. Playwright screenshot
diffing) if this project ever adopts one — none exists today.

### Requirement 6: each sheet explains its own scope with a short intro line

**User Story**: As a user (especially a first-time one), I want a one-line explanation of what each
filter panel actually affects, so I don't have to guess why "Filter My Series" and "Recommendations
Filters" are two separate things.

#### FRONTEND-134-AC-19 [AUTO]: "Filter My Series" sheet shows its intro line
**Statement**: While the "Filter My Series" sheet is open, `UseMySeriesPanel` shall render the text
"Filter the series that you want to use for recommendations before selecting them." directly below
the sheet heading, above `SavedFiltersList`.

**Rationale**: Per this spec's Design Decisions — states the pre-sourcing scope of this panel
explicitly, since it's no longer visually obvious once tucked into a sheet alongside a
same-looking second sheet.

**References**:
- Component: `components/UseMySeriesPanel.tsx` (new sheet header area, this spec's AC-10)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-19: Filter My Series intro line', () => {
  it('shows the explanatory intro text when the sheet is open', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    expect(
      screen.getByText(
        'Filter the series that you want to use for recommendations before selecting them.',
      ),
    ).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: a plain `<p>` with the fixed copy, rendered inside the sheet container
immediately after the heading/Close row, before `SavedFiltersList`.

#### FRONTEND-134-AC-20 [AUTO]: "Recommendations Filters" sheet shows its intro line
**Statement**: While the "Recommendations Filters" sheet is open, `RecommendationFiltersBox` shall
render the text "Filter the recommendations to only show series you want to see." directly below the
sheet heading, above `SavedFiltersList`.

**Rationale**: Same as AC-19, for the post-sourcing/output-filtering panel.

**References**:
- Component: `components/RecommendationFiltersBox.tsx` (new sheet header area, this spec's AC-02)

**Test Case (Red)**:
```typescript
describe('FRONTEND-134-AC-20: Recommendations Filters intro line', () => {
  it('shows the explanatory intro text when the sheet is open', () => {
    renderBox()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    expect(
      screen.getByText(
        'Filter the recommendations to only show series you want to see.',
      ),
    ).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: same pattern as AC-19, fixed copy inside `RecommendationFiltersBox`'s sheet
container.

## Cross-References

| Concept | Location |
|---|---|
| Sheet dialog a11y pattern reused (`role="dialog"`/`aria-modal`/Escape/backdrop-click) | `frontend_spec_071_my_series_filter_sheet.md`, `components/SearchFilter.tsx` |
| `CollapsibleSection` (toggle + badge + conditional body) | `frontend_spec_123_filter_layout_and_collapsible_sections.md`, `components/CollapsibleSection.tsx` |
| "Filter My Series" fields/layout this spec relocates | `frontend_spec_081_use_my_series_page_restructure.md`, `components/UseMySeriesPanel.tsx` |
| "Recommendations Filters" fields/`countActiveFilters` this spec relocates | `components/RecommendationFiltersBox.tsx` |
| "Source Ranking Strategy" disclosure this spec deliberately leaves untouched | `frontend_spec_132_source_ranking_strategy_and_custom_blend.md` |
| Saved-filter-profile components kept in their existing sheet positions | `frontend_spec_129` (`SavedFiltersList`/`FilterProfileActions` placement) |
| "Get Recommendations" single-submit gate this spec's field edits still funnel through unchanged | `frontend_spec_040_recommendation_controls_apply_and_lock.md` (see `handleApplyFilters`, `RecommendationControls.tsx`) |
| Originating idea | `.claude/ideas/future_ideas.md`, Search & Filter section, "Redo cluttered filter panels as a collapsible left-hand panel or slide-out sheet" (now fully resolved, removed from that file as part of this spec) |
| Wizard alternative considered and rejected for this redesign | `.claude/ideas/future_ideas.md`, Recommendations & Lookup section, "'Use My Series' as a step-by-step wizard" (unaffected by this spec, tracked separately) |

## Acceptance Criteria Summary

- [x] FRONTEND-134-AC-01: "Recommendations Filters" closed state unchanged (button only, no sheet)
- [x] FRONTEND-134-AC-02: opening renders an accessible `role="dialog"` sheet
- [x] FRONTEND-134-AC-03: focus moves to the Close control on open
- [x] FRONTEND-134-AC-04: Escape, Close control, and backdrop click all close the sheet
- [x] FRONTEND-134-AC-05: Reset Filters resets fields and closes the sheet
- [x] FRONTEND-134-AC-06: fields grouped into four `CollapsibleSection` subsections with own badges
- [x] FRONTEND-134-AC-07: Custom-Search-hidden fields stay hidden inside their subsections
- [x] FRONTEND-134-AC-08: all pre-existing fields still render (relocation smoke test)
- [x] FRONTEND-134-AC-09: "Filter My Series" closed state unchanged (button only, no sheet)
- [x] FRONTEND-134-AC-10: opening renders an accessible `role="dialog"` sheet
- [x] FRONTEND-134-AC-11: focus moves to the Close control on open
- [x] FRONTEND-134-AC-12: Escape, Close control, and backdrop click all close the sheet
- [x] FRONTEND-134-AC-13: Clear Filters resets fields and closes the sheet
- [x] FRONTEND-134-AC-14: new active-filter-count badge on the "Filter My Series" trigger
- [x] FRONTEND-134-AC-15: fields grouped into five `CollapsibleSection` subsections with own badges
- [x] FRONTEND-134-AC-16: all pre-existing fields still render (relocation smoke test)
- [x] FRONTEND-134-AC-17: DOM order around both sheet triggers, Source Ranking Strategy, and the
      Series picker is unchanged
- [ ] FRONTEND-134-AC-18: visual check — both sheets slide in from the edge in both themes
- [x] FRONTEND-134-AC-19: "Filter My Series" sheet shows its explanatory intro line
- [x] FRONTEND-134-AC-20: "Recommendations Filters" sheet shows its explanatory intro line
