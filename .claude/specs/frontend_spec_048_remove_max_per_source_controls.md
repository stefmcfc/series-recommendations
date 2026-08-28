# Frontend Spec 048: Remove "Max Per Source" / "Max Sources Shown" Controls

**Status**: Not started
**Priority**: P3 (removes non-functional-under-Discover controls the user confirmed should go entirely, not
just be mode-gated, pending a later "Use My Series" revamp)
**Depends on**: none — frontend-only, no backend change.
**Area**: Frontend (`RecommendationControls.tsx`) — backend (`RecommendationCriteria.maxPerSource`/
`maxSourcesShown`, `RecommendationRankingService.applyDiversityCap`, `RecommendationDtoAssembler`'s
`effectiveMaxSourcesShown` truncation) is deliberately untouched.

## Overview

Confirmed in discussion (`.claude/SPEC_CANDIDATES.md`, "Push Discover-mode output filters upward..."): "Max Per
Source" and "Max Sources Shown" are dead controls under every Discover mode (`RecommendationService.doRecommend`
never calls `applyDiversityCap` for `trending`/`topRated`/`genreOrKeywordDirected`, and Discover candidates
always have an empty `sourceSeries()`, so `maxSourcesShown` caps nothing there either), and `RecommendationControls`
renders both **unconditionally for every mode** today, Discover included — a user can turn either dial under any
Discover tab and nothing happens.

Rather than mode-gate them (hide under Discover, keep under "Use My Series"), the decided approach is simpler:
**remove both from the frontend entirely, for now**, leaving the backend capability completely untouched. "Use
My Series" is itself queued for a larger revamp (the "Customizable recommendation 'algorithm'" candidate in
`.claude/SPEC_CANDIDATES.md`), which will very likely redesign how source-based diversity capping and "because
you watched X" display counts work entirely — building and shipping a mode-gate for controls about to be
redesigned anyway is wasted effort. Once the frontend stops sending `maxPerSource`/`maxSourcesShown`, both
simply fall back to their existing config defaults (`app.tmdb.max-per-source`, `DEFAULT_MAX_SOURCES_SHOWN`) —
zero backend behavior change, a pure frontend removal.

## Design Decisions

- **Backend stays exactly as-is.** No spec needed there — `RecommendationCriteria.maxPerSource`/
  `maxSourcesShown` already default to `null` (no override) when absent from a request, which is exactly what
  happens once the frontend stops sending them. This spec's only surface is `RecommendationControls.tsx`.
- **Full removal, not a mode-conditional hide.** Delete the two fields from `ControlsState`, their `<input>`
  markup, their entry in `handleResetFilters`'s reset patch, and their read in the query-building logic — not
  just wrap them in a `{someCondition && (...)}` guard. There's no near-term plan to bring today's exact
  controls back under any mode; when "Use My Series" gets its revamp, whatever replaces them will very likely
  look and behave differently anyway.
- **This is a genuine, if small, behavior change from the user's perspective** (two visible, interactive
  controls disappear) — not a pure refactor — so it gets a spec rather than treating it as a no-spec-needed
  maintenance pass, per this project's own "Spec first" convention's narrow exception (only for genuinely
  no-behavior-change passes).

---

## Requirement 1: Remove both controls from the frontend entirely

**User story**: As a user, I don't want to see filter controls that provably do nothing under the mode I'm
currently using, with no indication that's the case.

### FRONTEND-048-AC-01 [AUTO]
**Statement**: `RecommendationControls` shall no longer render a "Max Per Source" input, under any mode.

**References**: `RecommendationControls.tsx`'s current `recommendation-max-per-source` field, inside the
Filters disclosure body.

**Test Case (Red)**:
```typescript
describe('FRONTEND-048-AC-01: Max Per Source is never rendered', () => {
  it('does not render under any mode', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    expect(screen.queryByLabelText(/max per source/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    expect(screen.queryByLabelText(/max per source/i)).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: delete the `recommendation-max-per-source` field block entirely from
`RecommendationControls.tsx`.

---

### FRONTEND-048-AC-02 [AUTO]
**Statement**: `RecommendationControls` shall no longer render a "Max Sources Shown" input, under any mode.

**Test Case (Red)**:
```typescript
describe('FRONTEND-048-AC-02: Max Sources Shown is never rendered', () => {
  it('does not render under any mode', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    expect(screen.queryByLabelText(/max sources shown/i)).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: delete the `recommendation-max-sources-shown` field block entirely.

---

### FRONTEND-048-AC-03 [AUTO]
**Statement**: The emitted `RecommendationQuery` shall never include `maxPerSource` or `maxSourcesShown`,
regardless of mode or prior state.

**References**: `applyExcludeAndMiscFilters`'s existing `state.maxPerSource`/`state.maxSourcesShown` reads.

**Test Case (Red)**:
```typescript
describe('FRONTEND-048-AC-03: query never includes maxPerSource/maxSourcesShown', () => {
  it('omits both fields from the emitted query', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.not.objectContaining({
        maxPerSource: expect.anything(),
        maxSourcesShown: expect.anything(),
      }),
    )
  })
})
```
**Test Case (Green)**: remove `maxPerSource`/`maxSourcesShown` from `ControlsState` and their reads from
`applyExcludeAndMiscFilters` — confirms this is a real state/logic removal, not just a hidden input whose value
still leaks into the request.

---

### FRONTEND-048-AC-04 [AUTO]
**Statement**: `handleResetFilters` shall no longer reference `maxPerSource`/`maxSourcesShown` in its reset
patch.

**Test Case (Green)**: remove the two lines from `handleResetFilters`'s `updateState({...})` call — a direct
consequence of AC-03's `ControlsState` field removal (the fields no longer exist to reset), verified by
`tsc`/the test suite failing to compile/pass if a stray reference is left behind.

---

## Implementation Notes

- Remove the two fields' existing Vitest tests/assertions in `RecommendationControls.test.tsx` rather than
  adapting them — the controls no longer exist, so there's nothing left to test beyond AC-01/02/03 above.
- No `API.md`/`RUNBOOK.md` change — the backend request fields (`maxPerSource`/`maxSourcesShown`) still exist
  and are still documented; only the frontend UI that used to set them is removed. Worth a quick check that
  `API.md` doesn't specifically say "set via the Max Per Source/Max Sources Shown UI controls" anywhere that
  would now be misleading (unlikely, but confirm).

## Cross-References

| This spec | Source |
|---|---|
| Confirmed dead-under-Discover finding and the "remove entirely" decision | `.claude/SPEC_CANDIDATES.md`, "Push Discover-mode output filters upward..." |
| Where these controls' real redesign belongs, once "Use My Series" is revamped | `.claude/SPEC_CANDIDATES.md`, "Customizable recommendation 'algorithm'..." |
| Backend fields/behavior this spec deliberately leaves untouched | `series_spec_007_recommendation_sourcing.md` (`maxPerSource`), `series_spec_015_multi_source_recommendations.md` (`maxSourcesShown`) |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-048-AC-01: Max Per Source is never rendered
- [ ] FRONTEND-048-AC-02: Max Sources Shown is never rendered
- [ ] FRONTEND-048-AC-03: emitted query never includes either field
- [ ] FRONTEND-048-AC-04: `handleResetFilters` no longer references either field
