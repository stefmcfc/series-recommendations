# Frontend Spec 066: `formatSeriesYear` — Open-Ended Range for a Returning Series Whose Aired Span Is a Single Year

**Status**: Implemented — `frontend/src/utils/formatSeriesYear.ts`,
`frontend/src/utils/formatSeriesYear.test.ts`
**Priority**: P2 (display-correctness bug — a still-airing, renewed show can read as if it's
already finished)
**Depends on**: Frontend Spec 058 (`frontend_spec_058_series_year_range_display.md`, owns
`formatSeriesYear`, whose `FRONTEND-058-AC-01` this spec partially supersedes) ✅ required
**Area**: Frontend (`utils/formatSeriesYear.ts`, `utils/formatSeriesYear.test.ts`) — no backend
change; `productionStatus`/`lastAirYear` are already resolved and exposed correctly today.

## Overview

Confirmed (2026-09-01, "Dexter: Resurrection" reported directly): a series whose `year` and
`lastAirYear` are the same (a freshman season that aired entirely within one calendar year) always
renders as a bare single year — `"2025"` — even when `productionStatus` is `RETURNING_SERIES`. This
reads as though the show has already ended, when it's actually confirmed to be continuing.

Root cause, reading `formatSeriesYear.ts` directly: `if (lastAirYear == null || lastAirYear ===
year) return `${year}`` short-circuits *before* the `productionStatus` check below it, for both the
"no `lastAirYear` resolved at all" case and the "`lastAirYear` equals `year`" case. `frontend_spec_058`'s
own Design Decisions already state the intended rule — "`productionStatus` is `RETURNING_SERIES`/
`IN_PRODUCTION`/`PLANNED`/`PILOT`/`null` (still going, or unknown): show `{year}-`" — but its
original `AC-01` test table explicitly asserted the opposite for exactly this case
(`{ year: 2025, lastAirYear: 2025, productionStatus: 'RETURNING_SERIES' }` → `'2025'`), so the
shipped implementation doesn't actually honor its own documented intent once `lastAirYear` and
`year` happen to match.

## Design Decisions

- **Scope is deliberately narrow: only the `lastAirYear === year` (resolved, equal) case is
  corrected.** The `lastAirYear == null` (never resolved) case keeps its existing bare-`{year}`
  behavior unchanged — there's no reported gap there, and with no `lastAirYear` data point at all,
  assuming an open-ended range would be guessing rather than reflecting a known fact. This spec
  fixes the one case that's actually wrong, not a wider reinterpretation of the function.
