import { useState } from 'react'
import { KeywordPicker } from './KeywordPicker'
import { NumberInput } from './NumberInput'
import { COUNTRY_OPTIONS } from '../utils/countryOptions'
import { MIN_VALID_YEAR, MAX_VALID_YEAR } from '../utils/yearBounds'
import { useLocalStorage } from '../hooks/useLocalStorage'
import {
  DEFAULT_COUNTRY_FAVOURITES,
  DEFAULT_LANGUAGE_FAVOURITES,
  LANGUAGE_OPTIONS,
  isCountryFavourites,
  isLanguageFavourites,
  isMinVoteCountValid,
} from './RecommendationControls'
import type { ControlsState } from './RecommendationControls'
import type { RecommendationFiltersCriteria } from '../types/filterProfile'
import { GenreIncludeExcludePicker } from './GenreIncludeExcludePicker'
import { FilterProfileSelector } from './FilterProfileSelector'
import styles from './RecommendationControls.module.css'
import btn from '../styles/buttons.module.css'

// FRONTEND-093-AC-02/03: counts every field this box reads/writes,
// regardless of isCustomSearch -- several fields are hidden while
// isCustomSearch is true, but their state values persist across mode
// switches, so counting only currently-visible fields would make the
// badge's number change confusingly as the user switches modes without
// touching anything (this spec's Design Decisions).
function countActiveFilters(state: ControlsState): number {
  const stringFields = [
    state.minTmdbRating,
    state.minVoteCount,
    state.yearMin,
    state.yearMax,
    state.language,
  ]
  // FRONTEND-094-AC-08: excludeKeywordsSelected moved here from
  // stringFields above -- it's now an array (KeywordPicker), checked via
  // `.length > 0` like every other array-typed field, not `.trim() !== ''`.
  const arrayFields = [
    state.excludeGenresSelected,
    state.excludeKeywordsSelected,
    state.countriesSelected,
  ]

  return (
    stringFields.filter((value) => value.trim() !== '').length +
    arrayFields.filter((value) => value.length > 0).length
  )
}

