# Frontend Spec 117: Series Language Display

**Status**: Implemented
**Depends on**: Frontend Spec 003 (`AddSeriesForm`) ✅, Frontend Spec 005 (`SeriesDetail`) ✅, Frontend Spec 022 (`SeriesLookupResult`, TMDB candidate picker) ✅, Frontend Spec 026 (`SeriesDetailFields`, `formatValue`, the read-only-system-metadata carry-through pattern this spec reuses) ✅, Series Spec 061 (`originalLanguage`, backend companion spec)
**Frontend Stage**: 117 of N

## Overview

Frontend companion to `series_spec_061_series_original_language.md`. A user asked whether a tracked series' language could be shown on its detail page, and specifically suggested it go right after the "Overview" field. This spec displays `series.originalLanguage` (TMDB's raw ISO 639-1 code, e.g. `"en"`, `"ko"`) as a new "Language" field in `SeriesDetailFields.tsx`, resolved to a readable name (e.g. `"English"`, `"Korean"`) the same way `originCountry` already resolves to a country name — via the native `Intl.DisplayNames` API, no lookup table needed.

This app already has exactly this resolution logic, but as a private, single-use helper inside `RecommendationControls.tsx` (`formatLanguageName`/`getLanguageDisplayNames`, added for the Discover "Language" filter, `frontend_spec_047`) — its own comment explicitly notes it wasn't extracted to `utils/` because it had "exactly one consumer today." This spec becomes a second consumer, so Requirement 2 extracts it into a shared `utils/languageName.ts`, mirroring `utils/countryName.ts`'s existing shape exactly, rather than duplicating the `Intl.DisplayNames` setup a second time.

