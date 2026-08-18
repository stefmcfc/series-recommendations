import { useState, useEffect, useCallback } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { Series } from '../types/series'
import styles from './SeriesDetail.module.css'

interface SeriesDetailProps {
  id: string
  onBack: () => void
  onDeleted: () => void
  onEditClick?: (series: Series) => void
}

function formatValue(value: string | number | null): string {
  return value === null ? '—' : String(value)
}

function formatDate(value: string | null): string {
  if (value === null) return '—'
  return new Date(value).toLocaleDateString()
}

export function SeriesDetail({
  id,
  onBack,
  onDeleted,
  onEditClick,
}: SeriesDetailProps) {
  const [series, setSeries] = useState<Series | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [fetchedForId, setFetchedForId] = useState(id)

  if (fetchedForId !== id) {
    setFetchedForId(id)
    setSeries(null)
    setLoading(true)
    setError(null)
    setNotFound(false)
  }

  useEffect(() => {
    let cancelled = false

    seriesApi
      .getById(id)
      .then((data) => {
        if (cancelled) return
        setSeries(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setError('Failed to load series. Please try again.')
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, refreshIndex])

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(null)
    setRefreshIndex((index) => index + 1)
  }, [])

  const handleEditClick = () => {
    if (series) {
      onEditClick?.(series)
    }
  }

  const handleDeleteClick = () => {
    setDeleteError(null)
    setConfirmingDelete(true)
  }

  const handleCancelDelete = () => {
    setConfirmingDelete(false)
    setDeleteError(null)
  }

  const handleConfirmDelete = () => {
    setDeleteError(null)
    setDeleting(true)

    seriesApi
      .delete(id)
      .then(() => {
        setDeleting(false)
        setConfirmingDelete(false)
        onDeleted()
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

  const backButton = (
    <button
      type="button"
      className={styles.backButton}
      data-testid="back-btn"
      onClick={onBack}
    >
      Back to series list
    </button>
  )

  return (
    <div className={styles.container}>
      {backButton}

      {loading && (
        <div className={styles.loading} role="status">
          <span>Loading series details...</span>
        </div>
      )}

      {!loading && notFound && (
        <div className={styles.notFound}>
          <p>Series not found.</p>
        </div>
      )}

      {!loading && !notFound && error && (
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

      {!loading && !notFound && !error && series && (
        <div className={styles.detail}>
          <h2 className={styles.heading}>{series.title}</h2>

          <dl className={styles.fields}>
            <div className={styles.field}>
              <dt>Year</dt>
              <dd>{formatValue(series.year)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Genres</dt>
              <dd>{formatValue(series.genres)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Status</dt>
              <dd>{series.status}</dd>
            </div>
            <div className={styles.field}>
              <dt>Total Seasons</dt>
              <dd>{formatValue(series.totalSeasons)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Total Episodes</dt>
              <dd>{formatValue(series.totalEpisodes)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Current Season</dt>
              <dd>{formatValue(series.currentSeason)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Current Episode</dt>
              <dd>{formatValue(series.currentEpisode)}</dd>
            </div>
            <div className={styles.field}>
              <dt>IMDb Rating</dt>
              <dd>{formatValue(series.imdbRating)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Metacritic Rating</dt>
              <dd>{formatValue(series.metacriticRating)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Rotten Tomatoes Rating</dt>
              <dd>{formatValue(series.rottenTomatoesRating)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Personal Rating</dt>
              <dd>{formatValue(series.personalRating)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Personal Notes</dt>
              <dd>{formatValue(series.personalNotes)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Date Added</dt>
              <dd>{formatDate(series.dateAdded)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Date Completed</dt>
              <dd>{formatDate(series.dateCompleted)}</dd>
            </div>
          </dl>

          {confirmingDelete ? (
            <div className={styles.actions}>
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
                onClick={handleConfirmDelete}
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
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.editButton}
                data-testid="edit-series-btn"
                onClick={handleEditClick}
              >
                Edit
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                data-testid="delete-series-btn"
                onClick={handleDeleteClick}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
