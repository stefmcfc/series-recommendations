import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  RecommendationControls,
  buildSpecificSeriesCandidatePool,
  buildQuery,
  initialState,
  seriesPickerLabel,
  seriesPickerDisplay,
} from './RecommendationControls'
import type { SpecificSeriesFilters } from './RecommendationControls'
import { seriesApi } from '../services/seriesApi'
import type { Series } from '../types/series'
import { SPECIFIC_SERIES_PICKER_LIMIT } from '../utils/keywordSuggestions'

vi.mock('../services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)
const mockGetGenreOptions = vi.mocked(seriesApi.getGenreOptions)
const mockGetKeywordStats = vi.mocked(seriesApi.getKeywordStats)

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: '1',
    title: 'Ozark',
    year: 2017,
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

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAll.mockResolvedValue([])
  mockGetGenreOptions.mockResolvedValue([])
  mockGetKeywordStats.mockResolvedValue([])
})

// FRONTEND-081: buildSpecificSeriesCandidatePool's filter criteria moved
// from 7 positional parameters to a single options object -- this helper
// keeps the direct unit tests below concise, only specifying the fields each
// test actually cares about.
function makeSpecificSeriesFilters(
  overrides: Partial<SpecificSeriesFilters> = {},
): SpecificSeriesFilters {
  return {
    genreFilter: [],
    excludeGenreFilter: [],
    statusFilter: 'any',
    sortBy: 'title',
    sortDirection: 'asc',
    keywordsFilter: [],
    minPersonalRating: null,
    minImdbRating: '',
    minTmdbRating: '',
    yearMin: '',
    yearMax: '',
    ...overrides,
  }
}

// FRONTEND-040-AC-01/03: every control except "Recommendation Source" is now
// Apply-gated -- most existing tests below click this between changing a
// field and asserting on onQueryChange, mirroring how frontend_spec_035
// updated this same file's interaction shape (not the behavioral intent)
// when the Specific Series picker's UI changed.
function clickApplyFilters() {
  fireEvent.click(screen.getByRole('button', { name: /get recommendations/i }))
}

// FRONTEND-042: the old five flat radios ("Automatic"/"Specific Series"/
// "Genre & Keyword"/"Popular Right Now"/"Highest Rated") are replaced by a
// two-tier tab widget -- "Use My Series" (merging the first two) and
// "Discover" (a parent tab whose own nested tablist offers "Custom Search"/
// "Popular Right Now"/"Highest Rated", the former "Genre & Keyword" renamed).
// These helpers implement frontend_spec_042's Design Decisions' mechanical
// query migration (getByLabelText(mode) -> getByRole('tab', {name})) used
// throughout this file. Each is idempotent -- clicking an already-active tab
// is a no-op (FRONTEND-042-AC-15), so calling e.g. selectDiscover() when
// Discover is already active is always safe.
function selectUseMySeries() {
  fireEvent.click(screen.getByRole('tab', { name: /use my series/i }))
}

function selectDiscover() {
  fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
}

function selectCustomSearch() {
  selectDiscover()
  fireEvent.click(screen.getByRole('tab', { name: /custom search/i }))
}

function selectPopularRightNow() {
  selectDiscover()
  fireEvent.click(screen.getByRole('tab', { name: /popular right now/i }))
}

function selectHighestRated() {
  selectDiscover()
  fireEvent.click(screen.getByRole('tab', { name: /highest rated/i }))
}

// FRONTEND-094-AC-02/AC-04: Custom Search's Keywords field now hides its own
// inline input (hideInput) -- typing a keyword (including free text with no
// match in keywordOptions) goes through the new "Browse all keywords" modal
// instead, mirrored from UseMySeriesPanel's own modal test helpers. Leaves
// the modal open (matching this file's existing convention of not always
// closing the GenreIncludeExcludePicker modal after every interaction) so
// callers can make further assertions scoped to the dialog if needed.
function addCustomSearchKeyword(value: string) {
  fireEvent.click(screen.getByRole('button', { name: /browse all keywords/i }))
  const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
  const input = within(dialog).getByLabelText('Keywords')
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

// FRONTEND-069-AC-04: "Filter by Genre" is now the shared
// GenreIncludeExcludePicker (trigger button + modal), replacing the old
// inline checkbox-per-genre fieldset -- opens the modal, toggles one genre
// from neutral straight to `include` (one click, mirroring what a direct
// checkbox click used to do), then closes the modal again so it doesn't
// leave a second `role="dialog"` element behind for tests that go on to
// open the "Show all series" modal.
function includeSpecificSeriesGenre(genre: string) {
  fireEvent.click(
    screen.getByRole('button', { name: 'Include / Exclude Genres' }),
  )
  fireEvent.click(screen.getByRole('button', { name: `${genre}: neutral` }))
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
}

// FRONTEND-077-AC-05: the inline Series field no longer renders its own
// typing input (hideInput) -- picking a series in these tests now
// routes through the "Show all series" modal, which keeps its own full
// KeywordPicker unaffected by hideInput. Closes the modal again afterward
// so it doesn't leave a second `role="dialog"` element behind for a test
// that goes on to open another modal.
async function pickSpecificSeries(name: string | RegExp) {
  fireEvent.click(
    await screen.findByRole('button', { name: /show all series/i }),
  )
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
}

describe('FRONTEND-011-AC-03: two-tier sourcing mode selector', () => {
  it('renders Use My Series and Discover tabs, defaulting to Use My Series', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    expect(
      screen.getByRole('tab', { name: /use my series/i, selected: true }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /^discover$/i, selected: false }),
    ).toBeInTheDocument()
  })
})

// FRONTEND-035: the checkbox-per-series list is replaced by a KeywordPicker
// (frontend_spec_035_specific_series_picker.md) -- these tests' query/
// interaction shape is updated accordingly (type-to-search, click a
// suggestion button), but the behavioral assertion each pins (picking a
// series populates seriesIds) is unchanged.
describe('FRONTEND-011-AC-04: Specific Series picker via getAll()', () => {
  // FRONTEND-077-AC-05: routed through the "Show all series" modal now that
  // the inline Series field no longer renders its own typing input (its default suggestion list still shows, but the modal exercises the same options uncapped).
  it('fetches series and offers each as a pickable suggestion, populating seriesIds when picked', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', status: 'COMPLETED', year: null }),
      makeSeries({
        id: '2',
        title: 'The Wire',
        status: 'WATCHING',
        year: null,
      }),
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(
      await screen.findByRole('button', { name: /show all series/i }),
    )
    let dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('button', { name: 'Ozark - COMPLETED' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'The Wire - WATCHING' }),
    ).toBeInTheDocument()

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Ozark - COMPLETED' }),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesIds: ['1'] }),
    )

    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    dialog = screen.getByRole('dialog')
    const input = within(dialog).getByRole('textbox', { name: 'Series' })
    fireEvent.change(input, { target: { value: 'wire' } })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'The Wire - WATCHING' }),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesIds: ['1', '2'] }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove 1' }))
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesIds: ['2'] }),
    )
  })

  it('includes year and origin country in the label to disambiguate same-titled series', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({
        id: '1',
        title: 'Ozark',
        year: 2017,
        originCountry: 'US',
        status: 'COMPLETED',
      }),
      makeSeries({
        id: '2',
        title: 'Ozark',
        year: 2022,
        originCountry: 'GB',
        status: 'BACKLOG',
      }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(
      await screen.findByRole('button', { name: /show all series/i }),
    )
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('button', {
        name: 'Ozark (2017) | United States - COMPLETED',
      }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', {
        name: 'Ozark (2022) | United Kingdom - BACKLOG',
      }),
    ).toBeInTheDocument()
  })

  it('omits the year/country segment when either field is null', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', year: null, originCountry: null }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(
      await screen.findByRole('button', { name: /show all series/i }),
    )
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('button', { name: 'Ozark - COMPLETED' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-014-AC-02: fetches genre options on mount', () => {
  it('calls seriesApi.getGenreOptions() once on mount', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    expect(mockGetGenreOptions).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-014-AC-03: degrades gracefully if getGenreOptions() rejects', () => {
  it('does not crash and still renders the rest of the form', async () => {
    mockGetGenreOptions.mockRejectedValue(new Error('network error'))
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    selectCustomSearch()
    await waitFor(() => expect(mockGetGenreOptions).toHaveBeenCalled())
    // FRONTEND-094-AC-02: the inline Keywords field now hides its own
    // <label> text (hideInput) in favor of an aria-label on its container --
    // getByLabelText still reaches it, matching CustomSearchPanel.test.tsx's
    // own equivalent assertion.
    expect(screen.getByLabelText('Keywords')).toBeInTheDocument()
  })
})

describe('FRONTEND-014-AC-04/05: genre checkbox list', () => {
  // FRONTEND-068-AC-02: the checkbox-per-genre fieldset this AC originally
  // covered was replaced by GenreIncludeExcludePicker -- updated to open
  // the picker and toggle each genre's own button instead of a checkbox.
  // The picker's neutral -> include -> exclude cycle means a third click on
  // an already-included genre moves it to `exclude` (removed from `genres`,
  // added to `excludeGenres`), not back to neutral -- either way it's
  // absent from `genres`, which is all this test's assertions check.
  it('renders a toggle per fetched genre and toggles genresSelected on click', async () => {
    mockGetGenreOptions.mockResolvedValue(['Action', 'Drama'])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectCustomSearch()
    fireEvent.click(
      screen.getByRole('button', { name: 'Include / Exclude Genres' }),
    )

    const dramaToggle = await screen.findByRole('button', {
      name: 'Drama: neutral',
    })
    expect(
      screen.getByRole('button', { name: 'Action: neutral' }),
    ).toBeInTheDocument()

    fireEvent.click(dramaToggle)
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Drama'] }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Action: neutral' }))
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Drama', 'Action'] }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Drama: include' }))
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Action'] }),
    )
  })
})

