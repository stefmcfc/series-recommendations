# Frontend Spec 063: Exclude Genre(s) Filter on `SearchFilter`

**Status**: Not started
**Priority**: P3
**Depends on**: Series Spec 042 (`series_spec_042_exclude_genres_search.md`, owns the
`excludeGenres` criterion/`excludeGenre` query param this UI sends) ✅ required, Frontend Spec 055
(`frontend_spec_055_search_filter_overhaul.md`, owns `SearchFilter`'s current form/fieldset
structure and its existing include-Genres checkbox fieldset this mirrors) ✅
**Area**: Frontend (`components/SearchFilter.tsx`, `types/series.ts`, `services/seriesApi.ts`)

## Overview

Recommendations' `RecommendationFiltersBox` already has an Exclude Genres filter, but
`SearchFilter` (My Series list) has none — only the existing include-Genres checkbox fieldset.
This spec adds a matching Exclude Genre(s) checkbox fieldset to `SearchFilter`, wired to the new
`SearchCriteria.excludeGenres`/`excludeGenre` query param from `series_spec_042`, reusing
`seriesApi.getGenreOptions()` for its option list exactly as the include fieldset already does.

## Design Decisions

- **Checkbox list, not free text** — `RecommendationFiltersBox`'s own Exclude Genres field is a
  free-text comma list, but `.claude/SPEC_CANDIDATES.md` already has an open candidate to convert
  *that* field to a checkbox list to match its own include-Genres fieldset. Building this new
  My Series field as free text would create a third, inconsistent shape; building it as a checkbox
  list (matching `SearchFilter`'s own adjacent include-Genres fieldset, one field away in the same
  form) is both the more consistent choice today and sets up the Recs-side conversion to follow the
  same shape later rather than inventing its own.
