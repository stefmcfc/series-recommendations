# Frontend Spec 014: Genre Checkbox List (Recommendation Sourcing Fix)

**Status**: Done
**Depends on**: Series Spec 010 (`GET /api/v1/series/genres`) ✅, Frontend Spec 011 (`RecommendationControls`, `ControlsState`, `RecommendationQuery`, `seriesApi.getRecommendations`) ✅
**Frontend Stage**: 14 of N

## Overview

Fixes the same bug `series_spec_010_genre_dropdown.md` fixes from the backend side, from the frontend side: `RecommendationControls`'s "Genre & Keyword" sourcing mode currently has a free-text "Genres" `<input>` (comma-separated), and whatever the user types is sent to the backend verbatim. The backend's genre resolution (`RecommendationService.resolveGenreIds` → `TmdbGenreTable.idFor`) is an exact-match lookup against a fixed 18-name vocabulary; anything that doesn't match exactly is silently dropped, and if every typed genre/keyword fails to resolve, the request silently falls back to TMDB's generic "most popular" feed with no error shown anywhere.

This spec replaces the free-text Genres input with a checkbox list populated from the new `GET /api/v1/series/genres` endpoint (Series Spec 010) — the exact same fixed vocabulary `idFor` accepts — so a user can no longer type a genre name that doesn't resolve. The Keywords field is unaffected: it's still free text, because it hits a real TMDB keyword search (`TmdbClient.searchKeyword`, Series Spec 007 Requirement 3) rather than a fixed local vocabulary, so there's no equivalent closed list to constrain it to.

**Design decisions**:
- **Reuse the existing "Specific Series" checkbox-picker pattern (`seriesPicker`/`seriesOption`, `handleSeriesToggle`), not a native `<select multiple>`.** `RecommendationControls` already has exactly this interaction — a fetched list rendered as one checkbox per item, toggled into/out of an array — one screen away in the same component. Reusing it keeps the component visually and behaviorally consistent with itself rather than introducing a second, different multi-select idiom for what is functionally the same kind of control.
- **`ControlsState.genresText: string` becomes `genresSelected: string[]`, holding the checked genre names directly.** There's nothing left to comma-parse once selection is constrained to a fixed, pre-validated list — `parseCommaList` stops applying to this one field. It still applies to `keywordsText`, which is unchanged.
- **The genre options fetch follows the exact same pattern as the existing `allSeries` fetch** (`seriesApi.getAll()` on mount, `.catch(() => undefined)` on failure) — fetched once on mount regardless of which sourcing mode is currently selected (mirroring how `allSeries` is fetched unconditionally today, not gated behind `mode === 'specific'`), so switching into Genre & Keyword mode never has to wait on a fetch that could have already started. A failed genre-list fetch must not break the rest of the form — the user can still submit other fields; they just see an empty checkbox list under Genre & Keyword mode until a retry (no retry UI is added by this spec, consistent with `allSeries` having none either).
- **No changes to the Keywords field, the Filters section, or any other part of `RecommendationControls`.** This spec is scoped exactly to the Genres field's input mechanism and the one state field/reset path it touches.

---

## Requirements

### Requirement 1: `seriesApi.getGenreOptions`

**User story**: As a developer, I want the new genre-vocabulary endpoint wrapped in `seriesApi`, so `RecommendationControls` has a single typed call to make, consistent with every other backend call in this app.

#### Acceptance Criteria

- **FRONTEND-014-AC-01** [AUTO]: `seriesApi.ts` shall gain `getGenreOptions: (): Promise<string[]>`, calling `GET /series/genres` and unwrapping the `{ data }` envelope, following the exact same call/unwrap shape as `seriesApi.getAll`.

---

### Requirement 2: Fetching Genre Options

**User story**: As a user, I want the set of valid genres loaded automatically, so I don't have to guess what will and won't work before I even open the Genre & Keyword mode.

#### Acceptance Criteria

- **FRONTEND-014-AC-02** [AUTO]: `RecommendationControls` shall fetch genre options via `seriesApi.getGenreOptions()` in a `useEffect` on mount (empty dependency array), storing the result in new component state, mirroring the existing `allSeries` fetch-on-mount pattern.
- **FRONTEND-014-AC-03** [AUTO]: If `seriesApi.getGenreOptions()` rejects, `RecommendationControls` shall catch the rejection (`.catch(() => undefined)`, same as the existing `allSeries` fetch) and continue rendering the rest of the form normally — no crash, no thrown error, no blocking of other fields.

---

