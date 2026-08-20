import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AddSeriesForm } from './AddSeriesForm'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockCreate = vi.mocked(seriesApi.create)
const mockSearch = vi.mocked(seriesApi.searchByTitle)
const mockResolve = vi.mocked(seriesApi.lookupByImdbId)
const mockSearchTmdb = vi.mocked(seriesApi.searchTmdb)
const mockResolveTmdb = vi.mocked(seriesApi.resolveTmdbCandidate)

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
      /metacritic rating/i,
      /rotten tomatoes rating/i,
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

describe('FRONTEND-003-AC-13..18: client-side validation', () => {
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

  it('blocks submit when metacriticRating is out of range', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(screen.getByLabelText(/metacritic rating/i), {
      target: { value: '150' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(mockCreate).not.toHaveBeenCalled()
    expect(
      screen.getByText(/metacritic rating must be between 0 and 100/i),
    ).toBeInTheDocument()
  })

  it('blocks submit when rottenTomatoesRating is out of range', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(screen.getByLabelText(/rotten tomatoes rating/i), {
      target: { value: '150' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(mockCreate).not.toHaveBeenCalled()
    expect(
      screen.getByText(/rotten tomatoes rating must be between 0 and 100/i),
    ).toBeInTheDocument()
  })

  it('blocks submit when personalRating is out of range', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(screen.getByLabelText(/personal rating/i), {
      target: { value: '9' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(mockCreate).not.toHaveBeenCalled()
    expect(
      screen.getByText(/personal rating must be between 1 and 5/i),
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
    expect(payload).not.toHaveProperty('metacriticRating')
    expect(payload).not.toHaveProperty('rottenTomatoesRating')
    expect(payload).not.toHaveProperty('personalRating')
    expect(payload).not.toHaveProperty('personalNotes')
    expect(payload).not.toHaveProperty('currentSeason')
    expect(payload).not.toHaveProperty('currentEpisode')
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

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Show')
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).not.toBeDisabled()
  })
})

describe('FRONTEND-015-AC-04: triggering a lookup calls searchByTitle', () => {
  it('disables Look Up until a title is entered, then calls searchByTitle', async () => {
    mockSearch.mockResolvedValue([{ title: 'Show', imdbId: 'tt0000001' }])
    mockResolve.mockResolvedValue({ title: 'Show' })
    renderForm()

    expect(screen.getByTestId('lookup-btn')).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    expect(screen.getByTestId('lookup-btn')).not.toBeDisabled()

    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('Show'))
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('trims the title before calling searchByTitle', async () => {
    mockSearch.mockResolvedValue([{ title: 'Show', imdbId: 'tt0000001' }])
    mockResolve.mockResolvedValue({ title: 'Show' })
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: '  Show  ' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('Show'))
  })
})

describe('FRONTEND-015-AC-05: zero results', () => {
  it('shows the existing lookup-error UI and no picker', async () => {
    mockSearch.mockResolvedValue([])
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Xyzzy' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no matches found/i),
    )
    expect(screen.queryByTestId('lookup-candidates')).not.toBeInTheDocument()
    expect(mockResolve).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-015-AC-06/07/08/09: autofill overwrite rules (single-candidate auto-resolve)', () => {
  it('overwrites empty fields but leaves user-entered totalEpisodes alone when the result omits it', async () => {
    mockSearch.mockResolvedValue([
      { title: 'Breaking Bad', imdbId: 'tt0959621' },
    ])
    mockResolve.mockResolvedValue({
      title: 'Breaking Bad',
      year: 2008,
      genres: 'Crime, Drama',
      totalSeasons: 5,
      // totalEpisodes intentionally absent
      imdbRating: 9.5,
      posterUrl: 'https://example.com/bb.jpg',
    })
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'breaking bad' },
    })
    fireEvent.change(screen.getByLabelText(/total episodes/i), {
      target: { value: '62' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith('tt0959621'))
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
    expect(screen.queryByTestId('lookup-candidates')).not.toBeInTheDocument()
  })

  it('never touches status, personalRating, or personalNotes', async () => {
    mockSearch.mockResolvedValue([{ title: 'Show', imdbId: 'tt0000001' }])
    mockResolve.mockResolvedValue({ title: 'Show', imdbRating: 7.5 })
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(screen.getByLabelText(/personal rating/i), {
      target: { value: '4' },
    })
    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { value: 'my notes' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getByLabelText(/imdb rating/i)).toHaveValue(7.5),
    )
    expect(screen.getByLabelText(/^status/i)).toHaveValue(SeriesStatus.BACKLOG)
    expect(screen.getByLabelText(/personal rating/i)).toHaveValue(4)
    expect(screen.getByLabelText(/notes/i)).toHaveValue('my notes')
  })

  it('shows "Looking up..." while either chained call is in flight and disables the button', () => {
    mockSearch.mockReturnValue(new Promise(() => undefined))
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    expect(screen.getByTestId('lookup-btn')).toHaveTextContent(/looking up/i)
    expect(screen.getByTestId('lookup-btn')).toBeDisabled()
  })

  it('shows a scoped alert on auto-resolve failure without touching form fields, and Save still works', async () => {
    mockSearch.mockResolvedValue([{ title: 'Xyzzy', imdbId: 'tt0000001' }])
    mockResolve.mockRejectedValue(
      new ApiError(404, 'No OMDb results for imdbId: tt0000001'),
    )
    mockCreate.mockResolvedValue({ id: '1', title: 'Xyzzy' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Xyzzy' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getAllByRole('alert')[0]).toHaveTextContent(
        /no omdb results/i,
      ),
    )
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Xyzzy')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
  })

  it('is a distinct alert region from the submitError region', async () => {
    mockSearch.mockResolvedValue([{ title: 'Xyzzy', imdbId: 'tt0000001' }])
    mockResolve.mockRejectedValue(
      new ApiError(404, 'No OMDb results for imdbId: tt0000001'),
    )
    mockCreate.mockRejectedValue(new ApiError(500, 'Internal server error'))
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Xyzzy' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() =>
      expect(screen.getByText(/no omdb results/i)).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() =>
      expect(screen.getByText(/internal server error/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/no omdb results/i)).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })
})

describe('FRONTEND-015-AC-10/11/12: two or more results shows a picker', () => {
  it('renders one button per candidate with title/year/poster, and no second dialog', async () => {
    mockSearch.mockResolvedValue([
      {
        title: 'Spooks',
        year: 2002,
        imdbId: 'tt0290403',
        posterUrl: 'https://example.com/spooks.jpg',
      },
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
    ])
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getAllByTestId('lookup-candidate')).toHaveLength(2),
    )
    expect(screen.getByTestId('lookup-candidates')).toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByText(/spooks: code 9/i)).toBeInTheDocument()
    expect(mockResolve).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-015-AC-13/14/15: selecting a candidate resolves and applies it', () => {
  it('calls lookupByImdbId for the clicked candidate, applies it, and clears the picker', async () => {
    mockSearch.mockResolvedValue([
      { title: 'Spooks', year: 2002, imdbId: 'tt0290403' },
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
    ])
    mockResolve.mockResolvedValue({
      title: 'Spooks',
      year: 2002,
      imdbRating: 7.9,
    })
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^spooks \(2002\)$/i }))

    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith('tt0290403'))
    await waitFor(() =>
      expect(screen.getByLabelText(/^year/i)).toHaveValue(2002),
    )
    expect(screen.queryByTestId('lookup-candidates')).not.toBeInTheDocument()
  })

  it('disables every candidate button while a selection resolves', async () => {
    mockSearch.mockResolvedValue([
      { title: 'Spooks', year: 2002, imdbId: 'tt0290403' },
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
    ])
    mockResolve.mockReturnValue(new Promise(() => undefined))
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^spooks \(2002\)$/i }))

    await waitFor(() => {
      for (const btn of screen.getAllByTestId('lookup-candidate')) {
        expect(btn).toBeDisabled()
      }
    })
  })
})

