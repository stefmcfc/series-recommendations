# Frontend Spec 024: Keyword Tracking (Display, Stats View, Filter)

**Status**: Not started
**Depends on**: Series Spec 019 (`series_spec_019_keyword_tracking.md`, `GET /series/keywords`, `SeriesSearchCriteria.keywords`) — not yet written/implemented, Frontend Spec 005 (`SeriesDetail`) ✅, Frontend Spec 006 (`SearchFilter`) ✅, Frontend Spec 018 (`tags` display precedent) ✅
**Frontend Stage**: 24 of N

## Overview

Surfaces Series Spec 019's normalized TMDB keyword tracking: read-only keyword chips on `SeriesDetail`, a new modest "Keywords" stats view (a sortable table of keyword × how many tracked series carry it × their average personal rating — e.g. "spy — 4 series — avg. 4.2"), and a `SearchFilter` keyword filter. Unlike the existing free-text `Genres`/`Tags` inputs, the keyword filter is a **fixed-vocabulary multi-select sourced from the backend** (`GET /series/keywords`), following the same rationale already established for the genre-vocabulary fix (`series_spec_010`/`frontend_spec_014`): TMDB keyword names are a real, spelling-stable vocabulary, so a free-text input would only reintroduce the same silent-typo-mismatch risk that fix eliminated for genres.

**Design decisions**:
- **The Keywords stats view is a plain sortable table, not a chart.** This is a first pass at making the aggregate data visible at all — matches the project's general "small, self-contained" sizing for a first cut, per the companion backend spec's own explicit scope boundary (no recommendation/filter weighting yet).
- **`SeriesDetail`'s keyword chips are read-only display only — no per-series keyword editing.** Keywords are entirely TMDB-sourced and synced on create/refresh (`series_spec_019`); there is no user-authored keyword concept the way there is for `tags`, so no form integration is added to `Add`/`EditSeriesForm`.
- **The `SearchFilter` keyword control is a multi-select populated from `GET /series/keywords`, not a free-text input**, mirroring `frontend_spec_014`'s genre checkbox-list fix rather than the free-text pattern `SearchFilter`'s own `genres`/existing fields still use — see Design Decisions on the companion backend spec for why this one field deliberately doesn't match those siblings.
- **The Keywords view is reachable via the same top-level nav toggle pattern `App.tsx` already uses for Recommendations** (`frontend_spec_010`) — a third top-level view alongside the series list and Recommendations, not nested inside either.

---

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the keyword stats shape and series-level keyword data typed centrally, so every consuming component shares one contract.

#### Acceptance Criteria

