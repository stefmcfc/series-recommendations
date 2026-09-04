# Frontend Spec 085: Display All Origin Countries, Not Just the First

**Status**: Complete
**Priority**: P3 (pairs with the backend capability this depends on)
**Depends on**: Series Spec 046 (`series_spec_046_multi_origin_country.md`, the multi-country
`originCountry` value this spec displays) — **backend must ship first**, this spec's display logic is
meaningless without it. Frontend Spec 026 (`frontend_spec_026_origin_country_and_tmdb_metadata_display.md`,
owns `formatCountryName`, the single-code resolver this spec extends) ✅.
**Area**: Frontend (`utils/countryName.ts`, and the 8 call sites listed in Requirement 2/3) — no new
component, no type change.

## Overview

`series_spec_046` widens the backend's `originCountry` value from always-one-code to a possible
comma-separated multi-code string (e.g. `"GB,US"` for a co-production like "MobLand"). Every frontend
call site today passes that raw string straight into `formatCountryName`, which resolves exactly one
ISO code via `Intl.DisplayNames` — given a multi-code string, it would either mis-resolve or fall back
to showing the raw, unformatted value (`formatCountryName`'s own fallback path for an unresolved
code). This spec adds a small multi-country-aware formatter and switches every display site to it, so
"GB,US" renders as "United Kingdom, United States" instead of a raw code or a wrong/blank name.

No backend contract or `Series`/`Recommendation` type changes — `originCountry` stays `string | null`
everywhere on the frontend, exactly as today; only the *value* it can now hold changes, and only
display logic needs updating.

## Design Decisions

