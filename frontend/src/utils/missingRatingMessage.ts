import type { SortOptions } from '../types/series'

// FRONTEND-119-AC-02: shared by both SeriesList.tsx (backend-computed
// excludedCount) and UseMySeriesPanel.tsx (client-side missingRatingCount) --
// see series_spec_119's Design Decisions for why the message-formatting util
// is shared while each surface's exclusion mechanism is independent.
export type SortByOption = NonNullable<SortOptions['sortBy']>

const DROPPABLE_FIELD_LABELS: Partial<Record<SortByOption, string>> = {
  imdbRating: 'IMDb',
  tmdbRating: 'TMDB',
  rottenTomatoesRating: 'Tomatometer',
  rottenTomatoesPopcornmeter: 'Popcornmeter',
}

/**
 * Formats the "N series meeting this criteria do/does not have X ratings"
 * notice shown when a rating sort drops series missing that rating. Returns
 * `null` when there's nothing to say -- `count` is 0, or `sortBy` isn't one
 * of the four droppable rating fields (personalRating/dateAdded/title/year
 * are never droppable).
 */
export function formatMissingRatingMessage(
  count: number,
  sortBy: SortByOption,
): string | null {
  if (count === 0) return null
  const label = DROPPABLE_FIELD_LABELS[sortBy]
  if (label == null) return null

  const verb = count === 1 ? 'does' : 'do'
  return `${count} series meeting this criteria ${verb} not have ${label} ratings`
}
