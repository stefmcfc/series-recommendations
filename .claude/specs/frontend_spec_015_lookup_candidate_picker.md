# Frontend Spec 015: Lookup Candidate Picker

**Status**: Done
**Priority**: P2 (quality-of-life / correctness fix for adding series — not core CRUD)
**Depends on**: Frontend Spec 009 (OMDb Autofill & Poster Display) ✅, Series Spec 011 (`GET /series/lookup/search`, `GET /series/lookup?imdbId=`)
**Frontend Stage**: 15 of N

---

## Overview

`frontend_spec_009_omdb_autofill.md` wired `AddSeriesForm`'s "Look Up" button straight to `seriesApi.lookupByTitle`, which is backed by OMDb's `t=` "best single match" parameter — OMDb does its own fuzzy matching server-side and can only ever return one guess. Looking up "Spooks" silently autofills from OMDb's guess "Spooks: Code 9" (a spin-off) instead, with no way for the user to notice or correct it. This spec fixes that by switching `handleLookup` to a search-first flow, backed by `series_spec_011_omdb_search_candidates.md`'s new endpoints: `seriesApi.searchByTitle` returns every candidate OMDb actually has for a title, and `seriesApi.lookupByImdbId` resolves one specific candidate to the same full detail `lookupByTitle` already produced. Zero results keeps today's error UX; exactly one result auto-resolves and autofills exactly as before (no extra click for the common, unambiguous case); two or more results shows a candidate picker inside the existing dialog so the user picks the right match before anything is autofilled.

