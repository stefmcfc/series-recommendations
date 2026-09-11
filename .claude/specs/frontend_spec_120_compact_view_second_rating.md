# Frontend Spec 120: Compact View Gains the Second Rating

**Status**: Implemented
**Priority**: P3 (visual parity between two existing view modes, no new data)
**Depends on**: `frontend_spec_054_series_list_compact_view.md` (introduced `SeriesCompactGrid` as an opt-in denser alternative to the expanded row view), `frontend_spec_039_sort_aware_rating_display.md` (`activeRating()`, the sort-aware second-rating logic this spec reuses), `frontend_spec_119_rating_sort_missing_value_exclusion.md` (the percent+emoji Rotten Tomatoes display format and shared `formatPercent` util this spec's compact card also uses)
**Area**: Frontend (`components/SeriesCompactGrid.tsx`, `components/SeriesList.tsx`, `components/SeriesCompactGrid.module.css`, and each file's tests)

## Overview

`SeriesList`'s expanded row view always shows two ratings per series: the "active" rating (whichever field the list is currently sorted by — IMDb, TMDB, or now Rotten Tomatoes Tomatometer/Popcornmeter — defaulting to IMDb when sorted by a non-rating field like Date Added or Title, per `activeRating()`'s existing fallback) and the personal `StarRating`. `SeriesCompactGrid` (the "Compact" view mode) currently shows only the personal `StarRating` — the active rating is missing entirely, so switching from Expanded to Compact silently drops information the user was just looking at.

This spec adds the same active-rating display to each compact card, positioned before the personal `StarRating` (mirroring the expanded row's order: active rating, then personal rating).

## Design Decisions

- **Reuses `activeRating()` and `formatPercent()` as-is — no new rating logic.** `SeriesCompactGrid` needs to know the current `sortBy` to compute the same active rating `SeriesList`'s expanded row already shows, so `SeriesList.tsx` passes its own `sortBy` state down as a new `SeriesCompactGridProps.sortBy` prop — the same value already driving the expanded view, just threaded one level further.
- **A single combined text label, not the expanded view's two-span split.** The expanded row renders IMDb/TMDB as two visually distinct pieces (`{value}` large, `{source}` small caption) — appropriate for a spacious row layout, but `SeriesCompactGrid` cards are already a deliberately "denser" format (`frontend_spec_054`'s own description) with no equivalent two-tier text treatment anywhere else in the card. A new exported helper, `formatCompactRatingLabel(series: Series, sortBy: SortByOption): string` (in `SeriesList.tsx`, alongside `activeRating`, since it composes `activeRating` + `formatPercent`), produces one string for every case: `"8.4 IMDb"`, `"7.9 TMDB"`, `"88% 🍅"`, `"75% 🍿"`.
- **`SortByOption` is exported from `SeriesList.tsx`** (currently module-private) so `SeriesCompactGrid.tsx` can type its new prop against it, rather than redeclaring the union or widening to `string`.
- **Renders unconditionally, including the `'—'` no-value case** — matching the expanded row's own behavior (`FRONTEND-039-AC-01`'s "renders a dash when the currently-displayed source is null"), so Compact and Expanded never disagree about whether a rating line is shown for a given series.
- **New `.rating` class in `SeriesCompactGrid.module.css`**, styled as small/muted text (consistent with the card's already-compact, secondary-information aesthetic) — a new class rather than reusing `SeriesList.module.css`'s own `.rating`/`.ratingSource` since CSS Modules scope class names per file; there's no cross-file class to share here.
- **`SeriesPosterGrid` (the third view mode) is explicitly out of scope** — the user's ask was specifically about the Compact view; Poster view's card format is different again and isn't addressed here.

---

## Requirement 1: Compact cards show the active rating

**User story**: As a user browsing My Series in Compact view, I want to see the same rating I'd see in Expanded view (whichever one the list is sorted by, or IMDb by default) — not just my personal rating — so switching view modes doesn't hide information.

### FRONTEND-120-AC-01 [AUTO]
**Statement**: `formatCompactRatingLabel(series, sortBy)` shall return `"{value} {source}"` for `imdbRating`/`tmdbRating`/any non-rating `sortBy` (matching `activeRating()`'s existing fallback-to-IMDb behavior), and `formatPercent(value, emoji)` (🍅/🍿) for the two Rotten Tomatoes fields, using `'—'` wherever `activeRating()`'s `value` is `null`.

**References**: `components/SeriesList.tsx` — `activeRating` (lines 74-~100 post-`frontend_spec_119`), new `formatPercent` util (`frontend_spec_119`'s Correction).

**Test Case (Red)**:
```typescript
describe('FRONTEND-120-AC-01: formatCompactRatingLabel', () => {
  it('formats IMDb as "value IMDb"', () => {
    expect(
      formatCompactRatingLabel({ imdbRating: 8.4 } as Series, 'dateAdded'),
    ).toBe('8.4 IMDb')
  })

  it('formats TMDB as "value TMDB" when sorted by tmdbRating', () => {
    expect(
      formatCompactRatingLabel({ tmdbRating: 7.9 } as Series, 'tmdbRating'),
    ).toBe('7.9 TMDB')
  })

  it('formats Rotten Tomatoes Tomatometer as percent + tomato emoji', () => {
    expect(
      formatCompactRatingLabel(
        { rottenTomatoesRating: 88 } as Series,
        'rottenTomatoesRating',
      ),
    ).toBe('88% 🍅')
  })

  it('formats Rotten Tomatoes Popcornmeter as percent + popcorn emoji', () => {
    expect(
      formatCompactRatingLabel(
        { rottenTomatoesPopcornmeter: 75 } as Series,
        'rottenTomatoesPopcornmeter',
      ),
    ).toBe('75% 🍿')
  })

  it('renders a dash when the active value is null', () => {
    expect(
      formatCompactRatingLabel({ imdbRating: null } as Series, 'dateAdded'),
    ).toBe('— IMDb')
  })
})
```
**Test Case (Green)**: implement `formatCompactRatingLabel` in `SeriesList.tsx`, exported alongside `activeRating`.

---

### FRONTEND-120-AC-02 [AUTO]
**Statement**: `SeriesCompactGrid` shall accept a new required `sortBy: SortByOption` prop and render `formatCompactRatingLabel(series, sortBy)`'s output for each card, positioned before the personal `StarRating`.

**References**: `components/SeriesCompactGrid.tsx` (current props interface, lines 7-12; card JSX, lines 42-54).

**Test Case (Red)**:
```typescript
describe('FRONTEND-120-AC-02: compact card shows the active rating', () => {
  it('shows the IMDb rating before the personal rating', () => {
    render(
      <SeriesCompactGrid
        series={[makeSeries({ title: 'Ozark', imdbRating: 8.4, personalRating: 4 })]}
        posterErrorIds={new Set()}
        onPosterError={vi.fn()}
        onCardClick={vi.fn()}
        sortBy="dateAdded"
      />,
    )
    expect(screen.getByText('8.4 IMDb')).toBeInTheDocument()
  })

  it('shows the Rotten Tomatoes percent+emoji format when sorted by it', () => {
    render(
      <SeriesCompactGrid
        series={[makeSeries({ title: 'Ozark', rottenTomatoesRating: 88 })]}
        posterErrorIds={new Set()}
        onPosterError={vi.fn()}
        onCardClick={vi.fn()}
        sortBy="rottenTomatoesRating"
      />,
    )
    expect(screen.getByText('88% 🍅')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `sortBy` prop, import `formatCompactRatingLabel`/`SortByOption` from `SeriesList.tsx`, render a new `<span className={styles.rating}>` before `<StarRating value={s.personalRating} />`.

---

### FRONTEND-120-AC-03 [AUTO]
**Statement**: `SeriesList` shall pass its current `sortBy` state to `SeriesCompactGrid` at its existing render site.

**References**: `components/SeriesList.tsx` — `<SeriesCompactGrid ... />` (lines 755-761).

**Test Case (Red)**:
```typescript
describe('FRONTEND-120-AC-03: SeriesList threads sortBy into Compact view', () => {
  it('reflects a changed sort in the compact card rating', async () => {
    mockGetAll.mockResolvedValue({
      series: [makeSeries({ title: 'Ozark', imdbRating: 8.4, tmdbRating: 8.1 })],
      excludedCount: 0,
    })
    render(<SeriesList />)
    fireEvent.click(await screen.findByTestId('view-mode-compact-btn'))
    fireEvent.change(screen.getByLabelText('Sort by'), {
      target: { value: 'tmdbRating' },
    })
    expect(await screen.findByText('8.1 TMDB')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add `sortBy={sortBy}` to the existing `<SeriesCompactGrid>` element.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `SeriesCompactGrid`, view mode toggle | `frontend_spec_054_series_list_compact_view.md` |
| `activeRating()`, sort-aware rating fallback | `frontend_spec_039_sort_aware_rating_display.md` |
| `formatPercent` util, Rotten Tomatoes percent+emoji format | `frontend_spec_119_rating_sort_missing_value_exclusion.md` (Correction, 2026-09-11) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-120-AC-01: `formatCompactRatingLabel` formats all four rating kinds correctly, including the null/dash case
- [x] FRONTEND-120-AC-02: `SeriesCompactGrid` renders the active rating before the personal rating
- [x] FRONTEND-120-AC-03: `SeriesList` threads its `sortBy` state into `SeriesCompactGrid`