describe('FRONTEND-014-AC-06: free-text Genres input is gone', () => {
  it('does not render a text input labelled Genres, but does render the free-text Keywords picker input', async () => {
    mockGetGenreOptions.mockResolvedValue(['Action'])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    selectCustomSearch()
    fireEvent.click(
      screen.getByRole('button', { name: 'Include / Exclude Genres' }),
    )
    await screen.findByRole('button', { name: 'Action: neutral' })

    expect(
      screen.queryByRole('textbox', { name: /^genres/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Keywords')).toBeInTheDocument()
  })
})

describe('FRONTEND-014-AC-08: empty genresSelected omits genres from the query', () => {
  it('omits genres when no checkbox is checked', async () => {
    mockGetGenreOptions.mockResolvedValue(['Action'])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectCustomSearch()
    addCustomSearchKeyword('heist')

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ genres: expect.anything() }),
    )
  })
})

describe('FRONTEND-014-AC-09: hint reflects genresSelected/keywords emptiness', () => {
  it('hides the hint once a genre is included, shows it again once cleared', async () => {
    mockGetGenreOptions.mockResolvedValue(['Drama'])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    selectCustomSearch()
    expect(
      screen.getByText(/browse the most popular shows overall/i),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Include / Exclude Genres' }),
    )
    const dramaToggle = await screen.findByRole('button', {
      name: 'Drama: neutral',
    })
    fireEvent.click(dramaToggle)
    expect(
      screen.queryByText(/browse the most popular shows overall/i),
    ).not.toBeInTheDocument()

    // FRONTEND-068-AC-02: the picker's cycle is neutral -> include ->
    // exclude -> neutral -- Clear returns both included/excluded to empty
    // directly, which is the equivalent "un-toggle" action for this test
    // (a second click on the same toggle would move Drama to `exclude`,
    // which still shows the hint's "empty genres" condition since
    // genresSelected would be empty -- but exercising Clear here matches
    // the picker's own documented reset affordance instead).
    fireEvent.click(
      screen.getByTestId('custom-search-genre-genre-picker-clear-btn'),
    )
    expect(
      screen.getByText(/browse the most popular shows overall/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-014-AC-10: switching mode clears genresSelected', () => {
  it('clears included genres when switching from Custom Search to Use My Series', async () => {
    mockGetGenreOptions.mockResolvedValue(['Drama'])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectCustomSearch()
    fireEvent.click(
      screen.getByRole('button', { name: 'Include / Exclude Genres' }),
    )
    const dramaToggle = await screen.findByRole('button', {
      name: 'Drama: neutral',
    })
    fireEvent.click(dramaToggle)
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ genres: ['Drama'] }),
    )

    selectUseMySeries()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ genres: expect.anything() }),
    )
  })
})

describe('FRONTEND-011-AC-06: mode switching clears stale fields', () => {
  it('clears seriesIds when switching from Use My Series to Custom Search', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', year: null }),
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    await pickSpecificSeries('Ozark - COMPLETED')
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesIds: ['1'] }),
    )

    selectCustomSearch()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ seriesIds: expect.anything() }),
    )
  })
})

describe('FRONTEND-011-AC-07: output filter fields', () => {
  it('renders the Filters section collapsed by default', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    expect(
      screen.queryByLabelText(/^min tmdb rating$/i),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    expect(screen.getByLabelText(/^min tmdb rating$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/min vote count/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^year min$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^year max$/i)).toBeInTheDocument()
    // FRONTEND-068-AC-04: Exclude Genres is now a GenreIncludeExcludePicker
    // trigger button, not a labeled text input.
    expect(
      screen.getByRole('button', { name: 'Exclude Genres' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^language/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-011-AC-08: empty filter fields omitted, not sent as empty/zero', () => {
  it('omits minVoteCount from the query when the field is left blank', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    fireEvent.change(screen.getByLabelText(/^min tmdb rating$/i), {
      target: { value: '7' },
    })
    clickApplyFilters()

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ minVoteCount: expect.anything() }),
    )
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ minTmdbRating: 7 }),
    )
  })

  it('sends numeric, not string, values for populated number fields', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    fireEvent.change(screen.getByLabelText(/min vote count/i), {
      target: { value: '50' },
    })
    fireEvent.change(screen.getByLabelText(/^year min$/i), {
      target: { value: '2020' },
    })
    // FRONTEND-047: Language is now a single-select picker -- setting a
    // value means selecting an option (the pinned "English" quick-select
    // here), not typing directly into the field.
    fireEvent.click(screen.getByRole('button', { name: /^english$/i }))
    clickApplyFilters()

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        minVoteCount: 50,
        yearMin: 2020,
        language: 'en',
      }),
    )
  })
})

describe('FRONTEND-011-AC-09: Reset Filters', () => {
  // FRONTEND-040-AC-04: Reset no longer auto-applies -- the user clicks
  // Apply Filters afterward like any other pending change, so this test now
  // clicks it both after making the change and after resetting.
  it('clears every filter field but leaves sourcing mode/selection untouched, applied via Apply Filters', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', year: null }),
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    await pickSpecificSeries('Ozark - COMPLETED')

    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    fireEvent.change(screen.getByLabelText(/^min tmdb rating$/i), {
      target: { value: '7' },
    })
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesIds: ['1'], minTmdbRating: 7 }),
    )

    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }))
    clickApplyFilters()

    expect(onQueryChange).toHaveBeenLastCalledWith({
      sourceMode: 'useMySeries',
      seriesIds: ['1'],
    })
    expect(screen.getByLabelText(/^min tmdb rating$/i)).toHaveValue(null)
  })
})

// FRONTEND-040 supersedes this AC's "no Apply button" premise -- an explicit
// "Apply Filters" button now gates every control except Recommendation
// Source (see the FRONTEND-040-AC-01/02/03 describe blocks below).
//
// FRONTEND-062 (2026-09-01): the "calls onQueryChange once on mount with the
// default query" test that used to live here (added by the since-superseded
// "Fix 3" mount effect, itself reversed by frontend_spec_062) asserted
// exactly the mount-fires-a-request behavior FRONTEND-062-AC-01 now
// forbids. Replaced below with its direct opposite.
describe('FRONTEND-011-AC-12: mounting does not trigger an Apply-gated control', () => {
  it('renders "Get Recommendations", not a bare "Apply"/"Submit" button', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: /get recommendations/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^apply$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^submit$/i }),
    ).not.toBeInTheDocument()
  })

  // FRONTEND-062-AC-01: no default query is established on mount anymore --
  // nothing calls onQueryChange until the user clicks Apply Filters.
  it('FRONTEND-062-AC-01: does not call onQueryChange on mount', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    expect(onQueryChange).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-048-AC-01: Max Per Source is never rendered', () => {
  it('does not render under any mode', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    expect(screen.queryByLabelText(/max per source/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    expect(screen.queryByLabelText(/max per source/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-048-AC-02: Max Sources Shown is never rendered', () => {
  it('does not render under any mode', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    expect(
      screen.queryByLabelText(/max sources shown/i),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-048-AC-03: query never includes maxPerSource/maxSourcesShown', () => {
  it('omits both fields from the emitted query', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.not.objectContaining({
        maxPerSource: expect.anything(),
        maxSourcesShown: expect.anything(),
      }),
    )
  })
})

describe('FRONTEND-019-AC-11: Sort By is a top-level control, defaults to Best Match', () => {
  it('is visible while Filters is collapsed, defaulted to Best Match', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    expect(screen.getByLabelText(/best match/i)).toBeChecked()
    expect(
      screen.queryByLabelText(/^min tmdb rating$/i),
    ).not.toBeInTheDocument()
  })
})

// FRONTEND-040-AC-01: Sort By is now Apply-gated like every other non-mode
// control -- "immediately" in this AC's title is superseded, but the
// underlying behavioral intent (selecting toggles sortBy in the built query)
// is unchanged, just requires an Apply Filters click first.
describe('FRONTEND-019-AC-12: selecting Most Recommended sets/unsets sortBy', () => {
  it('sets sortBy on selection, omits it again once reverted to Best Match', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/most recommended/i))
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'recommendationCount' }),
    )

    fireEvent.click(screen.getByLabelText(/best match/i))
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ sortBy: expect.anything() }),
    )
  })
})

