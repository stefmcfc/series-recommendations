# Frontend Spec 019: Multi-Source Recommendation Display & Sort Controls

**Status**: Done
**Priority**: P2 (fixes an undercounting display bug in an existing discovery feature and adds a related sort control — quality-of-life, not core CRUD)
**Depends on**: `series_spec_015_multi_source_recommendations.md` (backend, paired — replaces `RecommendationDto.sourceTitle: String` with `sourceTitles: List<String>`/`totalSourceCount: Integer`, adds `maxSourcesShown`/`sortBy` request criteria; may show as "Not started" since it is being written/implemented alongside this spec in the same session), `frontend_spec_011_recommendation_controls.md` ✅ (this spec extends `RecommendationControls`'s Filters section and immediate-submit control machinery directly), `frontend_spec_010_recommendations.md` ✅ (`RecommendationsList`, `Recommendation` type, `seriesApi.getRecommendations` base contract)
**Frontend Stage**: 19 of N

## Overview

`RecommendationsList`'s "Because you watched X" line currently reads only `Recommendation.sourceTitle: string | null` — a single title — even when a suggested series was actually recommended by *several* of the user's watched series. `series_spec_015_multi_source_recommendations.md` fixes this on the backend by replacing that field with a capped, best-source-first `sourceTitles: string[]` plus a `totalSourceCount: number` giving the true uncapped count. This spec is the frontend consumer of that change: it updates the `Recommendation` type and `RecommendationsList`'s render logic to build a joined, overflow-aware sentence from the new shape, wires the two new `RecommendationQuery` criteria fields (`maxSourcesShown`, `sortBy`) through `seriesApi`, adds a `Max Sources Shown` filter field to `RecommendationControls`'s existing Filters section, and adds a new top-level `Sort By` control (`Best Match` / `Most Recommended`) that sits alongside the `Recommendation Source` mode fieldset rather than inside the collapsible filters.

**Design decisions**:
- **Label format is a plain comma join, no "and" between titles** — `sourceTitles.join(', ')`, then `" and {N} more"` appended only when `totalSourceCount > sourceTitles.length` (`N = totalSourceCount - sourceTitles.length`), omitted entirely otherwise. This deliberately matches the existing plain-comma-join convention `genres` already uses elsewhere in this app (`RecommendationService.joinGenres` on the backend; `SeriesEntity.genres`/`Recommendation.genres` rendered as-is on the frontend) rather than "proper" Oxford-comma-with-and English, for consistency with that precedent. Confirmed example: `sourceTitles = ["Slow Horses", "24"]`, `totalSourceCount = 3` → `"Because you watched Slow Horses, 24 and 1 more"`.
- **`Max Sources Shown` lives inside the existing Filters section, next to `Max Per Source`** — it's a narrowing/shaping output parameter exactly like `maxPerSource`, so it belongs with the other fields a user only occasionally needs to open the Filters section for, wired with the same `updateField`/state pattern and included in `handleResetFilters`'s reset list.
- **`Sort By` is a top-level, always-visible control, not a Filters-section field** — unlike a filter (which narrows results), sort order changes how the *whole* result set is primarily browsed, so hiding it behind the same collapsed-by-default toggle as the narrowing filters would bury a control that affects every visible card, not just which ones appear. It's positioned near the existing `Recommendation Source` mode fieldset at the top of `RecommendationControls`, as a peer-level primary control.
- **`sortBy` is omitted from the outgoing `RecommendationQuery` when set to its default (`'score'`)**, and only included when the user picks `'recommendationCount'` — this mirrors every other optional field in `RecommendationControls`/`buildRecommendationParams`, all of which are omitted at their default/empty state rather than sent explicitly (`FRONTEND-011-AC-08`). The backend's own default is already `'score'` (`series_spec_015`), so omitting it is behaviorally identical to sending it and keeps the query string minimal.
- **This spec fully replaces `sourceTitle`, it does not add `sourceTitles` alongside it.** `series_spec_015` removes the single-string field from `RecommendationDto` outright (see its own design decisions), so `RecommendationsList`'s existing null-check render branch (`FRONTEND-010-AC-08/09/10`) and the corresponding `makeRecommendation` test helper in `RecommendationsList.test.tsx` are updated in place as part of this work, not left running alongside new code for the replaced field.

---

## Requirements

### Requirement 1: Types

**User story**: As a developer, I want the new multi-source shape and criteria fields typed, so `RecommendationsList` and `RecommendationControls` have a single typed contract to build against.

#### Acceptance Criteria

- **FRONTEND-019-AC-01** [AUTO]: `src/types/series.ts`'s `Recommendation` interface shall replace `sourceTitle: string | null` with `sourceTitles: string[]` and `totalSourceCount: number`.
- **FRONTEND-019-AC-02** [AUTO]: `src/types/series.ts`'s `RecommendationQuery` interface shall gain `maxSourcesShown?: number` and `sortBy?: 'score' | 'recommendationCount'`.

---

### Requirement 2: `seriesApi` Wiring

**User story**: As a developer, I want `maxSourcesShown` and `sortBy` threaded through `seriesApi.getRecommendations`, so `RecommendationControls` has a working parameter to send.

#### Acceptance Criteria

- **FRONTEND-019-AC-03** [AUTO]: `seriesApi.ts`'s `buildRecommendationParams` shall include `maxSourcesShown` in the outgoing params whenever `query.maxSourcesShown != null`, following the exact same pattern already used for `maxPerSource`.
- **FRONTEND-019-AC-04** [AUTO]: `buildRecommendationParams` shall include `sortBy` in the outgoing params whenever `query.sortBy` is present and non-empty, following the same present-and-non-empty-string pattern already used for `language`; it shall be omitted entirely when `query.sortBy` is absent.

---

### Requirement 3: `RecommendationsList` Multi-Source Label

**User story**: As a user, I want to see every series (up to a sensible cap) that led to a suggestion, and how many more contributed beyond that, so "Because you watched X" doesn't hide the fact that Y and Z also recommended it.

#### Acceptance Criteria

- **FRONTEND-019-AC-05** [AUTO]: When `r.sourceTitles.length > 0`, `RecommendationsList` shall render `Because you watched {r.sourceTitles.join(', ')}` in place of its previous single-`sourceTitle` line — a plain comma join with no "and" between titles.
- **FRONTEND-019-AC-06** [AUTO]: When `r.totalSourceCount > r.sourceTitles.length`, `RecommendationsList` shall append `" and {N} more"` to that sentence, where `N = r.totalSourceCount - r.sourceTitles.length`; when `r.totalSourceCount === r.sourceTitles.length`, no suffix is appended.
- **FRONTEND-019-AC-07** [AUTO]: When `r.sourceTitles.length === 0`, `RecommendationsList` shall render no "Because you watched" line at all — the array-length check replaces the previous `r.sourceTitle !== null` check entirely.

---

### Requirement 4: `RecommendationControls` — Max Sources Shown Filter

**User story**: As a user, I want to control how many source titles are shown per recommendation, so I can see more attribution detail or keep cards compact, independent of how many sources actually contributed.

#### Acceptance Criteria

- **FRONTEND-019-AC-08** [AUTO]: `RecommendationControls` shall render a `Max Sources Shown` number input inside the existing collapsible Filters section, positioned adjacent to the existing `Max Per Source` field, following the same `<div className={styles.field}>`/`updateField` wiring pattern as every other Filters-section field.
- **FRONTEND-019-AC-09** [AUTO]: When the `Max Sources Shown` field is left blank, `maxSourcesShown` shall be omitted from the resulting `RecommendationQuery` entirely (not sent as an empty string or `0`) — same convention as every other Filters-section field (`FRONTEND-011-AC-08`).
- **FRONTEND-019-AC-10** [AUTO]: `RecommendationControls`'s `Reset Filters` action shall clear the `Max Sources Shown` field alongside every other Filters-section field it already resets.

---

### Requirement 5: `RecommendationControls` — Sort By Control

**User story**: As a user, I want to switch between "best overall match" and "most recommended by my watch history" ordering, so I can browse recommendations either way without it being buried behind the same toggle as narrowing filters.

#### Acceptance Criteria

- **FRONTEND-019-AC-11** [AUTO]: `RecommendationControls` shall render a `Sort By` control — `Best Match` (value `score`, default/checked) and `Most Recommended` (value `recommendationCount`) — as a top-level, always-visible control positioned near the existing `Recommendation Source` mode fieldset, outside and independent of the collapsible Filters section (i.e. visible whether or not Filters is expanded).
- **FRONTEND-019-AC-12** [AUTO]: Changing the `Sort By` selection shall update the query immediately, consistent with every other control's immediate-submit behavior (`FRONTEND-011-AC-12`): selecting `Most Recommended` sets `query.sortBy = 'recommendationCount'`; selecting `Best Match` omits `sortBy` from the query entirely (see Design Decisions' default-omission rationale).
- **FRONTEND-019-AC-13** [AUTO]: `RecommendationControls`'s `Reset Filters` action shall not alter the current `Sort By` selection — it is a top-level control, not a Filters-section field, mirroring how `Reset Filters` already leaves the sourcing mode/selection untouched (`FRONTEND-011-AC-09`).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationDto.sourceTitles`/`totalSourceCount`, `RecommendationCriteria.maxSourcesShown`/`sortBy`, `GET /api/v1/series/recommendations` param contract | `series_spec_015_multi_source_recommendations.md` |
| `RecommendationControls`, its Filters section, `updateField`/`updateState` wiring, immediate-submit convention, `Reset Filters` behavior, `RecommendationQuery` type, `buildRecommendationParams` | `frontend_spec_011_recommendation_controls.md` |
| `RecommendationsList` base render/loading/error/empty behavior, `Recommendation` type origin, `seriesApi.getRecommendations` | `frontend_spec_010_recommendations.md` |
| Plain comma-join (no "and") convention for multi-value display strings | `RecommendationService.joinGenres` (backend), `SeriesEntity.genres`/`Recommendation.genres` (rendered as-is) |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (additions)

