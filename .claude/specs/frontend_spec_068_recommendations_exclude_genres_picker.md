# Frontend Spec 068: Recommendations' Exclude Genres Becomes the Shared Genre Picker

**Status**: Not started
**Priority**: P3
**Depends on**: Frontend Spec 067 (`frontend_spec_067_genre_include_exclude_picker.md`, owns the
`GenreIncludeExcludePicker` component this spec wires in) ✅ required, Tooling Spec 008
(`tooling_spec_008_recommendation_controls_decomposition.md`, owns `CustomSearchPanel`/
`RecommendationFiltersBox`/`ControlsState`, all touched by this spec) ✅ required, Series Spec 043
(`series_spec_043_exclude_genres_vocabulary_fix.md`, fixes the backend matching this field's values
now need to survive correctly) recommended, Series Spec 044
(`series_spec_044_custom_search_exclude_genres_prefilter.md`, owns the `excludeGenre` values this
spec's Custom Search picker now feeds into a real TMDB pre-filter) recommended
**Area**: Frontend (`components/CustomSearchPanel.tsx`, `components/RecommendationFiltersBox.tsx`,
`components/RecommendationControls.tsx`)

## Overview

Recommendations' Exclude Genres field is currently a free-text comma list
(`ControlsState.excludeGenresText`, `RecommendationFiltersBox`), shown unconditionally in every
source mode, with no defined vocabulary — a user has to know or guess an exact string TMDB's genre
data will match. This spec replaces it with the shared `GenreIncludeExcludePicker`
(`frontend_spec_067`), and relocates it exactly the way `frontend_spec_046`/`047` already relocated
Min TMDB Rating/Year Min/Year Max/Countries/Language between `RecommendationFiltersBox` and
`CustomSearchPanel`:

- **Custom Search** (`state.mode === 'discover' && state.discoverMode === 'customSearch'`): gains
  one combined `GenreIncludeExcludePicker` (`includeExclude` mode) in `CustomSearchPanel`, replacing
  its existing include-only Genres checkbox fieldset. One control now covers both `genres` and
  `excludeGenres` — the "Genres" field a Custom Search user already fills in also lets them exclude,
  from the same modal, with mutual exclusivity guaranteed by `frontend_spec_067`.
- **Every other mode** (trending, topRated, useMySeries): keeps an Exclude Genres picker in
  `RecommendationFiltersBox`, now in `excludeOnly` mode (these modes have no "include genres"
  concept — Design Decisions) instead of a free-text input.

Both pickers write to the same underlying `ControlsState` field, since only one is ever visible for
a given mode — the same one-field-two-locations shape `excludeGenresText` already had.

## Design Decisions

- **One `excludeGenresSelected: string[]` field replaces `excludeGenresText: string` in
  `ControlsState`.** No comma-parsing left in `buildQuery` (`applyExcludeAndMiscFilters`'s
  `parseCommaList(state.excludeGenresText)` call goes away) — the picker already produces an array
  directly, mirroring how `genresSelected`/`countriesSelected` already work.
- **`CustomSearchPanel` gets `includeExclude` mode; `RecommendationFiltersBox` gets `excludeOnly`
  mode, gated on `!isCustomSearch`** — exactly the existing relocation pattern this file already
  uses for Min TMDB Rating/Year Min/Year Max (`frontend_spec_046`) and Countries/Language
  (`frontend_spec_047`): a field renders in exactly one of the two components depending on
  `isCustomSearch`, never both, never neither.
- **`RecommendationFiltersBox` needs a new `genreOptions: string[]` prop.** It doesn't currently
  receive one (only `CustomSearchPanel`/`UseMySeriesPanel` do) — `RecommendationControls` already
  fetches `genreOptions` via `seriesApi.getGenreOptions()` for those two, so this is passing an
  existing value one prop further, not a new fetch.
- **`handleResetFilters` resets `excludeGenresSelected` to `[]`**, replacing its current
  `excludeGenresText: ''` line — same reset behavior, new field.
- **No change to how `query.excludeGenres` is consumed downstream.** `RecommendationQuery`'s
  `excludeGenres?: string[]` field (`types/series.ts`) is unchanged; only how the frontend populates
  it changes (array from the picker, not a parsed comma string).

## Requirements

### Requirement 1: `ControlsState` carries `excludeGenresSelected` as an array

**User Story**: As a developer wiring this picker, I need `ControlsState` to hold an array the
picker can bind to directly, matching every other multi-select field in this state shape.

#### FRONTEND-068-AC-01 [AUTO]: `excludeGenresText` is replaced by `excludeGenresSelected: string[]`
**Statement**: The `ControlsState` interface shall replace its `excludeGenresText: string` field
with `excludeGenresSelected: string[]`, and `buildQuery` shall set `query.excludeGenres` directly
from that array (no comma-parsing) when it is non-empty.

**Rationale**: Removes the free-text vocabulary problem at its source — there's no longer a string
to parse, only a picker-produced array of values already drawn from `genreOptions`.

**References**:
- Type: `components/RecommendationControls.tsx`, `ControlsState`, `initialState`,
  `applyExcludeAndMiscFilters`

**Test Case (Red)**:
```typescript
describe('FRONTEND-068-AC-01: excludeGenresSelected drives query.excludeGenres', () => {
  it('sends excludeGenres from the array field, no parsing', () => {
    const state = { ...initialState, excludeGenresSelected: ['Comedy', 'Horror'] }
    const query = buildQuery(state)
    expect(query.excludeGenres).toEqual(['Comedy', 'Horror'])
  })

  it('omits excludeGenres when the array is empty', () => {
    const query = buildQuery(initialState)
    expect(query.excludeGenres).toBeUndefined()
  })
})
```

**Test Case (Green)**: rename the field throughout `RecommendationControls.tsx`; replace
`applyExcludeAndMiscFilters`'s `parseCommaList(state.excludeGenresText)` line with a direct
`state.excludeGenresSelected` length check.

### Requirement 2: `CustomSearchPanel` renders a combined include/exclude Genres picker

**User Story**: As a Custom Search user, I want to include and exclude genres from the same "Genres"
control, so I don't have to reconcile a separate free-text field against my checkbox selections.

#### FRONTEND-068-AC-02 [AUTO]: replaces the include-only Genres fieldset with `GenreIncludeExcludePicker`
**Statement**: The `CustomSearchPanel` component shall render one `GenreIncludeExcludePicker`
(`idPrefix="custom-search-genre"`, `label="Genres"`, default `includeExclude` mode) with `included`
bound to `state.genresSelected` and `excluded` bound to `state.excludeGenresSelected`, in place of
its former include-only checkbox fieldset.

**Rationale**: Core wiring — one control now covers what used to require this fieldset plus a
separate free-text field elsewhere on the page.

**References**:
- Component: `components/CustomSearchPanel.tsx` (existing Genres fieldset, lines 56-76)
- Component: `components/GenreIncludeExcludePicker.tsx` (`frontend_spec_067`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-068-AC-02: CustomSearchPanel renders the combined picker', () => {
  it('renders a Genres picker trigger, not the old checkbox fieldset', () => {
    render(
      <CustomSearchPanel
        state={initialState} updateState={vi.fn()}
        genreOptions={['Comedy', 'Drama']} keywordOptions={[]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Genres' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: remove the old inline checkbox block and `handleGenreToggle`; render
`<GenreIncludeExcludePicker idPrefix="custom-search-genre" label="Genres" genreOptions={genreOptions} included={state.genresSelected} excluded={state.excludeGenresSelected} onChange={({ included, excluded }) => updateState({ genresSelected: included, excludeGenresSelected: excluded })} />`.

#### FRONTEND-068-AC-03 [AUTO]: excluding a genre updates the submitted query's `excludeGenres`
**Statement**: When a user toggles a genre to `exclude` in `CustomSearchPanel`'s picker, the
resulting `ControlsState.excludeGenresSelected` shall contain that genre, and `state.genresSelected`
shall not.

**Rationale**: The actual filtering behavior a Custom Search user triggers, and confirms
mutual exclusivity holds through this specific wiring (not just inside the shared component itself).

**References**:
- Component: `components/CustomSearchPanel.tsx`
- Related: `FRONTEND-067-AC-05` (picker's own include-to-exclude transition)

**Test Case (Red)**:
```typescript
describe('FRONTEND-068-AC-03: excluding a genre updates state correctly', () => {
  it('moves a genre from genresSelected to excludeGenresSelected', () => {
    const updateState = vi.fn()
    const state = { ...initialState, genresSelected: ['Comedy'] }
    render(
      <CustomSearchPanel
        state={state} updateState={updateState}
        genreOptions={['Comedy']} keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres — 1 included' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: include' }))
    expect(updateState).toHaveBeenCalledWith({
      genresSelected: [],
      excludeGenresSelected: ['Comedy'],
    })
  })
})
```

**Test Case (Green)**: covered by `FRONTEND-068-AC-02`'s `onChange` wiring — this AC is the
scenario-level regression test for it.

### Requirement 3: `RecommendationFiltersBox` shows an exclude-only picker outside Custom Search

**User Story**: As a user in trending/top-rated/Use My Series mode, I still want to exclude genres,
even though there's no "include genres" concept in those modes.

#### FRONTEND-068-AC-04 [AUTO]: renders the exclude-only picker only while `!isCustomSearch`
**Statement**: While `isCustomSearch` is `false`, the `RecommendationFiltersBox` component shall
render one `GenreIncludeExcludePicker` (`idPrefix="recs-filters-exclude-genre"`,
`label="Exclude Genres"`, `mode="excludeOnly"`) bound to `excludeGenresSelected`, in place of the
former free-text input; while `isCustomSearch` is `true`, it shall render neither the old input nor
this picker (the field lives in `CustomSearchPanel` instead, per `FRONTEND-068-AC-02`).

**Rationale**: Mirrors the exact relocation-by-`isCustomSearch` pattern this component already uses
for Min TMDB Rating/Year Min/Year Max/Countries/Language, extended to the one remaining field that
didn't yet follow it.

**References**:
- Component: `components/RecommendationFiltersBox.tsx` (existing unconditional Exclude Genres
  field, lines 154-164, and the existing `!isCustomSearch` relocation precedent at lines 97-112)

**Test Case (Red)**:
```typescript
describe('FRONTEND-068-AC-04: exclude-only picker relocation', () => {
  it('renders the picker when not Custom Search', () => {
    render(
      <RecommendationFiltersBox
        state={initialState} updateState={vi.fn()}
        isCustomSearch={false} showMinSourceRating={false} genreOptions={['Comedy']}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.getByRole('button', { name: 'Exclude Genres' })).toBeInTheDocument()
  })

  it('does not render the picker when Custom Search is active', () => {
    render(
      <RecommendationFiltersBox
        state={initialState} updateState={vi.fn()}
        isCustomSearch={true} showMinSourceRating={false} genreOptions={['Comedy']}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.queryByRole('button', { name: /Exclude Genres/ })).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add a `genreOptions: string[]` prop to `RecommendationFiltersBoxProps`; wrap
the picker in the existing `{!isCustomSearch && ...}` conditional, replacing the old unconditional
text input.

#### FRONTEND-068-AC-05 [AUTO]: "Reset Filters" resets `excludeGenresSelected` to empty
**Statement**: When the user clicks "Reset Filters", the `RecommendationFiltersBox` component shall
reset `excludeGenresSelected` to `[]`, alongside every other filter field `handleResetFilters`
already clears.

**Rationale**: Consistency with the existing reset behavior — the renamed field must participate in
the same reset, not silently stop being cleared.

**References**:
- Component: `components/RecommendationFiltersBox.tsx`, `handleResetFilters`

**Test Case (Red)**:
```typescript
describe('FRONTEND-068-AC-05: Reset Filters clears excludeGenresSelected', () => {
  it('calls updateState with excludeGenresSelected: []', () => {
    const updateState = vi.fn()
    render(
      <RecommendationFiltersBox
        state={{ ...initialState, excludeGenresSelected: ['Comedy'] }} updateState={updateState}
        isCustomSearch={false} showMinSourceRating={false} genreOptions={['Comedy']}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    fireEvent.click(screen.getByTestId('reset-filters-btn'))
    expect(updateState).toHaveBeenCalledWith(
      expect.objectContaining({ excludeGenresSelected: [] }),
    )
  })
})
```

**Test Case (Green)**: replace `handleResetFilters`'s `excludeGenresText: ''` line with
`excludeGenresSelected: []`.

## Cross-References

| Concept | Location |
|---|---|
| `ControlsState`/`buildQuery` | `frontend/src/components/RecommendationControls.tsx` |
| `CustomSearchPanel` | `frontend/src/components/CustomSearchPanel.tsx` |
| `RecommendationFiltersBox` | `frontend/src/components/RecommendationFiltersBox.tsx` |
| Shared picker component | `frontend_spec_067_genre_include_exclude_picker.md`, `components/GenreIncludeExcludePicker.tsx` |
| Existing relocation-by-`isCustomSearch` precedent | `frontend_spec_046_custom_search_prefetch_filters_ui.md`, `frontend_spec_047_custom_search_language_country_filters_ui.md` |
| Backend pre-filter this now feeds | `series_spec_044_custom_search_exclude_genres_prefilter.md` |
| Backend post-filter vocabulary fix | `series_spec_043_exclude_genres_vocabulary_fix.md` |
| `RecommendationQuery.excludeGenres` (unchanged) | `frontend/src/types/series.ts` |

## Acceptance Criteria Summary

- [ ] FRONTEND-068-AC-01: `excludeGenresText` is replaced by `excludeGenresSelected: string[]`
- [ ] FRONTEND-068-AC-02: replaces the include-only Genres fieldset with `GenreIncludeExcludePicker`
- [ ] FRONTEND-068-AC-03: excluding a genre updates the submitted query's `excludeGenres`
- [ ] FRONTEND-068-AC-04: renders the exclude-only picker only while `!isCustomSearch`
- [ ] FRONTEND-068-AC-05: "Reset Filters" resets `excludeGenresSelected` to empty
