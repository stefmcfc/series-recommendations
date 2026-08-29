import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SearchFilter } from './SearchFilter'
import { SeriesStatus } from '../types/series'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

vi.mock('../services/seriesApi')
const mockGetKeywordStats = vi.mocked(seriesApi.getKeywordStats)
const mockGetGenreOptions = vi.mocked(seriesApi.getGenreOptions)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetKeywordStats.mockResolvedValue([])
  mockGetGenreOptions.mockResolvedValue([])
})

function renderFilter() {
  const onSearch = vi.fn()
  const onClear = vi.fn()
  render(<SearchFilter onSearch={onSearch} onClear={onClear} />)
  return { onSearch, onClear }
}

describe('FRONTEND-006-AC-01/02: fields', () => {
  it('renders a labelled control per SearchCriteria field, status defaulting to Any', () => {
    renderFilter()
    for (const label of [
      /title/i,
      /status/i,
      /min personal rating/i,
      /min imdb rating/i,
      /min tmdb rating/i,
      /min year/i,
      /max year/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByLabelText(/^status/i)).toHaveValue('')
  })

  it('status select includes Any status plus all SeriesStatus values', () => {
    renderFilter()
    const select = screen.getByLabelText(/^status/i) as HTMLSelectElement
    const optionValues = Array.from(select.options).map((o) => o.value)
    expect(optionValues).toEqual([
      '',
      SeriesStatus.WATCHING,
      SeriesStatus.COMPLETED,
      SeriesStatus.DROPPED,
      SeriesStatus.BACKLOG,
    ])
  })
})

describe('FRONTEND-006-AC-03/04/05: submit builds criteria', () => {
  it('calls onSearch with only populated fields', () => {
    const { onSearch } = renderFilter()
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'office' },
    })
    fireEvent.change(screen.getByLabelText(/^status/i), {
      target: { value: SeriesStatus.WATCHING },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'office',
        status: SeriesStatus.WATCHING,
      }),
    )
    const payload = onSearch.mock.calls[0][0]
    expect(payload).not.toHaveProperty('minPersonalRating')
  })

  it('calls onSearch with an empty object when every field is blank', () => {
    const { onSearch } = renderFilter()
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalledWith({})
  })

  it('includes numeric rating fields when populated', () => {
    const { onSearch } = renderFilter()
    fireEvent.change(screen.getByLabelText(/min personal rating/i), {
      target: { value: '3' },
    })
    fireEvent.change(screen.getByLabelText(/min imdb rating/i), {
      target: { value: '7.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith({
      minPersonalRating: 3,
      minImdbRating: 7.5,
    })
  })
})

describe('FRONTEND-055-AC-01: removed fields', () => {
  it('no longer renders the removed fields', () => {
    renderFilter()
    expect(
      screen.queryByLabelText(/max personal rating/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/max imdb rating/i)).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/started, not finished/i),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-055-AC-02: min TMDB rating and min/max year', () => {
  it('submits minTmdbRating and yearMin/yearMax', () => {
    const { onSearch } = renderFilter()

    fireEvent.change(screen.getByLabelText(/min tmdb rating/i), {
      target: { value: '7.5' },
    })
    fireEvent.change(screen.getByLabelText(/min year/i), {
      target: { value: '2015' },
    })
    fireEvent.change(screen.getByLabelText(/max year/i), {
      target: { value: '2025' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        minTmdbRating: 7.5,
        yearMin: 2015,
        yearMax: 2025,
      }),
    )
  })
})

describe('FRONTEND-055-AC-03: genre checkbox list', () => {
  it('renders genres as checkboxes and submits selected ones', async () => {
    mockGetGenreOptions.mockResolvedValue(['Drama', 'Comedy', 'Crime'])
    const { onSearch } = renderFilter()

    fireEvent.click(await screen.findByLabelText('Drama'))
    fireEvent.click(screen.getByLabelText('Crime'))
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ genres: ['Drama', 'Crime'] }),
    )
  })

  it('omits genres from criteria when nothing is selected', () => {
    const { onSearch } = renderFilter()
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalledWith(
      expect.not.objectContaining({ genres: expect.anything() }),
    )
  })
})

describe('FRONTEND-055-AC-04: collapsible filter panel', () => {
  it('filters are visible by default and can be collapsed', () => {
    renderFilter()
    expect(screen.getByTestId('filters-body')).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: /hide filters/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(toggle)
    expect(screen.queryByTestId('filters-body')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /show filters/i }),
    ).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('FRONTEND-006-AC-06: no auto-search on mount', () => {
  it('does not call onSearch just from rendering', () => {
    const { onSearch } = renderFilter()
    expect(onSearch).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-006-AC-07/08: clearing', () => {
  it('renders a Clear Filters button', () => {
    renderFilter()
    expect(screen.getByTestId('clear-filters-btn')).toBeInTheDocument()
  })

  it('resets fields and calls onClear, not onSearch', () => {
    const { onSearch, onClear } = renderFilter()
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'office' },
    })
    fireEvent.change(screen.getByLabelText(/^status/i), {
      target: { value: SeriesStatus.WATCHING },
    })
    fireEvent.click(screen.getByLabelText(/flagged for rewatch/i))

    fireEvent.click(screen.getByTestId('clear-filters-btn'))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/title/i)).toHaveValue('')
    expect(screen.getByLabelText(/^status/i)).toHaveValue('')
    expect(screen.getByLabelText(/flagged for rewatch/i)).not.toBeChecked()
  })
})

