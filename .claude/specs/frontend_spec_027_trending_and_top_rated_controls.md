# Frontend Spec 027: Trending & Top-Rated Recommendation Controls

**Status**: Done (2026-08-24)
**Priority**: P3 (mirrors backend spec's own caveat — depends on TMDB endpoint feasibility being confirmed during `series_spec_022`'s implementation)
**Depends on**: Frontend Spec 011 (`RecommendationControls`, three-way sourcing mode selector, output filters) ✅, Series Spec 022 (`sourceMode`/`trendingWindow` request params) ✅
**Frontend Stage**: 27 of N
**Files touched**: `src/types/series.ts` (`RecommendationQuery.sourceMode`/`trendingWindow`), `src/services/seriesApi.ts` (`buildRecommendationParams`), `src/services/__tests__/seriesApi.test.ts`, `src/components/RecommendationControls.tsx` (five-way mode selector, Day/Week toggle, `minSourceRating` visibility gate), `src/components/RecommendationControls.test.tsx`

## Overview

Surfaces `series_spec_022_trending_and_top_rated_recommendations.md`'s two new sourcing modes in `RecommendationControls`: **"Popular Right Now"** (TMDB's globally trending shows, with a Day/Week toggle) and **"Highest Rated"** (TMDB's top-rated shows, respecting the existing `minVoteCount` filter). Both slot into the same mode selector `RecommendationControls` already renders (`FRONTEND-011-AC-03`) as two further mutually-exclusive options, rather than a separate panel.

**Design decisions**:
- **The mode selector becomes a five-way choice, not a nested sub-choice under an existing option.** `Automatic` / `Specific Series` / `Genre & Keyword` (Frontend Spec 011) plus `Popular Right Now` / `Highest Rated` are five equally-weighted, mutually-exclusive ways to source recommendations — consistent with the existing radio-button shape (`FRONTEND-011-AC-03`) rather than introducing a second selection axis.
- **`minSourceRating` (shown only for `Automatic`/`Specific Series`, `FRONTEND-011-AC-07`) stays hidden for both new modes**, for the same reason it's already hidden for `Genre & Keyword` — there is no source pool to apply it against in either mode (`SERIES-007-AC-20`'s no-op rationale extends identically here).
- **`maxPerSource` stays visible but has no observable effect for either new mode** (mirroring how it already has no effect for `Genre & Keyword`, since `series_spec_022`'s candidates also carry a `null` `sourceTitle`) — left as-is rather than adding another mode-conditional hide, consistent with `FRONTEND-011-AC-08`'s existing "harmless no-op filter" tolerance rather than every filter needing bespoke visibility logic per mode.
- **The Day/Week toggle only renders for `Popular Right Now`.** It has no meaning for any other mode, the same visibility-gating precedent `minSourceRating` already establishes for mode-specific controls.

---

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the new sourcing parameters typed centrally, so `RecommendationControls` has a single typed contract to build against.

#### Acceptance Criteria

- **FRONTEND-027-AC-01** [AUTO]: `src/types/series.ts`'s `RecommendationQuery` interface shall gain `sourceMode?: 'trending' | 'topRated'` and `trendingWindow?: 'day' | 'week'`.
- **FRONTEND-027-AC-02** [AUTO]: `seriesApi.getRecommendations`'s existing query-building (`buildRecommendationParams`, `FRONTEND-011-AC-02`) shall include `sourceMode`/`trendingWindow` in its built params whenever present, following the same "include when present" convention every other `RecommendationQuery` field already uses — no special-casing needed since neither is an array field.

---

### Requirement 2: Mode Selector — Two New Options

**User story**: As a user, I want "Popular Right Now" and "Highest Rated" alongside the existing sourcing choices, so discovering something outside my own watch history doesn't require typing a genre or keyword.

#### Acceptance Criteria

- **FRONTEND-027-AC-03** [AUTO]: `RecommendationControls`' mode selector (`FRONTEND-011-AC-03`) shall gain two additional radio options: `Popular Right Now` (`sourceMode: 'trending'`) and `Highest Rated` (`sourceMode: 'topRated'`).
- **FRONTEND-027-AC-04** [AUTO]: Selecting `Popular Right Now` or `Highest Rated` shall clear any `seriesIds`/`genresSelected`/`keywordsSelected` state from a previously-selected mode, extending the existing mode-switch clearing behavior (`FRONTEND-011-AC-06`) to the two new modes.
- **FRONTEND-027-AC-05** [AUTO]: Under `Popular Right Now` mode, `RecommendationControls` shall render a Day/Week toggle (radio or two-button toggle, default `Week` — matching `series_spec_022`'s own default), populating `RecommendationQuery.trendingWindow`. This control shall not render under any other mode.
- **FRONTEND-027-AC-06** [AUTO]: Under `Highest Rated` mode, `RecommendationControls` shall render no additional mode-specific control — it relies entirely on the existing `minVoteCount` filter (Requirement 3 of Frontend Spec 011) for tuning, per `series_spec_022`'s design decision that `minVoteCount` doubles as the sourcing-time threshold.
- **FRONTEND-027-AC-07** [AUTO]: `minSourceRating` (`FRONTEND-011-AC-07`) shall be hidden under both `Popular Right Now` and `Highest Rated`, extending the same mode-based visibility rule already applied to `Genre & Keyword`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `sourceMode`, `trendingWindow`, mutual-exclusivity rules, `minVoteCount`-as-sourcing-threshold design | `series_spec_022_trending_and_top_rated_recommendations.md` |
| `RecommendationControls`' existing three-way mode selector, mode-switch clearing behavior, `minSourceRating` mode-based visibility | `frontend_spec_011_recommendation_controls.md` |
| `RecommendationQuery` type, `buildRecommendationParams` | `src/types/series.ts`, `seriesApi.ts` (Frontend Spec 011) |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (addition)

```typescript
describe('FRONTEND-027-AC-02: getRecommendations includes sourceMode/trendingWindow', () => {
  it('passes sourceMode and trendingWindow through to the query string', async () => {
    client.get.mockResolvedValue({ data: { data: [] } })

    await seriesApi.getRecommendations({ sourceMode: 'trending', trendingWindow: 'day' })

    expect(client.get).toHaveBeenCalledWith('/series/recommendations', {
      params: { sourceMode: 'trending', trendingWindow: 'day' },
    })
  })
})
```

### `src/components/RecommendationControls.test.tsx` (additions)

```typescript
describe('FRONTEND-027-AC-03/04: new mode options, clears stale state on switch', () => {
  it('selects Popular Right Now and clears a prior Specific Series selection', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Ozark', status: 'COMPLETED' } as any])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/specific series/i))
    fireEvent.click(await screen.findByLabelText('Ozark (COMPLETED)'))
    fireEvent.click(screen.getByLabelText(/popular right now/i))

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceMode: 'trending' }),
    )
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ seriesIds: expect.anything() }),
    )
  })
})

describe('FRONTEND-027-AC-05: Day/Week toggle only under Popular Right Now', () => {
  it('renders the toggle under Popular Right Now, defaulting to week', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/popular right now/i))
    expect(screen.getByLabelText(/^week$/i)).toBeChecked()

    fireEvent.click(screen.getByLabelText(/highest rated/i))
    expect(screen.queryByLabelText(/^week$/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-027-AC-07: minSourceRating hidden for both new modes', () => {
  it('hides Min Source Rating under Highest Rated', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    fireEvent.click(screen.getByLabelText(/highest rated/i))

    expect(screen.queryByLabelText(/min source rating/i)).not.toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-027-AC-01: `RecommendationQuery.sourceMode`/`trendingWindow`
- [x] FRONTEND-027-AC-02: `getRecommendations` passes both through to the query string
- [x] FRONTEND-027-AC-03: mode selector gains "Popular Right Now"/"Highest Rated"
- [x] FRONTEND-027-AC-04: switching to either new mode clears prior mode's state
- [x] FRONTEND-027-AC-05: Day/Week toggle, "Popular Right Now" only, defaults to Week
- [x] FRONTEND-027-AC-06: no extra control for "Highest Rated" beyond existing `minVoteCount`
- [x] FRONTEND-027-AC-07: `minSourceRating` hidden for both new modes
