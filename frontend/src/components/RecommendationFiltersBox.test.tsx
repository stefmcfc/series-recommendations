import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { RecommendationFiltersBox } from './RecommendationFiltersBox'
import type { ControlsState } from './RecommendationControls'

// TOOLING-008-AC-05: dedicated, isolated coverage for the panel extracted
// from RecommendationControls.tsx's former `styles.filtersSection` block --
// new tests, not moved out of RecommendationControls.test.tsx (whose full
// suite already covers this panel end-to-end via the parent, unmodified,
// per TOOLING-008-AC-01).
function makeState(overrides: Partial<ControlsState> = {}): ControlsState {
  return {
    mode: 'useMySeries',
    discoverMode: 'customSearch',
    selectedSeriesIds: [],
    genresSelected: [],
    keywordsSelected: [],
    trendingWindow: 'week',
    minTmdbRating: '',
    minVoteCount: '',
    minVoteCountTouched: false,
    yearMin: '',
    yearMax: '',
    excludeGenresSelected: [],
    excludeKeywordsText: '',
    language: '',
    countriesSelected: [],
    sortBy: 'score',
    discoverSortBy: 'vote_average.desc',
    ...overrides,
  }
}

function renderBox(
  overrides: Partial<Parameters<typeof RecommendationFiltersBox>[0]> = {},
) {
  const updateState = vi.fn()
  const utils = render(
    <RecommendationFiltersBox
      state={makeState()}
      updateState={updateState}
      isCustomSearch={false}
      genreOptions={[]}
      {...overrides}
    />,
  )
  return { ...utils, updateState }
}

describe('RecommendationFiltersBox', () => {
  it('renders collapsed by default, revealing fields once toggled', () => {
    renderBox()
    expect(screen.queryByLabelText(/min tmdb rating/i)).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    expect(screen.getByLabelText(/min tmdb rating/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/min vote count/i)).toBeInTheDocument()
    // FRONTEND-068-AC-04: Exclude Genres is now a GenreIncludeExcludePicker
    // trigger button, not a labeled text input.
    expect(
      screen.getByRole('button', { name: 'Exclude Genres' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/exclude keywords/i)).toBeInTheDocument()
  })

  it('hides Min TMDB Rating/Year Min/Year Max/Country/Language when isCustomSearch is true', () => {
    renderBox({ isCustomSearch: true })
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    expect(screen.queryByLabelText(/min tmdb rating/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^year min/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^year max/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/countries/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^language/i)).not.toBeInTheDocument()
    // Min Vote Count is unaffected by isCustomSearch.
    expect(screen.getByLabelText(/min vote count/i)).toBeInTheDocument()
  })

  it('marks minVoteCountTouched when Min Vote Count is edited', () => {
    const { updateState } = renderBox()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    fireEvent.change(screen.getByLabelText(/min vote count/i), {
      target: { value: '50' },
    })

    expect(updateState).toHaveBeenCalledWith({
      minVoteCount: '50',
      minVoteCountTouched: true,
    })
  })

  it('clears every filter field via Reset Filters', () => {
    const { updateState } = renderBox()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    fireEvent.click(screen.getByTestId('reset-filters-btn'))

    expect(updateState).toHaveBeenCalledWith({
      minTmdbRating: '',
      minVoteCount: '',
      minVoteCountTouched: false,
      yearMin: '',
      yearMax: '',
      excludeGenresSelected: [],
      excludeKeywordsText: '',
      language: '',
      countriesSelected: [],
    })
  })
})

describe('FRONTEND-068-AC-04: exclude-only picker relocation', () => {
  it('renders the picker when not Custom Search', () => {
    render(
      <RecommendationFiltersBox
        state={makeState()}
        updateState={vi.fn()}
        isCustomSearch={false}
        genreOptions={['Comedy']}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Recommendations Filters' }),
    )
    expect(
      screen.getByRole('button', { name: 'Exclude Genres' }),
    ).toBeInTheDocument()
  })

  it('does not render the picker when Custom Search is active', () => {
    render(
      <RecommendationFiltersBox
        state={makeState()}
        updateState={vi.fn()}
        isCustomSearch={true}
        genreOptions={['Comedy']}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Recommendations Filters' }),
    )
    expect(
      screen.queryByRole('button', { name: /Exclude Genres/ }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-068-AC-05: Reset Filters clears excludeGenresSelected', () => {
  it('calls updateState with excludeGenresSelected: []', () => {
    const updateState = vi.fn()
    render(
      <RecommendationFiltersBox
        state={{ ...makeState(), excludeGenresSelected: ['Comedy'] }}
        updateState={updateState}
        isCustomSearch={false}
        genreOptions={['Comedy']}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Recommendations Filters' }),
    )
    fireEvent.click(screen.getByTestId('reset-filters-btn'))
    expect(updateState).toHaveBeenCalledWith(
      expect.objectContaining({ excludeGenresSelected: [] }),
    )
  })
})
