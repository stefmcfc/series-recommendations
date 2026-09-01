import { render, screen, fireEvent, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RecommendationCard } from './RecommendationCard'
import { seriesApi } from '../services/seriesApi'
import type { Recommendation } from '../types/series'

vi.mock('../services/seriesApi')
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
