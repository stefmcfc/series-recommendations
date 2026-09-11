# Frontend Spec 126: Fold Analysis's Saved Filters Into Its Filters Box

**Status**: Not started
**Priority**: P4 (layout/placement fix, no new capability)
**Depends on**: `frontend_spec_112_filter_profiles_custom_search_and_analysis.md` (the spec whose placement decision this one reverses — see Overview)
**Area**: Frontend (`components/NameStatsTable.tsx`, `components/AnalysisView.tsx`)

## Overview

`AnalysisView.tsx` renders `<FilterProfileSelector area="ANALYSIS_FILTERS">` once, as a bare block between the tab `<nav>` and whichever tab's view is active — outside `NameStatsTable.tsx`'s own collapsible "Analysis Filters" box entirely, unlike every other filterable area in this app (Custom Search, Use My Series, Recommendation Filters), which all render their `FilterProfileSelector` *inside* their own filters container, at the end of the fields, before the actions row.

This placement was a deliberate choice in `frontend_spec_112` (`FRONTEND-112-AC-09`'s comment, quoted in `AnalysisView.tsx` lines 60-63): *"renders once here, shared across all three tabs — not inside `NameStatsTable.tsx` (instantiated three times, once per tab, which would triple-render a per-instance picker)."* Reading `AnalysisView.tsx` directly shows this is imprecise: `{tab === 'keywords' && <KeywordsView .../>}` / `{tab === 'genres' && ...}` / `{tab === 'country-of-origin' && ...}` are mutually exclusive — only **one** `NameStatsTable` is ever mounted at a time, never three simultaneously. The real cost of nesting the selector inside `NameStatsTable.tsx` is a refetch of the saved-profile list on each tab switch (an unmount/remount effect, not a "3 at once" duplication) — a small, one-off network request, not a rendering bug. Given the confirmed cost is minor, this spec makes the change the user asked for: fold the selector into the filters box, matching every other area's convention.

## Design Decisions

- **Purely internal to `NameStatsTable.tsx` — no new props.** `NameStatsTable` already receives a `filters` prop (from `useNameStatsFilters()`) containing everything `FilterProfileSelector` needs: `filters.filterInputs`, `filters.sortBy`/`sortDirection`, `filters.applyFilterProfile`, `filters.clearFilterProfile` (confirmed directly in `hooks/useNameStatsFilters.ts`). The `currentCriteria` object `AnalysisView.tsx` currently assembles gets rebuilt identically inside `NameStatsTable.tsx` instead.
- **Placed at the end of the fields, before the Reset/Apply actions row** — matching `CustomSearchPanel.tsx`/`UseMySeriesPanel.tsx`'s existing convention for their own `FilterProfileSelector`s, not inventing a new placement rule for Analysis.
- **`AnalysisView.tsx` loses its `FilterProfileSelector` block and the `currentAnalysisFiltersCriteria` computation that only existed to feed it** — both become dead code once the selector moves.
- **This explicitly reverses `frontend_spec_112`'s placement decision.** That spec's stated reasoning is corrected here (see Overview) rather than silently contradicted — the "triple-render" framing was about tab-switch remounts, not simultaneous duplication, and that smaller cost is an acceptable trade-off for matching this app's otherwise-universal "selector lives inside the filters box" convention.

---

## Requirement 1: Analysis's saved-filters picker lives inside its filters box

**User story**: As a user managing Analysis filter profiles, I want the saved-filters picker inside the "Analysis Filters" disclosure, the same place it lives for every other filterable area in this app, instead of floating above the tab content.

### FRONTEND-126-AC-01 [AUTO]
**Statement**: `NameStatsTable.tsx` shall render `<FilterProfileSelector area="ANALYSIS_FILTERS">` inside its `.filtersBody`, immediately after the Status `<select>` field and before the Reset/Apply actions row, using `currentCriteria={{...filters.filterInputs, sortBy: filters.sortBy, sortDirection: filters.sortDirection}}`, `onApply={filters.applyFilterProfile}`, `onClear={filters.clearFilterProfile}`.

**References**: `components/NameStatsTable.tsx` lines 185-197 (Status field, immediately followed by `.filtersActions` at line 197 — the exact insertion point), `components/CustomSearchPanel.tsx`'s own `FilterProfileSelector` placement (the "end of fields, before actions" convention being matched), `hooks/useNameStatsFilters.ts` (confirms `filterInputs`/`sortBy`/`applyFilterProfile`/`clearFilterProfile` are all already on the `filters` object `NameStatsTable` receives).

**Test Case (Red)**:
```typescript
describe('FRONTEND-126-AC-01: FilterProfileSelector renders inside the Analysis filters box', () => {
  it('shows the Saved Filters picker inside the filters body when open', () => {
    render(<NameStatsTable {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    const filtersBody = screen.getByTestId('filters-body')
    expect(within(filtersBody).getByText(/saved filters/i)).toBeInTheDocument()
  })

  it('applying a saved profile updates filterInputs the same way it did before this move', () => {
    // adapt to this file's existing FilterProfileSelector-application test
    // pattern (e.g. from CustomSearchPanel.test.tsx or UseMySeriesPanel.test.tsx)
    // -- asserts filters.applyFilterProfile is still called correctly from its
    // new render location.
  })
})
```
**Test Case (Green)**: add the `FilterProfileSelector` render (with its `currentCriteria` built inline) to `NameStatsTable.tsx`'s `.filtersBody`, at the stated position.

---

### FRONTEND-126-AC-02 [AUTO]
**Statement**: `AnalysisView.tsx` shall no longer render its own `FilterProfileSelector` or compute `currentAnalysisFiltersCriteria`.

**References**: `components/AnalysisView.tsx` lines 41-45 (`currentAnalysisFiltersCriteria`), lines 60-69 (the `FilterProfileSelector` block) — both removed.

**Test Case (Red)**:
```typescript
describe('FRONTEND-126-AC-02: AnalysisView no longer renders its own picker', () => {
  it('does not render a Saved Filters picker outside the filters box', () => {
    render(<AnalysisView />)
    // Only the one inside NameStatsTable's (closed-by-default) filters box
    // should exist -- none directly under the tab nav.
    expect(
      screen.queryByText(/saved filters/i),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    expect(screen.getByText(/saved filters/i)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: delete the block and the now-unused computation from `AnalysisView.tsx`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Placement decision this spec reverses, with corrected reasoning | `frontend_spec_112_filter_profiles_custom_search_and_analysis.md` (`FRONTEND-112-AC-09`) |
| "End of fields, before actions" convention being matched | `CustomSearchPanel.tsx`, `UseMySeriesPanel.tsx` (both established by `frontend_spec_109`/`frontend_spec_112`) |
| Confirms `NameStatsTable` already has everything needed via its `filters` prop | `hooks/useNameStatsFilters.ts` |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-126-AC-01: `FilterProfileSelector` renders inside `NameStatsTable`'s filters box, correctly wired
- [ ] FRONTEND-126-AC-02: `AnalysisView.tsx`'s now-redundant selector/computation removed
