import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SeriesList } from './SeriesList'
import { seriesApi } from '../services/seriesApi'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)

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

describe('SH-001: Fetch on mount', () => {
  it('should call seriesApi.getAll() once on mount', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1))
  })
})

describe('SH-002: Loading state', () => {
  it('should show loading indicator while fetch is in flight', () => {
    mockGetAll.mockReturnValue(new Promise(() => undefined))
    render(<SeriesList />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/loading series/i)).toBeInTheDocument()
  })

  it('should hide loading indicator after fetch completes', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument(),
    )
  })
})

describe('SH-003: Render series data', () => {
  it('should render title and status for each series', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({
        id: '1',
        title: 'The Office',
        status: SeriesStatus.WATCHING,
      }),
      makeSeries({
        id: '2',
        title: 'Breaking Bad',
        status: SeriesStatus.COMPLETED,
      }),
    ])
    render(<SeriesList />)
    await waitFor(() => {
      expect(screen.getByText('The Office')).toBeInTheDocument()
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument()
      expect(screen.getByText('WATCHING')).toBeInTheDocument()
      expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    })
  })

  it('should render IMDb rating when present', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ title: 'Show', imdbRating: 8.4 }),
    ])
    render(<SeriesList />)
    await waitFor(() => expect(screen.getByText('8.4')).toBeInTheDocument())
  })

  it('should display "—" when imdbRating is null', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ title: 'Show', imdbRating: null }),
    ])
    render(<SeriesList />)
    await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument())
  })

  it('should render one series-row per series', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Show 1' }),
      makeSeries({ id: '2', title: 'Show 2' }),
    ])
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.getAllByTestId('series-row')).toHaveLength(2),
    )
  })
})

describe('IF-004: Empty state', () => {
  it('should show "No series yet." when list is empty', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.getByText(/no series yet/i)).toBeInTheDocument(),
    )
  })

  it('should show "Add your first series" button in empty state', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.getByText(/add your first series/i)).toBeInTheDocument(),
    )
  })

  it('should not render any series rows in empty state', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.queryAllByTestId('series-row')).toHaveLength(0),
    )
  })
})

describe('IF-005: Error state', () => {
  it('should show error message when fetch fails', async () => {
    mockGetAll.mockRejectedValue(new Error('Network error'))
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.getByText(/failed to load series/i)).toBeInTheDocument(),
    )
  })

  it('should show Retry button in error state', async () => {
    mockGetAll.mockRejectedValue(new Error('Network error'))
    render(<SeriesList />)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /retry/i }),
      ).toBeInTheDocument(),
    )
  })

  it('should re-fetch when Retry is clicked', async () => {
    mockGetAll
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue([makeSeries({ title: 'Loaded on retry' })])

    render(<SeriesList />)

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /retry/i }),
      ).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() =>
      expect(screen.getByText('Loaded on retry')).toBeInTheDocument(),
    )
    expect(mockGetAll).toHaveBeenCalledTimes(2)
  })

  it('should show error state again if retry also fails', async () => {
    mockGetAll.mockRejectedValue(new Error('Still broken'))
    render(<SeriesList />)

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /retry/i }),
      ).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() =>
      expect(screen.getByText(/failed to load series/i)).toBeInTheDocument(),
    )
    expect(mockGetAll).toHaveBeenCalledTimes(2)
  })

  it('error container should have role="alert"', async () => {
    mockGetAll.mockRejectedValue(new Error('Network error'))
    render(<SeriesList />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})

describe('SH-006: Add Series button', () => {
  it('should show Add Series button when list is populated', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)
    await waitFor(() =>
      expect(screen.getByTestId('add-series-btn')).toBeInTheDocument(),
    )
  })
})

describe('SH-007: Series row click', () => {
  it('should call onSeriesClick with series id when row is clicked', async () => {
    const onSeriesClick = vi.fn()
    mockGetAll.mockResolvedValue([
      makeSeries({ id: 'abc-123', title: 'Clickable Show' }),
    ])
    render(<SeriesList onSeriesClick={onSeriesClick} />)

    await waitFor(() =>
      expect(screen.getByTestId('series-row')).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByTestId('series-row'))
    expect(onSeriesClick).toHaveBeenCalledWith('abc-123')
  })

  it('should not throw if onSeriesClick is not provided', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)

    await waitFor(() =>
      expect(screen.getByTestId('series-row')).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByTestId('series-row'))
  })
})

describe('SN-008: No sensitive data exposed', () => {
  it('should not render the series UUID as visible text', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: 'secret-uuid-123', title: 'Show' }),
    ])
    render(<SeriesList />)
    await waitFor(() => screen.getByText('Show'))
    expect(screen.queryByText('secret-uuid-123')).not.toBeInTheDocument()
  })

  it('should not render personalNotes in the list view', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ title: 'Show', personalNotes: 'My private note' }),
    ])
    render(<SeriesList />)
    await waitFor(() => screen.getByText('Show'))
    expect(screen.queryByText('My private note')).not.toBeInTheDocument()
  })
})
