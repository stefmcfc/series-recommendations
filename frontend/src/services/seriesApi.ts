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
  SortOptions,
  StreamingProvider,
  CandidateDetail,
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

// Both helpers exist once (java/typescript:S3776 -- buildRecommendationParams
// had 17 flat `if`s, one per field) so the field list below is a straight-line
// sequence of calls instead.
function addIfPresent(
  params: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (value != null) params[key] = value
}

function addJoinedIfNonEmpty(
  params: Record<string, unknown>,
  key: string,
  value: string[] | undefined,
): void {
  if (value?.length) params[key] = value.join(',')
}

function buildRecommendationParams(
  query?: RecommendationQuery,
): Record<string, unknown> {
  if (!query) return {}
  const params: Record<string, unknown> = {}
  addIfPresent(params, 'limit', query.limit)
  addJoinedIfNonEmpty(params, 'seriesIds', query.seriesIds)
  addJoinedIfNonEmpty(params, 'genres', query.genres)
  addJoinedIfNonEmpty(params, 'keywords', query.keywords)
  addIfPresent(params, 'minSourceRating', query.minSourceRating)
  addIfPresent(params, 'minTmdbRating', query.minTmdbRating)
  addIfPresent(params, 'minVoteCount', query.minVoteCount)
  addIfPresent(params, 'yearMin', query.yearMin)
  addIfPresent(params, 'yearMax', query.yearMax)
  addJoinedIfNonEmpty(params, 'excludeGenres', query.excludeGenres)
  addJoinedIfNonEmpty(params, 'excludeKeywords', query.excludeKeywords)
  if (query.language != null && query.language !== '')
    params.language = query.language
  addJoinedIfNonEmpty(params, 'countries', query.countries)
  addIfPresent(params, 'maxPerSource', query.maxPerSource)
  addIfPresent(params, 'maxSourcesShown', query.maxSourcesShown)
  addIfPresent(params, 'sortBy', query.sortBy)
  addIfPresent(params, 'sourceMode', query.sourceMode)
  addIfPresent(params, 'trendingWindow', query.trendingWindow)
  addIfPresent(params, 'discoverSortBy', query.discoverSortBy)
  return params
}

// FRONTEND-013-AC-11: sortBy/sortDirection are only added when present, so an
// omitted (or default) sort produces no query params -- consistent with
// backend defaults (series_spec_009_rating_sort.md, SERIES-009-AC-06).
function buildSortParams(sort?: SortOptions): Record<string, unknown> {
  if (!sort) return {}
  const params: Record<string, unknown> = {}
  if (sort.sortBy != null) params.sortBy = sort.sortBy
  if (sort.sortDirection != null) params.sortDirection = sort.sortDirection
  return params
}

function buildSearchParams(criteria?: SearchCriteria): Record<string, unknown> {
  if (!criteria) return {}
  const params: Record<string, unknown> = {}
  if (criteria.title != null) params.title = criteria.title
  if (criteria.genres?.length) params.genre = criteria.genres
  // FRONTEND-063-AC-02/SERIES-042-AC-06: excludeGenre (singular, repeatable),
  // matching the existing genre param's convention.
  if (criteria.excludeGenres?.length)
    params.excludeGenre = criteria.excludeGenres
  if (criteria.keywords?.length) params.keyword = criteria.keywords
  if (criteria.status != null) params.status = criteria.status
  if (criteria.minPersonalRating != null)
    params.minPersonalRating = criteria.minPersonalRating
  if (criteria.minImdbRating != null)
    params.minImdbRating = criteria.minImdbRating
  // FRONTEND-055/SERIES-037: replaces the removed maxPersonalRating/
  // maxImdbRating/startedNotFinished params.
  if (criteria.minTmdbRating != null)
    params.minTmdbRating = criteria.minTmdbRating
  if (criteria.yearMin != null) params.yearMin = criteria.yearMin
  if (criteria.yearMax != null) params.yearMax = criteria.yearMax
  if (criteria.flaggedForRewatch != null)
    params.flaggedForRewatch = criteria.flaggedForRewatch
  return params
}

export const seriesApi = {
  // FRONTEND-013-AC-11: sort is optional -- omitting it (or leaving it
  // undefined) preserves the pre-existing no-params GET /series call exactly,
  // so callers/tests that never pass a sort see no behavior change.
  getAll: (sort?: SortOptions): Promise<Series[]> => {
    const sortParams = buildSortParams(sort)
    return request<{ data: Series[]; count: number }>(() =>
      Object.keys(sortParams).length > 0
        ? client.get('/series', { params: sortParams })
        : client.get('/series'),
    ).then((res) => res.data)
  },

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

  search: (criteria: SearchCriteria, sort?: SortOptions): Promise<Series[]> =>
    request<{ data: Series[]; count: number }>(() =>
      client.get('/series/search', {
        params: { ...buildSearchParams(criteria), ...buildSortParams(sort) },
      }),
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

  getRecommendationKeywords: (tmdbId: number): Promise<string[]> =>
    request<{ data: string[]; count: number }>(() =>
      client.get('/series/recommendations/' + tmdbId + '/keywords'),
    ).then((res) => res.data),

  // FRONTEND-053-AC-04/SERIES-036: single-object envelope (matching
  // getById), not the list-plus-count shape getRecommendationKeywords uses.
  getRecommendationDetails: (
    tmdbId: number,
    imdbId: string,
  ): Promise<CandidateDetail> =>
    request<{ data: CandidateDetail }>(() =>
      client.get('/series/recommendations/' + tmdbId + '/details', {
        params: { imdbId },
      }),
    ).then((res) => res.data),

  getWatchProviders: (id: string): Promise<StreamingProvider[]> =>
    request<{ data: StreamingProvider[]; count: number }>(() =>
      client.get('/series/' + id + '/watch-providers'),
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

  acknowledgeNewContent: (id: string): Promise<Series> =>
    request<{ data: Series }>(() =>
      client.post('/series/' + id + '/acknowledge-new-content'),
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
