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

describe('FRONTEND-114-AC-01: file input accepts CSV', () => {
  it('sets accept to include both json and csv types', () => {
    render(<ImportControls onImported={vi.fn()} />)
    const input = screen.getByTestId('import-file-input') as HTMLInputElement
    expect(input.accept).toContain('.csv')
    expect(input.accept).toContain('text/csv')
    expect(input.accept).toContain('.json')
    expect(input.accept).toContain('application/json')
  })
})

describe('FRONTEND-114-AC-02: submitting a CSV file uses the existing upload flow', () => {
  it('calls importSeries with the selected CSV file and shows progress', async () => {
    const csvFile = new File(['id,title\n,Show A\n'], 'export.csv', {
      type: 'text/csv',
    })
    mockImportSeries.mockResolvedValue({
      status: 'IN_PROGRESS',
      totalCount: 1,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      startedAt: '2026-09-05T00:00:00',
      completedAt: null,
    })

    render(<ImportControls onImported={vi.fn()} />)
    fireEvent.change(screen.getByTestId('import-file-input'), {
      target: { files: [csvFile] },
    })
    fireEvent.click(screen.getByTestId('import-btn'))

    expect(mockImportSeries).toHaveBeenCalledWith(csvFile)
    expect(await screen.findByText(/importing/i)).toBeInTheDocument()
  })
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

describe('FRONTEND-057-AC-06: Clear resets the file picker and any error', () => {
  it('is not rendered when no file is selected', () => {
    render(<ImportControls onImported={vi.fn()} />)
    expect(screen.queryByTestId('import-clear-btn')).not.toBeInTheDocument()
  })

  it('resets the file picker, error, and job status without a page reload', async () => {
    mockImportSeries.mockRejectedValue(
      new ApiError(400, 'Uploaded file must be a .json or .csv file'),
    )

    render(<ImportControls onImported={vi.fn()} />)
    selectFile()
    fireEvent.click(screen.getByTestId('import-btn'))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByTestId('import-clear-btn')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('import-clear-btn'))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByTestId('import-clear-btn')).not.toBeInTheDocument()
    expect(screen.getByTestId('import-file-input')).toHaveValue('')
    expect(screen.getByTestId('import-btn')).toBeDisabled()
  })

  it('is disabled while an import is in progress', async () => {
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

    render(<ImportControls onImported={vi.fn()} />)
    selectFile()
    fireEvent.click(screen.getByTestId('import-btn'))

    expect(await screen.findByText(/importing/i)).toBeInTheDocument()
    expect(screen.getByTestId('import-clear-btn')).toBeDisabled()
  })
})
