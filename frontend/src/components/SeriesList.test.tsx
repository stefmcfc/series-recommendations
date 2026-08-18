import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
      expect(mockSearch).toHaveBeenCalledWith({ title: 'office' }),
    )
    expect(mockGetAll).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-006-AC-12: re-fetch on criteria change', () => {
  it('re-fetches when criteria changes', async () => {
    mockSearch.mockResolvedValue([])
    const { rerender } = render(<SeriesList criteria={{ title: 'a' }} />)
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith({ title: 'a' }))

    rerender(<SeriesList criteria={{ title: 'b' }} />)
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith({ title: 'b' }))
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