describe('FRONTEND-019-AC-13: Reset Filters does not affect Sort By', () => {
  it('leaves sortBy=recommendationCount in place after Reset Filters', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/most recommended/i))
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }))
    clickApplyFilters()

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'recommendationCount' }),
    )
  })
})

describe('specific-series fetch failure', () => {
  it('does not crash if seriesApi.getAll() rejects', async () => {
    mockGetAll.mockRejectedValue(new Error('network error'))
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    await waitFor(() => expect(mockGetAll).toHaveBeenCalled())
  })
})

describe('FRONTEND-027-AC-03: Discover reveals Popular Right Now / Highest Rated sub-tabs, unselected by default', () => {
  it('renders the two sub-tabs unselected, Custom Search selected by default', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    selectDiscover()

    expect(
      screen.getByRole('tab', { name: /popular right now/i, selected: false }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /highest rated/i, selected: false }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /custom search/i, selected: true }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-027-AC-03/04: new mode options, clears stale state on switch', () => {
  it('selects Popular Right Now and clears a prior Use My Series selection', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', status: 'COMPLETED', year: null }),
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    await pickSpecificSeries('Ozark - COMPLETED')
    selectPopularRightNow()
    // FRONTEND-062: mode changes no longer auto-fetch -- Apply Filters must
    // be clicked explicitly to produce a built query to inspect.
    clickApplyFilters()

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceMode: 'trending' }),
    )
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ seriesIds: expect.anything() }),
    )
  })

  it('selects Highest Rated, sending sourceMode=topRated with no trendingWindow', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectHighestRated()
    // FRONTEND-062: mode changes no longer auto-fetch -- Apply Filters must
    // be clicked explicitly to produce a built query to inspect.
    clickApplyFilters()

    // FRONTEND-030-AC-07: switching into Highest Rated also pre-fills
    // minVoteCount to 200 when untouched.
    expect(onQueryChange).toHaveBeenLastCalledWith({
      sourceMode: 'topRated',
      minVoteCount: 200,
    })
  })
})

describe('FRONTEND-027-AC-05: Day/Week toggle only under Popular Right Now', () => {
  it('renders the toggle under Popular Right Now, defaulting to week', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectPopularRightNow()
    expect(screen.getByLabelText(/^week$/i)).toBeChecked()
    // FRONTEND-062: mode changes no longer auto-fetch -- Apply Filters must
    // be clicked explicitly to produce a built query to inspect.
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sourceMode: 'trending',
        trendingWindow: 'week',
      }),
    )

    selectHighestRated()
    expect(screen.queryByLabelText(/^week$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^day$/i)).not.toBeInTheDocument()
  })

  it('switches trendingWindow to day when selected', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectPopularRightNow()
    fireEvent.click(screen.getByLabelText(/^day$/i))
    clickApplyFilters()

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sourceMode: 'trending',
        trendingWindow: 'day',
      }),
    )
  })
})

describe('FRONTEND-027-AC-06: no additional control for Highest Rated beyond minVoteCount', () => {
  it('exposes minVoteCount in Filters, with no mode-specific control outside it', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    selectHighestRated()
    expect(screen.queryByLabelText(/^week$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^day$/i)).not.toBeInTheDocument()

    fireEvent.click(
      // FRONTEND-093-AC-02: Highest Rated defaults minVoteCount to '200'
      // (untouched), which makes the toggle's accessible name
      // "Recommendations Filters1" (count badge appended).
      screen.getByRole('button', { name: /^recommendations filters/i }),
    )
    expect(screen.getByLabelText(/min vote count/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-09/10: free-text keyword picker replaces the checkbox list', () => {
  it('adds a typed keyword to the query', async () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectCustomSearch()
    addCustomSearchKeyword('submarine')
    clickApplyFilters()

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ keywords: ['submarine'] }),
    )
  })

  it('accepts multiple typed keywords', async () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectCustomSearch()
    addCustomSearchKeyword('submarine')
    const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
    const input = within(dialog).getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'spy' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    clickApplyFilters()

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ keywords: ['submarine', 'spy'] }),
    )
  })
})

// FRONTEND-032-AC-07/AC-08 supersedes FRONTEND-029-AC-11: the field now
// fetches getKeywordStats() to offer tracked keywords as suggestions
// alongside free text (a real gap found in live use, per
// frontend_spec_032's Overview), rather than never fetching at all.
describe('FRONTEND-032-AC-07: fetches keyword stats and offers them as suggestions', () => {
  it('fetches on mount and renders a fetched keyword as a clickable suggestion', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 3, averagePersonalRating: 4 },
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    selectCustomSearch()
    expect(mockGetKeywordStats).toHaveBeenCalled()
    await screen.findByText('spy')
  })
})

describe('FRONTEND-032-AC-08: degrades silently on keyword stats fetch failure', () => {
  it('renders no alert and free text still works when getKeywordStats rejects', async () => {
    mockGetKeywordStats.mockRejectedValue(new Error('fail'))
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    selectCustomSearch()
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    addCustomSearchKeyword('still works')
    expect(screen.getAllByText('still works').length).toBeGreaterThan(0)
  })
})

describe('FRONTEND-029-AC-12: mode switch still clears keywordsSelected', () => {
  it('clears typed keywords when switching away from Custom Search', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectCustomSearch()
    addCustomSearchKeyword('submarine')
    selectUseMySeries()

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ keywords: expect.anything() }),
    )
  })
})

describe('FRONTEND-029-AC-13: hint recomputed from keywordsSelected', () => {
  it('hides the hint once a keyword is added, shows it again once removed', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    selectCustomSearch()
    expect(
      screen.getByText(/browse the most popular shows overall/i),
    ).toBeInTheDocument()

    addCustomSearchKeyword('spy')
    // FRONTEND-094-AC-03/04: close the modal before checking the inline
    // field's own chip -- while open, both the modal's and the inline
    // field's KeywordPicker instances render a "Remove spy" chip button
    // (they share the same selected state), which would otherwise be an
    // ambiguous match.
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: /browse keywords/i }),
      ).getByRole('button', { name: /^done$/i }),
    )
    expect(
      screen.queryByText(/browse the most popular shows overall/i),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove spy' }))
    expect(
      screen.getByText(/browse the most popular shows overall/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-24/25: accessible names for the keyword picker embedding', () => {
  it('keyword field is reachable by label with named buttons', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    selectCustomSearch()

    addCustomSearchKeyword('spy')
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: /browse keywords/i }),
      ).getByRole('button', { name: /^done$/i }),
    )

    expect(
      screen.getByRole('button', { name: 'Remove spy' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-030-AC-03/04: Exclude Keywords filter field', () => {
  // FRONTEND-094-AC-05/06: Exclude Keywords is now a KeywordPicker
  // (allowFreeText, no hideInput) -- each keyword is typed and committed
  // with Enter individually, replacing the old single comma-separated
  // free-text value.
  it('populates excludeKeywords from individually typed keywords', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    const input = screen.getByLabelText('Exclude Keywords')
    fireEvent.change(input, { target: { value: 'Zombie' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: 'Heist' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    clickApplyFilters()

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ excludeKeywords: ['Zombie', 'Heist'] }),
    )
  })

  it('renders Exclude Keywords immediately adjacent to Exclude Genres', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    // FRONTEND-068-AC-04: Exclude Genres is now a GenreIncludeExcludePicker
    // trigger button, not a labeled text input.
    expect(
      screen.getByRole('button', { name: 'Exclude Genres' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/exclude keywords/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-030-AC-05: Reset Filters clears Exclude Keywords', () => {
  it('clears the field and omits excludeKeywords from the next query', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    const input = screen.getByLabelText('Exclude Keywords')
    fireEvent.change(input, { target: { value: 'Zombie' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Zombie')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('reset-filters-btn'))
    clickApplyFilters()

    expect(screen.queryByText('Zombie')).not.toBeInTheDocument()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ excludeKeywords: expect.anything() }),
    )
  })
})

describe('FRONTEND-030-AC-07/08: mode-aware Min Vote Count auto-fill', () => {
  it('pre-fills 200 when switching to Highest Rated, reverts to empty when switching away', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    selectHighestRated()
    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(200)

    selectUseMySeries()
    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(null)
  })
})

describe('FRONTEND-030-AC-09: a manually-edited Min Vote Count is never clobbered by a mode switch', () => {
  it('preserves a user-typed value across mode changes in either direction', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    selectHighestRated()
    fireEvent.change(screen.getByLabelText(/min vote count/i), {
      target: { value: '500' },
    })
    selectUseMySeries()

    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(500)
  })

  it('preserves a user-typed value when switching into Highest Rated too', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    fireEvent.change(screen.getByLabelText(/min vote count/i), {
      target: { value: '50' },
    })
    selectHighestRated()

    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(50)
  })
})

describe('FRONTEND-030-AC-10: Reset Filters clears minVoteCount and minVoteCountTouched', () => {
  it('clears a touched, manually-edited value and does not re-trigger the topRated auto-fill', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    selectHighestRated()
    fireEvent.change(screen.getByLabelText(/min vote count/i), {
      target: { value: '500' },
    })
    fireEvent.click(screen.getByTestId('reset-filters-btn'))
    clickApplyFilters()

    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(null)
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ minVoteCount: expect.anything() }),
    )
  })
})

