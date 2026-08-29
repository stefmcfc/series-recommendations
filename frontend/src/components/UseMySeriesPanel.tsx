import { useState } from 'react'
import type { Series } from '../types/series'
import { KeywordPicker } from './KeywordPicker'
import type { PickerOption } from './KeywordPicker'
import { SPECIFIC_SERIES_PICKER_LIMIT } from '../utils/keywordSuggestions'
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
}: UseMySeriesPanelProps) {
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
                            checked={specificSeriesGenreFilter.includes(genre)}
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
                        checked={specificSeriesStatusFilter === 'completedOnly'}
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
