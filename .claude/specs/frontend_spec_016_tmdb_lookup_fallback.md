# Frontend Spec 016: TMDB Lookup Fallback

**Status**: Complete
**Priority**: P2 (quality-of-life / correctness fix for adding series — not core CRUD)
**Depends on**: Frontend Spec 015 (Lookup Candidate Picker) ✅, Series Spec 012 (`GET /series/lookup/search-tmdb`, `GET /series/lookup/resolve-tmdb`)
**Frontend Stage**: 16 of N

---

## Overview

`frontend_spec_015_lookup_candidate_picker.md` fixed OMDb's `t=` "best single guess" endpoint silently autofilling the wrong series by switching `AddSeriesForm`'s "Look Up" flow to OMDb's `s=` search, with a candidate picker for the two-or-more-results case. But OMDb's `s=` search has no AKA/alternate-title matching, so a title catalogued under a different name in OMDb than the one the user knows it by returns zero *or several plausible-but-wrong* candidates, with the correct one never appearing at all — confirmed live during Spec 015's own verification: searching "Spooks" against OMDb's `s=` returns five real but wrong candidates, because OMDb catalogues that show as "MI-5". TMDB's own `/search/tv` (`series_spec_012_tmdb_lookup_fallback.md`) matches against original/translated/AKA names and finds it immediately.

This spec adds a manual "Search TMDB instead" escape hatch to `AddSeriesForm`, backed by Spec 012's two new endpoints (`seriesApi.searchTmdb`/`seriesApi.resolveTmdbCandidate`). The trigger is **user-initiated**, surfaced in exactly two places: alongside the existing zero-OMDb-results message, and alongside the existing two-or-more-results OMDb candidate picker's Cancel button. It is deliberately **not** auto-fired on "OMDb returned zero results" and **not** offered on the exactly-one-OMDb-result auto-resolve path — the Spooks case that motivates this spec returned five *wrong* results, not zero, so an empty-results-only trigger would never fire for the bug this spec exists to fix, and a confidently-wrong single auto-resolved match is a different, deeper problem this spec doesn't address.

