# Frontend Spec 052: `SeriesDetail` "Recommendations" Button (Modal) + Shared `RecommendationCard`

**Status**: Implemented — `components/RecommendationCard.tsx` (+
`RecommendationCard.module.css`, `RecommendationCard.test.tsx`),
`components/RecommendationsList.tsx` (refactored to render
`<RecommendationCard>`, dead card CSS removed from
`RecommendationsList.module.css`), `components/SeriesDetailActionsPanel.tsx`
(new "Recommendations" button), `components/SeriesRecommendationsModal.tsx`
(+ `SeriesRecommendationsModal.module.css`, new modal component) and
`components/SeriesDetail.tsx` (wires the modal open/close state + disabled
prop), `components/SeriesDetail.test.tsx` (new FRONTEND-052 coverage),
`SeriesDetail.module.css` (`.recommendationsButton`).
**Priority**: P3 (quality-of-life — lets a user get recs for one series without leaving its detail
page or manually narrowing "Use My Series" to it)
**Depends on**: Frontend Spec 005 (`frontend_spec_005_series_detail.md`, owns `SeriesDetail.tsx`/
`SeriesDetailActionsPanel`) ✅, Frontend Spec 010/011 (`frontend_spec_010_recommendations.md`/
`frontend_spec_011_recommendation_controls.md`, own `RecommendationsList.tsx`'s existing card
rendering this spec extracts) ✅, Series Spec 033 (`series_spec_033_use_my_series_explicit_mode.md`,
confirms `sourceMode=useMySeries` + `seriesIds` is already a valid, allowed combination — SERIES-
033-AC-03) ✅
**No backend spec or backend change is required.** `GET /api/v1/series/recommendations?
sourceMode=useMySeries&seriesIds={id}` already works exactly as needed — confirmed via
`series_spec_033`'s `SERIES-033-AC-03/05` and `RecommendationCriteriaValidator`.
**Area**: Frontend (`components/SeriesDetail.tsx`, `components/SeriesDetailActionsPanel.tsx`, new
`components/RecommendationCard.tsx`, `components/RecommendationsList.tsx`)

## Overview

Confirmed (2026-08-29): `SeriesDetail.tsx`'s current action set (via `SeriesDetailActionsPanel`) is
Edit, Delete, Refresh, rewatch toggle, dismiss-new-content, and Check Streaming — no way to get
recommendations for that one series without navigating to the Recommendations page and manually
narrowing "Use My Series" to it via the Specific Series picker. This spec adds a "Recommendations"
button that opens a modal showing recs sourced from just that series, reusing the sourcing capability
that already exists (`sourceMode=useMySeries` + `seriesIds=[id]`).

Since the modal needs the same per-candidate card rendering `RecommendationsList.tsx` already has
(title/year/genres/overview/rating/streaming providers/"Because you watched"/Mark as Watched/Add to
List/Ignore/Show keywords), this spec extracts that rendering into a standalone `RecommendationCard`
component reused by both places, rather than duplicating ~150 lines of JSX and its associated state.
This also sets up **Frontend Spec 053** (the "candidate detail view" idea) to add its new action to
one shared component and have it appear in both the main Recommendations page and this modal for
free — see `ROADMAP.md` for the resulting build order.

## Design Decisions

- **`RecommendationCard` takes a single `recommendation: Recommendation` prop, plus callback props**
  (`onMarkWatched`, `onAddToList`, `onIgnore`) — the parent (`RecommendationsList` or this spec's new
  modal) decides what happens on success/failure (e.g. removing the card from its own list, opening
  `AddSeriesForm`), the card itself only renders and reports the action.
- **Keywords loading/result/error state moves inside `RecommendationCard` as local `useState`**, no
  longer keyed by `imdbId` in a parent-level `Set`/`Record` (`keywordsLoadingIds`/`keywordResults`/
  `keywordErrors`) — that keying only existed because one parent rendered many cards from a flat
  array; now that each card is its own component instance, plain local state is simpler and
  correctly scoped. Same for `posterErrorIds`' per-card entry.
