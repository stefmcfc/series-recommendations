import axios from 'axios'
import type {
  Series,
  CreateSeriesRequest,
  UpdateSeriesRequest,
  SearchCriteria,
  SeriesLookupResult,
  LookupTmdbCandidate,
  Recommendation,
  RecommendationQuery,
  RefreshResult,
  RefreshJobStatus,
  KeywordStat,
} from '../types/series'
import { ApiError } from '../types/api'

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  'http://localhost:8080/api/v1'

const client = axios.create({ baseURL: API_BASE })

async function request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    if (import.meta.env.DEV) {
      console.log('[seriesApi] request')
    }
    const response = await fn()
    return response.data
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (import.meta.env.DEV) {
        console.error('[seriesApi] error', err)
      }
      if (!err.response) {
        throw new ApiError(0, 'Network error. Please check your connection.')
      }
      const { status, data } = err.response as {
        status: number
        data: { error?: string; details?: Record<string, string> }
      }
      throw new ApiError(
        status,
        data?.error ?? 'An error occurred',
        data?.details,
      )
    }
    throw err
  }
}

function buildRecommendationParams(
  query?: RecommendationQuery,
): Record<string, unknown> {
  if (!query) return {}
  const params: Record<string, unknown> = {}
  if (query.limit != null) params.limit = query.limit
  if (query.seriesIds?.length) params.seriesIds = query.seriesIds.join(',')
  if (query.genres?.length) params.genres = query.genres.join(',')
  if (query.keywords?.length) params.keywords = query.keywords.join(',')
  if (query.minSourceRating != null)
    params.minSourceRating = query.minSourceRating
  if (query.minTmdbRating != null) params.minTmdbRating = query.minTmdbRating
  if (query.minVoteCount != null) params.minVoteCount = query.minVoteCount
  if (query.yearMin != null) params.yearMin = query.yearMin
  if (query.yearMax != null) params.yearMax = query.yearMax
  if (query.excludeGenres?.length)
    params.excludeGenres = query.excludeGenres.join(',')
  if (query.language != null && query.language !== '')
    params.language = query.language
  if (query.maxPerSource != null) params.maxPerSource = query.maxPerSource
  if (query.maxSourcesShown != null)
    params.maxSourcesShown = query.maxSourcesShown
  if (query.sortBy != null) params.sortBy = query.sortBy
  return params
}

function buildSearchParams(criteria?: SearchCriteria): Record<string, unknown> {
  if (!criteria) return {}
  const params: Record<string, unknown> = {}
  if (criteria.title != null) params.title = criteria.title
  if (criteria.genres?.length) params.genre = criteria.genres
  if (criteria.keywords?.length) params.keyword = criteria.keywords
  if (criteria.status != null) params.status = criteria.status
  if (criteria.minPersonalRating != null)
    params.minPersonalRating = criteria.minPersonalRating
  if (criteria.maxPersonalRating != null)
    params.maxPersonalRating = criteria.maxPersonalRating
  if (criteria.minImdbRating != null)
    params.minImdbRating = criteria.minImdbRating
  if (criteria.maxImdbRating != null)
    params.maxImdbRating = criteria.maxImdbRating
  if (criteria.startedNotFinished != null)
    params.startedNotFinished = criteria.startedNotFinished
  return params
}

