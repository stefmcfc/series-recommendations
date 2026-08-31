# Frontend Spec 035: Specific Series Picker — Search, Sort, Filter & Shared Picker Component

**Status**: Partially implemented — Requirements 1–4 (`FRONTEND-035-AC-01`–`16`) shipped
2026-08-27 via `frontend/src/components/KeywordPicker.tsx` (Requirement 1, generalized `options:
string[] | PickerOption[]`), `frontend/src/components/RecommendationControls.tsx`/`.module.css`
(Requirements 2–4, KeywordPicker-based "Specific Series" mode, genre/status filters, client-side
sort, "Show all series" modal), `frontend/src/utils/keywordSuggestions.ts`
(`resolveSpecificSeriesPickerLimit`/`SPECIFIC_SERIES_PICKER_LIMIT`), plus corresponding
`*.test.tsx`/`*.test.ts` updates. **Requirement 5 (`FRONTEND-035-AC-17`, added 2026-08-31) is not
yet built** — see `ROADMAP.md`'s "Specced, coming soon" table.
**Priority**: P3 (quality-of-life — the current picker is fully functional, this addresses it becoming unwieldy as the tracked collection grows)
**Depends on**: Frontend Spec 011 (`frontend_spec_011_recommendation_controls.md`, owns `RecommendationControls.tsx` and today's "Specific Series" mode) ✅, Frontend Spec 029 (`frontend_spec_029_searchable_keyword_picker.md`, `KeywordPicker`'s current contract, `SearchFilter`'s "Browse all keywords" modal pattern being mirrored) ✅, Frontend Spec 032 (`frontend_spec_032_hybrid_keyword_suggestions.md`, the `VITE_*_LIMIT`/`resolveKeywordSuggestionsLimit` config pattern being mirrored) ✅, Frontend Spec 013 Requirement 4/5 only (`frontend_spec_013_star_ratings.md`, `SortOptions`'/`SeriesList`'s sort field list and labels being mirrored — **Requirements 1–3 of that spec are themselves still not started**, only its already-implemented sort-control portion is a safe precedent here), Series Spec 002 (`series_spec_002_crud.md`, `GET /api/v1/series` — confirms no backend change is needed)
**Frontend Stage**: 35 of N
**No backend spec or backend change is required.** `GET /api/v1/series` (Series Spec 002) already returns every field this spec needs (`id`, `title`, `status`, `genres`, `personalRating`, `imdbRating`, `tmdbRating`, `dateAdded`) via the same `seriesApi.getAll()` call `RecommendationControls` already makes today. `RecommendationQuery.seriesIds` (Frontend Spec 011) is completely unchanged — this spec only changes how the already-fetched series list is searched, filtered, sorted, and displayed client-side before the user picks from it.

## Overview

`RecommendationControls.tsx`'s "Specific Series" source mode currently renders one checkbox per tracked series, fetched once via `seriesApi.getAll()`, in whatever order the API returns them, with no search, filter, or cap — every series in the collection is always rendered as a checkbox. This was fine for a small collection; a live-review discussion flagged it as something that "is going to become quite large" and needs addressing before it does. This spec:

1. **Generalizes the existing `KeywordPicker` component** (today purely string-based — an option's display text *is* its selection/dedup key) to also support option objects with a distinct `id` (used for selection) and `label` (used for display/search), so the "Specific Series" picker can reuse it — series need to be selected by `id` (a UUID) since two tracked series could plausibly share a title, but `RecommendationQuery.seriesIds` and `ControlsState.selectedSeriesIds` are both already `id`-keyed today.
2. **Reuses `KeywordPicker` for the "Specific Series" picker itself**, gaining type-to-filter search, a capped default view with a "Show all" browse-all modal (identical pattern to `SearchFilter`'s existing "Browse all keywords"), and removable-chip display of already-selected series — all "for free" from the generalization in (1), no new picker UI built from scratch.
3. **Adds genre and status filtering** that narrow which series are offered by the picker at all (not sent to the backend — this is client-side narrowing of an already-fetched list, distinct from the existing `RecommendationQuery` output filters in the "Filters" section).
4. **Adds a sort control** reusing `SortOptions`' existing field set/labels, applied client-side to order the picker's candidate pool.

## Design Decisions

- **`KeywordPicker`'s prop contract generalizes rather than forks into a new component.** A new exported `PickerOption` interface (`{ id: string; label: string }`) is accepted by the existing `options` prop *in addition to* the existing `string[]` shape (`options?: string[] | PickerOption[]`), auto-detected at render time by inspecting the first element's type. `selected`/`onChange` keep their existing `string[]`/`(next: string[]) => void` signature everywhere — for a plain `string[]` `options` array, an option's `id` and `label` are identical (matching every current keyword call site's existing byte-for-byte behavior); for a `PickerOption[]` array, `selected` holds `id`s. This means **every existing keyword call site needs zero code changes** and their existing test suites should pass unmodified.
- **Not renamed.** `KeywordPicker.tsx`/`KeywordPicker` stays as the file and export name despite now handling non-keyword data, to avoid unnecessary import churn across three existing call sites for a cosmetic rename — a rename can be a separate follow-up if ever wanted.
- **Dedup/removal comparison differs by mode.** The existing `isSameKeyword` case-insensitive string compare (built for user-typed free-text keyword quirks) stays scoped to the legacy `string[]` path only. For `PickerOption[]`, dedup/removal/Backspace-removes-last-chip compare by exact `id` equality (`===`) — UUIDs don't have a meaningful "case variant" concern.
- **`allowFreeText` is meaningless for `PickerOption[]` and must not be passed alongside it.** Free text typed by the user can't resolve to a valid `id` for an item that doesn't exist yet — unlike a keyword, you can't "add" a series that isn't in your tracked collection. The Specific Series picker instance never sets `allowFreeText`.
- **Suggestion/search matching uses `label`, not `id`, for `PickerOption[]`.** `KeywordPicker`'s internal `typedMatches`/`emptyInputSuggestions` filtering (currently matching directly against the `string[]` option's own value) filters against `option.label` when given `PickerOption[]`, and renders `option.label` as both the suggestion button's text and the resulting chip's text.
- **Genre/status filtering and sort are picker-scoped UI state, not part of `ControlsState`.** They never feed `buildQuery`/`RecommendationQuery` — mirroring how `filtersOpen`/`allSeries`/`genreOptions`/`keywordOptions` are *already* separate `useState` calls outside `ControlsState` for the exact same reason (UI-local display concerns, not query-affecting fields). New state: `specificSeriesGenreFilter: string[]`, `specificSeriesStatusFilter: 'any' | 'completedOnly' | 'completedOrWatching'` (default `'any'`), `specificSeriesSortBy`/`specificSeriesSortDirection` (reusing `SortOptions`' field union, default `title`/`asc`), `specificSeriesBrowseModalOpen: boolean`.
- **Pipeline order is fixed and unambiguous**: fetched series → genre filter → status filter → client-side sort → handed to `KeywordPicker` as `options` (which itself applies the empty-input cap, or the typed-text search, entirely inside the existing generalized component). Changing the genre filter, status filter, or sort **never** alters `selectedSeriesIds` — already-selected chips stay selected and visible regardless of what the browsable list currently shows.
- **Sort defaults to `title`/`asc`, deliberately different from `SeriesList`'s own `dateAdded`/`desc` default.** This picker exists to find one specific show by name among many, not to see what's newest — alphabetical is the more useful default here, even though the field set/labels/direction-toggle shape is otherwise identical to `SeriesList`'s sort control.
- **Sort stays entirely client-side.** `seriesApi.getAll()` is still called with no arguments (as today) — `SortOptions` is reused only for its *type shape and labels*, not passed as a request parameter, since the full list is already fetched unconditionally and an in-memory `Array.prototype.sort` over it is simpler than round-tripping through the backend for a list that's already local.
- **Genre matching parses `Series.genres` (a comma-separated string field) client-side.** A series matches the genre filter when at least one selected genre appears in its `genres` field, case-insensitively, after splitting on `,` and trimming each segment. No selected genres means every series passes.
- **Genre filter options reuse the existing `seriesApi.getGenreOptions()` fetch** `RecommendationControls` already performs for Genre & Keyword mode — no new endpoint or fetch.
- **Status filter is three fixed radio options, not a generic multi-select of every `SeriesStatus` value** — "Any Status" (default), "Completed Only", "Completed or Watching" — per explicit instruction, since those are the only statuses meaningfully useful as a recommendation-source filter. Rendered as radio buttons (not a `<select>`) to match every other mode-scoped choice already in this exact component (source mode, trending window, sort-by are all radio groups).
- **The "Show all series" modal mirrors `SearchFilter`'s "Browse all keywords" dialog exactly**: same `role="dialog"`/`aria-modal`/`aria-labelledby`/Escape-to-dismiss/"Done" button structure, no React portal, bound to the *same* `selectedSeriesIds` state as the inline picker (no duplicate state) — the only differences are `options` (the same filtered/sorted `PickerOption[]`, but presented uncapped) and `focusOnMount`.
- **Configurable cap follows the exact `KEYWORD_SUGGESTIONS_LIMIT` pattern** (`frontend_spec_032`): a new `resolveSpecificSeriesPickerLimit`/`SPECIFIC_SERIES_PICKER_LIMIT` pair (co-located in `src/utils/keywordSuggestions.ts` alongside the existing keyword one, or a new sibling util file — implementer's call, either is fine as long as it's independently unit-testable), reading `VITE_SPECIFIC_SERIES_PICKER_LIMIT`, defaulting to `15` when unset/non-numeric/non-positive. This is a starting value, not a load-bearing number — the whole point of making it a `VITE_`-env-var constant (rather than a hardcoded literal) is that it's freely retunable later without a code change, per the explicit "future config param" request. No settings UI is built for this.
- **Breaking change to existing "Specific Series" tests' interaction shape — expected and necessary, not a defect.** Today's checkbox-per-series list means existing tests query `screen.getByLabelText(/ozark/i)` or `screen.findByLabelText('Ozark (COMPLETED)')` and `fireEvent.click(...)` a checkbox. Once the picker is `KeywordPicker`-based, selecting a series is "type or scroll to find it, then click its suggestion button" (`getByRole('button', { name: 'Ozark (COMPLETED)' })` in the suggestions list) — the *behavioral* AC intent of every affected existing test (that picking a series populates `selectedSeriesIds`/`seriesIds`) is unchanged, but the literal query/interaction needs updating. Per this project's ID-immutability convention, none of the following ACs are renumbered or reworded — their test code changes, their statements don't: `FRONTEND-011-AC-04`, `FRONTEND-011-AC-06`, `FRONTEND-011-AC-09` (`frontend_spec_011_recommendation_controls.md`), `FRONTEND-014-AC-10` (`frontend_spec_014_genre_dropdown.md`), `FRONTEND-027-AC-03`/`AC-04` (`frontend_spec_027_trending_and_top_rated_controls.md`), `FRONTEND-033-AC-02` (`frontend_spec_033_discover_native_sort_controls.md`), plus the unnumbered `"specific-series fetch failure"` describe block in `RecommendationControls.test.tsx`. The implementer should grep `RecommendationControls.test.tsx` for `specific series`/`getByLabelText(/ozark/i)`-style queries against series checkboxes and update each to the new suggestion-button interaction, not just add new tests for this spec's own ACs.

---

## Requirement 1: Generalize `KeywordPicker` for id/label option objects

**User story**: As a developer, I want `KeywordPicker` to support selecting an item by a stable id distinct from its display text, so components that can't use display text as a selection key (like a series picker, where titles aren't unique) can still reuse this shared component.

### FRONTEND-035-AC-01 [AUTO]
**Statement**: `KeywordPicker`'s `options` prop shall accept `string[] | PickerOption[]` (`PickerOption` a new exported `{ id: string; label: string }` interface), auto-detected by the shape of the first element. Existing behavior for `options?: string[]` (or `undefined`) shall be entirely unchanged.

**References**: `frontend/src/components/KeywordPicker.tsx`.

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-01: existing string[] options behavior is unaffected', () => {
  render(
    <KeywordPicker id="k" label="Keywords" selected={[]} onChange={vi.fn()} options={['spy', 'grim']} />,
  )
  fireEvent.change(screen.getByLabelText('Keywords'), { target: { value: 'sp' } })
  expect(screen.getByRole('button', { name: 'spy' })).toBeInTheDocument()
})
```

**Test Case (Green)**: add the `PickerOption` type, a type-guard/normalization step at the top of the component that maps whatever `options` shape was passed into a uniform internal `PickerOption[]` (for `string[]`, `id === label === value`), and use that normalized array everywhere the component currently reads `options` directly.

---

### FRONTEND-035-AC-02 [AUTO]
**Statement**: When `options` is `PickerOption[]`, suggestion filtering/matching (both typed and empty-input) shall match against each option's `label`, chips shall display `label`, and `selected`/`onChange` shall carry `id` strings. Dedup/removal comparisons shall use exact `id` equality, not the existing case-insensitive `isSameKeyword` helper (which stays scoped to the `string[]` path).

**References**: `KeywordPicker.tsx`'s `typedMatches`/`emptyInputSuggestions`/`addKeyword`/`removeKeyword`/`isSameKeyword`.

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-02: PickerOption[] selects by id, displays by label', () => {
  const onChange = vi.fn()
  render(
    <KeywordPicker
      id="s"
      label="Series"
      selected={[]}
      onChange={onChange}
      options={[{ id: 'abc-123', label: 'Ozark (COMPLETED)' }]}
    />,
  )
  fireEvent.change(screen.getByLabelText('Series'), { target: { value: 'ozark' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ozark (COMPLETED)' }))
  expect(onChange).toHaveBeenCalledWith(['abc-123'])
})

it('FRONTEND-035-AC-02: an already-selected id is not offered again, matched by id not label', () => {
  render(
    <KeywordPicker
      id="s"
      label="Series"
      selected={['abc-123']}
      onChange={vi.fn()}
      options={[{ id: 'abc-123', label: 'Ozark (COMPLETED)' }]}
    />,
  )
  expect(screen.getByText('Ozark (COMPLETED)')).toBeInTheDocument() // renders as a chip
  expect(screen.queryByRole('button', { name: 'Ozark (COMPLETED)' })).not.toBeInTheDocument() // not also a suggestion
})
```

