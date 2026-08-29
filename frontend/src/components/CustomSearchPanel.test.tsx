import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { CustomSearchPanel } from './CustomSearchPanel'
import type { ControlsState } from './RecommendationControls'

// TOOLING-008-AC-03: dedicated, isolated coverage for the panel extracted
// from RecommendationControls.tsx's former `state.discoverMode ===
// 'customSearch'` tabpanel block -- new tests, not moved out of
// RecommendationControls.test.tsx (whose full suite already covers this
// panel end-to-end via the parent, unmodified, per TOOLING-008-AC-01).
function makeState(overrides: Partial<ControlsState> = {}): ControlsState {
  return {
    mode: 'discover',
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
    excludeGenresText: '',
    excludeKeywordsText: '',
    language: '',
    countriesSelected: [],
    sortBy: 'score',
    discoverSortBy: 'popularity.desc',
    ...overrides,
  }
}

describe('CustomSearchPanel', () => {
  it('renders a checkbox per genre option and a Keywords picker', () => {
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={['Drama', 'Comedy']}
        keywordOptions={[]}
      />,
    )

    expect(screen.getByLabelText('Drama')).toBeInTheDocument()
    expect(screen.getByLabelText('Comedy')).toBeInTheDocument()
    expect(screen.getByLabelText('Keywords')).toBeInTheDocument()
  })

  it('calls updateState with the toggled genre added', () => {
    const updateState = vi.fn()
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={updateState}
        genreOptions={['Drama']}
        keywordOptions={[]}
      />,
    )

    fireEvent.click(screen.getByLabelText('Drama'))

    expect(updateState).toHaveBeenCalledWith({ genresSelected: ['Drama'] })
  })

  it('shows the hint only when both genres and keywords are empty', () => {
    const { rerender } = render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    expect(
      screen.getByText(/browse the most popular shows overall/i),
    ).toBeInTheDocument()

    rerender(
      <CustomSearchPanel
        state={makeState({ genresSelected: ['Drama'] })}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    expect(
      screen.queryByText(/browse the most popular shows overall/i),
    ).not.toBeInTheDocument()
  })

  it('renders Min TMDB Rating/Year Min/Year Max fields and forwards edits via updateState', () => {
    const updateState = vi.fn()
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={updateState}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )

    fireEvent.change(screen.getByLabelText(/min tmdb rating/i), {
      target: { value: '7.5' },
    })

    expect(updateState).toHaveBeenCalledWith({ minTmdbRating: '7.5' })
  })

  it('renders Countries and Language pickers', () => {
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )

    expect(screen.getByLabelText(/countries/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^language/i)).toBeInTheDocument()
  })
})
