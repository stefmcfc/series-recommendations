# Frontend Spec 053: Recommendation Candidate Detail View

**Status**: Not started
**Priority**: P3 (resolves a confirmed, longstanding gap — a recommendation candidate never showed
more than what's always visible on the card)
**Depends on**: Frontend Spec 052 (`frontend_spec_052_series_detail_recommendations_button.md`,
owns the `RecommendationCard` component this spec adds a new action to — **must land first**, since
this spec modifies that component rather than `RecommendationsList.tsx` directly) ✅ required,
Series Spec 036 (`series_spec_036_recommendation_candidate_details.md`, owns `GET
/api/v1/series/recommendations/{tmdbId}/details`) ✅ required
**Area**: Frontend (`components/RecommendationCard.tsx`, new
`components/RecommendationDetailModal.tsx`, `services/seriesApi.ts`, `types/series.ts`)

## Overview

Confirmed (2026-08-29 discussion, and via `.claude/ideas/future_ideas.md`'s existing "Recommendation
cards have no fuller detail/expand view beyond keywords" entry): a recommendation card's only
on-demand affordance is "Show keywords," an inline expand — there's no way to see season/episode
counts or an IMDb rating, and no real "detail view" exists at all. That existing idea explicitly
raised "whether it's an inline expand or a real detail view" as an open fork; this spec resolves it
by choosing a real detail view (a modal, matching this app's established dialog convention) and
**replacing** the standalone "Show keywords" button with a single "View Details" action that shows
keywords as one section of a fuller view — not adding a second, redundant "learn more" affordance
alongside the first.

## Design Decisions

- **"Show keywords" is removed from `RecommendationCard`, replaced by "View Details."** Two
  separate on-demand "learn more" buttons on one card is worse than one that shows everything —
  keywords become a section inside the new modal, fetched the same way (on open, on demand, not
  eagerly per card).
- **The modal fetches keywords (existing `seriesApi.getRecommendationKeywords`) and the new
  candidate details (`seriesApi.getRecommendationDetails`, `series_spec_036`) independently and in
  parallel on open** — each section renders its own loading/error/empty state; a failure in one
  (e.g. OMDb down) doesn't block or blank out the other.
- **The modal shows the candidate's already-known fields too** (title, poster, overview, genres,
  origin country, TMDB rating, streaming providers — everything already on the card), not just the
  two new data points — so it reads as an actual detail view, not a small box bolted onto the card
  for two numbers.
- **New `seriesApi.getRecommendationDetails(tmdbId, imdbId)` method**, mirroring
  `getRecommendationKeywords`'s exact shape (`GET
  /series/recommendations/{tmdbId}/details?imdbId={imdbId}`, unwrapping the single-object
  `ApiResponse<CandidateDetail>` envelope rather than a list).
- **New `CandidateDetail` frontend type** (`{ numberOfSeasons: number | null; numberOfEpisodes:
  number | null; imdbRating: number | null }`), mirroring `CandidateDetailDto` field-for-field.
- **The modal follows the same established dialog convention** as `frontend_spec_052`'s
  Recommendations-for-one-series modal and `SearchFilter`/`RecommendationControls`' existing
  "Browse" modals — `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape-to-dismiss, single
  "Done" button.

---

## Requirement 1: `RecommendationCard` gains "View Details," replacing "Show keywords"

**User story**: As a user, I want one clear action to see everything about a recommendation beyond
what's already on the card, instead of a separate keywords-only expand.

### FRONTEND-053-AC-01 [AUTO]
**Statement**: `RecommendationCard` shall render a "View Details" button (`data-testid="view-
details-btn"`) in place of the existing "Show keywords" button. The inline keywords expand (and its
associated `keywordsLoadingIds`/`keywordResults`/`keywordErrors`-shaped local state from
`frontend_spec_052`) shall be removed from the card itself.

**References**: `frontend_spec_052_series_detail_recommendations_button.md`'s `RecommendationCard`
(`FRONTEND-052-AC-01`), which this spec modifies.

**Test Case (Red)**:
```typescript
describe('FRONTEND-053-AC-01: View Details replaces Show keywords', () => {
  it('renders View Details, not Show keywords', () => {
    render(<RecommendationCard recommendation={makeRecommendation()} onMarkWatched={vi.fn()} onAddToList={vi.fn()} onIgnore={vi.fn()} />)
    expect(screen.getByTestId('view-details-btn')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show keywords/i })).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: remove the keywords button/expand JSX and its local state from
`RecommendationCard`; add the "View Details" button opening `RecommendationDetailModal`.

---

### FRONTEND-053-AC-02 [AUTO] (regression guard)
**Statement**: Every other `RecommendationCard` behavior established in `frontend_spec_052`
(rendering, Mark as Watched/Add to List/Ignore) shall be unaffected by this spec.

**Test Case (Green)**: existing `RecommendationCard` tests for those three actions, from
`frontend_spec_052`, continue to pass unmodified.

---

## Requirement 2: `RecommendationDetailModal`

### FRONTEND-053-AC-03 [AUTO]
**Statement**: Clicking "View Details" shall open a modal (`role="dialog"`, `aria-modal="true"`,
`aria-labelledby` pointing at an `<h2>` reading the candidate's title) showing every field already
visible on the card (title, poster, overview, genres, origin country, TMDB rating, vote count,
streaming providers), following the established dialog convention (Escape-to-dismiss, single "Done"
button).

**Test Case (Red)**:
```typescript
it('FRONTEND-053-AC-03: opens a dialog with the candidate\'s already-known fields', async () => {
  render(<RecommendationCard recommendation={makeRecommendation({ title: 'Ozark', overview: 'A money-laundering scheme...' })} onMarkWatched={vi.fn()} onAddToList={vi.fn()} onIgnore={vi.fn()} />)
  fireEvent.click(screen.getByTestId('view-details-btn'))
  const dialog = await screen.findByRole('dialog', { name: /ozark/i })
  expect(within(dialog).getByText(/money-laundering scheme/i)).toBeInTheDocument()
})
```
**Test Case (Green)**: new `RecommendationDetailModal` component, receiving the full `recommendation`
object as a prop (no re-fetch needed for already-known fields).

---

### FRONTEND-053-AC-04 [AUTO]
**Statement**: On open, the modal shall call `seriesApi.getRecommendationDetails(tmdbId, imdbId)`
and `seriesApi.getRecommendationKeywords(tmdbId)` independently, rendering a "Seasons," "Episodes,"
and "IMDb Rating" field (each `—` when `null`) and a keywords section, each with its own
loading/error state.

**Test Case (Red)**:
```typescript
it('FRONTEND-053-AC-04: fetches and renders details and keywords independently', async () => {
  mockGetRecommendationDetails.mockResolvedValue({ numberOfSeasons: 5, numberOfEpisodes: 62, imdbRating: 9.5 })
  mockGetRecommendationKeywords.mockRejectedValue(new Error('unavailable'))
  render(<RecommendationCard recommendation={makeRecommendation({ tmdbId: 1396, imdbId: 'tt0903747' })} onMarkWatched={vi.fn()} onAddToList={vi.fn()} onIgnore={vi.fn()} />)
  fireEvent.click(screen.getByTestId('view-details-btn'))

  expect(await screen.findByText('5')).toBeInTheDocument() // Seasons
  expect(screen.getByText('9.5')).toBeInTheDocument() // IMDb Rating
  expect(await screen.findByText(/keywords unavailable/i)).toBeInTheDocument() // independent failure
})
```
**Test Case (Green)**: two independent fetch effects (or a `Promise.allSettled`-style pattern),
each with its own loading/error/result state — a failure in one never blocks or blanks the other.

---

### FRONTEND-053-AC-05 [AUTO] (regression guard)
**Statement**: `RecommendationsList.tsx` and `frontend_spec_052`'s SeriesDetail Recommendations
modal shall both automatically gain "View Details" (in place of "Show keywords") purely by virtue of
rendering the shared `RecommendationCard` — no separate wiring needed in either.

**Test Case (Green)**: no code change required in `RecommendationsList.tsx` or `SeriesDetail.tsx`
beyond what `frontend_spec_052` already put in place — confirmed by existing tests for both
surfaces continuing to render `RecommendationCard` unchanged, now showing the new button.

---

## Cross-References

| This spec | Source |
|---|---|
| `RecommendationCard`, the component this spec modifies | `frontend_spec_052_series_detail_recommendations_button.md` |
| `GET .../{tmdbId}/details`, `CandidateDetailDto` | `series_spec_036_recommendation_candidate_details.md` |
| Existing keywords fetch this spec reuses unchanged | `frontend_spec_010_recommendations.md` (`getRecommendationKeywords`) |
| Dialog convention this spec's modal follows | `SearchFilter.tsx` "Browse Keywords", `RecommendationControls.tsx` "Browse Series" |
| The fork this spec resolves | `.claude/ideas/future_ideas.md` ("Recommendation cards have no fuller detail/expand view beyond keywords") |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-053-AC-01: "View Details" replaces "Show keywords" on `RecommendationCard`
- [ ] FRONTEND-053-AC-02: every other `RecommendationCard` behavior is unaffected
- [ ] FRONTEND-053-AC-03: the modal shows the candidate's already-known fields
- [ ] FRONTEND-053-AC-04: details and keywords fetch and fail independently
- [ ] FRONTEND-053-AC-05: both `RecommendationsList` and the SeriesDetail modal gain the new action for free
