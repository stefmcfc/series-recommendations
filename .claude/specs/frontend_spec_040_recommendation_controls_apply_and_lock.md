# Frontend Spec 040: Recommendation Controls — Explicit "Apply Filters" & In-Flight Request Locking

**Status**: Implemented (2026-08-27) — `RecommendationControls.tsx`/`.module.css`,
`RecommendationsList.tsx`, `App.tsx`, `RecommendationControls.test.tsx`,
`RecommendationsList.test.tsx`
**Priority**: P2 (fixes a live, user-reported usability problem — the Recommendations panel appears to stop
refreshing when a filter combination produces a heavier/slower request)
**Depends on**: Frontend Spec 011 (`frontend_spec_011_recommendation_controls.md`, owns `RecommendationControls.tsx`
and its `ControlsState`/`updateState`/`onQueryChange` wiring) ✅, Frontend Spec 035
(`frontend_spec_035_specific_series_picker.md`, confirms the Specific Series picker's own genre/status/sort state
is already client-side-only and out of scope for this spec) ✅
**Area**: Frontend (`RecommendationControls.tsx`, `RecommendationsList.tsx`, `App.tsx`) — no backend change needed.

## Overview

Reported live: after raising "Max Per Source" to 35 in Automatic/Best Match mode, the Recommendations panel
appeared to stop refreshing. Root cause, confirmed by reading the current code (not assumed):

`RecommendationControls`'s `updateState` (the single choke point every control in this component funnels through)
calls `onQueryChange` **synchronously, on every state change, with no debouncing**:

```typescript
const updateState = (patch: Partial<ControlsState>) => {
  const next = { ...state, ...patch }
  setState(next)
  onQueryChange(buildQuery(next))
}
```

`onQueryChange` is `App.tsx`'s `setRecommendationQuery`, which `RecommendationsList` watches via a `useEffect`
keyed on `[refreshIndex, query]` — so **every single change fires a brand-new backend request immediately**,
including one keystroke at a time in a numeric field. `RecommendationsList`'s fetch effect does guard against a
*stale response overwriting a newer one* (a `cancelled` flag set in its cleanup function), so results are never
shown out of order — but every one of those superseded requests still executes fully server-side (including,
depending on mode, per-candidate TMDB calls) before being discarded client-side. A larger "Max Per Source" value
means more work per request, so rapid changes compound: each new request takes longer, in-flight ones pile up
server-side, and — critically — **`loading` is never set back to `true` after the first successful load**
(`RecommendationsList`'s `loading` state only starts `true` on mount and is reset by `handleRetry`, not by a `query`
change), so none of this is visible to the user. The panel just appears to sit there showing stale results with no
indication anything is happening — which is exactly what was reported as "no longer refreshing."

This spec fixes both the cause (uncontrolled request fan-out) and the symptom (no feedback while a request is
genuinely in flight):