describe('FRONTEND-015-AC-16: a failed candidate resolution keeps the picker open', () => {
  it('shows the error and leaves the picker showing with buttons re-enabled', async () => {
    mockSearch.mockResolvedValue([
      { title: 'Spooks', year: 2002, imdbId: 'tt0290403' },
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
    ])
    mockResolve.mockRejectedValue(
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
    await waitFor(() => screen.getAllByTestId('lookup-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^spooks \(2002\)$/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to reach/i),
    )
    const candidateButtons = screen.getAllByTestId('lookup-candidate')
    expect(candidateButtons).toHaveLength(2)
    for (const btn of candidateButtons) {
      expect(btn).not.toBeDisabled()
    }
  })
})

describe('FRONTEND-015-AC-17: dismissing the picker', () => {
  it('clears the picker without resolving anything', async () => {
    mockSearch.mockResolvedValue([
      { title: 'Spooks', year: 2002, imdbId: 'tt0290403' },
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
    ])
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-candidate'))

    fireEvent.click(screen.getByTestId('lookup-candidates-cancel'))

    expect(screen.queryByTestId('lookup-candidates')).not.toBeInTheDocument()
    expect(mockResolve).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-015-AC-18: re-clicking Look Up while the picker is open re-searches', () => {
  it('replaces the picker contents with the new search result', async () => {
    mockSearch.mockResolvedValueOnce([
      { title: 'Spooks', year: 2002, imdbId: 'tt0290403' },
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
    ])
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Spooks' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() =>
      expect(screen.getAllByTestId('lookup-candidate')).toHaveLength(2),
    )

    mockSearch.mockResolvedValueOnce([
      { title: 'Spooks', year: 2002, imdbId: 'tt0290403' },
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
      { title: 'Spooks: The Greater Good', year: 2015, imdbId: 'tt2379713' },
    ])
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getAllByTestId('lookup-candidate')).toHaveLength(3),
    )
    expect(mockSearch).toHaveBeenCalledTimes(2)
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

describe('FRONTEND-015-AC-20: no logging of search/resolve data', () => {
  it('never logs the searched title or a resolved result', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    mockSearch.mockResolvedValue([
      { title: 'Secret Show', imdbId: 'tt0000001' },
    ])
    mockResolve.mockResolvedValue({ title: 'Secret Show', imdbRating: 8.1 })
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Secret Show' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() => expect(mockResolve).toHaveBeenCalled())
    expect(
      logSpy.mock.calls.flat().some((c) => String(c).includes('Secret Show')),
    ).toBe(false)
  })
})

describe('FRONTEND-016-AC-04: escape hatch shown alongside zero OMDb results', () => {
  it('renders search-tmdb-btn next to the lookup-error message', async () => {
    mockSearch.mockResolvedValue([])
    renderForm()
    await runLookup('Spooks')

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no matches found/i),
    )
    expect(screen.getByTestId('search-tmdb-btn')).toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-05: escape hatch shown alongside the OMDb candidate picker', () => {
  it('renders search-tmdb-btn next to lookup-candidates-cancel', async () => {
    mockSearch.mockResolvedValue([
      { title: 'Spooks: Code 9', year: 2008, imdbId: 'tt1219342' },
      { title: "Frankelda's Book of Spooks", year: 2024, imdbId: 'tt9999999' },
    ])
    renderForm()
    await runLookup('Spooks')

    await waitFor(() => screen.getAllByTestId('lookup-candidate'))
    expect(screen.getByTestId('search-tmdb-btn')).toBeInTheDocument()
    expect(screen.getByTestId('lookup-candidates-cancel')).toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-06: no escape hatch on the exactly-one-result auto-resolve path', () => {
  it('does not render search-tmdb-btn when OMDb search auto-resolves a single candidate', async () => {
    mockSearch.mockResolvedValue([{ title: 'Spooks', imdbId: 'tt0290403' }])
    mockResolve.mockResolvedValue({ title: 'Spooks', year: 2002 })
    renderForm()
    await runLookup('Spooks')

    await waitFor(() =>
      expect(screen.getByLabelText(/^year/i)).toHaveValue(2002),
    )
    expect(screen.queryByTestId('search-tmdb-btn')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-07/12: clicking Search TMDB instead clears OMDb state and searches TMDB', () => {
  it('clears candidates/lookupError and calls searchTmdb with the trimmed title', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([])
    renderForm()
    await runLookup('  Spooks  ')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))

    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    expect(screen.getByTestId('search-tmdb-btn')).toHaveTextContent(
      /searching tmdb/i,
    )
    await waitFor(() => expect(mockSearchTmdb).toHaveBeenCalledWith('Spooks'))
  })
})

describe('FRONTEND-016-AC-08: zero TMDB results is a dead end', () => {
  it('shows a distinct message and does not re-render the escape hatch', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([])
    renderForm()
    await runLookup('Xyzzy')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /no matches found on tmdb/i,
      ),
    )
    expect(screen.queryByTestId('search-tmdb-btn')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('lookup-tmdb-candidates'),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-09/12: exactly one TMDB result auto-resolves', () => {
  it('resolves and applies the single TMDB candidate without showing a picker', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
    ])
    mockResolveTmdb.mockResolvedValue({
      title: 'Spooks',
      year: 2002,
      imdbId: 'tt0160904',
    })
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))

    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() => expect(mockResolveTmdb).toHaveBeenCalledWith(4046))
    await waitFor(() =>
      expect(screen.getByLabelText(/^year/i)).toHaveValue(2002),
    )
    expect(
      screen.queryByTestId('lookup-tmdb-candidates'),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-11: auto-resolve failure', () => {
  it('shows the lookup error and leaves fields untouched', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
    ])
    mockResolveTmdb.mockRejectedValue(
      new ApiError(
        502,
        'Unable to reach the series lookup service. Please try again.',
      ),
    )
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to reach/i),
    )
    expect(screen.getByLabelText(/^year/i)).toHaveValue(null)
  })
})