interface RecommendationFiltersBoxProps {
  readonly state: ControlsState
  readonly updateState: (patch: Partial<ControlsState>) => void
  readonly isCustomSearch: boolean
  // FRONTEND-068-AC-04: RecommendationControls already fetches genreOptions
  // for CustomSearchPanel/UseMySeriesPanel -- threaded one prop further so
  // this box's exclude-only picker can use the same list.
  readonly genreOptions: string[]
  // FRONTEND-094 follow-up: same threading as genreOptions above, for the
  // Exclude Keywords picker's suggestion list (frontend_spec_094's own
  // CustomSearchPanel modal instance already combines options+allowFreeText
  // this same way -- this field was missed when Exclude Keywords was first
  // converted from free text).
  readonly keywordOptions: string[]
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
  keywordOptions,
}: RecommendationFiltersBoxProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilterCount = countActiveFilters(state)
  // FRONTEND-098-AC-07/08: same localStorage-backed favourites as
  // CustomSearchPanel's own instance (this spec's Design Decisions: no
  // cross-tab sync needed, each mounted consumer just reads its own copy).
  const [countryFavourites] = useLocalStorage(
    'countryFavourites',
    DEFAULT_COUNTRY_FAVOURITES,
    isCountryFavourites,
  )
  const [languageFavourites] = useLocalStorage(
    'languageFavourites',
    DEFAULT_LANGUAGE_FAVOURITES,
    isLanguageFavourites,
  )
  // FRONTEND-094-AC-09/AC-10: advisory-only inline error (Design Decisions --
  // "Get Recommendations" isn't gated on this, matching how no field in this
  // component already gates it), shares its validity rule with the
  // query-builder's own backstop via isMinVoteCountValid.
  const minVoteCountError =
    state.minVoteCount.trim() !== '' && !isMinVoteCountValid(state.minVoteCount)
      ? 'Min vote count must be a whole number of at least 0'
      : null

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
      excludeKeywordsSelected: [],
      language: '',
      countriesSelected: [],
    })
  }

  // FRONTEND-107-AC-11: the named 8-field slice of ControlsState this area's
  // saved profiles cover -- never minVoteCountTouched (bookkeeping-only, see
  // handleApplyProfile below).
  const currentRecommendationFiltersCriteria: RecommendationFiltersCriteria = {
    minVoteCount: state.minVoteCount,
    excludeGenresSelected: state.excludeGenresSelected,
    excludeKeywordsSelected: state.excludeKeywordsSelected,
    minTmdbRating: state.minTmdbRating,
    yearMin: state.yearMin,
    yearMax: state.yearMax,
    language: state.language,
    countriesSelected: state.countriesSelected,
  }

  // FRONTEND-107-AC-12: mirrors handleMinVoteCountChange/handleResetFilters's
  // existing pattern exactly -- always keeps minVoteCountTouched in sync
  // with minVoteCount in the same updateState call.
  const handleApplyProfile = (criteria: RecommendationFiltersCriteria) => {
    updateState({
      ...criteria,
      minVoteCountTouched: criteria.minVoteCount !== '',
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
        {activeFilterCount > 0 && (
          <span
            className={styles.filtersActiveBadge}
            data-testid="filters-active-count"
          >
            {activeFilterCount}
          </span>
        )}
      </button>

      {filtersOpen && (
        <div className={styles.filtersBody} data-testid="filters-body">
          {!isCustomSearch && (
            <div className={styles.field}>
              <NumberInput
                id="recommendation-min-tmdb-rating"
                label="Min TMDB Rating"
                step={0.1}
                min={0}
                max={10}
                value={state.minTmdbRating}
                onChange={(value) =>
                  updateState({ minTmdbRating: String(value) })
                }
              />
            </div>
          )}

          <div className={styles.field}>
            <NumberInput
              id="recommendation-min-vote-count"
              label="Min Vote Count"
              min={0}
              step={1}
              value={state.minVoteCount}
              onChange={(value) =>
                handleMinVoteCountChange({
                  target: { value: String(value) },
                } as React.ChangeEvent<HTMLInputElement>)
              }
            />
            {minVoteCountError && (
              <span className={styles.fieldError}>{minVoteCountError}</span>
            )}
          </div>

          {!isCustomSearch && (
            <>
              <div className={styles.field}>
                <NumberInput
                  id="recommendation-year-min"
                  label="Year Min"
                  min={MIN_VALID_YEAR}
                  max={MAX_VALID_YEAR}
                  value={state.yearMin}
                  onChange={(value) => updateState({ yearMin: String(value) })}
                />
              </div>

              <div className={styles.field}>
                <NumberInput
                  id="recommendation-year-max"
                  label="Year Max"
                  min={MIN_VALID_YEAR}
                  max={MAX_VALID_YEAR}
                  value={state.yearMax}
                  onChange={(value) => updateState({ yearMax: String(value) })}
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

          {/* FRONTEND-094-AC-05: KeywordPicker replaces the former
              comma-separated free-text input -- allowFreeText (not
              hideInput) since this field excludes TMDB-wide candidates, not
              just the user's own tracked-series vocabulary (this spec's
              Design Decisions). options=keywordOptions surfaces known
              keywords as suggestions while typing -- a follow-up fix:
              the original implementation set allowFreeText but never passed
              options, leaving the field with zero suggestions at all,
              unlike CustomSearchPanel's own modal instance which already
              combines both. */}
          <div className={styles.field}>
            <KeywordPicker
              id="recommendation-exclude-keywords"
              label="Exclude Keywords"
              selected={state.excludeKeywordsSelected}
              onChange={(next) =>
                updateState({ excludeKeywordsSelected: next })
              }
              options={keywordOptions}
              allowFreeText
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
                  pinnedOptions={countryFavourites}
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
                  pinnedOptions={languageFavourites}
                />
              </div>
            </>
          )}

          <div className={styles.filterFullWidthRow}>
            <FilterProfileSelector<RecommendationFiltersCriteria>
              area="RECOMMENDATION_FILTERS"
              currentCriteria={currentRecommendationFiltersCriteria}
              onApply={handleApplyProfile}
              onClear={handleResetFilters}
              disabled={isCustomSearch}
            />
          </div>

          <div className={styles.filtersActions}>
            <button
              type="button"
              className={`${styles.resetButton} ${btn.btnSecondary}`}
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
