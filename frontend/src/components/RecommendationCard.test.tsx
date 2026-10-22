import { render, screen, fireEvent, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RecommendationCard } from './RecommendationCard'
import { seriesApi } from '../services/seriesApi'
import type { Recommendation } from '../types/series'
import surface from '../styles/surfaces.module.css'

vi.mock('../services/seriesApi')
const mockGetRecommendationKeywords = vi.mocked(
  seriesApi.getRecommendationKeywords,
)
const mockGetRecommendationDetails = vi.mocked(
  seriesApi.getRecommendationDetails,
)

// FRONTEND-138-AC-05: mirrors GenreDetailModal.test.tsx/
// KeywordDetailModal.test.tsx's own useNavigate mock -- the real hook is
// entirely replaced, so no <MemoryRouter> wrapper is needed around any of
// this file's existing render() calls.
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

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
    trackedSeriesId: null,
    trackedStatus: null,
    trackedPersonalRating: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-052-AC-01: RecommendationCard renders standalone', () => {
  it('reports Mark as Watched/Add to List/Ignore via callback props', () => {
    const onMarkWatched = vi.fn()
    const onAddToList = vi.fn()
    const onIgnore = vi.fn()
    const recommendation = makeRecommendation()
    render(
      <RecommendationCard
        recommendation={recommendation}
        onMarkWatched={onMarkWatched}
        onAddToList={onAddToList}
        onIgnore={onIgnore}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /mark as watched/i }))
    expect(onMarkWatched).toHaveBeenCalledWith(recommendation)

    fireEvent.click(screen.getByRole('button', { name: /add to list/i }))
    expect(onAddToList).toHaveBeenCalledWith(recommendation)

    fireEvent.click(screen.getByTestId('ignore-btn'))
    expect(onIgnore).toHaveBeenCalledWith(recommendation)
  })

  it('disables Ignore and shows a scoped alert when ignoring/ignoreError props are set', () => {
    render(
      <RecommendationCard
        recommendation={makeRecommendation()}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
        ignoring
        ignoreError="Internal server error"
      />,
    )

    expect(screen.getByTestId('ignore-btn')).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Internal server error')
  })

  it('hides a poster image after it fails to load', () => {
    render(
      <RecommendationCard
        recommendation={makeRecommendation({
          posterUrl: 'https://example.com/p.jpg',
        })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )

    expect(screen.getByAltText('')).toBeInTheDocument()
    fireEvent.error(screen.getByAltText(''))
    expect(screen.queryByAltText('')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-053-AC-01: View Details replaces Show keywords', () => {
  it('renders View Details, not Show keywords', () => {
    render(
      <RecommendationCard
        recommendation={makeRecommendation()}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )
    expect(screen.getByTestId('view-details-btn')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /show keywords/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-053-AC-03/04: View Details opens the candidate detail modal', () => {
  it("opens a dialog with the candidate's already-known fields", async () => {
    mockGetRecommendationDetails.mockResolvedValue({
      numberOfSeasons: null,
      numberOfEpisodes: null,
      imdbRating: null,
    })
    mockGetRecommendationKeywords.mockResolvedValue([])

    render(
      <RecommendationCard
        recommendation={makeRecommendation({
          title: 'Ozark',
          overview: 'A money-laundering scheme...',
        })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('view-details-btn'))
    const dialog = await screen.findByRole('dialog', { name: /ozark/i })
    expect(
      within(dialog).getByText(/money-laundering scheme/i),
    ).toBeInTheDocument()
  })

  it('fetches and renders details and keywords independently', async () => {
    mockGetRecommendationDetails.mockResolvedValue({
      numberOfSeasons: 5,
      numberOfEpisodes: 62,
      imdbRating: 9.5,
    })
    mockGetRecommendationKeywords.mockRejectedValue(new Error('unavailable'))

    render(
      <RecommendationCard
        recommendation={makeRecommendation({
          tmdbId: 1396,
          imdbId: 'tt0903747',
        })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('view-details-btn'))

    expect(await screen.findByText('5')).toBeInTheDocument() // Seasons
    expect(screen.getByText('9.5')).toBeInTheDocument() // IMDb Rating
    expect(await screen.findByText(/keywords unavailable/i)).toBeInTheDocument() // independent failure
    expect(mockGetRecommendationDetails).toHaveBeenCalledWith(1396, 'tt0903747')
    expect(mockGetRecommendationKeywords).toHaveBeenCalledWith(1396)
  })

  it('renders — for each null detail field and closes on Escape', async () => {
    mockGetRecommendationDetails.mockResolvedValue({
      numberOfSeasons: null,
      numberOfEpisodes: null,
      imdbRating: null,
    })
    mockGetRecommendationKeywords.mockResolvedValue(['dark comedy'])

    render(
      <RecommendationCard
        recommendation={makeRecommendation()}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('view-details-btn'))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('dark comedy')).toBeInTheDocument()
    expect(within(dialog).getAllByText('—').length).toBeGreaterThanOrEqual(3)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-085-AC-06: RecommendationCard/RecommendationDetailModal show every origin country', () => {
  it('renders both countries in the card', () => {
    render(
      <RecommendationCard
        recommendation={makeRecommendation({ originCountry: 'GB,US' })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )

    expect(
      screen.getByText(/United Kingdom, United States/),
    ).toBeInTheDocument()
  })

  it('renders both countries in the detail modal', async () => {
    mockGetRecommendationDetails.mockResolvedValue({
      numberOfSeasons: null,
      numberOfEpisodes: null,
      imdbRating: null,
    })
    mockGetRecommendationKeywords.mockResolvedValue([])

    render(
      <RecommendationCard
        recommendation={makeRecommendation({ originCountry: 'GB,US' })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('view-details-btn'))
    const dialog = await screen.findByRole('dialog')

    expect(
      within(dialog).getByText(/United Kingdom, United States/),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-105-AC-07: recommendation cards compose the shared surface primitive', () => {
  it('applies surface.card to the card wrapper', () => {
    render(
      <RecommendationCard
        recommendation={makeRecommendation({ title: 'Fargo' })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )
    expect(screen.getByText('Fargo').closest(`.${surface.card}`)).toBeTruthy()
  })
})

describe('FRONTEND-138-AC-04: already-tracked card rendering', () => {
  it('shows a status/rating badge instead of Mark Watched/Add to List/Ignore', () => {
    render(
      <RecommendationCard
        recommendation={makeRecommendation({
          trackedSeriesId: 'series-1',
          trackedStatus: 'WATCHING',
          trackedPersonalRating: 4,
        })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )

    const badge = screen.getByTestId('tracked-badge')
    expect(badge).toHaveTextContent('WATCHING')
    expect(within(badge).getByLabelText('Personal rating')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /mark as watched/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /add to list/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('ignore-btn')).not.toBeInTheDocument()
    expect(screen.getByTestId('view-details-btn')).toBeInTheDocument()
    expect(screen.getByTestId('tracked-eyebrow')).toHaveTextContent(
      'In My Series',
    )
  })

  it('omits the personal rating segment when trackedPersonalRating is null', () => {
    render(
      <RecommendationCard
        recommendation={makeRecommendation({
          trackedSeriesId: 'series-1',
          trackedStatus: 'BACKLOG',
          trackedPersonalRating: null,
        })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )

    const badge = screen.getByTestId('tracked-badge')
    expect(badge).toHaveTextContent('BACKLOG')
    expect(within(badge).queryByLabelText('Personal rating')).toBeNull()
  })

  it('shows the normal three action buttons when trackedSeriesId is null', () => {
    render(
      <RecommendationCard
        recommendation={makeRecommendation({ trackedSeriesId: null })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: /mark as watched/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /add to list/i }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('ignore-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('tracked-badge')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tracked-eyebrow')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-138-AC-05: tracked badge navigation', () => {
  it('navigates to the series detail route when clicked', () => {
    render(
      <RecommendationCard
        recommendation={makeRecommendation({
          trackedSeriesId: 'series-42',
          trackedStatus: 'COMPLETED',
          trackedPersonalRating: 5,
        })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId('tracked-badge'))

    expect(mockNavigate).toHaveBeenCalledWith('/my-series/view/series-42')
  })
})