describe('FRONTEND-016-AC-10/13/14: two or more TMDB results shows a picker', () => {
  it('renders one button per candidate with title/year/originalTitle/poster', async () => {
    mockSearch.mockResolvedValue([])
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
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() =>
      expect(screen.getAllByTestId('lookup-tmdb-candidate')).toHaveLength(2),
    )
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByText(/la casa de papel/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-16/17/18: selecting a TMDB candidate resolves and applies it', () => {
  it('calls resolveTmdbCandidate for the clicked candidate, applies it, and clears the picker', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    mockResolveTmdb.mockResolvedValue({
      title: 'Spooks',
      year: 2002,
      imdbId: 'tt0160904',
    })
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-tmdb-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^spooks/i }))

    await waitFor(() => expect(mockResolveTmdb).toHaveBeenCalledWith(4046))
    await waitFor(() =>
      expect(screen.getByLabelText(/^year/i)).toHaveValue(2002),
    )
    expect(
      screen.queryByTestId('lookup-tmdb-candidates'),
    ).not.toBeInTheDocument()
  })

  it('disables every candidate button while a selection resolves', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    mockResolveTmdb.mockReturnValue(new Promise(() => undefined))
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-tmdb-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^spooks/i }))

    await waitFor(() => {
      for (const btn of screen.getAllByTestId('lookup-tmdb-candidate')) {
        expect(btn).toBeDisabled()
      }
    })
  })
})

