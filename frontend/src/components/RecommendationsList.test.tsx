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
const mockRefresh = vi.mocked(seriesApi.refresh)
const mockGetRecommendationKeywords = vi.mocked(
  seriesApi.getRecommendationKeywords,
)
const mockGetRecommendationDetails = vi.mocked(
  seriesApi.getRecommendationDetails,
)

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
    voteCount: null,
    streamingProviders: [],
    imdbId: 'tt5071412',
    sourceTitles: [],
    totalSourceCount: 0,
    originCountry: null,
    tmdbId: 1234,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // FRONTEND-053: RecommendationDetailModal fetches this independently of
  // keywords on open -- default it to a benign resolved value so tests in
  // this file that only care about the keywords section (opened via the
  // shared "View Details" button) don't also have to stub it individually.
  mockGetRecommendationDetails.mockResolvedValue({
    numberOfSeasons: null,
    numberOfEpisodes: null,
    imdbRating: null,
  })
})

// FRONTEND-062 (2026-09-01): RecommendationsList no longer fetches when its
// `query` prop is undefined/null (that state now means "nothing has been
// searched yet" -- see the dedicated describe block below). Most tests in
// this file are about behavior that only exists once a fetch has actually
// happened, so they now pass an explicit `query={{}}` (an "applied, but
// unfiltered" query) rather than omitting the prop and implicitly relying
// on the old mount-always-fetches behavior.
describe('FRONTEND-062-AC-06/07/08: no fetch, no loading, a distinct prompt when query is undefined', () => {
  it('FRONTEND-062-AC-06: does not call seriesApi.getRecommendations when query is undefined', () => {
    render(<RecommendationsList query={undefined} />)

    expect(mockGetRecommendations).not.toHaveBeenCalled()
  })

  it('FRONTEND-062-AC-07: shows no loading spinner when query is undefined', () => {
    render(<RecommendationsList query={undefined} />)

    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
  })

  it('FRONTEND-062-AC-08: shows a not-yet-searched prompt when query is undefined', () => {
    render(<RecommendationsList query={undefined} />)

    expect(
      screen.getByTestId('recommendations-not-searched'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/no recommendations yet/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/no shows match/i)).not.toBeInTheDocument()
  })

  it('FRONTEND-062-AC-10: onLoadingChange does not fire true on mount when query is undefined', () => {
    const onLoadingChange = vi.fn()
    render(
      <RecommendationsList
        query={undefined}
        onLoadingChange={onLoadingChange}
      />,
    )

    expect(onLoadingChange).not.toHaveBeenCalledWith(true)
  })
})

