import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RecommendationControls } from './RecommendationControls'
import { seriesApi } from '../services/seriesApi'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: '1',
    title: 'Ozark',
    year: 2017,
    genres: 'Crime, Drama',
    totalSeasons: 4,
    totalEpisodes: 44,
    currentSeason: null,
    currentEpisode: null,
    status: 'COMPLETED',
    imdbRating: 8.4,
    metacriticRating: null,
    rottenTomatoesRating: null,
    personalRating: null,
    personalNotes: null,
    posterUrl: null,
    imdbId: 'tt5071412',
    dateAdded: '2024-01-01T00:00:00Z',
    dateCompleted: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAll.mockResolvedValue([])
})

describe('FRONTEND-011-AC-03: three-way sourcing mode selector', () => {
  it('renders Automatic, Specific Series, and Genre & Keyword options, defaulting to Automatic', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    expect(screen.getByLabelText(/^automatic/i)).toBeChecked()
    expect(screen.getByLabelText(/specific series/i)).not.toBeChecked()
    expect(screen.getByLabelText(/genre & keyword/i)).not.toBeChecked()
  })
})

describe('FRONTEND-011-AC-04: Specific Series multi-select via getAll()', () => {
  it('fetches series and renders a checkbox per series, populating seriesIds when checked', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', status: 'COMPLETED' }),
      makeSeries({ id: '2', title: 'The Wire', status: 'WATCHING' }),
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/specific series/i))

    const ozarkCheckbox = await screen.findByLabelText(/ozark/i)
    expect(ozarkCheckbox).toBeInTheDocument()
    expect(screen.getByLabelText(/the wire/i)).toBeInTheDocument()

    fireEvent.click(ozarkCheckbox)

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesIds: ['1'] }),
    )

    fireEvent.click(screen.getByLabelText(/the wire/i))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesIds: ['1', '2'] }),
    )

    fireEvent.click(ozarkCheckbox)
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesIds: ['2'] }),
    )
  })
})

describe('FRONTEND-011-AC-05: Genre & Keyword text inputs and at-least-one hint', () => {
  it('populates genres/keywords from comma-separated text', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    fireEvent.change(screen.getByLabelText(/^genres/i), {
      target: { value: 'Drama, Crime ,' },
    })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Drama', 'Crime'] }),
    )

    fireEvent.change(screen.getByLabelText(/^keywords/i), {
      target: { value: 'heist' },
    })
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        genres: ['Drama', 'Crime'],
        keywords: ['heist'],
      }),
    )
  })

  it('shows a hint and omits genres/keywords from the query when both are empty', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))

    expect(
      screen.getByText(/enter at least one genre or keyword/i),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^genres/i), {
      target: { value: 'Drama' },
    })
    expect(
      screen.queryByText(/enter at least one genre or keyword/i),
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^genres/i), {
      target: { value: '' },
    })
    expect(
      screen.getByText(/enter at least one genre or keyword/i),
    ).toBeInTheDocument()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ genres: expect.anything() }),
    )
  })
})

describe('FRONTEND-011-AC-06: mode switching clears stale fields', () => {
  it('clears genres/keywords when switching from Genre & Keyword to Specific Series', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    fireEvent.change(screen.getByLabelText(/^genres/i), {
      target: { value: 'Drama' },
    })
    fireEvent.click(screen.getByLabelText(/specific series/i))

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ genres: expect.anything() }),
    )
  })

  it('clears seriesIds when switching from Specific Series to Genre & Keyword', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Ozark' })])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/specific series/i))
    const checkbox = await screen.findByLabelText(/ozark/i)
    fireEvent.click(checkbox)
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesIds: ['1'] }),
    )

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ seriesIds: expect.anything() }),
    )
  })
})

describe('FRONTEND-011-AC-07: output filter fields', () => {
  it('renders the Filters section collapsed by default', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    expect(screen.queryByLabelText(/min tmdb rating/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    expect(screen.getByLabelText(/min tmdb rating/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/min vote count/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/year min/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/year max/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/exclude genres/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^language/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/max per source/i)).toBeInTheDocument()
  })

  it('shows minSourceRating for Automatic/Specific Series but not Genre & Keyword', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    expect(screen.getByLabelText(/min source rating/i)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    expect(
      screen.queryByLabelText(/min source rating/i),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/specific series/i))
    expect(screen.getByLabelText(/min source rating/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-011-AC-08: empty filter fields omitted, not sent as empty/zero', () => {
  it('omits minVoteCount from the query when the field is left blank', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))

    fireEvent.change(screen.getByLabelText(/min tmdb rating/i), {
      target: { value: '7' },
    })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ minVoteCount: expect.anything() }),
    )
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ minTmdbRating: 7 }),
    )
  })

  it('sends numeric, not string, values for populated number fields', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))

    fireEvent.change(screen.getByLabelText(/min vote count/i), {
      target: { value: '50' },
    })
    fireEvent.change(screen.getByLabelText(/year min/i), {
      target: { value: '2020' },
    })
    fireEvent.change(screen.getByLabelText(/^language/i), {
      target: { value: 'en' },
    })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        minVoteCount: 50,
        yearMin: 2020,
        language: 'en',
      }),
    )
  })
})

describe('FRONTEND-011-AC-09: Reset Filters', () => {
  it('clears every filter field but leaves sourcing mode/selection untouched, and re-fetches', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Ozark' })])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/specific series/i))
    const checkbox = await screen.findByLabelText(/ozark/i)
    fireEvent.click(checkbox)

    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    fireEvent.change(screen.getByLabelText(/min tmdb rating/i), {
      target: { value: '7' },
    })
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesIds: ['1'], minTmdbRating: 7 }),
    )

    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }))

    expect(onQueryChange).toHaveBeenLastCalledWith({ seriesIds: ['1'] })
    expect(screen.getByLabelText(/min tmdb rating/i)).toHaveValue(null)
  })
})

describe('FRONTEND-011-AC-12: every control change triggers onQueryChange, no Apply button', () => {
  it('has no Apply/Submit button in the panel', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    expect(
      screen.queryByRole('button', { name: /^apply$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^submit$/i }),
    ).not.toBeInTheDocument()
  })

  it('does not call onQueryChange just from mounting', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    expect(onQueryChange).not.toHaveBeenCalled()
  })
})

describe('specific-series fetch failure', () => {
  it('does not crash if seriesApi.getAll() rejects', async () => {
    mockGetAll.mockRejectedValue(new Error('network error'))
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/specific series/i))
    await waitFor(() => expect(mockGetAll).toHaveBeenCalled())
  })
})
