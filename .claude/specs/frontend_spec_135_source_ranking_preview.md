# Frontend Spec 135: Source Ranking Preview

**Status**: Implemented
**Priority**: P3
**Depends on**: `series_spec_068_recommendation_source_ranking_strategy.md` (`SourceOrderComparator`/
`SourceRatingBlend`, the backend logic this spec ports client-side), `frontend_spec_132_source_ranking_strategy_and_custom_blend.md`
(`ControlsState.sourceRankingStrategy`/`sourceRatingBlendSources`, the fields this preview reads),
`frontend_spec_134_recommendation_filter_sheets.md` (the "Source Ranking Strategy" standalone
disclosure this spec's own disclosure sits beside, and whose hand-rolled toggle/body pattern it
reuses).
**Area**: Frontend (`UseMySeriesPanel.tsx`, new `utils/sourceRanking.ts`, new
`components/SourceRankingPreview.tsx`).

## Overview

On the Recommendations page's "Use My Series" tab, the source-series pool the backend actually
queries against is invisible today — the user picks (or leaves empty to auto-select) series in
`UseMySeriesPanel.tsx`'s picker, which sorts by an unrelated `sortBy` field (e.g. Title), and picks
a "Source Ranking Strategy," but never sees what order that strategy actually produces. This spec
adds a read-only, client-side preview: a new collapsed-by-default "Source Ranking Preview"
disclosure listing the selected (or, if none selected, the auto-eligible) series in the exact order
`RecommendationSourcingService#resolveSourcePool`/`SourceOrderComparator`/`SourceRatingBlend` would
apply on the backend, so a curious user can audit the ordering — including which series fall past
the `maxSourceSeries` cutoff and are never actually queried — before submitting a request. This is
purely additive UI: no backend change, no change to what's sent on "Get Recommendations."

## Design Decisions

1. **Preview both cases identically, matching backend behavior exactly.** When
   `state.selectedSeriesIds` is non-empty, the preview ranks exactly that explicit selection
   (any status); when empty, it ranks the same "automatic pool" the backend would (`status ===
   'COMPLETED' && imdbId` truthy) — both cases then filtered by `!excludeFromRecommendations`,
   mirroring `RecommendationSourcingService#resolveSourcePool` (read this session,
   `backend/src/main/java/uk/co/stefirby/seriestracker/service/recommendation/RecommendationSourcingService.java:307-317`).
   The 20-item cap (`maxSourceSeries`, backend default `app.tmdb.max-source-series:20`) is
   hardcoded client-side as `MAX_SOURCE_SERIES = 20` in the new utility, with a comment noting it
   must be kept in sync with that backend default by hand — there's no live config-sharing
   mechanism between backend and frontend in this app, and none is introduced here. The
   auto-pool case is the more valuable of the two (the user is trusting a hidden algorithm to pick
   for them, potentially across dozens of series) and is not treated as a lesser/optional path —
   both render through the identical component and utility functions.
2. **Visually mark the cutoff, don't hide anything past it.** Series beyond position 20 are still
   rendered (so the list stays useful for auditing "why wasn't X used"), but shown below a visible
   divider ("Won't be queried (limit: 20)") and visually muted (a dedicated CSS class, lower
   opacity) rather than dropped from the list.
3. **Show the rank number, title, and the value(s) driving that position.** Personal rating renders
   on every row regardless of strategy. The computed Custom Rating Blend value additionally renders
   per row when a blend strategy (`personalRatingThenCustomBlend`/`customBlendThenPersonalRating`)
   is active. **Addition beyond the literal minimum instructed** (flagged explicitly, not a
   re-litigation): Date Completed also renders per row when `personalRatingThenDate` (the default
   strategy) is active, since that field is that strategy's own tiebreaker — without it, two rows
   tied on personal rating would show identical "driving values" with no visible reason for their
   relative order, undermining the stated "legible, not just asserted" goal for exactly the same
   reason the blend value is shown for the blend strategies.
