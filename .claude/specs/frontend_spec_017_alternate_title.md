# Frontend Spec 017: Alternate Title

**Status**: Implemented. **Superseded (removed) by `frontend_spec_022_tmdb_primary_lookup.md`**: the `alternateTitle` field and its display across `Add`/`EditSeriesForm`, `SeriesList`, and `SeriesDetail` are removed, per the backend field removal in `series_spec_017_tmdb_primary_lookup.md`. Kept for historical/traceability reference; no AC here is renumbered or deleted.
**Priority**: P2 (quality-of-life / correctness fix for adding series — not core CRUD)
**Depends on**: Series Spec 013 (`alternateTitle` field) ✅, Frontend Spec 009 (OMDb Autofill & Poster Display) ✅, Frontend Spec 015 (Lookup Candidate Picker) ✅, Frontend Spec 016 (TMDB Lookup Fallback) ✅
**Frontend Stage**: 17 of N

---

## Overview

`series_spec_013_alternate_title.md` added a nullable `alternateTitle` column to `SeriesEntity`/`SeriesDto` as pure passthrough storage, deliberately leaving "what value goes in it" and all rendering as frontend work. The gap it exists to close: OMDb sometimes catalogues a show under a different name than the one a user searches for or recognizes — confirmed live with the UK drama "Spooks" (2002), which the TMDB-fallback picker (`series_spec_012_tmdb_lookup_fallback.md`/`frontend_spec_016_tmdb_lookup_fallback.md`) resolves via OMDb to the title "MI-5", with nothing anywhere indicating these are the same show.

This spec is that frontend work. `AddSeriesForm.tsx`'s `applyLookupResult` function gains a third parameter — a "reference title" to compare against the lookup result's own title — so that whenever a lookup resolution's title differs from the name the user actually knows the show by, that name is captured into a new, ordinary, user-editable `alternateTitle` form field (not silently-set metadata). The same field is added to `EditSeriesForm.tsx` for consistency, since it's a stored field like any other and should be addable/editable/clearable without re-running a lookup. `SeriesList.tsx` and `SeriesDetail.tsx` both render it, muted, next to/near the primary title, so a user immediately sees "MI-5 — aka Spooks" rather than just "MI-5".

---

## Requirements

### Requirement 1: Types

**User story**: As a developer, I want `alternateTitle` typed on the request/response shapes the same way every other optional string field already is, so nothing has to redeclare its shape.

#### Acceptance Criteria

- **FRONTEND-017-AC-01** [AUTO]: `src/types/series.ts`'s `Series` interface shall gain `alternateTitle: string | null`, matching `genres`'s own nullable-string shape (verified by compilation: any code assuming `Series.alternateTitle` exists must type-check).
- **FRONTEND-017-AC-02** [AUTO]: `src/types/series.ts`'s `CreateSeriesRequest` interface shall gain `alternateTitle?: string`, matching `genres`'s own optional-string shape — `UpdateSeriesRequest` (`Partial<CreateSeriesRequest> & { ... }`) inherits it automatically, with no separate declaration needed.

---

### Requirement 2: `applyLookupResult` — Reference-Title Parameter & Mismatch Detection

**User story**: As a user who searched for a show under the name I know it by, I want the app to notice when a lookup source resolves it to a different canonical title, so I don't lose track of which name I actually searched for.

#### Acceptance Criteria

- **FRONTEND-017-AC-03** [AUTO]: `applyLookupResult` shall accept a third parameter, `referenceTitle: string`, in addition to its existing `form` and `result` parameters.
- **FRONTEND-017-AC-04** [AUTO]: When `referenceTitle`, trimmed, is non-empty and differs from `result.title` (case-insensitive comparison, both trimmed), `applyLookupResult` shall set the returned `FormState.alternateTitle` to the trimmed `referenceTitle`.
- **FRONTEND-017-AC-05** [AUTO]: When `referenceTitle`, trimmed, is empty, or matches `result.title` (case-insensitive comparison, both trimmed), `applyLookupResult` shall leave `FormState.alternateTitle` unchanged from the form's prior value — consistent with every other field `applyLookupResult` only conditionally overwrites (it neither invents a value nor clears an existing one on a match/blank).

