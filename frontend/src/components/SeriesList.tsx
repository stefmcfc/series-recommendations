import { useState, useEffect, useCallback } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { Series, SearchCriteria } from '../types/series'
import styles from './SeriesList.module.css'

interface SeriesListProps {
  onSeriesClick?: (id: string) => void
  onAddClick?: () => void
  onEditClick?: (series: Series) => void
  criteria?: SearchCriteria
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

  const criteriaActive = hasActiveCriteria(criteria)

  useEffect(() => {
    let cancelled = false

    const fetchSeries = criteriaActive
      ? seriesApi.search(criteria as SearchCriteria)
      : seriesApi.getAll()

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
  }, [refreshIndex, criteria])

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
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.heading}>My Series</h2>
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
              <button
                type="button"
                className={styles.title}
                onClick={() => handleRowClick(s.id)}
              >
                {s.title}
              </button>
              <span className={styles.status}>{s.status}</span>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