```typescript
describe('FRONTEND-019-AC-03: getRecommendations wires maxSourcesShown', () => {
  it('includes maxSourcesShown in params when present', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })

    await seriesApi.getRecommendations({ maxSourcesShown: 2 })

    expect(client.get).toHaveBeenCalledWith('/series/recommendations', {
      params: { maxSourcesShown: 2 },
    })
  })
})

describe('FRONTEND-019-AC-04: getRecommendations wires sortBy', () => {
  it('includes sortBy when set to recommendationCount', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })

    await seriesApi.getRecommendations({ sortBy: 'recommendationCount' })

    expect(client.get).toHaveBeenCalledWith('/series/recommendations', {
      params: { sortBy: 'recommendationCount' },
    })
  })

  it('omits sortBy entirely when absent from the query', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })

    await seriesApi.getRecommendations({})

    expect(client.get).toHaveBeenCalledWith('/series/recommendations', {
      params: {},
    })
  })
})
```

### `src/components/RecommendationsList.test.tsx` (additions; `makeRecommendation` updated to use `sourceTitles: []`/`totalSourceCount: 0` in place of `sourceTitle: null`)

```typescript
describe('FRONTEND-019-AC-05/06: multi-source "Because you watched" label', () => {
  it('joins sourceTitles with a plain comma when there is no overflow', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ sourceTitles: ['Slow Horses', '24'], totalSourceCount: 2 }),
    ])
    render(<RecommendationsList />)

    expect(
      await screen.findByText('Because you watched Slow Horses, 24'),
    ).toBeInTheDocument()
  })

  it('appends "and N more" when totalSourceCount exceeds sourceTitles.length', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ sourceTitles: ['Slow Horses', '24'], totalSourceCount: 3 }),
    ])
    render(<RecommendationsList />)

    expect(
      await screen.findByText('Because you watched Slow Horses, 24 and 1 more'),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-019-AC-07: no line when sourceTitles is empty', () => {
  it('does not render "Because you watched" when sourceTitles is []', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ sourceTitles: [], totalSourceCount: 0 }),
    ])
    render(<RecommendationsList />)

    await screen.findByText('Ozark')
    expect(screen.queryByText(/because you watched/i)).not.toBeInTheDocument()
  })
})
```

