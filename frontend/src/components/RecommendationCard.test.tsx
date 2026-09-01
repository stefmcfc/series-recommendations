import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RecommendationCard } from './RecommendationCard'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { Recommendation } from '../types/series'

vi.mock('../services/seriesApi')
const mockGetRecommendationKeywords = vi.mocked(
  seriesApi.getRecommendationKeywords,
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
  it('renders a recommendation and supports Show keywords independently of any list', async () => {
    mockGetRecommendationKeywords.mockResolvedValue(['dark comedy', 'cartel'])

    render(
      <RecommendationCard
        recommendation={makeRecommendation({ title: 'Ozark' })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )
    expect(screen.getByText('Ozark')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show keywords/i }))
    expect(await screen.findByText(/dark comedy/i)).toBeInTheDocument()
  })

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

  it('shows a scoped error when the keywords fetch rejects, independent of any list', async () => {
    mockGetRecommendationKeywords.mockRejectedValue(
      new ApiError(500, 'Failed to load keywords'),
    )
    render(
      <RecommendationCard
        recommendation={makeRecommendation()}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /show keywords/i }))
    expect(
      await screen.findByText('Failed to load keywords'),
    ).toBeInTheDocument()
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
