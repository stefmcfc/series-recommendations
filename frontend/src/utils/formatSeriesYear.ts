import type { Series } from '../types/series'

type YearFields = Pick<Series, 'year' | 'lastAirYear' | 'productionStatus'>

/**
 * Formats a series' year(s) for display: a single year ("2020"), a closed
 * range for a show known to have finished ("2020-2024"), or an open-ended
 * range for a still-running/unknown-status show ("2020-"). `lastAirYear`
 * alone can't distinguish "ended" from "still running, last aired X" --
 * both a returning show and an ended one can have a resolved lastAirYear --
 * so `productionStatus` (series_spec_008) decides which shape to use, once
 * `lastAirYear` is actually known. Shared by SeriesList's row title and
 * SeriesDetail's header (frontend_spec_058).
 *
 * FRONTEND-066/frontend_spec_066: `productionStatus` decides the shape even
 * when `lastAirYear` equals `year` (e.g. a freshman season of a renewed show
 * that aired entirely within one calendar year) -- that case must still read
 * as open-ended for a confirmed-still-returning show, not collapse to a bare
 * year as if it had already finished. Only a genuinely unresolved
 * `lastAirYear` (no data point at all) keeps the bare-year fallback,
 * regardless of `productionStatus`.
 */
export function formatSeriesYear(series: YearFields): string {
  const { year, lastAirYear, productionStatus } = series

  // Loose null checks (matching this codebase's existing `!= null` idiom,
  // e.g. SeriesList/SeriesDetail's prior inline formatting) so a test double
  // built via `{ ... } as Series` with an omitted (undefined) field behaves
  // the same as an explicit `null` -- not just the exact `year: null` shape
  // AC-01 spells out.
  if (year == null) return ''
  if (lastAirYear == null) return `${year}`
  const isEnded =
    productionStatus === 'ENDED' || productionStatus === 'CANCELED'
  if (isEnded) {
    return lastAirYear === year ? `${year}` : `${year}-${lastAirYear}`
  }
  return `${year}-`
}
