# Frontend Spec 058: Series Year Range Display (`2020-2024` / `2025-`)

**Status**: Implemented — `frontend/src/utils/formatSeriesYear.ts` (new),
`frontend/src/utils/formatSeriesYear.test.ts` (new),
`frontend/src/components/SeriesList.tsx`, `frontend/src/components/SeriesList.test.tsx`,
`frontend/src/components/SeriesDetail.tsx`, `frontend/src/components/SeriesDetail.test.tsx`,
`frontend/src/types/series.ts` (added `lastAirYear: number | null` to `Series`)
**Priority**: P3 (paired display half of `series_spec_039`)
**Depends on**: Series Spec 039 (`series_spec_039_last_air_year.md`, owns `Series.lastAirYear`) ✅
required
**Area**: Frontend (new `utils/formatSeriesYear.ts`, `components/SeriesList.tsx`,
`components/SeriesDetail.tsx`)

## Overview

Confirmed (2026-08-29): both `SeriesList.tsx` (`{title} ({year})`, its row title button) and
`SeriesDetail.tsx` (identical format, its header) display only the single stored `year`. This spec
adds a shared year-formatting helper reflecting `series_spec_039`'s new `lastAirYear`, and applies
it at both existing display sites.

## Design Decisions

- **Display logic depends on both `lastAirYear` and `productionStatus`, not `lastAirYear` alone.**
  `lastAirYear` reflects "most recently aired episode," which is populated for an actively-running
  show too (not just an ended one) — so `lastAirYear` alone can't distinguish "ended in 2024" from
  "still running, last aired 2024." `productionStatus` (`series_spec_008`) is what actually answers
  that:
  - `year === lastAirYear` (or `lastAirYear` unset): show just `{year}` — today's exact format,
    unchanged, for a single-year or not-yet-resolved show.
  - `productionStatus` is `ENDED`/`CANCELED`: show `{year}-{lastAirYear}` — a closed range.
  - `productionStatus` is `RETURNING_SERIES`/`IN_PRODUCTION`/`PLANNED`/`PILOT`/`null` (still going,
    or unknown): show `{year}-` — an open-ended range, no assumption the show has finished.
- **One shared `formatSeriesYear(series)` utility**, not duplicated logic in `SeriesList`/
  `SeriesDetail` — both already independently format `{title} ({year})` today; this spec extracts a
  single function both call, reducing two copies of this branching logic to one.
- **`frontend_spec_054_series_list_compact_view.md` (not yet built) should consume this same
  helper once both land**, rather than hand-rolling its own `{title} ({year})` format — noted here
  as a forward cross-reference for whoever sequences the build order, not a change to that spec's
  own text (per this project's ID-immutability convention, that spec's existing AC wording isn't
  edited retroactively).

---

## Requirement 1: `formatSeriesYear` utility

### FRONTEND-058-AC-01 [AUTO]
**Statement**: A new `formatSeriesYear(series: Pick<Series, 'year' | 'lastAirYear' |
'productionStatus'>): string` shall return: `''` when `year` is `null`; `` `${year}` `` when
`lastAirYear` is `null` or equals `year`; `` `${year}-${lastAirYear}` `` when `productionStatus` is
`'ENDED'` or `'CANCELED'`; `` `${year}-` `` otherwise (still running or unknown status).

**Test Case (Red)**:
```typescript
describe('FRONTEND-058-AC-01: formatSeriesYear', () => {
  it.each([
    [{ year: null, lastAirYear: null, productionStatus: null }, ''],
    [{ year: 2020, lastAirYear: null, productionStatus: null }, '2020'],
    [{ year: 2020, lastAirYear: 2020, productionStatus: 'ENDED' }, '2020'],
    [{ year: 2020, lastAirYear: 2024, productionStatus: 'ENDED' }, '2020-2024'],
    [{ year: 2020, lastAirYear: 2024, productionStatus: 'CANCELED' }, '2020-2024'],
    [{ year: 2025, lastAirYear: 2025, productionStatus: 'RETURNING_SERIES' }, '2025'],
    [{ year: 2020, lastAirYear: 2025, productionStatus: 'RETURNING_SERIES' }, '2020-'],
    [{ year: 2020, lastAirYear: 2025, productionStatus: null }, '2020-'],
  ])('formats %j as %s', (series, expected) => {
    expect(formatSeriesYear(series)).toBe(expected)
  })
})
```
**Test Case (Green)**: new pure function in `frontend/src/utils/formatSeriesYear.ts`.

---

## Requirement 2: Applied at both existing display sites

### FRONTEND-058-AC-02 [AUTO]
**Statement**: `SeriesList`'s row title button and `SeriesDetail`'s header shall both use
`formatSeriesYear` in place of their current inline `` `(${year})` `` formatting — `{title}
{formatSeriesYear(series)}` (parenthesized when non-empty, e.g. `"Ozark (2017-2022)"`, unchanged
`"Ozark"` when `formatSeriesYear` returns `''`).

**Test Case (Red)**:
```typescript
it('FRONTEND-058-AC-02: SeriesList shows a closed year range for an ended show', async () => {
  mockGetAll.mockResolvedValue([makeSeries({ title: 'Ozark', year: 2017, lastAirYear: 2022, productionStatus: 'ENDED' })])
  render(<SeriesList {...defaultProps} />)
  expect(await screen.findByText('Ozark (2017-2022)')).toBeInTheDocument()
})

it('FRONTEND-058-AC-02: SeriesDetail shows an open-ended range for a running show', () => {
  render(<SeriesDetail {...defaultProps} series={makeSeries({ title: 'The Simpsons', year: 1989, lastAirYear: 2025, productionStatus: 'RETURNING_SERIES' })} />)
  expect(screen.getByText('The Simpsons (1989-)')).toBeInTheDocument()
})
```
**Test Case (Green)**: replace each site's inline `` `(${year})` `` with
`formatSeriesYear(series)`-derived text.

---

## Cross-References

| This spec | Source |
|---|---|
| `Series.lastAirYear`, `productionStatus` values this spec branches on | `series_spec_039_last_air_year.md`, `series_spec_008_series_lifecycle_data.md` |
| Existing `{title} ({year})` display sites this spec replaces | `SeriesList.tsx`, `SeriesDetail.tsx` |
| Should consume this same helper once both land (not yet built, forward reference only) | `frontend_spec_054_series_list_compact_view.md` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-058-AC-01: `formatSeriesYear` covers all branches correctly
- [x] FRONTEND-058-AC-02: `SeriesList`/`SeriesDetail` both use the shared helper
