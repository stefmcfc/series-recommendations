import { useState, useEffect, useCallback } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'
import { formatRelativeTime } from '../utils/relativeTime'
import { formatCountryName } from '../utils/countryName'
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

function formatProductionStatus(value: string | null): string {
  if (value == null) return '—'
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function buildRefreshSummary(
  omdbRefreshed: boolean,
  tmdbRefreshed: boolean,
): string {
  if (omdbRefreshed && tmdbRefreshed) {
    return 'Ratings and production status updated.'
  }
  if (omdbRefreshed) {
    return 'Ratings updated.'
  }
  if (tmdbRefreshed) {
    return 'Production status updated.'
  }
  return 'No new data available.'
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
  const [posterError, setPosterError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshSummary, setRefreshSummary] = useState<string | null>(null)
  const [acknowledging, setAcknowledging] = useState(false)
  const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null)
  const [rewatchError, setRewatchError] = useState<string | null>(null)

  if (fetchedForId !== id) {
    setFetchedForId(id)
    setSeries(null)
    setLoading(true)
    setError(null)
    setNotFound(false)
    setPosterError(false)
    setRefreshing(false)
    setRefreshError(null)
    setRefreshSummary(null)
    setAcknowledging(false)
    setAcknowledgeError(null)
    setRewatchError(null)
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

  const handleRefreshClick = () => {
    setRefreshError(null)
    setRefreshSummary(null)
    setRefreshing(true)

    seriesApi
      .refresh(id)
      .then((result) => {
        setRefreshing(false)
        setSeries(result.series)
        setRefreshSummary(
          buildRefreshSummary(result.omdbRefreshed, result.tmdbRefreshed),
        )
      })
      .catch((err: unknown) => {
        setRefreshing(false)
        if (err instanceof ApiError) {
          setRefreshError(err.message)
        } else {
          setRefreshError('An unexpected error occurred. Please try again.')
        }
      })
  }

  const handleDismissNewContentClick = () => {
    setAcknowledgeError(null)
    setAcknowledging(true)

    seriesApi
      .acknowledgeNewContent(id)
      .then((updated) => {
        setAcknowledging(false)
        setSeries(updated)
      })
      .catch((err: unknown) => {
        setAcknowledging(false)
        if (err instanceof ApiError) {
          setAcknowledgeError(err.message)
        } else {
          setAcknowledgeError('An unexpected error occurred. Please try again.')
        }
      })
  }

  const handleRewatchToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!series) return
    const previousValue = series.flaggedForRewatch
    const nextValue = event.target.checked

    setRewatchError(null)
    setSeries((prev) =>
      prev ? { ...prev, flaggedForRewatch: nextValue } : prev,
    )

    seriesApi
      .update(id, { flaggedForRewatch: nextValue })
      .catch((err: unknown) => {
        setSeries((prev) =>
          prev ? { ...prev, flaggedForRewatch: previousValue } : prev,
        )
        if (err instanceof ApiError) {
          setRewatchError(err.message)
        } else {
          setRewatchError('An unexpected error occurred. Please try again.')
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
          <div className={styles.headingRow}>
            <h2 className={styles.heading}>
              {series.year != null
                ? `${series.title} (${series.year})`
                : series.title}
            </h2>
            {series.originCountry != null && (
              <span className={styles.country}>
                {' | '}
                {formatCountryName(series.originCountry)}
              </span>
            )}
          </div>

          <div className={styles.content}>
            {series.posterUrl !== null && !posterError && (
              <img
                src={series.posterUrl}
                alt=""
                className={styles.poster}
                onError={() => setPosterError(true)}
              />
            )}

            <dl className={styles.fields}>
              <div className={`${styles.field} ${styles.overviewField}`}>
                <dt>Overview</dt>
                <dd>{formatValue(series.overview)}</dd>
              </div>
              <div className={styles.field}>
                <dt>Genres</dt>
                <dd>{formatValue(series.genres)}</dd>
              </div>
              <div className={styles.field}>
                <dt>Tags</dt>
                <dd>{formatValue(series.tags)}</dd>
              </div>
              <div className={`${styles.field} ${styles.keywordsField}`}>
                <dt>Keywords</dt>
                <dd>
                  {(series.keywords ?? []).length === 0
                    ? '—'
                    : series.keywords.map((keyword) => (
                        <span key={keyword} className={styles.keywordChip}>
                          {keyword}
                        </span>
                      ))}
                </dd>
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
              {series.status !== SeriesStatus.COMPLETED && (
                <>
                  <div className={styles.field}>
                    <dt>Current Season</dt>
                    <dd>{formatValue(series.currentSeason)}</dd>
                  </div>
                  <div className={styles.field}>
                    <dt>Current Episode</dt>
                    <dd>{formatValue(series.currentEpisode)}</dd>
                  </div>
                </>
              )}
              <div className={styles.field}>
                <dt>IMDb Rating</dt>
                <dd>{formatValue(series.imdbRating)}</dd>
              </div>
              <div className={styles.field}>
                <dt>Rotten Tomatoes Rating</dt>
                <dd>{formatValue(series.rottenTomatoesRating)}</dd>
              </div>
              <div className={styles.field}>
                <dt>TMDB Rating</dt>
                <dd>{formatValue(series.tmdbRating)}</dd>
              </div>
              <div className={styles.field}>
                <dt>TMDB Vote Count</dt>
                <dd>{formatValue(series.tmdbVoteCount)}</dd>
              </div>
              <div className={styles.field}>
                <dt>Production Status</dt>
                <dd>{formatProductionStatus(series.productionStatus)}</dd>
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
          </div>

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
              <button
                type="button"
                className={styles.refreshButton}
                data-testid="refresh-series-btn"
                disabled={refreshing}
                onClick={handleRefreshClick}
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              {series.lastRefreshedAt !== null && (
                <span className={styles.lastRefreshed}>
                  Last refreshed {formatRelativeTime(series.lastRefreshedAt)}
                </span>
              )}
              {series.newContentDetectedAt !== null && (
                <>
                  <span
                    className={styles.newContentBadge}
                    data-testid="new-content-badge"
                  >
                    New content
                  </span>
                  <button
                    type="button"
                    className={styles.dismissNewContentButton}
                    data-testid="dismiss-new-content-btn"
                    disabled={acknowledging}
                    onClick={handleDismissNewContentClick}
                  >
                    {acknowledging ? 'Dismissing...' : 'Dismiss'}
                  </button>
                </>
              )}
              {series.status === SeriesStatus.COMPLETED && (
                <label className={styles.rewatchToggle}>
                  <input
                    type="checkbox"
                    aria-label="Flag for rewatch"
                    checked={series.flaggedForRewatch}
                    onChange={handleRewatchToggle}
                  />
                  Flag for rewatch
                </label>
              )}
            </div>
          )}

          {rewatchError && (
            <div className={styles.error} role="alert">
              <p>{rewatchError}</p>
            </div>
          )}
          {refreshError && (
            <div className={styles.error} role="alert">
              <p>{refreshError}</p>
            </div>
          )}
          {refreshSummary && (
            <p className={styles.refreshSummary}>{refreshSummary}</p>
          )}
          {acknowledgeError && (
            <div className={styles.error} role="alert">
              <p>{acknowledgeError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