describe('FRONTEND-030-AC-11/12: Sort By hidden under Popular Right Now', () => {
  it('renders Sort By under every mode except Popular Right Now', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    expect(screen.getByText(/^sort by$/i)).toBeInTheDocument()

    selectPopularRightNow()
    expect(screen.queryByText(/^sort by$/i)).not.toBeInTheDocument()

    selectHighestRated()
    expect(screen.getByText(/^sort by$/i)).toBeInTheDocument()
  })
})

// FRONTEND-033 supersedes FRONTEND-030-AC-13/14/15 and FRONTEND-031-AC-01/02:
// the "Vote Average"/"Most Recommended" relabel under Highest Rated and
// Genre & Keyword (two labels for one identical output) is replaced by four
// real, TMDB-backed sort options for those two modes only. See
// frontend_spec_033_discover_native_sort_controls.md.
describe('FRONTEND-033-AC-01: four TMDB-native sort options under Highest Rated and Genre & Keyword', () => {
  it('shows the four TMDB-native sort options under Highest Rated', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    selectHighestRated()

    for (const label of [
      /vote average/i,
      /most popular/i,
      /^newest$/i,
      /most voted/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.queryByLabelText(/^best match$/i)).not.toBeInTheDocument()
  })

  it('shows the same four options under Genre & Keyword', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    selectCustomSearch()

    for (const label of [
      /vote average/i,
      /most popular/i,
      /^newest$/i,
      /most voted/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.queryByLabelText(/^best match$/i)).not.toBeInTheDocument()
  })

  it('still renders the Sort By fieldset under Genre & Keyword', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    selectCustomSearch()
    expect(screen.getByText(/^sort by$/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-033-AC-02: Use My Series is unaffected', () => {
  it('continues to show exactly Best Match/Most Recommended', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    expect(screen.getByLabelText(/^best match$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/most recommended/i)).toBeInTheDocument()

    selectUseMySeries()
    expect(screen.getByLabelText(/^best match$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/most recommended/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-033-AC-03: correct per-mode default is selected', () => {
  it('Vote Average is the default under Highest Rated', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    selectHighestRated()
    expect(screen.getByLabelText(/vote average/i)).toBeChecked()
  })

  it('Most Popular is the default under Genre & Keyword', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    selectCustomSearch()
    expect(screen.getByLabelText(/most popular/i)).toBeChecked()
  })
})

describe('FRONTEND-033-AC-04: discoverSortBy omitted at the mode default, included otherwise', () => {
  it('omits discoverSortBy at the default, includes it once a non-default option is picked', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectHighestRated()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ discoverSortBy: expect.anything() }),
    )

    fireEvent.click(screen.getByLabelText(/most popular/i))
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ discoverSortBy: 'popularity.desc' }),
    )
  })

  it('omits discoverSortBy under Genre & Keyword at the default, includes it once changed', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectCustomSearch()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ discoverSortBy: expect.anything() }),
    )

    fireEvent.click(screen.getByLabelText(/^newest$/i))
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ discoverSortBy: 'first_air_date.desc' }),
    )
  })

  it('sends vote_average.desc/vote_count.desc for the remaining two options under Highest Rated', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectHighestRated()
    fireEvent.click(screen.getByLabelText(/most voted/i))
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ discoverSortBy: 'vote_count.desc' }),
    )

    fireEvent.click(screen.getByLabelText(/vote average/i))
    clickApplyFilters()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ discoverSortBy: expect.anything() }),
    )
  })
})

describe('FRONTEND-033-AC-05: switching modes never leaks discoverSortBy into an unrelated request', () => {
  it('clears discoverSortBy from the request when switching from Highest Rated to Automatic', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectHighestRated()
    fireEvent.click(screen.getByLabelText(/most voted/i))
    selectUseMySeries()

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ discoverSortBy: expect.anything() }),
    )
  })

  it('resets to the Genre & Keyword default when switching there from a non-default Highest Rated selection', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    selectHighestRated()
    fireEvent.click(screen.getByLabelText(/most voted/i))
    selectCustomSearch()

    expect(screen.getByLabelText(/most popular/i)).toBeChecked()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ discoverSortBy: expect.anything() }),
    )
  })
})

// FRONTEND-077-AC-05: the inline Series field no longer renders its own
// typing input (hideInput) -- this AC's typed-filtering behavior is
// now exercised inside the "Show all series" modal, which keeps its own
// full KeywordPicker.
describe('FRONTEND-035-AC-05: Specific Series mode renders a KeywordPicker', () => {
  it('builds one PickerOption per candidate series, offered as suggestions', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', status: 'COMPLETED', year: null }),
      makeSeries({
        id: '2',
        title: 'The Wire',
        status: 'WATCHING',
        year: null,
      }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(
      await screen.findByRole('button', { name: /show all series/i }),
    )
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByRole('textbox', { name: 'Series' })
    fireEvent.change(input, { target: { value: 'ozark' } })
    expect(
      within(dialog).getByRole('button', { name: 'Ozark - COMPLETED' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'The Wire - WATCHING' }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-035-AC-06: picking a suggestion populates seriesIds', () => {
  it('emits seriesIds in the built query after picking a series', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', status: 'COMPLETED', year: null }),
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    await pickSpecificSeries('Ozark - COMPLETED')
    clickApplyFilters()

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesIds: ['1'] }),
    )
  })
})

describe('FRONTEND-035-AC-07: selected series stay visible as chips through filter changes', () => {
  it('keeps the Ozark chip (with its correct label) after narrowing the genre filter away from it', async () => {
    mockGetGenreOptions.mockResolvedValue(['Crime', 'Comedy'])
    mockGetAll.mockResolvedValue([
      makeSeries({
        id: '1',
        title: 'Ozark',
        status: 'COMPLETED',
        genres: 'Crime, Drama',
        year: null,
      }),
      makeSeries({
        id: '2',
        title: 'Ted Lasso',
        status: 'COMPLETED',
        genres: 'Comedy',
        year: null,
      }),
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    await pickSpecificSeries('Ozark - COMPLETED')

    includeSpecificSeriesGenre('Comedy')
    clickApplyFilters()

    // Narrowed away from the genre-filtered candidate pool, but the chip
    // must still resolve its real label, not fall back to a raw UUID. A
    // custom matcher is needed since the chip's text is now split across
    // <strong>/<em> elements (bold title, italic status), not one flat
    // text node.
    expect(
      screen.getByText(
        (_, element) => element?.textContent === 'Ozark - COMPLETED',
      ),
    ).toBeInTheDocument()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesIds: ['1'] }),
    )
  })
})