---

### Requirement 3: Reference Title Per Call Site

**User story**: As a user, I want the "other name" captured to be the most meaningful one available at the point I confirmed a match, so the alternate title is actually useful rather than an artifact of whichever endpoint happened to run.

#### Acceptance Criteria

- **FRONTEND-017-AC-06** [AUTO]: In `handleLookup`'s exactly-one-OMDb-result auto-resolve path, `AddSeriesForm` shall pass the trimmed, user-typed Title field value (the `title` local already computed at the top of `handleLookup`) as `referenceTitle` to `applyLookupResult`.
- **FRONTEND-017-AC-07** [AUTO]: In `handleSelectCandidate` (the OMDb 2+-result candidate-picker selection path), `AddSeriesForm` shall pass the trimmed Title field value as `referenceTitle` — the same source as `FRONTEND-017-AC-06`, since a candidate picked from OMDb's own search results is still OMDb's own naming, not a more-authoritative signal.
- **FRONTEND-017-AC-08** [AUTO]: In `handleSearchTmdb`'s exactly-one-TMDB-result auto-resolve path, `AddSeriesForm` shall pass the selected TMDB candidate's own `title` (not the originally-typed Title field value) as `referenceTitle` to `applyLookupResult`.
- **FRONTEND-017-AC-09** [AUTO]: In `handleSelectTmdbCandidate` (the TMDB 2+-result candidate-picker selection path), `AddSeriesForm` shall pass the selected TMDB candidate's own `title` as `referenceTitle` — the same source as `FRONTEND-017-AC-08`, since by the point a user has picked a specific TMDB candidate they've confirmed a specific real show, a stronger signal than whatever term they originally typed.

---

### Requirement 4: `AddSeriesForm` — Editable Alternate Title Field

**User story**: As a user adding a series, I want to see, edit, or clear whatever alternate title a lookup populated before I save, so it's never silently-set metadata I can't correct.

#### Acceptance Criteria

- **FRONTEND-017-AC-10** [AUTO]: `AddSeriesForm`'s `FormState` shall gain an `alternateTitle: string` field, defaulting to `''` in `initialFormState`.
- **FRONTEND-017-AC-11** [AUTO]: `AddSeriesForm` shall render an editable Alternate Title field (`<div className={styles.field}><label htmlFor="alternateTitle">Alternate Title</label><input id="alternateTitle" ...></div>`, wired through the existing `updateField('alternateTitle')` handler) positioned directly after the Title field's row and before the Year field — following the Genres field's exact structural pattern, since Alternate Title is conceptually the closest field to Title.
- **FRONTEND-017-AC-12** [AUTO]: `buildPayload` shall include `alternateTitle` (trimmed) in the returned `CreateSeriesRequest` when `form.alternateTitle.trim() !== ''`, and shall omit the key entirely when blank — the same trim/omit-if-blank rule already applied to `genres`.
- **FRONTEND-017-AC-13** [AUTO]: `buildInitialFormState` shall populate `next.alternateTitle` from `initialValues.alternateTitle` when it is non-null, matching how `genres` is already handled there.

---

### Requirement 5: `EditSeriesForm` — Editable Alternate Title Field

**User story**: As a user editing an existing series, I want to add, edit, or clear its alternate title after the fact, without needing to re-run a lookup, so it behaves like every other stored field.

#### Acceptance Criteria

