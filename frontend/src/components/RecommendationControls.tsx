import { useState, useEffect } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { RecommendationQuery, Series } from '../types/series'
import { KeywordPicker } from './KeywordPicker'
import { KEYWORD_SUGGESTIONS_LIMIT } from '../utils/keywordSuggestions'
import styles from './RecommendationControls.module.css'

type SourceMode = 'automatic' | 'specific' | 'genre' | 'trending' | 'topRated'
type SortByOption = 'score' | 'recommendationCount'
type TrendingWindow = 'day' | 'week'
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
}: RecommendationControlsProps) {
  const [state, setState] = useState<ControlsState>(initialState)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [genreOptions, setGenreOptions] = useState<string[]>([])
  const [keywordOptions, setKeywordOptions] = useState<string[]>([])

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

  const updateState = (patch: Partial<ControlsState>) => {
    const next = { ...state, ...patch }
    setState(next)
    onQueryChange(buildQuery(next))
  }

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

    updateState(patch)
  }

  const handleSeriesToggle =
    (id: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked
      updateState({
        selectedSeriesIds: checked
          ? [...state.selectedSeriesIds, id]
          : state.selectedSeriesIds.filter((seriesId) => seriesId !== id),
      })
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

  return (
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
                  onChange={() => handleDiscoverSortByChange('popularity.desc')}
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
                  onChange={() => handleDiscoverSortByChange('vote_count.desc')}
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
        <div className={styles.seriesPicker}>
          {allSeries.length === 0 ? (
            <p className={styles.hint}>No series to choose from yet.</p>
          ) : (
            allSeries.map((s) => (
              <div key={s.id} className={styles.seriesOption}>
                <input
                  id={`series-checkbox-${s.id}`}
                  type="checkbox"
                  checked={state.selectedSeriesIds.includes(s.id)}
                  onChange={handleSeriesToggle(s.id)}
                />
                <label htmlFor={`series-checkbox-${s.id}`}>
                  {s.title} ({s.status})
                </label>
              </div>
            ))
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
              Enter at least one genre or keyword; otherwise this falls back to
              automatic recommendations.
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
    </div>
  )
}
