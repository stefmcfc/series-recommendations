import { render, screen, fireEvent, within } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { UseMySeriesPanel } from './UseMySeriesPanel'
import { initialState } from './RecommendationControls'
import type { ControlsState } from './RecommendationControls'
import type { Series } from '../types/series'

// TOOLING-008-AC-02: dedicated, isolated coverage for the panel extracted
// from RecommendationControls.tsx's former `state.mode === 'useMySeries'`
// tabpanel block, including the five FRONTEND-035 picker-scoped useState
// calls now owned entirely by this component -- new tests, not moved out of
// RecommendationControls.test.tsx (whose full suite already covers this
// panel end-to-end via the parent, unmodified, per TOOLING-008-AC-01).
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

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: '1',
    title: 'Ozark',
    year: null,
    lastAirYear: null,
    genres: 'Crime, Drama',
    tags: null,
    totalSeasons: 4,
    totalEpisodes: 44,
    currentSeason: null,
    currentEpisode: null,
    status: 'COMPLETED',
    imdbRating: 8.4,
    rottenTomatoesRating: null,
    rottenTomatoesPopcornmeter: null,
    tmdbRating: null,
    tmdbVoteCount: null,
    personalRating: null,
    personalNotes: null,
    posterUrl: null,
    imdbId: 'tt5071412',
    dateAdded: '2024-01-01T00:00:00Z',
    dateCompleted: null,
    lastRefreshedAt: null,
    newContentDetectedAt: null,
    originCountry: null,
    productionStatus: null,
    keywords: [],
    overview: null,
    excludeFromRecommendations: false,
    flaggedForRewatch: false,
    ...overrides,
  }
}

describe('UseMySeriesPanel', () => {
  it('shows the "no series" hint when allSeries is empty', () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[]}
        genreOptions={[]}
      />,
    )

    expect(
      screen.getByText(/no series to choose from yet/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Series' }),
    ).not.toBeInTheDocument()
  })

  it('offers each series as a pickable suggestion and calls updateState when picked', () => {
    const updateState = vi.fn()
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={updateState}
        allSeries={[makeSeries({ id: '1', title: 'Ozark' })]}
        genreOptions={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ozark - COMPLETED' }))

    expect(updateState).toHaveBeenCalledWith({ selectedSeriesIds: ['1'] })
  })

  // FRONTEND-069-AC-04: the former include-only checkbox fieldset ('renders
  // a genre filter checkbox per genre option') is superseded by the
  // FRONTEND-069-AC-04/AC-05 describe blocks below, which cover the combined
  // GenreIncludeExcludePicker that replaced it -- a checkbox-per-genre no
  // longer exists in this panel.
  it('renders the Filter by Genre picker trigger when genre options exist', () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={['Crime', 'Drama']}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Filter by Genre' }),
    ).toBeInTheDocument()
  })

  it('narrows the picker suggestions when a status filter is applied', () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[
          makeSeries({ id: '1', title: 'Ozark', status: 'COMPLETED' }),
          makeSeries({ id: '2', title: 'The Wire', status: 'DROPPED' }),
        ]}
        genreOptions={[]}
      />,
    )

    fireEvent.click(screen.getByLabelText(/completed only/i))

    // FRONTEND-035-AC-17: the status suffix is hidden once the status
    // filter narrows to one value -- every remaining suggestion would
    // otherwise repeat the same status text.
    expect(screen.getByRole('button', { name: 'Ozark' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /The Wire/ }),
    ).not.toBeInTheDocument()
  })

  it('opens the "Show all series" modal, uncapped and sharing selection state', () => {
    const updateState = vi.fn()
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={updateState}
        allSeries={[
          makeSeries({ id: '1', title: 'Ozark' }),
          makeSeries({ id: '2', title: 'The Wire' }),
        ]}
        genreOptions={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))

    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('button', { name: /Ozark/ }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /The Wire/ }),
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /Ozark/ }))
    expect(updateState).toHaveBeenCalledWith({ selectedSeriesIds: ['1'] })
  })

  it('closes the modal on Escape', () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-069-AC-04: UseMySeriesPanel renders the combined picker', () => {
  it('renders a Filter by Genre picker trigger, not the old checkbox fieldset', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[{ id: '1', title: 'Show', genres: 'Comedy' } as Series]}
        genreOptions={['Comedy', 'Drama']}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Filter by Genre' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-069-AC-05: exclude toggle narrows Series suggestions', () => {
  it('removes an excluded-genre series from the Series picker options', async () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[
          { id: '1', title: 'Funny Show', genres: 'Comedy' } as Series,
          { id: '2', title: 'Serious Show', genres: 'Drama' } as Series,
        ]}
        genreOptions={['Comedy', 'Drama']}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Filter by Genre' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: neutral' }))
    // neutral -> include -> exclude (the picker's toggle cycle is
    // neutral -> include -> exclude -> neutral -- a third click on the
    // exclude-labeled button would cycle back to neutral and undo the
    // exclusion, so this deliberately stops at two clicks, not the spec's
    // literal three, to actually land on and verify the "exclude" state).
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: include' }))

    expect(
      screen.queryByRole('button', { name: /Funny Show/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Serious Show/ }),
    ).toBeInTheDocument()
  })
})
