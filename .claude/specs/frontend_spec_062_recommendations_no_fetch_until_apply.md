# Frontend Spec 062: Recommendations — No Fetch Until "Apply Filters" (Any Tab)

**Status**: Implemented — `RecommendationControls.tsx` (mount effect removed, `handleTopLevelModeChange`/
`handleDiscoverSubModeChange` call `onQueryChange(undefined)` instead of firing a built query,
`onQueryChange` prop widened to accept `undefined`), `RecommendationsList.tsx` (`loading` initializes
`false`, fetch effect early-returns when `query == null`, new `data-testid="recommendations-not-searched"`
prompt gated ahead of — and the four pre-existing loading/error/empty-results/results branches now also
gated on — `query != null`, closing a gap the original Design Decisions didn't fully spell out: without
it, stale `recommendations`/`error` state from a previous mode would render simultaneously with the new
prompt after a tab switch), `RecommendationControls.test.tsx`/`RecommendationsList.test.tsx`/
`App.test.tsx` (new + rewritten test cases). Manually verified in-browser via the network tab: no
`/api/v1/series/recommendations` request fires on navigation or on switching tabs; one fires only after
clicking "Apply Filters"; switching tabs after that correctly clears the results back to the prompt.
**Priority**: P2 (product decision reversal — every visit to Recommendations fires at least one
request, including one that reaches TMDB via "Use My Series" pool sourcing, before the user has
looked at or touched a single control)
**Depends on**: Frontend Spec 040 (`frontend_spec_040_recommendation_controls_apply_and_lock.md`,
owns the "Apply Filters" gate and in-flight lock this spec extends, and whose `FRONTEND-040-AC-02`
this spec reverses) ✅, Frontend Spec 042
(`frontend_spec_042_recommendation_source_mode_reorganization.md`, owns the two-tier tab widget —
top-level tab, Discover sub-tab — whose change handlers this spec changes) ✅
**Area**: Frontend (`components/RecommendationControls.tsx`, `components/RecommendationsList.tsx`)
— no backend change; this only changes *when* the frontend calls the existing
`GET /api/v1/series/recommendations` endpoint, not its contract.

## Overview

Confirmed live (2026-09-01, via the browser network tab, not assumed): navigating to
`/recommendations` fires two requests immediately, before any user interaction —
`GET /api/v1/series/recommendations` (no params) and `GET /api/v1/series/recommendations?
sourceMode=useMySeries`, the second of which reaches TMDB backend-side via "Use My Series" pool
sourcing. This traces to an undocumented mount-only effect in `RecommendationControls.tsx`, marked
only `// Fix 3 (2026-08-28, live testing)` — not tied to any spec:

```typescript
useEffect(() => {
  onQueryChange(buildQuery(state))
}, [])
```

Separately, `frontend_spec_040` deliberately kept the "Recommendation Source" selector exempt from
its "Apply Filters" gate (`FRONTEND-040-AC-02`): switching modes fires `onQueryChange` — and
therefore a fresh request — immediately, unlike every other control. `frontend_spec_042` carried
that same immediate-fire behavior forward into both halves of the resulting two-tier tab widget
(`handleTopLevelModeChange`/`handleDiscoverSubModeChange`).

**Decided in discussion (2026-09-01)**: neither of these should fire on their own. No tab,
including whichever is selected by default, should cause a request merely by being *loaded* or
*switched to* — a request should only ever be sent when the user explicitly clicks "Apply
Filters." This spec removes the mount effect entirely and folds "Recommendation Source" (both
tiers) into the same Apply-gated flow every other control already uses, reversing
`FRONTEND-040-AC-02`.

## Design Decisions

- **The mount-only effect (`// Fix 3`) is deleted outright**, not reworked — its entire purpose
  (establishing a non-empty default query before any real trigger exists) is precisely the
  behavior this spec removes.
- **`handleTopLevelModeChange`/`handleDiscoverSubModeChange` stop calling `onQueryChange`.** Both
  already build the correct next `ControlsState` and call `setState(next)`; the only change is
  removing their trailing `onQueryChange(buildQuery(next))` call, making them behave exactly like
  every other control already gated behind `updateState`/"Apply Filters" (`frontend_spec_040`
  Requirement 1). Switching tabs updates what *would* be searched for; only "Apply Filters" and
  sends it.
- **Switching either tab also clears any already-fetched query back to `undefined`**, rather than
  leaving a previous mode's results on screen next to a different mode's now-selected controls.
  Without this, a user who applies "Use My Series" filters, looks at results, then switches to
  "Discover" would see stale "Use My Series" recommendations sitting under Discover's controls
  until they happened to click "Apply Filters" again — a mismatched, confusing state. Clearing back
  to `undefined` returns the panel to the same "not yet searched" prompt (Requirement 2) a fresh
  page load shows, for both tiers of the tab widget.
