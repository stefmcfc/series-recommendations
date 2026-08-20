# Frontend Spec 021: TMDB Title as Primary for TMDB-Resolved Lookups

**Status**: ✅ Implemented. **Rendered moot by `frontend_spec_022_tmdb_primary_lookup.md`**: this fix corrected which of two divergent titles won when both an OMDb-first and a TMDB-fallback path could produce a series. With only one search path (and `alternateTitle` removed entirely), the bug class this fixed no longer exists. Kept for historical/traceability reference; no AC here is renumbered or deleted.
**Priority**: P2 (correctness fix — the alternate-title feature currently inverts which name a user recognizes)
**Depends on**: Frontend Spec 017 (Alternate Title) ✅, Frontend Spec 016 (TMDB Lookup Fallback) ✅

## Overview

`frontend_spec_017_alternate_title.md` built `applyLookupResult`'s title-capture logic against a single rule: the resolved lookup's own title (`result.title`) always becomes the primary `title`, and whatever the user searched/selected becomes `alternateTitle` when it differs. That rule is right for the two OMDb-only paths (`handleLookup`'s single-match auto-resolve, `handleSelectCandidate`'s OMDb picker) — there's no second, more-authoritative name in play, just "what the user typed" versus "what OMDb resolved."

It's backwards for the two TMDB-fallback paths (`handleSearchTmdb`'s single-match auto-resolve, `handleSelectTmdbCandidate`'s TMDB picker). There, the user has explicitly confirmed a specific TMDB candidate before resolution — e.g. selecting "Spooks" from TMDB's search — and TMDB's own title is the one that matched via AKA/translated-name search in the first place (the entire reason the TMDB fallback exists — `series_spec_012_tmdb_lookup_fallback.md`). Resolving that candidate via OMDb can still return a differently-cataloged title (OMDb's "MI-5"), and under the current rule that OMDb title silently becomes primary — exactly inverted from what the user confirmed to it. Reported directly: searching and resolving "Spooks" via the TMDB fallback still shows "MI-5" as the main title with "Spooks" relegated to alternate, when the user wants the reverse.

This spec adds a `preferReferenceAsTitle` flag to `applyLookupResult`, set only by the two TMDB-fallback call sites, so the candidate's own (TMDB-sourced) title becomes primary and the OMDb-resolved title becomes the alternate whenever they differ. The two OMDb-only paths are unchanged.

