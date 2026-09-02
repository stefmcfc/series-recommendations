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
  // FRONTEND-041: <BrowserRouter> lives inside App itself, so tests seed the
  // starting route via window.history.pushState. Default to /my-series here
  // so tests that don't care about routing (most of the pre-existing suite)
  // aren't affected by whatever path a previous test in this file left the
  // shared jsdom window on; tests that do care override it in their own body.
  window.history.pushState({}, '', '/my-series')
  mockGetRefreshStatus.mockResolvedValue({
    status: 'IDLE',
    totalCount: 0,
    completedCount: 0,
    skippedCount: 0,
    startedAt: null,
    finishedAt: null,
  })
  mockGetKeywordStats.mockResolvedValue([])
  mockGetGenreOptions.mockResolvedValue([])
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

describe('FRONTEND-072-AC-01: Export controls no longer render on My Series', () => {
  it('does not render Export JSON/CSV buttons on the My Series page', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    expect(screen.queryByTestId('export-json-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('export-csv-btn')).not.toBeInTheDocument()
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
  it('applies a search from the live Title search box to the rendered list', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'The Office' } as Series])
    mockSearch.mockResolvedValue([{ id: '1', title: 'The Office' } as Series])

    render(<App />)
    await screen.findByText('The Office')

    // FRONTEND-073-AC-03/04: Title is now a live, always-visible box on the
    // page itself -- no sheet to open, no Search button to click.
    fireEvent.change(screen.getByTestId('live-title-search'), {
      target: { value: 'office' },
    })

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
    await screen.findByTestId('series-list')

    fireEvent.click(screen.getByTestId('open-filters-btn'))
    fireEvent.change(await screen.findByLabelText(/min imdb rating/i), {
      target: { value: '7.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1))

    // FRONTEND-071-AC-06: Search now closes the sheet after applying --
    // Clear Filters lives inside it too, so it must be reopened here.
    fireEvent.click(screen.getByTestId('open-filters-btn'))
    fireEvent.click(await screen.findByTestId('clear-filters-btn'))
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
    window.history.pushState({}, '', '/my-series')

    render(<App />)
    await screen.findByText('The Office')

    // FRONTEND-073: Title itself now lives in MySeriesView's own local state
    // (rawTitle/debouncedTitle), which does not survive a route
    // unmount/remount -- unlike sheet-owned criteria (App-level state), which
    // this test is actually exercising here via a still-sheet-owned field.
    fireEvent.click(screen.getByTestId('open-filters-btn'))
    fireEvent.change(screen.getByLabelText(/min imdb rating/i), {
      target: { value: '7.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ minImdbRating: 7.5 }),
        undefined,
      ),
    )

    fireEvent.click(screen.getByRole('link', { name: /recommendations/i }))
    expect(
      await screen.findByTestId('recommendations-list'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('series-list')).not.toBeInTheDocument()
    // FRONTEND-062 (2026-09-01): navigating to Recommendations no longer
    // fires a request on its own -- this incidental sanity check (confirming
    // the view actually rendered) now looks for the "not yet searched"
    // prompt instead of a real empty-results message, since nothing has
    // been fetched yet.
    expect(
      await screen.findByTestId('recommendations-not-searched'),
    ).toBeInTheDocument()

    const searchCallsBeforeReturning = mockSearch.mock.calls.length

    fireEvent.click(
      screen.getByRole('link', { name: /series list|my series/i }),
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
      expect.objectContaining({ minImdbRating: 7.5 }),
    )
    expect(await screen.findByText('The Office')).toBeInTheDocument()
  })
})

describe('FRONTEND-011-AC-10: RecommendationControls only renders in the Recommendations view', () => {
  it('shows the sourcing controls only while the Recommendations view is active', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRecommendations.mockResolvedValue([])
    mockGetGenreOptions.mockResolvedValue([])
    window.history.pushState({}, '', '/my-series')

    render(<App />)
    await screen.findByTestId('add-series-btn')
    expect(
      screen.queryByRole('tab', { name: /use my series/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: /recommendations/i }))
    expect(
      await screen.findByRole('tab', { name: /use my series/i }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('link', { name: /series list|my series/i }),
    )
    await screen.findByTestId('series-list')
    expect(
      screen.queryByRole('tab', { name: /use my series/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-024-AC-10: Keywords nav toggle', () => {
  it('renders KeywordsView when the Keywords toggle is clicked', async () => {
    mockGetAll.mockResolvedValue([])
    window.history.pushState({}, '', '/my-series')

    render(<App />)
    await screen.findByTestId('add-series-btn')

    fireEvent.click(screen.getByRole('link', { name: /^keywords$/i }))
    expect(await screen.findByTestId('keywords-view')).toBeInTheDocument()
    expect(screen.queryByTestId('series-list')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('link', { name: /series list|my series/i }),
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

describe('FRONTEND-041-AC-01: nav items are links, not buttons', () => {
  it('renders My Series/Recommendations/Keywords as links', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('add-series-btn')

    expect(screen.getByRole('link', { name: /my series/i })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /recommendations/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /^keywords$/i }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-041-AC-03: logo links home', () => {
  it('renders a logo link pointing at /my-series', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('add-series-btn')

    const logo = screen.getByTestId('app-logo')
    expect(logo.closest('a')).toHaveAttribute('href', '/my-series')
  })
})

describe('FRONTEND-041-AC-04: logo click navigates home from any view', () => {
  it('navigates to My Series from Recommendations', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRecommendations.mockResolvedValue([])
    mockGetGenreOptions.mockResolvedValue([])
    window.history.pushState({}, '', '/recommendations')

    render(<App />)
    await screen.findByTestId('recommendations-list')

    fireEvent.click(screen.getByTestId('app-logo'))

    await screen.findByTestId('series-list')
    expect(window.location.pathname).toBe('/my-series')
  })
})

describe('FRONTEND-041-AC-05: root redirects to /my-series', () => {
  it('shows the series list when loaded at /', async () => {
    mockGetAll.mockResolvedValue([])
    window.history.pushState({}, '', '/')

    render(<App />)

    await screen.findByTestId('series-list')
    expect(window.location.pathname).toBe('/my-series')
  })
})

describe('FRONTEND-041-AC-06: /my-series renders the list view', () => {
  it('renders SeriesList content at /my-series', async () => {
    mockGetAll.mockResolvedValue([])
    window.history.pushState({}, '', '/my-series')

    render(<App />)

    expect(await screen.findByTestId('series-list')).toBeInTheDocument()
  })
})

describe('FRONTEND-041-AC-07: /recommendations renders the recommendations view', () => {
  it('renders RecommendationsList content at /recommendations', async () => {
    mockGetRecommendations.mockResolvedValue([])
    mockGetGenreOptions.mockResolvedValue([])
    window.history.pushState({}, '', '/recommendations')

    render(<App />)

    expect(
      await screen.findByTestId('recommendations-list'),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-041-AC-08: /keywords renders the keywords view', () => {
  it('renders KeywordsView content at /keywords', async () => {
    mockGetAll.mockResolvedValue([])
    window.history.pushState({}, '', '/keywords')

    render(<App />)

    expect(await screen.findByTestId('keywords-view')).toBeInTheDocument()
  })
})

describe('FRONTEND-070-AC-01: Settings nav link renders after Keywords', () => {
  it('renders a Settings link after Keywords in the nav', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('add-series-btn')

    const links = screen.getAllByRole('link').map((el) => el.textContent)
    const keywordsIndex = links.findIndex((text) => text === 'Keywords')
    const settingsIndex = links.findIndex((text) => text === 'Settings')

    expect(keywordsIndex).toBeGreaterThan(-1)
    expect(settingsIndex).toBe(keywordsIndex + 1)
  })
})

describe('FRONTEND-070-AC-02: /settings renders the Settings page shell', () => {
  it('renders SettingsPage content at /settings', async () => {
    mockGetAll.mockResolvedValue([])
    window.history.pushState({}, '', '/settings')

    render(<App />)

    expect(await screen.findByTestId('settings-view')).toBeInTheDocument()
  })
})

describe('FRONTEND-041-AC-09: nav updates the URL and supports Back', () => {
  it('navigates and supports browser Back', async () => {
    mockGetAll.mockResolvedValue([])
    mockGetRecommendations.mockResolvedValue([])
    mockGetGenreOptions.mockResolvedValue([])
    window.history.pushState({}, '', '/my-series')

    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.click(screen.getByRole('link', { name: /recommendations/i }))
    await screen.findByTestId('recommendations-list')
    expect(window.location.pathname).toBe('/recommendations')

    window.history.back()
    await waitFor(() => expect(window.location.pathname).toBe('/my-series'))
    expect(await screen.findByTestId('series-list')).toBeInTheDocument()
  })
})

describe('FRONTEND-041-AC-10: unmatched path redirects to /my-series', () => {
  it('redirects an unknown path to /my-series', async () => {
    mockGetAll.mockResolvedValue([])
    window.history.pushState({}, '', '/does-not-exist')

    render(<App />)

    await screen.findByTestId('series-list')
    expect(window.location.pathname).toBe('/my-series')
  })
})

describe('FRONTEND-041-AC-11: menu bar hides behind SeriesDetail', () => {
  it('hides the nav when a series is selected', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    window.history.pushState({}, '', '/my-series')

    render(<App />)
    await screen.findByTestId('series-row')
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))

    await screen.findByTestId('back-btn')
    expect(
      screen.queryByRole('link', { name: /my series/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-041-AC-12: selecting a series does not change the URL', () => {
  it('keeps the URL at /my-series through select and back', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    window.history.pushState({}, '', '/my-series')

    render(<App />)
    await screen.findByTestId('series-row')
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    await screen.findByTestId('back-btn')
    expect(window.location.pathname).toBe('/my-series')

    fireEvent.click(screen.getByTestId('back-btn'))
    await screen.findByTestId('series-row')
    expect(window.location.pathname).toBe('/my-series')
  })
})

describe('FRONTEND-056-AC-01: status tab bar renders', () => {
  it('renders five status tabs', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)

    expect(await screen.findByRole('link', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Watching' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Completed' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Backlog' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dropped' })).toBeInTheDocument()
  })
})

describe('FRONTEND-056-AC-02: deep-linking to a status tab filters SeriesList', () => {
  it('renders SeriesList filtered to the route-derived status', async () => {
    mockSearch.mockResolvedValue([
      { id: '1', title: 'Completed Show', status: 'COMPLETED' } as Series,
    ])
    window.history.pushState({}, '', '/my-series/completed')

    render(<App />)

    expect(await screen.findByText('Completed Show')).toBeInTheDocument()
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'COMPLETED' }),
      undefined,
    )
    expect(screen.getByRole('link', { name: 'Completed' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

describe('FRONTEND-056-AC-03: top-level My Series nav stays active on a status tab', () => {
  it('keeps aria-current on the top-level My Series link', async () => {
    mockSearch.mockResolvedValue([])
    window.history.pushState({}, '', '/my-series/watching')

    render(<App />)
    await screen.findByTestId('series-list')

    const topLevelLink = screen.getAllByRole('link', { name: 'My Series' })[0]
    expect(topLevelLink).toHaveAttribute('aria-current', 'page')
  })
})

describe('FRONTEND-056-AC-05: SearchFilter criteria and tab-derived status combine', () => {
  it('merges the SearchFilter criteria with the route-derived status', async () => {
    mockGetAll.mockResolvedValue([])
    mockSearch.mockResolvedValue([])
    window.history.pushState({}, '', '/my-series/watching')

    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.change(screen.getByTestId('live-title-search'), {
      target: { value: 'test' },
    })

    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'test', status: 'WATCHING' }),
        undefined,
      ),
    )
  })
})

describe('FRONTEND-056-AC-06: tabs and other filters do not clear/override each other', () => {
  it('preserves the active tab when other criteria change, and vice versa', async () => {
    mockGetAll.mockResolvedValue([])
    mockSearch.mockResolvedValue([])
    window.history.pushState({}, '', '/my-series/watching')

    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.change(screen.getByTestId('live-title-search'), {
      target: { value: 'office' },
    })

    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'office', status: 'WATCHING' }),
        undefined,
      ),
    )
    // Still on the Watching tab -- the live title box's own state didn't
    // navigate away.
    expect(screen.getByRole('link', { name: 'Watching' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    fireEvent.click(screen.getByRole('link', { name: 'Completed' }))

    await waitFor(() =>
      expect(mockSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: 'office', status: 'COMPLETED' }),
        undefined,
      ),
    )
  })
})

describe('FRONTEND-071-AC-09: opening Filters from SeriesList shows the sheet', () => {
  it('opens the SearchFilter sheet when the Filters button is clicked', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.click(screen.getByTestId('open-filters-btn'))

    expect(
      await screen.findByRole('dialog', { name: /filters/i }),
    ).toBeInTheDocument()
  })

  it('closes the sheet and reflects an active filter after a search', async () => {
    mockGetAll.mockResolvedValue([])
    mockSearch.mockResolvedValue([])
    mockGetGenreOptions.mockResolvedValue([])
    mockGetKeywordStats.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.click(screen.getByTestId('open-filters-btn'))
    fireEvent.change(await screen.findByLabelText(/min imdb rating/i), {
      target: { value: '7.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(
      screen.queryByRole('dialog', { name: /filters/i }),
    ).not.toBeInTheDocument()
    expect(await screen.findByTestId('filters-active-dot')).toBeInTheDocument()
  })
})

describe('FRONTEND-073-AC-04: typing debounces into fetch criteria', () => {
  // FRONTEND-073-AC-01's own hook-level test uses vi.useFakeTimers() against
  // a bare renderHook() (no React scheduler/act() interplay to worry about).
  // Faking timers around a full <App/> render is a different story: React's
  // own Scheduler package falls back to setTimeout in this jsdom environment,
  // so fake timers freeze scheduled work indefinitely (findByTestId/waitFor
  // never resolve, even for content already in the DOM) -- real timers plus
  // waitFor's default polling exercises the same 350ms debounce contract
  // without that hazard.
  it('does not refetch until the debounce settles', async () => {
    mockGetAll.mockResolvedValue([])
    mockSearch.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.change(screen.getByTestId('live-title-search'), {
      target: { value: 'office' },
    })
    expect(mockSearch).not.toHaveBeenCalled()

    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'office' }),
        undefined,
      ),
    )
  })
})

describe('FRONTEND-073-AC-05: live title clear is independent of Clear Filters', () => {
  it('Clear Filters in the sheet does not reset the live title box', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.change(screen.getByTestId('live-title-search'), {
      target: { value: 'office' },
    })
    fireEvent.click(screen.getByTestId('open-filters-btn'))
    fireEvent.click(await screen.findByTestId('clear-filters-btn'))

    expect(screen.getByTestId('live-title-search')).toHaveValue('office')
  })
})

describe('FRONTEND-073-AC-06: active-filter dot ignores live title', () => {
  it('does not show the active-filter dot from typing a title alone', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.change(screen.getByTestId('live-title-search'), {
      target: { value: 'office' },
    })

    expect(screen.queryByTestId('filters-active-dot')).not.toBeInTheDocument()
  })
})
