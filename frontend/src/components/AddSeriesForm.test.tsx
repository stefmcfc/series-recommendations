import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AddSeriesForm } from './AddSeriesForm'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series, SeriesLookupResult } from '../types/series'

vi.mock('../services/seriesApi')
const mockCreate = vi.mocked(seriesApi.create)
const mockSearchTmdb = vi.mocked(seriesApi.searchTmdb)
const mockResolveTmdb = vi.mocked(seriesApi.resolveTmdbCandidate)

function makeLookupResult(
  overrides: Partial<SeriesLookupResult> = {},
): SeriesLookupResult {
  return {
    title: 'Show',
    ...overrides,
  }
}

async function runLookup(title: string) {
  fireEvent.change(screen.getByLabelText(/^title/i), {
    target: { value: title },
  })
  fireEvent.click(screen.getByTestId('lookup-btn'))
}

beforeEach(() => {
  vi.clearAllMocks()
})

function renderForm(
  overrides: Partial<{
    onCancel: () => void
    onSuccess: (s: Series) => void
  }> = {},
) {
  const onCancel = overrides.onCancel ?? vi.fn()
  const onSuccess = overrides.onSuccess ?? vi.fn()
  render(<AddSeriesForm onCancel={onCancel} onSuccess={onSuccess} />)
  return { onCancel, onSuccess }
}

describe('FRONTEND-003-AC-05/06: dialog structure & focus', () => {
  it('renders as a labelled dialog', () => {
    renderForm()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(
      screen.getByRole('heading', { name: /add series/i }),
    ).toBeInTheDocument()
  })

  it('focuses the title input on mount', () => {
    renderForm()
    expect(screen.getByLabelText(/^title/i)).toHaveFocus()
  })
})

