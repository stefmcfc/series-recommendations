// FRONTEND-107-AC-01: frontend-side mirror of series_spec_055's
// FilterProfileDto (`id, area, name, criteria, createdAt, updatedAt`).
// Lives in its own file (not folded into types/series.ts) -- cross-cutting,
// not series-specific, per frontend_structure.md's centralization
// convention.

import type {
  NameStatsSortBy,
  NameStatsSortDirection,
} from '../components/NameStatsTable'

export type FilterProfileArea =
  | 'MY_SERIES'
  | 'USE_MY_SERIES'
  | 'RECOMMENDATION_FILTERS'
  | 'CUSTOM_SEARCH'
  | 'ANALYSIS_FILTERS'

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
  // FRONTEND-119-AC-07/SERIES-062: rottenTomatoesRating/
  // rottenTomatoesPopcornmeter added, mirroring
  // RecommendationControls.tsx's SpecificSeriesSortBy exactly.
  sortBy:
    | 'dateAdded'
    | 'personalRating'
    | 'title'
    | 'year'
    | 'imdbRating'
    | 'tmdbRating'
    | 'rottenTomatoesRating'
    | 'rottenTomatoesPopcornmeter'
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

// Area D -- CustomSearchPanel.tsx's 8 fields (frontend_spec_112's Overview:
// a dedicated type, not a reuse of RecommendationFiltersCriteria, so the two
// areas' profile lists stay fully independent). No excludeKeywordsSelected
// -- Custom Search has no such field today (a pre-existing gap, unrelated to
// this spec).
export interface CustomSearchFilterCriteria {
  genresSelected: string[]
  excludeGenresSelected: string[]
  keywordsSelected: string[]
  minTmdbRating: string
  yearMin: string
  yearMax: string
  language: string
  countriesSelected: string[]
}

// Area E -- hooks/useNameStatsFilters.ts's FilterInputs plus its live
// sortBy/sortDirection (frontend_spec_112's Overview/Design Decisions).
// sortBy/sortDirection are genuinely `| undefined` (not defaulted strings)
// since the hook never initializes them -- see describeFilterCriteria.ts's
// describeAnalysisFiltersCriteria for why this sidesteps
// frontend_spec_109-AC-13's default-value-comparison bug class.
export interface AnalysisFilterCriteria {
  minSeriesCount: string
  minAveragePersonalRating: string
  minAverageBlendedRating: string
  statusScope: 'all' | 'completed'
  sortBy: NameStatsSortBy | undefined
  sortDirection: NameStatsSortDirection | undefined
}