// FRONTEND-077-AC-05: routed through the "Show all series" modal now that
// the inline field no longer renders its own typing input -- this
// necessarily overlaps with FRONTEND-050-AC-02 below, which already checks
// the same thing via the modal.
describe('FRONTEND-050-AC-01: excluded series are never offered in the Specific Series picker', () => {
  it('does not show an excluded series as a selectable suggestion', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Included Show', status: 'COMPLETED' }),
      makeSeries({
        id: '2',
        title: 'Excluded Show',
        status: 'COMPLETED',
        excludeFromRecommendations: true,
      }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(
      await screen.findByRole('button', { name: /show all series/i }),
    )
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('button', { name: /Included Show/ }),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: /Excluded Show/ }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-050-AC-02: excluded series are never offered in the browse-all modal', () => {
  it('omits an excluded series from the "Show all series" modal', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Included Show', status: 'COMPLETED' }),
      makeSeries({
        id: '2',
        title: 'Excluded Show',
        status: 'COMPLETED',
        excludeFromRecommendations: true,
      }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(
      await screen.findByRole('button', { name: /show all series/i }),
    )

    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('button', { name: /Included Show/ }),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: /Excluded Show/ }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-050-AC-03: an already-selected-then-excluded series still resolves its chip label', () => {
  it('keeps resolving a correct label for a selected id even once that series is excludeFromRecommendations=true', () => {
    // Direct unit test of the exported pool builder: RecommendationControls
    // has no prop to seed selectedSeriesIds pre-render (allSeries is fetched
    // once on mount, with no re-fetch path to exercise this through the DOM),
    // so this asserts the missingSelected union-back mechanism itself --
    // sourced from the unfiltered allSeries, not the new `selectable` list.
    const nowExcluded = makeSeries({
      id: '1',
      title: 'Now Excluded Show',
      status: 'COMPLETED',
      excludeFromRecommendations: true,
    })
    const pool = buildSpecificSeriesCandidatePool(
      [nowExcluded],
      makeSpecificSeriesFilters(),
      ['1'],
    )

    expect(pool).toHaveLength(1)
    expect(pool[0]).toBe(nowExcluded)
  })
})

describe('FRONTEND-035-AC-08: default suggestion list capped at SPECIFIC_SERIES_PICKER_LIMIT', () => {
  // FRONTEND-077-AC-05 (corrected 2026-09-03, live review): hideInput
  // suppresses only the inline field's typing input, not its suggestions --
  // the default (empty-input) suggestion list still renders inline, still
  // capped at SPECIFIC_SERIES_PICKER_LIMIT. The "Show all series" modal
  // remains uncapped, covered separately by FRONTEND-035-AC-09 below.
  it('renders inline suggestions capped at SPECIFIC_SERIES_PICKER_LIMIT, with no inline typing input', async () => {
    mockGetAll.mockResolvedValue(
      Array.from({ length: SPECIFIC_SERIES_PICKER_LIMIT + 5 }, (_, i) =>
        makeSeries({
          id: String(i),
          title: `Show ${String(i).padStart(2, '0')}`,
        }),
      ),
    )
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    await screen.findByRole('button', { name: /show all series/i })

    expect(
      screen.queryByRole('textbox', { name: 'Series' }),
    ).not.toBeInTheDocument()
    // Matches suggestion buttons ("Show 00 - COMPLETED"...) but not the
    // "Show all series" button, which also contains the substring "Show".
    const suggestions = screen
      .queryAllByRole('button')
      .filter((b) => /^Show \d/.test(b.textContent ?? ''))
    expect(suggestions).toHaveLength(SPECIFIC_SERIES_PICKER_LIMIT)
  })
})

describe('FRONTEND-035-AC-09: Show all series modal is uncapped and shares selection state', () => {
  it('opens a dialog with every series, without re-fetching', async () => {
    mockGetAll.mockResolvedValue(
      Array.from({ length: SPECIFIC_SERIES_PICKER_LIMIT + 5 }, (_, i) =>
        makeSeries({
          id: String(i),
          title: `Show ${String(i).padStart(2, '0')}`,
        }),
      ),
    )
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    await screen.findByRole('button', { name: /show all series/i })

    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))

    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog)
        .getAllByRole('button')
        .filter((b) => b.textContent?.includes('Show')),
    ).toHaveLength(SPECIFIC_SERIES_PICKER_LIMIT + 5)
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-035-AC-10: genre/status filters render but never appear in the emitted query', () => {
  it('renders filter controls without affecting the emitted RecommendationQuery', async () => {
    mockGetGenreOptions.mockResolvedValue(['Drama'])
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', genres: 'Drama' }),
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    await screen.findByRole('button', { name: 'Include / Exclude Genres' })
    includeSpecificSeriesGenre('Drama')
    fireEvent.click(screen.getByLabelText(/completed only/i))
    // FRONTEND-042: "Use My Series" is now active by default (no separate
    // mode-change click to trigger the auto-fetch this test relies on), so
    // Apply Filters is clicked explicitly to produce a query to inspect.
    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    const lastCall = onQueryChange.mock.calls.at(-1)![0]
    expect(lastCall).not.toHaveProperty('genres')
    expect(lastCall).not.toHaveProperty('status')
  })
})

describe('FRONTEND-035-AC-11: genre filter matches case-insensitively within the comma-separated field', () => {
  it('narrows the candidate pool to series with a matching genre', async () => {
    mockGetGenreOptions.mockResolvedValue(['Comedy'])
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ted Lasso', genres: 'comedy, Sport' }),
      makeSeries({ id: '2', title: 'Ozark', genres: 'Crime, Drama' }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    await screen.findByRole('button', { name: 'Include / Exclude Genres' })
    includeSpecificSeriesGenre('Comedy')

    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('button', { name: /Ted Lasso/ }),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: /Ozark/ }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-035-AC-12: status filter — Any / Completed Only / Completed or Watching', () => {
  it('"Completed or Watching" includes both statuses, excludes others', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', status: 'COMPLETED' }),
      makeSeries({ id: '2', title: 'The Wire', status: 'WATCHING' }),
      makeSeries({ id: '3', title: 'Firefly', status: 'DROPPED' }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(await screen.findByLabelText(/completed or watching/i))

    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('button', { name: /Ozark/ }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /The Wire/ }),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: /Firefly/ }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-035-AC-17: status suffix hidden unless "Any Status"', () => {
  it('hides the status suffix once the status filter narrows to one value', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', year: 2017, status: 'COMPLETED' }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(await screen.findByLabelText(/completed only/i))

    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('button', { name: 'Ozark (2017)' }),
    ).toBeInTheDocument()
    expect(within(dialog).queryByText(/COMPLETED/)).not.toBeInTheDocument()
  })

  it('shows the status suffix at Any Status (default)', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Ozark', year: 2017, status: 'COMPLETED' }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    fireEvent.click(
      await screen.findByRole('button', { name: /show all series/i }),
    )
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('button', { name: 'Ozark (2017) - COMPLETED' }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-035-AC-13: fixed pipeline order — filter then sort', () => {
  it('sorts within the genre-filtered pool, excluding the filtered-out series entirely', async () => {
    mockGetGenreOptions.mockResolvedValue(['Drama'])
    mockGetAll.mockResolvedValue([
      makeSeries({
        id: '1',
        title: 'B Show',
        genres: 'Drama',
        status: 'COMPLETED',
        year: null,
      }),
      makeSeries({
        id: '2',
        title: 'A Show',
        genres: 'Drama',
        status: 'COMPLETED',
        year: null,
      }),
      makeSeries({
        id: '3',
        title: 'Z Show',
        genres: 'Comedy',
        status: 'COMPLETED',
        year: null,
      }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    await screen.findByRole('button', { name: 'Include / Exclude Genres' })
    includeSpecificSeriesGenre('Drama')

    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    const dialog = screen.getByRole('dialog')
    const suggestionTexts = within(dialog)
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t) => t?.includes('Show'))
    expect(suggestionTexts).toEqual([
      'A Show - COMPLETED',
      'B Show - COMPLETED',
    ])
  })
})

describe('FRONTEND-035-AC-14/15: sort control reorders the picker client-side, defaults to title/asc', () => {
  it('orders the picker by title ascending by default, without re-fetching', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'B Show', year: null }),
      makeSeries({ id: '2', title: 'A Show', year: null }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    await screen.findByRole('button', { name: /show all series/i })

    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    const dialog = screen.getByRole('dialog')
    const order = within(dialog)
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t) => t?.includes('Show'))
    expect(order).toEqual(['A Show - COMPLETED', 'B Show - COMPLETED'])
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })

  it('reverses order when the direction toggle is clicked', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'B Show', year: null }),
      makeSeries({ id: '2', title: 'A Show', year: null }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    await screen.findByRole('button', { name: /show all series/i })

    fireEvent.click(screen.getByLabelText(/sort ascending/i))

    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    const dialog = screen.getByRole('dialog')
    const order = within(dialog)
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t) => t?.includes('Show'))
    expect(order).toEqual(['B Show - COMPLETED', 'A Show - COMPLETED'])
  })
})

describe('FRONTEND-035-AC-16: null sort values sort last regardless of direction', () => {
  it('places a null personalRating after a rated series', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({
        id: '1',
        title: 'No Rating',
        personalRating: null,
        year: null,
      }),
      makeSeries({ id: '2', title: 'Rated', personalRating: 4, year: null }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    await screen.findByRole('button', { name: /show all series/i })

    fireEvent.change(screen.getByLabelText(/sort by/i), {
      target: { value: 'personalRating' },
    })
    fireEvent.click(screen.getByRole('button', { name: /show all series/i }))
    const dialog = screen.getByRole('dialog')
    const order = within(dialog)
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t) => t?.includes('Rating') || t?.includes('Rated'))
    expect(order).toEqual(['Rated - COMPLETED', 'No Rating - COMPLETED'])
  })
})

// frontend_spec_040_recommendation_controls_apply_and_lock.md
describe('FRONTEND-040-AC-01: changing a filter updates local state but does not call onQueryChange', () => {
  it('does not call onQueryChange from a non-mode control change', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    onQueryChange.mockClear() // clear the initial mount call, if any

    fireEvent.click(screen.getByLabelText(/^most recommended/i)) // Sort By radio

    expect(onQueryChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^most recommended/i)).toBeChecked() // local state did update
  })
})

// ~~FRONTEND-040-AC-02~~ superseded by FRONTEND-062-AC-02/AC-03 (this test
// used to assert "calls onQueryChange immediately on a mode change" -- the
// exact behavior frontend_spec_062 reverses). Replaced below with the new
// contract: switching either tier of the tab widget updates pending state
// only and clears any previously-fetched query back to undefined, never
// firing a real built query on its own.
describe('FRONTEND-062-AC-02: switching the top-level tab does not call onQueryChange with a built query', () => {
  it('does not call onQueryChange with an object (only ever undefined) on a top-level tab change', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    onQueryChange.mockClear()

    selectCustomSearch()

    expect(onQueryChange).toHaveBeenCalledTimes(1)
    expect(onQueryChange.mock.calls[0][0]).toBeUndefined()
  })
})

// FRONTEND-042-AC-27's own tab labels apply here too: the Discover sub-tab
// for the former "trending" mode renders as "Popular Right Now", not
// "Trending" -- selectPopularRightNow() (this file's existing helper)
// exercises the same sub-tab change the spec's own illustrative sketch
// described by the old flat name.
describe('FRONTEND-062-AC-03: switching the Discover sub-tab does not call onQueryChange with a built query', () => {
  it('does not call onQueryChange with an object (only ever undefined) on a sub-tab change', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    selectDiscover()
    onQueryChange.mockClear()

    fireEvent.click(screen.getByRole('tab', { name: /popular right now/i }))

    expect(onQueryChange).toHaveBeenCalledTimes(1)
    expect(onQueryChange.mock.calls[0][0]).toBeUndefined()
  })
})

