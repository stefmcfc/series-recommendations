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
}

export type UpdateSeriesRequest = Partial<CreateSeriesRequest>

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