4. **New disclosure, collapsed by default, reusing the hand-rolled pattern already established in
   this file — not `CollapsibleSection`.** `UseMySeriesPanel.tsx` already has two disclosures built
   on the same hand-rolled `styles.filtersSection`/`styles.filtersToggle`/`styles.filtersBody`
   shape ("Filter My Series" and, since `frontend_spec_134`'s amendment to `frontend_spec_132`,
   the standalone "Source Ranking Strategy" section this new one sits directly beside). This new
   "Source Ranking Preview" disclosure copies that exact shape (toggle button +
   `aria-expanded` + conditionally-rendered body div, `data-testid="source-ranking-preview-body"`)
   rather than introducing `CollapsibleSection` as a third disclosure idiom into one file for no
   real benefit — `CollapsibleSection`'s `activeCount` badge convention (count of active filters)
   has no clean analog here ("how many series would be sourced" isn't a filter-active count), and
   the sibling it sits beside doesn't use it either. Defaults **closed** (`useState(false)`),
   matching this whole redesign effort's (`frontend_spec_134`) explicit goal of decluttering these
   panels — this preview must not reintroduce clutter by rendering open.
5. **Placement: the last thing inside `UseMySeriesPanel`'s `specificSeriesSection` block** — after
   the "Show all series" button, still before the two existing "Browse..." modals. It depends on
   the picker's current selection, so reading order puts it after the picker rather than before.
   This is the chosen placement, not a suggestion.
6. **Component boundary: the disclosure wrapper (toggle + body div) lives in `UseMySeriesPanel.tsx`
   itself** (matching where "Filter My Series"'s and "Source Ranking Strategy"'s own wrappers
   live), while the new `SourceRankingPreview` component is only the ranked-list content rendered
   inside that body — it receives an already-ranked `series` array plus `strategy` (for which
   value(s) to display) as props and does no ranking of its own. This mirrors this codebase's
   existing split between a panel's own inline disclosure chrome and a small presentational child
   (e.g. `RatingSourceChips` inside the "Source Ranking Strategy" body) — the new component follows
   the standard 3-file convention (`SourceRankingPreview.tsx` + `.module.css` + `.test.tsx`).
7. **New pure-logic file, `utils/sourceRanking.ts`, colocated `sourceRanking.test.ts`**, ports
   `SourceOrderComparator`/`SourceRatingBlend` as three small functions (pool resolution, blend
   computation, ranking) rather than one monolithic function, so each piece of backend logic being
   mirrored has an isolated, directly-testable client-side counterpart. This is a deliberate,
   accepted **drift risk**: this logic is now duplicated in two languages with no shared source of
   truth, so a future change to `SourceOrderComparator`/`SourceRatingBlend`/`resolveSourcePool`
   (e.g. a new strategy, a changed default) will silently desync this preview unless someone
   remembers to update `sourceRanking.ts` too. No attempt is made here to share code between Java
   and TypeScript (e.g. codegen, a shared spec file) — that's out of scope for the immediate value
   this spec delivers.
8. **No backend change, no `API.md` update.** This is entirely client-side computation over data
   the frontend already has (`Series[]` from `allSeries`, already passed into `UseMySeriesPanel`).
   `RecommendationQuery`/`seriesApi.getRecommendations` are untouched — what's actually sent to the
   backend for "Get Recommendations" is unaffected by this spec.

---

## Requirement 1: client-side source pool resolution

**User story**: As a user, I want the preview to consider exactly the same set of series the
backend would actually source from, so the preview isn't misleading.

### FRONTEND-135-AC-01 [AUTO]
**Statement**: When `selectedSeriesIds` is non-empty, `resolveSourceRankingPool` shall return the
subset of `allSeries` whose `id` is in `selectedSeriesIds`, regardless of `status`.

**References**: `utils/sourceRanking.ts`; mirrors `RecommendationSourcingService#explicitPool`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-135-AC-01: explicit selection pool', () => {
  it('returns exactly the selected series regardless of status', () => {
    const backlog = makeSeries({ id: '1', status: 'BACKLOG' })
    const completed = makeSeries({ id: '2', status: 'COMPLETED' })
    const untouched = makeSeries({ id: '3', status: 'COMPLETED' })
    const pool = resolveSourceRankingPool([backlog, completed, untouched], ['1', '2'])
    expect(pool.map((s) => s.id)).toEqual(['1', '2'])
  })
})
```
**Test Case (Green)**: implement the explicit-id-match branch.

---

### FRONTEND-135-AC-02 [AUTO]
**Statement**: When `selectedSeriesIds` is empty, `resolveSourceRankingPool` shall return every
series in `allSeries` whose `status` is `'COMPLETED'` and whose `imdbId` is non-blank (the
automatic pool).

**References**: `utils/sourceRanking.ts`; mirrors `RecommendationSourcingService#automaticPool`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-135-AC-02: automatic pool', () => {
  it('includes only COMPLETED series with a non-blank imdbId', () => {
    const eligible = makeSeries({ id: '1', status: 'COMPLETED', imdbId: 'tt1' })
    const wrongStatus = makeSeries({ id: '2', status: 'WATCHING', imdbId: 'tt2' })
    const noImdbId = makeSeries({ id: '3', status: 'COMPLETED', imdbId: null })
    const blankImdbId = makeSeries({ id: '4', status: 'COMPLETED', imdbId: '   ' })
    const pool = resolveSourceRankingPool(
      [eligible, wrongStatus, noImdbId, blankImdbId],
      [],
    )
    expect(pool.map((s) => s.id)).toEqual(['1'])
  })
})
```
**Test Case (Green)**: implement the automatic-pool branch (`status === 'COMPLETED' &&
imdbId?.trim()`).

---

### FRONTEND-135-AC-03 [AUTO]
**Statement**: `resolveSourceRankingPool` shall exclude any series whose `excludeFromRecommendations`
is `true`, whether the pool came from an explicit selection or the automatic pool.

**References**: `utils/sourceRanking.ts`; mirrors `resolveSourcePool`'s shared filter chain
(`series_spec_034`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-135-AC-03: excludeFromRecommendations filtering', () => {
  it('drops an excluded series from an explicit selection', () => {
    const excluded = makeSeries({ id: '1', excludeFromRecommendations: true })
    const included = makeSeries({ id: '2', excludeFromRecommendations: false })
    expect(
      resolveSourceRankingPool([excluded, included], ['1', '2']).map((s) => s.id),
    ).toEqual(['2'])
  })

  it('drops an excluded series from the automatic pool', () => {
    const excluded = makeSeries({
      id: '1', status: 'COMPLETED', imdbId: 'tt1', excludeFromRecommendations: true,
    })
    expect(resolveSourceRankingPool([excluded], [])).toEqual([])
  })
})
```
**Test Case (Green)**: apply the `!excludeFromRecommendations` filter after either branch.