**Test Case (Green)**: thread the normalized `PickerOption[]` through the existing filtering/rendering logic, swapping the `isSameKeyword(a, b)` calls for an `id`-equality check gated on which `options` shape was passed (or, simpler: always compare by `id` internally once every option — string or object — has been normalized to carry an `id`, and keep `isSameKeyword`'s case-insensitivity *only* for the free-text-add path where a freshly-typed string has no pre-existing `id` to compare against).

---

### FRONTEND-035-AC-03 [AUTO]
**Statement**: When `options` is `PickerOption[]`, `allowFreeText` shall have no effect — pressing Enter with no exact matching suggestion shall add nothing.

**References**: `KeywordPicker.tsx`'s `handleKeyDown`.

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-03: Enter with no match adds nothing for PickerOption[] options', () => {
  const onChange = vi.fn()
  render(
    <KeywordPicker
      id="s"
      label="Series"
      selected={[]}
      onChange={onChange}
      options={[{ id: 'abc-123', label: 'Ozark (COMPLETED)' }]}
    />,
  )
  fireEvent.change(screen.getByLabelText('Series'), { target: { value: 'no such show' } })
  fireEvent.keyDown(screen.getByLabelText('Series'), { key: 'Enter' })
  expect(onChange).not.toHaveBeenCalled()
})
```

**Test Case (Green)**: gate the free-text-add branch in `handleKeyDown` on `options` being absent or a `string[]`.

---

### FRONTEND-035-AC-04 [AUTO]
**Statement**: Every existing `KeywordPicker` call site (`RecommendationControls`' Genre & Keyword mode, `SearchFilter`'s inline field, `SearchFilter`'s browse-all modal) shall continue to pass `string[]` `options` and shall be unaffected by this generalization — their existing test suites shall pass unmodified.

**References**: `RecommendationControls.tsx`, `SearchFilter.tsx`, and their existing `*.test.tsx` files.

**Test Case (Red)**: none new — this AC is a regression guard. **Test Case (Green)**: run the existing `KeywordPicker.test.tsx`, `RecommendationControls.test.tsx`, and `SearchFilter.test.tsx` suites unmodified; all must stay green.

---

## Requirement 2: "Specific Series" mode uses the generalized `KeywordPicker`

**User story**: As a user picking specific series to source recommendations from, I want to search by typing instead of scrolling a long checkbox list, and still see what I've already picked as removable chips, so a large tracked collection stays easy to work with.

### FRONTEND-035-AC-05 [AUTO]
**Statement**: `RecommendationControls`' "Specific Series" mode shall render a `KeywordPicker` instance in place of today's checkbox-per-series list, with `options` built as `PickerOption[]` — one entry per series in the (genre/status-filtered, sorted — Requirements 3/4) candidate pool, `{ id: s.id, label: "${s.title} (${s.status})" }` (the exact display text already used today, unchanged).

**Correction (2026-08-27, implementation)**: this AC's own `label` shorthand is an inaccurate paraphrase of "today's" actual format — verified against the pre-existing checkbox label JSX (`RecommendationControls.tsx`, prior to this spec), which was `"{title}{year ? ' (' + year + ')' : ''}{country ? ' — ' + formattedCountry : ''} ({status})"`, not the simpler `"{title} ({status})"` written above. Implemented to match the real prior format (title, optional year, optional country, status) rather than the AC statement's simplified text, per the AC's own instruction to keep "the exact display text already used today, unchanged."

**References**: `RecommendationControls.tsx`, the `state.mode === 'specific'` render branch.

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-05: renders a KeywordPicker with one option per series', async () => {
  mockGetAll.mockResolvedValue([
    makeSeries({ id: '1', title: 'Ozark', status: 'COMPLETED' }),
    makeSeries({ id: '2', title: 'The Wire', status: 'WATCHING' }),
  ])
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/specific series/i))

  expect(await screen.findByLabelText(/series/i)).toBeInTheDocument() // the picker's text input
  fireEvent.change(screen.getByLabelText(/series/i), { target: { value: 'ozark' } })
  expect(await screen.findByRole('button', { name: 'Ozark (COMPLETED)' })).toBeInTheDocument()
})
```

