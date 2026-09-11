# Frontend Spec 122: Rotten Tomatoes Min-Rating Filter & Tiered Control Steps

**Status**: Not started
**Priority**: P3
**Depends on**: `series_spec_063_rotten_tomatoes_min_rating_filter.md` (companion backend spec — new `minRottenTomatoesRating`/`minRottenTomatoesPopcornmeter` query params on `GET /api/v1/series/search`/`GET /api/v1/series/export`), `frontend_spec_035_specific_series_picker.md` / `frontend_spec_081_use_my_series_page_restructure.md` (established the client-side min-rating filter pattern for "Recs > Use My Series" this spec extends)
**Area**: Frontend (`components/NumberInput.tsx`, `components/SearchFilter.tsx`, `components/UseMySeriesPanel.tsx`, `components/RecommendationControls.tsx`, `components/RecommendationFiltersBox.tsx`, `components/CustomSearchPanel.tsx`, `services/seriesApi.ts`, `types/series.ts`, `types/filterProfile.ts`, new `utils/tieredStep.ts`)

## Overview

Two independent changes bundled together because both touch the same `NumberInput` call sites across the same set of filter components:

1. **Adds Rotten Tomatoes min-rating filters** to "My Series" (`SearchFilter.tsx`) and "Recs > Use My Series" (`UseMySeriesPanel.tsx`) — two new fields, Min Tomatometer and Min Popcornmeter, matching how Min IMDb/Min TMDB Rating already work in both places.
2. **Replaces flat step sizes with tiered ones** across every rating/year control in the app — the step gets finer as the value climbs into the range where precision matters, instead of one fixed step end-to-end. Also a flat step change for the one "Min Vote Count" field (Discover mode).

## Design Decisions

- **RT filters are two independent fields** (`minRottenTomatoesRating`/`minRottenTomatoesPopcornmeter`), matching how RT is already treated as two independent things everywhere else in this app (sort options, missing-value booleans).
- **No new frontend validation beyond `NumberInput`'s `min`/`max` HTML attributes** — matches Min IMDb/Min TMDB Rating's own (non-)validation today; see `series_spec_063`'s Design Decisions for why this is intentional parity, not a gap.
- **`SearchFilter.tsx` needs no new change-handler code for the two new fields** — `updateField` (lines 188-197) is already a generic curried handler over every string field in `FormState` (typed as `Exclude<keyof FormState, 'genresSelected' | 'keywordsSelected' | 'minPersonalRating'>`), so adding the two fields to the `FormState` type alone makes `updateField('minRottenTomatoesRating')` work.
- **Tiered stepping is a resolver function, not a static number.** `NumberInput`'s `step` prop widens to accept `NumberLike | ((currentValue: number) => NumberLike)`, resolved fresh on every render (already a controlled component re-rendering on every value change — no new state/effect needed). One shared utility (`resolveTieredStep`, new file `utils/tieredStep.ts`) turns a small sorted array of `{from, step}` breakpoints into a resolver, reused by all three tiered field families below — not three separate bespoke functions.
- **Tier boundary convention**: each breakpoint's `from` value is where that (finer) step begins — e.g. for ratings, at exactly `value = 6` the step is already `0.5`, not `1`. This mirrors the year tiers' own unambiguous phrasing ("2010 onwards, steps of 1") applied consistently to the other two field families.
- **The year threshold (2010) is a fixed constant, not computed from the current date** — confirmed explicitly with the user despite the seemingly time-relative framing of the original request; this is intentional, and will need a manual code change in some future decade if "recent years" should mean something different than "2010+" by then.
- **`Min Vote Count`** (`RecommendationFiltersBox.tsx`, the one field of its kind in the app) gets a plain flat `step={100}` — no tiering, since only a single range was requested for it.

---

## Requirement 1: Rotten Tomatoes minimum-rating filters

**User story**: As a user filtering My Series or picking source series for recommendations, I want to filter by a minimum Rotten Tomatoes Tomatometer or Popcornmeter score, the same way I already can for IMDb and TMDB.

### FRONTEND-122-AC-01 [AUTO]
**Statement**: `SearchCriteria` (`types/series.ts`) shall gain `minRottenTomatoesRating?: number` and `minRottenTomatoesPopcornmeter?: number`, alongside the existing `minTmdbRating` field. `seriesApi.ts`'s `buildSearchParams` shall include both in its emitted query params when set.