**Design decisions**:
- **Scoped to the two TMDB call sites only.** The two OMDb-only paths keep today's behavior unchanged — there's no equivalent "the user already confirmed a specific, independently-sourced title" moment in those flows, so inverting them would just swap which text is untrustworthy (a typed search term) for which is trusted (OMDb's own title), with no benefit.
- **The degraded TMDB-detail-only path (no OMDb data at all, `series_spec_012` Requirement 6) needs no special handling.** In that case `result.title` already *is* TMDB's own title (via `TmdbClient.details`), so `referenceTitle`/`result.title` already match and no `alternateTitle` gets set either way — the new flag only changes behavior when OMDb *does* return a differing title.
- **The mismatch-detection comparison itself (case-insensitive, trimmed) is unchanged** — only which side of the comparison becomes `title` versus `alternateTitle` flips.

---

## Requirements

### Requirement 1: `applyLookupResult` Gains a Title-Preference Flag

**User story**: As a user who explicitly picked a TMDB search result, I want that title to be the one I see as primary, not whatever OMDb happens to call it, so my confirmed choice is respected.

#### Acceptance Criteria

- **FRONTEND-021-AC-01** [AUTO]: `applyLookupResult` shall accept a fourth parameter, `preferReferenceAsTitle: boolean`, defaulting to `false`.
- **FRONTEND-021-AC-02** [AUTO]: When `preferReferenceAsTitle` is `false` (the default), `applyLookupResult`'s existing behavior is unchanged: `title` is set from `result.title`; `alternateTitle` is set from the trimmed `referenceTitle` only when it's non-empty and differs (case-insensitive, trimmed) from `result.title`.
- **FRONTEND-021-AC-03** [AUTO]: When `preferReferenceAsTitle` is `true` and the trimmed `referenceTitle` is non-empty, `applyLookupResult` shall set `title` from the trimmed `referenceTitle` instead of `result.title`.
- **FRONTEND-021-AC-04** [AUTO]: When `preferReferenceAsTitle` is `true` and `title` was set from `referenceTitle` per `AC-03`, `applyLookupResult` shall set `alternateTitle` from `result.title` when it's non-empty and differs (case-insensitive, trimmed) from `referenceTitle` — otherwise `alternateTitle` is left unchanged, same "no invent, no clear" rule `FRONTEND-017-AC-05` already established.
- **FRONTEND-021-AC-05** [AUTO]: When `preferReferenceAsTitle` is `true` but the trimmed `referenceTitle` is empty, `applyLookupResult` shall fall back to `AC-02`'s behavior (`result.title` as primary) — there is nothing to prefer.

---

### Requirement 2: Wiring at the Call Sites

#### Acceptance Criteria

- **FRONTEND-021-AC-06** [AUTO]: `handleSearchTmdb`'s exactly-one-result auto-resolve path shall call `applyResolvedResult`/`applyLookupResult` with `preferReferenceAsTitle: true` and the selected candidate's own `title` as `referenceTitle`.
- **FRONTEND-021-AC-07** [AUTO]: `handleSelectTmdbCandidate` shall call `applyResolvedResult`/`applyLookupResult` with `preferReferenceAsTitle: true` and the selected candidate's own `title` as `referenceTitle`.
- **FRONTEND-021-AC-08** [AUTO]: `handleLookup`'s exactly-one-result auto-resolve path and `handleSelectCandidate` (the two OMDb-only paths) shall continue to omit `preferReferenceAsTitle` (or pass `false`), unchanged.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `applyLookupResult`'s original single-rule behavior this spec adds a flag to, `FormState.alternateTitle`, mismatch-detection comparison | `frontend_spec_017_alternate_title.md` |
| `handleSearchTmdb`/`handleSelectTmdbCandidate`, the TMDB candidate's own `title`, the degraded-detail-only path where `result.title` already equals the candidate's title | `frontend_spec_016_tmdb_lookup_fallback.md`, `series_spec_012_tmdb_lookup_fallback.md` |
| `handleLookup`/`handleSelectCandidate`, unaffected by this spec | `frontend_spec_015_lookup_candidate_picker.md` |

---

## TDD Test Case Sketches

### `src/components/AddSeriesForm.test.tsx`

```typescript
describe('FRONTEND-021-AC-03/04/06: TMDB single-match auto-resolve prefers the candidate title as primary', () => {
  it('sets title to the TMDB candidate name and alternateTitle to OMDb\'s differing title', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 4046, title: 'Spooks', year: 2002 }])
    mockResolveTmdb.mockResolvedValue({ title: 'MI-5', year: 2002, imdbId: 'tt0160904' })
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue('Spooks'))
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('MI-5')
  })
})

describe('FRONTEND-021-AC-03/04/07: TMDB picker selection prefers the candidate title as primary', () => {
  it('sets title to the selected TMDB candidate name and alternateTitle to OMDb\'s differing title', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    mockResolveTmdb.mockResolvedValue({ title: 'MI-5', year: 2002, imdbId: 'tt0160904' })
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-tmdb-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^spooks/i }))

    await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue('Spooks'))
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('MI-5')
  })
})

describe('FRONTEND-021-AC-08: OMDb-only paths are unaffected', () => {
  it('still uses the OMDb-resolved title as primary for the direct lookup path', async () => {
    mockSearch.mockResolvedValue([{ title: 'MI-5', imdbId: 'tt0160904' }])
    mockResolve.mockResolvedValue({ title: 'MI-5', year: 2002, imdbId: 'tt0160904' })
    renderForm()
    await runLookup('Spooks')

    await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue('MI-5'))
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('Spooks')
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-021-AC-01: `applyLookupResult` gains `preferReferenceAsTitle`, default `false`
- [x] FRONTEND-021-AC-02: default-`false` behavior unchanged from `frontend_spec_017`
- [x] FRONTEND-021-AC-03: `true` + non-empty reference → `title` set from `referenceTitle`
- [x] FRONTEND-021-AC-04: `true` case sets `alternateTitle` from `result.title` when it differs
- [x] FRONTEND-021-AC-05: `true` + empty reference falls back to default behavior
- [x] FRONTEND-021-AC-06: `handleSearchTmdb` passes `preferReferenceAsTitle: true`
- [x] FRONTEND-021-AC-07: `handleSelectTmdbCandidate` passes `preferReferenceAsTitle: true`
- [x] FRONTEND-021-AC-08: `handleLookup`/`handleSelectCandidate` unaffected
