# Frontend Spec 132: Source Ranking Strategy and Custom Rating Blend Chips

**Status**: Implemented
**Priority**: P3
**Depends on**: `series_spec_068_recommendation_source_ranking_strategy.md` (backend fields this
spec's controls send), `frontend_spec_131_info_disclosure_boxes.md` (reuses the shared
`InfoDisclosure` component), `frontend_spec_129_filter_profile_selector_top_placement_and_tooltips.md`
(the `USE_MY_SERIES`-area save/restore flow these two new fields ride inside).
**Area**: Frontend (`UseMySeriesPanel.tsx`, new `RatingSourceChips` component, `types/`,
`services/seriesApi.ts`).

## Overview

Adds UI for `series_spec_068`'s two new `RecommendationCriteria` fields to `UseMySeriesPanel.tsx`: a
3-option radio choice for how the user's own source series are ranked, and — only when a
Custom-Rating-Blend strategy is selected — a small chip multi-select for which rating sources
(IMDb/TMDB/Tomatometer/Popcornmeter) feed that blend.

**Amendment (2026-09-25)**: originally placed inside the "Filter & sort my series" disclosure (see
Design Decisions below for the original placement rationale, still valid at the panel level). A
same-day quick fix, ahead of the bigger two-sheet redesign spec'd separately
(`.claude/ideas/future_ideas.md`'s "Redo cluttered filter panels..." entry), renamed that disclosure
to "Filter My Series" and pulled this spec's radiogroup + `RatingSourceChips` out into their own
standalone `styles.filtersSection`/`styles.filtersToggle`/`styles.filtersBody` disclosure, titled
"Source Ranking Strategy" (`data-testid="source-ranking-strategy-body"`), rendered as a sibling
immediately after "Filter My Series" and before the Series picker/divider — and, further down the
page, before `RecommendationFiltersBox`'s "Recommendations Filters" disclosure. `FRONTEND-132-AC-01`
below is updated to match; every other AC (chip behavior, `seriesApi` wiring) is unaffected by the
move.

## Design Decisions

- **Placement: inside `UseMySeriesPanel.tsx`, not `HighestRatedPanel.tsx`'s "Sort By" fieldset.**
  `HighestRatedPanel`'s existing Best Match/Most Recommended pair controls how *candidate
  recommendations* are ranked and is shown across multiple source modes; this spec's controls only
  ever affect the user's *own source series* ranking and, per `series_spec_068`'s Design Decisions,
  only have any effect at all when `sourceMode === "useMySeries"` — so they belong specifically in
  the panel that's only rendered for that mode. **(Originally nested inside that panel's "Filter &
  sort my series" disclosure specifically; moved to its own standalone disclosure within the same
  panel per the 2026-09-25 amendment above — the "which panel" reasoning here still holds, only the
  "which disclosure within that panel" detail changed.)**
- **New chip component, not a reuse of `GenreIncludeExcludePicker`.** That component's 3-state
  include/exclude/neutral toggle semantics don't fit a plain "select any subset of 4" control. A new,
  small, single-purpose `RatingSourceChips` component is added instead, following this codebase's
  established 3-file colocated convention (`.tsx`+`.module.css`+`.test.tsx`).
- **Naming: "Custom Rating Blend" everywhere in this spec's UI copy**, matching the backend field
  naming from `series_spec_068` and the reasoning behind it — kept visibly distinct from the
  Analysis page's unrelated, fixed "Blended Rating" (Min Avg Blended Rating field, already explained
  by its own `frontend_spec_131` `InfoDisclosure`). This spec's new `InfoDisclosure` copy states the
  distinction explicitly so a user who's seen both doesn't conflate them.