- **FRONTEND-017-AC-14** [AUTO]: `EditSeriesForm`'s `FormState` shall gain an `alternateTitle: string` field.
- **FRONTEND-017-AC-15** [AUTO]: `toFormState` shall populate `alternateTitle` from `series.alternateTitle ?? ''`, matching how `genres` is already handled there.
- **FRONTEND-017-AC-16** [AUTO]: `EditSeriesForm` shall render an editable Alternate Title field, structurally identical to `AddSeriesForm`'s (`FRONTEND-017-AC-11`), positioned directly after the Title field and before the Year field, wired through the existing `updateField('alternateTitle')` handler.
- **FRONTEND-017-AC-17** [AUTO]: `buildPayload` shall include `alternateTitle` (trimmed) in the returned `UpdateSeriesRequest` when `form.alternateTitle.trim() !== ''`, and shall omit the key entirely when blank — the same trim/omit-if-blank rule already applied to `genres`, and the same null-if-unset `PATCH` semantics `series_spec_013_alternate_title.md` (`SERIES-013-AC-03`) establishes on the backend.

---

### Requirement 6: `SeriesList` — Row Display

**User story**: As a user browsing my series list, I want to see a show's alternate name right next to its title, so I recognize it at a glance even when it's catalogued under an unfamiliar name.

#### Acceptance Criteria

- **FRONTEND-017-AC-18** [AUTO]: While rendering a series row, where `s.alternateTitle` is non-null, `SeriesList` shall render it as muted secondary text (e.g. `aka {s.alternateTitle}`) as a sibling element next to the existing `<button className={styles.title}>{s.title}</button>` — not nested inside it, consistent with this app's no-nested-interactive-controls precedent (`frontend_spec_008_accessible_row_interactions.md`).
- **FRONTEND-017-AC-19** [AUTO]: While rendering a series row, where `s.alternateTitle` is null, `SeriesList` shall not render that secondary text.

---

### Requirement 7: `SeriesDetail` — Heading-Area Display

**User story**: As a user viewing a series' full record, I want its alternate name shown prominently near the main title, not buried in the fields list, so at-a-glance recognition is actually served.

#### Acceptance Criteria

- **FRONTEND-017-AC-20** [AUTO]: Where `series.alternateTitle` is non-null, `SeriesDetail` shall render it (e.g. `aka {series.alternateTitle}`) near the `<h2 className={styles.heading}>{series.title}</h2>` heading — not as an entry in the `<dl className={styles.fields}>` list below (unlike `Genres`/`Personal Notes`).
- **FRONTEND-017-AC-21** [AUTO]: Where `series.alternateTitle` is null, `SeriesDetail` shall not render that text near the heading.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `alternateTitle` backend contract: nullable column, null-if-unset `PATCH` semantics, no format validation, CRUD/export passthrough | `series_spec_013_alternate_title.md` |
| `OmdbLookupResult` type, `applyLookupResult`'s existing overwrite rules, `lookingUp`/`lookupError` state | `frontend_spec_009_omdb_autofill.md` |
| `searchByTitle`/`lookupByImdbId`, `candidates`/`resolvingCandidate` state, `handleLookup`/`handleSelectCandidate` (OMDb candidate-picker call sites this spec extends) | `frontend_spec_015_lookup_candidate_picker.md` |
| `searchTmdb`/`resolveTmdbCandidate`, `tmdbCandidates`/`resolvingTmdbCandidate` state, `handleSearchTmdb`/`handleSelectTmdbCandidate` (TMDB candidate-picker call sites this spec extends) | `frontend_spec_016_tmdb_lookup_fallback.md` |
| `AddSeriesForm`'s Genres field structure (`<div className={styles.field}>` pattern) this spec's Alternate Title field mirrors | `frontend_spec_003_add_series_form.md` |
| `EditSeriesForm`'s Genres field structure and `toFormState`/`buildPayload` wiring this spec's Alternate Title field mirrors | `frontend_spec_004_edit_delete_series.md` |
| No-nested-interactive-controls precedent (`SeriesList` row title `<button>` stays the row's only interactive element) | `frontend_spec_008_accessible_row_interactions.md` |

---

## TDD Test Case Sketches

### `src/components/AddSeriesForm.test.tsx` (additions)

`applyLookupResult` is not exported from `AddSeriesForm.tsx`; its behavior (Requirements 2 and 3) is verified end-to-end through the rendered `Alternate Title` field, the same way `FRONTEND-009-AC-07/08/09` already verify `applyLookupResult`'s existing overwrite rules.

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

describe('FRONTEND-017-AC-04/06: typed title differs from the OMDb auto-resolved result', () => {
  it('captures the typed title into Alternate Title', async () => {
    mockSearch.mockResolvedValue([{ title: 'MI-5', imdbId: 'tt0160904' }])
    mockResolve.mockResolvedValue({ title: 'MI-5', year: 2002, imdbId: 'tt0160904' })
    renderForm()
    await runLookup('Spooks')

    await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue('MI-5'))
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('Spooks')
  })
})

