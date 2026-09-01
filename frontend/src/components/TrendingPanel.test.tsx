import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { TrendingPanel } from './TrendingPanel'
import type { ControlsState } from './RecommendationControls'

// TOOLING-008-AC-04: dedicated, isolated coverage for the panel extracted
// from RecommendationControls.tsx's former `state.discoverMode ===
// 'trending'` tabpanel block -- new tests, not moved out of
// RecommendationControls.test.tsx (whose full suite already covers this
// panel end-to-end via the parent, unmodified, per TOOLING-008-AC-01).
function makeState(overrides: Partial<ControlsState> = {}): ControlsState {
  return {
    mode: 'discover',
    discoverMode: 'trending',
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

describe('TrendingPanel', () => {
  it('renders the Trending Window fieldset with Day/Week options', () => {
    render(<TrendingPanel state={makeState()} updateState={vi.fn()} />)

    expect(screen.getByText('Trending Window')).toBeInTheDocument()
    expect(screen.getByLabelText(/^day$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^week$/i)).toBeInTheDocument()
  })

  it('checks the option matching state.trendingWindow', () => {
    render(
      <TrendingPanel
        state={makeState({ trendingWindow: 'day' })}
        updateState={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(/^day$/i)).toBeChecked()
    expect(screen.getByLabelText(/^week$/i)).not.toBeChecked()
  })

  it('calls updateState with the clicked window', () => {
    const updateState = vi.fn()
    render(<TrendingPanel state={makeState()} updateState={updateState} />)

    fireEvent.click(screen.getByLabelText(/^day$/i))

    expect(updateState).toHaveBeenCalledWith({ trendingWindow: 'day' })
  })
})
