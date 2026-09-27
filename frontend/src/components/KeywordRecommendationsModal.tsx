import { useEffect, useState } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Recommendation, Series } from '../types/series'
import { AddSeriesForm } from './AddSeriesForm'
import { RecommendationCard } from './RecommendationCard'
import styles from './KeywordRecommendationsModal.module.css'
import btn from '../styles/buttons.module.css'

interface PendingAdd {
  recommendation: Recommendation
  status: SeriesStatus
}

interface KeywordRecommendationsModalProps {
  readonly keyword: string
  readonly onClose: () => void
}

// FRONTEND-133-AC-08/09: "Get recommendations for this keyword" modal,
// opened from KeywordsView's per-row "Get Recs" button (NameStatsTable's new
// optional onGetRecommendations prop). Modeled directly on
// SeriesRecommendationsModal.tsx's shape (fetch-on-mount, loading/error/
// empty/results states, mark-as-watched/add-to-list/ignore handling) --
// seeded by a keyword string instead of a tracked series id, and calling
// seriesApi.getRecommendations({ keywords: [keyword] }) with no
// sourceMode/region (unlike SeriesRecommendationsModal, whose sourceMode is
// 'useMySeries'). One genuine addition beyond that mirrored shape: a Retry
// action on the error state (this spec's own test contract), which
// SeriesRecommendationsModal doesn't have.
export function KeywordRecommendationsModal({
  keyword,
  onClose,
}: KeywordRecommendationsModalProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null)
  const [ignoringIds, setIgnoringIds] = useState<Set<string>>(new Set())
  const [ignoreErrors, setIgnoreErrors] = useState<Record<string, string>>({})
  // FRONTEND-133-AC-09: bumped by the Retry button to re-run the fetch
  // effect below -- keyword itself is fixed for the lifetime of this
  // component, so it alone can't trigger a re-fetch on demand.
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    // FRONTEND-133-AC-09: re-entering loading/clearing any previous error on
    // every run of this effect (mount, and again on Retry) -- same standard
    // React "fetch on dependency change" shape already established at
    // NameStatsTable.tsx's identical fetch effect (see that file's own
    // comment for the full rationale).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setLoading(true)
    setError(null)

    seriesApi
      .getRecommendations({ keywords: [keyword] })
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
    // FRONTEND-133-AC-09: keyword is fixed for the lifetime of this modal
    // (KeywordsView only mounts it while open, for the clicked keyword) --
    // retryToken is the only thing meant to re-trigger this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken])

  const handleModalKeyDown = useEscapeToClose(onClose)
  const handleRetry = () => setRetryToken((t) => t + 1)

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

    // Fire-and-forget, mirroring SeriesRecommendationsModal.tsx -- see that
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
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop click-to-close mirrors SeriesRecommendationsModal.tsx's identical pattern. This outer div is a non-interactive backdrop, not the dialog itself (that's the nested role="dialog" element below, which already handles Escape via onKeyDown) -- a keyboard-equivalent dismissal already exists via Escape and the "Done" button, so no keyboard handler is added here.
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* A native <dialog> needs showModal()/close() lifecycle management
          (focus trap, native backdrop) to behave correctly, not just a tag
          swap -- deliberately not converted here, mirroring
          SeriesRecommendationsModal.tsx's identical dialog. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior, matching SeriesRecommendationsModal.tsx; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
      <div // NOSONAR: typescript:S6819, see comment above
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyword-recommendations-heading"
        onKeyDown={handleModalKeyDown}
      >
        <h2
          id="keyword-recommendations-heading"
          className={styles.dialogHeading}
        >
          Recommendations for {keyword}
        </h2>

        {loading && (
          <output className={styles.loading} aria-label="Loading">
            Loading recommendations...
          </output>
        )}

        {!loading && error && (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            <button
              type="button"
              className={`${styles.retryButton} ${btn.btnSecondary}`}
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && recommendations.length === 0 && (
          <p className={styles.empty}>
            No recommendations found for this keyword
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
          <button
            type="button"
            className={`${styles.doneButton} ${btn.btnPrimary}`}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
