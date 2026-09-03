# Frontend Spec 084: Use My Series Picker Shows Full Year Range

**Status**: Implemented — `components/RecommendationControls.tsx`, `components/RecommendationControls.test.tsx`
**Priority**: P4
**Depends on**: none
**Area**: Frontend (`components/RecommendationControls.tsx`)

## Overview

The Use My Series series picker's option labels (`seriesPickerLabel`/`seriesPickerDisplay`, e.g. "Bosch (2015)") show only `series.year` — a single year, even for a show that ran multiple years or is still airing. Every other place in this app that shows a series' year (`SeriesList`'s row title, `SeriesDetail`'s header) uses the shared `formatSeriesYear` utility (`frontend_spec_058`/`066`), which renders a closed range for a finished multi-year show ("2015-2023"), an open-ended range for a still-running one ("2015-"), or a bare year when that's all there is ("2015"). The picker's two label functions never adopted it — they reimplement a simpler, year-only version instead.

Noticed by the user immediately after `frontend_spec_082` shipped `lastAirYear`-aware interval-overlap matching to this same picker's year filter — the filter now correctly accounts for a show's full airing span, but the picker's own display still doesn't show it.

## Design Decisions

- **Reuse `formatSeriesYear` as-is, no new formatting logic.** It already takes `{ year, lastAirYear, productionStatus }` (a subset `Series` already satisfies) and returns exactly the string shape needed — this is a straight swap of the inline `` `${series.year}` `` computation for a call to the existing shared utility, not a new formatting decision.
- **Both `seriesPickerLabel` (plain string, used for the picker's accessible/dedup label) and `seriesPickerDisplay` (the rendered `ReactNode` with `<strong>`/`<em>`) get the same change** — they currently duplicate the same `yearPart` computation independently; both need the swap so the visible text and the accessible name stay in sync (as they already are today for every other part of the label).
- **No change to which series the picker offers or how sorting/filtering works** — this is a pure display-string fix in the two functions that turn a `Series` into picker option text, not a change to `buildSpecificSeriesCandidatePool` or any filter predicate.

## Requirements

### Requirement 1: picker option text shows the full year range

**User Story**: As a user browsing the Use My Series picker, I want to see a show's full year range (or "still airing" open-endedness), the same way I already see it on My Series and the series detail page.

#### FRONTEND-084-AC-01 [AUTO]: `seriesPickerLabel` uses `formatSeriesYear`
**Statement**: `seriesPickerLabel` shall build its year portion from `formatSeriesYear(series)` instead of `series.year` alone, producing the same closed-range/open-ended-range/bare-year/absent shape `SeriesList`/`SeriesDetail` already use.

**Rationale**: Core fix — reuse the existing shared formatter instead of a second, less capable inline computation.

**References**:
- Function: `components/RecommendationControls.tsx`, `seriesPickerLabel` (lines 397-408)
- Utility: `utils/formatSeriesYear.ts`

**Test Case (Red)**:
```typescript
describe('FRONTEND-084-AC-01: seriesPickerLabel shows the full year range', () => {
  it('shows a closed range for an ended multi-year show', () => {
    const series = makeSeries({ title: 'Ended Show', year: 2015, lastAirYear: 2020, productionStatus: 'ENDED' })
    expect(seriesPickerLabel(series, 'any')).toContain('(2015-2020)')
  })

  it('shows an open-ended range for a still-running show', () => {
    const series = makeSeries({ title: 'Running Show', year: 2022, lastAirYear: 2024, productionStatus: 'RETURNING_SERIES' })
    expect(seriesPickerLabel(series, 'any')).toContain('(2022-)')
  })

  it('shows a bare year when lastAirYear is unresolved', () => {
    const series = makeSeries({ title: 'Unknown End', year: 2021, lastAirYear: null })
    expect(seriesPickerLabel(series, 'any')).toContain('(2021)')
  })
})
```

**Test Case (Green)**: in `seriesPickerLabel`, replace `series.year != null ? \` (${series.year})\` : ''` with a call through `formatSeriesYear(series)`, wrapping in parens only when the result is non-empty (`const formatted = formatSeriesYear(series); const yearPart = formatted !== '' ? \` (${formatted})\` : ''`).

#### FRONTEND-084-AC-02 [AUTO]: `seriesPickerDisplay` uses `formatSeriesYear`
**Statement**: `seriesPickerDisplay` shall build its rendered year portion from `formatSeriesYear(series)`, identically to `seriesPickerLabel`'s AC-01 change, so the visible option text and its accessible name stay in sync.

**Rationale**: The two functions currently duplicate the same year computation independently — both need the same fix, not just one.

**References**:
- Function: `components/RecommendationControls.tsx`, `seriesPickerDisplay` (lines 411-433)

**Test Case (Red)**:
```typescript
describe('FRONTEND-084-AC-02: seriesPickerDisplay shows the full year range', () => {
  it('renders a closed range for an ended multi-year show', () => {
    const series = makeSeries({ title: 'Ended Show', year: 2015, lastAirYear: 2020, productionStatus: 'ENDED' })
    render(<>{seriesPickerDisplay(series, 'any')}</>)
    expect(screen.getByText(/\(2015-2020\)/)).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: same `formatSeriesYear`-based computation as AC-01, applied to `seriesPickerDisplay`'s own `yearPart`.

#### FRONTEND-084-AC-03 [AUTO]: no change when a series has no year at all
**Statement**: When `series.year` is `null`, both `seriesPickerLabel` and `seriesPickerDisplay` shall omit the year portion entirely, matching their pre-fix behavior for that case.

**Rationale**: Regression guard — `formatSeriesYear` already returns `''` for a `null` year (same as the current inline check), so this should be a no-op for that case, worth confirming explicitly.

**Test Case (Red)**:
```typescript
describe('FRONTEND-084-AC-03: no year portion when year is null', () => {
  it('omits the year parenthetical entirely', () => {
    const series = makeSeries({ title: 'No Year', year: null, lastAirYear: null })
    expect(seriesPickerLabel(series, 'any')).toBe('No Year')
  })
})
```

**Test Case (Green)**: covered naturally by the `formatted !== ''` guard in AC-01/AC-02's fix — no separate branch needed.

## Cross-References

| Concept | Location |
|---|---|
| Shared utility being adopted | `utils/formatSeriesYear.ts` (`frontend_spec_058`/`066`) |
| Existing consumers already using it correctly | `components/SeriesList.tsx` (row title), `components/SeriesDetail.tsx` (header) |
| Related recent fix to this same picker | `frontend_spec_082_use_my_series_year_range_overlap.md` (the year *filter*'s matching logic — this spec is the *display* counterpart, found immediately after) |

## Acceptance Criteria Summary

- [x] FRONTEND-084-AC-01: `seriesPickerLabel` uses `formatSeriesYear`
- [x] FRONTEND-084-AC-02: `seriesPickerDisplay` uses `formatSeriesYear`
- [x] FRONTEND-084-AC-03: no change when a series has no year at all
