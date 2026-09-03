# Frontend Spec 065: Relabel Recommendations' "Filters" and "Apply Filters"

**Status**: Not started
**Priority**: P4
**Depends on**: Frontend Spec 040 (`frontend_spec_040_recommendation_controls_apply_and_lock.md`,
owns the "Apply Filters" button this spec renames) ✅, Frontend Spec 042
(`frontend_spec_042_recommendation_source_mode_reorganization.md`, owns the four Recs modes this
relabel applies to uniformly) ✅
**Area**: Frontend (`components/RecommendationFiltersBox.tsx`, `components/RecommendationControls.tsx`,
`components/RecommendationControls.test.tsx`)
**Status**: Implemented — via `frontend_spec_081_use_my_series_page_restructure.md`'s Requirement 10
(same touch of `components/RecommendationFiltersBox.tsx`, `components/RecommendationControls.tsx`,
`components/RecommendationControls.test.tsx`, `components/RecommendationFiltersBox.test.tsx`)

## Overview

`RecommendationFiltersBox`'s disclosure toggle literally renders the word "Filters", and
`RecommendationControls`' submit button renders "Apply Filters" — both single shared components
already applied uniformly across all four Recs modes (Use My Series, Custom Search, Trending,
Highest Rated). This spec is a pure copy change: the disclosure toggle becomes "Recommendations
Filters" and the submit button becomes "Get Recommendations", with no change to either component's
behavior, state, or test coverage beyond updating string matchers to the new text.

## Design Decisions

- **"Recommendations Filters" (Title Case), not "Recommendations filter"** — matches this app's
  existing button-label casing convention (`Apply Filters`, `Clear Filters`, `Show Filters`/`Hide
  Filters` all use Title Case). The idea as raised used sentence case ("Recommendations filter");
  this spec normalizes it to match the surrounding UI rather than introduce a one-off casing
  exception.