- **A new `formatCountryNames(raw: string | null): string | null` utility in `utils/countryName.ts`**,
  alongside (not replacing) the existing single-code `formatCountryName`. Splits `raw` on `,`
  (matching the backend's bare-comma, no-space delimiter — `series_spec_046`'s own convention,
  mirroring `SeriesEntity.genres`'s existing storage format), resolves each code through the existing
  `formatCountryName`, and joins the results with `", "` (comma-space, for display — distinct from the
  bare-comma wire delimiter, matching how this app already displays `genres` as a comma-space-joined
  string on screen even though it's comma-only on the wire).
- **A single-code value produces an identical result to calling `formatCountryName` directly** — e.g.
  `formatCountryNames("GB")` returns the same string as `formatCountryName("GB")`. This isn't a
  parallel, divergent formatter; it's `formatCountryName` applied per-code, so every existing single-
  country display keeps rendering exactly as it does today (regression guard, Requirement 1).
- **Every one of the 8 current `formatCountryName(x.originCountry)` call sites switches to
  `formatCountryNames`** — `SeriesList.tsx`, `SeriesDetail.tsx`, `RecommendationCard.tsx`,
  `RecommendationDetailModal.tsx`, `RecommendationControls.tsx` (×2 call sites), and the two
  candidate-picker sites in `AddSeriesForm.tsx`/`EditSeriesForm.tsx`. A plain find-and-replace of the
  function name at each site — none of these call sites' surrounding JSX/conditional-rendering logic
  changes (each already guards on `!= null`/`!== null` before calling the formatter, which stays
  correct unchanged).
- **No new component, no layout change.** Every call site today renders the formatted string as plain
  text (a `<span>`, a labelled detail row, or inline after a `|`/`—` separator) — a longer
  "United Kingdom, United States" string flows into that exact same slot; no site needs a redesign to
  accommodate it.

---

## Requirement 1: `formatCountryNames` resolves a comma-separated multi-code value

**User story**: As a developer, I want one shared utility that turns a possibly-multi-country raw
value into a display string, so the 8 call sites that show origin country don't each reimplement the
same split/resolve/join logic.

### FRONTEND-085-AC-01 [AUTO]
**Statement**: `formatCountryNames(raw)` shall split `raw` on `,`, resolve each code via the existing
`formatCountryName`, and join the results with `", "`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-085-AC-01: formatCountryNames resolves a multi-code value', () => {
  it('resolves and joins each code with a comma-space', () => {
    expect(formatCountryNames('GB,US')).toBe('United Kingdom, United States')
  })
})
```
**Test Case (Green)**: `raw.split(',').map(formatCountryName).join(', ')`, guarded for `raw === null`.

---

### FRONTEND-085-AC-02 [AUTO] (regression guard)
**Statement**: `formatCountryNames(raw)` shall return the identical result `formatCountryName(raw)`
would for a single-code value, and `null` for a `null` input — no change to today's single-country
behavior.

**Test Case (Red)**:
```typescript
describe('FRONTEND-085-AC-02: single-code and null inputs are unchanged', () => {
  it('matches formatCountryName exactly for one code', () => {
    expect(formatCountryNames('GB')).toBe(formatCountryName('GB'))
  })

  it('returns null for a null input', () => {
    expect(formatCountryNames(null)).toBeNull()
  })
})
```
**Test Case (Green)**: `if (raw === null) return null` before the split/map/join; a one-element split
array collapses to `formatCountryName`'s own single-code result with no `", "` ever inserted.

---

### FRONTEND-085-AC-03 [AUTO]
**Statement**: `formatCountryNames(raw)` shall fall back to each unresolvable code's raw value in
place, exactly as `formatCountryName` already does per-code — a partially-unresolvable multi-country
value degrades gracefully (e.g. one recognized code plus one unrecognized one still shows both, the
unrecognized one as its raw code) rather than the whole value failing to render.

**Test Case (Red)**:
```typescript
describe('FRONTEND-085-AC-03: an unresolvable code within a multi-code value falls back per-code', () => {
  it('keeps a recognized code resolved and an unrecognized one raw', () => {
    expect(formatCountryNames('GB,ZZ')).toBe('United Kingdom, ZZ')
  })
})
```
**Test Case (Green)**: falls out of AC-01's `map(formatCountryName)` directly — no special-casing
needed, since `formatCountryName` already has its own per-code fallback (`series_spec_021`'s
companion `frontend_spec_026`).

---

## Requirement 2: Series display sites show every origin country

**User story**: As a user browsing my tracked series, I want to see every one of a co-production's
origin countries, not just the first, so "MobLand" shows "United Kingdom, United States" rather than
just one.

### FRONTEND-085-AC-04 [AUTO]
**Statement**: `SeriesList` and `SeriesDetail` shall display a series' full `originCountry` value via
`formatCountryNames` instead of `formatCountryName`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-085-AC-04: SeriesList/SeriesDetail show every origin country', () => {
  it('renders both countries for a multi-country series in SeriesList', () => {
    render(<SeriesList series={[makeSeries({ originCountry: 'GB,US' })]} /* ...required props... */ />)
    expect(screen.getByText(/United Kingdom, United States/)).toBeInTheDocument()
  })

  it('renders both countries for a multi-country series in SeriesDetail', () => {
    render(<SeriesDetail series={makeSeries({ originCountry: 'GB,US' })} /* ...required props... */ />)
    expect(screen.getByText('United Kingdom, United States')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: both call sites' `formatCountryName(s.originCountry)` /
`formatCountryName(series.originCountry)` become `formatCountryNames(...)`.

---

### FRONTEND-085-AC-05 [AUTO]
**Statement**: `AddSeriesForm`'s and `EditSeriesForm`'s TMDB candidate-picker lists shall show each
candidate's full origin-country value via `formatCountryNames` instead of `formatCountryName`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-085-AC-05: candidate picker shows every origin country', () => {
  it('renders both countries for a multi-country TMDB candidate', async () => {
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 1, title: 'MobLand', year: 2025, originCountry: 'GB,US' },
      { tmdbId: 2, title: 'MobLand', year: 2025, originCountry: 'GB,US' },
    ])
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'MobLand' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    expect(await screen.findByText(/United Kingdom, United States/)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: both call sites' `formatCountryName(candidate.originCountry)` become
`formatCountryNames(...)`.

---

## Requirement 3: Recommendation display sites show every origin country

**User story**: As a user browsing recommendations, I want to see every one of a candidate's origin
countries, so a co-production isn't shown as if it only had one.

### FRONTEND-085-AC-06 [AUTO]
**Statement**: `RecommendationCard` and `RecommendationDetailModal` shall display a candidate's full
`originCountry` value via `formatCountryNames` instead of `formatCountryName`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-085-AC-06: RecommendationCard/RecommendationDetailModal show every origin country', () => {
  it('renders both countries in RecommendationCard', () => {
    render(<RecommendationCard recommendation={makeRecommendation({ originCountry: 'GB,US' })} /* ... */ />)
    expect(screen.getByText(/United Kingdom, United States/)).toBeInTheDocument()
  })

  it('renders both countries in RecommendationDetailModal', () => {
    render(<RecommendationDetailModal recommendation={makeRecommendation({ originCountry: 'GB,US' })} /* ... */ />)
    expect(screen.getByText('United Kingdom, United States')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: both call sites' `formatCountryName(r.originCountry)` become
`formatCountryNames(...)`.

---

### FRONTEND-085-AC-07 [AUTO]
**Statement**: `RecommendationControls`' two source-series display call sites shall show a series'
full `originCountry` value via `formatCountryNames` instead of `formatCountryName`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-085-AC-07: RecommendationControls source-series display shows every origin country', () => {
  it('renders both countries for a multi-country source series', () => {
    render(<RecommendationControls /* ...required props, a source series with originCountry: 'GB,US'... */ />)
    expect(screen.getByText(/United Kingdom, United States/)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: both `formatCountryName(series.originCountry)` call sites become
`formatCountryNames(...)`.

---

## Cross-References

| This spec | Source |
|---|---|
| Backend `originCountry` multi-value capability this spec displays — **must ship first** | `series_spec_046_multi_origin_country.md` |
| `formatCountryName`, the single-code resolver this spec's `formatCountryNames` wraps | `frontend_spec_026_origin_country_and_tmdb_metadata_display.md`, `utils/countryName.ts` |
| The 8 call sites updated by this spec | `SeriesList.tsx`, `SeriesDetail.tsx`, `AddSeriesForm.tsx`, `EditSeriesForm.tsx`, `RecommendationCard.tsx`, `RecommendationDetailModal.tsx`, `RecommendationControls.tsx` (×2) |
| Backend comma delimiter (bare `,`, no space) this spec's split logic matches | `series_spec_046_multi_origin_country.md`'s Design Decisions |

---

## Acceptance Criteria Summary

- [x] FRONTEND-085-AC-01: `formatCountryNames` resolves and joins a multi-code value
- [x] FRONTEND-085-AC-02: single-code/`null` behavior unchanged from `formatCountryName` (regression guard)
- [x] FRONTEND-085-AC-03: an unresolvable code within a multi-code value falls back per-code
- [x] FRONTEND-085-AC-04: `SeriesList`/`SeriesDetail` show every origin country
- [x] FRONTEND-085-AC-05: `AddSeriesForm`/`EditSeriesForm` candidate pickers show every origin country
- [x] FRONTEND-085-AC-06: `RecommendationCard`/`RecommendationDetailModal` show every origin country
- [x] FRONTEND-085-AC-07: `RecommendationControls`' source-series display shows every origin country
