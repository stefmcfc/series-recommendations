# Frontend Spec 116: Missing Ratings Filter UI

**Status**: Implemented — `types/series.ts`, `services/seriesApi.ts`, `components/SearchFilter.tsx`
**Priority**: P3 (matches `series_spec_060`'s tier — small frontend companion to a backend filter
addition)
**Depends on**: `series_spec_060_missing_ratings_filter.md` (the four new
`SeriesSearchCriteria` fields this UI drives), `frontend_spec_055_search_filter_overhaul.md`
(owns `SearchFilter.tsx`'s existing "Ratings" section this spec extends)
**Area**: Frontend (`types/series.ts`, `services/seriesApi.ts`, `components/SearchFilter.tsx`)

## Overview

`series_spec_060` adds four new `SeriesSearchCriteria` fields so a user can find series missing an
IMDb, TMDB, or Rotten Tomatoes (Tomatometer/Popcornmeter) rating — a real, confirmed gap (see that
spec's Overview for why none of these ratings can be reliably auto-improved, especially
Popcornmeter, which has no data source at all). This spec adds the four corresponding checkboxes to
`SearchFilter.tsx`'s existing "Ratings" section, wired straight through to the backend fields.

## Design Decisions

- **Four checkboxes, not one combined toggle** — matching `series_spec_060`'s own per-field
  design and this filter sheet's existing per-field philosophy (`Min IMDb Rating`/`Min TMDB Rating`
  are already separate fields). Checking more than one broadens the result set (OR semantics,
  handled entirely backend-side by `series_spec_060`) — the frontend just passes through whichever
  boxes are checked, with no client-side combination logic of its own.
- **Placed in the existing "Ratings" `<section>`, after Min IMDb/Min TMDB Rating** — the natural
  home given the section's existing content, rather than a new section for four checkboxes.
- **Full field-name labels, matching this section's existing style** — "Missing IMDb Rating",
  "Missing TMDB Rating", "Missing Rotten Tomatoes Rating", "Missing Rotten Tomatoes Popcornmeter"
  (not abbreviated "RT") — the neighboring `Min IMDb Rating`/`Min TMDB Rating` labels are spelled
  out in full, and `AddSeriesForm`/`EditSeriesForm`'s existing Rotten Tomatoes field labels
  ("Rotten Tomatoes Rating (Tomatometer)"/"Rotten Tomatoes Rating (Popcornmeter)") confirm this
  app's convention is the full name, not an abbreviation.
- **New `.checkboxField` class in `SearchFilter.module.css`** — this file has no existing checkbox
  markup; `SeriesFormFields.module.css`'s `.checkboxField` (label + `type="checkbox"` input pair,
  used for "Exclude from recommendations") is the one existing checkbox pattern in this codebase,
  copied into this module rather than cross-imported (each component's CSS Module is self-contained
  in this app — no existing precedent for importing another component's module).
- **No new `addIfPresent`-style helper** — `buildSearchParams` in `seriesApi.ts` already
  hand-writes each field's `if (criteria.x != null) params.x = x` check (not the generic
  `addIfPresent` helper used elsewhere in this file); the four new fields follow that exact
  existing style, mirroring `flaggedForRewatch`'s own line immediately above where they're added.

---

## Requirement 1: `SearchCriteria` type and API param passthrough

**User story**: As a developer wiring up the missing-ratings checkboxes, I want the criteria type
and API call to already support the four new fields, following the same pattern as every other
filter field.

### FRONTEND-116-AC-01 [AUTO]
**Statement**: `types/series.ts`'s `SearchCriteria` interface shall gain four new optional
`boolean` fields — `missingImdbRating`, `missingTmdbRating`, `missingRottenTomatoesRating`,
`missingRottenTomatoesPopcornmeter` — mirroring `flaggedForRewatch?: boolean`'s exact shape.

**References**: `types/series.ts` (existing `flaggedForRewatch?: boolean` on `SearchCriteria`, the
shape this mirrors).

**Test Case (Green)**: type-only change, verified by `FRONTEND-116-AC-03`'s component test and
`FRONTEND-116-AC-02`'s param-builder test compiling and passing.

---

### FRONTEND-116-AC-02 [AUTO]
**Statement**: `services/seriesApi.ts`'s `buildSearchParams` shall pass each of the four new
fields through to the request params when non-null, mirroring `flaggedForRewatch`'s existing
`if (criteria.flaggedForRewatch != null) params.flaggedForRewatch = criteria.flaggedForRewatch`
line exactly.

**References**: `services/seriesApi.ts`'s `buildSearchParams` function (existing
`flaggedForRewatch` line, the pattern this mirrors).

