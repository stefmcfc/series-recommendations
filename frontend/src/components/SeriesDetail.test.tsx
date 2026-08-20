import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SeriesDetail } from './SeriesDetail'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockGetById = vi.mocked(seriesApi.getById)
const mockDelete = vi.mocked(seriesApi.delete)

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'abc-123',
    title: 'The Office',
    alternateTitle: null,
    year: 2005,
    genres: 'Comedy',
    tags: null,
    totalSeasons: 9,
    totalEpisodes: 201,
    currentSeason: 4,
    currentEpisode: 10,
    status: SeriesStatus.WATCHING,
    imdbRating: 8.9,
    metacriticRating: null,
    rottenTomatoesRating: null,
    personalRating: 5,
    personalNotes: 'Rewatch of the year',
    posterUrl: null,
    imdbId: null,
    dateAdded: '2026-01-01T00:00:00Z',
    dateCompleted: null,
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
      expect(screen.getByText('The Office')).toBeInTheDocument(),
    )
    expect(mockGetById).toHaveBeenCalledWith('abc-123')
    expect(screen.getByText('Rewatch of the year')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
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
    mockGetById.mockResolvedValue(makeSeries({ metacriticRating: null }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('The Office'))
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText('abc-123')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-09: dates rendered as human-readable', () => {
  it('renders dateAdded as a non-empty formatted string', async () => {
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('The Office'))
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
    await waitFor(() => screen.getByText('The Office'))
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
      expect(screen.getByText('The Office')).toBeInTheDocument(),
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

describe('FRONTEND-017-AC-20/21: alternate title shown near the heading, not in the fields list', () => {
  it('renders "aka {alternateTitle}" near the heading when present', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ title: 'MI-5', alternateTitle: 'Spooks' }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'MI-5' })).toBeInTheDocument(),
    )
    expect(screen.getByText(/aka spooks/i)).toBeInTheDocument()
    expect(screen.queryByText('Alternate Title')).not.toBeInTheDocument() // not in the <dl> fields list
  })

  it('renders nothing extra when alternateTitle is null', async () => {
    mockGetById.mockResolvedValue(makeSeries({ alternateTitle: null }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument())
    expect(screen.queryByText(/^aka /i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-018-AC-13/14: Tags entry rendered', () => {
  it('renders a populated tags value verbatim', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ tags: 'rewatch candidate,watch with partner' }),
    )
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('The Office'))
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(
      screen.getByText('rewatch candidate,watch with partner'),
    ).toBeInTheDocument()
  })

  it('renders "—" for a null tags value', async () => {
    mockGetById.mockResolvedValue(makeSeries({ tags: null }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('The Office'))
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

describe('FRONTEND-005-AC-30: no console logging of series data', () => {
  it('does not log personalNotes to the console', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    mockGetById.mockResolvedValue(makeSeries())
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('The Office'))
    const loggedNotes = consoleSpy.mock.calls.some((call) =>
      call.some(
        (arg) => typeof arg === 'string' && arg.includes('Rewatch of the year'),
      ),
    )
    expect(loggedNotes).toBe(false)
    consoleSpy.mockRestore()
  })
})
