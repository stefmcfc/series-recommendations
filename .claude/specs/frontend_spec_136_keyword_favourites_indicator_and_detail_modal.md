# Frontend Spec 136: Keyword Favourites Indicator and Per-Keyword Series Detail Modal

**Status**: Not started
**Priority**: P3
**Depends on**: `frontend_spec_133_keyword_suggestions_and_analysis_recommendations_link.md` (the
`keywordFavourites` `localStorage` key this spec reads/writes as-is, `KeywordsView`/
`NameStatsTable`'s optional-callback-prop pattern this spec's new star/detail-modal hook points
mirror structurally, and `KeywordRecommendationsModal.tsx`'s fetch-on-mount/loading/error/Retry
shape the new modal also mirrors), `series_spec_047_keyword_genre_country_stats.md`
(`RatingBlendUtil.blendedRating`, the backend formula this spec's client-side equivalent must stay
consistent with).
**Area**: Frontend only — no backend spec needed. Confirmed via direct code reads: `GET
/api/v1/series/search`'s existing `keyword` param already does a case-insensitive exact match with
no implicit status filter (so "any status" is already free), and every `Series` object already
carries the raw `imdbRating`/`tmdbRating` fields a client-side blended-rating calculation needs.

## Overview

Two related enhancements to the Analysis page's Keywords tab, building directly on
`frontend_spec_133`'s Favourite Keywords: (1) each keyword row gains a visible star indicator when
that keyword is favourited, plus a "Favourites Only" filter toggle for the table; (2) clicking a
keyword's name opens a new detail modal listing every tracked series carrying that keyword —
regardless of status — with name, status, personal rating, and a client-side-computed blended
rating, sortable by clicking any column header, each row clickable through to that series' own
detail page, and a favourite toggle for the keyword itself inside the modal.

## Design Decisions

- **Reuses the existing `keywordFavourites` `localStorage` key as-is** — written today only by
  `SettingsPage.tsx`'s "Favourite Keywords" picker (`frontend_spec_133`). This spec's star indicator
  and the new modal's favourite toggle read/write that exact same key, so toggling a favourite from
  either place — the modal or Settings — stays in sync automatically via `localStorage` itself as
  the single source of truth; no new shared state or hook is introduced. Matches this codebase's
  already-established "independently re-read wherever needed" philosophy for favourites (see
  `frontend_spec_133`'s own Design Decisions, and `CustomSearchPanel.tsx`'s independent
  `countryFavourites`/`languageFavourites` reads).
- **The star indicator reuses `SettingsIcons.tsx`'s existing `FavouritesIcon`** (a star `<polygon>`)
  — no new icon asset. It is read-only in the table row; per the user's own framing, toggling a
  favourite happens only inside the new detail modal, not by clicking the star in the row directly.