---

## Requirement 2: Custom Rating Blend computation

**User story**: As a user with a blend strategy selected, I want the preview's blend value to
match what the backend would actually compute, so the preview is trustworthy.

### FRONTEND-135-AC-04 [AUTO]
**Statement**: `computeCustomRatingBlend(series, sources)` shall average exactly the values of
`sources` that are non-null on `series`, drawn from `{imdbRating, tmdbRating,
rottenTomatoesRating, rottenTomatoesPopcornmeter}`.

**References**: `utils/sourceRanking.ts`; mirrors `SourceRatingBlend#compute`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-135-AC-04: blend averages exactly the requested, present sources', () => {
  it('averages imdb and tmdb only when both are requested and present', () => {
    const series = makeSeries({ imdbRating: 8, tmdbRating: 6, rottenTomatoesRating: 100 })
    expect(computeCustomRatingBlend(series, ['imdb', 'tmdb'])).toBe(7)
  })

  it('ignores a requested source with no value on this series', () => {
    const series = makeSeries({ imdbRating: 8, tmdbRating: null })
    expect(computeCustomRatingBlend(series, ['imdb', 'tmdb'])).toBe(8)
  })
})
```
**Test Case (Green)**: filter `sources` to those present, average the resolved values.

---

### FRONTEND-135-AC-05 [AUTO]
**Statement**: `computeCustomRatingBlend` shall normalize `rottenTomatoesRating` and
`rottenTomatoesPopcornmeter` (0-100 scale) by dividing by 10 before averaging with
`imdbRating`/`tmdbRating` (already 0-10 scale).

**References**: `utils/sourceRanking.ts`; mirrors `SourceRatingBlend#normalize`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-135-AC-05: Rotten Tomatoes normalization', () => {
  it('divides tomatometer/popcornmeter by 10 before blending', () => {
    const series = makeSeries({ rottenTomatoesRating: 90, rottenTomatoesPopcornmeter: 70 })
    expect(computeCustomRatingBlend(series, ['tomatometer', 'popcornmeter'])).toBe(8)
  })
})
```
**Test Case (Green)**: divide each RT-scale value by 10 before summing/averaging.

---

### FRONTEND-135-AC-06 [AUTO]
**Statement**: If none of the requested `sources` have a non-null value on `series`,
`computeCustomRatingBlend` shall return `null`.

**References**: `utils/sourceRanking.ts`; mirrors `SourceRatingBlend#compute`'s empty-`ratings`
branch.

**Test Case (Red)**:
```typescript
describe('FRONTEND-135-AC-06: null when no requested source has a value', () => {
  it('returns null, not NaN or 0', () => {
    const series = makeSeries({ imdbRating: null, tmdbRating: null })
    expect(computeCustomRatingBlend(series, ['imdb', 'tmdb'])).toBeNull()
  })
})
```
**Test Case (Green)**: short-circuit to `null` before dividing when the filtered list is empty.

---

### FRONTEND-135-AC-07 [AUTO]
**Statement**: `computeCustomRatingBlend` shall round its result to one decimal place.

