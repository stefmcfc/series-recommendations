import { render, screen, fireEvent, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { UseMySeriesPanel } from './UseMySeriesPanel'
import { initialState } from './RecommendationControls'
import type { ControlsState } from './RecommendationControls'
import type { Series } from '../types/series'
import { seriesApi } from '../services/seriesApi'

// FRONTEND-107-AC-10: UseMySeriesPanel now renders a FilterProfileSelector
// (area USE_MY_SERIES) that fetches on mount -- mocked here (not previously
// needed by this file) so every pre-existing test sees no behavior change.
vi.mock('../services/seriesApi')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(seriesApi.listFilterProfiles).mockResolvedValue([])
})

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
    excludeKeywordsSelected: [],
    language: '',
    countriesSelected: [],
    sortBy: 'score',
    discoverSortBy: 'vote_average.desc',
    sourceRankingStrategy: 'personalRatingThenDate',
    sourceRatingBlendSources: ['imdb', 'tmdb'],
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
    originalLanguage: null,
    keywords: [],
    overview: null,
    excludeFromRecommendations: false,
    flaggedForRewatch: false,
    ...overrides,
  }
}

// FRONTEND-134-AC-09/10: "Filter My Series" is now a slide-out sheet,
// defaulting closed (supersedes frontend_spec_081-AC-01's original
// "defaults open" behavior) -- every test below that reaches into the
// sheet's own fields now opens it first via this helper.
function openFilterMySeriesSheet() {
  fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
}

