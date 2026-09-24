import { useState, useEffect, useRef } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { seriesApi } from '../services/seriesApi'
import type { SearchCriteria } from '../types/series'
import type { MySeriesFilterCriteria } from '../types/filterProfile'
import { GenreIncludeExcludePicker } from './GenreIncludeExcludePicker'
import { KeywordPicker } from './KeywordPicker'
import { NumberInput } from './NumberInput'
import { StarRating } from './StarRating'
import { useFilterProfileSelector } from '../hooks/useFilterProfileSelector'
import { SavedFiltersList } from './SavedFiltersList'
import { FilterProfileActions } from './FilterProfileActions'
import { CollapsibleSection } from './CollapsibleSection'
import { COUNTRY_OPTIONS } from '../utils/countryOptions'
import {
  LANGUAGE_OPTIONS,
  DEFAULT_COUNTRY_FAVOURITES,
  DEFAULT_LANGUAGE_FAVOURITES,
  isCountryFavourites,
  isLanguageFavourites,
} from './RecommendationControls'
import { MIN_VALID_YEAR, MAX_VALID_YEAR } from '../utils/yearBounds'
import {
  resolveTieredStep,
  RATING_STEP_BREAKPOINTS,
  ROTTEN_TOMATOES_STEP_BREAKPOINTS,
  YEAR_STEP_BREAKPOINTS,
} from '../utils/tieredStep'
import styles from './SearchFilter.module.css'
import btn from '../styles/buttons.module.css'
import surface from '../styles/surfaces.module.css'

interface SearchFilterProps {
  // FRONTEND-071-AC-04/05: the sheet's open/closed state is now owned by
  // MySeriesView (App.tsx) and passed down, rather than SearchFilter
  // managing its own filtersOpen -- see frontend_spec_071.
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onSearch: (criteria: SearchCriteria) => void
  readonly onClear: () => void
}

interface FormState {
  genresSelected: string[]
  // FRONTEND-063-AC-03: exclude-side selection for the shared
  // GenreIncludeExcludePicker, alongside the existing genresSelected
  // (include-side).
  excludeGenresSelected: string[]
  keywordsSelected: string[]
  // FRONTEND-128-AC-02/SERIES-065: mirrors keywordsSelected/minImdbRating's
  // shape -- originCountrySelected is multi-value (array), originalLanguage
  // is single-value (a plain string, matching Language's single-select
  // adapter pattern elsewhere in the app).
  originCountrySelected: string[]
  originalLanguage: string
  // FRONTEND-055-AC-06: number|null (not string) to match StarRating's own
  // value/onChange shape directly -- no string parsing needed for this
  // field anymore.
  minPersonalRating: number | null
  minImdbRating: string
  minTmdbRating: string
  // FRONTEND-122-AC-02/SERIES-063: two independent RT min-rating filters,
  // mirroring minImdbRating/minTmdbRating's shape exactly.
  minRottenTomatoesRating: string
  minRottenTomatoesPopcornmeter: string
  yearMin: string
  yearMax: string
  // FRONTEND-116/SERIES-060: four independent "find series missing this
  // rating" toggles -- OR-composed entirely server-side, no client-side
  // combination logic here.
  missingImdbRating: boolean
  missingTmdbRating: boolean
  missingRottenTomatoesRating: boolean
  missingRottenTomatoesPopcornmeter: boolean
}

const initialFormState: FormState = {
  genresSelected: [],
  excludeGenresSelected: [],
  keywordsSelected: [],
  originCountrySelected: [],
  originalLanguage: '',
  minPersonalRating: null,
  minImdbRating: '',
  minTmdbRating: '',
  minRottenTomatoesRating: '',
  minRottenTomatoesPopcornmeter: '',
  yearMin: '',
  yearMax: '',
  missingImdbRating: false,
  missingTmdbRating: false,
  missingRottenTomatoesRating: false,
  missingRottenTomatoesPopcornmeter: false,
}

