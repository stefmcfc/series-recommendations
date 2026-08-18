import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ExportControls } from './ExportControls'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

vi.mock('../services/seriesApi')
const mockExport = vi.mocked(seriesApi.export)

let createObjectURLSpy: ReturnType<typeof vi.fn>
let revokeObjectURLSpy: ReturnType<typeof vi.fn>
let clickSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  createObjectURLSpy = vi.fn(() => 'blob:mock-url')
  revokeObjectURLSpy = vi.fn()
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: createObjectURLSpy,
    revokeObjectURL: revokeObjectURLSpy,
  })
  clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  clickSpy.mockRestore()
})

describe('FRONTEND-007-AC-05: rendering', () => {
  it('renders both export buttons', () => {
    render(<ExportControls />)
    expect(screen.getByTestId('export-json-btn')).toBeInTheDocument()
    expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument()
  })
})

describe('FRONTEND-007-AC-06/07/08: triggering with criteria', () => {
  it('calls seriesApi.export with the format and criteria', async () => {
    mockExport.mockResolvedValue({
      blob: new Blob(['{}']),
      filename: 'series-export.json',
    })
    render(<ExportControls criteria={{ title: 'office' }} />)

    fireEvent.click(screen.getByTestId('export-json-btn'))
    await waitFor(() =>
      expect(mockExport).toHaveBeenCalledWith('json', { title: 'office' }),
    )
  })

  it('calls seriesApi.export with csv format', async () => {
    mockExport.mockResolvedValue({
      blob: new Blob(['a,b']),
      filename: 'series-export.csv',
    })
    render(<ExportControls />)

    fireEvent.click(screen.getByTestId('export-csv-btn'))
    await waitFor(() =>
      expect(mockExport).toHaveBeenCalledWith('csv', undefined),
    )
  })
})

describe('FRONTEND-007-AC-09: loading state', () => {
  it('disables both buttons and shows "Exporting..." while in flight', async () => {
    mockExport.mockReturnValue(new Promise(() => undefined))
    render(<ExportControls />)

    fireEvent.click(screen.getByTestId('export-json-btn'))
    expect(screen.getByTestId('export-json-btn')).toBeDisabled()
    expect(screen.getByTestId('export-json-btn')).toHaveTextContent(
      /exporting/i,
    )
    expect(screen.getByTestId('export-csv-btn')).toBeDisabled()
  })
})

describe('FRONTEND-007-AC-10/11: successful download', () => {
  it('creates an object URL, clicks a download anchor, then revokes it', async () => {
    mockExport.mockResolvedValue({
      blob: new Blob(['{}']),
      filename: 'series-export-20260101.json',
    })
    render(<ExportControls />)

    fireEvent.click(screen.getByTestId('export-json-btn'))

    await waitFor(() => expect(createObjectURLSpy).toHaveBeenCalledTimes(1))
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('re-enables both buttons and restores the label after a successful export', async () => {
    mockExport.mockResolvedValue({
      blob: new Blob(['{}']),
      filename: 'series-export.json',
    })
    render(<ExportControls />)

    fireEvent.click(screen.getByTestId('export-json-btn'))

    await waitFor(() =>
      expect(screen.getByTestId('export-json-btn')).not.toBeDisabled(),
    )
    expect(screen.getByTestId('export-json-btn')).toHaveTextContent(
      /export json/i,
    )
    expect(screen.getByTestId('export-csv-btn')).not.toBeDisabled()
  })
})

describe('FRONTEND-007-AC-12: failure', () => {
  it('shows the ApiError message and re-enables both buttons', async () => {
    mockExport.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<ExportControls />)

    fireEvent.click(screen.getByTestId('export-json-btn'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /internal server error/i,
      ),
    )
    expect(screen.getByTestId('export-json-btn')).not.toBeDisabled()
    expect(screen.getByTestId('export-csv-btn')).not.toBeDisabled()
  })
})

describe('FRONTEND-007-AC-14: no logging of blob contents or criteria', () => {
  it('does not log to the console on a successful export', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    mockExport.mockResolvedValue({
      blob: new Blob(['{}']),
      filename: 'series-export.json',
    })
    render(<ExportControls criteria={{ title: 'office' }} />)

    fireEvent.click(screen.getByTestId('export-json-btn'))
    await waitFor(() => expect(createObjectURLSpy).toHaveBeenCalledTimes(1))

    expect(logSpy).not.toHaveBeenCalled()
    logSpy.mockRestore()
  })
})