- **Once `lastAirYear` is known, `productionStatus` alone decides the shape — not equality with
  `year` first.** `ENDED`/`CANCELED` → closed range (`{year}-{lastAirYear}`, or bare `{year}` when
  they're equal — nothing to range over). Anything else, including a `null`/unresolved status →
  open range (`{year}-`), matching `frontend_spec_058`'s own already-documented intent for "still
  running or unknown" — this spec's fix is bringing the implementation in line with that existing
  rationale, not inventing a new one.
- **`frontend_spec_058`'s `FRONTEND-058-AC-01` is marked superseded, not reworded**, per this
  project's ID-immutability convention (`.claude/steering/ears_format.md`) — its original statement
  and test table stay verbatim in that spec file, with a strikethrough and a pointer here.

---

## Requirement 1: `formatSeriesYear` treats a known `lastAirYear` consistently with `productionStatus`

**User story**: As a user browsing my series, I want a renewed/still-airing show to read as
ongoing even if everything it's aired so far happened to air within one calendar year, so I don't
mistake it for a finished show.

### FRONTEND-066-AC-01 [AUTO]
**Statement**: `formatSeriesYear(series)` shall return: `''` when `year` is `null`; `` `${year}` ``
when `lastAirYear` is `null`; when `lastAirYear` is non-null and `productionStatus` is `'ENDED'` or
`'CANCELED'`, `` `${year}` `` if `lastAirYear` equals `year` or `` `${year}-${lastAirYear}` ``
otherwise; `` `${year}-` `` for every other case where `lastAirYear` is non-null (any other
`productionStatus`, including `null`/unresolved) — regardless of whether `lastAirYear` equals
`year`.

**References**: `frontend_spec_058_series_year_range_display.md` (`FRONTEND-058-AC-01`, the
original statement this supersedes); `service/TmdbGenreTable`-adjacent `ProductionStatus` enum
values (`backend/src/main/java/uk/co/stefirby/seriestracker/model/ProductionStatus.java`):
`RETURNING_SERIES`, `PLANNED`, `IN_PRODUCTION`, `ENDED`, `CANCELED`, `PILOT`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-066-AC-01: formatSeriesYear (supersedes FRONTEND-058-AC-01)', () => {
  it.each([
    [{ year: null, lastAirYear: null, productionStatus: null }, ''],
    [{ year: 2020, lastAirYear: null, productionStatus: null }, '2020'],
    [{ year: 2020, lastAirYear: null, productionStatus: 'RETURNING_SERIES' }, '2020'],
    [{ year: 2020, lastAirYear: 2020, productionStatus: 'ENDED' }, '2020'],
    [{ year: 2020, lastAirYear: 2024, productionStatus: 'ENDED' }, '2020-2024'],
    [{ year: 2020, lastAirYear: 2024, productionStatus: 'CANCELED' }, '2020-2024'],
    // FRONTEND-066: the case FRONTEND-058-AC-01 got wrong -- same year, but
    // confirmed still returning, must not collapse to a bare year.
    [{ year: 2025, lastAirYear: 2025, productionStatus: 'RETURNING_SERIES' }, '2025-'],
    [{ year: 2025, lastAirYear: 2025, productionStatus: null }, '2025-'],
    [{ year: 2020, lastAirYear: 2025, productionStatus: 'RETURNING_SERIES' }, '2020-'],
    [{ year: 2020, lastAirYear: 2025, productionStatus: null }, '2020-'],
  ] as const)('formats %j as %s', (series, expected) => {
    expect(formatSeriesYear(series)).toBe(expected)
  })
})
```

**Test Case (Green)**: rewrite `formatSeriesYear` so the `lastAirYear === year` shortcut no longer
bypasses the `productionStatus` check:
```typescript
export function formatSeriesYear(series: YearFields): string {
  const { year, lastAirYear, productionStatus } = series
  if (year == null) return ''
  if (lastAirYear == null) return `${year}`
  const isEnded = productionStatus === 'ENDED' || productionStatus === 'CANCELED'
  if (isEnded) return lastAirYear === year ? `${year}` : `${year}-${lastAirYear}`
  return `${year}-`
}
```

---

### FRONTEND-066-AC-02 [AUTO] (regression guard)
**Statement**: `SeriesList`'s row title and `SeriesDetail`'s header, both consumers of
`formatSeriesYear` (`FRONTEND-058-AC-02`), shall pick up the corrected behavior automatically with
no code change in either component — confirmed by their existing test suites continuing to pass
unmodified.

**Test Case (Green)**: no change to `SeriesList.tsx`/`SeriesDetail.tsx` or their tests — both call
`formatSeriesYear(series)` already; only the function's own internals change.

---

## Implementation Notes

- **`frontend_spec_058_series_year_range_display.md` needs a matching edit**: mark
  `FRONTEND-058-AC-01` superseded in place (`~~**FRONTEND-058-AC-01** [AUTO]~~ — superseded by
  FRONTEND-066-AC-01: <original statement and test table unchanged>`), tick/update its Acceptance
  Criteria Summary line, and append a dated note to its Design Decisions pointing here — per this
  project's ID-immutability convention, the original text isn't reworded or deleted.
- **No `API.md`/`RUNBOOK.md` change** — purely a frontend display-formatting fix, no request/
  response contract or configuration change.

## Cross-References

| This spec | Source |
|---|---|
| `formatSeriesYear`, the function this spec corrects | `frontend_spec_058_series_year_range_display.md` (`FRONTEND-058-AC-01`) |
| `ProductionStatus` enum values | `backend/src/main/java/uk/co/stefirby/seriestracker/model/ProductionStatus.java` (`series_spec_008_series_lifecycle_data.md`) |
| Consumers unaffected beyond the corrected output | `SeriesList.tsx`, `SeriesDetail.tsx` (`FRONTEND-058-AC-02`) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-066-AC-01: `formatSeriesYear` shows an open range once `lastAirYear` is known and `productionStatus` isn't `ENDED`/`CANCELED`, regardless of whether `lastAirYear` equals `year`
- [x] FRONTEND-066-AC-02: `SeriesList`/`SeriesDetail` pick up the fix with no code change (regression guard)
