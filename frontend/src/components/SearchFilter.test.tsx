import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SearchFilter } from './SearchFilter'
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

// FRONTEND-071-AC-04/05: SearchFilter is now an externally-controlled sheet
// (isOpen/onClose), not a self-toggling panel -- render it already open by
// default so existing field-level tests in this file don't need a separate
// "open" step. The now-removed "Show Filters" toggle's own behavior is
// covered by the FRONTEND-071-AC-04/05 tests further down instead.
function renderFilter(isOpen = true) {
  const onSearch = vi.fn()
  const onClear = vi.fn()
  const onClose = vi.fn()
  render(
    <SearchFilter
      isOpen={isOpen}
      onClose={onClose}
      onSearch={onSearch}
      onClear={onClear}
    />,
  )
  return { onSearch, onClear, onClose }
}

describe('FRONTEND-006-AC-01/02: fields', () => {
  it('renders a labelled control per SearchCriteria field', () => {
    renderFilter()
    for (const label of [
      /min imdb rating/i,
      /min tmdb rating/i,
      /min year/i,
      /max year/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })
})

describe('FRONTEND-073-AC-02: sheet no longer has a Title field', () => {
  it('does not render a Title input inside the sheet', () => {
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText(/^title$/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-006-AC-03/04/05: submit builds criteria', () => {
  it('calls onSearch with only populated fields', () => {
    const { onSearch } = renderFilter()
    fireEvent.click(screen.getByLabelText(/flagged for rewatch/i))
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ flaggedForRewatch: true }),
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
    fireEvent.click(screen.getByRole('button', { name: 'Rate 3 star(s)' }))
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

describe('FRONTEND-063-AC-03: GenreIncludeExcludePicker renders', () => {
  it('renders the picker trigger once filters are shown', async () => {
    mockGetGenreOptions.mockResolvedValue(['Comedy', 'Drama'])
    renderFilter()
    expect(
      await screen.findByRole('button', { name: 'Genres' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-063-AC-04: toggling submits genres/excludeGenres', () => {
  it('includes an included genre in onSearch criteria', async () => {
    mockGetGenreOptions.mockResolvedValue(['Drama', 'Comedy', 'Crime'])
    const { onSearch } = renderFilter()

    fireEvent.click(await screen.findByRole('button', { name: 'Genres' }))
    fireEvent.click(screen.getByRole('button', { name: 'Drama: neutral' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crime: neutral' }))
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ genres: ['Drama', 'Crime'] }),
    )
  })

  it('includes an excluded genre in onSearch criteria', async () => {
    mockGetGenreOptions.mockResolvedValue(['Comedy'])
    const onSearch = vi.fn()
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={onSearch}
        onClear={vi.fn()}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Genres' }))
    // neutral -> include -> exclude
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: neutral' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: include' }))
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
    fireEvent.click(screen.getByText('Search'))
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ excludeGenres: ['Comedy'] }),
    )
  })

  it('omits genres/excludeGenres from criteria when nothing is selected', () => {
    const { onSearch } = renderFilter()
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalledWith(
      expect.not.objectContaining({
        genres: expect.anything(),
        excludeGenres: expect.anything(),
      }),
    )
  })
})

describe('FRONTEND-063-AC-05: Clear Filters resets both genre selections', () => {
  it('resets the picker summary after Clear Filters', async () => {
    mockGetGenreOptions.mockResolvedValue(['Comedy'])
    renderFilter()
    fireEvent.click(await screen.findByRole('button', { name: 'Genres' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: neutral' }))
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
    fireEvent.click(screen.getByTestId('clear-filters-btn'))
    expect(screen.getByRole('button', { name: 'Genres' })).toBeInTheDocument()
  })
})

// FRONTEND-055-AC-04's inline show/hide disclosure is superseded outright by
// frontend_spec_071's externally-controlled sheet -- see the
// FRONTEND-071-AC-04/05/06/07/08 tests below for its replacement coverage.
describe('FRONTEND-071-AC-04: closed sheet renders nothing', () => {
  it('renders no dialog and no toggle button when isOpen is false', () => {
    render(
      <SearchFilter
        isOpen={false}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /show filters/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-071-AC-05: open sheet is an accessible dialog', () => {
  it('renders a labelled dialog and closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <SearchFilter
        isOpen={true}
        onClose={onClose}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: /filters/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    // Regression guard: focus must actually be inside the sheet on open, not
    // left on the funnel trigger button in SeriesList (a DOM sibling, not an
    // ancestor, of this dialog) -- otherwise a real Escape keypress right
    // after opening would never bubble to this dialog's own keydown handler.
    // Firing the event directly on `dialog` (as this test used to) can't
    // catch that class of bug, since it bypasses real focus/bubbling
    // entirely -- fire it from wherever focus actually landed instead.
    // FRONTEND-073-AC-02: Title (the previous focus target) has moved out of
    // this sheet -- Close is now the first focusable element inside it.
    expect(document.activeElement).toHaveAccessibleName('Close')
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the close control is clicked', () => {
    const onClose = vi.fn()
    render(
      <SearchFilter
        isOpen={true}
        onClose={onClose}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-071-AC-06: Search applies and closes', () => {
  it('calls onSearch then onClose on submit', () => {
    const onSearch = vi.fn()
    const onClose = vi.fn()
    render(
      <SearchFilter
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
        onClear={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText(/min imdb rating/i), {
      target: { value: '7.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ minImdbRating: 7.5 }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-071-AC-07: Clear Filters resets and closes', () => {
  it('calls onClear then onClose', () => {
    const onClear = vi.fn()
    const onClose = vi.fn()
    render(
      <SearchFilter
        isOpen={true}
        onClose={onClose}
        onSearch={vi.fn()}
        onClear={onClear}
      />,
    )

    fireEvent.click(screen.getByTestId('clear-filters-btn'))

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-071-AC-08: all fields still present', () => {
  it('renders every pre-existing field when open', () => {
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    for (const label of [
      /min imdb rating/i,
      /min tmdb rating/i,
      /min year/i,
      /max year/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('Min Personal Rating')).toBeInTheDocument()
    expect(screen.getByLabelText(/flagged for rewatch/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-055-AC-05: rating/year fields carry validation bounds', () => {
  it('rating and year fields carry the same bounds as Custom Search', () => {
    renderFilter()

    const minImdb = screen.getByLabelText(/min imdb rating/i)
    expect(minImdb).toHaveAttribute('min', '0')
    expect(minImdb).toHaveAttribute('max', '10')
    expect(minImdb).toHaveAttribute('step', '0.1')

    const minTmdb = screen.getByLabelText(/min tmdb rating/i)
    expect(minTmdb).toHaveAttribute('min', '0')
    expect(minTmdb).toHaveAttribute('max', '10')
    expect(minTmdb).toHaveAttribute('step', '0.1')

    const yearMin = screen.getByLabelText(/min year/i)
    expect(yearMin).toHaveAttribute('min', '1900')
    expect(yearMin).toHaveAttribute('max', String(new Date().getFullYear() + 1))

    const yearMax = screen.getByLabelText(/max year/i)
    expect(yearMax).toHaveAttribute('min', '1900')
    expect(yearMax).toHaveAttribute('max', String(new Date().getFullYear() + 1))
  })
})

describe('FRONTEND-055-AC-06: Min Personal Rating via StarRating', () => {
  it('sets minPersonalRating via stars', () => {
    const { onSearch } = renderFilter()

    fireEvent.click(screen.getByRole('button', { name: 'Rate 3 star(s)' }))
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ minPersonalRating: 3 }),
    )
  })

  it('clicking an already-selected star clears it', () => {
    const { onSearch } = renderFilter()

    fireEvent.click(screen.getByRole('button', { name: 'Rate 3 star(s)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rate 3 star(s)' }))
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.not.objectContaining({ minPersonalRating: expect.anything() }),
    )
  })
})

describe('FRONTEND-055-AC-07: Status dropdown removed', () => {
  it('no longer renders a Status field', () => {
    renderFilter()
    expect(screen.queryByLabelText(/^status$/i)).not.toBeInTheDocument()
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
    fireEvent.change(screen.getByLabelText(/min imdb rating/i), {
      target: { value: '7.5' },
    })
    fireEvent.click(screen.getByLabelText(/flagged for rewatch/i))

    fireEvent.click(screen.getByTestId('clear-filters-btn'))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/min imdb rating/i)).toHaveValue(null)
    expect(screen.getByLabelText(/flagged for rewatch/i)).not.toBeChecked()
  })
})

describe('FRONTEND-006-AC-19: no console logging of filter values', () => {
  it('never logs entered filter values to the console', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const { onSearch } = renderFilter()
    fireEvent.change(screen.getByLabelText('Keywords'), {
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
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={onSearch}
        onClear={vi.fn()}
      />,
    )

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
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )

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
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={onSearch}
        onClear={vi.fn()}
      />,
    )

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
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )

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
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )
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
    expect(
      screen.queryByRole('dialog', { name: /browse keywords/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remove spy' }),
    ).toBeInTheDocument()
  })

  it('closes on Escape without clearing selections', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    fireEvent.click(
      screen.getByRole('button', { name: /browse all keywords/i }),
    )
    const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
    fireEvent.change(within(dialog).getByLabelText('Keywords'), {
      target: { value: 'sp' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'spy' }))

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(
      screen.queryByRole('dialog', { name: /browse keywords/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remove spy' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-032-AC-09: inline field accepts free text', () => {
  it('adds typed text not present in options on Enter', () => {
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )
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
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    fireEvent.click(await screen.findByText('Browse all keywords'))
    const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
    expect(await within(dialog).findByText('kw-0')).toBeInTheDocument()
    expect(within(dialog).getByText('kw-14')).toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-23: opening the modal does not re-fetch keyword options', () => {
  it('calls getKeywordStats exactly once across mount + modal open', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )
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
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )
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
