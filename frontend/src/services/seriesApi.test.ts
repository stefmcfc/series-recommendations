import { vi, describe, it, expect } from 'vitest'

// FRONTEND-133-AC-03: this is a narrow, deliberate exception to this repo's
// "mock seriesApi, not axios" convention -- that convention exists for
// *component* tests, which have seriesApi as a genuine dependency to stub
// out. Here seriesApi.ts is itself the module under test, so mocking it
// would be circular; axios (the one real dependency below it) is the only
// thing left to mock.
const mockGet = vi.fn().mockResolvedValue({ data: { data: [], count: 0 } })

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    })),
    isAxiosError: vi.fn(() => false),
  },
}))

const { seriesApi } = await import('./seriesApi')

// FRONTEND-133-AC-03: confirms (rather than implements) that
// seriesApi.getKeywordStats already forwards sortBy/sortDirection/
// minSeriesCount as query params on GET /series/keywords -- true since
// series_spec_047/FRONTEND-086, well before this spec. No seriesApi.ts
// change was needed for this AC; this test is a regression guard for the
// contract FRONTEND-133-AC-04 depends on.
describe('FRONTEND-133-AC-03: getKeywordStats already forwards sort/floor options', () => {
  it('sends sortBy, sortDirection, and minSeriesCount when provided', async () => {
    await seriesApi.getKeywordStats({
      sortBy: 'averageBlendedRating',
      sortDirection: 'desc',
      minSeriesCount: 3,
    })

    expect(mockGet).toHaveBeenCalledWith(
      '/series/keywords',
      expect.objectContaining({
        params: expect.objectContaining({
          sortBy: 'averageBlendedRating',
          sortDirection: 'desc',
          minSeriesCount: 3,
        }),
      }),
    )
  })
})
