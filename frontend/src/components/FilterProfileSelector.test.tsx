import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react'
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

describe('FRONTEND-108-AC-07: Save opens the modal, not an inline input', () => {
  it('has no bare name input, and clicking Save opens the modal', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText(/profile name/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('creates a profile via the modal and adds it to the list', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(screen.getByLabelText(/profile name/i), {
      target: { value: 'New' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText('New')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(seriesApi.createFilterProfile).toHaveBeenCalledWith(
      'MY_SERIES',
      'New',
      {},
    )
    expect(dialog).not.toBeInTheDocument()
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

describe('FRONTEND-108-AC-08: delete requires confirmation', () => {
  it('a single click on Delete does not delete', async () => {
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
    const deleteSpy = vi.spyOn(seriesApi, 'deleteFilterProfile')
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={vi.fn()}
      />,
    )
    fireEvent.click(await screen.findByLabelText(/delete weeknight/i))
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument()
  })

  it('Confirm deletes, Cancel does not', async () => {
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
    fireEvent.click(await screen.findByLabelText(/delete weeknight/i))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    await waitFor(() =>
      expect(screen.queryByText('Weeknight')).not.toBeInTheDocument(),
    )
  })

  it('Cancel reverts without deleting', async () => {
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
    const deleteSpy = vi.spyOn(seriesApi, 'deleteFilterProfile')
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={vi.fn()}
      />,
    )
    fireEvent.click(await screen.findByLabelText(/delete weeknight/i))
    fireEvent.click(screen.getByTestId('cancel-delete-btn'))
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(screen.getByText('Weeknight')).toBeInTheDocument()
    expect(screen.queryByTestId('confirm-delete-btn')).not.toBeInTheDocument()
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
    fireEvent.click(screen.getByLabelText(/delete weeknight/i))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))
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