- **`RecommendationsList`'s fetch effect becomes a no-op when `query` is `undefined`** — it already
  receives `query` as a prop and re-runs on `[refreshIndex, query]`; the only change is an early
  return before calling `seriesApi.getRecommendations` when `query == null`, and not flipping
  `loading` to `true` in that case (there is nothing loading).
- **`loading`'s initial value becomes `false`, not `true`.** Today's `useState(true)` assumes a
  fetch always starts immediately on mount, which stops being true once nothing fetches until
  "Apply Filters." Starting `false` and only flipping `true` when a real fetch begins keeps the
  existing loading-spinner/`onLoadingChange` machinery (`frontend_spec_040` Requirement 2)
  otherwise completely unchanged — it already correctly reflects "is a request in flight," which is
  now `false` at mount instead of `true`.
- **A new "not yet searched" prompt, distinct from the existing empty-results messages.** The
  existing `recommendations.length === 0` branch's two messages ("mark a series as Completed"/"try
  widening your search") both presuppose a search actually ran and found nothing — showing either
  when no request has been made yet would be actively misleading. The new prompt (exact copy is an
  implementer call, not an AC) explains that filters need to be set and applied, and renders
  whenever `query == null` — checked *before* the existing `loading`/`error`/empty-results/results
  branches.
- **(Corrected during implementation, 2026-09-01) The four pre-existing branches also gained a
  `query != null` guard, not just the new prompt.** Nothing clears `recommendations`/`error` state
  when `query` goes back to `undefined` on a tab switch — without gating the existing branches too,
  a previous mode's results (or error) would render *simultaneously* with the new "not yet searched"
  prompt the moment `loading`/`error` happened to allow it, rather than the prompt fully replacing
  them as `FRONTEND-062-AC-04`'s "returns to the not-yet-searched state" intends. This is a
  clarification of the original Design Decision above, not a scope change — the four branches'
  own internal logic is otherwise untouched.
- **`onQueryChange`'s prop type widens to accept `undefined`**
  (`(query: RecommendationQuery | undefined) => void`) — `App.tsx`'s own `recommendationQuery`
  state was already typed `RecommendationQuery | undefined` from the start (it begins `undefined`
  until the first-ever request), so this is a type-signature correction, not a new capability;
  `setRecommendationQuery` already accepts `undefined` today.
- **The in-flight lock overlay (`frontend_spec_040` Requirement 2) is unaffected in contract**,
  simplified in practice: since neither tab ever fires a request on its own anymore, "a
  mode-triggered request could arrive mid-flight" (the scenario `frontend_spec_040`'s own Design
  Decisions explicitly reasoned about) can no longer happen — "Apply Filters" is the only trigger
  left to lock around. No AC changes; this is a corollary of Requirement 1, not new behavior to
  test.

---

## Requirement 1: No tab fires a request on its own — only "Apply Filters" does

**User story**: As a user opening Recommendations, I want to see and adjust my filters before
anything is fetched, and I want the same to hold no matter which Recommendation Source tab I'm on
or switch to — a request should only ever be sent when I explicitly ask for one.

### FRONTEND-062-AC-01 [AUTO]
**Statement**: `RecommendationControls` shall no longer establish a default query on mount — the
existing mount-only `useEffect` calling `onQueryChange(buildQuery(state))` shall be removed
entirely.

**References**: `RecommendationControls.tsx`'s mount effect (`// Fix 3`, not tied to any prior
spec).

**Test Case (Red)**:
```typescript
it('FRONTEND-062-AC-01: no onQueryChange call on mount', () => {
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)

  expect(onQueryChange).not.toHaveBeenCalled()
})
```
**Test Case (Green)**: delete the mount-only `useEffect`.

---

### FRONTEND-062-AC-02 [AUTO]
**Statement**: Switching the top-level Recommendation Source tab (e.g. "Use My Series" ↔
"Discover") shall update pending state only — it shall no longer call `onQueryChange`. Reverses
`FRONTEND-040-AC-02` for the top-level tab.

**References**: `RecommendationControls.tsx`'s `handleTopLevelModeChange`.

**Test Case (Red)**:
```typescript
it('FRONTEND-062-AC-02: switching the top-level tab does not call onQueryChange', () => {
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
  onQueryChange.mockClear()

  fireEvent.click(screen.getByRole('tab', { name: /discover/i }))

  expect(onQueryChange).not.toHaveBeenCalled()
})
```
**Test Case (Green)**: remove `handleTopLevelModeChange`'s trailing `onQueryChange(buildQuery(next))`
call — it keeps its `setState(next)` call unchanged.

---

