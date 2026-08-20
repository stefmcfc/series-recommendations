# Frontend Spec 022: TMDB-Primary Lookup UI

**Status**: Not started
**Depends on**: Frontend Spec 003 (`AddSeriesForm`) ✅, Frontend Spec 004 (`EditSeriesForm`) ✅, Frontend Spec 005 (`SeriesDetail`) ✅, Frontend Spec 015 (candidate picker being removed) ✅, Frontend Spec 016 (TMDB fallback UI being promoted to primary) ✅, Frontend Spec 017 (alternate title UI being removed) ✅, Series Spec 017 (backend companion)
**Frontend Stage**: 22 of N

## Overview

Frontend companion to `series_spec_017_tmdb_primary_lookup.md`. Collapses `AddSeriesForm`'s two-path lookup UI (OMDb-first single-guess/candidate-picker, with a manual "Search TMDB instead" escape hatch) down to the single TMDB-primary flow that escape hatch already implements today — that flow becomes the *only* "Look Up" behavior, not an alternative one. Removes the now-dead OMDb candidate picker (`frontend_spec_015`), the escape-hatch button and its own picker (`frontend_spec_016`'s UI, whose underlying calls are promoted to primary rather than removed), the `alternateTitle` field/display everywhere it appears (`frontend_spec_017`), and the `metacriticRating` field from both forms. Adds the two new TMDB fields (`tmdbRating`/`tmdbVoteCount`) to the shared types.

This directly supersedes `frontend_spec_009_omdb_autofill.md`, `frontend_spec_015_lookup_candidate_picker.md`, `frontend_spec_016_tmdb_lookup_fallback.md`, `frontend_spec_017_alternate_title.md`, and `frontend_spec_021_tmdb_primary_title.md` — see each file's updated `Status` line. Those files are kept, unmodified apart from their status note, as historical implementation record; none of their acceptance criteria are renumbered or deleted per `ears_format.md`'s immutability rule.