**Test Case (Green)**: replace the current `allSeries.map(...)` checkbox rendering with a `KeywordPicker`, computing its `options` prop from the filtered/sorted series array.

---

### FRONTEND-035-AC-06 [AUTO]
**Statement**: Selecting a suggestion shall add that series' `id` to `state.selectedSeriesIds`. `buildQuery`'s existing `seriesIds` behavior (populated only in `specific` mode, only when non-empty) shall be unchanged.

**References**: `RecommendationControls.tsx`'s `buildQuery`, `handleSeriesToggle` (replaced by a `KeywordPicker` `onChange` handler).

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-06: picking a series populates seriesIds in the emitted query', async () => {
  mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Ozark', status: 'COMPLETED' })])
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} />)
  fireEvent.click(screen.getByLabelText(/specific series/i))

  fireEvent.change(await screen.findByLabelText(/series/i), { target: { value: 'ozark' } })
  fireEvent.click(await screen.findByRole('button', { name: 'Ozark (COMPLETED)' }))

  expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ seriesIds: ['1'] }))
})
```

**Test Case (Green)**: wire `KeywordPicker`'s `onChange` to `updateState({ selectedSeriesIds: next })`, same as today's `handleSeriesToggle` did.

---

### FRONTEND-035-AC-07 [AUTO]
**Statement**: Already-selected series shall render as removable chips, independent of the current genre filter, status filter, sort, or search text. Changing any of those shall never alter `selectedSeriesIds`.

**References**: `KeywordPicker.tsx`'s existing chip rendering (unchanged by this spec) plus `RecommendationControls.tsx`'s new filter/sort state.

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-07: a selected series stays selected after changing the genre filter', async () => {
  mockGetAll.mockResolvedValue([
    makeSeries({ id: '1', title: 'Ozark', status: 'COMPLETED', genres: 'Crime, Drama' }),
    makeSeries({ id: '2', title: 'Ted Lasso', status: 'COMPLETED', genres: 'Comedy' }),
  ])
  mockGetGenreOptions.mockResolvedValue(['Crime', 'Comedy'])
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} />)
  fireEvent.click(screen.getByLabelText(/specific series/i))
  fireEvent.change(await screen.findByLabelText(/series/i), { target: { value: 'ozark' } })
  fireEvent.click(await screen.findByRole('button', { name: 'Ozark (COMPLETED)' }))

  fireEvent.click(screen.getByLabelText('Comedy')) // genre filter checkbox, narrows away from Ozark

  expect(screen.getByText('Ozark (COMPLETED)')).toBeInTheDocument() // still shown as a chip
  expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ seriesIds: ['1'] }))
})
```