### FRONTEND-062-AC-03 [AUTO]
**Statement**: Switching the Discover sub-tab (Custom Search/Trending/Highest Rated) shall
likewise update pending state only, with no `onQueryChange` call. Reverses `FRONTEND-040-AC-02` for
the Discover sub-tab.

**References**: `RecommendationControls.tsx`'s `handleDiscoverSubModeChange`.

**Test Case (Red)**:
```typescript
it('FRONTEND-062-AC-03: switching the Discover sub-tab does not call onQueryChange', () => {
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
  fireEvent.click(screen.getByRole('tab', { name: /discover/i }))
  onQueryChange.mockClear()

  fireEvent.click(screen.getByRole('tab', { name: /trending/i }))

  expect(onQueryChange).not.toHaveBeenCalled()
})
```
**Test Case (Green)**: remove `handleDiscoverSubModeChange`'s trailing
`onQueryChange(buildQuery(next))` call.

---

### FRONTEND-062-AC-04 [AUTO]
**Statement**: Switching either tier of the Recommendation Source tab widget shall call
`onQueryChange(undefined)`, clearing any previously-fetched query/results rather than leaving a
different mode's stale results displayed under the newly-selected tab's controls.

**References**: `App.tsx`'s `recommendationQuery` state (already `RecommendationQuery |
undefined`); `RecommendationControlsProps.onQueryChange`, widened to accept `undefined`.

**Test Case (Red)**:
```typescript
it('FRONTEND-062-AC-04: switching tabs clears the previous query', () => {
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
  fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))
  onQueryChange.mockClear()

  fireEvent.click(screen.getByRole('tab', { name: /discover/i }))

  expect(onQueryChange).toHaveBeenCalledWith(undefined)
})
```
**Test Case (Green)**: both `handleTopLevelModeChange`/`handleDiscoverSubModeChange` call
`onQueryChange(undefined)` (instead of the removed `onQueryChange(buildQuery(next))`) after their
existing `setState(next)`.

---

### FRONTEND-062-AC-05 [AUTO] (regression guard)
**Statement**: Clicking "Apply Filters" shall continue to call `onQueryChange(buildQuery(state))`
using the current pending state, exactly as `FRONTEND-040-AC-03` already established — unaffected
by this spec.

**Test Case (Green)**: no code change to `handleApplyFilters` — regression guard confirming the
existing `FRONTEND-040-AC-03` test still passes unmodified.

---

## Requirement 2: A distinct "not yet searched" state, and no spurious loading spinner

**User story**: As a user who hasn't applied any filters yet, I want to see an explanation of what
to do next, not a loading spinner for a request that was never sent or an empty-results message
implying a search already came up short.

### FRONTEND-062-AC-06 [AUTO]
**Statement**: `RecommendationsList`'s fetch effect shall not call `seriesApi.getRecommendations`
when `query` is `undefined`, and shall not set `loading` to `true` in that case.

**References**: `RecommendationsList.tsx`'s fetch `useEffect` (`[refreshIndex, query]`).

**Test Case (Red)**:
```typescript
it('FRONTEND-062-AC-06: no fetch when query is undefined', () => {
  render(<RecommendationsList query={undefined} />)

  expect(mockGetRecommendations).not.toHaveBeenCalled()
})
```
**Test Case (Green)**: add an early return in the fetch effect when `query == null`, before the
existing `setLoading(true)`/`seriesApi.getRecommendations(query)` calls.

---

### FRONTEND-062-AC-07 [AUTO]
**Statement**: `RecommendationsList`'s `loading` state shall initialize to `false`, not `true` —
there is no fetch in flight until a real `query` exists.

**Test Case (Red)**:
```typescript
it('FRONTEND-062-AC-07: no loading spinner when query is undefined', () => {
  render(<RecommendationsList query={undefined} />)

  expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
})
```
**Test Case (Green)**: `useState(true)` → `useState(false)` for `loading`.

---

### FRONTEND-062-AC-08 [AUTO]
**Statement**: While `query` is `undefined`, `RecommendationsList` shall render a prompt (exact
copy is an implementer call) inviting the user to set filters and click "Apply Filters" — rendered
instead of, and checked before, the existing loading/error/empty-results/results branches, none of
which change.

**Test Case (Red)**:
```typescript
it('FRONTEND-062-AC-08: shows a not-yet-searched prompt when query is undefined', () => {
  render(<RecommendationsList query={undefined} />)

  expect(screen.getByTestId('recommendations-not-searched')).toBeInTheDocument()
  expect(screen.queryByText(/no recommendations yet/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/no shows match/i)).not.toBeInTheDocument()
})
```
**Test Case (Green)**: a new `{query == null && (...)}` branch, checked ahead of the existing
`loading`/`error`/`recommendations.length === 0`/`recommendations.length > 0` branches.

---

### FRONTEND-062-AC-09 [AUTO] (regression guard)
**Statement**: Once a `query` has been set (the user has clicked "Apply Filters" at least once),
`RecommendationsList`'s loading/error/empty-results/results states shall behave exactly as they do
today — this spec only adds the one new state that precedes all of them.

**Test Case (Green)**: no code change to those four branches or their existing tests — regression
guard confirming `frontend_spec_040`'s existing `RecommendationsList.test.tsx` coverage (loading
spinner, error+Retry, both empty-results messages, results list) still passes unmodified once
`query` is non-`null`.

---

### FRONTEND-062-AC-10 [AUTO] (regression guard, adjusts `FRONTEND-040-AC-05`'s test)
**Statement**: `onLoadingChange` shall still be called on every real `loading` transition
(`FRONTEND-040-AC-05`'s own contract, unchanged) — but no longer fires with `true` on mount when
`query` is `undefined`, since nothing is loading in that case.

**Test Case (Red)**:
```typescript
it('FRONTEND-062-AC-10: onLoadingChange does not fire true on mount when query is undefined', () => {
  const onLoadingChange = vi.fn()
  render(<RecommendationsList query={undefined} onLoadingChange={onLoadingChange} />)

  expect(onLoadingChange).not.toHaveBeenCalledWith(true)
})
```
**Test Case (Green)**: falls out of AC-06/AC-07 directly — the fetch effect never sets `loading` to
`true` when `query` is `undefined`, so the existing `onLoadingChange?.(loading)` effect never fires
`true`. `FRONTEND-040-AC-05`'s original test (asserting `onLoadingChange` fires `true` then `false`)
needs its `render` call updated to pass a defined `query`, since it was implicitly relying on the
mount-always-fetches behavior this spec removes.

---

## Implementation Notes

- **`frontend_spec_040_recommendation_controls_apply_and_lock.md` needs a matching edit**: mark
  `FRONTEND-040-AC-02` superseded (`~~**FRONTEND-040-AC-02** [AUTO]~~ — superseded by
  `FRONTEND-062-AC-02`/`AC-03`: <original statement unchanged>`), update its Acceptance Criteria
  Summary line, and append a dated note to its Design Decisions pointing here — per this project's
  ID-immutability convention, the original AC text is preserved verbatim, not reworded or deleted.
- **`RecommendationControls.test.tsx`'s existing `"FRONTEND-040-AC-02: changing Recommendation
  Source still calls onQueryChange immediately"` test must be rewritten**, not left alongside the
  new `FRONTEND-062-AC-02`/`AC-03` tests — it currently asserts the exact behavior this spec
  reverses.
