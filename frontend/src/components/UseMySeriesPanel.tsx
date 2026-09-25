import { useState } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { Series } from '../types/series'
import type { UseMySeriesFilterCriteria } from '../types/filterProfile'
import { KeywordPicker } from './KeywordPicker'
import type { PickerOption } from './KeywordPicker'
import { SPECIFIC_SERIES_PICKER_LIMIT } from '../utils/keywordSuggestions'
import { GenreIncludeExcludePicker } from './GenreIncludeExcludePicker'
import { NumberInput } from './NumberInput'
import { InfoDisclosure } from './InfoDisclosure'
import { RatingSourceChips } from './RatingSourceChips'
import { StarRating } from './StarRating'
import { useFilterProfileSelector } from '../hooks/useFilterProfileSelector'
import { SavedFiltersList } from './SavedFiltersList'
import { FilterProfileActions } from './FilterProfileActions'
import { MIN_VALID_YEAR, MAX_VALID_YEAR } from '../utils/yearBounds'
import {
  resolveTieredStep,
  RATING_STEP_BREAKPOINTS,
  ROTTEN_TOMATOES_STEP_BREAKPOINTS,
  YEAR_STEP_BREAKPOINTS,
} from '../utils/tieredStep'
import { formatMissingRatingMessage } from '../utils/missingRatingMessage'
import {
  buildSpecificSeriesCandidatePool,
  seriesPickerLabel,
  seriesPickerDisplay,
  SPECIFIC_SERIES_SORT_BY_OPTIONS,
  LANGUAGE_OPTIONS,
  DEFAULT_COUNTRY_FAVOURITES,
  DEFAULT_LANGUAGE_FAVOURITES,
  isCountryFavourites,
  isLanguageFavourites,
} from './RecommendationControls'
import type {
  ControlsState,
  SpecificSeriesStatusFilter,
  SpecificSeriesSortBy,
  SpecificSeriesSortDirection,
} from './RecommendationControls'
import { COUNTRY_OPTIONS } from '../utils/countryOptions'
import styles from './RecommendationControls.module.css'
import btn from '../styles/buttons.module.css'

interface UseMySeriesPanelProps {
  readonly state: ControlsState
  readonly updateState: (patch: Partial<ControlsState>) => void
  readonly allSeries: Series[]
  readonly genreOptions: string[]
  // FRONTEND-081-AC-04: threaded from RecommendationControls's already-
  // fetched keywordOptions state (previously only passed to
  // CustomSearchPanel), so the new Keywords field can offer the same
  // tracked-keyword suggestions.
  readonly keywordOptions: string[]
}

