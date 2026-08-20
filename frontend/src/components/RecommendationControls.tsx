import { useState, useEffect } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { RecommendationQuery, Series } from '../types/series'
import styles from './RecommendationControls.module.css'

type SourceMode = 'automatic' | 'specific' | 'genre'

interface RecommendationControlsProps {
  onQueryChange: (query: RecommendationQuery) => void
}

interface ControlsState {
  mode: SourceMode
  selectedSeriesIds: string[]
  genresSelected: string[]
  keywordsText: string
  minSourceRating: string
  minTmdbRating: string
  minVoteCount: string
  yearMin: string
  yearMax: string
  excludeGenresText: string
  language: string
  maxPerSource: string
}

const initialState: ControlsState = {
  mode: 'automatic',
  selectedSeriesIds: [],
  genresSelected: [],
  keywordsText: '',
  minSourceRating: '',
  minTmdbRating: '',
  minVoteCount: '',
  yearMin: '',
  yearMax: '',
  excludeGenresText: '',
  language: '',
  maxPerSource: '',
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '')
}

function buildQuery(state: ControlsState): RecommendationQuery {
  const query: RecommendationQuery = {}

  if (state.mode === 'specific' && state.selectedSeriesIds.length > 0) {
    query.seriesIds = state.selectedSeriesIds
  }

  if (state.mode === 'genre') {
    const keywords = parseCommaList(state.keywordsText)
    if (state.genresSelected.length > 0) query.genres = state.genresSelected
    if (keywords.length > 0) query.keywords = keywords
  }

  if (state.mode !== 'genre' && state.minSourceRating.trim() !== '') {
    query.minSourceRating = Number(state.minSourceRating)
  }
  if (state.minTmdbRating.trim() !== '')
    query.minTmdbRating = Number(state.minTmdbRating)
  if (state.minVoteCount.trim() !== '')
    query.minVoteCount = Number(state.minVoteCount)
  if (state.yearMin.trim() !== '') query.yearMin = Number(state.yearMin)
  if (state.yearMax.trim() !== '') query.yearMax = Number(state.yearMax)

  const excludeGenres = parseCommaList(state.excludeGenresText)
  if (excludeGenres.length > 0) query.excludeGenres = excludeGenres

  if (state.language.trim() !== '') query.language = state.language.trim()
  if (state.maxPerSource.trim() !== '')
    query.maxPerSource = Number(state.maxPerSource)

  return query
}

export function RecommendationControls({
  onQueryChange,
}: RecommendationControlsProps) {
  const [state, setState] = useState<ControlsState>(initialState)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [genreOptions, setGenreOptions] = useState<string[]>([])

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

  const updateState = (patch: Partial<ControlsState>) => {
    const next = { ...state, ...patch }
    setState(next)
    onQueryChange(buildQuery(next))
  }

  const handleModeChange = (mode: SourceMode) => {
    updateState({
      mode,
      selectedSeriesIds: [],
      genresSelected: [],
      keywordsText: '',
    })
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

  const handleResetFilters = () => {
    updateState({
      minSourceRating: '',
      minTmdbRating: '',
      minVoteCount: '',
      yearMin: '',
      yearMax: '',
      excludeGenresText: '',
      language: '',
      maxPerSource: '',
    })
  }

  const showGenreKeywordHint =
    state.mode === 'genre' &&
    state.genresSelected.length === 0 &&
    parseCommaList(state.keywordsText).length === 0

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
      </fieldset>

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
            <label htmlFor="recommendation-keywords">Keywords</label>
            <input
              id="recommendation-keywords"
              type="text"
              value={state.keywordsText}
              onChange={updateField('keywordsText')}
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
            {state.mode !== 'genre' && (
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
                onChange={updateField('minVoteCount')}
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