**Test Case (Green)**: no special handling needed beyond correctly wiring `selected={state.selectedSeriesIds}` — this is `KeywordPicker`'s existing, unmodified chip behavior; the test exists to pin it explicitly for this new consumer.

---

### FRONTEND-035-AC-08 [AUTO]
**Statement**: The picker's default (empty-input) suggestion list shall be capped at `SPECIFIC_SERIES_PICKER_LIMIT`, resolved from `import.meta.env.VITE_SPECIFIC_SERIES_PICKER_LIMIT` via a `resolveSpecificSeriesPickerLimit` function mirroring `resolveKeywordSuggestionsLimit`'s exact validation (undefined/non-numeric/non-positive falls back to a default of `15`), passed as `KeywordPicker`'s `maxSuggestionsWhenEmpty` prop.

**References**: `src/utils/keywordSuggestions.ts` (existing `resolveKeywordSuggestionsLimit`/`KEYWORD_SUGGESTIONS_LIMIT` precedent).

**Test Case (Red)**:
```typescript
// src/utils/keywordSuggestions.test.ts (or a new sibling util's own test file)
it('FRONTEND-035-AC-08: resolveSpecificSeriesPickerLimit falls back to 15 when unset/invalid', () => {
  expect(resolveSpecificSeriesPickerLimit(undefined)).toBe(15)
  expect(resolveSpecificSeriesPickerLimit('not-a-number')).toBe(15)
  expect(resolveSpecificSeriesPickerLimit('0')).toBe(15)
  expect(resolveSpecificSeriesPickerLimit('25')).toBe(25)
})
```

