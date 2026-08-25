import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SeriesList } from './SeriesList'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)
const mockDelete = vi.mocked(seriesApi.delete)
const mockSearch = vi.mocked(seriesApi.search)
const mockRefreshAll = vi.mocked(seriesApi.refreshAll)
const mockGetRefreshStatus = vi.mocked(seriesApi.getRefreshStatus)

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'test-id',
    title: 'Test Show',
    year: null,
    genres: null,
    tags: null,
    totalSeasons: null,
    totalEpisodes: null,
    currentSeason: null,
    currentEpisode: null,
    status: SeriesStatus.BACKLOG,
    imdbRating: null,
    rottenTomatoesRating: null,
    rottenTomatoesPopcornmeter: null,
    tmdbRating: null,
    tmdbVoteCount: null,
    personalRating: null,
    personalNotes: null,
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
  mockGetRefreshStatus.mockResolvedValue({
    status: 'IDLE',
    totalCount: 0,
    completedCount: 0,
    skippedCount: 0,
    startedAt: null,
    finishedAt: null,
  })
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

describe('FRONTEND-009-AC-21/22: row thumbnail', () => {
  it('renders a placeholder slot when posterUrl is null, an image when present', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'No Poster', posterUrl: null }),
      makeSeries({
        id: '2',
        title: 'Has Poster',
        posterUrl: 'https://example.com/p.jpg',
      }),
    ])
    render(<SeriesList />)
    await waitFor(() => screen.getByText('No Poster'))

    expect(screen.getAllByTestId('series-thumbnail')).toHaveLength(2)
    expect(screen.getByAltText('')).toHaveAttribute(
      'src',
      'https://example.com/p.jpg',
    )
  })

  it('falls back to the placeholder if the poster image fails to load', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({
        id: '1',
        title: 'Has Poster',
        posterUrl: 'https://example.com/p.jpg',
      }),
    ])
    render(<SeriesList />)
    await waitFor(() => screen.getByText('Has Poster'))

    const img = screen.getByAltText('')
    fireEvent.error(img)
    expect(screen.queryByAltText('')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('series-thumbnail')).toHaveLength(1)
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
  it('should call onSeriesClick with series id when the title is clicked', async () => {
    const onSeriesClick = vi.fn()
    mockGetAll.mockResolvedValue([
      makeSeries({ id: 'abc-123', title: 'Clickable Show' }),
    ])
    render(<SeriesList onSeriesClick={onSeriesClick} />)

    const titleButton = await screen.findByRole('button', {
      name: 'Clickable Show',
    })

    fireEvent.click(titleButton)
    expect(onSeriesClick).toHaveBeenCalledWith('abc-123')
  })

  it('should not throw if onSeriesClick is not provided', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)

    const titleButton = await screen.findByRole('button', { name: 'Show' })
    fireEvent.click(titleButton)
  })
})

describe('FRONTEND-008-AC-02: row is not itself interactive', () => {
  it('the row <li> has no role or tabIndex', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)
    const row = await screen.findByTestId('series-row')
    expect(row).not.toHaveAttribute('role')
    expect(row).not.toHaveAttribute('tabindex')
  })
})

describe('FRONTEND-003-AC-01/02/03: onAddClick wiring', () => {
  it('calls onAddClick when the header Add Series button is clicked', async () => {
    const onAddClick = vi.fn()
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList onAddClick={onAddClick} />)
    await waitFor(() => screen.getByText('Show'))
    fireEvent.click(screen.getByTestId('add-series-btn'))
    expect(onAddClick).toHaveBeenCalledTimes(1)
  })

  it('calls onAddClick when the empty-state Add button is clicked', async () => {
    const onAddClick = vi.fn()
    mockGetAll.mockResolvedValue([])
    render(<SeriesList onAddClick={onAddClick} />)
    const emptyStateButton = await screen.findByText(/add your first series/i)
    fireEvent.click(emptyStateButton)
    expect(onAddClick).toHaveBeenCalledTimes(1)
  })

  it('does not throw when clicked without onAddClick', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    const emptyStateButton = await screen.findByText(/add your first series/i)
    fireEvent.click(emptyStateButton)
  })
})