- **Chips only render for the two Custom-Rating-Blend strategies**, hidden entirely for
  `personalRatingThenDate` (today's default) — avoids showing an irrelevant control most of the time.
- **Default chip selection**: `["imdb", "tmdb"]`, matching `series_spec_068`'s own backend default —
  so selecting a Custom-Rating-Blend strategy without touching the chips produces the same blend
  the Analysis page's "Blended Rating" would (same two sources), even though the two remain separate
  features under separate names.
- **Rides the existing save/restore flow with no new persistence code.** Both new fields become two
  more entries on `UseMySeriesFilterCriteria`/`ControlsState`, alongside the panel's existing filter
  fields — `currentUseMySeriesCriteria`, `useFilterProfileSelector`, and `FilterProfileActions`
  already serialize/restore this object under the `USE_MY_SERIES` `FilterProfileArea` with no schema
  awareness of individual fields (confirmed: `FilterProfileEntity.criteria` is an opaque JSON blob).

---

## Requirement 1: source-ranking strategy radios

**User story**: As a user relying on "Use My Series" mode, I want to choose how my own tracked series
are ranked, so the recommendations I get reflect the ranking signal I actually care about.

### FRONTEND-132-AC-01 [AUTO]
**Statement**: `UseMySeriesPanel` shall render 3 radio options inside its standalone "Source Ranking
Strategy" disclosure (a sibling of, not nested inside, "Filter My Series") — "Personal Rating, then
Date Completed" (checked by default), "Personal Rating, then Custom Rating Blend", "Custom Rating
Blend, then Personal Rating" — updating `ControlsState.sourceRankingStrategy` on change.

**References**: `UseMySeriesPanel.tsx`, the "Source Ranking Strategy" disclosure
(`data-testid="source-ranking-strategy-body"`), a sibling section rendered after "Filter My Series"
and before the Series picker; `series_spec_068`'s `sourceRankingStrategy` values.

**Test Case (Red)**:
```tsx
describe('FRONTEND-132-AC-01: source ranking strategy radios', () => {
  it('defaults to Personal Rating, then Date Completed and updates state on change', () => {
    const updateState = vi.fn()
    render(<UseMySeriesPanel state={baseState} updateState={updateState} {...otherProps} />)

    expect(screen.getByRole('radio', { name: 'Personal Rating, then Date Completed' })).toBeChecked()

    fireEvent.click(screen.getByRole('radio', { name: 'Custom Rating Blend, then Personal Rating' }))
    expect(updateState).toHaveBeenCalledWith({ sourceRankingStrategy: 'customBlendThenPersonalRating' })
  })
})
```
**Test Case (Green)**: add the fieldset, bound to `state.sourceRankingStrategy`, defaulting to
`'personalRatingThenDate'` when unset.

---

### FRONTEND-132-AC-02 [AUTO]
**Statement**: An `InfoDisclosure` shall sit beside the new fieldset's legend, explaining what each
strategy means and that "Custom Rating Blend" is distinct from the Analysis page's "Blended Rating".

**References**: `components/InfoDisclosure.tsx` (`frontend_spec_131`).

**Test Case (Red)**:
```tsx
describe('FRONTEND-132-AC-02: strategy explanation disclosure', () => {
  it('reveals explanatory text distinguishing Custom Rating Blend from Blended Rating on click', () => {
    render(<UseMySeriesPanel state={baseState} updateState={vi.fn()} {...otherProps} />)
    fireEvent.click(screen.getByRole('button', { name: /About.*Ranking/i }))
    expect(screen.getByText(/distinct from.*Blended Rating/i)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `InfoDisclosure` with copy drafted per the Design Decisions above.

---

## Requirement 2: Custom Rating Blend source chips

**User story**: As a user choosing a Custom-Rating-Blend strategy, I want to pick which rating sources
feed it, so it reflects the sources I actually trust.

### FRONTEND-132-AC-03 [AUTO]
**Statement**: Where `state.sourceRankingStrategy` is `"personalRatingThenCustomBlend"` or
`"customBlendThenPersonalRating"`, `UseMySeriesPanel` shall render a new `RatingSourceChips`
component offering 4 toggleable chips — IMDb, TMDB, Tomatometer, Popcornmeter — defaulting to
IMDb+TMDB selected; while `sourceRankingStrategy` is `"personalRatingThenDate"`, the chips shall not
render at all.

**References**: new `components/RatingSourceChips.tsx`; `series_spec_068`'s
`sourceRatingBlendSources` values.

**Test Case (Red)**:
```tsx
describe('FRONTEND-132-AC-03: Custom Rating Blend source chips', () => {
  it('is hidden for the default strategy and shown, with IMDb+TMDB selected, for blend strategies', () => {
    const { rerender } = render(
      <UseMySeriesPanel state={{ ...baseState, sourceRankingStrategy: 'personalRatingThenDate' }} updateState={vi.fn()} {...otherProps} />,
    )
    expect(screen.queryByRole('group', { name: /Custom Rating Blend sources/i })).not.toBeInTheDocument()

    rerender(
      <UseMySeriesPanel state={{ ...baseState, sourceRankingStrategy: 'customBlendThenPersonalRating' }} updateState={vi.fn()} {...otherProps} />,
    )
    const group = screen.getByRole('group', { name: /Custom Rating Blend sources/i })
    expect(within(group).getByRole('button', { name: 'IMDb', pressed: true })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'TMDB', pressed: true })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'Tomatometer', pressed: false })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: build `RatingSourceChips` (controlled, `selected: string[]`, `onChange: (next: string[]) => void`), gated by the strategy check.

---

### FRONTEND-132-AC-04 [AUTO]
**Statement**: Clicking an unselected chip in `RatingSourceChips` shall add its source to
`state.sourceRatingBlendSources`; clicking a selected chip shall remove it, except when it is the
last selected chip, in which case the click is a no-op (at least one source must remain selected).

**References**: new `components/RatingSourceChips.tsx`.

**Test Case (Red)**:
```tsx
describe('FRONTEND-132-AC-04: chip toggle behavior', () => {
  it('toggles a source in and out, but refuses to deselect the last remaining source', () => {
    const onChange = vi.fn()
    render(<RatingSourceChips selected={['imdb']} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'IMDb' }))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'TMDB' }))
    expect(onChange).toHaveBeenCalledWith(['imdb', 'tmdb'])
  })
})
```
**Test Case (Green)**: implement the toggle with the last-source guard.

---

### FRONTEND-132-AC-05 [AUTO]
**Statement**: `seriesApi.getRecommendations` shall forward `sourceRankingStrategy` and
`sourceRatingBlendSources` as query params whenever either is set on the criteria object passed to it.

**References**: `services/seriesApi.ts` (existing `addIfPresent` pattern used for every other optional
recommendation criteria field).

**Test Case (Red)**:
```typescript
describe('FRONTEND-132-AC-05: seriesApi forwards the new params', () => {
  it('includes sourceRankingStrategy and sourceRatingBlendSources when present', async () => {
    await seriesApi.getRecommendations({
      sourceRankingStrategy: 'personalRatingThenCustomBlend',
      sourceRatingBlendSources: ['imdb', 'popcornmeter'],
    })
    expect(mockAxios.get).toHaveBeenCalledWith(
      '/series/recommendations',
      expect.objectContaining({
        params: expect.objectContaining({
          sourceRankingStrategy: 'personalRatingThenCustomBlend',
          sourceRatingBlendSources: 'imdb,popcornmeter',
        }),
      }),
    )
  })
})
```
**Test Case (Green)**: add both fields to the `RecommendationCriteria` frontend type and the
`addIfPresent` chain building the request params.

---

### FRONTEND-132-AC-06 [AUTO]: info disclosure explains the last-chip guard
**Amendment (2026-09-25)**: added after a live-review question about whether `RatingSourceChips`
needed its own explanatory copy — the parent "Source Ranking Strategy" `InfoDisclosure` (AC-02)
already explains what the blend itself means, so a second copy of that would be redundant, but
AC-04's last-chip guard (a silent no-op with no visual feedback) was undocumented anywhere in the
UI, matching exactly the kind of non-obvious-control gap `frontend_spec_131`'s `InfoDisclosure`
pattern exists to close.

**Statement**: `RatingSourceChips` shall render an `InfoDisclosure` beside its legend whose
description states that at least one source must remain selected and that clicking the last
remaining chip has no effect.

**References**: `components/RatingSourceChips.tsx`; `components/InfoDisclosure.tsx`
(`frontend_spec_131`).

**Test Case (Red)**:
```tsx
describe('FRONTEND-132 amendment: info disclosure explains the last-chip guard', () => {
  it('reveals the last-chip-cannot-be-deselected explanation on click', () => {
    render(<RatingSourceChips selected={['imdb']} onChange={vi.fn()} />)

    fireEvent.click(
      screen.getByRole('button', { name: /about custom rating blend sources/i }),
    )
    expect(
      screen.getByText(/clicking the last remaining chip does nothing/i),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: render `<InfoDisclosure label="About Custom Rating Blend sources"
description="..." />` immediately after the `<legend>`, before the chip row.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Backend fields/validation these controls drive | `series_spec_068_recommendation_source_ranking_strategy.md` |
| Shared disclosure component reused | `components/InfoDisclosure.tsx` (`frontend_spec_131`) |
| Existing radio-pair precedent (different axis: candidate ranking, not source ranking) | `HighestRatedPanel.tsx`'s Best Match/Most Recommended fieldset |
| Save/restore flow these fields ride inside, unmodified | `useFilterProfileSelector`, `FilterProfileActions`, `FilterProfileArea.USE_MY_SERIES` (`frontend_spec_129`) |
| Related future idea (fuller, per-series custom ranking) | `.claude/ideas/future_ideas.md`, "User-configurable (drag-and-drop) source-series ranking" |

---

## Acceptance Criteria Summary

- [x] FRONTEND-132-AC-01: 3-option source-ranking-strategy radios, defaulting to Personal Rating then Date Completed
- [x] FRONTEND-132-AC-02: `InfoDisclosure` explains all 3 strategies and the Custom Rating Blend / Blended Rating distinction
- [x] FRONTEND-132-AC-03: `RatingSourceChips` renders only for the two blend strategies, defaulting to IMDb+TMDB
- [x] FRONTEND-132-AC-04: chip toggle adds/removes a source, refusing to deselect the last one
- [x] FRONTEND-132-AC-05: `seriesApi.getRecommendations` forwards both new params when set
- [x] FRONTEND-132-AC-06: `InfoDisclosure` explains `RatingSourceChips`' last-chip guard