**References**: `utils/sourceRanking.ts`; mirrors `SourceRatingBlend#compute`'s
`BigDecimal.divide(..., 1, RoundingMode.HALF_UP)`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-135-AC-07: rounds to one decimal place', () => {
  it('averages 8 and 7.3 to 7.7, not 7.65 or 7.6500000001', () => {
    const series = makeSeries({ imdbRating: 8, tmdbRating: 7.3 })
    expect(computeCustomRatingBlend(series, ['imdb', 'tmdb'])).toBe(7.7)
  })
})
```
**Test Case (Green)**: round to one decimal (e.g. `Math.round(value * 10) / 10`).

---

## Requirement 3: ranking

**User story**: As a user, I want the preview's ordering to exactly match whichever Source Ranking
Strategy is currently selected, so I can trust it reflects what "Get Recommendations" would do.

### FRONTEND-135-AC-08 [AUTO]
**Statement**: For strategy `'personalRatingThenDate'`, `rankSourceSeries` shall sort `pool` by
`personalRating` descending (nulls last), then by `dateCompleted` descending (nulls last).

**References**: `utils/sourceRanking.ts`; mirrors `SourceOrderComparator.INSTANCE`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-135-AC-08: personalRatingThenDate ordering', () => {
  it('sorts by personal rating descending, ties broken by more recent dateCompleted', () => {
    const a = makeSeries({ id: 'a', personalRating: 9, dateCompleted: '2024-01-01' })
    const b = makeSeries({ id: 'b', personalRating: 9, dateCompleted: '2024-06-01' })
    const c = makeSeries({ id: 'c', personalRating: 7, dateCompleted: '2025-01-01' })
    const ranked = rankSourceSeries([a, b, c], 'personalRatingThenDate', ['imdb', 'tmdb'])
    expect(ranked.map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts a null personalRating last', () => {
    const rated = makeSeries({ id: 'rated', personalRating: 1 })
    const unrated = makeSeries({ id: 'unrated', personalRating: null })
    const ranked = rankSourceSeries([unrated, rated], 'personalRatingThenDate', ['imdb', 'tmdb'])
    expect(ranked.map((s) => s.id)).toEqual(['rated', 'unrated'])
  })

  it('sorts a null dateCompleted last among equal personal ratings', () => {
    const dated = makeSeries({ id: 'dated', personalRating: 5, dateCompleted: '2024-01-01' })
    const undated = makeSeries({ id: 'undated', personalRating: 5, dateCompleted: null })
    const ranked = rankSourceSeries([undated, dated], 'personalRatingThenDate', ['imdb', 'tmdb'])
    expect(ranked.map((s) => s.id)).toEqual(['dated', 'undated'])
  })
})
```
**Test Case (Green)**: implement the comparator with nulls-last descending on both fields.

---

### FRONTEND-135-AC-09 [AUTO]
**Statement**: For strategy `'personalRatingThenCustomBlend'`, `rankSourceSeries` shall sort `pool`
by `personalRating` descending (nulls last), then by `computeCustomRatingBlend(series,
blendSources)` descending (nulls last).

**References**: `utils/sourceRanking.ts`; mirrors `SourceOrderComparator#personalRatingThenBlend`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-135-AC-09: personalRatingThenCustomBlend ordering', () => {
  it('breaks a personal-rating tie by blend value, higher blend first', () => {
    const higherBlend = makeSeries({ id: 'hi', personalRating: 6, imdbRating: 9, tmdbRating: 9 })
    const lowerBlend = makeSeries({ id: 'lo', personalRating: 6, imdbRating: 4, tmdbRating: 4 })
    const ranked = rankSourceSeries(
      [lowerBlend, higherBlend],
      'personalRatingThenCustomBlend',
      ['imdb', 'tmdb'],
    )
    expect(ranked.map((s) => s.id)).toEqual(['hi', 'lo'])
  })

  it('sorts a null blend value (no requested source present) last among an equal personal rating', () => {
    const withBlend = makeSeries({ id: 'with', personalRating: 5, imdbRating: 7 })
    const withoutBlend = makeSeries({
      id: 'without', personalRating: 5, imdbRating: null, tmdbRating: null,
    })
    const ranked = rankSourceSeries(
      [withoutBlend, withBlend],
      'personalRatingThenCustomBlend',
      ['imdb', 'tmdb'],
    )
    expect(ranked.map((s) => s.id)).toEqual(['with', 'without'])
  })
})
```
**Test Case (Green)**: implement the two-key comparator using `computeCustomRatingBlend`.

---

### FRONTEND-135-AC-10 [AUTO]
**Statement**: For strategy `'customBlendThenPersonalRating'`, `rankSourceSeries` shall sort `pool`
by `computeCustomRatingBlend(series, blendSources)` descending (nulls last), then by
`personalRating` descending (nulls last).

**References**: `utils/sourceRanking.ts`; mirrors `SourceOrderComparator#blendThenPersonalRating`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-135-AC-10: customBlendThenPersonalRating ordering', () => {
  it('ranks by blend value first, ahead of a higher personal rating', () => {
    const higherPersonal = makeSeries({ id: 'hp', personalRating: 10, imdbRating: 2, tmdbRating: 2 })
    const higherBlend = makeSeries({ id: 'hb', personalRating: 1, imdbRating: 9, tmdbRating: 9 })
    const ranked = rankSourceSeries(
      [higherPersonal, higherBlend],
      'customBlendThenPersonalRating',
      ['imdb', 'tmdb'],
    )
    expect(ranked.map((s) => s.id)).toEqual(['hb', 'hp'])
  })
})
```
**Test Case (Green)**: implement the two-key comparator with the blend value primary.

---

### FRONTEND-135-AC-11 [AUTO]
**Statement**: When `blendSources` is empty, `rankSourceSeries` (and `computeCustomRatingBlend`, as
used by it) shall fall back to `['imdb', 'tmdb']`, matching `SourceRatingBlend#resolveSources`'
default.

