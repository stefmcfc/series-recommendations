# Frontend Spec 039: Sort-Aware Rating Column on Series List

**Status**: Not started
**Priority**: P3 (visibility/UX gap — TMDB rating exists in the data but is never shown on this view)
**Depends on**: Frontend Spec 013 Requirement 4/5 only (`frontend_spec_013_star_ratings.md`, `SeriesList`'s existing sort control/`SortOptions`, already implemented) ✅
**Frontend Stage**: 39 of N
**No backend spec required.** `GET /api/v1/series` already returns both `imdbRating` and `tmdbRating` on every row (`series_spec_002_crud.md`/`series_spec_017_tmdb_primary_lookup.md`) — this is a pure display change to data already on the wire.

## Overview

`SeriesList`'s per-row rating column always shows `imdbRating`, regardless of which field the list is currently sorted by — so sorting by "TMDB Rating" reorders the rows correctly, but the visible number next to each row is still the IMDb rating, not the value actually being sorted on. A live-review report: TMDB rating isn't visible anywhere on this list.

(Personal rating's own display treatment — replacing the numeric column with stars — is separately covered by `frontend_spec_013_star_ratings.md` Requirements 1–3, not yet implemented; this spec doesn't touch that.)

## Design Decisions

- **The rating column shows whichever rating the list is currently sorted by, when that's a rating field — otherwise it falls back to IMDb rating (today's existing default display).** Concretely: `sortBy === 'tmdbRating'` → show `tmdbRating`; every other `sortBy` value (`dateAdded`, `personalRating`, `title`, `year`, `imdbRating`) → show `imdbRating`, unchanged from today. This is a minimal, precise reading of "sorting by tmdb rating should surface that rating, maybe instead of the imdb rating" — it doesn't invent a second visible column or try to show both ratings at once.
- **A small source label distinguishes which rating is showing**, since the column can now display two different things — bare numbers alone would be ambiguous once "8.4" could mean either scale. A short suffix (`"IMDb"`/`"TMDB"`) is added next to the number, styled subtly (small, reduced-opacity, matching this list's existing secondary-text treatment for `.country`/`.status`).
- **No change to the sort control itself, `buildSortParam`, or the fetch logic** — this is purely which value the existing `.rating` `<span>` renders, driven by the `sortBy` state that already exists in this component.

---

## Requirement 1: Rating Column Reflects the Active Sort Field

**User story**: As a user sorting my list by TMDB rating, I want to actually see the TMDB rating next to each row, so the numbers I'm scanning match what the list is sorted by.

### FRONTEND-039-AC-01 [AUTO]
**Statement**: `SeriesList`'s rating column shall display `s.tmdbRating` (with a "TMDB" source label) when `sortBy === 'tmdbRating'`, and `s.imdbRating` (with an "IMDb" source label) for every other `sortBy` value. A `null` value for the currently-displayed source shall render `—`, same as today's existing null-handling.

**References**: `SeriesList.tsx`, its existing `.rating` `<span>` (currently unconditional `s.imdbRating`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-039-AC-01: sort-aware rating column', () => {
  it('shows IMDb rating by default', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', imdbRating: 8.4, tmdbRating: 8.1 }),
    ])
    render(<SeriesList />)

    expect(await screen.findByText('8.4')).toBeInTheDocument()
    expect(screen.getByText('IMDb')).toBeInTheDocument()
    expect(screen.queryByText('8.1')).not.toBeInTheDocument()
  })

  it('shows TMDB rating when sorted by tmdbRating', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', imdbRating: 8.4, tmdbRating: 8.1 }),
    ])
    render(<SeriesList />)
    await screen.findByText('Ozark')

    fireEvent.change(screen.getByLabelText(/sort by/i), { target: { value: 'tmdbRating' } })

    expect(await screen.findByText('8.1')).toBeInTheDocument()
    expect(screen.getByText('TMDB')).toBeInTheDocument()
    expect(screen.queryByText('8.4')).not.toBeInTheDocument()
  })

  it('renders a dash when the currently-displayed source is null', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', imdbRating: null, tmdbRating: 8.1 }),
    ])
    render(<SeriesList />)

    expect(await screen.findByText('—')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: replace the `.rating` span's unconditional `s.imdbRating` with a small helper reading `sortBy` (`sortBy === 'tmdbRating' ? s.tmdbRating : s.imdbRating`), plus the source label span.

---

## Cross-References

| This spec | Source |
|---|---|
| `SeriesList`'s existing sort control/`sortBy` state, `SortOptions` | `frontend_spec_013_star_ratings.md` Requirement 4/5 (only the implemented portion) |
| `Series.imdbRating`/`tmdbRating` fields already on the wire | `series_spec_002_crud.md`, `series_spec_017_tmdb_primary_lookup.md` |
| Personal rating's separate star-display treatment (not touched by this spec) | `frontend_spec_013_star_ratings.md` Requirements 1–3 (not yet implemented) |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-039-AC-01: rating column shows TMDB rating (+ label) when sorted by TMDB rating, IMDb rating (+ label) otherwise
