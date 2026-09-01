import { useState } from 'react'
import type { Recommendation } from '../types/series'
import { StreamingProviders } from './StreamingProviders'
import { formatCountryName } from '../utils/countryName'
import { RecommendationDetailModal } from './RecommendationDetailModal'
import styles from './RecommendationCard.module.css'

interface RecommendationCardProps {
  readonly recommendation: Recommendation
  readonly onMarkWatched: (recommendation: Recommendation) => void
  readonly onAddToList: (recommendation: Recommendation) => void
  readonly onIgnore: (recommendation: Recommendation) => void
  // FRONTEND-052: the ignore action's in-flight/error state stays owned by
  // whichever parent (RecommendationsList, or SeriesRecommendationsModal)
  // actually calls seriesApi.ignoreSeries and decides whether to remove this
  // card from its own list -- these are just display props reflecting that
  // parent-owned state back down. Both default to "not ignoring, no error"
  // so a parent that doesn't care about this (e.g. a future consumer) can
  // omit them entirely.
  readonly ignoring?: boolean
  readonly ignoreError?: string | null
}

// FRONTEND-052-AC-01: extracted from RecommendationsList.tsx's former inline
// per-candidate card JSX so it can be reused by both RecommendationsList and
// the new SeriesDetail "Recommendations" modal (SeriesRecommendationsModal)
// without duplicating ~150 lines of JSX. Poster-error state lives here as
// local useState.
//
// FRONTEND-053: the standalone "Show keywords" expand (and its keywordsLoading/
// keywordResult/keywordError state) has moved into RecommendationDetailModal,
// opened by the "View Details" button below -- see that spec's Design
// Decisions for why a second "learn more" affordance wasn't kept alongside it.
export function RecommendationCard({
  recommendation,
  onMarkWatched,
  onAddToList,
  onIgnore,
  ignoring = false,
  ignoreError = null,
}: RecommendationCardProps) {
  const [posterError, setPosterError] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  const r = recommendation

  return (
    <li className={styles.card} data-testid="recommendation-card">
      <div className={styles.thumbnail}>
        {r.posterUrl !== null && !posterError && (
          <img
            src={r.posterUrl}
            alt=""
            className={styles.thumbnailImage}
            onError={() => setPosterError(true)}
          />
        )}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardHeader}>
          <h3 className={styles.title}>{r.title}</h3>
          {r.year !== null && <span className={styles.year}>{r.year}</span>}
          {r.originCountry !== null && (
            <span className={styles.country}>
              {' | '}
              {formatCountryName(r.originCountry)}
            </span>
          )}
          {r.tmdbRating !== null && (
            <span className={styles.rating}>
              {r.tmdbRating.toFixed(1)}
              {r.voteCount !== null &&
                ` (${r.voteCount.toLocaleString()} votes)`}
            </span>
          )}
        </div>
        <StreamingProviders providers={r.streamingProviders} />
        {r.genres !== null && <span className={styles.genres}>{r.genres}</span>}
        {r.overview !== null && <p className={styles.overview}>{r.overview}</p>}
        {r.sourceTitles.length > 0 && (
          <p className={styles.sourceTitle}>
            Because you watched {r.sourceTitles.join(', ')}
            {r.totalSourceCount > r.sourceTitles.length &&
              ` and ${r.totalSourceCount - r.sourceTitles.length} more`}
          </p>
        )}

        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.markWatchedButton}
            onClick={() => onMarkWatched(r)}
          >
            Mark as Watched
          </button>
          <button
            type="button"
            className={styles.addToListButton}
            onClick={() => onAddToList(r)}
          >
            Add to List
          </button>
          <button
            type="button"
            className={styles.ignoreButton}
            data-testid="ignore-btn"
            disabled={ignoring}
            onClick={() => onIgnore(r)}
          >
            Ignore
          </button>
          <button
            type="button"
            className={styles.viewDetailsButton}
            data-testid="view-details-btn"
            onClick={() => setDetailModalOpen(true)}
          >
            View Details
          </button>
          {ignoreError && (
            <span className={styles.ignoreError} role="alert">
              {ignoreError}
            </span>
          )}
        </div>
      </div>

      {detailModalOpen && (
        <RecommendationDetailModal
          recommendation={r}
          onClose={() => setDetailModalOpen(false)}
        />
      )}
    </li>
  )
}
