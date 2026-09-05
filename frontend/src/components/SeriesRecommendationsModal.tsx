import { useEffect, useState } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Recommendation, Series } from '../types/series'
import { AddSeriesForm } from './AddSeriesForm'
import { RecommendationCard } from './RecommendationCard'
import styles from './SeriesRecommendationsModal.module.css'

interface PendingAdd {
  recommendation: Recommendation
  status: SeriesStatus
}

interface SeriesRecommendationsModalProps {
  readonly series: Series
  readonly onClose: () => void
}

// FRONTEND-052: "Recommendations for {series.title}" modal, opened from
// SeriesDetailActionsPanel's new "Recommendations" button. Mirrors
// RecommendationsList's own fetch-on-mount and mark-as-watched/add-to-
// list/ignore handling exactly (per this spec's Design Decisions) rather
// than sharing a hook -- this is the only other place that sources
// recommendations, and duplicating a handful of handlers here is simpler
// than introducing shared state-management infrastructure for two call
// sites.
export function SeriesRecommendationsModal({
  series,
  onClose,
}: SeriesRecommendationsModalProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null)
  const [ignoringIds, setIgnoringIds] = useState<Set<string>>(new Set())
  const [ignoreErrors, setIgnoreErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false

    seriesApi
      .getRecommendations({ sourceMode: 'useMySeries', seriesIds: [series.id] })
      .then((data) => {
        if (cancelled) return
        setRecommendations(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load recommendations. Please try again.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // FRONTEND-052-AC-05: fetches exactly once per modal open -- series.id is
    // fixed for the lifetime of this component (SeriesDetail only mounts it
    // while the modal is open, for the currently-viewed series).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleModalKeyDown = useEscapeToClose(onClose)

  const handleMarkAsWatched = (recommendation: Recommendation) => {
    setPendingAdd({ recommendation, status: SeriesStatus.COMPLETED })
  }

  const handleAddToList = (recommendation: Recommendation) => {
    setPendingAdd({ recommendation, status: SeriesStatus.BACKLOG })
  }

  const handleAddCancel = () => {
    setPendingAdd(null)
  }

  const handleAddSuccess = (newSeries: Series) => {
    if (!pendingAdd) return
    const { imdbId } = pendingAdd.recommendation
    setRecommendations((prev) => prev.filter((r) => r.imdbId !== imdbId))
    setPendingAdd(null)

    // Fire-and-forget, mirroring RecommendationsList.tsx -- see that
    // component's handleAddSuccess for the rationale.
    seriesApi.refresh(newSeries.id).catch(() => undefined)
  }

  const handleIgnore = (recommendation: Recommendation) => {
    const { imdbId, title } = recommendation
    setIgnoreErrors((prev) => {
      const next = { ...prev }
      delete next[imdbId]
      return next
    })
    setIgnoringIds((prev) => new Set(prev).add(imdbId))

    seriesApi
      .ignoreSeries(imdbId, title)
      .then(() => {
        setIgnoringIds((prev) => {
          const next = new Set(prev)
          next.delete(imdbId)
          return next
        })
        setRecommendations((prev) => prev.filter((r) => r.imdbId !== imdbId))
      })
      .catch((err: unknown) => {
        setIgnoringIds((prev) => {
          const next = new Set(prev)
          next.delete(imdbId)
          return next
        })
        const message =
          err instanceof ApiError
            ? err.message
            : 'An unexpected error occurred. Please try again.'
        setIgnoreErrors((prev) => ({ ...prev, [imdbId]: message }))
      })
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- FRONTEND-092-AC-04/05: backdrop click-to-close mirrors SearchFilter.tsx's identical pattern (FRONTEND-079-AC-03/04). This outer div is a non-interactive backdrop, not the dialog itself (that's the nested role="dialog" element below, which already handles Escape via onKeyDown) -- a keyboard-equivalent dismissal already exists via Escape and the "Done" button, so no keyboard handler is added here.
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* A native <dialog> needs showModal()/close() lifecycle management
          (focus trap, native backdrop) to behave correctly, not just a tag
          swap -- deliberately not converted here, mirroring SearchFilter.tsx's
          "Browse Keywords" modal (jsdom's <dialog> support has known gaps). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior, matching SearchFilter.tsx's "Browse Keywords" modal; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
      <div // NOSONAR: typescript:S6819, see comment above
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="series-recommendations-heading"
        onKeyDown={handleModalKeyDown}
      >
        <h2
          id="series-recommendations-heading"
          className={styles.dialogHeading}
        >
          Recommendations for {series.title}
        </h2>

        {loading && (
          <output className={styles.loading} aria-label="Loading">
            Loading recommendations...
          </output>
        )}

        {!loading && error && (
          <div className={styles.error} role="alert">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && recommendations.length === 0 && (
          <p className={styles.empty}>
            No recommendations found for this series
          </p>
        )}

        {!loading && !error && recommendations.length > 0 && (
          <ul className={styles.list}>
            {recommendations.map((r) => (
              <RecommendationCard
                key={r.imdbId}
                recommendation={r}
                onMarkWatched={handleMarkAsWatched}
                onAddToList={handleAddToList}
                onIgnore={handleIgnore}
                ignoring={ignoringIds.has(r.imdbId)}
                ignoreError={ignoreErrors[r.imdbId] ?? null}
              />
            ))}
          </ul>
        )}

        {pendingAdd && (
          <AddSeriesForm
            onCancel={handleAddCancel}
            onSuccess={handleAddSuccess}
            source="recommendation"
            initialValues={{
              title: pendingAdd.recommendation.title,
              status: pendingAdd.status,
              ...(pendingAdd.recommendation.year != null
                ? { year: pendingAdd.recommendation.year }
                : {}),
              ...(pendingAdd.recommendation.genres != null
                ? { genres: pendingAdd.recommendation.genres }
                : {}),
              ...(pendingAdd.recommendation.posterUrl != null
                ? { posterUrl: pendingAdd.recommendation.posterUrl }
                : {}),
              ...(pendingAdd.recommendation.overview != null
                ? { overview: pendingAdd.recommendation.overview }
                : {}),
              imdbId: pendingAdd.recommendation.imdbId,
            }}
          />
        )}

        <div className={styles.dialogActions}>
          <button type="button" className={styles.doneButton} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