describe('FRONTEND-016-AC-19: a failed TMDB candidate resolution keeps the picker open', () => {
  it('shows the error and leaves the TMDB picker showing, buttons re-enabled', async () => {
    mockSearch.mockResolvedValue([])
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
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-tmdb-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^spooks/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to reach/i),
    )
    expect(screen.getAllByTestId('lookup-tmdb-candidate')).toHaveLength(2)
    expect(screen.getAllByTestId('lookup-tmdb-candidate')[0]).not.toBeDisabled()
  })
})

describe('FRONTEND-016-AC-15: dismissing the TMDB picker', () => {
  it('clears the picker without resolving anything', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-tmdb-candidate'))

    fireEvent.click(screen.getByTestId('lookup-tmdb-candidates-cancel'))

    expect(
      screen.queryByTestId('lookup-tmdb-candidates'),
    ).not.toBeInTheDocument()
    expect(mockResolveTmdb).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-016-AC-21: re-clicking Look Up clears a stale TMDB picker', () => {
  it('clears tmdbCandidates when a fresh OMDb search cycle starts', async () => {
    mockSearch.mockResolvedValueOnce([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-tmdb-candidate'))

    mockSearch.mockResolvedValueOnce([])
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(
        screen.queryByTestId('lookup-tmdb-candidates'),
      ).not.toBeInTheDocument(),
    )
  })
})

describe('FRONTEND-016-AC-22: no logging of TMDB search/resolve data', () => {
  it('never logs the searched title or a resolved TMDB result', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 1, title: 'Secret Show' }])
    mockResolveTmdb.mockResolvedValue({ title: 'Secret Show' })
    renderForm()
    await runLookup('Secret Show')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() => expect(mockResolveTmdb).toHaveBeenCalled())
    expect(
      logSpy.mock.calls.flat().some((c) => String(c).includes('Secret Show')),
    ).toBe(false)
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

describe('FRONTEND-017-AC-04/06: typed title differs from the OMDb auto-resolved result', () => {
  it('captures the typed title into Alternate Title', async () => {
    mockSearch.mockResolvedValue([{ title: 'MI-5', imdbId: 'tt0160904' }])
    mockResolve.mockResolvedValue({
      title: 'MI-5',
      year: 2002,
      imdbId: 'tt0160904',
    })
    renderForm()
    await runLookup('Spooks')

    await waitFor(() =>
      expect(screen.getByLabelText(/^title/i)).toHaveValue('MI-5'),
    )
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('Spooks')
  })
})

describe('FRONTEND-017-AC-05: typed title matches the resolved result (case/whitespace-insensitive)', () => {
  it('leaves Alternate Title blank', async () => {
    mockSearch.mockResolvedValue([
      { title: 'Breaking Bad', imdbId: 'tt0903747' },
    ])
    mockResolve.mockResolvedValue({ title: 'Breaking Bad', year: 2008 })
    renderForm()
    await runLookup('  breaking bad  ')

    await waitFor(() =>
      expect(screen.getByLabelText(/^title/i)).toHaveValue('Breaking Bad'),
    )
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('')
  })
})

describe('FRONTEND-017-AC-07: OMDb candidate-picker selection uses the typed title as the reference', () => {
  it('captures the typed title into Alternate Title when the selected candidate resolves to a different name', async () => {
    mockSearch.mockResolvedValue([
      { title: 'MI-5', imdbId: 'tt0160904' },
      { title: 'Spooks: Code 9', imdbId: 'tt1219342' },
    ])
    mockResolve.mockResolvedValue({
      title: 'MI-5',
      year: 2002,
      imdbId: 'tt0160904',
    })
    renderForm()
    await runLookup('Spooks')
    await waitFor(() => screen.getAllByTestId('lookup-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^mi-5/i }))

    await waitFor(() =>
      expect(screen.getByLabelText(/^title/i)).toHaveValue('MI-5'),
    )
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('Spooks')
  })
})

describe("FRONTEND-017-AC-08: TMDB auto-resolve uses the selected candidate's own title as the reference", () => {
  it('captures the TMDB candidate title, not the originally-typed term', async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
    ])
    mockResolveTmdb.mockResolvedValue({
      title: 'MI-5',
      year: 2002,
      imdbId: 'tt0160904',
    })
    renderForm()
    await runLookup('spooks uk drama')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))

    await waitFor(() =>
      expect(screen.getByLabelText(/^title/i)).toHaveValue('MI-5'),
    )
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('Spooks')
  })
})

