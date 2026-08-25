import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SeriesDetail } from './SeriesDetail'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series, StreamingProvider } from '../types/series'

vi.mock('../services/seriesApi')
const mockGetById = vi.mocked(seriesApi.getById)
const mockDelete = vi.mocked(seriesApi.delete)
const mockRefresh = vi.mocked(seriesApi.refresh)
const mockAcknowledgeNewContent = vi.mocked(seriesApi.acknowledgeNewContent)
const mockGetWatchProviders = vi.mocked(seriesApi.getWatchProviders)

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'abc-123',
    title: 'The Office',
    year: 2005,
    genres: 'Comedy',
    tags: null,
    totalSeasons: 9,
    totalEpisodes: 201,
    currentSeason: 4,
    currentEpisode: 10,
    status: SeriesStatus.WATCHING,
    imdbRating: 8.9,
    rottenTomatoesRating: null,
    rottenTomatoesPopcornmeter: null,
    tmdbRating: null,
    tmdbVoteCount: null,
    personalRating: 5,
    personalNotes: 'Rewatch of the year',
    posterUrl: null,
    imdbId: null,
    dateAdded: '2026-01-01T00:00:00Z',
    dateCompleted: null,
    lastRefreshedAt: null,
    newContentDetectedAt: null,
    originCountry: null,
    productionStatus: null,
    keywords: [],
    overview: null,
    excludeFromRecommendations: false,
    flaggedForRewatch: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-005-AC-04/06/07: fetch, loading, render', () => {
  it('shows a loading indicator, then the full record', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      /loading series details/i,
    )
    await waitFor(() =>
      expect(screen.getByText(/^The Office/)).toBeInTheDocument(),
    )
    expect(mockGetById).toHaveBeenCalledWith('abc-123')
    expect(screen.getByText('Rewatch of the year')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})

describe('FRONTEND-037-AC-04: Rotten Tomatoes percentage display', () => {
  it('renders both scores as percentages with clarifying labels', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ rottenTomatoesRating: 96, rottenTomatoesPopcornmeter: 91 }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('96% 🍅')).toBeInTheDocument()
    expect(screen.getByText('91% 🍿')).toBeInTheDocument()
    expect(
      screen.getByText('Rotten Tomatoes Rating (Tomatometer)'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Rotten Tomatoes Rating (Popcornmeter)'),
    ).toBeInTheDocument()
  })

  it('renders a dash for a null Popcornmeter without affecting the Tomatometer value', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({
        rottenTomatoesRating: 96,
        rottenTomatoesPopcornmeter: null,
      }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('96% 🍅')).toBeInTheDocument()
    const popcornmeterLabel = screen.getByText(
      'Rotten Tomatoes Rating (Popcornmeter)',
    )
    expect(popcornmeterLabel.nextElementSibling).toHaveTextContent('—')
  })
})

describe('FRONTEND-005-AC-05: re-fetches on id change', () => {
  it('calls getById again when id prop changes', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    const { rerender } = render(
      <SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />,
    )
    await waitFor(() => expect(mockGetById).toHaveBeenCalledWith('abc-123'))

    mockGetById.mockResolvedValue(makeSeries({ id: 'xyz-789', title: 'Other' }))
    rerender(<SeriesDetail id="xyz-789" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => expect(mockGetById).toHaveBeenCalledWith('xyz-789'))
    expect(mockGetById).toHaveBeenCalledTimes(2)
  })
})