describe('FRONTEND-062-AC-04: switching either tab clears the previous query', () => {
  it('calls onQueryChange(undefined) after switching the top-level tab', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )
    onQueryChange.mockClear()

    selectDiscover()

    expect(onQueryChange).toHaveBeenCalledWith(undefined)
  })

  it('calls onQueryChange(undefined) after switching the Discover sub-tab', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    selectDiscover()
    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )
    onQueryChange.mockClear()

    fireEvent.click(screen.getByRole('tab', { name: /popular right now/i }))

    expect(onQueryChange).toHaveBeenCalledWith(undefined)
  })
})

describe('FRONTEND-040-AC-03: Apply Filters sends the current pending state', () => {
  it('sends the pending sortBy change only once Apply Filters is clicked', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    onQueryChange.mockClear()

    fireEvent.click(screen.getByLabelText(/^most recommended/i))
    expect(onQueryChange).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'recommendationCount' }),
    )
  })
})

describe('FRONTEND-040-AC-04: Reset updates local state without firing a request', () => {
  it('does not call onQueryChange on its own -- Apply Filters still required afterward', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    selectCustomSearch()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    ) // open the disclosure
    fireEvent.change(screen.getByLabelText(/^min tmdb rating$/i), {
      target: { value: '5' },
    })
    onQueryChange.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /^reset filters$/i }))

    expect(onQueryChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^min tmdb rating$/i)).toHaveValue(null)
  })
})

describe('FRONTEND-040-AC-07: the processing overlay tracks the loading prop', () => {
  it('renders the processing overlay while loading', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={true} />)

    expect(screen.getByText(/processing recommendations/i)).toBeInTheDocument()
  })

  it('renders no overlay while not loading', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    expect(
      screen.queryByText(/processing recommendations/i),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-040-AC-08: Recommendation Source and Apply Filters are disabled while loading', () => {
  it('disables the top-level source tabs and the Apply Filters button', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={true} />)

    expect(screen.getByRole('tab', { name: /use my series/i })).toBeDisabled()
    expect(screen.getByRole('tab', { name: /^discover$/i })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /get recommendations/i }),
    ).toBeDisabled()
  })
})

describe('FRONTEND-040-AC-09: a disabled control cannot fire onQueryChange', () => {
  it('does not call onQueryChange when a disabled Apply Filters button is clicked', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={true} />,
    )
    onQueryChange.mockClear()

    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).not.toHaveBeenCalled()
  })
})

// frontend_spec_042_recommendation_source_mode_reorganization.md
describe('FRONTEND-042-AC-02: the series picker is always visible under Use My Series', () => {
  it('renders the picker with nothing selected', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Show' })])
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    // FRONTEND-077-AC-05: hideInput replaces the inline field's
    // <label htmlFor> with a non-visual aria-label once its own input is gone.
    expect(await screen.findByLabelText(/^series$/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /show all series/i }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-042-AC-03: optional-narrowing hint text', () => {
  it('explains the picker is optional', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    expect(screen.getByText(/optional/i)).toBeInTheDocument()
  })
})

// FRONTEND-042-AC-15 (re-clicking the active tab is a no-op) means clicking
// "Use My Series" from the default render (already active) fires nothing --
// so unlike the spec's own illustrative sketch, this exercises the omission
// via a genuine mode change (Discover -> Use My Series), not a same-tab
// re-click. See this task's final report for why.
describe("FRONTEND-042-AC-04: empty selection behaves exactly like today's Automatic", () => {
  it('omits seriesIds when nothing is selected', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    selectDiscover()
    onQueryChange.mockClear()

    selectUseMySeries()

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.not.objectContaining({ seriesIds: expect.anything() }),
    )
  })
})

describe("FRONTEND-042-AC-05: a selection behaves exactly like today's Specific Series", () => {
  // FRONTEND-077-AC-05: routed through the "Show all series" modal now that
  // the inline field no longer renders its own input.
  it('sends seriesIds once a series is picked', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Show' })])
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    await pickSpecificSeries('Show (2017) - COMPLETED')
    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ seriesIds: ['1'] }),
    )
  })
})

describe('FRONTEND-042-AC-06: Discover replaces the three flat options', () => {
  it('renders a Discover tab, no separate top-level options for the three sub-modes', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    expect(screen.getByRole('tab', { name: /^discover$/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: /genre & keyword/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: /^popular right now$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: /^highest rated$/i }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-042-AC-07: Discover reveals its three sub-tabs', () => {
  it('shows the sub-tablist only once Discover is active', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    expect(
      screen.queryByRole('tab', { name: /custom search/i }),
    ).not.toBeInTheDocument()

    selectDiscover()

    expect(
      screen.getByRole('tab', { name: /custom search/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /popular right now/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /highest rated/i }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-042-AC-08: Custom Search behaves exactly like former Genre & Keyword', () => {
  it('renders a genre picker and a keyword picker, sends genres/keywords', async () => {
    mockGetGenreOptions.mockResolvedValue(['Comedy'])
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )

    selectCustomSearch()
    // FRONTEND-068-AC-02: Genres is now a GenreIncludeExcludePicker trigger
    // button, not a checkbox per genre -- open it, then toggle Comedy in
    // (awaited since genreOptions loads asynchronously).
    fireEvent.click(
      screen.getByRole('button', { name: 'Include / Exclude Genres' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Comedy: neutral' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ genres: ['Comedy'] }),
    )
  })
})

describe('FRONTEND-042-AC-09: Popular Right Now behavior is unaffected by the re-nesting', () => {
  it('shows the Trending Window toggle and sends sourceMode=trending', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )

    selectPopularRightNow()
    // FRONTEND-062: mode changes no longer auto-fetch -- Apply Filters must
    // be clicked explicitly to produce a built query to inspect.
    clickApplyFilters()

    expect(screen.getByLabelText(/^day$/i)).toBeInTheDocument()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sourceMode: 'trending',
        trendingWindow: 'week',
      }),
    )
  })
})

describe("FRONTEND-042-AC-10: Highest Rated's minVoteCount default survives the re-nesting", () => {
  it('pre-fills 200 entering Highest Rated, clears it leaving', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    selectHighestRated()
    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(200)

    selectUseMySeries()
    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(null)
  })
})

describe('FRONTEND-042-AC-11: discoverSortBy defaults survive the re-nesting', () => {
  it('resets to popularity.desc entering Custom Search from a non-default Highest Rated selection', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    selectHighestRated()
    fireEvent.click(screen.getByLabelText(/most voted/i))

    selectCustomSearch()

    expect(screen.getByLabelText(/most popular/i)).toBeChecked()
  })
})

describe('FRONTEND-042-AC-12: top-level selector uses the Tabs ARIA pattern', () => {
  it('marks the active tab via aria-selected', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    expect(
      screen.getByRole('tab', { name: /use my series/i, selected: true }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /^discover$/i, selected: false }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-042-AC-13: Discover sub-selector uses the Tabs ARIA pattern', () => {
  it('marks the active sub-tab via aria-selected', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    selectDiscover()

    expect(
      screen.getByRole('tab', { name: /custom search/i, selected: true }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /popular right now/i, selected: false }),
    ).toBeInTheDocument()
  })
})

// FRONTEND-062 (2026-09-01): this describe's title/premise ("mode changes
// still auto-fetch") is reversed by frontend_spec_062 -- a mode change no
// longer fetches anything, it only clears any previous query back to
// undefined (FRONTEND-062-AC-02/AC-04). The original bare
// `toHaveBeenCalled()` assertion happens to still pass either way (calling
// onQueryChange(undefined) is still "being called"), but is left updated
// here so the test actually pins the current contract rather than reading
// as if the old one still holds.
describe('FRONTEND-042-AC-14: mode changes clear the query (superseded by FRONTEND-062-AC-02/AC-04)', () => {
  it('calls onQueryChange(undefined), not a built query, on a top-level tab change', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    onQueryChange.mockClear()

    selectDiscover()

    expect(onQueryChange).toHaveBeenCalledWith(undefined)
  })
})

describe('FRONTEND-042-AC-15: re-clicking the active tab is a no-op', () => {
  it('does not re-fire onQueryChange for the already-active tab', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    onQueryChange.mockClear()

    selectUseMySeries()

    expect(onQueryChange).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-042-AC-16: all tabs disabled while loading', () => {
  it('disables both tiers of tabs', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={true} />)

    expect(screen.getByRole('tab', { name: /use my series/i })).toBeDisabled()
    expect(screen.getByRole('tab', { name: /^discover$/i })).toBeDisabled()
  })
})

