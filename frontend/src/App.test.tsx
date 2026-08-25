import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import App from './App'
import { seriesApi } from './services/seriesApi'
import type { Series } from './types/series'

vi.mock('./services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)
const mockCreate = vi.mocked(seriesApi.create)
const mockUpdate = vi.mocked(seriesApi.update)
const mockSearch = vi.mocked(seriesApi.search)
const mockGetById = vi.mocked(seriesApi.getById)
const mockGetRecommendations = vi.mocked(seriesApi.getRecommendations)
const mockGetGenreOptions = vi.mocked(seriesApi.getGenreOptions)
const mockGetRefreshStatus = vi.mocked(seriesApi.getRefreshStatus)
const mockGetKeywordStats = vi.mocked(seriesApi.getKeywordStats)

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
  mockGetKeywordStats.mockResolvedValue([])
})

describe('FRONTEND-003-AC-27/28: opening the form', () => {
  it('does not render AddSeriesForm until Add Series is clicked', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('add-series-btn')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByTestId('add-series-btn')[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('FRONTEND-003-AC-29: cancelling', () => {
  it('closes the dialog without re-fetching', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findAllByTestId('add-series-btn')
    fireEvent.click(screen.getAllByTestId('add-series-btn')[0])

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-003-AC-30: successful creation refreshes the list', () => {
  it('closes the dialog and re-fetches the series list', async () => {
    mockGetAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: '1', title: 'New Show' } as Series])
    mockCreate.mockResolvedValue({ id: '1', title: 'New Show' } as Series)

    render(<App />)
    await screen.findAllByTestId('add-series-btn')
    fireEvent.click(screen.getAllByTestId('add-series-btn')[0])

    fireEvent.change(
      within(screen.getByRole('dialog')).getByLabelText(/^title/i),
      {
        target: { value: 'New Show' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('New Show')).toBeInTheDocument()
  })
})

describe('FRONTEND-004-AC-34/35: opening the edit form', () => {
  it('renders EditSeriesForm pre-filled when a row Edit button is clicked', async () => {
    mockGetAll.mockResolvedValue([
      { id: '1', title: 'Show', status: 'WATCHING' } as Series,
    ])
    render(<App />)
    await screen.findByTestId('edit-series-btn')

    fireEvent.click(screen.getByTestId('edit-series-btn'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      within(screen.getByRole('dialog')).getByLabelText(/^title/i),
    ).toHaveValue('Show')
  })
})

describe('FRONTEND-004-AC-36: cancelling an edit', () => {
  it('closes the dialog without re-fetching', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    render(<App />)
    await screen.findByTestId('edit-series-btn')
    fireEvent.click(screen.getByTestId('edit-series-btn'))

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-007-AC-13: export controls rendered', () => {
  it('renders ExportControls on the main page', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('export-json-btn')
    expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument()
  })
})

describe('FRONTEND-004-AC-37: successful edit refreshes the list', () => {
  it('closes the dialog and re-fetches the series list', async () => {
    mockGetAll
      .mockResolvedValueOnce([{ id: '1', title: 'Show' } as Series])
      .mockResolvedValueOnce([{ id: '1', title: 'Updated Show' } as Series])
    mockUpdate.mockResolvedValue({ id: '1', title: 'Updated Show' } as Series)

    render(<App />)
    await screen.findByTestId('edit-series-btn')
    fireEvent.click(screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Updated Show')).toBeInTheDocument()
  })
})

describe('FRONTEND-006-AC-16/17/18: search wiring', () => {
  it('applies a search from SearchFilter to the rendered list', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'The Office' } as Series])
    mockSearch.mockResolvedValue([{ id: '1', title: 'The Office' } as Series])

    render(<App />)
    await screen.findByText('The Office')

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'office' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'office' }),
        undefined,
      ),
    )
  })

  it('reverts to getAll after Clear Filters', async () => {
    mockGetAll.mockResolvedValue([])
    mockSearch.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('clear-filters-btn')

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'office' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByTestId('clear-filters-btn'))
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
  })
})