**Design decisions**:
- **Language names are resolved via the native `Intl.DisplayNames` API, not a hand-maintained lookup table** — same reasoning as `formatCountryName`'s own precedent, and the same approach this app's Discover language filter already uses today.
- **The extracted `formatLanguageName` is null-safe (`string | null → string | null`), matching `formatCountryName`'s signature** — the existing private version only ever takes a definite `string` (its one call site, building `LANGUAGE_OPTIONS` from a fixed code list, never has a null). `SeriesDetailFields.tsx` needs to handle `series.originalLanguage` being `null` (a manually-added series, or one whose TMDB lookup never resolved a detail), so the shared version's signature widens to match — the `LANGUAGE_OPTIONS` call site adapts trivially (`formatLanguageName(code) ?? code`, `code` there is never actually null).
- **`originalLanguage` is treated as read-only, system-populated metadata, not a user-editable form input** — the exact same pattern `originCountry`/`productionStatus`/`imdbId` already use in `AddSeriesForm`'s `FormState` (carried through silently from the lookup result to the create payload, never rendered as an `<input>`). A hand-typed "language" wouldn't mean anything — it's TMDB's own data, not the user's opinion.
- **No `EditSeriesForm` changes are needed** — same reasoning as `frontend_spec_026`'s identical note: `EditSeriesForm`'s `buildPayload` already omits any field with no corresponding form input, and `SeriesService.update` only touches fields present in the incoming payload, so this read-only field already survives an edit-and-save round-trip untouched.
- **Placement: a second row inside the existing "Overview" field group in `SeriesDetailFields.tsx`, not a new standalone section** — the user's own request ("maybe it can go after overview on the page"). Today that `<dl className={styles.fieldGroup}>` holds exactly one row (Overview); this spec adds "Language" as a second row in the same group, still above the "Check Streaming Availability" button and the `SHOW_SECTION_HEADERS`-gated sections below, so it's visible without expanding anything.
- **The TMDB candidate picker (`AddSeriesForm`'s `tmdbCandidates` list) is out of scope** — unlike `originCountry` (shown there specifically to disambiguate same-titled remakes), nothing about this spec's purpose needs a not-yet-resolved candidate's language. Only `SeriesLookupResult` (the single, already-resolved candidate) gains the field, not `LookupTmdbCandidate`.

---

## Requirements

### Requirement 1: Types

**User story**: As a developer, I want the shared types to carry the new backend field, so no component silently drops it.

#### Acceptance Criteria

- **FRONTEND-117-AC-01** [AUTO]: `src/types/series.ts`'s `Series` interface shall gain `originalLanguage: string | null`.
- **FRONTEND-117-AC-02** [AUTO]: `CreateSeriesRequest` shall gain `originalLanguage?: string`.
- **FRONTEND-117-AC-03** [AUTO]: `SeriesLookupResult` shall gain `originalLanguage?: string`.

### Requirement 2: Shared Language Name Utility

**User story**: As a developer, I want one shared function that turns an ISO 639-1 code into a readable name, so a second consumer doesn't duplicate the `Intl.DisplayNames` setup `RecommendationControls.tsx` already has privately.

#### Acceptance Criteria

- **FRONTEND-117-AC-04** [AUTO]: A new `src/utils/languageName.ts` shall export `formatLanguageName(code: string | null): string | null`, returning `null` when `code` is `null`, the resolved display name (e.g. `"en"` → `"English"`, `"ko"` → `"Korean"`) via `Intl.DisplayNames({type: 'language'})`, and the raw code unchanged if resolution throws or returns `undefined` — mirroring `utils/countryName.ts`'s `formatCountryName` shape exactly (module-level cached `Intl.DisplayNames` instance, try/catch fallback to the raw input).
- **FRONTEND-117-AC-05** [AUTO]: `RecommendationControls.tsx`'s private `formatLanguageName`/`getLanguageDisplayNames` shall be removed, replaced by importing `formatLanguageName` from `utils/languageName.ts` — no behavior change for its existing `LANGUAGE_OPTIONS` call site (adapt via `formatLanguageName(code) ?? code`, since `code` there is always a definite string from the fixed `LANGUAGE_OPTION_CODES` list).

### Requirement 3: `AddSeriesForm` Captures Original Language

**User story**: As a user, when I look up and add a series, I want its original language actually saved, not silently dropped, so it's there the moment I add the show.

#### Acceptance Criteria

- **FRONTEND-117-AC-06** [AUTO]: `AddSeriesForm`'s lookup-autofill (`applyLookupResult`) shall carry `originalLanguage` from a resolved `SeriesLookupResult` into form state, the same way it already does for `originCountry`/`productionStatus` — not rendered as a visible input (see Design Decisions).
- **FRONTEND-117-AC-07** [AUTO]: `AddSeriesForm`'s submit payload (`buildPayload`) shall include `originalLanguage` whenever a lookup populated it.

### Requirement 4: `SeriesDetail` Displays Language After Overview

**User story**: As a user, I want to see a series' language on its detail page, right after its overview.

#### Acceptance Criteria

- **FRONTEND-117-AC-08** [AUTO]: `SeriesDetailFields.tsx` shall render a "Language" field showing `formatValue(formatLanguageName(series.originalLanguage))` (i.e. `"—"` when `null`, the resolved language name otherwise — same `formatValue` convention as every other optional field on this page), as a new row in the same `<dl className={styles.fieldGroup}>` that already holds "Overview", immediately after it.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `originalLanguage` backend field, `SeriesLookupDto`/`TmdbSeriesDetail` shape | `series_spec_061_series_original_language.md` (backend companion) |
| `SeriesLookupResult`, TMDB candidate picker, `AddSeriesForm`'s existing `imdbId`/`originCountry`-as-hidden-field precedent | `frontend_spec_022_tmdb_primary_lookup.md` |
| `formatCountryName`/`utils/countryName.ts` shape this spec's `formatLanguageName`/`utils/languageName.ts` mirrors exactly, `SeriesDetailFields.tsx`'s `formatValue` convention, the "read-only system metadata, not a form input" Design Decision | `frontend_spec_026_origin_country_and_tmdb_metadata_display.md` |
| The private `formatLanguageName`/`getLanguageDisplayNames` helper this spec extracts out of `RecommendationControls.tsx`, and the Discover "Language" filter it was originally built for | `frontend_spec_047_custom_search_language_country_filters_ui.md` |
| `SeriesDetailFields.tsx`'s current "Overview" field group, the exact insertion point this spec's `FRONTEND-117-AC-08` targets | Extracted from `SeriesDetail.tsx` — see that file's own history |

---

## TDD Test Case Sketches

### `src/utils/languageName.test.ts`

```typescript
describe('FRONTEND-117-AC-04: formatLanguageName', () => {
  it('resolves ISO 639-1 codes to display names', () => {
    expect(formatLanguageName('en')).toBe('English')
    expect(formatLanguageName('ko')).toBe('Korean')
  })

  it('returns null for a null code', () => {
    expect(formatLanguageName(null)).toBeNull()
  })

  it('falls back to the raw code for an unresolvable value', () => {
    expect(formatLanguageName('zz')).toBe('zz')
  })
})
```

### `src/components/RecommendationControls.test.tsx` (regression, no new behavior)

```typescript
describe('FRONTEND-117-AC-05: LANGUAGE_OPTIONS unchanged after extraction', () => {
  it('still resolves each option to its display name', () => {
    expect(LANGUAGE_OPTIONS.find((o) => o.id === 'en')?.label).toBe('English')
    expect(LANGUAGE_OPTIONS.find((o) => o.id === 'ja')?.label).toBe('Japanese')
  })
})
```

### `src/components/AddSeriesForm.test.tsx` (additions)

```typescript
describe('FRONTEND-117-AC-06/07: original language carried through to the create payload', () => {
  it('includes originalLanguage after a resolved lookup', async () => {
    vi.mocked(seriesApi.searchTmdb).mockResolvedValue([
      { tmdbId: 2996, title: 'The Office', year: 2001 },
    ])
    vi.mocked(seriesApi.resolveTmdbCandidate).mockResolvedValue({
      title: 'The Office',
      originalLanguage: 'en',
    })
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'The Office' } })
    fireEvent.click(screen.getByRole('button', { name: /look up/i }))
    await screen.findByDisplayValue('The Office')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(seriesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ originalLanguage: 'en' }),
      ),
    )
  })
})
```

### `src/components/SeriesDetail.test.tsx` (additions)

```typescript
describe('FRONTEND-117-AC-08: Language field renders after Overview', () => {
  it('displays the resolved language name immediately after Overview', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ overview: 'A financial planner relocates.', originalLanguage: 'en' }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    const overviewTerm = await screen.findByText('Overview')
    const languageTerm = screen.getByText('Language')
    expect(
      overviewTerm.compareDocumentPosition(languageTerm) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByText('English')).toBeInTheDocument()
  })

  it('shows "—" for Language when null', async () => {
    mockGetById.mockResolvedValue(makeSeries({ originalLanguage: null }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText('Language')
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })
})
```

Note: every `makeSeries` test-fixture helper (`SeriesDetail.test.tsx`, `SeriesList.test.tsx`, `EditSeriesForm.test.tsx`, `RecommendationControls.test.tsx`, `services/__tests__/seriesApi.test.ts`) will need `originalLanguage` added to its default shape — the same mechanical update `frontend_spec_026` required when `Series` last gained a field.

---

## Acceptance Criteria Summary

- [x] FRONTEND-117-AC-01: `Series` gains `originalLanguage`
- [x] FRONTEND-117-AC-02: `CreateSeriesRequest` gains `originalLanguage`
- [x] FRONTEND-117-AC-03: `SeriesLookupResult` gains `originalLanguage`
- [x] FRONTEND-117-AC-04: `utils/languageName.ts`'s `formatLanguageName` utility
- [x] FRONTEND-117-AC-05: `RecommendationControls.tsx` uses the extracted shared utility, no behavior change
- [x] FRONTEND-117-AC-06: `AddSeriesForm` autofill carries `originalLanguage` through
- [x] FRONTEND-117-AC-07: `AddSeriesForm` payload includes `originalLanguage`
- [x] FRONTEND-117-AC-08: `SeriesDetailFields` shows "Language" immediately after "Overview"
