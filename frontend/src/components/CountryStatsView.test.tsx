import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CountryStatsView } from './CountryStatsView'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

vi.mock('../services/seriesApi')
const mockGetCountryStats = vi.mocked(seriesApi.getCountryStats)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-089-AC-03/04: renders country stats table with resolved names', () => {
  it('renders a resolved display name for each raw code, never the raw code', async () => {
    mockGetCountryStats.mockResolvedValue([
      {
        name: 'GB',
        seriesCount: 5,
        averagePersonalRating: 4.2,
        averageBlendedRating: 7.8,
      },
    ])
    render(<CountryStatsView />)

    expect(await screen.findByText('United Kingdom')).toBeInTheDocument()
    expect(screen.queryByText('GB')).not.toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('4.2')).toBeInTheDocument()
    expect(screen.getByText('7.8')).toBeInTheDocument()
  })

  it('renders a dash for null averages', async () => {
    mockGetCountryStats.mockResolvedValue([
      {
        name: 'US',
        seriesCount: 2,
        averagePersonalRating: null,
        averageBlendedRating: null,
      },
    ])
    render(<CountryStatsView />)

    expect(await screen.findByText('United States')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('falls back to the raw code for an unresolvable code', async () => {
    mockGetCountryStats.mockResolvedValue([
      {
        name: 'ZZ',
        seriesCount: 1,
        averagePersonalRating: null,
        averageBlendedRating: null,
      },
    ])
    render(<CountryStatsView />)

    expect(await screen.findByText('ZZ')).toBeInTheDocument()
  })
})

describe('FRONTEND-089-AC-03: sortable column headers re-fetch with sortBy', () => {
  it('re-fetches with sortBy=name on header click, without re-sorting client-side', async () => {
    mockGetCountryStats.mockResolvedValue([])
    render(<CountryStatsView />)
    await waitFor(() => expect(mockGetCountryStats).toHaveBeenCalledWith({}))

    fireEvent.click(screen.getByRole('columnheader', { name: /country/i }))

    await waitFor(() =>
      expect(mockGetCountryStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'name' }),
      ),
    )
  })

  it('re-fetches with sortBy=seriesCount on header click', async () => {
    mockGetCountryStats.mockResolvedValue([])
    render(<CountryStatsView />)
    await waitFor(() => expect(mockGetCountryStats).toHaveBeenCalledWith({}))

    fireEvent.click(screen.getByRole('columnheader', { name: /series count/i }))

    await waitFor(() =>
      expect(mockGetCountryStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'seriesCount' }),
      ),
    )
  })

  it('toggles direction on repeated clicks of the same header', async () => {
    mockGetCountryStats.mockResolvedValue([])
    render(<CountryStatsView />)
    await waitFor(() => expect(mockGetCountryStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('columnheader', { name: /country/i }))
    await waitFor(() =>
      expect(mockGetCountryStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'name' }),
      ),
    )

    fireEvent.click(screen.getByRole('columnheader', { name: /country/i }))
    await waitFor(() =>
      expect(mockGetCountryStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'name', sortDirection: 'desc' }),
      ),
    )
    expect(
      screen.getByRole('columnheader', { name: /country/i }),
    ).toHaveTextContent('▼')
  })
})

describe('FRONTEND-089-AC-05: loading and error states', () => {
  it('shows a loading state while the fetch is in flight', () => {
    mockGetCountryStats.mockReturnValue(new Promise(() => {}))
    render(<CountryStatsView />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error alert when the fetch rejects', async () => {
    mockGetCountryStats.mockRejectedValue(
      new ApiError(500, 'Internal server error'),
    )
    render(<CountryStatsView />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('FRONTEND-089-AC-03: minimum-value filters', () => {
  it('renders three labelled numeric filter inputs and an Apply Filters button', async () => {
    mockGetCountryStats.mockResolvedValue([])
    render(<CountryStatsView />)
    await waitFor(() => expect(mockGetCountryStats).toHaveBeenCalled())

    expect(screen.getByLabelText(/min series count/i)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/min avg personal rating/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/min avg blended rating/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /apply filters/i }),
    ).toBeInTheDocument()
  })

  it('applies only the filled-in filters on Apply, omitting blank ones', async () => {
    mockGetCountryStats.mockResolvedValue([])
    render(<CountryStatsView />)
    await waitFor(() => expect(mockGetCountryStats).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/min series count/i), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(mockGetCountryStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ minSeriesCount: 3 }),
      ),
    )
  })
})

describe('CountryStatsView test id', () => {
  it('renders with data-testid="country-stats-view"', async () => {
    mockGetCountryStats.mockResolvedValue([])
    render(<CountryStatsView />)
    expect(await screen.findByTestId('country-stats-view')).toBeInTheDocument()
  })
})
