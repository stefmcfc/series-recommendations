# Frontend Spec 106: Sticky Discover-Mode Tab

**Status**: Implemented
**Priority**: P3 (quality-of-life — remembers the last-used Discover sub-tab, no new capability)
**Depends on**: none — frontend-only, no backend pairing
**Area**: Frontend (`components/RecommendationControls.tsx`)

## Overview

`RecommendationControls.tsx`'s `discoverMode` (`'customSearch' | 'trending' | 'topRated'` — UI
labels "Custom Search"/"Popular Right Now"/"Highest Rated") always resets to `'customSearch'` on
every page load and every time the top-level "Discover" tab is (re-)entered from "Use My Series" —
there is no memory of which sub-tab was last used. This spec makes it sticky via the existing
`useLocalStorage` hook (`frontend/src/hooks/useLocalStorage.ts`), the same pattern already used for
`theme` (`frontend_spec_099`) and `watchRegion` (`frontend_spec_102`).

## Design Decisions

- **Correction found during implementation planning, not part of the original ask but required to
  make it actually work**: `handleTopLevelModeChange` (line ~841) currently *hardcodes*
  `nextDiscoverMode = 'customSearch'` whenever `mode` transitions to `'discover'` — this is
  explicitly commented as intentional today ("Entering Discover always lands on its default
  sub-tab"). If left as-is, a persisted `discoverMode` would only ever be visible for the sliver of
  time between mount and the user's first click into the Discover tab (since `initialState.mode` is
  always `'useMySeries'` — the top-level tab itself is out of scope, see below), making the feature
  functionally invisible. This spec therefore also changes that one line: entering Discover now
  lands on the **current persisted `discoverMode` value** instead of a hardcoded literal.
  `handleDiscoverSubModeChange` (switching between the three sub-tabs while already in Discover)
  needs no change — it already calls `updateState`, which this spec's sync effect (Requirement 1)
  already covers.
- **Top-level `mode` (`'useMySeries'` vs `'discover'`) is explicitly out of scope** — only the three
  Discover sub-options are persisted. `initialState.mode` stays `'useMySeries'` unconditionally.
- **Read once on mount, write on every change** — matches `useLocalStorage`'s own one-way contract
  (no live cross-tab sync), consistent with every other consumer in this codebase.
- **Validator function** (`isDiscoverMode`) follows the exact style of the existing
  `isCountryFavourites`/`isLanguageFavourites` (lines ~92-112): a plain type-guard checking the
  value is one of the three known literals, so a stale/corrupted stored value can never inject an
  invalid `discoverMode`.

---

## Requirement 1: `discoverMode` persists across page loads

**User story**: As a user who mostly browses "Highest Rated" (or any one Discover sub-tab), I want
the app to remember that the next time I open Recommendations, instead of always starting back on
Custom Search.

### FRONTEND-106-AC-01 [AUTO]
**Statement**: `RecommendationControls.tsx` shall export a new `isDiscoverMode(value: unknown):
value is DiscoverMode` type guard returning `true` if and only if `value` is exactly
`'customSearch'`, `'trending'`, or `'topRated'`.

**References**: `DiscoverMode` type (line 120); `isCountryFavourites`/`isLanguageFavourites`
(lines 92-112) as the established validator style.

**Test Case (Red)**:
```typescript
describe('FRONTEND-106-AC-01: isDiscoverMode validator', () => {
  it('accepts each of the three known DiscoverMode values', () => {
    expect(isDiscoverMode('customSearch')).toBe(true)
    expect(isDiscoverMode('trending')).toBe(true)
    expect(isDiscoverMode('topRated')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isDiscoverMode('bogus')).toBe(false)
    expect(isDiscoverMode(null)).toBe(false)
    expect(isDiscoverMode(42)).toBe(false)
  })
})
```
**Test Case (Green)**: implement `isDiscoverMode` until the spec above passes.

---

### FRONTEND-106-AC-02 [AUTO]
**Statement**: On mount, `RecommendationControls` shall initialize `ControlsState.discoverMode`
from `useLocalStorage('discoverMode', 'customSearch', isDiscoverMode)`'s stored value instead of
`initialState`'s hardcoded `'customSearch'`; every other `initialState` field is unaffected.

**References**: `initialState` (line 228), `useState<ControlsState>(initialState)` (line 791).

**Test Case (Red)**:
```typescript
describe('FRONTEND-106-AC-02: discoverMode restored on mount', () => {
  it('initializes the Discover sub-tab from a previously stored value', () => {
    localStorage.setItem('discoverMode', JSON.stringify('trending'))
    render(<RecommendationControls {...defaultProps} />)
    fireEvent.click(screen.getByRole('tab', { name: /discover/i }))
    expect(screen.getByRole('tab', { name: /popular right now/i })).toHaveAttribute(
      'aria-selected', 'true',
    )
  })

  it('falls back to Custom Search when nothing is stored', () => {
    render(<RecommendationControls {...defaultProps} />)
    fireEvent.click(screen.getByRole('tab', { name: /discover/i }))
    expect(screen.getByRole('tab', { name: /custom search/i })).toHaveAttribute(
      'aria-selected', 'true',
    )
  })
})
```
**Test Case (Green)**: wire the `useLocalStorage`-backed initial value through until the spec above
passes.