- **The keyword *name* cell becomes the modal's open trigger**, not a second action button.
  `NameStatsTable`'s Keywords row already has one action button ("Get Recs", `frontend_spec_133`);
  adding a second dedicated button for "view detail" would clutter the row for an action that reads
  naturally as "click the thing to see more about it" — the same pattern `SeriesList` already uses
  (clicking a row opens that series' detail).
- **"Favourites Only" and the star both scope to Keywords only, not Genres/Country** — mirrors
  `frontend_spec_133`'s own established precedent for `onGetRecommendations`: new optional
  props/callbacks on `NameStatsTable`, wired up only in `KeywordsView`, so `GenreStatsView`/
  `CountryStatsView` are unaffected by construction (undefined prop = no star column, no filter
  checkbox, no behavior change). Neither Genre nor Country has a favourites concept in this app
  today, so this is a real scope boundary, not an arbitrary one.
- **The detail-modal open callback is named generically (`onOpenDetail`), not the more literal
  `onOpenKeywordDetail`** — confirmed with the user directly, ahead of a planned follow-up Genres spec
  (`frontend_spec_137`) that reuses this exact same `NameStatsTable` plumbing for a
  `GenreDetailModal`. Naming it generically now, while this prop doesn't exist yet, avoids
  `NameStatsTable` ending up with two near-duplicate callback props (`onOpenDetail` +
  `onOpenGenreDetail`) doing the identical job. `favouriteNames`/the "Favourites Only" filter were
  already generic by name; only the click-through callback needed this.
- **"Favourites Only" filters client-side, not via a new backend query param.** Favourite keywords
  are a purely local, unsynced-to-backend concept (confirmed: `GET /series/keywords` has no
  favourites-related param, and none is being added). The checkbox filters the already-fetched
  `stats` array down to entries whose `name` is in `keywordFavourites`, the same way any other
  client-only concern would layer on top of server-fetched data here.
- **Blended rating is computed client-side**, not fetched from a new backend field — no per-series
  `blendedRating` exists on `SeriesDto`/`Series` today (only the aggregate `averageBlendedRating`
  does). A new small utility, e.g. `utils/blendedRating.ts`, reimplements
  `RatingBlendUtil.blendedRating`'s exact contract for parity: the unweighted average of whichever of
  `imdbRating`/`tmdbRating` are non-null, rounded to 1 decimal place (`HALF_UP` on the backend;
  standard JS rounding is equivalent at 1dp for these inputs), `null` if both source ratings are
  `null`. A code comment on the new utility points at `RatingBlendUtil.java` by name so the two never
  silently drift in meaning if either is changed later.
- **The modal's series list is fetched via the existing `seriesApi.search({ keyword: [keyword] })`**
  — already supports a repeatable, case-insensitive exact-match `keyword` param with no status filter
  applied unless one is explicitly passed (confirmed via direct read of `SeriesControllerApi.search`
  and its frontend `seriesApi.search` wrapper), so "any status" requires no new parameter.
- **Column sorting is local/client-side**, not a re-fetch — unlike `NameStatsTable`'s aggregate-stats
  sort (which re-queries the backend), this modal already holds its full, typically-small result set
  (one user's own tracked series carrying one keyword) after a single fetch. Sorting re-orders that
  array in place via a local `useState<{ sortBy, direction }>` plus a derived sorted list, styled
  identically to `NameStatsTable.tsx`'s `<th onClick={...}>`/sort-indicator pattern for visual
  consistency, but without that component's shared `useNameStatsFilters` hook (that hook's
  fetch-driven design doesn't fit a dataset that's already fully in hand).
- **Clicking a series row navigates to that series' existing detail route**
  (`/my-series/view/:id`, via `useNavigate` — same route `SeriesList`'s own row click already
  targets), which unmounts the modal as a side effect of the route change; no separate explicit close
  handling is needed for that path.
- **Loading/error/Retry states mirror `KeywordRecommendationsModal.tsx`'s shape exactly** (itself
  modeled on `SeriesRecommendationsModal.tsx`, with a Retry action added for `frontend_spec_133`) —
  the now-current established pattern for a fetch-on-mount modal in this codebase, not the earlier
  no-Retry shape.

---

## Requirement 1: favourite indicator and filter on the Keywords tab

**User story**: As a user, I want to see at a glance which keywords I've favourited while browsing
the Keywords tab, and optionally narrow the table to just those, so I don't have to cross-reference
Settings' Favourite Keywords list separately.

### FRONTEND-136-AC-01 [AUTO]
**Statement**: `NameStatsTable` shall accept a new, optional `favouriteNames?: string[]` prop; where
provided, each row whose `name` is in that array shall render `FavouritesIcon` (a star) beside the
keyword name; where omitted, no star renders for any row.

**References**: `components/NameStatsTable.tsx` (row rendering, ~line 332-337);
`components/SettingsIcons.tsx` (`FavouritesIcon`, the icon to reuse).

