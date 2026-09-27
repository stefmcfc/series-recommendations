import type { Series } from '../types/series'

// FRONTEND-136-AC-06: client-side reimplementation of
// RatingBlendUtil.blendedRating's exact contract
// (backend/src/main/java/uk/co/stefirby/seriestracker/service/stats/RatingBlendUtil.java)
// -- the unweighted average of whichever of imdbRating/tmdbRating are
// non-null, rounded to 1 decimal place (HALF_UP on the backend; standard JS
// rounding is equivalent at 1dp for these inputs), null if both source
// ratings are null. Kept in sync manually -- if either side's formula
// changes, update the other and this comment pairing.
export function blendedRating(
  series: Pick<Series, 'imdbRating' | 'tmdbRating'>,
): number | null {
  const ratings = [series.imdbRating, series.tmdbRating].filter(
    (rating): rating is number => rating !== null,
  )
  if (ratings.length === 0) return null
  const sum = ratings.reduce((total, rating) => total + rating, 0)
  return Math.round((sum / ratings.length) * 10) / 10
}
