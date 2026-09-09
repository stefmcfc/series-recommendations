// FRONTEND-107-AC-01: frontend-side mirror of series_spec_055's
// FilterProfileDto (`id, area, name, criteria, createdAt, updatedAt`).
// Lives in its own file (not folded into types/series.ts) -- cross-cutting,
// not series-specific, per frontend_structure.md's centralization
// convention.

export type FilterProfileArea =
  'MY_SERIES' | 'USE_MY_SERIES' | 'RECOMMENDATION_FILTERS'

export interface FilterProfile<TCriteria> {
  id: string
  area: FilterProfileArea
  name: string
  criteria: TCriteria
  createdAt: string
  updatedAt: string
}

// Area A -- SearchFilter.tsx's `buildCriteria(form)` output shape
// (frontend_spec_107's Overview). Deliberately its own decoupled interface,
// not a re-export/Pick of SearchCriteria, so this saved-profile payload
// doesn't silently drift if SearchCriteria's shape changes later.
export interface MySeriesFilterCriteria {
  genres?: string[]
  excludeGenres?: string[]
  keywords?: string[]
  minPersonalRating?: number
  minImdbRating?: number
  minTmdbRating?: number
  yearMin?: number
  yearMax?: number
}

// Area B -- UseMySeriesPanel.tsx's ~10 local useState fields, mirrored by
// value/type (not imported from RecommendationControls.tsx) for the same
// decoupling reason as MySeriesFilterCriteria above.
export interface UseMySeriesFilterCriteria {
  genreFilter: string[]
  excludeGenreFilter: string[]
  statusFilter: 'any' | 'completedOnly' | 'completedOrWatching'
  keywordsFilter: string[]
  minPersonalRating: number | null
  minImdbRating: string
  minTmdbRating: string
  yearMin: string
  yearMax: string
  sortBy:
    | 'dateAdded'
    | 'personalRating'
    | 'title'
    | 'year'
    | 'imdbRating'
    | 'tmdbRating'
  sortDirection: 'asc' | 'desc'
}

// Area C -- RecommendationFiltersBox.tsx's named 8-field slice of
// ControlsState (never minVoteCountTouched, which is bookkeeping-only and
// never part of a saved profile's criteria).
export interface RecommendationFiltersCriteria {
  minVoteCount: string
  excludeGenresSelected: string[]
  excludeKeywordsSelected: string[]
  minTmdbRating: string
  yearMin: string
  yearMax: string
  language: string
  countriesSelected: string[]
}
