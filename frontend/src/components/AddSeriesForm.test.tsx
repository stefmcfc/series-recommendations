import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AddSeriesForm } from './AddSeriesForm'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockCreate = vi.mocked(seriesApi.create)
const mockLookup = vi.mocked(seriesApi.lookupByTitle)

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

describe('FRONTEND-009-AC-04/05/06: triggering a lookup', () => {
  it('disables Look Up until a title is entered, then calls lookupByTitle', async () => {
    mockLookup.mockResolvedValue({ title: 'Show' })
    renderForm()

    expect(screen.getByTestId('lookup-btn')).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    expect(screen.getByTestId('lookup-btn')).not.toBeDisabled()

    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('Show'))
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('trims the title before calling lookupByTitle', async () => {
    mockLookup.mockResolvedValue({ title: 'Show' })
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: '  Show  ' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('Show'))
  })
})

describe('FRONTEND-009-AC-07/08/09: autofill overwrite rules', () => {
  it('overwrites empty fields but leaves user-entered totalEpisodes alone when the result omits it', async () => {
    mockLookup.mockResolvedValue({
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
  })

  it('never touches status, personalRating, or personalNotes', async () => {
    mockLookup.mockResolvedValue({ title: 'Show', imdbRating: 7.5 })
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
})

describe('FRONTEND-009-AC-10/11/12: lookup loading and error', () => {
  it('shows "Looking up..." while in flight and disables the button', () => {
    mockLookup.mockReturnValue(new Promise(() => undefined))
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    expect(screen.getByTestId('lookup-btn')).toHaveTextContent(/looking up/i)
    expect(screen.getByTestId('lookup-btn')).toBeDisabled()
  })

  it('shows a scoped alert on failure without touching form fields, and Save still works', async () => {
    mockLookup.mockRejectedValue(
      new ApiError(404, 'No OMDb results for title: Xyzzy'),
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
    mockLookup.mockRejectedValue(
      new ApiError(404, 'No OMDb results for title: Xyzzy'),
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

describe('FRONTEND-009-AC-23: no lookup logging', () => {
  it('never logs the looked-up title or the lookup result', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    mockLookup.mockResolvedValue({ title: 'Secret Show', imdbRating: 8.1 })
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Secret Show' },
    })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() => expect(mockLookup).toHaveBeenCalled())
    expect(
      logSpy.mock.calls.flat().some((c) => String(c).includes('Secret Show')),
    ).toBe(false)
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
