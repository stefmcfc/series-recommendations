import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SavedFiltersList } from './SavedFiltersList'
import { useFilterProfileSelector } from '../hooks/useFilterProfileSelector'
import { seriesApi } from '../services/seriesApi'
import type { FilterProfileArea } from '../types/filterProfile'

vi.mock('../services/seriesApi')

beforeEach(() => {
  vi.clearAllMocks()
})

// A thin harness wiring the shared hook + this rendered piece together --
// mirrors NameStatsTable.test.tsx's own Harness pattern for a hook-backed
// component.
function SavedFiltersListHarness({
  area,
  onApply = vi.fn(),
  onClear,
}: {
  readonly area: FilterProfileArea
  readonly onApply?: (criteria: unknown) => void
  readonly onClear?: () => void
}) {
  const filterProfile = useFilterProfileSelector({
    area,
    currentCriteria: {},
    onApply,
    onClear,
  })
  return (
    <SavedFiltersList
      area={area}
      profiles={filterProfile.profiles}
      selectedId={filterProfile.selectedId}
      handleSelect={filterProfile.handleSelect}
    />
  )
}

describe('FRONTEND-129-AC-02: SavedFiltersList root always renders the shared testid', () => {
  it('renders the filter-profile-selector testid even with zero saved profiles', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(<SavedFiltersListHarness area="MY_SERIES" />)
    await waitFor(() => expect(seriesApi.listFilterProfiles).toHaveBeenCalled())
    expect(screen.getByTestId('filter-profile-selector')).toBeInTheDocument()
  })
})

describe('FRONTEND-109-AC-01: "Saved Filters" label', () => {
  it('shows the Saved Filters legend when profiles exist', async () => {
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
    render(<SavedFiltersListHarness area="MY_SERIES" />)
    expect(await screen.findByText('Saved Filters')).toBeInTheDocument()
  })

  it('shows no legend when there are no saved profiles', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(<SavedFiltersListHarness area="MY_SERIES" />)
    await waitFor(() => expect(seriesApi.listFilterProfiles).toHaveBeenCalled())
    expect(screen.queryByText('Saved Filters')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-109-AC-02: no delete control in the inline picker', () => {
  it('renders no delete button anywhere in the profile list', async () => {
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
    render(<SavedFiltersListHarness area="MY_SERIES" />)
    await screen.findByText('Weeknight')
    expect(
      screen.queryByRole('button', { name: /delete/i }),
    ).not.toBeInTheDocument()
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
    render(<SavedFiltersListHarness area="MY_SERIES" onApply={onApply} />)
    fireEvent.click(await screen.findByText('Weeknight'))
    expect(onApply).toHaveBeenCalledWith({ genres: ['Comedy'] })
  })
})

describe('FRONTEND-129-AC-04: saved-filter chips show a description tooltip on hover', () => {
  it('sets the title attribute from describeFilterCriteria entries', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Crime/Drama',
        criteria: { genres: ['Crime', 'Drama'], minImdbRating: '7' },
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(<SavedFiltersListHarness area="MY_SERIES" />)
    const chip = await screen.findByText('Crime/Drama')
    expect(chip).toHaveAttribute(
      'title',
      'Genres: Crime, Drama\nMin IMDb Rating: 7',
    )
  })

  it('omits the title attribute when the profile has no describable criteria', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Empty',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(<SavedFiltersListHarness area="MY_SERIES" />)
    const chip = await screen.findByText('Empty')
    expect(chip).not.toHaveAttribute('title')
  })
})

describe('FRONTEND-107-AC-08: disabled renders nothing', () => {
  it('does not fetch or render when disabled', () => {
    const listSpy = vi.spyOn(seriesApi, 'listFilterProfiles')
    const { container } = render(
      <SavedFiltersList
        area="RECOMMENDATION_FILTERS"
        profiles={[]}
        selectedId={null}
        handleSelect={vi.fn()}
        disabled
      />,
    )
    expect(listSpy).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })
})
