# Frontend Spec 081: "Use My Series" Page Restructure

**Status**: Implemented — `components/UseMySeriesPanel.tsx`, `components/UseMySeriesPanel.test.tsx`, `components/RecommendationControls.tsx`, `components/RecommendationControls.test.tsx`, `components/RecommendationFiltersBox.tsx`, `components/RecommendationFiltersBox.test.tsx`
**Priority**: P2
**Depends on**: Series Spec 045 (`series_spec_045_retire_min_source_rating.md`) ✅ required, Frontend Spec 080 (`frontend_spec_080_remove_min_source_rating_ui.md`) ✅ required — both already shipped; this spec builds the replacement UI they made room for. Also implements Frontend Spec 064's Requirement 2 (`frontend_spec_064_sort_direction_defaults.md`, AC-04/AC-05) and Frontend Spec 065 in full (`frontend_spec_065_recommendation_controls_relabel.md`) as part of the same touch of this code — see Requirements 8/10.
**Area**: Frontend (`components/UseMySeriesPanel.tsx`, `components/RecommendationControls.tsx`, `components/HighestRatedPanel.tsx`, `components/RecommendationFiltersBox.tsx`, `components/RecommendationControls.module.css`)

## Overview

Restructures "Use My Series" mode into five clearly-separated sections, top to bottom: **Filter & sort my series** (new, extended), **Select my series** (unchanged), **Post TMDB filtering** (unchanged, repositioned), **Sort filtered recs** (unchanged, repositioned), **Apply/Get Recommendations** (unchanged). The genre/status/sort row that already exists in `UseMySeriesPanel` — confirmed 100% client-side, only narrowing what's selectable in the series picker, never reaching the backend — gets wrapped in a proper disclosure box and extended with five new client-side-only fields (Keywords, Min Personal Rating, Min IMDb Rating, Min TMDB Rating, Year Min/Max), replacing the personal-rating gate `series_spec_045`/`frontend_spec_080` just retired from the backend with a purely local equivalent that can never silently drop an explicit pick.

This is a pure frontend restructure — no backend changes, no new API calls, no new `RecommendationCriteria`/`RecommendationQuery` fields. Every new field operates on `Series` data already fetched for this panel (`allSeries`, already carrying `genres`, `keywords`, `imdbRating`, `tmdbRating`, `year`, `personalRating`).

## Design Decisions

