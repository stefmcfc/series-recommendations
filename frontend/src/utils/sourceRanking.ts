import type { Series } from '../types/series'

// FRONTEND-135 Design Decision 1: this cap mirrors the backend's
// `app.tmdb.max-source-series` config default (20, see
// RecommendationSourcingService) -- there's no live config-sharing mechanism
// between backend and frontend in this app, so this must be kept in sync by
// hand if that default ever changes.
export const MAX_SOURCE_SERIES = 20

export type SourceRankingStrategy =
  | 'personalRatingThenDate'
  | 'personalRatingThenCustomBlend'
  | 'customBlendThenPersonalRating'

// FRONTEND-135-AC-11: mirrors SourceRatingBlend.DEFAULT_SOURCES -- used
// whenever the caller-supplied blendSources is empty.
const DEFAULT_BLEND_SOURCES = ['imdb', 'tmdb']

function resolveBlendSources(sources: string[]): string[] {
  return sources.length > 0 ? sources : DEFAULT_BLEND_SOURCES
}

// FRONTEND-135-AC-01/02/03: mirrors
// RecommendationSourcingService#resolveSourcePool -- an explicit selection
// (any status) when selectedSeriesIds is non-empty, otherwise the automatic
// pool (COMPLETED + non-blank imdbId), both then filtered by
// !excludeFromRecommendations.
export function resolveSourceRankingPool(
  allSeries: Series[],
  selectedSeriesIds: string[],
): Series[] {
  const pool =
    selectedSeriesIds.length > 0
      ? allSeries.filter((series) => selectedSeriesIds.includes(series.id))
      : allSeries.filter(
          (series) => series.status === 'COMPLETED' && !!series.imdbId?.trim(),
        )
  return pool.filter((series) => !series.excludeFromRecommendations)
}

// FRONTEND-135-AC-05: rottenTomatoesRating/rottenTomatoesPopcornmeter are on
// a 0-100 scale, imdbRating/tmdbRating are already 0-10 -- normalize the
// former by /10 before blending, mirroring SourceRatingBlend#normalize.
function sourceValue(series: Series, source: string): number | null {
  switch (source) {
    case 'imdb':
      return series.imdbRating
    case 'tmdb':
      return series.tmdbRating
    case 'tomatometer':
      return series.rottenTomatoesRating != null
        ? series.rottenTomatoesRating / 10
        : null
    case 'popcornmeter':
      return series.rottenTomatoesPopcornmeter != null
        ? series.rottenTomatoesPopcornmeter / 10
        : null
    default:
      return null
  }
}

// FRONTEND-135-AC-04/05/06/07/11: mirrors SourceRatingBlend#compute --
// averages exactly the requested sources that are present on this series,
// normalizing Rotten Tomatoes' 0-100 fields first, returning null (not NaN
// or 0) when nothing requested is present, rounded to one decimal place.
export function computeCustomRatingBlend(
  series: Series,
  sources: string[],
): number | null {
  const values = resolveBlendSources(sources)
    .map((source) => sourceValue(series, source))
    .filter((value): value is number => value != null)

  if (values.length === 0) return null

  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.round(average * 10) / 10
}

// Descending, nulls-last comparator shared by every ranking key below.
function compareNumbersDescNullsLast(
  a: number | null,
  b: number | null,
): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return b - a
}

// FRONTEND-135-AC-08: dateCompleted is an ISO 'YYYY-MM-DD' string --
// lexical comparison already matches chronological order, so no Date
// parsing is needed. Descending (more recent first), nulls last.
function compareDatesDescNullsLast(a: string | null, b: string | null): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (a === b) return 0
  return a < b ? 1 : -1
}

// FRONTEND-135-AC-08/09/10/11/12: mirrors SourceOrderComparator.INSTANCE and
// its #personalRatingThenBlend/#blendThenPersonalRating variants. Sorts a
// copy -- never mutates the input pool.
export function rankSourceSeries(
  pool: Series[],
  strategy: SourceRankingStrategy,
  blendSources: string[],
): Series[] {
  const resolvedBlendSources = resolveBlendSources(blendSources)

  const blendOf = (series: Series) =>
    computeCustomRatingBlend(series, resolvedBlendSources)

  const comparator = (a: Series, b: Series): number => {
    switch (strategy) {
      case 'personalRatingThenDate': {
        const byRating = compareNumbersDescNullsLast(
          a.personalRating,
          b.personalRating,
        )
        return byRating !== 0
          ? byRating
          : compareDatesDescNullsLast(a.dateCompleted, b.dateCompleted)
      }
      case 'personalRatingThenCustomBlend': {
        const byRating = compareNumbersDescNullsLast(
          a.personalRating,
          b.personalRating,
        )
        return byRating !== 0
          ? byRating
          : compareNumbersDescNullsLast(blendOf(a), blendOf(b))
      }
      case 'customBlendThenPersonalRating': {
        const byBlend = compareNumbersDescNullsLast(blendOf(a), blendOf(b))
        return byBlend !== 0
          ? byBlend
          : compareNumbersDescNullsLast(a.personalRating, b.personalRating)
      }
      default:
        return 0
    }
  }

  return [...pool].sort(comparator)
}