describe('FRONTEND-017-AC-05: typed title matches the resolved result (case/whitespace-insensitive)', () => {
  it('leaves Alternate Title blank', async () => {
    mockSearch.mockResolvedValue([{ title: 'Breaking Bad', imdbId: 'tt0903747' }])
    mockResolve.mockResolvedValue({ title: 'Breaking Bad', year: 2008 })
    renderForm()
    await runLookup('  breaking bad  ')

    await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue('Breaking Bad'))
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('')
  })
})

describe('FRONTEND-017-AC-07: OMDb candidate-picker selection uses the typed title as the reference', () => {
  it('captures the typed title into Alternate Title when the selected candidate resolves to a different name', async () => {
    mockSearch.mockResolvedValue([
      { title: 'MI-5', imdbId: 'tt0160904' },
      { title: 'Spooks: Code 9', imdbId: 'tt1219342' },
    ])
    mockResolve.mockResolvedValue({ title: 'MI-5', year: 2002, imdbId: 'tt0160904' })
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getAllByTestId('lookup-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^mi-5/i }))

    await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue('MI-5'))
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('Spooks')
  })
})

describe('FRONTEND-017-AC-08: TMDB auto-resolve uses the selected candidate\'s own title as the reference', () => {
  it('captures the TMDB candidate title, not the originally-typed term', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 4046, title: 'Spooks', year: 2002 }])
    mockResolveTmdb.mockResolvedValue({ title: 'MI-5', year: 2002, imdbId: 'tt0160904' })
    renderForm()
    await runLookup('spooks uk drama')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue('MI-5'))
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('Spooks')
  })
})

describe('FRONTEND-017-AC-09: TMDB candidate-picker selection uses the selected candidate\'s own title as the reference', () => {
  it('captures the selected TMDB candidate\'s title, not the originally-typed term', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    mockResolveTmdb.mockResolvedValue({ title: 'MI-5', year: 2002, imdbId: 'tt0160904' })
    renderForm()
    await runLookup('spooks uk drama')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-tmdb-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^spooks/i }))

    await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue('MI-5'))
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('Spooks')
  })
})

describe('FRONTEND-017-AC-11: Alternate Title field renders between Title and Year', () => {
  it('renders an editable, initially-empty Alternate Title input', () => {
    renderForm()
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('')
  })
})

describe('FRONTEND-017-AC-12: submission payload includes/omits alternateTitle', () => {
  it('omits alternateTitle when blank', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Show' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('alternateTitle')
  })

  it('includes a trimmed alternateTitle when populated', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'MI-5' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'MI-5' } })
    fireEvent.change(screen.getByLabelText(/alternate title/i), {
      target: { value: '  Spooks  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate.mock.calls[0][0].alternateTitle).toBe('Spooks')
  })
})

