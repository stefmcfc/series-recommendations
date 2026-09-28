import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { GenreStatsView } from './GenreStatsView'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { useNameStatsFilters } from '../hooks/useNameStatsFilters'

vi.mock('../services/seriesApi')
const mockGetGenreStats = vi.mocked(seriesApi.getGenreStats)
// FRONTEND-129-AC-03: NameStatsTable now renders a SavedFiltersList/
// FilterProfileActions pair (area ANALYSIS_FILTERS) that fetches on mount --
// mocked here (not previously needed by this file) so every pre-existing
// test sees no behavior change.
const mockListFilterProfiles = vi.mocked(seriesApi.listFilterProfiles)

// FRONTEND-096-AC-14: GenreStatsView now requires a `filters` prop, forwarded
// unchanged from AnalysisView's single shared useNameStatsFilters()
// instance -- this Harness wraps it with a real instance of that hook so
// every existing behavioral test below (Apply Filters, sort, etc.) keeps
// exercising the same end-to-end flow it did before this prop was added.
// FRONTEND-137-AC-05: GenreDetailModal calls useNavigate, so this harness
// always renders inside a Router -- unconditionally, since it's a no-op for
// every pre-existing test that never opens that modal (mirrors
// KeywordsView.test.tsx's identical KeywordsViewHarness precedent).
function GenreStatsViewHarness() {
  const filters = useNameStatsFilters()
  return (
    <MemoryRouter>
      <GenreStatsView filters={filters} />
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

// FRONTEND-137-AC-03/04 superseded this describe's original scope: as of
// frontend_spec_137, GenreStatsView *does* wire favouriteNames/onOpenDetail
// -- from genreFavourites, not keywordFavourites. This test now only
// confirms the keywordFavourites key specifically has no effect here (the
// scope boundary that still holds); see FRONTEND-137-AC-03/04's own describe
// blocks below for the genreFavourites-driven star/button behavior.
describe('FRONTEND-136-AC-02: GenreStatsView unaffected by keywordFavourites', () => {
  it('renders no favourite star for a keywordFavourites entry, even identically named', async () => {
    localStorage.setItem('keywordFavourites', JSON.stringify(['Drama']))
    mockGetGenreStats.mockResolvedValue([
      {
        name: 'Drama',
        seriesCount: 5,
        averagePersonalRating: 4.2,
        averageBlendedRating: 7.8,
      },
    ])
    render(<GenreStatsViewHarness />)
    await screen.findByText('Drama')
    expect(screen.queryByTestId('favourite-star')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-137-AC-03: GenreStatsView wires genreFavourites', () => {
  it('shows a star for a genre already in genreFavourites', async () => {
    localStorage.setItem('genreFavourites', JSON.stringify(['Comedy']))
    mockGetGenreStats.mockResolvedValue([
      {
        name: 'Comedy',
        seriesCount: 5,
        averagePersonalRating: 4.2,
        averageBlendedRating: 7.8,
      },
    ])
    render(<GenreStatsViewHarness />)
    await screen.findByText('Comedy')
    expect(screen.getByTestId('favourite-star')).toBeInTheDocument()
  })

  it('the Favourites Only filter narrows to genreFavourites, client-side', async () => {
    localStorage.setItem('genreFavourites', JSON.stringify(['Comedy']))
    mockGetGenreStats.mockResolvedValue([
      {
        name: 'Comedy',
        seriesCount: 5,
        averagePersonalRating: 4.2,
        averageBlendedRating: 7.8,
      },
      {
        name: 'Drama',
        seriesCount: 3,
        averagePersonalRating: 6,
        averageBlendedRating: 6.5,
      },
    ])
    render(<GenreStatsViewHarness />)
    await screen.findByText('Drama')

    fireEvent.click(screen.getByRole('checkbox', { name: /Favourites Only/i }))
    expect(screen.queryByText('Drama')).not.toBeInTheDocument()
    expect(screen.getByText('Comedy')).toBeInTheDocument()
  })
})

describe('FRONTEND-137-AC-04: GenreStatsView wires the detail modal', () => {
  it('opens GenreDetailModal from a genre name click', async () => {
    mockGetGenreStats.mockResolvedValue([
      {
        name: 'Comedy',
        seriesCount: 5,
        averagePersonalRating: 4.2,
        averageBlendedRating: 7.8,
      },
    ])
    vi.mocked(seriesApi.search).mockResolvedValue({
      series: [],
      excludedCount: 0,
    })
    render(<GenreStatsViewHarness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Comedy' }))

    expect(
      await screen.findByRole('dialog', { name: /Comedy/i }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-096-AC-14: forwards the filters prop unchanged', () => {
  it('passes the filters prop straight through to NameStatsTable', async () => {
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsViewHarness />)
    expect(await screen.findByTestId('genre-stats-view')).toBeInTheDocument()
  })
})

describe('FRONTEND-133-AC-08: GenreStatsView renders no Get Recs button', () => {
  it('never renders a Get Recs button', async () => {
    mockGetGenreStats.mockResolvedValue([
      {
        name: 'Drama',
        seriesCount: 5,
        averagePersonalRating: 4.2,
        averageBlendedRating: 7.8,
      },
    ])
    render(<GenreStatsViewHarness />)
    await screen.findByText('Drama')

    expect(
      screen.queryByRole('button', { name: /Get Recs/i }),
    ).not.toBeInTheDocument()
  })
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
    render(<GenreStatsViewHarness />)

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
    render(<GenreStatsViewHarness />)

    expect(await screen.findByText('Comedy')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})

describe('FRONTEND-088-AC-03: sortable column headers re-fetch with sortBy', () => {
  it('re-fetches with sortBy=averagePersonalRating on header click', async () => {
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsViewHarness />)
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
    render(<GenreStatsViewHarness />)
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
    render(<GenreStatsViewHarness />)
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
    render(<GenreStatsViewHarness />)
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
    render(<GenreStatsViewHarness />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error alert when the fetch rejects', async () => {
    mockGetGenreStats.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    render(<GenreStatsViewHarness />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('FRONTEND-088-AC-03: minimum-value filters', () => {
  it('renders three labelled numeric filter inputs and an Apply Filters button', async () => {
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsViewHarness />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())
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
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsViewHarness />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())
    openFilters()

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
    render(<GenreStatsViewHarness />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())
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
      expect(mockGetGenreStats).toHaveBeenLastCalledWith({
        minSeriesCount: 2,
        minAveragePersonalRating: 3.5,
        minAverageBlendedRating: 6,
      }),
    )
  })

  it('leaving all three filters blank and clicking Apply behaves like the unfiltered view', async () => {
    mockGetGenreStats.mockResolvedValue([])
    render(<GenreStatsViewHarness />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalledWith({}))
    openFilters()

    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() => expect(mockGetGenreStats).toHaveBeenLastCalledWith({}))
  })
})

describe('FRONTEND-088-AC-04: loading/error states apply identically under filtering', () => {
  it('shows the loading state again while a filtered fetch is in flight', async () => {
    mockGetGenreStats.mockResolvedValueOnce([])
    render(<GenreStatsViewHarness />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())
    openFilters()

    mockGetGenreStats.mockReturnValue(new Promise(() => {}))
    fireEvent.change(screen.getByLabelText(/min series count/i), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('shows an error alert when a filtered fetch rejects', async () => {
    mockGetGenreStats.mockResolvedValueOnce([])
    render(<GenreStatsViewHarness />)
    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())
    openFilters()

    mockGetGenreStats.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
