import { useState, useEffect, useCallback } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { Series, StreamingProvider } from '../types/series'
import { formatCountryName } from '../utils/countryName'
import { formatSeriesYear } from '../utils/formatSeriesYear'
import { toggleRewatchFlag } from '../utils/rewatchToggle'
import { submitDelete } from '../utils/deleteSeries'
import { SeriesDetailFields } from './SeriesDetailFields'
import { SeriesDetailActionsPanel } from './SeriesDetailActionsPanel'
import styles from './SeriesDetail.module.css'

interface SeriesDetailProps {
  readonly id: string
  readonly onBack: () => void
  readonly onDeleted: () => void
  readonly onEditClick?: (series: Series) => void
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
  const [streamingCheckLoading, setStreamingCheckLoading] = useState(false)
  const [streamingCheckError, setStreamingCheckError] = useState<string | null>(
    null,
  )
  const [streamingCheckResult, setStreamingCheckResult] = useState<
    StreamingProvider[] | null
  >(null)

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
    setStreamingCheckLoading(false)
    setStreamingCheckError(null)
    setStreamingCheckResult(null)
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
    submitDelete(id, {
      onStart: () => {
        setDeleteError(null)
        setDeleting(true)
      },
      onSuccess: () => {
        setDeleting(false)
        setConfirmingDelete(false)
        onDeleted()
      },
      onError: (message) => {
        setDeleting(false)
        setDeleteError(message)
      },
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

  const handleRewatchToggle = () => {
    if (!series) return
    const previousValue = series.flaggedForRewatch
    const nextValue = !previousValue

    toggleRewatchFlag(id, nextValue, {
      clearError: () => setRewatchError(null),
      applyOptimistic: () =>
        setSeries((prev) =>
          prev ? { ...prev, flaggedForRewatch: nextValue } : prev,
        ),
      revert: () =>
        setSeries((prev) =>
          prev ? { ...prev, flaggedForRewatch: previousValue } : prev,
        ),
      setError: setRewatchError,
    })
  }

  const handleCheckStreamingClick = () => {
    setStreamingCheckError(null)
    setStreamingCheckResult(null)
    setStreamingCheckLoading(true)

    seriesApi
      .getWatchProviders(id)
      .then((providers) => {
        setStreamingCheckLoading(false)
        setStreamingCheckResult(providers)
      })
      .catch((err: unknown) => {
        setStreamingCheckLoading(false)
        if (err instanceof ApiError) {
          setStreamingCheckError(err.message)
        } else {
          setStreamingCheckError(
            'An unexpected error occurred. Please try again.',
          )
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

  const yearLabel = series ? formatSeriesYear(series) : ''

  return (
    <div className={styles.container}>
      {backButton}

      {loading && (
        <output className={styles.loading}>
          <span>Loading series details...</span>
        </output>
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
              {yearLabel === ''
                ? series.title
                : `${series.title} (${yearLabel})`}
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

            <SeriesDetailFields
              series={series}
              streamingCheckLoading={streamingCheckLoading}
              streamingCheckError={streamingCheckError}
              streamingCheckResult={streamingCheckResult}
              onCheckStreamingClick={handleCheckStreamingClick}
            />
          </div>

          <SeriesDetailActionsPanel
            confirmingDelete={confirmingDelete}
            deleteError={deleteError}
            deleting={deleting}
            onConfirmDelete={handleConfirmDelete}
            onCancelDelete={handleCancelDelete}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
            refreshing={refreshing}
            onRefreshClick={handleRefreshClick}
            series={series}
            onRewatchToggle={handleRewatchToggle}
            acknowledging={acknowledging}
            onDismissNewContentClick={handleDismissNewContentClick}
          />

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
