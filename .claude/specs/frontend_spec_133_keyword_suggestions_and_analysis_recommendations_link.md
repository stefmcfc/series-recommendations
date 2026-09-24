# Frontend Spec 133: Keyword Suggestion Sort/Favourites and Analysis-Page Recommendations Link

**Status**: Not started
**Priority**: P3
**Depends on**: `frontend_spec_098_country_language_favourites.md` (the exact `useLocalStorage`
favourites pattern this spec copies for keywords), `frontend_spec_053_candidate_detail_modal.md`
(the `SeriesRecommendationsModal.tsx` shape this spec's new modal is modeled on),
`series_spec_047_keyword_genre_country_stats.md` (`NameStatDto`, `/series/keywords`'s existing
`sortBy`/`minSeriesCount` params, both reused as-is).
**Area**: Frontend only — no backend spec needed. Both underlying capabilities already exist:
`GET /series/keywords` already accepts `sortBy=averageBlendedRating`/`minSeriesCount` (confirmed via
direct read of `KeywordStatsService`/`NameStatAggregator.comparatorFor` — nothing calls it that way
today, it just soft-falls-back to `seriesCount desc` when `sortBy` is unset), and
`GET /series/recommendations?keywords=X` already works standalone via the existing genre/keyword-
directed default/fallback branch (`RecommendationSourcingService.sourceByGenreOrKeyword`).

## Overview

Two independent improvements to how keywords are surfaced across the app, confirmed via direct code
reads to actually be gaps rather than assumptions: (1) Custom Search's keyword suggestions are pure
frequency today (`RecommendationControls.tsx` calls `seriesApi.getKeywordStats()` with no options at
all) with no way to prefer highest-rated keywords or pin favourites, the way Country/Language already
can; (2) the Analysis page's Keywords tab (`NameStatsTable.tsx`) is purely a static display today —
clicking a keyword row does nothing — with no way to jump straight into getting recommendations for
that keyword.

## Design Decisions

- **A Settings-configurable minimum series-count floor, not a hardcoded one** — confirmed with the
  user directly: switching keyword suggestions to rating-based sort needs a floor (so a keyword
  you've only tagged once on a 5-star show can't outrank keywords genuinely common across your
  library), and that floor should be user-adjustable, not baked into the code.
- **Favourite Keywords, mirroring Country/Language Favourites exactly.** `SettingsPage.tsx` already
  has this exact pattern twice (`countryFavourites`/`languageFavourites`, each a
  `useLocalStorage`-backed `string[]` edited via a `reorderable` `KeywordPicker` in the
  "Recommendation Favourites" section, independently re-read wherever needed — e.g.
  `CustomSearchPanel.tsx`'s own separate `useLocalStorage('countryFavourites', ...)` call feeding
  `pinnedOptions`). This spec adds a third instance of the identical pattern for keywords, in the
  same "Recommendation Favourites" section — no new abstraction needed, no section rename (avoids
  touching that heading's existing accessible-name-based test queries).
- **All 3 new keyword-suggestion settings (Favourite Keywords, sort mode, minimum count) live
  together in the existing "Recommendation Favourites" section**, rather than a new section — they're
  small and thematically about the same "how are keyword suggestions built" concern; adding a whole
  new heading for 2-3 controls would be disproportionate.
- **The floor field only renders when sort mode is "Highest Rated"** — mirrors
  `series_spec_068`-adjacent conditional-field precedent already established for other settings in
  this codebase (e.g. Skip Threshold Override's own unit toggle).
- **"Get recommendations for this keyword" is a lightweight modal, not cross-page navigation** —
  confirmed with the user directly. This app has zero existing router-based deep-link mechanism
  (confirmed via a repo-wide grep: only 2 plain `navigate('/my-series')` calls exist anywhere, no
  query-param or route-state pre-fill pattern at all) but does have a real, already-shipped analog to
  copy instead: `SeriesRecommendationsModal.tsx` (opened from `SeriesDetail`, seeded by a tracked
  series id, fetches on mount, its own loading/error/empty states). The new modal mirrors that shape
  exactly, just seeded by a keyword string instead of a series id.
- **Scoped to the Keywords tab only, not Genres/Country.** `NameStatsTable.tsx` is shared across all
  three Analysis tabs; the new "get recommendations" action is added via a new *optional* callback
  prop so `GenreStatsView`/`CountryStatsView` are unaffected by construction (undefined prop = no
  button rendered) — matching this codebase's established zero-diff-by-default pattern for optional
  hook-point props (e.g. `InfoDisclosure`'s `labelInfo`/`info`).

---

## Requirement 1: rating-based keyword suggestion sort, with a configurable floor

**User story**: As a user with a large tracked library, I want Custom Search's keyword suggestions to
optionally favor highest-rated keywords instead of only the most common ones, so I can discover
recommendations aligned with what I actually rated highly, not just what I've tagged most often.

### FRONTEND-133-AC-01 [AUTO]
**Statement**: `SettingsPage`'s "Recommendation Favourites" section shall gain a "Keyword Suggestion
Sort" control (Most Common [default] / Highest Rated), persisted via
`useLocalStorage('keywordSuggestionSortMode', 'mostCommon', ...)`.

**References**: `SettingsPage.tsx` (existing `countryFavourites`/`skipThreshold`-style
`useLocalStorage` precedent).

**Test Case (Red)**:
```tsx
describe('FRONTEND-133-AC-01: keyword suggestion sort mode setting', () => {
  it('defaults to Most Common and persists a change to Highest Rated', () => {
    render(<SettingsPage {...props} />)
    expect(screen.getByRole('radio', { name: 'Most Common' })).toBeChecked()

    fireEvent.click(screen.getByRole('radio', { name: 'Highest Rated' }))
    expect(localStorage.getItem('keywordSuggestionSortMode')).toBe(JSON.stringify('highestRated'))
  })
})
```
**Test Case (Green)**: add the radio pair bound to the new `useLocalStorage` hook.

---

### FRONTEND-133-AC-02 [AUTO]
**Statement**: Where the sort mode is "Highest Rated", `SettingsPage` shall additionally render a
"Minimum Series Count" `NumberInput`, persisted via
`useLocalStorage('keywordSuggestionMinSeriesCount', 2, ...)`; the field shall not render when the
mode is "Most Common".

**References**: `components/NumberInput.tsx`; existing Skip Threshold Override conditional-field
precedent in the same file.

**Test Case (Red)**:
```tsx
describe('FRONTEND-133-AC-02: minimum series count field visibility', () => {
  it('only shows the floor field when Highest Rated is selected', () => {
    render(<SettingsPage {...props} />)
    expect(screen.queryByLabelText('Minimum Series Count')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Highest Rated' }))
    expect(screen.getByLabelText('Minimum Series Count')).toHaveValue(2)
  })
})
```
**Test Case (Green)**: conditionally render the `NumberInput`, bound to the new `useLocalStorage` hook.

---

### FRONTEND-133-AC-03 [AUTO]
**Statement**: `seriesApi.getKeywordStats` shall accept an optional options object
(`{ sortBy?, sortDirection?, minSeriesCount? }`) and forward each provided field as a query param on
`GET /series/keywords`.

**References**: `services/seriesApi.ts` (existing no-args call today).

**Test Case (Red)**:
```typescript
describe('FRONTEND-133-AC-03: getKeywordStats forwards sort/floor options', () => {
  it('sends sortBy, sortDirection, and minSeriesCount when provided', async () => {
    await seriesApi.getKeywordStats({ sortBy: 'averageBlendedRating', sortDirection: 'desc', minSeriesCount: 3 })
    expect(mockAxios.get).toHaveBeenCalledWith(
      '/series/keywords',
      expect.objectContaining({
        params: expect.objectContaining({ sortBy: 'averageBlendedRating', sortDirection: 'desc', minSeriesCount: 3 }),
      }),
    )
  })
})
```
**Test Case (Green)**: widen the function signature; existing no-args call sites (e.g. `KeywordsView`) are unaffected since the new parameter is optional.

---

### FRONTEND-133-AC-04 [AUTO]
**Statement**: When building Custom Search's keyword suggestion list, `RecommendationControls` shall
read the sort-mode/floor settings and, when the mode is "Highest Rated", call
`seriesApi.getKeywordStats({ sortBy: 'averageBlendedRating', sortDirection: 'desc', minSeriesCount: floor })`
instead of the current no-args call.

**References**: `RecommendationControls.tsx` (existing `useEffect` calling `getKeywordStats()`).

**Test Case (Red)**:
```tsx
describe('FRONTEND-133-AC-04: suggestion fetch respects the Highest Rated setting', () => {
  it('calls getKeywordStats with rating-sort params when Highest Rated is set', () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    localStorage.setItem('keywordSuggestionMinSeriesCount', JSON.stringify(3))
    render(<RecommendationControls {...props} />)
    expect(seriesApi.getKeywordStats).toHaveBeenCalledWith({
      sortBy: 'averageBlendedRating', sortDirection: 'desc', minSeriesCount: 3,
    })
  })
})
```
**Test Case (Green)**: read both settings via `useLocalStorage` and branch the fetch call accordingly.

---

## Requirement 2: Favourite Keywords

**User story**: As a user, I want to pin specific keywords as favourites, so they always appear as
suggestions in Custom Search regardless of sort mode — the same way I can already pin favourite
countries/languages.

### FRONTEND-133-AC-05 [AUTO]
**Statement**: `SettingsPage`'s "Recommendation Favourites" section shall gain a third `KeywordPicker`
instance ("Favourite Keywords", `reorderable`), persisted via
`useLocalStorage('keywordFavourites', [], ...)`, following the identical shape of the existing
Country/Language Favourites pickers in the same section.

**References**: `SettingsPage.tsx` lines ~442-470 (existing Country/Language Favourites block, the
pattern to copy).

**Test Case (Red)**:
```tsx
describe('FRONTEND-133-AC-05: Favourite Keywords setting', () => {
  it('adds and persists a favourite keyword', () => {
    render(<SettingsPage {...props} />)
    const picker = screen.getByLabelText('Favourite Keywords')
    // ... select a keyword via the picker's own interaction pattern
    expect(JSON.parse(localStorage.getItem('keywordFavourites')!)).toContain('time travel')
  })
})
```
**Test Case (Green)**: add the third `KeywordPicker` instance bound to the new `useLocalStorage` hook.

---

### FRONTEND-133-AC-06 [AUTO]
**Statement**: `CustomSearchPanel` shall read `keywordFavourites` from `localStorage` and pass it as
`pinnedOptions` to both of its keyword `KeywordPicker` instances (the inline picker and the "Browse
all keywords" modal).

**References**: `CustomSearchPanel.tsx` (existing `countryFavourites`/`languageFavourites`
independent-read pattern to copy for keywords).

**Test Case (Red)**:
```tsx
describe('FRONTEND-133-AC-06: favourite keywords are pinned in Custom Search', () => {
  it('passes keywordFavourites as pinnedOptions to the keyword picker', () => {
    localStorage.setItem('keywordFavourites', JSON.stringify(['time travel']))
    render(<CustomSearchPanel {...props} />)
    expect(screen.getByTestId('keyword-picker-pinned')).toHaveTextContent('time travel')
  })
})
```
**Test Case (Green)**: add the `useLocalStorage('keywordFavourites', [], ...)` read; wire
`pinnedOptions` on both `KeywordPicker` instances.

---

## Requirement 3: "Get recommendations for this keyword" from the Analysis page

**User story**: As a user browsing the Analysis page's Keywords tab, I want to jump straight into
getting recommendations for a specific keyword, without manually re-entering it in Custom Search.

### FRONTEND-133-AC-07 [AUTO]
**Statement**: `NameStatsTable` shall accept a new, optional `onGetRecommendations?: (name: string)
=> void` prop; where provided, each row shall render a "Get Recs" button calling it with that row's
`name`; where omitted, no such button renders.

**References**: `components/NameStatsTable.tsx` (existing static row rendering — no per-row action
today, confirmed via direct read).

**Test Case (Red)**:
```tsx
describe('FRONTEND-133-AC-07: optional per-row recommendations action', () => {
  it('renders a Get Recs button only when the callback prop is provided', () => {
    const { rerender } = render(<NameStatsTable stats={stats} fetchStats={fetchStats} />)
    expect(screen.queryByRole('button', { name: /Get Recs/i })).not.toBeInTheDocument()

    const onGetRecommendations = vi.fn()
    rerender(<NameStatsTable stats={stats} fetchStats={fetchStats} onGetRecommendations={onGetRecommendations} />)
    fireEvent.click(screen.getAllByRole('button', { name: /Get Recs/i })[0])
    expect(onGetRecommendations).toHaveBeenCalledWith(stats[0].name)
  })
})
```
**Test Case (Green)**: add the optional prop and conditional per-row button.

---

### FRONTEND-133-AC-08 [AUTO]
**Statement**: `KeywordsView` (and only `KeywordsView` — not `GenreStatsView`/`CountryStatsView`)
shall pass `onGetRecommendations`, opening a new `KeywordRecommendationsModal` seeded with the
clicked keyword.

**References**: `components/KeywordsView.tsx`; new `components/KeywordRecommendationsModal.tsx`.

**Test Case (Red)**:
```tsx
describe('FRONTEND-133-AC-08: KeywordsView wires the action, Genre/Country views do not', () => {
  it('opens KeywordRecommendationsModal from KeywordsView', () => {
    render(<KeywordsView />)
    fireEvent.click(screen.getAllByRole('button', { name: /Get Recs/i })[0])
    expect(screen.getByRole('dialog', { name: /Recommendations for/i })).toBeInTheDocument()
  })

  it('GenreStatsView renders no Get Recs button', () => {
    render(<GenreStatsView />)
    expect(screen.queryByRole('button', { name: /Get Recs/i })).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: wire the callback in `KeywordsView` only; leave `GenreStatsView`/
`CountryStatsView` untouched.

---

### FRONTEND-133-AC-09 [AUTO]
**Statement**: `KeywordRecommendationsModal`, on mount, shall call
`seriesApi.getRecommendations({ keywords: [keyword] })` and render the same loading/error/empty/
results states as `SeriesRecommendationsModal`.

**References**: new `components/KeywordRecommendationsModal.tsx`, modeled directly on
`components/SeriesRecommendationsModal.tsx`'s exact prop/lifecycle shape.

**Test Case (Red)**:
```tsx
describe('FRONTEND-133-AC-09: fetch-on-mount and state handling', () => {
  it('fetches recommendations for the seeded keyword on mount', () => {
    render(<KeywordRecommendationsModal keyword="time travel" onClose={vi.fn()} />)
    expect(seriesApi.getRecommendations).toHaveBeenCalledWith({ keywords: ['time travel'] })
  })

  it('shows an error state with retry when the fetch rejects', async () => {
    vi.mocked(seriesApi.getRecommendations).mockRejectedValueOnce(new Error('fail'))
    render(<KeywordRecommendationsModal keyword="time travel" onClose={vi.fn()} />)
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: implement the modal mirroring `SeriesRecommendationsModal`'s existing
fetch/loading/error/empty/results structure.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Existing endpoint params reused as-is, no backend change | `GET /series/keywords` (`sortBy`, `sortDirection`, `minSeriesCount`), `GET /series/recommendations` (`keywords`) |
| Favourites pattern copied for keywords | `SettingsPage.tsx`/`CustomSearchPanel.tsx`'s `countryFavourites`/`languageFavourites` (`frontend_spec_098`) |
| Modal shape copied for the new keyword modal | `components/SeriesRecommendationsModal.tsx` (`frontend_spec_053`) |
| Component whose static rows gain an optional action | `components/NameStatsTable.tsx` |
| Confirmed absent: any cross-page deep-link precedent | repo-wide grep, only 2 plain `navigate('/my-series')` calls exist, no query-param/route-state pre-fill anywhere |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-133-AC-01: "Keyword Suggestion Sort" setting (Most Common / Highest Rated)
- [ ] FRONTEND-133-AC-02: "Minimum Series Count" field, shown only in Highest Rated mode
- [ ] FRONTEND-133-AC-03: `seriesApi.getKeywordStats` accepts and forwards sort/floor options
- [ ] FRONTEND-133-AC-04: suggestion fetch uses rating-sort params when Highest Rated is set
- [ ] FRONTEND-133-AC-05: "Favourite Keywords" setting, same shape as Country/Language Favourites
- [ ] FRONTEND-133-AC-06: `CustomSearchPanel` pins favourite keywords via `pinnedOptions`
- [ ] FRONTEND-133-AC-07: `NameStatsTable` gains an optional per-row `onGetRecommendations` action
- [ ] FRONTEND-133-AC-08: only `KeywordsView` wires the action; Genre/Country views are unaffected
- [ ] FRONTEND-133-AC-09: `KeywordRecommendationsModal` fetches on mount, mirrors `SeriesRecommendationsModal`'s states