**References**: `utils/sourceRanking.ts`; mirrors `SourceRatingBlend.DEFAULT_SOURCES`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-135-AC-11: empty blendSources falls back to imdb+tmdb', () => {
  it('blends imdb and tmdb when blendSources is []', () => {
    const series = makeSeries({ imdbRating: 8, tmdbRating: 6, rottenTomatoesRating: 100 })
    const ranked = rankSourceSeries([series], 'customBlendThenPersonalRating', [])
    expect(computeCustomRatingBlend(ranked[0], [])).toBe(7)
  })
})
```
**Test Case (Green)**: default `blendSources` to `['imdb', 'tmdb']` when empty, inside
`computeCustomRatingBlend` (or a shared `resolveBlendSources` helper it and `rankSourceSeries` both
call).

---

### FRONTEND-135-AC-12 [AUTO]
**Statement**: `rankSourceSeries` shall not mutate its input `pool` array; it shall return a new
array.

**References**: `utils/sourceRanking.ts`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-135-AC-12: does not mutate the input array', () => {
  it('leaves the original array order untouched', () => {
    const low = makeSeries({ id: 'low', personalRating: 1 })
    const high = makeSeries({ id: 'high', personalRating: 9 })
    const pool = [low, high]
    const ranked = rankSourceSeries(pool, 'personalRatingThenDate', ['imdb', 'tmdb'])
    expect(pool.map((s) => s.id)).toEqual(['low', 'high'])
    expect(ranked).not.toBe(pool)
  })
})
```
**Test Case (Green)**: sort a copy (`[...pool].sort(...)`), never `pool.sort(...)` directly.

---

## Requirement 4: `SourceRankingPreview` presentational component

**User story**: As a user, I want to see the ranked list itself — rank, title, and the values that
explain the order — not just trust it happened.

### FRONTEND-135-AC-13 [AUTO]
**Statement**: `SourceRankingPreview` shall render a 1-based rank number and the title for each
series in the `series` prop, in the order given (it performs no sorting of its own).

**References**: new `components/SourceRankingPreview.tsx`.

**Test Case (Red)**:
```tsx
describe('FRONTEND-135-AC-13: renders rank and title in prop order', () => {
  it('numbers rows 1, 2, 3 in the order series are given', () => {
    render(
      <SourceRankingPreview
        series={[makeSeries({ title: 'B' }), makeSeries({ title: 'A' })]}
        strategy="personalRatingThenDate"
      />,
    )
    const rows = screen.getAllByTestId('source-ranking-row')
    expect(rows[0]).toHaveTextContent('1')
    expect(rows[0]).toHaveTextContent('B')
    expect(rows[1]).toHaveTextContent('2')
    expect(rows[1]).toHaveTextContent('A')
  })
})
```
**Test Case (Green)**: `series.map((s, i) => <li key={s.id} data-testid="source-ranking-row">{i + 1}. {s.title}...</li>)`.

---

### FRONTEND-135-AC-14 [AUTO]
**Statement**: `SourceRankingPreview` shall render each row's `personalRating` (or a "no rating"
placeholder when `null`) regardless of `strategy`.

**References**: new `components/SourceRankingPreview.tsx`.

**Test Case (Red)**:
```tsx
describe('FRONTEND-135-AC-14: personal rating shown on every row', () => {
  it('shows the rating value or a placeholder for null', () => {
    render(
      <SourceRankingPreview
        series={[makeSeries({ personalRating: 8 }), makeSeries({ personalRating: null })]}
        strategy="customBlendThenPersonalRating"
      />,
    )
    const rows = screen.getAllByTestId('source-ranking-row')
    expect(rows[0]).toHaveTextContent(/8/)
    expect(rows[1]).toHaveTextContent(/no rating/i)
  })
})
```
**Test Case (Green)**: render `personalRating ?? 'No rating'` on every row unconditionally.

---

### FRONTEND-135-AC-15 [AUTO]
**Statement**: Where `strategy` is `'personalRatingThenCustomBlend'` or
`'customBlendThenPersonalRating'`, `SourceRankingPreview` shall additionally render each row's
Custom Rating Blend value (via `computeCustomRatingBlend`); for `'personalRatingThenDate'` it shall
not render a blend value at all.

**References**: new `components/SourceRankingPreview.tsx`; `utils/sourceRanking.ts`'s
`computeCustomRatingBlend`.

**Test Case (Red)**:
```tsx
describe('FRONTEND-135-AC-15: blend value shown only for blend strategies', () => {
  it('shows blend value for a blend strategy', () => {
    render(
      <SourceRankingPreview
        series={[makeSeries({ imdbRating: 8, tmdbRating: 6 })]}
        strategy="personalRatingThenCustomBlend"
        blendSources={['imdb', 'tmdb']}
      />,
    )
    expect(screen.getByTestId('source-ranking-row')).toHaveTextContent(/blend.*7/i)
  })

  it('omits blend value for personalRatingThenDate', () => {
    render(
      <SourceRankingPreview series={[makeSeries()]} strategy="personalRatingThenDate" />,
    )
    expect(screen.getByTestId('source-ranking-row')).not.toHaveTextContent(/blend/i)
  })
})
```
**Test Case (Green)**: conditionally render the blend value based on `strategy`.

