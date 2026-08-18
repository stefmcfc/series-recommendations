import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import App from './App'
import { seriesApi } from './services/seriesApi'
import type { Series } from './types/series'

vi.mock('./services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)
const mockCreate = vi.mocked(seriesApi.create)
const mockUpdate = vi.mocked(seriesApi.update)
const mockGetById = vi.mocked(seriesApi.getById)

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

describe('FRONTEND-004-AC-34/35: opening the edit form', () => {
  it('renders EditSeriesForm pre-filled when a row Edit button is clicked', async () => {
    mockGetAll.mockResolvedValue([
      { id: '1', title: 'Show', status: 'WATCHING' } as Series,
    ])
    render(<App />)
    await waitFor(() => screen.getByTestId('edit-series-btn'))

    fireEvent.click(screen.getByTestId('edit-series-btn'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Show')
  })
})

describe('FRONTEND-004-AC-36: cancelling an edit', () => {
  it('closes the dialog without re-fetching', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    render(<App />)
    await waitFor(() => screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByTestId('edit-series-btn'))

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-004-AC-37: successful edit refreshes the list', () => {
  it('closes the dialog and re-fetches the series list', async () => {
    mockGetAll
      .mockResolvedValueOnce([{ id: '1', title: 'Show' } as Series])
      .mockResolvedValueOnce([{ id: '1', title: 'Updated Show' } as Series])
    mockUpdate.mockResolvedValue({ id: '1', title: 'Updated Show' } as Series)

    render(<App />)
    await waitFor(() => screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Updated Show')).toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-25/26: navigating to detail', () => {
  it('renders SeriesDetail instead of SeriesList when a row is clicked', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    render(<App />)
    await waitFor(() => screen.getByTestId('series-row'))

    fireEvent.click(screen.getByTestId('series-row'))
    await waitFor(() =>
      expect(screen.getByTestId('back-btn')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('series-row')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-27: returning to the list', () => {
  it('re-fetches SeriesList after Back', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    render(<App />)
    await waitFor(() => screen.getByTestId('series-row'))
    fireEvent.click(screen.getByTestId('series-row'))

    await waitFor(() => screen.getByTestId('back-btn'))
    fireEvent.click(screen.getByTestId('back-btn'))

    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('series-row')).toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-28/29: editing from detail refreshes it in place', () => {
  it('stays on SeriesDetail and shows updated data after a successful edit', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById
      .mockResolvedValueOnce({
        id: '1',
        title: 'Show',
        status: 'WATCHING',
      } as Series)
      .mockResolvedValueOnce({
        id: '1',
        title: 'Updated Show',
        status: 'WATCHING',
      } as Series)
    mockUpdate.mockResolvedValue({ id: '1', title: 'Updated Show' } as Series)

    render(<App />)
    await waitFor(() => screen.getByTestId('series-row'))
    fireEvent.click(screen.getByTestId('series-row'))
    await waitFor(() => screen.getByTestId('edit-series-btn'))

    fireEvent.click(screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Updated Show')).toBeInTheDocument()
    expect(screen.getByTestId('back-btn')).toBeInTheDocument()
  })
})