- **"Get Recommendations", not a bare "Apply"** — reads as an action on this specific screen
  (matches `RecommendationsList`'s own domain language) and stays close to the idea as raised
  ("something like 'Get Recommendations'"). No functional difference from today's "Apply Filters"
  — same `handleApplyFilters` handler, same disabled-while-loading behavior
  (`frontend_spec_040`'s `FRONTEND-040-AC-08`/`AC-09`, unaffected by this spec).
- **Applies uniformly, no mode-specific label** — both strings are rendered by single shared
  components already used identically across Use My Series/Custom Search/Trending/Highest Rated
  (`frontend_spec_042`), so this relabel takes effect everywhere with no new conditional logic.
- **No `data-testid`/`aria-label` changes** — neither element has an explicit `data-testid` or
  `aria-label` distinct from its visible text today (confirmed by reading
  `RecommendationFiltersBox.tsx`/`RecommendationControls.tsx`); tests query them by visible/
  accessible name (`getByRole('button', { name: /apply filters/i })` and similar), so this spec's
  only test impact is updating those name matchers to the new strings, not restructuring how tests
  find the elements.

## Requirements

### Requirement 1: The Filters disclosure toggle reads "Recommendations Filters"

**User Story**: As a user of Recommendations, I want the filters disclosure to be clearly labeled
as belonging to Recommendations (distinct from My Series' own "Show Filters"/"Hide Filters"), so
the two panels aren't confusingly identical when discussing them.

#### FRONTEND-065-AC-01 [AUTO]: renders "Recommendations Filters"
**Statement**: The `RecommendationFiltersBox` component shall render its disclosure toggle button
with the text "Recommendations Filters", replacing the current "Filters" text.

**Rationale**: Core relabel — see Design Decisions for the casing/wording choice.

**References**:
- Component: `components/RecommendationFiltersBox.tsx` (existing toggle, line 72)

**Test Case (Red)**:
```typescript
describe('FRONTEND-065-AC-01: Filters disclosure is labeled "Recommendations Filters"', () => {
  it('renders a toggle button named "Recommendations Filters"', () => {
    render(<RecommendationFiltersBox state={state} updateState={vi.fn()} isCustomSearch={false} showMinSourceRating={false} />)
    expect(
      screen.getByRole('button', { name: 'Recommendations Filters' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: change the button's text content from `Filters` to `Recommendations
Filters` in `RecommendationFiltersBox.tsx`.

### Requirement 2: The submit button reads "Get Recommendations"

**User Story**: As a user of Recommendations, I want the button that fetches results to describe
what it does ("get recommendations"), matching this screen's own domain language rather than the
generic "Apply Filters" phrasing.

#### FRONTEND-065-AC-02 [AUTO]: renders "Get Recommendations"
**Statement**: The `RecommendationControls` component shall render its submit button with the text
"Get Recommendations", replacing the current "Apply Filters" text, with no change to
`handleApplyFilters`'s behavior or the button's `disabled` binding.

**Rationale**: Core relabel — see Design Decisions.

**References**:
- Component: `components/RecommendationControls.tsx` (existing button, line 826)
- Related: `frontend_spec_040_recommendation_controls_apply_and_lock.md` (owns
  `handleApplyFilters`/the `disabled={loading}` binding, both unchanged by this spec)

**Test Case (Red)**:
```typescript
describe('FRONTEND-065-AC-02: submit button is labeled "Get Recommendations"', () => {
  it('renders a button named "Get Recommendations" that still calls onQueryChange', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    const button = screen.getByRole('button', { name: 'Get Recommendations' })
    expect(screen.queryByRole('button', { name: 'Apply Filters' })).not.toBeInTheDocument()
    fireEvent.click(button)
    expect(onQueryChange).toHaveBeenCalled()
  })
})
```

**Test Case (Green)**: change the button's text content from `Apply Filters` to `Get
Recommendations` in `RecommendationControls.tsx`.

#### FRONTEND-065-AC-03 [AUTO]: existing test suite's name matchers are updated, behavior unchanged
**Statement**: Where `RecommendationControls.test.tsx` currently queries the submit button via an
`/apply filters/i` name matcher, the test suite shall query it via a `/get recommendations/i`
matcher instead, with every such test's assertions otherwise unchanged.

**Rationale**: `RecommendationControls.test.tsx` has ~20 existing call sites using
`getByRole('button', { name: /apply filters/i })` (spanning `frontend_spec_040`/`019`/`047`/`062`'s
own test coverage) — this is a pure find/replace on the query text, not a behavioral change to any
of those specs' own ACs, and is called out explicitly so it isn't missed as "just" a component
change.

**References**:
- Test file: `components/RecommendationControls.test.tsx` (existing `/apply filters/i` matchers)

**Test Case (Red)**: N/A — this AC is the instruction to update existing red/green tests, not a
new test of its own.

**Test Case (Green)**: find-and-replace `/apply filters/i` → `/get recommendations/i` (and any
literal `'Apply Filters'` string matchers) across `RecommendationControls.test.tsx`; run the full
suite to confirm no other file references the old strings.

## Cross-References

| Concept | Location |
|---|---|
| Filters disclosure toggle | `frontend/src/components/RecommendationFiltersBox.tsx` |
| Apply/submit button | `frontend/src/components/RecommendationControls.tsx` |
| Existing test coverage to update | `frontend/src/components/RecommendationControls.test.tsx` |
| Apply-button behavior this spec doesn't change | `frontend_spec_040_recommendation_controls_apply_and_lock.md` |
| The four Recs modes this relabel applies to uniformly | `frontend_spec_042_recommendation_source_mode_reorganization.md` |
| `SearchFilter`'s own, differently-worded disclosure ("Show/Hide Filters") — unaffected | `frontend_spec_055_search_filter_overhaul.md` |

## Acceptance Criteria Summary

- [x] FRONTEND-065-AC-01: renders "Recommendations Filters"
- [x] FRONTEND-065-AC-02: renders "Get Recommendations"
- [x] FRONTEND-065-AC-03: existing test suite's name matchers are updated, behavior unchanged
