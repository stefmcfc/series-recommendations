# Frontend Spec 063: Exclude Genre(s) Filter on `SearchFilter`

**Status**: Not started
**Priority**: P3
**Depends on**: Series Spec 042 (`series_spec_042_exclude_genres_search.md`, owns the
`excludeGenres` criterion/`excludeGenre` query param this UI sends) ✅ required, Frontend Spec 055
(`frontend_spec_055_search_filter_overhaul.md`, owns `SearchFilter`'s current form/fieldset
structure and its existing include-Genres checkbox fieldset this replaces) ✅ required, Frontend
Spec 067 (`frontend_spec_067_genre_include_exclude_picker.md`, owns the shared
`GenreIncludeExcludePicker` component this spec wires in) ✅ required
**Area**: Frontend (`components/SearchFilter.tsx`, `types/series.ts`, `services/seriesApi.ts`)

## Overview

Recommendations' `RecommendationFiltersBox` already has an Exclude Genres filter, but
`SearchFilter` (My Series list) has none — only the existing include-Genres checkbox fieldset. This
spec replaces that lone include-Genres fieldset with the shared `GenreIncludeExcludePicker`
(`frontend_spec_067`) in its default `includeExclude` mode, wired to both the existing
`SearchCriteria.genres` and the new `SearchCriteria.excludeGenres`/`excludeGenre` query param from
`series_spec_042`. Reuses `seriesApi.getGenreOptions()` for its option list exactly as the old
include fieldset already did.

