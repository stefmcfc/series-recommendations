import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EditSeriesForm } from './EditSeriesForm'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockUpdate = vi.mocked(seriesApi.update)
const mockSearchTmdb = vi.mocked(seriesApi.searchTmdb)
const mockResolveTmdbCandidate = vi.mocked(seriesApi.resolveTmdbCandidate)

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'test-id',
    title: 'Test Show',
    year: 2020,
    lastAirYear: null,
    genres: 'Drama',
    tags: null,
    totalSeasons: 5,
    totalEpisodes: 50,
    currentSeason: 2,
    currentEpisode: 10,
    status: SeriesStatus.WATCHING,
    imdbRating: 8.4,
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
    keywords: [],
    overview: null,
    excludeFromRecommendations: false,
    flaggedForRewatch: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

function renderForm(
  overrides: Partial<{
    series: Series
    onCancel: () => void
    onSuccess: (s: Series) => void
  }> = {},
) {
  const series = overrides.series ?? makeSeries()
  const onCancel = overrides.onCancel ?? vi.fn()
  const onSuccess = overrides.onSuccess ?? vi.fn()
  render(
    <EditSeriesForm
      series={series}
      onCancel={onCancel}
      onSuccess={onSuccess}
    />,
  )
  return { series, onCancel, onSuccess }
}

describe('FRONTEND-004-AC-16/17: dialog structure & focus', () => {
  // FRONTEND-060-AC-03: Title is now permanently disabled (disabled elements
  // are unfocusable), so initial focus moves to the dialog container itself
  // rather than the Title input -- see EditSeriesForm.tsx's dialogRef.
  it('renders as a labelled dialog focused on the dialog itself', () => {
    renderForm()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(
      screen.getByRole('heading', { name: /edit series/i }),
    ).toBeInTheDocument()
    expect(dialog).toHaveFocus()
  })
})