describe('FRONTEND-046-AC-01: rating/year fields render in the Custom Search panel', () => {
  it('shows Min TMDB Rating and Year Min/Max under Custom Search', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    selectCustomSearch()

    const panel = screen.getByRole('tabpanel', { name: /custom search/i })
    expect(
      within(panel).getByLabelText(/^min tmdb rating$/i),
    ).toBeInTheDocument()
    expect(within(panel).getByLabelText(/^year min$/i)).toBeInTheDocument()
    expect(within(panel).getByLabelText(/^year max$/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-046-AC-02: Filters box omits these fields under Custom Search', () => {
  it('does not render the relocated fields inside Filters', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    selectCustomSearch()
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    const filtersBody = screen.getByTestId('filters-body')
    expect(
      within(filtersBody).queryByLabelText(/^min tmdb rating$/i),
    ).not.toBeInTheDocument()
    expect(
      within(filtersBody).queryByLabelText(/^year min$/i),
    ).not.toBeInTheDocument()
    expect(
      within(filtersBody).queryByLabelText(/^year max$/i),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-046-AC-03: other modes are unaffected', () => {
  it.each([
    ['Use My Series', () => {}],
    ['Popular Right Now', () => selectPopularRightNow()],
    ['Highest Rated', () => selectHighestRated()],
  ])('renders the fields inside Filters under %s', (_, selectMode) => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    selectMode()
    fireEvent.click(
      // FRONTEND-093-AC-02: Highest Rated defaults minVoteCount to '200'
      // (untouched), which makes the toggle's accessible name
      // "Recommendations Filters1" (count badge appended) -- drop the
      // trailing anchor so this still matches regardless of mode.
      screen.getByRole('button', { name: /^recommendations filters/i }),
    )

    expect(screen.getByLabelText(/^min tmdb rating$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^year min$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^year max$/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-046-AC-04: year semantics hint renders under Custom Search', () => {
  it('explains the episode-air-date year matching', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    selectCustomSearch()

    expect(screen.getByText(/episode air/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-046-AC-05: query output is unaffected by relocation', () => {
  it('sends minTmdbRating/yearMin/yearMax from the Custom Search panel location', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    selectCustomSearch()

    fireEvent.change(screen.getByLabelText(/^min tmdb rating$/i), {
      target: { value: '7.5' },
    })
    fireEvent.change(screen.getByLabelText(/^year min$/i), {
      target: { value: '2020' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ minTmdbRating: 7.5, yearMin: 2020 }),
    )
  })
})

describe('SERIES-031-AC-11/12 (frontend hint): rating/year inputs carry min/max bounds', () => {
  it('constrains Min TMDB Rating to 0-10 in both locations', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    expect(screen.getByLabelText(/^min tmdb rating$/i)).toHaveAttribute(
      'min',
      '0',
    )
    expect(screen.getByLabelText(/^min tmdb rating$/i)).toHaveAttribute(
      'max',
      '10',
    )

    selectCustomSearch()
    expect(screen.getByLabelText(/^min tmdb rating$/i)).toHaveAttribute(
      'min',
      '0',
    )
    expect(screen.getByLabelText(/^min tmdb rating$/i)).toHaveAttribute(
      'max',
      '10',
    )
  })

  it('constrains Year Min/Max to 1900-(current year + 1) in both locations', () => {
    const maxYear = String(new Date().getFullYear() + 1)
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    expect(screen.getByLabelText(/^year min$/i)).toHaveAttribute('min', '1900')
    expect(screen.getByLabelText(/^year min$/i)).toHaveAttribute('max', maxYear)
    expect(screen.getByLabelText(/^year max$/i)).toHaveAttribute('min', '1900')
    expect(screen.getByLabelText(/^year max$/i)).toHaveAttribute('max', maxYear)

    selectCustomSearch()
    expect(screen.getByLabelText(/^year min$/i)).toHaveAttribute('min', '1900')
    expect(screen.getByLabelText(/^year min$/i)).toHaveAttribute('max', maxYear)
    expect(screen.getByLabelText(/^year max$/i)).toHaveAttribute('min', '1900')
    expect(screen.getByLabelText(/^year max$/i)).toHaveAttribute('max', maxYear)
  })
})

describe('FRONTEND-049-AC-01: Use My Series sends sourceMode even with no selection', () => {
  it('includes sourceMode=useMySeries with nothing selected', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    onQueryChange.mockClear()

    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ sourceMode: 'useMySeries' }),
    )
  })
})

describe('FRONTEND-049-AC-02: sourceMode and seriesIds are both sent together', () => {
  // FRONTEND-077-AC-05: routed through the "Show all series" modal now that
  // the inline field no longer renders its own input.
  it('includes both when a series is selected', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Show' })])
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    await pickSpecificSeries('Show (2017) - COMPLETED')
    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ sourceMode: 'useMySeries', seriesIds: ['1'] }),
    )
  })
})

describe('FRONTEND-049-AC-03: Discover modes never send sourceMode=useMySeries', () => {
  it('omits sourceMode=useMySeries under Custom Search', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    selectDiscover()
    onQueryChange.mockClear()

    expect(onQueryChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceMode: 'useMySeries' }),
    )
  })
})

describe('FRONTEND-049-AC-04: an empty Custom Search request still fires', () => {
  it('calls onQueryChange with no blocking', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    selectCustomSearch()
    onQueryChange.mockClear()

    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenCalled()
  })
})

describe('FRONTEND-047-AC-04: Country picker renders under Custom Search', () => {
  it('shows the Country field with pinned US/GB', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /custom search/i }))

    const panel = screen.getByRole('tabpanel', { name: /custom search/i })
    expect(within(panel).getByLabelText(/countries/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-047-AC-05: Country picker relocates to Filters for other modes', () => {
  it('shows Country inside Filters under Use My Series', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    expect(screen.getByLabelText(/countries/i)).toBeInTheDocument()
  })

  it('does not render Country inside Custom Search panel while Custom Search is not active', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    selectCustomSearch()

    const filtersBody = screen.getByTestId('filters-body')
    expect(
      within(filtersBody).queryByLabelText(/countries/i),
    ).not.toBeInTheDocument()
    const panel = screen.getByRole('tabpanel', { name: /custom search/i })
    expect(within(panel).getByLabelText(/countries/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-047-AC-06: countries sent in the query', () => {
  it('includes selected countries on Apply Filters', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /^us$/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ countries: ['US'] }),
    )
  })

  it('omits countries from the query when nothing is selected', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ countries: expect.anything() }),
    )
  })
})

describe('FRONTEND-047-AC-07: country options are hardcoded, not tracked-data-derived', () => {
  it('offers a searchable country beyond the pinned two without fetching series data', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    fireEvent.change(screen.getByLabelText(/countries/i), {
      target: { value: 'japan' },
    })

    // Exact match ("^japan$"), not a loose /japan/i substring match --
    // Language's pinned "Japanese" quick-select (LANGUAGE_PINNED_CODES
    // includes 'ja') is always visible in the same Filters box regardless
    // of what's typed into Countries, and "japan" is a substring of
    // "Japanese" too, so a loose match here would find both buttons.
    expect(screen.getByRole('button', { name: /^japan$/i })).toBeInTheDocument()
  })
})

