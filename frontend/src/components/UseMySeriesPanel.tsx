import { useState } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import type { Series } from '../types/series'
import { KeywordPicker } from './KeywordPicker'
import type { PickerOption } from './KeywordPicker'
import { SPECIFIC_SERIES_PICKER_LIMIT } from '../utils/keywordSuggestions'
import { GenreIncludeExcludePicker } from './GenreIncludeExcludePicker'
import { StarRating } from './StarRating'
import { MIN_VALID_YEAR, MAX_VALID_YEAR } from '../utils/yearBounds'
import {
  buildSpecificSeriesCandidatePool,
  seriesPickerLabel,
  seriesPickerDisplay,
  SPECIFIC_SERIES_SORT_BY_OPTIONS,
} from './RecommendationControls'
import type {
  ControlsState,
  SpecificSeriesStatusFilter,
  SpecificSeriesSortBy,
  SpecificSeriesSortDirection,
} from './RecommendationControls'
import styles from './RecommendationControls.module.css'

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
  const [specificSeriesMinPersonalRating, setSpecificSeriesMinPersonalRating] =
    useState<number | null>(null)
  const [specificSeriesMinImdbRating, setSpecificSeriesMinImdbRating] =
    useState('')
  const [specificSeriesMinTmdbRating, setSpecificSeriesMinTmdbRating] =
    useState('')
  const [specificSeriesYearMin, setSpecificSeriesYearMin] = useState('')
  const [specificSeriesYearMax, setSpecificSeriesYearMax] = useState('')
  // FRONTEND-081-AC-01: "Filter & sort my series" disclosure, defaulting
  // OPEN (unlike RecommendationFiltersBox's own filtersOpen, which defaults
  // closed) so the new filtering capability isn't buried on first render.
  const [filterSectionOpen, setFilterSectionOpen] = useState(true)

  const handleSpecificSeriesSelectionChange = (next: string[]) => {
    updateState({ selectedSeriesIds: next })
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
  const specificSeriesCandidatePool = buildSpecificSeriesCandidatePool(
    allSeries,
    {
      genreFilter: specificSeriesGenreFilter,
      excludeGenreFilter: specificSeriesExcludeGenreFilter,
      statusFilter: specificSeriesStatusFilter,
      sortBy: specificSeriesSortBy,
      sortDirection: specificSeriesSortDirection,
      keywordsFilter: specificSeriesKeywordsFilter,
      minPersonalRating: specificSeriesMinPersonalRating,
      minImdbRating: specificSeriesMinImdbRating,
      minTmdbRating: specificSeriesMinTmdbRating,
      yearMin: specificSeriesYearMin,
      yearMax: specificSeriesYearMax,
    },
    state.selectedSeriesIds,
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
              {/* FRONTEND-081-AC-01/02: "Filter & sort my series" disclosure
                  -- same collapse/expand mechanics as
                  RecommendationFiltersBox's own toggle, but seeded open
                  (filterSectionOpen defaults true) so the new filtering
                  capability isn't buried. */}
              <div className={styles.filtersSection}>
                <button
                  type="button"
                  className={styles.filtersToggle}
                  aria-expanded={filterSectionOpen}
                  onClick={() => setFilterSectionOpen((open) => !open)}
                >
                  Filter & sort my series
                </button>

                {filterSectionOpen && (
                  <div
                    className={styles.filtersBody}
                    data-testid="specific-series-filters-body"
                  >
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
                        <label htmlFor="specific-series-min-imdb-rating">
                          Min IMDb Rating
                        </label>
                        <input
                          id="specific-series-min-imdb-rating"
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={specificSeriesMinImdbRating}
                          onChange={(event) =>
                            setSpecificSeriesMinImdbRating(event.target.value)
                          }
                        />
                      </div>

                      {/* FRONTEND-081-AC-07: "(My Series)" suffix
                          disambiguates from RecommendationFiltersBox's own
                          unsuffixed "Min TMDB Rating" (post-TMDB, unrelated
                          field). */}
                      <div className={styles.field}>
                        <label htmlFor="specific-series-min-tmdb-rating">
                          Min TMDB Rating (My Series)
                        </label>
                        <input
                          id="specific-series-min-tmdb-rating"
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={specificSeriesMinTmdbRating}
                          onChange={(event) =>
                            setSpecificSeriesMinTmdbRating(event.target.value)
                          }
                        />
                      </div>
                    </div>

                    {/* FRONTEND-081-AC-08: "(My Series)" suffix disambiguates
                        from RecommendationFiltersBox's own unsuffixed "Year
                        Min"/"Year Max" (post-TMDB, unrelated fields). */}
                    <div className={styles.filterFourColGrid}>
                      <div className={styles.field}>
                        <label htmlFor="specific-series-year-min">
                          Year Min (My Series)
                        </label>
                        <input
                          id="specific-series-year-min"
                          type="number"
                          min={MIN_VALID_YEAR}
                          max={MAX_VALID_YEAR}
                          value={specificSeriesYearMin}
                          onChange={(event) =>
                            setSpecificSeriesYearMin(event.target.value)
                          }
                        />
                      </div>

                      <div className={styles.field}>
                        <label htmlFor="specific-series-year-max">
                          Year Max (My Series)
                        </label>
                        <input
                          id="specific-series-year-max"
                          type="number"
                          min={MIN_VALID_YEAR}
                          max={MAX_VALID_YEAR}
                          value={specificSeriesYearMax}
                          onChange={(event) =>
                            setSpecificSeriesYearMax(event.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
                className={styles.doneButton}
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
                className={styles.doneButton}
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