// FRONTEND-062: these tests exercise "a query has already been applied and
// the component fetches" -- an explicit query prop is now required for
// that, since a query-less render no longer fetches at all
// (FRONTEND-062-AC-06/07, covered separately below).
describe('FRONTEND-010-AC-05/06: fetch on mount, loading state', () => {
  it('calls seriesApi.getRecommendations() once on mount', async () => {
    mockGetRecommendations.mockResolvedValue([])
    render(<RecommendationsList query={{}} />)
    await waitFor(() => expect(mockGetRecommendations).toHaveBeenCalledTimes(1))
  })

  it('shows a loading indicator while the fetch is in flight', () => {
    mockGetRecommendations.mockReturnValue(new Promise(() => undefined))
    render(<RecommendationsList query={{}} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('FRONTEND-010-AC-08/09/10: display, empty state', () => {
  it('renders a card per recommendation, with sourceTitles when present', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({
        sourceTitles: ['Breaking Bad'],
        totalSourceCount: 1,
      }),
    ])
    render(<RecommendationsList query={{}} />)

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

  it('shows the Use My Series empty-state message when sourceMode is useMySeries', async () => {
    mockGetRecommendations.mockResolvedValue([])
    render(<RecommendationsList query={{ sourceMode: 'useMySeries' }} />)

    expect(
      await screen.findByText(/no recommendations yet/i),
    ).toBeInTheDocument()
  })

  // Fix 2 (2026-08-28, live testing -- pre-existing bug, not part of any
  // open spec): the "mark a series as Completed" message only makes sense
  // for "Use My Series" pool-based sourcing -- every other case (Trending,
  // Highest Rated, Custom Search, or no query/undefined at all) now shows a
  // generic "no results" message instead.
  it('shows a generic empty-state message when sourceMode is not useMySeries', async () => {
    mockGetRecommendations.mockResolvedValue([])
    render(<RecommendationsList query={{ sourceMode: 'trending' }} />)

    expect(
      await screen.findByText(/no shows match these filters/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/no recommendations yet/i),
    ).not.toBeInTheDocument()
  })

  // FRONTEND-062 (2026-09-01): this test used to assert the generic
  // empty-results message when no query is provided -- that's no longer
  // true. "No query at all" now means "nothing has been searched yet"
  // (FRONTEND-062-AC-08), a distinct prompt checked ahead of the
  // empty-results branch this test used to exercise. See
  // FRONTEND-062-AC-06/07/08 below for the dedicated coverage of that
  // no-query state; this test now asserts the still-applicable case of a
  // real (but empty/unfiltered) query genuinely finding no results.
  it('shows the generic empty-state message when the applied query has no filters', async () => {
    mockGetRecommendations.mockResolvedValue([])
    render(<RecommendationsList query={{}} />)

    expect(
      await screen.findByText(/no shows match these filters/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-019-AC-05/06: multi-source "Because you watched" label', () => {
  it('joins sourceTitles with a plain comma when there is no overflow', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({
        sourceTitles: ['Slow Horses', '24'],
        totalSourceCount: 2,
      }),
    ])
    render(<RecommendationsList query={{}} />)

    expect(
      await screen.findByText('Because you watched Slow Horses, 24'),
    ).toBeInTheDocument()
  })

  it('appends "and N more" when totalSourceCount exceeds sourceTitles.length', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({
        sourceTitles: ['Slow Horses', '24'],
        totalSourceCount: 3,
      }),
    ])
    render(<RecommendationsList query={{}} />)

    expect(
      await screen.findByText('Because you watched Slow Horses, 24 and 1 more'),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-019-AC-07: no line when sourceTitles is empty', () => {
  it('does not render "Because you watched" when sourceTitles is []', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ sourceTitles: [], totalSourceCount: 0 }),
    ])
    render(<RecommendationsList query={{}} />)

    await screen.findByText('Ozark')
    expect(screen.queryByText(/because you watched/i)).not.toBeInTheDocument()
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
    render(<RecommendationsList query={{}} />)

    await screen.findByRole('alert')
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
    render(<RecommendationsList query={{}} />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /mark as watched/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText(/^title/i)).toHaveValue('Ozark')
    expect(
      within(dialog).queryByRole('combobox', { name: /^status/i }),
    ).not.toBeInTheDocument()
    expect(within(dialog).getByText(/^completed$/i)).toBeInTheDocument()

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
    render(<RecommendationsList query={{}} />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /add to list/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText(/^title/i)).toHaveValue('Ozark')
    expect(
      within(dialog).queryByRole('combobox', { name: /^status/i }),
    ).not.toBeInTheDocument()
    expect(within(dialog).getByText(/^backlog$/i)).toBeInTheDocument()
  })

  it('FRONTEND-034-AC-02: opens AddSeriesForm with source=recommendation, hiding refresh-populated fields', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    render(<RecommendationsList query={{}} />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /add to list/i }))

    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).queryByLabelText(/total seasons/i),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByLabelText(/total episodes/i),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByLabelText(/^imdb rating/i),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByLabelText(/rotten tomatoes rating/i),
    ).not.toBeInTheDocument()
  })

  it('closes the form without removing the card on cancel', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    render(<RecommendationsList query={{}} />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /mark as watched/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Ozark')).toBeInTheDocument()
  })
})

describe('FRONTEND-010-AC-21/22: auto-refresh after a successful save', () => {
  it('calls seriesApi.refresh with the new series id after Mark as Watched succeeds, without blocking card removal', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    mockCreate.mockResolvedValue({ id: 'new-id', title: 'Ozark' } as Series)
    mockRefresh.mockResolvedValue({
      series: { id: 'new-id', title: 'Ozark' } as Series,
      omdbRefreshed: true,
      tmdbRefreshed: true,
    })
    render(<RecommendationsList query={{}} />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /mark as watched/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByText('Ozark')).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledWith('new-id'))
  })

  it('calls seriesApi.refresh with the new series id after Add to List succeeds', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    mockCreate.mockResolvedValue({ id: 'new-id', title: 'Ozark' } as Series)
    mockRefresh.mockResolvedValue({
      series: { id: 'new-id', title: 'Ozark' } as Series,
      omdbRefreshed: true,
      tmdbRefreshed: true,
    })
    render(<RecommendationsList query={{}} />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /add to list/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledWith('new-id'))
  })
})