- **A second, independent inline checkbox block — no shared component extracted yet.** The existing
  include-Genres fieldset in `SearchFilter.tsx` (lines 178-199) is hand-rolled inline JSX, not a
  reusable component. Extracting a shared `CheckboxOptionList` first (as
  `.claude/SPEC_CANDIDATES.md`'s Recs-side exclude-genre candidate already flags as worth doing) is
  explicitly out of scope for this spec — it would require touching the Recs side too, which isn't
  part of this change. This spec copies the same inline pattern a second time for the exclude
  field, accepting the short-term duplication.
- **Reuses the same `genreOptions` state already fetched for the include fieldset** — no second
  `seriesApi.getGenreOptions()` call. Both fieldsets render from the identical list, so a single
  fetch already in `SearchFilter`'s `useEffect` (line 91-96) covers both.
- **No mutual exclusivity enforced client-side** — a user can check the same genre in both Include
  and Exclude simultaneously; the backend (`series_spec_042`, SERIES-042-AC-05) already defines
  that exclude wins, producing an empty result for that genre. `SearchFilter` doesn't need to
  prevent this combination or show a warning — the existing "Search" → results flow already
  surfaces an empty list the same way any other over-constrained filter combination would.

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

### Requirement 2: `SearchFilter` renders an Exclude Genre(s) checkbox fieldset

**User Story**: As a user of the My Series list, I want to exclude series in genres I'm not
interested in, so my results skip them without having to type genre names by hand.

#### FRONTEND-063-AC-03 [AUTO]: renders one checkbox per genre option, unchecked by default
**Statement**: When `SearchFilter`'s filters are expanded, the component shall render an "Exclude
Genre(s)" fieldset with one checkbox per entry in `genreOptions`, all unchecked initially.

**Rationale**: Core UI, mirroring the existing include-Genres fieldset's structure/labeling
convention exactly.

**References**:
- Component: `components/SearchFilter.tsx` (existing include-Genres fieldset, lines 178-199)

**Test Case (Red)**:
```typescript
describe('FRONTEND-063-AC-03: Exclude Genre(s) checkboxes render', () => {
  it('renders one checkbox per fetched genre option, all unchecked', async () => {
    vi.spyOn(seriesApi, 'getGenreOptions').mockResolvedValue(['Comedy', 'Drama'])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Show Filters'))
    await screen.findByText('Exclude Genre(s)')
    const comedyCheckbox = screen.getByRole('checkbox', { name: 'Comedy', exact: false })
    expect(comedyCheckbox).not.toBeChecked()
  })
})
```

**Test Case (Green)**: add `excludeGenresSelected: string[]` to `FormState`, an
`excludeGenreOptions` render block below the existing include-Genres fieldset, and a
`handleExcludeGenreToggle` handler mirroring `handleGenreToggle`.

#### FRONTEND-063-AC-04 [AUTO]: checking a genre adds it to the submitted `excludeGenres`
**Statement**: When a user checks a genre checkbox in the Exclude Genre(s) fieldset and submits
the form, the `SearchFilter` component shall call `onSearch` with `excludeGenres` containing that
genre.

**Rationale**: The actual filtering behavior a user triggers.

**References**:
- Component: `components/SearchFilter.tsx` `buildCriteria`/`handleSubmit`

**Test Case (Red)**:
```typescript
describe('FRONTEND-063-AC-04: checking Exclude Genre(s) submits excludeGenres', () => {
  it('includes the checked genre in onSearch criteria', async () => {
    vi.spyOn(seriesApi, 'getGenreOptions').mockResolvedValue(['Comedy'])
    const onSearch = vi.fn()
    render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Show Filters'))
    const excludeComedy = await screen.findByRole('checkbox', {
      name: 'Comedy',
      // disambiguated via the Exclude Genre(s) fieldset's own labelling, e.g. id prefix
    })
    fireEvent.click(excludeComedy)
    fireEvent.click(screen.getByText('Search'))
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ excludeGenres: ['Comedy'] }),
    )
  })
})
```

**Test Case (Green)**: `buildCriteria` adds `if (form.excludeGenresSelected.length > 0)
criteria.excludeGenres = form.excludeGenresSelected`, mirroring the existing `genresSelected`
branch.

#### FRONTEND-063-AC-05 [AUTO]: "Clear Filters" resets the Exclude Genre(s) selection
**Statement**: When the user clicks "Clear Filters", the `SearchFilter` component shall reset
`excludeGenresSelected` to empty, alongside every other filter field.

**Rationale**: Consistency with the existing `handleClear`/`initialFormState` behavior — a new
field must participate in the same reset, not be left behind as a silent exception.

**References**:
- Component: `components/SearchFilter.tsx` `initialFormState`, `handleClear`

**Test Case (Red)**:
```typescript
describe('FRONTEND-063-AC-05: Clear Filters resets Exclude Genre(s)', () => {
  it('unchecks a previously-checked exclude-genre checkbox', async () => {
    vi.spyOn(seriesApi, 'getGenreOptions').mockResolvedValue(['Comedy'])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Show Filters'))
    const excludeComedy = await screen.findByRole('checkbox', { name: 'Comedy' })
    fireEvent.click(excludeComedy)
    fireEvent.click(screen.getByTestId('clear-filters-btn'))
    expect(excludeComedy).not.toBeChecked()
  })
})
```

**Test Case (Green)**: add `excludeGenresSelected: []` to `initialFormState`.

## Cross-References

| Concept | Location |
|---|---|
| `SearchCriteria` | `frontend/src/types/series.ts` |
| `seriesApi.search`/`buildSearchParams` | `frontend/src/services/seriesApi.ts` |
| `SearchFilter` (existing include-Genres fieldset) | `frontend/src/components/SearchFilter.tsx` |
| Backend criterion/query param | `series_spec_042_exclude_genres_search.md` |
| Genre vocabulary (`GET /series/genres`) | `series_spec_010_genre_dropdown.md` |
| Related Recs-side candidate (checkbox conversion) | `.claude/SPEC_CANDIDATES.md`, "'Exclude Genres' filter — checkbox list instead of free text" |

## Acceptance Criteria Summary

- [ ] FRONTEND-063-AC-01: `SearchCriteria` exposes `excludeGenres`
- [ ] FRONTEND-063-AC-02: `seriesApi.search` sends `excludeGenre` query params
- [ ] FRONTEND-063-AC-03: renders one checkbox per genre option, unchecked by default
- [ ] FRONTEND-063-AC-04: checking a genre adds it to the submitted `excludeGenres`
- [ ] FRONTEND-063-AC-05: "Clear Filters" resets the Exclude Genre(s) selection
