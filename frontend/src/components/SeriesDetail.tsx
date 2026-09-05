import { useState, useEffect, useCallback, useRef } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { Series, StreamingProvider } from '../types/series'
import { formatCountryNames } from '../utils/countryName'
import { formatSeriesYear } from '../utils/formatSeriesYear'
import { toggleRewatchFlag } from '../utils/rewatchToggle'
import { submitDelete } from '../utils/deleteSeries'
import { SeriesDetailFields } from './SeriesDetailFields'
import { SeriesDetailActionsPanel } from './SeriesDetailActionsPanel'
import { SeriesRecommendationsModal } from './SeriesRecommendationsModal'
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
  // FRONTEND-052-AC-04/08: an independent overlay -- its own useState, no
  // shared state with editing/delete-confirmation/refresh above, so opening
  // or closing it can't interfere with any of that (AC-08's regression
  // guard).
  const [recommendationsModalOpen, setRecommendationsModalOpen] =
    useState(false)
  // FRONTEND-078-AC-01: independent of every other overlay's state above, so
  // opening/closing it can't interfere with delete-confirmation, editing, or
  // the recommendations modal.
  const [posterLightboxOpen, setPosterLightboxOpen] = useState(false)
  const posterCloseButtonRef = useRef<HTMLButtonElement>(null)

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
    setRecommendationsModalOpen(false)
    setPosterLightboxOpen(false)
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

  // FRONTEND-078-AC-05: moves focus into the dialog as soon as it opens.
  // Without this, focus stays on the poster thumbnail button -- a DOM
  // sibling, not an ancestor, of this dialog -- so a real Escape keypress
  // right after opening would never reach handleLightboxKeyDown at all.
  // Programmatic .focus() here (not the JSX autoFocus prop, which
  // jsx-a11y/no-autofocus disallows), matching SearchFilter.tsx's
  // closeButtonRef/FRONTEND-071-AC-05 pattern.
  useEffect(() => {
    if (posterLightboxOpen) {
      posterCloseButtonRef.current?.focus()
    }
  }, [posterLightboxOpen])

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

  const handleRecommendationsClick = () => {
    setRecommendationsModalOpen(true)
  }

  const handleRecommendationsClose = () => {
    setRecommendationsModalOpen(false)
  }

  const handlePosterClick = () => {
    setPosterLightboxOpen(true)
  }

  const handlePosterLightboxClose = () => {
    setPosterLightboxOpen(false)
  }

  const handleLightboxKeyDown = useEscapeToClose(handlePosterLightboxClose)

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
          <div className={styles.headingRow} data-testid="heading-row">
            <div className={styles.headingLeft}>
              <h2 className={styles.heading}>
                {yearLabel === ''
                  ? series.title
                  : `${series.title} (${yearLabel})`}
              </h2>
              {series.originCountry != null && (
                <span className={styles.country}>
                  {' | '}
                  {formatCountryNames(series.originCountry)}
                </span>
              )}
            </div>
            <span className={styles.statusHeading}>{series.status}</span>
          </div>

          <div className={styles.content}>
            {series.posterUrl !== null && !posterError && (
              <button
                type="button"
                className={styles.posterButton}
                aria-label={`View larger poster of ${series.title}`}
                onClick={handlePosterClick}
              >
                <img
                  src={series.posterUrl}
                  alt=""
                  className={styles.poster}
                  onError={() => setPosterError(true)}
                />
              </button>
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
            onRecommendationsClick={handleRecommendationsClick}
            recommendationsDisabled={series.excludeFromRecommendations}
          />

          {recommendationsModalOpen && (
            <SeriesRecommendationsModal
              series={series}
              onClose={handleRecommendationsClose}
            />
          )}

          {posterLightboxOpen && series.posterUrl !== null && (
            <div className={styles.posterOverlay}>
              {/* A native <dialog> needs showModal()/close() lifecycle
                  management (focus trap, native backdrop) to behave
                  correctly, not just a tag swap -- deliberately not
                  converted here, mirroring SeriesRecommendationsModal.tsx
                  and SearchFilter.tsx's "Browse Keywords" modal (jsdom's
                  <dialog> support has known gaps). */}
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior, matching every other hand-rolled dialog in this codebase; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
              <div // NOSONAR: typescript:S6819, see comment above
                className={styles.posterDialog}
                role="dialog"
                aria-modal="true"
                aria-label="Poster"
                onKeyDown={handleLightboxKeyDown}
              >
                <button
                  ref={posterCloseButtonRef}
                  type="button"
                  className={styles.posterCloseButton}
                  aria-label="Close"
                  onClick={handlePosterLightboxClose}
                >
                  ×
                </button>
                <button
                  type="button"
                  className={styles.posterEnlargedButton}
                  aria-label="Close enlarged poster"
                  onClick={handlePosterLightboxClose}
                >
                  <img
                    src={series.posterUrl}
                    alt=""
                    className={styles.posterEnlarged}
                  />
                </button>
              </div>
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