---

### FRONTEND-135-AC-16 [AUTO]
**Statement**: Where `strategy` is `'personalRatingThenDate'`, `SourceRankingPreview` shall
additionally render each row's `dateCompleted` (or a "no date" placeholder when `null`); for the
two blend strategies it shall not render `dateCompleted`.

**References**: new `components/SourceRankingPreview.tsx`; see Design Decision 3's addition.

**Test Case (Red)**:
```tsx
describe('FRONTEND-135-AC-16: dateCompleted shown only for personalRatingThenDate', () => {
  it('shows dateCompleted for the default strategy', () => {
    render(
      <SourceRankingPreview
        series={[makeSeries({ dateCompleted: '2024-05-01' })]}
        strategy="personalRatingThenDate"
      />,
    )
    expect(screen.getByTestId('source-ranking-row')).toHaveTextContent(/2024-05-01/)
  })

  it('omits dateCompleted for a blend strategy', () => {
    render(
      <SourceRankingPreview
        series={[makeSeries({ dateCompleted: '2024-05-01' })]}
        strategy="customBlendThenPersonalRating"
      />,
    )
    expect(screen.getByTestId('source-ranking-row')).not.toHaveTextContent(/2024-05-01/)
  })
})
```
**Test Case (Green)**: conditionally render `dateCompleted` based on `strategy`.

---

### FRONTEND-135-AC-17 [AUTO]
**Statement**: When `series.length` exceeds `MAX_SOURCE_SERIES` (20), `SourceRankingPreview` shall
render a divider after the 20th row with text indicating the series below it "won't be queried
(limit: 20)", and every row after that divider shall carry a distinct, visually-muted CSS class.

**References**: new `components/SourceRankingPreview.tsx`; `utils/sourceRanking.ts`'s
`MAX_SOURCE_SERIES`; mirrors `resolveSourcePool`'s `.limit(maxSourceSeries)`.

**Test Case (Red)**:
```tsx
describe('FRONTEND-135-AC-17: cutoff divider and muted styling beyond position 20', () => {
  it('shows the cutoff message and mutes rows 21+', () => {
    const series = Array.from({ length: 22 }, (_, i) => makeSeries({ id: `s${i}`, title: `S${i}` }))
    render(<SourceRankingPreview series={series} strategy="personalRatingThenDate" />)

    expect(screen.getByText(/won't be queried \(limit: 20\)/i)).toBeInTheDocument()
    const rows = screen.getAllByTestId('source-ranking-row')
    expect(rows[19]).not.toHaveClass(styles.mutedRow)
    expect(rows[20]).toHaveClass(styles.mutedRow)
    expect(rows[21]).toHaveClass(styles.mutedRow)
  })
})
```
**Test Case (Green)**: render the divider between index 19/20 (0-based), apply `styles.mutedRow`
to every row from index 20 onward.

---

### FRONTEND-135-AC-18 [AUTO]
**Statement**: When `series.length` is less than or equal to `MAX_SOURCE_SERIES`,
`SourceRankingPreview` shall render neither the cutoff divider nor any muted row.

**References**: new `components/SourceRankingPreview.tsx`.

**Test Case (Red)**:
```tsx
describe('FRONTEND-135-AC-18: no cutoff UI when at or under the limit', () => {
  it('renders no divider and no muted rows for exactly 20 series', () => {
    const series = Array.from({ length: 20 }, (_, i) => makeSeries({ id: `s${i}` }))
    render(<SourceRankingPreview series={series} strategy="personalRatingThenDate" />)

    expect(screen.queryByText(/won't be queried/i)).not.toBeInTheDocument()
    expect(screen.getAllByTestId('source-ranking-row').every(
      (row) => !row.className.includes('mutedRow'),
    )).toBe(true)
  })
})
```
**Test Case (Green)**: guard the divider/muted-class logic behind `series.length > MAX_SOURCE_SERIES`.

---

### FRONTEND-135-AC-19 [AUTO]
**Statement**: When `series` is empty, `SourceRankingPreview` shall render a hint message instead
of a list.

**References**: new `components/SourceRankingPreview.tsx`.

**Test Case (Red)**:
```tsx
describe('FRONTEND-135-AC-19: empty-pool hint', () => {
  it('shows a hint and renders no rows when series is empty', () => {
    render(<SourceRankingPreview series={[]} strategy="personalRatingThenDate" />)
    expect(screen.getByText(/no series to preview/i)).toBeInTheDocument()
    expect(screen.queryAllByTestId('source-ranking-row')).toHaveLength(0)
  })
})
```
**Test Case (Green)**: render a short hint paragraph when `series.length === 0`, skipping the list
entirely.

---

## Requirement 5: integration into `UseMySeriesPanel`

**User story**: As a user on the "Use My Series" tab, I want an optional, collapsed-by-default way
to check the source-series ordering without it cluttering the panel or affecting what gets sent to
the backend.

