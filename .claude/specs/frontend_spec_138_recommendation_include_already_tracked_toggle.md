# Frontend Spec 138: "Show Series I Already Have" Recommendations Toggle

**Status**: Complete
**Priority**: P3
**Depends on**: `series_spec_071_recommendation_include_already_tracked.md` (backend flag + response
fields this spec consumes)
**Frontend Stage**: 1 of 1 — a single checkbox, `RecommendationCard` rendering branch, and
navigation wire-up; no new component

## Overview

Adds a checkbox to `RecommendationFiltersBox` — **"Show series I already have"** — that sends
`series_spec_071`'s new `includeAlreadyTracked` request flag. It applies uniformly across all four
Discover/Use My Series modes, since the backend enforces it in one shared place. When a result
comes back with a non-null `trackedSeriesId`, `RecommendationCard` renders a status/personal-rating
badge in place of the normal Mark Watched/Add to List/Ignore actions, and clicking through
navigates to that series' own detail page (`/my-series/view/:id`) via the app's existing router —
the same pattern `GenreDetailModal`/`KeywordDetailModal` already use.

**Out of scope**: `SeriesRecommendationsModal` and `KeywordRecommendationsModal` (the two
lightweight "similar to this" card lists reusing `RecommendationCard` from a series/keyword detail
context) don't get their own copy of the checkbox — they have no filter panel at all today, and
adding one is a larger change than this spec's request covers. They keep sending no
`includeAlreadyTracked` flag, so their results are unaffected. `RecommendationCard`'s new
already-tracked rendering branch is still shared code, so if a future spec ever threads the flag
into either modal, the card already knows how to render the result correctly.

## Design Decisions

- **Not persisted to `localStorage`.** Unlike Settings-backed preferences (watch region, favourite
  keywords/genres), this is a one-off inspection toggle most naturally left off by default each
  session — mirrors `ControlsState`'s other per-request filter fields (`minTmdbRating`,
  `excludeGenresSelected`, etc.), none of which persist either. Defaults to `false`.
- **Sent only when `true`; omitted (not sent as `false`) otherwise** — matches how other optional
  boolean-shaped filters on this DTO already behave (absent means "no override" per
  `RecommendationCriteria`'s own convention), and keeps the query string shorter in the overwhelming
  majority (default-off) case.
- **One checkbox, not per-mode.** Because the backend applies the flag identically regardless of
  `sourceMode`, a single control in `RecommendationFiltersBox` (shared across all four
  Discover/Use My Series panels — see `tooling_spec_008_recommendation_controls_decomposition.md`)
  is sufficient; no per-panel duplication.
- **Already-tracked results are mixed into the same list, not split into a separate section.**
  Simpler, and consistent with how this codebase already handles "flagged" results elsewhere
  (e.g. a favourited genre/keyword gets a badge inline, not a separate list) — see
  `frontend_spec_136`/`frontend_spec_137`'s favourite-star badges for the precedent this mirrors.
- **`RecommendationCard` keeps its existing "View Details" button for an already-tracked result.**
  It still shows genuinely useful TMDB metadata (overview, keywords) independent of your own
  tracked record — only the three action buttons that assume "you don't have this yet" (Mark
  Watched, Add to List, Ignore) are replaced.
- **Clicking the new badge/status area navigates, not the whole card.** The rest of the card
  (poster, title, overview) stays inert to clicking, matching every other card on this page today
  (nothing on a normal `RecommendationCard` is currently click-to-navigate) — only the new,
  clearly-labeled tracked-status element itself is the navigation affordance, so this doesn't
  introduce a surprising new click target on the card's general surface.

---

## Requirement 1: Filter toggle

**User story**: As a user, I want a checkbox to include series I already have in a recommendation
sourcing mode's results, so I can see the full picture without hunting through separate views.

### FRONTEND-138-AC-01 [AUTO]
**Statement**: `ControlsState` shall include `includeAlreadyTracked: boolean`, defaulting to
`false`; `RecommendationFiltersBox` shall render a labeled checkbox ("Show series I already have")
bound to it via the existing `state`/`updateState` patch pattern.

**References**: `RecommendationControls.tsx`'s `ControlsState` interface;
`RecommendationFiltersBox.tsx`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-138-AC-01: already-tracked toggle', () => {
  it('renders unchecked by default and toggles on click', async () => {
    // render RecommendationFiltersBox with default ControlsState
    // expect checkbox unchecked
    // click it, expect updateState called with { includeAlreadyTracked: true }
  })
})
```
**Test Case (Green)**: add the field + checkbox JSX, following an existing checkbox's markup
pattern (e.g. `SeriesFormFields.tsx`) for consistent styling.

---

### FRONTEND-138-AC-02 [AUTO]
**Statement**: `buildRecommendationParams` (or equivalent request-building logic in
`RecommendationControls.tsx`) shall send `includeAlreadyTracked: true` on `RecommendationQuery`
only when the checkbox is checked; the field shall be omitted (not sent as `false`) otherwise.

**References**: `RecommendationQuery` (`types/series.ts`); `seriesApi.getRecommendations`.

**Test Case (Red)**:
```typescript
it('FRONTEND-138-AC-02: includeAlreadyTracked is only sent when checked', () => {
  // with includeAlreadyTracked: false in ControlsState, assert the built
  // RecommendationQuery has no includeAlreadyTracked key
  // with it true, assert RecommendationQuery.includeAlreadyTracked === true
})
```
**Test Case (Green)**: extend `RecommendationQuery`'s type + the params-building function.

---

## Requirement 2: Response type + already-tracked card rendering

**User story**: As a user, I want an already-tracked result to visibly show my existing status and
rating, so I don't mistake it for a new suggestion.

### FRONTEND-138-AC-03 [AUTO]
**Statement**: `Recommendation` shall gain `trackedSeriesId: string | null`, `trackedStatus:
SeriesStatus | null`, and `trackedPersonalRating: number | null`, mirroring
`series_spec_071`'s `RecommendationDto` fields field-for-field.

**References**: `types/series.ts`'s `Recommendation` interface; `SeriesStatus` (existing type).

**Test Case (Red)**: type-level — a `Recommendation` object literal omitting these three fields
fails to typecheck once added as required (non-optional, matching the interface's existing
convention of always-present fields for API response shapes).

**Test Case (Green)**: add the three fields to the interface.

---

### FRONTEND-138-AC-04 [AUTO]
**Statement**: When `recommendation.trackedSeriesId` is non-null, `RecommendationCard` shall
render a badge showing `trackedStatus` and (when non-null) `trackedPersonalRating`, in place of
the Mark Watched/Add to List/Ignore buttons; the "View Details" button remains present
unconditionally.

**References**: `RecommendationCard.tsx`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-138-AC-04: already-tracked card rendering', () => {
  it('shows a status/rating badge instead of Mark Watched/Add to List/Ignore', () => {
    // render RecommendationCard with a recommendation carrying
    // trackedSeriesId + trackedStatus: 'WATCHING' + trackedPersonalRating: 8
    // expect badge text containing 'WATCHING' and '8'
    // expect no Mark Watched / Add to List / Ignore buttons
    // expect View Details button still present
  })

  it('shows the normal three action buttons when trackedSeriesId is null', () => {
    // existing behavior unchanged -- regression pin
  })
})
```
**Test Case (Green)**: add the conditional branch in `RecommendationCard.tsx`'s action area.

