import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import App from './App'
import { seriesApi } from './services/seriesApi'
import type { Series } from './types/series'

vi.mock('./services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)
const mockCreate = vi.mocked(seriesApi.create)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-003-AC-27/28: opening the form', () => {
  it('does not render AddSeriesForm until Add Series is clicked', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await waitFor(() => screen.getByTestId('add-series-btn'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByTestId('add-series-btn')[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('FRONTEND-003-AC-29: cancelling', () => {
  it('closes the dialog without re-fetching', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await waitFor(() => screen.getAllByTestId('add-series-btn'))
    fireEvent.click(screen.getAllByTestId('add-series-btn')[0])

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-003-AC-30: successful creation refreshes the list', () => {
  it('closes the dialog and re-fetches the series list', async () => {
    mockGetAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: '1', title: 'New Show' } as Series])
    mockCreate.mockResolvedValue({ id: '1', title: 'New Show' } as Series)

    render(<App />)
    await waitFor(() => screen.getAllByTestId('add-series-btn'))
    fireEvent.click(screen.getAllByTestId('add-series-btn')[0])

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'New Show' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('New Show')).toBeInTheDocument()
  })
})
