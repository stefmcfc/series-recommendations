import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SearchFilter } from './SearchFilter'
import { SeriesStatus } from '../types/series'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

vi.mock('../services/seriesApi')
const mockGetKeywordStats = vi.mocked(seriesApi.getKeywordStats)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetKeywordStats.mockResolvedValue([])
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
      /genres/i,
      /status/i,
      /min personal rating/i,
      /max personal rating/i,
      /min imdb rating/i,
      /max imdb rating/i,
      /started.*not finished/i,
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
  it('calls onSearch with only populated fields, genres split and trimmed', () => {
    const { onSearch } = renderFilter()
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'office' },
    })
    fireEvent.change(screen.getByLabelText(/genres/i), {
      target: { value: 'Drama, Comedy ,' },
    })
    fireEvent.change(screen.getByLabelText(/^status/i), {
      target: { value: SeriesStatus.WATCHING },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'office',
        genres: ['Drama', 'Comedy'],
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

  it('includes numeric rating fields and the checkbox when populated', () => {
    const { onSearch } = renderFilter()
    fireEvent.change(screen.getByLabelText(/min personal rating/i), {
      target: { value: '3' },
    })
    fireEvent.change(screen.getByLabelText(/max personal rating/i), {
      target: { value: '5' },
    })
    fireEvent.change(screen.getByLabelText(/min imdb rating/i), {
      target: { value: '7.5' },
    })
    fireEvent.change(screen.getByLabelText(/max imdb rating/i), {
      target: { value: '9.2' },
    })
    fireEvent.click(screen.getByLabelText(/started.*not finished/i))
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith({
      minPersonalRating: 3,
      maxPersonalRating: 5,
      minImdbRating: 7.5,
      maxImdbRating: 9.2,
      startedNotFinished: true,
    })
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
    fireEvent.click(screen.getByLabelText(/started.*not finished/i))

    fireEvent.click(screen.getByTestId('clear-filters-btn'))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/title/i)).toHaveValue('')
    expect(screen.getByLabelText(/^status/i)).toHaveValue('')
    expect(screen.getByLabelText(/started.*not finished/i)).not.toBeChecked()
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

describe('FRONTEND-024-AC-12/13: keyword checkbox filter', () => {
  it('includes selected keywords in criteria, omits when none selected', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    const onSearch = vi.fn()
    render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^keywords$/i }))
    fireEvent.click(await screen.findByLabelText('spy'))
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: ['spy'] }),
    )
  })

  it('omits keywords from criteria when nothing is selected', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    const onSearch = vi.fn()
    render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^keywords$/i }))
    await screen.findByLabelText('spy')
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith({})
  })
})

describe('FRONTEND-024-AC-14: keyword fetch failure degrades gracefully', () => {
  it('renders the rest of SearchFilter when getKeywordStats rejects', async () => {
    mockGetKeywordStats.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-024-AC-20/21: keyword picker collapsed by default, expands on click', () => {
  it('hides the checkbox list until the toggle is clicked', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)

    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    expect(screen.queryByLabelText('spy')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^keywords$/i }))
    expect(await screen.findByLabelText('spy')).toBeInTheDocument()
  })

  it('renders the toggle with aria-expanded reflecting open state', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)

    const toggle = screen.getByRole('button', { name: /^keywords$/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('FRONTEND-024-AC-22/23: selected count shown collapsed, selections survive collapse', () => {
  it('shows a selected count on the collapsed toggle and keeps selections after re-collapsing', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^keywords$/i }))
    fireEvent.click(await screen.findByLabelText('spy'))
    fireEvent.click(screen.getByRole('button', { name: /keywords/i }))

    expect(
      screen.getByRole('button', { name: /keywords \(1 selected\)/i }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /keywords \(1 selected\)/i }),
    )
    expect(screen.getByLabelText('spy')).toBeChecked()
  })
})

describe('FRONTEND-024-AC-24: failed keyword fetch degrades gracefully regardless of open/closed state', () => {
  it('renders the scoped error whether or not the picker is expanded', async () => {
    mockGetKeywordStats.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^keywords$/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