describe('FRONTEND-003-AC-07/08/09: dismissal', () => {
  it('calls onCancel when Cancel is clicked, without submitting', () => {
    const { onCancel } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('calls onCancel on Escape, without submitting', () => {
    const { onCancel } = renderForm()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-003-AC-10/11/12: fields', () => {
  it('renders a labelled control for every CreateSeriesRequest field', () => {
    renderForm()
    for (const label of [
      /^title/i,
      /^year/i,
      /genres/i,
      /total seasons/i,
      /total episodes/i,
      /^status/i,
      /imdb rating/i,
      /rotten tomatoes rating \(tomatometer\)/i,
      /rotten tomatoes rating \(popcornmeter\)/i,
      /personal rating/i,
      /notes/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('marks title as required', () => {
    renderForm()
    expect(screen.getByLabelText(/^title/i)).toBeRequired()
  })

  it('defaults status to BACKLOG', () => {
    renderForm()
    expect(screen.getByLabelText(/^status/i)).toHaveValue(SeriesStatus.BACKLOG)
  })
})

describe('FRONTEND-022-AC-05/06: alternateTitle and metacriticRating fields removed', () => {
  it('does not render alternateTitle or metacriticRating inputs', () => {
    renderForm()
    expect(screen.queryByLabelText(/alternate title/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/metacritic/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-037-AC-02: Popcornmeter field on AddSeriesForm', () => {
  it('validates 0-100, omits from payload when empty, includes when provided', async () => {
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Ozark' },
    })
    fireEvent.change(
      screen.getByLabelText(/rotten tomatoes rating \(popcornmeter\)/i),
      { target: { value: '150' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(
      await screen.findByText(/must be between 0 and 100/i),
    ).toBeInTheDocument()

    fireEvent.change(
      screen.getByLabelText(/rotten tomatoes rating \(popcornmeter\)/i),
      { target: { value: '91' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ rottenTomatoesPopcornmeter: 91 }),
      ),
    )
  })

  it('relabels the existing field to clarify it is the Tomatometer', () => {
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)
    expect(
      screen.getByLabelText(/rotten tomatoes rating \(tomatometer\)/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-013..18: client-side validation', () => {
  it('blocks submit and shows an error when title is blank', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText(/title is required/i)).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('blocks submit when year is out of range', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(screen.getByLabelText(/^year/i), {
      target: { value: '9999' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(
      screen.getByText(/year must be between 1 and 2026/i),
    ).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('blocks submit when totalSeasons is less than 1', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(screen.getByLabelText(/total seasons/i), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(
      screen.getByText(/total seasons must be at least 1/i),
    ).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('blocks submit when totalEpisodes is less than 1', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(screen.getByLabelText(/total episodes/i), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(
      screen.getByText(/total episodes must be at least 1/i),
    ).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('blocks submit when imdbRating is out of range', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(screen.getByLabelText(/imdb rating/i), {
      target: { value: '15' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(mockCreate).not.toHaveBeenCalled()
    expect(
      screen.getByText(/imdb rating must be between 0 and 10/i),
    ).toBeInTheDocument()
  })

  it('blocks submit when rottenTomatoesRating is out of range', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(
      screen.getByLabelText(/rotten tomatoes rating \(tomatometer\)/i),
      { target: { value: '150' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(mockCreate).not.toHaveBeenCalled()
    expect(
      screen.getByText(/rotten tomatoes rating must be between 0 and 100/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-003-AC-19: valid submission payload', () => {
  it('calls seriesApi.create with only populated fields', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0][0]
    expect(payload.title).toBe('Show')
    expect(payload.status).toBe(SeriesStatus.BACKLOG)
    expect(payload).not.toHaveProperty('year')
    expect(payload).not.toHaveProperty('genres')
    expect(payload).not.toHaveProperty('totalSeasons')
    expect(payload).not.toHaveProperty('totalEpisodes')
    expect(payload).not.toHaveProperty('imdbRating')
    expect(payload).not.toHaveProperty('rottenTomatoesRating')
    expect(payload).not.toHaveProperty('personalRating')
    expect(payload).not.toHaveProperty('personalNotes')
    expect(payload).not.toHaveProperty('currentSeason')
    expect(payload).not.toHaveProperty('currentEpisode')
    expect(payload).not.toHaveProperty('alternateTitle')
    expect(payload).not.toHaveProperty('metacriticRating')
  })

  it('FRONTEND-013-AC-07: sets personalRating via star click', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByLabelText('Rate 4 star(s)'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate.mock.calls[0][0].personalRating).toBe(4)
  })

  it('includes populated optional fields with the correct types', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(screen.getByLabelText(/^year/i), {
      target: { value: '2020' },
    })
    fireEvent.change(screen.getByLabelText(/genres/i), {
      target: { value: 'Drama, Crime' },
    })
    fireEvent.change(screen.getByLabelText(/imdb rating/i), {
      target: { value: '8.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0][0]
    expect(payload.year).toBe(2020)
    expect(payload.genres).toBe('Drama, Crime')
    expect(payload.imdbRating).toBe(8.5)
  })
})

describe('FRONTEND-003-AC-20/21: loading state', () => {
  it('disables Save and Cancel and shows "Saving..." while in flight', async () => {
    mockCreate.mockReturnValue(new Promise(() => undefined))
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })
})

describe('FRONTEND-003-AC-22/23: success', () => {
  it('calls onSuccess with the created series exactly once', async () => {
    const created = { id: '1', title: 'Show' } as Series
    mockCreate.mockResolvedValue(created)
    const { onSuccess } = renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSuccess).toHaveBeenCalledWith(created)
  })
})

describe('FRONTEND-003-AC-24/25/26: server-side error handling', () => {
  it('shows the ApiError message and does not call onSuccess/onCancel', async () => {
    mockCreate.mockRejectedValue(new ApiError(500, 'Internal server error'))
    const { onSuccess, onCancel } = renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /internal server error/i,
      ),
    )
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('maps ApiError.details onto the matching fields', async () => {
    mockCreate.mockRejectedValue(
      new ApiError(400, 'Validation failed', { title: 'Title is required' }),
    )
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'x' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.getAllByText(/title is required/i).length).toBeGreaterThan(
        0,
      ),
    )
  })

  it('keeps entered values and re-enables buttons after a failed submission', async () => {
    mockCreate.mockRejectedValue(new ApiError(500, 'Internal server error'))
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await screen.findByRole('alert')
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Show')
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).not.toBeDisabled()
  })
})

describe('FRONTEND-038-AC-01: duplicate series submission error', () => {
  it('shows the backend message and does not call onSuccess', async () => {
    mockCreate.mockRejectedValue(
      new ApiError(
        409,
        'A series with this IMDb ID is already tracked: Breaking Bad',
      ),
    )
    const { onSuccess } = renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Breaking Bad' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A series with this IMDb ID is already tracked: Breaking Bad',
    )
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-022-AC-01/02: Look Up searches TMDB directly', () => {
  it('disables Look Up until a title is entered, then calls searchTmdb, not any OMDb method', async () => {
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 4046, title: 'Spooks' }])
    mockResolveTmdb.mockResolvedValue(makeLookupResult({ title: 'Spooks' }))
    renderForm()

    expect(screen.getByTestId('lookup-btn')).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    expect(screen.getByTestId('lookup-btn')).not.toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /look up/i }))
    await waitFor(() => expect(mockSearchTmdb).toHaveBeenCalledWith('Spooks'))
    expect(
      (seriesApi as unknown as Record<string, unknown>).lookupByTitle,
    ).toBeUndefined()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('trims the title before calling searchTmdb', async () => {
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 1, title: 'Show' }])
    mockResolveTmdb.mockResolvedValue(makeLookupResult({ title: 'Show' }))
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: '  Show  ' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() => expect(mockSearchTmdb).toHaveBeenCalledWith('Show'))
  })
})

describe('FRONTEND-022-AC-04: no escape-hatch button', () => {
  it('does not render a Search TMDB instead button', () => {
    renderForm()
    expect(
      screen.queryByRole('button', { name: /search tmdb instead/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('search-tmdb-btn')).not.toBeInTheDocument()
  })

  it('never shows an OMDb-style candidate picker', async () => {
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 1, title: 'Spooks', year: 2002 },
      { tmdbId: 2, title: 'Spooks: Code 9', year: 2008 },
    ])
    renderForm()
    await runLookup('Spooks')

    await screen.findAllByTestId('lookup-tmdb-candidate')
    expect(screen.queryByTestId('lookup-candidates')).not.toBeInTheDocument()
    expect(screen.queryByTestId('lookup-candidate')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-022-AC-02: zero results', () => {
  it('shows an error and no picker', async () => {
    mockSearchTmdb.mockResolvedValue([])
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Xyzzy' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no matches found/i),
    )
    expect(
      screen.queryByTestId('lookup-tmdb-candidates'),
    ).not.toBeInTheDocument()
    expect(mockResolveTmdb).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-022-AC-02: single-result auto-resolve autofill overwrite rules', () => {
  it('overwrites empty fields but leaves user-entered totalEpisodes alone when the result omits it', async () => {
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 1396, title: 'Breaking Bad' }])
    mockResolveTmdb.mockResolvedValue(
      makeLookupResult({
        title: 'Breaking Bad',
        year: 2008,
        genres: 'Crime, Drama',
        totalSeasons: 5,
        // totalEpisodes intentionally absent
        imdbRating: 9.5,
        posterUrl: 'https://example.com/bb.jpg',
      }),
    )
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'breaking bad' },
    })
    fireEvent.change(screen.getByLabelText(/total episodes/i), {
      target: { value: '62' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() => expect(mockResolveTmdb).toHaveBeenCalledWith(1396))
    await waitFor(() =>
      expect(screen.getByLabelText(/^title/i)).toHaveValue('Breaking Bad'),
    )
    expect(screen.getByLabelText(/^year/i)).toHaveValue(2008)
    expect(screen.getByLabelText(/genres/i)).toHaveValue('Crime, Drama')
    expect(screen.getByLabelText(/total seasons/i)).toHaveValue(5)
    expect(screen.getByLabelText(/total episodes/i)).toHaveValue(62) // untouched
    expect(screen.getByLabelText(/imdb rating/i)).toHaveValue(9.5)
    expect(screen.getByLabelText(/poster url/i)).toHaveValue(
      'https://example.com/bb.jpg',
    )
    expect(screen.getByLabelText(/^status/i)).toHaveValue(SeriesStatus.BACKLOG) // untouched
    expect(
      screen.queryByTestId('lookup-tmdb-candidates'),
    ).not.toBeInTheDocument()
  })

  it('never touches status, personalRating, or personalNotes', async () => {
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 1, title: 'Show' }])
    mockResolveTmdb.mockResolvedValue(
      makeLookupResult({ title: 'Show', imdbRating: 7.5 }),
    )
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByLabelText('Rate 4 star(s)'))
    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { value: 'my notes' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getByLabelText(/imdb rating/i)).toHaveValue(7.5),
    )
    expect(screen.getByLabelText(/^status/i)).toHaveValue(SeriesStatus.BACKLOG)
    expect(screen.getByLabelText('Rate 4 star(s)')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText(/notes/i)).toHaveValue('my notes')
  })

  it('shows "Looking up..." while either chained call is in flight and disables the button', () => {
    mockSearchTmdb.mockReturnValue(new Promise(() => undefined))
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    expect(screen.getByTestId('lookup-btn')).toHaveTextContent(/looking up/i)
    expect(screen.getByTestId('lookup-btn')).toBeDisabled()
  })

  it('shows a scoped alert on auto-resolve failure without touching form fields, and Save still works', async () => {
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 1, title: 'Xyzzy' }])
    mockResolveTmdb.mockRejectedValue(
      new ApiError(404, 'No TMDB results for tmdbId: 1'),
    )
    mockCreate.mockResolvedValue({ id: '1', title: 'Xyzzy' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Xyzzy' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getAllByRole('alert')[0]).toHaveTextContent(
        /no tmdb results/i,
      ),
    )
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Xyzzy')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
  })

  it('is a distinct alert region from the submitError region', async () => {
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 1, title: 'Xyzzy' }])
    mockResolveTmdb.mockRejectedValue(
      new ApiError(404, 'No TMDB results for tmdbId: 1'),
    )
    mockCreate.mockRejectedValue(new ApiError(500, 'Internal server error'))
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Xyzzy' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await screen.findByText(/no tmdb results/i)

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await screen.findByText(/internal server error/i)
    expect(screen.getByText(/no tmdb results/i)).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })
})

describe('FRONTEND-022-AC-03: two or more TMDB results shows a picker', () => {
  it('renders one button per candidate with title/year/originalTitle/poster, and no second dialog', async () => {
    mockSearchTmdb.mockResolvedValue([
      {
        tmdbId: 4046,
        title: 'Spooks',
        year: 2002,
        posterUrl: 'https://example.com/spooks.jpg',
      },
      {
        tmdbId: 65327,
        title: 'Money Heist',
        year: 2017,
        originalTitle: 'La Casa de Papel',
      },
    ])
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getAllByTestId('lookup-tmdb-candidate')).toHaveLength(2),
    )
    expect(screen.getByTestId('lookup-tmdb-candidates')).toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByText(/la casa de papel/i)).toBeInTheDocument()
    expect(mockResolveTmdb).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-022-AC-03: selecting a TMDB candidate resolves and applies it', () => {
  it('calls resolveTmdbCandidate for the clicked candidate, applies it, and clears the picker', async () => {
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    mockResolveTmdb.mockResolvedValue(
      makeLookupResult({
        title: 'Spooks',
        year: 2002,
        imdbId: 'tt0160904',
      }),
    )
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await screen.findAllByTestId('lookup-tmdb-candidate')

    fireEvent.click(screen.getByRole('button', { name: /^spooks \(2002\)$/i }))

    await waitFor(() => expect(mockResolveTmdb).toHaveBeenCalledWith(4046))
    await waitFor(() =>
      expect(screen.getByLabelText(/^year/i)).toHaveValue(2002),
    )
    expect(
      screen.queryByTestId('lookup-tmdb-candidates'),
    ).not.toBeInTheDocument()
  })

  it('disables every candidate button while a selection resolves', async () => {
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    mockResolveTmdb.mockReturnValue(new Promise(() => undefined))
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await screen.findAllByTestId('lookup-tmdb-candidate')

    fireEvent.click(screen.getByRole('button', { name: /^spooks \(2002\)$/i }))

    await waitFor(() => {
      for (const btn of screen.getAllByTestId('lookup-tmdb-candidate')) {
        expect(btn).toBeDisabled()
      }
    })
  })
})

describe('FRONTEND-022-AC-03: a failed TMDB candidate resolution keeps the picker open', () => {
  it('shows the error and leaves the picker showing with buttons re-enabled', async () => {
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    mockResolveTmdb.mockRejectedValue(
      new ApiError(
        502,
        'Unable to reach the series lookup service. Please try again.',
      ),
    )
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await screen.findAllByTestId('lookup-tmdb-candidate')

    fireEvent.click(screen.getByRole('button', { name: /^spooks \(2002\)$/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to reach/i),
    )
    const candidateButtons = screen.getAllByTestId('lookup-tmdb-candidate')
    expect(candidateButtons).toHaveLength(2)
    for (const btn of candidateButtons) {
      expect(btn).not.toBeDisabled()
    }
  })
})

describe('FRONTEND-022-AC-03: dismissing the picker', () => {
  it('clears the picker without resolving anything', async () => {
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await screen.findAllByTestId('lookup-tmdb-candidate')

    fireEvent.click(screen.getByTestId('lookup-tmdb-candidates-cancel'))

    expect(
      screen.queryByTestId('lookup-tmdb-candidates'),
    ).not.toBeInTheDocument()
    expect(mockResolveTmdb).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-022-AC-01: re-clicking Look Up while the picker is open re-searches', () => {
  it('replaces the picker contents with the new search result', async () => {
    mockSearchTmdb.mockResolvedValueOnce([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() =>
      expect(screen.getAllByTestId('lookup-tmdb-candidate')).toHaveLength(2),
    )

    mockSearchTmdb.mockResolvedValueOnce([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
      { tmdbId: 88396, title: 'Spooks: The Greater Good', year: 2015 },
    ])
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getAllByTestId('lookup-tmdb-candidate')).toHaveLength(3),
    )
    expect(mockSearchTmdb).toHaveBeenCalledTimes(2)
  })
})

describe('FRONTEND-009-AC-13/14/15: poster field and preview', () => {
  it('renders a labelled Poster URL field', () => {
    renderForm()
    expect(screen.getByLabelText(/poster url/i)).toBeInTheDocument()
  })

  it('renders a preview when Poster URL is populated, hides it on load failure', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/poster url/i), {
      target: { value: 'https://example.com/poster.jpg' },
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

  it('does not render a preview when Poster URL is blank', () => {
    renderForm()
    expect(
      screen.queryByRole('presentation', { hidden: true }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-022: no logging of search/resolve data', () => {
  it('never logs the searched title or a resolved result', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 1, title: 'Secret Show' }])
    mockResolveTmdb.mockResolvedValue(
      makeLookupResult({ title: 'Secret Show', imdbRating: 8.1 }),
    )
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Secret Show' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() => expect(mockResolveTmdb).toHaveBeenCalled())
    expect(
      logSpy.mock.calls.flat().some((c) => String(c).includes('Secret Show')),
    ).toBe(false)
  })
})

describe('FRONTEND-028-AC-05: overview carried through initialValues (recommendation flow)', () => {
  it('includes overview in the create payload when passed via initialValues without a lookup', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Ozark' } as Series)
    render(
      <AddSeriesForm
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
        initialValues={{
          title: 'Ozark',
          overview: 'A financial planner relocates his family.',
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          overview: 'A financial planner relocates his family.',
        }),
      ),
    )
  })
})

describe('FRONTEND-010-AC-11: initialValues prefill', () => {
  it('pre-populates fields from initialValues, only for provided fields', () => {
    render(
      <AddSeriesForm
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
        initialValues={{
          title: 'Ozark',
          genres: 'Crime, Drama',
          status: SeriesStatus.COMPLETED,
        }}
      />,
    )

    expect(screen.getByLabelText(/^title/i)).toHaveValue('Ozark')
    expect(screen.getByLabelText(/genres/i)).toHaveValue('Crime, Drama')
    expect(screen.getByLabelText(/^status/i)).toHaveValue(
      SeriesStatus.COMPLETED,
    )
    expect(screen.getByLabelText(/^year/i)).toHaveValue(null) // untouched, not in initialValues
  })

  it('pre-populates numeric fields as strings', () => {
    render(
      <AddSeriesForm
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
        initialValues={{ title: 'Ozark', year: 2017 }}
      />,
    )

    expect(screen.getByLabelText(/^year/i)).toHaveValue(2017)
  })
})

describe('FRONTEND-018-AC-04: Tags field rendered', () => {
  it('renders a labelled Tags control', () => {
    renderForm()
    expect(screen.getByLabelText(/^tags/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-018-AC-06: valid submission payload includes/omits tags', () => {
  it('omits tags from the payload when blank', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0][0]
    expect(payload).not.toHaveProperty('tags')
  })

  it('includes a trimmed tags value when populated', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(screen.getByLabelText(/^tags/i), {
      target: { value: '  rewatch candidate,watch with partner  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0][0]
    expect(payload.tags).toBe('rewatch candidate,watch with partner')
  })
})

describe('FRONTEND-018-AC-07: initialValues prefill includes tags', () => {
  it('pre-populates tags from initialValues when provided', () => {
    render(
      <AddSeriesForm
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
        initialValues={{ title: 'Ozark', tags: 'background watching' }}
      />,
    )
    expect(screen.getByLabelText(/^tags/i)).toHaveValue('background watching')
  })
})

describe('FRONTEND-026-AC-06/07: TMDB metadata carried through to the create payload', () => {
  it('includes tmdbRating, tmdbVoteCount, originCountry, and productionStatus after a resolved lookup', async () => {
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 2996, title: 'The Office', year: 2001 },
    ])
    mockResolveTmdb.mockResolvedValue(
      makeLookupResult({
        title: 'The Office',
        tmdbRating: 7.7,
        tmdbVoteCount: 450,
        originCountry: 'GB',
        productionStatus: 'ENDED',
      }),
    )
    mockCreate.mockResolvedValue({ id: '1', title: 'The Office' } as Series)
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'The Office' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await screen.findByDisplayValue('The Office')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tmdbRating: 7.7,
          tmdbVoteCount: 450,
          originCountry: 'GB',
          productionStatus: 'ENDED',
        }),
      ),
    )
  })

  it('does not render tmdbRating/tmdbVoteCount/originCountry/productionStatus as inputs', () => {
    renderForm()
    expect(screen.queryByLabelText(/tmdb rating/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/tmdb vote count/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/origin country/i)).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/production status/i),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-026-AC-08: candidate picker shows origin country', () => {
  it("displays each candidate's country to disambiguate same-titled results", async () => {
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 2996, title: 'The Office', year: 2001, originCountry: 'GB' },
      { tmdbId: 2316, title: 'The Office', year: 2005, originCountry: 'US' },
    ])
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'The Office' },
    })
    fireEvent.click(screen.getByRole('button', { name: /look up/i }))

    expect(await screen.findByText(/united kingdom/i)).toBeInTheDocument()
    expect(screen.getByText(/united states/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-003-AC-31/32: no leaked data, no out-of-contract fields', () => {
  it('never logs form values to the console', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { value: 'private note' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect(
      logSpy.mock.calls.flat().some((c) => String(c).includes('private note')),
    ).toBe(false)
    expect(
      errorSpy.mock.calls
        .flat()
        .some((c) => String(c).includes('private note')),
    ).toBe(false)
  })

  it('never sends currentSeason/currentEpisode keys', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0][0]
    expect(payload).not.toHaveProperty('currentSeason')
    expect(payload).not.toHaveProperty('currentEpisode')
  })
})

describe('FRONTEND-028-AC-05/06/07: overview carried through to the create payload', () => {
  it('includes overview in the create payload after a resolved lookup', async () => {
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 2996, title: 'The Office', year: 2001 },
    ])
    mockResolveTmdb.mockResolvedValue(
      makeLookupResult({
        title: 'The Office',
        overview: 'A mockumentary sitcom.',
      }),
    )
    mockCreate.mockResolvedValue({ id: '1', title: 'The Office' } as Series)
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'The Office' },
    })
    fireEvent.click(screen.getByRole('button', { name: /look up/i }))
    await screen.findByDisplayValue('The Office')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ overview: 'A mockumentary sitcom.' }),
      ),
    )
  })

  it('omits overview when no lookup was performed', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Homemade Show' } as Series)
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Homemade Show' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0][0]
    expect(payload).not.toHaveProperty('overview')
  })

  it('does not render a visible overview input', () => {
    renderForm()
    expect(screen.queryByLabelText(/overview/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-024-AC-17: tmdbId carried through to the create payload', () => {
  it('includes tmdbId after a resolved lookup', async () => {
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
    ])
    mockResolveTmdb.mockResolvedValue(
      makeLookupResult({ title: 'Spooks', tmdbId: 4046 }),
    )
    mockCreate.mockResolvedValue({ id: '1', title: 'Spooks' } as Series)
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    fireEvent.click(screen.getByRole('button', { name: /look up/i }))
    await screen.findByDisplayValue('Spooks')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ tmdbId: 4046 }),
      ),
    )
  })

  it('omits tmdbId when no lookup was performed', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Homemade Show' } as Series)
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Homemade Show' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0][0]
    expect(payload).not.toHaveProperty('tmdbId')
  })

  it('does not render a visible tmdbId input', () => {
    renderForm()
    expect(screen.queryByLabelText(/tmdb id/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-012-AC-04: exclude checkbox omitted from payload unless checked', () => {
  it('renders unchecked by default', () => {
    renderForm()
    expect(
      screen.getByLabelText(/exclude from recommendations/i),
    ).not.toBeChecked()
  })

  it('omits excludeFromRecommendations when left unchecked', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Ozark' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Ozark' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0][0]
    expect(payload).not.toHaveProperty('excludeFromRecommendations')
  })

  it('includes excludeFromRecommendations: true when checked', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Ozark' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Ozark' },
    })
    fireEvent.click(screen.getByLabelText(/exclude from recommendations/i))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ excludeFromRecommendations: true }),
      ),
    )
  })
})
