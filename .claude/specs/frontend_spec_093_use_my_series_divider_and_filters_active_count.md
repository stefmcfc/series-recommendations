# Frontend Spec 093: Use My Series Section Divider + Recommendation Filters Active-Count Indicator

**Status**: Complete
**Priority**: P4
**Depends on**: none
**Area**: Frontend (`components/UseMySeriesPanel.tsx`, `components/RecommendationFiltersBox.tsx`, `components/RecommendationControls.module.css`)

## Overview

Two small, unrelated polish items on the Recommendations page, bundled into one spec since both touch `RecommendationControls.module.css` and neither is big enough to warrant its own. First: `UseMySeriesPanel`'s "Filter & sort my series" disclosure (ending in the Year Min/Max row) runs directly into the "Series" picker below it with no visual separation — both read as one continuous block today. Second: `RecommendationFiltersBox`'s "Recommendations Filters" toggle gives no indication anything is set once collapsed — a user has to reopen it to remember whether they left filters active from a previous session/query.

## Design Decisions

- **The divider is a plain decorative `<div>`, not `<hr>`** — this codebase has no existing divider precedent to match (confirmed via grep: no `.divider` class, no `<hr>` usage anywhere in `frontend/src`), and a bare `<hr>` inside a flex column picks up browser default margins/borders that would need overriding anyway. A `div` styled with `border-top: 1px solid var(--border)` matches the `--border` custom property already used for every other subtle separator in this app (e.g. `SeriesDetail.module.css`'s section-header underlines).
- **Active-filter count includes every field `RecommendationFiltersBox` renders, regardless of `isCustomSearch`.** Several fields (`minTmdbRating`, `yearMin`, `yearMax`, `excludeGenresSelected`, `countriesSelected`, `language`) are hidden while `isCustomSearch` is true, but their `state` values persist across mode switches — counting only currently-visible fields would make the badge's number change confusingly as the user switches modes without touching anything. Counting all 8 fields unconditionally is simpler and matches what the user actually means by "how many filters am I applying."
- **The 8 counted fields**: `minTmdbRating`, `minVoteCount`, `yearMin`, `yearMax` (non-empty string), `excludeGenresSelected`, `countriesSelected` (non-empty array), `excludeKeywordsText`, `language` (non-empty string) — exactly the fields `RecommendationFiltersBox` itself reads/writes, confirmed by reading its current field list.
- **The badge only renders when the count is greater than zero** — mirrors the existing `hasActiveFilters &&` conditional-render pattern already used for `SeriesList`'s filter-funnel dot (`frontend_spec_071`), rather than always showing "(0)".
- **A plain visible number, not a re-use of the funnel's dot.** The funnel is an icon-only button with no visible label, so a dot is the only inline signal that fits; `RecommendationFiltersBox`'s toggle already has full visible text ("Recommendations Filters"), so a small numeric badge appended to that text is both more informative (matches the user's own "maybe the number of active filters" suggestion) and doesn't need a new `aria-label` — the badge's own text content is already screen-reader-visible as part of the button's accessible name.

## Requirements

### Requirement 1: Divider between Use My Series' filter section and the series picker

**User Story**: As a user, I want a visual break between "Filter & sort my series" and the series list below it, so the two don't read as one continuous block.

#### FRONTEND-093-AC-01 [AUTO]: Divider renders between the filter section and the Series picker
**Statement**: `UseMySeriesPanel` shall render a divider between the "Filter & sort my series" disclosure and the "Series" picker.

**Rationale**: The explicit request — today nothing visually separates the end of the filter/sort fields (Year Min/Max, the last row) from the series-selection picker immediately below.

**References**:
- Component: `components/UseMySeriesPanel.tsx` (`.filtersSection` div, ending with `data-testid="specific-series-filters-body"`'s closing tag; `<KeywordPicker id="specific-series-picker" label="Series">` immediately follows)

**Test Case (Red)**:
```typescript
describe('FRONTEND-093-AC-01: divider renders between filter section and Series picker', () => {
  it('places a divider after the filters body and before the Series picker', () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    const filtersBody = screen.getByTestId('specific-series-filters-body')
    const seriesLabel = screen.getByText('Series')
    const divider = screen.getByTestId('specific-series-divider')

    expect(
      filtersBody.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      divider.compareDocumentPosition(seriesLabel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
```

Uses this file's existing `makeState`/`makeSeries` helpers (already defined in `UseMySeriesPanel.test.tsx`) — `allSeries` must be non-empty or the panel shows its "no series to choose from yet" hint instead of the filter section/picker.

**Test Case (Green)**: add `<div className={styles.sectionDivider} data-testid="specific-series-divider" />` immediately after `.filtersSection`'s closing `</div>`, before `<KeywordPicker id="specific-series-picker">`. CSS: `.sectionDivider { border-top: 1px solid var(--border); margin: 0.5rem 0; }` in `RecommendationControls.module.css` (the shared module `UseMySeriesPanel.tsx` already imports).

### Requirement 2: Active-filter count indicator on the collapsed Recommendations Filters toggle

**User Story**: As a user, I want to see at a glance whether I have any Recommendation Filters set, without reopening the panel.

#### FRONTEND-093-AC-02 [AUTO]: Toggle shows a count badge when filters are active
**Statement**: While one or more `RecommendationFiltersBox` fields hold a non-default value, `RecommendationFiltersBox` shall display the count of such fields on its toggle button.

**Rationale**: The explicit request — today the toggle gives no indication anything is set once collapsed.

**References**:
- Component: `components/RecommendationFiltersBox.tsx` (`.filtersToggle` button, currently plain "Recommendations Filters" text)
- Precedent: `components/SeriesList.tsx` (`hasActiveFilters` → `.filtersActiveDot`, `frontend_spec_071`) — same "only render when active" shape, different visual treatment (see Design Decisions)

**Test Case (Red)**:
```typescript
describe('FRONTEND-093-AC-02: toggle shows a count badge when filters are active', () => {
  it('shows the count of active filters on the toggle', () => {
    renderBox({
      state: makeState({ minTmdbRating: '7', yearMin: '2010', countriesSelected: ['US'] }),
    })
    expect(screen.getByTestId('filters-active-count')).toHaveTextContent('3')
  })
})
```

**Test Case (Green)**: add a `countActiveFilters(state: ControlsState): number` helper in `RecommendationFiltersBox.tsx` checking the 8 fields listed in Design Decisions (string fields non-empty after `.trim()`, array fields non-empty via `.length > 0`), and render `{count > 0 && <span className={styles.filtersActiveBadge} data-testid="filters-active-count">{count}</span>}` immediately after the toggle button's existing text.

#### FRONTEND-093-AC-03 [AUTO]: No badge when no filters are active
**Statement**: While every `RecommendationFiltersBox` field holds its default value, `RecommendationFiltersBox` shall not display a count badge.

**Rationale**: Regression guard — matches the existing `hasActiveFilters &&` precedent of never showing a "(0)" state.

**Test Case (Red)**:
```typescript
describe('FRONTEND-093-AC-03: no badge when no filters are active', () => {
  it('renders no count badge for the default state', () => {
    renderBox()
    expect(screen.queryByTestId('filters-active-count')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: covered by the same `count > 0 &&` guard as AC-02.

## Cross-References

| Concept | Location |
|---|---|
| `--border` custom property, reused for the new divider | `frontend/src/index.css` (theme custom properties) |
| Existing "only render when active" precedent (dot, not count) | `components/SeriesList.tsx` (`hasActiveFilters`, `frontend_spec_071_my_series_filter_sheet.md`) |
| The 8 counted `ControlsState` fields, and their `isCustomSearch`-gated visibility | `components/RecommendationFiltersBox.tsx` |

## Acceptance Criteria Summary

- [x] FRONTEND-093-AC-01: Divider renders between the filter section and the Series picker
- [x] FRONTEND-093-AC-02: Toggle shows a count badge when filters are active
- [x] FRONTEND-093-AC-03: No badge when no filters are active