- **`RecommendationsList.test.tsx`'s existing `FRONTEND-040-AC-05` test** (asserting
  `onLoadingChange` is called with `true` immediately on mount) needs its `render` call updated to
  pass an explicit non-`undefined` `query`, per `FRONTEND-062-AC-10` above.
- **`API.md`** needs no change — the endpoint's contract is unaffected, only when the frontend calls
  it.

## Cross-References

| This spec | Source |
|---|---|
| "Apply Filters" gate and in-flight lock this spec extends, and whose `FRONTEND-040-AC-02` this spec reverses | `frontend_spec_040_recommendation_controls_apply_and_lock.md` |
| Two-tier tab widget (`handleTopLevelModeChange`/`handleDiscoverSubModeChange`) this spec's ACs change | `frontend_spec_042_recommendation_source_mode_reorganization.md` |
| The `query?.sourceMode === 'useMySeries'` empty-results branching this spec's new prompt is checked ahead of | `RecommendationsList.tsx` (`// Fix 2`, not tied to any prior spec) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-062-AC-01: no default query established on mount
- [x] FRONTEND-062-AC-02: switching the top-level tab doesn't call `onQueryChange`
- [x] FRONTEND-062-AC-03: switching the Discover sub-tab doesn't call `onQueryChange`
- [x] FRONTEND-062-AC-04: switching either tab clears the previous query back to `undefined`
- [x] FRONTEND-062-AC-05: "Apply Filters" still fires the pending state (regression guard)
- [x] FRONTEND-062-AC-06: no fetch when `query` is `undefined`
- [x] FRONTEND-062-AC-07: `loading` initializes `false`, not `true`
- [x] FRONTEND-062-AC-08: a distinct "not yet searched" prompt renders when `query` is `undefined`
- [x] FRONTEND-062-AC-09: existing loading/error/empty-results/results states unaffected once a query exists (regression guard)
- [x] FRONTEND-062-AC-10: `onLoadingChange` doesn't fire `true` on a query-less mount (adjusts `FRONTEND-040-AC-05`'s test)