describe('FRONTEND-076-AC-05: other include/exclude usages are renamed', () => {
  it('renders "Include / Exclude Genres" in UseMySeriesPanel', () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={['Comedy']}
        keywordOptions={[]}
      />,
    )
    openFilterMySeriesSheet()
    expect(
      screen.getByRole('button', { name: 'Include / Exclude Genres' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-093-AC-01: divider renders between filter section and Series picker', () => {
  it('places a divider after the filters body and before the Series picker', () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    openFilterMySeriesSheet()
    const filtersBody = screen.getByTestId('specific-series-filters-body')
    // FRONTEND-093-AC-01: the inline Series picker renders `hideInput`, so
    // "Series" is only exposed as an aria-label on its container div (no
    // visible <label> text) -- getByLabelText matches that directly, unlike
    // getByText which only finds visible text content.
    const seriesLabel = screen.getByLabelText('Series')
    const divider = screen.getByTestId('specific-series-divider')

    expect(
      filtersBody.compareDocumentPosition(divider) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      divider.compareDocumentPosition(seriesLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

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
    openFilterMySeriesSheet()

    expect(
      screen.getByRole('button', { name: 'Include / Exclude Genres' }),
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
    openFilterMySeriesSheet()

    fireEvent.click(screen.getByLabelText(/completed only/i))
    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    // FRONTEND-134-AC-10: name-filtered -- the "Filter My Series" sheet
    // (also role="dialog") is still open here too.
    const dialog = screen.getByRole('dialog', { name: /browse series/i })

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
    openFilterMySeriesSheet()
    expect(
      screen.getByRole('button', { name: 'Include / Exclude Genres' }),
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
    openFilterMySeriesSheet()
    fireEvent.click(
      screen.getByRole('button', { name: 'Include / Exclude Genres' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: neutral' }))
    // neutral -> include -> exclude (the picker's toggle cycle is
    // neutral -> include -> exclude -> neutral -- a third click on the
    // exclude-labeled button would cycle back to neutral and undo the
    // exclusion, so this deliberately stops at two clicks, not the spec's
    // literal three, to actually land on and verify the "exclude" state).
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: include' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    const dialog = openBrowseSeriesModal()

    expect(
      within(dialog).queryByRole('button', { name: /Funny Show/ }),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /Serious Show/ }),
    ).toBeInTheDocument()
  })
})

// FRONTEND-134-AC-09: supersedes this describe block's original title/
// behavior -- "Filter My Series" is now a slide-out sheet that defaults
// CLOSED (frontend_spec_081-AC-01's original "defaults OPEN" no longer
// holds, per this spec's Design Decisions: a sheet defaulting open would
// cover the page immediately on render, unlike the inline disclosure it
// replaces).
describe('FRONTEND-134-AC-09: Filter My Series sheet defaults closed', () => {
  it('renders collapsed on mount, opening only once the toggle is clicked', () => {
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
      screen.getByRole('button', { name: /^filter my series$/i }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(/completed only/i)).not.toBeInTheDocument()

    openFilterMySeriesSheet()
    expect(screen.getByLabelText(/completed only/i)).toBeVisible()
  })
})

describe('FRONTEND-134-AC-12: toggle opens/closes the sheet', () => {
  it('shows and hides the filter controls on click', () => {
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
      name: /^filter my series$/i,
    })

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText(/completed only/i)).toBeVisible()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(/completed only/i)).not.toBeInTheDocument()
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
    openFilterMySeriesSheet()

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
// FRONTEND-134-AC-10: name-filtered -- the "Filter My Series" sheet (also
// role="dialog") is frequently still open at this point in these tests
// (its fields are what's being exercised beforehand), so an unfiltered
// getByRole('dialog') would now match two dialogs at once.
function openBrowseSeriesModal() {
  fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
  return screen.getByRole('dialog', { name: /browse series/i })
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
    openFilterMySeriesSheet()

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
    openFilterMySeriesSheet()

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
    openFilterMySeriesSheet()

    fireEvent.change(screen.getByLabelText(/min tmdb rating \(my series\)/i), {
      target: { value: '8' },
    })
    const dialog = openBrowseSeriesModal()

    expect(within(dialog).getByText('High TMDB')).toBeInTheDocument()
    expect(within(dialog).queryByText('Low TMDB')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-122-AC-03: Rotten Tomatoes min-rating filters narrow the picker', () => {
  it('only offers series at or above the entered Rotten Tomatoes rating', () => {
    const series = [
      makeSeries({ id: '1', title: 'High RT', rottenTomatoesRating: 80 }),
      makeSeries({ id: '2', title: 'Low RT', rottenTomatoesRating: 30 }),
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
    openFilterMySeriesSheet()

    fireEvent.change(screen.getByLabelText('Min Tomatometer Rating'), {
      target: { value: '60' },
    })
    const dialog = openBrowseSeriesModal()

    expect(within(dialog).getByText('High RT')).toBeInTheDocument()
    expect(within(dialog).queryByText('Low RT')).not.toBeInTheDocument()
  })

  it('only offers series at or above the entered Rotten Tomatoes Popcornmeter', () => {
    const series = [
      makeSeries({
        id: '1',
        title: 'High Popcorn',
        rottenTomatoesPopcornmeter: 80,
      }),
      makeSeries({
        id: '2',
        title: 'Low Popcorn',
        rottenTomatoesPopcornmeter: 30,
      }),
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
    openFilterMySeriesSheet()

    fireEvent.change(screen.getByLabelText('Min Popcornmeter Rating'), {
      target: { value: '60' },
    })
    const dialog = openBrowseSeriesModal()

    expect(within(dialog).getByText('High Popcorn')).toBeInTheDocument()
    expect(within(dialog).queryByText('Low Popcorn')).not.toBeInTheDocument()
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
    openFilterMySeriesSheet()

    fireEvent.change(screen.getByLabelText(/year min \(my series\)/i), {
      target: { value: '2015' },
    })
    const dialog = openBrowseSeriesModal()

    expect(within(dialog).getByText('In Range')).toBeInTheDocument()
    expect(within(dialog).queryByText('Out of Range')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-109-AC-12/FRONTEND-134-AC-13: Clear Filters resets defaults and closes the sheet', () => {
  it('resets all local filter/sort fields to defaults, and closes the sheet', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    openFilterMySeriesSheet()

    fireEvent.change(screen.getByLabelText(/year min \(my series\)/i), {
      target: { value: '2020' },
    })
    fireEvent.click(screen.getByTestId('reset-specific-series-filters-btn'))

    // FRONTEND-134-AC-13: Clear Filters now also closes the sheet --
    // re-open it to inspect the reset fields.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    openFilterMySeriesSheet()
    expect(screen.getByLabelText(/year min \(my series\)/i)).toHaveValue(null)
    expect(screen.getByLabelText('Any Status')).toBeChecked()
  })
})

describe('FRONTEND-082-AC-01: interval-overlap year matching includes a series via lastAirYear', () => {
  it('includes a series whose year is below yearMin but lastAirYear reaches it', () => {
    const series = [
      makeSeries({
        id: '1',
        title: 'Long Runner',
        year: 2015,
        lastAirYear: 2023,
      }),
      makeSeries({
        id: '2',
        title: 'Ended Early',
        year: 2015,
        lastAirYear: 2016,
      }),
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
    openFilterMySeriesSheet()

    fireEvent.change(screen.getByLabelText(/year min \(my series\)/i), {
      target: { value: '2020' },
    })
    const dialog = openBrowseSeriesModal()

    expect(within(dialog).getByText('Long Runner')).toBeInTheDocument()
    expect(within(dialog).queryByText('Ended Early')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-082-AC-02: yearMax still checks year, not lastAirYear', () => {
  it('excludes a series whose year exceeds yearMax even if lastAirYear would not', () => {
    const series = [
      makeSeries({
        id: '1',
        title: 'Starts Late',
        year: 2025,
        lastAirYear: 2025,
      }),
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
    openFilterMySeriesSheet()

    fireEvent.change(screen.getByLabelText(/year max \(my series\)/i), {
      target: { value: '2020' },
    })
    const dialog = openBrowseSeriesModal()

    expect(within(dialog).queryByText('Starts Late')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-082-AC-03: no lastAirYear falls back to year, unchanged', () => {
  it('still matches or excludes correctly using year alone when lastAirYear is null', () => {
    const series = [
      makeSeries({ id: '1', title: 'In Range', year: 2021, lastAirYear: null }),
      makeSeries({
        id: '2',
        title: 'Out of Range',
        year: 2010,
        lastAirYear: null,
      }),
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
    openFilterMySeriesSheet()

    fireEvent.change(screen.getByLabelText(/year min \(my series\)/i), {
      target: { value: '2020' },
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
    openFilterMySeriesSheet()

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
    openFilterMySeriesSheet()

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
    openFilterMySeriesSheet()

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
    openFilterMySeriesSheet()

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
    openFilterMySeriesSheet()

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

    openFilterMySeriesSheet()
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
    openFilterMySeriesSheet()
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
    openFilterMySeriesSheet()
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

describe('FRONTEND-107-AC-10: UseMySeriesPanel applies a saved profile', () => {
  it('updates each local filter/sort field from the applied profile', async () => {
    vi.mocked(seriesApi.listFilterProfiles).mockResolvedValue([
      {
        id: '1',
        area: 'USE_MY_SERIES',
        name: 'Comedies',
        criteria: {
          genreFilter: ['Comedy'],
          excludeGenreFilter: [],
          statusFilter: 'completedOnly',
          keywordsFilter: [],
          // FRONTEND-128-AC-03/SERIES-065.
          originCountryFilter: [],
          originalLanguageFilter: '',
          minPersonalRating: null,
          minImdbRating: '',
          minTmdbRating: '',
          // FRONTEND-122-AC-03/SERIES-063.
          minRottenTomatoesRating: '',
          minRottenTomatoesPopcornmeter: '',
          yearMin: '',
          yearMax: '',
          sortBy: 'title',
          sortDirection: 'asc',
        },
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={['Comedy']}
        keywordOptions={[]}
      />,
    )
    openFilterMySeriesSheet()
    fireEvent.click(await screen.findByText('Comedies'))
    expect(screen.getByLabelText('Completed Only')).toBeChecked()
  })

  // Regression test: a profile saved before originCountryFilter/
  // originalLanguageFilter existed on UseMySeriesFilterCriteria
  // (frontend_spec_128) has those keys missing entirely, not set to their
  // empty value. Applying such a profile used to crash
  // buildSpecificSeriesCandidatePool's filterSpecificSeriesByOriginCountry
  // (`undefined.length`) -- found live after frontend_spec_129 shipped.
  it('applies an older profile missing newer criteria fields without crashing', async () => {
    vi.mocked(seriesApi.listFilterProfiles).mockResolvedValue([
      {
        id: '1',
        area: 'USE_MY_SERIES',
        name: 'No animation',
        criteria: {
          genreFilter: [],
          excludeGenreFilter: ['Animation'],
          statusFilter: 'any',
          keywordsFilter: [],
          // originCountryFilter/originalLanguageFilter omitted entirely --
          // the field didn't exist when this profile was saved.
          minPersonalRating: null,
          minImdbRating: '',
          minTmdbRating: '',
          yearMin: '',
          yearMax: '',
          sortBy: 'title',
          sortDirection: 'asc',
        },
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={['Animation']}
        keywordOptions={[]}
      />,
    )
    openFilterMySeriesSheet()
    fireEvent.click(await screen.findByText('No animation'))
    expect(screen.getByLabelText('Any Status')).toBeChecked()
  })
})

describe('FRONTEND-129-AC-02: Saved Filters list at top, actions stay at bottom, in UseMySeriesPanel', () => {
  it('renders SavedFiltersList before the Filter by Status fieldset', async () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    openFilterMySeriesSheet()
    const body = screen.getByTestId('specific-series-filters-body')
    const list = await screen.findByTestId('filter-profile-selector')
    const statusFieldset = screen.getByText('Filter by Status')
    expect(body.contains(list)).toBe(true)
    expect(
      list.compareDocumentPosition(statusFieldset) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('still renders FilterProfileActions after the year fields, before Clear Filters', async () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    openFilterMySeriesSheet()
    const yearMax = screen.getByLabelText(/year max \(my series\)/i)
    const actions = await screen.findByTestId('filter-profile-actions')
    const resetButton = screen.getByTestId('reset-specific-series-filters-btn')
    expect(
      yearMax.compareDocumentPosition(actions) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      actions.compareDocumentPosition(resetButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('FRONTEND-119-AC-09: Use My Series missing-rating notice', () => {
  it('shows the notice when sorted by a droppable rating with excluded series', () => {
    const allSeries = [
      makeSeries({
        id: '1',
        title: 'Has RT',
        rottenTomatoesRating: 80,
        excludeFromRecommendations: false,
      }),
      makeSeries({
        id: '2',
        title: 'No RT',
        excludeFromRecommendations: false,
      }),
    ]
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={allSeries}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    openFilterMySeriesSheet()

    fireEvent.change(screen.getByLabelText('Sort by'), {
      target: { value: 'rottenTomatoesRating' },
    })

    expect(
      screen.getByText(
        '1 series meeting this criteria does not have Tomatometer ratings',
      ),
    ).toBeInTheDocument()
  })

  it('shows nothing when every candidate has the sorted-on rating', () => {
    const allSeries = [
      makeSeries({
        id: '1',
        title: 'Has RT',
        rottenTomatoesRating: 80,
        excludeFromRecommendations: false,
      }),
    ]
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={allSeries}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    openFilterMySeriesSheet()

    fireEvent.change(screen.getByLabelText('Sort by'), {
      target: { value: 'rottenTomatoesRating' },
    })

    expect(
      screen.queryByText(/do not have|does not have/),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-128-AC-03: origin country/language filters in Use My Series', () => {
  it('only offers a series matching one of the selected origin countries', () => {
    const series = [
      makeSeries({
        id: '1',
        title: 'UK Co-Production',
        originCountry: 'GB,US',
      }),
      makeSeries({ id: '2', title: 'French Show', originCountry: 'FR' }),
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
    openFilterMySeriesSheet()

    fireEvent.click(screen.getByLabelText('Country'))
    fireEvent.click(screen.getByText('GB'))
    const dialog = openBrowseSeriesModal()

    expect(within(dialog).getByText('UK Co-Production')).toBeInTheDocument()
    expect(within(dialog).queryByText('French Show')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-131-AC-11: Min Tomatometer/Popcornmeter Rating fields have info disclosures', () => {
  it('renders a disclosure on both the Tomatometer and Popcornmeter fields', () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    openFilterMySeriesSheet()
    expect(
      screen.getByRole('button', {
        name: 'About Min Popcornmeter Rating',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'About Min Tomatometer Rating',
      }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-132-AC-01: source ranking strategy radios', () => {
  it('defaults to Personal Rating, then Date Completed and updates state on change', () => {
    const updateState = vi.fn()
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={updateState}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )

    expect(
      screen.getByRole('radio', {
        name: 'Personal Rating, then Date Completed',
      }),
    ).toBeChecked()

    fireEvent.click(
      screen.getByRole('radio', {
        name: 'Custom Rating Blend, then Personal Rating',
      }),
    )
    expect(updateState).toHaveBeenCalledWith({
      sourceRankingStrategy: 'customBlendThenPersonalRating',
    })
  })

  it('updates state when Personal Rating, then Custom Rating Blend is selected', () => {
    const updateState = vi.fn()
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={updateState}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )

    fireEvent.click(
      screen.getByRole('radio', {
        name: 'Personal Rating, then Custom Rating Blend',
      }),
    )
    expect(updateState).toHaveBeenCalledWith({
      sourceRankingStrategy: 'personalRatingThenCustomBlend',
    })
  })
})

describe('FRONTEND-132-AC-02: strategy explanation disclosure', () => {
  it('reveals explanatory text distinguishing Custom Rating Blend from Blended Rating on click', () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /About.*Ranking/i }))
    expect(
      screen.getByText(/distinct from.*Blended Rating/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-132-AC-03: Custom Rating Blend source chips', () => {
  it('is hidden for the default strategy and shown, with IMDb+TMDB selected, for blend strategies', () => {
    const { rerender } = render(
      <UseMySeriesPanel
        state={makeState({ sourceRankingStrategy: 'personalRatingThenDate' })}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    expect(
      screen.queryByRole('group', { name: /Custom Rating Blend sources/i }),
    ).not.toBeInTheDocument()

    rerender(
      <UseMySeriesPanel
        state={makeState({
          sourceRankingStrategy: 'customBlendThenPersonalRating',
        })}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    const group = screen.getByRole('group', {
      name: /Custom Rating Blend sources/i,
    })
    expect(
      within(group).getByRole('button', { name: 'IMDb', pressed: true }),
    ).toBeInTheDocument()
    expect(
      within(group).getByRole('button', { name: 'TMDB', pressed: true }),
    ).toBeInTheDocument()
    expect(
      within(group).getByRole('button', {
        name: 'Tomatometer',
        pressed: false,
      }),
    ).toBeInTheDocument()
  })

  it('updates sourceRatingBlendSources on the panel state when a chip is toggled', () => {
    const updateState = vi.fn()
    render(
      <UseMySeriesPanel
        state={makeState({
          sourceRankingStrategy: 'personalRatingThenCustomBlend',
        })}
        updateState={updateState}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tomatometer' }))
    expect(updateState).toHaveBeenCalledWith({
      sourceRatingBlendSources: ['imdb', 'tmdb', 'tomatometer'],
    })
  })
})

describe('FRONTEND-134-AC-10: opens as an accessible dialog', () => {
  it('renders a labelled dialog when the toggle is clicked', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    const dialog = screen.getByRole('dialog', { name: /filter my series/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})

describe('FRONTEND-134-AC-11: focus moves to Close on open', () => {
  it('focuses the Close button once the sheet opens', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus()
  })
})

describe('FRONTEND-134-AC-12: Escape/Close/backdrop close the sheet', () => {
  it('closes on Escape', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    fireEvent.keyDown(
      screen.getByRole('dialog', { name: /filter my series/i }),
      { key: 'Escape' },
    )
    expect(
      screen.queryByRole('dialog', { name: /filter my series/i }),
    ).not.toBeInTheDocument()
  })

  it('closes when the Close control is clicked', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(
      screen.queryByRole('dialog', { name: /filter my series/i }),
    ).not.toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    fireEvent.click(screen.getByRole('dialog', { name: /filter my series/i }))
    expect(
      screen.queryByRole('dialog', { name: /filter my series/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-134-AC-13: Clear Filters resets and closes', () => {
  it('resets fields and closes the sheet', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={['Drama']}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    fireEvent.click(screen.getByTestId('reset-specific-series-filters-btn'))
    expect(
      screen.queryByRole('dialog', { name: /filter my series/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-134-AC-14: active-filter-count badge', () => {
  it('shows no badge with every field at its default', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    expect(
      screen.queryByTestId('use-my-series-filters-active-count'),
    ).not.toBeInTheDocument()
  })

  it('shows a badge once Status is narrowed from Any', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    fireEvent.click(screen.getByLabelText('Completed Only'))
    expect(
      screen.getByTestId('use-my-series-filters-active-count'),
    ).toHaveTextContent('1')
  })
})

describe('FRONTEND-134-AC-15: fields grouped into subsections', () => {
  it('renders five named CollapsibleSection headings', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={['Drama']}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    for (const name of [
      'Status & Sort',
      'Genre & Keyword',
      'Country & Language',
      'Ratings',
      'Year',
    ]) {
      expect(
        screen.getByRole('button', { name: new RegExp(name, 'i') }),
      ).toBeInTheDocument()
    }
  })
})

describe('FRONTEND-134-AC-16: all fields still present', () => {
  it('renders every pre-existing field when open', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={['Drama']}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    expect(screen.getByText('Filter by Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument()
    expect(screen.getByText('Min Personal Rating')).toBeInTheDocument()
    expect(screen.getByLabelText(/year min \(my series\)/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-134-AC-19: Filter My Series intro line', () => {
  it('shows the explanatory intro text when the sheet is open', () => {
    render(
      <UseMySeriesPanel
        state={initialState}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^filter my series$/i }))
    expect(
      screen.getByText(
        'Filter the series that you want to use for recommendations before selecting them.',
      ),
    ).toBeInTheDocument()
  })
})
