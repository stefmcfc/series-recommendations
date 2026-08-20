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
  alternateTitle: string | null
  year: number | null
  genres: string | null
  tags: string | null
  totalSeasons: number | null
  totalEpisodes: number | null
  currentSeason: number | null
  currentEpisode: number | null
  status: SeriesStatus
  imdbRating: number | null
  metacriticRating: number | null
  rottenTomatoesRating: number | null
  personalRating: number | null
  personalNotes: string | null
  posterUrl: string | null
  imdbId: string | null
  dateAdded: string
  dateCompleted: string | null
}

export interface CreateSeriesRequest {
  title: string
  alternateTitle?: string
  year?: number
  genres?: string
  tags?: string
  totalSeasons?: number
  totalEpisodes?: number
  status?: SeriesStatus
  imdbRating?: number
  metacriticRating?: number
  rottenTomatoesRating?: number
  personalRating?: number
  personalNotes?: string
  posterUrl?: string
  imdbId?: string
}

export type UpdateSeriesRequest = Partial<CreateSeriesRequest> & {
  currentSeason?: number
  currentEpisode?: number
}

export interface OmdbLookupResult {
  title: string
  year?: number
  genres?: string
  totalSeasons?: number
  totalEpisodes?: number
  imdbRating?: number
  metacriticRating?: number
  rottenTomatoesRating?: number
  posterUrl?: string
  imdbId?: string
}

export interface LookupCandidate {
  title: string
  year?: number
  imdbId?: string
  posterUrl?: string
}

export interface LookupTmdbCandidate {
  tmdbId: number
  title: string
  year?: number
  originalTitle?: string
  posterUrl?: string
}

export interface Recommendation {
  title: string
  year: number | null
  genres: string | null
  overview: string | null
  posterUrl: string | null
  tmdbRating: number | null
  imdbId: string
  sourceTitle: string | null
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
