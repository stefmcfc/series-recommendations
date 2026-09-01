import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { CustomSearchPanel } from './CustomSearchPanel'
import { initialState } from './RecommendationControls'
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
    excludeGenresSelected: [],
    excludeKeywordsText: '',
    language: '',
    countriesSelected: [],
    sortBy: 'score',
    discoverSortBy: 'popularity.desc',
    ...overrides,
  }
}

describe('CustomSearchPanel', () => {
  // FRONTEND-068-AC-02/AC-03: the former include-only checkbox fieldset
  // ('renders a checkbox per genre option...'/'calls updateState with the
  // toggled genre added') is superseded by the FRONTEND-068-AC-02/AC-03
  // describe blocks below, which cover the combined
  // GenreIncludeExcludePicker that replaced it -- a checkbox-per-genre no
  // longer exists in this panel.
  it('renders a Keywords picker', () => {
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={['Drama', 'Comedy']}
        keywordOptions={[]}
      />,
    )

    expect(screen.getByLabelText('Keywords')).toBeInTheDocument()
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

describe('FRONTEND-068-AC-02: CustomSearchPanel renders the combined picker', () => {
  it('renders a Genres picker trigger, not the old checkbox fieldset', () => {
    render(
      <CustomSearchPanel
        state={initialState}
        updateState={vi.fn()}
        genreOptions={['Comedy', 'Drama']}
        keywordOptions={[]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Genres' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-068-AC-03: excluding a genre updates state correctly', () => {
  it('moves a genre from genresSelected to excludeGenresSelected', () => {
    const updateState = vi.fn()
    const state = { ...initialState, genresSelected: ['Comedy'] }
    render(
      <CustomSearchPanel
        state={state}
        updateState={updateState}
        genreOptions={['Comedy']}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres — 1 included' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: include' }))
    expect(updateState).toHaveBeenCalledWith({
      genresSelected: [],
      excludeGenresSelected: ['Comedy'],
    })
  })
})
