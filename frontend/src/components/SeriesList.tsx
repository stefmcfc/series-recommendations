import { useState, useEffect, useCallback } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type {
  Series,
  SearchCriteria,
  RefreshJobStatus,
  SortOptions,
} from '../types/series'
import { formatRelativeTime } from '../utils/relativeTime'
import { formatCountryName } from '../utils/countryName'
import styles from './SeriesList.module.css'

interface SeriesListProps {
  onSeriesClick?: (id: string) => void
  onAddClick?: () => void
  onEditClick?: (series: Series) => void
  criteria?: SearchCriteria
}

// FRONTEND-013-AC-12: sort field options, in display order. Extended by
// Requirement 5 (FRONTEND-013-AC-14/15) with title/year/imdbRating/tmdbRating
// alongside the original dateAdded/personalRating pair.
type SortByOption = NonNullable<SortOptions['sortBy']>
type SortDirection = NonNullable<SortOptions['sortDirection']>

const SORT_BY_OPTIONS: { value: SortByOption; label: string }[] = [
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'personalRating', label: 'Personal Rating' },
  { value: 'title', label: 'Title' },
  { value: 'year', label: 'Year' },
  { value: 'imdbRating', label: 'IMDb Rating' },
  { value: 'tmdbRating', label: 'TMDB Rating' },
]

// Matches the backend's own default (series_spec_009_rating_sort.md,
// SERIES-009-AC-06) -- when the control is at its default, no sort argument
// is passed through to getAll()/search() at all (see buildSortParam below).
const DEFAULT_SORT_BY: SortByOption = 'dateAdded'
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc'

function buildSortParam(
  sortBy: SortByOption,
  sortDirection: SortDirection,
): SortOptions | undefined {
  if (sortBy === DEFAULT_SORT_BY && sortDirection === DEFAULT_SORT_DIRECTION) {
    return undefined
  }
  return { sortBy, sortDirection }
}

// Within the 2-3s poll cadence called for by FRONTEND-023-AC-12 -- frequent
// enough that a short bulk job's progress feels live, infrequent enough not
// to hammer the status endpoint.
const REFRESH_POLL_INTERVAL_MS = 2500

function buildRefreshProgressText(status: RefreshJobStatus): string {
  const skippedSuffix =
    status.skippedCount > 0 ? ` (${status.skippedCount} skipped)` : ''
  return `Refreshing ${status.completedCount} of ${status.totalCount}${skippedSuffix}...`
}

function buildLastFullRefreshText(status: RefreshJobStatus): string {
  const finishedAt = status.finishedAt as string
  const skippedSuffix =
    status.skippedCount > 0
      ? ` (${status.skippedCount} skipped, already up to date)`
      : ''
  return `Last full refresh: ${formatRelativeTime(finishedAt)}${skippedSuffix}`
}

function hasActiveCriteria(criteria?: SearchCriteria): boolean {
  if (!criteria) return false
  return Object.values(criteria).some((value) => {
    if (value == null) return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'string') return value !== ''
    if (typeof value === 'boolean') return value === true
    return true
  })
}