describe('FRONTEND-004-AC-18/19: dismissal', () => {
  it('calls onCancel on Cancel click, without updating', () => {
    const { onCancel } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('calls onCancel on Escape, without updating', () => {
    const { onCancel } = renderForm()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-004-AC-20/21: fields pre-populated', () => {
  it('renders a labelled control for every field including currentSeason/currentEpisode', () => {
    renderForm()
    for (const label of [
      /^title/i,
      /^year/i,
      /^genres/i,
      /^total seasons/i,
      /^total episodes/i,
      /^current season/i,
      /^current episode/i,
      /^status/i,
      /^imdb rating/i,
      /^rotten tomatoes rating \(tomatometer\)/i,
      /^rotten tomatoes rating \(popcornmeter\)/i,
      /personal rating/i,
      /^personal notes/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('pre-fills every field from the series prop', () => {
    renderForm({
      series: makeSeries({
        title: 'The Office',
        currentSeason: 3,
        currentEpisode: 12,
      }),
    })
    expect(screen.getByLabelText(/^title/i)).toHaveValue('The Office')
    expect(screen.getByLabelText(/^current season/i)).toHaveValue(3)
    expect(screen.getByLabelText(/^current episode/i)).toHaveValue(12)
  })

  it('renders null fields as empty', () => {
    renderForm({
      series: makeSeries({
        rottenTomatoesRating: null,
        rottenTomatoesPopcornmeter: null,
      }),
    })
    expect(
      screen.getByLabelText(/^rotten tomatoes rating \(tomatometer\)/i),
    ).toHaveValue(null)
    expect(
      screen.getByLabelText(/^rotten tomatoes rating \(popcornmeter\)/i),
    ).toHaveValue(null)
  })
})

describe('FRONTEND-037-AC-03: Popcornmeter field on EditSeriesForm', () => {
  it('initializes from series.rottenTomatoesPopcornmeter and sends updates explicitly', async () => {
    const series = makeSeries({ rottenTomatoesPopcornmeter: 91 })
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    expect(
      screen.getByLabelText(/^rotten tomatoes rating \(popcornmeter\)/i),
    ).toHaveValue(91)

    fireEvent.change(
      screen.getByLabelText(/^rotten tomatoes rating \(popcornmeter\)/i),
      { target: { value: '85' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        series.id,
        expect.objectContaining({ rottenTomatoesPopcornmeter: 85 }),
      ),
    )
  })
})

describe('FRONTEND-022-AC-07/08: alternateTitle and metacriticRating fields removed', () => {
  it('does not render alternateTitle or metacriticRating inputs', () => {
    renderForm()
    expect(screen.queryByLabelText(/alternate title/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/metacritic/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-004-AC-23/24: shared validation', () => {
  it('blocks submit when title is blank', () => {
    renderForm({ series: makeSeries({ title: '' }) })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText(/title is required/i)).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('blocks submit when year is out of range', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/^year/i), {
      target: { value: '9999' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(
      screen.getByText(/year must be between 1900 and \d{4}/i),
    ).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-004-AC-25/26/27: currentSeason/currentEpisode validation', () => {
  it('blocks submit when currentSeason exceeds totalSeasons', () => {
    renderForm({ series: makeSeries({ totalSeasons: 3, currentSeason: 5 }) })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(
      screen.getByText(/current season cannot exceed total seasons/i),
    ).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('blocks submit when currentSeason is less than 1', () => {
    renderForm({ series: makeSeries({ currentSeason: 0 }) })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('blocks submit when currentEpisode is less than 1', () => {
    renderForm({ series: makeSeries({ currentEpisode: 0 }) })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-091-AC-01: currentEpisode cross-validated against totalEpisodes', () => {
  it('blocks submit when currentEpisode exceeds totalEpisodes', () => {
    renderForm({ series: makeSeries({ totalEpisodes: 5, currentEpisode: 50 }) })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(
      screen.getByText(/current episode cannot exceed total episodes/i),
    ).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-091-AC-06/07: currentSeason/currentEpisode reject non-integer values', () => {
  it('blocks submit when currentSeason is not a whole number', () => {
    renderForm({ series: makeSeries({ currentSeason: 2 }) })
    fireEvent.change(screen.getByLabelText('Current Season'), {
      target: { value: '2.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(
      screen.getByText(/current season must be a whole number of at least 1/i),
    ).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('blocks submit when currentEpisode is not a whole number', () => {
    renderForm({ series: makeSeries({ currentEpisode: 4 }) })
    fireEvent.change(screen.getByLabelText('Current Episode'), {
      target: { value: '4.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(
      screen.getByText(/current episode must be a whole number of at least 1/i),
    ).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-004-AC-33: submission payload', () => {
  it('calls seriesApi.update with the series id and populated fields, no id/dateAdded/dateCompleted', async () => {
    const series = makeSeries({ id: 'abc-123', title: 'Show' })
    mockUpdate.mockResolvedValue(series)
    renderForm({ series })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const [id, payload] = mockUpdate.mock.calls[0]
    expect(id).toBe('abc-123')
    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('dateAdded')
    expect(payload).not.toHaveProperty('dateCompleted')
  })

  it('includes currentSeason/currentEpisode when populated', async () => {
    const series = makeSeries({ currentSeason: 4, currentEpisode: 8 })
    mockUpdate.mockResolvedValue(series)
    renderForm({ series })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const payload = mockUpdate.mock.calls[0][1]
    expect(payload.currentSeason).toBe(4)
    expect(payload.currentEpisode).toBe(8)
  })

  it('omits currentSeason/currentEpisode when cleared', async () => {
    const series = makeSeries({ currentSeason: 4, currentEpisode: 8 })
    mockUpdate.mockResolvedValue(series)
    renderForm({ series })
    fireEvent.change(screen.getByLabelText(/^current season/i), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByLabelText(/^current episode/i), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const payload = mockUpdate.mock.calls[0][1]
    expect(payload).not.toHaveProperty('currentSeason')
    expect(payload).not.toHaveProperty('currentEpisode')
  })
})

describe('FRONTEND-009-AC-16/17: Poster URL field', () => {
  it('renders a labelled Poster URL field pre-populated from series.posterUrl', () => {
    renderForm({
      series: makeSeries({ posterUrl: 'https://example.com/poster.jpg' }),
    })
    expect(screen.getByLabelText(/^poster url/i)).toHaveValue(
      'https://example.com/poster.jpg',
    )
  })

  it('renders an empty Poster URL field when series.posterUrl is null', () => {
    renderForm({ series: makeSeries({ posterUrl: null }) })
    expect(screen.getByLabelText(/^poster url/i)).toHaveValue('')
  })

  it('renders a preview when Poster URL is populated, hides it on load failure', () => {
    renderForm({
      series: makeSeries({ posterUrl: 'https://example.com/poster.jpg' }),
    })

    const img = screen.getByRole('presentation', {
      hidden: true,
    }) as HTMLImageElement
    expect(img).toHaveAttribute('src', 'https://example.com/poster.jpg')

    fireEvent.error(img)
    expect(
      screen.queryByRole('presentation', { hidden: true }),
    ).not.toBeInTheDocument()
  })

  it('includes posterUrl in the update payload when populated', async () => {
    const series = makeSeries({ id: 'abc-123' })
    mockUpdate.mockResolvedValue(series)
    renderForm({ series })
    fireEvent.change(screen.getByLabelText(/^poster url/i), {
      target: { value: 'https://example.com/new-poster.jpg' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const payload = mockUpdate.mock.calls[0][1]
    expect(payload.posterUrl).toBe('https://example.com/new-poster.jpg')
  })

  it('FRONTEND-013-AC-08: sets personalRating via star click, initialized from series.personalRating', async () => {
    const series = makeSeries({ id: 'abc-123', personalRating: 3 })
    mockUpdate.mockResolvedValue(series)
    renderForm({ series })

    expect(screen.getByLabelText('Rate 3 star(s)')).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByLabelText('Rate 5 star(s)'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    expect(mockUpdate.mock.calls[0][1].personalRating).toBe(5)
  })
})

describe('FRONTEND-004-AC-28/29: loading & success', () => {
  it('disables Save and Cancel and shows "Saving..." while in flight', () => {
    mockUpdate.mockReturnValue(new Promise(() => undefined))
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('calls onSuccess with the updated series exactly once', async () => {
    const series = makeSeries()
    const updated = { ...series, title: 'Updated' }
    mockUpdate.mockResolvedValue(updated)
    const { onSuccess } = renderForm({ series })

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSuccess).toHaveBeenCalledWith(updated)
  })
})

describe('FRONTEND-004-AC-30/31/32: server-side error handling', () => {
  it('shows the ApiError message and retains entered values', async () => {
    mockUpdate.mockRejectedValue(new ApiError(500, 'Internal server error'))
    const { onSuccess, onCancel } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /internal server error/i,
      ),
    )
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).not.toBeDisabled()
  })

  it('maps ApiError.details onto the matching fields', async () => {
    mockUpdate.mockRejectedValue(
      new ApiError(400, 'Validation failed', { title: 'Title is required' }),
    )
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.getAllByText(/title is required/i).length).toBeGreaterThan(
        0,
      ),
    )
  })
})

describe('FRONTEND-018-AC-09/10: Tags field rendered and pre-filled', () => {
  it('renders a labelled Tags control pre-filled from the series prop', () => {
    renderForm({ series: makeSeries({ tags: 'rewatch candidate' }) })
    expect(screen.getByLabelText(/^tags/i)).toHaveValue('rewatch candidate')
  })

  it('renders a null tags value as empty', () => {
    renderForm({ series: makeSeries({ tags: null }) })
    expect(screen.getByLabelText(/^tags/i)).toHaveValue('')
  })
})

describe('FRONTEND-018-AC-12: submission payload includes/omits tags', () => {
  it('includes a trimmed tags value when changed', async () => {
    mockUpdate.mockResolvedValue({
      id: 'test-id',
      title: 'Test Show',
    } as Series)
    renderForm({ series: makeSeries({ tags: null }) })
    fireEvent.change(screen.getByLabelText(/^tags/i), {
      target: { value: '  watch with partner  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const payload = mockUpdate.mock.calls[0][1]
    expect(payload.tags).toBe('watch with partner')
  })

  it('omits tags from the payload when blank', async () => {
    mockUpdate.mockResolvedValue({
      id: 'test-id',
      title: 'Test Show',
    } as Series)
    renderForm({ series: makeSeries({ tags: null }) })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const payload = mockUpdate.mock.calls[0][1]
    expect(payload).not.toHaveProperty('tags')
  })
})

describe('FRONTEND-012-AC-05: exclude checkbox initialized from series, always sent', () => {
  it('initializes checked when series.excludeFromRecommendations is true', () => {
    renderForm({ series: makeSeries({ excludeFromRecommendations: true }) })
    expect(screen.getByLabelText(/exclude from recommendations/i)).toBeChecked()
  })

  it('initializes unchecked when series.excludeFromRecommendations is false', () => {
    renderForm({ series: makeSeries({ excludeFromRecommendations: false }) })
    expect(
      screen.getByLabelText(/exclude from recommendations/i),
    ).not.toBeChecked()
  })

  it('sends excludeFromRecommendations: false explicitly when unchecked', async () => {
    const series = makeSeries({ excludeFromRecommendations: true })
    mockUpdate.mockResolvedValue(series)
    renderForm({ series })

    fireEvent.click(screen.getByLabelText(/exclude from recommendations/i))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        series.id,
        expect.objectContaining({ excludeFromRecommendations: false }),
      ),
    )
  })

  it('sends excludeFromRecommendations: true explicitly when left checked', async () => {
    const series = makeSeries({ excludeFromRecommendations: true })
    mockUpdate.mockResolvedValue(series)
    renderForm({ series })

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        series.id,
        expect.objectContaining({ excludeFromRecommendations: true }),
      ),
    )
  })
})

describe('FRONTEND-060-AC-01: locked fields are disabled once set', () => {
  it('disables Year, Genres, Total Seasons, Total Episodes, and IMDb Rating when all are non-null', () => {
    const series = makeSeries({
      year: 2019,
      genres: 'Drama',
      totalSeasons: 3,
      totalEpisodes: 24,
      imdbRating: 8.4,
    })
    renderForm({ series })

    expect(screen.getByLabelText('Year')).toBeDisabled()
    expect(screen.getByLabelText('Genres')).toBeDisabled()
    expect(screen.getByLabelText('Total Seasons')).toBeDisabled()
    expect(screen.getByLabelText('Total Episodes')).toBeDisabled()
    expect(screen.getByLabelText('IMDb Rating')).toBeDisabled()
    expect(screen.getByTestId('year-locked-hint')).toBeInTheDocument()
    expect(screen.getByTestId('genres-locked-hint')).toBeInTheDocument()
    expect(screen.getByTestId('totalSeasons-locked-hint')).toBeInTheDocument()
    expect(screen.getByTestId('totalEpisodes-locked-hint')).toBeInTheDocument()
    expect(screen.getByTestId('imdbRating-locked-hint')).toBeInTheDocument()
  })
})

describe('FRONTEND-060-AC-02: a null field stays editable with no locked hint', () => {
  it('leaves Year enabled with no hint when series.year is null', () => {
    renderForm({
      series: makeSeries({
        year: null,
        genres: null,
        totalSeasons: null,
        totalEpisodes: null,
        imdbRating: null,
      }),
    })

    expect(screen.getByLabelText('Year')).not.toBeDisabled()
    expect(screen.queryByTestId('year-locked-hint')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Genres')).not.toBeDisabled()
    expect(screen.queryByTestId('genres-locked-hint')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Total Seasons')).not.toBeDisabled()
    expect(
      screen.queryByTestId('totalSeasons-locked-hint'),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Total Episodes')).not.toBeDisabled()
    expect(
      screen.queryByTestId('totalEpisodes-locked-hint'),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('IMDb Rating')).not.toBeDisabled()
    expect(
      screen.queryByTestId('imdbRating-locked-hint'),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-060-AC-03: Title is always disabled in EditSeriesForm', () => {
  it('disables the Title input unconditionally, with its own hint', () => {
    renderForm({ series: makeSeries({ title: 'Ozark' }) })
    expect(screen.getByLabelText('Title *')).toBeDisabled()
    expect(screen.getByTestId('title-locked-hint')).toBeInTheDocument()
  })
})

describe('FRONTEND-043-AC-07: EditSeriesForm gates Cancel when dirty', () => {
  it('opens the confirm dialog instead of cancelling immediately', () => {
    const onCancel = vi.fn()
    const series = makeSeries()
    render(
      <EditSeriesForm
        series={series}
        onCancel={onCancel}
        onSuccess={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText(/^tags/i), {
      target: { value: 'rewatch candidate' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-043-AC-08: no prompt when untouched', () => {
  it('cancels immediately when nothing changed', () => {
    const onCancel = vi.fn()
    renderForm({ onCancel })

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(onCancel).toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-043-AC-09: Escape mirrors Cancel gating', () => {
  it('opens the confirm dialog on Escape when dirty', () => {
    const onCancel = vi.fn()
    renderForm({ onCancel })
    fireEvent.change(screen.getByLabelText(/^tags/i), {
      target: { value: 'rewatch candidate' },
    })

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-043-AC-10: confirm dialog outcomes', () => {
  it('Discard calls onCancel; Keep Editing preserves the form', () => {
    const onCancel = vi.fn()
    renderForm({ onCancel })
    fireEvent.change(screen.getByLabelText(/^tags/i), {
      target: { value: 'rewatch candidate' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    fireEvent.click(screen.getByRole('button', { name: /keep editing/i }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^tags/i)).toHaveValue('rewatch candidate')
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('FRONTEND-004-AC-38: no leaked data', () => {
  it('never logs form values to the console', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    mockUpdate.mockResolvedValue(makeSeries())
    renderForm()
    fireEvent.change(screen.getByLabelText(/^personal notes/i), {
      target: { value: 'private note' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    expect(
      logSpy.mock.calls.flat().some((c) => String(c).includes('private note')),
    ).toBe(false)
  })
})

describe('FRONTEND-044-AC-04: clearedFields is sent on save', () => {
  it('includes clearedFields for an explicitly cleared field', async () => {
    const series = makeSeries({ id: '1', personalRating: 4 })
    mockUpdate.mockResolvedValue(series)
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    fireEvent.click(screen.getByLabelText('Rate 4 star(s)'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ clearedFields: ['personalRating'] }),
      ),
    )
  })
})

describe('FRONTEND-044-AC-05: re-typing a value un-clears the field', () => {
  it('removes the field from clearedFields once a new value is typed', async () => {
    const series = makeSeries({ id: '1', year: 2020, genres: null })
    mockUpdate.mockResolvedValue(series)
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /clear year/i }))
    fireEvent.change(screen.getByLabelText(/^year/i), {
      target: { value: '2021' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ year: 2021 }),
      ),
    )
    // FRONTEND-044-AC-05/Design Decisions: clearedFields is omitted
    // entirely (not sent as []) once nothing remains cleared -- re-typing
    // 'year' removed it from the set, leaving the set empty.
    const payload = mockUpdate.mock.calls[0][1]
    expect(payload).not.toHaveProperty('clearedFields')
  })
})

describe('FRONTEND-044-AC-06: Personal Rating clears via its own star gesture', () => {
  it('has no separate Clear button, but clears via deselecting the star', async () => {
    const series = makeSeries({ id: '1', personalRating: 4 })
    mockUpdate.mockResolvedValue(series)
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    expect(
      screen.queryByRole('button', { name: /clear personal rating/i }),
    ).not.toBeInTheDocument()

    // Deselect: clicking the currently-selected star again clears it.
    fireEvent.click(screen.getByLabelText('Rate 4 star(s)'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ clearedFields: ['personalRating'] }),
      ),
    )
  })
})

describe('FRONTEND-044-AC-07: currentSeason/currentEpisode have their own Clear buttons', () => {
  it('clears currentSeason via its own button', async () => {
    const series = makeSeries({ id: '1', currentSeason: 3 })
    mockUpdate.mockResolvedValue(series)
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /clear current season/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ clearedFields: ['currentSeason'] }),
      ),
    )
  })

  it('clears currentEpisode via its own button', async () => {
    const series = makeSeries({ id: '1', currentEpisode: 7 })
    mockUpdate.mockResolvedValue(series)
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /clear current episode/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ clearedFields: ['currentEpisode'] }),
      ),
    )
  })

  it('disables Clear when the field is already blank', () => {
    renderForm({
      series: makeSeries({ currentSeason: null, currentEpisode: null }),
    })
    expect(
      screen.getByRole('button', { name: /clear current season/i }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /clear current episode/i }),
    ).toBeDisabled()
  })
})

describe('FRONTEND-044: omits clearedFields entirely when nothing was cleared', () => {
  it('never sends clearedFields on an untouched save', async () => {
    const series = makeSeries({ id: '1' })
    mockUpdate.mockResolvedValue(series)
    renderForm({ series })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const payload = mockUpdate.mock.calls[0][1]
    expect(payload).not.toHaveProperty('clearedFields')
  })
})

describe('FRONTEND-045-AC-02: EditSeriesForm renders Look Up', () => {
  it('renders a Look Up button beside Title', () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING' } as Series
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    expect(screen.getByTestId('lookup-btn')).toBeInTheDocument()
    expect(screen.getByTestId('lookup-btn')).not.toBeDisabled()
  })
})

describe('FRONTEND-045-AC-03: a single match opens the confirm dialog, not an immediate apply', () => {
  it('opens ConfirmDialog instead of applying immediately', async () => {
    const series = {
      id: '1',
      title: 'Show',
      status: 'WATCHING',
      year: 2019,
    } as Series
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 42, title: 'Show', year: 2020 },
    ])
    mockResolveTmdbCandidate.mockResolvedValue({ title: 'Show', year: 2020 })
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    fireEvent.click(screen.getByTestId('lookup-btn'))

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/^year/i)).toHaveValue(2019) // unchanged until confirmed
  })
})

describe('FRONTEND-045-AC-04: multi-match candidates also gate through the confirm dialog', () => {
  it('opens the confirm dialog after picking a candidate', async () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING' } as Series
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 1, title: 'Show', year: 2019 },
      { tmdbId: 2, title: 'Show', year: 2020 },
    ])
    mockResolveTmdbCandidate.mockResolvedValue({ title: 'Show', year: 2020 })
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    fireEvent.click(screen.getByTestId('lookup-btn'))
    fireEvent.click(
      await screen
        .findAllByTestId('lookup-tmdb-candidate')
        .then((els) => els[1]),
    )

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  })
})

describe('FRONTEND-085-AC-05: candidate picker shows every origin country', () => {
  it('renders both countries for a multi-country TMDB candidate', async () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING' } as Series
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 1, title: 'MobLand', year: 2025, originCountry: 'GB,US' },
      { tmdbId: 2, title: 'MobLand', year: 2025, originCountry: 'GB,US' },
    ])
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    fireEvent.click(screen.getByTestId('lookup-btn'))

    expect(
      (await screen.findAllByText(/United Kingdom, United States/)).length,
    ).toBeGreaterThan(0)
  })
})

describe('FRONTEND-045-AC-05: confirming applies the resolved result', () => {
  it('overwrites fields on Overwrite', async () => {
    const series = {
      id: '1',
      title: 'Show',
      status: 'WATCHING',
      year: 2019,
    } as Series
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 42, title: 'Show', year: 2020 },
    ])
    mockResolveTmdbCandidate.mockResolvedValue({ title: 'Show', year: 2020 })
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    fireEvent.click(screen.getByTestId('lookup-btn'))
    fireEvent.click(await screen.findByRole('button', { name: /^overwrite$/i }))

    expect(screen.getByLabelText(/^year/i)).toHaveValue(2020)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-045-AC-06: cancelling discards the resolved result', () => {
  it('leaves the form unchanged on Keep Current Values', async () => {
    const series = {
      id: '1',
      title: 'Show',
      status: 'WATCHING',
      year: 2019,
    } as Series
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 42, title: 'Show', year: 2020 },
    ])
    mockResolveTmdbCandidate.mockResolvedValue({ title: 'Show', year: 2020 })
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    fireEvent.click(screen.getByTestId('lookup-btn'))
    fireEvent.click(
      await screen.findByRole('button', { name: /keep current values/i }),
    )

    expect(screen.getByLabelText(/^year/i)).toHaveValue(2019)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-045-AC-07: confirm dialog explains the overwrite', () => {
  it('names the overwrite in the dialog message', async () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING' } as Series
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 42, title: 'Show', year: 2020 },
    ])
    mockResolveTmdbCandidate.mockResolvedValue({ title: 'Show', year: 2020 })
    render(
      <EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />,
    )

    fireEvent.click(screen.getByTestId('lookup-btn'))

    // Narrower than a bare /overwrite/i: both the dialog's message and its
    // "Overwrite" confirm button match that pattern, which makes a plain
    // findByText(/overwrite/i) ambiguous (two matching elements). This still
    // asserts the message itself names the overwrite.
    expect(
      await screen.findByText(/overwrite the fields below/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-091-AC-08: submit error renders next to the actions row', () => {
  it('positions the submit-error banner adjacent to Save/Cancel, not near the heading', async () => {
    mockUpdate.mockRejectedValue(new ApiError(500, 'Server error'))
    renderForm({ series: makeSeries() })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    const error = await screen.findByText('Server error')
    const actions = screen
      .getByRole('button', { name: /^save$/i })
      .closest('div')
    expect(
      error.compareDocumentPosition(actions as Element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeFalsy()
  })
})

describe('FRONTEND-091-AC-09: a summary message appears when validation blocks submit', () => {
  it('shows a summary message next to the actions row', () => {
    renderForm({ series: makeSeries({ currentSeason: 0 }) })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(
      screen.getByText(/please review the highlighted fields above/i),
    ).toBeInTheDocument()
  })
})
