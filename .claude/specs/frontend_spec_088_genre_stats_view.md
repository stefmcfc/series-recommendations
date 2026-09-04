# Frontend Spec 088: Genre Stats View

**Status**: Not started
**Depends on**: Series Spec 048 (`series_spec_048_genre_stats.md`), Frontend Spec 087 (`frontend_spec_087_analysis_section_nav_restructure.md`, the `AnalysisView` container this adds a tab into), Frontend Spec 086 (`frontend_spec_086_keyword_stats_filtering_sort_and_blended_rating.md`, the UI pattern this mirrors)
**Frontend Stage**: 88 of N

## Overview

Unit 3 of 4 in the "Analysis/Trends" expansion. Adds a "Genres" tab to the `AnalysisView`
container (`frontend_spec_087`), backed by a new `GenreStatsView` component that is
structurally identical to the enhanced `KeywordsView` (`frontend_spec_086`) — same table shape,
same three filter inputs, same sortable-column-with-direction-toggle behavior — just pointed at
`GET /series/genres/stats` instead of `GET /series/keywords`.

**Design decision**: `GenreStatsView` is a separate component rather than a generalized
`KeywordsView` made polymorphic. Per the note in `series_spec_048`'s companion frontend work and
this project's no-premature-abstraction convention, a second near-identical component doesn't yet
justify extracting a shared one — that becomes worth revisiting once the third copy
(`frontend_spec_089`, Country of Origin) exists.

---

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the genre-stats shape and fetch typed/available the same
way keyword stats already are.

#### Acceptance Criteria

- **FRONTEND-088-AC-01** [AUTO]: `src/types/series.ts` shall gain a `GenreStat` interface: `name:
  string`, `seriesCount: number`, `averagePersonalRating: number | null`,
  `averageBlendedRating: number | null` — identical shape to `KeywordStat`.
- **FRONTEND-088-AC-02** [AUTO]: `seriesApi` shall gain `getGenreStats`, matching
  `getKeywordStats`'s options-object signature (`frontend_spec_086` FRONTEND-086-AC-02) exactly,
  calling `GET /series/genres/stats` and unwrapping the `{ data, count }` envelope.

---

### Requirement 2: `GenreStatsView`

**User story**: As a user, I want to see which genres appear most often across my tracked series
and how I've rated shows in each, filterable and sortable the same way Keywords already is.

#### Acceptance Criteria

- **FRONTEND-088-AC-03** [AUTO]: A new `GenreStatsView` component shall render a table with
  columns "Genre" (sortable, `sortBy: 'name'`), "Series Count" (sortable), "Avg. Personal Rating"
  (sortable), "Avg. Blended Rating" (sortable) — structurally identical to `KeywordsView`
  (`frontend_spec_086`), including its three minimum-value filter inputs, "Apply Filters" button,
  and ▲/▼ direction-toggle behavior on every sortable column.
- **FRONTEND-088-AC-04** [AUTO]: `GenreStatsView` shall use the same loading (`role="status"`)
  and error (`role="alert"`) states as `KeywordsView`.
- **FRONTEND-088-AC-05** [AUTO]: `AnalysisView` (`frontend_spec_087`) shall gain a second sub-nav
  tab, `NavLink to="/analysis/genres"` labelled "Genres", rendering `GenreStatsView` when
  `tab === 'genres'`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `GET /series/genres/stats`, `GenreStatDto` shape, shared param contract | `series_spec_048_genre_stats.md` |
| Table/filter/sort UI pattern this spec mirrors exactly | `frontend_spec_086_keyword_stats_filtering_sort_and_blended_rating.md` |
| `AnalysisView` container/sub-nav this adds a tab into | `frontend_spec_087_analysis_section_nav_restructure.md` |

---

## TDD Test Case Sketches

### `src/components/GenreStatsView.test.tsx` (new file)

```typescript
describe('FRONTEND-088-AC-03: renders genre stats table', () => {
  it('renders a row per genre with all four columns', async () => {
    mockGetGenreStats.mockResolvedValue([
      { name: 'Drama', seriesCount: 5, averagePersonalRating: 4.2, averageBlendedRating: 7.8 },
    ])
    render(<GenreStatsView />)

    expect(await screen.findByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('7.8')).toBeInTheDocument()
  })
})
```

### `src/components/AnalysisView.test.tsx` (additions)

```typescript
describe('FRONTEND-088-AC-05: Genres tab', () => {
  it('renders GenreStatsView when the genres tab is active', () => {
    render(<AnalysisView />, { route: '/analysis/genres' })
    expect(screen.getByTestId('genre-stats-view')).toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [ ] FRONTEND-088-AC-01: `GenreStat` type
- [ ] FRONTEND-088-AC-02: `seriesApi.getGenreStats` (options-object signature)
- [ ] FRONTEND-088-AC-03: `GenreStatsView` table, filters, sort/direction toggle
- [ ] FRONTEND-088-AC-04: loading/error states match `KeywordsView`
- [ ] FRONTEND-088-AC-05: `AnalysisView` gains a "Genres" sub-nav tab