**Test Case (Green)**: add the function/constant pair, mirroring `resolveKeywordSuggestionsLimit`'s implementation with a different default.

---

### FRONTEND-035-AC-09 [AUTO]
**Statement**: A "Show all series" button shall open a modal (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape-to-dismiss, a "Done" button — same structure as `SearchFilter`'s existing "Browse all keywords" dialog) containing a second `KeywordPicker` instance bound to the same `selectedSeriesIds`/`onChange` and the same filtered/sorted `PickerOption[]`, with `maxSuggestionsWhenEmpty` omitted (uncapped) and `focusOnMount` set. Opening the modal shall not re-fetch `seriesApi.getAll()`.

**References**: `SearchFilter.tsx`'s `browseModalOpen`/`handleModalKeyDown`/dialog JSX (the pattern being mirrored).

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-09: Show all series opens an uncapped picker modal, sharing selection state', async () => {
  mockGetAll.mockResolvedValue(
    Array.from({ length: 20 }, (_, i) => makeSeries({ id: String(i), title: `Show ${i}` })),
  )
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/specific series/i))
  await screen.findByLabelText(/series/i)

  fireEvent.click(screen.getByRole('button', { name: /show all series/i }))

  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Show 19 (BACKLOG)')).toBeInTheDocument() // beyond the default cap, visible uncapped
  expect(mockGetAll).toHaveBeenCalledTimes(1) // no re-fetch on open
})
```

**Test Case (Green)**: add `specificSeriesBrowseModalOpen` state and the dialog JSX, copying `SearchFilter`'s modal structure.

---

## Requirement 3: Genre & status filtering narrow the picker's candidate pool

**User story**: As a user with many tracked series, I want to narrow the picker down to (for example) just my completed Dramas, so I don't have to search through everything else to find plausible source series.

### FRONTEND-035-AC-10 [AUTO]
**Statement**: The "Specific Series" mode shall render a genre filter (checkbox list, sourced from the existing `seriesApi.getGenreOptions()` fetch already performed for Genre & Keyword mode) and a status filter (three radio options — see `FRONTEND-035-AC-12`), both scoped to this picker only. Neither is part of `RecommendationQuery`/`buildQuery`'s output.

**References**: `RecommendationControls.tsx`'s existing `genreOptions` state/fetch.

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-10: genre/status filters render but never appear in the emitted query', async () => {
  mockGetGenreOptions.mockResolvedValue(['Drama'])
  mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Ozark', genres: 'Drama' })])
  const onQueryChange = vi.fn()
  render(<RecommendationControls onQueryChange={onQueryChange} />)
  fireEvent.click(screen.getByLabelText(/specific series/i))

  fireEvent.click(await screen.findByLabelText('Drama')) // genre filter checkbox
  fireEvent.click(screen.getByLabelText(/completed only/i)) // status filter radio

  const lastCall = onQueryChange.mock.calls.at(-1)![0]
  expect(lastCall).not.toHaveProperty('genres')
  expect(lastCall).not.toHaveProperty('status')
})
```

