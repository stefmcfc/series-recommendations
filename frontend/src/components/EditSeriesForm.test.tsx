import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EditSeriesForm } from './EditSeriesForm'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockUpdate = vi.mocked(seriesApi.update)

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'test-id',
    title: 'Test Show',
    year: 2020,
    genres: 'Drama',
    tags: null,
    totalSeasons: 5,
    totalEpisodes: 50,
    currentSeason: 2,
    currentEpisode: 10,
    status: SeriesStatus.WATCHING,
    imdbRating: 8.4,
    rottenTomatoesRating: null,
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
  it('renders as a labelled dialog focused on the title input', () => {
    renderForm()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(
      screen.getByRole('heading', { name: /edit series/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^title/i)).toHaveFocus()
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
      /genres/i,
      /total seasons/i,
      /total episodes/i,
      /current season/i,
      /current episode/i,
      /^status/i,
      /imdb rating/i,
      /rotten tomatoes rating/i,
      /personal rating/i,
      /notes/i,
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
    expect(screen.getByLabelText(/current season/i)).toHaveValue(3)
    expect(screen.getByLabelText(/current episode/i)).toHaveValue(12)
  })

  it('renders null fields as empty', () => {
    renderForm({ series: makeSeries({ rottenTomatoesRating: null }) })
    expect(screen.getByLabelText(/rotten tomatoes rating/i)).toHaveValue(null)
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
      screen.getByText(/year must be between 1 and 2026/i),
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

  it('does not cross-validate currentEpisode against totalEpisodes', async () => {
    const series = makeSeries({ totalEpisodes: 5, currentEpisode: 50 })
    mockUpdate.mockResolvedValue(series)
    renderForm({ series })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
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
    fireEvent.change(screen.getByLabelText(/current season/i), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByLabelText(/current episode/i), {
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
    expect(screen.getByLabelText(/poster url/i)).toHaveValue(
      'https://example.com/poster.jpg',
    )
  })

  it('renders an empty Poster URL field when series.posterUrl is null', () => {
    renderForm({ series: makeSeries({ posterUrl: null }) })
    expect(screen.getByLabelText(/poster url/i)).toHaveValue('')
  })

  it('does not render a "Look Up" button', () => {
    renderForm()
    expect(screen.queryByTestId('lookup-btn')).not.toBeInTheDocument()
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
    fireEvent.change(screen.getByLabelText(/poster url/i), {
      target: { value: 'https://example.com/new-poster.jpg' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const payload = mockUpdate.mock.calls[0][1]
    expect(payload.posterUrl).toBe('https://example.com/new-poster.jpg')
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

describe('FRONTEND-004-AC-38: no leaked data', () => {
  it('never logs form values to the console', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    mockUpdate.mockResolvedValue(makeSeries())
    renderForm()
    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { value: 'private note' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    expect(
      logSpy.mock.calls.flat().some((c) => String(c).includes('private note')),
    ).toBe(false)
  })
})
