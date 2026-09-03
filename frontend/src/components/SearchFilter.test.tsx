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
    fireEvent.change(screen.getByLabelText(/min imdb rating/i), {
      target: { value: '7.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ minImdbRating: 7.5 }),
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

    fireEvent.click(screen.getByTestId('clear-filters-btn'))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/min imdb rating/i)).toHaveValue(null)
  })
})

describe('FRONTEND-006-AC-19: no console logging of filter values', () => {
  it('never logs entered filter values to the console', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const { onSearch } = renderFilter()
    // FRONTEND-077-AC-04: the inline Keywords field no longer has its own
    // input (hideInput) -- typing now happens in the "Browse all keywords"
    // modal instead.
    fireEvent.click(
      screen.getByRole('button', { name: /browse all keywords/i }),
    )
    const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
    const dialogInput = within(dialog).getByLabelText('Keywords')
    fireEvent.change(dialogInput, { target: { value: 'secret-title' } })
    fireEvent.keyDown(dialogInput, { key: 'Enter' })
    fireEvent.click(within(dialog).getByRole('button', { name: /^done$/i }))

    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalled()
    expect(
      logSpy.mock.calls.flat().some((c) => String(c).includes('secret-title')),
    ).toBe(false)
  })
})

describe('FRONTEND-029-AC-14/15/16: inline vocabulary-constrained picker', () => {
  // FRONTEND-077-AC-04: hideInput moved typing/suggestion-filtering from the
  // inline Keywords field to the "Browse all keywords" modal -- this test
  // now exercises that flow, while the underlying behavioral assertion
  // (picking a keyword ends up in the built criteria on Search) is
  // unchanged.
  it('filters suggestions as text is typed in the browse modal, and includes a chosen keyword on Search', async () => {
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

    fireEvent.click(
      screen.getByRole('button', { name: /browse all keywords/i }),
    )
    const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
    const input = within(dialog).getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'sp' } })
    expect(
      within(dialog).queryByRole('button', { name: 'heist' }),
    ).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'spy' }))
    fireEvent.click(within(dialog).getByRole('button', { name: /^done$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: ['spy'] }),
    )
  })

  // Live review (2026-08-24) found the default suggestion list read as
  // cluttered in this field's narrower layout -- reverted to
  // frontend_spec_029's original "no suggestions until typed" behavior
  // here specifically. FRONTEND-077-AC-04 (frontend_spec_077) has since
  // hidden the inline field's input entirely (hideInput), so this
  // "no suggestions until typed" premise no longer applies to it -- and it
  // was never meant to apply to the "Browse all keywords" modal, which is
  // deliberately uncapped/shows-everything-immediately by design (already
  // covered by FRONTEND-032-AC-10 below). Superseded rather than replaced
  // 1:1: this original test's premise has no remaining call site to attach
  // to. Replaced with a direct regression check that the inline field no
  // longer renders any suggestions UI, capped or not.
  it('renders no suggestions for the inline field regardless of typed text (hideInput)', async () => {
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
    expect(
      screen.queryByPlaceholderText(/type to filter tracked keywords/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'spy' }),
    ).not.toBeInTheDocument()
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
    // FRONTEND-077-AC-04: the inline Keywords field no longer has a
    // <label htmlFor> once hideInput is set -- a non-visual aria-label now.
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

describe('FRONTEND-032-AC-09: free text is accepted via the browse-all-keywords modal', () => {
  // FRONTEND-077-AC-04: the inline field no longer has its own input
  // (hideInput) -- the "Browse all keywords" modal is now the only place to
  // type, so free-text add is exercised there instead. The resulting pill
  // still renders inline (outside the modal), unaffected by hideInput.
  it('adds typed text not present in options on Enter, inside the modal', () => {
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: /browse all keywords/i }),
    )
    const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
    const input = within(dialog).getByPlaceholderText(
      /type to filter tracked keywords/i,
    )
    fireEvent.change(input, { target: { value: 'brand-new-keyword' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(within(dialog).getByRole('button', { name: /^done$/i }))
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

describe('FRONTEND-029-AC-24/25: accessible names for the keyword picker', () => {
  // FRONTEND-077-AC-04: selection now happens via the modal's own labelled
  // input/suggestion buttons (hideInput removed the inline field's own
  // input) -- the resulting chip's accessible "Remove spy" name is still
  // asserted on the inline picker, since that's where selected chips render.
  it('selecting a suggestion in the browse modal produces a named inline Remove button', async () => {
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
    const input = within(dialog).getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'sp' } })
    expect(
      within(dialog).getByRole('button', { name: 'spy' }),
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'spy' }))
    fireEvent.click(within(dialog).getByRole('button', { name: /^done$/i }))
    expect(
      screen.getByRole('button', { name: 'Remove spy' }),
    ).toBeInTheDocument()
  })
})