// Revised 2026-08-28 (frontend_spec_047, Requirement 3's revision note):
// Language now renders through KeywordPicker itself (single-select enforced
// by an adapter in RecommendationControls.tsx), the same proven
// chip-with-"x" UX Country already uses -- replacing the original bespoke
// LanguagePicker's permanently-visible pinned button + plain text input,
// which live testing found had no way to clear a selection back to empty.
describe('FRONTEND-047-AC-08: Language picker has pinned quick-select options', () => {
  it('renders English and Spanish quick-selects', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    expect(
      screen.getByRole('button', { name: /^english$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^spanish$/i }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-047-AC-09: selecting replaces, does not accumulate', () => {
  it('replaces the previous language selection', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    fireEvent.click(screen.getByRole('button', { name: /^english$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^french$/i }))

    // Deviates from this AC's original test sketch (a bare
    // getByText/queryByText on the plain label): once English is
    // deselected it reappears as a *pinned suggestion* button
    // (LANGUAGE_PINNED_CODES includes 'en'), so a bare text query for
    // "English" is ambiguous -- it's genuinely still on the page, just as a
    // suggestion rather than a chip. Querying each side's "Remove x"
    // control is unambiguous, since that only ever renders for a selected
    // chip.
    expect(
      screen.getByRole('button', { name: 'Remove fr' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Remove en' }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-047-AC-12: language selection can be cleared', () => {
  it("clears language back to empty via the chip's remove control", () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )

    fireEvent.click(screen.getByRole('button', { name: /^english$/i }))
    fireEvent.click(screen.getByRole('button', { name: /remove en$/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ language: expect.anything() }),
    )
  })
})

describe('FRONTEND-047-AC-10: Language picker relocates the same way as Country', () => {
  it('shows Language under the Custom Search panel', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    selectCustomSearch()

    const panel = screen.getByRole('tabpanel', { name: /custom search/i })
    expect(within(panel).getByLabelText(/language/i)).toBeInTheDocument()
  })

  it('does not render Language inside Filters while Custom Search is active', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    selectCustomSearch()

    const filtersBody = screen.getByTestId('filters-body')
    expect(
      within(filtersBody).queryByLabelText(/language/i),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-047-AC-11: query output for language is unaffected', () => {
  it('sends the same language value regardless of panel location', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /^english$/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
    )
  })

  it('sends the same language value from the Custom Search panel location', () => {
    const onQueryChange = vi.fn()
    render(
      <RecommendationControls onQueryChange={onQueryChange} loading={false} />,
    )
    selectCustomSearch()
    fireEvent.click(screen.getByRole('button', { name: /^english$/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /get recommendations/i }),
    )

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
    )
  })
})

describe('FRONTEND-047: Reset Filters clears countriesSelected', () => {
  it('clears the selected countries chip on reset', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(
      screen.getByRole('button', { name: /^recommendations filters$/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /^us$/i }))
    expect(
      screen.getByRole('button', { name: 'Remove US' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }))

    expect(
      screen.queryByRole('button', { name: 'Remove US' }),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-068-AC-01: excludeGenresSelected drives query.excludeGenres', () => {
  it('sends excludeGenres from the array field, no parsing', () => {
    const state = {
      ...initialState,
      excludeGenresSelected: ['Comedy', 'Horror'],
    }
    const query = buildQuery(state)
    expect(query.excludeGenres).toEqual(['Comedy', 'Horror'])
  })

  it('omits excludeGenres when the array is empty', () => {
    const query = buildQuery(initialState)
    expect(query.excludeGenres).toBeUndefined()
  })
})

describe('FRONTEND-094-AC-06: excludeKeywordsSelected reaches the query', () => {
  it('includes excludeKeywords in the built query', () => {
    const query = buildQuery({
      ...initialState,
      excludeKeywordsSelected: ['spoilers', 'reality tv'],
    })
    expect(query.excludeKeywords).toEqual(['spoilers', 'reality tv'])
  })
})

describe('FRONTEND-094-AC-11: valid Min Vote Count reaches the query', () => {
  it('includes a valid minVoteCount in the built query', () => {
    const query = buildQuery({ ...initialState, minVoteCount: '200' })
    expect(query.minVoteCount).toBe(200)
  })

  it('omits an invalid (negative) minVoteCount from the built query', () => {
    const query = buildQuery({ ...initialState, minVoteCount: '-5' })
    expect(query.minVoteCount).toBeUndefined()
  })
})

describe('FRONTEND-069-AC-01: excludeGenreFilter narrows the pool', () => {
  it('omits a series matching an excluded genre', () => {
    const series = [
      {
        id: '1',
        title: 'Funny Show',
        genres: 'Comedy',
        excludeFromRecommendations: false,
      },
      {
        id: '2',
        title: 'Serious Show',
        genres: 'Drama',
        excludeFromRecommendations: false,
      },
    ] as Series[]
    const pool = buildSpecificSeriesCandidatePool(
      series,
      makeSpecificSeriesFilters({ excludeGenreFilter: ['Comedy'] }),
      [],
    )
    expect(pool.map((s) => s.title)).toEqual(['Serious Show'])
  })
})

describe('FRONTEND-069-AC-02: a genre-less series is not excluded', () => {
  it('keeps a series with no genres regardless of excludeGenreFilter', () => {
    const series = [
      {
        id: '1',
        title: 'No Genre Show',
        genres: null,
        excludeFromRecommendations: false,
      },
    ] as Series[]
    const pool = buildSpecificSeriesCandidatePool(
      series,
      makeSpecificSeriesFilters({ excludeGenreFilter: ['Comedy'] }),
      [],
    )
    expect(pool.map((s) => s.title)).toEqual(['No Genre Show'])
  })
})

describe('FRONTEND-069-AC-03: empty excludeGenreFilter is a no-op', () => {
  it('returns every series unchanged when excludeGenreFilter is empty', () => {
    const series = [
      {
        id: '1',
        title: 'Show',
        genres: 'Comedy',
        excludeFromRecommendations: false,
      },
    ] as Series[]
    const pool = buildSpecificSeriesCandidatePool(
      series,
      makeSpecificSeriesFilters(),
      [],
    )
    expect(pool.map((s) => s.title)).toEqual(['Show'])
  })
})

// frontend_spec_051_specific_series_bulk_select.md
describe('FRONTEND-051-AC-01: Select all', () => {
  it('selects every series in the current candidate pool', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'A', status: 'COMPLETED' }),
      makeSeries({ id: '2', title: 'B', status: 'COMPLETED' }),
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    // FRONTEND-011-AC-03/FRONTEND-042: "Use My Series" (which hosts the
    // Specific Series picker) is already the default active tab -- no tab
    // click needed to reach it, unlike Discover sub-modes elsewhere in this
    // file.
    fireEvent.click(await screen.findByRole('button', { name: /select all/i }))
    clickApplyFilters()

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        seriesIds: expect.arrayContaining(['1', '2']),
      }),
    )
  })
})

describe('FRONTEND-051-AC-02: Clear all', () => {
  it('clears the entire selection', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'A', status: 'COMPLETED' }),
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    fireEvent.click(await screen.findByRole('button', { name: /select all/i }))
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    clickApplyFilters()

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.not.objectContaining({ seriesIds: expect.anything() }),
    )
  })
})

describe('FRONTEND-051-AC-03: disabled states', () => {
  it('disables Clear all when nothing is selected', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'A', status: 'COMPLETED' }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    expect(
      await screen.findByRole('button', { name: /clear all/i }),
    ).toBeDisabled()
  })

  it('disables Select all when the filtered pool is empty', async () => {
    // FRONTEND-051-AC-03: the spec's own snippet (click "completed or
    // watching" then "any status") leaves the status filter at "any", which
    // does NOT empty the pool here -- the tracked series would still match.
    // Using a genuinely non-matching status ('BACKLOG') plus the "Completed
    // Only" filter actually empties buildSpecificSeriesCandidatePool's
    // output, unlike the spec snippet's own combination.
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'A', status: 'BACKLOG' }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(await screen.findByLabelText(/^completed only/i))

    expect(screen.getByRole('button', { name: /select all/i })).toBeDisabled()
  })
})

describe('FRONTEND-051-AC-04: gated behind Apply Filters', () => {
  it('does not call onQueryChange until Apply Filters is clicked', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'A', status: 'COMPLETED' }),
    ])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)
    onQueryChange.mockClear() // clear the mount-time initial call, if any

    fireEvent.click(await screen.findByRole('button', { name: /select all/i }))
    expect(onQueryChange).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-081-AC-10: Sort filtered recs renders after Post TMDB filtering', () => {
  it('places the Sort By fieldset after the Filters disclosure in document order', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    const filtersToggle = screen.getByRole('button', {
      name: /recommendations filters/i,
    })
    const sortByLegend = screen.getByText('Sort By')

    expect(
      filtersToggle.compareDocumentPosition(sortByLegend) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('FRONTEND-084-AC-01: seriesPickerLabel shows the full year range', () => {
  it('shows a closed range for an ended multi-year show', () => {
    const series = makeSeries({
      title: 'Ended Show',
      year: 2015,
      lastAirYear: 2020,
      productionStatus: 'ENDED',
    })
    expect(seriesPickerLabel(series, 'any')).toContain('(2015-2020)')
  })

  it('shows an open-ended range for a still-running show', () => {
    const series = makeSeries({
      title: 'Running Show',
      year: 2022,
      lastAirYear: 2024,
      productionStatus: 'RETURNING_SERIES',
    })
    expect(seriesPickerLabel(series, 'any')).toContain('(2022-)')
  })

  it('shows a bare year when lastAirYear is unresolved', () => {
    const series = makeSeries({
      title: 'Unknown End',
      year: 2021,
      lastAirYear: null,
    })
    expect(seriesPickerLabel(series, 'any')).toContain('(2021)')
  })
})

describe('FRONTEND-084-AC-02: seriesPickerDisplay shows the full year range', () => {
  it('renders a closed range for an ended multi-year show', () => {
    const series = makeSeries({
      title: 'Ended Show',
      year: 2015,
      lastAirYear: 2020,
      productionStatus: 'ENDED',
    })
    render(<>{seriesPickerDisplay(series, 'any')}</>)
    expect(screen.getByText(/\(2015-2020\)/)).toBeInTheDocument()
  })
})

describe('FRONTEND-084-AC-03: no year portion when year is null', () => {
  it('omits the year parenthetical entirely', () => {
    const series = makeSeries({
      title: 'No Year',
      year: null,
      lastAirYear: null,
    })
    expect(seriesPickerLabel(series, 'any')).not.toContain('(')
  })
})

describe('FRONTEND-085-AC-07: RecommendationControls source-series display shows every origin country', () => {
  it('renders both countries for a multi-country source series in seriesPickerLabel', () => {
    const series = makeSeries({
      title: 'MobLand',
      originCountry: 'GB,US',
    })
    expect(seriesPickerLabel(series, 'any')).toContain(
      'United Kingdom, United States',
    )
  })

  it('renders both countries for a multi-country source series in seriesPickerDisplay', () => {
    const series = makeSeries({
      title: 'MobLand',
      originCountry: 'GB,US',
    })
    render(<>{seriesPickerDisplay(series, 'any')}</>)
    expect(
      screen.getByText(/United Kingdom, United States/),
    ).toBeInTheDocument()
  })
})