**Design decisions**:
- **This supersedes `FRONTEND-009-AC-06`** ("Clicking Look Up shall call `seriesApi.lookupByTitle`"). `handleLookup` now calls `seriesApi.searchByTitle` instead; `lookupByTitle` itself is untouched in `seriesApi` (the backend endpoint it calls is unchanged for title-only requests per `SERIES-011-AC-18`) but `AddSeriesForm` no longer calls it directly. `FRONTEND-009-AC-04`/`AC-05` (button rendered, disabled while title is blank) and the trimmed-title behavior are otherwise unaffected and not restated here.
- **The single-candidate auto-resolve path reuses `applyLookupResult` and the existing `lookingUp`/`lookupError` state unchanged** (`FRONTEND-009-AC-07`/`08`/`09`/`10`/`11`), just fed by a second network call (`lookupByImdbId`) chained after the first (`searchByTitle`) rather than one call. From the user's perspective, an unambiguous title still resolves in one click with no picker shown — this spec adds a disambiguation step only when OMDb's search genuinely returns more than one candidate.
- **No second `role="dialog"`.** The picker renders as a list inside `AddSeriesForm`'s existing dialog. This app's dialog contract expects exactly one `role="dialog"` region per screen (`frontend_spec_003_add_series_form.md`, `FRONTEND-003-AC-05`/`AC-08` — the dialog's own `Escape`-to-dismiss handling is scoped to a single mounted dialog root), so a second, nested dialog for the picker would both violate that contract and create two competing `Escape` handlers.
- **A failed candidate resolution leaves the picker open**, rather than clearing it. If `lookupByImdbId` fails for one selected candidate, the user most likely wants to try a different candidate from the same list, not restart the whole search from scratch. The picker only clears on a successful resolution or an explicit dismissal.
- **One `<button>` per candidate, no `role="listbox"`/`option` pattern.** This app already fixed one nested-interactive-controls accessibility violation by replacing a `role="button"` wrapper with a plain per-row `<button>` (`frontend_spec_008_accessible_row_interactions.md`); the same reasoning applies here — a native `<button type="button">` per candidate gives free keyboard activation (Enter/Space) and focus handling without hand-rolled ARIA `listbox`/`option` state management, and keeps the picker's markup simple enough to audit against `@axe-core/react` the same way the rest of the app already is.
- **Poster thumbnails in the picker use `alt=""` (decorative)**, consistent with every other poster image in the app (`frontend_spec_009_omdb_autofill.md` design decisions) — each candidate's title is already rendered as visible text inside the same button.

---

## Requirements

### Requirement 1: Types & API Service Layer

**User story**: As a developer, I want the new search-candidate shape and the imdbId-based lookup call typed and centralized, so every place that needs them shares one contract.

#### Acceptance Criteria

- **FRONTEND-015-AC-01** [AUTO]: `src/types/series.ts` shall gain a new `LookupCandidate` interface: `title: string`, and optional `year`, `imdbId`, `posterUrl` (mirroring `SeriesLookupCandidateDto`'s shape from `series_spec_011_omdb_search_candidates.md`).
- **FRONTEND-015-AC-02** [AUTO]: `seriesApi` shall gain `searchByTitle: (title: string) => Promise<LookupCandidate[]>`, calling `GET /series/lookup/search` with a `title` query param and unwrapping the `{ data: SeriesLookupCandidateDto[] }` envelope via the existing `request<T>()` helper, following the exact param-building/envelope-unwrapping conventions already used by `lookupByTitle`.
- **FRONTEND-015-AC-03** [AUTO]: `seriesApi` shall gain `lookupByImdbId: (imdbId: string) => Promise<OmdbLookupResult>`, calling `GET /series/lookup` with an `imdbId` query param (instead of `title`) and unwrapping the `{ data: SeriesLookupDto }` envelope the same way `lookupByTitle` already does.

---

### Requirement 2: Triggering a Lookup — Search Replaces Direct Title Lookup

**User story**: As a user, I want clicking "Look Up" to show me what OMDb actually found, not just its single best guess, so I don't end up with the wrong series autofilled without knowing it.

#### Acceptance Criteria

- **FRONTEND-015-AC-04** [AUTO]: Clicking "Look Up" shall call `seriesApi.searchByTitle` with the current (trimmed) Title field value — superseding `FRONTEND-009-AC-06`'s direct call to `seriesApi.lookupByTitle` (see design decisions above) — and shall not submit or validate the rest of the form (`FRONTEND-009-AC-06`'s "does not submit" obligation carries over unchanged).

---

### Requirement 3: Zero Results

**User story**: As a user, I want a clear "no match" message when OMDb has nothing for a title, so I know to just fill the form in myself.

#### Acceptance Criteria

- **FRONTEND-015-AC-05** [AUTO]: When `seriesApi.searchByTitle` resolves with an empty array, `AddSeriesForm` shall set `lookupError` to a client-generated message (e.g. `"No matches found for that title."`) and render it via the existing `lookupError` `role="alert"` region (`FRONTEND-009-AC-11`'s region, reused unchanged), without rendering a candidate picker.

---

### Requirement 4: Exactly One Result — Auto-Resolve

**User story**: As a user looking up an unambiguous title, I want it to still autofill in one click, so this fix doesn't add friction to the common case.

#### Acceptance Criteria

- **FRONTEND-015-AC-06** [AUTO]: When `seriesApi.searchByTitle` resolves with exactly one candidate, `AddSeriesForm` shall automatically call `seriesApi.lookupByImdbId` with that candidate's `imdbId`, and shall not render a candidate picker.
- **FRONTEND-015-AC-07** [AUTO]: On success of the automatic `lookupByImdbId` call from AC-06, `AddSeriesForm` shall apply the result via the existing `applyLookupResult` function exactly as `FRONTEND-009-AC-07`/`AC-08`/`AC-09` already specify (title always overwritten; other fields overwritten only where the result has a non-null value; `status`/`personalRating`/`personalNotes` never touched).
- **FRONTEND-015-AC-08** [AUTO]: While either the initial `searchByTitle` call or the automatic `lookupByImdbId` call from AC-06 is in flight, the "Look Up" button shall be disabled and read "Looking up..." — the same single loading state `FRONTEND-009-AC-10` already covers, now spanning both chained calls for the single-candidate path.
- **FRONTEND-015-AC-09** [AUTO]: If the automatic `lookupByImdbId` call from AC-06 rejects with an `ApiError`, `AddSeriesForm` shall display `ApiError.message` via the existing `lookupError` region (`FRONTEND-009-AC-11`) and shall leave all form fields exactly as they were — same error contract as a failed direct lookup.

---

### Requirement 5: Two or More Results — Candidate Picker

**User story**: As a user looking up an ambiguous title, I want to see the candidates OMDb found and pick the right one, so autofill only ever applies a match I confirmed.

#### Acceptance Criteria

- **FRONTEND-015-AC-10** [AUTO]: When `seriesApi.searchByTitle` resolves with two or more candidates, `AddSeriesForm` shall render a candidate picker (`data-testid="lookup-candidates"`) as a list within the existing dialog — not a second `role="dialog"` element (see design decisions above).
- **FRONTEND-015-AC-11** [AUTO]: Each candidate in the picker shall display its title and, when present, its year and a poster thumbnail (`alt=""`, decorative — consistent with `frontend_spec_009_omdb_autofill.md`'s established convention).
- **FRONTEND-015-AC-12** [AUTO]: Each candidate shall be rendered as its own `<button type="button" data-testid="lookup-candidate">` — one interactive control per candidate, with no interactive element nested inside another (following the row-title-button precedent set by `frontend_spec_008_accessible_row_interactions.md`) — keyboard-activatable via native button semantics (Enter/Space) with no custom key handling required.

---

### Requirement 6: Selecting a Candidate

**User story**: As a user, I want picking a candidate to resolve and autofill from that exact match, so my choice is respected rather than re-guessed.

#### Acceptance Criteria

- **FRONTEND-015-AC-13** [AUTO]: Clicking a candidate's button shall call `seriesApi.lookupByImdbId` with that candidate's `imdbId`.
- **FRONTEND-015-AC-14** [AUTO]: On success, `AddSeriesForm` shall apply the result via `applyLookupResult` (same overwrite rules as `FRONTEND-015-AC-07`) and then clear the picker (the candidate list state reset to empty), so it is no longer shown.
- **FRONTEND-015-AC-15** [AUTO]: While a selected candidate's `lookupByImdbId` call is in flight, `AddSeriesForm` shall disable every candidate button in the picker, to prevent a second concurrent selection.
- **FRONTEND-015-AC-16** [AUTO]: If a selected candidate's `lookupByImdbId` call rejects with an `ApiError`, `AddSeriesForm` shall display `ApiError.message` via the existing `lookupError` region and shall leave the candidate picker open (not cleared — see design decisions above), with its buttons re-enabled so the user can pick a different candidate or dismiss the picker explicitly (`FRONTEND-015-AC-17`).

---

### Requirement 7: Dismissing the Picker

**User story**: As a user, I want to back out of the candidate picker without being forced to pick one, so a bad search doesn't trap me.

#### Acceptance Criteria

- **FRONTEND-015-AC-17** [AUTO]: The candidate picker shall render an explicit close control (`data-testid="lookup-candidates-cancel"`, labelled e.g. "Cancel") that, when clicked, clears the picker (candidate list state reset to empty) without calling `seriesApi.lookupByImdbId`.
- **FRONTEND-015-AC-18** [AUTO]: Re-clicking "Look Up" while a candidate picker is showing shall re-run `seriesApi.searchByTitle` and replace the picker's contents with the new result, applying the zero/one/two-or-more handling above (`FRONTEND-015-AC-05`/`AC-06`/`AC-10`) to the new result the same as an initial search.

---

### Requirement 8: Component State

**User story**: As a developer, I want the new picker's state to be explicit and separate from the existing single-result lookup state, so the two flows don't interfere with each other.

#### Acceptance Criteria

- **FRONTEND-015-AC-19** [AUTO]: `AddSeriesForm` shall introduce a `candidates: LookupCandidate[]` state (empty by default, populated only in the two-or-more-result case per `FRONTEND-015-AC-10`, cleared per `FRONTEND-015-AC-14`/`AC-17`) and a `resolvingCandidate: boolean` state (used only for the loading indicator in `FRONTEND-015-AC-15`, distinct from the existing `lookingUp` state that already covers `FRONTEND-015-AC-08`'s search-plus-auto-resolve loading).

---

### Requirement 9: Shall Not — Data Handling

**User story**: As a developer, I want to be sure the new search/resolve calls don't leak data through logging, extending the existing no-logging guarantee to the new code paths.

#### Acceptance Criteria

- **FRONTEND-015-AC-20** [AUTO]: `AddSeriesForm` shall not log the searched title, the candidate list, or any resolved lookup result to the console (extends `FRONTEND-009-AC-23`'s existing no-lookup-logging obligation to the new `searchByTitle`/`lookupByImdbId` calls).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `GET /api/v1/series/lookup/search` contract, `SeriesLookupCandidateDto` shape, empty-array-is-200 semantics | `series_spec_011_omdb_search_candidates.md` |
| `GET /api/v1/series/lookup?imdbId=` contract, `SeriesLookupDto` shape, 404/502 semantics | `series_spec_011_omdb_search_candidates.md`, `series_spec_005_omdb_lookup.md` |
| `applyLookupResult` overwrite rules, `lookingUp`/`lookupError` state, "Look Up" button contract being extended | `frontend_spec_009_omdb_autofill.md` |
| Single-`role="dialog"` contract, `Escape`-to-dismiss scoping | `frontend_spec_003_add_series_form.md` (`FRONTEND-003-AC-05`/`AC-08`) |
| No-nested-interactive-controls precedent (one `<button>` per row/candidate) | `frontend_spec_008_accessible_row_interactions.md` |
| Decorative-image `alt=""` convention | `frontend_spec_009_omdb_autofill.md` design decisions |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (additions)

```typescript
describe('FRONTEND-015-AC-02: searchByTitle', () => {
  it('should call GET /series/lookup/search and unwrap { data: LookupCandidate[] }', async () => {
    const mockCandidates = [{ title: 'Spooks', year: 2002, imdbId: 'tt0290403' }]
    client.get.mockResolvedValue({ data: { data: mockCandidates } })

    const result = await seriesApi.searchByTitle('Spooks')

    expect(client.get).toHaveBeenCalledWith('/series/lookup/search', {
      params: { title: 'Spooks' },
    })
    expect(result).toEqual(mockCandidates)
  })
})

describe('FRONTEND-015-AC-03: lookupByImdbId', () => {
  it('should call GET /series/lookup with an imdbId param and unwrap { data: SeriesLookupDto }', async () => {
    const mockResult = { title: 'Spooks', imdbRating: 7.9 }
    client.get.mockResolvedValue({ data: { data: mockResult } })

    const result = await seriesApi.lookupByImdbId('tt0290403')

    expect(client.get).toHaveBeenCalledWith('/series/lookup', {
      params: { imdbId: 'tt0290403' },
    })
    expect(result.title).toBe('Spooks')
  })
})
```

### `src/components/AddSeriesForm.test.tsx` (additions/replacements)

The existing `FRONTEND-009-AC-04/05/06`, `AC-07/08/09`, `AC-10/11/12`, and `AC-23` describe blocks mock `seriesApi.lookupByTitle` directly; per `FRONTEND-015-AC-04`, `handleLookup` no longer calls it, so those blocks are updated to mock `seriesApi.searchByTitle` (and, where relevant, `seriesApi.lookupByImdbId`) instead — the underlying autofill/loading/error assertions are unchanged, only which mock drives them.

```typescript
vi.mock('../services/seriesApi')
const mockSearch = vi.mocked(seriesApi.searchByTitle)
const mockResolve = vi.mocked(seriesApi.lookupByImdbId)

describe('FRONTEND-015-AC-04: Look Up triggers a search, not a direct lookup', () => {
  it('calls searchByTitle with the trimmed title', async () => {
    mockSearch.mockResolvedValue([])
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: '  Spooks  ' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('Spooks'))
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-015-AC-05: zero results', () => {
  it('shows the existing lookup-error UI and no picker', async () => {
    mockSearch.mockResolvedValue([])
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Xyzzy' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no matches found/i),
    )
    expect(screen.queryByTestId('lookup-candidates')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-015-AC-06/07/08: exactly one result auto-resolves', () => {
  it('resolves and applies the single candidate without showing a picker', async () => {
    mockSearch.mockResolvedValue([{ title: 'Spooks', imdbId: 'tt0290403' }])
    mockResolve.mockResolvedValue({ title: 'Spooks', year: 2002, imdbRating: 7.9 })
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Spooks' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    expect(screen.getByTestId('lookup-btn')).toHaveTextContent(/looking up/i)
    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith('tt0290403'))
    await waitFor(() =>
      expect(screen.getByLabelText(/^year/i)).toHaveValue(2002),
    )
    expect(screen.queryByTestId('lookup-candidates')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-015-AC-09: auto-resolve failure', () => {
  it('shows the lookup error and leaves fields untouched', async () => {
    mockSearch.mockResolvedValue([{ title: 'Spooks', imdbId: 'tt0290403' }])
    mockResolve.mockRejectedValue(new ApiError(404, 'No OMDb results for imdbId: tt0290403'))
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Spooks' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no omdb results/i),
    )
    expect(screen.getByLabelText(/^year/i)).toHaveValue(null)
  })
})

describe('FRONTEND-015-AC-10/11/12: two or more results shows a picker', () => {
  it('renders one button per candidate with title/year/poster', async () => {
    mockSearch.mockResolvedValue([
      { title: 'Spooks', year: 2002, imdbId: 'tt0290403', posterUrl: 'https://example.com/spooks.jpg' },
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
    ])
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Spooks' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getAllByTestId('lookup-candidate')).toHaveLength(2),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByText(/spooks: code 9/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-015-AC-13/14: selecting a candidate resolves and applies it', () => {
  it('calls lookupByImdbId for the clicked candidate, applies it, and clears the picker', async () => {
    mockSearch.mockResolvedValue([
      { title: 'Spooks', year: 2002, imdbId: 'tt0290403' },
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
    ])
    mockResolve.mockResolvedValue({ title: 'Spooks', year: 2002, imdbRating: 7.9 })
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Spooks' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /spooks$/i }))

    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith('tt0290403'))
    await waitFor(() =>
      expect(screen.getByLabelText(/^year/i)).toHaveValue(2002),
    )
    expect(screen.queryByTestId('lookup-candidates')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-015-AC-16: a failed candidate resolution keeps the picker open', () => {
  it('shows the error and leaves the picker showing', async () => {
    mockSearch.mockResolvedValue([
      { title: 'Spooks', year: 2002, imdbId: 'tt0290403' },
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
    ])
    mockResolve.mockRejectedValue(new ApiError(502, 'Unable to reach the series lookup service. Please try again.'))
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Spooks' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /spooks$/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to reach/i),
    )
    expect(screen.getAllByTestId('lookup-candidate')).toHaveLength(2)
  })
})

describe('FRONTEND-015-AC-17: dismissing the picker', () => {
  it('clears the picker without resolving anything', async () => {
    mockSearch.mockResolvedValue([
      { title: 'Spooks', year: 2002, imdbId: 'tt0290403' },
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
    ])
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Spooks' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-candidate'))

    fireEvent.click(screen.getByTestId('lookup-candidates-cancel'))

    expect(screen.queryByTestId('lookup-candidates')).not.toBeInTheDocument()
    expect(mockResolve).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-015-AC-20: no logging of search/resolve data', () => {
  it('never logs the searched title or a resolved result', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    mockSearch.mockResolvedValue([{ title: 'Secret Show', imdbId: 'tt0000001' }])
    mockResolve.mockResolvedValue({ title: 'Secret Show' })
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Secret Show' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() => expect(mockResolve).toHaveBeenCalled())
    expect(
      logSpy.mock.calls.flat().some((c) => String(c).includes('Secret Show')),
    ).toBe(false)
  })
})
```

**Test Case (Green)** for every sketch above: implement `LookupCandidate`, `seriesApi.searchByTitle`/`lookupByImdbId`, and the `candidates`/`resolvingCandidate` state and rendering in `AddSeriesForm` until the tests above pass.

---

## Acceptance Criteria Summary

- [x] FRONTEND-015-AC-01: `LookupCandidate` type
- [x] FRONTEND-015-AC-02: `seriesApi.searchByTitle`
- [x] FRONTEND-015-AC-03: `seriesApi.lookupByImdbId`
- [x] FRONTEND-015-AC-04: "Look Up" calls `searchByTitle`, not `lookupByTitle`; doesn't submit the form
- [x] FRONTEND-015-AC-05: zero results → existing `lookupError` UI, no picker
- [x] FRONTEND-015-AC-06: exactly one result → auto-resolve via `lookupByImdbId`, no picker
- [x] FRONTEND-015-AC-07: auto-resolve success applies via `applyLookupResult`
- [x] FRONTEND-015-AC-08: "Looking up..." spans both chained calls
- [x] FRONTEND-015-AC-09: auto-resolve failure → `lookupError`, fields untouched
- [x] FRONTEND-015-AC-10: 2+ results → candidate picker rendered, no second dialog
- [x] FRONTEND-015-AC-11: each candidate shows title/year/poster
- [x] FRONTEND-015-AC-12: one `<button>` per candidate, no nested interactive elements
- [x] FRONTEND-015-AC-13: selecting a candidate calls `lookupByImdbId(imdbId)`
- [x] FRONTEND-015-AC-14: success applies result and clears the picker
- [x] FRONTEND-015-AC-15: picker buttons disabled while resolving
- [x] FRONTEND-015-AC-16: resolution failure keeps the picker open, buttons re-enabled
- [x] FRONTEND-015-AC-17: explicit cancel control clears the picker without resolving
- [x] FRONTEND-015-AC-18: re-clicking "Look Up" while the picker is open re-searches and replaces it
- [x] FRONTEND-015-AC-19: `candidates`/`resolvingCandidate` state introduced, distinct from `lookingUp`
- [x] FRONTEND-015-AC-20: no console logging of searched title, candidates, or resolved results
