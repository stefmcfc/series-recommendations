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
      {
        name: 'spy',
        seriesCount: 4,
        averagePersonalRating: 4.2,
        averageBlendedRating: 7.5,
      },
      {
        name: 'period drama',
        seriesCount: 2,
        averagePersonalRating: null,
        averageBlendedRating: null,
      },
    ])
    render(<KeywordsView />)

    expect(await screen.findByText('spy')).toBeInTheDocument()
    expect(screen.getByText('4.2')).toBeInTheDocument()
    expect(screen.getByText('7.5')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})

describe('FRONTEND-024-AC-09/FRONTEND-086-AC-09: sortable column headers re-fetch with sortBy', () => {
  it('re-fetches with sortBy=averagePersonalRating on header click', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalledWith({}))

    fireEvent.click(
      screen.getByRole('columnheader', { name: /avg\. personal rating/i }),
    )

    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'averagePersonalRating' }),
      ),
    )
  })

  it('re-fetches with sortBy=seriesCount on header click', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalledWith({}))

    fireEvent.click(screen.getByRole('columnheader', { name: /series count/i }))

    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'seriesCount' }),
      ),
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
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('FRONTEND-086-AC-04/05/06: minimum-value filters', () => {
  it('renders three labelled numeric filter inputs and an Apply Filters button', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    expect(screen.getByLabelText(/min series count/i)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/min avg personal rating/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/min avg blended rating/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /apply filters/i }),
    ).toBeInTheDocument()
  })

  it('applies only the filled-in filters on Apply, omitting blank ones', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/min series count/i), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ minSeriesCount: 3 }),
      ),
    )
    expect(mockGetKeywordStats.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      'minAveragePersonalRating',
    )
    expect(mockGetKeywordStats.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      'minAverageBlendedRating',
    )
  })

  it('sends all three filters when filled in, parsed to numbers', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/min series count/i), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByLabelText(/min avg personal rating/i), {
      target: { value: '3.5' },
    })
    fireEvent.change(screen.getByLabelText(/min avg blended rating/i), {
      target: { value: '6' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith({
        minSeriesCount: 2,
        minAveragePersonalRating: 3.5,
        minAverageBlendedRating: 6,
      }),
    )
  })

  it('leaving all three filters blank and clicking Apply behaves like the unfiltered view', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalledWith({}))

    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith({}),
    )
  })
})

describe('FRONTEND-086-AC-07: loading/error states apply identically under filtering', () => {
  it('shows the loading state again while a filtered fetch is in flight', async () => {
    mockGetKeywordStats.mockResolvedValueOnce([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    mockGetKeywordStats.mockReturnValue(new Promise(() => {}))
    fireEvent.change(screen.getByLabelText(/min series count/i), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('shows an error alert when a filtered fetch rejects', async () => {
    mockGetKeywordStats.mockResolvedValueOnce([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    mockGetKeywordStats.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('FRONTEND-086-AC-08/09/10: name/blended-rating columns and direction toggle', () => {
  it('sorts by name on first click, toggles direction on repeated clicks', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('columnheader', { name: /keyword/i }))
    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'name' }),
      ),
    )

    fireEvent.click(screen.getByRole('columnheader', { name: /keyword/i }))
    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'name', sortDirection: 'desc' }),
      ),
    )
    expect(
      screen.getByRole('columnheader', { name: /keyword/i }),
    ).toHaveTextContent('▼')
  })

  it('renders the Avg. Blended Rating column, dash for null', async () => {
    mockGetKeywordStats.mockResolvedValue([
      {
        name: 'spy',
        seriesCount: 2,
        averagePersonalRating: 4.0,
        averageBlendedRating: null,
      },
    ])
    render(<KeywordsView />)

    expect(await screen.findByText('Avg. Blended Rating')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('inactive sortable headers show no direction indicator', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    expect(
      screen.getByRole('columnheader', { name: /series count/i }).textContent,
    ).not.toMatch(/[▲▼]/)
    expect(
      screen.getByRole('columnheader', { name: /avg\. blended rating/i })
        .textContent,
    ).not.toMatch(/[▲▼]/)
  })
})
