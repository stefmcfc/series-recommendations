import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { HighestRatedPanel } from './HighestRatedPanel'
import type { ControlsState } from './RecommendationControls'

// TOOLING-008-AC-04: dedicated, isolated coverage for the panel extracted
// from RecommendationControls.tsx's former shared "Sort By" fieldset -- new
// tests, not moved out of RecommendationControls.test.tsx (whose full suite
// already covers this panel end-to-end via the parent, unmodified, per
// TOOLING-008-AC-01).
function makeState(overrides: Partial<ControlsState> = {}): ControlsState {
  return {
    mode: 'useMySeries',
    discoverMode: 'customSearch',
    selectedSeriesIds: [],
    genresSelected: [],
    keywordsSelected: [],
    trendingWindow: 'week',
    minSourceRating: '',
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

describe('HighestRatedPanel', () => {
  it('shows Best Match/Most Recommended under Use My Series', () => {
    render(<HighestRatedPanel state={makeState()} updateState={vi.fn()} />)

    expect(screen.getByLabelText(/^best match$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/most recommended/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/vote average/i)).not.toBeInTheDocument()
  })

  it('shows the four TMDB-native options under Discover > Highest Rated', () => {
    render(
      <HighestRatedPanel
        state={makeState({ mode: 'discover', discoverMode: 'topRated' })}
        updateState={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(/vote average/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/most popular/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^newest$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/most voted/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^best match$/i)).not.toBeInTheDocument()
  })

  it('shows the four TMDB-native options under Discover > Custom Search', () => {
    render(
      <HighestRatedPanel
        state={makeState({ mode: 'discover', discoverMode: 'customSearch' })}
        updateState={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(/vote average/i)).toBeInTheDocument()
  })

  it('calls updateState with sortBy when a Use My Series option is clicked', () => {
    const updateState = vi.fn()
    render(<HighestRatedPanel state={makeState()} updateState={updateState} />)

    fireEvent.click(screen.getByLabelText(/most recommended/i))

    expect(updateState).toHaveBeenCalledWith({
      sortBy: 'recommendationCount',
    })
  })

  it('calls updateState with discoverSortBy when a TMDB-native option is clicked', () => {
    const updateState = vi.fn()
    render(
      <HighestRatedPanel
        state={makeState({ mode: 'discover', discoverMode: 'topRated' })}
        updateState={updateState}
      />,
    )

    fireEvent.click(screen.getByLabelText(/most voted/i))

    expect(updateState).toHaveBeenCalledWith({
      discoverSortBy: 'vote_count.desc',
    })
  })
})