- **FRONTEND-024-AC-01** [AUTO]: `src/types/series.ts` shall gain a `KeywordStat` interface: `name: string`, `seriesCount: number`, `averagePersonalRating: number | null`.
- **FRONTEND-024-AC-02** [AUTO]: `Series` shall gain a `keywords: string[]` field (names only — the flattened `KeywordEntity.name` values for that series; empty array, never omitted, when a series has none).
- **FRONTEND-024-AC-03** [AUTO]: `SearchCriteria` shall gain a `keywords?: string[]` field, following the exact convention `genres?: string[]` already uses on the same interface.
- **FRONTEND-024-AC-04** [AUTO]: `seriesApi` shall gain `getKeywordStats: (sortBy?: 'seriesCount' | 'averagePersonalRating') => Promise<KeywordStat[]>`, calling `GET /series/keywords` (with `sortBy` as a query param when provided) and unwrapping the `{ data, count }` envelope, following the exact pattern `getGenreOptions` already uses for its own single-array-fetch shape.
- **FRONTEND-024-AC-05** [AUTO]: `buildSearchParams` (the shared helper already used by both `search` and `export`) shall include `params.keyword = criteria.keywords` (repeatable param, mirroring `params.genre = criteria.genres`'s exact existing line) when `criteria.keywords?.length` is truthy.

---

### Requirement 2: `SeriesDetail` — Keyword Chips

**User story**: As a user viewing a series' full record, I want to see its TMDB keywords, so I can see at a glance what it's actually about beyond its broad genre.

#### Acceptance Criteria

- **FRONTEND-024-AC-06** [AUTO]: `SeriesDetail` shall render a new `Keywords` `<dl>` entry (`<div className={styles.field}><dt>Keywords</dt><dd>...</dd></div>`), positioned immediately after the existing `Tags` entry (`frontend_spec_018`), within the existing `<dl className={styles.fields}>` list.
- **FRONTEND-024-AC-07** [AUTO]: When `series.keywords` is non-empty, the entry's `<dd>` shall render each keyword as a small read-only chip/pill element (comma-adjacent inline `<span>` elements are acceptable — no new interaction, just visual separation from a single unstructured string, since unlike `tags`/`genres` this is a real array rather than a delimited string). When empty, it shall render `—`, matching `formatValue`'s existing null-dash convention used by every sibling field on this component.

---

### Requirement 3: Keywords Stats View

**User story**: As a user, I want to see which keywords show up most across my tracked series and how I've rated shows carrying each one, so I can spot patterns in what I actually enjoy.

#### Acceptance Criteria

- **FRONTEND-024-AC-08** [AUTO]: A new `KeywordsView` component shall fetch and render `seriesApi.getKeywordStats()` results in a table with columns `Keyword`, `Series Count`, `Avg. Personal Rating` (rendering `—` for a `null` average, matching this app's established null-dash convention).
- **FRONTEND-024-AC-09** [AUTO]: The table's column headers (`Series Count`, `Avg. Personal Rating`) shall be clickable, re-fetching via `seriesApi.getKeywordStats(sortBy)` with the corresponding `sortBy` value — following the same "control re-fetches with the current param" pattern already established for `SeriesList`'s sort control (`frontend_spec_013` FRONTEND-013-AC-13).
- **FRONTEND-024-AC-10** [AUTO]: `App.tsx` shall gain a third top-level nav toggle, `Keywords`, alongside the existing series-list/Recommendations toggle (`frontend_spec_010`), rendering `KeywordsView` when active.
- **FRONTEND-024-AC-11** [AUTO]: While the fetch is in flight, `KeywordsView` shall display a loading state (`role="status"`), matching `SeriesList`/`RecommendationsList`'s existing loading-state convention. If the fetch rejects, it shall display an error message (`role="alert"`), matching those same components' existing error-state convention.

---

### Requirement 4: `SearchFilter` — Keyword Filter

**User story**: As a user, I want to filter my series list down to ones carrying a specific keyword, the same way I can already filter by genre or status.

#### Acceptance Criteria

- **FRONTEND-024-AC-12** [AUTO]: `SearchFilter` shall fetch `GET /series/keywords` (via `seriesApi.getKeywordStats()`) on mount and render its `name` values as a multi-select control (checkbox list, following `frontend_spec_014`'s genre-checkbox-list precedent exactly, rather than `SearchFilter`'s own free-text `genres` input's shape).
- **FRONTEND-024-AC-13** [AUTO]: Selected keyword names shall be included in the criteria object built on Search as `criteria.keywords: string[]`, omitted (not sent as an empty array) when nothing is selected — following the same omit-when-empty convention `genres` already uses in the same component.
- **FRONTEND-024-AC-14** [AUTO]: If the `GET /series/keywords` fetch fails, the keyword filter section shall render a scoped inline error and simply show no checkboxes, without blocking the rest of `SearchFilter` from rendering or functioning — same degrade-gracefully posture as `frontend_spec_014`'s genre checkbox list on a failed `getGenreOptions` call.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `GET /series/keywords`, `KeywordStatDto` shape, `SeriesSearchCriteria.keywords`, exact-match keyword filter semantics | `series_spec_019_keyword_tracking.md` (not yet written) |
| `formatValue` null-dash convention, `<dl className={styles.fields}>` structure, existing field ordering (`Tags` entry this spec's `Keywords` entry is positioned after) | `frontend_spec_005_series_detail.md`, `frontend_spec_018_tags.md` |
| Genre checkbox-list precedent this spec's `SearchFilter` keyword control and its failure-handling both mirror | `series_spec_010_genre_dropdown.md`, `frontend_spec_014_genre_dropdown.md` |
| `SeriesList` sort-control re-fetch-on-change pattern this spec's `KeywordsView` column-sort mirrors | `frontend_spec_013_star_ratings.md` |
| Top-level nav toggle pattern (`App.tsx`) this spec's `Keywords` view addition follows | `frontend_spec_010_recommendations.md` |
| `buildSearchParams`, `getGenreOptions`, `{ data, count }` envelope-unwrapping convention | `frontend_spec_001.md`, `seriesApi.ts` |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (additions)

```typescript
describe('FRONTEND-024-AC-04: getKeywordStats', () => {
  it('fetches /series/keywords and unwraps the envelope', async () => {
    client.get.mockResolvedValue({
      data: { data: [{ name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 }], count: 1 },
    })

    const result = await seriesApi.getKeywordStats()

    expect(client.get).toHaveBeenCalledWith('/series/keywords', { params: {} })
    expect(result).toEqual([{ name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 }])
  })

  it('passes sortBy as a query param when provided', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })

    await seriesApi.getKeywordStats('averagePersonalRating')

    expect(client.get).toHaveBeenCalledWith('/series/keywords', {
      params: { sortBy: 'averagePersonalRating' },
    })
  })
})
```

### `src/components/SeriesDetail.test.tsx` (additions)

```typescript
describe('FRONTEND-024-AC-06/07: Keywords entry rendered', () => {
  it('renders each keyword as a chip', async () => {
    mockGetById.mockResolvedValue(makeSeries({ keywords: ['spy', 'mi5'] }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('Keywords')).toBeInTheDocument()
    expect(screen.getByText('spy')).toBeInTheDocument()
    expect(screen.getByText('mi5')).toBeInTheDocument()
  })

  it('renders a dash when there are no keywords', async () => {
    mockGetById.mockResolvedValue(makeSeries({ keywords: [] }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText('Keywords')
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
```

### `src/components/KeywordsView.test.tsx` (new file)

```typescript
describe('FRONTEND-024-AC-08: renders keyword stats table', () => {
  it('renders a row per keyword', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
      { name: 'period drama', seriesCount: 2, averagePersonalRating: null },
    ])
    render(<KeywordsView />)

    expect(await screen.findByText('spy')).toBeInTheDocument()
    expect(screen.getByText('4.2')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('FRONTEND-024-AC-09: sortable column headers re-fetch with sortBy', () => {
  it('re-fetches with sortBy=averagePersonalRating on header click', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalledWith(undefined))

    fireEvent.click(screen.getByRole('columnheader', { name: /avg\. personal rating/i }))

    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith('averagePersonalRating'),
    )
  })
})

describe('FRONTEND-024-AC-11: loading and error states', () => {
  it('shows a loading state while the fetch is in flight', () => {
    mockGetKeywordStats.mockReturnValue(new Promise(() => {}))
    render(<KeywordsView />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error alert when the fetch rejects', async () => {
    mockGetKeywordStats.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<KeywordsView />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
```

### `src/components/SearchFilter.test.tsx` (additions)

```typescript
describe('FRONTEND-024-AC-12/13: keyword checkbox filter', () => {
  it('includes selected keywords in criteria, omits when none selected', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    const onSearch = vi.fn()
    render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)

    await screen.findByLabelText('spy')
    fireEvent.click(screen.getByLabelText('spy'))
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: ['spy'] }))
  })
})

describe('FRONTEND-024-AC-14: keyword fetch failure degrades gracefully', () => {
  it('renders the rest of SearchFilter when getKeywordStats rejects', async () => {
    mockGetKeywordStats.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [ ] FRONTEND-024-AC-01: `KeywordStat` type
- [ ] FRONTEND-024-AC-02: `Series.keywords: string[]`
- [ ] FRONTEND-024-AC-03: `SearchCriteria.keywords?: string[]`
- [ ] FRONTEND-024-AC-04: `seriesApi.getKeywordStats(sortBy?)`
- [ ] FRONTEND-024-AC-05: `buildSearchParams` includes `keyword` when present
- [ ] FRONTEND-024-AC-06: `SeriesDetail` Keywords `<dl>` entry, positioned after Tags
- [ ] FRONTEND-024-AC-07: keyword chips rendered; dash when empty
- [ ] FRONTEND-024-AC-08: `KeywordsView` table (keyword / count / avg rating)
- [ ] FRONTEND-024-AC-09: sortable column headers re-fetch with `sortBy`
- [ ] FRONTEND-024-AC-10: `App.tsx` gains a `Keywords` nav toggle
- [ ] FRONTEND-024-AC-11: loading/error states on `KeywordsView`
- [ ] FRONTEND-024-AC-12: `SearchFilter` keyword checkbox list, sourced from the backend
- [ ] FRONTEND-024-AC-13: selected keywords included in criteria, omitted when none
- [ ] FRONTEND-024-AC-14: keyword-fetch failure degrades gracefully, scoped error only
