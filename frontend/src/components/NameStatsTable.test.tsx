import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NameStatsTable } from './NameStatsTable'
import type { NameStatsOptions, NameStat } from './NameStatsTable'
import { useNameStatsFilters } from '../hooks/useNameStatsFilters'
import { seriesApi } from '../services/seriesApi'

// FRONTEND-129-AC-03: NameStatsTable now renders a SavedFiltersList/
// FilterProfileActions pair (area ANALYSIS_FILTERS) that fetches on mount
// while its "Analysis Filters" box is expanded -- mocked here (not
// previously needed by this file) so every pre-existing test sees no
// behavior change, mirroring RecommendationFiltersBox.test.tsx's own
// FRONTEND-107-AC-11 comment for why.
vi.mock('../services/seriesApi')

// FRONTEND-095: status-scope filter ("All Series" / "Completed Only") added
// directly to the shared NameStatsTable -- exercised here against the
// component itself (rather than through KeywordsView/GenreStatsView) since
// FRONTEND-095-AC-07 requires those two wrappers to stay unmodified.
//
// FRONTEND-096: filter/sort/panel-open state moved out of NameStatsTable
// into the shared useNameStatsFilters hook (now supplied via a `filters`
// prop). This Harness wraps NameStatsTable with a real instance of that
// hook -- rather than a static double -- so toggling/applying/resetting
// exercise the exact same state machine AnalysisView wires up in
// production, matching the "explicit-submit" contract these tests already
// depended on before this spec.

const defaultProps = {
  testId: 't',
  heading: 'T',
  idPrefix: 't',
  nameColumnLabel: 'Name',
  loadingLabel: 'L',
  errorLabel: 'E',
}

function Harness({
  fetchStats,
}: {
  fetchStats: (options: NameStatsOptions) => Promise<NameStat[]>
}) {
  const filters = useNameStatsFilters()
  return (
    <NameStatsTable
      {...defaultProps}
      fetchStats={fetchStats}
      filters={filters}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(seriesApi.listFilterProfiles).mockResolvedValue([])
})

describe('FRONTEND-096-AC-03: Apply Filters button styling', () => {
  it('uses the shared RecommendationControls applyButton class', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))

    const button = screen.getByRole('button', { name: /apply filters/i })
    expect(button.className).toContain('applyButton')
  })
})

describe('FRONTEND-096-AC-04/05: filters collapsed by default, toggle expands/collapses', () => {
  it('renders the filter fields collapsed behind an "Analysis Filters" toggle', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    expect(
      screen.getByRole('button', { name: /analysis filters/i }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Min Series Count')).not.toBeInTheDocument()
  })

  it('expands to show filter fields on click, collapses again on a second click', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())
    const toggle = screen.getByRole('button', { name: /analysis filters/i })

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Min Series Count')).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('FRONTEND-096-AC-06: active-filter-count badge reflects appliedFilters', () => {
  it('shows no badge when appliedFilters is entirely blank', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    expect(screen.queryByTestId('filters-active-count')).not.toBeInTheDocument()
  })

  it('shows a count badge once a filter is applied, not merely typed', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    fireEvent.change(screen.getByLabelText('Min Series Count'), {
      target: { value: '5' },
    })
    expect(screen.queryByTestId('filters-active-count')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(screen.getByTestId('filters-active-count')).toHaveTextContent('1'),
    )
  })
})

describe('FRONTEND-096-AC-07: Reset Filters re-fetches immediately', () => {
  it('calls fetchStats with cleared options as soon as Reset Filters is clicked', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    fireEvent.change(screen.getByLabelText('Min Series Count'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))
    await waitFor(() =>
      expect(fetchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ minSeriesCount: 5 }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }))

    await waitFor(() =>
      expect(fetchStats).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ minSeriesCount: expect.anything() }),
      ),
    )
    expect(screen.getByLabelText('Min Series Count')).toHaveValue(null)
  })
})