describe('FRONTEND-005-AC-08/10: null fields and no UUID', () => {
  it('shows "—" for null fields and never renders the id', async () => {
    mockGetById.mockResolvedValue(makeSeries({ rottenTomatoesRating: null }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText(/^The Office/))
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText('abc-123')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-09: dates rendered as human-readable', () => {
  it('renders dateAdded as a non-empty formatted string', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText(/^The Office/))
    const expected = new Date('2026-01-01T00:00:00Z').toLocaleDateString()
    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})

describe('FRONTEND-009-AC-18/19/20: poster on the detail view', () => {
  it('renders the poster when present, nothing when absent', async () => {
    mockGetById.mockResolvedValueOnce(
      makeSeries({ posterUrl: 'https://example.com/p.jpg' }),
    )
    const { rerender } = render(
      <SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />,
    )
    await waitFor(() => screen.getByAltText(''))
    expect(screen.getByAltText('')).toHaveAttribute(
      'src',
      'https://example.com/p.jpg',
    )

    mockGetById.mockResolvedValueOnce(makeSeries({ id: '2', posterUrl: null }))
    rerender(<SeriesDetail id="2" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await waitFor(() => screen.getByText(/^The Office/))
    expect(screen.queryByAltText('')).not.toBeInTheDocument()
  })

  it('hides the poster if it fails to load', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ posterUrl: 'https://example.com/p.jpg' }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await waitFor(() => screen.getByAltText(''))

    fireEvent.error(screen.getByAltText(''))
    expect(screen.queryByAltText('')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-11: not-found state', () => {
  it('shows "Series not found." and no Retry on 404', async () => {
    mockGetById.mockRejectedValue(new ApiError(404, 'Series not found'))
    render(
      <SeriesDetail id="missing-id" onBack={vi.fn()} onDeleted={vi.fn()} />,
    )

    await waitFor(() =>
      expect(screen.getByText(/series not found/i)).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('button', { name: /retry/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('back-btn')).toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-12/13: error state', () => {
  it('shows a generic error with Retry on non-404 failure, and retries on click', async () => {
    mockGetById
      .mockRejectedValueOnce(new ApiError(500, 'Internal server error'))
      .mockResolvedValueOnce(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /failed to load series/i,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() =>
      expect(screen.getByText(/^The Office/)).toBeInTheDocument(),
    )
    expect(mockGetById).toHaveBeenCalledTimes(2)
  })
})

describe('FRONTEND-005-AC-14/15: back navigation', () => {
  it('renders the back button in the loading state', () => {
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    expect(screen.getByTestId('back-btn')).toBeInTheDocument()
  })

  it('calls onBack when Back is clicked', async () => {
    const onBack = vi.fn()
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={onBack} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByTestId('back-btn'))
    fireEvent.click(screen.getByTestId('back-btn'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-005-AC-16/17/18: edit wiring', () => {
  it('calls onEditClick with the fetched series', async () => {
    const onEditClick = vi.fn()
    const series = makeSeries()
    mockGetById.mockResolvedValue(series)
    render(
      <SeriesDetail
        id="abc-123"
        onBack={vi.fn()}
        onDeleted={vi.fn()}
        onEditClick={onEditClick}
      />,
    )

    await waitFor(() => screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByTestId('edit-series-btn'))
    expect(onEditClick).toHaveBeenCalledWith(series)
  })

  it('does not throw when Edit is clicked without onEditClick', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await waitFor(() => screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByTestId('edit-series-btn'))
  })
})

describe('FRONTEND-005-AC-19..24: delete flow', () => {
  it('confirms, deletes, and calls onDeleted', async () => {
    const onDeleted = vi.fn()
    mockGetById.mockResolvedValue(makeSeries())
    mockDelete.mockResolvedValue(undefined)
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={onDeleted} />)

    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    expect(mockDelete).toHaveBeenCalledWith('abc-123')
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
  })

  it('cancels without deleting', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('cancel-delete-btn'))

    expect(screen.getByTestId('delete-series-btn')).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('shows an alert and stays confirmable on failure', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    mockDelete.mockRejectedValue(new ApiError(500, 'Internal server error'))
    const onDeleted = vi.fn()
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={onDeleted} />)

    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /internal server error/i,
      ),
    )
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByTestId('confirm-delete-btn')).not.toBeDisabled()
  })

  it('disables Confirm/Cancel and shows "Deleting..." while in flight', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    let resolveDelete: () => void = () => {}
    mockDelete.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve
      }),
    )
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    expect(screen.getByTestId('confirm-delete-btn')).toHaveTextContent(
      /deleting/i,
    )
    expect(screen.getByTestId('confirm-delete-btn')).toBeDisabled()
    expect(screen.getByTestId('cancel-delete-btn')).toBeDisabled()

    resolveDelete()
    await waitFor(() =>
      expect(
        screen.queryByTestId('confirm-delete-btn'),
      ).not.toBeInTheDocument(),
    )
  })
})

describe('FRONTEND-022-AC-09: alternateTitle no longer displayed', () => {
  it('does not render an Alternate Title field', async () => {
    mockGetById.mockResolvedValue(makeSeries({ title: 'Spooks' }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText(/^Spooks/)
    expect(screen.queryByText(/alternate title/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^aka /i)).not.toBeInTheDocument()
  })

  it('does not render a Metacritic Rating field', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await waitFor(() => screen.getByText(/^The Office/))
    expect(screen.queryByText(/metacritic/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-018-AC-13/14: Tags entry rendered', () => {
  it('renders a populated tags value verbatim', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ tags: 'rewatch candidate,watch with partner' }),
    )
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText(/^The Office/))
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(
      screen.getByText('rewatch candidate,watch with partner'),
    ).toBeInTheDocument()
  })

  it('renders "—" for a null tags value', async () => {
    mockGetById.mockResolvedValue(makeSeries({ tags: null }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText(/^The Office/))
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

describe('FRONTEND-023-AC-05/06/07: refresh action', () => {
  it('shows a busy state, then updates data and a summary on success', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ totalSeasons: 5, lastRefreshedAt: null }),
    )
    mockRefresh.mockResolvedValue({
      series: makeSeries({ totalSeasons: 6 }),
      omdbRefreshed: true,
      tmdbRefreshed: false,
    })
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText(/^The Office/)

    fireEvent.click(screen.getByRole('button', { name: /^refresh$/i }))
    expect(screen.getByRole('button', { name: /refreshing/i })).toBeDisabled()

    expect(await screen.findByText('6')).toBeInTheDocument()
    expect(screen.getByText(/ratings updated/i)).toBeInTheDocument()
  })

  it('shows a summary naming production status when only tmdb refreshed', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    mockRefresh.mockResolvedValue({
      series: makeSeries(),
      omdbRefreshed: false,
      tmdbRefreshed: true,
    })
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText(/^The Office/)

    fireEvent.click(screen.getByRole('button', { name: /^refresh$/i }))

    expect(
      await screen.findByText(/production status updated/i),
    ).toBeInTheDocument()
  })

  it('shows a "no new data" summary when neither source refreshed', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    mockRefresh.mockResolvedValue({
      series: makeSeries(),
      omdbRefreshed: false,
      tmdbRefreshed: false,
    })
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText(/^The Office/)

    fireEvent.click(screen.getByRole('button', { name: /^refresh$/i }))

    expect(
      await screen.findByText(/no new data available/i),
    ).toBeInTheDocument()
  })

  it('shows a summary naming ratings and production status when both refreshed', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    mockRefresh.mockResolvedValue({
      series: makeSeries(),
      omdbRefreshed: true,
      tmdbRefreshed: true,
    })
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText(/^The Office/)

    fireEvent.click(screen.getByRole('button', { name: /^refresh$/i }))

    expect(
      await screen.findByText(/ratings and production status updated/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-023-AC-08: refresh failure', () => {
  it('shows an alert and leaves data unchanged', async () => {
    mockGetById.mockResolvedValue(makeSeries({ totalSeasons: 3 }))
    mockRefresh.mockRejectedValue(
      new ApiError(
        502,
        'Unable to reach the series lookup service. Please try again.',
      ),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText(/^The Office/)

    fireEvent.click(screen.getByRole('button', { name: /^refresh$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

describe('FRONTEND-023-AC-09: last refreshed display', () => {
  it('shows relative time when lastRefreshedAt is set', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ lastRefreshedAt: new Date().toISOString() }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    expect(await screen.findByText(/last refreshed/i)).toBeInTheDocument()
  })

  it('shows no last-refreshed text when lastRefreshedAt is null', async () => {
    mockGetById.mockResolvedValue(makeSeries({ lastRefreshedAt: null }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText(/^The Office/)
    expect(screen.queryByText(/last refreshed/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-026-AC-09/10/11: TMDB metadata fields', () => {
  it('displays origin country, production status, and TMDB rating/vote count', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({
        originCountry: 'GB',
        productionStatus: 'ENDED',
        tmdbRating: 7.7,
        tmdbVoteCount: 450,
      }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('| United Kingdom')).toBeInTheDocument()
    expect(screen.getByText('Ended')).toBeInTheDocument()
    expect(screen.getByText('7.7')).toBeInTheDocument()
    expect(screen.getByText('450')).toBeInTheDocument()
  })

  it('shows "—" for each field when null', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({
        originCountry: null,
        productionStatus: null,
        tmdbRating: null,
        tmdbVoteCount: null,
      }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText(/^The Office/)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })
})

describe('FRONTEND-012-AC-06: production status label', () => {
  it('renders a human-readable label for RETURNING_SERIES', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ productionStatus: 'RETURNING_SERIES' }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('Returning Series')).toBeInTheDocument()
  })

  it('renders a dash when null', async () => {
    mockGetById.mockResolvedValue(makeSeries({ productionStatus: null }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText(/^The Office/)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

describe('FRONTEND-012-AC-13/14: rewatch toggle', () => {
  const mockUpdate = vi.mocked(seriesApi.update)

  it('renders only when status is COMPLETED', async () => {
    mockGetById.mockResolvedValue(makeSeries({ status: SeriesStatus.WATCHING }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText(/^The Office/)

    expect(screen.queryByLabelText(/flag for rewatch/i)).not.toBeInTheDocument()
  })

  it('toggles and calls seriesApi.update for a COMPLETED series', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ status: SeriesStatus.COMPLETED, flaggedForRewatch: false }),
    )
    mockUpdate.mockResolvedValue(
      makeSeries({ status: SeriesStatus.COMPLETED, flaggedForRewatch: true }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    const toggle = await screen.findByLabelText(/flag for rewatch/i)

    fireEvent.click(toggle)

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith('1', { flaggedForRewatch: true }),
    )
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('reverts and shows a scoped alert on failure', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ status: SeriesStatus.COMPLETED, flaggedForRewatch: false }),
    )
    mockUpdate.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    const toggle = await screen.findByLabelText(/flag for rewatch/i)

    fireEvent.click(toggle)

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /internal server error/i,
      ),
    )
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('FRONTEND-005-AC-30: no console logging of series data', () => {
  it('does not log personalNotes to the console', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText(/^The Office/))
    const loggedNotes = consoleSpy.mock.calls.some((call) =>
      call.some(
        (arg) => typeof arg === 'string' && arg.includes('Rewatch of the year'),
      ),
    )
    expect(loggedNotes).toBe(false)
    consoleSpy.mockRestore()
  })
})

describe('FRONTEND-005-AC-31: current season/episode hidden when COMPLETED', () => {
  it('does not render Current Season/Current Episode for a COMPLETED series', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ status: SeriesStatus.COMPLETED }),
    )
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText(/^The Office/))
    expect(screen.queryByText('Current Season')).not.toBeInTheDocument()
    expect(screen.queryByText('Current Episode')).not.toBeInTheDocument()
  })

  it('still renders Current Season/Current Episode for a non-COMPLETED series', async () => {
    mockGetById.mockResolvedValue(makeSeries({ status: SeriesStatus.WATCHING }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText(/^The Office/))
    expect(screen.getByText('Current Season')).toBeInTheDocument()
    expect(screen.getByText('Current Episode')).toBeInTheDocument()
  })
})

describe('FRONTEND-024-AC-06/07: Keywords entry rendered', () => {
  it('renders each keyword as a chip', async () => {
    mockGetById.mockResolvedValue(makeSeries({ keywords: ['spy', 'mi5'] }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('Keywords')).toBeInTheDocument()
    expect(screen.getByText('spy')).toBeInTheDocument()
    expect(screen.getByText('mi5')).toBeInTheDocument()
  })

  it('renders a dash when there are no keywords', async () => {
    mockGetById.mockResolvedValue(makeSeries({ keywords: [] }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText('Keywords')
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

describe('FRONTEND-024-AC-18: keywords field renders as its own full-width row', () => {
  it('renders Keywords alone in its field row, not alongside other fields', async () => {
    mockGetById.mockResolvedValue(makeSeries({ keywords: ['spy'] }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    const dt = await screen.findByText('Keywords')
    const field = dt.parentElement
    expect(field?.className).toContain('field')
    const row = field?.parentElement
    expect(row?.children).toHaveLength(1)
  })
})

describe('FRONTEND-028-AC-14: overview field', () => {
  it('displays the series overview', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ overview: 'A mockumentary sitcom.' }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(
      await screen.findByText('A mockumentary sitcom.'),
    ).toBeInTheDocument()
  })

  it('shows "—" when overview is null', async () => {
    mockGetById.mockResolvedValue(makeSeries({ overview: null }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText(/^The Office/)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })
})

describe('FRONTEND-023-AC-19/20: new-content badge and dismiss', () => {
  it('shows no badge/dismiss button when newContentDetectedAt is null', async () => {
    mockGetById.mockResolvedValue(makeSeries({ newContentDetectedAt: null }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText(/^The Office/)
    expect(
      screen.queryByTestId('dismiss-new-content-btn'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/new content/i)).not.toBeInTheDocument()
  })

  it('shows a badge and clears it on successful dismiss', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ newContentDetectedAt: new Date().toISOString() }),
    )
    mockAcknowledgeNewContent.mockResolvedValue(
      makeSeries({ newContentDetectedAt: null }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByTestId('dismiss-new-content-btn')
    expect(screen.getByText(/new content/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('dismiss-new-content-btn'))

    await waitFor(() =>
      expect(
        screen.queryByTestId('dismiss-new-content-btn'),
      ).not.toBeInTheDocument(),
    )
    expect(mockAcknowledgeNewContent).toHaveBeenCalledWith('1')
    expect(screen.queryByText(/new content/i)).not.toBeInTheDocument()
  })

  it('keeps the badge and shows an alert if dismiss fails', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ newContentDetectedAt: new Date().toISOString() }),
    )
    mockAcknowledgeNewContent.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByTestId('dismiss-new-content-btn')
    fireEvent.click(screen.getByTestId('dismiss-new-content-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /internal server error/i,
      ),
    )
    expect(screen.getByTestId('dismiss-new-content-btn')).toBeInTheDocument()
    expect(screen.getByText(/new content/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-012 amendment (live review): year/country in heading', () => {
  it('renders year in the heading text, not as a separate field', async () => {
    mockGetById.mockResolvedValue(makeSeries({ year: 2005 }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('The Office (2005)')).toBeInTheDocument()
    expect(screen.queryByText('Year')).not.toBeInTheDocument()
  })

  it('renders the heading without a year suffix when year is null', async () => {
    mockGetById.mockResolvedValue(makeSeries({ year: null }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() =>
      expect(screen.getByText(/^The Office/)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/The Office \(/)).not.toBeInTheDocument()
  })

  it('renders origin country next to the heading, not as a separate field', async () => {
    mockGetById.mockResolvedValue(makeSeries({ originCountry: 'GB' }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('| United Kingdom')).toBeInTheDocument()
    expect(screen.queryByText('Origin Country')).not.toBeInTheDocument()
  })

  it('renders no country span when origin country is null', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ originCountry: null, year: null }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText(/^The Office/)
    expect(screen.queryByText(/^\| /)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-012 amendment (live review): full-width Overview field', () => {
  it('renders Overview alone in its field row, not alongside other fields', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ overview: 'A mockumentary sitcom.' }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    const dt = await screen.findByText('Overview')
    const field = dt.parentElement
    expect(field?.className).toContain('field')
    const row = field?.parentElement
    expect(row?.children).toHaveLength(1)
  })

  it('renders Overview as the first field row in the grid', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ overview: 'A mockumentary sitcom.' }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    const dt = await screen.findByText('Overview')
    const fieldsList = dt.closest('dl')
    const firstRow = fieldsList?.firstElementChild
    const overviewRow = dt.parentElement?.parentElement
    expect(firstRow).toBe(overviewRow)
  })
})

describe('FRONTEND-036-AC-04: streaming check button, busy state', () => {
  it('renders between Overview and Keywords, shows a busy state while in flight', async () => {
    mockGetById.mockResolvedValue(makeSeries({ overview: 'A show.' }))
    let resolveCheck: (v: StreamingProvider[]) => void = () => {}
    mockGetWatchProviders.mockReturnValue(
      new Promise((resolve) => {
        resolveCheck = resolve
      }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText('A show.')

    const button = screen.getByRole('button', {
      name: /check streaming availability/i,
    })
    fireEvent.click(button)

    expect(button).toBeDisabled()
    expect(screen.getByText(/checking/i)).toBeInTheDocument()

    resolveCheck([])
    await waitFor(() => expect(button).not.toBeDisabled())
  })
})

describe('FRONTEND-036-AC-05: successful check renders the result', () => {
  it('shows providers via the shared StreamingProviders component', async () => {
    mockGetById.mockResolvedValue(makeSeries({ overview: 'A show.' }))
    mockGetWatchProviders.mockResolvedValue([
      { name: 'Netflix', logoUrl: null },
    ])
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText('A show.')

    fireEvent.click(
      screen.getByRole('button', { name: /check streaming availability/i }),
    )

    expect(await screen.findByText('Netflix')).toBeInTheDocument()
  })

  it('shows the not-streaming note when the result is empty', async () => {
    mockGetById.mockResolvedValue(makeSeries({ overview: 'A show.' }))
    mockGetWatchProviders.mockResolvedValue([])
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText('A show.')

    fireEvent.click(
      screen.getByRole('button', { name: /check streaming availability/i }),
    )

    expect(
      await screen.findByText('Not currently streaming in the UK'),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-036-AC-06: check failure', () => {
  it('shows a scoped alert and clears any previous result', async () => {
    mockGetById.mockResolvedValue(makeSeries({ overview: 'A show.' }))
    mockGetWatchProviders
      .mockResolvedValueOnce([{ name: 'Netflix', logoUrl: null }])
      .mockRejectedValueOnce(
        new ApiError(
          502,
          'Unable to reach the streaming lookup service. Please try again.',
        ),
      )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText('A show.')
    const button = screen.getByRole('button', {
      name: /check streaming availability/i,
    })

    fireEvent.click(button)
    expect(await screen.findByText('Netflix')).toBeInTheDocument()

    fireEvent.click(button)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByText('Netflix')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-036-AC-07: resets on navigating to a different series', () => {
  it('clears a prior result when id changes', async () => {
    mockGetById.mockResolvedValue(makeSeries({ id: '1', overview: 'A show.' }))
    mockGetWatchProviders.mockResolvedValue([
      { name: 'Netflix', logoUrl: null },
    ])
    const { rerender } = render(
      <SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />,
    )
    await screen.findByText('A show.')
    fireEvent.click(
      screen.getByRole('button', { name: /check streaming availability/i }),
    )
    expect(await screen.findByText('Netflix')).toBeInTheDocument()

    mockGetById.mockResolvedValue(
      makeSeries({ id: '2', overview: 'Another show.' }),
    )
    rerender(<SeriesDetail id="2" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText('Another show.')
    expect(screen.queryByText('Netflix')).not.toBeInTheDocument()
  })
})
