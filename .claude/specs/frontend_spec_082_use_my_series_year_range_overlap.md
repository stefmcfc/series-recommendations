# Frontend Spec 082: Use My Series Picker's Year Filter Uses Interval-Overlap Matching

**Status**: Implemented — `components/RecommendationControls.tsx`, `components/UseMySeriesPanel.test.tsx`
**Priority**: P3
**Depends on**: none
**Area**: Frontend (`components/RecommendationControls.tsx`)

## Overview

`UseMySeriesPanel`'s "Year Min (My Series)"/"Year Max (My Series)" filter (`frontend_spec_081`) only checks a series' `year` against the range — a point check. The backend's own year-range filter (`SeriesSearchService.matchesYearRange`, `series_spec_039`) instead treats a series as spanning `[year, lastAirYear ?? year]` and matches if that span overlaps the query range at all. The two diverge for any still-running (or previously long-running) show whose start year predates the filter range but whose known airing span reaches into it — matching on My Series' own filter sheet, silently excluded from the Use My Series picker for the identical query. This spec brings the picker's client-side filter in line with the backend's interval-overlap semantics.

This was found during a 2026-09-04 investigation into `.claude/SPEC_CANDIDATES.md`'s "Share filter/sort logic between `SeriesList`/`SearchFilter` and Use My Series" candidate — that candidate's "extract shared predicates" framing turned out not to be actionable (the two implementations are in different languages with no client-side counterpart to consolidate on the My Series side), but the investigation surfaced this as a genuine, undocumented behavioral gap worth fixing on its own merits, independent of that candidate.

## Design Decisions

