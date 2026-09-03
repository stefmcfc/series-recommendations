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
        keywordOptions={[]}
      />,
    )

    expect(
      screen.getByText(/no series to choose from yet/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Series' }),
    ).not.toBeInTheDocument()
  })

  // FRONTEND-077-AC-05: the inline Series field no longer renders its own
  // typing input (hideInput), but its empty-input default suggestion list
  // still renders (corrected 2026-09-03, live review -- hideInput must not
  // suppress suggestions, only the input itself) -- a series remains
  // pickable both inline and via the "Show all series" modal.
  it('offers each series as a pickable suggestion both inline and in the "Show all series" modal', () => {
    const updateState = vi.fn()
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={updateState}
        allSeries={[makeSeries({ id: '1', title: 'Ozark' })]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ozark - COMPLETED' }))
    expect(updateState).toHaveBeenCalledWith({ selectedSeriesIds: ['1'] })
    updateState.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Ozark - COMPLETED' }),
    )

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
        keywordOptions={[]}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Filter by Genre' }),
    ).toBeInTheDocument()
  })

  // FRONTEND-077-AC-05: routed through the "Show all series" modal now that
  // the inline field no longer renders its own typing input.
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
        keywordOptions={[]}
      />,
    )

    fireEvent.click(screen.getByLabelText(/completed only/i))
    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    const dialog = screen.getByRole('dialog')

    // FRONTEND-035-AC-17: the status suffix is hidden once the status
    // filter narrows to one value -- every remaining suggestion would
    // otherwise repeat the same status text.
    expect(
      within(dialog).getByRole('button', { name: 'Ozark' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: /The Wire/ }),
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
        keywordOptions={[]}
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
        keywordOptions={[]}
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
        keywordOptions={[]}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Filter by Genre' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-069-AC-05: exclude toggle narrows Series suggestions', () => {
  // FRONTEND-077-AC-05: routed through the "Show all series" modal now that
  // the inline field no longer renders its own typing input.
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
        keywordOptions={[]}
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
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    const dialog = screen.getByRole('dialog')

    expect(
      within(dialog).queryByRole('button', { name: /Funny Show/ }),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /Serious Show/ }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-081-AC-01: Filter & sort my series disclosure, open by default', () => {
  it('renders expanded on mount', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={['Drama']}
        keywordOptions={[]}
      />,
    )
    expect(
      screen.getByRole('button', { name: /filter & sort my series/i }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText(/completed only/i)).toBeVisible()
  })
})