**References**: `types/series.ts` (`SearchCriteria`, near the existing `minTmdbRating` field), `services/seriesApi.ts` lines 176-208 (`buildSearchParams`, specifically line 190's existing `addIfPresent(params, 'minTmdbRating', criteria.minTmdbRating)`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-122-AC-01: buildSearchParams includes RT min-rating fields', () => {
  it('includes minRottenTomatoesRating/minRottenTomatoesPopcornmeter when set', async () => {
    await seriesApi.search({
      minRottenTomatoesRating: 60,
      minRottenTomatoesPopcornmeter: 70,
    })
    expect(mockAxios.history.get[0].params).toMatchObject({
      minRottenTomatoesRating: 60,
      minRottenTomatoesPopcornmeter: 70,
    })
  })
})
```
**Test Case (Green)**: add the two fields to `SearchCriteria`, and two `addIfPresent(...)` calls in `buildSearchParams` mirroring the `minTmdbRating` line exactly.

---

### FRONTEND-122-AC-02 [AUTO]
**Statement**: `SearchFilter.tsx` shall render "Min Rotten Tomatoes Rating" and "Min Rotten Tomatoes Popcornmeter" `NumberInput` fields (`min={0} max={100}`), included in the submitted search criteria when non-blank, and round-tripped correctly through `formStateFromCriteria` (saved filter profiles).

**References**: `components/SearchFilter.tsx` — `FormState`/`initialFormState` (lines 26-63), `buildCriteria` (lines 65-96, specifically the `minTmdbRating` branch at line 80-81), `formStateFromCriteria` (lines 103-136, specifically the `minTmdbRating` branch at lines 115-118), the Ratings section JSX (~line 353 onward, Min TMDB Rating field at line 380-394 with id `search-min-tmdb-rating`). `types/filterProfile.ts`'s `MySeriesFilterCriteria` (lines 32-41) needs the two fields added too, or the new criteria silently won't round-trip through saved profiles.

**Test Case (Red)**:
```typescript
describe('FRONTEND-122-AC-02: Rotten Tomatoes min-rating filters in My Series', () => {
  it('includes both RT fields in the submitted criteria when filled in', () => {
    const { onSearch } = renderFilter()
    fireEvent.change(screen.getByLabelText('Min Rotten Tomatoes Rating'), {
      target: { value: '60' },
    })
    fireEvent.change(screen.getByLabelText('Min Rotten Tomatoes Popcornmeter'), {
      target: { value: '70' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        minRottenTomatoesRating: 60,
        minRottenTomatoesPopcornmeter: 70,
      }),
    )
  })
})
```
**Test Case (Green)**: add `minRottenTomatoesRating`/`minRottenTomatoesPopcornmeter: string` to `FormState`/`initialFormState` (both `''`); two lines in `buildCriteria` mirroring `minTmdbRating`'s shape; two lines in `formStateFromCriteria` mirroring its shape; two new `NumberInput` fields in the Ratings section JSX; the two fields added to `MySeriesFilterCriteria` in `types/filterProfile.ts`.

---

### FRONTEND-122-AC-03 [AUTO]
**Statement**: `UseMySeriesPanel.tsx`'s specific-series picker shall gain the same two RT min-rating fields, filtering the candidate pool client-side.

**References**: `components/UseMySeriesPanel.tsx` — `specificSeriesMinImdbRating`/`specificSeriesMinTmdbRating` state (lines 90-93), `currentUseMySeriesCriteria` (line 114-115), `applyUseMySeriesFilterCriteria`'s criteria object (lines 204-205), the Min TMDB Rating field (line 455-465, id `specific-series-min-tmdb-rating`). `components/RecommendationControls.tsx` — `SpecificSeriesFilters` (lines 728-744), `filterSpecificSeriesByMinTmdbRating` (lines 603-611, the pattern to mirror), `buildSpecificSeriesCandidatePool`'s filter chain (lines 787-802). `types/filterProfile.ts`'s `UseMySeriesFilterCriteria` (lines 46-69) needs the two fields as `string`, matching its existing string-typed numeric fields.

**Test Case (Red)**:
```typescript
describe('FRONTEND-122-AC-03: Rotten Tomatoes min-rating filters in Use My Series', () => {
  it('excludes a series below the minimum Rotten Tomatoes rating', () => {
    const series = [
      { id: '1', title: 'RT Has', rottenTomatoesRating: 80, excludeFromRecommendations: false },
      { id: '2', title: 'RT Low', rottenTomatoesRating: 30, excludeFromRecommendations: false },
    ] as Series[]
    const result = buildSpecificSeriesCandidatePool(
      series,
      makeSpecificSeriesFilters({ minRottenTomatoesRating: '60' }),
      [],
    )
    expect(result.series.map((s) => s.title)).toEqual(['RT Has'])
  })
})
```
**Test Case (Green)**: two new `useState<string>('')` in `UseMySeriesPanel.tsx`, wired into `currentUseMySeriesCriteria`/`applyUseMySeriesFilterCriteria`/`handleClearSpecificSeriesFilters`/the filters object passed to `buildSpecificSeriesCandidatePool`, plus two new `NumberInput` fields; in `RecommendationControls.tsx`, add the two fields to `SpecificSeriesFilters`, two new filter functions mirroring `filterSpecificSeriesByMinTmdbRating` exactly but comparing `s.rottenTomatoesRating`/`s.rottenTomatoesPopcornmeter` (already integers, no decimal parsing needed), inserted into the existing filter chain.

---

## Requirement 2: Tiered control steps

**User story**: As a user adjusting a rating or year filter with the spinner buttons, I want coarse steps where precision doesn't matter and fine steps where it does, instead of one step size across the whole range.

### FRONTEND-122-AC-04 [AUTO]
**Statement**: `NumberInput`'s `step` prop shall accept a resolver function `(currentValue: number) => NumberLike` in addition to a plain value; when a function, it shall be called with the current numeric value on every render and its result used for both the native `<input step>` attribute and the spinner buttons' increment/decrement math.

**References**: `components/NumberInput.tsx` — `step` prop (line 26, default `1` at line 76), `parsedStep` (line 87), the native `<input step={step}>` attribute (line 118).

**Test Case (Red)**:
```typescript
describe('FRONTEND-122-AC-04: NumberInput accepts a dynamic step resolver', () => {
  it('uses the resolver-computed step for the increment button', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="Test"
        value={5}
        onChange={onChange}
        step={(v) => (v >= 6 ? 0.5 : 1)}
      />,
    )
    fireEvent.click(screen.getByLabelText('Increase'))
    expect(onChange).toHaveBeenCalledWith(6)
    onChange.mockClear()
  })

  it('re-resolves the step once the value crosses the threshold', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <NumberInput
        label="Test"
        value={6}
        onChange={onChange}
        step={(v) => (v >= 6 ? 0.5 : 1)}
      />,
    )
    fireEvent.click(screen.getByLabelText('Increase'))
    expect(onChange).toHaveBeenCalledWith(6.5)
  })
})
```
**Test Case (Green)**: widen `step`'s type to `NumberLike | ((currentValue: number) => NumberLike)`; compute `const resolvedStep = typeof step === 'function' ? step(currentValue) : step` and use `resolvedStep` everywhere `step` currently is (the `parsedStep` computation and the native `<input>` attribute).

---

### FRONTEND-122-AC-05 [AUTO]
**Statement**: A new shared utility, `utils/tieredStep.ts`, shall export `resolveTieredStep(breakpoints)` — given a sorted array of `{from, step}` breakpoints, returns a resolver function returning the `step` of the highest breakpoint whose `from` is `<= value`.

**References**: new file, no existing equivalent in this codebase.

**Test Case (Red)**:
```typescript
describe('FRONTEND-122-AC-05: resolveTieredStep', () => {
  const breakpoints = [
    { from: 0, step: 1 },
    { from: 6, step: 0.5 },
    { from: 8, step: 0.1 },
  ]
  const resolver = resolveTieredStep(breakpoints)

  it('returns the first tier below the first breakpoint boundary', () => {
    expect(resolver(3)).toBe(1)
  })

  it('returns the middle tier at and above its boundary', () => {
    expect(resolver(6)).toBe(0.5)
    expect(resolver(7.5)).toBe(0.5)
  })

  it('returns the finest tier at and above its boundary', () => {
    expect(resolver(8)).toBe(0.1)
    expect(resolver(10)).toBe(0.1)
  })
})
```
**Test Case (Green)**: implement `resolveTieredStep` per the statement above.

---

### FRONTEND-122-AC-06 [AUTO]
**Statement**: `utils/tieredStep.ts` shall export three ready-made breakpoint arrays — `RATING_STEP_BREAKPOINTS` (`0`→`1`, `6`→`0.5`, `8`→`0.1`, for the 0-10 IMDb/TMDB scale), `ROTTEN_TOMATOES_STEP_BREAKPOINTS` (`0`→`10`, `60`→`5`, `80`→`1`, for the 0-100 RT scale), and `YEAR_STEP_BREAKPOINTS` (`MIN_VALID_YEAR`→`10`, `2010`→`1`) — and every IMDb/TMDB/RT/Year `NumberInput` in the app shall use `resolveTieredStep(...)` with the appropriate array instead of a literal `step` number.

**References**: all IMDb/TMDB/Year `NumberInput` call sites: `components/SearchFilter.tsx` (`search-min-imdb-rating` line 366, `search-min-tmdb-rating` line 382, `search-year-min` line 458, `search-year-max` line 473, plus the two new RT fields from AC-02), `components/UseMySeriesPanel.tsx` (`specific-series-min-imdb-rating` line 437, `specific-series-min-tmdb-rating` line 455, `specific-series-year-min` line 474, `specific-series-year-max` line 487, plus the two new RT fields from AC-03), `components/RecommendationFiltersBox.tsx` (`recommendation-min-tmdb-rating` line 192, `recommendation-year-min` line 227, `recommendation-year-max` line 238), `components/CustomSearchPanel.tsx` (`recommendation-min-tmdb-rating` line 180, `recommendation-year-min` line 194, `recommendation-year-max` line 205).

**Test Case (Red)**:
```typescript
describe('FRONTEND-122-AC-06: rating/year controls use tiered steps', () => {
  it('Min IMDb Rating steps by 0.5 once at/above 6', () => {
    renderFilter()
    fireEvent.change(screen.getByLabelText(/min imdb rating/i), { target: { value: '6' } })
    fireEvent.click(screen.getByLabelText('Increase'))
    // asserts the resulting value reflects a 0.5 step, e.g. 6.5 not 7 -- adapt to
    // this file's existing NumberInput interaction-testing helpers.
  })

  it('Year Min steps by 1 once at/above 2010', () => {
    renderFilter()
    fireEvent.change(screen.getByLabelText(/min year/i), { target: { value: '2010' } })
    fireEvent.click(screen.getByLabelText('Increase'))
    // asserts 2011, not 2020.
  })
})
```
**Test Case (Green)**: replace each literal `step={0.1}`/no-step (defaults to `1`) with `step={resolveTieredStep(RATING_STEP_BREAKPOINTS)}` (ratings) or `step={resolveTieredStep(YEAR_STEP_BREAKPOINTS)}` (years) at every call site listed above; the two new RT fields from AC-02/AC-03 use `step={resolveTieredStep(ROTTEN_TOMATOES_STEP_BREAKPOINTS)}` from the start (never had a flat step to replace). Do **not** touch `NameStatsTable.tsx`'s unrelated `step={0.1}` (an Analysis stat threshold, not a rating/year field).

---

### FRONTEND-122-AC-07 [AUTO]
**Statement**: `RecommendationFiltersBox.tsx`'s "Min Vote Count" field shall use `step={100}` (a flat, non-tiered value), replacing its current `step={1}`.

**References**: `components/RecommendationFiltersBox.tsx` line 206-217 (`recommendation-min-vote-count`, currently `min={0} step={1}`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-122-AC-07: Min Vote Count steps by 100', () => {
  it('increases by 100 per click', () => {
    render(<RecommendationFiltersBox {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Min Vote Count' })) // open the box if collapsed, per this component's existing test helpers
    const before = screen.getByLabelText('Min Vote Count') as HTMLInputElement
    fireEvent.click(within(before.closest('div')!).getByLabelText('Increase'))
    // asserts onChange fired with 100, not 1.
  })
})
```
**Test Case (Green)**: change `step={1}` to `step={100}`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Backend RT min-rating filter this spec's `SearchFilter.tsx`/`UseMySeriesPanel.tsx` halves consume/mirror respectively | `series_spec_063_rotten_tomatoes_min_rating_filter.md` |
| Min IMDb/TMDB Rating pattern mirrored for the new RT fields | `frontend_spec_081_use_my_series_page_restructure.md` (client-side filters), `frontend_spec_055`/`series_spec_037` (My Series filters) |
| `NumberInput` component this spec extends with a dynamic-step resolver | `frontend_spec_115_number_input_spinner_styling.md` |
| Row layout the new RT fields land in | `frontend_spec_123_filter_layout_and_collapsible_sections.md` (companion spec) |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-122-AC-01: `SearchCriteria`/`buildSearchParams` carry the two new RT query params
- [ ] FRONTEND-122-AC-02: My Series filters gain both RT min-rating fields, round-trip through saved profiles
- [ ] FRONTEND-122-AC-03: Use My Series filters gain both RT min-rating fields, filter the candidate pool correctly
- [ ] FRONTEND-122-AC-04: `NumberInput` accepts and correctly resolves a dynamic step function
- [ ] FRONTEND-122-AC-05: `resolveTieredStep` correctly resolves each tier at its boundary
- [ ] FRONTEND-122-AC-06: every IMDb/TMDB/RT/Year control in the app uses the correct tiered-step breakpoints
- [ ] FRONTEND-122-AC-07: Min Vote Count steps by a flat 100
