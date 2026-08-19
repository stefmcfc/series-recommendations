# Frontend Spec 011: Recommendation Sourcing & Filter Controls

**Status**: Not started
**Depends on**: Frontend Spec 010 (`RecommendationsList`, `Recommendation` type, `seriesApi.getRecommendations`) ✅, Series Spec 007 (`seriesIds`/`genres`/`keywords`/`minSourceRating`/`minTmdbRating`/`minVoteCount`/`yearMin`/`yearMax`/`excludeGenres`/`language`/`maxPerSource` query params)
**Frontend Stage**: 11 of N

## Overview

Adds a control panel above `RecommendationsList` — analogous to `SearchFilter`'s relationship with `SeriesList` — that exposes Series Spec 007's new sourcing modes and output filters. A user picks one of three sourcing modes (automatic from watch history, specific series, or genre/keyword direct), optionally narrows the result with output filters, and the resulting query is sent to the already-existing `GET /series/recommendations` endpoint via an extended `seriesApi.getRecommendations`.

**Design decisions**:
- **Sourcing mode is a single radio-button choice (`Automatic` / `Specific Series` / `Genre & Keyword`), not three independently-fillable sections.** Series Spec 007 rejects a request with both `seriesIds` and `genres`/`keywords` set (`SERIES-007-AC-17`, `400`). Modeling this as mutually-exclusive UI up front means the invalid combination can't be constructed in the first place, rather than letting the user hit a 400 and having to explain why.
- **The "Specific Series" picker is populated from `seriesApi.getAll()`**, not a new endpoint — every tracked series is a valid pick regardless of status (`SERIES-007-AC-08`), and `getAll()` already returns exactly that list.
- **`minSourceRating` is only shown for `Automatic`/`Specific Series` modes**, not `Genre & Keyword` — it has no effect there (`SERIES-007-AC-20`), and showing a control that silently does nothing would be misleading.
- **Filters submit immediately on change**, matching `RecommendationsList`'s existing fetch-on-mount pattern, rather than requiring a separate "Apply" click gating every field — this mirrors how `SearchFilter` requires an explicit Search click for *filters*, but recommendation sourcing/filtering is a smaller, single-panel control where re-fetching on change reads as more responsive than a form-submit model. (Contrast noted rather than blindly copied, since `SearchFilter`'s existing multi-click-then-Search pattern was designed around a much larger field set.)
- **No changes to `RecommendationsList`'s card rendering or actions (Mark as Watched / Add to List / Ignore)** — this spec only changes what feeds the list, not what a card looks like or does.

---

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the new sourcing/filter parameters typed and threaded through `seriesApi`, so the control panel has a single typed contract to build against.

#### Acceptance Criteria

- **FRONTEND-011-AC-01** [AUTO]: `src/types/series.ts` shall gain a `RecommendationQuery` interface: `limit?: number`, `seriesIds?: string[]`, `genres?: string[]`, `keywords?: string[]`, `minSourceRating?: number`, `minTmdbRating?: number`, `minVoteCount?: number`, `yearMin?: number`, `yearMax?: number`, `excludeGenres?: string[]`, `language?: string`, `maxPerSource?: number`.
- **FRONTEND-011-AC-02** [AUTO]: `seriesApi.getRecommendations` shall change signature from `(limit?: number)` to `(query?: RecommendationQuery)`, building query-string params from every present field (array fields comma-joined, same convention as `buildSearchParams`'s `genre` handling). Existing no-argument and `{ limit }`-only call sites (`RecommendationsList`'s initial fetch) continue to work unchanged.

---

### Requirement 2: Sourcing Mode Controls

**User story**: As a user, I want to choose whether recommendations come from my whole watch history, specific series I pick, or a genre/keyword I name directly, so I can steer suggestions toward what I actually want right now.

#### Acceptance Criteria

