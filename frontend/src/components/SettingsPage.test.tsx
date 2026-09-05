import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SettingsPage } from './SettingsPage'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

vi.mock('../services/seriesApi')
const mockExport = vi.mocked(seriesApi.export)
const mockRefreshAll = vi.mocked(seriesApi.refreshAll)
const mockGetRefreshStatus = vi.mocked(seriesApi.getRefreshStatus)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetRefreshStatus.mockResolvedValue({
    status: 'IDLE',
    totalCount: 0,
    completedCount: 0,
    skippedCount: 0,
    startedAt: null,
    finishedAt: null,
  })
})

describe('FRONTEND-070-AC-03: SettingsPage renders its heading', () => {
  it('renders a heading', () => {
    render(<SettingsPage />)

    expect(screen.getByTestId('settings-view')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-057-AC-05: Settings renders Import after Export, no stale placeholder', () => {
  it('renders the Import controls and drops the old placeholder copy', () => {
    render(<SettingsPage />)

    expect(screen.getByTestId('import-file-input')).toBeInTheDocument()
    expect(
      screen.queryByText(/no settings are available yet/i),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-072-AC-02: Settings renders unfiltered Export controls', () => {
  it('calls seriesApi.export with no criteria when Export JSON is clicked', async () => {
    mockExport.mockResolvedValue({ blob: new Blob(), filename: 'series.json' })
    render(<SettingsPage />)

    fireEvent.click(screen.getByTestId('export-json-btn'))

    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledWith('json', undefined)
    })
  })

  it('calls seriesApi.export with no criteria when Export CSV is clicked', async () => {
    mockExport.mockResolvedValue({ blob: new Blob(), filename: 'series.csv' })
    render(<SettingsPage />)

    fireEvent.click(screen.getByTestId('export-csv-btn'))

    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledWith('csv', undefined)
    })
  })
})

describe('FRONTEND-072-AC-04: Settings resyncs Refresh All state on mount', () => {
  it('shows in-progress state when a job is already running server-side', async () => {
    mockGetRefreshStatus.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 10,
      completedCount: 3,
      skippedCount: 0,
      startedAt: '2026-09-01T00:00:00',
      finishedAt: null,
    })
    render(<SettingsPage />)

    expect(await screen.findByText(/Refreshing 3 of 10/)).toBeInTheDocument()
    expect(screen.getByTestId('refresh-all-btn')).toBeDisabled()
  })
})

describe('FRONTEND-072-AC-05: Refresh All starts a job and polls to completion', () => {
  // Real timers + a generous waitFor timeout, matching the established
  // pattern used by FRONTEND-023-AC-10/12/13 below -- vitest's fake timers
  // don't reliably interleave with RTL's findBy/waitFor polling and this
  // component's mount-time getRefreshStatus() resync call, which made a
  // fake-timer version of this test flaky/order-dependent on which
  // getRefreshStatus() call consumed a queued mockResolvedValueOnce.
  it('polls until the job completes', async () => {
    mockRefreshAll.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 5,
      completedCount: 0,
      skippedCount: 0,
      startedAt: '2026-09-01T00:00:00',
      finishedAt: null,
    })
    render(<SettingsPage />)

    fireEvent.click(await screen.findByTestId('refresh-all-btn'))
    expect(await screen.findByText(/refreshing 0 of 5/i)).toBeInTheDocument()

    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 5,
      completedCount: 5,
      skippedCount: 0,
      startedAt: '2026-09-01T00:00:00',
      finishedAt: '2026-09-01T00:01:00',
    })

    expect(
      await screen.findByText(/Last full refresh/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  }, 10000)
})

describe('FRONTEND-023-AC-10/12/13: refresh-all click, polling, completion', () => {
  it('disables the button, shows progress, then re-enables on completion', async () => {
    mockRefreshAll.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 15,
      completedCount: 0,
      skippedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    })
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: /refresh all/i }))
    expect(await screen.findByText(/refreshing 0 of 15/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh all/i })).toBeDisabled()

    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 15,
      completedCount: 15,
      skippedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    })

    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: /refresh all/i }),
        ).not.toBeDisabled(),
      { timeout: 8000 },
    )
  }, 10000)
})

describe('FRONTEND-023-AC-11: resumes polling on mount if a job is already running', () => {
  it('enters the disabled/polling state without a click', async () => {
    mockGetRefreshStatus.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 15,
      completedCount: 4,
      skippedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    })

    render(<SettingsPage />)

    expect(await screen.findByText(/refreshing 4 of 15/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh all/i })).toBeDisabled()
  })
})

describe('FRONTEND-023-AC-14: 409 on click is treated as already-in-progress, not an error', () => {
  it('enters polling state instead of showing an error', async () => {
    mockRefreshAll.mockRejectedValue(
      new ApiError(409, 'A refresh is already in progress'),
    )
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: /refresh all/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /refresh all/i }),
      ).toBeDisabled(),
    )
  })
})

describe('FRONTEND-023-AC-15: last full refresh display', () => {
  it('shows relative time from the status endpoint finishedAt', async () => {
    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 15,
      completedCount: 15,
      skippedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    })
    render(<SettingsPage />)
    expect(await screen.findByText(/last full refresh/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-023-AC-23: skipped count shown in progress text', () => {
  it('includes the skipped count when greater than zero', async () => {
    mockGetRefreshStatus.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 15,
      completedCount: 4,
      skippedCount: 3,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    })
    render(<SettingsPage />)

    expect(
      await screen.findByText(/refreshing 4 of 15 \(3 skipped\)/i),
    ).toBeInTheDocument()
  })

  it('omits the parenthetical when skippedCount is zero', async () => {
    mockGetRefreshStatus.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 15,
      completedCount: 4,
      skippedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    })
    render(<SettingsPage />)

    expect(
      await screen.findByText(/refreshing 4 of 15\.\.\./i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-023-AC-24: skipped count in "Last full refresh" summary', () => {
  it('includes the skipped count when greater than zero, and it stays visible after completion', async () => {
    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 15,
      completedCount: 15,
      skippedCount: 3,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    })
    render(<SettingsPage />)

    expect(
      await screen.findByText(
        /last full refresh:.*\(3 skipped, already up to date\)/i,
      ),
    ).toBeInTheDocument()
  })

  it('omits the parenthetical when skippedCount is zero', async () => {
    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 15,
      completedCount: 15,
      skippedCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    })
    render(<SettingsPage />)

    await screen.findByText(/last full refresh/i)
    expect(screen.queryByText(/skipped/i)).not.toBeInTheDocument()
  })
})
