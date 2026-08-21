import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { KeywordsView } from './KeywordsView'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

vi.mock('../services/seriesApi')
const mockGetKeywordStats = vi.mocked(seriesApi.getKeywordStats)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-024-AC-08: renders keyword stats table', () => {
  it('renders a row per keyword', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
      { name: 'period drama', seriesCount: 2, averagePersonalRating: null },
    ])
    render(<KeywordsView />)

    expect(await screen.findByText('spy')).toBeInTheDocument()
    expect(screen.getByText('4.2')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('FRONTEND-024-AC-09: sortable column headers re-fetch with sortBy', () => {
  it('re-fetches with sortBy=averagePersonalRating on header click', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenCalledWith(undefined),
    )

    fireEvent.click(
      screen.getByRole('columnheader', { name: /avg\. personal rating/i }),
    )

    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith(
        'averagePersonalRating',
      ),
    )
  })

  it('re-fetches with sortBy=seriesCount on header click', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenCalledWith(undefined),
    )

    fireEvent.click(screen.getByRole('columnheader', { name: /series count/i }))

    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith('seriesCount'),
    )
  })
})

describe('FRONTEND-024-AC-11: loading and error states', () => {
  it('shows a loading state while the fetch is in flight', () => {
    mockGetKeywordStats.mockReturnValue(new Promise(() => {}))
    render(<KeywordsView />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error alert when the fetch rejects', async () => {
    mockGetKeywordStats.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    render(<KeywordsView />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