describe('FRONTEND-017-AC-13: buildInitialFormState populates alternateTitle from initialValues', () => {
  it('pre-fills Alternate Title when initialValues.alternateTitle is set', () => {
    renderForm({ initialValues: { title: 'MI-5', alternateTitle: 'Spooks' } })
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('Spooks')
  })
})
```

### `src/components/EditSeriesForm.test.tsx` (additions)

```typescript
describe('FRONTEND-017-AC-15/16: Alternate Title pre-populated from the series', () => {
  it('pre-fills from series.alternateTitle', () => {
    renderForm({ series: makeSeries({ title: 'MI-5', alternateTitle: 'Spooks' }) })
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('Spooks')
  })

  it('renders blank when series.alternateTitle is null', () => {
    renderForm({ series: makeSeries({ alternateTitle: null }) })
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('')
  })
})

describe('FRONTEND-017-AC-17: submission payload includes/omits alternateTitle', () => {
  it('omits alternateTitle when blank', async () => {
    const series = makeSeries({ alternateTitle: null })
    mockUpdate.mockResolvedValue(series)
    renderForm({ series })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty('alternateTitle')
  })

  it('includes a trimmed alternateTitle when populated', async () => {
    const series = makeSeries({ title: 'MI-5', alternateTitle: null })
    mockUpdate.mockResolvedValue(series)
    renderForm({ series })
    fireEvent.change(screen.getByLabelText(/alternate title/i), {
      target: { value: '  Spooks  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    expect(mockUpdate.mock.calls[0][1].alternateTitle).toBe('Spooks')
  })
})
```

### `src/components/SeriesList.test.tsx` (additions)

```typescript
describe('FRONTEND-017-AC-18/19: alternate title shown next to the row title', () => {
  it('renders "aka {alternateTitle}" next to the title when present', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ title: 'MI-5', alternateTitle: 'Spooks' }),
    ])
    render(<SeriesList />)

    await waitFor(() => expect(screen.getByText('MI-5')).toBeInTheDocument())
    expect(screen.getByText(/aka spooks/i)).toBeInTheDocument()
  })

  it('renders nothing extra when alternateTitle is null', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ title: 'Breaking Bad', alternateTitle: null }),
    ])
    render(<SeriesList />)

    await waitFor(() => expect(screen.getByText('Breaking Bad')).toBeInTheDocument())
    expect(screen.queryByText(/^aka /i)).not.toBeInTheDocument()
  })

  it('does not nest the alternate title text inside the title button', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ title: 'MI-5', alternateTitle: 'Spooks' }),
    ])
    render(<SeriesList />)

    const titleButton = await screen.findByRole('button', { name: 'MI-5' })
    expect(titleButton).not.toHaveTextContent(/spooks/i)
  })
})
```

### `src/components/SeriesDetail.test.tsx` (additions)

```typescript
describe('FRONTEND-017-AC-20/21: alternate title shown near the heading, not in the fields list', () => {
  it('renders "aka {alternateTitle}" near the heading when present', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ title: 'MI-5', alternateTitle: 'Spooks' }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'MI-5' })).toBeInTheDocument())
    expect(screen.getByText(/aka spooks/i)).toBeInTheDocument()
    expect(screen.queryByText('Alternate Title')).not.toBeInTheDocument() // not in the <dl> fields list
  })

  it('renders nothing extra when alternateTitle is null', async () => {
    mockGetById.mockResolvedValue(makeSeries({ alternateTitle: null }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument())
    expect(screen.queryByText(/^aka /i)).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)** for every sketch above: add `alternateTitle` to the types, thread the `referenceTitle` parameter through `applyLookupResult` and its four call sites, add the editable field to `AddSeriesForm`/`EditSeriesForm` (state, rendering, `buildPayload`/`buildInitialFormState`/`toFormState`), and add the muted display in `SeriesList`/`SeriesDetail`, until the tests above pass. Existing `makeSeries` test helpers in `SeriesList.test.tsx`/`SeriesDetail.test.tsx`/`EditSeriesForm.test.tsx` will need an `alternateTitle: null` default added alongside their other nullable fields for the `Series` type to keep compiling.

---

## Acceptance Criteria Summary

- [x] FRONTEND-017-AC-01: `Series.alternateTitle: string | null`
- [x] FRONTEND-017-AC-02: `CreateSeriesRequest.alternateTitle?: string` (and `UpdateSeriesRequest` via inheritance)
- [x] FRONTEND-017-AC-03: `applyLookupResult` accepts a `referenceTitle: string` third parameter
- [x] FRONTEND-017-AC-04: mismatch (non-empty, differs case-insensitively) sets `alternateTitle`
- [x] FRONTEND-017-AC-05: match or blank leaves `alternateTitle` unchanged
- [x] FRONTEND-017-AC-06: `handleLookup` single-OMDb-result path passes the typed title as `referenceTitle`
- [x] FRONTEND-017-AC-07: `handleSelectCandidate` (OMDb picker) passes the typed title as `referenceTitle`
- [x] FRONTEND-017-AC-08: `handleSearchTmdb` single-TMDB-result path passes the candidate's own title as `referenceTitle`
- [x] FRONTEND-017-AC-09: `handleSelectTmdbCandidate` (TMDB picker) passes the candidate's own title as `referenceTitle`
- [x] FRONTEND-017-AC-10: `AddSeriesForm.FormState.alternateTitle: string`, default `''`
- [x] FRONTEND-017-AC-11: `AddSeriesForm` renders an editable Alternate Title field after Title, before Year
- [x] FRONTEND-017-AC-12: `AddSeriesForm.buildPayload` trims/omits-if-blank `alternateTitle`
- [x] FRONTEND-017-AC-13: `AddSeriesForm.buildInitialFormState` populates `alternateTitle` from `initialValues`
- [x] FRONTEND-017-AC-14: `EditSeriesForm.FormState.alternateTitle: string`
- [x] FRONTEND-017-AC-15: `EditSeriesForm.toFormState` populates `alternateTitle` from `series.alternateTitle ?? ''`
- [x] FRONTEND-017-AC-16: `EditSeriesForm` renders an editable Alternate Title field after Title, before Year
- [x] FRONTEND-017-AC-17: `EditSeriesForm.buildPayload` trims/omits-if-blank `alternateTitle`
- [x] FRONTEND-017-AC-18: `SeriesList` renders "aka {alternateTitle}" next to the title button when present, not nested inside it
- [x] FRONTEND-017-AC-19: `SeriesList` renders nothing extra when `alternateTitle` is null
- [x] FRONTEND-017-AC-20: `SeriesDetail` renders "aka {alternateTitle}" near the heading (not in the `<dl>`) when present
- [x] FRONTEND-017-AC-21: `SeriesDetail` renders nothing extra near the heading when `alternateTitle` is null

---

## Implementation Notes

- `SeriesList.module.css` gained a new `.alternateTitle` class (muted/italic secondary text) for the sibling `<span>` next to the row's title `<button>`. `SeriesDetail.module.css` gained `.alternateTitle` (same muted/italic treatment, rendered as a `<p>` under the heading) plus a small `.headingWithAlternate` modifier that tightens the heading's bottom margin only when an alternate title is present, so the no-alternate-title layout is pixel-identical to before this spec.
- No browser automation tool was available in this environment (the available toolset is Read/Edit/Write/Bash/Grep/Glob — no Playwright/Puppeteer or similar). Per this repo's own steering note that Vitest/jsdom can't validate real CSS rendering, a manual browser check of the "aka …" placement in `SeriesList`/`SeriesDetail` is still outstanding and should be done before/soon after merge (`npm run dev` + `gradlew.bat bootRun`).
- All 21 acceptance criteria are covered by Vitest/RTL tests in `AddSeriesForm.test.tsx`, `EditSeriesForm.test.tsx`, `SeriesList.test.tsx`, and `SeriesDetail.test.tsx`; `npm test`, `npm run lint`, and `npm run build` all pass.
