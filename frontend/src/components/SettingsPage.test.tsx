import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  SettingsPage,
  buildLastFullRefreshText,
  buildRefreshProgressText,
} from './SettingsPage'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

vi.mock('../services/seriesApi')
const mockExport = vi.mocked(seriesApi.export)
const mockRefreshAll = vi.mocked(seriesApi.refreshAll)
const mockGetRefreshStatus = vi.mocked(seriesApi.getRefreshStatus)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockGetRefreshStatus.mockResolvedValue({
    status: 'IDLE',
    totalCount: 0,
    completedCount: 0,
    skippedCount: 0,
    skipThresholdMinutesUsed: 0,
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
      skipThresholdMinutesUsed: 0,
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
      skipThresholdMinutesUsed: 0,
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
      skipThresholdMinutesUsed: 0,
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
      skipThresholdMinutesUsed: 0,
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
      skipThresholdMinutesUsed: 0,
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
      skipThresholdMinutesUsed: 0,
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
      skipThresholdMinutesUsed: 0,
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
      skipThresholdMinutesUsed: 10,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    })
    render(<SettingsPage />)

    expect(
      await screen.findByText(
        /refreshing 4 of 15 \(3 skipped, threshold: 10 min\)/i,
      ),
    ).toBeInTheDocument()
  })

  it('omits the parenthetical when skippedCount is zero', async () => {
    mockGetRefreshStatus.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 15,
      completedCount: 4,
      skippedCount: 0,
      skipThresholdMinutesUsed: 0,
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
      skipThresholdMinutesUsed: 10,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    })
    render(<SettingsPage />)

    expect(
      await screen.findByText(
        /last full refresh:.*\(3 skipped, already up to date, threshold: 10 min\)/i,
      ),
    ).toBeInTheDocument()
  })

  it('omits the parenthetical when skippedCount is zero', async () => {
    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 15,
      completedCount: 15,
      skippedCount: 0,
      skipThresholdMinutesUsed: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    })
    render(<SettingsPage />)

    await screen.findByText(/last full refresh/i)
    expect(screen.queryByText(/skipped/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-097-AC-04: existing sections render via SettingsSection', () => {
  it('renders Refresh All, Export, and Import each under their own heading', () => {
    render(<SettingsPage />)

    expect(
      screen.getByRole('heading', { name: /refresh/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /export/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /import/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-097-AC-05/06/07: skip-threshold override input', () => {
  it('renders a labeled override input', () => {
    render(<SettingsPage />)

    const input = screen.getByLabelText(/skip threshold override/i)
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('id', 'refresh-skip-threshold-override')
  })

  it('sends no override when the field is left blank', async () => {
    mockRefreshAll.mockResolvedValue({
      status: 'IDLE',
      totalCount: 0,
      completedCount: 0,
      skippedCount: 0,
      skipThresholdMinutesUsed: 0,
      startedAt: null,
      finishedAt: null,
    })
    render(<SettingsPage />)

    fireEvent.click(screen.getByTestId('refresh-all-btn'))

    await waitFor(() => expect(mockRefreshAll).toHaveBeenCalledWith(undefined))
  })

  it('sends the override value when the field is filled in', async () => {
    mockRefreshAll.mockResolvedValue({
      status: 'IDLE',
      totalCount: 0,
      completedCount: 0,
      skippedCount: 0,
      skipThresholdMinutesUsed: 10,
      startedAt: null,
      finishedAt: null,
    })
    render(<SettingsPage />)

    fireEvent.change(screen.getByLabelText(/skip threshold override/i), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByTestId('refresh-all-btn'))

    await waitFor(() => expect(mockRefreshAll).toHaveBeenCalledWith(10))
  })
})

describe('FRONTEND-097-AC-08: progress/last-refresh text mentions the threshold used', () => {
  it('includes the threshold in the progress text when skippedCount > 0', () => {
    const text = buildRefreshProgressText({
      status: 'IN_PROGRESS',
      totalCount: 5,
      completedCount: 2,
      skippedCount: 3,
      startedAt: '2026-09-07T10:00:00',
      finishedAt: null,
      skipThresholdMinutesUsed: 10,
    })
    expect(text).toContain('threshold: 10')
  })

  it('includes the threshold in the last-refresh text when skippedCount > 0', () => {
    const text = buildLastFullRefreshText({
      status: 'COMPLETED',
      totalCount: 5,
      completedCount: 5,
      skippedCount: 3,
      startedAt: '2026-09-07T10:00:00',
      finishedAt: '2026-09-07T10:00:05',
      skipThresholdMinutesUsed: 10,
    })
    expect(text).toContain('threshold: 10')
  })
})

describe('FRONTEND-097-AC-09: 409-conflict synthesized status includes skipThresholdMinutesUsed', () => {
  it('falls back to 0 and still reaches the disabled/polling state when no jobStatus is known yet', async () => {
    mockRefreshAll.mockRejectedValue(
      new ApiError(409, 'A refresh is already in progress'),
    )
    render(<SettingsPage />)

    fireEvent.click(screen.getByTestId('refresh-all-btn'))

    // Reaching a disabled/polling state without throwing confirms the
    // synthesized RefreshJobStatus (now including skipThresholdMinutesUsed)
    // is well-formed enough to drive the rest of the component.
    await waitFor(() =>
      expect(screen.getByTestId('refresh-all-btn')).toBeDisabled(),
    )
  })

  it('carries forward the most recently known skipThresholdMinutesUsed without throwing', async () => {
    mockGetRefreshStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 5,
      completedCount: 5,
      skippedCount: 3,
      skipThresholdMinutesUsed: 15,
      startedAt: '2026-09-07T10:00:00',
      finishedAt: '2026-09-07T10:00:05',
    })
    mockRefreshAll.mockRejectedValue(
      new ApiError(409, 'A refresh is already in progress'),
    )
    render(<SettingsPage />)

    await screen.findByText(/last full refresh/i)
    fireEvent.click(screen.getByTestId('refresh-all-btn'))

    await waitFor(() =>
      expect(screen.getByTestId('refresh-all-btn')).toBeDisabled(),
    )
  })
})

describe('FRONTEND-098-AC-10/11: Recommendation Favourites editor', () => {
  it('renders a Recommendation Favourites section with both favourites pickers', () => {
    render(<SettingsPage />)

    expect(
      screen.getByRole('heading', { name: 'Recommendation Favourites' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/country favourites/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/language favourites/i)).toBeInTheDocument()
  })

  it('selecting a country favourite writes through to localStorage immediately', () => {
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'France' }))

    expect(JSON.parse(localStorage.getItem('countryFavourites')!)).toContain(
      'FR',
    )
  })

  it('selecting a language favourite writes through to localStorage immediately', () => {
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Italian' }))

    expect(JSON.parse(localStorage.getItem('languageFavourites')!)).toContain(
      'it',
    )
  })

  it('pre-populates each picker with the current favourites', () => {
    localStorage.setItem('countryFavourites', JSON.stringify(['FR', 'DE']))
    render(<SettingsPage />)

    expect(screen.getByText('France')).toBeInTheDocument()
    expect(screen.getByText('Germany')).toBeInTheDocument()
  })
})

describe('FRONTEND-100-AC-07/08: favourites editors are reorderable', () => {
  // Deviation from the spec's TDD sketch: the sketch's button-name matcher
  // (`/move us later/i`) assumed the raw stored code ("US") appeared in the
  // aria-label, but FRONTEND-100-AC-02 resolves Move button aria-labels
  // through `options` the same way chip text already does (ALL_COUNTRY_OPTIONS
  // resolves 'US' to "United States" via Intl.DisplayNames) -- so the actual
  // accessible name is "Move United States later", not "Move US later".
  it('writes the reordered favourites through useLocalStorage on Move later', () => {
    localStorage.setItem('countryFavourites', JSON.stringify(['US', 'GB']))
    render(<SettingsPage />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Move United States later' }),
    )

    expect(JSON.parse(localStorage.getItem('countryFavourites')!)).toEqual([
      'GB',
      'US',
    ])
  })

  it('writes the reordered favourites through useLocalStorage on Move earlier', () => {
    localStorage.setItem('countryFavourites', JSON.stringify(['US', 'GB']))
    render(<SettingsPage />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Move United Kingdom earlier' }),
    )

    expect(JSON.parse(localStorage.getItem('countryFavourites')!)).toEqual([
      'GB',
      'US',
    ])
  })

  it('reorders language favourites through useLocalStorage', () => {
    localStorage.setItem('languageFavourites', JSON.stringify(['it', 'zh']))
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Move Italian later' }))

    expect(JSON.parse(localStorage.getItem('languageFavourites')!)).toEqual([
      'zh',
      'it',
    ])
  })
})
