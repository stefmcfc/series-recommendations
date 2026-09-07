import { useState, useEffect } from 'react'
import type { NameStatsFiltersState } from '../hooks/useNameStatsFilters'
import styles from './NameStatsTable.module.css'
import sharedStyles from './RecommendationControls.module.css'

// FRONTEND-088: shared table/filter/sort UI extracted from KeywordsView
// (frontend_spec_086) and GenreStatsView (frontend_spec_088), which had
// near-identical state/effect/handler logic and JSX differing only in
// labels, id prefixes, data-testid, and which seriesApi method to call.
// KeywordsView/GenreStatsView are now thin wrappers passing that config in
// via props -- see each file's own top-level comment.
//
// FRONTEND-096: filter/sort/panel-open state (previously local useState
// here) now lives in the shared `hooks/useNameStatsFilters.ts` hook,
// instantiated once by AnalysisView and passed down as the `filters` prop --
// this is what lets that state survive a tab switch instead of being
// discarded on unmount. This component still owns its own stats/loading/
// error state and fetch effect (genuinely per-tab, not shared). The filters
// UI itself is now a collapsed-by-default disclosure box reusing
// RecommendationControls.module.css's `.filtersSection`/`.filtersToggle`/
// `.filtersBody`/`.field`/`.filtersActions`/`.applyButton`/`.resetButton`
// classes (already shared by RecommendationFiltersBox/UseMySeriesPanel)
// rather than this component's own previously-unstyled equivalents.

export type NameStatsSortBy =
  'seriesCount' | 'averagePersonalRating' | 'averageBlendedRating' | 'name'
export type NameStatsSortDirection = 'asc' | 'desc'

export interface NameStat {
  name: string
  seriesCount: number
  averagePersonalRating: number | null
  averageBlendedRating: number | null
}

export interface NameStatsOptions {
  sortBy?: NameStatsSortBy
  sortDirection?: NameStatsSortDirection
  minSeriesCount?: number
  minAveragePersonalRating?: number
  minAverageBlendedRating?: number
  // FRONTEND-095-AC-01/SERIES-051: restricts the table to COMPLETED series
  // only -- omitted (never sent as false) unless the "Completed Only" status
  // scope option is selected and applied.
  onlyCompleted?: boolean
}

export interface NameStatsTableProps {
  readonly testId: string
  readonly heading: string
  readonly idPrefix: string
  readonly nameColumnLabel: string
  readonly loadingLabel: string
  readonly errorLabel: string
  readonly fetchStats: (options: NameStatsOptions) => Promise<NameStat[]>
  // FRONTEND-096-AC-10: supplied by AnalysisView via a single
  // useNameStatsFilters() instance shared across all three /analysis
  // sub-tabs.
  readonly filters: NameStatsFiltersState
}

function formatAverage(value: number | null): string {
  return value === null ? '—' : String(value)
}

