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
  tmdbRating: number | null
  tmdbVoteCount: number | null
  personalRating: number | null
  personalNotes: string | null
  posterUrl: string | null
  imdbId: string | null
  dateAdded: string
  dateCompleted: string | null
  lastRefreshedAt: string | null
  originCountry: string | null
  productionStatus: string | null
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
  personalRating?: number
  personalNotes?: string
  posterUrl?: string
  imdbId?: string
  tmdbRating?: number
  tmdbVoteCount?: number
  originCountry?: string
  productionStatus?: string
}

export type UpdateSeriesRequest = Partial<CreateSeriesRequest> & {
  currentSeason?: number
  currentEpisode?: number
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
}

export interface LookupTmdbCandidate {
  tmdbId: number
  title: string
  year?: number
  originalTitle?: string
  posterUrl?: string
  originCountry?: string
}

export interface Recommendation {
  title: string
  year: number | null
  genres: string | null
  overview: string | null
  posterUrl: string | null
  tmdbRating: number | null
  voteCount: number | null
  imdbId: string
  sourceTitles: string[]
  totalSourceCount: number
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
  language?: string
  maxPerSource?: number
  maxSourcesShown?: number
  sortBy?: 'score' | 'recommendationCount'
}

export interface SearchCriteria {
  title?: string
  genres?: string[]
  status?: SeriesStatus
  minPersonalRating?: number
  maxPersonalRating?: number
  minImdbRating?: number
  maxImdbRating?: number
  startedNotFinished?: boolean
}
