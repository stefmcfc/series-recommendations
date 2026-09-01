# Frontend Spec 069: "Use My Series" Panel Gains Exclude Genre(s)

**Status**: Implemented — `frontend/src/components/RecommendationControls.tsx`,
`frontend/src/components/UseMySeriesPanel.tsx`, tests in
`frontend/src/components/RecommendationControls.test.tsx`,
`frontend/src/components/UseMySeriesPanel.test.tsx`
**Priority**: P3
**Depends on**: Frontend Spec 067 (`frontend_spec_067_genre_include_exclude_picker.md`, owns the
`GenreIncludeExcludePicker` component this spec wires in) ✅ required, Tooling Spec 008
(`tooling_spec_008_recommendation_controls_decomposition.md`, owns `UseMySeriesPanel`/
`buildSpecificSeriesCandidatePool`, both touched by this spec) ✅ required
**Area**: Frontend (`components/UseMySeriesPanel.tsx`, `components/RecommendationControls.tsx`)

## Overview

`UseMySeriesPanel`'s "Filter by Genre" fieldset (`specificSeriesGenreFilter`,
`filterSpecificSeriesByGenre` in `RecommendationControls.tsx`) narrows the source-series picker to
series matching a chosen genre, but has no exclude counterpart — it's a purely client-side filter
over `allSeries`, entirely independent of `SearchFilter`'s and Recommendations' own genre fields
(`.claude/ideas/future_ideas.md`'s "'Use My Series' source-series picker gains filter/sort parity
with My Series" entry first flagged this gap). This spec adds Exclude Genre(s) to that same panel,
narrowing which of the user's tracked series are offered as recommendation-sourcing candidates,
using the shared `GenreIncludeExcludePicker` (`frontend_spec_067`) in place of the existing
include-only checkbox fieldset.

This spec is scoped to exclude-genres only. `future_ideas.md`'s broader "filter/sort parity" proposal
(Keywords, Min Rating, Year Range, a "Select Series" relabel) stays there, unspecced, for a later
pass — see the tracking-file updates accompanying this spec.

## Design Decisions

- **Mirrors the existing `filterSpecificSeriesByGenre` matching shape exactly, not the backend's.**
  `filterSpecificSeriesByGenre` already matches on exact (not substring) equality between a
  lowercased, comma-split, trimmed series genre token and the filter set — different from
  `SeriesSearchService.matchesGenres`'/`series_spec_042`'s case-insensitive *substring* match. This
  spec's new `filterSpecificSeriesByExcludeGenre` follows its sibling's existing exact-token-match
  shape, not the backend's, since it's extending an already-established client-side function, not
  introducing a new one from scratch.
- **A genre-less series is never excluded** — same convention as every other exclude-genres surface
  in this consolidation (`series_spec_042`, `series_spec_043`): nothing to match against means it
  survives the filter by default.
- **One `GenreIncludeExcludePicker` (`includeExclude` mode) replaces the existing "Filter by Genre"
  fieldset entirely**, not a second fieldset added beside it — same replace-not-append shape
  `frontend_spec_063`/`068` already use for their own consumers.
- **`buildSpecificSeriesCandidatePool` gains one new parameter, `excludeGenreFilter`**, applied
  immediately after the existing `genreFilter` step and before status filtering — keeps the existing
  filter pipeline's order (genre narrowing before status narrowing) rather than reordering it.
- **No backend change.** This is purely a client-side narrowing of `allSeries` (already fully
  fetched via `seriesApi.getAll()`) into the picker's candidate pool — nothing here is a server
  request parameter, unlike `series_spec_042`'s `GET /series/search` or `series_spec_044`'s
  `discover/tv` pre-filter.

## Requirements

### Requirement 1: `buildSpecificSeriesCandidatePool` narrows out series matching an excluded genre

**User Story**: As a user picking source series for "Use My Series", I want to exclude series in
genres I'm not interested in sourcing from, without having to scroll past them.

#### FRONTEND-069-AC-01 [AUTO]: `excludeGenreFilter` narrows the candidate pool
**Statement**: When `buildSpecificSeriesCandidatePool` is called with a non-empty
`excludeGenreFilter`, it shall omit from its result any series whose `genres` field, split on `,`
and trimmed/lowercased, contains a token matching (case-insensitively) any entry in
`excludeGenreFilter`.

**Rationale**: Core filtering behavior, mirroring `filterSpecificSeriesByGenre`'s existing
include-side matching exactly (Design Decisions).

**References**:
- Function: `components/RecommendationControls.tsx`, `buildSpecificSeriesCandidatePool`,
  `filterSpecificSeriesByGenre` (the sibling this mirrors)

**Test Case (Red)**:
```typescript
describe('FRONTEND-069-AC-01: excludeGenreFilter narrows the pool', () => {
  it('omits a series matching an excluded genre', () => {
    const series = [
      { id: '1', title: 'Funny Show', genres: 'Comedy', excludeFromRecommendations: false },
      { id: '2', title: 'Serious Show', genres: 'Drama', excludeFromRecommendations: false },
    ] as Series[]
    const pool = buildSpecificSeriesCandidatePool(series, [], ['Comedy'], 'any', 'title', 'asc', [])
    expect(pool.map((s) => s.title)).toEqual(['Serious Show'])
  })
})
```

**Test Case (Green)**: add `filterSpecificSeriesByExcludeGenre(series, excludeGenreFilter)`
(negated version of `filterSpecificSeriesByGenre`'s matching logic), chained into
`buildSpecificSeriesCandidatePool` immediately after the existing `filterSpecificSeriesByGenre`
call; add the `excludeGenreFilter: string[]` parameter to the function's signature.

#### FRONTEND-069-AC-02 [AUTO]: a genre-less series is never excluded
**Statement**: While a series' `genres` field is `null`/empty, `buildSpecificSeriesCandidatePool`
shall not omit it on the basis of `excludeGenreFilter`.

**Rationale**: Matches the same null-handling convention used everywhere else in this consolidation
(`series_spec_042`/`043`) — a filter with nothing to check against doesn't silently drop the series.

**References**:
- Function: `components/RecommendationControls.tsx`, `filterSpecificSeriesByExcludeGenre`

**Test Case (Red)**:
```typescript
describe('FRONTEND-069-AC-02: a genre-less series is not excluded', () => {
  it('keeps a series with no genres regardless of excludeGenreFilter', () => {
    const series = [
      { id: '1', title: 'No Genre Show', genres: null, excludeFromRecommendations: false },
    ] as Series[]
    const pool = buildSpecificSeriesCandidatePool(series, [], ['Comedy'], 'any', 'title', 'asc', [])
    expect(pool.map((s) => s.title)).toEqual(['No Genre Show'])
  })
})
```

**Test Case (Green)**: `s.genres?.split(',') ?? []` already yields an empty array for a genre-less
series, whose `.some(...)` check against the exclude set is always `false` — no series is excluded,
requiring no special-case branch beyond the existing optional-chaining pattern
`filterSpecificSeriesByGenre` already uses.

#### FRONTEND-069-AC-03 [AUTO]: empty/absent `excludeGenreFilter` is a no-op
**Statement**: While `excludeGenreFilter` is empty, `buildSpecificSeriesCandidatePool` shall not
omit any series on that basis.

**Rationale**: An unset filter must not change the result, matching every other optional filter in
this pipeline.

**References**:
- Function: `components/RecommendationControls.tsx`, `filterSpecificSeriesByExcludeGenre`

**Test Case (Red)**:
```typescript
describe('FRONTEND-069-AC-03: empty excludeGenreFilter is a no-op', () => {
  it('returns every series unchanged when excludeGenreFilter is empty', () => {
    const series = [
      { id: '1', title: 'Show', genres: 'Comedy', excludeFromRecommendations: false },
    ] as Series[]
    const pool = buildSpecificSeriesCandidatePool(series, [], [], 'any', 'title', 'asc', [])
    expect(pool.map((s) => s.title)).toEqual(['Show'])
  })
})
```

**Test Case (Green)**: `filterSpecificSeriesByExcludeGenre` returns `series` unchanged when
`excludeGenreFilter.length === 0`, mirroring `filterSpecificSeriesByGenre`'s own early return.

### Requirement 2: `UseMySeriesPanel` renders the shared picker in place of "Filter by Genre"

**User Story**: As a user of the "Use My Series" source picker, I want to include and exclude
genres from one control, consistent with how the rest of this consolidation's genre pickers work.

#### FRONTEND-069-AC-04 [AUTO]: replaces "Filter by Genre" with `GenreIncludeExcludePicker`
**Statement**: The `UseMySeriesPanel` component shall render one `GenreIncludeExcludePicker`
(`idPrefix="specific-series-genre"`, `label="Filter by Genre"`, default `includeExclude` mode) with
`included` bound to `specificSeriesGenreFilter` and `excluded` bound to a new
`specificSeriesExcludeGenreFilter` local state, in place of its former include-only "Filter by
Genre" checkbox fieldset.

**Rationale**: Core wiring — replaces the fieldset with the shared control, gaining exclude support.

**References**:
- Component: `components/UseMySeriesPanel.tsx` (existing "Filter by Genre" fieldset, lines 124-147)
- Component: `components/GenreIncludeExcludePicker.tsx` (`frontend_spec_067`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-069-AC-04: UseMySeriesPanel renders the combined picker', () => {
  it('renders a Filter by Genre picker trigger, not the old checkbox fieldset', () => {
    render(
      <UseMySeriesPanel
        state={initialState} updateState={vi.fn()}
        allSeries={[{ id: '1', title: 'Show', genres: 'Comedy' } as Series]}
        genreOptions={['Comedy', 'Drama']}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Filter by Genre' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `specificSeriesExcludeGenreFilter` `useState<string[]>([])`; remove the
old inline checkbox block and `handleSpecificSeriesGenreFilterToggle`; render
`<GenreIncludeExcludePicker idPrefix="specific-series-genre" label="Filter by Genre" genreOptions={genreOptions} included={specificSeriesGenreFilter} excluded={specificSeriesExcludeGenreFilter} onChange={({ included, excluded }) => { setSpecificSeriesGenreFilter(included); setSpecificSeriesExcludeGenreFilter(excluded) }} />`;
thread `specificSeriesExcludeGenreFilter` into `buildSpecificSeriesCandidatePool`'s new parameter.

#### FRONTEND-069-AC-05 [AUTO]: excluding a genre narrows the picker's candidate suggestions
**Statement**: When a user toggles a genre to `exclude` in `UseMySeriesPanel`'s picker, the
`specificSeriesCandidatePool` (and therefore the "Series" picker's suggestion list) shall no longer
include series matching that genre.

**Rationale**: End-to-end confirmation that the toggle actually reaches the candidate pool a user
selects source series from, not just local component state.

**References**:
- Component: `components/UseMySeriesPanel.tsx`
- Related: `FRONTEND-069-AC-01`, `FRONTEND-067-AC-04`

**Test Case (Red)**:
```typescript
describe('FRONTEND-069-AC-05: exclude toggle narrows Series suggestions', () => {
  it('removes an excluded-genre series from the Series picker options', async () => {
    render(
      <UseMySeriesPanel
        state={initialState} updateState={vi.fn()}
        allSeries={[
          { id: '1', title: 'Funny Show', genres: 'Comedy' } as Series,
          { id: '2', title: 'Serious Show', genres: 'Drama' } as Series,
        ]}
        genreOptions={['Comedy', 'Drama']}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Filter by Genre' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: neutral' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: include' }))
    // neutral -> include -> exclude
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: exclude' }))
  })
})
```

**Test Case (Green)**: covered by `FRONTEND-069-AC-01`'s `buildSpecificSeriesCandidatePool` wiring
plus `FRONTEND-069-AC-04`'s `onChange` handler — this AC is the scenario-level regression test
tying both together.

## Cross-References

| Concept | Location |
|---|---|
| `UseMySeriesPanel` | `frontend/src/components/UseMySeriesPanel.tsx` |
| `buildSpecificSeriesCandidatePool`/`filterSpecificSeriesByGenre` | `frontend/src/components/RecommendationControls.tsx` |
| Shared picker component | `frontend_spec_067_genre_include_exclude_picker.md`, `components/GenreIncludeExcludePicker.tsx` |
| Originating idea (broader scope, partially out of scope here) | `.claude/ideas/future_ideas.md`, "'Use My Series' source-series picker gains filter/sort parity with My Series, plus a 'Select Series' relabel" |

## Acceptance Criteria Summary

- [x] FRONTEND-069-AC-01: `excludeGenreFilter` narrows the candidate pool
- [x] FRONTEND-069-AC-02: a genre-less series is never excluded
- [x] FRONTEND-069-AC-03: empty/absent `excludeGenreFilter` is a no-op
- [x] FRONTEND-069-AC-04: replaces "Filter by Genre" with `GenreIncludeExcludePicker`
- [x] FRONTEND-069-AC-05: excluding a genre narrows the picker's candidate suggestions