**Design decisions**:
- **Reuses `OmdbLookupResult` as the resolve response type**, rather than introducing a new type for `seriesApi.resolveTmdbCandidate`'s return value. `OmdbLookupResult`'s shape (every field beyond `title` optional/nullable) already accommodates Series Spec 012's degraded case, where `resolveTmdbCandidate` falls back to TMDB-only detail and ratings come back absent — no new frontend type or mapping logic is needed to handle that case; `applyLookupResult`'s existing "only overwrite fields with a non-null value" rule already does the right thing.
- **The escape hatch is a single reused `<button data-testid="search-tmdb-btn">`, not two separately-tracked ones.** It's rendered in two different places in the JSX (next to the zero-OMDb-results message, and next to the OMDb candidate picker's Cancel button) but never both at once — those two render conditions are mutually exclusive (`candidates.length === 0` vs. `candidates.length >= 2`) — so one `data-testid` is sufficient and a test can assert on it regardless of which place it renders in.
- **One combined `resolvingTmdbCandidate` loading flag, not two.** Unlike Spec 015's OMDb flow, which splits loading state into `lookingUp` (the initial search, plus its exactly-one-result chained auto-resolve) and `resolvingCandidate` (picking from an already-rendered picker) — because both a "Look Up" click and a candidate-picker click can't happen at the same time but the picker and the button *are* both on screen at once in that flow — this spec's "Search TMDB instead" button and the TMDB candidate picker are never interactable simultaneously (the picker only appears after the button's own search call has already resolved), so a single `resolvingTmdbCandidate` boolean safely covers all three of: the initial `searchTmdb` call, its chained exactly-one-result auto-resolve, and resolving a candidate selected from the TMDB picker.
- **No new CSS.** The TMDB candidate picker reuses `AddSeriesForm.module.css`'s existing `.candidates`/`.candidateList`/`.candidateButton`/`.candidatePoster`/`.candidatesCancelButton` classes unchanged — its visual structure is identical to Spec 015's OMDb picker, just fed by a different data source. The "Search TMDB instead" button reuses the existing `.candidatesCancelButton` style (a plain secondary action button, matching Cancel's visual weight rather than the primary `.lookupButton` style).
- **No second `role="dialog"`**, for the same reason Spec 015 established (`frontend_spec_003_add_series_form.md`, `FRONTEND-003-AC-05`/`AC-08`): this app's dialog contract expects exactly one `role="dialog"` region per screen. The TMDB picker renders as a second list inside the existing dialog, alongside (never simultaneously with) the OMDb picker.
- **After a TMDB search returns zero results, the escape hatch is not re-offered.** That state is a genuine dead end for this lookup cycle — there's nothing further to fall back to — so `AddSeriesForm` renders a distinct message with no button, rather than looping the user back to the same TMDB search they just ran. Re-clicking "Look Up" to start an entirely new OMDb-search cycle naturally clears this state and re-enables the escape hatch for that new cycle (see Requirement 6).
- **A failed TMDB candidate resolution leaves the TMDB picker open**, exactly mirroring Spec 015's `FRONTEND-015-AC-16` rationale for the OMDb picker: the user most likely wants to try a different TMDB candidate from the same list, not restart the whole search from scratch.

---

## Requirements

### Requirement 1: Types & API Service Layer

**User story**: As a developer, I want the new TMDB-candidate shape and the two new endpoint calls typed and centralized, so every place that needs them shares one contract.

#### Acceptance Criteria

- **FRONTEND-016-AC-01** [AUTO]: `src/types/series.ts` shall gain a new `LookupTmdbCandidate` interface: `tmdbId: number`, `title: string`, and optional `year`, `originalTitle`, `posterUrl` (mirroring `TmdbLookupCandidateDto`'s shape from `series_spec_012_tmdb_lookup_fallback.md`).
- **FRONTEND-016-AC-02** [AUTO]: `seriesApi` shall gain `searchTmdb: (title: string) => Promise<LookupTmdbCandidate[]>`, calling `GET /series/lookup/search-tmdb` with a `title` query param and unwrapping the `{ data: TmdbLookupCandidateDto[] }` envelope via the existing `request<T>()` helper, following the exact param-building/envelope-unwrapping conventions `searchByTitle` (`frontend_spec_015_lookup_candidate_picker.md`) already uses.
- **FRONTEND-016-AC-03** [AUTO]: `seriesApi` shall gain `resolveTmdbCandidate: (tmdbId: number) => Promise<OmdbLookupResult>`, calling `GET /series/lookup/resolve-tmdb` with a `tmdbId` query param and unwrapping the `{ data: SeriesLookupDto }` envelope the same way `lookupByImdbId` already does — reusing the existing `OmdbLookupResult` type (see design decisions above), not a new one.

---

### Requirement 2: Escape-Hatch Affordance Placement

**User story**: As a user whose OMDb search came back empty or full of wrong matches, I want an explicit way to try TMDB instead, so I'm not stuck when OMDb simply doesn't have the right entry under the title I know.

#### Acceptance Criteria

- **FRONTEND-016-AC-04** [AUTO]: When `AddSeriesForm` is displaying the zero-OMDb-results `lookupError` message (`frontend_spec_015_lookup_candidate_picker.md`'s `FRONTEND-015-AC-05` case), it shall also render a `<button type="button" data-testid="search-tmdb-btn">Search TMDB instead</button>` alongside that message.
- **FRONTEND-016-AC-05** [AUTO]: When `AddSeriesForm` is displaying the two-or-more-OMDb-results candidate picker (`FRONTEND-015-AC-10`), it shall also render the same `data-testid="search-tmdb-btn"` button alongside the picker's existing `data-testid="lookup-candidates-cancel"` button.
- **FRONTEND-016-AC-06** [AUTO]: `AddSeriesForm` shall not render the `search-tmdb-btn` affordance on the exactly-one-OMDb-result auto-resolve path (`FRONTEND-015-AC-06`) — out of scope for this spec (see Overview).

---

### Requirement 3: Triggering a TMDB Search — Zero, One, and Many Results

**User story**: As a user, I want clicking "Search TMDB instead" to search TMDB directly and handle however many results come back, the same way the original "Look Up" button already does for OMDb.

#### Acceptance Criteria

- **FRONTEND-016-AC-07** [AUTO]: Clicking `search-tmdb-btn` shall clear any existing OMDb `candidates`/`lookupError` state, then call `seriesApi.searchTmdb` with the current (trimmed) Title field value.
- **FRONTEND-016-AC-08** [AUTO]: When `seriesApi.searchTmdb` resolves with an empty array, `AddSeriesForm` shall set `lookupError` to a distinct client-generated message (e.g. `"No matches found on TMDB either."`, distinguishable from the OMDb zero-results message) rendered via the existing `lookupError` `role="alert"` region, without rendering the `search-tmdb-btn` affordance again for this state (see design decisions above) and without rendering a TMDB candidate picker.
- **FRONTEND-016-AC-09** [AUTO]: When `seriesApi.searchTmdb` resolves with exactly one candidate, `AddSeriesForm` shall automatically call `seriesApi.resolveTmdbCandidate` with that candidate's `tmdbId`, apply the result via the existing `applyLookupResult` function on success (same overwrite rules `FRONTEND-015-AC-07` already specifies), and shall not render a TMDB candidate picker.
- **FRONTEND-016-AC-10** [AUTO]: When `seriesApi.searchTmdb` resolves with two or more candidates, `AddSeriesForm` shall render a TMDB candidate picker (`data-testid="lookup-tmdb-candidates"`) as a list within the existing dialog — not a second `role="dialog"` element.
- **FRONTEND-016-AC-11** [AUTO]: If the automatic `resolveTmdbCandidate` call from `FRONTEND-016-AC-09` rejects with an `ApiError`, `AddSeriesForm` shall display `ApiError.message` via the existing `lookupError` region and shall leave all form fields exactly as they were.
- **FRONTEND-016-AC-12** [AUTO]: While the initial `searchTmdb` call, its chained exactly-one-result `resolveTmdbCandidate` call (`FRONTEND-016-AC-09`), or a selected-candidate `resolveTmdbCandidate` call (Requirement 5) is in flight, the `search-tmdb-btn` button shall be disabled and read `"Searching TMDB..."` (a single `resolvingTmdbCandidate` state spanning all three, per the design decisions above).

---

### Requirement 4: TMDB Candidate Picker Rendering

**User story**: As a user looking up an ambiguous or hard-to-find title, I want to see TMDB's candidates and pick the right one, so autofill only ever applies a match I confirmed.

#### Acceptance Criteria

- **FRONTEND-016-AC-13** [AUTO]: Each candidate in the TMDB picker shall be rendered as its own `<button type="button" data-testid="lookup-tmdb-candidate">`, reusing `AddSeriesForm.module.css`'s existing `.candidateButton` styling (no new CSS) — one interactive control per candidate, none nested inside another.
- **FRONTEND-016-AC-14** [AUTO]: Each candidate button shall display its title and, when present, its year, its `originalTitle` (only when present and different from `title`), and a poster thumbnail (`alt=""`, decorative, reusing `.candidatePoster`) — consistent with `frontend_spec_009_omdb_autofill.md`'s established decorative-image convention.
- **FRONTEND-016-AC-15** [AUTO]: The TMDB picker shall render an explicit close control (`data-testid="lookup-tmdb-candidates-cancel"`, labelled e.g. "Cancel") that, when clicked, clears the picker (`tmdbCandidates` reset to empty) without calling `seriesApi.resolveTmdbCandidate`.

---

### Requirement 5: Selecting a TMDB Candidate

**User story**: As a user, I want picking a TMDB candidate to resolve and autofill from that exact match — via OMDb's richer data when available, or TMDB's own data otherwise — so my choice is respected rather than re-guessed.

#### Acceptance Criteria

- **FRONTEND-016-AC-16** [AUTO]: Clicking a TMDB candidate's button shall call `seriesApi.resolveTmdbCandidate` with that candidate's `tmdbId`.
- **FRONTEND-016-AC-17** [AUTO]: On success, `AddSeriesForm` shall apply the result via `applyLookupResult` (same overwrite rules as `FRONTEND-016-AC-09`; a degraded/partial result — e.g. absent ratings — is handled correctly with no extra logic, since `applyLookupResult` already only overwrites fields with non-null values) and then clear `tmdbCandidates`, so the picker is no longer shown.
- **FRONTEND-016-AC-18** [AUTO]: While a selected TMDB candidate's `resolveTmdbCandidate` call is in flight, `AddSeriesForm` shall disable every `lookup-tmdb-candidate` button in the picker, to prevent a second concurrent selection.
- **FRONTEND-016-AC-19** [AUTO]: If a selected TMDB candidate's `resolveTmdbCandidate` call rejects with an `ApiError`, `AddSeriesForm` shall display `ApiError.message` via the existing `lookupError` region and shall leave the TMDB candidate picker open (not cleared), with its buttons re-enabled so the user can pick a different candidate or dismiss the picker explicitly (`FRONTEND-016-AC-15`).

---

### Requirement 6: Component State & Interaction With the Existing OMDb Flow

**User story**: As a developer, I want the new TMDB picker's state to be explicit, separate from the existing OMDb picker state, and correctly reset when a fresh OMDb search cycle begins, so the two flows never interfere with each other or leave stale UI behind.

#### Acceptance Criteria

- **FRONTEND-016-AC-20** [AUTO]: `AddSeriesForm` shall introduce a `tmdbCandidates: LookupTmdbCandidate[]` state (empty by default, populated only in the two-or-more-result case per `FRONTEND-016-AC-10`, cleared per `FRONTEND-016-AC-15`/`AC-17`) and a `resolvingTmdbCandidate: boolean` state (used for the loading indicator in `FRONTEND-016-AC-12`/`AC-18`, distinct from the existing `lookingUp`/`resolvingCandidate` states `frontend_spec_015_lookup_candidate_picker.md` already introduced).
- **FRONTEND-016-AC-21** [AUTO]: Re-clicking the original "Look Up" button (`lookup-btn`) shall clear any existing `tmdbCandidates` state, in addition to the OMDb `candidates`/`lookupError` clearing `FRONTEND-015-AC-04`/`AC-18` already specify — extending that existing clearing behavior to this spec's new state, so a stale TMDB picker or TMDB-specific message from a previous search cycle can never linger over a fresh OMDb search.

---

### Requirement 7: Shall Not — Data Handling

**User story**: As a developer, I want to be sure the new TMDB search/resolve calls don't leak data through logging, extending the existing no-logging guarantee to the new code paths.

#### Acceptance Criteria

- **FRONTEND-016-AC-22** [AUTO]: `AddSeriesForm` shall not log the searched title, the TMDB candidate list, or any resolved TMDB lookup result to the console (extends `FRONTEND-015-AC-20`'s existing no-lookup-logging obligation to the new `searchTmdb`/`resolveTmdbCandidate` calls).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `GET /api/v1/series/lookup/search-tmdb` contract, `TmdbLookupCandidateDto` shape, empty-array-is-200 semantics | `series_spec_012_tmdb_lookup_fallback.md` |
| `GET /api/v1/series/lookup/resolve-tmdb` contract, degraded-result semantics (absent ratings, still a 200) | `series_spec_012_tmdb_lookup_fallback.md` |
| `OmdbLookupResult` type (reused as the resolve response shape), `applyLookupResult` overwrite rules | `frontend_spec_009_omdb_autofill.md` |
| `searchByTitle`/`lookupByImdbId` conventions this spec's `searchTmdb`/`resolveTmdbCandidate` mirror; `candidates`/`lookingUp`/`resolvingCandidate` state and the OMDb candidate picker this spec's affordance attaches to | `frontend_spec_015_lookup_candidate_picker.md` |
| Single-`role="dialog"` contract, `Escape`-to-dismiss scoping | `frontend_spec_003_add_series_form.md` (`FRONTEND-003-AC-05`/`AC-08`) |
| No-nested-interactive-controls precedent (one `<button>` per row/candidate) | `frontend_spec_008_accessible_row_interactions.md` |
| Decorative-image `alt=""` convention | `frontend_spec_009_omdb_autofill.md` design decisions |
| `.candidates`/`.candidateList`/`.candidateButton`/`.candidatePoster`/`.candidatesCancelButton` CSS classes reused unchanged | `AddSeriesForm.module.css` (`frontend_spec_015_lookup_candidate_picker.md`) |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (additions)

```typescript
describe('FRONTEND-016-AC-02: searchTmdb', () => {
  it('should call GET /series/lookup/search-tmdb and unwrap { data: LookupTmdbCandidate[] }', async () => {
    const mockCandidates = [{ tmdbId: 4046, title: 'Spooks', year: 2002 }]
    client.get.mockResolvedValue({ data: { data: mockCandidates } })

    const result = await seriesApi.searchTmdb('Spooks')

    expect(client.get).toHaveBeenCalledWith('/series/lookup/search-tmdb', {
      params: { title: 'Spooks' },
    })
    expect(result).toEqual(mockCandidates)
  })
})

describe('FRONTEND-016-AC-03: resolveTmdbCandidate', () => {
  it('should call GET /series/lookup/resolve-tmdb with a tmdbId param and unwrap { data: SeriesLookupDto }', async () => {
    const mockResult = { title: 'Spooks', imdbId: 'tt0160904' }
    client.get.mockResolvedValue({ data: { data: mockResult } })

    const result = await seriesApi.resolveTmdbCandidate(4046)

    expect(client.get).toHaveBeenCalledWith('/series/lookup/resolve-tmdb', {
      params: { tmdbId: 4046 },
    })
    expect(result.title).toBe('Spooks')
  })
})
```

### `src/components/AddSeriesForm.test.tsx` (additions)

```typescript
vi.mock('../services/seriesApi')
const mockSearch = vi.mocked(seriesApi.searchByTitle)
const mockResolve = vi.mocked(seriesApi.lookupByImdbId)
const mockSearchTmdb = vi.mocked(seriesApi.searchTmdb)
const mockResolveTmdb = vi.mocked(seriesApi.resolveTmdbCandidate)

async function runLookup(title: string) {
  fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: title } })
  fireEvent.click(screen.getByTestId('lookup-btn'))
}

describe('FRONTEND-016-AC-04: escape hatch shown alongside zero OMDb results', () => {
  it('renders search-tmdb-btn next to the lookup-error message', async () => {
    mockSearch.mockResolvedValue([])
    renderForm()
    await runLookup('Spooks')

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no matches found/i))
    expect(screen.getByTestId('search-tmdb-btn')).toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-05: escape hatch shown alongside the OMDb candidate picker', () => {
  it('renders search-tmdb-btn next to lookup-candidates-cancel', async () => {
    mockSearch.mockResolvedValue([
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
      { title: "Frankelda's Book of Spooks", year: 2024, imdbId: 'tt9999999' },
    ])
    renderForm()
    await runLookup('Spooks')

    await waitFor(() => screen.getAllByTestId('lookup-candidate'))
    expect(screen.getByTestId('search-tmdb-btn')).toBeInTheDocument()
    expect(screen.getByTestId('lookup-candidates-cancel')).toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-06: no escape hatch on the exactly-one-result auto-resolve path', () => {
  it('does not render search-tmdb-btn when OMDb search auto-resolves a single candidate', async () => {
    mockSearch.mockResolvedValue([{ title: 'Spooks', imdbId: 'tt0290403' }])
    mockResolve.mockResolvedValue({ title: 'Spooks', year: 2002 })
    renderForm()
    await runLookup('Spooks')

    await waitFor(() => expect(screen.getByLabelText(/^year/i)).toHaveValue(2002))
    expect(screen.queryByTestId('search-tmdb-btn')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-07/12: clicking Search TMDB instead clears OMDb state and searches TMDB', () => {
  it('clears candidates/lookupError and calls searchTmdb with the trimmed title', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([])
    renderForm()
    await runLookup('  Spooks  ')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))

    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    expect(screen.getByTestId('search-tmdb-btn')).toHaveTextContent(/searching tmdb/i)
    await waitFor(() => expect(mockSearchTmdb).toHaveBeenCalledWith('Spooks'))
  })
})

describe('FRONTEND-016-AC-08: zero TMDB results is a dead end', () => {
  it('shows a distinct message and does not re-render the escape hatch', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([])
    renderForm()
    await runLookup('Xyzzy')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no matches found on tmdb/i),
    )
    expect(screen.queryByTestId('search-tmdb-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('lookup-tmdb-candidates')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-09/12: exactly one TMDB result auto-resolves', () => {
  it('resolves and applies the single TMDB candidate without showing a picker', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 4046, title: 'Spooks', year: 2002 }])
    mockResolveTmdb.mockResolvedValue({ title: 'Spooks', year: 2002, imdbId: 'tt0160904' })
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))

    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() => expect(mockResolveTmdb).toHaveBeenCalledWith(4046))
    await waitFor(() => expect(screen.getByLabelText(/^year/i)).toHaveValue(2002))
    expect(screen.queryByTestId('lookup-tmdb-candidates')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-11: auto-resolve failure', () => {
  it('shows the lookup error and leaves fields untouched', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 4046, title: 'Spooks', year: 2002 }])
    mockResolveTmdb.mockRejectedValue(new ApiError(502, 'Unable to reach the series lookup service. Please try again.'))
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/unable to reach/i))
    expect(screen.getByLabelText(/^year/i)).toHaveValue(null)
  })
})

describe('FRONTEND-016-AC-10/13/14: two or more TMDB results shows a picker', () => {
  it('renders one button per candidate with title/year/originalTitle/poster', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002, posterUrl: 'https://example.com/spooks.jpg' },
      { tmdbId: 65327, title: 'Money Heist', year: 2017, originalTitle: 'La Casa de Papel' },
    ])
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() => expect(screen.getAllByTestId('lookup-tmdb-candidate')).toHaveLength(2))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByText(/la casa de papel/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-16/17/18: selecting a TMDB candidate resolves and applies it', () => {
  it('calls resolveTmdbCandidate for the clicked candidate, applies it, and clears the picker', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    mockResolveTmdb.mockResolvedValue({ title: 'Spooks', year: 2002, imdbId: 'tt0160904' })
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-tmdb-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^spooks/i }))

    await waitFor(() => expect(mockResolveTmdb).toHaveBeenCalledWith(4046))
    await waitFor(() => expect(screen.getByLabelText(/^year/i)).toHaveValue(2002))
    expect(screen.queryByTestId('lookup-tmdb-candidates')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-19: a failed TMDB candidate resolution keeps the picker open', () => {
  it('shows the error and leaves the TMDB picker showing, buttons re-enabled', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    mockResolveTmdb.mockRejectedValue(new ApiError(502, 'Unable to reach the series lookup service. Please try again.'))
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-tmdb-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^spooks/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/unable to reach/i))
    expect(screen.getAllByTestId('lookup-tmdb-candidate')).toHaveLength(2)
    expect(screen.getAllByTestId('lookup-tmdb-candidate')[0]).not.toBeDisabled()
  })
})

describe('FRONTEND-016-AC-15: dismissing the TMDB picker', () => {
  it('clears the picker without resolving anything', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-tmdb-candidate'))

    fireEvent.click(screen.getByTestId('lookup-tmdb-candidates-cancel'))

    expect(screen.queryByTestId('lookup-tmdb-candidates')).not.toBeInTheDocument()
    expect(mockResolveTmdb).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-016-AC-21: re-clicking Look Up clears a stale TMDB picker', () => {
  it('clears tmdbCandidates when a fresh OMDb search cycle starts', async () => {
    mockSearch.mockResolvedValueOnce([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-tmdb-candidate'))

    mockSearch.mockResolvedValueOnce([])
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.queryByTestId('lookup-tmdb-candidates')).not.toBeInTheDocument(),
    )
  })
})

describe('FRONTEND-016-AC-22: no logging of TMDB search/resolve data', () => {
  it('never logs the searched title or a resolved TMDB result', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 1, title: 'Secret Show' }])
    mockResolveTmdb.mockResolvedValue({ title: 'Secret Show' })
    renderForm()
    await runLookup('Secret Show')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() => expect(mockResolveTmdb).toHaveBeenCalled())
    expect(
      logSpy.mock.calls.flat().some((c) => String(c).includes('Secret Show')),
    ).toBe(false)
  })
})
```

**Test Case (Green)** for every sketch above: implement `LookupTmdbCandidate`, `seriesApi.searchTmdb`/`resolveTmdbCandidate`, and the `tmdbCandidates`/`resolvingTmdbCandidate` state and rendering in `AddSeriesForm` until the tests above pass.

---

## Acceptance Criteria Summary

- [x] FRONTEND-016-AC-01: `LookupTmdbCandidate` type
- [x] FRONTEND-016-AC-02: `seriesApi.searchTmdb`
- [x] FRONTEND-016-AC-03: `seriesApi.resolveTmdbCandidate` (reuses `OmdbLookupResult`)
- [x] FRONTEND-016-AC-04: escape hatch shown alongside zero-OMDb-results message
- [x] FRONTEND-016-AC-05: escape hatch shown alongside the 2+-result OMDb picker's Cancel button
- [x] FRONTEND-016-AC-06: escape hatch not shown on the exactly-one-OMDb-result auto-resolve path
- [x] FRONTEND-016-AC-07: click clears OMDb `candidates`/`lookupError`, calls `searchTmdb(title)`
- [x] FRONTEND-016-AC-08: zero TMDB results → distinct dead-end message, escape hatch not re-shown
- [x] FRONTEND-016-AC-09: exactly one TMDB result → auto-resolve via `resolveTmdbCandidate`, applied, no picker
- [x] FRONTEND-016-AC-10: 2+ TMDB results → picker rendered, no second dialog
- [x] FRONTEND-016-AC-11: auto-resolve failure → `lookupError`, fields untouched
- [x] FRONTEND-016-AC-12: `search-tmdb-btn` disabled/"Searching TMDB..." across all three in-flight calls
- [x] FRONTEND-016-AC-13: one `<button data-testid="lookup-tmdb-candidate">` per candidate, reused CSS
- [x] FRONTEND-016-AC-14: each candidate shows title/year/originalTitle-if-different/poster
- [x] FRONTEND-016-AC-15: explicit cancel control clears the TMDB picker without resolving
- [x] FRONTEND-016-AC-16: selecting a TMDB candidate calls `resolveTmdbCandidate(tmdbId)`
- [x] FRONTEND-016-AC-17: success applies result and clears `tmdbCandidates`
- [x] FRONTEND-016-AC-18: TMDB picker buttons disabled while resolving
- [x] FRONTEND-016-AC-19: resolution failure keeps the TMDB picker open, buttons re-enabled
- [x] FRONTEND-016-AC-20: `tmdbCandidates`/`resolvingTmdbCandidate` state introduced, distinct from Spec 015's state
- [x] FRONTEND-016-AC-21: re-clicking "Look Up" clears a stale `tmdbCandidates`
- [x] FRONTEND-016-AC-22: no console logging of TMDB-searched title, candidates, or resolved results
