import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ImportControls } from './ImportControls'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

vi.mock('../services/seriesApi')
const mockImportSeries = vi.mocked(seriesApi.importSeries)
const mockGetImportStatus = vi.mocked(seriesApi.getImportStatus)

const selectFile = () => {
  const file = new File(['{"series":[]}'], 'export.json', {
    type: 'application/json',
  })
  fireEvent.change(screen.getByTestId('import-file-input'), {
    target: { files: [file] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-057-AC-01: Import button is disabled until a file is selected', () => {
  it('disables the button with no file, enables it once one is selected', () => {
    render(<ImportControls onImported={vi.fn()} />)
    expect(screen.getByTestId('import-btn')).toBeDisabled()

    selectFile()
    expect(screen.getByTestId('import-btn')).not.toBeDisabled()
  })
})

describe('FRONTEND-057-AC-02: uploads and polls until completion', () => {
  it('shows a progress indicator, then the completion summary', async () => {
    mockImportSeries.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 0,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      startedAt: '2026-09-05T00:00:00',
      completedAt: null,
    })
    mockGetImportStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 3,
      importedCount: 2,
      skippedCount: 1,
      errorCount: 0,
      errors: [],
      startedAt: '2026-09-05T00:00:00',
      completedAt: '2026-09-05T00:01:00',
    })

    render(<ImportControls onImported={vi.fn()} />)
    selectFile()
    fireEvent.click(screen.getByTestId('import-btn'))

    expect(await screen.findByText(/importing/i)).toBeInTheDocument()
    expect(
      await screen.findByText(/imported 2, skipped 1/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  }, 10000)
})

describe('FRONTEND-057-AC-03: shows per-row errors when present', () => {
  it('renders the capped errors list alongside the summary', async () => {
    mockImportSeries.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 0,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      startedAt: '2026-09-05T00:00:00',
      completedAt: null,
    })
    mockGetImportStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 2,
      importedCount: 1,
      skippedCount: 0,
      errorCount: 1,
      errors: [{ rowIndex: 1, message: 'title is required' }],
      startedAt: '2026-09-05T00:00:00',
      completedAt: '2026-09-05T00:01:00',
    })

    render(<ImportControls onImported={vi.fn()} />)
    selectFile()
    fireEvent.click(screen.getByTestId('import-btn'))

    expect(
      await screen.findByText(/title is required/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  }, 10000)
})

describe('FRONTEND-057-AC-04: onImported fires only when something was actually imported', () => {
  it('calls onImported once completion has importedCount > 0', async () => {
    const onImported = vi.fn()
    mockImportSeries.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 0,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      startedAt: '2026-09-05T00:00:00',
      completedAt: null,
    })
    mockGetImportStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 3,
      importedCount: 2,
      skippedCount: 1,
      errorCount: 0,
      errors: [],
      startedAt: '2026-09-05T00:00:00',
      completedAt: '2026-09-05T00:01:00',
    })

    render(<ImportControls onImported={onImported} />)
    selectFile()
    fireEvent.click(screen.getByTestId('import-btn'))

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1), {
      timeout: 8000,
    })
  }, 10000)

  it('does not call onImported when nothing was imported', async () => {
    const onImported = vi.fn()
    mockImportSeries.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 0,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      startedAt: '2026-09-05T00:00:00',
      completedAt: null,
    })
    mockGetImportStatus.mockResolvedValue({
      status: 'COMPLETED',
      totalCount: 2,
      importedCount: 0,
      skippedCount: 2,
      errorCount: 0,
      errors: [],
      startedAt: '2026-09-05T00:00:00',
      completedAt: '2026-09-05T00:01:00',
    })

    render(<ImportControls onImported={onImported} />)
    selectFile()
    fireEvent.click(screen.getByTestId('import-btn'))

    expect(
      await screen.findByText(/imported 0, skipped 2/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(onImported).not.toHaveBeenCalled()
  }, 10000)
})

describe('failure handling', () => {
  it('shows the ApiError message and re-enables the button when the upload itself fails', async () => {
    mockImportSeries.mockRejectedValue(new ApiError(400, 'Invalid file'))

    render(<ImportControls onImported={vi.fn()} />)
    selectFile()
    fireEvent.click(screen.getByTestId('import-btn'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid file/i)
    expect(screen.getByTestId('import-btn')).not.toBeDisabled()
  })
})