describe('FRONTEND-096-AC-08: Reset Filters leaves sort untouched', () => {
  it('preserves the active sortBy/sortDirection after Reset Filters', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('columnheader', { name: /series count/i }))
    await waitFor(() =>
      expect(fetchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'seriesCount' }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }))

    await waitFor(() =>
      expect(fetchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'seriesCount' }),
      ),
    )
  })
})

describe('FRONTEND-095-AC-04: status scope filter control', () => {
  it('renders a labelled status-filter select defaulting to All Series', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))

    const select = screen.getByLabelText(/status/i) as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.id).toBe('t-status-filter')
    expect(select.value).toBe('all')
    expect(
      screen.getByRole('option', { name: /all series/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /completed only/i }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-095-AC-05/06: status scope filter on Apply', () => {
  it('defaults to All Series and omits onlyCompleted on Apply', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(fetchStats.mock.calls.at(-1)?.[0]).not.toHaveProperty(
        'onlyCompleted',
      ),
    )
  })

  it('sends onlyCompleted: true after selecting Completed Only and applying', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: 'completed' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(fetchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ onlyCompleted: true }),
      ),
    )
  })

  it('reverting back to All Series and applying omits onlyCompleted again', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: 'completed' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))
    await waitFor(() =>
      expect(fetchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ onlyCompleted: true }),
      ),
    )

    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: 'all' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(fetchStats.mock.calls.at(-1)?.[0]).not.toHaveProperty(
        'onlyCompleted',
      ),
    )
  })

  it('does not re-fetch with onlyCompleted merely from selecting, before Apply is clicked', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    fetchStats.mockClear()
    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: 'completed' },
    })

    expect(fetchStats).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-086-AC-04/05/06: minimum-value filters', () => {
  it('applies only the filled-in filters on Apply, omitting blank ones', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    fireEvent.change(screen.getByLabelText('Min Series Count'), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(fetchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ minSeriesCount: 3 }),
      ),
    )
    expect(fetchStats.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      'minAveragePersonalRating',
    )
  })
})

describe('FRONTEND-131-AC-10: Min Avg Blended Rating has an info disclosure', () => {
  it('renders the disclosure button beside the field, once expanded', async () => {
    vi.mocked(seriesApi.listFilterProfiles).mockResolvedValue([])
    render(<Harness fetchStats={vi.fn().mockResolvedValue([])} />)
    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    expect(
      await screen.findByRole('button', {
        name: 'About Min Avg Blended Rating',
      }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-129-AC-03: Saved Filters list and actions bookend the fields in NameStatsTable', () => {
  it('renders the list before Min Series Count and actions before Reset Filters, once expanded', async () => {
    vi.mocked(seriesApi.listFilterProfiles).mockResolvedValue([])
    render(<Harness fetchStats={vi.fn().mockResolvedValue([])} />)
    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))

    const body = screen.getByTestId('filters-body')
    const list = await screen.findByTestId('filter-profile-selector')
    const actions = await screen.findByTestId('filter-profile-actions')
    const minSeriesCountField = screen.getByLabelText('Min Series Count')
    const resetButton = screen.getByTestId('reset-filters-btn')

    expect(body.contains(list)).toBe(true)
    expect(
      list.compareDocumentPosition(minSeriesCountField) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      minSeriesCountField.compareDocumentPosition(actions) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      actions.compareDocumentPosition(resetButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('table rendering and sort', () => {
  it('renders a row per stat and sorts on column header click', async () => {
    const fetchStats = vi.fn().mockResolvedValue([
      {
        name: 'spy',
        seriesCount: 4,
        averagePersonalRating: 4.2,
        averageBlendedRating: 7.5,
      },
    ])
    render(<Harness fetchStats={fetchStats} />)

    expect(await screen.findByText('spy')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('columnheader', { name: /^name/i }))
    await waitFor(() =>
      expect(fetchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'name' }),
      ),
    )
  })

  it('shows a loading state while the fetch is in flight', () => {
    const fetchStats = vi.fn().mockReturnValue(new Promise(() => {}))
    render(<Harness fetchStats={fetchStats} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error alert when the fetch rejects', async () => {
    const fetchStats = vi.fn().mockRejectedValue(new Error('boom'))
    render(<Harness fetchStats={fetchStats} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
