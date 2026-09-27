# Frontend Spec 137: Genre Favourites Indicator and Per-Genre Series Detail Modal

**Status**: Not started
**Priority**: P3
**Depends on**: `frontend_spec_136_keyword_favourites_indicator_and_detail_modal.md` (must ship
first — this spec reuses its generalized `NameStatsTable` plumbing (`favouriteNames`, the
"Favourites Only" filter, `onOpenDetail`) as-is rather than adding near-duplicate props; also
reuses `KeywordDetailModal.tsx`'s exact shape and the `blendedRating` utility it introduces),
`series_spec_047_keyword_genre_country_stats.md` (`RatingBlendUtil.blendedRating`, unchanged
reference from `frontend_spec_136`).
**Area**: Frontend only — no backend spec needed. Confirmed via direct code reads: `GET
/api/v1/series/search`'s existing `genre` param already does a case-insensitive **substring** match
(not the exact match `keyword` uses) with no implicit status filter, and the genre vocabulary itself
is a small, fixed TMDB table (`TmdbGenreTable.GENRES`, 16 canonical entries) — substring matching a
canonical name pulled directly from that same table carries no realistic collision risk.

## Overview

The Genres analog of `frontend_spec_133`/`136`'s keyword work — but **only the parts that actually
apply**. Confirmed via direct code reads that Custom Search's genre picker
(`GenreIncludeExcludePicker`) is structurally nothing like `KeywordPicker`: it renders the *entire*
16-entry genre vocabulary as a fixed grid of toggle buttons (`getGenreOptions()`, alphabetical, no
ranking), not a searchable/truncated suggestion list built from `getGenreStats()`. There is no
long tail to rank or truncate, so `frontend_spec_133`'s Requirement 1 (a "Most Common / Highest
Rated" sort mode with a floor) has no meaningful equivalent here and is deliberately not ported —
confirmed with the user directly.

What *does* transfer cleanly: (1) Favourite Genres, surfaced as a small star badge on Custom
Search's genre grid (confirmed with the user: a badge, not reordering the grid); (2) the
`frontend_spec_136`-style Analysis-page work — a favourite star + "Favourites Only" filter on the
Genres tab, and a new `GenreDetailModal` listing every tracked series (any status) carrying that
genre, sortable, click-through to the series' own detail page, with a favourite toggle inside.

## Design Decisions

- **New `genreFavourites` `localStorage` key**, following the exact same shape as
  `keywordFavourites`/`countryFavourites`/`languageFavourites`: a plain `string[]`, read/written
  independently wherever needed (Settings, the Custom Search grid, the new detail modal) — no new
  shared state or hook, matching this codebase's established favourites philosophy.
- **A fourth "Favourite Genres" picker in Settings' "Recommendation Favourites" section**, same
  `reorderable` `KeywordPicker` shape as the existing three. Unlike Country/Language (whose options
  come from static frontend constants, `ALL_COUNTRY_OPTIONS`/`LANGUAGE_OPTIONS`) and unlike Keywords
  (whose options come from a `getKeywordStats()` fetch), genres have **no static frontend list** —
  the vocabulary only exists via `seriesApi.getGenreOptions()`. `SettingsPage.tsx` fetches it on
  mount the same way `frontend_spec_133` already established for Keywords (a local
  `useState<string[]>([])` plus a `useEffect` populating it), not a new static constants file, since
  the backend table (`TmdbGenreTable`) is the real source of truth and could change.
- **Favourite Genres on the Custom Search grid is a read-only star badge, not reordering** —
  confirmed with the user directly. `GenreIncludeExcludePicker`'s grid has no existing
  "pinned/reordered" concept the way `KeywordPicker` does (`pinnedOptions`); a badge is the smaller,
  lower-risk addition and was the explicitly chosen option over restructuring the grid's order.
  **Scoped to `CustomSearchPanel`'s one `GenreIncludeExcludePicker` instance only** — `SearchFilter`,
  `RecommendationFiltersBox`, and `UseMySeriesPanel`'s own separate instances are unaffected, mirroring
  exactly how `frontend_spec_133` only wired keyword favourites into `CustomSearchPanel`'s pickers,
  never `SearchFilter`'s.
- **The badge is purely visual in the grid** — toggling a genre's favourite status happens in
  Settings or the new `GenreDetailModal`, not by interacting with the badge itself, mirroring
  `frontend_spec_136`'s identical read-only-in-list / toggle-in-modal split for keywords.
- **Reuses `frontend_spec_136`'s generalized `NameStatsTable` props as-is**: `favouriteNames`
  (already generic), the "Favourites Only" filter (already generic), and `onOpenDetail` (generalized
  by that spec specifically so this one wouldn't need its own near-duplicate prop). `GenreStatsView`
  wires all three from `genreFavourites`, exactly as `KeywordsView` wires them from
  `keywordFavourites` — `CountryStatsView` remains unaffected by construction, same as it was for
  `frontend_spec_136`.
- **`GenreDetailModal` is `KeywordDetailModal`'s shape, unchanged**, just seeded by a genre name and
  fetching `seriesApi.search({ genre: [genreName] })` instead of `{ keyword: [...] }`. Reuses the
  same `blendedRating` utility `frontend_spec_136` introduces — no new rating-calculation code.
- **`search`'s `genre` param is a substring match, not `keyword`'s exact match** — confirmed via
  direct read of `SeriesSearchService.matchesGenres` (`lower.contains(g.toLowerCase())`) vs.
  `matchesKeywords`' exact-match comment calling this out explicitly in the existing code. Not a
  practical concern here: `GenreDetailModal` is always seeded with one of the 16 canonical names
  already sourced from `getGenreStats()` (built from the same stored, already-canonicalized `genres`
  column), so there's no realistic false-positive risk within this fixed vocabulary — noted here so
  a future reader doesn't assume this spec's modal behaves identically to `KeywordDetailModal`'s
  exact-match fetch under the hood.
- **Not pursued in this spec (deliberately)**: a "Favourites Only" filter on the Custom Search grid
  itself (narrowing the 16-genre grid down to just favourites) — a real, distinct idea from the
  badge, raised and intentionally left for `SPEC_CANDIDATES.md` rather than folded in here.

---

## Requirement 1: Favourite Genres

**User story**: As a user, I want to mark specific genres as favourites and see them called out
while browsing Custom Search's genre picker, the same way I can already do for keywords.

### FRONTEND-137-AC-01 [AUTO]
**Statement**: `SettingsPage`'s "Recommendation Favourites" section shall gain a fourth
`KeywordPicker` instance ("Favourite Genres", `reorderable`), persisted via
`useLocalStorage('genreFavourites', [], ...)`, with its `options` populated from
`seriesApi.getGenreOptions()` fetched on mount.

**References**: `SettingsPage.tsx` (existing Country/Language/Keyword Favourites block, the pattern
to extend); `frontend_spec_133`'s own `keywordOptions` fetch-on-mount precedent (the shape to mirror
for `genreOptions`, since neither has a static frontend list).

**Test Case (Red)**:
```tsx
describe('FRONTEND-137-AC-01: Favourite Genres setting', () => {
  it('adds and persists a favourite genre', async () => {
    mockGetGenreOptions.mockResolvedValue(['Comedy', 'Drama'])
    render(<SettingsPage {...props} />)
    const picker = await screen.findByLabelText('Favourite Genres')
    // ... select a genre via the picker's own interaction pattern
    expect(JSON.parse(localStorage.getItem('genreFavourites')!)).toContain('Comedy')
  })
})
```
**Test Case (Green)**: add the `useState`/`useEffect` fetch and the fourth `KeywordPicker` instance
bound to the new `useLocalStorage` hook.

---

### FRONTEND-137-AC-02 [AUTO]
**Statement**: `CustomSearchPanel`'s `GenreIncludeExcludePicker` instance shall read
`genreFavourites` from `localStorage` and render `FavouritesIcon` as a small badge on the grid
toggle button for each favourited genre; the badge shall not be interactive (toggling a favourite
happens elsewhere).

**References**: `components/CustomSearchPanel.tsx` (the one `GenreIncludeExcludePicker` instance to
change); `components/GenreIncludeExcludePicker.tsx` (grid button rendering, ~line 180-194);
`components/SettingsIcons.tsx`'s `FavouritesIcon` (the icon to reuse, no new asset).

**Test Case (Red)**:
```tsx
describe('FRONTEND-137-AC-02: favourite genre badge in Custom Search', () => {
  it('shows a badge only on favourited genres, only in CustomSearchPanel', () => {
    localStorage.setItem('genreFavourites', JSON.stringify(['Comedy']))
    render(<CustomSearchPanel {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Genres/i })) // open the grid
    expect(
      within(screen.getByRole('button', { name: /Comedy/i })).getByTestId(
        'genre-favourite-badge',
      ),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('button', { name: /Drama/i })).queryByTestId(
        'genre-favourite-badge',
      ),
    ).not.toBeInTheDocument()
  })

  it('SearchFilter\'s own genre picker renders no badge', () => {
    localStorage.setItem('genreFavourites', JSON.stringify(['Comedy']))
    render(<SearchFilter {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Genres/i }))
    expect(screen.queryByTestId('genre-favourite-badge')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add an optional `favouriteGenres?: string[]` prop to
`GenreIncludeExcludePicker`, rendering the badge conditionally per grid button; wire it from
`localStorage` only in `CustomSearchPanel`.

---

## Requirement 2: favourite indicator and filter on the Genres tab

**User story**: As a user, I want to see which genres I've favourited while browsing the Analysis
page's Genres tab, and narrow the table to just those, the same way I already can for Keywords.

### FRONTEND-137-AC-03 [AUTO]
**Statement**: `GenreStatsView` shall read `genreFavourites` from `localStorage` and pass it as
`NameStatsTable`'s existing `favouriteNames` prop; `KeywordsView`/`CountryStatsView` are unaffected.

**References**: `components/GenreStatsView.tsx`; `components/NameStatsTable.tsx`'s `favouriteNames`
prop (already generalized by `frontend_spec_136` — no `NameStatsTable` change needed here).

**Test Case (Red)**:
```tsx
describe('FRONTEND-137-AC-03: GenreStatsView wires favourites', () => {
  it('shows a star for a genre already in genreFavourites', () => {
    localStorage.setItem('genreFavourites', JSON.stringify(['Comedy']))
    render(<GenreStatsView filters={filters} />)
    expect(screen.getByTestId('favourite-star')).toBeInTheDocument()
  })

  it('the Favourites Only filter narrows to genreFavourites, client-side', () => {
    localStorage.setItem('genreFavourites', JSON.stringify(['Comedy']))
    render(<GenreStatsView filters={filters} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Favourites Only/i }))
    expect(screen.queryByText('Drama')).not.toBeInTheDocument()
    expect(screen.getByText('Comedy')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `useLocalStorage('genreFavourites', [], ...)` read in `GenreStatsView`
only, wired to `NameStatsTable`'s existing `favouriteNames` prop (the filter checkbox itself needs no
new code — it already exists behind that same prop from `frontend_spec_136`).

---

## Requirement 3: per-genre series detail modal

**User story**: As a user browsing the Genres tab, I want to click a genre and see every series I've
tagged with it — whatever their status — with ratings I can sort by, the same way I already can for
keywords.

### FRONTEND-137-AC-04 [AUTO]
**Statement**: `GenreStatsView` shall pass `NameStatsTable`'s existing `onOpenDetail` prop, opening a
new `GenreDetailModal` seeded with the clicked genre name; `KeywordsView`/`CountryStatsView` are
unaffected.

**References**: `components/GenreStatsView.tsx`; new `components/GenreDetailModal.tsx`;
`components/NameStatsTable.tsx`'s `onOpenDetail` prop (already generalized by `frontend_spec_136`).

**Test Case (Red)**:
```tsx
describe('FRONTEND-137-AC-04: GenreStatsView wires the detail modal', () => {
  it('opens GenreDetailModal from a genre name click', () => {
    render(<GenreStatsView filters={filters} />)
    fireEvent.click(screen.getByRole('button', { name: 'Comedy' }))
    expect(screen.getByRole('dialog', { name: /Comedy/i })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: wire the callback in `GenreStatsView` only, rendering `GenreDetailModal`.

---

### FRONTEND-137-AC-05 [AUTO]
**Statement**: `GenreDetailModal`, on mount, shall call `seriesApi.search({ genre: [genre] })` (no
status filter) and render the same loading/error-with-Retry/sortable-table/row-click-to-detail/
favourite-toggle behavior as `KeywordDetailModal` (`frontend_spec_136`), reading/writing
`genreFavourites` instead of `keywordFavourites`.

**References**: new `components/GenreDetailModal.tsx`, modeled directly on
`components/KeywordDetailModal.tsx`'s exact shape (`frontend_spec_136`) — fetch/loading/error/Retry,
client-side column sort, row-click navigation to `/my-series/view/:id`, and the in-modal favourite
toggle, all unchanged except the fetch call and the `localStorage` key.

**Test Case (Red)**:
```tsx
describe('FRONTEND-137-AC-05: fetch-on-mount and favourite toggle', () => {
  it('fetches all-status series for the seeded genre on mount', () => {
    render(<GenreDetailModal genre="Comedy" onClose={vi.fn()} />)
    expect(seriesApi.search).toHaveBeenCalledWith({ genre: ['Comedy'] })
  })

  it('toggles the genre in genreFavourites', () => {
    render(<GenreDetailModal genre="Comedy" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /favourite/i }))
    expect(JSON.parse(localStorage.getItem('genreFavourites')!)).toContain('Comedy')
  })
})
```
**Test Case (Green)**: implement `GenreDetailModal` as a near-verbatim copy of
`KeywordDetailModal`'s structure, substituting the fetch call and `localStorage` key.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `NameStatsTable`'s generalized `favouriteNames`/`onOpenDetail` props, reused as-is | `frontend_spec_136_keyword_favourites_indicator_and_detail_modal.md` |
| `GenreDetailModal`'s shape, copied unchanged | `components/KeywordDetailModal.tsx` (`frontend_spec_136`) |
| `blendedRating` utility, reused unchanged | `frontend_spec_136` (originally from `RatingBlendUtil.blendedRating`, `series_spec_047`) |
| Star icon reused, no new asset | `components/SettingsIcons.tsx`'s `FavouritesIcon` |
| Confirmed: no sort-mode/floor analog for Genres (small fixed vocabulary, no suggestion-ranking concept) | direct read of `GenreIncludeExcludePicker.tsx`/`TmdbGenreTable.java` |
| Confirmed: `search`'s `genre` param is substring, not exact match | `SeriesSearchService.matchesGenres` |
| Scoping pattern (`CustomSearchPanel` only, not `SearchFilter`/etc.) matched | `frontend_spec_133`'s identical scoping of keyword favourites |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-137-AC-01: "Favourite Genres" picker in Settings, options fetched from `getGenreOptions()`
- [ ] FRONTEND-137-AC-02: favourite badge on `CustomSearchPanel`'s genre grid, scoped to that instance only
- [ ] FRONTEND-137-AC-03: `GenreStatsView` wires `favouriteNames`/"Favourites Only" from `genreFavourites`
- [ ] FRONTEND-137-AC-04: `GenreStatsView` wires `onOpenDetail` to open `GenreDetailModal`
- [ ] FRONTEND-137-AC-05: `GenreDetailModal` mirrors `KeywordDetailModal` exactly, seeded by genre