**Test Case (Red)**:
```typescript
// src/services/__tests__/seriesApi.test.ts (additions)
describe('FRONTEND-116-AC-02: missing-rating params passed through when set', () => {
  it('includes each missing-rating field only when non-null', async () => {
    mockAxios.get.mockResolvedValue({ data: { data: [], count: 0 } })
    await seriesApi.search({
      missingImdbRating: true,
      missingTmdbRating: false,
      missingRottenTomatoesRating: true,
    })
    expect(mockAxios.get).toHaveBeenCalledWith(
      '/series/search',
      expect.objectContaining({
        params: expect.objectContaining({
          missingImdbRating: true,
          missingTmdbRating: false,
          missingRottenTomatoesRating: true,
        }),
      }),
    )
  })
})
```
**Test Case (Green)**: four new `if (criteria.missingX != null) params.missingX = criteria.missingX`
lines in `buildSearchParams`.

---

## Requirement 2: `SearchFilter` renders the four checkboxes

**User story**: As a user, I want to check one or more "missing" boxes in the Ratings section and
see only series that need that rating filled in.

### FRONTEND-116-AC-03 [AUTO]
**Statement**: `SearchFilter.tsx`'s "Ratings" `<section>` shall render four new checkboxes, after
the existing Min IMDb/Min TMDB Rating fields — "Missing IMDb Rating", "Missing TMDB Rating",
"Missing Rotten Tomatoes Rating", "Missing Rotten Tomatoes Popcornmeter" — each bound to its
corresponding `SearchCriteria` field, submitted as part of the same search criteria object the
existing fields already build.

**References**: `components/SearchFilter.tsx`'s existing "Ratings" section (~line 308-350, the
`Min IMDb Rating`/`Min TMDB Rating` fields this is placed after); `SeriesFormFields.tsx`'s
"Exclude from recommendations" checkbox (~line 483-492, the one existing checkbox markup pattern
in this codebase).

**Test Case (Red)**:
```typescript
// src/components/SearchFilter.test.tsx (additions)
describe('FRONTEND-116-AC-03: missing-rating checkboxes', () => {
  it('renders all four checkboxes in the Ratings section, unchecked by default', () => {
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByLabelText('Missing IMDb Rating')).not.toBeChecked()
    expect(screen.getByLabelText('Missing TMDB Rating')).not.toBeChecked()
    expect(screen.getByLabelText('Missing Rotten Tomatoes Rating')).not.toBeChecked()
    expect(screen.getByLabelText('Missing Rotten Tomatoes Popcornmeter')).not.toBeChecked()
  })

  it('includes checked missing-rating fields in the submitted search criteria', async () => {
    const onSearch = vi.fn()
    render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('Missing IMDb Rating'))
    await userEvent.click(screen.getByRole('button', { name: /search/i }))
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ missingImdbRating: true }),
    )
  })
})
```
**Test Case (Green)**: four `<div className={styles.checkboxField}>` blocks (label + `type="checkbox"`
input pair), each `onChange` calling `updateField('missingX')` with the checkbox's `checked` value,
added to the existing form state alongside `minImdbRating`/`minTmdbRating`.

---

### FRONTEND-116-AC-04 [AUTO]
**Statement**: The four new checkboxes shall reset to unchecked when the filter sheet's existing
"Clear" action is used, matching every other field's existing reset behavior — no special-cased
exclusion.

**Test Case (Red)**:
```typescript
describe('FRONTEND-116-AC-04: Clear resets the missing-rating checkboxes', () => {
  it('unchecks all four missing-rating checkboxes on Clear', async () => {
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('Missing IMDb Rating'))
    await userEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(screen.getByLabelText('Missing IMDb Rating')).not.toBeChecked()
  })
})
```
**Test Case (Green)**: covered automatically once the four fields are added to the same form-state
object the existing "Clear" handler already resets wholesale — no new reset logic needed if that
handler resets the whole form object rather than field-by-field (confirm against the actual
implementation before assuming).

---

## Cross-References

| This spec | Source |
|---|---|
| The four new `SeriesSearchCriteria` fields this UI drives, and the OR-among-themselves semantics | `series_spec_060_missing_ratings_filter.md` |
| `SearchFilter.tsx`'s existing "Ratings" section, `Min IMDb Rating`/`Min TMDB Rating` fields this is placed after | `frontend_spec_055_search_filter_overhaul.md` |
| The one existing checkbox markup pattern in this codebase | `components/SeriesFormFields.tsx` ("Exclude from recommendations") |

## Acceptance Criteria Summary

- [x] FRONTEND-116-AC-01: `SearchCriteria` gains four missing-rating boolean fields
- [x] FRONTEND-116-AC-02: `buildSearchParams` passes the four fields through when non-null
- [x] FRONTEND-116-AC-03: `SearchFilter` renders and submits the four checkboxes correctly
- [x] FRONTEND-116-AC-04: the four checkboxes reset on Clear like every other field
