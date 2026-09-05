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
  ImportJobStatus,
  KeywordStat,
  KeywordStatsOptions,
  GenreStat,
  GenreStatsOptions,
  CountryStat,
  CountryStatsOptions,
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

// FRONTEND-086-AC-03: only options actually provided (non-undefined) are
// included -- an empty/undefined options object sends no params at all,
// unchanged from the pre-086 no-argument call shape.
function buildKeywordStatsParams(
  options?: KeywordStatsOptions,
): Record<string, unknown> {
  if (!options) return {}
  const params: Record<string, unknown> = {}
  addIfPresent(params, 'sortBy', options.sortBy)
  addIfPresent(params, 'sortDirection', options.sortDirection)
  addIfPresent(params, 'minSeriesCount', options.minSeriesCount)
  addIfPresent(
    params,
    'minAveragePersonalRating',
    options.minAveragePersonalRating,
  )
  addIfPresent(
    params,
    'minAverageBlendedRating',
    options.minAverageBlendedRating,
  )
  // FRONTEND-095-AC-03: onlyCompleted is sent only when explicitly true --
  // addIfPresent's `!= null` check would let `false` through as
  // `onlyCompleted=false`, which the backend contract treats as distinct
  // from simply omitting it (series_spec_051), so this is checked directly.
  if (options.onlyCompleted === true) params.onlyCompleted = true
  return params
}

// FRONTEND-088-AC-02: mirrors buildKeywordStatsParams exactly -- genre stats
// share the same options shape (series_spec_048).
function buildGenreStatsParams(
  options?: GenreStatsOptions,
): Record<string, unknown> {
  if (!options) return {}
  const params: Record<string, unknown> = {}
  addIfPresent(params, 'sortBy', options.sortBy)
  addIfPresent(params, 'sortDirection', options.sortDirection)
  addIfPresent(params, 'minSeriesCount', options.minSeriesCount)
  addIfPresent(
    params,
    'minAveragePersonalRating',
    options.minAveragePersonalRating,
  )
  addIfPresent(
    params,
    'minAverageBlendedRating',
    options.minAverageBlendedRating,
  )
  // FRONTEND-095-AC-03: mirrors buildKeywordStatsParams's onlyCompleted
  // handling exactly.
  if (options.onlyCompleted === true) params.onlyCompleted = true
  return params
}

// FRONTEND-089-AC-02: mirrors buildKeywordStatsParams/buildGenreStatsParams
// exactly -- country stats share the same options shape (series_spec_049).
function buildCountryStatsParams(
  options?: CountryStatsOptions,
): Record<string, unknown> {
  if (!options) return {}
  const params: Record<string, unknown> = {}
  addIfPresent(params, 'sortBy', options.sortBy)
  addIfPresent(params, 'sortDirection', options.sortDirection)
  addIfPresent(params, 'minSeriesCount', options.minSeriesCount)
  addIfPresent(
    params,
    'minAveragePersonalRating',
    options.minAveragePersonalRating,
  )
  addIfPresent(
    params,
    'minAverageBlendedRating',
    options.minAverageBlendedRating,
  )
  if (options.onlyCompleted === true) params.onlyCompleted = true
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

  // FRONTEND-086-AC-02/03: options object (sortBy/sortDirection plus three
  // min-value filters), replacing the single positional sortBy argument --
  // KeywordsView is the only call site, so this is a contained signature
  // change (series_spec_047).
  getKeywordStats: (options?: KeywordStatsOptions): Promise<KeywordStat[]> =>
    request<{ data: KeywordStat[]; count: number }>(() =>
      client.get('/series/keywords', {
        params: buildKeywordStatsParams(options),
      }),
    ).then((res) => res.data),

  // FRONTEND-088-AC-02: mirrors getKeywordStats's options-object signature
  // exactly, pointed at the new genre-stats endpoint (series_spec_048).
  getGenreStats: (options?: GenreStatsOptions): Promise<GenreStat[]> =>
    request<{ data: GenreStat[]; count: number }>(() =>
      client.get('/series/genres/stats', {
        params: buildGenreStatsParams(options),
      }),
    ).then((res) => res.data),

  // FRONTEND-089-AC-02: mirrors getKeywordStats/getGenreStats's
  // options-object signature exactly, pointed at the new
  // origin-country-stats endpoint (series_spec_049).
  getCountryStats: (options?: CountryStatsOptions): Promise<CountryStat[]> =>
    request<{ data: CountryStat[]; count: number }>(() =>
      client.get('/series/origin-country/stats', {
        params: buildCountryStatsParams(options),
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

  // FRONTEND-057/SERIES-038-AC-01: multipart POST, matching the backend's
  // @RequestParam("file") field name -- the only multipart upload in this
  // client, so there's no prior sibling pattern to mirror beyond FormData +
  // the existing axios instance.
  importSeries: (file: File): Promise<ImportJobStatus> => {
    const formData = new FormData()
    formData.append('file', file)
    return request<{ data: ImportJobStatus }>(() =>
      client.post('/series/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    ).then((res) => res.data)
  },

  getImportStatus: (): Promise<ImportJobStatus> =>
    request<{ data: ImportJobStatus }>(() =>
      client.get('/series/import/status'),
    ).then((res) => res.data),

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
