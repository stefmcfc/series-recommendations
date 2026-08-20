# Frontend Spec 020: TMDB Rating & Vote Count Display

**Status**: ✅ Implemented
**Priority**: P3 (small display addition — not core CRUD)
**Depends on**: Series Spec 016 (`RecommendationDto.voteCount`), Frontend Spec 010 (Recommendations UI) ✅

## Overview

`RecommendationsList` already receives `tmdbRating` on every `Recommendation` but never renders it, and `voteCount` (`series_spec_016_recommendation_vote_count.md`) is new. This spec surfaces both on each recommendation card: the rating to one decimal place, right-justified within the card header row (alongside the title/year, mirroring `SeriesList`'s existing right-justified `.rating` column convention), with the vote count alongside it.

**Design decisions**:
- **Right-justified via `margin-left: auto` inside the existing `.cardHeader` flex row**, not a separate grid column — `cardHeader` is already `display: flex`, so pushing the rating to the row's far end this way is the direct equivalent of `SeriesList`'s `.rating { text-align: right }` in its own (non-flex) row layout.
- **Format: `{rating.toFixed(1)} ({voteCount} votes)`** — e.g. `7.7 (1,500 votes)`. When `tmdbRating` is `null`, nothing is rendered (no `—` placeholder — a recommendation card is TMDB-sourced by definition, so a missing rating is the genuinely-exceptional case, unlike `SeriesDetail`'s user-editable fields where `—` signals "not yet entered"). When `voteCount` is `null` but `tmdbRating` isn't, render the rating alone, no `(null votes)`.
- **Vote count is formatted with locale thousands-separators** (`toLocaleString()`) for readability on popular shows (TMDB vote counts regularly run into the thousands) — not a raw digit string.

---

## Requirements

### Requirement 1: Types

#### Acceptance Criteria

- **FRONTEND-020-AC-01** [AUTO]: `src/types/series.ts`'s `Recommendation` interface shall gain `voteCount: number | null`.

---

### Requirement 2: Rating & Vote Count Display

**User story**: As a user browsing recommendations, I want to see the TMDB rating and how many votes back it, right within each card, so I can judge trustworthiness at a glance.

#### Acceptance Criteria

- **FRONTEND-020-AC-02** [AUTO]: When `r.tmdbRating` is non-null, `RecommendationsList` shall render it inside `.cardHeader`, right-justified (`margin-left: auto`), formatted to exactly one decimal place (`r.tmdbRating.toFixed(1)`).
- **FRONTEND-020-AC-03** [AUTO]: When `r.tmdbRating` is non-null and `r.voteCount` is also non-null, the rendered text shall include the vote count alongside the rating (e.g. `7.7 (1,500 votes)`), with `voteCount` formatted via `toLocaleString()`.
- **FRONTEND-020-AC-04** [AUTO]: When `r.tmdbRating` is non-null and `r.voteCount` is `null`, the rendered text shall show the rating alone (e.g. `7.7`), with no vote-count fragment.
- **FRONTEND-020-AC-05** [AUTO]: When `r.tmdbRating` is `null`, `RecommendationsList` shall render nothing for this element (no placeholder).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationDto.voteCount`, `GET /api/v1/series/recommendations` response shape | `series_spec_016_recommendation_vote_count.md` |
| `RecommendationsList`, `.cardHeader` flex layout, `Recommendation` type origin | `frontend_spec_010_recommendations.md` |
| Right-justified rating column precedent | `SeriesList.module.css` `.rating` |

---

## TDD Test Case Sketches

### `src/components/RecommendationsList.test.tsx`

```typescript
describe('FRONTEND-020-AC-02/03: rating and vote count rendered', () => {
  it('renders the rating to one decimal place with a formatted vote count', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ tmdbRating: 7.749, voteCount: 1500 }),
    ])
    render(<RecommendationsList />)

    expect(await screen.findByText('7.7 (1,500 votes)')).toBeInTheDocument()
  })
})

describe('FRONTEND-020-AC-04: rating alone when voteCount is null', () => {
  it('renders just the rating', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ tmdbRating: 8, voteCount: null }),
    ])
    render(<RecommendationsList />)

    expect(await screen.findByText('8.0')).toBeInTheDocument()
  })
})

describe('FRONTEND-020-AC-05: nothing rendered when tmdbRating is null', () => {
  it('renders no rating text', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ tmdbRating: null, voteCount: null }),
    ])
    render(<RecommendationsList />)

    await screen.findByText('Ozark')
    expect(screen.queryByText(/votes\)/)).not.toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-020-AC-01: `Recommendation.voteCount: number | null`
- [x] FRONTEND-020-AC-02: rating rendered right-justified, one decimal place
- [x] FRONTEND-020-AC-03: vote count appended, locale-formatted, when present
- [x] FRONTEND-020-AC-04: rating alone when `voteCount` is `null`
- [x] FRONTEND-020-AC-05: nothing rendered when `tmdbRating` is `null`
