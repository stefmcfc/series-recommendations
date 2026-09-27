import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { KeywordRecommendationsModal } from './KeywordRecommendationsModal'
import { seriesApi } from '../services/seriesApi'

vi.mock('../services/seriesApi')
const mockGetRecommendations = vi.mocked(seriesApi.getRecommendations)

function makeRecommendation(overrides = {}) {
  return {
    tmdbId: 70523,
    imdbId: 'tt1234567',
    title: 'Dark',
    year: 2017,
    genres: 'Drama, Mystery',
    overview: 'A time travel mystery.',
    posterUrl: null,
    tmdbRating: 8.6,
    voteCount: 1000,
    originCountry: null,
    streamingProviders: [],
    sourceTitles: [],
    totalSourceCount: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// FRONTEND-133-AC-09: KeywordRecommendationsModal is modeled directly on
// SeriesRecommendationsModal.tsx's shape (loading/error/empty/results
// states, fetch-on-mount), seeded by a keyword string instead of a series
// id -- calling seriesApi.getRecommendations({ keywords: [keyword] })
// exactly (no sourceMode/region, unlike SeriesRecommendationsModal), per
// this AC's own statement.
describe('FRONTEND-133-AC-09: fetch-on-mount and state handling', () => {
  it('fetches recommendations for the seeded keyword on mount', () => {
    mockGetRecommendations.mockReturnValue(new Promise(() => {}))
    render(
      <KeywordRecommendationsModal keyword="time travel" onClose={vi.fn()} />,
    )
    expect(mockGetRecommendations).toHaveBeenCalledWith({
      keywords: ['time travel'],
    })
  })

  it('shows a loading state while the fetch is in flight', () => {
    mockGetRecommendations.mockReturnValue(new Promise(() => {}))
    render(
      <KeywordRecommendationsModal keyword="time travel" onClose={vi.fn()} />,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error state with retry when the fetch rejects', async () => {
    mockGetRecommendations.mockRejectedValueOnce(new Error('fail'))
    render(
      <KeywordRecommendationsModal keyword="time travel" onClose={vi.fn()} />,
    )
    expect(
      await screen.findByRole('button', { name: /retry/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('retry re-fetches and clears the error on success', async () => {
    mockGetRecommendations.mockRejectedValueOnce(new Error('fail'))
    render(
      <KeywordRecommendationsModal keyword="time travel" onClose={vi.fn()} />,
    )
    const retryButton = await screen.findByRole('button', { name: /retry/i })

    mockGetRecommendations.mockResolvedValueOnce([makeRecommendation()])
    fireEvent.click(retryButton)

    expect(await screen.findByText('Dark')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an empty state when no recommendations are found', async () => {
    mockGetRecommendations.mockResolvedValue([])
    render(
      <KeywordRecommendationsModal keyword="time travel" onClose={vi.fn()} />,
    )
    expect(
      await screen.findByText(/no recommendations found for this keyword/i),
    ).toBeInTheDocument()
  })

  it('renders a recommendation card per result, seeded from the keyword', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    render(
      <KeywordRecommendationsModal keyword="time travel" onClose={vi.fn()} />,
    )
    expect(await screen.findByText('Dark')).toBeInTheDocument()
  })

  it('renders a dialog labelled with the seeded keyword', async () => {
    mockGetRecommendations.mockResolvedValue([])
    render(
      <KeywordRecommendationsModal keyword="time travel" onClose={vi.fn()} />,
    )
    expect(
      await screen.findByRole('dialog', {
        name: /Recommendations for time travel/i,
      }),
    ).toBeInTheDocument()
  })

  it('calls onClose when Done is clicked', async () => {
    mockGetRecommendations.mockResolvedValue([])
    const onClose = vi.fn()
    render(
      <KeywordRecommendationsModal keyword="time travel" onClose={onClose} />,
    )
    await waitFor(() => expect(mockGetRecommendations).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