### FRONTEND-135-AC-20 [AUTO]
**Statement**: `UseMySeriesPanel` shall render a new "Source Ranking Preview" disclosure —
collapsed by default, toggle/body shape matching the existing "Source Ranking Strategy" disclosure
(`data-testid="source-ranking-preview-body"`) — as the last element inside `specificSeriesSection`,
after the "Show all series" button and before the "Browse Series"/"Browse Keywords" modals.

**References**: `UseMySeriesPanel.tsx`; `styles.filtersSection`/`filtersToggle`/`filtersBody`
(`RecommendationControls.module.css`, established by `frontend_spec_134`'s "Source Ranking
Strategy" disclosure).

**Test Case (Red)**:
```tsx
describe('FRONTEND-135-AC-20: Source Ranking Preview disclosure, collapsed by default', () => {
  it('is present but collapsed until toggled, positioned after "Show all series"', () => {
    render(<UseMySeriesPanel state={baseState} updateState={vi.fn()} {...otherProps} />)

    expect(screen.queryByTestId('source-ranking-preview-body')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /source ranking preview/i }))
    expect(screen.getByTestId('source-ranking-preview-body')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add `sourceRankingPreviewOpen` state (default `false`) and the disclosure
markup, mirroring the "Source Ranking Strategy" block immediately above it.

---

### FRONTEND-135-AC-21 [AUTO]
**Statement**: The disclosure body shall render `SourceRankingPreview`, fed by
`rankSourceSeries(resolveSourceRankingPool(allSeries, state.selectedSeriesIds),
state.sourceRankingStrategy, state.sourceRatingBlendSources)`.

**References**: `UseMySeriesPanel.tsx`; `utils/sourceRanking.ts`;
`components/SourceRankingPreview.tsx`.

**Test Case (Red)**:
```tsx
describe('FRONTEND-135-AC-21: preview is wired to the resolved, ranked pool', () => {
  it('shows the explicitly-selected series, ranked by the active strategy', () => {
    const low = makeSeries({ id: '1', title: 'Low', personalRating: 2 })
    const high = makeSeries({ id: '2', title: 'High', personalRating: 9 })
    render(
      <UseMySeriesPanel
        state={{ ...baseState, selectedSeriesIds: ['1', '2'] }}
        updateState={vi.fn()}
        allSeries={[low, high]}
        {...otherProps}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /source ranking preview/i }))
    const rows = screen.getAllByTestId('source-ranking-row')
    expect(rows[0]).toHaveTextContent('High')
    expect(rows[1]).toHaveTextContent('Low')
  })
})
```
**Test Case (Green)**: compose `resolveSourceRankingPool`/`rankSourceSeries` and pass the result
into `SourceRankingPreview`.

---

### FRONTEND-135-AC-22 [AUTO]
**Statement**: When `state.selectedSeriesIds` is empty, the preview shall reflect the automatic
pool (every `allSeries` entry with `status === 'COMPLETED'` and a non-blank `imdbId`, minus any
`excludeFromRecommendations`), computed identically to the explicit-selection case.

**References**: `UseMySeriesPanel.tsx`; `utils/sourceRanking.ts`.

**Test Case (Red)**:
```tsx
describe('FRONTEND-135-AC-22: automatic-pool preview when no series are selected', () => {
  it('shows eligible series when selectedSeriesIds is empty', () => {
    const eligible = makeSeries({
      id: '1', title: 'Eligible', status: 'COMPLETED', imdbId: 'tt1',
    })
    const ineligible = makeSeries({ id: '2', title: 'Ineligible', status: 'BACKLOG' })
    render(
      <UseMySeriesPanel
        state={{ ...baseState, selectedSeriesIds: [] }}
        updateState={vi.fn()}
        allSeries={[eligible, ineligible]}
        {...otherProps}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /source ranking preview/i }))
    const rows = screen.getAllByTestId('source-ranking-row')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('Eligible')
  })
})
```
**Test Case (Green)**: confirm `resolveSourceRankingPool` (Requirement 1) is invoked unconditionally
with the live `selectedSeriesIds`, with no separate "auto mode" branch in the panel itself.

---

### FRONTEND-135-AC-23 [AUTO]
**Statement**: The preview shall update live on any change to `state.selectedSeriesIds`,
`state.sourceRankingStrategy`, or `state.sourceRatingBlendSources`, with no separate "Preview"
action required and no call to `seriesApi`.

**References**: `UseMySeriesPanel.tsx`; `services/seriesApi.ts` (asserted un-called).

**Test Case (Red)**:
```tsx
describe('FRONTEND-135-AC-23: live updates, no seriesApi calls', () => {
  it('re-ranks immediately when the strategy changes, without calling seriesApi', () => {
    const series = makeSeries({
      id: '1', personalRating: 5, imdbRating: 9, tmdbRating: 9,
    })
    const { rerender } = render(
      <UseMySeriesPanel
        state={{ ...baseState, selectedSeriesIds: ['1'], sourceRankingStrategy: 'personalRatingThenDate' }}
        updateState={vi.fn()}
        allSeries={[series]}
        {...otherProps}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /source ranking preview/i }))
    expect(screen.getByTestId('source-ranking-row')).not.toHaveTextContent(/blend/i)

    rerender(
      <UseMySeriesPanel
        state={{ ...baseState, selectedSeriesIds: ['1'], sourceRankingStrategy: 'customBlendThenPersonalRating' }}
        updateState={vi.fn()}
        allSeries={[series]}
        {...otherProps}
      />,
    )
    expect(screen.getByTestId('source-ranking-row')).toHaveTextContent(/blend/i)
    expect(seriesApi.getRecommendations).not.toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: confirm the preview is derived directly from props/state on every render
(no memoized/stale snapshot, no button-triggered fetch).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Backend pool resolution/ordering this preview mirrors | `RecommendationSourcingService#resolveSourcePool` (`series_spec_006`/`007`/`034`/`045`/`068`) |
| Backend comparator ported by `rankSourceSeries` | `SourceOrderComparator.java` (`series_spec_068`) |
| Backend blend computation ported by `computeCustomRatingBlend` | `SourceRatingBlend.java` (`series_spec_068`) |
| `maxSourceSeries` default (20) this spec hardcodes as `MAX_SOURCE_SERIES` | `app.tmdb.max-source-series` config property, `RecommendationSourcingService` constructor |
| `ControlsState.sourceRankingStrategy`/`sourceRatingBlendSources` fields read by this spec | `frontend_spec_132_source_ranking_strategy_and_custom_blend.md` |
| Sibling disclosure/pattern reused for this spec's own toggle | `frontend_spec_134_recommendation_filter_sheets.md`'s "Source Ranking Strategy" section |
| Panel this spec's disclosure/component are added to | `UseMySeriesPanel.tsx` (`frontend_spec_081`, extracted by `tooling_spec_008`) |
| `Series` fields consumed (`personalRating`, `dateCompleted`, `imdbRating`, `tmdbRating`, `rottenTomatoesRating`, `rottenTomatoesPopcornmeter`, `imdbId`, `excludeFromRecommendations`, `status`) | `frontend/src/types/series.ts` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-135-AC-01: `resolveSourceRankingPool` returns the explicit selection, any status, when `selectedSeriesIds` is non-empty
- [x] FRONTEND-135-AC-02: `resolveSourceRankingPool` returns the automatic pool (`COMPLETED` + non-blank `imdbId`) when `selectedSeriesIds` is empty
- [x] FRONTEND-135-AC-03: `resolveSourceRankingPool` excludes `excludeFromRecommendations` series from either pool
- [x] FRONTEND-135-AC-04: `computeCustomRatingBlend` averages exactly the requested, present sources
- [x] FRONTEND-135-AC-05: `computeCustomRatingBlend` normalizes RT fields (÷10) before blending
- [x] FRONTEND-135-AC-06: `computeCustomRatingBlend` returns `null` when no requested source has a value
- [x] FRONTEND-135-AC-07: `computeCustomRatingBlend` rounds to one decimal place
- [x] FRONTEND-135-AC-08: `rankSourceSeries` orders `personalRatingThenDate` correctly, nulls last on both keys
- [x] FRONTEND-135-AC-09: `rankSourceSeries` orders `personalRatingThenCustomBlend` correctly, nulls last on both keys
- [x] FRONTEND-135-AC-10: `rankSourceSeries` orders `customBlendThenPersonalRating` correctly, nulls last on both keys
- [x] FRONTEND-135-AC-11: `rankSourceSeries`/`computeCustomRatingBlend` fall back to `['imdb', 'tmdb']` when `blendSources` is empty
- [x] FRONTEND-135-AC-12: `rankSourceSeries` does not mutate its input array
- [x] FRONTEND-135-AC-13: `SourceRankingPreview` renders rank + title in prop order
- [x] FRONTEND-135-AC-14: `SourceRankingPreview` renders personal rating on every row
- [x] FRONTEND-135-AC-15: `SourceRankingPreview` renders the blend value only for blend strategies
- [x] FRONTEND-135-AC-16: `SourceRankingPreview` renders `dateCompleted` only for `personalRatingThenDate`
- [x] FRONTEND-135-AC-17: `SourceRankingPreview` renders the cutoff divider and mutes rows beyond position 20
- [x] FRONTEND-135-AC-18: `SourceRankingPreview` renders no cutoff UI at or under 20 series
- [x] FRONTEND-135-AC-19: `SourceRankingPreview` renders an empty-pool hint when `series` is empty
- [x] FRONTEND-135-AC-20: `UseMySeriesPanel` renders the new disclosure, collapsed by default, in the correct position
- [x] FRONTEND-135-AC-21: the disclosure body wires `SourceRankingPreview` to `resolveSourceRankingPool`/`rankSourceSeries`
- [x] FRONTEND-135-AC-22: the preview reflects the automatic pool identically to the explicit-selection case
- [x] FRONTEND-135-AC-23: the preview updates live with no separate action and makes no `seriesApi` calls