**Test Case (Green)**: add the new filter state and UI, deliberately not threading it into `buildQuery`.

---

### FRONTEND-035-AC-11 [AUTO]
**Statement**: A series shall match the genre filter when at least one selected genre appears in that series' comma-separated `genres` field (case-insensitive, each segment trimmed). No genres selected means every series passes.

**References**: `Series.genres` (`string | null`, comma-separated).

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-11: genre filter matches case-insensitively within the comma-separated field', async () => {
  mockGetGenreOptions.mockResolvedValue(['Comedy'])
  mockGetAll.mockResolvedValue([
    makeSeries({ id: '1', title: 'Ted Lasso', genres: 'comedy, Sport' }),
    makeSeries({ id: '2', title: 'Ozark', genres: 'Crime, Drama' }),
  ])
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/specific series/i))
  fireEvent.click(await screen.findByLabelText('Comedy'))

  fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText(/Ted Lasso/)).toBeInTheDocument()
  expect(within(dialog).queryByText(/Ozark/)).not.toBeInTheDocument()
})
```

**Test Case (Green)**: `series.genres?.split(',').map(g => g.trim().toLowerCase()) ?? []` intersected against the selected genre filter (also lower-cased).

---

### FRONTEND-035-AC-12 [AUTO]
**Statement**: A series shall match the status filter as follows: "Any Status" (default) — every series passes; "Completed Only" — only `status === 'COMPLETED'`; "Completed or Watching" — `status === 'COMPLETED' || status === 'WATCHING'`.

**References**: `SeriesStatus`.

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-12: "Completed or Watching" includes both statuses, excludes others', async () => {
  mockGetAll.mockResolvedValue([
    makeSeries({ id: '1', title: 'Ozark', status: 'COMPLETED' }),
    makeSeries({ id: '2', title: 'The Wire', status: 'WATCHING' }),
    makeSeries({ id: '3', title: 'Firefly', status: 'DROPPED' }),
  ])
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/specific series/i))
  fireEvent.click(await screen.findByLabelText(/completed or watching/i))

  fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText(/Ozark/)).toBeInTheDocument()
  expect(within(dialog).getByText(/The Wire/)).toBeInTheDocument()
  expect(within(dialog).queryByText(/Firefly/)).not.toBeInTheDocument()
})
```

**Test Case (Green)**: a small switch/lookup over `specificSeriesStatusFilter`.

---

### FRONTEND-035-AC-13 [AUTO]
**Statement**: The candidate pool shall be computed in this fixed order: fetched series → genre filter → status filter → client-side sort (Requirement 4) → handed to `KeywordPicker` as `options` (which applies its own cap or typed-text search internally).