- **`ignoringIds`/`ignoreErrors` and `pendingAdd` (the `AddSeriesForm` trigger) stay owned by the
  parent**, not the card — removing an ignored candidate from the list, and opening `AddSeriesForm`
  as a sibling overlay, are both list-level/page-level concerns the card shouldn't own itself. Each
  parent (`RecommendationsList`, and this spec's new modal) renders its own `AddSeriesForm` instance
  when a card reports an add/mark-watched action, exactly mirroring how `RecommendationsList` already
  does this today — nesting a modal-triggered `AddSeriesForm` inside this spec's new
  Recommendations-for-one-series modal is no different architecturally from `AddSeriesForm` already
  opening as an overlay from other pages.
- **The new modal follows the established dialog convention exactly** (`SearchFilter`'s "Browse
  Keywords" / `RecommendationControls`' "Browse Series"): a plain `<div role="dialog" aria-modal="true"
  aria-labelledby="...">`, no focus-trap library (Escape-to-dismiss only), single "Done" button, same
  `NOSONAR`/eslint-disable comments for the Escape key handler.
- **The "Recommendations" button is disabled when `series.excludeFromRecommendations === true`**,
  with an explanatory `aria-label`/title (e.g. "This series is excluded from recommendations") —
  proactively, regardless of whether `series_spec_034`/`frontend_spec_050` (which makes the backend
  itself reject/filter an excluded series from explicit selection) has shipped yet. Inviting the user
  to request recs for a series they've deliberately excluded is a confusing affordance either way the
  flag already exists to prevent.
- **No new `seriesApi` method or type is needed for the fetch itself** — `seriesApi.getRecommendations
  ({ sourceMode: 'useMySeries', seriesIds: [series.id] })` already produces the exact request needed.

---

## Requirement 1: Extract `RecommendationCard` as a shared, reusable component

**User story**: As a developer, I want the per-candidate card rendering that already exists in
`RecommendationsList` to be reusable, so a new "recommendations for one series" modal doesn't
duplicate ~150 lines of JSX and state.

### FRONTEND-052-AC-01 [AUTO]
**Statement**: A new `RecommendationCard.tsx` component shall render everything a card in
`RecommendationsList.tsx` renders today — title, year, genres, overview, origin country, TMDB
rating, vote count, streaming providers, "Because you watched" `sourceTitles`, and the Mark as
Watched / Add to List / Ignore / Show keywords actions — taking `recommendation: Recommendation`
plus `onMarkWatched`/`onAddToList`/`onIgnore` callback props. Keywords loading/result/error state and
poster-error state are owned locally inside the component.

**References**: `RecommendationsList.tsx`'s existing card JSX (today inline in its `.map()`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-052-AC-01: RecommendationCard renders standalone', () => {
  it('renders a recommendation and supports Show keywords independently of any list', async () => {
    render(
      <RecommendationCard
        recommendation={makeRecommendation({ title: 'Ozark' })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )
    expect(screen.getByText('Ozark')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show keywords/i }))
    expect(await screen.findByText(/dark comedy/i)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: move the card JSX and its keywords/poster-error `useState`s into the new
component; wire `RecommendationsList` to render `<RecommendationCard>` per item.

---

### FRONTEND-052-AC-02 [AUTO] (regression guard)
**Statement**: `RecommendationsList.tsx`, refactored to render `<RecommendationCard>` per
recommendation, shall have identical behavior to today — same `data-testid`s, same Mark as
Watched/Add to List/Ignore/Show keywords interactions, same rendered output. The existing
`RecommendationsList.test.tsx` suite shall pass with no behavioral expectation changes (query-only
updates are acceptable if the DOM structure moved without changing what's rendered).

**Test Case (Green)**: run the existing `RecommendationsList.test.tsx` suite unmodified in behavior
— any failures are markup-relocation query fixes, not new assertions.

---

## Requirement 2: `SeriesDetail` "Recommendations" button and modal

**User story**: As a user viewing one series' detail page, I want to see recommendations sourced
from just that series without leaving the page or manually narrowing "Use My Series" to it.

### FRONTEND-052-AC-03 [AUTO]
**Statement**: `SeriesDetailActionsPanel` shall render a "Recommendations" button
(`data-testid="recommendations-btn"`) in `.actionsLeft`, after the existing Refresh button.

**References**: `SeriesDetailActionsPanel.tsx`'s existing `.actionsLeft` (Edit/Delete/Refresh).

**Test Case (Red)**:
```typescript
it('FRONTEND-052-AC-03: renders a Recommendations button after Refresh', () => {
  render(<SeriesDetailActionsPanel {...defaultProps} />)
  expect(screen.getByTestId('recommendations-btn')).toBeInTheDocument()
})
```
**Test Case (Green)**: add the button and an `onRecommendationsClick`/`recommendationsDisabled` prop
pair to `SeriesDetailActionsPanelProps`.

---

### FRONTEND-052-AC-04 [AUTO]
**Statement**: Clicking "Recommendations" shall open a modal (`role="dialog"`, `aria-modal="true"`,
`aria-labelledby` pointing at an `<h2>` reading "Recommendations for {series.title}"), following the
established dialog convention (Escape-to-dismiss, single "Done" button).

**Test Case (Red)**:
```typescript
it('FRONTEND-052-AC-04: opens a dialog titled after the series', async () => {
  render(<SeriesDetail {...defaultProps} series={makeSeries({ title: 'Ozark' })} />)
  fireEvent.click(screen.getByTestId('recommendations-btn'))
  expect(await screen.findByRole('dialog', { name: /recommendations for ozark/i })).toBeInTheDocument()
})
```
**Test Case (Green)**: new modal state (`recommendationsModalOpen`) in `SeriesDetail.tsx`, rendered
conditionally with the standard dialog markup.

---

### FRONTEND-052-AC-05 [AUTO]
**Statement**: On open, the modal shall call `seriesApi.getRecommendations({ sourceMode:
'useMySeries', seriesIds: [series.id] })` and render each result via `<RecommendationCard>`.

**Test Case (Red)**:
```typescript
it('FRONTEND-052-AC-05: fetches recommendations scoped to this series', async () => {
  mockGetRecommendations.mockResolvedValue([makeRecommendation({ title: 'Better Call Saul' })])
  render(<SeriesDetail {...defaultProps} series={makeSeries({ id: 's1', title: 'Breaking Bad' })} />)
  fireEvent.click(screen.getByTestId('recommendations-btn'))

  expect(await screen.findByText('Better Call Saul')).toBeInTheDocument()
  expect(mockGetRecommendations).toHaveBeenCalledWith({ sourceMode: 'useMySeries', seriesIds: ['s1'] })
})
```
**Test Case (Green)**: `useEffect` on modal open, guarded so it only fires once per open (mirrors
`RecommendationsList`'s own fetch-on-mount/query-change pattern).

---

### FRONTEND-052-AC-06 [AUTO]
**Statement**: While the fetch is in flight, the modal shall show a loading indicator. On failure, it
shall show an error message (`role="alert"`). When zero recommendations are returned (including the
case where sourcing legitimately finds nothing), it shall show an empty-state message (e.g. "No
recommendations found for this series") — a single generic empty message covers both "no matches"
and "series is excluded" (once `series_spec_034` enforces that server-side); no separate messaging is
needed since AC-09 already prevents opening this modal for an excluded series from the UI.

**Test Case (Red)**:
```typescript
it('FRONTEND-052-AC-06: shows loading, then an empty-state message', async () => {
  mockGetRecommendations.mockResolvedValue([])
  render(<SeriesDetail {...defaultProps} />)
  fireEvent.click(screen.getByTestId('recommendations-btn'))
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
  expect(await screen.findByText(/no recommendations found/i)).toBeInTheDocument()
})

it('FRONTEND-052-AC-06: shows an error message on fetch failure', async () => {
  mockGetRecommendations.mockRejectedValue(new Error('network error'))
  render(<SeriesDetail {...defaultProps} />)
  fireEvent.click(screen.getByTestId('recommendations-btn'))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
})
```
**Test Case (Green)**: standard `loading`/`error`/`recommendations` local state, mirroring
`RecommendationsList`'s own fetch-effect shape.

---

### FRONTEND-052-AC-07 [AUTO]
**Statement**: The "Recommendations" button shall be `disabled`, with an explanatory `aria-label`
(e.g. "This series is excluded from recommendations"), when `series.excludeFromRecommendations ===
true`.

**Test Case (Red)**:
```typescript
it('FRONTEND-052-AC-07: disables the button for an excluded series', () => {
  render(<SeriesDetail {...defaultProps} series={makeSeries({ excludeFromRecommendations: true })} />)
  expect(screen.getByTestId('recommendations-btn')).toBeDisabled()
})
```
**Test Case (Green)**: `recommendationsDisabled={series.excludeFromRecommendations}` passed down to
`SeriesDetailActionsPanel`.

---

### FRONTEND-052-AC-08 [AUTO] (regression guard)
**Statement**: Opening or closing the Recommendations modal shall not affect `SeriesDetail`'s other
state (editing, delete-confirmation, refresh in progress) — an independent overlay.

**Test Case (Green)**: no shared state between the new modal's `useState` and the existing
edit/delete/refresh state in `SeriesDetail.tsx` — a code-level regression guard, confirmed by the
existing `SeriesDetail.test.tsx` suite continuing to pass unmodified.

---

## Cross-References

| This spec | Source |
|---|---|
| `sourceMode=useMySeries` + `seriesIds` already valid together | `series_spec_033_use_my_series_explicit_mode.md` (`SERIES-033-AC-03`) |
| Card rendering/actions this spec extracts | `frontend_spec_010_recommendations.md`, `frontend_spec_011_recommendation_controls.md` |
| Dialog convention this spec's modal follows | `SearchFilter.tsx` "Browse Keywords", `RecommendationControls.tsx` "Browse Series" (`frontend_spec_029_searchable_keyword_picker.md`, `frontend_spec_035_specific_series_picker.md`) |
| `excludeFromRecommendations` enforcement this button's disabled state anticipates | `series_spec_034_exclude_from_recommendations_enforcement.md`, `frontend_spec_050_exclude_from_recommendations_ui.md` |
| The shared `RecommendationCard` this enables reuse for | `frontend_spec_053_recommendation_candidate_detail.md` (adds a new action to the same component) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-052-AC-01: `RecommendationCard` renders standalone, with its own keywords/poster-error state
- [x] FRONTEND-052-AC-02: `RecommendationsList` behavior is unchanged after the extraction
- [x] FRONTEND-052-AC-03: `SeriesDetailActionsPanel` renders a "Recommendations" button after Refresh
- [x] FRONTEND-052-AC-04: clicking it opens a dialog titled after the series
- [x] FRONTEND-052-AC-05: the modal fetches recommendations scoped to `seriesIds=[series.id]`
- [x] FRONTEND-052-AC-06: loading/error/empty states render correctly
- [x] FRONTEND-052-AC-07: the button is disabled for an excluded series
- [x] FRONTEND-052-AC-08: the modal doesn't interfere with `SeriesDetail`'s other state
