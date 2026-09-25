import { useEffect, useRef, useState } from 'react'
import { KeywordPicker } from './KeywordPicker'
import { NumberInput } from './NumberInput'
import { InfoDisclosure } from './InfoDisclosure'
import { COUNTRY_OPTIONS } from '../utils/countryOptions'
import { MIN_VALID_YEAR, MAX_VALID_YEAR } from '../utils/yearBounds'
import {
  resolveTieredStep,
  RATING_STEP_BREAKPOINTS,
  YEAR_STEP_BREAKPOINTS,
} from '../utils/tieredStep'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
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
import { useFilterProfileSelector } from '../hooks/useFilterProfileSelector'
import { SavedFiltersList } from './SavedFiltersList'
import { FilterProfileActions } from './FilterProfileActions'
import { CollapsibleSection } from './CollapsibleSection'
import styles from './RecommendationControls.module.css'
import btn from '../styles/buttons.module.css'
import surface from '../styles/surfaces.module.css'

// FRONTEND-093-AC-02/03/04: counts every field this box reads/writes while NOT
// isCustomSearch -- several fields are hidden while isCustomSearch is true, but
// their state values persist across mode switches, so counting only
// currently-visible fields would make the badge's number change confusingly as
// the user switches modes without touching anything (this spec's original
// Design Decisions). FRONTEND-093-AC-04 corrects a real bug that original
// reasoning didn't anticipate: minTmdbRating/yearMin/yearMax/
// excludeGenresSelected/countriesSelected/language are ALSO bound to
// CustomSearchPanel.tsx's own visible fields while Custom Search is active --
// so editing them there silently bumped this box's own badge even though none
// of those fields are shown by this box's own collapsed toggle in that mode.
// While isCustomSearch, only the two fields that stay visible in this box
// regardless of mode (minVoteCount, excludeKeywordsSelected) are counted.
function countActiveFilters(
  state: ControlsState,
  isCustomSearch: boolean,
): number {
  const stringFields = isCustomSearch
    ? [state.minVoteCount]
    : [
        state.minTmdbRating,
        state.minVoteCount,
        state.yearMin,
        state.yearMax,
        state.language,
      ]
  // FRONTEND-094-AC-08: excludeKeywordsSelected moved here from
  // stringFields above -- it's now an array (KeywordPicker), checked via
  // `.length > 0` like every other array-typed field, not `.trim() !== ''`.
  const arrayFields = isCustomSearch
    ? [state.excludeKeywordsSelected]
    : [
        state.excludeGenresSelected,
        state.excludeKeywordsSelected,
        state.countriesSelected,
      ]

  return (
    stringFields.filter((value) => value.trim() !== '').length +
    arrayFields.filter((value) => value.length > 0).length
  )
}

// FRONTEND-134-AC-06: four small per-section active-filter counters, one per
// CollapsibleSection this spec introduces -- mirroring SearchFilter.tsx's own
// per-section counter style (group the section's fields, filter non-empty,
// sum), but each also honors isCustomSearch the same way countActiveFilters
// above already does, since three of these four sections' fields are hidden
// entirely while Custom Search is active (this spec's Design Decisions).
function countRatingVotesActive(
  state: ControlsState,
  isCustomSearch: boolean,
): number {
  const stringFields = isCustomSearch
    ? [state.minVoteCount]
    : [state.minTmdbRating, state.minVoteCount]
  return stringFields.filter((value) => value.trim() !== '').length
}

function countGenreKeywordActive(
  state: ControlsState,
  isCustomSearch: boolean,
): number {
  const arrayFields = isCustomSearch
    ? [state.excludeKeywordsSelected]
    : [state.excludeGenresSelected, state.excludeKeywordsSelected]
  return arrayFields.filter((value) => value.length > 0).length
}

function countCountryLanguageActive(
  state: ControlsState,
  isCustomSearch: boolean,
): number {
  if (isCustomSearch) return 0
  return (
    (state.countriesSelected.length > 0 ? 1 : 0) +
    (state.language.trim() !== '' ? 1 : 0)
  )
}

