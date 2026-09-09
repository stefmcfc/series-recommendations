import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { FilterProfileManager } from './FilterProfileManager'
import { seriesApi } from '../services/seriesApi'
import type { FilterProfileArea } from '../types/filterProfile'

vi.mock('../services/seriesApi')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-108-AC-09: three independent area groups', () => {
  it('renders all three areas and fetches each independently', () => {
    const listSpy = vi
      .spyOn(seriesApi, 'listFilterProfiles')
      .mockResolvedValue([])
    render(<FilterProfileManager />)
    expect(listSpy).toHaveBeenCalledWith('MY_SERIES')
    expect(listSpy).toHaveBeenCalledWith('USE_MY_SERIES')
    expect(listSpy).toHaveBeenCalledWith('RECOMMENDATION_FILTERS')
  })

  it('shows an empty-state message for an area with no profiles', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(<FilterProfileManager />)
    expect(await screen.findAllByText(/no saved profiles yet/i)).toHaveLength(3)
  })

  it('renders readable titles for each area', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(<FilterProfileManager />)
    expect(await screen.findByText('My Series')).toBeInTheDocument()
    expect(screen.getByText('Use My Series')).toBeInTheDocument()
    expect(screen.getByText('Recommendation Filters')).toBeInTheDocument()
  })
})

function mockOnlyMySeries(
  profiles: {
    id: string
    area: FilterProfileArea
    name: string
    criteria: unknown
    createdAt: string
    updatedAt: string
  }[],
) {
  vi.spyOn(seriesApi, 'listFilterProfiles').mockImplementation((area) =>
    Promise.resolve(area === 'MY_SERIES' ? profiles : []),
  )
}

describe('FRONTEND-108-AC-10: expand reveals the criteria summary', () => {
  it('shows the readable criteria on expand', async () => {
    mockOnlyMySeries([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: { genres: ['Comedy'] },
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByText('Weeknight'))
    expect(await screen.findByText(/Comedy/)).toBeInTheDocument()
  })

  it('collapses again on a second click', async () => {
    mockOnlyMySeries([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: { genres: ['Comedy'] },
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(<FilterProfileManager />)
    const nameButton = await screen.findByText('Weeknight')
    fireEvent.click(nameButton)
    expect(await screen.findByText(/Comedy/)).toBeInTheDocument()
    fireEvent.click(nameButton)
    await waitFor(() =>
      expect(screen.queryByText(/Comedy/)).not.toBeInTheDocument(),
    )
  })
})

describe('FRONTEND-108-AC-11: rename validates and persists', () => {
  it('renames a profile via updateFilterProfile', async () => {
    mockOnlyMySeries([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    const updateSpy = vi
      .spyOn(seriesApi, 'updateFilterProfile')
      .mockResolvedValue({
        id: '1',
        area: 'MY_SERIES',
        name: 'Renamed',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      })
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByLabelText(/rename weeknight/i))
    fireEvent.change(screen.getByDisplayValue('Weeknight'), {
      target: { value: 'Renamed' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(updateSpy).toHaveBeenCalledWith('1', { name: 'Renamed' })
    expect(await screen.findByText('Renamed')).toBeInTheDocument()
  })

  it('renaming to itself is not rejected as a duplicate', async () => {
    mockOnlyMySeries([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    const updateSpy = vi
      .spyOn(seriesApi, 'updateFilterProfile')
      .mockResolvedValue({
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      })
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByLabelText(/rename weeknight/i))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(updateSpy).toHaveBeenCalledWith('1', { name: 'Weeknight' })
  })

  it('shows an inline error and stays in rename mode on a duplicate name', async () => {
    mockOnlyMySeries([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        area: 'MY_SERIES',
        name: 'Weekend',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    const updateSpy = vi.spyOn(seriesApi, 'updateFilterProfile')
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByLabelText(/rename weeknight/i))
    fireEvent.change(screen.getByDisplayValue('Weeknight'), {
      target: { value: 'Weekend' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already exists/i,
    )
    expect(updateSpy).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Weekend')).toBeInTheDocument()
  })
})

describe('FRONTEND-108-AC-12: delete confirm, and rename/delete are mutually exclusive', () => {
  it('starting rename cancels an in-progress delete confirmation on the same row', async () => {
    mockOnlyMySeries([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByLabelText(/delete weeknight/i))
    expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/rename weeknight/i))
    expect(screen.queryByTestId('confirm-delete-btn')).not.toBeInTheDocument()
  })

  it('starting delete cancels an in-progress rename on the same row', async () => {
    mockOnlyMySeries([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByLabelText(/rename weeknight/i))
    expect(screen.getByDisplayValue('Weeknight')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/delete weeknight/i))
    expect(screen.queryByDisplayValue('Weeknight')).not.toBeInTheDocument()
  })

  it('Confirm deletes, Cancel does not', async () => {
    mockOnlyMySeries([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    vi.spyOn(seriesApi, 'deleteFilterProfile').mockResolvedValue(undefined)
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByLabelText(/delete weeknight/i))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    await waitFor(() =>
      expect(screen.queryByText('Weeknight')).not.toBeInTheDocument(),
    )
  })

  it('Cancel reverts without deleting', async () => {
    mockOnlyMySeries([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    const deleteSpy = vi.spyOn(seriesApi, 'deleteFilterProfile')
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByLabelText(/delete weeknight/i))
    fireEvent.click(screen.getByTestId('cancel-delete-btn'))
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(screen.getByText('Weeknight')).toBeInTheDocument()
  })
})

describe('FRONTEND-109-AC-06: rename replaces the name display', () => {
  it('hides the name button and Rename trigger while renaming', async () => {
    mockOnlyMySeries([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByLabelText(/rename weeknight/i))
    expect(
      screen.queryByRole('button', { name: 'Weeknight' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/rename weeknight/i)).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Weeknight')).toBeInTheDocument()
  })
})

describe('FRONTEND-109-AC-09: row uses the shared card primitive', () => {
  it('applies the surface.card class to each profile row', async () => {
    mockOnlyMySeries([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    const { container } = render(<FilterProfileManager />)
    await screen.findByText('Weeknight')
    const row = container.querySelector('li')
    expect(row?.className).toMatch(/card/)
  })
})
