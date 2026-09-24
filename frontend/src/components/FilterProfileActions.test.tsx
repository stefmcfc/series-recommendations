import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { FilterProfileActions } from './FilterProfileActions'
import { SavedFiltersList } from './SavedFiltersList'
import { useFilterProfileSelector } from '../hooks/useFilterProfileSelector'
import { seriesApi } from '../services/seriesApi'
import type { FilterProfileArea } from '../types/filterProfile'

vi.mock('../services/seriesApi')

beforeEach(() => {
  vi.clearAllMocks()
})

// Wires the shared hook to both rendered pieces -- mirrors how every real
// host (SearchFilter/UseMySeriesPanel/RecommendationFiltersBox/
// CustomSearchPanel/NameStatsTable) calls useFilterProfileSelector once and
// feeds both SavedFiltersList and FilterProfileActions from its return
// value. Selecting a profile through the (also-rendered) SavedFiltersList
// chip is how tests below get FilterProfileActions into a "profile
// selected" state, rather than a bespoke prop this component doesn't take.
function FilterProfileActionsHarness({
  area = 'MY_SERIES',
  currentCriteria = {},
  disabled,
}: {
  readonly area?: FilterProfileArea
  readonly currentCriteria?: unknown
  readonly disabled?: boolean
}) {
  const filterProfile = useFilterProfileSelector({
    area,
    currentCriteria,
    onApply: vi.fn(),
    disabled,
  })
  return (
    <>
      <SavedFiltersList
        area={area}
        profiles={filterProfile.profiles}
        selectedId={filterProfile.selectedId}
        handleSelect={filterProfile.handleSelect}
        disabled={disabled}
      />
      <FilterProfileActions
        area={area}
        currentCriteria={currentCriteria}
        profiles={filterProfile.profiles}
        selectedProfile={filterProfile.selectedProfile}
        hasActiveCriteria={filterProfile.hasActiveCriteria}
        actionError={filterProfile.actionError}
        saveModalOpen={filterProfile.saveModalOpen}
        setSaveModalOpen={filterProfile.setSaveModalOpen}
        handleSaveFromModal={filterProfile.handleSaveFromModal}
        updateModalOpen={filterProfile.updateModalOpen}
        setUpdateModalOpen={filterProfile.setUpdateModalOpen}
        handleUpdateConfirm={filterProfile.handleUpdateConfirm}
        disabled={disabled}
      />
    </>
  )
}

describe('FRONTEND-129-AC-02: FilterProfileActions carries its own testid', () => {
  it('renders filter-profile-actions', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(
      <FilterProfileActionsHarness currentCriteria={{ genres: ['Comedy'] }} />,
    )
    expect(
      await screen.findByTestId('filter-profile-actions'),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-108-AC-07: Save opens the modal, not an inline input', () => {
  it('has no bare name input, and clicking Save opens the modal', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(
      <FilterProfileActionsHarness currentCriteria={{ genres: ['Comedy'] }} />,
    )
    expect(screen.queryByLabelText(/profile name/i)).not.toBeInTheDocument()
    fireEvent.click(
      await screen.findByRole('button', { name: /save filters/i }),
    )
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('creates a profile via the modal and adds it to the list', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    vi.spyOn(seriesApi, 'createFilterProfile').mockResolvedValue({
      id: '2',
      area: 'MY_SERIES',
      name: 'New',
      criteria: { genres: ['Comedy'] },
      createdAt: '',
      updatedAt: '',
    })
    render(
      <FilterProfileActionsHarness currentCriteria={{ genres: ['Comedy'] }} />,
    )
    fireEvent.click(
      await screen.findByRole('button', { name: /save filters/i }),
    )
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
      { genres: ['Comedy'] },
    )
  })
})

describe("FRONTEND-109-AC-13: Save Filters is disabled when there's nothing to save", () => {
  it('disables Save Filters when currentCriteria is empty', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(<FilterProfileActionsHarness currentCriteria={{}} />)
    expect(
      await screen.findByRole('button', { name: /save filters/i }),
    ).toBeDisabled()
  })

  it('enables Save Filters once at least one field is set', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(
      <FilterProfileActionsHarness currentCriteria={{ genres: ['Comedy'] }} />,
    )
    expect(
      await screen.findByRole('button', { name: /save filters/i }),
    ).toBeEnabled()
  })
})

describe('FRONTEND-129-AC-05: Update Filters opens a confirmation modal', () => {
  it('does not call updateFilterProfile until the modal is confirmed', async () => {
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
    const updateSpy = vi.spyOn(seriesApi, 'updateFilterProfile')
    render(<FilterProfileActionsHarness currentCriteria={{}} />)
    fireEvent.click(await screen.findByText('Weeknight'))
    fireEvent.click(
      screen.getByRole('button', { name: /update saved filter/i }),
    )
    expect(
      await screen.findByRole('dialog', { name: /update filter profile/i }),
    ).toBeInTheDocument()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('renders no Update Filters button when no profile is selected', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(<FilterProfileActionsHarness currentCriteria={{}} />)
    await waitFor(() => expect(seriesApi.listFilterProfiles).toHaveBeenCalled())
    expect(
      screen.queryByRole('button', { name: /update saved filter/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-129-AC-07: confirming Update sends name + criteria and updates the list', () => {
  it('calls updateFilterProfile with the trimmed name and current criteria', async () => {
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
    const updateSpy = vi
      .spyOn(seriesApi, 'updateFilterProfile')
      .mockResolvedValue({
        id: '1',
        area: 'MY_SERIES',
        name: 'Weekend',
        criteria: { genres: ['Drama'] },
        createdAt: '',
        updatedAt: '',
      })
    render(
      <FilterProfileActionsHarness currentCriteria={{ genres: ['Drama'] }} />,
    )
    fireEvent.click(await screen.findByText('Weeknight'))
    fireEvent.click(
      screen.getByRole('button', { name: /update saved filter/i }),
    )
    fireEvent.change(await screen.findByLabelText(/name/i), {
      target: { value: 'Weekend' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^update$/i }))
    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith('1', {
        name: 'Weekend',
        criteria: { genres: ['Drama'] },
      }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Weekend')).toBeInTheDocument()
  })

  it('shows an error inside the modal and keeps it open on failure', async () => {
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
    vi.spyOn(seriesApi, 'updateFilterProfile').mockRejectedValue(
      new Error('network'),
    )
    render(<FilterProfileActionsHarness currentCriteria={{}} />)
    fireEvent.click(await screen.findByText('Weeknight'))
    fireEvent.click(
      screen.getByRole('button', { name: /update saved filter/i }),
    )
    fireEvent.click(await screen.findByRole('button', { name: /^update$/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('FRONTEND-107-AC-08: disabled renders nothing', () => {
  it('does not fetch or render when disabled', () => {
    const listSpy = vi.spyOn(seriesApi, 'listFilterProfiles')
    const { container } = render(
      <FilterProfileActionsHarness currentCriteria={{}} disabled />,
    )
    expect(listSpy).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })
})