**Test Case (Red)**:
```tsx
describe('FRONTEND-136-AC-01: favourite star indicator', () => {
  it('renders a star only for names present in favouriteNames', () => {
    render(
      <NameStatsTable
        stats={stats}
        fetchStats={fetchStats}
        favouriteNames={['time travel']}
      />,
    )
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByTestId('favourite-star')).toBeInTheDocument()
    expect(within(rows[2]).queryByTestId('favourite-star')).not.toBeInTheDocument()
  })

  it('renders no star at all when favouriteNames is omitted', () => {
    render(<NameStatsTable stats={stats} fetchStats={fetchStats} />)
    expect(screen.queryByTestId('favourite-star')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the optional prop and conditional per-row `FavouritesIcon`.

---

### FRONTEND-136-AC-02 [AUTO]
**Statement**: `KeywordsView` shall read `keywordFavourites` from `localStorage` (the same key
`frontend_spec_133` already writes) and pass it as `NameStatsTable`'s `favouriteNames`;
`GenreStatsView`/`CountryStatsView` shall not pass this prop.

**References**: `components/KeywordsView.tsx`; `components/GenreStatsView.tsx`/
`CountryStatsView.tsx` (unaffected).

**Test Case (Red)**:
```tsx
describe('FRONTEND-136-AC-02: KeywordsView wires favourites, Genre/Country do not', () => {
  it('shows a star for a keyword already in keywordFavourites', () => {
    localStorage.setItem('keywordFavourites', JSON.stringify(['time travel']))
    render(<KeywordsView filters={filters} />)
    expect(screen.getByTestId('favourite-star')).toBeInTheDocument()
  })

  it('GenreStatsView renders no favourite star even for an identically-named favourite', () => {
    localStorage.setItem('keywordFavourites', JSON.stringify(['Drama']))
    render(<GenreStatsView filters={filters} />)
    expect(screen.queryByTestId('favourite-star')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `useLocalStorage('keywordFavourites', [], ...)` read in `KeywordsView`
only, wired to the new prop.

---

### FRONTEND-136-AC-03 [AUTO]
**Statement**: Where `favouriteNames` is provided, `NameStatsTable` shall render a "Favourites Only"
checkbox; when checked, only rows whose `name` is in `favouriteNames` shall render, filtered
client-side against the already-fetched `stats` (no new fetch, no new backend param); unchecking
restores all rows.

**References**: `components/NameStatsTable.tsx` (existing `onlyCompleted`-style filter checkbox
precedent in the same filters section).

**Test Case (Red)**:
```tsx
describe('FRONTEND-136-AC-03: Favourites Only filter', () => {
  it('narrows rows to favourites only when checked, client-side', () => {
    render(
      <NameStatsTable
        stats={[{ name: 'time travel', seriesCount: 2, averagePersonalRating: 8, averageBlendedRating: 7.5 },
                { name: 'heist', seriesCount: 5, averagePersonalRating: 6, averageBlendedRating: 6.2 }]}
        fetchStats={fetchStats}
        favouriteNames={['time travel']}
      />,
    )
    expect(screen.getByText('heist')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /Favourites Only/i }))
    expect(screen.queryByText('heist')).not.toBeInTheDocument()
    expect(screen.getByText('time travel')).toBeInTheDocument()
    expect(fetchStats).toHaveBeenCalledTimes(1) // no re-fetch triggered by the filter
  })
})
```
**Test Case (Green)**: add the checkbox and client-side row filter, gated on `favouriteNames` being
provided.

---

## Requirement 2: per-keyword series detail modal

**User story**: As a user browsing the Keywords tab, I want to click a keyword and see every series
I've tagged with it — whatever their status — with ratings I can sort by, so I can explore my own
history with that keyword without leaving the page to search manually.

### FRONTEND-136-AC-04 [AUTO]
**Statement**: `NameStatsTable` shall accept a new, optional `onOpenDetail?: (name: string) =>
void` prop; where provided, each row's name cell shall render as a button calling it with that row's
`name`; where omitted, the name cell shall remain plain text as today.

**References**: `components/NameStatsTable.tsx` (name cell, ~line 334); existing
`onGetRecommendations` optional-prop pattern in the same file (`frontend_spec_133`) as the structural
model.

**Test Case (Red)**:
```tsx
describe('FRONTEND-136-AC-04: optional keyword-name click-through', () => {
  it('renders the name as a clickable button only when the callback prop is provided', () => {
    const { rerender } = render(<NameStatsTable stats={stats} fetchStats={fetchStats} />)
    expect(screen.queryByRole('button', { name: stats[0].name })).not.toBeInTheDocument()

    const onOpenDetail = vi.fn()
    rerender(
      <NameStatsTable stats={stats} fetchStats={fetchStats} onOpenDetail={onOpenDetail} />,
    )
    fireEvent.click(screen.getByRole('button', { name: stats[0].name }))
    expect(onOpenDetail).toHaveBeenCalledWith(stats[0].name)
  })
})
```
**Test Case (Green)**: add the optional prop and conditional button-vs-text name cell.

---

### FRONTEND-136-AC-05 [AUTO]
**Statement**: `KeywordsView` (and only `KeywordsView`) shall pass `onOpenDetail`, opening a
new `KeywordDetailModal` seeded with the clicked keyword.

**References**: `components/KeywordsView.tsx`; new `components/KeywordDetailModal.tsx`.

**Test Case (Red)**:
```tsx
describe('FRONTEND-136-AC-05: KeywordsView wires the detail modal, Genre/Country do not', () => {
  it('opens KeywordDetailModal from a keyword name click', () => {
    render(<KeywordsView filters={filters} />)
    fireEvent.click(screen.getByRole('button', { name: 'time travel' }))
    expect(screen.getByRole('dialog', { name: /time travel/i })).toBeInTheDocument()
  })

  it('GenreStatsView renders no clickable name button', () => {
    render(<GenreStatsView filters={filters} />)
    expect(screen.queryByRole('button', { name: 'Drama' })).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: wire the callback in `KeywordsView` only.

---

### FRONTEND-136-AC-06 [AUTO]
**Statement**: `KeywordDetailModal`, on mount, shall call `seriesApi.search({ keyword: [keyword] })`
(no status filter) and render the same loading/error-with-Retry states as
`KeywordRecommendationsModal`; on success, it shall render one row per returned series showing name,
status, personal rating, and a client-side-computed blended rating (via the new `blendedRating`
utility), or an empty-state message when the result is empty.

**References**: new `components/KeywordDetailModal.tsx`, modeled on
`components/KeywordRecommendationsModal.tsx`'s exact fetch/loading/error/Retry shape; new
`utils/blendedRating.ts`.

**Test Case (Red)**:
```tsx
describe('FRONTEND-136-AC-06: fetch-on-mount and state handling', () => {
  it('fetches all-status series for the seeded keyword on mount', () => {
    render(<KeywordDetailModal keyword="time travel" onClose={vi.fn()} />)
    expect(seriesApi.search).toHaveBeenCalledWith({ keyword: ['time travel'] })
  })

  it('shows an error state with retry when the fetch rejects', async () => {
    vi.mocked(seriesApi.search).mockRejectedValueOnce(new Error('fail'))
    render(<KeywordDetailModal keyword="time travel" onClose={vi.fn()} />)
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('renders a computed blended rating per row', async () => {
    vi.mocked(seriesApi.search).mockResolvedValueOnce([
      { id: '1', title: 'Dark', status: 'COMPLETED', personalRating: 9, imdbRating: 8.8, tmdbRating: 8.4, ... },
    ])
    render(<KeywordDetailModal keyword="time travel" onClose={vi.fn()} />)
    expect(await screen.findByText('8.6')).toBeInTheDocument() // (8.8 + 8.4) / 2, 1dp
  })
})
```
**Test Case (Green)**: implement the modal mirroring `KeywordRecommendationsModal`'s existing
fetch/loading/error/Retry structure, mapping each result through the new `blendedRating` utility.

---

### FRONTEND-136-AC-07 [AUTO]
**Statement**: `KeywordDetailModal`'s table columns (Name, Status, Personal Rating, Blended Rating)
shall each be sortable by clicking their header, re-ordering the already-fetched rows client-side (no
re-fetch); clicking the same header again shall reverse the current direction.

**References**: `components/NameStatsTable.tsx`'s `<th onClick={...}>`/sort-indicator styling, as the
visual pattern to match (not its fetch-driven `useNameStatsFilters` hook).

**Test Case (Red)**:
```tsx
describe('FRONTEND-136-AC-07: client-side column sort', () => {
  it('sorts rows by personal rating on header click, without re-fetching', async () => {
    render(<KeywordDetailModal keyword="time travel" onClose={vi.fn()} />)
    await screen.findByRole('table')

    fireEvent.click(screen.getByRole('columnheader', { name: /Personal Rating/i }))
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('Dark')).toBeInTheDocument() // highest personalRating first
    expect(seriesApi.search).toHaveBeenCalledTimes(1) // sorting never re-fetches
  })
})
```
**Test Case (Green)**: add local sort state and a derived sorted array driving row order.

---

### FRONTEND-136-AC-08 [AUTO]
**Statement**: Clicking a series row (outside any interactive control within it) shall navigate to
that series' existing detail route (`/my-series/view/:id`).

**References**: `components/SeriesList.tsx` (existing row-click-to-detail behavior, the pattern to
match); `App.tsx` (`/my-series/view/:id` route).

**Test Case (Red)**:
```tsx
describe('FRONTEND-136-AC-08: row click navigates to SeriesDetail', () => {
  it('navigates to the clicked series\' detail route', () => {
    render(<KeywordDetailModal keyword="time travel" onClose={vi.fn()} />, { wrapper: RouterWrapper })
    fireEvent.click(screen.getByText('Dark'))
    expect(mockNavigate).toHaveBeenCalledWith('/my-series/view/1')
  })
})
```
**Test Case (Green)**: add `useNavigate` and an `onClick` on each row targeting that series' id.

---

### FRONTEND-136-AC-09 [AUTO]
**Statement**: `KeywordDetailModal` shall render a favourite toggle for the seeded keyword itself
(star, filled when favourited), reading and writing the same `keywordFavourites` `localStorage` key
`frontend_spec_133` already established.

**References**: `hooks/useLocalStorage.ts`; `components/SettingsPage.tsx`'s `keywordFavourites`
write (the key this spec's toggle also writes).

**Test Case (Red)**:
```tsx
describe('FRONTEND-136-AC-09: favourite toggle inside the modal', () => {
  it('adds the keyword to keywordFavourites when toggled on', () => {
    render(<KeywordDetailModal keyword="time travel" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /favourite/i }))
    expect(JSON.parse(localStorage.getItem('keywordFavourites')!)).toContain('time travel')
  })

  it('removes it when toggled off, reflecting an already-favourited keyword on mount', () => {
    localStorage.setItem('keywordFavourites', JSON.stringify(['time travel']))
    render(<KeywordDetailModal keyword="time travel" onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /favourite/i })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /favourite/i }))
    expect(JSON.parse(localStorage.getItem('keywordFavourites')!)).not.toContain('time travel')
  })
})
```
**Test Case (Green)**: add the toggle button bound to `useLocalStorage('keywordFavourites', [], ...)`,
adding/removing the seeded `keyword`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `keywordFavourites` `localStorage` key, reused as-is (read in Req 1, read+write in Req 2) | `frontend_spec_133_keyword_suggestions_and_analysis_recommendations_link.md` |
| Fetch/loading/error/Retry modal shape copied for the new modal | `components/KeywordRecommendationsModal.tsx` (`frontend_spec_133`) |
| Star icon reused, no new asset | `components/SettingsIcons.tsx`'s `FavouritesIcon` |
| Backend formula the new client-side `blendedRating` utility must stay consistent with | `RatingBlendUtil.blendedRating` (`series_spec_047`) |
| Existing endpoint reused as-is for "any status" series-by-keyword, no backend change | `GET /api/v1/series/search` (`keyword` param) |
| Row-click-to-detail pattern matched | `components/SeriesList.tsx`; `/my-series/view/:id` route in `App.tsx` |
| Optional-prop scoping pattern (Keywords only, Genre/Country unaffected) matched | `NameStatsTable.tsx`'s existing `onGetRecommendations` (`frontend_spec_133`) |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-136-AC-01: `NameStatsTable` renders a favourite star per row via optional `favouriteNames` prop
- [ ] FRONTEND-136-AC-02: `KeywordsView` wires `favouriteNames` from `keywordFavourites`; Genre/Country do not
- [ ] FRONTEND-136-AC-03: "Favourites Only" client-side filter checkbox, no re-fetch
- [ ] FRONTEND-136-AC-04: `NameStatsTable`'s name cell becomes clickable via optional `onOpenDetail` prop
- [ ] FRONTEND-136-AC-05: `KeywordsView` wires the click-through to open `KeywordDetailModal`; Genre/Country do not
- [ ] FRONTEND-136-AC-06: `KeywordDetailModal` fetches all-status series on mount, computes blended rating client-side
- [ ] FRONTEND-136-AC-07: modal's columns sort client-side by header click, no re-fetch
- [ ] FRONTEND-136-AC-08: clicking a series row navigates to its existing detail route
- [ ] FRONTEND-136-AC-09: modal renders a favourite toggle reading/writing `keywordFavourites`
