# Frontend Spec 089: Country-of-Origin Stats View

**Status**: Done
**Depends on**: Series Spec 049 (`series_spec_049_country_of_origin_stats.md`), Frontend Spec 088 (`frontend_spec_088_genre_stats_view.md`, the tab this is added alongside), Frontend Spec 087 (`frontend_spec_087_analysis_section_nav_restructure.md`, the `AnalysisView` container this adds a tab into)
**Frontend Stage**: 89 of N

## Overview

Unit 4 of 4 in the "Analysis/Trends" expansion. Adds a "Country of Origin" tab to `AnalysisView`,
backed by a new `CountryStatsView` component — structurally identical to `KeywordsView`
(`frontend_spec_086`) and `GenreStatsView` (`frontend_spec_088`), differing only in resolving
each row's raw ISO code to a display name via the existing `formatCountryName` util
(`countryName.ts`), the same way `SeriesDetail`/`SeriesList` already render `originCountry`.

**Design decision**: sorting and filtering happen backend-side against the raw ISO code
(`series_spec_049`'s documented "known, accepted limitation" — alphabetical sort is by code, not
by the resolved display name). `CountryStatsView` only resolves the code to a name for **display**
in the table cell; it does not re-sort client-side by the resolved name, keeping this view's
sort behavior consistent with the other two tabs (server-driven, not partially client-corrected).

---

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the country-stats shape and fetch typed/available the same
way keyword and genre stats already are.

#### Acceptance Criteria

- **FRONTEND-089-AC-01** [AUTO]: `src/types/series.ts` shall gain a `CountryStat` interface:
  `name: string` (raw ISO 3166-1 alpha-2 code), `seriesCount: number`, `averagePersonalRating:
  number | null`, `averageBlendedRating: number | null` — identical shape to `KeywordStat`/
  `GenreStat`.
- **FRONTEND-089-AC-02** [AUTO]: `seriesApi` shall gain `getCountryStats`, matching
  `getKeywordStats`/`getGenreStats`'s options-object signature exactly, calling `GET
  /series/origin-country/stats` and unwrapping the `{ data, count }` envelope.

---

### Requirement 2: `CountryStatsView`

**User story**: As a user, I want to see which countries my tracked series most often originate
from and how I've rated shows from each, filterable and sortable the same way Keywords and Genres
already are.

#### Acceptance Criteria

- **FRONTEND-089-AC-03** [AUTO]: A new `CountryStatsView` component shall render a table with
  columns "Country" (sortable, `sortBy: 'name'`), "Series Count" (sortable), "Avg. Personal
  Rating" (sortable), "Avg. Blended Rating" (sortable) — structurally identical to `KeywordsView`/
  `GenreStatsView`, including the three minimum-value filter inputs, "Apply Filters" button, and
  ▲/▼ direction-toggle behavior on every sortable column.
- **FRONTEND-089-AC-04** [AUTO]: The "Country" column shall render each row's resolved display
  name via `formatCountryName(stat.name)` (e.g. `"GB"` → `"United Kingdom"`), not the raw code —
  matching how `SeriesDetail`/`SeriesList` already display `originCountry`. An unresolvable code
  falls back to the raw code unchanged, per `formatCountryName`'s own existing behavior.
- **FRONTEND-089-AC-05** [AUTO]: `CountryStatsView` shall use the same loading (`role="status"`)
  and error (`role="alert"`) states as `KeywordsView`/`GenreStatsView`.
- **FRONTEND-089-AC-06** [AUTO]: `AnalysisView` (`frontend_spec_087`) shall gain a third sub-nav
  tab, `NavLink to="/analysis/country-of-origin"` labelled "Country of Origin", rendering
  `CountryStatsView` when `tab === 'country-of-origin'`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `GET /series/origin-country/stats`, `CountryStatDto` shape, shared param contract, raw-code-sort limitation | `series_spec_049_country_of_origin_stats.md` |
| Table/filter/sort UI pattern this spec mirrors exactly | `frontend_spec_086_keyword_stats_filtering_sort_and_blended_rating.md`, `frontend_spec_088_genre_stats_view.md` |
| `formatCountryName` display-name resolution | `countryName.ts`, `frontend_spec_085_multi_origin_country_display.md` |
| `AnalysisView` container/sub-nav this adds a tab into | `frontend_spec_087_analysis_section_nav_restructure.md` |

---

## TDD Test Case Sketches

### `src/components/CountryStatsView.test.tsx` (new file)

```typescript
describe('FRONTEND-089-AC-03/04: renders country stats table with resolved names', () => {
  it('renders a resolved display name for each raw code', async () => {
    mockGetCountryStats.mockResolvedValue([
      { name: 'GB', seriesCount: 5, averagePersonalRating: 4.2, averageBlendedRating: 7.8 },
    ])
    render(<CountryStatsView />)

    expect(await screen.findByText('United Kingdom')).toBeInTheDocument()
    expect(screen.queryByText('GB')).not.toBeInTheDocument()
  })
})
```

### `src/components/AnalysisView.test.tsx` (additions)

```typescript
describe('FRONTEND-089-AC-06: Country of Origin tab', () => {
  it('renders CountryStatsView when the country-of-origin tab is active', () => {
    render(<AnalysisView />, { route: '/analysis/country-of-origin' })
    expect(screen.getByTestId('country-stats-view')).toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-089-AC-01: `CountryStat` type
- [x] FRONTEND-089-AC-02: `seriesApi.getCountryStats` (options-object signature)
- [x] FRONTEND-089-AC-03: `CountryStatsView` table, filters, sort/direction toggle
- [x] FRONTEND-089-AC-04: raw code resolved to display name via `formatCountryName`
- [x] FRONTEND-089-AC-05: loading/error states match `KeywordsView`/`GenreStatsView`
- [x] FRONTEND-089-AC-06: `AnalysisView` gains a "Country of Origin" sub-nav tab