### Requirement 3: Genre Checkbox List Replaces Free-Text Input

**User story**: As a user picking "Genre & Keyword" sourcing, I want to choose genres from a list of values I know will work, instead of typing free text that might silently do nothing.

#### Acceptance Criteria

- **FRONTEND-014-AC-04** [AUTO]: Under `Genre & Keyword` mode, `RecommendationControls` shall render the fetched genre options (`FRONTEND-014-AC-02`) as a checkbox list — one checkbox per genre name — using the same visual/interaction pattern as the existing `Specific Series` mode's series checkbox picker (`seriesPicker`/`seriesOption`, `handleSeriesToggle`), not a native `<select multiple>`.
- **FRONTEND-014-AC-05** [AUTO]: Checking a genre checkbox shall add that exact genre name to `genresSelected`; unchecking it shall remove it — mirroring `handleSeriesToggle`'s add/remove-from-array logic — and shall immediately update the query via `onQueryChange`, consistent with every other control's immediate-submit behavior (`FRONTEND-011-AC-12`).
- **FRONTEND-014-AC-06** [AUTO]: The free-text Genres `<input>` (previously bound to `genresText`) shall no longer be rendered anywhere in `RecommendationControls`. The Keywords `<input>` (`keywordsText`, still comma-separated free text, `parseCommaList`) is unchanged by this spec.

---

### Requirement 4: State Shape & Query Building

**User story**: As a developer, I want the component's internal state to hold exactly what the checkbox list produces, so there's no leftover free-text parsing for a field that no longer accepts free text.

#### Acceptance Criteria

- **FRONTEND-014-AC-07** [AUTO]: `ControlsState.genresText: string` shall be replaced by `genresSelected: string[]`, holding the currently-checked genre names directly (no comma-parsing applies to this field).
- **FRONTEND-014-AC-08** [AUTO]: `buildQuery` shall populate `RecommendationQuery.genres` directly from `state.genresSelected` when `mode === 'genre'` and the array is non-empty (previously `parseCommaList(state.genresText)`); when `genresSelected` is empty, `genres` shall be omitted from the query exactly as an empty free-text field was omitted before.

---

### Requirement 5: Hint & Mode-Switch Reset Behavior Preserved

**User story**: As a user, I still want to be told when I haven't entered enough to source anything, and I still don't want a stale genre selection to leak into a request after I switch away from Genre & Keyword mode.

#### Acceptance Criteria

- **FRONTEND-014-AC-09** [AUTO]: `showGenreKeywordHint`'s existing behavior (shown when `mode === 'genre'` and both the genre selection and the keyword text are empty; hidden as soon as either has a value) shall continue to work unchanged, now evaluated against `genresSelected.length === 0` in place of `parseCommaList(genresText).length === 0`.
- **FRONTEND-014-AC-10** [AUTO]: `handleModeChange` shall reset `genresSelected` to `[]` on every mode switch (the equivalent of its previous `genresText: ''` reset), alongside its existing `selectedSeriesIds`/`keywordsText` resets — a stale genre selection can never be silently included after switching away from `Genre & Keyword` mode.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `GET /api/v1/series/genres` endpoint, the alias-name vocabulary it returns | `series_spec_010_genre_dropdown.md` |
| `RecommendationControls`, `ControlsState`, `buildQuery`, `parseCommaList`, `handleModeChange`, `showGenreKeywordHint`, the `Specific Series` checkbox-picker pattern (`seriesPicker`/`seriesOption`/`handleSeriesToggle`) being extended here, immediate-submit convention (`FRONTEND-011-AC-12`) | `frontend_spec_011_recommendation_controls.md` |
| `seriesApi.getAll()` fetch-on-mount + `.catch(() => undefined)` pattern this spec's `getGenreOptions()` fetch mirrors | `frontend_spec_011_recommendation_controls.md` Requirement 2, `seriesApi.ts` |
| `RecommendationQuery.genres`, `RecommendationQuery` type | `frontend_spec_011_recommendation_controls.md` Requirement 1 (`FRONTEND-011-AC-01`) |
| Backend genre resolution this fixes the silent-failure symptom for (`resolveGenreIds`/`idFor`) | `series_spec_007_recommendation_sourcing.md` Requirement 5 |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (addition)

```typescript
describe('FRONTEND-014-AC-01: getGenreOptions', () => {
  it('fetches and unwraps the genre list', async () => {
    client.get.mockResolvedValue({ data: { data: ['Action', 'Drama'], count: 2 } })

    const result = await seriesApi.getGenreOptions()

    expect(client.get).toHaveBeenCalledWith('/series/genres')
    expect(result).toEqual(['Action', 'Drama'])
  })
})
```

