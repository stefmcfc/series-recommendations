# Frontend Spec 080: Remove "Min Source Rating" UI

**Status**: Implemented — `components/RecommendationFiltersBox.tsx`, `components/RecommendationControls.tsx`, `types/series.ts`, `services/seriesApi.ts`, `components/RecommendationFiltersBox.test.tsx`, `components/RecommendationControls.test.tsx`, `components/CustomSearchPanel.test.tsx`, `components/HighestRatedPanel.test.tsx`, `components/TrendingPanel.test.tsx`, `components/UseMySeriesPanel.test.tsx`, `services/__tests__/seriesApi.test.ts`
**Priority**: P2
**Depends on**: Series Spec 045 (`series_spec_045_retire_min_source_rating.md`, removes the backend field this UI drives) — ship together
**Area**: Frontend (`components/RecommendationFiltersBox.tsx`, `components/RecommendationControls.tsx`)

## Overview

`series_spec_045` retires `minSourceRating` from the backend entirely. This spec removes the now-dangling "Min Source Rating" `<select>` from `RecommendationFiltersBox` (rendered only for Use My Series mode today) along with its plumbing through `RecommendationControls`'s `ControlsState`/`buildQuery`, so the frontend doesn't send a param the backend no longer reads and doesn't show a control with no effect.

## Design Decisions

- **Straight removal, not a relocation.** A personal-rating filter reappears later (`frontend_spec_081`'s "Filter & sort my series" section) as a brand-new, purely client-side `StarRating`-based field with zero backend wiring — it is a different control serving a different purpose (narrows the picker, doesn't reach the server), not this field moved. This spec doesn't build that replacement; it only removes the retired one.
- **`showMinSourceRating` prop removed entirely** from `RecommendationFiltersBoxProps` — it has no purpose once the field it gates is gone.
- **`ControlsState.minSourceRating` and its `buildQuery` wiring removed** from `RecommendationControls.tsx` — the field stops being part of pending state altogether, not just unrendered.

## Requirements

### Requirement 1: "Min Source Rating" control removed

**User Story**: As a user, I don't want to see a filter control that no longer does anything.

#### FRONTEND-080-AC-01 [AUTO]: the field no longer renders
**Statement**: `RecommendationFiltersBox` shall not render a "Min Source Rating" field, under any mode.

**Rationale**: The backend field it wrote to is retired (`series_spec_045`).

**References**:
- Component: `components/RecommendationFiltersBox.tsx` (field block, lines 83-101; `showMinSourceRating` prop, line 18)

**Test Case (Red)**:
```typescript
describe('FRONTEND-080-AC-01: Min Source Rating no longer renders', () => {
  it('does not render a Min Source Rating field for Use My Series mode', () => {
    render(<RecommendationFiltersBox {...baseProps} isCustomSearch={false} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))

    expect(screen.queryByLabelText(/min source rating/i)).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: delete the `showMinSourceRating && (...)` block and the `showMinSourceRating` prop from `RecommendationFiltersBoxProps`.

#### FRONTEND-080-AC-02 [AUTO]: `RecommendationControls` no longer computes or passes `showMinSourceRating`
**Statement**: `RecommendationControls` shall not compute a `showMinSourceRating` value or pass it to `RecommendationFiltersBox`.

**Rationale**: Dead prop plumbing for a removed control.

**References**:
- Component: `components/RecommendationControls.tsx` (`showMinSourceRating` computed at line 715, passed at line 855)

**Test Case (Red)**: covered by AC-01/AC-03 — no separate runtime assertion needed; a TypeScript build failure guards against a lingering unused prop reference once `RecommendationFiltersBoxProps` drops the field (AC-01's Green step).

**Test Case (Green)**: delete both the computation and the prop pass-through.

#### FRONTEND-080-AC-03 [AUTO]: `minSourceRating` removed from `ControlsState` and the outgoing query
**Statement**: `ControlsState` shall not include a `minSourceRating` field, and `buildQuery` shall never set `query.minSourceRating`.

**Rationale**: Stops sending a query param the backend no longer reads at all.

**References**:
- Component: `components/RecommendationControls.tsx` (`ControlsState.minSourceRating`, line 140; initial state, line 198; `buildQuery`, lines 358-359)
- Type: `types/series.ts` (`RecommendationQuery.minSourceRating`, line 159)
- Service: `services/seriesApi.ts` (`addIfPresent(params, 'minSourceRating', ...)`, line 83)

**Test Case (Red)**:
```typescript
describe('FRONTEND-080-AC-03: minSourceRating never sent', () => {
  it('does not include minSourceRating in the built query, even if somehow set', async () => {
    mockGetRecommendations.mockResolvedValue([])
    render(<App />)
    // ... navigate to Use My Series, Apply Filters ...
    await waitFor(() =>
      expect(mockGetRecommendations).toHaveBeenCalledWith(
        expect.not.objectContaining({ minSourceRating: expect.anything() }),
      ),
    )
  })
})
```

**Test Case (Green)**: remove `minSourceRating` from `ControlsState`, `initialState`, `buildQuery`, `RecommendationQuery` (`types/series.ts`), and the `addIfPresent` call in `seriesApi.ts`.

#### FRONTEND-080-AC-04 [AUTO]: existing test scaffolding updated
**Statement**: Every test file constructing a `ControlsState`-shaped fixture with `minSourceRating: ''` shall have that line removed, and `RecommendationFiltersBox.test.tsx`'s `showMinSourceRating`-specific assertions shall be removed.

**Rationale**: Regression guard — these fixtures/assertions reference fields this spec deletes; left in place they'd either fail to compile (TypeScript) or assert against dead behavior.

**References**:
- Test files: `CustomSearchPanel.test.tsx:20`, `HighestRatedPanel.test.tsx:19`, `TrendingPanel.test.tsx:19`, `UseMySeriesPanel.test.tsx:22`, `RecommendationFiltersBox.test.tsx` (lines 19, 44, 69-70, 112, 133, 149, 168), `RecommendationControls.test.tsx` (`FRONTEND-027-AC-07`-adjacent tests at lines 419, 754), `services/__tests__/seriesApi.test.ts` (lines 558, 571)

**Test Case (Green)**: remove each `minSourceRating`/`showMinSourceRating` reference; delete or rewrite the two `RecommendationControls.test.tsx` tests whose entire premise is `minSourceRating` visibility-by-mode, since that premise no longer exists.

## Cross-References

| Concept | Location |
|---|---|
| Backend field this UI drove, now retired | `series_spec_045_retire_min_source_rating.md` |
| Replacement personal-rating concept (different control, client-side only) | `frontend_spec_081_use_my_series_page_restructure.md` (not yet written) |

## Acceptance Criteria Summary

- [x] FRONTEND-080-AC-01: the field no longer renders
- [x] FRONTEND-080-AC-02: `RecommendationControls` no longer computes or passes `showMinSourceRating`
- [x] FRONTEND-080-AC-03: `minSourceRating` removed from `ControlsState` and the outgoing query
- [x] FRONTEND-080-AC-04: existing test scaffolding updated
