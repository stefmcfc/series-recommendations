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
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={vi.fn()}
      />,
    )
    expect(await screen.findByText('Saved Filters')).toBeInTheDocument()
  })

  it('shows no legend when there are no saved profiles', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={vi.fn()}
      />,
    )
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
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={vi.fn()}
      />,
    )
    await screen.findByText('Weeknight')
    expect(
      screen.queryByRole('button', { name: /delete/i }),
    ).not.toBeInTheDocument()
  })
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

describe('FRONTEND-109-AC-17: an invalid saved profile is refused, not applied', () => {
  it('does not call onApply and shows an alert for an out-of-range saved value', async () => {
    const onApply = vi.fn()
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'RECOMMENDATION_FILTERS',
        name: 'Broken',
        criteria: { minTmdbRating: '-99' },
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(
      <FilterProfileSelector
        area="RECOMMENDATION_FILTERS"
        currentCriteria={{}}
        onApply={onApply}
      />,
    )
    fireEvent.click(await screen.findByText('Broken'))
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      /"Broken" has an invalid saved value and can't be applied/i,
    )
  })
})

describe('FRONTEND-109-AC-10: reclicking an applied chip clears instead of re-applying', () => {
  it('calls onClear and deselects when the already-applied chip is clicked again', async () => {
    const onApply = vi.fn()
    const onClear = vi.fn()
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
        onClear={onClear}
      />,
    )
    const chip = await screen.findByText('Weeknight')
    fireEvent.click(chip)
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(chip).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(chip)
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking a different chip still applies immediately, no clear', async () => {
    const onApply = vi.fn()
    const onClear = vi.fn()
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'A',
        criteria: { genres: ['Comedy'] },
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        area: 'MY_SERIES',
        name: 'B',
        criteria: { genres: ['Drama'] },
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={onApply}
        onClear={onClear}
      />,
    )
    fireEvent.click(await screen.findByText('A'))
    fireEvent.click(screen.getByText('B'))
    expect(onApply).toHaveBeenCalledTimes(2)
    expect(onClear).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-108-AC-07: Save opens the modal, not an inline input', () => {
  it('has no bare name input, and clicking Save opens the modal', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{ genres: ['Comedy'] }}
        onApply={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText(/profile name/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /save filters/i }))
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
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{ genres: ['Comedy'] }}
        onApply={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /save filters/i }))
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
    expect(dialog).not.toBeInTheDocument()
  })
})

describe("FRONTEND-109-AC-13: Save Filters is disabled when there's nothing to save", () => {
  it('disables Save Filters when currentCriteria is empty', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{}}
        onApply={vi.fn()}
      />,
    )
    expect(
      await screen.findByRole('button', { name: /save filters/i }),
    ).toBeDisabled()
  })

  it('enables Save Filters once at least one field is set', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{ genres: ['Comedy'] }}
        onApply={vi.fn()}
      />,
    )
    expect(
      await screen.findByRole('button', { name: /save filters/i }),
    ).toBeEnabled()
  })

  it('disables Save Filters for Area B at its true defaults (sortBy/sortDirection are never actually unset)', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(
      <FilterProfileSelector
        area="USE_MY_SERIES"
        currentCriteria={{
          genreFilter: [],
          excludeGenreFilter: [],
          statusFilter: 'any',
          keywordsFilter: [],
          minPersonalRating: null,
          minImdbRating: '',
          minTmdbRating: '',
          yearMin: '',
          yearMax: '',
          sortBy: 'title',
          sortDirection: 'asc',
        }}
        onApply={vi.fn()}
      />,
    )
    expect(
      await screen.findByRole('button', { name: /save filters/i }),
    ).toBeDisabled()
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