**Revision note (2026-09-01, exclude-genres consolidation)**: this spec originally planned a second,
independent inline checkbox fieldset for Exclude Genre(s), duplicating the existing include-Genres
fieldset's JSX a second time (see the superseded Design Decisions below, kept for history). That
plan is replaced by wiring in the shared `GenreIncludeExcludePicker` instead — one control replacing
both the old include fieldset and the never-built exclude one, with mutual exclusivity (a genre
can't be in both lists) enforced structurally by that component rather than left unenforced as
originally decided.

## Design Decisions (current)

- **One `GenreIncludeExcludePicker` instance, `mode="includeExclude"`, replacing the old include
  fieldset entirely** — not a second, separate exclude fieldset next to the existing include one.
  `frontend_spec_067` owns the toggle/mutual-exclusivity/modal behavior; this spec only wires
  `SearchFilter`'s `genresSelected`/new `excludeGenresSelected` form state to its
  `included`/`excluded`/`onChange` props.
- **Reuses the same `genreOptions` state already fetched for the old include fieldset** — no second
  `seriesApi.getGenreOptions()` call. The picker renders from the identical list the existing
  fetch in `SearchFilter`'s `useEffect` (line 91-96) already provides.
- **Mutual exclusivity is enforced structurally, by `GenreIncludeExcludePicker` itself** — a user
  cannot select the same genre in both Include and Exclude through this UI, superseding this spec's
  original "no mutual exclusivity enforced client-side" decision (see Superseded Design Decisions
  below). The backend's SERIES-042-AC-05 exclude-wins precedence stays as defensive behavior for any
  caller that bypasses this UI (e.g. a direct API request), but a `SearchFilter` user can no longer
  reach that state at all.

### Superseded Design Decisions (2026-08-xx original plan, kept for history)

- ~~Checkbox list, not free text~~ — superseded: the picker is neither a checkbox list nor free
  text, it's the shared modal-toggle component; the underlying "checkbox list over free text" intent
  is preserved (its toggle buttons list the same vocabulary a checkbox list would), just via a
  different, now-shared control.
- ~~A second, independent inline checkbox block — no shared component extracted yet~~ — superseded:
  `frontend_spec_067` *is* that shared component, extracted specifically because this consolidation
  needed the same control in three places (`SearchFilter`, Recommendations, Use My Series) at once,
  not just here.
- ~~No mutual exclusivity enforced client-side~~ — superseded, see Design Decisions (current) above.

## Requirements

### Requirement 1: `SearchCriteria` and the search API call carry `excludeGenres`

**User Story**: As a developer wiring this filter, I need the frontend's search request shape to
carry excluded genres through to the backend.

#### FRONTEND-063-AC-01 [AUTO]: `SearchCriteria` exposes `excludeGenres`
**Statement**: The `SearchCriteria` type shall include an optional `excludeGenres?: string[]`
field, alongside its existing `genres` field.

**Rationale**: Mirrors the existing `genres` field's shape exactly, matching `series_spec_042`'s
backend DTO shape.

**References**:
- Type: `types/series.ts` (existing `SearchCriteria.genres`, line 186)
- Backend: `series_spec_042_exclude_genres_search.md`, SERIES-042-AC-01

**Test Case (Red)**: type-level; verified by `frontend_spec_063_exclude_genres_search_filter.md`'s
other ACs compiling against the extended type (no standalone runtime test needed for a type-only
change, consistent with how `genres`/`keywords` aren't separately unit-tested as types elsewhere in
this codebase).

**Test Case (Green)**: add `excludeGenres?: string[]` to the `SearchCriteria` interface.

#### FRONTEND-063-AC-02 [AUTO]: `seriesApi.search` sends `excludeGenre` query params
**Statement**: When `SearchCriteria.excludeGenres` is a non-empty array, `seriesApi`'s
`buildSearchParams` shall include an `excludeGenre` param carrying that array, following the same
convention `genres`/`genre` already uses.

**Rationale**: Wires the new criterion field through to the actual HTTP request, matching
`series_spec_042`'s `excludeGenre` (singular, repeatable) query param name.

**References**:
- Function: `services/seriesApi.ts` `buildSearchParams` (existing `criteria.genres` handling, line
  116)
- Backend: `series_spec_042_exclude_genres_search.md`, SERIES-042-AC-06

**Test Case (Red)**:
```typescript
describe('FRONTEND-063-AC-02: buildSearchParams sends excludeGenre', () => {
  it('includes excludeGenre when excludeGenres is set', async () => {
    const getSpy = vi.spyOn(client, 'get').mockResolvedValue({ data: { data: [] } })
    await seriesApi.search({ excludeGenres: ['Comedy', 'Horror'] })
    expect(getSpy).toHaveBeenCalledWith(
      '/series/search',
      expect.objectContaining({
        params: expect.objectContaining({ excludeGenre: ['Comedy', 'Horror'] }),
      }),
    )
  })

  it('omits excludeGenre when excludeGenres is empty/absent', async () => {
    const getSpy = vi.spyOn(client, 'get').mockResolvedValue({ data: { data: [] } })
    await seriesApi.search({})
    expect(getSpy).toHaveBeenCalledWith(
      '/series/search',
      expect.objectContaining({ params: expect.not.objectContaining({ excludeGenre: expect.anything() }) }),
    )
  })
})
```

**Test Case (Green)**: add the `if (criteria.excludeGenres?.length) params.excludeGenre =
criteria.excludeGenres` branch to `buildSearchParams`.

### Requirement 2: `SearchFilter` renders a `GenreIncludeExcludePicker` in place of the old include-Genres fieldset

**User Story**: As a user of the My Series list, I want to include and exclude genres from one
control, so I can narrow my results without being able to accidentally pick the same genre both
ways.

#### FRONTEND-063-AC-03 [AUTO]: renders `GenreIncludeExcludePicker` wired to both genre selections
**Statement**: When `SearchFilter`'s filters are expanded, the component shall render one
`GenreIncludeExcludePicker` (`idPrefix="search-filter-genre"`, `label="Genres"`, default
`includeExclude` mode) in place of the former standalone include-Genres fieldset, with `included`
bound to `form.genresSelected` and `excluded` bound to a new `form.excludeGenresSelected`.

**Rationale**: Core wiring — one control now owns what used to be (and, per the original plan,
would have become) two separate fieldsets.

**References**:
- Component: `components/SearchFilter.tsx` (former include-Genres fieldset, lines 178-199, removed
  by this AC)
- Component: `components/GenreIncludeExcludePicker.tsx` (`frontend_spec_067`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-063-AC-03: GenreIncludeExcludePicker renders', () => {
  it('renders the picker trigger once filters are shown', async () => {
    vi.spyOn(seriesApi, 'getGenreOptions').mockResolvedValue(['Comedy', 'Drama'])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Show Filters'))
    expect(await screen.findByRole('button', { name: 'Genres' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `excludeGenresSelected: string[]` to `FormState`/`initialFormState`,
replace the old inline checkbox JSX with a single `<GenreIncludeExcludePicker ... />`, and an
`onChange` handler that writes both `genresSelected`/`excludeGenresSelected` into form state.

#### FRONTEND-063-AC-04 [AUTO]: toggling a genre to include/exclude updates the submitted criteria accordingly
**Statement**: When a user toggles a genre to `include` or `exclude` via the picker and submits the
form, the `SearchFilter` component shall call `onSearch` with `genres`/`excludeGenres` respectively
containing that genre.

**Rationale**: The actual filtering behavior a user triggers, for both directions.

**References**:
- Component: `components/SearchFilter.tsx` `buildCriteria`/`handleSubmit`
- Related: `FRONTEND-067-AC-04`, `FRONTEND-067-AC-05` (picker's own toggle contract)

**Test Case (Red)**:
```typescript
describe('FRONTEND-063-AC-04: toggling submits genres/excludeGenres', () => {
  it('includes an excluded genre in onSearch criteria', async () => {
    vi.spyOn(seriesApi, 'getGenreOptions').mockResolvedValue(['Comedy'])
    const onSearch = vi.fn()
    render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Show Filters'))
    fireEvent.click(await screen.findByRole('button', { name: 'Genres' }))
    // neutral -> include -> exclude
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: neutral' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: include' }))
    fireEvent.click(screen.getByText('Search'))
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ excludeGenres: ['Comedy'] }),
    )
  })
})
```

**Test Case (Green)**: `buildCriteria` adds `if (form.excludeGenresSelected.length > 0)
criteria.excludeGenres = form.excludeGenresSelected`, alongside the existing `genresSelected`
branch (both now sourced from the same picker's `onChange`).

#### FRONTEND-063-AC-05 [AUTO]: "Clear Filters" resets both the include and exclude genre selections
**Statement**: When the user clicks "Clear Filters", the `SearchFilter` component shall reset both
`genresSelected` and `excludeGenresSelected` to empty, alongside every other filter field.

**Rationale**: Consistency with the existing `handleClear`/`initialFormState` behavior — the new
field must participate in the same reset, not be left behind as a silent exception.

**References**:
- Component: `components/SearchFilter.tsx` `initialFormState`, `handleClear`

**Test Case (Red)**:
```typescript
describe('FRONTEND-063-AC-05: Clear Filters resets both genre selections', () => {
  it('resets the picker summary after Clear Filters', async () => {
    vi.spyOn(seriesApi, 'getGenreOptions').mockResolvedValue(['Comedy'])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Show Filters'))
    fireEvent.click(await screen.findByRole('button', { name: 'Genres' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: neutral' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(screen.getByTestId('clear-filters-btn'))
    expect(screen.getByRole('button', { name: 'Genres' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `excludeGenresSelected: []` alongside the existing `genresSelected: []`
in `initialFormState`.

## Cross-References

| Concept | Location |
|---|---|
| `SearchCriteria` | `frontend/src/types/series.ts` |
| `seriesApi.search`/`buildSearchParams` | `frontend/src/services/seriesApi.ts` |
| `SearchFilter` | `frontend/src/components/SearchFilter.tsx` |
| Shared picker component | `frontend_spec_067_genre_include_exclude_picker.md`, `components/GenreIncludeExcludePicker.tsx` |
| Backend criterion/query param | `series_spec_042_exclude_genres_search.md` |
| Genre vocabulary (`GET /series/genres`) | `series_spec_010_genre_dropdown.md` |

## Acceptance Criteria Summary

- [ ] FRONTEND-063-AC-01: `SearchCriteria` exposes `excludeGenres`
- [ ] FRONTEND-063-AC-02: `seriesApi.search` sends `excludeGenre` query params
- [ ] FRONTEND-063-AC-03: renders `GenreIncludeExcludePicker` wired to both genre selections
- [ ] FRONTEND-063-AC-04: toggling a genre to include/exclude updates the submitted criteria accordingly
- [ ] FRONTEND-063-AC-05: "Clear Filters" resets both the include and exclude genre selections