describe('FRONTEND-004-AC-01/02/03/04: edit button wiring', () => {
  it('renders labelled Edit and Delete buttons per row', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'The Office' })])
    render(<SeriesList />)
    await waitFor(() => screen.getByText('The Office'))
    expect(
      screen.getByRole('button', { name: /edit the office/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /delete the office/i }),
    ).toBeInTheDocument()
  })

  it('calls onEditClick with the full series and not onSeriesClick', async () => {
    const onEditClick = vi.fn()
    const onSeriesClick = vi.fn()
    const series = makeSeries({ id: '1', title: 'The Office' })
    mockGetAll.mockResolvedValue([series])
    render(
      <SeriesList onEditClick={onEditClick} onSeriesClick={onSeriesClick} />,
    )
    await waitFor(() => screen.getByText('The Office'))

    fireEvent.click(screen.getByTestId('edit-series-btn'))
    expect(onEditClick).toHaveBeenCalledWith(series)
    expect(onSeriesClick).not.toHaveBeenCalled()
  })

  it('does not throw when Edit is clicked without onEditClick', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByTestId('edit-series-btn'))
  })

  it('does not call onSeriesClick, onEditClick, or seriesApi.delete when Delete is clicked', async () => {
    const onSeriesClick = vi.fn()
    const onEditClick = vi.fn()
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(
      <SeriesList onSeriesClick={onSeriesClick} onEditClick={onEditClick} />,
    )
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    expect(onSeriesClick).not.toHaveBeenCalled()
    expect(onEditClick).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-004-AC-06/07/08/09: delete confirmation', () => {
  it('shows Confirm/Cancel in place of Edit/Delete when Delete is clicked', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))

    fireEvent.click(screen.getByTestId('delete-series-btn'))
    expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument()
    expect(screen.getByTestId('cancel-delete-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('delete-series-btn')).not.toBeInTheDocument()
  })

  it('restores Edit/Delete when the confirmation Cancel is clicked, without deleting', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))

    fireEvent.click(screen.getByTestId('cancel-delete-btn'))
    expect(screen.getByTestId('delete-series-btn')).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('restores Edit/Delete on Escape without deleting', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))

    fireEvent.keyDown(screen.getByTestId('series-row'), { key: 'Escape' })
    expect(screen.getByTestId('delete-series-btn')).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('does not call onSeriesClick when the title is clicked while confirming', async () => {
    const onSeriesClick = vi.fn()
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Show' })])
    render(<SeriesList onSeriesClick={onSeriesClick} />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))

    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(onSeriesClick).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-004-AC-10/11/12: delete loading state', () => {
  it('disables Confirm/Cancel and shows "Deleting..." while in flight', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Show' })])
    mockDelete.mockReturnValue(new Promise(() => undefined))
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    expect(mockDelete).toHaveBeenCalledWith('1')
    const confirmButton = screen.getByTestId('confirm-delete-btn')
    expect(confirmButton).toHaveTextContent(/deleting/i)
    expect(confirmButton).toBeDisabled()
    expect(screen.getByTestId('cancel-delete-btn')).toBeDisabled()
  })
})

describe('FRONTEND-004-AC-13/14: delete success', () => {
  it('removes the row without re-fetching', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Show A' }),
      makeSeries({ id: '2', title: 'Show B' }),
    ])
    mockDelete.mockResolvedValue(undefined)
    render(<SeriesList />)
    await waitFor(() => screen.getAllByTestId('delete-series-btn'))

    fireEvent.click(screen.getAllByTestId('delete-series-btn')[0])
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    await waitFor(() =>
      expect(screen.queryByText('Show A')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Show B')).toBeInTheDocument()
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state after deleting the last series', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Only Show' })])
    mockDelete.mockResolvedValue(undefined)
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    await waitFor(() =>
      expect(screen.getByText(/no series yet/i)).toBeInTheDocument(),
    )
  })
})