function buildCriteria(form: FormState): SearchCriteria {
  const criteria: SearchCriteria = {}

  if (form.genresSelected.length > 0) criteria.genres = form.genresSelected

  if (form.excludeGenresSelected.length > 0)
    criteria.excludeGenres = form.excludeGenresSelected

  if (form.keywordsSelected.length > 0)
    criteria.keywords = form.keywordsSelected

  if (form.originCountrySelected.length > 0)
    criteria.originCountry = form.originCountrySelected
  if (form.originalLanguage.trim() !== '')
    criteria.originalLanguage = form.originalLanguage

  if (form.minPersonalRating != null)
    criteria.minPersonalRating = form.minPersonalRating
  if (form.minImdbRating.trim() !== '')
    criteria.minImdbRating = Number(form.minImdbRating)
  if (form.minTmdbRating.trim() !== '')
    criteria.minTmdbRating = Number(form.minTmdbRating)
  if (form.minRottenTomatoesRating.trim() !== '')
    criteria.minRottenTomatoesRating = Number(form.minRottenTomatoesRating)
  if (form.minRottenTomatoesPopcornmeter.trim() !== '')
    criteria.minRottenTomatoesPopcornmeter = Number(
      form.minRottenTomatoesPopcornmeter,
    )
  if (form.yearMin.trim() !== '') criteria.yearMin = Number(form.yearMin)
  if (form.yearMax.trim() !== '') criteria.yearMax = Number(form.yearMax)

  // FRONTEND-116-AC-03: only sent when checked -- unchecked (the default)
  // means "no filter", same omit-when-absent convention as every other field
  // above, not an explicit `false`.
  if (form.missingImdbRating) criteria.missingImdbRating = true
  if (form.missingTmdbRating) criteria.missingTmdbRating = true
  if (form.missingRottenTomatoesRating)
    criteria.missingRottenTomatoesRating = true
  if (form.missingRottenTomatoesPopcornmeter)
    criteria.missingRottenTomatoesPopcornmeter = true

  return criteria
}

// FRONTEND-107-AC-09: Area A's apply is a full replace, not a patch --
// buildCriteria above only ever emits non-empty fields, so reversing a saved
// profile back into FormState starts from initialFormState and overwrites
// only the fields present in the saved criteria (this spec's Design
// Decisions).
function formStateFromCriteria(criteria: MySeriesFilterCriteria): FormState {
  return {
    genresSelected: criteria.genres ?? initialFormState.genresSelected,
    excludeGenresSelected:
      criteria.excludeGenres ?? initialFormState.excludeGenresSelected,
    keywordsSelected: criteria.keywords ?? initialFormState.keywordsSelected,
    originCountrySelected:
      criteria.originCountry ?? initialFormState.originCountrySelected,
    originalLanguage:
      criteria.originalLanguage ?? initialFormState.originalLanguage,
    minPersonalRating:
      criteria.minPersonalRating ?? initialFormState.minPersonalRating,
    minImdbRating:
      criteria.minImdbRating != null
        ? String(criteria.minImdbRating)
        : initialFormState.minImdbRating,
    minTmdbRating:
      criteria.minTmdbRating != null
        ? String(criteria.minTmdbRating)
        : initialFormState.minTmdbRating,
    minRottenTomatoesRating:
      criteria.minRottenTomatoesRating != null
        ? String(criteria.minRottenTomatoesRating)
        : initialFormState.minRottenTomatoesRating,
    minRottenTomatoesPopcornmeter:
      criteria.minRottenTomatoesPopcornmeter != null
        ? String(criteria.minRottenTomatoesPopcornmeter)
        : initialFormState.minRottenTomatoesPopcornmeter,
    yearMin:
      criteria.yearMin != null
        ? String(criteria.yearMin)
        : initialFormState.yearMin,
    yearMax:
      criteria.yearMax != null
        ? String(criteria.yearMax)
        : initialFormState.yearMax,
    // FRONTEND-116: MySeriesFilterCriteria (the saved-profile shape) doesn't
    // carry the four missing-rating fields -- out of this spec's scope -- so
    // applying a saved profile always resets them to unchecked, same as any
    // other field a saved profile doesn't mention.
    missingImdbRating: initialFormState.missingImdbRating,
    missingTmdbRating: initialFormState.missingTmdbRating,
    missingRottenTomatoesRating: initialFormState.missingRottenTomatoesRating,
    missingRottenTomatoesPopcornmeter:
      initialFormState.missingRottenTomatoesPopcornmeter,
  }
}