// FRONTEND-012-AC-15's checkbox coverage is superseded outright by
// frontend_spec_074's Rewatch tab in App.tsx -- see
// FRONTEND-074-AC-04 below for its replacement coverage.
describe('FRONTEND-074-AC-04: sheet no longer has a rewatch checkbox', () => {
  it('does not render a Flagged for rewatch checkbox', () => {
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(
      screen.queryByLabelText(/flagged for rewatch/i),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-075-AC-01: Genres & Keywords section', () => {
  it('groups Genres and Keywords under one heading', () => {
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    const heading = screen.getByRole('heading', { name: 'Genres & Keywords' })
    const section = heading.closest('section') ?? heading.parentElement!
    expect(
      within(section).getByRole('button', { name: /^genres$/i }),
    ).toBeInTheDocument()
    // FRONTEND-077-AC-04: hideInput replaces the inline field's
    // <label htmlFor> with a non-visual aria-label once its own input is gone.
    expect(within(section).getByLabelText(/^keywords$/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-075-AC-02: Ratings section', () => {
  it('groups the three rating fields under one heading', () => {
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    const heading = screen.getByRole('heading', { name: 'Ratings' })
    const section = heading.closest('section') ?? heading.parentElement!
    expect(within(section).getByText('Min Personal Rating')).toBeInTheDocument()
    expect(
      within(section).getByLabelText(/min imdb rating/i),
    ).toBeInTheDocument()
    expect(
      within(section).getByLabelText(/min tmdb rating/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-075-AC-03: Years section', () => {
  it('groups Min Year and Max Year under one heading', () => {
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    const heading = screen.getByRole('heading', { name: 'Years' })
    const section = heading.closest('section') ?? heading.parentElement!
    expect(within(section).getByLabelText(/min year/i)).toBeInTheDocument()
    expect(within(section).getByLabelText(/max year/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-075-AC-04: dividers between sections', () => {
  it('applies a divider class to sections after the first', () => {
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    const ratingsSection = screen
      .getByRole('heading', { name: 'Ratings' })
      .closest('section')!
    const yearsSection = screen
      .getByRole('heading', { name: 'Years' })
      .closest('section')!
    const genresSection = screen
      .getByRole('heading', { name: 'Genres & Keywords' })
      .closest('section')!
    expect(ratingsSection.className).toMatch(/sectionDivider/)
    expect(yearsSection.className).toMatch(/sectionDivider/)
    expect(genresSection.className).not.toMatch(/sectionDivider/)
  })
})

describe('FRONTEND-075-AC-05: no change to field behavior', () => {
  it('still builds the same criteria shape after sectioning', () => {
    const onSearch = vi.fn()
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
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
  })
})

describe('FRONTEND-077-AC-04: SearchFilter inline Keywords hides its input', () => {
  it('shows no text input for the inline Keywords field, but the modal still has one', () => {
    render(
      <SearchFilter
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    expect(
      screen.queryByPlaceholderText('Type to filter tracked keywords'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Browse all keywords' }))
    expect(
      screen.getByPlaceholderText('Type to filter tracked keywords'),
    ).toBeInTheDocument()
  })
})
