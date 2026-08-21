# Frontend Spec 026: Origin Country & TMDB Metadata Display

**Status**: Implemented
**Depends on**: Frontend Spec 002 (`SeriesList`) ✅, Frontend Spec 003 (`AddSeriesForm`) ✅, Frontend Spec 005 (`SeriesDetail`) ✅, Frontend Spec 022 (`SeriesLookupResult`, TMDB candidate picker) ✅, Series Spec 021 (`originCountry`, `productionStatus`-at-creation, companion backend spec)
**Frontend Stage**: 26 of N

## Overview

Frontend companion to `series_spec_021_origin_country.md`. Displays a series' TMDB origin country (resolved from its raw ISO 3166-1 alpha-2 code to a readable name via the native `Intl.DisplayNames` API — no lookup table needed) in the "Look Up" candidate picker, the series list, and the series detail view, so a user adding a remade title like "The Office" can tell the UK original from the US remake apart. Also closes two related, frontend-only gaps found while scoping this: `tmdbRating`/`tmdbVoteCount` (added to the `Series`/`SeriesLookupResult` types back in `frontend_spec_022`) were never actually wired into `AddSeriesForm`'s payload-building or lookup-autofill, so every series added via the form has silently stored `null` for both since that spec shipped; and `productionStatus` (stored by the backend since `frontend_spec_023`'s refresh work) was never added to the `Series` type or displayed anywhere in the UI at all — the refresh success message ("production status updated") was describing an invisible update.

**Design decisions**:
- **Country names are resolved via the native `Intl.DisplayNames` API, not a hand-maintained lookup table.** `new Intl.DisplayNames(['en'], { type: 'region' }).of('GB')` returns `"United Kingdom"` with zero dependencies and correct-by-construction ISO 3166-1 coverage — see the backend companion spec's own Design Decisions for why the raw code is stored rather than a resolved name.
- **Standard ISO/CLDR country names are used as-is ("United Kingdom", "United States"), not custom abbreviations ("UK", "USA").** Picking custom short forms for just a couple of countries would mean two different naming conventions on screen depending on which country a series happens to be from; the standard name stays consistent across all ~250 codes `Intl.DisplayNames` covers.
- **`tmdbRating`/`tmdbVoteCount`/`originCountry`/`productionStatus` are treated as read-only, system-populated metadata, not user-editable form inputs** — the same existing pattern `imdbId` already uses in `AddSeriesForm`'s `FormState` (carried through silently from the lookup result to the create payload, never rendered as an `<input>`). Unlike `imdbRating`/`rottenTomatoesRating` (which the user can knowingly override), a hand-typed "TMDB rating" or "origin country" wouldn't mean anything — it's TMDB's own data, not the user's opinion.
- **No `EditSeriesForm` changes are needed.** `EditSeriesForm`'s `buildPayload` already omits any field with no corresponding form input entirely (rather than sending it as `null`), and `SeriesService.update` on the backend only touches fields present in the incoming payload — so these four read-only fields already survive an edit-and-save round-trip untouched, with no code change required to preserve that.
- **`SeriesList`'s "(Year) | Country" text sits next to, not inside, the clickable title button** — mirroring the now-removed `alternateTitle` display's own precedent (`frontend_spec_017`/superseded by `frontend_spec_022`) of a separate muted span beside the title, keeping the button's accessible name to just the title/year.

---

## Requirements

### Requirement 1: Types

**User story**: As a developer, I want the shared types to carry every TMDB-sourced field this app now persists, so no component silently drops one when building a request.

#### Acceptance Criteria

- **FRONTEND-026-AC-01** [AUTO]: `src/types/series.ts`'s `Series` interface shall gain `originCountry: string | null` and `productionStatus: string | null`.
- **FRONTEND-026-AC-02** [AUTO]: `CreateSeriesRequest` shall gain `tmdbRating?: number`, `tmdbVoteCount?: number`, `originCountry?: string`, and `productionStatus?: string`.
- **FRONTEND-026-AC-03** [AUTO]: `SeriesLookupResult` shall gain `originCountry?: string` and `productionStatus?: string`.
- **FRONTEND-026-AC-04** [AUTO]: `LookupTmdbCandidate` shall gain `originCountry?: string`.

### Requirement 2: Country Name Utility

**User story**: As a developer, I want one shared function that turns an ISO country code into a readable name, so every component resolves it the same way.

#### Acceptance Criteria

- **FRONTEND-026-AC-05** [AUTO]: A new `src/utils/countryName.ts` shall export `formatCountryName(code: string | null): string | null`, returning `null` when `code` is `null`, the resolved display name (e.g. `"GB"` → `"United Kingdom"`, `"US"` → `"United States"`) via `Intl.DisplayNames`, and the raw code unchanged if resolution throws or returns `undefined` (an unrecognized code degrades to showing the raw value, never to a blank or crashed render).

### Requirement 3: `AddSeriesForm` Captures Full TMDB Metadata

**User story**: As a user, when I look up and add a series, I want its TMDB rating, vote count, origin country, and production status actually saved, not silently dropped.

#### Acceptance Criteria

- **FRONTEND-026-AC-06** [AUTO]: `AddSeriesForm`'s lookup-autofill (`applyLookupResult`) shall carry `tmdbRating`, `tmdbVoteCount`, `originCountry`, and `productionStatus` from a resolved `SeriesLookupResult` into form state, the same way it already does for `imdbId` — not rendered as visible inputs (see Design Decisions).
- **FRONTEND-026-AC-07** [AUTO]: `AddSeriesForm`'s submit payload (`buildPayload`) shall include `tmdbRating`, `tmdbVoteCount`, `originCountry`, and `productionStatus` whenever a lookup populated them.
- **FRONTEND-026-AC-08** [AUTO]: The TMDB candidate picker (`tmdbCandidates` list) shall display each candidate's origin country (via `formatCountryName`) alongside its title/year/original title, so a user can distinguish same-titled candidates before picking one (e.g. "The Office (2001) — United Kingdom" vs "The Office (2005) — United States").

### Requirement 4: `SeriesDetail` Displays TMDB Metadata

**User story**: As a user, I want to see a series' origin country, production status, and TMDB rating on its detail page, not just its IMDb/Rotten Tomatoes ratings.

#### Acceptance Criteria

- **FRONTEND-026-AC-09** [AUTO]: `SeriesDetail` shall display an "Origin Country" field showing `formatCountryName(series.originCountry)`, or `"—"` when `null` (same `formatValue` convention as every other optional field on this page).
- **FRONTEND-026-AC-10** [AUTO]: `SeriesDetail` shall display a "Production Status" field showing a human-readable form of `series.productionStatus` (e.g. `"IN_PRODUCTION"` → `"In Production"`), or `"—"` when `null`.
- **FRONTEND-026-AC-11** [AUTO]: `SeriesDetail` shall display "TMDB Rating" and "TMDB Vote Count" fields (`series.tmdbRating`/`series.tmdbVoteCount`), each `"—"` when `null` — alongside the existing IMDb/Rotten Tomatoes rating fields.

### Requirement 5: `SeriesList` Shows Year and Country

**User story**: As a user, I want to tell same-titled series in my own list apart at a glance, without opening each one.

#### Acceptance Criteria

- **FRONTEND-026-AC-12** [AUTO]: Each `SeriesList` row's title button shall append the series' year in parentheses when non-null (e.g. `"The Office (2001)"`), unchanged (just the title) when `year` is `null`.
- **FRONTEND-026-AC-13** [AUTO]: Each `SeriesList` row shall display `formatCountryName(s.originCountry)` in a muted span immediately after the title button, prefixed with `" | "`, when `originCountry` is non-null — rendering nothing extra when `null`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `originCountry`/`productionStatus`-at-creation backend fields, `SeriesLookupDto`/`TmdbLookupCandidateDto` shapes | `series_spec_021_origin_country.md` (backend companion) |
| `SeriesLookupResult` (renamed from `OmdbLookupResult`), TMDB candidate picker, `AddSeriesForm`'s existing `imdbId`-as-hidden-field precedent | `frontend_spec_022_tmdb_primary_lookup.md` |
| `tmdbRating`/`tmdbVoteCount` original type addition (never wired into `AddSeriesForm`, the gap `FRONTEND-026-AC-06`/`AC-07` close) | `frontend_spec_022_tmdb_primary_lookup.md` (`FRONTEND-022-AC-12`) |
| `productionStatus` original backend addition (never added to the frontend `Series` type until now) | `frontend_spec_023_series_refresh.md` (refresh summary message referencing it) |
| Superseded `alternateTitle`-next-to-title muted-span display precedent | `frontend_spec_017_alternate_title.md` (superseded by `frontend_spec_022`) |

---

## TDD Test Case Sketches

### `src/utils/countryName.test.ts`

```typescript
describe('FRONTEND-026-AC-05: formatCountryName', () => {
  it('resolves ISO codes to display names', () => {
    expect(formatCountryName('GB')).toBe('United Kingdom')
    expect(formatCountryName('US')).toBe('United States')
  })

  it('returns null for a null code', () => {
    expect(formatCountryName(null)).toBeNull()
  })

  it('falls back to the raw code for an unresolvable value', () => {
    expect(formatCountryName('ZZ')).toBe('ZZ')
  })
})
```

### `src/components/AddSeriesForm.test.tsx` (additions)

```typescript
describe('FRONTEND-026-AC-06/07: TMDB metadata carried through to the create payload', () => {
  it('includes tmdbRating, tmdbVoteCount, originCountry, and productionStatus after a resolved lookup', async () => {
    vi.mocked(seriesApi.searchTmdb).mockResolvedValue([
      { tmdbId: 2996, title: 'The Office', year: 2001 },
    ])
    vi.mocked(seriesApi.resolveTmdbCandidate).mockResolvedValue({
      title: 'The Office',
      tmdbRating: 7.7,
      tmdbVoteCount: 450,
      originCountry: 'GB',
      productionStatus: 'ENDED',
    })
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'The Office' } })
    fireEvent.click(screen.getByRole('button', { name: /look up/i }))
    await screen.findByDisplayValue('The Office')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(seriesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tmdbRating: 7.7,
          tmdbVoteCount: 450,
          originCountry: 'GB',
          productionStatus: 'ENDED',
        }),
      ),
    )
  })
})

describe('FRONTEND-026-AC-08: candidate picker shows origin country', () => {
  it('displays each candidate\'s country to disambiguate same-titled results', async () => {
    vi.mocked(seriesApi.searchTmdb).mockResolvedValue([
      { tmdbId: 2996, title: 'The Office', year: 2001, originCountry: 'GB' },
      { tmdbId: 2316, title: 'The Office', year: 2005, originCountry: 'US' },
    ])
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'The Office' } })
    fireEvent.click(screen.getByRole('button', { name: /look up/i }))

    expect(await screen.findByText(/united kingdom/i)).toBeInTheDocument()
    expect(screen.getByText(/united states/i)).toBeInTheDocument()
  })
})
```

### `src/components/SeriesDetail.test.tsx` (additions)

```typescript
describe('FRONTEND-026-AC-09/10/11: TMDB metadata fields', () => {
  it('displays origin country, production status, and TMDB rating/vote count', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({
        originCountry: 'GB',
        productionStatus: 'ENDED',
        tmdbRating: 7.7,
        tmdbVoteCount: 450,
      }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('United Kingdom')).toBeInTheDocument()
    expect(screen.getByText('Ended')).toBeInTheDocument()
    expect(screen.getByText('7.7')).toBeInTheDocument()
    expect(screen.getByText('450')).toBeInTheDocument()
  })

  it('shows "—" for each field when null', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({
        originCountry: null,
        productionStatus: null,
        tmdbRating: null,
        tmdbVoteCount: null,
      }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText('The Office')
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })
})
```

### `src/components/SeriesList.test.tsx` (additions)

```typescript
describe('FRONTEND-026-AC-12/13: year and country next to the title', () => {
  it('shows "(Year) | Country" for a series with both set', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ title: 'The Office', year: 2001, originCountry: 'GB' }),
    ])
    render(<SeriesList />)

    expect(await screen.findByText('The Office (2001)')).toBeInTheDocument()
    expect(screen.getByText('| United Kingdom')).toBeInTheDocument()
  })

  it('omits the year suffix and country span when both are null', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ title: 'Obscure Show', year: null, originCountry: null }),
    ])
    render(<SeriesList />)

    expect(await screen.findByText('Obscure Show')).toBeInTheDocument()
    expect(screen.queryByText('|', { exact: false })).not.toBeInTheDocument()
  })
})
```

Note: every `makeSeries` test-fixture helper (`SeriesList.test.tsx`, `SeriesDetail.test.tsx`, `EditSeriesForm.test.tsx`, `RecommendationControls.test.tsx`, `services/__tests__/seriesApi.test.ts`) will need `originCountry`/`productionStatus` added to its default shape, the same way `frontend_spec_023` had to add `lastRefreshedAt` to each when `Series` last gained a field.

---

## Acceptance Criteria Summary

- [x] FRONTEND-026-AC-01: `Series` gains `originCountry`/`productionStatus`
- [x] FRONTEND-026-AC-02: `CreateSeriesRequest` gains `tmdbRating`/`tmdbVoteCount`/`originCountry`/`productionStatus`
- [x] FRONTEND-026-AC-03: `SeriesLookupResult` gains `originCountry`/`productionStatus`
- [x] FRONTEND-026-AC-04: `LookupTmdbCandidate` gains `originCountry`
- [x] FRONTEND-026-AC-05: `formatCountryName` utility
- [x] FRONTEND-026-AC-06: `AddSeriesForm` autofill carries the four fields through
- [x] FRONTEND-026-AC-07: `AddSeriesForm` payload includes the four fields
- [x] FRONTEND-026-AC-08: candidate picker shows origin country
- [x] FRONTEND-026-AC-09: `SeriesDetail` shows Origin Country
- [x] FRONTEND-026-AC-10: `SeriesDetail` shows Production Status
- [x] FRONTEND-026-AC-11: `SeriesDetail` shows TMDB Rating/Vote Count
- [x] FRONTEND-026-AC-12: `SeriesList` title shows "(Year)"
- [x] FRONTEND-026-AC-13: `SeriesList` shows "| Country"
