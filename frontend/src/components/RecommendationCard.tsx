import { useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { Recommendation } from '../types/series'
import { StreamingProviders } from './StreamingProviders'
import { formatCountryName } from '../utils/countryName'
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
// without duplicating ~150 lines of JSX. Keywords loading/result/error and
// poster-error state move here as local useState -- previously keyed by
// imdbId in a parent-level Set/Record because one parent rendered many cards
// from a flat array; now each card is its own component instance, so plain
// local state is simpler and correctly scoped.
export function RecommendationCard({
  recommendation,
  onMarkWatched,
  onAddToList,
  onIgnore,
  ignoring = false,
  ignoreError = null,
}: RecommendationCardProps) {
  const [posterError, setPosterError] = useState(false)
  const [keywordsLoading, setKeywordsLoading] = useState(false)
  const [keywordResult, setKeywordResult] = useState<string[] | null>(null)
  const [keywordError, setKeywordError] = useState<string | null>(null)

  const r = recommendation

  const handleShowKeywords = () => {
    setKeywordError(null)
    setKeywordsLoading(true)

    seriesApi
      .getRecommendationKeywords(r.tmdbId)
      .then((keywords) => {
        setKeywordsLoading(false)
        setKeywordResult(keywords)
      })
      .catch((err: unknown) => {
        setKeywordsLoading(false)
        const message =
          err instanceof ApiError
            ? err.message
            : 'An unexpected error occurred. Please try again.'
        setKeywordError(message)
      })
  }

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
            className={styles.keywordsButton}
            data-testid="show-keywords-btn"
            disabled={keywordsLoading}
            onClick={handleShowKeywords}
          >
            Show keywords
          </button>
          {ignoreError && (
            <span className={styles.ignoreError} role="alert">
              {ignoreError}
            </span>
          )}
        </div>

        {keywordsLoading && (
          <output
            className={styles.keywordsLoading}
            aria-label="Loading keywords"
          >
            Loading keywords...
          </output>
        )}
        {keywordError && (
          <span className={styles.keywordsError} role="alert">
            {keywordError}
          </span>
        )}
        {keywordResult !== null &&
          (keywordResult.length === 0 ? (
            <p className={styles.keywordsEmpty}>No keywords found</p>
          ) : (
            <ul className={styles.keywordsList}>
              {keywordResult.map((keyword) => (
                <li key={keyword} className={styles.keywordChip}>
                  {keyword}
                </li>
              ))}
            </ul>
          ))}
      </div>
    </li>
  )
}