describe('FRONTEND-010-AC-23: a failed auto-refresh is silent', () => {
  it('does not show an error when the background refresh call rejects', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    mockCreate.mockResolvedValue({ id: 'new-id', title: 'Ozark' } as Series)
    mockRefresh.mockRejectedValue(
      new ApiError(502, 'Unable to reach the series lookup service.'),
    )
    render(<RecommendationsList query={{}} />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /mark as watched/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledWith('new-id'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-010-AC-15/16/17: ignore', () => {
  it('calls ignoreSeries and removes the card immediately on success', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    mockIgnoreSeries.mockResolvedValue(undefined)
    render(<RecommendationsList query={{}} />)
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
    render(<RecommendationsList query={{}} />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByTestId('ignore-btn'))

    await screen.findByRole('alert')
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
    render(<RecommendationsList query={{}} />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getAllByTestId('ignore-btn')[0])

    await screen.findByRole('alert')
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
    render(<RecommendationsList query={{}} />)

    expect(
      screen.getByText(
        /this product uses the tmdb api but is not endorsed or certified by tmdb/i,
      ),
    ).toBeInTheDocument()

    await screen.findByText(/no shows match these filters/i)
    expect(
      screen.getByText(
        /this product uses the tmdb api but is not endorsed or certified by tmdb/i,
      ),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-020-AC-02/03: rating and vote count rendered', () => {
  it('renders the rating to one decimal place with a formatted vote count', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ tmdbRating: 7.749, voteCount: 1500 }),
    ])
    render(<RecommendationsList query={{}} />)

    expect(await screen.findByText('7.7 (1,500 votes)')).toBeInTheDocument()
  })
})

describe('FRONTEND-020-AC-04: rating alone when voteCount is null', () => {
  it('renders just the rating', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ tmdbRating: 8, voteCount: null }),
    ])
    render(<RecommendationsList query={{}} />)

    expect(await screen.findByText('8.0')).toBeInTheDocument()
  })
})

describe('FRONTEND-020-AC-05: nothing rendered when tmdbRating is null', () => {
  it('renders no rating text', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ tmdbRating: null, voteCount: null }),
    ])
    render(<RecommendationsList query={{}} />)

    await screen.findByText('Ozark')
    expect(screen.queryByText(/votes\)/)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-028-AC-04: origin country shown on every card', () => {
  it('displays the resolved country name when originCountry is set', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ originCountry: 'GB' }),
    ])
    render(<RecommendationsList query={{}} />)

    expect(await screen.findByText(/united kingdom/i)).toBeInTheDocument()
  })

  it('renders nothing extra when originCountry is null', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ originCountry: null }),
    ])
    render(<RecommendationsList query={{}} />)

    await screen.findByText('Ozark')
    expect(screen.queryByText(/united/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-025-AC-03: streaming providers rendered', () => {
  it('renders provider name and logo when present', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({
        streamingProviders: [
          {
            name: 'Netflix',
            logoUrl: 'https://image.tmdb.org/t/p/w92/abc.jpg',
          },
        ],
      }),
    ])
    render(<RecommendationsList query={{}} />)

    expect(await screen.findByText('Netflix')).toBeInTheDocument()
    expect(screen.getByAltText('Netflix')).toHaveAttribute(
      'src',
      'https://image.tmdb.org/t/p/w92/abc.jpg',
    )
  })

  it('renders the name alone when logoUrl is null', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({
        streamingProviders: [{ name: 'BBC iPlayer', logoUrl: null }],
      }),
    ])
    render(<RecommendationsList query={{}} />)

    expect(await screen.findByText('BBC iPlayer')).toBeInTheDocument()
    expect(screen.queryByAltText('BBC iPlayer')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-025-AC-04: empty streamingProviders shows a quiet note', () => {
  it('renders the not-streaming note instead of a provider list', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ streamingProviders: [] }),
    ])
    render(<RecommendationsList query={{}} />)

    expect(
      await screen.findByText('Not currently streaming in the UK'),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-025-AC-05: JustWatch attribution', () => {
  it('renders a JustWatch attribution line alongside the TMDB one', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation({})])
    render(<RecommendationsList query={{}} />)

    await screen.findByText('Ozark')
    expect(
      screen.getByText('Streaming data via JustWatch.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/uses the TMDB API but is not endorsed/),
    ).toBeInTheDocument()
  })
})

