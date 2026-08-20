import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RecommendationsList } from './RecommendationsList'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Recommendation, Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockGetRecommendations = vi.mocked(seriesApi.getRecommendations)
const mockIgnoreSeries = vi.mocked(seriesApi.ignoreSeries)
const mockCreate = vi.mocked(seriesApi.create)

function makeRecommendation(
  overrides: Partial<Recommendation> = {},
): Recommendation {
  return {
    title: 'Ozark',
    year: 2017,
    genres: 'Crime, Drama',
    overview: 'A financial planner relocates his family.',
    posterUrl: null,
    tmdbRating: 8.4,
    imdbId: 'tt5071412',
    sourceTitle: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-010-AC-05/06: fetch on mount, loading state', () => {
  it('calls seriesApi.getRecommendations() once on mount', async () => {
    mockGetRecommendations.mockResolvedValue([])
    render(<RecommendationsList />)
    await waitFor(() => expect(mockGetRecommendations).toHaveBeenCalledTimes(1))
  })

  it('shows a loading indicator while the fetch is in flight', () => {
    mockGetRecommendations.mockReturnValue(new Promise(() => undefined))
    render(<RecommendationsList />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('FRONTEND-010-AC-08/09/10: display, empty state', () => {
  it('renders a card per recommendation, with sourceTitle when present', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ sourceTitle: 'Breaking Bad' }),
    ])
    render(<RecommendationsList />)

    expect(await screen.findByText('Ozark')).toBeInTheDocument()
    expect(
      screen.getByText(/because you watched breaking bad/i),
    ).toBeInTheDocument()
    expect(screen.getByText('2017')).toBeInTheDocument()
    expect(screen.getByText('Crime, Drama')).toBeInTheDocument()
    expect(
      screen.getByText('A financial planner relocates his family.'),
    ).toBeInTheDocument()
  })

  it('does not render "Because you watched" when sourceTitle is null', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ sourceTitle: null }),
    ])
    render(<RecommendationsList />)

    await screen.findByText('Ozark')
    expect(screen.queryByText(/because you watched/i)).not.toBeInTheDocument()
  })

  it('shows an empty-state message when there are no results', async () => {
    mockGetRecommendations.mockResolvedValue([])
    render(<RecommendationsList />)

    expect(
      await screen.findByText(/no recommendations yet/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-010-AC-07: error and retry', () => {
  it('shows an alert with Retry on fetch failure, and retry re-fetches', async () => {
    mockGetRecommendations.mockRejectedValueOnce(
      new ApiError(
        502,
        'Unable to reach the series lookup service. Please try again.',
      ),
    )
    mockGetRecommendations.mockResolvedValueOnce([])
    render(<RecommendationsList />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => expect(mockGetRecommendations).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
  })
})

describe('FRONTEND-010-AC-12/13/14: mark as watched / add to list', () => {
  it('opens AddSeriesForm pre-filled with COMPLETED status on Mark as Watched, removes the card on save', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    mockCreate.mockResolvedValue({ id: '1', title: 'Ozark' } as Series)
    render(<RecommendationsList />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /mark as watched/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText(/^title/i)).toHaveValue('Ozark')
    expect(within(dialog).getByLabelText(/^status/i)).toHaveValue(
      SeriesStatus.COMPLETED,
    )

    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0][0]
    expect(payload.imdbId).toBe('tt5071412')
    expect(payload.status).toBe(SeriesStatus.COMPLETED)

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(screen.queryByText('Ozark')).not.toBeInTheDocument()
  })

  it('opens AddSeriesForm pre-filled with BACKLOG status on Add to List', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    render(<RecommendationsList />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /add to list/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText(/^title/i)).toHaveValue('Ozark')
    expect(within(dialog).getByLabelText(/^status/i)).toHaveValue(
      SeriesStatus.BACKLOG,
    )
  })

  it('closes the form without removing the card on cancel', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    render(<RecommendationsList />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /mark as watched/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Ozark')).toBeInTheDocument()
  })
})

describe('FRONTEND-010-AC-15/16/17: ignore', () => {
  it('calls ignoreSeries and removes the card immediately on success', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    mockIgnoreSeries.mockResolvedValue(undefined)
    render(<RecommendationsList />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByTestId('ignore-btn'))

    await waitFor(() =>
      expect(mockIgnoreSeries).toHaveBeenCalledWith('tt5071412', 'Ozark'),
    )
    await waitFor(() =>
      expect(screen.queryByText('Ozark')).not.toBeInTheDocument(),
    )
  })

  it('keeps the card and shows a scoped alert if ignore fails', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    mockIgnoreSeries.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    render(<RecommendationsList />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByTestId('ignore-btn'))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Ozark')).toBeInTheDocument()
  })

  it('does not show a page-level error when ignore fails', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation(),
      makeRecommendation({ imdbId: 'tt0944947', title: 'Game of Thrones' }),
    ])
    mockIgnoreSeries.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    render(<RecommendationsList />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getAllByTestId('ignore-btn')[0])

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Game of Thrones')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})

describe('FRONTEND-011-AC-11: re-fetches when query prop changes', () => {
  it('calls getRecommendations again with the new query', async () => {
    mockGetRecommendations.mockResolvedValue([])
    const { rerender } = render(
      <RecommendationsList query={{ genres: ['Drama'] }} />,
    )
    await waitFor(() =>
      expect(mockGetRecommendations).toHaveBeenCalledWith({
        genres: ['Drama'],
      }),
    )

    rerender(<RecommendationsList query={{ genres: ['Comedy'] }} />)
    await waitFor(() =>
      expect(mockGetRecommendations).toHaveBeenLastCalledWith({
        genres: ['Comedy'],
      }),
    )
  })
})

describe('FRONTEND-010-AC-20: TMDB attribution', () => {
  it('shows the attribution notice regardless of view state', async () => {
    mockGetRecommendations.mockResolvedValue([])
    render(<RecommendationsList />)

    expect(
      screen.getByText(
        /this product uses the tmdb api but is not endorsed or certified by tmdb/i,
      ),
    ).toBeInTheDocument()

    await waitFor(() =>
      expect(screen.getByText(/no recommendations yet/i)).toBeInTheDocument(),
    )
    expect(
      screen.getByText(
        /this product uses the tmdb api but is not endorsed or certified by tmdb/i,
      ),
    ).toBeInTheDocument()
  })
})