describe('FRONTEND-006-AC-19: no console logging of filter values', () => {
  it('never logs entered filter values to the console', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const { onSearch } = renderFilter()
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'secret-title' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalled()
    expect(
      logSpy.mock.calls.flat().some((c) => String(c).includes('secret-title')),
    ).toBe(false)
  })
})

describe('FRONTEND-029-AC-14/15/16: inline vocabulary-constrained picker', () => {
  it('filters suggestions as text is typed, and includes a chosen keyword on Search', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
      { name: 'heist', seriesCount: 2, averagePersonalRating: 3.1 },
    ])
    const onSearch = vi.fn()
    render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)

    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'sp' } })
    expect(
      screen.queryByRole('button', { name: 'heist' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'spy' }))
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: ['spy'] }),
    )
  })

  // Live review (2026-08-24) found the default suggestion list read as
  // cluttered in this field's narrower layout -- reverted to
  // frontend_spec_029's original "no suggestions until typed" behavior
  // here specifically; "Browse all keywords" is the dedicated surface for
  // browsing without typing (frontend_spec_032 Requirement 4).
  it('shows no suggestions until something is typed', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)

    await screen.findByPlaceholderText(/type to filter tracked keywords/i)
    expect(
      screen.queryByRole('button', { name: 'spy' }),
    ).not.toBeInTheDocument()

    fireEvent.change(
      screen.getByPlaceholderText(/type to filter tracked keywords/i),
      {
        target: { value: 'sp' },
      },
    )
    expect(
      await screen.findByRole('button', { name: 'spy' }),
    ).toBeInTheDocument()
  })

  it('omits keywords from criteria when nothing is selected', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    const onSearch = vi.fn()
    render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)

    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith({})
  })
})

describe('FRONTEND-029-AC-17: keyword fetch failure degrades gracefully', () => {
  it('renders a scoped inline error and still renders the rest of SearchFilter', async () => {
    mockGetKeywordStats.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)

    await screen.findByRole('alert')
    expect(
      screen.getByRole('button', { name: /^search$/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Keywords')).toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-18/19/20/21/22: browse-all-keywords modal', () => {
  it('opens a labelled dialog, focuses its input, and shares selection state with the inline picker', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    fireEvent.click(
      screen.getByRole('button', { name: /browse all keywords/i }),
    )
    const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByLabelText('Keywords')).toHaveFocus()

    fireEvent.change(within(dialog).getByLabelText('Keywords'), {
      target: { value: 'sp' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'spy' }))

    fireEvent.click(within(dialog).getByRole('button', { name: /^done$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remove spy' }),
    ).toBeInTheDocument()
  })

  it('closes on Escape without clearing selections', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    fireEvent.click(
      screen.getByRole('button', { name: /browse all keywords/i }),
    )
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Keywords'), {
      target: { value: 'sp' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'spy' }))

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remove spy' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-032-AC-09: inline field accepts free text', () => {
  it('adds typed text not present in options on Enter', () => {
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    const input = screen.getByPlaceholderText(
      /type to filter tracked keywords/i,
    )
    fireEvent.change(input, { target: { value: 'brand-new-keyword' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('brand-new-keyword')).toBeInTheDocument()
  })
})

describe('FRONTEND-032-AC-10: "Browse all keywords" modal shows the full list with nothing typed', () => {
  it("renders every tracked keyword without a cap, including entries past the inline field's cap", async () => {
    mockGetKeywordStats.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({
        name: `kw-${i}`,
        seriesCount: 15 - i,
        averagePersonalRating: null,
      })),
    )
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    fireEvent.click(await screen.findByText('Browse all keywords'))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText('kw-0')).toBeInTheDocument()
    expect(within(dialog).getByText('kw-14')).toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-23: opening the modal does not re-fetch keyword options', () => {
  it('calls getKeywordStats exactly once across mount + modal open', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalledTimes(1))

    fireEvent.click(
      screen.getByRole('button', { name: /browse all keywords/i }),
    )
    expect(mockGetKeywordStats).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-029-AC-24/25: accessible names for the inline keyword field', () => {
  it('inline keyword field is reachable by label with named suggestion/remove buttons', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'sp' } })
    expect(screen.getByRole('button', { name: 'spy' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'spy' }))
    expect(
      screen.getByRole('button', { name: 'Remove spy' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-012-AC-15: rewatch filter checkbox', () => {
  it('renders unchecked by default', () => {
    renderFilter()
    expect(screen.getByLabelText(/flagged for rewatch/i)).not.toBeChecked()
  })

  it('includes flaggedForRewatch in criteria only when checked', () => {
    const { onSearch } = renderFilter()

    fireEvent.click(screen.getByLabelText(/flagged for rewatch/i))
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ flaggedForRewatch: true }),
    )
  })

  it('omits flaggedForRewatch when left unchecked', () => {
    const { onSearch } = renderFilter()

    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.not.objectContaining({ flaggedForRewatch: expect.anything() }),
    )
  })
})
