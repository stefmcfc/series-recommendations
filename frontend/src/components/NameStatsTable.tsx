import { useState, useEffect } from 'react'
import styles from './NameStatsTable.module.css'

// FRONTEND-088: shared table/filter/sort UI extracted from KeywordsView
// (frontend_spec_086) and GenreStatsView (frontend_spec_088), which had
// near-identical state/effect/handler logic and JSX differing only in
// labels, id prefixes, data-testid, and which seriesApi method to call.
// KeywordsView/GenreStatsView are now thin wrappers passing that config in
// via props -- see each file's own top-level comment.

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
  testId: string
  heading: string
  idPrefix: string
  nameColumnLabel: string
  loadingLabel: string
  errorLabel: string
  fetchStats: (options: NameStatsOptions) => Promise<NameStat[]>
}

// FRONTEND-086-AC-09/10/SERIES-047-AC-07: each sortable field's established
// default direction when sortDirection is omitted -- used here purely to
// compute the toggle's starting point and the direction indicator, not sent
// to the backend unless the user has actually toggled (see buildFetchOptions
// below, which only includes sortDirection once it's explicitly set).
const DEFAULT_SORT_DIRECTION: Record<NameStatsSortBy, NameStatsSortDirection> =
  {
    seriesCount: 'desc',
    averagePersonalRating: 'desc',
    averageBlendedRating: 'desc',
    name: 'asc',
  }

// FRONTEND-095-AC-04: the status-scope select's two option values -- 'all'
// is the default and maps to onlyCompleted being omitted entirely (never
// sent as false); 'completed' maps to onlyCompleted: true.
type StatusScope = 'all' | 'completed'

interface FilterInputs {
  minSeriesCount: string
  minAveragePersonalRating: string
  minAverageBlendedRating: string
  statusScope: StatusScope
}

const emptyFilterInputs: FilterInputs = {
  minSeriesCount: '',
  minAveragePersonalRating: '',
  minAverageBlendedRating: '',
  statusScope: 'all',
}

function formatAverage(value: number | null): string {
  return value === null ? '—' : String(value)
}

// FRONTEND-086-AC-06: a blank filter field is omitted entirely (not sent as
// 0) -- leaving all three blank reduces this to {}.
function buildFetchOptions(
  sortBy: NameStatsSortBy | undefined,
  sortDirection: NameStatsSortDirection | undefined,
  appliedFilters: FilterInputs,
): NameStatsOptions {
  const options: NameStatsOptions = {}
  if (sortBy !== undefined) options.sortBy = sortBy
  if (sortDirection !== undefined) options.sortDirection = sortDirection
  if (appliedFilters.minSeriesCount.trim() !== '')
    options.minSeriesCount = Number(appliedFilters.minSeriesCount)
  if (appliedFilters.minAveragePersonalRating.trim() !== '')
    options.minAveragePersonalRating = Number(
      appliedFilters.minAveragePersonalRating,
    )
  if (appliedFilters.minAverageBlendedRating.trim() !== '')
    options.minAverageBlendedRating = Number(
      appliedFilters.minAverageBlendedRating,
    )
  // FRONTEND-095-AC-05/06: only included when explicitly 'completed' --
  // 'all' (the default, and reverting back to it) omits onlyCompleted
  // entirely rather than sending it as false.
  if (appliedFilters.statusScope === 'completed') options.onlyCompleted = true
  return options
}