### `src/components/RecommendationControls.test.tsx` (additions)

```typescript
describe('FRONTEND-019-AC-08/09: Max Sources Shown filter field', () => {
  it('renders inside Filters and updates the query when populated', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))

    fireEvent.change(screen.getByLabelText(/max sources shown/i), {
      target: { value: '2' },
    })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxSourcesShown: 2 }),
    )
  })

  it('omits maxSourcesShown from the query when left blank', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))

    fireEvent.change(screen.getByLabelText(/min tmdb rating/i), {
      target: { value: '7' },
    })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ maxSourcesShown: expect.anything() }),
    )
  })
})

describe('FRONTEND-019-AC-10: Reset Filters clears Max Sources Shown', () => {
  it('clears a populated Max Sources Shown field on Reset Filters', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))

    fireEvent.change(screen.getByLabelText(/max sources shown/i), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }))

    expect(screen.getByLabelText(/max sources shown/i)).toHaveValue(null)
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ maxSourcesShown: expect.anything() }),
    )
  })
})

describe('FRONTEND-019-AC-11: Sort By is a top-level control, defaults to Best Match', () => {
  it('is visible while Filters is collapsed, defaulted to Best Match', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    expect(screen.getByLabelText(/best match/i)).toBeChecked()
    expect(screen.queryByLabelText(/min tmdb rating/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-019-AC-12: selecting Most Recommended sets/unsets sortBy immediately', () => {
  it('sets sortBy on selection, omits it again once reverted to Best Match', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/most recommended/i))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'recommendationCount' }),
    )

    fireEvent.click(screen.getByLabelText(/best match/i))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ sortBy: expect.anything() }),
    )
  })
})

describe('FRONTEND-019-AC-13: Reset Filters does not affect Sort By', () => {
  it('leaves sortBy=recommendationCount in place after Reset Filters', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/most recommended/i))
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }))

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'recommendationCount' }),
    )
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-019-AC-01: `Recommendation.sourceTitles`/`totalSourceCount` replace `sourceTitle`
- [x] FRONTEND-019-AC-02: `RecommendationQuery.maxSourcesShown`/`sortBy`
- [x] FRONTEND-019-AC-03: `buildRecommendationParams` wires `maxSourcesShown`
- [x] FRONTEND-019-AC-04: `buildRecommendationParams` wires `sortBy`, omitted when absent
- [x] FRONTEND-019-AC-05: "Because you watched" joins `sourceTitles` with a plain comma
- [x] FRONTEND-019-AC-06: `" and {N} more"` suffix appended on overflow only
- [x] FRONTEND-019-AC-07: no line rendered when `sourceTitles` is empty
- [x] FRONTEND-019-AC-08: `Max Sources Shown` field in Filters, next to `Max Per Source`
- [x] FRONTEND-019-AC-09: blank `Max Sources Shown` omitted from the query
- [x] FRONTEND-019-AC-10: `Reset Filters` clears `Max Sources Shown`
- [x] FRONTEND-019-AC-11: `Sort By` is a top-level control, defaults to Best Match
- [x] FRONTEND-019-AC-12: `Sort By` change updates the query immediately; default omitted
- [x] FRONTEND-019-AC-13: `Reset Filters` does not affect `Sort By`