- **Match the backend's semantics exactly, not just "be less wrong".** `matchesYearRange`'s exact rule: a `null` year matches only when no range filter is active at all (both bounds unset); otherwise, `series.year > yearMax` fails the check, and the series' *effective end* — `lastAirYear` if set, else `year` — must be `>= yearMin`. This spec's fixed frontend function reproduces that rule precisely, field for field.
- **No change to the "no filter active" fast path.** `filterSpecificSeriesByYearRange`'s existing `if (trimmedMin === '' && trimmedMax === '') return series` early return already matches the backend's own null-year behavior in that case (a null-year series isn't excluded when no filter is set) — this spec only changes the per-item check that runs once a filter is actually active.
- **`Series.lastAirYear` already exists on the frontend type** (`types/series.ts`) and is already populated by the API — no new field, no new fetch, purely a matching-logic fix in one function.
- **Scope is this one function only.** The genre substring-vs-exact-token divergence between the two implementations is a separate, already-documented *deliberate* choice (`frontend_spec_069`'s own comments) — not in scope here, and not being revisited by this spec.

## Requirements

### Requirement 1: interval-overlap year matching

**User Story**: As a user filtering Use My Series' picker by year, I want a still-running (or long-running) show to match the same way it would on My Series' own filter, instead of being silently excluded because only its start year is checked.

#### FRONTEND-082-AC-01 [AUTO]: a series matching only via its `lastAirYear` is included
**Statement**: When `yearMin` is set and a series' `year` is below it but its `lastAirYear` is at or above it, `filterSpecificSeriesByYearRange` shall include that series in the filtered result.

**Rationale**: The core gap — a show that started before the range but is (or was) still airing into it should match, mirroring the backend.

**References**:
- Function: `components/RecommendationControls.tsx`, `filterSpecificSeriesByYearRange` (lines 555-570)
- Backend reference behavior: `SeriesSearchService.matchesYearRange` (`series_spec_039`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-082-AC-01: interval-overlap year matching includes a series via lastAirYear', () => {
  it('includes a series whose year is below yearMin but lastAirYear reaches it', () => {
    const series = [
      makeSeries({ id: '1', title: 'Long Runner', year: 2015, lastAirYear: 2023 }),
      makeSeries({ id: '2', title: 'Ended Early', year: 2015, lastAirYear: 2016 }),
    ]
    render(
      <UseMySeriesPanel state={makeState()} updateState={vi.fn()} allSeries={series} genreOptions={[]} keywordOptions={[]} />,
    )

    fireEvent.change(screen.getByLabelText(/year min \(my series\)/i), { target: { value: '2020' } })

    expect(screen.getByText('Long Runner')).toBeInTheDocument()
    expect(screen.queryByText('Ended Early')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: in `filterSpecificSeriesByYearRange`, replace the direct `s.year < min` check with `(s.lastAirYear ?? s.year) < min`.

#### FRONTEND-082-AC-02 [AUTO]: `yearMax` still checks the series' start year, unchanged
**Statement**: When `yearMax` is set, `filterSpecificSeriesByYearRange` shall continue excluding a series whose `year` exceeds it, regardless of `lastAirYear`.

**Rationale**: Regression guard — the backend's own rule only widens the lower bound via `lastAirYear`; the upper bound stays a plain `year > yearMax` check on both sides (a show can't have *started* after the query's max year and still match, no matter how it ends).

**References**:
- Backend: `SeriesSearchService.matchesYearRange` line 131 (`if (yearMax != null && s.getYear() > yearMax) return false;`) — unaffected by `lastAirYear`

**Test Case (Red)**:
```typescript
describe('FRONTEND-082-AC-02: yearMax still checks year, not lastAirYear', () => {
  it('excludes a series whose year exceeds yearMax even if lastAirYear would not', () => {
    const series = [makeSeries({ id: '1', title: 'Starts Late', year: 2025, lastAirYear: 2025 })]
    render(
      <UseMySeriesPanel state={makeState()} updateState={vi.fn()} allSeries={series} genreOptions={[]} keywordOptions={[]} />,
    )

    fireEvent.change(screen.getByLabelText(/year max \(my series\)/i), { target: { value: '2020' } })

    expect(screen.queryByText('Starts Late')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: no change needed to the `max` branch — confirms it's untouched by this spec's fix.

#### FRONTEND-082-AC-03 [AUTO]: a series with no `lastAirYear` falls back to `year`, unchanged
**Statement**: When a series' `lastAirYear` is `null`, `filterSpecificSeriesByYearRange` shall use `year` as its effective end, matching its pre-fix behavior for such series.

**Rationale**: Regression guard — `frontend_spec_082` only changes behavior for series that actually carry a `lastAirYear`; everything else (the common case for a completed, single-season, or not-yet-refreshed series) must behave identically to before.

**References**:
- Function: `components/RecommendationControls.tsx`, `filterSpecificSeriesByYearRange`

**Test Case (Red)**:
```typescript
describe('FRONTEND-082-AC-03: no lastAirYear falls back to year, unchanged', () => {
  it('still matches or excludes correctly using year alone when lastAirYear is null', () => {
    const series = [
      makeSeries({ id: '1', title: 'In Range', year: 2021, lastAirYear: null }),
      makeSeries({ id: '2', title: 'Out of Range', year: 2010, lastAirYear: null }),
    ]
    render(
      <UseMySeriesPanel state={makeState()} updateState={vi.fn()} allSeries={series} genreOptions={[]} keywordOptions={[]} />,
    )

    fireEvent.change(screen.getByLabelText(/year min \(my series\)/i), { target: { value: '2020' } })

    expect(screen.getByText('In Range')).toBeInTheDocument()
    expect(screen.queryByText('Out of Range')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: `s.lastAirYear ?? s.year` naturally covers this — no separate branch needed.

## Cross-References

| Concept | Location |
|---|---|
| Reference (correct) behavior this spec matches | `backend/.../service/SeriesSearchService.java`, `matchesYearRange`; `series_spec_039_last_air_year.md` |
| Function being fixed | `frontend/src/components/RecommendationControls.tsx`, `filterSpecificSeriesByYearRange` |
| `lastAirYear` field, already present on the frontend type | `frontend/src/types/series.ts` |
| Deliberately out-of-scope, already-documented divergence | Genre substring-vs-exact-token matching, `frontend_spec_069`'s Design Decisions |
| Investigation that surfaced this gap | `.claude/SPEC_CANDIDATES.md`, "Share filter/sort logic..." candidate, 2026-09-04 update |

## Acceptance Criteria Summary

- [x] FRONTEND-082-AC-01: a series matching only via its `lastAirYear` is included
- [x] FRONTEND-082-AC-02: `yearMax` still checks the series' start year, unchanged
- [x] FRONTEND-082-AC-03: a series with no `lastAirYear` falls back to `year`, unchanged