describe('FRONTEND-004-AC-15: delete error handling', () => {
  it('shows an alert scoped to the row and keeps it deletable', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Show' })])
    mockDelete.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /internal server error/i,
      ),
    )
    expect(screen.getByText('Show')).toBeInTheDocument()
    expect(screen.getByTestId('confirm-delete-btn')).not.toBeDisabled()
  })
})

describe('FRONTEND-004-AC-39: no series data logged during delete', () => {
  it('never logs series data to the console when deleting', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    mockGetAll.mockResolvedValue([
      makeSeries({
        id: '1',
        title: 'Secret Show',
        personalNotes: 'private note',
      }),
    ])
    mockDelete.mockResolvedValue(undefined)
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    await waitFor(() => expect(mockDelete).toHaveBeenCalled())
    expect(
      logSpy.mock.calls.flat().some((c) => String(c).includes('private note')),
    ).toBe(false)
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

describe('FRONTEND-006-AC-09/10/11: criteria-driven fetching', () => {
  it('calls getAll when no criteria is provided', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1))
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('calls getAll when criteria is an empty object', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList criteria={{}} />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1))
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('calls search with the given criteria when non-empty', async () => {
    mockSearch.mockResolvedValue([])
    render(<SeriesList criteria={{ title: 'office' }} />)
    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith({ title: 'office' }, undefined),
    )
    expect(mockGetAll).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-006-AC-12: re-fetch on criteria change', () => {
  it('re-fetches when criteria changes', async () => {
    mockSearch.mockResolvedValue([])
    const { rerender } = render(<SeriesList criteria={{ title: 'a' }} />)
    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith({ title: 'a' }, undefined),
    )

    rerender(<SeriesList criteria={{ title: 'b' }} />)
    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith({ title: 'b' }, undefined),
    )
    expect(mockSearch).toHaveBeenCalledTimes(2)
  })
})

describe('FRONTEND-006-AC-13: retry uses search when criteria active', () => {
  it('retries via search, not getAll', async () => {
    mockSearch
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce([])
    render(<SeriesList criteria={{ title: 'office' }} />)
    await waitFor(() => screen.getByRole('button', { name: /retry/i }))

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2))
    expect(mockGetAll).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-022-AC-10: alternateTitle no longer displayed', () => {
  it('does not render an "aka" line next to the row title', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'MI-5' })])
    render(<SeriesList />)

    await waitFor(() => expect(screen.getByText('MI-5')).toBeInTheDocument())
    expect(screen.queryByText(/^aka /i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-026-AC-12/13: year and country next to the title', () => {
  it('shows "(Year) | Country" for a series with both set', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ title: 'The Office', year: 2001, originCountry: 'GB' }),
    ])
    render(<SeriesList />)

    expect(await screen.findByText('The Office (2001)')).toBeInTheDocument()
    expect(screen.getByText('| United Kingdom')).toBeInTheDocument()
  })

  it('omits the year suffix and country span when both are null', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ title: 'Obscure Show', year: null, originCountry: null }),
    ])
    render(<SeriesList />)

    expect(await screen.findByText('Obscure Show')).toBeInTheDocument()
    expect(screen.queryByText('|', { exact: false })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-023-AC-10/12/13: refresh-all click, polling, completion', () => {
  it('disables the button, shows progress, then re-enables and re-fetches on completion', async () => {
    mockGetAll.mockResolvedValue([])
    mockRefreshAll.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 15,
      completedCount: 0,
      skippedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    })
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /refresh all/i }))
    expect(await screen.findByText(/refreshing 0 of 15/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh all/i })).toBeDisabled()

    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 15,
      completedCount: 15,
      skippedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    })

    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: /refresh all/i }),
        ).not.toBeDisabled(),
      { timeout: 8000 },
    )
    expect(mockGetAll).toHaveBeenCalledTimes(2)
  }, 10000)
})

