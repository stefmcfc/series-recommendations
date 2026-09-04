import type { SeriesLookupResult } from '../types/series'

// FRONTEND-045-AC-05: the subset of lookup-mergeable fields both
// AddSeriesForm's and EditSeriesForm's FormState shapes have in common.
// AddSeriesForm's FormState carries several TMDB-only metadata fields this
// interface deliberately omits (imdbId, tmdbRating, tmdbVoteCount,
// originCountry, productionStatus, tmdbId, overview) -- those aren't fields
// EditSeriesForm's FormState/payload tracks today (they're managed by the
// separate Refresh flow, frontend_spec_060), so they're merged by
// AddSeriesForm itself on top of this shared base rather than here.
export interface LookupMergeableFormState {
  title: string
  year: string
  genres: string
  totalSeasons: string
  totalEpisodes: string
  imdbRating: string
  rottenTomatoesRating: string
  posterUrl: string
}

export function mergeCommonLookupFields<T extends LookupMergeableFormState>(
  form: T,
  result: SeriesLookupResult,
): T {
  const next: T = { ...form, title: result.title }

  if (result.year != null) next.year = String(result.year)
  if (result.genres != null) next.genres = result.genres
  if (result.totalSeasons != null)
    next.totalSeasons = String(result.totalSeasons)
  if (result.totalEpisodes != null)
    next.totalEpisodes = String(result.totalEpisodes)
  if (result.imdbRating != null) next.imdbRating = String(result.imdbRating)
  if (result.rottenTomatoesRating != null)
    next.rottenTomatoesRating = String(result.rottenTomatoesRating)
  if (result.posterUrl != null) next.posterUrl = result.posterUrl

  return next
}