**Design decisions**:
- **The existing "Search TMDB instead" escape-hatch code path (`frontend_spec_016`) becomes the *only* "Look Up" path**, rather than being deleted and rebuilt — it's already the correct behavior (search TMDB, show a candidate picker on multiple matches, auto-resolve on a single match). What's deleted is the *other* path (OMDb-first lookup/candidate picker, `frontend_spec_015`) and the escape-hatch button itself, since there's nothing left to escape to it *from*.
- **`frontend_spec_021`'s TMDB-primary-title fix becomes moot, not re-implemented.** That fix corrected which of two divergent titles ("Spooks" vs. "MI-5") won when both an OMDb-first and a TMDB-fallback path could produce a series. With only one path, there's only ever one resolved title — the bug class this fixed no longer exists.
- **The frontend's `OmdbLookupResult` type is renamed to `SeriesLookupResult`**, matching the backend's already-neutral `SeriesLookupDto` naming — it stopped being an accurate name once the result stopped being OMDb-sourced.
- **No new frontend work for Rotten Tomatoes overriding** — `rottenTomatoesRating` is already a plain, manually-editable, autofillable input in both forms; nothing about its UI changes here (see Design Decisions in the backend companion spec for why it'll still often come back empty).

---

## Requirements

### Requirement 1: Consolidated Look Up Flow (`AddSeriesForm`)

**User story**: As a user, clicking "Look Up" should always search the same way and reliably find my show, without a second button to reach for when the first search comes up empty.

#### Acceptance Criteria

- **FRONTEND-022-AC-01** [AUTO]: `AddSeriesForm`'s "Look Up" button shall call `seriesApi.searchTmdb(title)` directly (replacing today's OMDb-first `seriesApi.lookupByTitle` call as the button's first action).
- **FRONTEND-022-AC-02** [AUTO]: On a single TMDB search result, the form shall auto-resolve and autofill it via `seriesApi.resolveTmdbCandidate`, preserving today's single-match behavior (`FRONTEND-016-AC-*`).
- **FRONTEND-022-AC-03** [AUTO]: On multiple TMDB search results, the form shall show the existing TMDB candidate picker (poster, title, year, original title) for the user to choose from before resolving (preserving `FRONTEND-016`'s picker UI unchanged).
- **FRONTEND-022-AC-04** [AUTO]: The separate "Search TMDB instead" escape-hatch button, and the OMDb-driven candidate picker it was an alternative to (`FRONTEND-015`), shall be removed from `AddSeriesForm` — there is only one search path.
- **FRONTEND-022-AC-05** [AUTO]: The `alternateTitle` field, and the mismatch-capture logic that populated it from a divergent searched-vs-resolved title, shall be removed from `AddSeriesForm`.
- **FRONTEND-022-AC-06** [AUTO]: The `metacriticRating` field (input, validation, payload building, lookup-result autofill) shall be removed from `AddSeriesForm`.

### Requirement 2: `EditSeriesForm` Field Removals

**User story**: As a user, I don't want to see empty/unused fields when editing a series.

#### Acceptance Criteria

- **FRONTEND-022-AC-07** [AUTO]: `EditSeriesForm` shall remove its `alternateTitle` field (input, `toFormState` initialization, payload).
- **FRONTEND-022-AC-08** [AUTO]: `EditSeriesForm` shall remove its `metacriticRating` field (input, `toFormState` initialization, payload).

### Requirement 3: Display Removals

**User story**: As a user, I don't want a dropped field's leftover UI still rendering (or rendering blank) on the list or detail views.

#### Acceptance Criteria

- **FRONTEND-022-AC-09** [AUTO]: `SeriesDetail` shall remove its `alternateTitle` field display.
- **FRONTEND-022-AC-10** [AUTO]: `SeriesList` shall remove its muted `alternateTitle`-next-to-title display.

### Requirement 4: Types & API Layer

**User story**: As a developer, I want the shared types/API layer to accurately reflect the new TMDB-primary shape, so no component can accidentally reference a field that no longer exists.

#### Acceptance Criteria

- **FRONTEND-022-AC-11** [AUTO]: `src/types/series.ts` shall remove `alternateTitle` from `Series`/`CreateSeriesRequest`, and `metacriticRating` from `Series`/`CreateSeriesRequest`/the lookup-result type.
- **FRONTEND-022-AC-12** [AUTO]: `src/types/series.ts`'s `OmdbLookupResult` interface shall be renamed `SeriesLookupResult` (all usages updated accordingly), and gain `tmdbRating?: number`/`tmdbVoteCount?: number`. `Series` shall gain the same two fields (non-optional, nullable: `tmdbRating: number | null`, `tmdbVoteCount: number | null`).
- **FRONTEND-022-AC-13** [AUTO]: `src/types/series.ts`'s `LookupCandidate` interface (the OMDb-candidate shape) shall be removed, along with `LookupTmdbCandidate`'s renaming left as-is (it's still accurate and still used).
- **FRONTEND-022-AC-14** [AUTO]: `seriesApi.ts` shall remove `lookupByTitle`, `searchByTitle`, and `lookupByImdbId` (all OMDb-route-backed); `searchTmdb` and `resolveTmdbCandidate` remain, with their return types updated to `SeriesLookupResult`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| TMDB search/resolve flow being promoted from escape hatch to sole path | `frontend_spec_016_tmdb_lookup_fallback.md` |
| OMDb candidate picker being removed | `frontend_spec_015_lookup_candidate_picker.md` |
| Original OMDb-first "Look Up" button behavior being replaced | `frontend_spec_009_omdb_autofill.md` |
| `alternateTitle` field/display being removed | `frontend_spec_017_alternate_title.md` |
| TMDB-primary-title bug fix rendered moot by there being only one path | `frontend_spec_021_tmdb_primary_title.md` |
| `tmdbRating`/`tmdbVoteCount` fields, narrowed `OmdbClient`, removed endpoints | `series_spec_017_tmdb_primary_lookup.md` (backend companion) |
| `Recommendation.tmdbRating`/`voteCount` naming precedent already in `src/types/series.ts` | `series_spec_016_recommendation_vote_count.md` / `frontend_spec_020_recommendation_rating_display.md` |

---

## TDD Test Case Sketches

### `src/components/AddSeriesForm.test.tsx`

```typescript
describe('FRONTEND-022-AC-01/02: Look Up searches TMDB directly', () => {
  it('calls searchTmdb, not lookupByTitle, when Look Up is clicked', async () => {
    vi.mocked(seriesApi.searchTmdb).mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
    ])
    vi.mocked(seriesApi.resolveTmdbCandidate).mockResolvedValue(
      makeLookupResult({ title: 'Spooks', tmdbRating: 7.8, tmdbVoteCount: 245 }),
    )
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Spooks' } })
    fireEvent.click(screen.getByRole('button', { name: /look up/i }))

    await waitFor(() => expect(seriesApi.searchTmdb).toHaveBeenCalledWith('Spooks'))
    expect(seriesApi.lookupByTitle).toBeUndefined()
  })
})

describe('FRONTEND-022-AC-04: no escape-hatch button', () => {
  it('does not render a Search TMDB instead button', () => {
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)
    expect(
      screen.queryByRole('button', { name: /search tmdb instead/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-022-AC-05/06: alternateTitle and metacriticRating fields removed', () => {
  it('does not render alternateTitle or metacriticRating inputs', () => {
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.queryByLabelText(/alternate title/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/metacritic/i)).not.toBeInTheDocument()
  })
})
```

### `src/components/SeriesDetail.test.tsx`

```typescript
describe('FRONTEND-022-AC-09: alternateTitle no longer displayed', () => {
  it('does not render an Alternate Title field', async () => {
    mockGetById.mockResolvedValue(makeSeries({ title: 'Spooks' }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText('Spooks')
    expect(screen.queryByText(/alternate title/i)).not.toBeInTheDocument()
  })
})
```

### `src/services/__tests__/seriesApi.test.ts`

```typescript
describe('FRONTEND-022-AC-14: removed OMDb-backed methods', () => {
  it('no longer exposes lookupByTitle/searchByTitle/lookupByImdbId', () => {
    expect((seriesApi as Record<string, unknown>).lookupByTitle).toBeUndefined()
    expect((seriesApi as Record<string, unknown>).searchByTitle).toBeUndefined()
    expect((seriesApi as Record<string, unknown>).lookupByImdbId).toBeUndefined()
  })
})
```

---

## Acceptance Criteria Summary

- [ ] FRONTEND-022-AC-01: "Look Up" calls `searchTmdb` directly
- [ ] FRONTEND-022-AC-02: single-match auto-resolve preserved
- [ ] FRONTEND-022-AC-03: multi-match TMDB candidate picker preserved
- [ ] FRONTEND-022-AC-04: escape-hatch button + OMDb picker removed
- [ ] FRONTEND-022-AC-05: `alternateTitle` field removed from `AddSeriesForm`
- [ ] FRONTEND-022-AC-06: `metacriticRating` field removed from `AddSeriesForm`
- [ ] FRONTEND-022-AC-07: `alternateTitle` field removed from `EditSeriesForm`
- [ ] FRONTEND-022-AC-08: `metacriticRating` field removed from `EditSeriesForm`
- [ ] FRONTEND-022-AC-09: `SeriesDetail` alternateTitle display removed
- [ ] FRONTEND-022-AC-10: `SeriesList` alternateTitle display removed
- [ ] FRONTEND-022-AC-11: types cleaned of `alternateTitle`/`metacriticRating`
- [ ] FRONTEND-022-AC-12: `OmdbLookupResult` renamed `SeriesLookupResult`, gains `tmdbRating`/`tmdbVoteCount`
- [ ] FRONTEND-022-AC-13: `LookupCandidate` interface removed
- [ ] FRONTEND-022-AC-14: `seriesApi` OMDb-backed methods removed
