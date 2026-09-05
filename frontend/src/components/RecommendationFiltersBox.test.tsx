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
    excludeKeywordsSelected: [],
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

describe('FRONTEND-076-AC-06: exclude-only usage keeps its own label', () => {
  it('still renders "Exclude Genres", not the renamed label', () => {
    renderBox()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    expect(
      screen.getByRole('button', { name: 'Exclude Genres' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Include / Exclude Genres' }),
    ).not.toBeInTheDocument()
  })
})

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
      excludeKeywordsSelected: [],
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

describe('FRONTEND-093-AC-02: toggle shows a count badge when filters are active', () => {
  it('shows the count of active filters on the toggle', () => {
    renderBox({
      state: makeState({
        minTmdbRating: '7',
        yearMin: '2010',
        countriesSelected: ['US'],
      }),
    })
    expect(screen.getByTestId('filters-active-count')).toHaveTextContent('3')
  })
})

describe('FRONTEND-093-AC-03: no badge when no filters are active', () => {
  it('renders no count badge for the default state', () => {
    renderBox()
    expect(screen.queryByTestId('filters-active-count')).not.toBeInTheDocument()
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
      // FRONTEND-093-AC-02: excludeGenresSelected: ['Comedy'] makes the
      // toggle's accessible name "Recommendations Filters1" (count badge
      // appended) -- exact match no longer applies once a filter is active.
      screen.getByRole('button', { name: /^recommendations filters/i }),
    )
    fireEvent.click(screen.getByTestId('reset-filters-btn'))
    expect(updateState).toHaveBeenCalledWith(
      expect.objectContaining({ excludeGenresSelected: [] }),
    )
  })
})

describe('FRONTEND-094-AC-05: Exclude Keywords renders as a KeywordPicker', () => {
  it('renders a Keywords chip picker, not a plain text input', () => {
    renderBox({ state: makeState({ excludeKeywordsSelected: ['spoilers'] }) })
    fireEvent.click(
      screen.getByRole('button', { name: /recommendations filters/i }),
    )
    expect(screen.getByText('spoilers')).toBeInTheDocument()
    // Design Decisions: Exclude Keywords deliberately keeps its inline input
    // (no `hideInput`), so the field stays reachable via
    // getByLabelText('Exclude Keywords') -- the meaningful "not a plain text
    // input" check is that the input's own value is empty (selections render
    // as chips, not as raw input text), unlike the old comma-separated
    // free-text field this replaces.
    expect(screen.getByLabelText('Exclude Keywords')).toHaveValue('')
  })
})

describe('FRONTEND-094-AC-07: Reset Filters clears excludeKeywordsSelected', () => {
  it('calls updateState with excludeKeywordsSelected: []', () => {
    const updateState = vi.fn()
    renderBox({
      state: makeState({ excludeKeywordsSelected: ['spoilers'] }),
      updateState,
    })
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters/i }),
    )
    fireEvent.click(screen.getByTestId('reset-filters-btn'))
    expect(updateState).toHaveBeenCalledWith(
      expect.objectContaining({ excludeKeywordsSelected: [] }),
    )
  })
})

describe('FRONTEND-094-AC-08: active-filter count reflects excludeKeywordsSelected', () => {
  it('counts a non-empty excludeKeywordsSelected as one active filter', () => {
    renderBox({ state: makeState({ excludeKeywordsSelected: ['spoilers'] }) })
    expect(screen.getByTestId('filters-active-count')).toHaveTextContent('1')
  })
})

describe('FRONTEND-094-AC-09: negative Min Vote Count shows an inline error', () => {
  it('shows an error for a negative value', () => {
    // RecommendationFiltersBox's `state` is a controlled prop (updateState
    // is mocked, not wired back into a real re-render here) -- passed
    // directly via makeState, matching this file's own established pattern
    // for FRONTEND-094-AC-11's "shows no error" case below, rather than
    // simulating a change event the mock harness can't reflect back.
    renderBox({ state: makeState({ minVoteCount: '-5' }) })
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters/i }),
    )
    expect(
      screen.getByText(/min vote count must be a whole number of at least 0/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-094-AC-10: decimal Min Vote Count shows an inline error', () => {
  it('shows an error for a decimal value', () => {
    renderBox({ state: makeState({ minVoteCount: '5.5' }) })
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters/i }),
    )
    expect(
      screen.getByText(/min vote count must be a whole number of at least 0/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-094-AC-11: valid Min Vote Count has no error', () => {
  it('shows no error for a valid non-negative integer', () => {
    renderBox({ state: makeState({ minVoteCount: '200' }) })
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters/i }),
    )
    expect(
      screen.queryByText(/min vote count must be a whole number/i),
    ).not.toBeInTheDocument()
  })
})