**References**: the combined filter/sort computation feeding both the inline picker and the browse-all modal.

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-13: filtering then sorting determines which series are capped away', async () => {
  mockGetGenreOptions.mockResolvedValue(['Drama'])
  mockGetAll.mockResolvedValue([
    makeSeries({ id: '1', title: 'B Show', genres: 'Drama', status: 'COMPLETED' }),
    makeSeries({ id: '2', title: 'A Show', genres: 'Drama', status: 'COMPLETED' }),
    makeSeries({ id: '3', title: 'Z Show', genres: 'Comedy', status: 'COMPLETED' }), // filtered out by genre
  ])
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/specific series/i))
  fireEvent.click(await screen.findByLabelText('Drama'))

  fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
  const dialog = screen.getByRole('dialog')
  const suggestionTexts = within(dialog)
    .getAllByRole('button')
    .map((b) => b.textContent)
    .filter((t) => t?.includes('Show'))
  expect(suggestionTexts).toEqual(['A Show (COMPLETED)', 'B Show (COMPLETED)']) // sorted after filtering, Z Show absent
})
```

**Test Case (Green)**: a single `useMemo`-style derived array computed in the stated order, shared by both the inline picker and the modal.

---

## Requirement 4: Sort control for the picker's candidate pool

**User story**: As a user scanning for a specific show by name, I want the picker's list sorted (by title by default), so I don't have to hunt through an arbitrary order.

### FRONTEND-035-AC-14 [AUTO]
**Statement**: The "Specific Series" mode shall render a sort control reusing `SortOptions`' existing field set and labels ("Date Added"/"Personal Rating"/"Title"/"Year"/"IMDb Rating"/"TMDB Rating") plus a direction toggle, mirroring `SeriesList`'s sort control's shape. Sorting shall be applied client-side (`Array.prototype.sort` over the fetched/filtered series) — `seriesApi.getAll()` is still called with no arguments, never a `sort` parameter.

**References**: `frontend/src/types/series.ts`'s `SortOptions`, `SeriesList.tsx`'s `SORT_BY_OPTIONS`/sort control (field-list/labels precedent only — the mechanism itself is client-side here, not a request parameter).

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-14: sort control reorders the picker without re-fetching', async () => {
  mockGetAll.mockResolvedValue([
    makeSeries({ id: '1', title: 'B Show' }),
    makeSeries({ id: '2', title: 'A Show' }),
  ])
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/specific series/i))
  await screen.findByLabelText(/series/i)

  fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
  const dialog = screen.getByRole('dialog')
  const initialOrder = within(dialog)
    .getAllByRole('button')
    .map((b) => b.textContent)
    .filter((t) => t?.includes('Show'))
  expect(initialOrder).toEqual(['A Show (COMPLETED)', 'B Show (COMPLETED)']) // default title/asc

  expect(mockGetAll).toHaveBeenCalledTimes(1)
})
```

**Test Case (Green)**: add the sort control + client-side comparator, reusing `SortOptions`' type.

---

### FRONTEND-035-AC-15 [AUTO]
**Statement**: The sort control's default shall be `title`/`asc`.

**References**: contrast with `SeriesList`'s own `dateAdded`/`desc` default (`series_spec_009_rating_sort.md`, `SERIES-009-AC-06`) — deliberately different here.

**Test Case (Red)**: covered by `FRONTEND-035-AC-14`'s test above (asserts the default order without touching the sort control first).

**Test Case (Green)**: initialize `specificSeriesSortBy`/`specificSeriesSortDirection` state to `'title'`/`'asc'`.

---

### FRONTEND-035-AC-16 [AUTO]
**Statement**: `null` values for the selected sort field shall sort last, regardless of direction — matching `series_spec_009_rating_sort.md`'s existing null-last convention for backend sorts, kept for consistency even though this sort runs client-side.

**References**: `series_spec_009_rating_sort.md` (`SERIES-009-AC-04`, null-last precedent).

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-16: null personalRating sorts last regardless of direction', async () => {
  mockGetAll.mockResolvedValue([
    makeSeries({ id: '1', title: 'No Rating', personalRating: null }),
    makeSeries({ id: '2', title: 'Rated', personalRating: 4 }),
  ])
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/specific series/i))
  await screen.findByLabelText(/series/i)

  fireEvent.change(screen.getByLabelText(/sort by/i), { target: { value: 'personalRating' } })
  fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
  const dialog = screen.getByRole('dialog')
  const order = within(dialog)
    .getAllByRole('button')
    .map((b) => b.textContent)
  expect(order).toEqual(['Rated (COMPLETED)', 'No Rating (COMPLETED)'])
})
```

**Test Case (Green)**: comparator treats `null` as always-last, independent of the ascending/descending toggle.

---

## Requirement 5 (added 2026-08-31): Status suffix only shown at "Any Status"

**User story**: As a user who's narrowed the picker to "Completed Only" or "Completed or Watching",
I don't need every single suggestion to repeat a status I've already filtered down to — I only need
to see each series' status when the pool is a genuine mix of statuses.

### FRONTEND-035-AC-17 [AUTO]
**Statement**: `seriesPickerLabel` and `seriesPickerDisplay` shall omit the trailing `- {status}`
segment (and its bold/italic rendering in `seriesPickerDisplay`) when `specificSeriesStatusFilter`
is `'completedOnly'` or `'completedOrWatching'`. When `specificSeriesStatusFilter` is `'any'`
(the default), both functions shall continue to include the status segment exactly as today.

**References**: `seriesPickerLabel`/`seriesPickerDisplay` (`RecommendationControls.tsx`);
`SpecificSeriesStatusFilter`, `filterSpecificSeriesByStatus`; `FRONTEND-035-AC-12`'s original status
filter values, unchanged.

**Test Case (Red)**:
```typescript
it('FRONTEND-035-AC-17: status suffix hidden once the status filter narrows to one value', async () => {
  mockGetAll.mockResolvedValue([
    makeSeries({ id: '1', title: 'Ozark', year: 2017, status: 'COMPLETED' }),
  ])
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/specific series/i))
  fireEvent.click(await screen.findByLabelText(/completed only/i))

  fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Ozark (2017)')).toBeInTheDocument()
  expect(within(dialog).queryByText(/COMPLETED/)).not.toBeInTheDocument()
})

