import { KeywordPicker } from './KeywordPicker'
import { KEYWORD_SUGGESTIONS_LIMIT } from '../utils/keywordSuggestions'
import { COUNTRY_OPTIONS } from '../utils/countryOptions'
import { MIN_VALID_YEAR, MAX_VALID_YEAR } from '../utils/yearBounds'
import {
  COUNTRY_PINNED_OPTIONS,
  LANGUAGE_OPTIONS,
  LANGUAGE_PINNED_CODES,
} from './RecommendationControls'
import type { ControlsState } from './RecommendationControls'
import { GenreIncludeExcludePicker } from './GenreIncludeExcludePicker'
import styles from './RecommendationControls.module.css'

interface CustomSearchPanelProps {
  readonly state: ControlsState
  readonly updateState: (patch: Partial<ControlsState>) => void
  readonly genreOptions: string[]
  readonly keywordOptions: string[]
}

// TOOLING-008-AC-03: Custom Search's Genres/Keywords/Min TMDB Rating/Year
// Min/Year Max/Countries/Language fields, extracted from
// RecommendationControls.tsx's former `state.discoverMode === 'customSearch'`
// tabpanel block.
export function CustomSearchPanel({
  state,
  updateState,
  genreOptions,
  keywordOptions,
}: CustomSearchPanelProps) {
  const showGenreKeywordHint =
    state.genresSelected.length === 0 && state.keywordsSelected.length === 0

  const updateField =
    (field: keyof ControlsState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateState({ [field]: event.target.value } as Partial<ControlsState>)
    }

  return (
    <div
      role="tabpanel"
      id="discover-panel-custom-search"
      aria-labelledby="discover-tab-custom-search"
      className={styles.tabPanel}
    >
      <div className={styles.genreKeywordFields}>
        {/* FRONTEND-068-AC-02: combined include/exclude Genres picker,
            replacing the former include-only checkbox fieldset -- one
            control now covers both `genres` and `excludeGenres`, mutual
            exclusivity guaranteed by GenreIncludeExcludePicker itself
            (frontend_spec_067). */}
        <div className={styles.field}>
          <GenreIncludeExcludePicker
            idPrefix="custom-search-genre"
            label="Genres"
            genreOptions={genreOptions}
            included={state.genresSelected}
            excluded={state.excludeGenresSelected}
            onChange={({ included, excluded }) =>
              updateState({
                genresSelected: included,
                excludeGenresSelected: excluded,
              })
            }
          />
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
            Leave empty to browse the most popular shows overall.
          </p>
        )}
      </div>

      {/* FRONTEND-046-AC-01: relocated out of the shared Filters box while
          Custom Search is active -- series_spec_031 makes these three
          fields real TMDB discover/tv params for this mode specifically, so
          they're first-class here rather than a generic post-fetch filter.
          Field ids and updateField wiring are unchanged from their previous
          Filters-box location. .ratingYearRow/.fieldNarrow (no spec,
          layout-only) keep the three on one line instead of stacking
          full-width, since this panel is a flex column (.tabPanel) rather
          than the Filters box's own grid. */}
      <div className={styles.ratingYearRow}>
        <div className={`${styles.field} ${styles.fieldNarrow}`}>
          <label htmlFor="recommendation-min-tmdb-rating">
            Min TMDB Rating
          </label>
          <input
            id="recommendation-min-tmdb-rating"
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={state.minTmdbRating}
            onChange={updateField('minTmdbRating')}
          />
        </div>

        <div className={`${styles.field} ${styles.fieldNarrow}`}>
          <label htmlFor="recommendation-year-min">Year Min</label>
          <input
            id="recommendation-year-min"
            type="number"
            min={MIN_VALID_YEAR}
            max={MAX_VALID_YEAR}
            value={state.yearMin}
            onChange={updateField('yearMin')}
          />
        </div>

        <div className={`${styles.field} ${styles.fieldNarrow}`}>
          <label htmlFor="recommendation-year-max">Year Max</label>
          <input
            id="recommendation-year-max"
            type="number"
            min={MIN_VALID_YEAR}
            max={MAX_VALID_YEAR}
            value={state.yearMax}
            onChange={updateField('yearMax')}
          />
        </div>
      </div>

      {/* FRONTEND-046-AC-04: series_spec_031's year-range semantics for
          Custom Search specifically are episode-air-date based (matches any
          year the show had an episode air, not just its first season) --
          different from every other mode, where Year Min/Max still filters
          post-fetch on first-air-date only. This hint makes that asymmetry
          visible instead of a silent surprise when a user switches tabs. */}
      <p className={styles.hint}>
        Year range matches any year the show had an episode air — not just its
        first season.
      </p>

      {/* FRONTEND-047-AC-04/AC-10: Country/Language relocated into Custom
          Search's own panel, mirroring frontend_spec_046's Min TMDB
          Rating/Year Min/Year Max relocation pattern -- series_spec_032
          makes these real TMDB discover/tv params for this mode
          specifically. */}
      <div className={styles.genreKeywordFields}>
        <div className={styles.field}>
          <KeywordPicker
            id="recommendation-countries"
            label="Countries"
            selected={state.countriesSelected}
            onChange={(next) => updateState({ countriesSelected: next })}
            options={COUNTRY_OPTIONS}
            pinnedOptions={COUNTRY_PINNED_OPTIONS}
          />
        </div>

        <div className={styles.field}>
          <KeywordPicker
            id="recommendation-language"
            label="Language"
            selected={state.language ? [state.language] : []}
            onChange={(next) => updateState({ language: next.at(-1) ?? '' })}
            options={LANGUAGE_OPTIONS}
            pinnedOptions={LANGUAGE_PINNED_CODES}
          />
        </div>
      </div>
    </div>
  )
}
