# Frontend Spec 024: Keyword Tracking (Display, Stats View, Filter)

**Status**: Implemented (Requirements 1–7). **Amendment (2026-08-23, Requirements 6–7)**: restyles `SeriesDetail`'s keyword chips onto their own full-width row (Requirement 6), and redesigns `SearchFilter`'s keyword picker as a collapsible, height-bounded control so a large keyword vocabulary no longer pushes page content down (Requirement 7). Files touched: `frontend/src/components/SeriesDetail.tsx`, `frontend/src/components/SeriesDetail.module.css`, `frontend/src/components/SeriesDetail.test.tsx`, `frontend/src/components/SearchFilter.tsx`, `frontend/src/components/SearchFilter.module.css`, `frontend/src/components/SearchFilter.test.tsx`, `frontend/src/App.test.tsx` (disambiguated the top-level `Keywords` nav toggle from `SearchFilter`'s new same-named disclosure toggle via `pressed: false` in `getByRole`, a pre-existing test that broke under the new control — no `App.tsx` source change). `AC-19`/`AC-21` (real-browser visual checks) are reasoned through the CSS (a `grid-column: 1 / -1` child in a `grid-template-columns: repeat(auto-fit, minmax(...))` parent spans the full row; `max-height` + `overflow-y: auto` bounds the picker) but not confirmed with an actual browser pass in this session — no browser automation tool was available; a human should still do the real-browser check `.claude/skills/verify/SKILL.md`/root `CLAUDE.md` call for before treating this as fully done. **Superseded (2026-08-24)**: Requirement 7's collapsible checkbox list (`FRONTEND-024-AC-20`–`AC-24`) was replaced by `frontend_spec_029_searchable_keyword_picker.md` Requirement 3, which swaps `SearchFilter`'s Keywords field to the shared `KeywordPicker` component in vocabulary-constrained (type-to-filter, click-to-add) mode, plus Requirement 4's new "Browse all keywords" modal for browsing the full tracked vocabulary. This section is left as-is for history; `frontend_spec_029` is the current source of truth for this field's contract.
**Depends on**: Series Spec 019 (`series_spec_019_keyword_tracking.md`, `GET /series/keywords`, `SeriesSearchCriteria.keywords`, Requirement 6's `tmdbId` round-trip) ✅, Frontend Spec 005 (`SeriesDetail`) ✅, Frontend Spec 006 (`SearchFilter`) ✅, Frontend Spec 018 (`tags` display precedent) ✅, Frontend Spec 022 (`AddSeriesForm` hidden-field round-trip pattern) ✅
**Frontend Stage**: 24 of N

## Overview

Surfaces Series Spec 019's normalized TMDB keyword tracking: read-only keyword chips on `SeriesDetail`, a new modest "Keywords" stats view (a sortable table of keyword × how many tracked series carry it × their average personal rating — e.g. "spy — 4 series — avg. 4.2"), and a `SearchFilter` keyword filter. Unlike the existing free-text `Genres`/`Tags` inputs, the keyword filter is a **fixed-vocabulary multi-select sourced from the backend** (`GET /series/keywords`), following the same rationale already established for the genre-vocabulary fix (`series_spec_010`/`frontend_spec_014`): TMDB keyword names are a real, spelling-stable vocabulary, so a free-text input would only reintroduce the same silent-typo-mismatch risk that fix eliminated for genres.

**Design decisions**:
- **The Keywords stats view is a plain sortable table, not a chart.** This is a first pass at making the aggregate data visible at all — matches the project's general "small, self-contained" sizing for a first cut, per the companion backend spec's own explicit scope boundary (no recommendation/filter weighting yet).
- **`SeriesDetail`'s keyword chips are read-only display only — no per-series keyword editing.** Keywords are entirely TMDB-sourced and synced on create/refresh (`series_spec_019`); there is no user-authored keyword concept the way there is for `tags`, so no form integration is added to `Add`/`EditSeriesForm`.
- **The `SearchFilter` keyword control is a multi-select populated from `GET /series/keywords`, not a free-text input**, mirroring `frontend_spec_014`'s genre checkbox-list fix rather than the free-text pattern `SearchFilter`'s own `genres`/existing fields still use — see Design Decisions on the companion backend spec for why this one field deliberately doesn't match those siblings.
- **The Keywords view is reachable via the same top-level nav toggle pattern `App.tsx` already uses for Recommendations** (`frontend_spec_010`) — a third top-level view alongside the series list and Recommendations, not nested inside either.

---

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the keyword stats shape and series-level keyword data typed centrally, so every consuming component shares one contract.

#### Acceptance Criteria

- **FRONTEND-024-AC-01** [AUTO]: `src/types/series.ts` shall gain a `KeywordStat` interface: `name: string`, `seriesCount: number`, `averagePersonalRating: number | null`.
- **FRONTEND-024-AC-02** [AUTO]: `Series` shall gain a `keywords: string[]` field (names only — the flattened `KeywordEntity.name` values for that series; empty array, never omitted, when a series has none).
- **FRONTEND-024-AC-03** [AUTO]: `SearchCriteria` shall gain a `keywords?: string[]` field, following the exact convention `genres?: string[]` already uses on the same interface.
- **FRONTEND-024-AC-04** [AUTO]: `seriesApi` shall gain `getKeywordStats: (sortBy?: 'seriesCount' | 'averagePersonalRating') => Promise<KeywordStat[]>`, calling `GET /series/keywords` (with `sortBy` as a query param when provided) and unwrapping the `{ data, count }` envelope, following the exact pattern `getGenreOptions` already uses for its own single-array-fetch shape.
- **FRONTEND-024-AC-05** [AUTO]: `buildSearchParams` (the shared helper already used by both `search` and `export`) shall include `params.keyword = criteria.keywords` (repeatable param, mirroring `params.genre = criteria.genres`'s exact existing line) when `criteria.keywords?.length` is truthy.

**Implementation note (backend gap closed as part of this spec)**: at the start of this spec's implementation, `SeriesDto` did not serialize a series' own keyword names — `SeriesEntity.keywords` (the `series_spec_019` `@ManyToMany` relation) existed, but `SeriesService.entityToDto` never read it, so `FRONTEND-024-AC-02` had no real backend data to carry. Closed by adding `SeriesDto.keywords: List<String>` (output-only, alphabetically sorted, empty list not null) and populating it in `entityToDto`. This also required changing `SeriesEntity.keywords` from `FetchType.LAZY` to `FetchType.EAGER` — `entityToDto` now reads this collection on every read path (`getById`/`getAll`/`create`/`update`), and `KeywordStatsService` already loads every series' full keyword set into memory regardless (its own javadoc's "fine at this app's scale" precedent), so this doesn't introduce a new class of cost. Covered by two new `SeriesServiceSpec` cases (`FRONTEND-024-AC-02`). See `backend/src/main/java/uk/co/stefirby/seriestracker/dto/SeriesDto.java`, `SeriesService.java`, `model/SeriesEntity.java`.

---

### Requirement 2: `SeriesDetail` — Keyword Chips

**User story**: As a user viewing a series' full record, I want to see its TMDB keywords, so I can see at a glance what it's actually about beyond its broad genre.

#### Acceptance Criteria

- **FRONTEND-024-AC-06** [AUTO]: `SeriesDetail` shall render a new `Keywords` `<dl>` entry (`<div className={styles.field}><dt>Keywords</dt><dd>...</dd></div>`), positioned immediately after the existing `Tags` entry (`frontend_spec_018`), within the existing `<dl className={styles.fields}>` list.
- **FRONTEND-024-AC-07** [AUTO]: When `series.keywords` is non-empty, the entry's `<dd>` shall render each keyword as a small read-only chip/pill element (comma-adjacent inline `<span>` elements are acceptable — no new interaction, just visual separation from a single unstructured string, since unlike `tags`/`genres` this is a real array rather than a delimited string). When empty, it shall render `—`, matching `formatValue`'s existing null-dash convention used by every sibling field on this component.

---

### Requirement 3: Keywords Stats View

**User story**: As a user, I want to see which keywords show up most across my tracked series and how I've rated shows carrying each one, so I can spot patterns in what I actually enjoy.

#### Acceptance Criteria

- **FRONTEND-024-AC-08** [AUTO]: A new `KeywordsView` component shall fetch and render `seriesApi.getKeywordStats()` results in a table with columns `Keyword`, `Series Count`, `Avg. Personal Rating` (rendering `—` for a `null` average, matching this app's established null-dash convention).
- **FRONTEND-024-AC-09** [AUTO]: The table's column headers (`Series Count`, `Avg. Personal Rating`) shall be clickable, re-fetching via `seriesApi.getKeywordStats(sortBy)` with the corresponding `sortBy` value — following the same "control re-fetches with the current param" pattern already established for `SeriesList`'s sort control (`frontend_spec_013` FRONTEND-013-AC-13).
- **FRONTEND-024-AC-10** [AUTO]: `App.tsx` shall gain a third top-level nav toggle, `Keywords`, alongside the existing series-list/Recommendations toggle (`frontend_spec_010`), rendering `KeywordsView` when active.
- **FRONTEND-024-AC-11** [AUTO]: While the fetch is in flight, `KeywordsView` shall display a loading state (`role="status"`), matching `SeriesList`/`RecommendationsList`'s existing loading-state convention. If the fetch rejects, it shall display an error message (`role="alert"`), matching those same components' existing error-state convention.

---

### Requirement 4: `SearchFilter` — Keyword Filter

**User story**: As a user, I want to filter my series list down to ones carrying a specific keyword, the same way I can already filter by genre or status.

#### Acceptance Criteria

- **FRONTEND-024-AC-12** [AUTO]: `SearchFilter` shall fetch `GET /series/keywords` (via `seriesApi.getKeywordStats()`) on mount and render its `name` values as a multi-select control (checkbox list, following `frontend_spec_014`'s genre-checkbox-list precedent exactly, rather than `SearchFilter`'s own free-text `genres` input's shape).
- **FRONTEND-024-AC-13** [AUTO]: Selected keyword names shall be included in the criteria object built on Search as `criteria.keywords: string[]`, omitted (not sent as an empty array) when nothing is selected — following the same omit-when-empty convention `genres` already uses in the same component.
- **FRONTEND-024-AC-14** [AUTO]: If the `GET /series/keywords` fetch fails, the keyword filter section shall render a scoped inline error and simply show no checkboxes, without blocking the rest of `SearchFilter` from rendering or functioning — same degrade-gracefully posture as `frontend_spec_014`'s genre checkbox list on a failed `getGenreOptions` call.

---

### Requirement 5: `tmdbId` Carried Through for Creation-Time Keyword Population

**User story**: As a user, I want a series I just added to already have its keywords populated, not just after I later hit Refresh, since TMDB's keyword data was available the whole time via the same `tmdbId` I already picked in the candidate picker.

Implemented ahead of Requirements 1-4 (display) — this is prerequisite plumbing, not display, added to close a gap in `series_spec_019_keyword_tracking.md` discovered after that spec's initial implementation: `resolveTmdbCandidate` already has the `tmdbId` it needs in scope (it's the method's own parameter), but nothing carried that value from the lookup response, through the add-series form, to the eventual create request — so a freshly-created series got no keywords until its first refresh. This requirement closes that round-trip using the exact hidden-field pattern already established for `imdbId`/`originCountry`/`tmdbRating`/`tmdbVoteCount` (`frontend_spec_022`/`frontend_spec_026`) — no new mechanism, just one more field carried the same way. It's numbered last (not folded into Requirement 1) specifically so it doesn't collide with or renumber `FRONTEND-024-AC-01` through `AC-14` above, which predate it.

#### Acceptance Criteria

- **FRONTEND-024-AC-15** [AUTO]: `src/types/series.ts`'s `SeriesLookupResult` interface shall gain `tmdbId?: number`.
- **FRONTEND-024-AC-16** [AUTO]: `CreateSeriesRequest` shall gain `tmdbId?: number`.
- **FRONTEND-024-AC-17** [AUTO]: `AddSeriesForm`'s `FormState` shall carry `tmdbId` the same way it already carries `imdbId`: populated by `applyLookupResult` from a resolved `SeriesLookupResult`, included in `buildPayload`'s `CreateSeriesRequest` whenever present, never rendered as a visible input.

---

### Requirement 6: `SeriesDetail` — Full-Row Keyword Layout

**User story**: As a user, I want a series' keyword chips to have their own full-width row on the detail view, so a longer list of chips isn't squeezed into the same narrow column as a two-word field like "Year".

**Design decision**: `SeriesDetail`'s `<dl className={styles.fields}>` is a CSS grid (`grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`, `SeriesDetail.module.css`), so every `.field` entry — including `Keywords` (Requirement 2 above) — currently shares one grid cell like any other two-line label/value pair. A variable-length, wrapping list of chips reads poorly constrained to a single ~200px-minimum column; spanning the entry across the full grid width (`grid-column: 1 / -1`) gives it room to wrap naturally regardless of how many keywords a series carries.

#### Acceptance Criteria

- **FRONTEND-024-AC-18** [AUTO]: The `Keywords` `<dl>` entry (`FRONTEND-024-AC-06`) shall render with a distinct class (e.g. `styles.keywordsField`) applied alongside the existing `styles.field` class, so it can be targeted independently in CSS without changing any other field's markup.
- **FRONTEND-024-AC-19** [MANUAL]: `SeriesDetail.module.css`'s `.keywordsField` rule shall set `grid-column: 1 / -1`, so the Keywords entry visually spans the full width of the `.fields` grid instead of sharing a column with a neighboring field, and its chips (`.keywordChip`, unchanged) wrap cleanly across that full width without overlapping or truncating. Verified by a visual check in a real browser, in both light and dark `prefers-color-scheme` — jsdom doesn't render CSS, so no Vitest assertion can confirm actual grid placement (per this project's "Vitest/jsdom can't validate real CSS rendering" convention, root `CLAUDE.md`).

---

### Requirement 7: `SearchFilter` — Collapsible, Bounded Keyword Picker

**User story**: As a user filtering my series list, I want the keyword picker to stay out of the way until I open it, so a large keyword vocabulary doesn't push the Status/rating/other filter fields down the page just by existing.

**Design decision**: `SearchFilter.tsx`'s keyword field (`FRONTEND-024-AC-12`) currently renders every keyword from `getKeywordStats()` as an always-visible, unconstrained flex-wrap list (`.keywordPicker`, `SearchFilter.module.css`) — with enough tracked series this can be dozens of checkboxes, each pushing the rest of the form (and the list below it) further down the page. `RecommendationControls.tsx` already solved an analogous problem for its own "Filters" section with a collapsed-by-default disclosure (`filtersOpen` state, `aria-expanded` toggle button, `FRONTEND-011-AC-07`) — this requirement applies the same pattern to `SearchFilter`'s keyword picker specifically, plus a `max-height`/`overflow-y: auto` scroll boundary for when the list is open, so an open picker has a bounded footprint even with a very large vocabulary.

#### Acceptance Criteria

- **FRONTEND-024-AC-20** [AUTO]: `SearchFilter`'s keyword field shall render a disclosure toggle button (`aria-expanded`, mirroring `RecommendationControls`' `styles.filtersToggle` pattern) that shows/hides the keyword checkbox list; the list shall be collapsed (hidden) by default on mount.
- **FRONTEND-024-AC-21** [AUTO]: When expanded, the keyword checkbox list (`.keywordPicker`) shall render inside a container with a bounded `max-height` and `overflow-y: auto` (CSS, verified by a `[MANUAL]` browser check per `FRONTEND-024-AC-19`'s convention) rather than growing unbounded with the number of keywords, so opening it can never itself push page content down by more than that fixed height.
- **FRONTEND-024-AC-22** [AUTO]: When the picker is collapsed and at least one keyword is currently selected, the toggle button's label shall include the selected count (e.g. "Keywords (3 selected)"), so a collapsed-but-active filter is never silently invisible to the user. When collapsed with nothing selected, the label shall read plain "Keywords".
- **FRONTEND-024-AC-23** [AUTO]: Toggling the disclosure shall not clear `form.keywordsSelected` — collapsing the list after selecting keywords keeps those selections intact (verified by re-expanding and finding them still checked).
- **FRONTEND-024-AC-24** [AUTO]: The existing degrade-gracefully behavior on a failed `getKeywordStats()` fetch (`FRONTEND-024-AC-14`) is unchanged by this requirement — the scoped error still renders regardless of the disclosure's open/closed state.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `GET /series/keywords`, `KeywordStatDto` shape, `SeriesSearchCriteria.keywords`, exact-match keyword filter semantics | `series_spec_019_keyword_tracking.md` |
| Collapsed-by-default disclosure pattern (`filtersOpen`, `aria-expanded` toggle) this spec's Requirement 7 mirrors | `frontend_spec_011_recommendation_controls.md` (`FRONTEND-011-AC-07`) |
| `SeriesDetail`'s `.fields` CSS grid (`grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`) that Requirement 6's full-row span applies against | `frontend_spec_005_series_detail.md`, `SeriesDetail.module.css` |
| "Vitest/jsdom can't validate real CSS rendering" — real-browser verification requirement for layout-only ACs | Root `CLAUDE.md` (user's global instructions) |
| `formatValue` null-dash convention, `<dl className={styles.fields}>` structure, existing field ordering (`Tags` entry this spec's `Keywords` entry is positioned after) | `frontend_spec_005_series_detail.md`, `frontend_spec_018_tags.md` |
| Genre checkbox-list precedent this spec's `SearchFilter` keyword control and its failure-handling both mirror | `series_spec_010_genre_dropdown.md`, `frontend_spec_014_genre_dropdown.md` |
| `SeriesList` sort-control re-fetch-on-change pattern this spec's `KeywordsView` column-sort mirrors | `frontend_spec_013_star_ratings.md` |
| Top-level nav toggle pattern (`App.tsx`) this spec's `Keywords` view addition follows | `frontend_spec_010_recommendations.md` |
| `buildSearchParams`, `getGenreOptions`, `{ data, count }` envelope-unwrapping convention | `frontend_spec_001.md`, `seriesApi.ts` |
| `SeriesLookupDto.tmdbId`/`SeriesDto.tmdbId`, `SeriesService.create`'s conditional `KeywordSyncService.syncKeywords` call (Requirement 5's backend counterpart) | `series_spec_019_keyword_tracking.md` Requirement 6 |
| `imdbId`/`originCountry`/`tmdbRating` hidden-field round-trip pattern Requirement 5's `tmdbId` field mirrors | `frontend_spec_022_tmdb_primary_lookup.md`, `frontend_spec_026_origin_country_and_tmdb_metadata_display.md` |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (additions)

```typescript
describe('FRONTEND-024-AC-04: getKeywordStats', () => {
  it('fetches /series/keywords and unwraps the envelope', async () => {
    client.get.mockResolvedValue({
      data: { data: [{ name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 }], count: 1 },
    })

    const result = await seriesApi.getKeywordStats()

    expect(client.get).toHaveBeenCalledWith('/series/keywords', { params: {} })
    expect(result).toEqual([{ name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 }])
  })

  it('passes sortBy as a query param when provided', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })

    await seriesApi.getKeywordStats('averagePersonalRating')

    expect(client.get).toHaveBeenCalledWith('/series/keywords', {
      params: { sortBy: 'averagePersonalRating' },
    })
  })
})
```

### `src/components/SeriesDetail.test.tsx` (additions)

```typescript
describe('FRONTEND-024-AC-06/07: Keywords entry rendered', () => {
  it('renders each keyword as a chip', async () => {
    mockGetById.mockResolvedValue(makeSeries({ keywords: ['spy', 'mi5'] }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('Keywords')).toBeInTheDocument()
    expect(screen.getByText('spy')).toBeInTheDocument()
    expect(screen.getByText('mi5')).toBeInTheDocument()
  })

  it('renders a dash when there are no keywords', async () => {
    mockGetById.mockResolvedValue(makeSeries({ keywords: [] }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText('Keywords')
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
```

### `src/components/KeywordsView.test.tsx` (new file)

```typescript
describe('FRONTEND-024-AC-08: renders keyword stats table', () => {
  it('renders a row per keyword', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
      { name: 'period drama', seriesCount: 2, averagePersonalRating: null },
    ])
    render(<KeywordsView />)

    expect(await screen.findByText('spy')).toBeInTheDocument()
    expect(screen.getByText('4.2')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('FRONTEND-024-AC-09: sortable column headers re-fetch with sortBy', () => {
  it('re-fetches with sortBy=averagePersonalRating on header click', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalledWith(undefined))

    fireEvent.click(screen.getByRole('columnheader', { name: /avg\. personal rating/i }))

    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith('averagePersonalRating'),
    )
  })
})

describe('FRONTEND-024-AC-11: loading and error states', () => {
  it('shows a loading state while the fetch is in flight', () => {
    mockGetKeywordStats.mockReturnValue(new Promise(() => {}))
    render(<KeywordsView />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error alert when the fetch rejects', async () => {
    mockGetKeywordStats.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<KeywordsView />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
```

### `src/components/SearchFilter.test.tsx` (additions)

```typescript
describe('FRONTEND-024-AC-12/13: keyword checkbox filter', () => {
  it('includes selected keywords in criteria, omits when none selected', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    const onSearch = vi.fn()
    render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)

    await screen.findByLabelText('spy')
    fireEvent.click(screen.getByLabelText('spy'))
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: ['spy'] }))
  })
})

describe('FRONTEND-024-AC-14: keyword fetch failure degrades gracefully', () => {
  it('renders the rest of SearchFilter when getKeywordStats rejects', async () => {
    mockGetKeywordStats.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })
})
```

### `src/components/AddSeriesForm.test.tsx` (additions, Requirement 5)

```typescript
describe('FRONTEND-024-AC-17: tmdbId carried through to the create payload', () => {
  it('includes tmdbId after a resolved lookup', async () => {
    vi.mocked(seriesApi.searchTmdb).mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
    ])
    vi.mocked(seriesApi.resolveTmdbCandidate).mockResolvedValue({
      title: 'Spooks',
      tmdbId: 4046,
    })
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Spooks' } })
    fireEvent.click(screen.getByRole('button', { name: /look up/i }))
    await screen.findByDisplayValue('Spooks')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(seriesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ tmdbId: 4046 }),
      ),
    )
  })

  it('omits tmdbId when no lookup was performed', async () => {
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Homemade Show' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(seriesApi.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ tmdbId: expect.anything() }),
      ),
    )
  })
})
```

### `src/components/SeriesDetail.test.tsx` (addition, Requirement 6)

```typescript
describe('FRONTEND-024-AC-18: keywords field carries a distinct class', () => {
  it('applies the keywordsField class alongside field on the Keywords entry', async () => {
    mockGetById.mockResolvedValue(makeSeries({ keywords: ['spy'] }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    const dt = await screen.findByText('Keywords')
    expect(dt.parentElement).toHaveClass('keywordsField')
  })
})
```

### `src/components/SearchFilter.test.tsx` (additions, Requirement 7)

```typescript
describe('FRONTEND-024-AC-20/21: keyword picker collapsed by default, expands on click', () => {
  it('hides the checkbox list until the toggle is clicked', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)

    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    expect(screen.queryByLabelText('spy')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^keywords$/i }))
    expect(await screen.findByLabelText('spy')).toBeInTheDocument()
  })
})

describe('FRONTEND-024-AC-22/23: selected count shown collapsed, selections survive collapse', () => {
  it('shows a selected count on the collapsed toggle and keeps selections after re-collapsing', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^keywords$/i }))
    fireEvent.click(await screen.findByLabelText('spy'))
    fireEvent.click(screen.getByRole('button', { name: /keywords/i }))

    expect(
      screen.getByRole('button', { name: /keywords \(1 selected\)/i }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /keywords \(1 selected\)/i }))
    expect(screen.getByLabelText('spy')).toBeChecked()
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-024-AC-01: `KeywordStat` type
- [x] FRONTEND-024-AC-02: `Series.keywords: string[]`
- [x] FRONTEND-024-AC-03: `SearchCriteria.keywords?: string[]`
- [x] FRONTEND-024-AC-04: `seriesApi.getKeywordStats(sortBy?)`
- [x] FRONTEND-024-AC-05: `buildSearchParams` includes `keyword` when present
- [x] FRONTEND-024-AC-06: `SeriesDetail` Keywords `<dl>` entry, positioned after Tags
- [x] FRONTEND-024-AC-07: keyword chips rendered; dash when empty
- [x] FRONTEND-024-AC-08: `KeywordsView` table (keyword / count / avg rating)
- [x] FRONTEND-024-AC-09: sortable column headers re-fetch with `sortBy`
- [x] FRONTEND-024-AC-10: `App.tsx` gains a `Keywords` nav toggle
- [x] FRONTEND-024-AC-11: loading/error states on `KeywordsView`
- [x] FRONTEND-024-AC-12: `SearchFilter` keyword checkbox list, sourced from the backend
- [x] FRONTEND-024-AC-13: selected keywords included in criteria, omitted when none
- [x] FRONTEND-024-AC-14: keyword-fetch failure degrades gracefully, scoped error only
- [x] FRONTEND-024-AC-15: `SeriesLookupResult` gains `tmdbId`
- [x] FRONTEND-024-AC-16: `CreateSeriesRequest` gains `tmdbId`
- [x] FRONTEND-024-AC-17: `AddSeriesForm` carries `tmdbId` through to the create payload
- [x] FRONTEND-024-AC-18: Keywords `<dl>` entry carries a distinct `keywordsField` class
- [x] FRONTEND-024-AC-19: `.keywordsField` spans the full grid row (visual check — CSS reasoned through, real-browser pass still pending; see header note)
- [x] FRONTEND-024-AC-20: keyword picker collapsed by default behind a toggle
- [x] FRONTEND-024-AC-21: expanded list is height-bounded and scrollable (visual check — CSS reasoned through, real-browser pass still pending; see header note)
- [x] FRONTEND-024-AC-22: collapsed toggle label shows selected count
- [x] FRONTEND-024-AC-23: collapsing the picker doesn't clear selections
- [x] FRONTEND-024-AC-24: failed keyword fetch still degrades gracefully regardless of open/closed state