export function NameStatsTable({
  testId,
  heading,
  idPrefix,
  nameColumnLabel,
  loadingLabel,
  errorLabel,
  fetchStats,
  filters,
}: NameStatsTableProps) {
  const [stats, setStats] = useState<NameStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // FRONTEND-096: previously this setLoading(true)/setError(null) pair
    // lived in the click handlers themselves (handleSortChange/
    // handleApplyFilters), which owned this state directly. Now that
    // filter/sort state has moved into useNameStatsFilters (shared across
    // tabs, see that hook's own comments), those handlers no longer own
    // loading/error -- setting them here, at the top of every re-run of this
    // fetch effect, reproduces the same "loading again on every new
    // sort/filter" behavior. Same standard React "fetch on dependency
    // change" shape already established at RecommendationsList.tsx's
    // identical fetch effect (see that file's own comment for the full
    // rationale for why this can't be avoided without a bigger refactor).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setLoading(true)
    setError(null)

    fetchStats(filters.options)
      .then((data) => {
        if (cancelled) return
        setStats(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(errorLabel)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filters.options, filters.applyVersion, fetchStats, errorLabel])

  return (
    <div className={styles.container} data-testid={testId}>
      <h2 className={styles.heading}>{heading}</h2>

      <div className={sharedStyles.filtersSection}>
        <button
          type="button"
          className={sharedStyles.filtersToggle}
          aria-expanded={filters.filtersOpen}
          onClick={filters.handleToggleFiltersOpen}
        >
          Analysis Filters
          {filters.activeFilterCount > 0 && (
            <span
              className={sharedStyles.filtersActiveBadge}
              data-testid="filters-active-count"
            >
              {filters.activeFilterCount}
            </span>
          )}
        </button>

        {filters.filtersOpen && (
          <div className={sharedStyles.filtersBody} data-testid="filters-body">
            <div className={sharedStyles.field}>
              <label htmlFor={`${idPrefix}-min-series-count`}>
                Min Series Count
              </label>
              <input
                id={`${idPrefix}-min-series-count`}
                type="number"
                min="0"
                value={filters.filterInputs.minSeriesCount}
                onChange={filters.handleFilterInputChange('minSeriesCount')}
              />
            </div>

            <div className={sharedStyles.field}>
              <label htmlFor={`${idPrefix}-min-avg-personal-rating`}>
                Min Avg Personal Rating
              </label>
              <input
                id={`${idPrefix}-min-avg-personal-rating`}
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={filters.filterInputs.minAveragePersonalRating}
                onChange={filters.handleFilterInputChange(
                  'minAveragePersonalRating',
                )}
              />
            </div>

            <div className={sharedStyles.field}>
              <label htmlFor={`${idPrefix}-min-avg-blended-rating`}>
                Min Avg Blended Rating
              </label>
              <input
                id={`${idPrefix}-min-avg-blended-rating`}
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={filters.filterInputs.minAverageBlendedRating}
                onChange={filters.handleFilterInputChange(
                  'minAverageBlendedRating',
                )}
              />
            </div>

            <div className={sharedStyles.field}>
              <label htmlFor={`${idPrefix}-status-filter`}>Status</label>
              <select
                id={`${idPrefix}-status-filter`}
                value={filters.filterInputs.statusScope}
                onChange={filters.handleStatusScopeChange}
              >
                <option value="all">All Series</option>
                <option value="completed">Completed Only</option>
              </select>
            </div>

            <div className={sharedStyles.filtersActions}>
              <button
                type="button"
                className={sharedStyles.resetButton}
                data-testid="reset-filters-btn"
                onClick={filters.handleResetFilters}
              >
                Reset Filters
              </button>
              <button
                type="button"
                className={sharedStyles.applyButton}
                onClick={filters.handleApplyFilters}
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <output className={styles.loading} aria-label="Loading">
          <span>{loadingLabel}</span>
        </output>
      )}

      {!loading && error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th
                scope="col"
                className={styles.sortableHeader}
                onClick={() => filters.handleSortChange('name')}
              >
                {`${nameColumnLabel}${filters.sortIndicator('name')}`}
              </th>
              <th
                scope="col"
                className={styles.sortableHeader}
                onClick={() => filters.handleSortChange('seriesCount')}
              >
                {`Series Count${filters.sortIndicator('seriesCount')}`}
              </th>
              <th
                scope="col"
                className={styles.sortableHeader}
                onClick={() =>
                  filters.handleSortChange('averagePersonalRating')
                }
              >
                {`Avg. Personal Rating${filters.sortIndicator('averagePersonalRating')}`}
              </th>
              <th
                scope="col"
                className={styles.sortableHeader}
                onClick={() => filters.handleSortChange('averageBlendedRating')}
              >
                {`Avg. Blended Rating${filters.sortIndicator('averageBlendedRating')}`}
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.name}>
                <td>{stat.name}</td>
                <td>{stat.seriesCount}</td>
                <td>{formatAverage(stat.averagePersonalRating)}</td>
                <td>{formatAverage(stat.averageBlendedRating)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
