import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RecommendationControls } from './RecommendationControls'
import { seriesApi } from '../services/seriesApi'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)
const mockGetGenreOptions = vi.mocked(seriesApi.getGenreOptions)
const mockGetKeywordStats = vi.mocked(seriesApi.getKeywordStats)

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: '1',
    title: 'Ozark',
    year: 2017,
    genres: 'Crime, Drama',
    tags: null,
    totalSeasons: 4,
    totalEpisodes: 44,
    currentSeason: null,
    currentEpisode: null,
    status: 'COMPLETED',
    imdbRating: 8.4,
    rottenTomatoesRating: null,
    tmdbRating: null,
    tmdbVoteCount: null,
    personalRating: null,
    personalNotes: null,
    posterUrl: null,
    imdbId: 'tt5071412',
    dateAdded: '2024-01-01T00:00:00Z',
    dateCompleted: null,
    lastRefreshedAt: null,
    newContentDetectedAt: null,
    originCountry: null,
    productionStatus: null,
    keywords: [],
    overview: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAll.mockResolvedValue([])
  mockGetGenreOptions.mockResolvedValue([])
  mockGetKeywordStats.mockResolvedValue([])
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

describe('FRONTEND-014-AC-02: fetches genre options on mount', () => {
  it('calls seriesApi.getGenreOptions() once on mount', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    expect(mockGetGenreOptions).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-014-AC-03: degrades gracefully if getGenreOptions() rejects', () => {
  it('does not crash and still renders the rest of the form', async () => {
    mockGetGenreOptions.mockRejectedValue(new Error('network error'))
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    await waitFor(() => expect(mockGetGenreOptions).toHaveBeenCalled())
    expect(screen.getByText(/^keywords/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-014-AC-04/05: genre checkbox list', () => {
  it('renders a checkbox per fetched genre and toggles genresSelected on click', async () => {
    mockGetGenreOptions.mockResolvedValue(['Action', 'Drama'])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))

    const dramaCheckbox = await screen.findByLabelText('Drama')
    expect(screen.getByLabelText('Action')).toBeInTheDocument()

    fireEvent.click(dramaCheckbox)
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Drama'] }),
    )

    fireEvent.click(screen.getByLabelText('Action'))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Drama', 'Action'] }),
    )

    fireEvent.click(dramaCheckbox)
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Action'] }),
    )
  })
})

describe('FRONTEND-014-AC-06: free-text Genres input is gone', () => {
  it('does not render a text input labelled Genres, but does render the free-text Keywords picker input', async () => {
    mockGetGenreOptions.mockResolvedValue(['Action'])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    await screen.findByLabelText('Action')

    expect(
      screen.queryByRole('textbox', { name: /^genres/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Keywords')).toBeInTheDocument()
  })
})

describe('FRONTEND-014-AC-08: empty genresSelected omits genres from the query', () => {
  it('omits genres when no checkbox is checked', async () => {
    mockGetGenreOptions.mockResolvedValue(['Action'])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'heist' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ genres: expect.anything() }),
    )
  })
})

describe('FRONTEND-014-AC-09: hint reflects genresSelected/keywords emptiness', () => {
  it('hides the hint once a genre checkbox is checked, shows it again once unchecked', async () => {
    mockGetGenreOptions.mockResolvedValue(['Drama'])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    expect(
      screen.getByText(/enter at least one genre or keyword/i),
    ).toBeInTheDocument()

    const dramaCheckbox = await screen.findByLabelText('Drama')
    fireEvent.click(dramaCheckbox)
    expect(
      screen.queryByText(/enter at least one genre or keyword/i),
    ).not.toBeInTheDocument()

    fireEvent.click(dramaCheckbox)
    expect(
      screen.getByText(/enter at least one genre or keyword/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-014-AC-10: switching mode clears genresSelected', () => {
  it('clears checked genres when switching from Genre & Keyword to Specific Series', async () => {
    mockGetGenreOptions.mockResolvedValue(['Drama'])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    const dramaCheckbox = await screen.findByLabelText('Drama')
    fireEvent.click(dramaCheckbox)
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Drama'] }),
    )

    fireEvent.click(screen.getByLabelText(/specific series/i))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ genres: expect.anything() }),
    )
  })
})

describe('FRONTEND-011-AC-06: mode switching clears stale fields', () => {
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

describe('FRONTEND-019-AC-08/09: Max Sources Shown filter field', () => {
  it('renders inside Filters and updates the query when populated', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))

    fireEvent.change(screen.getByLabelText(/max sources shown/i), {
      target: { value: '2' },
    })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxSourcesShown: 2 }),
    )
  })

  it('omits maxSourcesShown from the query when left blank', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))

    fireEvent.change(screen.getByLabelText(/min tmdb rating/i), {
      target: { value: '7' },
    })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ maxSourcesShown: expect.anything() }),
    )
  })
})