describe('FRONTEND-081-AC-02: toggle collapses/expands the section', () => {
  it('hides and shows the filter controls on click', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={['Drama']}
        keywordOptions={[]}
      />,
    )
    const toggle = screen.getByRole('button', {
      name: /filter & sort my series/i,
    })

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(/completed only/i)).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('FRONTEND-081-AC-04: Keywords filter narrows the picker', () => {
  // FRONTEND-077-AC-07/AC-08: the inline Keywords filter field no longer
  // has its own input (hideInput) -- selecting a keyword now goes through
  // the new "Browse all keywords" modal, which shares the same filter state.
  it('only offers series matching a selected keyword', () => {
    const series = [
      makeSeries({ id: '1', title: 'Has Keyword', keywords: ['space opera'] }),
      makeSeries({ id: '2', title: 'No Keyword', keywords: [] }),
    ]
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={series}
        genreOptions={[]}
        keywordOptions={['space opera']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Browse all keywords' }))
    const keywordsDialog = screen.getByRole('dialog', {
      name: /browse keywords/i,
    })
    fireEvent.click(
      within(keywordsDialog).getByRole('button', { name: 'space opera' }),
    )
    fireEvent.click(
      within(keywordsDialog).getByRole('button', { name: /^done$/i }),
    )

    // FRONTEND-077-AC-05: the inline Series field no longer renders its own
    // typing input -- checked via the "Show all series" modal.
    const seriesDialog = openBrowseSeriesModal()
    expect(within(seriesDialog).getByText('Has Keyword')).toBeInTheDocument()
    expect(
      within(seriesDialog).queryByText('No Keyword'),
    ).not.toBeInTheDocument()
  })
})

// FRONTEND-077-AC-05: the inline Series field no longer renders its own
// typing input (hideInput) -- every "narrows the picker" assertion below now
// checks the "Show all series" modal's contents instead of the page at
// large.
function openBrowseSeriesModal() {
  fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
  return screen.getByRole('dialog')
}

describe('FRONTEND-081-AC-05: Min Personal Rating filter narrows the picker', () => {
  it('only offers series at or above the selected star rating', () => {
    const series = [
      makeSeries({ id: '1', title: 'High Rated', personalRating: 5 }),
      makeSeries({ id: '2', title: 'Low Rated', personalRating: 2 }),
    ]
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={series}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Rate 4 star(s)' }))
    const dialog = openBrowseSeriesModal()

    expect(within(dialog).getByText('High Rated')).toBeInTheDocument()
    expect(within(dialog).queryByText('Low Rated')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-081-AC-06: Min IMDb Rating filter narrows the picker', () => {
  it('only offers series at or above the entered IMDb rating', () => {
    const series = [
      makeSeries({ id: '1', title: 'High IMDb', imdbRating: 8.5 }),
      makeSeries({ id: '2', title: 'Low IMDb', imdbRating: 5.0 }),
    ]
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={series}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )

    fireEvent.change(screen.getByLabelText(/min imdb rating/i), {
      target: { value: '8' },
    })
    const dialog = openBrowseSeriesModal()

    expect(within(dialog).getByText('High IMDb')).toBeInTheDocument()
    expect(within(dialog).queryByText('Low IMDb')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-081-AC-07: Min TMDB Rating (My Series) filter narrows the picker', () => {
  it('only offers series at or above the entered TMDB rating', () => {
    const series = [
      makeSeries({ id: '1', title: 'High TMDB', tmdbRating: 8.5 }),
      makeSeries({ id: '2', title: 'Low TMDB', tmdbRating: 5.0 }),
    ]
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={series}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )

    fireEvent.change(screen.getByLabelText(/min tmdb rating \(my series\)/i), {
      target: { value: '8' },
    })
    const dialog = openBrowseSeriesModal()

    expect(within(dialog).getByText('High TMDB')).toBeInTheDocument()
    expect(within(dialog).queryByText('Low TMDB')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-081-AC-08: Year Min/Max (My Series) filters narrow the picker', () => {
  it('only offers series within the entered year range', () => {
    const series = [
      makeSeries({ id: '1', title: 'In Range', year: 2020 }),
      makeSeries({ id: '2', title: 'Out of Range', year: 2005 }),
    ]
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={series}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )

    fireEvent.change(screen.getByLabelText(/year min \(my series\)/i), {
      target: { value: '2015' },
    })
    const dialog = openBrowseSeriesModal()

    expect(within(dialog).getByText('In Range')).toBeInTheDocument()
    expect(within(dialog).queryByText('Out of Range')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-081-AC-09: selected series survive new filters', () => {
  it('keeps a selected series in the pool even if a new filter would exclude it', () => {
    const series = [
      makeSeries({ id: '1', title: 'Selected Low IMDb', imdbRating: 2.0 }),
    ]
    const stateWithSelection = { ...initialState, selectedSeriesIds: ['1'] }
    render(
      <UseMySeriesPanel
        state={stateWithSelection}
        updateState={vi.fn()}
        allSeries={series}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )

    fireEvent.change(screen.getByLabelText(/min imdb rating/i), {
      target: { value: '8' },
    })

    expect(screen.getByText('Selected Low IMDb')).toBeInTheDocument()
  })
})

describe('FRONTEND-081 (2026-09-03 live-review amendment): Keywords field rejects free text', () => {
  // FRONTEND-077-AC-07/AC-08: typed via the new "Browse all keywords" modal
  // now that the inline field's own input is hidden -- the modal shares the
  // inline field's own no-allowFreeText behavior (it narrows a series' real
  // keywords only), so free text is rejected there too.
  it('does not add a typed keyword that has no matching tracked option on Enter', () => {
    const series = [
      makeSeries({ id: '1', title: 'Has Keyword', keywords: ['space opera'] }),
    ]
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={series}
        genreOptions={[]}
        keywordOptions={['space opera']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Browse all keywords' }))
    const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
    const input = within(dialog).getByLabelText(/keywords/i)
    fireEvent.change(input, {
      target: { value: 'zzz-not-a-tracked-keyword' },
    })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(
      screen.queryByText('zzz-not-a-tracked-keyword'),
    ).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /^done$/i }))

    // Since no filter was actually applied, the series remains in the pool
    // -- checked via the "Show all series" modal now that the inline Series
    // field no longer renders its own typing input (FRONTEND-077-AC-05).
    const seriesDialog = openBrowseSeriesModal()
    expect(within(seriesDialog).getByText('Has Keyword')).toBeInTheDocument()
  })
})

describe('FRONTEND-077-AC-07: Browse all keywords modal for the Keywords filter field', () => {
  it('opens a Browse Keywords modal with the full keyword list on click', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries({ id: '1', title: 'Show' })]}
        genreOptions={[]}
        keywordOptions={['drama', 'crime', 'lapd']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Browse all keywords' }))

    expect(
      screen.getByRole('dialog', { name: /browse keywords/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('drama')).toBeInTheDocument()
    expect(screen.getByText('crime')).toBeInTheDocument()
    expect(screen.getByText('lapd')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries({ id: '1', title: 'Show' })]}
        genreOptions={[]}
        keywordOptions={['drama']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Browse all keywords' }))
    const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(
      screen.queryByRole('dialog', { name: /browse keywords/i }),
    ).not.toBeInTheDocument()
  })

  it('closes on Done, keeping the selection', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[
          makeSeries({ id: '1', title: 'Has Keyword', keywords: ['drama'] }),
        ]}
        genreOptions={[]}
        keywordOptions={['drama']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Browse all keywords' }))
    const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
    fireEvent.click(within(dialog).getByRole('button', { name: 'drama' }))
    fireEvent.click(within(dialog).getByRole('button', { name: /^done$/i }))

    expect(
      screen.queryByRole('dialog', { name: /browse keywords/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remove drama' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-077-AC-08: UseMySeriesPanel inline Keywords filter field hides its input', () => {
  it('shows no text input for the inline Keywords field, but the modal still has one', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries({ id: '1', title: 'Show' })]}
        genreOptions={[]}
        keywordOptions={['drama']}
      />,
    )
    expect(
      screen.queryByPlaceholderText('Type to filter tracked keywords'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Browse all keywords' }))
    expect(
      screen.getByPlaceholderText('Type to filter tracked keywords'),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-064-AC-04: picker sort defaults to descending for non-Title fields', () => {
  it('sets specificSeriesSortDirection to desc when switching to IMDb Rating', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.change(screen.getByLabelText(/sort by/i), {
      target: { value: 'imdbRating' },
    })
    expect(
      screen.getByRole('button', { name: 'Sort descending' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-064-AC-05: picker sort defaults to ascending for Title', () => {
  it('sets specificSeriesSortDirection to asc when switching to Title from a descending field', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.change(screen.getByLabelText(/sort by/i), {
      target: { value: 'year' },
    })
    fireEvent.change(screen.getByLabelText(/sort by/i), {
      target: { value: 'title' },
    })
    expect(
      screen.getByRole('button', { name: 'Sort ascending' }),
    ).toBeInTheDocument()
  })
})