function countYearActive(
  state: ControlsState,
  isCustomSearch: boolean,
): number {
  if (isCustomSearch) return 0
  return [state.yearMin, state.yearMax].filter((value) => value.trim() !== '')
    .length
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
  const activeFilterCount = countActiveFilters(state, isCustomSearch)
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

  // FRONTEND-129-AC-01/AC-02: one shared hook instance feeds both
  // SavedFiltersList (rendered at the top of filtersBody) and
  // FilterProfileActions (rendered at this box's existing bottom position,
  // immediately before the Reset Filters row) -- see frontend_spec_129's
  // Design Decisions. `disabled` already handles the Custom Search case.
  const filterProfile = useFilterProfileSelector<RecommendationFiltersCriteria>(
    {
      area: 'RECOMMENDATION_FILTERS',
      currentCriteria: currentRecommendationFiltersCriteria,
      onApply: handleApplyProfile,
      onClear: handleResetFilters,
      disabled: isCustomSearch,
    },
  )

  // FRONTEND-134-AC-03: same closeButtonRef/useEffect pattern
  // SearchFilter.tsx already uses -- moves focus into the sheet as soon as
  // it opens.
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (filtersOpen) {
      closeButtonRef.current?.focus()
    }
  }, [filtersOpen])

  // FRONTEND-134-AC-04: same Escape-to-close pattern as SearchFilter.tsx's
  // sheet, on this sheet's own dialog root.
  const handleSheetKeyDown = useEscapeToClose(() => setFiltersOpen(false))

  // FRONTEND-134-AC-05: handleResetFilters's own body is unchanged -- this
  // wrapper just also closes the sheet afterward, mirroring
  // frontend_spec_071-AC-07's "Clear Filters resets and closes".
  const handleResetFiltersAndClose = () => {
    handleResetFilters()
    setFiltersOpen(false)
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
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-close matches SearchFilter.tsx's sheet; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`).
        <div // NOSONAR: typescript:S6819, see comment above
          className={styles.sheetOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="recommendation-filters-sheet-heading"
          onKeyDown={handleSheetKeyDown}
          onClick={(e) => {
            // FRONTEND-134-AC-04: only the overlay backdrop itself should
            // close the sheet -- mirrors SearchFilter.tsx's own guard.
            if (e.target === e.currentTarget) setFiltersOpen(false)
          }}
        >
          <div className={styles.sheet}>
            <div className={styles.sheetHeader}>
              <h2
                id="recommendation-filters-sheet-heading"
                className={styles.sheetHeading}
              >
                Recommendations Filters
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                aria-label="Close"
                onClick={() => setFiltersOpen(false)}
              >
                Close
              </button>
            </div>

            {/* FRONTEND-134-AC-20: one-line explanation of this sheet's
                post-sourcing scope, directly below the heading, above
                SavedFiltersList (this spec's Design Decisions). */}
            <p>
              Filter the recommendations to only show series you want to see.
            </p>

            <div className={styles.sheetBody} data-testid="filters-body">
              {/* FRONTEND-129-AC-02: Saved Filters now renders first, before
                  any individual field, unconditionally -- disabled already
                  handles the Custom Search case. */}
              <SavedFiltersList<RecommendationFiltersCriteria>
                area="RECOMMENDATION_FILTERS"
                disabled={isCustomSearch}
                {...filterProfile}
              />

              <section className={`${styles.filterSection} ${surface.card}`}>
                <CollapsibleSection
                  title="Rating & Votes"
                  defaultOpen={true}
                  activeCount={countRatingVotesActive(state, isCustomSearch)}
                  toggleClassName={styles.filterSectionHeading}
                  bodyClassName={styles.filterSectionBody}
                >
                  {!isCustomSearch && (
                    <div className={styles.field}>
                      <NumberInput
                        id="recommendation-min-tmdb-rating"
                        label="Min TMDB Rating"
                        step={resolveTieredStep(RATING_STEP_BREAKPOINTS)}
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
                      // FRONTEND-122-AC-07: flat, non-tiered -- only a single
                      // range was requested for this field.
                      step={100}
                      value={state.minVoteCount}
                      onChange={(value) =>
                        handleMinVoteCountChange({
                          target: { value: String(value) },
                        } as React.ChangeEvent<HTMLInputElement>)
                      }
                      labelInfo={
                        <InfoDisclosure
                          label="About Min Vote Count"
                          description="Filters out titles TMDB has very little voting data for, excluding obscure or newly-added shows whose rating might not be reliable yet."
                        />
                      }
                    />
                    {minVoteCountError && (
                      <span className={styles.fieldError}>
                        {minVoteCountError}
                      </span>
                    )}
                  </div>
                </CollapsibleSection>
              </section>

              <section className={`${styles.filterSection} ${surface.card}`}>
                <CollapsibleSection
                  title="Genre & Keyword"
                  defaultOpen={true}
                  activeCount={countGenreKeywordActive(state, isCustomSearch)}
                  toggleClassName={styles.filterSectionHeading}
                  bodyClassName={styles.filterSectionBody}
                >
                  {/* FRONTEND-068-AC-04: exclude-only picker relocated here
                      in place of the former free-text input -- renders only
                      while !isCustomSearch, mirroring the existing Min TMDB
                      Rating/Year Min/Year Max/Country/Language relocation-
                      by-isCustomSearch pattern; Custom Search gets the
                      combined picker in CustomSearchPanel instead
                      (frontend_spec_068 AC-02). */}
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
                      hideInput) since this field excludes TMDB-wide
                      candidates, not just the user's own tracked-series
                      vocabulary (this spec's Design Decisions).
                      options=keywordOptions surfaces known keywords as
                      suggestions while typing -- a follow-up fix: the
                      original implementation set allowFreeText but never
                      passed options, leaving the field with zero suggestions
                      at all, unlike CustomSearchPanel's own modal instance
                      which already combines both. */}
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
                </CollapsibleSection>
              </section>

              {!isCustomSearch && (
                <section className={`${styles.filterSection} ${surface.card}`}>
                  <CollapsibleSection
                    title="Country & Language"
                    // FRONTEND-134-AC-08: all four sections default open --
                    // unlike SearchFilter.tsx's mixed defaultOpen convention,
                    // this box's own relocation-smoke-test AC expects every
                    // pre-existing field visible immediately after opening
                    // the sheet itself, with no further per-section clicks.
                    defaultOpen={true}
                    activeCount={countCountryLanguageActive(
                      state,
                      isCustomSearch,
                    )}
                    toggleClassName={styles.filterSectionHeading}
                    bodyClassName={styles.filterSectionBody}
                  >
                    {/* FRONTEND-047-AC-05/AC-10: Country/Language render here
                        only outside Custom Search -- while Custom Search is
                        active they relocate into that mode's own panel
                        instead (same relocation conditional
                        frontend_spec_046 established for Min TMDB Rating/
                        Year Min/Year Max). */}
                    <div className={styles.field}>
                      <KeywordPicker
                        id="recommendation-countries"
                        label="Countries"
                        selected={state.countriesSelected}
                        onChange={(next) =>
                          updateState({ countriesSelected: next })
                        }
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
                  </CollapsibleSection>
                </section>
              )}

              {!isCustomSearch && (
                <section className={`${styles.filterSection} ${surface.card}`}>
                  <CollapsibleSection
                    title="Year"
                    defaultOpen={true}
                    activeCount={countYearActive(state, isCustomSearch)}
                    toggleClassName={styles.filterSectionHeading}
                    bodyClassName={styles.filterSectionBody}
                  >
                    <div className={styles.field}>
                      <NumberInput
                        id="recommendation-year-min"
                        label="Year Min"
                        min={MIN_VALID_YEAR}
                        max={MAX_VALID_YEAR}
                        step={resolveTieredStep(YEAR_STEP_BREAKPOINTS)}
                        value={state.yearMin}
                        onChange={(value) =>
                          updateState({ yearMin: String(value) })
                        }
                      />
                    </div>

                    <div className={styles.field}>
                      <NumberInput
                        id="recommendation-year-max"
                        label="Year Max"
                        min={MIN_VALID_YEAR}
                        max={MAX_VALID_YEAR}
                        step={resolveTieredStep(YEAR_STEP_BREAKPOINTS)}
                        value={state.yearMax}
                        onChange={(value) =>
                          updateState({ yearMax: String(value) })
                        }
                      />
                    </div>
                  </CollapsibleSection>
                </section>
              )}

              <FilterProfileActions<RecommendationFiltersCriteria>
                area="RECOMMENDATION_FILTERS"
                currentCriteria={currentRecommendationFiltersCriteria}
                disabled={isCustomSearch}
                {...filterProfile}
              />

              <div className={styles.filtersActions}>
                <button
                  type="button"
                  className={`${styles.resetButton} ${btn.btnSecondary}`}
                  data-testid="reset-filters-btn"
                  onClick={handleResetFiltersAndClose}
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