describe('FRONTEND-019-AC-10: Reset Filters clears Max Sources Shown', () => {
  it('clears a populated Max Sources Shown field on Reset Filters', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))

    fireEvent.change(screen.getByLabelText(/max sources shown/i), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }))

    expect(screen.getByLabelText(/max sources shown/i)).toHaveValue(null)
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ maxSourcesShown: expect.anything() }),
    )
  })
})

describe('FRONTEND-019-AC-11: Sort By is a top-level control, defaults to Best Match', () => {
  it('is visible while Filters is collapsed, defaulted to Best Match', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    expect(screen.getByLabelText(/best match/i)).toBeChecked()
    expect(screen.queryByLabelText(/min tmdb rating/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-019-AC-12: selecting Most Recommended sets/unsets sortBy immediately', () => {
  it('sets sortBy on selection, omits it again once reverted to Best Match', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/most recommended/i))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'recommendationCount' }),
    )

    fireEvent.click(screen.getByLabelText(/best match/i))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ sortBy: expect.anything() }),
    )
  })
})

describe('FRONTEND-019-AC-13: Reset Filters does not affect Sort By', () => {
  it('leaves sortBy=recommendationCount in place after Reset Filters', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/most recommended/i))
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }))

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'recommendationCount' }),
    )
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

describe('FRONTEND-027-AC-03: mode selector gains Popular Right Now / Highest Rated', () => {
  it('renders the two new options, unchecked by default', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    expect(screen.getByLabelText(/popular right now/i)).not.toBeChecked()
    expect(screen.getByLabelText(/highest rated/i)).not.toBeChecked()
  })
})

describe('FRONTEND-027-AC-03/04: new mode options, clears stale state on switch', () => {
  it('selects Popular Right Now and clears a prior Specific Series selection', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', status: 'COMPLETED' }),
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/specific series/i))
    fireEvent.click(await screen.findByLabelText('Ozark (COMPLETED)'))
    fireEvent.click(screen.getByLabelText(/popular right now/i))

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceMode: 'trending' }),
    )
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ seriesIds: expect.anything() }),
    )
  })

  it('selects Highest Rated, sending sourceMode=topRated with no trendingWindow', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/highest rated/i))

    // FRONTEND-030-AC-07: switching into Highest Rated also pre-fills
    // minVoteCount to 200 when untouched.
    expect(onQueryChange).toHaveBeenLastCalledWith({
      sourceMode: 'topRated',
      minVoteCount: 200,
    })
  })
})

describe('FRONTEND-027-AC-05: Day/Week toggle only under Popular Right Now', () => {
  it('renders the toggle under Popular Right Now, defaulting to week', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/popular right now/i))
    expect(screen.getByLabelText(/^week$/i)).toBeChecked()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sourceMode: 'trending',
        trendingWindow: 'week',
      }),
    )

    fireEvent.click(screen.getByLabelText(/highest rated/i))
    expect(screen.queryByLabelText(/^week$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^day$/i)).not.toBeInTheDocument()
  })

  it('switches trendingWindow to day when selected', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/popular right now/i))
    fireEvent.click(screen.getByLabelText(/^day$/i))

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sourceMode: 'trending',
        trendingWindow: 'day',
      }),
    )
  })
})

describe('FRONTEND-027-AC-06: no additional control for Highest Rated beyond minVoteCount', () => {
  it('exposes minVoteCount in Filters, with no mode-specific control outside it', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/highest rated/i))
    expect(screen.queryByLabelText(/^week$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^day$/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    expect(screen.getByLabelText(/min vote count/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-027-AC-07: minSourceRating hidden for both new modes', () => {
  it('hides Min Source Rating under Popular Right Now', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    fireEvent.click(screen.getByLabelText(/popular right now/i))

    expect(
      screen.queryByLabelText(/min source rating/i),
    ).not.toBeInTheDocument()
  })

  it('hides Min Source Rating under Highest Rated', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    fireEvent.click(screen.getByLabelText(/highest rated/i))

    expect(
      screen.queryByLabelText(/min source rating/i),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-09/10: free-text keyword picker replaces the checkbox list', () => {
  it('adds a typed keyword to the query', async () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'submarine' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ keywords: ['submarine'] }),
    )
  })

  it('accepts multiple typed keywords', async () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'submarine' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: 'spy' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ keywords: ['submarine', 'spy'] }),
    )
  })
})

// FRONTEND-032-AC-07/AC-08 supersedes FRONTEND-029-AC-11: the field now
// fetches getKeywordStats() to offer tracked keywords as suggestions
// alongside free text (a real gap found in live use, per
// frontend_spec_032's Overview), rather than never fetching at all.
describe('FRONTEND-032-AC-07: fetches keyword stats and offers them as suggestions', () => {
  it('fetches on mount and renders a fetched keyword as a clickable suggestion', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 3, averagePersonalRating: 4 },
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    expect(mockGetKeywordStats).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('spy')).toBeInTheDocument())
  })
})

