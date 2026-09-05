import { useState, useEffect } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { KeywordStat, KeywordStatsOptions } from '../types/series'
import styles from './KeywordsView.module.css'

type SortBy = KeywordStatsOptions['sortBy']
type SortDirection = 'asc' | 'desc'

// FRONTEND-086-AC-09/10/SERIES-047-AC-07: each sortable field's established
// default direction when sortDirection is omitted -- used here purely to
// compute the toggle's starting point and the direction indicator, not sent
// to the backend unless the user has actually toggled (see buildFetchOptions
// below, which only includes sortDirection once it's explicitly set).
const DEFAULT_SORT_DIRECTION: Record<
  Exclude<SortBy, undefined>,
  SortDirection
> = {
  seriesCount: 'desc',
  averagePersonalRating: 'desc',
  averageBlendedRating: 'desc',
  name: 'asc',
}

interface FilterInputs {
  minSeriesCount: string
  minAveragePersonalRating: string
  minAverageBlendedRating: string
}

const emptyFilterInputs: FilterInputs = {
  minSeriesCount: '',
  minAveragePersonalRating: '',
  minAverageBlendedRating: '',
}

function formatAverage(value: number | null): string {
  return value === null ? '—' : String(value)
}

// FRONTEND-086-AC-06: a blank filter field is omitted entirely (not sent as
// 0) -- leaving all three blank reduces this to {}.
function buildFetchOptions(
  sortBy: SortBy,
  sortDirection: SortDirection | undefined,
  appliedFilters: FilterInputs,
): KeywordStatsOptions {
  const options: KeywordStatsOptions = {}
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
  return options
}

export function KeywordsView() {
  const [stats, setStats] = useState<KeywordStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>(undefined)
  const [sortDirection, setSortDirection] = useState<SortDirection | undefined>(
    undefined,
  )

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

    seriesApi
      .getKeywordStats(options)
      .then((data) => {
        if (cancelled) return
        setStats(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load keyword stats. Please try again.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sortBy, sortDirection, appliedFilters, applyVersion])

  const handleSortChange = (column: Exclude<SortBy, undefined>) => {
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
    (field: keyof FilterInputs) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFilterInputs((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const handleApplyFilters = () => {
    setLoading(true)
    setError(null)
    setAppliedFilters(filterInputs)
    setApplyVersion((v) => v + 1)
  }

  const sortIndicator = (column: Exclude<SortBy, undefined>): string => {
    if (sortBy !== column) return ''
    const direction = sortDirection ?? DEFAULT_SORT_DIRECTION[column]
    return direction === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <div className={styles.container} data-testid="keywords-view">
      <h2 className={styles.heading}>Keywords</h2>

      <div className={styles.filters}>
        <div className={styles.filterField}>
          <label htmlFor="keywords-min-series-count">Min Series Count</label>
          <input
            id="keywords-min-series-count"
            type="number"
            min="0"
            value={filterInputs.minSeriesCount}
            onChange={handleFilterInputChange('minSeriesCount')}
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor="keywords-min-avg-personal-rating">
            Min Avg Personal Rating
          </label>
          <input
            id="keywords-min-avg-personal-rating"
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={filterInputs.minAveragePersonalRating}
            onChange={handleFilterInputChange('minAveragePersonalRating')}
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor="keywords-min-avg-blended-rating">
            Min Avg Blended Rating
          </label>
          <input
            id="keywords-min-avg-blended-rating"
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={filterInputs.minAverageBlendedRating}
            onChange={handleFilterInputChange('minAverageBlendedRating')}
          />
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
          <span>Loading keyword stats...</span>
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
                {`Keyword${sortIndicator('name')}`}
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
