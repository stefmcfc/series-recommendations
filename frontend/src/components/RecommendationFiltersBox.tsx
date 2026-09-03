import { useState } from 'react'
import { KeywordPicker } from './KeywordPicker'
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

interface RecommendationFiltersBoxProps {
  readonly state: ControlsState
  readonly updateState: (patch: Partial<ControlsState>) => void
  readonly isCustomSearch: boolean
  // FRONTEND-068-AC-04: RecommendationControls already fetches genreOptions
  // for CustomSearchPanel/UseMySeriesPanel -- threaded one prop further so
  // this box's exclude-only picker can use the same list.
  readonly genreOptions: string[]
}

// TOOLING-008-AC-05: the shared Filters disclosure box (toggle button, every
// mode-gated field, Reset Filters button), extracted from
// RecommendationControls.tsx's former `styles.filtersSection` block.
// `filtersOpen` moves fully into this component -- nothing else in the
// parent ever read it (this spec's Requirement 5 test case: implementer's
// call, doesn't affect any test's observable behavior either way).
export function RecommendationFiltersBox({
  state,
  updateState,
  isCustomSearch,
  genreOptions,
}: RecommendationFiltersBoxProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)

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
      minTmdbRating: '',
      minVoteCount: '',
      minVoteCountTouched: false,
      yearMin: '',
      yearMax: '',
      excludeGenresSelected: [],
      excludeKeywordsText: '',
      language: '',
      countriesSelected: [],
    })
  }

  return (
    <div className={styles.filtersSection}>
      {/* FRONTEND-065-AC-01: relabeled from "Filters" -- disambiguates from
          My Series' own, differently-worded "Show Filters"/"Hide Filters"
          disclosure (frontend_spec_055), fulfilled via frontend_spec_081. */}
      <button
        type="button"
        className={styles.filtersToggle}
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen((open) => !open)}
      >
        Recommendations Filters
      </button>

      {filtersOpen && (
        <div className={styles.filtersBody} data-testid="filters-body">
          {!isCustomSearch && (
            <div className={styles.field}>
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
          )}

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

          {!isCustomSearch && (
            <>
              <div className={styles.field}>
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

              <div className={styles.field}>
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
            </>
          )}

          {/* FRONTEND-068-AC-04: exclude-only picker relocated here in
              place of the former free-text input -- renders only while
              !isCustomSearch, mirroring the existing Min TMDB Rating/Year
              Min/Year Max/Country/Language relocation-by-isCustomSearch
              pattern; Custom Search gets the combined picker in
              CustomSearchPanel instead (frontend_spec_068 AC-02). */}
          {!isCustomSearch && (
            <div className={styles.field}>
              <GenreIncludeExcludePicker
                idPrefix="recs-filters-exclude-genre"
                label="Exclude Genres"
                mode="excludeOnly"
                genreOptions={genreOptions}
                included={[]}
                excluded={state.excludeGenresSelected}
                onChange={({ excluded }) =>
                  updateState({ excludeGenresSelected: excluded })
                }
              />
            </div>
          )}

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

          {/* FRONTEND-047-AC-05/AC-10: Country/Language render here only
              outside Custom Search -- while Custom Search is active they
              relocate into that mode's own panel instead (same relocation
              conditional frontend_spec_046 established for Min TMDB
              Rating/Year Min/Year Max). */}
          {!isCustomSearch && (
            <>
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
                  onChange={(next) =>
                    updateState({ language: next.at(-1) ?? '' })
                  }
                  options={LANGUAGE_OPTIONS}
                  pinnedOptions={LANGUAGE_PINNED_CODES}
                />
              </div>
            </>
          )}

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
  )
}
