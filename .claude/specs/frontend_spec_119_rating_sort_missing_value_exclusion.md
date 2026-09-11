# Frontend Spec 119: Rotten Tomatoes Sort Options & Missing-Rating Exclusion

**Status**: Implemented
**Priority**: P2 (extends an existing, frequently-used capability)
**Depends on**: `series_spec_062_rating_sort_missing_value_exclusion.md` (companion backend spec — new sort options and `excludedCount` on `GET /api/v1/series`/`GET /api/v1/series/search`, consumed by `SeriesList.tsx` below), `frontend_spec_035_specific_series_picker.md` (established the client-side `SpecificSeriesSortBy`/`compareSpecificSeries` sort used by "Recs > Use My Series")
**Area**: Frontend (`types/series.ts`, `services/seriesApi.ts`, `components/SeriesList.tsx`, `components/RecommendationControls.tsx`, `components/UseMySeriesPanel.tsx`, a new shared util, and each file's tests)

## Overview

Two related surfaces both need the same two additions — two new Rotten Tomatoes sort options, and "sorting by a rating drops series missing it, with a count message" — but they get there differently, because they're built differently today:

- **My Series** (`SeriesList.tsx`) sorts via a real API round trip (`seriesApi.getAll`/`search`, `SortOptions.sortBy`), so it consumes `series_spec_062`'s new backend behavior directly: the two new sort options, and the new `excludedCount` field on the response envelope.
- **Recs > Use My Series** (`RecommendationControls.tsx`'s `buildSpecificSeriesCandidatePool`, rendered by `UseMySeriesPanel.tsx`) sorts entirely **client-side** over an already-fetched `allSeries` array (`frontend_spec_035`) — there is no backend round trip to extend. This spec reimplements the same two additions independently in JS, using the same field names/labels for consistency, but with its own client-side exclusion logic and its own count.

Both surfaces render the same message format via one new shared utility, so the wording is identical everywhere: `"{count} series meeting this criteria {do|does} not have {rating label} ratings"`.

## Design Decisions

- **One shared message-formatting util, two independent exclusion mechanisms.** `frontend/src/utils/missingRatingMessage.ts` exports `formatMissingRatingMessage(count: number, sortBy: SortByOption): string | null` (returns `null` when `sortBy` isn't one of the four droppable fields or `count` is `0`, so both call sites can render conditionally with a single check: `{message && <p>...</p>}`). It handles singular/plural verb agreement ("1 series... does not have" vs. "3 series... do not have") but not the noun itself ("series" is already both singular and plural). The four droppable fields' display labels: `imdbRating` → "IMDb", `tmdbRating` → "TMDB", `rottenTomatoesRating` → "Rotten Tomatoes", `rottenTomatoesPopcornmeter` → "Rotten Tomatoes Popcornmeter".
- **`SeriesList.tsx` consumes the backend's `excludedCount` as-is** — no client-side recomputation needed, since the backend already did the filtering (`series_spec_062`).
- **`RecommendationControls.tsx` gets its own client-side droppable-fields predicate**, `isSpecificSeriesMissingSortRating(series: Series, sortBy: SpecificSeriesSortBy): boolean`, placed next to the existing `getSpecificSeriesSortValue`/`compareSpecificSeries` (same four fields as the backend's `isMissingRatingForSort`, same `personalRating`-excluded reasoning) — a deliberate, independent reimplementation rather than a shared module, because this sort has always been "entirely client-side... unlike SeriesList's which is a request parameter" (existing comment, line 205-206) and introducing a shared cross-cutting module for one predicate function isn't justified.
- **The new exclusion is just one more filter step in `buildSpecificSeriesCandidatePool`'s existing chain** (alongside `filterSpecificSeriesByMinImdbRating` etc.), not special-cased. This means the function's *existing* "reunite an already-selected series the filter chain dropped" step (lines 766-771, `FRONTEND-035-AC-07`/`FRONTEND-050-AC-03`/`FRONTEND-081-AC-09`) automatically covers it too, with no new code: if a selected series lacks the sort rating, it still gets filtered out of `filtered`, then reunited back in from `allSeries` by the existing generic mechanism, exactly like any other filter today.
- **`missingRatingCount` counts entries dropped by the new filter step, without correcting for the reunion step above.** In the rare case where an already-selected series is missing the sort rating, it's still counted as "excluded" even though it reappears in the final list via reunion (reunion exists solely so its picker chip keeps a resolvable label — see the existing comment's own rationale — not to make it discoverable by sorting/browsing). Precisely subtracting reunited entries from the count would require correlating two independent filter passes for a rare edge case with no real user-facing benefit; this is a documented, deliberate simplification, not an oversight.
- **`buildSpecificSeriesCandidatePool`'s return type changes from `Series[]` to `{ series: Series[]; missingRatingCount: number }`.** Its one real caller (`UseMySeriesPanel.tsx` line 189) and four existing test call sites (`RecommendationControls.test.tsx` lines 1460, 2671, 2690, 2709) are updated to destructure `.series` — none of their expected results change, since all four use `sortBy: 'title'` (never a droppable field, per `makeSpecificSeriesFilters`'s default).
- **`seriesApi.getAll`/`seriesApi.search` return type changes from `Promise<Series[]>` to `Promise<SeriesListResult>`** (new type in `types/series.ts`: `{ series: Series[]; excludedCount: number }`), since the backend now returns `excludedCount` alongside `data` in the same response and both need to reach `SeriesList.tsx`. Every existing test asserting `Promise<Series[]>`-shaped output (`seriesApi.test.ts`, ~20 call sites) is updated to check `.series` instead of the bare array — a mechanical, one-line-per-assertion change, not a logic change.
- **`activeRating()` (`SeriesList.tsx`, `FRONTEND-039-AC-01`) is extended to cover the two new sort fields**, so the displayed rating column matches whichever rating the list is actually sorted by — the same existing behavior already applied to `imdbRating`/`tmdbRating`, now extended rather than left inconsistent for the two new options.
- **The exclusion-notice message renders in the same location on both surfaces relative to their existing loading/error/empty states**: immediately below the header/toolbar, shown only when not loading, no error, and the count is non-zero — mirroring the existing `{!loading && error && (...)}` conditional pattern already used for the error banner (`SeriesList.tsx` line 515) so it participates in the same state machine rather than fighting it for visibility.

**Correction (2026-09-11, before this spec's PR merged)**: user feedback on the open PR, in two rounds, made here rather than as a follow-up spec since the work hadn't shipped yet:

1. **The "Rotten Tomatoes Rating" sort option is renamed to "Rotten Tomatoes Tomatometer"** in both `SORT_BY_OPTIONS` (`SeriesList.tsx`) and `SPECIFIC_SERIES_SORT_BY_OPTIONS` (`RecommendationControls.tsx`), disambiguating it from "Rotten Tomatoes Popcornmeter" — matching `SeriesDetailFields.tsx`'s existing field label, "Rotten Tomatoes Rating (Tomatometer)". Only the display `label` changes; the `value` (`'rottenTomatoesRating'`) is unchanged, so this has no effect on `SortOptions`, the API, or `activeRating()`'s existing `source: 'Rotten Tomatoes'` return value (`FRONTEND-119-AC-06`, unaffected).
2. **The rating column's display format changes for the two Rotten Tomatoes sort fields**, from the plain `{value} {source}` text pattern shared with IMDb/TMDB (e.g. "8.5 IMDb") to a percent-plus-emoji format matching the series detail page's existing convention: `formatPercent` (currently a private helper in `SeriesDetailFields.tsx` — `${value}% ${emoji}`, or `—` when null) is extracted into a new shared util, `frontend/src/utils/formatPercent.ts`, exported and reused by `SeriesDetailFields.tsx` (updated to import it instead of its own private copy — a third consumer justifies the extraction per `frontend_conventions.md`'s "extract on a third consumer" rule), `SeriesList.tsx`, and `SeriesCompactGrid.tsx` (`frontend_spec_120`). IMDb/TMDB's existing two-part `{value ?? '—'} <span class="ratingSource">{source}</span>` rendering in `SeriesList.tsx`'s expanded row is **unchanged** — only the two Rotten Tomatoes fields switch to the single-string percent+emoji format (🍅 for Tomatometer, 🍿 for Popcornmeter).
3. **(Same-day follow-up, after seeing 1-2 live)** `formatMissingRatingMessage`'s `DROPPABLE_FIELD_LABELS` shortens to match: `rottenTomatoesRating` → "Tomatometer" (not "Rotten Tomatoes"), `rottenTomatoesPopcornmeter` → "Popcornmeter" (not "Rotten Tomatoes Popcornmeter") — e.g. "3 series meeting this criteria do not have Tomatometer ratings". `imdbRating`/`tmdbRating` labels are unaffected. Every test snippet below quoting the old wording (`FRONTEND-119-AC-02`, `AC-05`, `AC-09`) reflects this — the actual test files were updated to match, not the other way around.
4. **(Second same-day follow-up)** The sort option labels themselves drop the "Rotten Tomatoes" prefix too: `SORT_BY_OPTIONS`/`SPECIFIC_SERIES_SORT_BY_OPTIONS` now label the two options plain "Tomatometer" and "Popcornmeter" (not "Rotten Tomatoes Tomatometer"/"Rotten Tomatoes Popcornmeter"), and `describeFilterCriteria.ts`'s `SORT_BY_LABELS` matches. Scoped to these two label maps only — `SearchFilter.tsx`'s unrelated "Missing Rotten Tomatoes Popcornmeter" filter *checkbox* label (`frontend_spec_116`/`frontend_spec_118`) keeps its full name, as does `activeRating()`'s internal `source` field (`'Rotten Tomatoes'`/`'Rotten Tomatoes Popcornmeter'`, `FRONTEND-119-AC-06`) — neither is a sort-by dropdown label.

---

## Requirement 1: `SortOptions` and the shared message util

### FRONTEND-119-AC-01 [AUTO]
**Statement**: `types/series.ts`'s `SortOptions.sortBy` union shall include `'rottenTomatoesRating'` and `'rottenTomatoesPopcornmeter'`, alongside the existing six values. A new exported interface `SeriesListResult` shall have shape `{ series: Series[]; excludedCount: number }`.

**References**: `types/series.ts` lines 322-331 (`SortOptions`).

**Test Case (Green)**: extend the union; add the new interface. Covered end-to-end by the type-checked usages in Requirements 2/3 below (no standalone test file for a pure type addition, consistent with how `SortOptions` itself has none).

---

### FRONTEND-119-AC-02 [AUTO]
**Statement**: `formatMissingRatingMessage(count, sortBy)` (new `utils/missingRatingMessage.ts`) shall return `null` when `count` is `0` or `sortBy` is not one of `imdbRating`/`tmdbRating`/`rottenTomatoesRating`/`rottenTomatoesPopcornmeter`; otherwise it shall return a message naming the count, correct singular/plural verb agreement, and the field's display label ("IMDb"/"TMDB"/"Rotten Tomatoes"/"Rotten Tomatoes Popcornmeter").

**Test Case (Red)**:
```typescript
describe('FRONTEND-119-AC-02: formatMissingRatingMessage', () => {
  it('returns null when count is 0', () => {
    expect(formatMissingRatingMessage(0, 'rottenTomatoesRating')).toBeNull()
  })

  it('returns null for a non-droppable sortBy', () => {
    expect(formatMissingRatingMessage(3, 'personalRating')).toBeNull()
  })

  it('formats a plural message for Rotten Tomatoes', () => {
    expect(formatMissingRatingMessage(3, 'rottenTomatoesRating')).toBe(
      '3 series meeting this criteria do not have Tomatometer ratings',
    )
  })

  it('formats a singular message with correct verb agreement', () => {
    expect(formatMissingRatingMessage(1, 'imdbRating')).toBe(
      '1 series meeting this criteria does not have IMDb ratings',
    )
  })

  it('uses the Popcornmeter label for rottenTomatoesPopcornmeter', () => {
    expect(formatMissingRatingMessage(2, 'rottenTomatoesPopcornmeter')).toBe(
      '2 series meeting this criteria do not have Popcornmeter ratings',
    )
  })
})
```
**Test Case (Green)**: implement the util until the spec above passes.

---

## Requirement 2: My Series (`SeriesList.tsx`) consumes the backend's exclusion

### FRONTEND-119-AC-03 [AUTO]
**Statement**: `SORT_BY_OPTIONS` shall include two new entries, `{ value: 'rottenTomatoesRating', label: 'Rotten Tomatoes Rating' }` and `{ value: 'rottenTomatoesPopcornmeter', label: 'Rotten Tomatoes Popcornmeter' }`, selectable from the "Sort by" dropdown.

**References**: `components/SeriesList.tsx` lines 46-53.

**Test Case (Red)**:
```typescript
describe('FRONTEND-119-AC-03: Rotten Tomatoes sort options', () => {
  it('offers both new Rotten Tomatoes sort options', () => {
    render(<SeriesList />)
    const select = screen.getByLabelText('Sort by')
    expect(within(select).getByText('Rotten Tomatoes Rating')).toBeInTheDocument()
    expect(
      within(select).getByText('Rotten Tomatoes Popcornmeter'),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the two options.

---

### FRONTEND-119-AC-04 [AUTO]
**Statement**: `seriesApi.getAll`/`seriesApi.search` shall resolve to `SeriesListResult` (`{ series, excludedCount }`), reading both `data` and `excludedCount` from the same response.

**References**: `services/seriesApi.ts` lines 213-220 (`getAll`), 240-245 (`search`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-119-AC-04: seriesApi surfaces excludedCount', () => {
  it('getAll resolves with series and excludedCount', async () => {
    mockAxios.onGet('/series').reply(200, { data: [], count: 0, excludedCount: 2 })
    const result = await seriesApi.getAll()
    expect(result).toEqual({ series: [], excludedCount: 2 })
  })

  it('search resolves with series and excludedCount', async () => {
    mockAxios
      .onGet('/series/search')
      .reply(200, { data: [], count: 0, excludedCount: 1 })
    const result = await seriesApi.search({ title: 'office' })
    expect(result).toEqual({ series: [], excludedCount: 1 })
  })
})
```
**Test Case (Green)**: change both methods' `.then((res) => res.data)` to `.then((res) => ({ series: res.data, excludedCount: res.excludedCount }))`. Update every existing assertion in `seriesApi.test.ts` that currently expects a bare array (e.g. `expect(await seriesApi.getAll()).toEqual([])` → `toEqual({ series: [], excludedCount: 0 })`).

---

### FRONTEND-119-AC-05 [AUTO]
**Statement**: `SeriesList` shall render the message from `formatMissingRatingMessage(excludedCount, sortBy)` (when non-null) immediately below the header/toolbar, only while not loading and with no error.

**References**: `components/SeriesList.tsx` — fetch effect (lines 156-182, `.then((data) => setSeries(data))`), render (line 484-486, between the closing `.header` `</div>` and the `{loading && ...}` block).

**Test Case (Red)**:
```typescript
describe('FRONTEND-119-AC-05: missing-rating notice', () => {
  it('shows the notice when sorted by a droppable rating with excluded series', async () => {
    vi.spyOn(seriesApi, 'getAll').mockResolvedValue({ series: [], excludedCount: 3 })
    render(<SeriesList />)
    fireEvent.change(screen.getByLabelText('Sort by'), {
      target: { value: 'rottenTomatoesRating' },
    })
    expect(
      await screen.findByText(
        '3 series meeting this criteria do not have Tomatometer ratings',
      ),
    ).toBeInTheDocument()
  })

  it('shows nothing when excludedCount is 0', async () => {
    vi.spyOn(seriesApi, 'getAll').mockResolvedValue({ series: [], excludedCount: 0 })
    render(<SeriesList />)
    expect(
      screen.queryByText(/do not have|does not have/),
    ).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add `excludedCount` state, set it from the fetch result (reset to `0` on error), and render the message block.

---

### FRONTEND-119-AC-06 [AUTO]
**Statement**: `activeRating()` shall return the Rotten Tomatoes (Tomatometer) value/label when `sortBy === 'rottenTomatoesRating'`, and the Popcornmeter value/label when `sortBy === 'rottenTomatoesPopcornmeter'`, matching the existing pattern for `imdbRating`/`tmdbRating`.

**References**: `components/SeriesList.tsx` lines 74-81.

**Test Case (Red)**:
```typescript
describe('FRONTEND-119-AC-06: activeRating covers Rotten Tomatoes fields', () => {
  it('shows the Rotten Tomatoes rating when sorted by it', () => {
    expect(
      activeRating({ rottenTomatoesRating: 88 } as Series, 'rottenTomatoesRating'),
    ).toEqual({ value: 88, source: 'Rotten Tomatoes' })
  })

  it('shows the Popcornmeter rating when sorted by it', () => {
    expect(
      activeRating(
        { rottenTomatoesPopcornmeter: 92 } as Series,
        'rottenTomatoesPopcornmeter',
      ),
    ).toEqual({ value: 92, source: 'Rotten Tomatoes Popcornmeter' })
  })
})
```
**Test Case (Green)**: extend `activeRating`'s branching (a `switch` or additional ternary branches) to cover both new fields.

---

### FRONTEND-119-AC-10 [AUTO] (Correction, 2026-09-11)
**Statement**: `SORT_BY_OPTIONS` and `SPECIFIC_SERIES_SORT_BY_OPTIONS` shall label the `'rottenTomatoesRating'` option "Rotten Tomatoes Tomatometer" (not "Rotten Tomatoes Rating"); the `'rottenTomatoesPopcornmeter'` option's label is unchanged.

**References**: `components/SeriesList.tsx` `SORT_BY_OPTIONS`; `components/RecommendationControls.tsx` `SPECIFIC_SERIES_SORT_BY_OPTIONS`.

**Test Case (Red)**: update `FRONTEND-119-AC-03`'s existing assertion from `within(select).getByText('Rotten Tomatoes Rating')` to `within(select).getByText('Rotten Tomatoes Tomatometer')`; add the equivalent assertion for `SPECIFIC_SERIES_SORT_BY_OPTIONS` in `RecommendationControls.test.tsx` alongside the existing `FRONTEND-119-AC-07` label check.

**Test Case (Green)**: change the one `label` string in each options array.

---

### FRONTEND-119-AC-11 [AUTO] (Correction, 2026-09-11)
**Statement**: `SeriesList`'s expanded-row rating column shall display the two Rotten Tomatoes fields as `formatPercent(value, emoji)` (🍅 for `rottenTomatoesRating`, 🍿 for `rottenTomatoesPopcornmeter`) instead of the plain `{value} {source}` text pattern; the `imdbRating`/`tmdbRating` display is unchanged.

**References**: `components/SeriesList.tsx` — the `.rating`/`.ratingSource` JSX (around line 590); new shared `frontend/src/utils/formatPercent.ts`, extracted from `components/SeriesDetailFields.tsx`'s existing private `formatPercent` helper.

**Test Case (Red)**:
```typescript
describe('FRONTEND-119-AC-11: Rotten Tomatoes rating column shows percent + emoji', () => {
  it('shows the Tomatometer value as a percent with the tomato emoji', async () => {
    mockGetAll.mockResolvedValue({
      series: [makeSeries({ title: 'Ozark', rottenTomatoesRating: 88 })],
      excludedCount: 0,
    })
    render(<SeriesList />)
    fireEvent.change(await screen.findByLabelText('Sort by'), {
      target: { value: 'rottenTomatoesRating' },
    })
    expect(await screen.findByText('88% 🍅')).toBeInTheDocument()
  })

  it('shows the Popcornmeter value as a percent with the popcorn emoji', async () => {
    mockGetAll.mockResolvedValue({
      series: [makeSeries({ title: 'Ozark', rottenTomatoesPopcornmeter: 75 })],
      excludedCount: 0,
    })
    render(<SeriesList />)
    fireEvent.change(await screen.findByLabelText('Sort by'), {
      target: { value: 'rottenTomatoesPopcornmeter' },
    })
    expect(await screen.findByText('75% 🍿')).toBeInTheDocument()
  })

  it('leaves the IMDb display format unchanged', async () => {
    mockGetAll.mockResolvedValue({
      series: [makeSeries({ title: 'Ozark', imdbRating: 8.4 })],
      excludedCount: 0,
    })
    render(<SeriesList />)
    expect(await screen.findByText(/8\.4/)).toBeInTheDocument()
    expect(screen.getByText('IMDb')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: extract `formatPercent` into `frontend/src/utils/formatPercent.ts` (update `SeriesDetailFields.tsx` to import it); in `SeriesList.tsx`'s expanded row, branch on `sortBy` — for the two Rotten Tomatoes values, render `formatPercent(activeRating(s, sortBy).value, emoji)` as a single string; otherwise keep the existing two-span JSX unchanged.

---

## Requirement 3: Recs > Use My Series gets the same additions, client-side

### FRONTEND-119-AC-07 [AUTO]
**Statement**: `SPECIFIC_SERIES_SORT_BY_OPTIONS` shall include the same two new entries as `SORT_BY_OPTIONS`, and `getSpecificSeriesSortValue` shall return `series.rottenTomatoesRating`/`series.rottenTomatoesPopcornmeter` for the respective `sortBy`.

**References**: `components/RecommendationControls.tsx` lines 208-218 (`SPECIFIC_SERIES_SORT_BY_OPTIONS`), 636-656 (`getSpecificSeriesSortValue`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-119-AC-07: specific-series Rotten Tomatoes sort', () => {
  it('offers both new sort options', () => {
    const labels = SPECIFIC_SERIES_SORT_BY_OPTIONS.map((o) => o.label)
    expect(labels).toContain('Rotten Tomatoes Rating')
    expect(labels).toContain('Rotten Tomatoes Popcornmeter')
  })

  it('sorts by rottenTomatoesRating descending', () => {
    const a = { id: '1', rottenTomatoesRating: 60 } as Series
    const b = { id: '2', rottenTomatoesRating: 95 } as Series
    expect(compareSpecificSeries(a, b, 'rottenTomatoesRating', 'desc')).toBeGreaterThan(0)
  })
})
```
**Test Case (Green)**: add the two options and switch cases.

---

### FRONTEND-119-AC-08 [AUTO]
**Statement**: `buildSpecificSeriesCandidatePool` shall exclude from its returned pool any series missing the field being sorted on (`imdbRating`/`tmdbRating`/`rottenTomatoesRating`/`rottenTomatoesPopcornmeter`), and shall return `{ series: Series[]; missingRatingCount: number }` instead of a bare array, where `missingRatingCount` is the number of otherwise-matching series excluded for this reason.

**References**: `components/RecommendationControls.tsx` lines 733-772 (`buildSpecificSeriesCandidatePool`), the existing filter chain and `missingSelected` reunion step (lines 738-771).

**Test Case (Red)**:
```typescript
describe('FRONTEND-119-AC-08: candidate pool excludes missing-rating series when sorted on it', () => {
  it('excludes a series missing the sorted-on rating and reports the count', () => {
    const series = [
      { id: '1', title: 'Has RT', rottenTomatoesRating: 80, excludeFromRecommendations: false },
      { id: '2', title: 'No RT', excludeFromRecommendations: false },
    ] as Series[]
    const result = buildSpecificSeriesCandidatePool(
      series,
      makeSpecificSeriesFilters({ sortBy: 'rottenTomatoesRating' }),
      [],
    )
    expect(result.series.map((s) => s.title)).toEqual(['Has RT'])
    expect(result.missingRatingCount).toBe(1)
  })

  it('does not exclude on a non-droppable sortBy (existing behavior unchanged)', () => {
    const series = [
      { id: '1', title: 'Show', excludeFromRecommendations: false },
    ] as Series[]
    const result = buildSpecificSeriesCandidatePool(
      series,
      makeSpecificSeriesFilters(),
      [],
    )
    expect(result.series.map((s) => s.title)).toEqual(['Show'])
    expect(result.missingRatingCount).toBe(0)
  })

  it('still reunites an already-selected series missing the sorted-on rating (existing FRONTEND-035-AC-07 behavior)', () => {
    const series = [
      { id: '1', title: 'Selected No RT', excludeFromRecommendations: false },
    ] as Series[]
    const result = buildSpecificSeriesCandidatePool(
      series,
      makeSpecificSeriesFilters({ sortBy: 'rottenTomatoesRating' }),
      ['1'],
    )
    expect(result.series.map((s) => s.title)).toEqual(['Selected No RT'])
  })
})
```
**Test Case (Green)**: add `isSpecificSeriesMissingSortRating` and a new filter step to the chain; change the return statement to `{ series: [...sorted, ...missingSelected], missingRatingCount }`, where `missingRatingCount` is computed before the reunion step (per this spec's Design Decisions — not corrected for reunited entries). Update the one real call site (`UseMySeriesPanel.tsx` line 189) and the four existing test call sites (`RecommendationControls.test.tsx` lines 1460, 2671, 2690, 2709) to destructure `.series`.

---

### FRONTEND-119-AC-09 [AUTO]
**Statement**: `UseMySeriesPanel` shall render the message from `formatMissingRatingMessage(missingRatingCount, specificSeriesSortBy)` (when non-null) near the sort control.

**References**: `components/UseMySeriesPanel.tsx` lines 187-212.

**Test Case (Red)**:
```typescript
describe('FRONTEND-119-AC-09: Use My Series missing-rating notice', () => {
  it('shows the notice when sorted by a droppable rating with excluded series', () => {
    const allSeries = [
      { id: '1', title: 'Has RT', rottenTomatoesRating: 80, excludeFromRecommendations: false },
      { id: '2', title: 'No RT', excludeFromRecommendations: false },
    ] as Series[]
    render(
      <UseMySeriesPanel
        state={{ ...baseState, specificSeriesSortBy: 'rottenTomatoesRating' }}
        updateState={vi.fn()}
        allSeries={allSeries}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    expect(
      screen.getByText(
        '1 series meeting this criteria does not have Tomatometer ratings',
      ),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: destructure `missingRatingCount` from `buildSpecificSeriesCandidatePool`'s result and render the message near the existing sort dropdown.

---

### FRONTEND-119-AC-12 [AUTO] (Correction, 2026-09-11)
**Statement**: `SORT_BY_OPTIONS` and `SPECIFIC_SERIES_SORT_BY_OPTIONS` shall label the `'rottenTomatoesRating'`/`'rottenTomatoesPopcornmeter'` options plain "Tomatometer"/"Popcornmeter" (no "Rotten Tomatoes" prefix); `describeFilterCriteria.ts`'s `SORT_BY_LABELS` matches. `SearchFilter.tsx`'s "Missing Rotten Tomatoes Popcornmeter" checkbox label and `activeRating()`'s internal `source` field are unaffected — neither is a sort-by dropdown label.

**References**: `components/SeriesList.tsx` `SORT_BY_OPTIONS`; `components/RecommendationControls.tsx` `SPECIFIC_SERIES_SORT_BY_OPTIONS`; `utils/describeFilterCriteria.ts` `SORT_BY_LABELS`.

**Test Case (Red)**: update every existing label assertion introduced by `FRONTEND-119-AC-03`/`AC-07`/`AC-10` from "Tomatometer"/"Popcornmeter" *without* the "Rotten Tomatoes" prefix — i.e. `within(select).getByText('Tomatometer')` / `('Popcornmeter')`, and `expect(labels).toContain('Tomatometer')` / `('Popcornmeter')`.

**Test Case (Green)**: change the two `label` strings in each of the three files.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Backend `excludedCount`/new sort options this spec's `SeriesList.tsx` half consumes | `series_spec_062_rating_sort_missing_value_exclusion.md` |
| Client-side `SpecificSeriesSortBy`/`compareSpecificSeries`/`buildSpecificSeriesCandidatePool` this spec extends | `frontend_spec_035_specific_series_picker.md` |
| Existing "reunite an already-selected series" step this spec's new filter automatically participates in | `FRONTEND-035-AC-07`, `FRONTEND-050-AC-03`, `FRONTEND-081-AC-09` |
| `activeRating()`'s existing IMDb/TMDB branching, extended here | `frontend_spec_039` (`FRONTEND-039-AC-01`) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-119-AC-01: `SortOptions.sortBy` gains the two new values; `SeriesListResult` type added
- [x] FRONTEND-119-AC-02: `formatMissingRatingMessage` util implemented and correctly worded
- [x] FRONTEND-119-AC-03: `SORT_BY_OPTIONS` offers both new Rotten Tomatoes options
- [x] FRONTEND-119-AC-04: `seriesApi.getAll`/`search` resolve to `{ series, excludedCount }`
- [x] FRONTEND-119-AC-05: `SeriesList` renders the missing-rating notice correctly
- [x] FRONTEND-119-AC-06: `activeRating()` covers both new Rotten Tomatoes fields
- [x] FRONTEND-119-AC-07: `SPECIFIC_SERIES_SORT_BY_OPTIONS`/`getSpecificSeriesSortValue` cover both new fields
- [x] FRONTEND-119-AC-08: `buildSpecificSeriesCandidatePool` excludes missing-rating series and reports the count
- [x] FRONTEND-119-AC-09: `UseMySeriesPanel` renders the missing-rating notice correctly
- [x] FRONTEND-119-AC-10 (Correction): "Rotten Tomatoes Rating" sort option renamed to "Rotten Tomatoes Tomatometer" in both option lists
- [x] FRONTEND-119-AC-11 (Correction): Rotten Tomatoes rating column shows `percent% emoji`, IMDb/TMDB unchanged
- [x] FRONTEND-119-AC-12 (Correction): sort option labels drop the "Rotten Tomatoes" prefix ("Tomatometer"/"Popcornmeter" only)
