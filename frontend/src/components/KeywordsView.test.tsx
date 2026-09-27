import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { KeywordsView } from './KeywordsView'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { useNameStatsFilters } from '../hooks/useNameStatsFilters'

vi.mock('../services/seriesApi')
const mockGetKeywordStats = vi.mocked(seriesApi.getKeywordStats)
// FRONTEND-129-AC-03: NameStatsTable now renders a SavedFiltersList/
// FilterProfileActions pair (area ANALYSIS_FILTERS) that fetches on mount --
// mocked here (not previously needed by this file) so every pre-existing
// test sees no behavior change.
const mockListFilterProfiles = vi.mocked(seriesApi.listFilterProfiles)

// FRONTEND-096-AC-14: KeywordsView now requires a `filters` prop, forwarded
// unchanged from AnalysisView's single shared useNameStatsFilters()
// instance -- this Harness wraps it with a real instance of that hook so
// every existing behavioral test below (Apply Filters, sort, etc.) keeps
// exercising the same end-to-end flow it did before this prop was added.
// FRONTEND-136-AC-08: KeywordDetailModal calls useNavigate, so this harness
// always renders inside a Router -- unconditionally, since it's a no-op for
// every pre-existing test that never opens that modal.
function KeywordsViewHarness() {
  const filters = useNameStatsFilters()
  return (
    <MemoryRouter>
      <KeywordsView filters={filters} />
    </MemoryRouter>
  )
}

// FRONTEND-096-AC-04: filter fields now sit collapsed behind the "Analysis
// Filters" toggle by default -- tests that read/change a filter field open
// it first.
function openFilters() {
  fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListFilterProfiles.mockResolvedValue([])
  localStorage.clear()
})

describe('FRONTEND-133-AC-08: KeywordsView wires the recommendations action', () => {
  it('opens KeywordRecommendationsModal seeded with the clicked keyword', async () => {
    mockGetKeywordStats.mockResolvedValue([
      {
        name: 'spy',
        seriesCount: 4,
        averagePersonalRating: 4.2,
        averageBlendedRating: 7.5,
      },
    ])
    vi.mocked(seriesApi.getRecommendations).mockResolvedValue([])
    render(<KeywordsViewHarness />)
    await screen.findByText('spy')

    fireEvent.click(screen.getAllByRole('button', { name: /Get Recs/i })[0])

    expect(
      screen.getByRole('dialog', { name: /Recommendations for/i }),
    ).toBeInTheDocument()
    expect(seriesApi.getRecommendations).toHaveBeenCalledWith({
      keywords: ['spy'],
    })
  })
})

describe('FRONTEND-136-AC-02: KeywordsView wires favourites', () => {
  it('shows a star for a keyword already in keywordFavourites', async () => {
    localStorage.setItem('keywordFavourites', JSON.stringify(['time travel']))
    mockGetKeywordStats.mockResolvedValue([
      {
        name: 'time travel',
        seriesCount: 2,
        averagePersonalRating: 8,
        averageBlendedRating: 7.5,
      },
    ])
    render(<KeywordsViewHarness />)
    expect(await screen.findByTestId('favourite-star')).toBeInTheDocument()
  })
})