export function NameStatsTable({
  testId,
  heading,
  idPrefix,
  nameColumnLabel,
  loadingLabel,
  errorLabel,
  fetchStats,
}: NameStatsTableProps) {
  const [stats, setStats] = useState<NameStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<NameStatsSortBy | undefined>(undefined)
  const [sortDirection, setSortDirection] = useState<
    NameStatsSortDirection | undefined
  >(undefined)

  // FRONTEND-086-AC-05: uncommitted field values the user is currently
  // typing -- distinct from appliedFilters below, which only changes when
  // Apply Filters is clicked (explicit-submit convention, matching
  // SearchFilter).
  const [filterInputs, setFilterInputs] =
    useState<FilterInputs>(emptyFilterInputs)
  const [appliedFilters, setAppliedFilters] =
    useState<FilterInputs>(emptyFilterInputs)
  // FRONTEND-086-AC-05: Apply Filters must always re-fetch, even when the
  // filter values are unchanged from what's already applied (e.g. re-typing
  // the same value, or clicking Apply again with nothing changed) -- an
  // identical appliedFilters object reference wouldn't otherwise trigger the
  // effect below, so a click bumps this counter unconditionally.
  const [applyVersion, setApplyVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    const options = buildFetchOptions(sortBy, sortDirection, appliedFilters)

    fetchStats(options)
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
  }, [
    sortBy,
    sortDirection,
    appliedFilters,
    applyVersion,
    fetchStats,
    errorLabel,
  ])

  const handleSortChange = (column: NameStatsSortBy) => {
    setLoading(true)
    setError(null)
    if (sortBy === column) {
      const currentDirection = sortDirection ?? DEFAULT_SORT_DIRECTION[column]
      setSortDirection(currentDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection(undefined)
    }
  }

  const handleFilterInputChange =
    (field: keyof Omit<FilterInputs, 'statusScope'>) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFilterInputs((prev) => ({ ...prev, [field]: event.target.value }))
    }

  // FRONTEND-095-AC-04: separate from handleFilterInputChange above since the
  // status scope control is a <select> (StatusScope union), not a free-text
  // numeric <input> (string).
  const handleStatusScopeChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const statusScope = event.target.value as StatusScope
    setFilterInputs((prev) => ({ ...prev, statusScope }))
  }

  const handleApplyFilters = () => {
    setLoading(true)
    setError(null)
    setAppliedFilters(filterInputs)
    setApplyVersion((v) => v + 1)
  }

  const sortIndicator = (column: NameStatsSortBy): string => {
    if (sortBy !== column) return ''
    const direction = sortDirection ?? DEFAULT_SORT_DIRECTION[column]
    return direction === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <div className={styles.container} data-testid={testId}>
      <h2 className={styles.heading}>{heading}</h2>

      <div className={styles.filters}>
        <div className={styles.filterField}>
          <label htmlFor={`${idPrefix}-min-series-count`}>
            Min Series Count
          </label>
          <input
            id={`${idPrefix}-min-series-count`}
            type="number"
            min="0"
            value={filterInputs.minSeriesCount}
            onChange={handleFilterInputChange('minSeriesCount')}
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor={`${idPrefix}-min-avg-personal-rating`}>
            Min Avg Personal Rating
          </label>
          <input
            id={`${idPrefix}-min-avg-personal-rating`}
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={filterInputs.minAveragePersonalRating}
            onChange={handleFilterInputChange('minAveragePersonalRating')}
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor={`${idPrefix}-min-avg-blended-rating`}>
            Min Avg Blended Rating
          </label>
          <input
            id={`${idPrefix}-min-avg-blended-rating`}
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={filterInputs.minAverageBlendedRating}
            onChange={handleFilterInputChange('minAverageBlendedRating')}
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor={`${idPrefix}-status-filter`}>Status</label>
          <select
            id={`${idPrefix}-status-filter`}
            value={filterInputs.statusScope}
            onChange={handleStatusScopeChange}
          >
            <option value="all">All Series</option>
            <option value="completed">Completed Only</option>
          </select>
        </div>

        <button
          type="button"
          className={styles.applyButton}
          onClick={handleApplyFilters}
        >
          Apply Filters
        </button>
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
                onClick={() => handleSortChange('name')}
              >
                {`${nameColumnLabel}${sortIndicator('name')}`}
              </th>
              <th
                scope="col"
                className={styles.sortableHeader}
                onClick={() => handleSortChange('seriesCount')}
              >
                {`Series Count${sortIndicator('seriesCount')}`}
              </th>
              <th
                scope="col"
                className={styles.sortableHeader}
                onClick={() => handleSortChange('averagePersonalRating')}
              >
                {`Avg. Personal Rating${sortIndicator('averagePersonalRating')}`}
              </th>
              <th
                scope="col"
                className={styles.sortableHeader}
                onClick={() => handleSortChange('averageBlendedRating')}
              >
                {`Avg. Blended Rating${sortIndicator('averageBlendedRating')}`}
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
