import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { GenreDetailModal } from './GenreDetailModal'
import { seriesApi } from '../services/seriesApi'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockSearch = vi.mocked(seriesApi.search)

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'test-id',
    title: 'Test Show',
    year: null,
    lastAirYear: null,
    genres: null,
    tags: null,
    totalSeasons: null,
    totalEpisodes: null,
    currentSeason: null,
    currentEpisode: null,
    status: SeriesStatus.BACKLOG,
    imdbRating: null,
    rottenTomatoesRating: null,
    rottenTomatoesPopcornmeter: null,
    tmdbRating: null,
    tmdbVoteCount: null,
    personalRating: null,
    personalNotes: null,
    posterUrl: null,
    imdbId: null,
    dateAdded: '2026-01-01T00:00:00Z',
    dateCompleted: null,
    lastRefreshedAt: null,
    newContentDetectedAt: null,
    originCountry: null,
    productionStatus: null,
    originalLanguage: null,
    keywords: [],
    overview: null,
    excludeFromRecommendations: false,
    flaggedForRewatch: false,
    ...overrides,
  }
}

function renderModal(props: { genre?: string; onClose?: () => void } = {}) {
  return render(
    <MemoryRouter>
      <GenreDetailModal
        genre={props.genre ?? 'Comedy'}
        onClose={props.onClose ?? vi.fn()}
      />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

// FRONTEND-137-AC-05: fetch-on-mount and loading/error/Retry/empty states,
// mirroring KeywordDetailModal.test.tsx's own conventions.
describe('FRONTEND-137-AC-05: fetch-on-mount and state handling', () => {
  it('fetches all-status series for the seeded genre on mount', () => {
    mockSearch.mockReturnValue(new Promise(() => {}))
    renderModal({ genre: 'Comedy' })
    expect(mockSearch).toHaveBeenCalledWith({ genres: ['Comedy'] })
  })

  it('shows a loading state while the fetch is in flight', () => {
    mockSearch.mockReturnValue(new Promise(() => {}))
    renderModal()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error state with retry when the fetch rejects', async () => {
    mockSearch.mockRejectedValueOnce(new Error('fail'))
    renderModal()
    expect(
      await screen.findByRole('button', { name: /retry/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('retry re-fetches and clears the error on success', async () => {
    mockSearch.mockRejectedValueOnce(new Error('fail'))
    renderModal()
    const retryButton = await screen.findByRole('button', { name: /retry/i })

    mockSearch.mockResolvedValueOnce({ series: [], excludedCount: 0 })
    fireEvent.click(retryButton)

    expect(
      await screen.findByText(/no series found for this genre/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an empty state when the result is empty', async () => {
    mockSearch.mockResolvedValue({ series: [], excludedCount: 0 })
    renderModal()
    expect(
      await screen.findByText(/no series found for this genre/i),
    ).toBeInTheDocument()
  })

  it('renders a row with name/status/personal rating/computed blended rating per result', async () => {
    mockSearch.mockResolvedValueOnce({
      series: [
        makeSeries({
          id: '1',
          title: 'Dark',
          status: SeriesStatus.COMPLETED,
          personalRating: 9,
          imdbRating: 8.8,
          tmdbRating: 8.4,
        }),
      ],
      excludedCount: 0,
    })
    renderModal()
    expect(await screen.findByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('8.6')).toBeInTheDocument() // (8.8 + 8.4) / 2, 1dp
  })

  it('renders a dialog labelled with the seeded genre', async () => {
    mockSearch.mockResolvedValue({ series: [], excludedCount: 0 })
    renderModal({ genre: 'Comedy' })
    expect(
      await screen.findByRole('dialog', { name: /Comedy/i }),
    ).toBeInTheDocument()
  })

  it('calls onClose when Done is clicked', async () => {
    mockSearch.mockResolvedValue({ series: [], excludedCount: 0 })
    const onClose = vi.fn()
    renderModal({ onClose })
    await screen.findByText(/no series found for this genre/i)

    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(onClose).toHaveBeenCalled()
  })
})

// FRONTEND-137-AC-05: client-side column sort, no re-fetch.
describe('FRONTEND-137-AC-05: client-side column sort', () => {
  it('sorts rows by personal rating on header click, without re-fetching', async () => {
    mockSearch.mockResolvedValueOnce({
      series: [
        makeSeries({ id: '1', title: 'Dark', personalRating: 9 }),
        makeSeries({ id: '2', title: 'Alias', personalRating: 3 }),
        makeSeries({ id: '3', title: 'Loki', personalRating: 6 }),
      ],
      excludedCount: 0,
    })
    renderModal()
    await screen.findByRole('table')

    fireEvent.click(
      screen.getByRole('columnheader', { name: /Personal Rating/i }),
    )
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('Dark')).toBeInTheDocument() // highest personalRating first
    expect(mockSearch).toHaveBeenCalledTimes(1) // sorting never re-fetches
  })

  it('reverses direction on a second click of the same header', async () => {
    mockSearch.mockResolvedValueOnce({
      series: [
        makeSeries({ id: '1', title: 'Dark', personalRating: 9 }),
        makeSeries({ id: '2', title: 'Alias', personalRating: 3 }),
      ],
      excludedCount: 0,
    })
    renderModal()
    await screen.findByRole('table')

    const header = screen.getByRole('columnheader', {
      name: /Personal Rating/i,
    })
    fireEvent.click(header)
    fireEvent.click(header)
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('Alias')).toBeInTheDocument()
  })

  it('defaults to ascending by name, and reverses on header click', async () => {
    mockSearch.mockResolvedValueOnce({
      series: [
        makeSeries({ id: '1', title: 'Zeta' }),
        makeSeries({ id: '2', title: 'Alpha' }),
      ],
      excludedCount: 0,
    })
    renderModal()
    await screen.findByRole('table')

    let rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('Alpha')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('columnheader', { name: /^Name/i }))
    rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('Zeta')).toBeInTheDocument()
  })
})

// FRONTEND-137-AC-05: row click navigates to the series' detail route.
describe('FRONTEND-137-AC-05: row click navigates to SeriesDetail', () => {
  it("navigates to the clicked series' detail route", async () => {
    mockSearch.mockResolvedValueOnce({
      series: [makeSeries({ id: '1', title: 'Dark' })],
      excludedCount: 0,
    })
    renderModal()
    await screen.findByText('Dark')

    fireEvent.click(screen.getByText('Dark'))
    expect(mockNavigate).toHaveBeenCalledWith('/my-series/view/1')
  })
})

// FRONTEND-137-AC-05: favourite toggle inside the modal.
describe('FRONTEND-137-AC-05: favourite toggle inside the modal', () => {
  it('adds the genre to genreFavourites when toggled on', async () => {
    mockSearch.mockResolvedValue({ series: [], excludedCount: 0 })
    renderModal({ genre: 'Comedy' })
    await screen.findByText(/no series found for this genre/i)

    fireEvent.click(screen.getByRole('button', { name: /favourite/i }))
    expect(JSON.parse(localStorage.getItem('genreFavourites')!)).toContain(
      'Comedy',
    )
  })

  it('reflects an already-favourited genre on mount, and removes it when toggled off', async () => {
    localStorage.setItem('genreFavourites', JSON.stringify(['Comedy']))
    mockSearch.mockResolvedValue({ series: [], excludedCount: 0 })
    renderModal({ genre: 'Comedy' })
    await screen.findByText(/no series found for this genre/i)

    expect(screen.getByRole('button', { name: /favourite/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: /favourite/i }))
    expect(JSON.parse(localStorage.getItem('genreFavourites')!)).not.toContain(
      'Comedy',
    )
  })
})