describe('FRONTEND-136-AC-05: KeywordsView wires the detail modal', () => {
  it('opens KeywordDetailModal from a keyword name click', async () => {
    mockGetKeywordStats.mockResolvedValue([
      {
        name: 'time travel',
        seriesCount: 2,
        averagePersonalRating: 8,
        averageBlendedRating: 7.5,
      },
    ])
    vi.mocked(seriesApi.search).mockResolvedValue({
      series: [],
      excludedCount: 0,
    })
    render(<KeywordsViewHarness />)
    fireEvent.click(await screen.findByRole('button', { name: 'time travel' }))

    expect(
      await screen.findByRole('dialog', { name: /time travel/i }),
    ).toBeInTheDocument()
  })

  // Regression: favouriting a keyword from inside the modal previously never
  // updated the star already rendered in the table behind it -- KeywordsView
  // and KeywordDetailModal each held their own independent
  // useLocalStorage('keywordFavourites', ...) state, read from storage only
  // once on mount, so the table's copy of that state never learned about the
  // modal's write without a full remount. Fixed in useLocalStorage.ts itself
  // (same-tab sync broadcast) -- this exercises the real user-facing flow
  // the bug was reported against, not just the hook in isolation (see
  // useLocalStorage.test.ts for that unit-level coverage).
  it('shows the star in the table once a keyword is favourited from the still-open modal, without a remount', async () => {
    mockGetKeywordStats.mockResolvedValue([
      {
        name: 'time travel',
        seriesCount: 2,
        averagePersonalRating: 8,
        averageBlendedRating: 7.5,
      },
    ])
    vi.mocked(seriesApi.search).mockResolvedValue({
      series: [],
      excludedCount: 0,
    })
    render(<KeywordsViewHarness />)
    fireEvent.click(await screen.findByRole('button', { name: 'time travel' }))
    await screen.findByRole('dialog', { name: /time travel/i })

    expect(screen.queryByTestId('favourite-star')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add.*favourites/i }))

    expect(await screen.findByTestId('favourite-star')).toBeInTheDocument()
  })
})

describe('FRONTEND-096-AC-14: forwards the filters prop unchanged', () => {
  it('passes the filters prop straight through to NameStatsTable', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsViewHarness />)
    expect(await screen.findByTestId('keywords-view')).toBeInTheDocument()
  })
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
    render(<KeywordsViewHarness />)

    expect(await screen.findByText('spy')).toBeInTheDocument()
    expect(screen.getByText('4.2')).toBeInTheDocument()
    expect(screen.getByText('7.5')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})

describe('FRONTEND-024-AC-09/FRONTEND-086-AC-09: sortable column headers re-fetch with sortBy', () => {
  it('re-fetches with sortBy=averagePersonalRating on header click', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsViewHarness />)
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
    render(<KeywordsViewHarness />)
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
    render(<KeywordsViewHarness />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error alert when the fetch rejects', async () => {
    mockGetKeywordStats.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    render(<KeywordsViewHarness />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('FRONTEND-086-AC-04/05/06: minimum-value filters', () => {
  it('renders three labelled numeric filter inputs and an Apply Filters button', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsViewHarness />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    openFilters()

    expect(screen.getByLabelText(/min series count/i)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/min avg personal rating/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('spinbutton', { name: /min avg blended rating/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /apply filters/i }),
    ).toBeInTheDocument()
  })

  it('applies only the filled-in filters on Apply, omitting blank ones', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsViewHarness />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    openFilters()

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
    render(<KeywordsViewHarness />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    openFilters()

    fireEvent.change(screen.getByLabelText(/min series count/i), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByLabelText(/min avg personal rating/i), {
      target: { value: '3.5' },
    })
    fireEvent.change(
      screen.getByRole('spinbutton', { name: /min avg blended rating/i }),
      {
        target: { value: '6' },
      },
    )
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
    render(<KeywordsViewHarness />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalledWith({}))
    openFilters()

    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith({}),
    )
  })
})

describe('FRONTEND-086-AC-07: loading/error states apply identically under filtering', () => {
  it('shows the loading state again while a filtered fetch is in flight', async () => {
    mockGetKeywordStats.mockResolvedValueOnce([])
    render(<KeywordsViewHarness />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    openFilters()

    mockGetKeywordStats.mockReturnValue(new Promise(() => {}))
    fireEvent.change(screen.getByLabelText(/min series count/i), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('shows an error alert when a filtered fetch rejects', async () => {
    mockGetKeywordStats.mockResolvedValueOnce([])
    render(<KeywordsViewHarness />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    openFilters()

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
    render(<KeywordsViewHarness />)
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
    render(<KeywordsViewHarness />)

    expect(await screen.findByText('Avg. Blended Rating')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('inactive sortable headers show no direction indicator', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsViewHarness />)
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
