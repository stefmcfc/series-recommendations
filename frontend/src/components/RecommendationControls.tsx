import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { RecommendationQuery, Series, SortOptions } from '../types/series'
import { KeywordPicker } from './KeywordPicker'
import type { PickerOption } from './KeywordPicker'
import {
  KEYWORD_SUGGESTIONS_LIMIT,
  SPECIFIC_SERIES_PICKER_LIMIT,
} from '../utils/keywordSuggestions'
import { formatCountryName } from '../utils/countryName'
import styles from './RecommendationControls.module.css'

type SourceMode = 'automatic' | 'specific' | 'genre' | 'trending' | 'topRated'
type SortByOption = 'score' | 'recommendationCount'
type TrendingWindow = 'day' | 'week'
// FRONTEND-035: picker-scoped filter/sort state for "Specific Series" mode --
// deliberately not part of ControlsState/RecommendationQuery, mirroring how
// filtersOpen/allSeries/genreOptions are already separate useState calls for
// the same reason (UI-local display concerns, never sent to the backend).
type SpecificSeriesStatusFilter =
  'any' | 'completedOnly' | 'completedOrWatching'
type SpecificSeriesSortBy = NonNullable<SortOptions['sortBy']>
type SpecificSeriesSortDirection = NonNullable<SortOptions['sortDirection']>
// FRONTEND-033-AC-01: real, TMDB-backed sort options for topRated/genre mode
// -- replaces the previous "Best Match"/"Vote Average" no-op pair for those
// two modes only. See frontend_spec_033_discover_native_sort_controls.md.
type DiscoverSortByOption =
  | 'vote_average.desc'
  | 'popularity.desc'
  | 'first_air_date.desc'
  | 'vote_count.desc'

interface RecommendationControlsProps {
  readonly onQueryChange: (query: RecommendationQuery) => void
  // FRONTEND-040-AC-06/07/08: broadcasts whether a recommendations request is
  // currently in flight (mirrored down from App.tsx's recommendationsLoading,
  // itself fed by RecommendationsList's onLoadingChange) so this panel can
  // lock itself while one is running. Optional/defaulted to false so every
  // pre-existing call site that doesn't pass it keeps working unchanged.
  readonly loading?: boolean
}

interface ControlsState {
  mode: SourceMode
  selectedSeriesIds: string[]
  genresSelected: string[]
  keywordsSelected: string[]
  trendingWindow: TrendingWindow
  minSourceRating: string
  minTmdbRating: string
  minVoteCount: string
  minVoteCountTouched: boolean
  yearMin: string
  yearMax: string
  excludeGenresText: string
  excludeKeywordsText: string
  language: string
  maxPerSource: string
  maxSourcesShown: string
  sortBy: SortByOption
  discoverSortBy: DiscoverSortByOption
}

// FRONTEND-033-AC-03: each mode's default matches its current implicit
// behavior exactly, so a user who never touches the control sees no
// behavior change from before this spec.
const DISCOVER_SORT_BY_DEFAULTS: Record<
  'topRated' | 'genre',
  DiscoverSortByOption
> = {
  topRated: 'vote_average.desc',
  genre: 'popularity.desc',
}

// FRONTEND-035-AC-14: field list/labels mirror SeriesList.tsx's own
// SORT_BY_OPTIONS -- only the field set and labels are reused here, the sort
// itself stays entirely client-side (buildSpecificSeriesCandidatePool below),
// unlike SeriesList's which is a request parameter.
const SPECIFIC_SERIES_SORT_BY_OPTIONS: {
  value: SpecificSeriesSortBy
  label: string
}[] = [
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'personalRating', label: 'Personal Rating' },
  { value: 'title', label: 'Title' },
  { value: 'year', label: 'Year' },
  { value: 'imdbRating', label: 'IMDb Rating' },
  { value: 'tmdbRating', label: 'TMDB Rating' },
]

const initialState: ControlsState = {
  mode: 'automatic',
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
  maxPerSource: '',
  maxSourcesShown: '',
  sortBy: 'score',
  discoverSortBy: DISCOVER_SORT_BY_DEFAULTS.topRated,
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '')
}