describe("FRONTEND-017-AC-09: TMDB candidate-picker selection uses the selected candidate's own title as the reference", () => {
  it("captures the selected TMDB candidate's title, not the originally-typed term", async () => {
    mockSearch.mockResolvedValue([])
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 4046, title: 'Spooks', year: 2002 },
      { tmdbId: 65327, title: 'Money Heist', year: 2017 },
    ])
    mockResolveTmdb.mockResolvedValue({
      title: 'MI-5',
      year: 2002,
      imdbId: 'tt0160904',
    })
    renderForm()
    await runLookup('spooks uk drama')
    await waitFor(() => screen.getByTestId('search-tmdb-btn'))
    fireEvent.click(screen.getByTestId('search-tmdb-btn'))
    await waitFor(() => screen.getAllByTestId('lookup-tmdb-candidate'))

    fireEvent.click(screen.getByRole('button', { name: /^spooks/i }))

    await waitFor(() =>
      expect(screen.getByLabelText(/^title/i)).toHaveValue('MI-5'),
    )
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('Spooks')
  })
})

describe('FRONTEND-017-AC-11: Alternate Title field renders between Title and Year', () => {
  it('renders an editable, initially-empty Alternate Title input', () => {
    renderForm()
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('')
  })
})

describe('FRONTEND-017-AC-12: submission payload includes/omits alternateTitle', () => {
  it('omits alternateTitle when blank', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('alternateTitle')
  })

  it('includes a trimmed alternateTitle when populated', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'MI-5' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'MI-5' },
    })
    fireEvent.change(screen.getByLabelText(/alternate title/i), {
      target: { value: '  Spooks  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate.mock.calls[0][0].alternateTitle).toBe('Spooks')
  })
})

describe('FRONTEND-017-AC-13: buildInitialFormState populates alternateTitle from initialValues', () => {
  it('pre-fills Alternate Title when initialValues.alternateTitle is set', () => {
    render(
      <AddSeriesForm
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
        initialValues={{ title: 'MI-5', alternateTitle: 'Spooks' }}
      />,
    )
    expect(screen.getByLabelText(/alternate title/i)).toHaveValue('Spooks')
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