export function SeriesList({
  onSeriesClick,
  onAddClick,
  onEditClick,
  criteria,
}: SeriesListProps) {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [posterErrorIds, setPosterErrorIds] = useState<Set<string>>(new Set())
  const [jobStatus, setJobStatus] = useState<RefreshJobStatus | null>(null)
  const [refreshAllError, setRefreshAllError] = useState<string | null>(null)
  // FRONTEND-012-AC-12/14: per-row rewatch toggle errors, keyed by series id
  // -- mirrors RecommendationsList's per-card scoped-error pattern
  // (FRONTEND-010-AC-17) since more than one row's toggle can be in flight.
  const [rewatchErrors, setRewatchErrors] = useState<Record<string, string>>({})
  // FRONTEND-013-AC-12: sort state lives here, local to the list -- see the
  // spec's Design Decisions for why this isn't lifted into App.tsx/SearchFilter.
  const [sortBy, setSortBy] = useState<SortByOption>(DEFAULT_SORT_BY)
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_SORT_DIRECTION,
  )

  const criteriaActive = hasActiveCriteria(criteria)
  const refreshAllInProgress = jobStatus?.status === 'IN_PROGRESS'

  useEffect(() => {
    let cancelled = false

    // FRONTEND-013-AC-13/16: whichever of getAll()/search() is active per
    // criteriaActive gets the current sortBy/sortDirection.
    const sortParam = buildSortParam(sortBy, sortDirection)
    const fetchSeries = criteriaActive
      ? seriesApi.search(criteria as SearchCriteria, sortParam)
      : seriesApi.getAll(sortParam)

    fetchSeries
      .then((data) => {
        if (cancelled) return
        setSeries(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load series. Please try again.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- criteriaActive is derived from criteria; including both is redundant and would cause criteria's object identity to trigger duplicate re-fetches.
  }, [refreshIndex, criteria, sortBy, sortDirection])

  // FRONTEND-023-AC-11: check once on mount so a page reload mid-batch
  // resumes the disabled/polling state instead of showing a stale enabled
  // button.
  useEffect(() => {
    let cancelled = false

    seriesApi
      .getRefreshStatus()
      .then((status) => {
        if (cancelled) return
        setJobStatus(status)
      })
      .catch(() => {
        // Non-critical background check -- leave the button in its default
        // enabled state if the status endpoint itself is unreachable.
      })

    return () => {
      cancelled = true
    }
  }, [])

  // FRONTEND-023-AC-12/13: poll while a bulk job is in progress, whether
  // just started by this click or discovered on mount. Stops itself (via
  // effect cleanup) once jobStatus.status is no longer IN_PROGRESS.
  useEffect(() => {
    if (!refreshAllInProgress) return

    const intervalId = setInterval(() => {
      seriesApi
        .getRefreshStatus()
        .then((status) => {
          setJobStatus(status)
          if (status.status !== 'IN_PROGRESS') {
            setRefreshIndex((index) => index + 1)
          }
        })
        .catch(() => {
          // Transient poll failure -- keep polling on the next tick rather
          // than surfacing an error for a background check.
        })
    }, REFRESH_POLL_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [refreshAllInProgress])

  const handleRefreshAllClick = () => {
    setRefreshAllError(null)

    seriesApi
      .refreshAll()
      .then((status) => {
        setJobStatus(status)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 409) {
          // FRONTEND-023-AC-14: a job is already running server-side --
          // reflect that the same way a mount-time discovery would, rather
          // than surfacing it as a user-facing error.
          setJobStatus({
            status: 'IN_PROGRESS',
            totalCount: 0,
            completedCount: 0,
            skippedCount: 0,
            startedAt: null,
            finishedAt: null,
          })
          return
        }
        if (err instanceof ApiError) {
          setRefreshAllError(err.message)
        } else {
          setRefreshAllError('An unexpected error occurred. Please try again.')
        }
      })
  }

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(null)
    setRefreshIndex((index) => index + 1)
  }, [])

  const handleRowClick = (id: string) => {
    if (confirmingDeleteId === id) return
    onSeriesClick?.(id)
  }

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLLIElement>,
    id: string,
  ) => {
    if (event.key === 'Escape' && confirmingDeleteId === id) {
      setConfirmingDeleteId(null)
      setDeleteError(null)
    }
  }

  const handleEditClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    s: Series,
  ) => {
    event.stopPropagation()
    onEditClick?.(s)
  }

  const handleDeleteClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    event.stopPropagation()
    setDeleteError(null)
    setConfirmingDeleteId(id)
  }

  const handleSortByChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(event.target.value as SortByOption)
  }

  const handleSortDirectionToggle = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
  }

  const handlePosterError = (id: string) => {
    setPosterErrorIds((prev) => new Set(prev).add(id))
  }

  const handleRewatchToggle = (id: string, previousValue: boolean) => {
    const nextValue = !previousValue
    setRewatchErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setSeries((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, flaggedForRewatch: nextValue } : s,
      ),
    )

    seriesApi
      .update(id, { flaggedForRewatch: nextValue })
      .catch((err: unknown) => {
        setSeries((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, flaggedForRewatch: previousValue } : s,
          ),
        )
        const message =
          err instanceof ApiError
            ? err.message
            : 'An unexpected error occurred. Please try again.'
        setRewatchErrors((prev) => ({ ...prev, [id]: message }))
      })
  }

  const handleCancelDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setConfirmingDeleteId(null)
    setDeleteError(null)
  }

  const handleConfirmDelete = (
    event: React.MouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    event.stopPropagation()
    setDeleteError(null)
    setDeleting(true)

    seriesApi
      .delete(id)
      .then(() => {
        setDeleting(false)
        setConfirmingDeleteId(null)
        setSeries((prev) => prev.filter((item) => item.id !== id))
      })
      .catch((err: unknown) => {
        setDeleting(false)
        if (err instanceof ApiError) {
          setDeleteError(err.message)
        } else {
          setDeleteError('An unexpected error occurred. Please try again.')
        }
      })
  }

  return (
    <div className={styles.container} data-testid="series-list">
      <div className={styles.header}>
        <h2 className={styles.heading}>My Series</h2>
        <div className={styles.sortControl}>
          <label htmlFor="series-sort-by" className={styles.sortLabel}>
            Sort by
          </label>
          <select
            id="series-sort-by"
            className={styles.sortSelect}
            aria-label="Sort by"
            value={sortBy}
            onChange={handleSortByChange}
          >
            {SORT_BY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.sortDirectionButton}
            aria-label={
              sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'
            }
            onClick={handleSortDirectionToggle}
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.refreshAllButton}
            data-testid="refresh-all-btn"
            disabled={refreshAllInProgress}
            onClick={handleRefreshAllClick}
          >
            Refresh All
          </button>
          {refreshAllInProgress && jobStatus && (
            <span className={styles.refreshProgress}>
              {buildRefreshProgressText(jobStatus)}
            </span>
          )}
          {jobStatus?.finishedAt != null && (
            <span className={styles.lastFullRefresh}>
              {buildLastFullRefreshText(jobStatus)}
            </span>
          )}
          <button
            type="button"
            className={styles.addButton}
            data-testid="add-series-btn"
            aria-label="Add new series"
            onClick={() => onAddClick?.()}
          >
            Add Series
          </button>
        </div>
      </div>

      {refreshAllError && (
        <div className={styles.error} role="alert">
          <p>{refreshAllError}</p>
        </div>
      )}

      {loading && (
        <div className={styles.loading} role="status" aria-label="Loading">
          <svg
            className={styles.spinner}
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeOpacity="0.25"
            />
            <path
              d="M22 12a10 10 0 0 0-10-10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <span>Loading series...</span>
        </div>
      )}

      {!loading && error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && series.length === 0 && (
        <div className={styles.empty}>
          <p>
            {criteriaActive
              ? 'No series match your filters.'
              : 'No series yet.'}
          </p>
          {!criteriaActive && (
            <button
              type="button"
              className={styles.addButton}
              data-testid="add-series-btn"
              aria-label="Add new series"
              onClick={() => onAddClick?.()}
            >
              Add your first series
            </button>
          )}
        </div>
      )}

      {!loading && !error && series.length > 0 && (
        <ul className={styles.list}>
          {series.map((s) => (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-cancels-delete-confirmation (frontend_spec_008.md FRONTEND-008-AC-06) relies on the keydown bubbling up from whichever Confirm/Cancel button currently has focus; the <li> itself is intentionally non-interactive (no role/tabIndex — see frontend_spec_008.md) and isn't a keyboard-interaction target on its own.
            <li
              key={s.id}
              className={styles.row}
              data-testid="series-row"
              onKeyDown={(e) => handleRowKeyDown(e, s.id)}
            >
              <div className={styles.rowPrimary}>
                <div
                  className={styles.thumbnail}
                  data-testid="series-thumbnail"
                >
                  {s.posterUrl !== null && !posterErrorIds.has(s.id) && (
                    <img
                      src={s.posterUrl}
                      alt=""
                      className={styles.thumbnailImage}
                      onError={() => handlePosterError(s.id)}
                    />
                  )}
                </div>
                <div className={styles.titleGroup}>
                  <button
                    type="button"
                    className={styles.title}
                    onClick={() => handleRowClick(s.id)}
                  >
                    {s.year != null ? `${s.title} (${s.year})` : s.title}
                  </button>
                  {s.originCountry != null && (
                    <span className={styles.country}>
                      {' | '}
                      {formatCountryName(s.originCountry)}
                    </span>
                  )}
                </div>
                <span className={styles.rating}>
                  {s.imdbRating !== null ? s.imdbRating : '—'}
                </span>

                {confirmingDeleteId === s.id ? (
                  <div className={styles.rowActions}>
                    {deleteError && (
                      <span className={styles.deleteError} role="alert">
                        {deleteError}
                      </span>
                    )}
                    <button
                      type="button"
                      className={styles.confirmDeleteButton}
                      data-testid="confirm-delete-btn"
                      disabled={deleting}
                      onClick={(e) => handleConfirmDelete(e, s.id)}
                    >
                      {deleting ? 'Deleting...' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      className={styles.cancelDeleteButton}
                      data-testid="cancel-delete-btn"
                      disabled={deleting}
                      onClick={handleCancelDelete}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.editButton}
                      data-testid="edit-series-btn"
                      aria-label={`Edit ${s.title}`}
                      onClick={(e) => handleEditClick(e, s)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.deleteButton}
                      data-testid="delete-series-btn"
                      aria-label={`Delete ${s.title}`}
                      onClick={(e) => handleDeleteClick(e, s.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.rowSecondary}>
                <div className={styles.rowSecondaryLeft}>
                  <span className={styles.status}>{s.status}</span>
                  {s.newContentDetectedAt != null && (
                    <span
                      className={styles.newContentBadge}
                      data-testid="new-content-badge"
                    >
                      New content
                    </span>
                  )}
                </div>

                <div className={styles.rowSecondaryRight}>
                  {s.status === SeriesStatus.COMPLETED && (
                    <button
                      type="button"
                      className={`${styles.rewatchToggle} ${
                        s.flaggedForRewatch ? styles.rewatchToggleActive : ''
                      }`}
                      aria-label="Flag for rewatch"
                      aria-pressed={s.flaggedForRewatch}
                      onClick={() =>
                        handleRewatchToggle(s.id, s.flaggedForRewatch)
                      }
                    >
                      Rewatch
                    </button>
                  )}
                  {rewatchErrors[s.id] && (
                    <span className={styles.rewatchError} role="alert">
                      {rewatchErrors[s.id]}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
