# Frontend Spec 011: Recommendation Sourcing & Filter Controls

**Status**: Done (Requirements 1–5). **Requirement 5 (2026-08-23)**: replaced the free-text "Keywords" input under `Genre & Keyword` mode with a fixed-vocabulary checkbox multi-select sourced from `GET /series/keywords`, matching `SearchFilter`'s own keyword picker (`frontend_spec_024_keyword_tracking.md`) and this same component's existing `genres` checkbox-list precedent. **Superseded (2026-08-24)**: Requirement 5's checkbox multi-select (`FRONTEND-011-AC-14`–`AC-18`) was replaced by `frontend_spec_029_searchable_keyword_picker.md` Requirement 2, which swaps the Keywords field to the shared `KeywordPicker` component in free-text mode (type-and-Enter, no longer constrained to the tracked vocabulary) and removes the `getKeywordStats()` fetch this requirement added. This section is left as-is for history; `frontend_spec_029` is the current source of truth for this field's contract.

Original scope (Requirements 1–4) — all 13 acceptance criteria implemented and covered by Vitest (`npm test`: 210/210 passing across the suite), `npm run lint` clean, `npm run build` clean. Requirement 5 (5 more acceptance criteria) verified the same way: `npm test`: 333/333 passing across the full suite (29/29 in `RecommendationControls.test.tsx`), `npm run lint` clean, `npm run build` clean. Additionally verified against the real backend (`gradlew.bat bootRun`, no `APP_TMDB_API_KEY` configured in this environment): `GET /api/v1/series/keywords` returns real keyword data from this collection, and `GET /api/v1/series/recommendations?keywords=spy` returns `200` (confirming the endpoint accepts and processes the param rather than rejecting it) — a full browser click-through was not additionally captured for this narrowly-scoped follow-up, since it reuses `SearchFilter`'s already browser-verified checkbox-list pattern verbatim (`frontend_spec_024_keyword_tracking.md`) with no new interaction shape introduced.