- **FRONTEND-011-AC-03** [AUTO]: A new `RecommendationControls` component shall render a three-way mode selector: `Automatic` (default), `Specific Series`, `Genre & Keyword`.
- **FRONTEND-011-AC-04** [AUTO]: Under `Specific Series` mode, `RecommendationControls` shall fetch the user's series via `seriesApi.getAll()` and render them as a multi-select (checkboxes, one per series, showing title and status) — selected series ids populate `RecommendationQuery.seriesIds`.
- **FRONTEND-011-AC-05** [AUTO]: Under `Genre & Keyword` mode, `RecommendationControls` shall render two comma-separated text inputs, "Genres" and "Keywords" (same free-text-list convention as `SearchFilter`'s existing Genres field), populating `RecommendationQuery.genres`/`keywords` respectively. At least one of the two must be non-empty to submit; if both are empty, the mode-specific fields are omitted from the query (falling through to `Automatic` behavior server-side, per `SERIES-007-AC-18`) and a hint is shown asking the user to enter at least one.
- **FRONTEND-011-AC-06** [AUTO]: Switching sourcing mode shall clear the fields specific to the previously-selected mode, so a stale selection can never be silently included after switching away from it.

---

### Requirement 3: Output Filter Controls

**User story**: As a user, I want to narrow recommendation results by quality, recency, genre, and language, so I don't have to scroll past suggestions I already know I don't want.

#### Acceptance Criteria

- **FRONTEND-011-AC-07** [AUTO]: `RecommendationControls` shall render, in a collapsible "Filters" section (collapsed by default): `minSourceRating` (1–5 dropdown, shown only for `Automatic`/`Specific Series` modes per Design Decisions), `minTmdbRating` (number input, step 0.1), `minVoteCount` (number input), `yearMin`/`yearMax` (number inputs), `excludeGenres` (comma-separated text input), `language` (text input, e.g. `en`), `maxPerSource` (number input).
- **FRONTEND-011-AC-08** [AUTO]: An empty filter field shall be omitted from `RecommendationQuery` entirely (not sent as an empty string or `0`), so server-side defaults (e.g. `minVoteCount`'s default of 20, `SERIES-007-AC-25`) apply exactly as they do when the field is untouched.
- **FRONTEND-011-AC-09** [AUTO]: A "Reset Filters" action shall clear every field in the Filters section (but not the sourcing mode/selection from Requirement 2) and re-fetch.

---

### Requirement 4: Wiring & Fetch Behavior

**User story**: As a user, I want my sourcing/filter choices to actually change what I see, immediately.

#### Acceptance Criteria

- **FRONTEND-011-AC-10** [AUTO]: `RecommendationControls` shall be rendered above `RecommendationsList` only while the Recommendations view is active (same conditional-render seam as `SearchFilter`/`ExportControls` above `SeriesList`).
- **FRONTEND-011-AC-11** [AUTO]: `RecommendationsList` shall accept an optional `query?: RecommendationQuery` prop and pass it to `seriesApi.getRecommendations`, re-fetching whenever it changes (extending its existing `refreshIndex`-keyed effect to also depend on `query`).
- **FRONTEND-011-AC-12** [AUTO]: Changing any control in `RecommendationControls` (mode, selection, or a filter field) shall trigger a re-fetch, per Design Decisions' immediate-submit choice — no separate "Apply" button.
- **FRONTEND-011-AC-13** [AUTO]: If `seriesApi.getRecommendations` rejects for a `RecommendationControls`-driven fetch (e.g. a malformed filter value the client-side validation missed), `RecommendationsList`'s existing error/Retry handling (`FRONTEND-010-AC-07`) applies unchanged — no new error path is introduced.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationsList`, `Recommendation` type, existing `getRecommendations`/error/empty/loading behavior | `frontend_spec_010_recommendations.md` |
| `seriesIds`, `genres`/`keywords`, `minSourceRating`, output filters, `maxPerSource`, mutual-exclusivity `400` | `series_spec_007_recommendation_sourcing.md` |
| `seriesApi.getAll()`, comma-separated free-text list convention (`Genres` field) | `SearchFilter.tsx` (Frontend Spec 006) |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (addition)

```typescript
describe('FRONTEND-011-AC-02: getRecommendations with a full query', () => {
  it('builds comma-joined array params and omits absent fields', async () => {
    client.get.mockResolvedValue({ data: { data: [] } })

    await seriesApi.getRecommendations({
      genres: ['Drama', 'Crime'],
      minVoteCount: 50,
      yearMin: 2020,
    })

    expect(client.get).toHaveBeenCalledWith('/series/recommendations', {
      params: { genres: 'Drama,Crime', minVoteCount: 50, yearMin: 2020 },
    })
  })
})
```

### `src/components/RecommendationControls.test.tsx`

```typescript
vi.mock('../services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)

describe('FRONTEND-011-AC-03/06: mode switching clears stale fields', () => {
  it('clears genres/keywords when switching from Genre & Keyword to Specific Series', async () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    fireEvent.change(screen.getByLabelText(/genres/i), { target: { value: 'Drama' } })
    fireEvent.click(screen.getByLabelText(/specific series/i))

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ genres: expect.anything() }),
    )
  })
})

describe('FRONTEND-011-AC-04: specific series picker lists the user\'s series', async () => {
  it('renders a checkbox per series from getAll()', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Ozark', status: 'COMPLETED' } as any])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/specific series/i))
    expect(await screen.findByLabelText('Ozark')).toBeInTheDocument()
  })
})

describe('FRONTEND-011-AC-08: empty filter fields are omitted, not sent as empty/zero', () => {
  it('omits minVoteCount from the query when the field is left blank', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.change(screen.getByLabelText(/min tmdb rating/i), { target: { value: '7' } })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ minVoteCount: expect.anything() }),
    )
  })
})
```

### `src/components/RecommendationsList.test.tsx` (addition)

```typescript
describe('FRONTEND-011-AC-11: re-fetches when query prop changes', () => {
  it('calls getRecommendations again with the new query', async () => {
    const { rerender } = render(<RecommendationsList query={{ genres: ['Drama'] }} />)
    await waitFor(() => expect(mockGetRecommendations).toHaveBeenCalledWith({ genres: ['Drama'] }))

    rerender(<RecommendationsList query={{ genres: ['Comedy'] }} />)
    await waitFor(() => expect(mockGetRecommendations).toHaveBeenLastCalledWith({ genres: ['Comedy'] }))
  })
})
```

---

## Acceptance Criteria Summary

- [ ] FRONTEND-011-AC-01: `RecommendationQuery` type
- [ ] FRONTEND-011-AC-02: `seriesApi.getRecommendations(query?)` signature
- [ ] FRONTEND-011-AC-03: three-way sourcing mode selector
- [ ] FRONTEND-011-AC-04: Specific Series multi-select via `getAll()`
- [ ] FRONTEND-011-AC-05: Genre & Keyword text inputs, at-least-one hint
- [ ] FRONTEND-011-AC-06: switching mode clears the other mode's fields
- [ ] FRONTEND-011-AC-07: output filter fields
- [ ] FRONTEND-011-AC-08: empty filter fields omitted, not sent as empty/zero
- [ ] FRONTEND-011-AC-09: Reset Filters action
- [ ] FRONTEND-011-AC-10: `RecommendationControls` rendered only in Recommendations view
- [ ] FRONTEND-011-AC-11: `RecommendationsList` re-fetches on `query` prop change
- [ ] FRONTEND-011-AC-12: any control change triggers re-fetch, no Apply button
- [ ] FRONTEND-011-AC-13: fetch errors use existing error/Retry path, no new one