---

### FRONTEND-138-AC-05 [AUTO]
**Statement**: The already-tracked badge shall be a navigation control that, on click, routes to
`/my-series/view/${trackedSeriesId}` via the app's existing `react-router` `useNavigate`, matching
`GenreDetailModal`/`KeywordDetailModal`'s existing navigation pattern.

**References**: `GenreDetailModal.tsx`/`KeywordDetailModal.tsx` (the pattern mirrored);
`App.tsx`'s `/my-series/view/:id` route.

**Test Case (Red)**:
```typescript
it('FRONTEND-138-AC-05: clicking the tracked badge navigates to the series detail route', () => {
  // render RecommendationCard (with router context) for a tracked recommendation
  // click the badge
  // assert navigation to `/my-series/view/${trackedSeriesId}`
})
```
**Test Case (Green)**: `useNavigate()` + an `onClick` on the badge element.

---

## Cross-References

| This spec | Source |
|---|---|
| Backend flag + response fields this spec consumes | `series_spec_071_recommendation_include_already_tracked.md` |
| Shared filter panel this spec's checkbox is added to | `tooling_spec_008_recommendation_controls_decomposition.md` (`RecommendationFiltersBox`) |
| Existing inline-badge precedent (mixed into results, not a separate list) | `frontend_spec_136`/`frontend_spec_137` (keyword/genre favourite-star badges) |
| Navigation pattern mirrored (`useNavigate` to `/my-series/view/:id`) | `GenreDetailModal.tsx`/`KeywordDetailModal.tsx` |
| Explicitly out of scope (no toggle added to these) | `SeriesRecommendationsModal.tsx`, `KeywordRecommendationsModal.tsx` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-138-AC-01: `ControlsState.includeAlreadyTracked` checkbox, default false
- [x] FRONTEND-138-AC-02: sent only when true, omitted otherwise
- [x] FRONTEND-138-AC-03: `Recommendation` gains the three tracked-* fields
- [x] FRONTEND-138-AC-04: tracked card shows status/rating badge instead of the 3 normal actions
- [x] FRONTEND-138-AC-05: badge click navigates to `/my-series/view/:id`
