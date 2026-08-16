import axios from 'axios'
import type {
  Series,
  CreateSeriesRequest,
  UpdateSeriesRequest,
  SearchCriteria,
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

function buildSearchParams(criteria?: SearchCriteria): Record<string, unknown> {
  if (!criteria) return {}
  const params: Record<string, unknown> = {}
  if (criteria.title != null) params.title = criteria.title
  if (criteria.genres?.length) params.genre = criteria.genres
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
    request<Series>(() => client.get('/series/' + id)),

  create: (data: CreateSeriesRequest): Promise<Series> =>
    request<Series>(() => client.post('/series', data)),

  update: (id: string, data: UpdateSeriesRequest): Promise<Series> =>
    request<Series>(() => client.patch('/series/' + id, data)),

  delete: (id: string): Promise<void> =>
    request<null>(() => client.delete('/series/' + id)).then(() => undefined),

  search: (criteria: SearchCriteria): Promise<Series[]> =>
    request<{ data: Series[]; count: number }>(() =>
      client.get('/series/search', { params: buildSearchParams(criteria) }),
    ).then((res) => res.data),

  export: (format: 'json' | 'csv', filters?: SearchCriteria): Promise<Blob> =>
    request<Blob>(() =>
      client.get('/series/export', {
        responseType: 'blob',
        params: { format, ...buildSearchParams(filters) },
      }),
    ),
}
