import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NameStatsTable } from './NameStatsTable'

// FRONTEND-095: status-scope filter ("All Series" / "Completed Only") added
// directly to the shared NameStatsTable -- exercised here against the
// component itself (rather than through KeywordsView/GenreStatsView) since
// FRONTEND-095-AC-07 requires those two wrappers to stay unmodified.

const defaultProps = {
  testId: 't',
  heading: 'T',
  idPrefix: 't',
  nameColumnLabel: 'Name',
  loadingLabel: 'L',
  errorLabel: 'E',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-095-AC-04: status scope filter control', () => {
  it('renders a labelled status-filter select defaulting to All Series', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<NameStatsTable {...defaultProps} fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

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
    render(<NameStatsTable {...defaultProps} fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(fetchStats.mock.calls.at(-1)?.[0]).not.toHaveProperty(
        'onlyCompleted',
      ),
    )
  })

  it('sends onlyCompleted: true after selecting Completed Only and applying', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<NameStatsTable {...defaultProps} fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

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
    render(<NameStatsTable {...defaultProps} fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

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
    render(<NameStatsTable {...defaultProps} fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fetchStats.mockClear()
    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: 'completed' },
    })

    expect(fetchStats).not.toHaveBeenCalled()
  })
})