export const seriesApi = {
  getAll: (): Promise<Series[]> =>
    request<{ data: Series[]; count: number }>(() =>
      client.get('/series'),
    ).then((res) => res.data),

  getById: (id: string): Promise<Series> =>
    request<{ data: Series }>(() => client.get('/series/' + id)).then(
      (res) => res.data,
    ),

  create: (data: CreateSeriesRequest): Promise<Series> =>
    request<{ data: Series }>(() => client.post('/series', data)).then(
      (res) => res.data,
    ),

  update: (id: string, data: UpdateSeriesRequest): Promise<Series> =>
    request<{ data: Series }>(() => client.patch('/series/' + id, data)).then(
      (res) => res.data,
    ),

  delete: (id: string): Promise<void> =>
    request<null>(() => client.delete('/series/' + id)).then(() => undefined),

  search: (criteria: SearchCriteria): Promise<Series[]> =>
    request<{ data: Series[]; count: number }>(() =>
      client.get('/series/search', { params: buildSearchParams(criteria) }),
    ).then((res) => res.data),

  searchTmdb: (title: string): Promise<LookupTmdbCandidate[]> =>
    request<{ data: LookupTmdbCandidate[] }>(() =>
      client.get('/series/lookup/search-tmdb', { params: { title } }),
    ).then((res) => res.data),

  resolveTmdbCandidate: (tmdbId: number): Promise<SeriesLookupResult> =>
    request<{ data: SeriesLookupResult }>(() =>
      client.get('/series/lookup/resolve-tmdb', { params: { tmdbId } }),
    ).then((res) => res.data),

  getGenreOptions: (): Promise<string[]> =>
    request<{ data: string[]; count: number }>(() =>
      client.get('/series/genres'),
    ).then((res) => res.data),

  getKeywordStats: (
    sortBy?: 'seriesCount' | 'averagePersonalRating',
  ): Promise<KeywordStat[]> =>
    request<{ data: KeywordStat[]; count: number }>(() =>
      client.get('/series/keywords', {
        params: sortBy !== undefined ? { sortBy } : {},
      }),
    ).then((res) => res.data),

  getRecommendations: (
    query?: RecommendationQuery,
  ): Promise<Recommendation[]> =>
    request<{ data: Recommendation[]; count: number }>(() =>
      client.get('/series/recommendations', {
        params: buildRecommendationParams(query),
      }),
    ).then((res) => res.data),

  refresh: (id: string): Promise<RefreshResult> =>
    request<{ data: RefreshResult }>(() =>
      client.post('/series/' + id + '/refresh'),
    ).then((res) => res.data),

  refreshAll: (): Promise<RefreshJobStatus> =>
    request<{ data: RefreshJobStatus }>(() =>
      client.post('/series/refresh-all'),
    ).then((res) => res.data),

  getRefreshStatus: (): Promise<RefreshJobStatus> =>
    request<{ data: RefreshJobStatus }>(() =>
      client.get('/series/refresh-all/status'),
    ).then((res) => res.data),

  ignoreSeries: (
    imdbId: string,
    title: string,
    reason?: string,
  ): Promise<void> =>
    request<{ data: unknown }>(() =>
      client.post('/series/ignored', {
        imdbId,
        title,
        ...(reason !== undefined ? { reason } : {}),
      }),
    ).then(() => undefined),

  export: async (
    format: 'json' | 'csv',
    filters?: SearchCriteria,
  ): Promise<{ blob: Blob; filename: string }> => {
    try {
      if (import.meta.env.DEV) {
        console.log('[seriesApi] request')
      }
      const response = await client.get('/series/export', {
        responseType: 'blob',
        params: { format, ...buildSearchParams(filters) },
      })
      const blob = response.data as Blob
      const filename =
        parseFilename(response.headers?.['content-disposition']) ??
        `series-export.${format}`
      return { blob, filename }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (import.meta.env.DEV) {
          console.error('[seriesApi] error', err)
        }
        if (!err.response) {
          throw new ApiError(0, 'Network error. Please check your connection.')
        }
        const { status, data } = err.response as {
          status: number
          data: unknown
        }
        // The request uses responseType: 'blob', so axios applies that same
        // responseType to error responses too — a failed export's body
        // arrives as a Blob of JSON text, not the parsed { error, details }
        // object every other seriesApi method's error path assumes.
        const parsed = await parseErrorBlob(data)
        throw new ApiError(
          status,
          parsed?.error ?? 'An error occurred',
          parsed?.details,
        )
      }
      throw err
    }
  },
}

function parseFilename(contentDisposition: string | undefined): string | null {
  if (!contentDisposition) return null
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition)
  return match ? match[1] : null
}

async function parseErrorBlob(
  data: unknown,
): Promise<{ error?: string; details?: Record<string, string> } | null> {
  if (!(data instanceof Blob)) return null
  try {
    const text = await data.text()
    return JSON.parse(text) as {
      error?: string
      details?: Record<string, string>
    }
  } catch {
    return null
  }
}
