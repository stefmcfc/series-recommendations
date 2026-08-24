# Frontend Spec 031: Genre & Keyword Mode Sort-By Relabel

**Status**: Implemented (2026-08-24). One-line change: `RecommendationControls.tsx`'s label ternary extended
from `state.mode === 'topRated'` to `state.mode === 'topRated' || state.mode === 'genre'`. Verified via
`RecommendationControls.test.tsx` (50/50 passing) — a pre-existing test that asserted the old (wrong) behavior
for Genre & Keyword mode was updated as part of this fix's red/green cycle rather than left contradicting the
new spec.
**Addendum (2026-08-24)**: this spec's "Vote Average" relabel for `genre` mode was superseded by
`frontend_spec_033_discover_native_sort_controls.md`, which replaces it (and `topRated`'s matching relabel from
`frontend_spec_030`) with four real, distinct TMDB-backed sort options for both modes. The relabel described
above is no longer present in the codebase; this entry is left as-is as a historical record.
**Priority**: Low
**Depends on**: `frontend_spec_030_discover_filters_and_sort_controls.md`, `series_spec_024_discover_filters_and_vote_threshold.md`
**Area**: Frontend (`RecommendationControls.tsx`)

## Overview

`frontend_spec_030` relabeled the "Most Recommended" sort option to "Vote Average" for `topRated` (Highest
Rated) mode, because that mode's candidates are never sourced from the tracked list — `totalSourceCount` is
always `0`, making "Most Recommended" a meaningless sort there. A live review on 2026-08-24 found the exact
same problem in `genre` (Genre & Keyword) mode, missed during that spec's own investigation.

Confirmed by reading `RecommendationService.java`: `sourceByGenreOrKeyword()` (the method backing `genre` mode)
always constructs its `RawCandidate`s with a `null` source series, identically to `sourceTrending()`/
`sourceTopRated()` — genre/keyword-sourced candidates are never linked back to a tracked series. So
`totalSourceCount` is always `0` for this mode too, and `score()`'s `rankScore` formula for a candidate with
`dc.sourceSeries().isEmpty()` is exactly `tmdbRating` (no personal-rating blend) — the identical formula
`topRated` already got relabeled for. This spec applies the same fix to `genre` mode. No backend change is
needed; this is a pure frontend relabel, since the underlying data (`totalSourceCount`, `rankScore`) is already
correct — only the label was misleading.

**Confirmed unaffected**: `automatic` and `specific` modes are sourced from the tracked pool
(`sourceFromPool()`), so `totalSourceCount` and the personal-rating blend are both real there — "Best Match"
and "Most Recommended" keep their current, meaningful behavior on those two modes. `trending` mode already
hides the Sort By control entirely (`frontend_spec_030`) and is untouched by this spec.

## Requirement 1: Relabel "Most Recommended" for Genre & Keyword mode

**User story**: As a user browsing recommendations by genre/keyword, I want the sort option labeled accurately,
so I don't expect a "recommended by N of your shows" signal that doesn't exist for this mode.

### FRONTEND-031-AC-01 [AUTO]
**Statement**: While `RecommendationControls`' `mode` is `'genre'`, the `Sort By` fieldset's second radio option
shall be labeled "Vote Average" instead of "Most Recommended", matching the existing `'topRated'` behavior.

**Rationale**: `genre` mode's candidates always have `totalSourceCount: 0` (never sourced from the tracked
list), and its `rankScore` is exactly `tmdbRating` — identical to `topRated`'s situation that `frontend_spec_030`
already fixed. Leaving the old label suggests a personalized signal that isn't there.

**References**:
- Component: `frontend/src/components/RecommendationControls.tsx` (the ternary at the "Most Recommended"/"Vote
  Average" label, currently `state.mode === 'topRated' ? 'Vote Average' : 'Most Recommended'`)
- Related: `FRONTEND-030-AC-13` (the original `topRated` relabel this extends the same condition to)

**Test Case (Red)**:
```typescript
describe('FRONTEND-031-AC-01: Genre & Keyword mode relabels Most Recommended to Vote Average', () => {
  it('shows "Vote Average" when mode is genre', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Genre & Keyword'))
    expect(screen.getByLabelText('Vote Average')).toBeInTheDocument()
    expect(screen.queryByLabelText('Most Recommended')).not.toBeInTheDocument()
  })

  it('still shows "Most Recommended" for automatic/specific modes', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    expect(screen.getByLabelText('Most Recommended')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Specific Series'))
    expect(screen.getByLabelText('Most Recommended')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: change the label condition to
`state.mode === 'topRated' || state.mode === 'genre' ? 'Vote Average' : 'Most Recommended'`.

### FRONTEND-031-AC-02 [AUTO]
**Statement**: The `Sort By` fieldset shall continue to render (not hide) under `genre` mode — only the label
changes, the control itself and both radio options remain available and functional, since `rankScore`
("Best Match") still meaningfully differs from a pure vote-average tiebreak-free sort when combined with the
existing output filters.

**Rationale**: Unlike `trending` (a true no-op, hidden entirely by `frontend_spec_030`), `genre` mode's
"Best Match"/rankScore sort still does real work — it's only the second option's label that was wrong, not the
control's usefulness as a whole.

**References**:
- Component: `frontend/src/components/RecommendationControls.tsx`, the `state.mode !== 'trending'` guard around
  `sortByFieldset` — unchanged by this spec.

**Test Case (Red)**:
```typescript
it('FRONTEND-031-AC-02: Sort By fieldset still renders under genre mode', () => {
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText('Genre & Keyword'))
  expect(screen.getByText('Sort By')).toBeInTheDocument()
})
```

**Test Case (Green)**: no change needed if `FRONTEND-031-AC-01`'s fix doesn't touch the surrounding
`state.mode !== 'trending'` guard — included as an explicit regression check.

## Cross-references

| Reference | Relationship |
|---|---|
| `frontend_spec_030_discover_filters_and_sort_controls.md` | Establishes the `topRated` relabel this spec extends to `genre` |
| `series_spec_024_discover_filters_and_vote_threshold.md` | Backend rationale doc for why `topRated`'s "Most Recommended" was misleading — same rationale applies to `genre` |
| `RecommendationService.java` `sourceByGenreOrKeyword()`/`score()` | Backend behavior confirming `genre` mode always has `totalSourceCount: 0` |

## Acceptance Criteria Summary

- [x] FRONTEND-031-AC-01: "Most Recommended" relabeled to "Vote Average" under Genre & Keyword mode
- [x] FRONTEND-031-AC-02: Sort By fieldset still renders (not hidden) under Genre & Keyword mode