// FRONTEND-123-AC-03: five small per-section active-filter counters, one per
// CollapsibleSection instance below -- mirroring
// RecommendationFiltersBox.tsx's own countActiveFilters style (group
// relevant fields into arrays, filter non-empty/checked, sum lengths), but
// scoped per-section since no whole-form counter exists in this file today.
function countGenresKeywordsActive(form: FormState): number {
  const arrayFields = [
    form.genresSelected,
    form.excludeGenresSelected,
    form.keywordsSelected,
  ]
  return arrayFields.filter((value) => value.length > 0).length
}

// FRONTEND-123 Design Decisions: unlike the other four counters below (which
// count non-empty *fields*, following countActiveFilters's style),
// originCountry's contribution is its own length -- one badge increment per
// selected country, not a flat 1 for "any selected".
function countOriginActive(form: FormState): number {
  return (
    form.originCountrySelected.length +
    (form.originalLanguage.trim() !== '' ? 1 : 0)
  )
}

function countRatingsActive(form: FormState): number {
  const stringFields = [
    form.minImdbRating,
    form.minTmdbRating,
    form.minRottenTomatoesRating,
    form.minRottenTomatoesPopcornmeter,
  ]
  return (
    (form.minPersonalRating != null ? 1 : 0) +
    stringFields.filter((value) => value.trim() !== '').length
  )
}

function countMissingRatingsActive(form: FormState): number {
  return [
    form.missingImdbRating,
    form.missingTmdbRating,
    form.missingRottenTomatoesRating,
    form.missingRottenTomatoesPopcornmeter,
  ].filter(Boolean).length
}

function countYearsActive(form: FormState): number {
  return [form.yearMin, form.yearMax].filter((value) => value.trim() !== '')
    .length
}