function applySourceModeQuery(
  state: ControlsState,
  query: RecommendationQuery,
): void {
  if (state.mode === 'specific' && state.selectedSeriesIds.length > 0) {
    query.seriesIds = state.selectedSeriesIds
  }

  if (state.mode === 'genre') {
    if (state.genresSelected.length > 0) query.genres = state.genresSelected
    if (state.keywordsSelected.length > 0)
      query.keywords = state.keywordsSelected
  }

  if (state.mode === 'trending') {
    query.sourceMode = 'trending'
    query.trendingWindow = state.trendingWindow
  }

  if (state.mode === 'topRated') {
    query.sourceMode = 'topRated'
  }

  // FRONTEND-033-AC-04: only sent when it differs from the current mode's
  // own default -- mirrors SeriesList.tsx's buildSortParam wire-minimization
  // convention (series_spec_009) so a client at the default behaves
  // identically to a pre-FRONTEND-033 client.
  if (state.mode === 'topRated' || state.mode === 'genre') {
    if (state.discoverSortBy !== DISCOVER_SORT_BY_DEFAULTS[state.mode]) {
      query.discoverSortBy = state.discoverSortBy
    }
  }
}

function applyRatingAndRangeFilters(
  state: ControlsState,
  query: RecommendationQuery,
): void {
  const hasSourcePool = state.mode === 'automatic' || state.mode === 'specific'
  if (hasSourcePool && state.minSourceRating.trim() !== '') {
    query.minSourceRating = Number(state.minSourceRating)
  }
  if (state.minTmdbRating.trim() !== '')
    query.minTmdbRating = Number(state.minTmdbRating)
  if (state.minVoteCount.trim() !== '')
    query.minVoteCount = Number(state.minVoteCount)
  if (state.yearMin.trim() !== '') query.yearMin = Number(state.yearMin)
  if (state.yearMax.trim() !== '') query.yearMax = Number(state.yearMax)
}

function applyExcludeAndMiscFilters(
  state: ControlsState,
  query: RecommendationQuery,
): void {
  const excludeGenres = parseCommaList(state.excludeGenresText)
  if (excludeGenres.length > 0) query.excludeGenres = excludeGenres

  const excludeKeywords = parseCommaList(state.excludeKeywordsText)
  if (excludeKeywords.length > 0) query.excludeKeywords = excludeKeywords

  if (state.language.trim() !== '') query.language = state.language.trim()
  if (state.maxPerSource.trim() !== '')
    query.maxPerSource = Number(state.maxPerSource)
  if (state.maxSourcesShown.trim() !== '')
    query.maxSourcesShown = Number(state.maxSourcesShown)
}

// Cosmetic pass (2026-08-27, no spec): title | (year) | country - status,
// pipe before country instead of an em dash, hyphen instead of brackets
// before status. `seriesPickerLabel` stays the plain-text source of truth
// for search matching/dedup/the picker's flattened accessible name;
// `seriesPickerDisplay` is the same content with bold title / italic status
// for visual rendering only (KeywordPicker's PickerOption.display).
function seriesPickerLabel(series: Series): string {
  const yearPart = series.year != null ? ` (${series.year})` : ''
  const countryPart =
    series.originCountry != null
      ? ` | ${formatCountryName(series.originCountry)}`
      : ''
  return `${series.title}${yearPart}${countryPart} - ${series.status}`
}

function seriesPickerDisplay(series: Series): ReactNode {
  const yearPart = series.year != null ? ` (${series.year})` : ''
  const countryPart =
    series.originCountry != null
      ? ` | ${formatCountryName(series.originCountry)}`
      : ''
  return (
    <>
      <strong>{series.title}</strong>
      {yearPart}
      {countryPart}
      {' - '}
      <em>{series.status}</em>
    </>
  )
}

// FRONTEND-035-AC-11: a series matches when at least one selected genre
// appears in its comma-separated genres field, case-insensitively, each
// segment trimmed. No genres selected means every series passes.
function filterSpecificSeriesByGenre(
  series: Series[],
  genreFilter: string[],
): Series[] {
  if (genreFilter.length === 0) return series
  const lowerFilter = new Set(genreFilter.map((genre) => genre.toLowerCase()))
  return series.filter((s) => {
    const seriesGenres =
      s.genres?.split(',').map((genre) => genre.trim().toLowerCase()) ?? []
    return seriesGenres.some((genre) => lowerFilter.has(genre))
  })
}