describe('FRONTEND-023-AC-11: resumes polling on mount if a job is already running', () => {
  it('enters the disabled/polling state without a click', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRefreshStatus.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 15,
      completedCount: 4,
      skippedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    })

    render(<SeriesList />)

    expect(await screen.findByText(/refreshing 4 of 15/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh all/i })).toBeDisabled()
  })
})

describe('FRONTEND-023-AC-14: 409 on click is treated as already-in-progress, not an error', () => {
  it('enters polling state instead of showing an error', async () => {
    mockGetAll.mockResolvedValue([])
    mockRefreshAll.mockRejectedValue(
      new ApiError(409, 'A refresh is already in progress'),
    )
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /refresh all/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /refresh all/i }),
      ).toBeDisabled(),
    )
  })
})

describe('FRONTEND-023-AC-15: last full refresh display', () => {
  it('shows relative time from the status endpoint finishedAt', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 15,
      completedCount: 15,
      skippedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    })
    render(<SeriesList />)
    expect(await screen.findByText(/last full refresh/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-023-AC-18: new-content badge per row', () => {
  it('shows a "New content" badge on a row whose newContentDetectedAt is set', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({
        id: '1',
        title: 'Flagged Show',
        newContentDetectedAt: new Date().toISOString(),
      }),
      makeSeries({
        id: '2',
        title: 'Unflagged Show',
        newContentDetectedAt: null,
      }),
    ])
    render(<SeriesList />)

    await waitFor(() => screen.getByText('Flagged Show'))
    const rows = screen.getAllByTestId('series-row')
    expect(within(rows[0]).getByText(/new content/i)).toBeInTheDocument()
    expect(within(rows[1]).queryByText(/new content/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-023-AC-23: skipped count shown in progress text', () => {
  it('includes the skipped count when greater than zero', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRefreshStatus.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 15,
      completedCount: 4,
      skippedCount: 3,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    })
    render(<SeriesList />)

    expect(
      await screen.findByText(/refreshing 4 of 15 \(3 skipped\)/i),
    ).toBeInTheDocument()
  })

  it('omits the parenthetical when skippedCount is zero', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRefreshStatus.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 15,
      completedCount: 4,
      skippedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    })
    render(<SeriesList />)

    expect(
      await screen.findByText(/refreshing 4 of 15\.\.\./i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-023-AC-24: skipped count in "Last full refresh" summary', () => {
  it('includes the skipped count when greater than zero, and it stays visible after completion', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 15,
      completedCount: 15,
      skippedCount: 3,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    })
    render(<SeriesList />)

    expect(
      await screen.findByText(
        /last full refresh:.*\(3 skipped, already up to date\)/i,
      ),
    ).toBeInTheDocument()
  })

  it('omits the parenthetical when skippedCount is zero', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 15,
      completedCount: 15,
      skippedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    })
    render(<SeriesList />)

    await screen.findByText(/last full refresh/i)
    expect(screen.queryByText(/skipped/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-013-AC-12/13: sort control', () => {
  it('renders a "Sort by" field selector defaulting to Date Added', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledWith(undefined))

    expect(screen.getByLabelText(/sort by/i)).toHaveValue('dateAdded')
  })

  it('re-fetches getAll with sort params on change', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledWith(undefined))

    fireEvent.change(screen.getByLabelText(/sort by/i), {
      target: { value: 'personalRating' },
    })

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenLastCalledWith({
        sortBy: 'personalRating',
        sortDirection: 'desc',
      }),
    )
  })

  it('re-fetches via search (not getAll) with sort params when criteria is active', async () => {
    mockSearch.mockResolvedValue([])
    render(<SeriesList criteria={{ title: 'office' }} />)
    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith({ title: 'office' }, undefined),
    )

    fireEvent.change(screen.getByLabelText(/sort by/i), {
      target: { value: 'personalRating' },
    })

    await waitFor(() =>
      expect(mockSearch).toHaveBeenLastCalledWith(
        { title: 'office' },
        { sortBy: 'personalRating', sortDirection: 'desc' },
      ),
    )
    expect(mockGetAll).not.toHaveBeenCalled()
  })

  it('toggles sort direction and re-fetches with the new direction', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledWith(undefined))

    fireEvent.click(screen.getByRole('button', { name: /sort descending/i }))

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenLastCalledWith({
        sortBy: 'dateAdded',
        sortDirection: 'asc',
      }),
    )
  })
})