### `src/components/RecommendationControls.test.tsx` (additions/changes)

```typescript
vi.mock('../services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)
const mockGetGenreOptions = vi.mocked(seriesApi.getGenreOptions)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAll.mockResolvedValue([])
  mockGetGenreOptions.mockResolvedValue([])
})

describe('FRONTEND-014-AC-02: fetches genre options on mount', () => {
  it('calls seriesApi.getGenreOptions() once on mount', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    expect(mockGetGenreOptions).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-014-AC-03: degrades gracefully if getGenreOptions() rejects', () => {
  it('does not crash and still renders the rest of the form', async () => {
    mockGetGenreOptions.mockRejectedValue(new Error('network error'))
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    await waitFor(() => expect(mockGetGenreOptions).toHaveBeenCalled())
    expect(screen.getByLabelText(/^keywords/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-014-AC-04/05: genre checkbox list', () => {
  it('renders a checkbox per fetched genre and toggles genresSelected on click', async () => {
    mockGetGenreOptions.mockResolvedValue(['Action', 'Drama'])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))

    const dramaCheckbox = await screen.findByLabelText('Drama')
    expect(screen.getByLabelText('Action')).toBeInTheDocument()

    fireEvent.click(dramaCheckbox)
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Drama'] }),
    )

    fireEvent.click(screen.getByLabelText('Action'))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Drama', 'Action'] }),
    )

    fireEvent.click(dramaCheckbox)
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Action'] }),
    )
  })
})

describe('FRONTEND-014-AC-06: free-text Genres input is gone', () => {
  it('does not render a text input labelled Genres', async () => {
    mockGetGenreOptions.mockResolvedValue(['Action'])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    await screen.findByLabelText('Action')

    expect(screen.queryByRole('textbox', { name: /^genres/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^keywords/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-014-AC-08: empty genresSelected omits genres from the query', () => {
  it('omits genres when no checkbox is checked', async () => {
    mockGetGenreOptions.mockResolvedValue(['Action'])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    fireEvent.change(screen.getByLabelText(/^keywords/i), { target: { value: 'heist' } })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ genres: expect.anything() }),
    )
  })
})

describe('FRONTEND-014-AC-09: hint reflects genresSelected/keywords emptiness', () => {
  it('hides the hint once a genre checkbox is checked, shows it again once unchecked', async () => {
    mockGetGenreOptions.mockResolvedValue(['Drama'])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    expect(
      screen.getByText(/enter at least one genre or keyword/i),
    ).toBeInTheDocument()

    const dramaCheckbox = await screen.findByLabelText('Drama')
    fireEvent.click(dramaCheckbox)
    expect(
      screen.queryByText(/enter at least one genre or keyword/i),
    ).not.toBeInTheDocument()

    fireEvent.click(dramaCheckbox)
    expect(
      screen.getByText(/enter at least one genre or keyword/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-014-AC-10: switching mode clears genresSelected', () => {
  it('clears checked genres when switching from Genre & Keyword to Specific Series', async () => {
    mockGetGenreOptions.mockResolvedValue(['Drama'])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    const dramaCheckbox = await screen.findByLabelText('Drama')
    fireEvent.click(dramaCheckbox)
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Drama'] }),
    )

    fireEvent.click(screen.getByLabelText(/specific series/i))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ genres: expect.anything() }),
    )
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-014-AC-01: `seriesApi.getGenreOptions()`
- [x] FRONTEND-014-AC-02: fetch genre options on mount, mirroring `allSeries`'s pattern
- [x] FRONTEND-014-AC-03: failed genre-options fetch degrades gracefully, doesn't break the form
- [x] FRONTEND-014-AC-04: genre checkbox list rendered under Genre & Keyword mode, series-picker pattern reused
- [x] FRONTEND-014-AC-05: checking/unchecking a genre toggles `genresSelected`, immediate `onQueryChange`
- [x] FRONTEND-014-AC-06: free-text Genres `<input>` removed; Keywords `<input>` unchanged
- [x] FRONTEND-014-AC-07: `ControlsState.genresSelected: string[]` replaces `genresText: string`
- [x] FRONTEND-014-AC-08: `buildQuery` populates `genres` from `genresSelected` directly, omits when empty
- [x] FRONTEND-014-AC-09: `showGenreKeywordHint` works against `genresSelected`
- [x] FRONTEND-014-AC-10: `handleModeChange` resets `genresSelected` on every mode switch