// FRONTEND-035-AC-12: three fixed options -- Any Status (default, everything
// passes), Completed Only, Completed or Watching.
function filterSpecificSeriesByStatus(
  series: Series[],
  statusFilter: SpecificSeriesStatusFilter,
): Series[] {
  if (statusFilter === 'completedOnly') {
    return series.filter((s) => s.status === 'COMPLETED')
  }
  if (statusFilter === 'completedOrWatching') {
    return series.filter(
      (s) => s.status === 'COMPLETED' || s.status === 'WATCHING',
    )
  }
  return series
}

function getSpecificSeriesSortValue(
  series: Series,
  sortBy: SpecificSeriesSortBy,
): string | number | null {
  switch (sortBy) {
    case 'dateAdded':
      return series.dateAdded
    case 'personalRating':
      return series.personalRating
    case 'title':
      return series.title
    case 'year':
      return series.year
    case 'imdbRating':
      return series.imdbRating
    case 'tmdbRating':
      return series.tmdbRating
    default:
      return null
  }
}

// FRONTEND-035-AC-16: null values for the selected sort field always sort
// last, regardless of ascending/descending -- matches
// series_spec_009_rating_sort.md's backend null-last convention, kept here
// for consistency even though this sort runs entirely client-side.
function compareSpecificSeries(
  a: Series,
  b: Series,
  sortBy: SpecificSeriesSortBy,
  direction: SpecificSeriesSortDirection,
): number {
  const aValue = getSpecificSeriesSortValue(a, sortBy)
  const bValue = getSpecificSeriesSortValue(b, sortBy)

  if (aValue == null && bValue == null) return 0
  if (aValue == null) return 1
  if (bValue == null) return -1

  const comparison =
    typeof aValue === 'string' && typeof bValue === 'string'
      ? aValue.localeCompare(bValue)
      : (aValue as number) - (bValue as number)

  return direction === 'asc' ? comparison : -comparison
}

// FRONTEND-035-AC-13: fixed pipeline order -- genre filter, then status
// filter, then client-side sort -- shared by both the inline picker and the
// browse-all modal, so what's offered (subject to KeywordPicker's own cap or
// typed-text search) is always computed identically.
//
// FRONTEND-035-AC-07: any already-selected series the genre/status filter
// narrows away is unioned back in *after* sorting, purely so KeywordPicker's
// chip-label lookup (which resolves a selected id against whatever `options`
// it was last given -- see KeywordPicker.tsx) can still find a correct
// label instead of falling back to rendering the raw id. This never affects
// what's offered as a *suggestion*: KeywordPicker already excludes anything
// in `selected` from its suggestion list.
function buildSpecificSeriesCandidatePool(
  allSeries: Series[],
  genreFilter: string[],
  statusFilter: SpecificSeriesStatusFilter,
  sortBy: SpecificSeriesSortBy,
  sortDirection: SpecificSeriesSortDirection,
  selectedSeriesIds: string[],
): Series[] {
  const filtered = filterSpecificSeriesByStatus(
    filterSpecificSeriesByGenre(allSeries, genreFilter),
    statusFilter,
  )
  const sorted = [...filtered].sort((a, b) =>
    compareSpecificSeries(a, b, sortBy, sortDirection),
  )

  const sortedIds = new Set(sorted.map((s) => s.id))
  const missingSelected = allSeries.filter(
    (s) => selectedSeriesIds.includes(s.id) && !sortedIds.has(s.id),
  )

  return [...sorted, ...missingSelected]
}

function buildQuery(state: ControlsState): RecommendationQuery {
  const query: RecommendationQuery = {}
  applySourceModeQuery(state, query)
  applyRatingAndRangeFilters(state, query)
  applyExcludeAndMiscFilters(state, query)
  if (state.sortBy === 'recommendationCount') query.sortBy = state.sortBy
  return query
}

