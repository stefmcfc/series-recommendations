import { useState, useEffect, useCallback } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { Series } from '../types/series'
import styles from './SeriesList.module.css'

interface SeriesListProps {
  onSeriesClick?: (id: string) => void
  onAddClick?: () => void
  onEditClick?: (series: Series) => void
}

export function SeriesList({
  onSeriesClick,
  onAddClick,
  onEditClick,
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

  useEffect(() => {
    let cancelled = false

    seriesApi
      .getAll()
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
  }, [refreshIndex])

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
      return
    }
    if (
      (event.key === 'Enter' || event.key === ' ') &&
      confirmingDeleteId !== id
    ) {
      event.preventDefault()
      onSeriesClick?.(id)
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
          <p>No series yet.</p>
          <button
            type="button"
            className={styles.addButton}
            data-testid="add-series-btn"
            aria-label="Add new series"
            onClick={() => onAddClick?.()}
          >
            Add your first series
          </button>
        </div>
      )}

      {!loading && !error && series.length > 0 && (
        <ul className={styles.list}>
          {series.map((s) => (
            <li
              key={s.id}
              className={styles.row}
              data-testid="series-row"
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- spec (frontend_spec_002.md, Requirement 7) requires role="button" and data-testid="series-row" on the same <li>; keyboard/focus support (tabIndex, onKeyDown) makes it a valid interactive element despite the static check.
              role="button"
              tabIndex={0}
              onClick={() => handleRowClick(s.id)}
              onKeyDown={(e) => handleRowKeyDown(e, s.id)}
            >
              <span className={styles.title}>{s.title}</span>
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