describe('FRONTEND-005-AC-25/26: navigating to detail', () => {
  it('renders SeriesDetail instead of SeriesList when the title is clicked', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    render(<App />)
    await screen.findByTestId('series-row')

    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    await screen.findByTestId('back-btn')
    expect(screen.queryByTestId('series-row')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-27: returning to the list', () => {
  it('re-fetches SeriesList after Back', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    render(<App />)
    await screen.findByTestId('series-row')
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))

    await screen.findByTestId('back-btn')
    fireEvent.click(screen.getByTestId('back-btn'))

    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('series-row')).toBeInTheDocument()
  })
})

describe('FRONTEND-010-AC-18/19: Recommendations nav toggle', () => {
  it('switches the main view without disturbing active search criteria', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'The Office' } as Series])
    mockSearch.mockResolvedValue([{ id: '1', title: 'The Office' } as Series])
    mockGetRecommendations.mockResolvedValue([])
    mockGetGenreOptions.mockResolvedValue([])

    render(<App />)
    await screen.findByText('The Office')

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'office' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'office' }),
        undefined,
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: /recommendations/i }))
    expect(
      await screen.findByTestId('recommendations-list'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('series-list')).not.toBeInTheDocument()
    expect(
      await screen.findByText(/no recommendations yet/i),
    ).toBeInTheDocument()

    const searchCallsBeforeReturning = mockSearch.mock.calls.length

    fireEvent.click(
      screen.getByRole('button', { name: /series list|my series/i }),
    )
    expect(await screen.findByTestId('series-list')).toBeInTheDocument()

    // The active criteria (App-level state, not SearchFilter's uncommitted
    // input) survived the round trip: remounting SeriesList re-fetches with
    // the same criteria automatically, without the user re-entering/re-
    // submitting the filter.
    await waitFor(() =>
      expect(mockSearch.mock.calls.length).toBeGreaterThan(
        searchCallsBeforeReturning,
      ),
    )
    expect(mockSearch.mock.calls[mockSearch.mock.calls.length - 1][0]).toEqual(
      expect.objectContaining({ title: 'office' }),
    )
    expect(await screen.findByText('The Office')).toBeInTheDocument()
  })
})

describe('FRONTEND-011-AC-10: RecommendationControls only renders in the Recommendations view', () => {
  it('shows the sourcing controls only while the Recommendations view is active', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRecommendations.mockResolvedValue([])
    mockGetGenreOptions.mockResolvedValue([])

    render(<App />)
    await screen.findByTestId('add-series-btn')
    expect(
      screen.queryByRole('button', { name: /^automatic$/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /recommendations/i }))
    expect(await screen.findByLabelText(/^automatic/i)).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /series list|my series/i }),
    )
    await screen.findByTestId('series-list')
    expect(screen.queryByLabelText(/^automatic/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-024-AC-10: Keywords nav toggle', () => {
  it('renders KeywordsView when the Keywords toggle is clicked', async () => {
    mockGetAll.mockResolvedValue([])

    render(<App />)
    await screen.findByTestId('add-series-btn')

    fireEvent.click(
      screen.getByRole('button', { name: /^keywords$/i, pressed: false }),
    )
    expect(await screen.findByTestId('keywords-view')).toBeInTheDocument()
    expect(screen.queryByTestId('series-list')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /series list|my series/i }),
    )
    await screen.findByTestId('series-list')
    expect(screen.queryByTestId('keywords-view')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-28/29: editing from detail refreshes it in place', () => {
  it('stays on SeriesDetail and shows updated data after a successful edit', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById
      .mockResolvedValueOnce({
        id: '1',
        title: 'Show',
        status: 'WATCHING',
      } as Series)
      .mockResolvedValueOnce({
        id: '1',
        title: 'Updated Show',
        status: 'WATCHING',
      } as Series)
    mockUpdate.mockResolvedValue({ id: '1', title: 'Updated Show' } as Series)

    render(<App />)
    await screen.findByTestId('series-row')
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    await screen.findByTestId('edit-series-btn')

    fireEvent.click(screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Updated Show')).toBeInTheDocument()
    expect(screen.getByTestId('back-btn')).toBeInTheDocument()
  })
})