export function RecommendationControls({
  onQueryChange,
  loading = false,
}: RecommendationControlsProps) {
  const [state, setState] = useState<ControlsState>(initialState)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [genreOptions, setGenreOptions] = useState<string[]>([])
  const [keywordOptions, setKeywordOptions] = useState<string[]>([])
  // FRONTEND-035: "Specific Series" picker-scoped filter/sort/modal state --
  // see the SpecificSeries* type comments above for why this is kept out of
  // ControlsState.
  const [specificSeriesGenreFilter, setSpecificSeriesGenreFilter] = useState<
    string[]
  >([])
  const [specificSeriesStatusFilter, setSpecificSeriesStatusFilter] =
    useState<SpecificSeriesStatusFilter>('any')
  const [specificSeriesSortBy, setSpecificSeriesSortBy] =
    useState<SpecificSeriesSortBy>('title')
  const [specificSeriesSortDirection, setSpecificSeriesSortDirection] =
    useState<SpecificSeriesSortDirection>('asc')
  const [specificSeriesBrowseModalOpen, setSpecificSeriesBrowseModalOpen] =
    useState(false)

  useEffect(() => {
    seriesApi
      .getAll()
      .then(setAllSeries)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    seriesApi
      .getGenreOptions()
      .then(setGenreOptions)
      .catch(() => undefined)
  }, [])

  // FRONTEND-032-AC-07/AC-08: offers tracked keywords as type-ahead
  // suggestions alongside free text. Unlike SearchFilter's stricter
  // fetch-failure handling (keywords are that field's only input method),
  // this field stays fully usable via free text on its own, so a failed
  // fetch degrades silently here -- no error banner, options just stay [].
  useEffect(() => {
    seriesApi
      .getKeywordStats()
      .then((stats) => setKeywordOptions(stats.map((stat) => stat.name)))
      .catch(() => undefined)
  }, [])

  // FRONTEND-040-AC-01: state-only update, no longer a choke point that
  // fires a backend request on every change -- every call site except
  // handleModeChange now funnels through this. Sending is deferred until
  // handleApplyFilters (the new "Apply Filters" button) runs.
  const updateState = (patch: Partial<ControlsState>) => {
    setState((prev) => ({ ...prev, ...patch }))
  }

  // FRONTEND-040-AC-02: the one control that keeps today's auto-fetch-on-
  // change behavior -- deliberately does not go through updateState, so it
  // keeps calling onQueryChange immediately, unchanged from before this spec.
  const handleModeChange = (mode: SourceMode) => {
    const patch: Partial<ControlsState> = {
      mode,
      selectedSeriesIds: [],
      genresSelected: [],
      keywordsSelected: [],
    }

    if (!state.minVoteCountTouched) {
      if (mode === 'topRated') {
        patch.minVoteCount = '200'
      } else if (state.mode === 'topRated') {
        patch.minVoteCount = ''
      }
    }

    // FRONTEND-033-AC-05: entering topRated/genre resets the sort selection
    // to that mode's own default, mirroring the minVoteCount mode-switch
    // reset pattern above -- never leaks a discoverSortBy value chosen under
    // one of these modes into the other, or into an unrelated mode's request
    // (buildQuery only ever reads it for topRated/genre in the first place).
    if (mode === 'topRated' || mode === 'genre') {
      patch.discoverSortBy = DISCOVER_SORT_BY_DEFAULTS[mode]
    }

    const next = { ...state, ...patch }
    setState(next)
    onQueryChange(buildQuery(next))
  }

  // FRONTEND-040-AC-03: sends whatever the current pending (possibly not-
  // yet-applied) state is at the moment of the click.
  const handleApplyFilters = () => {
    onQueryChange(buildQuery(state))
  }

  const handleSpecificSeriesSelectionChange = (next: string[]) => {
    updateState({ selectedSeriesIds: next })
  }

  const handleSpecificSeriesGenreFilterToggle =
    (genre: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked
      setSpecificSeriesGenreFilter((prev) =>
        checked ? [...prev, genre] : prev.filter((g) => g !== genre),
      )
    }

  const handleSpecificSeriesSortByChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setSpecificSeriesSortBy(event.target.value as SpecificSeriesSortBy)
  }

  const handleSpecificSeriesSortDirectionToggle = () => {
    setSpecificSeriesSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
  }

  const handleSpecificSeriesModalKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === 'Escape') {
      setSpecificSeriesBrowseModalOpen(false)
    }
  }

  const handleGenreToggle =
    (genre: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked
      updateState({
        genresSelected: checked
          ? [...state.genresSelected, genre]
          : state.genresSelected.filter((g) => g !== genre),
      })
    }

  const updateField =
    (field: keyof ControlsState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateState({ [field]: event.target.value } as Partial<ControlsState>)
    }

  const handleMinVoteCountChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    updateState({
      minVoteCount: event.target.value,
      minVoteCountTouched: true,
    })
  }

  const handleResetFilters = () => {
    updateState({
      minSourceRating: '',
      minTmdbRating: '',
      minVoteCount: '',
      minVoteCountTouched: false,
      yearMin: '',
      yearMax: '',
      excludeGenresText: '',
      excludeKeywordsText: '',
      language: '',
      maxPerSource: '',
      maxSourcesShown: '',
    })
  }

  const handleSortByChange = (sortBy: SortByOption) => {
    updateState({ sortBy })
  }

  const handleDiscoverSortByChange = (discoverSortBy: DiscoverSortByOption) => {
    updateState({ discoverSortBy })
  }

  const showGenreKeywordHint =
    state.mode === 'genre' &&
    state.genresSelected.length === 0 &&
    state.keywordsSelected.length === 0

  const showMinSourceRating =
    state.mode === 'automatic' || state.mode === 'specific'

  // FRONTEND-033-AC-01: topRated/genre get four real, TMDB-native options in
  // place of the legacy Best Match/Vote Average(-relabeled) pair.
  const showDiscoverSortByOptions =
    state.mode === 'topRated' || state.mode === 'genre'

  // FRONTEND-035-AC-05/13: computed once, shared by both the inline picker
  // and the "Show all series" modal.
  const specificSeriesCandidatePool = buildSpecificSeriesCandidatePool(
    allSeries,
    specificSeriesGenreFilter,
    specificSeriesStatusFilter,
    specificSeriesSortBy,
    specificSeriesSortDirection,
    state.selectedSeriesIds,
  )
  const specificSeriesOptions: PickerOption[] = specificSeriesCandidatePool.map(
    (s) => ({
      id: s.id,
      label: seriesPickerLabel(s),
      display: seriesPickerDisplay(s),
    }),
  )

  return (
    <>
      <div className={styles.container}>
        <fieldset className={styles.modeFieldset}>
          <legend>Recommendation Source</legend>

          <div className={styles.modeOption}>
            <input
              id="source-mode-automatic"
              type="radio"
              name="source-mode"
              checked={state.mode === 'automatic'}
              onChange={() => handleModeChange('automatic')}
              disabled={loading}
            />
            <label htmlFor="source-mode-automatic">Automatic</label>
          </div>

          <div className={styles.modeOption}>
            <input
              id="source-mode-specific"
              type="radio"
              name="source-mode"
              checked={state.mode === 'specific'}
              onChange={() => handleModeChange('specific')}
              disabled={loading}
            />
            <label htmlFor="source-mode-specific">Specific Series</label>
          </div>

          <div className={styles.modeOption}>
            <input
              id="source-mode-genre"
              type="radio"
              name="source-mode"
              checked={state.mode === 'genre'}
              onChange={() => handleModeChange('genre')}
              disabled={loading}
            />
            <label htmlFor="source-mode-genre">Genre &amp; Keyword</label>
          </div>

          <div className={styles.modeOption}>
            <input
              id="source-mode-trending"
              type="radio"
              name="source-mode"
              checked={state.mode === 'trending'}
              onChange={() => handleModeChange('trending')}
              disabled={loading}
            />
            <label htmlFor="source-mode-trending">Popular Right Now</label>
          </div>

          <div className={styles.modeOption}>
            <input
              id="source-mode-top-rated"
              type="radio"
              name="source-mode"
              checked={state.mode === 'topRated'}
              onChange={() => handleModeChange('topRated')}
              disabled={loading}
            />
            <label htmlFor="source-mode-top-rated">Highest Rated</label>
          </div>
        </fieldset>

        {state.mode === 'trending' && (
          <fieldset className={styles.modeFieldset}>
            <legend>Trending Window</legend>

            <div className={styles.modeOption}>
              <input
                id="trending-window-day"
                type="radio"
                name="trending-window"
                checked={state.trendingWindow === 'day'}
                onChange={() => updateState({ trendingWindow: 'day' })}
              />
              <label htmlFor="trending-window-day">Day</label>
            </div>

            <div className={styles.modeOption}>
              <input
                id="trending-window-week"
                type="radio"
                name="trending-window"
                checked={state.trendingWindow === 'week'}
                onChange={() => updateState({ trendingWindow: 'week' })}
              />
              <label htmlFor="trending-window-week">Week</label>
            </div>
          </fieldset>
        )}

        {state.mode !== 'trending' && (
          <fieldset className={styles.sortByFieldset}>
            <legend>Sort By</legend>

            {showDiscoverSortByOptions ? (
              <>
                <div className={styles.modeOption}>
                  <input
                    id="sort-by-vote-average"
                    type="radio"
                    name="sort-by"
                    checked={state.discoverSortBy === 'vote_average.desc'}
                    onChange={() =>
                      handleDiscoverSortByChange('vote_average.desc')
                    }
                  />
                  <label htmlFor="sort-by-vote-average">Vote Average</label>
                </div>

                <div className={styles.modeOption}>
                  <input
                    id="sort-by-most-popular"
                    type="radio"
                    name="sort-by"
                    checked={state.discoverSortBy === 'popularity.desc'}
                    onChange={() =>
                      handleDiscoverSortByChange('popularity.desc')
                    }
                  />
                  <label htmlFor="sort-by-most-popular">Most Popular</label>
                </div>

                <div className={styles.modeOption}>
                  <input
                    id="sort-by-newest"
                    type="radio"
                    name="sort-by"
                    checked={state.discoverSortBy === 'first_air_date.desc'}
                    onChange={() =>
                      handleDiscoverSortByChange('first_air_date.desc')
                    }
                  />
                  <label htmlFor="sort-by-newest">Newest</label>
                </div>

                <div className={styles.modeOption}>
                  <input
                    id="sort-by-most-voted"
                    type="radio"
                    name="sort-by"
                    checked={state.discoverSortBy === 'vote_count.desc'}
                    onChange={() =>
                      handleDiscoverSortByChange('vote_count.desc')
                    }
                  />
                  <label htmlFor="sort-by-most-voted">Most Voted</label>
                </div>
              </>
            ) : (
              <>
                <div className={styles.modeOption}>
                  <input
                    id="sort-by-score"
                    type="radio"
                    name="sort-by"
                    checked={state.sortBy === 'score'}
                    onChange={() => handleSortByChange('score')}
                  />
                  <label htmlFor="sort-by-score">Best Match</label>
                </div>

                <div className={styles.modeOption}>
                  <input
                    id="sort-by-recommendation-count"
                    type="radio"
                    name="sort-by"
                    checked={state.sortBy === 'recommendationCount'}
                    onChange={() => handleSortByChange('recommendationCount')}
                  />
                  <label htmlFor="sort-by-recommendation-count">
                    Most Recommended
                  </label>
                </div>
              </>
            )}
          </fieldset>
        )}

        {state.mode === 'specific' && (
          <div className={styles.specificSeriesSection}>
            {allSeries.length === 0 ? (
              <p className={styles.hint}>No series to choose from yet.</p>
            ) : (
              <>
                {/* Layout-only, no spec (2026-08-27): Filter by Genre's scrollable box left a lot of empty width next to it, so Status + Sort now share that row as a second column -- temporary until this section is revisited for a sheet/modal-based filter UI. */}
                <div className={styles.specificSeriesFiltersRow}>
                  {genreOptions.length > 0 && (
                    <fieldset className={styles.modeFieldset}>
                      <legend>Filter by Genre</legend>
                      <div className={styles.seriesPicker}>
                        {genreOptions.map((genre) => (
                          <div key={genre} className={styles.seriesOption}>
                            <input
                              id={`specific-series-genre-filter-${genre}`}
                              type="checkbox"
                              checked={specificSeriesGenreFilter.includes(
                                genre,
                              )}
                              onChange={handleSpecificSeriesGenreFilterToggle(
                                genre,
                              )}
                            />
                            <label
                              htmlFor={`specific-series-genre-filter-${genre}`}
                            >
                              {genre}
                            </label>
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  )}

                  <div className={styles.specificSeriesRightColumn}>
                    <fieldset className={styles.modeFieldset}>
                      <legend>Filter by Status</legend>

                      <div className={styles.modeOption}>
                        <input
                          id="specific-series-status-any"
                          type="radio"
                          name="specific-series-status"
                          checked={specificSeriesStatusFilter === 'any'}
                          onChange={() => setSpecificSeriesStatusFilter('any')}
                        />
                        <label htmlFor="specific-series-status-any">
                          Any Status
                        </label>
                      </div>

                      <div className={styles.modeOption}>
                        <input
                          id="specific-series-status-completed-only"
                          type="radio"
                          name="specific-series-status"
                          checked={
                            specificSeriesStatusFilter === 'completedOnly'
                          }
                          onChange={() =>
                            setSpecificSeriesStatusFilter('completedOnly')
                          }
                        />
                        <label htmlFor="specific-series-status-completed-only">
                          Completed Only
                        </label>
                      </div>

                      <div className={styles.modeOption}>
                        <input
                          id="specific-series-status-completed-or-watching"
                          type="radio"
                          name="specific-series-status"
                          checked={
                            specificSeriesStatusFilter === 'completedOrWatching'
                          }
                          onChange={() =>
                            setSpecificSeriesStatusFilter('completedOrWatching')
                          }
                        />
                        <label htmlFor="specific-series-status-completed-or-watching">
                          Completed or Watching
                        </label>
                      </div>
                    </fieldset>

                    <div className={styles.sortControl}>
                      <label htmlFor="specific-series-sort-by">Sort by</label>
                      <select
                        id="specific-series-sort-by"
                        value={specificSeriesSortBy}
                        onChange={handleSpecificSeriesSortByChange}
                      >
                        {SPECIFIC_SERIES_SORT_BY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={styles.sortDirectionButton}
                        aria-label={
                          specificSeriesSortDirection === 'asc'
                            ? 'Sort ascending'
                            : 'Sort descending'
                        }
                        onClick={handleSpecificSeriesSortDirectionToggle}
                      >
                        {specificSeriesSortDirection === 'asc' ? '↑' : '↓'}
                      </button>
                    </div>
                  </div>
                </div>

                <KeywordPicker
                  id="specific-series-picker"
                  label="Series"
                  selected={state.selectedSeriesIds}
                  onChange={handleSpecificSeriesSelectionChange}
                  options={specificSeriesOptions}
                  placeholder="Type to search your series"
                  maxSuggestionsWhenEmpty={SPECIFIC_SERIES_PICKER_LIMIT}
                />

                <button
                  type="button"
                  className={styles.browseSeriesButton}
                  onClick={() => setSpecificSeriesBrowseModalOpen(true)}
                >
                  Show all series
                </button>
              </>
            )}
          </div>
        )}

        {state.mode === 'genre' && (
          <div className={styles.genreKeywordFields}>
            <div className={styles.field}>
              <span>Genres</span>
              <div className={styles.seriesPicker}>
                {genreOptions.length === 0 ? (
                  <p className={styles.hint}>No genres to choose from yet.</p>
                ) : (
                  genreOptions.map((genre) => (
                    <div key={genre} className={styles.seriesOption}>
                      <input
                        id={`genre-checkbox-${genre}`}
                        type="checkbox"
                        checked={state.genresSelected.includes(genre)}
                        onChange={handleGenreToggle(genre)}
                      />
                      <label htmlFor={`genre-checkbox-${genre}`}>{genre}</label>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className={styles.field}>
              <KeywordPicker
                id="recommendation-keywords"
                label="Keywords"
                selected={state.keywordsSelected}
                onChange={(next) => updateState({ keywordsSelected: next })}
                placeholder="Type a keyword and press Enter"
                options={keywordOptions}
                allowFreeText
                maxSuggestionsWhenEmpty={KEYWORD_SUGGESTIONS_LIMIT}
              />
            </div>
            {showGenreKeywordHint && (
              <p className={styles.hint}>
                Enter at least one genre or keyword; otherwise this falls back
                to automatic recommendations.
              </p>
            )}
          </div>
        )}

        <div className={styles.filtersSection}>
          <button
            type="button"
            className={styles.filtersToggle}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filters
          </button>

          {filtersOpen && (
            <div className={styles.filtersBody}>
              {showMinSourceRating && (
                <div className={styles.field}>
                  <label htmlFor="recommendation-min-source-rating">
                    Min Source Rating
                  </label>
                  <select
                    id="recommendation-min-source-rating"
                    value={state.minSourceRating}
                    onChange={updateField('minSourceRating')}
                  >
                    <option value="">Any</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </div>
              )}

              <div className={styles.field}>
                <label htmlFor="recommendation-min-tmdb-rating">
                  Min TMDB Rating
                </label>
                <input
                  id="recommendation-min-tmdb-rating"
                  type="number"
                  step="0.1"
                  value={state.minTmdbRating}
                  onChange={updateField('minTmdbRating')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="recommendation-min-vote-count">
                  Min Vote Count
                </label>
                <input
                  id="recommendation-min-vote-count"
                  type="number"
                  value={state.minVoteCount}
                  onChange={handleMinVoteCountChange}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="recommendation-year-min">Year Min</label>
                <input
                  id="recommendation-year-min"
                  type="number"
                  value={state.yearMin}
                  onChange={updateField('yearMin')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="recommendation-year-max">Year Max</label>
                <input
                  id="recommendation-year-max"
                  type="number"
                  value={state.yearMax}
                  onChange={updateField('yearMax')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="recommendation-exclude-genres">
                  Exclude Genres
                </label>
                <input
                  id="recommendation-exclude-genres"
                  type="text"
                  value={state.excludeGenresText}
                  onChange={updateField('excludeGenresText')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="recommendation-exclude-keywords">
                  Exclude Keywords
                </label>
                <input
                  id="recommendation-exclude-keywords"
                  type="text"
                  value={state.excludeKeywordsText}
                  onChange={updateField('excludeKeywordsText')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="recommendation-language">Language</label>
                <input
                  id="recommendation-language"
                  type="text"
                  value={state.language}
                  onChange={updateField('language')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="recommendation-max-per-source">
                  Max Per Source
                </label>
                <input
                  id="recommendation-max-per-source"
                  type="number"
                  value={state.maxPerSource}
                  onChange={updateField('maxPerSource')}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="recommendation-max-sources-shown">
                  Max Sources Shown
                </label>
                <input
                  id="recommendation-max-sources-shown"
                  type="number"
                  value={state.maxSourcesShown}
                  onChange={updateField('maxSourcesShown')}
                />
              </div>

              <div className={styles.filtersActions}>
                <button
                  type="button"
                  className={styles.resetButton}
                  data-testid="reset-filters-btn"
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FRONTEND-040-AC-03: the single explicit "Apply Filters" action --
            every other control above now only updates local (pending) state;
            nothing reaches the backend until this is clicked. Placed after
            the Filters disclosure section, mirroring AddSeriesForm/
            EditSeriesForm's submit-button-at-the-end convention. */}
        <button
          type="button"
          className={styles.applyButton}
          onClick={handleApplyFilters}
          disabled={loading}
        >
          Apply Filters
        </button>

        {/* FRONTEND-040-AC-07/08: a second, independent loading indicator
            from RecommendationsList's own "Loading recommendations..." state
            -- this one locks the controls panel itself while any request
            (mode-triggered or Apply-triggered) is in flight. Reuses the same
            spinner SVG/<output> markup RecommendationsList's loading state
            already renders (RecommendationsList.tsx), not a new design. */}
        {loading && (
          <output className={styles.processingOverlay} aria-label="Loading">
            <svg
              className={styles.spinner}
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeOpacity="0.25"
              />
              <path
                d="M22 12a10 10 0 0 0-10-10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <span>Processing recommendations…</span>
          </output>
        )}
      </div>

      {specificSeriesBrowseModalOpen && (
        <div className={styles.overlay}>
          {/* A native <dialog> needs showModal()/close() lifecycle management (focus trap, native backdrop) to behave correctly, not just a tag swap -- deliberately not converted here, mirroring SearchFilter.tsx's "Browse all keywords" modal (jsdom's <dialog> support has known gaps). */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior, matching SearchFilter.tsx's "Browse all keywords" modal; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
          <div // NOSONAR: typescript:S6819, see comment above
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="browse-series-heading"
            onKeyDown={handleSpecificSeriesModalKeyDown}
          >
            <h2 id="browse-series-heading" className={styles.dialogHeading}>
              Browse Series
            </h2>

            <KeywordPicker
              id="browse-series"
              label="Series"
              selected={state.selectedSeriesIds}
              onChange={handleSpecificSeriesSelectionChange}
              options={specificSeriesOptions}
              placeholder="Type to search your series"
              focusOnMount
            />

            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.doneButton}
                onClick={() => setSpecificSeriesBrowseModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
