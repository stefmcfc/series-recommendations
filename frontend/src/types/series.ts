export const SeriesStatus = {
  WATCHING: 'WATCHING',
  COMPLETED: 'COMPLETED',
  DROPPED: 'DROPPED',
  BACKLOG: 'BACKLOG',
} as const

export type SeriesStatus = (typeof SeriesStatus)[keyof typeof SeriesStatus]

export interface Series {
  id: string
  title: string
  year: number | null
  genres: string | null
  tags: string | null
  totalSeasons: number | null
  totalEpisodes: number | null
  currentSeason: number | null
  currentEpisode: number | null
  status: SeriesStatus
  imdbRating: number | null
  rottenTomatoesRating: number | null
  rottenTomatoesPopcornmeter: number | null
  tmdbRating: number | null
  tmdbVoteCount: number | null
  personalRating: number | null
  personalNotes: string | null
  posterUrl: string | null
  imdbId: string | null
  dateAdded: string
  dateCompleted: string | null
  lastRefreshedAt: string | null
  newContentDetectedAt: string | null
  originCountry: string | null
  productionStatus: string | null
  keywords: string[]
  overview: string | null
  excludeFromRecommendations: boolean
  flaggedForRewatch: boolean
}

export interface KeywordStat {
  name: string
  seriesCount: number
  averagePersonalRating: number | null
}

export interface RefreshResult {
  series: Series
  omdbRefreshed: boolean
  tmdbRefreshed: boolean
}

export interface RefreshJobStatus {
  status: 'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  totalCount: number
  completedCount: number
  skippedCount: number
  startedAt: string | null
  finishedAt: string | null
}

export interface CreateSeriesRequest {
  title: string
  year?: number
  genres?: string
  tags?: string
  totalSeasons?: number
  totalEpisodes?: number
  status?: SeriesStatus
  imdbRating?: number
  rottenTomatoesRating?: number
  rottenTomatoesPopcornmeter?: number
  personalRating?: number
  personalNotes?: string
  posterUrl?: string
  imdbId?: string
  tmdbRating?: number
  tmdbVoteCount?: number
  originCountry?: string
  productionStatus?: string
  tmdbId?: number
  overview?: string
  excludeFromRecommendations?: boolean
}

export type UpdateSeriesRequest = Partial<CreateSeriesRequest> & {
  currentSeason?: number
  currentEpisode?: number
  flaggedForRewatch?: boolean
}

export interface SeriesLookupResult {
  title: string
  year?: number
  genres?: string
  totalSeasons?: number
  totalEpisodes?: number
  imdbRating?: number
  rottenTomatoesRating?: number
  tmdbRating?: number
  tmdbVoteCount?: number
  posterUrl?: string
  imdbId?: string
  originCountry?: string
  productionStatus?: string
  tmdbId?: number
  overview?: string
}

export interface LookupTmdbCandidate {
  tmdbId: number
  title: string
  year?: number
  originalTitle?: string
  posterUrl?: string
  originCountry?: string
}

export interface StreamingProvider {
  name: string
  logoUrl: string | null
}

export interface Recommendation {
  title: string
  year: number | null
  genres: string | null
  overview: string | null
  posterUrl: string | null
  tmdbRating: number | null
  voteCount: number | null
  streamingProviders: StreamingProvider[]
  imdbId: string
  sourceTitles: string[]
  totalSourceCount: number
  originCountry: string | null
  tmdbId: number
}

export interface RecommendationQuery {
  limit?: number
  seriesIds?: string[]
  genres?: string[]
  keywords?: string[]
  minSourceRating?: number
  minTmdbRating?: number
  minVoteCount?: number
  yearMin?: number
  yearMax?: number
  excludeGenres?: string[]
  excludeKeywords?: string[]
  language?: string
  // SERIES-032/FRONTEND-047: multi-select, OR-matched origin countries --
  // sent comma-joined as `with_origin_country` to TMDB's discover/tv,
  // scoped to Custom Search sourcing only (series_spec_032). Deliberately a
  // separate field from `language` (single-select, TMDB only ever accepts
  // one `with_original_language` value) -- see frontend_spec_047's Design
  // Decisions for the asymmetry.
  countries?: string[]
  maxPerSource?: number
  maxSourcesShown?: number
  sortBy?: 'score' | 'recommendationCount'
  // SERIES-033/FRONTEND-049: 'useMySeries' sent explicitly and unconditionally
  // whenever that tab is active, so the backend never has to infer it by
  // elimination (an empty Custom Search request is a distinct, legitimate
  // request in its own right -- see series_spec_033_use_my_series_explicit_mode.md).
  sourceMode?: 'trending' | 'topRated' | 'useMySeries'
  trendingWindow?: 'day' | 'week'
  // FRONTEND-033-AC-04: TMDB-native discover sort, applicable only when
  // sourceMode is 'topRated' or the query is genre/keyword-directed --
  // mirrors series_spec_025_discover_native_sort.md's discoverSortBy param.
  discoverSortBy?:
    | 'vote_average.desc'
    | 'popularity.desc'
    | 'first_air_date.desc'
    | 'vote_count.desc'
}

export interface SearchCriteria {
  title?: string
  genres?: string[]
  keywords?: string[]
  status?: SeriesStatus
  minPersonalRating?: number
  minImdbRating?: number
  // FRONTEND-055/SERIES-037: replaces the removed maxPersonalRating/
  // maxImdbRating/startedNotFinished fields -- minTmdbRating/yearMin/yearMax
  // map 1:1 to series_spec_037's new GET /series/search query params.
  minTmdbRating?: number
  yearMin?: number
  yearMax?: number
  flaggedForRewatch?: boolean
}

// FRONTEND-013-AC-10/14: mirrors series_spec_009_rating_sort.md's sortBy/sortDirection
// params on GET /series and GET /series/search -- the full six-member enum from that
// spec's Requirement 1 + Requirement 2 amendment.
export interface SortOptions {
  sortBy?:
    | 'dateAdded'
    | 'personalRating'
    | 'title'
    | 'year'
    | 'imdbRating'
    | 'tmdbRating'
  sortDirection?: 'asc' | 'desc'
}