---

### FRONTEND-106-AC-03 [AUTO]
**Statement**: Whenever `state.discoverMode` changes (via `handleDiscoverSubModeChange` or the
corrected `handleTopLevelModeChange` below), `RecommendationControls` shall write the new value to
`localStorage` under the `'discoverMode'` key.

**References**: `handleDiscoverSubModeChange` (line 867), `updateState` (line 826).

**Test Case (Red)**:
```typescript
describe('FRONTEND-106-AC-03: discoverMode written on change', () => {
  it('persists a sub-tab switch', () => {
    render(<RecommendationControls {...defaultProps} />)
    fireEvent.click(screen.getByRole('tab', { name: /discover/i }))
    fireEvent.click(screen.getByRole('tab', { name: /highest rated/i }))
    expect(JSON.parse(localStorage.getItem('discoverMode')!)).toBe('topRated')
  })
})
```
**Test Case (Green)**: add the sync effect until the spec above passes.

---

## Requirement 2: Entering Discover lands on the last-used sub-tab, not always Custom Search

**User story**: As a user, when I switch from "Use My Series" over to "Discover", I want to land
back on whichever Discover sub-tab I was last using — not always Custom Search — otherwise the
persisted value from Requirement 1 is never actually visible in practice.

### FRONTEND-106-AC-04 [AUTO]
**Statement**: When `handleTopLevelModeChange('discover')` is called, the resulting
`discoverMode` shall be the current persisted/in-memory sticky value (the same value
`FRONTEND-106-AC-01/02`'s hook exposes) rather than the hardcoded literal `'customSearch'`
Custom Search remains the correct behavior only when nothing has ever been stored (matching
`FRONTEND-106-AC-02`'s fallback default).

**References**: `handleTopLevelModeChange` (lines 841-862) — the `nextDiscoverMode` ternary
currently reads `mode === 'discover' ? 'customSearch' : state.discoverMode`; this becomes
`mode === 'discover' ? storedDiscoverMode : state.discoverMode` where `storedDiscoverMode` is the
`useLocalStorage` hook's current value (always up to date per `FRONTEND-106-AC-03`'s write-through).

**Test Case (Red)**:
```typescript
describe('FRONTEND-106-AC-04: entering Discover restores the last-used sub-tab', () => {
  it('lands on the previously used sub-tab, not Custom Search', () => {
    render(<RecommendationControls {...defaultProps} />)
    fireEvent.click(screen.getByRole('tab', { name: /discover/i }))
    fireEvent.click(screen.getByRole('tab', { name: /popular right now/i }))
    fireEvent.click(screen.getByRole('tab', { name: /use my series/i }))
    fireEvent.click(screen.getByRole('tab', { name: /discover/i }))
    expect(screen.getByRole('tab', { name: /popular right now/i })).toHaveAttribute(
      'aria-selected', 'true',
    )
  })

  it('still no-ops on a re-click of the already-active top-level tab (FRONTEND-042-AC-15, unchanged)', () => {
    render(<RecommendationControls {...defaultProps} />)
    fireEvent.click(screen.getByRole('tab', { name: /use my series/i }))
    // asserts no onQueryChange(undefined) call / no state churn -- see existing FRONTEND-042-AC-15 test for the pattern to mirror
  })
})
```
**Test Case (Green)**: change the `nextDiscoverMode` ternary in `handleTopLevelModeChange` until the
spec above passes, without breaking any existing `frontend_spec_042` test.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `useLocalStorage` hook this spec's persistence is built on | `frontend/src/hooks/useLocalStorage.ts` |
| Validator style this spec's `isDiscoverMode` follows | `RecommendationControls.tsx`'s `isCountryFavourites`/`isLanguageFavourites` |
| `theme`/`watchRegion` — the two existing single-scalar `useLocalStorage` consumers this mirrors | `frontend_spec_099_theme_toggle.md`, `frontend_spec_102_settings_watch_region.md` |
| Two-tier `mode`/`discoverMode` selector this spec persists one tier of, and the "no-op on re-click" behavior this spec must not regress | `frontend_spec_042_recommendation_source_mode_reorganization.md` |
| First phase of the larger saved-filter-profiles initiative this spec ships ahead of, independently | `series_spec_055_filter_profiles.md` (not yet written), `frontend_spec_107_filter_profile_ui.md` (not yet written) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-106-AC-01: `isDiscoverMode` validator accepts the three known values, rejects everything else
- [x] FRONTEND-106-AC-02: `discoverMode` initializes from `useLocalStorage`, defaulting to `'customSearch'`
- [x] FRONTEND-106-AC-03: `discoverMode` writes to `localStorage` on every change
- [x] FRONTEND-106-AC-04: entering Discover from Use My Series lands on the last-used sub-tab, not always Custom Search