export function SearchFilter({
  isOpen,
  onClose,
  onSearch,
  onClear,
}: SearchFilterProps) {
  const [form, setForm] = useState<FormState>(initialFormState)
  const [keywordOptions, setKeywordOptions] = useState<string[]>([])
  const [keywordOptionsError, setKeywordOptionsError] = useState<string | null>(
    null,
  )
  const [genreOptions, setGenreOptions] = useState<string[]>([])
  const [browseModalOpen, setBrowseModalOpen] = useState(false)
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
  // FRONTEND-073-AC-02: Title used to be this sheet's first field (and this
  // ref's focus target) -- now that it's lived on the My Series page itself
  // since frontend_spec_073, the Close button is the first focusable element
  // remaining inside the sheet.
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // FRONTEND-071-AC-05: moves focus into the sheet as soon as it opens.
  // Without this, focus stays on the funnel trigger button in SeriesList --
  // a DOM sibling, not an ancestor, of this dialog -- so a real Escape
  // keypress right after opening would never reach handleSheetKeyDown at
  // all. Programmatic .focus() here (not the JSX autoFocus prop, which
  // jsx-a11y/no-autofocus disallows) on the isOpen transition.
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    seriesApi
      .getKeywordStats()
      .then((stats) => setKeywordOptions(stats.map((stat) => stat.name)))
      .catch(() =>
        setKeywordOptionsError(
          'Failed to load keyword filter options. Please try again.',
        ),
      )
  }, [])

  useEffect(() => {
    seriesApi
      .getGenreOptions()
      .then(setGenreOptions)
      .catch(() => undefined)
  }, [])

  const updateField =
    (
      field: Exclude<
        keyof FormState,
        | 'genresSelected'
        | 'keywordsSelected'
        | 'originCountrySelected'
        | 'minPersonalRating'
      >,
    ) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const handleMinPersonalRatingChange = (value: number | null) => {
    setForm((prev) => ({ ...prev, minPersonalRating: value }))
  }

  // FRONTEND-116-AC-03: separate from updateField above, which reads
  // event.target.value for the string-valued fields -- these four are
  // booleans, flipped directly (no change-event target to read once these
  // render as toggle chips rather than checkboxes).
  const toggleMissingRatingField =
    (
      field:
        | 'missingImdbRating'
        | 'missingTmdbRating'
        | 'missingRottenTomatoesRating'
        | 'missingRottenTomatoesPopcornmeter',
    ) =>
    () => {
      setForm((prev) => ({ ...prev, [field]: !prev[field] }))
    }

  const handleGenresChange = (next: {
    included: string[]
    excluded: string[]
  }) => {
    setForm((prev) => ({
      ...prev,
      genresSelected: next.included,
      excludeGenresSelected: next.excluded,
    }))
  }

  const handleKeywordsChange = (next: string[]) => {
    setForm((prev) => ({ ...prev, keywordsSelected: next }))
  }

  // FRONTEND-128-AC-02/SERIES-065: mirrors handleKeywordsChange above.
  const handleOriginCountryChange = (next: string[]) => {
    setForm((prev) => ({ ...prev, originCountrySelected: next }))
  }

  // FRONTEND-128-AC-02/SERIES-065: the same selected={val ? [val] : []} /
  // onChange={(next) => next.at(-1) ?? ''} adapter
  // RecommendationFiltersBox.tsx's own Language field already uses to make
  // KeywordPicker (a multi-select component) behave as a single-select.
  const handleOriginalLanguageChange = (next: string[]) => {
    setForm((prev) => ({ ...prev, originalLanguage: next.at(-1) ?? '' }))
  }

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch(buildCriteria(form))
    onClose()
  }

  const handleClear = () => {
    setForm(initialFormState)
    onClear()
    onClose()
  }

  // FRONTEND-109-AC-10: resets the pending form only -- unlike handleClear
  // above, this doesn't notify the parent or close the sheet, matching
  // handleApplyProfile's own "pending state only" contract. Used when the
  // currently-applied saved-filter chip is clicked again (toggle-off).
  const handleClearForm = () => {
    setForm(initialFormState)
  }

  // FRONTEND-107-AC-09: apply only updates the sheet's pending form state --
  // it does not call onSearch automatically, consistent with this sheet's
  // existing "Search" button gate (handleSubmit above).
  const handleApplyProfile = (criteria: MySeriesFilterCriteria) => {
    setForm(formStateFromCriteria(criteria))
  }

  // FRONTEND-129-AC-01/AC-02: one shared hook instance feeds both
  // SavedFiltersList (rendered at the top of filtersBody) and
  // FilterProfileActions (rendered at this sheet's existing bottom
  // position, immediately before the Search/Clear Filters row) -- see
  // frontend_spec_129's Design Decisions.
  const filterProfile = useFilterProfileSelector<MySeriesFilterCriteria>({
    area: 'MY_SERIES',
    currentCriteria: buildCriteria(form),
    onApply: handleApplyProfile,
    onClear: handleClearForm,
  })

  const handleModalKeyDown = useEscapeToClose(() => setBrowseModalOpen(false))

  // FRONTEND-071-AC-05: same Escape-to-close pattern as
  // handleModalKeyDown/the "Browse all keywords" modal, on the sheet's own
  // dialog root.
  const handleSheetKeyDown = useEscapeToClose(onClose)

  if (!isOpen) {
    return null
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-close matches AddSeriesForm's convention and the existing "Browse all keywords" modal in this file; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
      <div // NOSONAR: typescript:S6819, see comment above
        className={styles.sheetOverlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-series-filters-heading"
        onKeyDown={handleSheetKeyDown}
        onClick={(e) => {
          // FRONTEND-079-AC-03/04: only the overlay backdrop itself should
          // close the sheet -- a click on the form or any of its descendants
          // reports that descendant as e.target, not the overlay, so this
          // guard naturally excludes clicks inside the sheet panel.
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <form className={styles.sheet} onSubmit={handleSubmit}>
          <div className={styles.sheetHeader}>
            <h2 id="my-series-filters-heading" className={styles.sheetHeading}>
              Filters
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              className={styles.closeButton}
              aria-label="Close"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className={styles.filtersBody} data-testid="filters-body">
            {/* FRONTEND-129-AC-02: Saved Filters now renders first, before
                any individual field -- a shortcut past fields for a
                returning user, distinct from Save/Update at the bottom. */}
            <SavedFiltersList<MySeriesFilterCriteria>
              area="MY_SERIES"
              {...filterProfile}
            />

            <section className={`${styles.filterSection} ${surface.card}`}>
              <CollapsibleSection
                title="Genres & Keywords"
                defaultOpen={true}
                activeCount={countGenresKeywordsActive(form)}
                toggleClassName={styles.filterSectionHeading}
                bodyClassName={styles.filterSectionBody}
                headingTag="h3"
              >
                <div className={styles.field}>
                  <GenreIncludeExcludePicker
                    idPrefix="search-filter-genre"
                    label="Include / Exclude Genres"
                    genreOptions={genreOptions}
                    included={form.genresSelected}
                    excluded={form.excludeGenresSelected}
                    onChange={handleGenresChange}
                  />
                </div>

                <div className={styles.field}>
                  <KeywordPicker
                    id="search-keywords"
                    label="Keywords"
                    selected={form.keywordsSelected}
                    onChange={handleKeywordsChange}
                    options={keywordOptionsError ? [] : keywordOptions}
                    placeholder="Type to filter tracked keywords"
                    allowFreeText
                    // A default suggestion list here (rather than only once typing)
                    // read as cluttered in this field's narrower layout, and the
                    // "Browse all keywords" modal already covers browsing without
                    // typing -- so this field only shows matches once you type.
                    maxSuggestionsWhenEmpty={0}
                    // FRONTEND-077-AC-04: the "Browse all keywords" modal below
                    // is now the sole place to type/search for this field --
                    // the inline field only shows what's already selected.
                    hideInput
                  />
                  {keywordOptionsError && (
                    <p className={styles.keywordError} role="alert">
                      {keywordOptionsError}
                    </p>
                  )}
                  <button
                    type="button"
                    className={`${styles.browseKeywordsButton} ${btn.btnSecondary}`}
                    onClick={() => setBrowseModalOpen(true)}
                  >
                    Browse all keywords
                  </button>
                </div>
              </CollapsibleSection>
            </section>

            {/* FRONTEND-128-AC-02/SERIES-065: Country (multi-select) and
                Language (single-select via the KeywordPicker adapter) --
                mirrors the Country/Language pair RecommendationFiltersBox.tsx
                already renders for Discover. */}
            <section className={`${styles.filterSection} ${surface.card}`}>
              <CollapsibleSection
                title="Origin"
                defaultOpen={false}
                activeCount={countOriginActive(form)}
                toggleClassName={styles.filterSectionHeading}
                bodyClassName={styles.filterSectionBody}
                headingTag="h3"
              >
                <div className={styles.field}>
                  <KeywordPicker
                    id="search-origin-country"
                    label="Country"
                    selected={form.originCountrySelected}
                    onChange={handleOriginCountryChange}
                    options={COUNTRY_OPTIONS}
                    pinnedOptions={countryFavourites}
                  />
                </div>

                <div className={styles.field}>
                  <KeywordPicker
                    id="search-original-language"
                    label="Language"
                    selected={
                      form.originalLanguage ? [form.originalLanguage] : []
                    }
                    onChange={handleOriginalLanguageChange}
                    options={LANGUAGE_OPTIONS}
                    pinnedOptions={languageFavourites}
                  />
                </div>
              </CollapsibleSection>
            </section>

            <section className={`${styles.filterSection} ${surface.card}`}>
              <CollapsibleSection
                title="Ratings"
                defaultOpen={true}
                activeCount={countRatingsActive(form)}
                toggleClassName={styles.filterSectionHeading}
                bodyClassName={styles.filterSectionBody}
                headingTag="h3"
              >
                {/* FRONTEND-123-AC-01: Min Personal Rating alone in its own
                    row -- three explicit rows replace the former flat
                    auto-fit grid, so related fields read together
                    regardless of viewport width. */}
                <div className={styles.ratingRow}>
                  <div className={styles.field}>
                    <span>Min Personal Rating</span>
                    <StarRating
                      value={form.minPersonalRating}
                      onChange={handleMinPersonalRatingChange}
                    />
                  </div>
                </div>

                {/* FRONTEND-123-AC-01: Min IMDb + Min TMDB together. */}
                <div className={styles.ratingRow}>
                  <div className={styles.field}>
                    <NumberInput
                      id="search-min-imdb-rating"
                      label="Min IMDb Rating"
                      min={0}
                      max={10}
                      step={resolveTieredStep(RATING_STEP_BREAKPOINTS)}
                      value={form.minImdbRating}
                      onChange={(value) =>
                        updateField('minImdbRating')({
                          target: { value: String(value) },
                        } as React.ChangeEvent<HTMLInputElement>)
                      }
                    />
                  </div>

                  <div className={styles.field}>
                    <NumberInput
                      id="search-min-tmdb-rating"
                      label="Min TMDB Rating"
                      min={0}
                      max={10}
                      step={resolveTieredStep(RATING_STEP_BREAKPOINTS)}
                      value={form.minTmdbRating}
                      onChange={(value) =>
                        updateField('minTmdbRating')({
                          target: { value: String(value) },
                        } as React.ChangeEvent<HTMLInputElement>)
                      }
                    />
                  </div>
                </div>

                {/* FRONTEND-122-AC-02/SERIES-063. FRONTEND-123-AC-01: both
                    Rotten Tomatoes ratings together. */}
                <div className={styles.ratingRow}>
                  <div className={styles.field}>
                    <NumberInput
                      id="search-min-rotten-tomatoes-rating"
                      label="Min Rotten Tomatoes Rating"
                      min={0}
                      max={100}
                      step={resolveTieredStep(ROTTEN_TOMATOES_STEP_BREAKPOINTS)}
                      value={form.minRottenTomatoesRating}
                      onChange={(value) =>
                        updateField('minRottenTomatoesRating')({
                          target: { value: String(value) },
                        } as React.ChangeEvent<HTMLInputElement>)
                      }
                    />
                  </div>

                  <div className={styles.field}>
                    <NumberInput
                      id="search-min-rotten-tomatoes-popcornmeter"
                      label="Min Rotten Tomatoes Popcornmeter"
                      min={0}
                      max={100}
                      step={resolveTieredStep(ROTTEN_TOMATOES_STEP_BREAKPOINTS)}
                      value={form.minRottenTomatoesPopcornmeter}
                      onChange={(value) =>
                        updateField('minRottenTomatoesPopcornmeter')({
                          target: { value: String(value) },
                        } as React.ChangeEvent<HTMLInputElement>)
                      }
                    />
                  </div>
                </div>
              </CollapsibleSection>
            </section>

            <section className={`${styles.filterSection} ${surface.card}`}>
              <CollapsibleSection
                title="Missing Ratings"
                defaultOpen={false}
                activeCount={countMissingRatingsActive(form)}
                toggleClassName={styles.filterSectionHeading}
                bodyClassName={styles.filterSectionBody}
                headingTag="h3"
              >
                <div className={styles.missingRatingsChips}>
                  <button
                    type="button"
                    className={`${styles.ratingToggleChip} ${
                      form.missingImdbRating ? btn.btnPrimary : btn.btnSecondary
                    }`}
                    aria-pressed={form.missingImdbRating}
                    onClick={toggleMissingRatingField('missingImdbRating')}
                  >
                    Missing IMDb Rating
                  </button>

                  <button
                    type="button"
                    className={`${styles.ratingToggleChip} ${
                      form.missingTmdbRating ? btn.btnPrimary : btn.btnSecondary
                    }`}
                    aria-pressed={form.missingTmdbRating}
                    onClick={toggleMissingRatingField('missingTmdbRating')}
                  >
                    Missing TMDB Rating
                  </button>

                  <button
                    type="button"
                    className={`${styles.ratingToggleChip} ${
                      form.missingRottenTomatoesRating
                        ? btn.btnPrimary
                        : btn.btnSecondary
                    }`}
                    aria-pressed={form.missingRottenTomatoesRating}
                    onClick={toggleMissingRatingField(
                      'missingRottenTomatoesRating',
                    )}
                  >
                    Missing Rotten Tomatoes Rating
                  </button>

                  <button
                    type="button"
                    className={`${styles.ratingToggleChip} ${
                      form.missingRottenTomatoesPopcornmeter
                        ? btn.btnPrimary
                        : btn.btnSecondary
                    }`}
                    aria-pressed={form.missingRottenTomatoesPopcornmeter}
                    onClick={toggleMissingRatingField(
                      'missingRottenTomatoesPopcornmeter',
                    )}
                  >
                    Missing Rotten Tomatoes Popcornmeter
                  </button>
                </div>
              </CollapsibleSection>
            </section>

            <section className={`${styles.filterSection} ${surface.card}`}>
              <CollapsibleSection
                title="Years"
                defaultOpen={false}
                activeCount={countYearsActive(form)}
                toggleClassName={styles.filterSectionHeading}
                bodyClassName={styles.filterSectionBody}
                headingTag="h3"
              >
                <div className={styles.field}>
                  <NumberInput
                    id="search-year-min"
                    label="Min Year"
                    min={MIN_VALID_YEAR}
                    max={MAX_VALID_YEAR}
                    step={resolveTieredStep(YEAR_STEP_BREAKPOINTS)}
                    value={form.yearMin}
                    onChange={(value) =>
                      updateField('yearMin')({
                        target: { value: String(value) },
                      } as React.ChangeEvent<HTMLInputElement>)
                    }
                  />
                </div>

                <div className={styles.field}>
                  <NumberInput
                    id="search-year-max"
                    label="Max Year"
                    min={MIN_VALID_YEAR}
                    max={MAX_VALID_YEAR}
                    step={resolveTieredStep(YEAR_STEP_BREAKPOINTS)}
                    value={form.yearMax}
                    onChange={(value) =>
                      updateField('yearMax')({
                        target: { value: String(value) },
                      } as React.ChangeEvent<HTMLInputElement>)
                    }
                  />
                </div>
              </CollapsibleSection>
            </section>
          </div>

          <FilterProfileActions<MySeriesFilterCriteria>
            area="MY_SERIES"
            currentCriteria={buildCriteria(form)}
            {...filterProfile}
          />

          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.clearButton} ${btn.btnSecondary}`}
              data-testid="clear-filters-btn"
              onClick={handleClear}
            >
              Clear Filters
            </button>
            <button
              type="submit"
              className={`${styles.searchButton} ${btn.btnPrimary}`}
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {browseModalOpen && (
        <div className={styles.overlay}>
          {/* A native <dialog> needs showModal()/close() lifecycle management (focus trap, native backdrop) to behave correctly, not just a tag swap -- a bigger, riskier change than this div+role warrants right now (jsdom's <dialog> support has known gaps). Deliberately not converted. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior, matching AddSeriesForm's convention (frontend_spec_003.md FRONTEND-003-AC-08); the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
          <div // NOSONAR: typescript:S6819, see comment above
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="browse-keywords-heading"
            onKeyDown={handleModalKeyDown}
          >
            <h2 id="browse-keywords-heading" className={styles.dialogHeading}>
              Browse Keywords
            </h2>

            <KeywordPicker
              id="browse-keywords"
              label="Keywords"
              selected={form.keywordsSelected}
              onChange={handleKeywordsChange}
              options={keywordOptionsError ? [] : keywordOptions}
              placeholder="Type to filter tracked keywords"
              focusOnMount
              allowFreeText
              // FRONTEND-032-AC-10: no maxSuggestionsWhenEmpty here -- this
              // modal is the dedicated "browse everything" surface, so it
              // intentionally omits the cap the inline field uses.
            />

            <div className={styles.dialogActions}>
              <button
                type="button"
                className={`${styles.doneButton} ${btn.btnPrimary}`}
                onClick={() => setBrowseModalOpen(false)}
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
