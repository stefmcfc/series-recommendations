import { useEffect, useState } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { CandidateDetail, Recommendation } from '../types/series'
import { StreamingProviders } from './StreamingProviders'
import { formatCountryName } from '../utils/countryName'
import styles from './RecommendationDetailModal.module.css'

interface RecommendationDetailModalProps {
  readonly recommendation: Recommendation
  readonly onClose: () => void
}

// FRONTEND-053: replaces RecommendationCard's inline "Show keywords" expand
// with a full detail view -- everything already visible on the card (title,
// poster, overview, genres, origin country, TMDB rating, vote count,
// streaming providers) plus two new sections (season/episode counts + IMDb
// rating, keywords) fetched independently on open. A failure in one fetch
// never blocks or blanks the other -- see this spec's Design Decisions.
export function RecommendationDetailModal({
  recommendation,
  onClose,
}: RecommendationDetailModalProps) {
  const [detailsLoading, setDetailsLoading] = useState(true)
  const [details, setDetails] = useState<CandidateDetail | null>(null)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const [keywordsLoading, setKeywordsLoading] = useState(true)
  const [keywordResult, setKeywordResult] = useState<string[] | null>(null)
  const [keywordError, setKeywordError] = useState<string | null>(null)

  const r = recommendation

  useEffect(() => {
    let cancelled = false

    seriesApi
      .getRecommendationDetails(r.tmdbId, r.imdbId)
      .then((result) => {
        if (cancelled) return
        setDetails(result)
        setDetailsLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof ApiError
            ? err.message
            : 'Details unavailable. Please try again.'
        setDetailsError(message)
        setDetailsLoading(false)
      })

    return () => {
      cancelled = true
    }
    // FRONTEND-053-AC-04: fetches exactly once per modal open -- r.tmdbId/
    // r.imdbId are fixed for the lifetime of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false

    seriesApi
      .getRecommendationKeywords(r.tmdbId)
      .then((keywords) => {
        if (cancelled) return
        setKeywordResult(keywords)
        setKeywordsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setKeywordError('Keywords unavailable. Please try again.')
        setKeywordsLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleModalKeyDown = useEscapeToClose(onClose)

  return (
    <div className={styles.overlay}>
      {/* A native <dialog> needs showModal()/close() lifecycle management
          (focus trap, native backdrop) to behave correctly, not just a tag
          swap -- deliberately not converted here, mirroring SearchFilter.tsx's
          "Browse Keywords" modal (jsdom's <dialog> support has known gaps). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior, matching SeriesRecommendationsModal.tsx/SearchFilter.tsx's "Browse Keywords" modal; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
      <div // NOSONAR: typescript:S6819, see comment above
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommendation-detail-heading"
        onKeyDown={handleModalKeyDown}
      >
        <div className={styles.header}>
          <div className={styles.thumbnail}>
            {r.posterUrl !== null && (
              <img src={r.posterUrl} alt="" className={styles.thumbnailImage} />
            )}
          </div>
          <div className={styles.headerBody}>
            <h2 id="recommendation-detail-heading" className={styles.heading}>
              {r.title}
            </h2>
            <div className={styles.metaRow}>
              {r.year !== null && <span>{r.year}</span>}
              {r.originCountry !== null && (
                <span>{formatCountryName(r.originCountry)}</span>
              )}
              {r.tmdbRating !== null && (
                <span>
                  {r.tmdbRating.toFixed(1)}
                  {r.voteCount !== null &&
                    ` (${r.voteCount.toLocaleString()} votes)`}
                </span>
              )}
            </div>
            <StreamingProviders providers={r.streamingProviders} />
            {r.genres !== null && (
              <span className={styles.genres}>{r.genres}</span>
            )}
          </div>
        </div>

        {r.overview !== null && <p className={styles.overview}>{r.overview}</p>}

        <div className={styles.statsSection}>
          <h3 className={styles.sectionHeading}>Details</h3>
          {detailsLoading && (
            <output className={styles.loading} aria-label="Loading details">
              Loading details...
            </output>
          )}
          {!detailsLoading && detailsError && (
            <span className={styles.error} role="alert">
              {detailsError}
            </span>
          )}
          {!detailsLoading && !detailsError && (
            <dl className={styles.statsList}>
              <div className={styles.statRow}>
                <dt>Seasons</dt>
                <dd>{details?.numberOfSeasons ?? '—'}</dd>
              </div>
              <div className={styles.statRow}>
                <dt>Episodes</dt>
                <dd>{details?.numberOfEpisodes ?? '—'}</dd>
              </div>
              <div className={styles.statRow}>
                <dt>IMDb Rating</dt>
                <dd>{details?.imdbRating ?? '—'}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className={styles.keywordsSection}>
          <h3 className={styles.sectionHeading}>Keywords</h3>
          {keywordsLoading && (
            <output className={styles.loading} aria-label="Loading keywords">
              Loading keywords...
            </output>
          )}
          {!keywordsLoading && keywordError && (
            <span className={styles.error} role="alert">
              {keywordError}
            </span>
          )}
          {!keywordsLoading &&
            !keywordError &&
            keywordResult !== null &&
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

        <div className={styles.dialogActions}>
          <button type="button" className={styles.doneButton} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
