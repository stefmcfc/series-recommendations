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
  year?: number
  genres?: string
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
