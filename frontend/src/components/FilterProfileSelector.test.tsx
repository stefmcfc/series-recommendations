import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { FilterProfileSelector } from './FilterProfileSelector'
import { seriesApi } from '../services/seriesApi'

vi.mock('../services/seriesApi')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-107-AC-03: profile list renders on mount', () => {
  it('fetches and displays saved profiles for the given area', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={vi.fn()}
      />,
    )
    expect(await screen.findByText('Weeknight')).toBeInTheDocument()
    expect(seriesApi.listFilterProfiles).toHaveBeenCalledWith('MY_SERIES')
  })
})

describe('FRONTEND-107-AC-04: selecting a profile applies it immediately', () => {
  it("calls onApply with the selected profile's criteria", async () => {
    const onApply = vi.fn()
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: { genres: ['Comedy'] },
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={onApply}
      />,
    )
    fireEvent.click(await screen.findByText('Weeknight'))
    expect(onApply).toHaveBeenCalledWith({ genres: ['Comedy'] })
  })
})

describe('FRONTEND-107-AC-05: save as new profile', () => {
  it('creates a profile and adds it to the list', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    vi.spyOn(seriesApi, 'createFilterProfile').mockResolvedValue({
      id: '2',
      area: 'MY_SERIES',
      name: 'New',
      criteria: {},
      createdAt: '',
      updatedAt: '',
    })
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText(/profile name/i), {
      target: { value: 'New' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save as new/i }))
    expect(await screen.findByText('New')).toBeInTheDocument()
    expect(seriesApi.createFilterProfile).toHaveBeenCalledWith(
      'MY_SERIES',
      'New',
      {},
    )
  })

  it('shows an inline error on a 409 conflict, not a toast', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    vi.spyOn(seriesApi, 'createFilterProfile').mockRejectedValue(
      Object.assign(new Error('conflict'), { status: 409, isApiError: true }),
    )
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText(/profile name/i), {
      target: { value: 'Dup' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save as new/i }))
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-107-AC-06: update overwrites the selected profile', () => {
  it('calls updateFilterProfile with the current criteria', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Weeknight',
        criteria: { genres: ['Comedy'] },
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
        criteria: { genres: ['Drama'] },
        createdAt: '',
        updatedAt: '',
      })
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{ genres: ['Drama'] }}
        onApply={vi.fn()}
      />,
    )
    fireEvent.click(await screen.findByText('Weeknight'))
    fireEvent.click(screen.getByRole('button', { name: /update/i }))
    expect(updateSpy).toHaveBeenCalledWith('1', {
      criteria: { genres: ['Drama'] },
    })
  })
})

describe('FRONTEND-107-AC-07: delete removes the profile', () => {
  it('removes the deleted profile from the list', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
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
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={vi.fn()}
      />,
    )
    await screen.findByText('Weeknight')
    fireEvent.click(screen.getByRole('button', { name: /delete weeknight/i }))
    await waitFor(() =>
      expect(screen.queryByText('Weeknight')).not.toBeInTheDocument(),
    )
  })

  it('clears the selection if the deleted profile was selected', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
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
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={vi.fn()}
      />,
    )
    fireEvent.click(await screen.findByText('Weeknight'))
    expect(
      screen.getByRole('button', { name: /^update$/i }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /delete weeknight/i }))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /^update$/i }),
      ).not.toBeInTheDocument(),
    )
  })
})

describe('FRONTEND-107-AC-08: disabled renders nothing', () => {
  it('does not fetch or render when disabled', () => {
    const listSpy = vi.spyOn(seriesApi, 'listFilterProfiles')
    const { container } = render(
      <FilterProfileSelector
        area="RECOMMENDATION_FILTERS"
        currentCriteria={{}}
        onApply={vi.fn()}
        disabled
      />,
    )
    expect(listSpy).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })
})