// TOOLING-008-AC-02: the Specific Series picker (search/filter/sort/"Show
// all series" modal), extracted from RecommendationControls.tsx's former
// `state.mode === 'useMySeries'` tabpanel block. FRONTEND-035's five
// picker-scoped useState calls -- previously kept deliberately separate from
// ControlsState but still lifted in the parent -- now live entirely inside
// this component, since RecommendationControls has no reason to hold state
// only this one panel ever reads (this spec's Design Decisions).
export function UseMySeriesPanel({
  state,
  updateState,
  allSeries,
  genreOptions,
  keywordOptions,
}: UseMySeriesPanelProps) {
  const [specificSeriesGenreFilter, setSpecificSeriesGenreFilter] = useState<
    string[]
  >([])
  // FRONTEND-069-AC-04: replaces the former include-only "Filter by Genre"
  // checkbox fieldset with the shared GenreIncludeExcludePicker -- this new
  // state slot is the exclude side, specificSeriesGenreFilter above stays
  // the include side.
  const [
    specificSeriesExcludeGenreFilter,
    setSpecificSeriesExcludeGenreFilter,
  ] = useState<string[]>([])
  const [specificSeriesStatusFilter, setSpecificSeriesStatusFilter] =
    useState<SpecificSeriesStatusFilter>('any')
  const [specificSeriesSortBy, setSpecificSeriesSortBy] =
    useState<SpecificSeriesSortBy>('title')
  const [specificSeriesSortDirection, setSpecificSeriesSortDirection] =
    useState<SpecificSeriesSortDirection>('asc')
  const [specificSeriesBrowseModalOpen, setSpecificSeriesBrowseModalOpen] =
    useState(false)
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
  // FRONTEND-077-AC-07: separate open/closed state for the new "Browse all
  // keywords" modal paired with the Keywords filter field below -- mirrors
  // specificSeriesBrowseModalOpen above in every respect, just for a
  // different field/modal pairing.
  const [
    specificSeriesKeywordsBrowseModalOpen,
    setSpecificSeriesKeywordsBrowseModalOpen,
  ] = useState(false)
  // FRONTEND-081: the five new Section 1 fields -- local useState exactly
  // like the five above (never part of ControlsState, this spec's Design
  // Decisions), client-side-only picker-narrowing aids that replace the
  // retired backend minSourceRating gate conceptually.
  const [specificSeriesKeywordsFilter, setSpecificSeriesKeywordsFilter] =
    useState<string[]>([])
  // FRONTEND-128-AC-03/SERIES-065: mirrors specificSeriesGenreFilter/
  // specificSeriesKeywordsFilter's shape -- country is multi-value
  // (OR/substring matched), language is single-value (exact matched).
  const [
    specificSeriesOriginCountryFilter,
    setSpecificSeriesOriginCountryFilter,
  ] = useState<string[]>([])
  const [
    specificSeriesOriginalLanguageFilter,
    setSpecificSeriesOriginalLanguageFilter,
  ] = useState('')
  const [specificSeriesMinPersonalRating, setSpecificSeriesMinPersonalRating] =
    useState<number | null>(null)
  const [specificSeriesMinImdbRating, setSpecificSeriesMinImdbRating] =
    useState('')
  const [specificSeriesMinTmdbRating, setSpecificSeriesMinTmdbRating] =
    useState('')
  // FRONTEND-122-AC-03/SERIES-063: two independent RT min-rating filters,
  // mirroring specificSeriesMinImdbRating/specificSeriesMinTmdbRating above.
  const [
    specificSeriesMinRottenTomatoesRating,
    setSpecificSeriesMinRottenTomatoesRating,
  ] = useState('')
  const [
    specificSeriesMinRottenTomatoesPopcornmeter,
    setSpecificSeriesMinRottenTomatoesPopcornmeter,
  ] = useState('')
  const [specificSeriesYearMin, setSpecificSeriesYearMin] = useState('')
  const [specificSeriesYearMax, setSpecificSeriesYearMax] = useState('')
  // FRONTEND-081-AC-01: "Filter My Series" disclosure, defaulting OPEN
  // (unlike RecommendationFiltersBox's own filtersOpen, which defaults
  // closed) so the new filtering capability isn't buried on first render.
  const [filterSectionOpen, setFilterSectionOpen] = useState(true)
  // Per an amendment to frontend_spec_132 (being updated separately): the
  // Source Ranking Strategy radiogroup now lives in its own top-level
  // disclosure rather than nested inside "Filter My Series" -- this section
  // defaults OPEN too, matching its effective default visibility before the
  // split (filterSectionOpen also defaults true).
  const [sourceRankingSectionOpen, setSourceRankingSectionOpen] = useState(true)

  const handleSpecificSeriesSelectionChange = (next: string[]) => {
    updateState({ selectedSeriesIds: next })
  }

  // FRONTEND-107-AC-10: assembled from this panel's own ~10 local useState
  // values -- there's no single ControlsState/reducer slice for these, so
  // this is a small adapter rather than a straight prop pass-through.
  const currentUseMySeriesCriteria: UseMySeriesFilterCriteria = {
    genreFilter: specificSeriesGenreFilter,
    excludeGenreFilter: specificSeriesExcludeGenreFilter,
    statusFilter: specificSeriesStatusFilter,
    keywordsFilter: specificSeriesKeywordsFilter,
    originCountryFilter: specificSeriesOriginCountryFilter,
    originalLanguageFilter: specificSeriesOriginalLanguageFilter,
    minPersonalRating: specificSeriesMinPersonalRating,
    minImdbRating: specificSeriesMinImdbRating,
    minTmdbRating: specificSeriesMinTmdbRating,
    minRottenTomatoesRating: specificSeriesMinRottenTomatoesRating,
    minRottenTomatoesPopcornmeter: specificSeriesMinRottenTomatoesPopcornmeter,
    yearMin: specificSeriesYearMin,
    yearMax: specificSeriesYearMax,
    sortBy: specificSeriesSortBy,
    sortDirection: specificSeriesSortDirection,
    // FRONTEND-132-AC-01/03/SERIES-068: unlike every other field on this
    // object, these two live on ControlsState (state), not this panel's own
    // local useState -- read directly from the state prop rather than a
    // local variable.
    sourceRankingStrategy: state.sourceRankingStrategy,
    sourceRatingBlendSources: state.sourceRatingBlendSources,
  }

  // FRONTEND-107-AC-10: there's no reducer to patch here, so applying a
  // saved profile calls each individual setter in sequence (this spec's
  // Design Decisions).
  // A saved profile from before a given field existed on
  // UseMySeriesFilterCriteria (e.g. originCountryFilter/originalLanguageFilter,
  // added by frontend_spec_128) has that key missing entirely, not set to its
  // empty value -- applying it unguarded left state as `undefined` instead of
  // `[]`/`''`/`null`, which crashed buildSpecificSeriesCandidatePool's
  // filterSpecificSeriesByOriginCountry (`undefined.length`). Defaulting each
  // field here mirrors SearchFilter.tsx's own formStateFromCriteria, which
  // already guards the same way for its equivalent fields.
  const applyUseMySeriesFilterCriteria = (
    criteria: UseMySeriesFilterCriteria,
  ) => {
    setSpecificSeriesGenreFilter(criteria.genreFilter ?? [])
    setSpecificSeriesExcludeGenreFilter(criteria.excludeGenreFilter ?? [])
    setSpecificSeriesStatusFilter(criteria.statusFilter ?? 'any')
    setSpecificSeriesKeywordsFilter(criteria.keywordsFilter ?? [])
    setSpecificSeriesOriginCountryFilter(criteria.originCountryFilter ?? [])
    setSpecificSeriesOriginalLanguageFilter(
      criteria.originalLanguageFilter ?? '',
    )
    setSpecificSeriesMinPersonalRating(criteria.minPersonalRating ?? null)
    setSpecificSeriesMinImdbRating(criteria.minImdbRating ?? '')
    setSpecificSeriesMinTmdbRating(criteria.minTmdbRating ?? '')
    setSpecificSeriesMinRottenTomatoesRating(
      criteria.minRottenTomatoesRating ?? '',
    )
    setSpecificSeriesMinRottenTomatoesPopcornmeter(
      criteria.minRottenTomatoesPopcornmeter ?? '',
    )
    setSpecificSeriesYearMin(criteria.yearMin ?? '')
    setSpecificSeriesYearMax(criteria.yearMax ?? '')
    setSpecificSeriesSortBy(criteria.sortBy ?? 'title')
    setSpecificSeriesSortDirection(criteria.sortDirection ?? 'asc')
    // FRONTEND-132-AC-01/03/SERIES-068: these two live on ControlsState, so
    // restoring them goes through updateState rather than a local setter --
    // a saved profile from before this field existed has it missing
    // entirely (same undefined-key gap this function's other ?? defaults
    // above already guard against), so both fall back to their
    // series_spec_068-matching defaults.
    updateState({
      sourceRankingStrategy:
        criteria.sourceRankingStrategy ?? 'personalRatingThenDate',
      sourceRatingBlendSources: criteria.sourceRatingBlendSources ?? [
        'imdb',
        'tmdb',
      ],
    })
  }

  // FRONTEND-064-AC-04/AC-05: selecting a new sort field also resets the
  // direction to a sensible default -- descending for every field except
  // Title, which defaults ascending. A subsequent manual toggle
  // (handleSpecificSeriesSortDirectionToggle) is left alone until the field
  // changes again.
  const handleSpecificSeriesSortByChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const newField = event.target.value as SpecificSeriesSortBy
    setSpecificSeriesSortBy(newField)
    setSpecificSeriesSortDirection(newField === 'title' ? 'asc' : 'desc')
  }

  const handleSpecificSeriesSortDirectionToggle = () => {
    setSpecificSeriesSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
  }

  // FRONTEND-109-AC-12: this panel previously had no way to reset its own
  // filter/sort fields at all (unlike SearchFilter's "Clear Filters" and
  // RecommendationFiltersBox's "Reset Filters") -- also reused as the
  // saved-filter chip's onClear (toggle-off), so there's one source of
  // truth for "reset this panel's filters" rather than two.
  const handleClearSpecificSeriesFilters = () => {
    setSpecificSeriesGenreFilter([])
    setSpecificSeriesExcludeGenreFilter([])
    setSpecificSeriesStatusFilter('any')
    setSpecificSeriesKeywordsFilter([])
    setSpecificSeriesOriginCountryFilter([])
    setSpecificSeriesOriginalLanguageFilter('')
    setSpecificSeriesMinPersonalRating(null)
    setSpecificSeriesMinImdbRating('')
    setSpecificSeriesMinTmdbRating('')
    setSpecificSeriesMinRottenTomatoesRating('')
    setSpecificSeriesMinRottenTomatoesPopcornmeter('')
    setSpecificSeriesYearMin('')
    setSpecificSeriesYearMax('')
    setSpecificSeriesSortBy('title')
    setSpecificSeriesSortDirection('asc')
    // FRONTEND-132-AC-01/03/SERIES-068: mirrors applyUseMySeriesFilterCriteria's
    // updateState call above -- these two live on ControlsState, not local
    // state, so clearing them goes through updateState too.
    updateState({
      sourceRankingStrategy: 'personalRatingThenDate',
      sourceRatingBlendSources: ['imdb', 'tmdb'],
    })
  }

  // FRONTEND-129-AC-01/AC-02: one shared hook instance feeds both
  // SavedFiltersList (rendered at the top of this panel's filters body) and
  // FilterProfileActions (rendered at its existing bottom position,
  // immediately before the Clear Filters row) -- see frontend_spec_129's
  // Design Decisions.
  const filterProfile = useFilterProfileSelector<UseMySeriesFilterCriteria>({
    area: 'USE_MY_SERIES',
    currentCriteria: currentUseMySeriesCriteria,
    onApply: applyUseMySeriesFilterCriteria,
    onClear: handleClearSpecificSeriesFilters,
  })

  const handleSpecificSeriesModalKeyDown = useEscapeToClose(() =>
    setSpecificSeriesBrowseModalOpen(false),
  )

  // FRONTEND-077-AC-07: same Escape-to-dismiss pattern as
  // handleSpecificSeriesModalKeyDown above, for the new Browse Keywords
  // modal.
  const handleSpecificSeriesKeywordsModalKeyDown = useEscapeToClose(() =>
    setSpecificSeriesKeywordsBrowseModalOpen(false),
  )

  // FRONTEND-035-AC-05/13: computed once, shared by both the inline picker
  // and the "Show all series" modal.
  // FRONTEND-119-AC-08/09/SERIES-062: buildSpecificSeriesCandidatePool now
  // returns { series, missingRatingCount } -- missingRatingCount feeds the
  // notice rendered near the sort control below.
  const { series: specificSeriesCandidatePool, missingRatingCount } =
    buildSpecificSeriesCandidatePool(
      allSeries,
      {
        genreFilter: specificSeriesGenreFilter,
        excludeGenreFilter: specificSeriesExcludeGenreFilter,
        statusFilter: specificSeriesStatusFilter,
        sortBy: specificSeriesSortBy,
        sortDirection: specificSeriesSortDirection,
        keywordsFilter: specificSeriesKeywordsFilter,
        originCountryFilter: specificSeriesOriginCountryFilter,
        originalLanguageFilter: specificSeriesOriginalLanguageFilter,
        minPersonalRating: specificSeriesMinPersonalRating,
        minImdbRating: specificSeriesMinImdbRating,
        minTmdbRating: specificSeriesMinTmdbRating,
        minRottenTomatoesRating: specificSeriesMinRottenTomatoesRating,
        minRottenTomatoesPopcornmeter:
          specificSeriesMinRottenTomatoesPopcornmeter,
        yearMin: specificSeriesYearMin,
        yearMax: specificSeriesYearMax,
      },
      state.selectedSeriesIds,
    )
  const missingRatingMessage = formatMissingRatingMessage(
    missingRatingCount,
    specificSeriesSortBy,
  )
  const specificSeriesOptions: PickerOption[] = specificSeriesCandidatePool.map(
    (s) => ({
      id: s.id,
      label: seriesPickerLabel(s, specificSeriesStatusFilter),
      display: seriesPickerDisplay(s, specificSeriesStatusFilter),
    }),
  )

  return (
    <>
      <div
        role="tabpanel"
        id="source-panel-use-my-series"
        aria-labelledby="source-tab-use-my-series"
        className={styles.tabPanel}
      >
        {/* FRONTEND-042-AC-02/03: always rendered now (no separate
            "automatic" mode to hide it under) -- this hint replaces the
            affordance that used to live in having two visibly distinct
            mode names. */}
        <p className={styles.hint}>
          Narrow to specific series (optional) — leave empty to use your
          top-rated completed shows automatically.
        </p>

        <div className={styles.specificSeriesSection}>
          {allSeries.length === 0 ? (
            <p className={styles.hint}>No series to choose from yet.</p>
          ) : (
            <>
              {/* FRONTEND-081-AC-01/02: "Filter My Series" disclosure -- same
                  collapse/expand mechanics as RecommendationFiltersBox's own
                  toggle, but seeded open (filterSectionOpen defaults true)
                  so the new filtering capability isn't buried. */}
              <div className={styles.filtersSection}>
                <button
                  type="button"
                  className={styles.filtersToggle}
                  aria-expanded={filterSectionOpen}
                  onClick={() => setFilterSectionOpen((open) => !open)}
                >
                  Filter My Series
                </button>

                {filterSectionOpen && (
                  <div
                    className={styles.filtersBody}
                    data-testid="specific-series-filters-body"
                  >
                    {/* FRONTEND-129-AC-02: Saved Filters now renders first,
                        before any individual field. */}
                    <div className={styles.filterFullWidthRow}>
                      <SavedFiltersList<UseMySeriesFilterCriteria>
                        area="USE_MY_SERIES"
                        {...filterProfile}
                      />
                    </div>

                    {/* FRONTEND-081 (2026-09-03 live-review amendment): Status
                        and Sort by are now their own full-width rows
                        (previously stacked together in a shared right-hand
                        column next to Genre) -- see the spec's Design
                        Decisions for the full before/after. */}
                    <fieldset
                      className={`${styles.modeFieldset} ${styles.filterFullWidthRow}`}
                    >
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

                    <div
                      className={`${styles.sortControl} ${styles.filterFullWidthRow}`}
                    >
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

                    {/* FRONTEND-119-AC-09/SERIES-062: notice shown when the
                        current sort drops series missing that rating. */}
                    {missingRatingMessage && (
                      <p
                        className={`${styles.hint} ${styles.filterFullWidthRow}`}
                      >
                        {missingRatingMessage}
                      </p>
                    )}

                    {/* FRONTEND-081 (2026-09-03 live-review amendment):
                        Genre and Keyword now share a fixed 4-column grid row,
                        each spanning 2 columns, instead of sitting in
                        separate auto-fit .filtersBody cells. */}
                    <div className={styles.filterFourColGrid}>
                      {genreOptions.length > 0 && (
                        // FRONTEND-069-AC-04: combined include/exclude Filter
                        // by Genre picker, replacing the former include-only
                        // checkbox fieldset -- one control now covers both
                        // specificSeriesGenreFilter and
                        // specificSeriesExcludeGenreFilter, mutual
                        // exclusivity guaranteed by GenreIncludeExcludePicker
                        // itself (frontend_spec_067).
                        <div className={styles.filterSpanTwo}>
                          <GenreIncludeExcludePicker
                            idPrefix="specific-series-genre"
                            label="Include / Exclude Genres"
                            genreOptions={genreOptions}
                            included={specificSeriesGenreFilter}
                            excluded={specificSeriesExcludeGenreFilter}
                            onChange={({ included, excluded }) => {
                              setSpecificSeriesGenreFilter(included)
                              setSpecificSeriesExcludeGenreFilter(excluded)
                            }}
                          />
                        </div>
                      )}

                      {/* FRONTEND-081 (2026-09-03 live-review amendment):
                          allowFreeText removed -- this field narrows the
                          picker to a tracked series' actual keywords, so an
                          untracked typed keyword could never match anything.
                          Mirrors SearchFilter.tsx's Keywords field in every
                          other respect. */}
                      <div className={styles.filterSpanTwo}>
                        <KeywordPicker
                          id="specific-series-keywords"
                          label="Keywords"
                          selected={specificSeriesKeywordsFilter}
                          onChange={setSpecificSeriesKeywordsFilter}
                          options={keywordOptions}
                          placeholder="Type to filter tracked keywords"
                          maxSuggestionsWhenEmpty={0}
                          // FRONTEND-077-AC-08: the new "Browse all keywords"
                          // modal below is now the sole place to type/search
                          // for this field -- the inline field only shows
                          // what's already selected.
                          hideInput
                        />
                        {/* FRONTEND-077-AC-07: mirrors the "Show all series"
                            button's placement/style directly below its own
                            paired field. */}
                        <button
                          type="button"
                          className={styles.browseSeriesButton}
                          onClick={() =>
                            setSpecificSeriesKeywordsBrowseModalOpen(true)
                          }
                        >
                          Browse all keywords
                        </button>
                      </div>
                    </div>

                    {/* FRONTEND-128-AC-03/SERIES-065: Country/Language
                        client-side filters, mirroring the Genre/Keywords row
                        immediately above -- Country is multi-select
                        (OR/substring matched), Language is single-select via
                        the same selected/onChange adapter
                        RecommendationFiltersBox.tsx's own Language field
                        uses to make KeywordPicker (a multi-select component)
                        behave as a single-select. */}
                    <div className={styles.filterFourColGrid}>
                      <div className={styles.filterSpanTwo}>
                        <KeywordPicker
                          id="specific-series-origin-country"
                          label="Country"
                          selected={specificSeriesOriginCountryFilter}
                          onChange={setSpecificSeriesOriginCountryFilter}
                          options={COUNTRY_OPTIONS}
                          pinnedOptions={countryFavourites}
                        />
                      </div>

                      <div className={styles.filterSpanTwo}>
                        <KeywordPicker
                          id="specific-series-original-language"
                          label="Language"
                          selected={
                            specificSeriesOriginalLanguageFilter
                              ? [specificSeriesOriginalLanguageFilter]
                              : []
                          }
                          onChange={(next) =>
                            setSpecificSeriesOriginalLanguageFilter(
                              next.at(-1) ?? '',
                            )
                          }
                          options={LANGUAGE_OPTIONS}
                          pinnedOptions={languageFavourites}
                        />
                      </div>
                    </div>

                    {/* FRONTEND-081-AC-05: the client-side successor to the
                        retired backend minSourceRating gate
                        (series_spec_045) -- narrows the picker only, never
                        drops an explicit pick server-side. */}
                    <div className={styles.filterFourColGrid}>
                      <div className={styles.field}>
                        <span>Min Personal Rating</span>
                        <StarRating
                          value={specificSeriesMinPersonalRating}
                          onChange={setSpecificSeriesMinPersonalRating}
                        />
                      </div>

                      <div className={styles.field}>
                        <NumberInput
                          id="specific-series-min-imdb-rating"
                          label="Min IMDb Rating"
                          min={0}
                          max={10}
                          step={resolveTieredStep(RATING_STEP_BREAKPOINTS)}
                          value={specificSeriesMinImdbRating}
                          onChange={(value) =>
                            setSpecificSeriesMinImdbRating(String(value))
                          }
                        />
                      </div>

                      {/* FRONTEND-081-AC-07: "(My Series)" suffix
                          disambiguates from RecommendationFiltersBox's own
                          unsuffixed "Min TMDB Rating" (post-TMDB, unrelated
                          field). */}
                      <div className={styles.field}>
                        <NumberInput
                          id="specific-series-min-tmdb-rating"
                          label="Min TMDB Rating (My Series)"
                          min={0}
                          max={10}
                          step={resolveTieredStep(RATING_STEP_BREAKPOINTS)}
                          value={specificSeriesMinTmdbRating}
                          onChange={(value) =>
                            setSpecificSeriesMinTmdbRating(String(value))
                          }
                        />
                      </div>

                      {/* FRONTEND-122-AC-03/SERIES-063. */}
                      <div className={styles.field}>
                        <NumberInput
                          id="specific-series-min-rotten-tomatoes-rating"
                          label="Min Tomatometer Rating"
                          min={0}
                          max={100}
                          step={resolveTieredStep(
                            ROTTEN_TOMATOES_STEP_BREAKPOINTS,
                          )}
                          value={specificSeriesMinRottenTomatoesRating}
                          onChange={(value) =>
                            setSpecificSeriesMinRottenTomatoesRating(
                              String(value),
                            )
                          }
                          labelInfo={
                            <InfoDisclosure
                              label="About Min Tomatometer Rating"
                              description="Rotten Tomatoes' critics score (their own term is 'Tomatometer') — the percentage of critic reviews that were positive."
                            />
                          }
                        />
                      </div>

                      <div className={styles.field}>
                        <NumberInput
                          id="specific-series-min-rotten-tomatoes-popcornmeter"
                          label="Min Popcornmeter Rating"
                          min={0}
                          max={100}
                          step={resolveTieredStep(
                            ROTTEN_TOMATOES_STEP_BREAKPOINTS,
                          )}
                          value={specificSeriesMinRottenTomatoesPopcornmeter}
                          onChange={(value) =>
                            setSpecificSeriesMinRottenTomatoesPopcornmeter(
                              String(value),
                            )
                          }
                          labelInfo={
                            <InfoDisclosure
                              label="About Min Popcornmeter Rating"
                              description="Rotten Tomatoes' audience score (their own term is 'Popcornmeter') — the percentage of verified audience members who rated it positively."
                            />
                          }
                        />
                      </div>
                    </div>

                    {/* FRONTEND-081-AC-08: "(My Series)" suffix disambiguates
                        from RecommendationFiltersBox's own unsuffixed "Year
                        Min"/"Year Max" (post-TMDB, unrelated fields). */}
                    <div className={styles.filterFourColGrid}>
                      <div className={styles.field}>
                        <NumberInput
                          id="specific-series-year-min"
                          label="Year Min (My Series)"
                          min={MIN_VALID_YEAR}
                          max={MAX_VALID_YEAR}
                          step={resolveTieredStep(YEAR_STEP_BREAKPOINTS)}
                          value={specificSeriesYearMin}
                          onChange={(value) =>
                            setSpecificSeriesYearMin(String(value))
                          }
                        />
                      </div>

                      <div className={styles.field}>
                        <NumberInput
                          id="specific-series-year-max"
                          label="Year Max (My Series)"
                          min={MIN_VALID_YEAR}
                          max={MAX_VALID_YEAR}
                          step={resolveTieredStep(YEAR_STEP_BREAKPOINTS)}
                          value={specificSeriesYearMax}
                          onChange={(value) =>
                            setSpecificSeriesYearMax(String(value))
                          }
                        />
                      </div>
                    </div>

                    <div className={styles.filterFullWidthRow}>
                      <FilterProfileActions<UseMySeriesFilterCriteria>
                        area="USE_MY_SERIES"
                        currentCriteria={currentUseMySeriesCriteria}
                        {...filterProfile}
                      />
                    </div>

                    {/* FRONTEND-109-AC-12: matches RecommendationFiltersBox's
                        "Reset Filters" placement/styling exactly (shared
                        .filtersActions/.resetButton classes, same
                        RecommendationControls.module.css). */}
                    <div className={styles.filtersActions}>
                      <button
                        type="button"
                        className={`${styles.resetButton} ${btn.btnSecondary}`}
                        data-testid="reset-specific-series-filters-btn"
                        onClick={handleClearSpecificSeriesFilters}
                      >
                        Clear Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Per an amendment to frontend_spec_132 (being updated
                  separately): the Source Ranking Strategy radiogroup was
                  pulled out of "Filter My Series" into its own top-level
                  disclosure, structurally identical to that section, so it
                  can be shown/hidden independently. Defaults OPEN, matching
                  its effective default visibility before the split. */}
              <div className={styles.filtersSection}>
                <button
                  type="button"
                  className={styles.filtersToggle}
                  aria-expanded={sourceRankingSectionOpen}
                  onClick={() => setSourceRankingSectionOpen((open) => !open)}
                >
                  Source Ranking Strategy
                </button>

                {sourceRankingSectionOpen && (
                  <div
                    className={styles.filtersBody}
                    data-testid="source-ranking-strategy-body"
                  >
                    {/* FRONTEND-132-AC-01/02/SERIES-068: 3-option
                        source-ranking-strategy radios. Per an amendment to
                        frontend_spec_132 (being updated separately): now
                        lives in its own top-level "Source Ranking Strategy"
                        disclosure rather than nested inside "Filter My
                        Series" -- previously repositioned (2026-09-24
                        live-review amendment) within that section; this
                        amendment pulls it out entirely instead. Only has any
                        effect while sourceMode === 'useMySeries'
                        (series_spec_068's Design Decisions), which is always
                        true here since this fieldset only ever renders
                        inside UseMySeriesPanel. */}
                    {/* (2026-09-24 live-review amendment): a real <legend>
                        can never share a flex row with a sibling -- browsers
                        render a fieldset's legend as its own block-level
                        "rendered legend" box outside the flex formatting
                        context entirely, confirmed live (computed
                        display: block, full row width, pushing every
                        sibling -- including the heading InfoDisclosure --
                        onto the next line) regardless of legend/CSS
                        tweaks. Switched to a plain div with
                        role="radiogroup"/aria-labelledby (the standard
                        ARIA-authoring-practices equivalent of
                        fieldset/legend for a radio group) so the visible
                        heading is an ordinary flex item that can sit beside
                        InfoDisclosure normally. */}
                    <div
                      role="radiogroup"
                      aria-labelledby="source-ranking-strategy-heading"
                      className={`${styles.modeFieldset} ${styles.filterFullWidthRow}`}
                    >
                      <div
                        className={`${styles.fieldsetLegendRow} ${styles.modeOptionFullRow}`}
                      >
                        <span
                          id="source-ranking-strategy-heading"
                          className={styles.legendText}
                        >
                          Source Ranking Strategy
                        </span>
                        <InfoDisclosure
                          label="About Source Ranking Strategy"
                          description={
                            <>
                              Controls how your own tracked series are ordered
                              before recommendations are drawn from them.
                              &quot;Personal Rating, then Date Completed&quot;
                              uses your star rating first, breaking ties by when
                              you finished a series. The two Custom Rating Blend
                              options instead blend the rating sources you pick
                              below (IMDb/TMDB/Tomatometer/ Popcornmeter) —
                              either as the primary signal or as a tiebreaker
                              behind your personal rating. This &quot;Custom
                              Rating Blend&quot; is distinct from the Analysis
                              page&apos;s fixed &quot;Blended Rating&quot; (Min
                              Avg Blended Rating) — the two features are
                              unrelated even though they can use the same
                              sources.
                            </>
                          }
                        />
                      </div>

                      {/* (2026-09-24 live-review amendment): modeOptionFullRow
                          forces each option onto its own row (see the class's
                          own comment in RecommendationControls.module.css) --
                          leaves the Status fieldset above, which shares
                          .modeFieldset, untouched. Each option also now gets
                          its own InfoDisclosure describing only that one
                          strategy, rendered as a label sibling (never inside
                          the label itself, same accessible-name-safety rule
                          this codebase follows everywhere else). */}
                      <div
                        className={`${styles.modeOption} ${styles.modeOptionFullRow}`}
                      >
                        <input
                          id="source-ranking-strategy-personal-then-date"
                          type="radio"
                          name="source-ranking-strategy"
                          checked={
                            state.sourceRankingStrategy ===
                            'personalRatingThenDate'
                          }
                          onChange={() =>
                            updateState({
                              sourceRankingStrategy: 'personalRatingThenDate',
                            })
                          }
                        />
                        <label htmlFor="source-ranking-strategy-personal-then-date">
                          Personal Rating, then Date Completed
                        </label>
                        <InfoDisclosure
                          label="About Personal Rating, then Date Completed"
                          description="Ranks your tracked series by your own star rating first; if two series share the same rating, the one you finished more recently is prioritized. This is the default and doesn't use Custom Rating Blend at all."
                        />
                      </div>

                      <div
                        className={`${styles.modeOption} ${styles.modeOptionFullRow}`}
                      >
                        <input
                          id="source-ranking-strategy-personal-then-blend"
                          type="radio"
                          name="source-ranking-strategy"
                          checked={
                            state.sourceRankingStrategy ===
                            'personalRatingThenCustomBlend'
                          }
                          onChange={() =>
                            updateState({
                              sourceRankingStrategy:
                                'personalRatingThenCustomBlend',
                            })
                          }
                        />
                        <label htmlFor="source-ranking-strategy-personal-then-blend">
                          Personal Rating, then Custom Rating Blend
                        </label>
                        <InfoDisclosure
                          label="About Personal Rating, then Custom Rating Blend"
                          description="Ranks by your own star rating first; series with the same personal rating are then broken by their Custom Rating Blend score (the sources you pick below)."
                        />
                      </div>

                      <div
                        className={`${styles.modeOption} ${styles.modeOptionFullRow}`}
                      >
                        <input
                          id="source-ranking-strategy-blend-then-personal"
                          type="radio"
                          name="source-ranking-strategy"
                          checked={
                            state.sourceRankingStrategy ===
                            'customBlendThenPersonalRating'
                          }
                          onChange={() =>
                            updateState({
                              sourceRankingStrategy:
                                'customBlendThenPersonalRating',
                            })
                          }
                        />
                        <label htmlFor="source-ranking-strategy-blend-then-personal">
                          Custom Rating Blend, then Personal Rating
                        </label>
                        <InfoDisclosure
                          label="About Custom Rating Blend, then Personal Rating"
                          description="Ranks primarily by Custom Rating Blend (the sources you pick below); your own personal rating is used only to break ties between series with the same blend score."
                        />
                      </div>
                    </div>

                    {/* FRONTEND-132-AC-03/04/SERIES-068: only rendered for
                        the two Custom-Rating-Blend strategies -- hidden
                        entirely for personalRatingThenDate (today's
                        default), avoiding an irrelevant control most of the
                        time (this spec's Design Decisions). */}
                    {state.sourceRankingStrategy !==
                      'personalRatingThenDate' && (
                      <div className={styles.filterFullWidthRow}>
                        <RatingSourceChips
                          selected={state.sourceRatingBlendSources}
                          onChange={(next) =>
                            updateState({ sourceRatingBlendSources: next })
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* FRONTEND-093-AC-01: plain decorative divider separating the
                  "Filter My Series" and "Source Ranking Strategy" disclosures
                  from the Series picker below -- previously ran directly
                  into it with no visual break. */}
              <div
                className={styles.sectionDivider}
                data-testid="specific-series-divider"
              />

              <KeywordPicker
                id="specific-series-picker"
                label="Series"
                selected={state.selectedSeriesIds}
                onChange={handleSpecificSeriesSelectionChange}
                options={specificSeriesOptions}
                placeholder="Type to search your series"
                maxSuggestionsWhenEmpty={SPECIFIC_SERIES_PICKER_LIMIT}
                // FRONTEND-077-AC-05: the "Show all series" modal below is
                // now the sole place to type/search for this field -- the
                // inline field only shows what's already selected.
                hideInput
              />

              {/* FRONTEND-051-AC-01/02/03: bulk select/clear the picker's
                  current candidate pool -- neither button calls
                  onQueryChange directly, both only update pending
                  ControlsState via updateState, staying behind the existing
                  Apply Filters gate (frontend_spec_040) like every other
                  Specific-Series-picker interaction. */}
              <div className={styles.bulkSelectRow}>
                <button
                  type="button"
                  className={styles.browseSeriesButton}
                  disabled={specificSeriesCandidatePool.length === 0}
                  onClick={() =>
                    updateState({
                      selectedSeriesIds: specificSeriesCandidatePool.map(
                        (s) => s.id,
                      ),
                    })
                  }
                >
                  Select all
                </button>
                <button
                  type="button"
                  className={styles.browseSeriesButton}
                  disabled={state.selectedSeriesIds.length === 0}
                  onClick={() => updateState({ selectedSeriesIds: [] })}
                >
                  Clear all
                </button>
              </div>

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
                className={`${styles.doneButton} ${btn.btnPrimary}`}
                onClick={() => setSpecificSeriesBrowseModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FRONTEND-077-AC-07: new "Browse all keywords" modal, paired with
          the Keywords filter field above -- copies the "Browse Series" modal
          just above verbatim in shape (overlay, role="dialog", aria-modal,
          Escape-to-dismiss, heading, full KeywordPicker, Done button). */}
      {specificSeriesKeywordsBrowseModalOpen && (
        <div className={styles.overlay}>
          {/* A native <dialog> needs showModal()/close() lifecycle management (focus trap, native backdrop) to behave correctly, not just a tag swap -- deliberately not converted here, mirroring SearchFilter.tsx's "Browse all keywords" modal (jsdom's <dialog> support has known gaps). */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior, matching SearchFilter.tsx's "Browse all keywords" modal; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
          <div // NOSONAR: typescript:S6819, see comment above
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="browse-specific-series-keywords-heading"
            onKeyDown={handleSpecificSeriesKeywordsModalKeyDown}
          >
            <h2
              id="browse-specific-series-keywords-heading"
              className={styles.dialogHeading}
            >
              Browse Keywords
            </h2>

            <KeywordPicker
              id="browse-specific-series-keywords"
              label="Keywords"
              selected={specificSeriesKeywordsFilter}
              onChange={setSpecificSeriesKeywordsFilter}
              options={keywordOptions}
              placeholder="Type to filter tracked keywords"
              focusOnMount
              // FRONTEND-077-AC-07: no maxSuggestionsWhenEmpty here -- this
              // modal is the dedicated "browse everything" surface, so it
              // intentionally omits the cap the inline field uses.
            />

            <div className={styles.dialogActions}>
              <button
                type="button"
                className={`${styles.doneButton} ${btn.btnPrimary}`}
                onClick={() => setSpecificSeriesKeywordsBrowseModalOpen(false)}
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