describe('FRONTEND-032-AC-08: degrades silently on keyword stats fetch failure', () => {
  it('renders no alert and free text still works when getKeywordStats rejects', async () => {
    mockGetKeywordStats.mockRejectedValue(new Error('fail'))
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'still works' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('still works')).toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-12: mode switch still clears keywordsSelected', () => {
  it('clears typed keywords when switching away from Genre & Keyword', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'submarine' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByLabelText(/specific series/i))

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ keywords: expect.anything() }),
    )
  })
})

describe('FRONTEND-029-AC-13: hint recomputed from keywordsSelected', () => {
  it('hides the hint once a keyword is added, shows it again once removed', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    expect(
      screen.getByText(/enter at least one genre or keyword/i),
    ).toBeInTheDocument()

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'spy' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(
      screen.queryByText(/enter at least one genre or keyword/i),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove spy' }))
    expect(
      screen.getByText(/enter at least one genre or keyword/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-24/25: accessible names for the keyword picker embedding', () => {
  it('keyword field is reachable by label with named buttons', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(/genre & keyword/i))

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'spy' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(
      screen.getByRole('button', { name: 'Remove spy' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-030-AC-03/04: Exclude Keywords filter field', () => {
  it('populates excludeKeywords from comma-separated free text', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    fireEvent.change(screen.getByLabelText(/exclude keywords/i), {
      target: { value: 'Zombie, Heist' },
    })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ excludeKeywords: ['Zombie', 'Heist'] }),
    )
  })

  it('renders Exclude Keywords immediately adjacent to Exclude Genres', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    expect(screen.getByLabelText(/exclude genres/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/exclude keywords/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-030-AC-05: Reset Filters clears Exclude Keywords', () => {
  it('clears the field and omits excludeKeywords from the next query', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    fireEvent.change(screen.getByLabelText(/exclude keywords/i), {
      target: { value: 'Zombie' },
    })
    fireEvent.click(screen.getByTestId('reset-filters-btn'))

    expect(screen.getByLabelText(/exclude keywords/i)).toHaveValue('')
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ excludeKeywords: expect.anything() }),
    )
  })
})

describe('FRONTEND-030-AC-07/08: mode-aware Min Vote Count auto-fill', () => {
  it('pre-fills 200 when switching to Highest Rated, reverts to empty when switching away', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    fireEvent.click(screen.getByLabelText(/highest rated/i))
    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(200)

    fireEvent.click(screen.getByLabelText(/^automatic/i))
    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(null)
  })
})

describe('FRONTEND-030-AC-09: a manually-edited Min Vote Count is never clobbered by a mode switch', () => {
  it('preserves a user-typed value across mode changes in either direction', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    fireEvent.click(screen.getByLabelText(/highest rated/i))
    fireEvent.change(screen.getByLabelText(/min vote count/i), {
      target: { value: '500' },
    })
    fireEvent.click(screen.getByLabelText(/^automatic/i))

    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(500)
  })

  it('preserves a user-typed value when switching into Highest Rated too', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    fireEvent.change(screen.getByLabelText(/min vote count/i), {
      target: { value: '50' },
    })
    fireEvent.click(screen.getByLabelText(/highest rated/i))

    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(50)
  })
})

describe('FRONTEND-030-AC-10: Reset Filters clears minVoteCount and minVoteCountTouched', () => {
  it('clears a touched, manually-edited value and does not re-trigger the topRated auto-fill', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    fireEvent.click(screen.getByLabelText(/highest rated/i))
    fireEvent.change(screen.getByLabelText(/min vote count/i), {
      target: { value: '500' },
    })
    fireEvent.click(screen.getByTestId('reset-filters-btn'))

    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(null)
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ minVoteCount: expect.anything() }),
    )
  })
})

describe('FRONTEND-030-AC-11/12: Sort By hidden under Popular Right Now', () => {
  it('renders Sort By under every mode except Popular Right Now', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    expect(screen.getByText(/^sort by$/i)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/popular right now/i))
    expect(screen.queryByText(/^sort by$/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/highest rated/i))
    expect(screen.getByText(/^sort by$/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-030-AC-13/14/15, FRONTEND-031-AC-01: "Vote Average" relabel under Highest Rated and Genre & Keyword', () => {
  it('relabels the second Sort By option under Highest Rated, keeping the same underlying value', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/highest rated/i))
    expect(screen.getByLabelText(/vote average/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/most recommended/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/vote average/i))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'recommendationCount' }),
    )
  })

  it('FRONTEND-031-AC-01: also relabels the second Sort By option under Genre & Keyword', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    expect(screen.getByLabelText(/vote average/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/most recommended/i)).not.toBeInTheDocument()
  })

  it('FRONTEND-031-AC-02: Sort By fieldset still renders under Genre & Keyword', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    expect(screen.getByText(/^sort by$/i)).toBeInTheDocument()
  })

  it('leaves the label as "Most Recommended" for Automatic and Specific Series', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    expect(screen.getByLabelText(/most recommended/i)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/specific series/i))
    expect(screen.getByLabelText(/most recommended/i)).toBeInTheDocument()
  })
})