- **Every new Section 1 field is local `useState` inside `UseMySeriesPanel`, exactly like the five that already exist there** (`specificSeriesGenreFilter`, `specificSeriesExcludeGenreFilter`, `specificSeriesStatusFilter`, `specificSeriesSortBy`, `specificSeriesSortDirection`) — never part of `ControlsState`, never reaching `buildQuery`/the backend. This is the same scope call `frontend_spec_040`'s Design Decisions already made for the original five fields, just extended to the new ones.
- **`buildSpecificSeriesCandidatePool`'s signature changes from 7 positional parameters to a single `SpecificSeriesFilters` options object** (plus `allSeries` and `selectedSeriesIds`, which stay separate since they're not filter criteria). Seven positional string/array/enum arguments was already borderline before this spec; adding six more (13 total) would make every call site unreadable and error-prone to get in the right order. This is a mechanical refactor of an existing function's call shape, not a new abstraction — both existing call sites (`UseMySeriesPanel`'s inline picker and its "Show all series" modal both go through the one `specificSeriesCandidatePool` computation already, so there's actually only one call site to update).
- **New filter predicates follow the exact shape of the three that already exist** (`filterSpecificSeriesByGenre`, `filterSpecificSeriesByExcludeGenre`, `filterSpecificSeriesByStatus` in `RecommendationControls.tsx`) — plain, non-exported, single-purpose functions chained together, not a generic predicate-builder abstraction.
- **Keyword matching is exact-token, case-insensitive** (a series matches if any of its `keywords` array entries case-insensitively equals any selected filter keyword) — mirrors the existing client-side genre filter's deliberate exact-match choice (`FRONTEND-069`'s comment: "deliberately not the backend's substring match... since it's extending an already-established client-side function"), not the backend's `KeywordPicker`/`SeriesSearchService` substring behavior.
- **Rating/year filters exclude a `null` value when their threshold is actively set** — matches this app's established convention everywhere else a rating/year range filter exists (`SeriesSearchService`'s `matchesPersonalRating`/`matchesImdbRating`/`matchesTmdbRating`/`matchesYearRange`): a series with no rating/year data doesn't pass a threshold check that's actually in effect, but is unaffected when the field is left blank.
- **Naming-collision suffixes**: "Min TMDB Rating (My Series)" and "Year Min (My Series)"/"Year Max (My Series)" for the two Section 1 fields that would otherwise share a label with `RecommendationFiltersBox`'s existing (unchanged, unsuffixed) post-TMDB fields of the same name.
- **The existing "any selected series survives the filter" union-back-in behavior is preserved automatically, not re-implemented** — `buildSpecificSeriesCandidatePool`'s final `missingSelected` step already operates generically on whatever the filter chain excluded, regardless of which predicate did the excluding. Adding more predicates earlier in the chain requires no change to that step.
- **The reorder of `HighestRatedPanel`/`RecommendationFiltersBox` (Requirement 9) is global, not Use-My-Series-specific.** Both components already render in the same shared position for every mode (Use My Series, Custom Search, Trending, Highest Rated) via one unconditional block in `RecommendationControls.tsx` — splitting that block to reorder only for one mode would add real branching complexity for a distinction the user never asked to preserve per-mode. The simpler, more consistent choice is to move the whole shared block, affecting every mode's layout identically.
- **`frontend_spec_064`'s Requirement 2 (picker sort direction defaults) and `frontend_spec_065` in full (relabel) are implemented here**, reusing their already-assigned AC IDs rather than inventing new ones, since both touch exactly the files this spec is already restructuring — see Requirements 8 and 10. `frontend_spec_064`'s Requirement 1 (`SeriesList`'s own sort, an unrelated component/page) is **not** part of this spec and stays separately not-started.

## Requirements

### Requirement 1: "Filter & sort my series" becomes a labelled, disclosure-wrapped section, defaulting open

**User Story**: As a user, I want the picker-narrowing controls grouped under a clear heading, expanded by default so I notice the new filtering capability.

#### FRONTEND-081-AC-01 [AUTO]: disclosure box renders, expanded by default
**Statement**: `UseMySeriesPanel` shall render its filter/sort controls inside a disclosure box headed "Filter & sort my series", expanded (`aria-expanded="true"`) on initial render.

**Rationale**: Core structural change — the existing filter row has no heading or expand/collapse affordance today; this makes it visually and semantically its own section, open by default so the new capability isn't buried.

**References**:
- Component: `components/UseMySeriesPanel.tsx` (`specificSeriesFiltersRow` div, lines 124-224, becomes the disclosure body)

**Test Case (Red)**:
```typescript
describe('FRONTEND-081-AC-01: Filter & sort my series disclosure, open by default', () => {
  it('renders expanded on mount', () => {
    render(<UseMySeriesPanel state={state} updateState={vi.fn()} allSeries={series} genreOptions={['Drama']} keywordOptions={[]} />)
    expect(
      screen.getByRole('button', { name: /filter & sort my series/i }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText(/filter by status/i)).toBeVisible()
  })
})
```

**Test Case (Green)**: add a `const [filterSectionOpen, setFilterSectionOpen] = useState(true)` and a toggle `<button aria-expanded={filterSectionOpen}>Filter & sort my series</button>` wrapping the existing filter row, same collapse/expand pattern as `RecommendationFiltersBox` (`filtersOpen`/`setFiltersOpen`) but seeded `true` instead of `false`.

#### FRONTEND-081-AC-02 [AUTO]: the toggle collapses and re-expands the section
**Statement**: When the "Filter & sort my series" toggle is clicked, `UseMySeriesPanel` shall collapse the section (and clicking again re-expands it).

**Rationale**: It's a real disclosure, not just a static heading — matches `RecommendationFiltersBox`'s existing toggle mechanics.

**Test Case (Red)**:
```typescript
describe('FRONTEND-081-AC-02: toggle collapses/expands the section', () => {
  it('hides and shows the filter controls on click', () => {
    render(<UseMySeriesPanel state={state} updateState={vi.fn()} allSeries={series} genreOptions={['Drama']} keywordOptions={[]} />)
    const toggle = screen.getByRole('button', { name: /filter & sort my series/i })

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(/filter by status/i)).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
```

**Test Case (Green)**: `onClick={() => setFilterSectionOpen((open) => !open)}`, body rendered conditionally on `filterSectionOpen`.

#### FRONTEND-081-AC-03 [AUTO]: existing Genre/Status/Sort controls are unaffected by relocation
**Statement**: The Genre, Status, and Sort controls already present in `UseMySeriesPanel` shall continue to narrow/sort the series picker identically after being moved inside the new disclosure body.

**Rationale**: Regression guard — this is a wrapping change, not a logic change, for these three existing controls.

**Test Case (Red)**: existing `UseMySeriesPanel.test.tsx` coverage for genre/status/sort filtering (from `frontend_spec_035`/`067`/`069`) continues to pass unmodified except for any selector that needs to first assert/rely on the section being expanded (it is, by default, per AC-01) — no new test required beyond confirming the existing suite is green.

**Test Case (Green)**: no logic changes to `specificSeriesGenreFilter`/`specificSeriesExcludeGenreFilter`/`specificSeriesStatusFilter` state or their handlers — only their JSX's wrapping ancestor changes.

### Requirement 2: Keywords filter (new)

**User Story**: As a user, I want to narrow the series picker to ones matching specific keywords, the same way I already can on My Series.

#### FRONTEND-081-AC-04 [AUTO]: Keywords field narrows the candidate pool
**Statement**: `UseMySeriesPanel` shall render a "Keywords" field (mirroring `SearchFilter.tsx`'s own Keywords `KeywordPicker` — free text allowed, options sourced from tracked-keyword stats); when one or more keywords are selected, the series picker's candidate pool shall include only series with at least one matching keyword (case-insensitive, exact match against `Series.keywords`).

**Rationale**: The core new capability — parity with My Series' Keywords filter, applied to the picker.

**References**:
- Component: `components/UseMySeriesPanel.tsx` (new field, alongside the existing Genre picker)
- Pattern to mirror: `components/SearchFilter.tsx`'s Keywords field
- Prop: `UseMySeriesPanelProps` gains `readonly keywordOptions: string[]` (threaded from `RecommendationControls`'s already-fetched `keywordOptions` state, currently only passed to `CustomSearchPanel`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-081-AC-04: Keywords filter narrows the picker', () => {
  it('only offers series matching a selected keyword', async () => {
    const series = [
      makeSeries({ id: '1', title: 'Has Keyword', keywords: ['space opera'] }),
      makeSeries({ id: '2', title: 'No Keyword', keywords: [] }),
    ]
    render(<UseMySeriesPanel state={state} updateState={vi.fn()} allSeries={series} genreOptions={[]} keywordOptions={['space opera']} />)

    await userEvent.type(screen.getByLabelText(/keywords/i), 'space opera')
    await userEvent.click(screen.getByText('space opera'))

    expect(screen.getByText('Has Keyword')).toBeInTheDocument()
    expect(screen.queryByText('No Keyword')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `specificSeriesKeywordsFilter` (`string[]`) local state; add `filterSpecificSeriesByKeywords(series, keywordsFilter)` predicate to `RecommendationControls.tsx`; include it in `buildSpecificSeriesCandidatePool`'s filter chain via the new options object.

### Requirement 3: Min Personal Rating filter (new — replaces the retired `minSourceRating` conceptually, client-side only)

**User Story**: As a user, I want to narrow the picker to series I've rated highly myself, without a rating I set here ever silently excluding a series I explicitly pick.

#### FRONTEND-081-AC-05 [AUTO]: Min Personal Rating field narrows the candidate pool
**Statement**: `UseMySeriesPanel` shall render a "Min Personal Rating" `StarRating` control; when a value is set, the series picker's candidate pool shall include only series with a non-null `personalRating` at or above it.

**Rationale**: The direct client-side successor to the retired `minSourceRating` — same concept, but now purely a picker-narrowing aid that can never drop an explicit pick server-side.

**References**:
- Component: `components/StarRating.tsx` (reused as-is, `value`/`onChange` props)
- Retired backend concept: `series_spec_045_retire_min_source_rating.md`

**Test Case (Red)**:
```typescript
describe('FRONTEND-081-AC-05: Min Personal Rating filter narrows the picker', () => {
  it('only offers series at or above the selected star rating', () => {
    const series = [
      makeSeries({ id: '1', title: 'High Rated', personalRating: 5 }),
      makeSeries({ id: '2', title: 'Low Rated', personalRating: 2 }),
    ]
    render(<UseMySeriesPanel state={state} updateState={vi.fn()} allSeries={series} genreOptions={[]} keywordOptions={[]} />)

    fireEvent.click(screen.getAllByRole('button', { name: /rate 4 stars/i })[0])

    expect(screen.getByText('High Rated')).toBeInTheDocument()
    expect(screen.queryByText('Low Rated')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `specificSeriesMinPersonalRating` (`number | null`) local state; add `filterSpecificSeriesByMinPersonalRating` predicate; wire into the filter chain.

### Requirement 4: Min IMDb Rating filter (new)

**User Story**: As a user, I want to narrow the picker to my series with a decent IMDb rating.

#### FRONTEND-081-AC-06 [AUTO]: Min IMDb Rating field narrows the candidate pool
**Statement**: `UseMySeriesPanel` shall render a "Min IMDb Rating" number input (step 0.1, 0-10); when a value is set, the series picker's candidate pool shall include only series with a non-null `imdbRating` at or above it.

**Rationale**: Parity with My Series' own Min IMDb Rating filter.

**Test Case (Red)**:
```typescript
describe('FRONTEND-081-AC-06: Min IMDb Rating filter narrows the picker', () => {
  it('only offers series at or above the entered IMDb rating', () => {
    const series = [
      makeSeries({ id: '1', title: 'High IMDb', imdbRating: 8.5 }),
      makeSeries({ id: '2', title: 'Low IMDb', imdbRating: 5.0 }),
    ]
    render(<UseMySeriesPanel state={state} updateState={vi.fn()} allSeries={series} genreOptions={[]} keywordOptions={[]} />)

    fireEvent.change(screen.getByLabelText(/min imdb rating/i), { target: { value: '8' } })

    expect(screen.getByText('High IMDb')).toBeInTheDocument()
    expect(screen.queryByText('Low IMDb')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `specificSeriesMinImdbRating` (`string`) local state; add `filterSpecificSeriesByMinImdbRating` predicate; wire in.

### Requirement 5: Min TMDB Rating (My Series) filter (new)

**User Story**: As a user, I want to narrow the picker to my series with a decent TMDB rating, distinct from the separate TMDB-rating filter that applies to fetched recommendations.

#### FRONTEND-081-AC-07 [AUTO]: Min TMDB Rating (My Series) field narrows the candidate pool
**Statement**: `UseMySeriesPanel` shall render a "Min TMDB Rating (My Series)" number input (step 0.1, 0-10); when a value is set, the series picker's candidate pool shall include only series with a non-null `tmdbRating` at or above it.

**Rationale**: Parity with My Series' Min TMDB Rating filter, labelled to avoid collision with `RecommendationFiltersBox`'s existing "Min TMDB Rating" (post-TMDB, unrelated field).

**Test Case (Red)**:
```typescript
describe('FRONTEND-081-AC-07: Min TMDB Rating (My Series) filter narrows the picker', () => {
  it('only offers series at or above the entered TMDB rating', () => {
    const series = [
      makeSeries({ id: '1', title: 'High TMDB', tmdbRating: 8.5 }),
      makeSeries({ id: '2', title: 'Low TMDB', tmdbRating: 5.0 }),
    ]
    render(<UseMySeriesPanel state={state} updateState={vi.fn()} allSeries={series} genreOptions={[]} keywordOptions={[]} />)

    fireEvent.change(screen.getByLabelText(/min tmdb rating \(my series\)/i), { target: { value: '8' } })

    expect(screen.getByText('High TMDB')).toBeInTheDocument()
    expect(screen.queryByText('Low TMDB')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `specificSeriesMinTmdbRating` (`string`) local state; add `filterSpecificSeriesByMinTmdbRating` predicate; wire in. Label text is literally `Min TMDB Rating (My Series)`; `RecommendationFiltersBox`'s existing field keeps its unsuffixed `Min TMDB Rating` label unchanged.

### Requirement 6: Year Min/Max (My Series) filter (new)

**User Story**: As a user, I want to narrow the picker to my series from a particular year range.

#### FRONTEND-081-AC-08 [AUTO]: Year Min/Max (My Series) fields narrow the candidate pool
**Statement**: `UseMySeriesPanel` shall render "Year Min (My Series)"/"Year Max (My Series)" number inputs (bounds from `utils/yearBounds`); when either is set, the series picker's candidate pool shall include only series with a non-null `year` within the given (inclusive) range.

**Rationale**: Parity with My Series' Year Min/Max filter, labelled to avoid collision with `RecommendationFiltersBox`'s existing "Year Min"/"Year Max" (post-TMDB, unrelated fields).

**Test Case (Red)**:
```typescript
describe('FRONTEND-081-AC-08: Year Min/Max (My Series) filters narrow the picker', () => {
  it('only offers series within the entered year range', () => {
    const series = [
      makeSeries({ id: '1', title: 'In Range', year: 2020 }),
      makeSeries({ id: '2', title: 'Out of Range', year: 2005 }),
    ]
    render(<UseMySeriesPanel state={state} updateState={vi.fn()} allSeries={series} genreOptions={[]} keywordOptions={[]} />)

    fireEvent.change(screen.getByLabelText(/year min \(my series\)/i), { target: { value: '2015' } })

    expect(screen.getByText('In Range')).toBeInTheDocument()
    expect(screen.queryByText('Out of Range')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `specificSeriesYearMin`/`specificSeriesYearMax` (`string`) local state; add `filterSpecificSeriesByYearRange` predicate; wire in.

### Requirement 7: Explicitly-selected series always remain visible in the picker regardless of Section 1 filters

**User Story**: As a user, once I've selected a series, I don't want it to disappear from the picker just because I changed a filter afterward.

#### FRONTEND-081-AC-09 [AUTO]: an already-selected series survives every new filter, same as the existing three
**Statement**: `buildSpecificSeriesCandidatePool` shall continue to include any series in `selectedSeriesIds` in its returned pool even when one of the new filters (Keywords, Min Personal/IMDb/TMDB Rating, Year range) would otherwise exclude it — the same guarantee `FRONTEND-035-AC-07`/`FRONTEND-050-AC-03` already provide for the genre/status filters.

**Rationale**: Extends an existing, deliberate regression guard to the new filters, rather than only covering the original three.

**References**:
- Function: `components/RecommendationControls.tsx`, `buildSpecificSeriesCandidatePool`'s `missingSelected` step (lines 580-585) — no change needed to this step itself, only confirmation it still applies once the new predicates run earlier in the same chain.

**Test Case (Red)**:
```typescript
describe('FRONTEND-081-AC-09: selected series survive new filters', () => {
  it('keeps a selected series in the pool even if a new filter would exclude it', () => {
    const series = [makeSeries({ id: '1', title: 'Selected Low IMDb', imdbRating: 2.0 })]
    const stateWithSelection = { ...state, selectedSeriesIds: ['1'] }
    render(<UseMySeriesPanel state={stateWithSelection} updateState={vi.fn()} allSeries={series} genreOptions={[]} keywordOptions={[]} />)

    fireEvent.change(screen.getByLabelText(/min imdb rating/i), { target: { value: '8' } })

    expect(screen.getByText('Selected Low IMDb')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: no new code beyond Requirements 2-6's own filter wiring — this is a regression assertion that the existing `missingSelected` union step, unmodified, still covers the enlarged filter chain.

### Requirement 8: Picker sort direction defaults per newly-selected field (`frontend_spec_064` Requirement 2)

**User Story**: As stated in `frontend_spec_064` — when I pick a new field to sort the picker by, I want a sensible default direction.

#### FRONTEND-064-AC-04 [AUTO]: selecting a non-Title field defaults direction to descending
See `frontend_spec_064_sort_direction_defaults.md` for the full statement/rationale/test case — implemented here verbatim against `UseMySeriesPanel.handleSpecificSeriesSortByChange`, unchanged from that spec's own description.

#### FRONTEND-064-AC-05 [AUTO]: selecting Title defaults direction to ascending
See `frontend_spec_064_sort_direction_defaults.md` for the full statement/rationale/test case — implemented here verbatim.

**Test Case (Green)** (both ACs): `handleSpecificSeriesSortByChange` calls both `setSpecificSeriesSortBy` and `setSpecificSeriesSortDirection(newField === 'title' ? 'asc' : 'desc')`.

### Requirement 9: Page reorder — Sort filtered recs moves below Post TMDB filtering

**User Story**: As a user, I want to see the filters applied to fetched recommendations before I choose how to sort them, matching the order I actually think through the page.

#### FRONTEND-081-AC-10 [AUTO]: `HighestRatedPanel` renders after `RecommendationFiltersBox`
**Statement**: `RecommendationControls` shall render `HighestRatedPanel` (Sort filtered recs) after `RecommendationFiltersBox` (Post TMDB filtering), reversing their current order, for every mode.

**Rationale**: The explicit reorder request — applies globally since both components already render unconditionally in the same shared position across every mode (see Design Decisions).

**References**:
- Component: `components/RecommendationControls.tsx` (current order: `HighestRatedPanel` lines 839-841, `RecommendationFiltersBox` lines 843-848)

**Test Case (Red)**:
```typescript
describe('FRONTEND-081-AC-10: Sort filtered recs renders after Post TMDB filtering', () => {
  it('places the Sort By fieldset after the Filters disclosure in document order', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    const filtersToggle = screen.getByRole('button', { name: /recommendations filters/i })
    const sortByLegend = screen.getByText('Sort By')

    expect(
      filtersToggle.compareDocumentPosition(sortByLegend) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
```

**Test Case (Green)**: swap the two JSX blocks' order in `RecommendationControls.tsx`'s render.

### Requirement 10: Relabel (`frontend_spec_065`, in full)

**User Story**: As stated in `frontend_spec_065` — I want the Filters disclosure and submit button to read clearly in Recommendations' own domain language.

#### FRONTEND-065-AC-01 [AUTO]: renders "Recommendations Filters"
See `frontend_spec_065_recommendation_controls_relabel.md` for the full statement/rationale/test case — implemented here verbatim.

#### FRONTEND-065-AC-02 [AUTO]: renders "Get Recommendations"
See `frontend_spec_065_recommendation_controls_relabel.md` for the full statement/rationale/test case — implemented here verbatim.

#### FRONTEND-065-AC-03 [AUTO]: existing test suite's name matchers are updated, behavior unchanged
See `frontend_spec_065_recommendation_controls_relabel.md` for the full statement/rationale/test case — implemented here verbatim.

**Test Case (Green)** (all three ACs): change `RecommendationFiltersBox`'s toggle text to "Recommendations Filters" and `RecommendationControls`' submit button text to "Get Recommendations"; update `RecommendationControls.test.tsx`'s `/apply filters/i` matchers to `/get recommendations/i`.

## Cross-References

| Concept | Location |
|---|---|
| Retired backend concept Min Personal Rating replaces conceptually | `series_spec_045_retire_min_source_rating.md`, `frontend_spec_080_remove_min_source_rating_ui.md` |
| Existing client-side filter pattern extended | `components/RecommendationControls.tsx` (`filterSpecificSeriesByGenre`/`ByExcludeGenre`/`ByStatus`, `buildSpecificSeriesCandidatePool`) |
| Field-parity source (`SearchFilter`'s own field set) | `frontend_spec_075_my_series_filter_sections.md` |
| Sort direction defaults (Requirement 2 fulfilled here) | `frontend_spec_064_sort_direction_defaults.md` |
| Relabel (fulfilled here in full) | `frontend_spec_065_recommendation_controls_relabel.md` |
| `missingSelected` union-back-in guarantee, extended not re-implemented | `FRONTEND-035-AC-07`, `FRONTEND-050-AC-03` |

## Acceptance Criteria Summary

- [x] FRONTEND-081-AC-01: disclosure box renders, expanded by default
- [x] FRONTEND-081-AC-02: the toggle collapses and re-expands the section
- [x] FRONTEND-081-AC-03: existing Genre/Status/Sort controls are unaffected by relocation
- [x] FRONTEND-081-AC-04: Keywords field narrows the candidate pool
- [x] FRONTEND-081-AC-05: Min Personal Rating field narrows the candidate pool
- [x] FRONTEND-081-AC-06: Min IMDb Rating field narrows the candidate pool
- [x] FRONTEND-081-AC-07: Min TMDB Rating (My Series) field narrows the candidate pool
- [x] FRONTEND-081-AC-08: Year Min/Max (My Series) fields narrow the candidate pool
- [x] FRONTEND-081-AC-09: an already-selected series survives every new filter, same as the existing three
- [x] FRONTEND-064-AC-04: selecting a non-Title field defaults direction to descending (picker sort)
- [x] FRONTEND-064-AC-05: selecting Title defaults direction to ascending (picker sort)
- [x] FRONTEND-081-AC-10: `HighestRatedPanel` renders after `RecommendationFiltersBox`
- [x] FRONTEND-065-AC-01: renders "Recommendations Filters"
- [x] FRONTEND-065-AC-02: renders "Get Recommendations"
- [x] FRONTEND-065-AC-03: existing test suite's name matchers are updated, behavior unchanged