Files touched (Requirements 1–4): `frontend/src/types/series.ts` (new `RecommendationQuery` interface), `frontend/src/services/seriesApi.ts` + `frontend/src/services/__tests__/seriesApi.test.ts` (`getRecommendations` signature changed from `(limit?: number)` to `(query?: RecommendationQuery)`, new `buildRecommendationParams` helper joining array fields with commas and omitting absent/empty fields; the pre-existing `getRecommendations(10)` call-site test was updated to `getRecommendations({ limit: 10 })` to match the new signature), `frontend/src/components/RecommendationControls.tsx` + `.test.tsx` + `.module.css` (new component — three-way radio mode selector `Automatic`/`Specific Series`/`Genre & Keyword`, `Specific Series` checkbox multi-select populated from `seriesApi.getAll()`, `Genre & Keyword` comma-separated text inputs with an at-least-one hint, a collapsed-by-default `Filters` section covering every Series Spec 007 output filter plus a mode-gated `minSourceRating` dropdown, and a `Reset Filters` action that clears only the filter fields), `frontend/src/components/RecommendationsList.tsx` + `.test.tsx` (new optional `query?: RecommendationQuery` prop, threaded into `getRecommendations` and added to the existing `refreshIndex`-keyed effect's dependency array), `frontend/src/App.tsx` + `frontend/src/App.test.tsx` (new `recommendationQuery` state, `RecommendationControls` rendered above `RecommendationsList` only in the Recommendations view, wired via `onQueryChange`/`query`).

**Files touched (Requirement 5, 2026-08-23)**: `frontend/src/components/RecommendationControls.tsx` (`ControlsState.keywordsText: string` replaced with `keywordsSelected: string[]`; new `getKeywordStats()` effect on mount alongside the existing `getGenreOptions()` effect; the `Genre & Keyword` mode's Keywords field is now a checkbox multi-select — identical markup/interaction shape to the adjacent `genresSelected` list — instead of a free-text `recommendation-keywords` input; `buildQuery` populates `query.keywords` from `keywordsSelected` directly; mode-switch clearing and the at-least-one hint both recomputed off `keywordsSelected`; a `getKeywordStats()` rejection renders a scoped `role="alert"` error in place of the checkbox list without affecting the rest of the panel), `frontend/src/components/RecommendationControls.module.css` (new `.keywordError` class, copied from `SearchFilter.module.css`'s own), `frontend/src/components/RecommendationControls.test.tsx` (new `mockGetKeywordStats` mock; three pre-existing tests that exercised the old free-text `recommendation-keywords` input — the `getGenreOptions()`-rejection smoke test, the "free-text Genres input is gone" test, and the "empty genresSelected omits genres" test — updated to the new checkbox shape; five new test blocks for AC-14 through AC-18).

**Design/implementation note**: `RecommendationControls` emits changes by computing the next full state object directly (`{ ...state, ...patch }`) and calling both `setState` and `onQueryChange` with it synchronously in the event handler, rather than deriving the next value inside a `setState` updater callback — the latter triggered a real React warning ("Cannot update a component while rendering a different component") in a live browser check, because the updater runs during React's render phase and calling the parent's `setState` (`App`'s `setRecommendationQuery`) from inside it is exactly the case that warning covers. Caught only by the real-browser pass below, not by jsdom/Vitest.

**Real-browser verification**: with the real backend running (`gradlew.bat bootRun`) and `npm run dev`, verified via a scripted Puppeteer pass (using this machine's already-cached Puppeteer Chrome build, executed as an ad hoc script outside the repo — no new dependency added to `frontend/package.json`) against the live dev server and real backend, no mocking: Recommendations view opens with `RecommendationControls` visible only there (not on "My Series"); switching to "Specific Series" fetches and renders one checkbox per real tracked series via `seriesApi.getAll()`; switching to "Genre & Keyword" shows the at-least-one hint, which disappears once a genre is typed; the Filters section is collapsed by default and expands on click; `minSourceRating` is present in Automatic/Specific Series modes and absent in Genre & Keyword mode; Reset Filters clears a populated `minTmdbRating` field back to empty; and network capture confirmed real `GET /series/recommendations` requests were sent with the correct query string as controls changed (`?seriesIds=<real-id>`, then `?seriesIds=<real-id>&minTmdbRating=7`), with zero console/page errors after the fix above. TMDB itself is not configured in this environment (same caveat as Frontend Spec 010), so the populated-recommendations-list rendering from a real TMDB-backed response was not re-verified here — that path is unchanged by this spec (Requirement 4's "no changes to card rendering" design decision) and was already verified under Frontend Spec 010.
**Amendment (2026-08-26, live review)**: `FRONTEND-011-AC-04`'s "Specific Series" checkbox label
gains the series' year and origin country alongside the existing title/status — a live-review
report that two tracked series sharing a title (e.g. two different `Ozark`-named shows) couldn't
be told apart in this picker. Purely additive to the existing AC statement (title and status are
still shown, unchanged); no new acceptance criteria. Label format:
`{title} ({year}) — {country} ({status})`, omitting the year/country segment when either field is
`null` — matching the same conditional-segment pattern already used by `AddSeriesForm`'s TMDB
candidate list. Files touched: `frontend/src/components/RecommendationControls.tsx` (the
`Specific Series` `<label>`), `frontend/src/components/RecommendationControls.test.tsx`.
**Depends on**: Frontend Spec 010 (`RecommendationsList`, `Recommendation` type, `seriesApi.getRecommendations`) ✅, Series Spec 007 (`seriesIds`/`genres`/`keywords`/`minSourceRating`/`minTmdbRating`/`minVoteCount`/`yearMin`/`yearMax`/`excludeGenres`/`language`/`maxPerSource` query params) ✅
**Frontend Stage**: 11 of N

## Overview

Adds a control panel above `RecommendationsList` — analogous to `SearchFilter`'s relationship with `SeriesList` — that exposes Series Spec 007's new sourcing modes and output filters. A user picks one of three sourcing modes (automatic from watch history, specific series, or genre/keyword direct), optionally narrows the result with output filters, and the resulting query is sent to the already-existing `GET /series/recommendations` endpoint via an extended `seriesApi.getRecommendations`.

**Design decisions**:
- **Sourcing mode is a single radio-button choice (`Automatic` / `Specific Series` / `Genre & Keyword`), not three independently-fillable sections.** Series Spec 007 rejects a request with both `seriesIds` and `genres`/`keywords` set (`SERIES-007-AC-17`, `400`). Modeling this as mutually-exclusive UI up front means the invalid combination can't be constructed in the first place, rather than letting the user hit a 400 and having to explain why.
- **The "Specific Series" picker is populated from `seriesApi.getAll()`**, not a new endpoint — every tracked series is a valid pick regardless of status (`SERIES-007-AC-08`), and `getAll()` already returns exactly that list.
- **`minSourceRating` is only shown for `Automatic`/`Specific Series` modes**, not `Genre & Keyword` — it has no effect there (`SERIES-007-AC-20`), and showing a control that silently does nothing would be misleading.
- **Filters submit immediately on change**, matching `RecommendationsList`'s existing fetch-on-mount pattern, rather than requiring a separate "Apply" click gating every field — this mirrors how `SearchFilter` requires an explicit Search click for *filters*, but recommendation sourcing/filtering is a smaller, single-panel control where re-fetching on change reads as more responsive than a form-submit model. (Contrast noted rather than blindly copied, since `SearchFilter`'s existing multi-click-then-Search pattern was designed around a much larger field set.)
- **No changes to `RecommendationsList`'s card rendering or actions (Mark as Watched / Add to List / Ignore)** — this spec only changes what feeds the list, not what a card looks like or does.

---

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the new sourcing/filter parameters typed and threaded through `seriesApi`, so the control panel has a single typed contract to build against.

#### Acceptance Criteria

- **FRONTEND-011-AC-01** [AUTO]: `src/types/series.ts` shall gain a `RecommendationQuery` interface: `limit?: number`, `seriesIds?: string[]`, `genres?: string[]`, `keywords?: string[]`, `minSourceRating?: number`, `minTmdbRating?: number`, `minVoteCount?: number`, `yearMin?: number`, `yearMax?: number`, `excludeGenres?: string[]`, `language?: string`, `maxPerSource?: number`.
- **FRONTEND-011-AC-02** [AUTO]: `seriesApi.getRecommendations` shall change signature from `(limit?: number)` to `(query?: RecommendationQuery)`, building query-string params from every present field (array fields comma-joined, same convention as `buildSearchParams`'s `genre` handling). Existing no-argument and `{ limit }`-only call sites (`RecommendationsList`'s initial fetch) continue to work unchanged.

---

### Requirement 2: Sourcing Mode Controls

**User story**: As a user, I want to choose whether recommendations come from my whole watch history, specific series I pick, or a genre/keyword I name directly, so I can steer suggestions toward what I actually want right now.

#### Acceptance Criteria

- **FRONTEND-011-AC-03** [AUTO]: A new `RecommendationControls` component shall render a three-way mode selector: `Automatic` (default), `Specific Series`, `Genre & Keyword`.
- **FRONTEND-011-AC-04** [AUTO]: Under `Specific Series` mode, `RecommendationControls` shall fetch the user's series via `seriesApi.getAll()` and render them as a multi-select (checkboxes, one per series, showing title and status) — selected series ids populate `RecommendationQuery.seriesIds`.
- **FRONTEND-011-AC-05** [AUTO]: Under `Genre & Keyword` mode, `RecommendationControls` shall render two comma-separated text inputs, "Genres" and "Keywords" (same free-text-list convention as `SearchFilter`'s existing Genres field), populating `RecommendationQuery.genres`/`keywords` respectively. At least one of the two must be non-empty to submit; if both are empty, the mode-specific fields are omitted from the query (falling through to `Automatic` behavior server-side, per `SERIES-007-AC-18`) and a hint is shown asking the user to enter at least one.
- **FRONTEND-011-AC-06** [AUTO]: Switching sourcing mode shall clear the fields specific to the previously-selected mode, so a stale selection can never be silently included after switching away from it.

---

### Requirement 3: Output Filter Controls

**User story**: As a user, I want to narrow recommendation results by quality, recency, genre, and language, so I don't have to scroll past suggestions I already know I don't want.

#### Acceptance Criteria

- **FRONTEND-011-AC-07** [AUTO]: `RecommendationControls` shall render, in a collapsible "Filters" section (collapsed by default): `minSourceRating` (1–5 dropdown, shown only for `Automatic`/`Specific Series` modes per Design Decisions), `minTmdbRating` (number input, step 0.1), `minVoteCount` (number input), `yearMin`/`yearMax` (number inputs), `excludeGenres` (comma-separated text input), `language` (text input, e.g. `en`), `maxPerSource` (number input).
- **FRONTEND-011-AC-08** [AUTO]: An empty filter field shall be omitted from `RecommendationQuery` entirely (not sent as an empty string or `0`), so server-side defaults (e.g. `minVoteCount`'s default of 20, `SERIES-007-AC-25`) apply exactly as they do when the field is untouched.
- **FRONTEND-011-AC-09** [AUTO]: A "Reset Filters" action shall clear every field in the Filters section (but not the sourcing mode/selection from Requirement 2) and re-fetch.

---

### Requirement 4: Wiring & Fetch Behavior

**User story**: As a user, I want my sourcing/filter choices to actually change what I see, immediately.

#### Acceptance Criteria

- **FRONTEND-011-AC-10** [AUTO]: `RecommendationControls` shall be rendered above `RecommendationsList` only while the Recommendations view is active (same conditional-render seam as `SearchFilter`/`ExportControls` above `SeriesList`).
- **FRONTEND-011-AC-11** [AUTO]: `RecommendationsList` shall accept an optional `query?: RecommendationQuery` prop and pass it to `seriesApi.getRecommendations`, re-fetching whenever it changes (extending its existing `refreshIndex`-keyed effect to also depend on `query`).
- **FRONTEND-011-AC-12** [AUTO]: Changing any control in `RecommendationControls` (mode, selection, or a filter field) shall trigger a re-fetch, per Design Decisions' immediate-submit choice — no separate "Apply" button.
- **FRONTEND-011-AC-13** [AUTO]: If `seriesApi.getRecommendations` rejects for a `RecommendationControls`-driven fetch (e.g. a malformed filter value the client-side validation missed), `RecommendationsList`'s existing error/Retry handling (`FRONTEND-010-AC-07`) applies unchanged — no new error path is introduced.

---

### Requirement 5: Keyword Filter — Fixed Vocabulary, Not Free Text

**User story**: As a user picking `Genre & Keyword` sourcing mode, I want to choose keywords from the same real, spelling-stable vocabulary the series list's own keyword filter already uses, instead of typing free text I might misspell or that might not match any TMDB keyword this collection actually has.

**Design decision**: `RecommendationControls.tsx`'s `genresSelected` field is already a checkbox list sourced from `seriesApi.getGenreOptions()` (`state.mode === 'genre'` block, `genreOptions.map(...)`) — but its sibling `keywordsText` field, in the same block, is still a raw comma-separated `<input type="text">` (`recommendation-keywords`), parsed via `parseCommaList`. This is the one inconsistency the user flagged directly: the series list's `SearchFilter` keyword control (`frontend_spec_024_keyword_tracking.md`, `FRONTEND-024-AC-12`) is already a fixed-vocabulary checkbox list sourced from `GET /series/keywords`, for exactly the reason `frontend_spec_014`'s genre-checkbox-list fix and this component's own `genresSelected` field already exist — free text against a real, backend-known vocabulary just reintroduces a silent-typo-mismatch risk. This requirement brings `keywordsText` in line with its own sibling field and with `SearchFilter`'s established pattern, rather than inventing a new one.

#### Acceptance Criteria

- **FRONTEND-011-AC-14** [AUTO]: `RecommendationControls` shall fetch `seriesApi.getKeywordStats()` on mount (mirroring the existing `getGenreOptions()` effect) and, under `Genre & Keyword` mode, render the result's `name` values as a checkbox multi-select (replacing the free-text `keywordsText` input and its `recommendation-keywords` id), following exactly the same markup/interaction shape as the adjacent `genresSelected` checkbox list in the same component.
- **FRONTEND-011-AC-15** [AUTO]: `ControlsState` shall replace its `keywordsText: string` field with `keywordsSelected: string[]`; `buildQuery` shall populate `RecommendationQuery.keywords` from `keywordsSelected` directly (no `parseCommaList` step, since selections are already discrete values) whenever it is non-empty, following the exact convention `genresSelected` → `query.genres` already uses.
- **FRONTEND-011-AC-16** [AUTO]: Switching away from `Genre & Keyword` mode shall clear `keywordsSelected` (extending the existing mode-switch clearing behavior, `FRONTEND-011-AC-06`, to the renamed field) exactly as it already clears `genresSelected`.
- **FRONTEND-011-AC-17** [AUTO]: The existing "enter at least one genre or keyword" hint (`showGenreKeywordHint`, `FRONTEND-011-AC-05`) shall be recomputed from `keywordsSelected.length === 0` instead of `parseCommaList(keywordsText).length === 0` — same condition, adapted to the new field shape.
- **FRONTEND-011-AC-18** [AUTO]: If `seriesApi.getKeywordStats()` rejects, the keyword checkbox section shall render a scoped inline error and simply show no checkboxes, without blocking the rest of `RecommendationControls` from rendering or functioning — mirroring `FRONTEND-024-AC-14`'s established degrade-gracefully posture for the same failure mode on `SearchFilter`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationsList`, `Recommendation` type, existing `getRecommendations`/error/empty/loading behavior | `frontend_spec_010_recommendations.md` |
| `seriesIds`, `genres`/`keywords`, `minSourceRating`, output filters, `maxPerSource`, mutual-exclusivity `400` | `series_spec_007_recommendation_sourcing.md` |
| `seriesApi.getAll()`, comma-separated free-text list convention (`Genres` field) | `SearchFilter.tsx` (Frontend Spec 006) |
| `GET /series/keywords`, `seriesApi.getKeywordStats()`, `SearchFilter`'s fixed-vocabulary keyword checkbox list and its degrade-gracefully-on-failure behavior (`FRONTEND-024-AC-12`/`AC-14`) that Requirement 5 mirrors | `frontend_spec_024_keyword_tracking.md` |
| `genresSelected` checkbox-list field in this same component, whose shape Requirement 5's `keywordsSelected` field copies exactly | `RecommendationControls.tsx` (this spec, Requirement 2) |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (addition)

```typescript
describe('FRONTEND-011-AC-02: getRecommendations with a full query', () => {
  it('builds comma-joined array params and omits absent fields', async () => {
    client.get.mockResolvedValue({ data: { data: [] } })

    await seriesApi.getRecommendations({
      genres: ['Drama', 'Crime'],
      minVoteCount: 50,
      yearMin: 2020,
    })

    expect(client.get).toHaveBeenCalledWith('/series/recommendations', {
      params: { genres: 'Drama,Crime', minVoteCount: 50, yearMin: 2020 },
    })
  })
})
```

### `src/components/RecommendationControls.test.tsx`

```typescript
vi.mock('../services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)

describe('FRONTEND-011-AC-03/06: mode switching clears stale fields', () => {
  it('clears genres/keywords when switching from Genre & Keyword to Specific Series', async () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    fireEvent.change(screen.getByLabelText(/genres/i), { target: { value: 'Drama' } })
    fireEvent.click(screen.getByLabelText(/specific series/i))

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ genres: expect.anything() }),
    )
  })
})

describe('FRONTEND-011-AC-04: specific series picker lists the user\'s series', async () => {
  it('renders a checkbox per series from getAll()', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Ozark', status: 'COMPLETED' } as any])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/specific series/i))
    expect(await screen.findByLabelText('Ozark')).toBeInTheDocument()
  })
})

describe('FRONTEND-011-AC-08: empty filter fields are omitted, not sent as empty/zero', () => {
  it('omits minVoteCount from the query when the field is left blank', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.change(screen.getByLabelText(/min tmdb rating/i), { target: { value: '7' } })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ minVoteCount: expect.anything() }),
    )
  })
})
```

### `src/components/RecommendationsList.test.tsx` (addition)

```typescript
describe('FRONTEND-011-AC-11: re-fetches when query prop changes', () => {
  it('calls getRecommendations again with the new query', async () => {
    const { rerender } = render(<RecommendationsList query={{ genres: ['Drama'] }} />)
    await waitFor(() => expect(mockGetRecommendations).toHaveBeenCalledWith({ genres: ['Drama'] }))

    rerender(<RecommendationsList query={{ genres: ['Comedy'] }} />)
    await waitFor(() => expect(mockGetRecommendations).toHaveBeenLastCalledWith({ genres: ['Comedy'] }))
  })
})
```

### `src/components/RecommendationControls.test.tsx` (additions, Requirement 5)

```typescript
describe('FRONTEND-011-AC-14/15: keyword checkbox list replaces free text', () => {
  it('renders keyword checkboxes from getKeywordStats and includes selections in the query', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    fireEvent.click(await screen.findByLabelText('spy'))

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ keywords: ['spy'] }),
    )
  })
})

describe('FRONTEND-011-AC-16: mode switch clears keywordsSelected', () => {
  it('clears selected keywords when switching away from Genre & Keyword', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    fireEvent.click(await screen.findByLabelText('spy'))
    fireEvent.click(screen.getByLabelText(/specific series/i))

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ keywords: expect.anything() }),
    )
  })
})

describe('FRONTEND-011-AC-18: keyword fetch failure degrades gracefully', () => {
  it('shows a scoped error without blocking the rest of the panel', async () => {
    mockGetKeywordStats.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByLabelText(/automatic/i)).toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-011-AC-01: `RecommendationQuery` type
- [x] FRONTEND-011-AC-02: `seriesApi.getRecommendations(query?)` signature
- [x] FRONTEND-011-AC-03: three-way sourcing mode selector
- [x] FRONTEND-011-AC-04: Specific Series multi-select via `getAll()`
- [x] FRONTEND-011-AC-05: Genre & Keyword text inputs, at-least-one hint
- [x] FRONTEND-011-AC-06: switching mode clears the other mode's fields
- [x] FRONTEND-011-AC-07: output filter fields
- [x] FRONTEND-011-AC-08: empty filter fields omitted, not sent as empty/zero
- [x] FRONTEND-011-AC-09: Reset Filters action
- [x] FRONTEND-011-AC-10: `RecommendationControls` rendered only in Recommendations view
- [x] FRONTEND-011-AC-11: `RecommendationsList` re-fetches on `query` prop change
- [x] FRONTEND-011-AC-12: any control change triggers re-fetch, no Apply button
- [x] FRONTEND-011-AC-13: fetch errors use existing error/Retry path, no new one
- [x] FRONTEND-011-AC-14: keyword checkbox list sourced from `getKeywordStats()`, replaces free text
- [x] FRONTEND-011-AC-15: `keywordsSelected` populates `RecommendationQuery.keywords`
- [x] FRONTEND-011-AC-16: mode switch clears `keywordsSelected`
- [x] FRONTEND-011-AC-17: at-least-one hint recomputed from `keywordsSelected`
- [x] FRONTEND-011-AC-18: keyword-fetch failure degrades gracefully, scoped error only
