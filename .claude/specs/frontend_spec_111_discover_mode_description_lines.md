# Frontend Spec 111: Discover Sub-Tab Description Lines

**Status**: Not started
**Priority**: P4 (small copy/clarity addition, no behavior change)
**Depends on**: none — frontend-only, no backend pairing
**Area**: Frontend (`components/CustomSearchPanel.tsx`, `components/TrendingPanel.tsx`,
`components/RecommendationControls.tsx`, and each affected file's tests)

## Overview

`UseMySeriesPanel.tsx` already has a one-line, always-visible description above its fields
("Narrow to specific series (optional) — leave empty to use your top-rated completed shows
automatically.", `.hint` class from `RecommendationControls.module.css`) explaining what that mode
does. None of the three Discover sub-tabs (Custom Search / Popular Right Now / Highest Rated) has
an equivalent line — a user switching into "Popular Right Now" or "Highest Rated" has no in-app
explanation of what those modes actually source from or how they differ from Custom Search or from
each other. This spec adds the same treatment to all three.

**A real structural gap found while grounding this spec, not previously known**: confirmed via
reading `RecommendationControls.tsx` (~lines 997-1066) that "Highest Rated" (`topRated`) has **no
dedicated tabpanel element at all** today. Custom Search and Popular Right Now each render their own
`role="tabpanel"` wrapper (`CustomSearchPanel.tsx`, `TrendingPanel.tsx`) conditionally on
`state.discoverMode`; Highest Rated's tab button declares `aria-controls="discover-panel-top-rated"`,
but no element with that `id` is ever rendered anywhere — because Highest Rated has no fields unique
to itself (everything it needs — Sort By, output filters — already renders unconditionally via
`HighestRatedPanel`/`RecommendationFiltersBox` regardless of which Discover sub-tab is active), so no
component was ever built for it. This spec must therefore add a small new conditional block directly
in `RecommendationControls.tsx` for Highest Rated's hint, which also incidentally fixes the
previously-dangling `aria-controls` reference — a side effect worth calling out, not something this
spec set out to fix on its own.

## Design Decisions

- **A plain always-visible `<p className={styles.hint}>`, not a disclosure/tooltip.** This matches
  `UseMySeriesPanel.tsx`'s exact existing precedent and reuses the already-shared `.hint` class
  (`RecommendationControls.module.css`, imported by all four panel files already). This is
  deliberately a **different UI shape** from the still-open "Info/disclosure boxes" spec candidate
  (`.claude/SPEC_CANDIDATES.md`) — that idea is a click-to-expand `?`/`ⓘ` toggle for Settings fields
  and the Sort By control; this is a short, permanent sentence, the same treatment "Use My Series"
  already has. Both were raised in the same 2026-09-09 pass but are not the same feature.
- **`HighestRatedPanel.tsx` is not touched.** Despite its name, that component is the shared
  cross-mode "Sort By" fieldset (per its own existing code comment: "named for the sub-mode (Highest
  Rated) this spec's Requirement 4 groups it with, though it renders under every mode except Popular
  Right Now") — not a real per-mode content panel. Highest Rated's hint instead needs a small new
  wrapper block directly in `RecommendationControls.tsx`, sibling to the existing
  `state.discoverMode === 'trending'`/`'customSearch'` conditional blocks.
- **Wording is grounded in `series_spec_022_trending_and_top_rated_recommendations.md`'s documented
  backend semantics**, not guessed: Popular Right Now bypasses ranking entirely and keeps TMDB's own
  trending order; Highest Rated applies a minimum vote-count floor specifically so a handful of
  perfect scores can't dominate. Both facts are called out in the hint text below since they're the
  kind of non-obvious behavior a description line exists to surface.

---

## Requirement 1: Custom Search gains a description line

**User story**: As a user switching into Custom Search, I want a one-line reminder of what this
mode does, matching the clarity "Use My Series" already gives me.

### FRONTEND-111-AC-01 [AUTO]
**Statement**: `CustomSearchPanel.tsx`'s `role="tabpanel"` div shall render a new `<p
className={styles.hint}>` as its first child (before `.genreKeywordFields` and every other field),
containing the text: "Search TMDB directly using your own combination of genres, keywords, ratings,
and other filters — not based on your watched shows."

**References**: `UseMySeriesPanel.tsx`'s existing hint paragraph (line ~225), the exact placement
and class this mirrors; `CustomSearchPanel.tsx`'s `role="tabpanel"` div (line ~71).

**Test Case (Red)**:
```typescript
// src/components/CustomSearchPanel.test.tsx (additions)
describe('FRONTEND-111-AC-01: Custom Search description line', () => {
  it('renders a hint explaining what Custom Search does', () => {
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    expect(
      screen.getByText(/search tmdb directly using your own combination/i),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the hint paragraph until the spec above passes.

---

## Requirement 2: Popular Right Now gains a description line

**User story**: As a user switching into Popular Right Now, I want to know this shows globally
trending shows, not something personalized to me.

### FRONTEND-111-AC-02 [AUTO]
**Statement**: `TrendingPanel.tsx`'s `role="tabpanel"` div shall render a new `<p
className={styles.hint}>` as its first child (before the "Trending Window" fieldset), containing the
text: "Shows trending globally on TMDB right now — not personalized to your ratings, genres, or
watch history."

**References**: `TrendingPanel.tsx`'s `role="tabpanel"` div (line ~14); `series_spec_022`'s Design
Decisions ("Trending mode bypasses the watched pool entirely and does not re-rank TMDB's own
ordering... that ordering *is* the feature"), the source for this wording.

**Test Case (Red)**:
```typescript
// src/components/TrendingPanel.test.tsx (additions)
describe('FRONTEND-111-AC-02: Popular Right Now description line', () => {
  it('renders a hint explaining what Popular Right Now does', () => {
    render(<TrendingPanel state={makeState()} updateState={vi.fn()} />)
    expect(
      screen.getByText(/trending globally on tmdb right now/i),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the hint paragraph until the spec above passes.

---

## Requirement 3: Highest Rated gains a tabpanel wrapper and description line

**User story**: As a user switching into Highest Rated, I want to know this is TMDB's overall
top-rated list (with a sensible vote-count floor), not something drawn from my own series.

### FRONTEND-111-AC-03 [AUTO]
**Statement**: `RecommendationControls.tsx` shall render a new block, sibling to the existing
`state.discoverMode === 'trending'`/`'customSearch'` conditional blocks (~line 1053-1064), when
`state.discoverMode === 'topRated'`:

```tsx
{state.discoverMode === 'topRated' && (
  <div
    role="tabpanel"
    id="discover-panel-top-rated"
    aria-labelledby="discover-tab-top-rated"
    className={styles.tabPanel}
  >
    <p className={styles.hint}>
      TMDB's highest-rated shows overall, with a minimum vote count so a
      handful of perfect scores can't dominate — not personalized to your
      watch history.
    </p>
  </div>
)}
```

This is the first element ever rendered with `id="discover-panel-top-rated"` — the Highest Rated tab
button's existing `aria-controls="discover-panel-top-rated"` (line ~1042) previously referenced no
element at all; this AC resolves that as a side effect, not a separately-scoped fix.

**References**: `RecommendationControls.tsx`'s existing `trending`/`customSearch` conditional blocks
(the structural pattern this mirrors); the Highest Rated tab button's pre-existing `aria-controls`
(line ~1042); `series_spec_022`'s Design Decisions ("Top-rated mode reuses the existing
`minVoteCount` output filter as the actual TMDB query parameter... a minimum vote-count floor so a
handful of 10/10 votes doesn't dominate"), the source for this wording.

**Test Case (Red)**:
```typescript
// src/components/RecommendationControls.test.tsx (additions)
describe('FRONTEND-111-AC-03: Highest Rated description line', () => {
  it('renders a tabpanel with a hint when Highest Rated is selected', () => {
    render(<RecommendationControls {...defaultProps} />)
    fireEvent.click(screen.getByRole('tab', { name: /discover/i }))
    fireEvent.click(screen.getByRole('tab', { name: /highest rated/i }))
    expect(
      screen.getByText(/tmdb's highest-rated shows overall/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('tabpanel', { name: /highest rated/i })).toHaveAttribute(
      'id',
      'discover-panel-top-rated',
    )
  })
})
```
**Test Case (Green)**: add the new conditional block until the spec above passes.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `.hint` class and placement precedent this spec's three lines all follow | `UseMySeriesPanel.tsx` (line ~225), `RecommendationControls.module.css`'s `.hint` |
| Trending's "keep TMDB's own order, don't re-rank" behavior, grounding `FRONTEND-111-AC-02`'s wording | `series_spec_022_trending_and_top_rated_recommendations.md` |
| Top-rated's minimum-vote-count floor, grounding `FRONTEND-111-AC-03`'s wording | `series_spec_022_trending_and_top_rated_recommendations.md` |
| Why `HighestRatedPanel.tsx` isn't touched by this spec (it's the shared Sort By fieldset, not a per-mode panel) | `tooling_spec_008_recommendation_controls_decomposition.md`, `HighestRatedPanel.tsx`'s own existing code comment |
| Distinct from the still-open, different-shaped "Info/disclosure boxes" idea | `.claude/SPEC_CANDIDATES.md` |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-111-AC-01: `CustomSearchPanel.tsx` gains a `.hint` description line
- [ ] FRONTEND-111-AC-02: `TrendingPanel.tsx` gains a `.hint` description line
- [ ] FRONTEND-111-AC-03: `RecommendationControls.tsx` gains a new `discover-panel-top-rated` tabpanel wrapper + `.hint` description line, resolving the previously-dangling `aria-controls` reference as a side effect
