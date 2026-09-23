# Frontend Spec 128: Filter My Series by Origin Country / Original Language

**Status**: Complete
**Priority**: P3
**Depends on**: `series_spec_065_origin_country_language_filter.md` (companion backend spec — new
`originCountry`/`originalLanguage` query params on `GET /api/v1/series/search`/`GET
/api/v1/series/export`), `frontend_spec_055_search_filter_overhaul.md` (established `SearchFilter.tsx`'s
`FormState`/`buildCriteria`/`formStateFromCriteria` wiring pattern this spec extends),
`frontend_spec_081_use_my_series_page_restructure.md` (established the client-side filter pattern for
"Recs > Use My Series" this spec extends), `frontend_spec_085_multi_origin_country_display.md`
(`Series.originCountry`'s comma-joined multi-value display shape), `frontend_spec_117_series_language_display.md`
(`Series.originalLanguage`, `formatLanguageName`), `frontend_spec_122_rating_filter_and_step_refinements.md`
(closest recent precedent — identical shape of change: two new filter fields threaded through
`SearchFilter.tsx`/`UseMySeriesPanel.tsx`/`RecommendationControls.tsx`/`seriesApi.ts`/`types/`)
**Area**: Frontend (`types/series.ts`, `types/filterProfile.ts`, `services/seriesApi.ts`,
`components/SearchFilter.tsx`, `components/UseMySeriesPanel.tsx`, `components/RecommendationControls.tsx`)

## Overview

`Series.originCountry`/`Series.originalLanguage` are already fetched and displayed everywhere a series
appears, but neither field is filterable in "My Series" or "Recs > Use My Series" today. This spec adds
a Country filter (multi-select, OR-matched — a series co-produced across two countries matches a filter
naming either one) and a Language filter (single-select, exact-matched) to both surfaces, consuming the
companion backend spec's new `originCountry`/`originalLanguage` query params for "My Series"/export, and
filtering the candidate pool client-side for "Use My Series" — the same "add two fields to both
surfaces" shape `frontend_spec_122` established for its own pair of Rotten Tomatoes min-rating filters.

## Design Decisions

- **Country is multi-value (`string[]`), Language is single-value (`string`)** — mirrors the companion
  backend spec's own `originCountry`/`originalLanguage` asymmetry exactly (`series_spec_065`'s Design
  Decisions: `originCountry` is comma-joined multi-value on the entity, `originalLanguage` is documented
  single-value-only). This is the same asymmetry `RecommendationQuery.countries`/`RecommendationQuery.language`
  already model for Discover/Custom Search (`frontend_spec_047`'s Design Decisions), just applied here
  to My Series/Use My Series instead.
- **Correction (post-ship, reported by the user testing the live feature): Country/Language use
  `COUNTRY_OPTIONS`/`LANGUAGE_OPTIONS` with `pinnedOptions={countryFavourites}`/`{languageFavourites}`,
  not `ALL_COUNTRY_OPTIONS` with no pinning.** The original text below argued this filter is
  "plain, un-favourited," and reached for `ALL_COUNTRY_OPTIONS` on that basis — but
  `ALL_COUNTRY_OPTIONS` is documented in `countryOptions.ts` itself as "used only by the Settings
  Country Favourites editor," not as a general-purpose substitute for a favourites-aware picker.
  Every *consuming* picker elsewhere in the app (`CustomSearchPanel.tsx`/`RecommendationFiltersBox.tsx`)
  reads the user's saved favourites via `useLocalStorage('countryFavourites', DEFAULT_COUNTRY_FAVOURITES,
  isCountryFavourites)` (same for language) and passes them as `pinnedOptions` alongside the disjoint
  `COUNTRY_OPTIONS`/`LANGUAGE_OPTIONS` list — there was no real "un-favourited" precedent to follow;
  this filter is exactly the same *kind* of consumer as those two, just on a different page, and should
  behave identically (GB/US pinned at the top by default, matching a user's actual saved favourites).
  Fixed to reuse that exact pattern, including the pinned entries' bare-code display (`"GB"`/`"US"`, not
  `"United Kingdom"`/`"United States"`) — see `RecommendationFiltersBox.test.tsx`/`CustomSearchPanel.test.tsx`
  for the same established display convention this filter now also follows.
- **Language reuses `LANGUAGE_OPTIONS`/the existing single-select adapter pattern verbatim, both
  exported from `RecommendationControls.tsx`.** `LANGUAGE_OPTIONS` is already the app's one canonical
  language catalog (`frontend_spec_098`); duplicating it would let the two lists drift. The
  `selected={val ? [val] : []}` / `onChange: (next) => next.at(-1) ?? ''` adapter that makes
  `KeywordPicker` (a multi-select component) behave as a single-select is already established at
  `RecommendationFiltersBox.tsx`'s own Language field — reused here unchanged rather than introducing a
  second single-select mechanism.
- **`seriesApi.ts`'s `buildSearchParams` needs no separate export-specific wiring.** `seriesApi.export`
  already calls `buildSearchParams(filters)` for its query params (same function `search` uses) — once
  `originCountry`/`originalLanguage` are added there, both `GET /series/search` and `GET /series/export`
  pick them up automatically, mirroring the backend's own "both endpoints get the filter" design
  decision (`series_spec_065`) without any additional frontend code.
- **`UseMySeriesPanel.tsx`/`RecommendationControls.tsx` gain matching client-side filters for parity**,
  following `frontend_spec_122`'s own AC-03 precedent of adding new My Series filter fields to both
  `SearchFilter.tsx` and the Use My Series candidate-pool filter chain. The new
  `filterSpecificSeriesByOriginCountry`/`filterSpecificSeriesByOriginalLanguage` functions mirror the
  backend's own `matchesOriginCountry`(OR/substring)/`matchesOriginalLanguage`(exact) semantics exactly,
  the same way the existing `filterSpecificSeriesByGenre`/`filterSpecificSeriesByStatus` client-side
  functions already mirror their backend counterparts.
- **New fields are named with the `Filter` suffix** (`originCountryFilter: string[]`,
  `originalLanguageFilter: string`) in `UseMySeriesFilterCriteria` and `SpecificSeriesFilters`, matching
  those interfaces' own existing convention (`genreFilter`, `excludeGenreFilter`, `keywordsFilter`,
  `statusFilter` — `statusFilter` in particular already establishes that a single (non-array) value still
  takes the `Filter` suffix, not just array-typed fields). The corresponding local `useState` names in
  `UseMySeriesPanel.tsx` follow the same `specificSeries<Field>` convention as every sibling field
  (`specificSeriesGenreFilter`, `specificSeriesKeywordsFilter`) — `specificSeriesOriginCountryFilter`/
  `specificSeriesOriginalLanguageFilter`.
- **The two new client-side filter functions are inserted into `buildSpecificSeriesCandidatePool`'s
  chain immediately after `filterSpecificSeriesByExcludeGenre` and before `filterSpecificSeriesByStatus`**
  — keeps the categorical filters (genre, exclude-genre, origin country, original language, status)
  grouped together ahead of the rating/year filters, the same categorical-before-numeric grouping the
  companion backend spec applies to `SeriesSearchCriteria`'s own field order.

---

## Requirement 1: Types and query-param wiring

**User story**: As a developer, I want the new backend query params represented end-to-end in the
frontend's type layer, so every consumer (My Series search, export, saved filter profiles) can send
them without redeclaring the shape.

### FRONTEND-128-AC-01 [AUTO]
**Statement**: `SearchCriteria` (`types/series.ts`) shall gain `originCountry?: string[]` and
`originalLanguage?: string`. `MySeriesFilterCriteria` (`types/filterProfile.ts`) shall gain the same two
fields, matching `SearchCriteria`'s shape directly. `UseMySeriesFilterCriteria` (`types/filterProfile.ts`)
shall gain `originCountryFilter: string[]` and `originalLanguageFilter: string`, matching its own
existing `Filter`-suffixed naming convention. `seriesApi.ts`'s `buildSearchParams` shall include
`originCountry` (as a repeated array param, via `addArrayIfNonEmpty`) and `originalLanguage` (via
`addIfPresent`) in its emitted query params when set.

**References**: `types/series.ts` (`SearchCriteria`, immediately after the existing `status` field, line
300), `types/filterProfile.ts` (`MySeriesFilterCriteria` lines 32-44, `UseMySeriesFilterCriteria` lines
49-76), `services/seriesApi.ts` lines 176-219 (`buildSearchParams`, specifically line 185's existing
`addIfPresent(params, 'status', criteria.status)` — the insertion point — and lines 88-94's
`addArrayIfNonEmpty` helper, the one `genre`/`excludeGenre`/`keyword` already use for repeated params).

**Test Case (Red)**:
```typescript
describe('FRONTEND-128-AC-01: buildSearchParams includes origin country/language fields', () => {
  it('includes originCountry/originalLanguage when set', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })
    await seriesApi.search({
      originCountry: ['GB', 'US'],
      originalLanguage: 'en',
    })

    const args = client.get.mock.calls[0][1] as {
      params: Record<string, unknown>
    }
    expect(args.params.originCountry).toEqual(['GB', 'US'])
    expect(args.params.originalLanguage).toBe('en')
  })

  it('omits both fields when absent', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })
    await seriesApi.search({ title: 'office' })

    const args = client.get.mock.calls[0][1] as {
      params: Record<string, unknown>
    }
    expect(args.params.originCountry).toBeUndefined()
    expect(args.params.originalLanguage).toBeUndefined()
  })
})
```
**Test Case (Green)**: add the two fields to `SearchCriteria`/`MySeriesFilterCriteria`, the two
`Filter`-suffixed fields to `UseMySeriesFilterCriteria`, and two calls in `buildSearchParams` —
`addArrayIfNonEmpty(params, 'originCountry', criteria.originCountry)` and `addIfPresent(params,
'originalLanguage', criteria.originalLanguage)` — mirroring `status`'s existing line shape.

---

## Requirement 2: My Series filters

**User story**: As a user filtering My Series, I want to filter to only series originating from a
country I choose, or in a language I choose, the same way I already can by genre or status.

### FRONTEND-128-AC-02 [AUTO]
**Statement**: `SearchFilter.tsx` shall render a new "Origin" section with a Country field (`KeywordPicker`,
multi-select, `options={COUNTRY_OPTIONS}`, `pinnedOptions={countryFavourites}`) and a Language field
(`KeywordPicker`, single-select via the `selected={val ? [val] : []}` / `onChange: (next) => next.at(-1) ?? ''`
adapter, `options={LANGUAGE_OPTIONS}`, `pinnedOptions={languageFavourites}`), both included in the
submitted search criteria when non-empty, and round-tripped correctly through `formStateFromCriteria`
(saved filter profiles). `countryFavourites`/`languageFavourites` are read via
`useLocalStorage('countryFavourites', DEFAULT_COUNTRY_FAVOURITES, isCountryFavourites)` (same for
language), mirroring `CustomSearchPanel.tsx`/`RecommendationFiltersBox.tsx`'s own Discover pickers
exactly, so a user's saved favourites (GB/US by default) render pinned at the top here too.

**References**: `components/SearchFilter.tsx` — `FormState`/`initialFormState` (lines 32-75, specifically
the `updateField` curried handler's `Exclude<keyof FormState, ...>` type at lines 214-219, which must
also exclude the new array-typed `originCountrySelected` field), `buildCriteria` (lines 77-114), the
"Genres & Keywords" section JSX (lines 331-377, the section this spec's new "Origin" section is inserted
immediately after) and its `handleGenresChange`/`handleKeywordsChange` handlers (lines 244-257, the
pattern the new Country field's own `handleOriginCountryChange` mirrors), `formStateFromCriteria` (lines
121-163). `types/filterProfile.ts`'s `MySeriesFilterCriteria` needs the two fields added too (AC-01), or
the new criteria silently won't round-trip through saved profiles.

**Test Case (Red)**:
```typescript
describe('FRONTEND-128-AC-02: origin country/language filters in My Series', () => {
  it('includes both origin fields in the submitted criteria when filled in', () => {
    const { onSearch } = renderFilter()
    fireEvent.click(screen.getByLabelText('Country'))
    fireEvent.click(screen.getByText('United Kingdom'))
    fireEvent.click(screen.getByLabelText('Language'))
    fireEvent.click(screen.getByText('English'))
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        originCountry: ['GB'],
        originalLanguage: 'en',
      }),
    )
  })

  it('round-trips both origin fields through a saved filter profile', async () => {
    mockListFilterProfiles.mockResolvedValue([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'UK English',
        criteria: { originCountry: ['GB'], originalLanguage: 'en' },
        createdAt: '',
        updatedAt: '',
      },
    ])
    renderFilter()
    fireEvent.click(await screen.findByText('UK English'))
    expect(screen.getByText('GB')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add `originCountrySelected: string[]`/`originalLanguage: string` to
`FormState`/`initialFormState` (`[]`/`''`); add `originCountrySelected` to `updateField`'s `Exclude` type
alongside `genresSelected`/`keywordsSelected`; a `handleOriginCountryChange` handler mirroring
`handleKeywordsChange`; two lines in `buildCriteria` (`if (form.originCountrySelected.length > 0)
criteria.originCountry = form.originCountrySelected`, `if (form.originalLanguage.trim() !== '')
criteria.originalLanguage = form.originalLanguage`); two lines in `formStateFromCriteria` mirroring
`keywordsSelected`/`minImdbRating`'s shape; a new "Origin" `<section>` (after "Genres & Keywords", before
"Ratings") with the two `KeywordPicker` fields described above; the two fields added to
`MySeriesFilterCriteria` in `types/filterProfile.ts` (AC-01).

---

## Requirement 3: Use My Series filters

**User story**: As a user picking source series for recommendations via "Use My Series", I want to
narrow the picker to series from a country I choose, or in a language I choose, the same way I already
can by genre.

### FRONTEND-128-AC-03 [AUTO]
**Statement**: `UseMySeriesPanel.tsx`'s specific-series picker shall gain matching Country
(`KeywordPicker`, multi-select) and Language (`KeywordPicker`, single-select) fields, filtering the
candidate pool client-side — a series matches the Country filter if any of its comma-joined origin
countries matches any selected filter country (OR/substring, mirroring the backend's
`matchesOriginCountry` semantics); a series matches the Language filter only on an exact match against
its `originalLanguage`.

**References**: `components/UseMySeriesPanel.tsx` — `specificSeriesGenreFilter`/
`specificSeriesExcludeGenreFilter` state (lines 61-71, the pattern the two new `useState` calls mirror),
`currentUseMySeriesCriteria` (lines 124-138), `applyUseMySeriesFilterCriteria` (lines 143-161),
`handleClearSpecificSeriesFilters` (lines 185-199), the `filterFourColGrid` Genre/Keywords row (lines
389-447, the new Country/Language fields render in a matching row). `components/RecommendationControls.tsx`
— `SpecificSeriesFilters` (lines 764-784), `filterSpecificSeriesByGenre`/`filterSpecificSeriesByExcludeGenre`
(lines 500-534, the OR/substring pattern `filterSpecificSeriesByOriginCountry` mirrors),
`buildSpecificSeriesCandidatePool`'s filter chain (lines 821-858, insertion point immediately after the
`filterSpecificSeriesByExcludeGenre` stage), `LANGUAGE_OPTIONS`/`COUNTRY_OPTIONS`/`DEFAULT_COUNTRY_FAVOURITES`/
`DEFAULT_LANGUAGE_FAVOURITES`/`isCountryFavourites`/`isLanguageFavourites` — the same catalogs and
favourites-reading pattern AC-02's `SearchFilter.tsx` fields reuse (see this spec's corrected Design
Decisions). `types/filterProfile.ts`'s
`UseMySeriesFilterCriteria` needs the two `Filter`-suffixed fields (AC-01).