1. Every control **except** the "Recommendation Source" mode selector stops auto-firing a request on change.
   Changes accumulate in local state as before (so the UI still reflects what you've selected/typed), but nothing
   is sent to the backend until an explicit **"Apply Filters"** button is clicked.
2. While a request is in flight (whether triggered by changing "Recommendation Source" or clicking "Apply
   Filters"), the controls panel is visually and functionally locked — an overlay reading "Processing
   recommendations…" (with the same spinner `RecommendationsList` already uses) covers the panel, and the
   "Recommendation Source" radios and "Apply Filters" button are both disabled — so a second request can't be
   fired while the first is still running.

## Design Decisions

- **"Recommendation Source" is the one control that keeps today's auto-fetch-on-change behavior**, per explicit
  instruction — switching between Automatic/Specific Series/Genre & Keyword/Popular Right Now/Highest Rated is a
  deliberate, discrete choice (not fine-grained tuning), and today's immediate-fetch behavior there isn't the
  problem being reported. Every other control funnels through the new "Apply Filters" gate instead.
- **Everything that currently calls `updateState` (and therefore `onQueryChange`) becomes Apply-gated**, confirmed
  by enumerating every `updateState(...)` call site in the current file: `handleSpecificSeriesSelectionChange`
  (picking a chip in the Specific Series picker), `handleGenreToggle` (Genre & Keyword mode's genre checkboxes),
  the shared numeric-field handler backing Min Source Rating/Min TMDB Rating/Year Min/Year Max/Max Per Source/Max
  Sources Shown/etc., `handleMinVoteCountChange`, `handleResetFilters`, `handleSortByChange`,
  `handleDiscoverSortByChange`, the Trending Window `day`/`week` radios, and the Genre & Keyword `KeywordPicker`'s
  `onChange`. **Not** in scope: the Specific Series picker's own genre/status filter and sort control
  (`specificSeriesGenreFilter`/`specificSeriesStatusFilter`/`specificSeriesSortBy`/`specificSeriesSortDirection`) —
  confirmed these already use their own local `useState`, entirely separate from `ControlsState`, and never call
  `updateState`/reach the backend at all (`frontend_spec_035`'s own Design Decisions). They're unaffected by this
  spec either way and don't need gating.
- **`handleResetFilters` is Apply-gated too, not a special case.** Clicking "Reset" resets the pending (not-yet-
  applied) filter state immediately, exactly as it does today, but — like every other control now — doesn't itself
  fire a request. The user still clicks "Apply Filters" afterward to actually reset what's shown. This is a
  deliberate simplification (no special-cased "instant apply" list) over introducing an exception a user would have
  to learn.
- **No "unapplied changes" dirty-state indicator in this pass.** "Apply Filters" is always enabled (except while
  locked, see Requirement 2) regardless of whether anything has actually changed since the last request — clicking
  it with no pending changes just re-runs the same query, which is harmless. A visual "you have unsaved changes"
  affordance is a reasonable follow-up but isn't needed to fix the reported problem, and this spec deliberately
  keeps to the smallest change that does.
- **"Apply Filters" is placed at the bottom of the controls panel**, after the "Filters" disclosure section —
  mirroring this project's existing form-submission convention (`AddSeriesForm`/`EditSeriesForm` both place their
  submit button at the end of the form, not the top), rather than inventing a new top-of-panel placement.
- **The in-flight lock covers the entire controls panel, including the "Recommendation Source" radios** — not just
  the newly-added "Apply Filters" button. "Recommendation Source" keeps auto-fetch-on-*change* (Design Decision 1
  above), but while *any* request (mode-triggered or Apply-triggered) is already in flight, every control including
  the mode radios is locked until it resolves. This is the more literal, simpler reading of "locking any further
  calls until the current one is completed" than a partial lock would be, and avoids the extra complexity of
  reasoning about a mode change that arrives mid-request (cancel-and-restart vs. queue vs. ignore).
- **Loading state is lifted from `RecommendationsList` up to `App.tsx`**, mirroring the existing
  `onQueryChange`/`setRecommendationQuery` callback pattern exactly, rather than restructuring which component owns
  the fetch. `RecommendationsList` gains an optional `onLoadingChange?: (loading: boolean) => void` prop, called
  whenever its internal `loading` state changes; `App.tsx` stores that in a new `recommendationsLoading` state
  variable and passes it down to `RecommendationControls` as a new `loading: boolean` prop. `RecommendationsList`
  keeps owning the actual fetch and its own `loading`/`error`/`recommendations` state exactly as today — this spec
  only adds a read-only broadcast of that existing state upward, not a new source of truth.
- **The overlay reuses `RecommendationsList`'s existing spinner markup exactly** (same inline SVG, same
  `<output>`/`aria-label` structure) rather than introducing a new loading-indicator shape — this codebase already
  has exactly one spinner precedent; this spec is another instance of it, not a second design.
- **`RecommendationsList`'s own existing "Loading recommendations..." state is unaffected and stays exactly as-is**
  — this spec adds a *second*, independent loading indicator (the new overlay on the controls panel) alongside the
  existing one (which replaces the results area itself). They'll often be visible at the same time, which is
  correct and expected — they're telling the user about the same in-flight request from two different parts of the
  screen.

---

## Requirement 1: "Apply Filters" gates every control except "Recommendation Source"

**User story**: As a user tuning recommendation filters, I want my changes to only be sent to the backend when I
explicitly ask for it, so adjusting several fields (or typing a multi-digit number) doesn't fire a separate request
per change.

### FRONTEND-040-AC-01 [AUTO]
**Statement**: Every existing `updateState(...)` call site **except** `handleModeChange` shall update local
component state only, and shall **not** call `onQueryChange`.

**References**: `RecommendationControls.tsx` — every `updateState` call site enumerated in Design Decisions.

**Test Case (Red)**:
```typescript
it('FRONTEND-040-AC-01: changing a filter updates local state but does not call onQueryChange', () => {
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
  onQueryChange.mockClear() // clear the initial mount call

  fireEvent.click(screen.getByLabelText(/^most recommended/i)) // Sort By radio

  expect(onQueryChange).not.toHaveBeenCalled()
  expect(screen.getByLabelText(/^most recommended/i)).toBeChecked() // local state did update
})
```
**Test Case (Green)**: split `updateState` into a state-only update and a separate explicit-apply action (AC-03);
repoint every non-mode call site at the former.

---

### FRONTEND-040-AC-02 [AUTO]
**Statement**: `handleModeChange` (the "Recommendation Source" radios) shall continue to call `onQueryChange`
immediately on change, unchanged from today's behavior.

**References**: `RecommendationControls.tsx`'s `handleModeChange`.

**Test Case (Red)**:
```typescript
it('FRONTEND-040-AC-02: changing Recommendation Source still calls onQueryChange immediately', () => {
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
  onQueryChange.mockClear()

  fireEvent.click(screen.getByLabelText(/genre & keyword/i))

  expect(onQueryChange).toHaveBeenCalled()
})
```
**Test Case (Green)**: no change needed to `handleModeChange` itself — this is a regression guard confirming it
wasn't accidentally swept into the same gating as every other control.

---

### FRONTEND-040-AC-03 [AUTO]
**Statement**: A new "Apply Filters" button shall render at the bottom of the controls panel, after the "Filters"
disclosure section. Clicking it shall call `onQueryChange(buildQuery(state))` using whatever the current
(pending) state is at the moment of the click.

**References**: `RecommendationControls.tsx`'s render, after the existing `filtersSection`/`resetButton` markup.

**Test Case (Red)**:
```typescript
it('FRONTEND-040-AC-03: Apply Filters sends the current pending state', () => {
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
  onQueryChange.mockClear()

  fireEvent.click(screen.getByLabelText(/^most recommended/i))
  expect(onQueryChange).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

  expect(onQueryChange).toHaveBeenCalledWith(
    expect.objectContaining({ sortBy: 'recommendationCount' }),
  )
})
```
**Test Case (Green)**: add the button and its click handler, calling `onQueryChange(buildQuery(state))`.

---

### FRONTEND-040-AC-04 [AUTO]
**Statement**: `handleResetFilters` shall continue to reset the relevant fields in local state exactly as today,
and shall **not** call `onQueryChange` on its own — the user applies the reset via "Apply Filters" like any other
change.

**References**: `RecommendationControls.tsx`'s `handleResetFilters`.

**Test Case (Red)**:
```typescript
it('FRONTEND-040-AC-04: Reset updates local state without firing a request', () => {
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
  fireEvent.click(screen.getByLabelText(/genre & keyword/i))
  fireEvent.click(screen.getByRole('button', { name: /^filters$/i })) // open the disclosure
  fireEvent.change(screen.getByLabelText(/min tmdb rating/i), { target: { value: '5' } })
  onQueryChange.mockClear()

  fireEvent.click(screen.getByRole('button', { name: /^reset$/i }))

  expect(onQueryChange).not.toHaveBeenCalled()
  expect(screen.getByLabelText(/min tmdb rating/i)).toHaveValue(null)
})
```
**Test Case (Green)**: no change to `handleResetFilters`'s own logic — confirm it no longer calls `onQueryChange`
as a side effect of the AC-01 refactor.

---

## Requirement 2: Lock the controls panel while a request is in flight

**User story**: As a user, I want clear feedback and to be prevented from firing another request while one is
already running, so I'm never left wondering whether anything is happening and can't accidentally pile up
overlapping requests.

### FRONTEND-040-AC-05 [AUTO]
**Statement**: `RecommendationsList` shall accept an optional `onLoadingChange?: (loading: boolean) => void` prop,
called whenever its internal `loading` state changes (including the initial mount and every subsequent fetch).

**References**: `RecommendationsList.tsx`.

**Test Case (Red)**:
```typescript
it('FRONTEND-040-AC-05: onLoadingChange is called as loading transitions', async () => {
  const onLoadingChange = vi.fn()
  mockGetRecommendations.mockResolvedValue([])
  render(<RecommendationsList onLoadingChange={onLoadingChange} />)

  expect(onLoadingChange).toHaveBeenCalledWith(true)
  await waitFor(() => expect(onLoadingChange).toHaveBeenLastCalledWith(false))
})
```
**Test Case (Green)**: add a `useEffect` watching `loading`, calling `onLoadingChange?.(loading)`.

---

### FRONTEND-040-AC-06 [AUTO]
**Statement**: `App.tsx` shall track a new `recommendationsLoading` state, passed to `RecommendationsList` as
`onLoadingChange={setRecommendationsLoading}` and to `RecommendationControls` as a new `loading` prop.

**References**: `App.tsx`.

**Test Case (Green)**: no dedicated unit test — covered end-to-end by AC-07/AC-08's tests, which pass `loading`
directly to `RecommendationControls` to verify its own behavior; `App.tsx`'s wiring is a thin pass-through.

---

### FRONTEND-040-AC-07 [AUTO]
**Statement**: While `RecommendationControls`'s new `loading` prop is `true`, an overlay reading "Processing
recommendations…" shall cover the controls panel, reusing the same spinner SVG markup
`RecommendationsList`'s existing loading state already renders.

**References**: `RecommendationsList.tsx`'s existing `<output className={styles.loading} aria-label="Loading">`
block (the spinner SVG to copy), `RecommendationControls.tsx`'s render.

**Test Case (Red)**:
```typescript
it('FRONTEND-040-AC-07: loading=true renders the processing overlay', () => {
  render(<RecommendationControls onQueryChange={vi.fn()} loading={true} />)

  expect(screen.getByText(/processing recommendations/i)).toBeInTheDocument()
})

it('FRONTEND-040-AC-07: loading=false renders no overlay', () => {
  render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

  expect(screen.queryByText(/processing recommendations/i)).not.toBeInTheDocument()
})
```
**Test Case (Green)**: conditionally render the overlay `<output>` block when `loading` is `true`.

---

### FRONTEND-040-AC-08 [AUTO]
**Statement**: While `loading` is `true`, the "Recommendation Source" radio inputs and the "Apply Filters" button
shall all be `disabled`.

**References**: `RecommendationControls.tsx`'s Recommendation Source `<input type="radio">` elements, the new
"Apply Filters" button.

**Test Case (Red)**:
```typescript
it('FRONTEND-040-AC-08: Recommendation Source and Apply Filters are disabled while loading', () => {
  render(<RecommendationControls onQueryChange={vi.fn()} loading={true} />)

  expect(screen.getByLabelText(/^automatic/i)).toBeDisabled()
  expect(screen.getByLabelText(/genre & keyword/i)).toBeDisabled()
  expect(screen.getByRole('button', { name: /apply filters/i })).toBeDisabled()
})
```
**Test Case (Green)**: add `disabled={loading}` to each.

---

### FRONTEND-040-AC-09 [AUTO]
**Statement**: A click on a disabled "Recommendation Source" radio or a disabled "Apply Filters" button while
`loading` is `true` shall not call `onQueryChange` — the native `disabled` attribute already prevents this, but is
pinned explicitly as a regression guard.

**References**: covered by standard DOM `disabled`-input behavior; no new application code beyond AC-08.

**Test Case (Red)**:
```typescript
it('FRONTEND-040-AC-09: a disabled control does not fire onQueryChange when clicked', () => {
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} loading={true} />)
  onQueryChange.mockClear()

  fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

  expect(onQueryChange).not.toHaveBeenCalled()
})
```
**Test Case (Green)**: none expected beyond AC-08 — confirms `disabled` alone is sufficient.

---

## Implementation Notes

- **`RecommendationsList`'s fetch effect now calls `setLoading(true)` at the top of every run, not just via
  `useState`'s initial value.** This wasn't spelled out as its own AC, but AC-05's statement ("called whenever its
  internal `loading` state changes ... including ... every subsequent fetch") only holds if `loading` genuinely
  transitions back to `true` on a `query`/`refreshIndex` change — before this fix it never did (this is the
  Overview's "critically" clause), so a real fetch triggered by Apply Filters or a mode change would have shown
  neither this component's own "Loading recommendations..." state nor the new `onLoadingChange` broadcast. Fixing
  this is what makes both loading indicators added by this spec actually fire on a real subsequent request, not just
  on mount.
- **`RecommendationControls.test.tsx`'s existing `{ name: /filters/i } ` selectors were tightened to
  `{ name: /^filters$/i }`** (anchored) where they meant the "Filters" disclosure toggle specifically — the new
  "Apply Filters" button also matches the loose `/filters/i` substring pattern, which made `getByRole` ambiguous
  (two matching buttons) in every test using it. No behavioral change, just disambiguation.

## Cross-References

| This spec | Source |
|---|---|
| `RecommendationControls.tsx`'s `ControlsState`/`updateState`/`onQueryChange` wiring, every existing `updateState` call site being gated | `frontend_spec_011_recommendation_controls.md` |
| The Specific Series picker's own client-side-only genre/status/sort state, confirmed out of scope | `frontend_spec_035_specific_series_picker.md` |
| `RecommendationsList.tsx`'s existing `loading`/spinner markup being reused for the new overlay, and its existing `cancelled`-flag stale-response guard (still relied on, unchanged) | `frontend_spec_010_recommendations.md` |
| `App.tsx`'s `onQueryChange`/`setRecommendationQuery` wiring, the pattern `onLoadingChange`/`recommendationsLoading` mirrors | `frontend_spec_011_recommendation_controls.md` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-040-AC-01: every `updateState` call site except mode change stops calling `onQueryChange`
- [x] FRONTEND-040-AC-02: `handleModeChange` still calls `onQueryChange` immediately (regression guard)
- [x] FRONTEND-040-AC-03: new "Apply Filters" button sends the current pending state
- [x] FRONTEND-040-AC-04: Reset updates local state only, no auto-apply
- [x] FRONTEND-040-AC-05: `RecommendationsList` gains `onLoadingChange`
- [x] FRONTEND-040-AC-06: `App.tsx` wires `recommendationsLoading` between both components
- [x] FRONTEND-040-AC-07: "Processing recommendations…" overlay renders while `loading`
- [x] FRONTEND-040-AC-08: Recommendation Source radios + Apply Filters disabled while `loading`
- [x] FRONTEND-040-AC-09: a disabled control cannot fire `onQueryChange` (regression guard)
