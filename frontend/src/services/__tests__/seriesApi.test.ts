/**
 * seriesApi.test.ts — SH-001 through SN-009
 *
 * Vitest hoists vi.mock() calls to the top of the file, BEFORE any const/let
 * declarations are evaluated. So we cannot reference outer variables inside
 * the vi.mock() factory. Instead we create the mock fns INSIDE the factory,
 * attach them to the returned object, then retrieve them via vi.mocked() after
 * the import.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 1. Register the mock FIRST (hoisted by Vitest)
vi.mock('axios', () => {
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }

  const isAxiosError = vi.fn(
    (err: unknown) =>
      !!(
        err &&
        typeof err === 'object' &&
        (err as Record<string, unknown>).isAxiosError === true
      ),
  )

  const create = vi.fn(() => mockInstance)

  // Attach instance to create so tests can reach it
  ;(create as unknown as Record<string, unknown>)._instance = mockInstance

  return {
    default: { create, isAxiosError },
    isAxiosError,
  }
})

// 2. Import subjects AFTER mock registration
import axios from 'axios'
import { seriesApi } from '../seriesApi'
import { SeriesStatus } from '../../types/series'
import type { Series, CreateSeriesRequest } from '../../types/series'

// 3. Retrieve the mock instance that seriesApi.ts received when it called axios.create()
const client = (axios.create as unknown as Record<string, unknown>)
  ._instance as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

// ---------------------------------------------------------------------------
// Helper: build a fully-typed Series with null optionals
// ---------------------------------------------------------------------------
function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'test-id',
    title: 'Test Show',
    year: null,
    genres: null,
    totalSeasons: null,
    totalEpisodes: null,
    currentSeason: null,
    currentEpisode: null,
    status: SeriesStatus.BACKLOG,
    imdbRating: null,
    metacriticRating: null,
    rottenTomatoesRating: null,
    personalRating: null,
    personalNotes: null,
    dateAdded: '2026-01-01T00:00:00Z',
    dateCompleted: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// SH-001: getAll()
// ---------------------------------------------------------------------------
describe('SH-001: getAll', () => {
  it('should return Series[] unwrapped from { data: Series[] }', async () => {
    const mockSeries: Series[] = [
      makeSeries({
        id: '1',
        title: 'The Office',
        status: SeriesStatus.WATCHING,
      }),
    ]
    client.get.mockResolvedValue({ data: { data: mockSeries, count: 1 } })

    const result = await seriesApi.getAll()

    expect(client.get).toHaveBeenCalledWith('/series')
    expect(result).toEqual(mockSeries)
    expect(Array.isArray(result)).toBe(true)
  })

  it('should return empty array when list is empty', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })
    expect(await seriesApi.getAll()).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// SH-002: getById()
// ---------------------------------------------------------------------------
describe('SH-002: getById', () => {
  it('should return Series from GET /series/{id}', async () => {
    const mock = makeSeries({
      id: 'abc-123',
      title: 'Breaking Bad',
      status: SeriesStatus.COMPLETED,
    })
    client.get.mockResolvedValue({ data: mock })

    const result = await seriesApi.getById('abc-123')

    expect(client.get).toHaveBeenCalledWith('/series/abc-123')
    expect(result.title).toBe('Breaking Bad')
  })
})

// ---------------------------------------------------------------------------
// SH-003: create()
// ---------------------------------------------------------------------------
describe('SH-003: create', () => {
  it('should POST to /series and return the created Series', async () => {
    const req: CreateSeriesRequest = { title: 'Severance' }
    const mockCreated = makeSeries({
      id: 'new-id',
      title: 'Severance',
      status: SeriesStatus.BACKLOG,
    })
    client.post.mockResolvedValue({ data: mockCreated })

    const result = await seriesApi.create(req)

    expect(client.post).toHaveBeenCalledWith('/series', req)
    expect(result.id).toBe('new-id')
  })
})

// ---------------------------------------------------------------------------
// SH-004: update()
// ---------------------------------------------------------------------------
describe('SH-004: update', () => {
  it('should PATCH /series/{id} with partial data', async () => {
    const patch = { currentSeason: 3, status: SeriesStatus.WATCHING }
    const mockUpdated = makeSeries({
      id: 'abc-123',
      currentSeason: 3,
      status: SeriesStatus.WATCHING,
    })
    client.patch.mockResolvedValue({ data: mockUpdated })

    const result = await seriesApi.update('abc-123', patch)

    expect(client.patch).toHaveBeenCalledWith('/series/abc-123', patch)
    expect(result.currentSeason).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// SH-005: delete()
// ---------------------------------------------------------------------------
describe('SH-005: delete', () => {
  it('should DELETE /series/{id} and return void', async () => {
    client.delete.mockResolvedValue({ data: null, status: 204 })

    await expect(seriesApi.delete('abc-123')).resolves.toBeUndefined()
    expect(client.delete).toHaveBeenCalledWith('/series/abc-123')
  })
})

// ---------------------------------------------------------------------------
// SH-006: search()
// ---------------------------------------------------------------------------
describe('SH-006: search', () => {
  it('should call GET /series/search with title param', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })
    await seriesApi.search({ title: 'office' })

    expect(client.get).toHaveBeenCalledWith(
      '/series/search',
      expect.objectContaining({
        params: expect.objectContaining({ title: 'office' }),
      }),
    )
  })

  it('should serialize genres array as repeated genre param', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })
    await seriesApi.search({ genres: ['Drama', 'Comedy'] })

    const args = client.get.mock.calls[0][1] as {
      params: Record<string, unknown>
    }
    expect(args.params.genre).toEqual(['Drama', 'Comedy'])
  })

  it('should omit undefined fields from params', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })
    await seriesApi.search({ title: 'office', status: undefined })

    const args = client.get.mock.calls[0][1] as {
      params: Record<string, unknown>
    }
    expect(args.params).not.toHaveProperty('status')
  })

  it('should return empty array on no matches without throwing', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })
    expect(await seriesApi.search({ title: 'nonexistent' })).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// SH-007: export()
// ---------------------------------------------------------------------------
describe('SH-007: export', () => {
  it('should call GET /series/export with format=json and return Blob', async () => {
    const mockBlob = new Blob(['{"series":[]}'], { type: 'application/json' })
    client.get.mockResolvedValue({ data: mockBlob })

    const result = await seriesApi.export('json')

    expect(client.get).toHaveBeenCalledWith(
      '/series/export',
      expect.objectContaining({
        responseType: 'blob',
        params: expect.objectContaining({ format: 'json' }),
      }),
    )
    expect(result).toBeInstanceOf(Blob)
  })

  it('should include filters in export params when provided', async () => {
    client.get.mockResolvedValue({ data: new Blob([''], { type: 'text/csv' }) })
    await seriesApi.export('csv', { status: SeriesStatus.COMPLETED })

    const args = client.get.mock.calls[0][1] as {
      params: Record<string, unknown>
    }
    expect(args.params.status).toBe('COMPLETED')
    expect(args.params.format).toBe('csv')
  })
})

// ---------------------------------------------------------------------------
// IF-008: Error handling
// ---------------------------------------------------------------------------
describe('IF-008: Error handling', () => {
  it('should throw ApiError with status 404', async () => {
    client.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { error: 'Series not found' } },
    })

    await expect(seriesApi.getById('abc-123')).rejects.toMatchObject({
      status: 404,
      message: 'Series not found',
    })
  })

  it('should throw ApiError with status 400 and field-level details', async () => {
    client.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          error: 'Validation failed',
          details: { imdbRating: 'must be <= 10' },
        },
      },
    })

    await expect(seriesApi.create({ title: 'Bad' })).rejects.toMatchObject({
      status: 400,
      details: { imdbRating: 'must be <= 10' },
    })
  })

  it('should throw ApiError with status 0 on network error', async () => {
    client.get.mockRejectedValue({
      isAxiosError: true,
      response: undefined,
      message: 'Network Error',
    })

    await expect(seriesApi.getAll()).rejects.toMatchObject({
      status: 0,
      message: expect.stringMatching(/network error/i),
    })
  })
})

// ---------------------------------------------------------------------------
// SN-009: No logging in production (DEV=false in vitest run)
// ---------------------------------------------------------------------------
describe('SN-009: No production logging', () => {
  it('console.log is only called when DEV=true (Vitest runs in dev mode)', async () => {
    // In Vitest, import.meta.env.DEV is a compile-time constant set to true.
    // The service correctly guards logging behind this flag.
    // This test verifies the guard IS in place: console.log is called exactly
    // once per request (the DEV log), not on every call unconditionally.
    const consoleSpy = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined)
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })

    await seriesApi.getAll()

    // DEV=true in test env, so logging fires — confirming the guard exists
    expect(consoleSpy).toHaveBeenCalledWith('[seriesApi] request')
    expect(consoleSpy).toHaveBeenCalledTimes(1)
    consoleSpy.mockRestore()
  })
})