it('FRONTEND-035-AC-17: status suffix shown at Any Status (default)', async () => {
  mockGetAll.mockResolvedValue([
    makeSeries({ id: '1', title: 'Ozark', year: 2017, status: 'COMPLETED' }),
  ])
  render(<RecommendationControls onQueryChange={vi.fn()} />)
  fireEvent.click(screen.getByLabelText(/specific series/i))

  fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText(/Ozark.*COMPLETED/)).toBeInTheDocument()
})
```
**Test Case (Green)**: both `seriesPickerLabel`/`seriesPickerDisplay` gain a `statusFilter:
SpecificSeriesStatusFilter` parameter (threaded through from the same call sites that already pass
`specificSeriesStatusFilter` to `filterSpecificSeriesByStatus`), appending the status segment only
when `statusFilter === 'any'`.

---

## Cross-References

| This spec | Source |
|---|---|
| `KeywordPicker`'s current string-based contract, chip/suggestion rendering, `isSameKeyword`, `handleKeyDown`, browse-all-modal precedent | `frontend_spec_029_searchable_keyword_picker.md` |
| `maxSuggestionsWhenEmpty`/`allowFreeText`, `resolveKeywordSuggestionsLimit`/`KEYWORD_SUGGESTIONS_LIMIT` config pattern | `frontend_spec_032_hybrid_keyword_suggestions.md` |
| `RecommendationControls.tsx`'s `ControlsState`, `buildQuery`, existing `allSeries`/`genreOptions` fetches, today's checkbox-per-series "Specific Series" mode being replaced | `frontend_spec_011_recommendation_controls.md` |
| `SortOptions` type, `SeriesList`'s sort control field list/labels (mechanism itself not reused — client-side here) | `frontend_spec_013_star_ratings.md` Requirement 4/5 (only the implemented portion) |
| Null-last sort convention | `series_spec_009_rating_sort.md` |
| `GET /api/v1/series` response shape, confirming no backend change needed | `series_spec_002_crud.md` |
| Existing tests whose "Specific Series" interaction queries need updating (not their AC statements) | `frontend_spec_011_recommendation_controls.md` (`FRONTEND-011-AC-04`/`AC-06`/`AC-09`), `frontend_spec_014_genre_dropdown.md` (`FRONTEND-014-AC-10`), `frontend_spec_027_trending_and_top_rated_controls.md` (`FRONTEND-027-AC-03`/`AC-04`), `frontend_spec_033_discover_native_sort_controls.md` (`FRONTEND-033-AC-02`) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-035-AC-01: `KeywordPicker.options` accepts `string[] | PickerOption[]`, string behavior unchanged
- [x] FRONTEND-035-AC-02: `PickerOption[]` selects/dedups by `id`, displays by `label`
- [x] FRONTEND-035-AC-03: `allowFreeText` is a no-op for `PickerOption[]`
- [x] FRONTEND-035-AC-04: every existing keyword call site unaffected
- [x] FRONTEND-035-AC-05: "Specific Series" mode renders a `KeywordPicker`, one `PickerOption` per candidate series
- [x] FRONTEND-035-AC-06: picking a suggestion populates `selectedSeriesIds`/`seriesIds`
- [x] FRONTEND-035-AC-07: selected series render as chips, unaffected by filter/sort changes
- [x] FRONTEND-035-AC-08: default view capped at configurable `SPECIFIC_SERIES_PICKER_LIMIT` (default 15)
- [x] FRONTEND-035-AC-09: "Show all series" modal, uncapped, shared selection state, no re-fetch
- [x] FRONTEND-035-AC-10: genre + status filters render, scoped to the picker only (not in `RecommendationQuery`)
- [x] FRONTEND-035-AC-11: genre filter matches case-insensitively within the comma-separated field
- [x] FRONTEND-035-AC-12: status filter — Any / Completed Only / Completed or Watching
- [x] FRONTEND-035-AC-13: fixed pipeline order — filter → sort → cap/search
- [x] FRONTEND-035-AC-14: sort control reusing `SortOptions` field set/labels, client-side only
- [x] FRONTEND-035-AC-15: sort defaults to `title`/`asc`
- [x] FRONTEND-035-AC-16: `null` sort values sort last
- [ ] FRONTEND-035-AC-17: status suffix hidden unless the status filter is "Any Status" (added 2026-08-31)
