import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { GenreStatsView } from './GenreStatsView'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

vi.mock('../services/seriesApi')
const mockGetGenreStats = vi.mocked(seriesApi.getGenreStats)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-088-AC-03: renders genre stats table', () => {
  it('renders a row per genre with all four columns', async () => {
    mockGetGenreStats.mockResolvedValue([
      {
        name: 'Drama',
        seriesCount: 5,
        averagePersonalRating: 4.2,
        averageBlendedRating: 7.8,
      },
    ])
    render(<GenreStatsView />)

    expect(await screen.findByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('4.2')).toBeInTheDocument()
    expect(screen.getByText('7.8')).toBeInTheDocument()
  })

  it('renders a dash for null averages', async () => {
    mockGetGenreStats.mockResolvedValue([
      {
        name: 'Comedy',
        seriesCount: 2,
        averagePersonalRating: null,
        averageBlendedRating: null,
      },
    ])
    render(<GenreStatsView />)

    expect(await screen.findByText('Comedy')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})

describe('FRONTEND-088-AC-03: sortable column headers re-fetch with sortBy', () => {
  it('re-fetches with sortBy=averagePersonalRating on header click', async () => {
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsView />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalledWith({}))

    fireEvent.click(
      screen.getByRole('columnheader', { name: /avg\. personal rating/i }),
    )

    await waitFor(() =>
      expect(mockGetGenreStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'averagePersonalRating' }),
      ),
    )
  })

  it('re-fetches with sortBy=seriesCount on header click', async () => {
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsView />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalledWith({}))

    fireEvent.click(screen.getByRole('columnheader', { name: /series count/i }))

    await waitFor(() =>
      expect(mockGetGenreStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'seriesCount' }),
      ),
    )
  })

  it('sorts by name on first click, toggles direction on repeated clicks', async () => {
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsView />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('columnheader', { name: /genre/i }))
    await waitFor(() =>
      expect(mockGetGenreStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'name' }),
      ),
    )

    fireEvent.click(screen.getByRole('columnheader', { name: /genre/i }))
    await waitFor(() =>
      expect(mockGetGenreStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'name', sortDirection: 'desc' }),
      ),
    )
    expect(
      screen.getByRole('columnheader', { name: /genre/i }),
    ).toHaveTextContent('▼')
  })

  it('inactive sortable headers show no direction indicator', async () => {
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsView />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())

    expect(
      screen.getByRole('columnheader', { name: /series count/i }).textContent,
    ).not.toMatch(/[▲▼]/)
    expect(
      screen.getByRole('columnheader', { name: /avg\. blended rating/i })
        .textContent,
    ).not.toMatch(/[▲▼]/)
  })
})

describe('FRONTEND-088-AC-04: loading and error states', () => {
  it('shows a loading state while the fetch is in flight', () => {
    mockGetGenreStats.mockReturnValue(new Promise(() => {}))
    render(<GenreStatsView />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error alert when the fetch rejects', async () => {
    mockGetGenreStats.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    render(<GenreStatsView />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('FRONTEND-088-AC-03: minimum-value filters', () => {
  it('renders three labelled numeric filter inputs and an Apply Filters button', async () => {
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsView />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())

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
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsView />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/min series count/i), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(mockGetGenreStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ minSeriesCount: 3 }),
      ),
    )
    expect(mockGetGenreStats.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      'minAveragePersonalRating',
    )
    expect(mockGetGenreStats.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      'minAverageBlendedRating',
    )
  })

  it('sends all three filters when filled in, parsed to numbers', async () => {
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsView />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())

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
      expect(mockGetGenreStats).toHaveBeenLastCalledWith({
        minSeriesCount: 2,
        minAveragePersonalRating: 3.5,
        minAverageBlendedRating: 6,
      }),
    )
  })

  it('leaving all three filters blank and clicking Apply behaves like the unfiltered view', async () => {
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsView />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalledWith({}))

    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() => expect(mockGetGenreStats).toHaveBeenLastCalledWith({}))
  })
})

describe('FRONTEND-088-AC-04: loading/error states apply identically under filtering', () => {
  it('shows the loading state again while a filtered fetch is in flight', async () => {
    mockGetGenreStats.mockResolvedValueOnce([])
    render(<GenreStatsView />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())

    mockGetGenreStats.mockReturnValue(new Promise(() => {}))
    fireEvent.change(screen.getByLabelText(/min series count/i), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('shows an error alert when a filtered fetch rejects', async () => {
    mockGetGenreStats.mockResolvedValueOnce([])
    render(<GenreStatsView />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())

    mockGetGenreStats.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