describe('FRONTEND-013-AC-15/16: additional sort options re-fetch correctly', () => {
  it('offers Title/Year/IMDb Rating/TMDB Rating alongside Date Added/Personal Rating', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledWith(undefined))

    const select = screen.getByLabelText(/sort by/i)
    const optionLabels = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(optionLabels).toEqual([
      'Date Added',
      'Personal Rating',
      'Title',
      'Year',
      'IMDb Rating',
      'TMDB Rating',
    ])
  })

  it('re-fetches with sortBy=tmdbRating when that option is selected', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledWith(undefined))

    fireEvent.change(screen.getByLabelText(/sort by/i), {
      target: { value: 'tmdbRating' },
    })

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenLastCalledWith({
        sortBy: 'tmdbRating',
        sortDirection: 'desc',
      }),
    )
  })

  it('re-fetches with sortBy=title when that option is selected', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledWith(undefined))

    fireEvent.change(screen.getByLabelText(/sort by/i), {
      target: { value: 'title' },
    })

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenLastCalledWith({
        sortBy: 'title',
        sortDirection: 'desc',
      }),
    )
  })

  it('re-fetches with sortBy=year when that option is selected', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledWith(undefined))

    fireEvent.change(screen.getByLabelText(/sort by/i), {
      target: { value: 'year' },
    })

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenLastCalledWith({
        sortBy: 'year',
        sortDirection: 'desc',
      }),
    )
  })

  it('re-fetches with sortBy=imdbRating when that option is selected', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledWith(undefined))

    fireEvent.change(screen.getByLabelText(/sort by/i), {
      target: { value: 'imdbRating' },
    })

    await waitFor(() =>
      expect(mockGetAll).toHaveBeenLastCalledWith({
        sortBy: 'imdbRating',
        sortDirection: 'desc',
      }),
    )
  })
})

describe('FRONTEND-012-AC-12/14: rewatch toggle on COMPLETED rows', () => {
  const mockUpdate = vi.mocked(seriesApi.update)

  it('renders only for COMPLETED rows and updates on toggle', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({
        id: '1',
        title: 'Finished Show',
        status: SeriesStatus.COMPLETED,
        flaggedForRewatch: false,
      }),
      makeSeries({
        id: '2',
        title: 'Ongoing Show',
        status: SeriesStatus.WATCHING,
        flaggedForRewatch: false,
      }),
    ])
    mockUpdate.mockResolvedValue(
      makeSeries({
        id: '1',
        status: SeriesStatus.COMPLETED,
        flaggedForRewatch: true,
      }),
    )
    render(<SeriesList />)
    await screen.findByText('Finished Show')

    const toggles = screen.getAllByLabelText(/flag for rewatch/i)
    expect(toggles).toHaveLength(1)

    fireEvent.click(toggles[0])
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith('1', { flaggedForRewatch: true }),
    )
    expect(toggles[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('reverts and shows a scoped error on failure', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({
        id: '1',
        status: SeriesStatus.COMPLETED,
        flaggedForRewatch: false,
      }),
    ])
    mockUpdate.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<SeriesList />)
    const toggle = await screen.findByLabelText(/flag for rewatch/i)

    fireEvent.click(toggle)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('FRONTEND-006-AC-14/15: filtered empty state', () => {
  it('shows "No series match your filters." without the add-first-series button', async () => {
    mockSearch.mockResolvedValue([])
    render(<SeriesList criteria={{ title: 'nonexistent' }} />)
    await waitFor(() =>
      expect(
        screen.getByText(/no series match your filters/i),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText(/add your first series/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('add-series-btn')).toBeInTheDocument()
  })
})
