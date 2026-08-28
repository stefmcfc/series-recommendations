# Frontend Spec 046: Custom Search — Relocate Min TMDB Rating & Year Range Out of the Filters Box

**Status**: Not started
**Priority**: P3 (paired UI half of `series_spec_031`)
**Depends on**: Series Spec 031 (`series_spec_031_custom_search_prefetch_filters.md`, the backend pre-fetch
behavior this spec's relocation reflects — **backend should ship first**, though this spec's own changes are UI
placement only and don't functionally depend on the backend change being live to render correctly) ✅. Frontend
Spec 042 (`frontend_spec_042_recommendation_source_mode_reorganization.md`, owns the `state.mode`/
`state.discoverMode` two-tier state and the Custom Search panel this spec adds fields into) ✅.
**Area**: Frontend (`RecommendationControls.tsx`) — no new component, no wire-format change.

## Overview

`series_spec_031` moves `minTmdbRating`/`yearMin`/`yearMax` from post-fetch-only filtering to real TMDB
`discover/tv` params, but **only for Custom Search**. This spec is purely a UI placement change reflecting that:
while Custom Search is the active Discover sub-mode, these three fields move out of the generic "Filters"
disclosure box (where they still live, post-fetch-only, for every other mode) and render directly in Custom
Search's own panel, alongside Genres/Keywords — first-class fields for the mode where they now genuinely shape
what TMDB is asked for, rather than a generic post-hoc filter buried in a collapsed accordion.

**No wire-format change.** `applyRatingAndRangeFilters` already sends `minTmdbRating`/`yearMin`/`yearMax`
unconditionally whenever set, regardless of mode — confirmed via reading the current code. This spec only moves
*where the inputs render*; the emitted `RecommendationQuery` is identical either way.

## Design Decisions

- **Relocation, not duplication.** These three fields render in exactly one place at a time: inside Custom
  Search's panel while that sub-mode is active, inside the Filters box for every other mode. Never both, never
  neither.
- **A hint explains the year fields' semantics specifically in Custom Search**, since `series_spec_031` makes
  Year Min/Max mean something different there (episode-air-date range — matches a still-running show for any
  year it had an episode air) than it still means for every other mode (post-fetch, first-air-date only). A user
  switching between tabs seeing the same field behave differently without explanation would be confusing — the
  hint (e.g. "Matches any year the show had an episode air") makes the asymmetry visible rather than a silent
  surprise. No equivalent hint is needed for Min TMDB Rating — its meaning doesn't change, only its timing.
- **No change to `buildQuery`/`applySourceModeQuery`/`applyRatingAndRangeFilters`.** These functions already
  read `state.minTmdbRating`/`state.yearMin`/`state.yearMax` unconditionally, independent of which JSX block
  the corresponding `<input>` happens to render in. Moving the inputs' markup location has zero effect on what's
  sent — confirmed as a design constraint, not just an implementation detail, so nobody "fixes" this into a
  mode-conditional send path that would actually be a regression.

---

## Requirement 1: Fields render in Custom Search's panel, not the Filters box, while that sub-mode is active

**User story**: As a user in Custom Search, I want Min TMDB Rating and Year Min/Max visible alongside Genres
and Keywords as part of building my search, not hidden inside a separate collapsed Filters section.

### FRONTEND-046-AC-01 [AUTO]
**Statement**: While Discover > Custom Search is the active sub-mode, Min TMDB Rating, Year Min, and Year Max
shall render inside Custom Search's own panel.

**References**: `RecommendationControls.tsx`'s Custom Search panel (`discover-panel-custom-search`, added by
`frontend_spec_042`), currently containing only the Genres checkbox list and Keywords `KeywordPicker`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-046-AC-01: rating/year fields render in the Custom Search panel', () => {
  it('shows Min TMDB Rating and Year Min/Max under Custom Search', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /custom search/i }))

    const panel = screen.getByRole('tabpanel', { name: /custom search/i })
    expect(within(panel).getByLabelText(/min tmdb rating/i)).toBeInTheDocument()
    expect(within(panel).getByLabelText(/^year min/i)).toBeInTheDocument()
    expect(within(panel).getByLabelText(/^year max/i)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: move the three `<div className={styles.field}>` blocks for these inputs from the shared
Filters body into the Custom Search panel's JSX.

---

### FRONTEND-046-AC-02 [AUTO]
**Statement**: While Discover > Custom Search is active, the Filters disclosure box shall NOT render Min TMDB
Rating, Year Min, or Year Max.

**Test Case (Red)**:
```typescript
describe('FRONTEND-046-AC-02: Filters box omits these fields under Custom Search', () => {
  it('does not render the relocated fields inside Filters', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /custom search/i }))
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    const filtersBody = screen.getByTestId('filters-body')
    expect(within(filtersBody).queryByLabelText(/min tmdb rating/i)).not.toBeInTheDocument()
    expect(within(filtersBody).queryByLabelText(/^year min/i)).not.toBeInTheDocument()
    expect(within(filtersBody).queryByLabelText(/^year max/i)).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: gate the three fields' existing Filters-box rendering on `!(state.mode === 'discover' &&
state.discoverMode === 'customSearch')`. Add `data-testid="filters-body"` to the Filters body container if it
doesn't already have an equivalent selector (check first — reuse an existing one if present).

---

### FRONTEND-046-AC-03 [AUTO]
**Statement**: For every mode other than Discover > Custom Search, Min TMDB Rating, Year Min, and Year Max
shall continue rendering inside the Filters disclosure box exactly as today.

**Test Case (Red)**:
```typescript
describe('FRONTEND-046-AC-03: other modes are unaffected', () => {
  it.each([
    ['Use My Series', () => {}],
    ['Popular Right Now', () => {
      fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
      fireEvent.click(screen.getByRole('tab', { name: /popular right now/i }))
    }],
    ['Highest Rated', () => {
      fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
      fireEvent.click(screen.getByRole('tab', { name: /highest rated/i }))
    }],
  ])('renders the fields inside Filters under %s', (_, selectMode) => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    selectMode()
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    expect(screen.getByLabelText(/min tmdb rating/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^year min/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^year max/i)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: the same conditional from AC-02, `true` branch for every mode except Custom Search —
regression guard confirming the relocation is scoped correctly, not a blanket removal from Filters.

---

### FRONTEND-046-AC-04 [AUTO]
**Statement**: Custom Search's panel shall render explanatory hint text near Year Min/Max clarifying that the
range matches any year the show had an episode air (not just its first season).

**Test Case (Red)**:
```typescript
describe('FRONTEND-046-AC-04: year semantics hint renders under Custom Search', () => {
  it('explains the episode-air-date year matching', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /custom search/i }))

    expect(screen.getByText(/episode air/i)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add a static hint string near the relocated Year Min/Max fields in the Custom Search
panel.

---

### FRONTEND-046-AC-05 [AUTO]
**Statement**: The emitted `RecommendationQuery` shall be unaffected by this relocation — the same
`minTmdbRating`/`yearMin`/`yearMax` values are sent regardless of which panel (Filters vs. Custom Search) the
corresponding input currently renders in.

**References**: `buildQuery`/`applyRatingAndRangeFilters`, unchanged by this spec.

**Test Case (Red)**:
```typescript
describe('FRONTEND-046-AC-05: query output is unaffected by relocation', () => {
  it('sends minTmdbRating/yearMin/yearMax from the Custom Search panel location', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /custom search/i }))

    fireEvent.change(screen.getByLabelText(/min tmdb rating/i), { target: { value: '7.5' } })
    fireEvent.change(screen.getByLabelText(/^year min/i), { target: { value: '2020' } })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ minTmdbRating: 7.5, yearMin: 2020 }),
    )
  })
})
```
**Test Case (Green)**: no logic change expected — this AC exists to prove the relocation didn't accidentally
change wiring, not to drive new implementation.

---

## Implementation Notes

- Field `id`s (`recommendation-min-tmdb-rating`, `recommendation-year-min`, `recommendation-year-max`) and their
  `updateField`/`onChange` wiring stay exactly as they are today — only the JSX location of the three
  `<div className={styles.field}>` blocks moves, not their internals.
- Check whether the Filters body container already has a stable test selector before adding
  `data-testid="filters-body"` in AC-02 — reuse what's there if so, to avoid an unnecessary second selector for
  the same element.

## Cross-References

| This spec | Source |
|---|---|
| Backend behavior this UI relocation reflects | `series_spec_031_custom_search_prefetch_filters.md` |
| Custom Search panel / two-tier tab state this spec adds fields into | `frontend_spec_042_recommendation_source_mode_reorganization.md` |
| Original consolidated design discussion (scope decision: Custom Search only, shared field UI regardless of pre/post-fetch wiring) | `.claude/SPEC_CANDIDATES.md`, "Push Discover-mode output filters upward..." |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-046-AC-01: rating/year fields render in the Custom Search panel
- [ ] FRONTEND-046-AC-02: Filters box omits these fields under Custom Search
- [ ] FRONTEND-046-AC-03: other modes are unaffected (fields stay in Filters)
- [ ] FRONTEND-046-AC-04: year semantics hint renders under Custom Search
- [ ] FRONTEND-046-AC-05: emitted query is unaffected by the relocation