**Test Case (Red)**:
```typescript
describe('FRONTEND-128-AC-03: origin country/language filters in Use My Series', () => {
  it('only offers a series matching one of the selected origin countries', () => {
    const series = [
      makeSeries({ id: '1', title: 'UK Co-Production', originCountry: 'GB,US' }),
      makeSeries({ id: '2', title: 'French Show', originCountry: 'FR' }),
    ]
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={series}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )

    fireEvent.click(screen.getByLabelText('Country'))
    fireEvent.click(screen.getByText('GB'))
    const dialog = openBrowseSeriesModal()

    expect(within(dialog).getByText('UK Co-Production')).toBeInTheDocument()
    expect(within(dialog).queryByText('French Show')).not.toBeInTheDocument()
  })
})

// components/RecommendationControls.test.tsx
describe('FRONTEND-128-AC-03: buildSpecificSeriesCandidatePool origin filters', () => {
  it('excludes a series that matches none of the selected origin countries', () => {
    const series = [
      { id: '1', title: 'GB Show', originCountry: 'GB', excludeFromRecommendations: false },
      { id: '2', title: 'FR Show', originCountry: 'FR', excludeFromRecommendations: false },
    ] as Series[]
    const result = buildSpecificSeriesCandidatePool(
      series,
      makeSpecificSeriesFilters({ originCountryFilter: ['GB'] }),
      [],
    )
    expect(result.series.map((s) => s.title)).toEqual(['GB Show'])
  })

  it('excludes a series whose originalLanguage does not exactly match', () => {
    const series = [
      { id: '1', title: 'English Show', originalLanguage: 'en', excludeFromRecommendations: false },
      { id: '2', title: 'Korean Show', originalLanguage: 'ko', excludeFromRecommendations: false },
    ] as Series[]
    const result = buildSpecificSeriesCandidatePool(
      series,
      makeSpecificSeriesFilters({ originalLanguageFilter: 'en' }),
      [],
    )
    expect(result.series.map((s) => s.title)).toEqual(['English Show'])
  })
})
```
**Test Case (Green)**: two new `useState<string[]>([])`/`useState('')` (`specificSeriesOriginCountryFilter`/
`specificSeriesOriginalLanguageFilter`) in `UseMySeriesPanel.tsx`, wired into
`currentUseMySeriesCriteria`/`applyUseMySeriesFilterCriteria`/`handleClearSpecificSeriesFilters`/the
filters object passed to `buildSpecificSeriesCandidatePool`, plus two new `KeywordPicker` fields in a new
`filterFourColGrid` row (Country: `options={COUNTRY_OPTIONS}`, `pinnedOptions={countryFavourites}`;
Language: `options={LANGUAGE_OPTIONS}`, `pinnedOptions={languageFavourites}`, via the single-select
adapter — `countryFavourites`/`languageFavourites` read the same `useLocalStorage` way as AC-02). In
`RecommendationControls.tsx`: add `originCountryFilter: string[]`/
`originalLanguageFilter: string` to `SpecificSeriesFilters`; two new filter functions —
`filterSpecificSeriesByOriginCountry` (splits `s.originCountry` on `,`, lowercases/trims each entry,
mirroring `filterSpecificSeriesByGenre`'s exact shape) and `filterSpecificSeriesByOriginalLanguage`
(`s.originalLanguage != null && s.originalLanguage === trimmed`) — inserted into
`buildSpecificSeriesCandidatePool`'s chain immediately after the exclude-genre stage.

---

## Requirement 4: Export inherits the same filters with no extra wiring

**User story**: As a user exporting a filtered subset of My Series, I want an export I run with an
origin country or language filter active to include only the matching series, the same way it already
does for every other My Series filter.

### FRONTEND-128-AC-04 [AUTO]
**Statement**: `seriesApi.export(format, filters)` shall include `originCountry`/`originalLanguage` in
its request params whenever the passed `filters` criteria carries them — a direct consequence of
`export` already delegating to the shared `buildSearchParams` (AC-01), needing no export-specific code.

**References**: `services/seriesApi.ts` lines 414-425 (`export`, specifically line 424's existing
`params: { format, ...buildSearchParams(filters) }`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-128-AC-04: export includes origin country/language fields', () => {
  it('includes originCountry/originalLanguage in the export request when set', async () => {
    client.get.mockResolvedValue({
      data: new Blob(['{}']),
      headers: {},
    })
    await seriesApi.export('json', {
      originCountry: ['GB', 'US'],
      originalLanguage: 'en',
    })

    const args = client.get.mock.calls[0][1] as {
      params: Record<string, unknown>
    }
    expect(args.params.originCountry).toEqual(['GB', 'US'])
    expect(args.params.originalLanguage).toBe('en')
  })
})
```
**Test Case (Green)**: no code change — `export`'s existing `buildSearchParams(filters)` call already
picks up the two new fields once AC-01 adds them there. This test exists purely as a regression guard
confirming that pass-through, matching how `series_spec_065`'s own AC-04 confirms both backend endpoints
apply the same filters.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Backend `originCountry`/`originalLanguage` filter this spec's `SearchFilter.tsx`/`UseMySeriesPanel.tsx` halves consume/mirror respectively | `series_spec_065_origin_country_language_filter.md` (companion spec) |
| `SearchFilter.tsx`'s `FormState`/`buildCriteria`/`formStateFromCriteria` wiring pattern | `frontend_spec_055_search_filter_overhaul.md` |
| `UseMySeriesPanel.tsx`/`RecommendationControls.tsx`'s client-side filter-chain pattern | `frontend_spec_081_use_my_series_page_restructure.md` |
| `Series.originCountry`'s comma-joined multi-value display shape (`formatCountryNames`) | `frontend_spec_085_multi_origin_country_display.md` |
| `Series.originalLanguage`, `formatLanguageName`, `LANGUAGE_OPTIONS`' origin | `frontend_spec_117_series_language_display.md`, `frontend_spec_098` (`ALL_COUNTRY_OPTIONS`/pinned-favourites split) |
| Closest recent precedent — identical shape of change (two new filter fields threaded through the same components/types/API layer) | `frontend_spec_122_rating_filter_and_step_refinements.md` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-128-AC-01: `SearchCriteria`/`MySeriesFilterCriteria`/`UseMySeriesFilterCriteria`/`buildSearchParams` carry the two new fields
- [x] FRONTEND-128-AC-02: My Series filters gain both origin fields, round-trip through saved profiles
- [x] FRONTEND-128-AC-03: Use My Series filters gain both origin fields, filter the candidate pool correctly
- [x] FRONTEND-128-AC-04: export includes both fields with no export-specific wiring (regression guard)