describe("FRONTEND-028-AC-09/10/FRONTEND-053: keywords are fetched only on a card's own View Details click", () => {
  it('does not call getRecommendationKeywords on initial render', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    render(<RecommendationsList query={{}} />)

    await screen.findByText('Ozark')
    expect(mockGetRecommendationKeywords).not.toHaveBeenCalled()
  })

  it('calls getRecommendationKeywords with the card\'s tmdbId when "View Details" is clicked', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ tmdbId: 4046 }),
    ])
    mockGetRecommendationKeywords.mockResolvedValue(['spy', 'mi5'])
    render(<RecommendationsList query={{}} />)

    await screen.findByText('Ozark')
    fireEvent.click(screen.getByTestId('view-details-btn'))

    await waitFor(() =>
      expect(mockGetRecommendationKeywords).toHaveBeenCalledWith(4046),
    )
  })
})

describe('FRONTEND-028-AC-11/12/13/FRONTEND-053: per-card loading, error, and result states', () => {
  it('shows a scoped loading state while the fetch is in flight', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    mockGetRecommendationKeywords.mockReturnValue(new Promise(() => undefined))
    render(<RecommendationsList query={{}} />)

    await screen.findByText('Ozark')
    fireEvent.click(screen.getByTestId('view-details-btn'))

    expect(await screen.findByText(/loading keywords/i)).toBeInTheDocument()
  })

  it('shows a scoped error message when the fetch rejects', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    mockGetRecommendationKeywords.mockRejectedValue(
      new ApiError(500, 'Failed to load keywords'),
    )
    render(<RecommendationsList query={{}} />)

    await screen.findByText('Ozark')
    fireEvent.click(screen.getByTestId('view-details-btn'))

    expect(await screen.findByText(/keywords unavailable/i)).toBeInTheDocument()
  })

  it('renders each keyword and an explicit empty message when none are found', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    mockGetRecommendationKeywords.mockResolvedValue([])
    render(<RecommendationsList query={{}} />)

    await screen.findByText('Ozark')
    fireEvent.click(screen.getByTestId('view-details-btn'))

    expect(await screen.findByText(/no keywords found/i)).toBeInTheDocument()
  })

  it('renders each keyword as a chip when the fetch resolves with results', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    mockGetRecommendationKeywords.mockResolvedValue(['spy', 'mi5'])
    render(<RecommendationsList query={{}} />)

    await screen.findByText('Ozark')
    fireEvent.click(screen.getByTestId('view-details-btn'))

    expect(await screen.findByText('spy')).toBeInTheDocument()
    expect(screen.getByText('mi5')).toBeInTheDocument()
  })

  it('does not affect the list-wide error/loading state on a per-card keyword error', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    mockGetRecommendationKeywords.mockRejectedValue(
      new ApiError(500, 'Failed to load keywords'),
    )
    render(<RecommendationsList query={{}} />)

    await screen.findByText('Ozark')
    fireEvent.click(screen.getByTestId('view-details-btn'))

    await screen.findByText(/keywords unavailable/i)
    expect(screen.getAllByText('Ozark').length).toBeGreaterThan(0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

// frontend_spec_040_recommendation_controls_apply_and_lock.md
describe('FRONTEND-040-AC-05: onLoadingChange broadcasts loading transitions', () => {
  // FRONTEND-062-AC-10: this test's render call now passes an explicit,
  // non-undefined query -- it was implicitly relying on the mount-always-
  // fetches behavior this spec removes (a query-less mount no longer
  // fetches at all, so `loading` would never flip to true to broadcast).
  it('is called as loading transitions on mount', async () => {
    const onLoadingChange = vi.fn()
    mockGetRecommendations.mockResolvedValue([])
    render(<RecommendationsList query={{}} onLoadingChange={onLoadingChange} />)

    expect(onLoadingChange).toHaveBeenCalledWith(true)
    await waitFor(() => expect(onLoadingChange).toHaveBeenLastCalledWith(false))
  })

  it('is called again on a subsequent query change', async () => {
    const onLoadingChange = vi.fn()
    mockGetRecommendations.mockResolvedValue([])
    const { rerender } = render(
      <RecommendationsList
        query={{ genres: ['Drama'] }}
        onLoadingChange={onLoadingChange}
      />,
    )
    await waitFor(() => expect(onLoadingChange).toHaveBeenLastCalledWith(false))
    onLoadingChange.mockClear()

    rerender(
      <RecommendationsList
        query={{ genres: ['Comedy'] }}
        onLoadingChange={onLoadingChange}
      />,
    )

    expect(onLoadingChange).toHaveBeenCalledWith(true)
    await waitFor(() => expect(onLoadingChange).toHaveBeenLastCalledWith(false))
  })
})
