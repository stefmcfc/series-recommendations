import { useState, useEffect, useCallback } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type {
  Recommendation,
  RecommendationQuery,
  Series,
} from '../types/series'
import { AddSeriesForm } from './AddSeriesForm'
import { formatCountryName } from '../utils/countryName'
import styles from './RecommendationsList.module.css'

interface PendingAdd {
  recommendation: Recommendation
  status: SeriesStatus
}

interface RecommendationsListProps {
  query?: RecommendationQuery
}

export function RecommendationsList({ query }: RecommendationsListProps = {}) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null)
  const [ignoringIds, setIgnoringIds] = useState<Set<string>>(new Set())
  const [ignoreErrors, setIgnoreErrors] = useState<Record<string, string>>({})
  const [posterErrorIds, setPosterErrorIds] = useState<Set<string>>(new Set())
  const [keywordsLoadingIds, setKeywordsLoadingIds] = useState<Set<string>>(
    new Set(),
  )
  const [keywordResults, setKeywordResults] = useState<
    Record<string, string[]>
  >({})
  const [keywordErrors, setKeywordErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false

    seriesApi
      .getRecommendations(query)
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
  }, [refreshIndex, query])

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(null)
    setRefreshIndex((index) => index + 1)
  }, [])

  const handlePosterError = (imdbId: string) => {
    setPosterErrorIds((prev) => new Set(prev).add(imdbId))
  }

  const handleMarkAsWatched = (recommendation: Recommendation) => {
    setPendingAdd({ recommendation, status: SeriesStatus.COMPLETED })
  }

  const handleAddToList = (recommendation: Recommendation) => {
    setPendingAdd({ recommendation, status: SeriesStatus.BACKLOG })
  }

  const handleAddCancel = () => {
    setPendingAdd(null)
  }

  const handleAddSuccess = (series: Series) => {
    if (!pendingAdd) return
    const { imdbId } = pendingAdd.recommendation
    setRecommendations((prev) => prev.filter((r) => r.imdbId !== imdbId))
    setPendingAdd(null)

    // Fire-and-forget: populates IMDb rating, season/episode counts, TMDB
    // rating, and keywords in the background (FRONTEND-010-AC-21/22/23).
    // Must not block card removal above, and a failure here is silent —
    // the series is already saved, so this is no worse than the
    // pre-amendment status quo of requiring a separate manual refresh.
    seriesApi.refresh(series.id).catch(() => undefined)
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

  const handleShowKeywords = (recommendation: Recommendation) => {
    const { imdbId, tmdbId } = recommendation
    setKeywordErrors((prev) => {
      const next = { ...prev }
      delete next[imdbId]
      return next
    })
    setKeywordsLoadingIds((prev) => new Set(prev).add(imdbId))

    seriesApi
      .getRecommendationKeywords(tmdbId)
      .then((keywords) => {
        setKeywordsLoadingIds((prev) => {
          const next = new Set(prev)
          next.delete(imdbId)
          return next
        })
        setKeywordResults((prev) => ({ ...prev, [imdbId]: keywords }))
      })
      .catch((err: unknown) => {
        setKeywordsLoadingIds((prev) => {
          const next = new Set(prev)
          next.delete(imdbId)
          return next
        })
        const message =
          err instanceof ApiError
            ? err.message
            : 'An unexpected error occurred. Please try again.'
        setKeywordErrors((prev) => ({ ...prev, [imdbId]: message }))
      })
  }

  return (
    <div className={styles.container} data-testid="recommendations-list">
      <h2 className={styles.heading}>Recommendations</h2>

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
          <span>Loading recommendations...</span>
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

      {!loading && !error && recommendations.length === 0 && (
        <div className={styles.empty}>
          <p>
            No recommendations yet — mark a series as Completed to get
            suggestions.
          </p>
        </div>
      )}

      {!loading && !error && recommendations.length > 0 && (
        <ul className={styles.list}>
          {recommendations.map((r) => (
            <li
              key={r.imdbId}
              className={styles.card}
              data-testid="recommendation-card"
            >
              <div className={styles.thumbnail}>
                {r.posterUrl !== null && !posterErrorIds.has(r.imdbId) && (
                  <img
                    src={r.posterUrl}
                    alt=""
                    className={styles.thumbnailImage}
                    onError={() => handlePosterError(r.imdbId)}
                  />
                )}
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.title}>{r.title}</h3>
                  {r.year !== null && (
                    <span className={styles.year}>{r.year}</span>
                  )}
                  {r.tmdbRating !== null && (
                    <span className={styles.rating}>
                      {r.tmdbRating.toFixed(1)}
                      {r.voteCount !== null &&
                        ` (${r.voteCount.toLocaleString()} votes)`}
                    </span>
                  )}
                </div>
                {r.genres !== null && (
                  <span className={styles.genres}>{r.genres}</span>
                )}
                {r.streamingProviders.length > 0 ? (
                  <ul className={styles.streamingProviders}>
                    {r.streamingProviders.map((provider) => (
                      <li
                        key={provider.name}
                        className={styles.streamingProvider}
                      >
                        {provider.logoUrl !== null && (
                          <img
                            src={provider.logoUrl}
                            alt={provider.name}
                            className={styles.streamingProviderLogo}
                          />
                        )}
                        <span>{provider.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className={styles.streamingProvidersEmpty}>
                    Not currently streaming in the UK
                  </span>
                )}
                {r.originCountry !== null && (
                  <span className={styles.country}>
                    {formatCountryName(r.originCountry)}
                  </span>
                )}
                {r.overview !== null && (
                  <p className={styles.overview}>{r.overview}</p>
                )}
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
                    onClick={() => handleMarkAsWatched(r)}
                  >
                    Mark as Watched
                  </button>
                  <button
                    type="button"
                    className={styles.addToListButton}
                    onClick={() => handleAddToList(r)}
                  >
                    Add to List
                  </button>
                  <button
                    type="button"
                    className={styles.ignoreButton}
                    data-testid="ignore-btn"
                    disabled={ignoringIds.has(r.imdbId)}
                    onClick={() => handleIgnore(r)}
                  >
                    Ignore
                  </button>
                  <button
                    type="button"
                    className={styles.keywordsButton}
                    data-testid="show-keywords-btn"
                    disabled={keywordsLoadingIds.has(r.imdbId)}
                    onClick={() => handleShowKeywords(r)}
                  >
                    Show keywords
                  </button>
                  {ignoreErrors[r.imdbId] && (
                    <span className={styles.ignoreError} role="alert">
                      {ignoreErrors[r.imdbId]}
                    </span>
                  )}
                </div>

                {keywordsLoadingIds.has(r.imdbId) && (
                  <div
                    className={styles.keywordsLoading}
                    role="status"
                    aria-label="Loading keywords"
                  >
                    Loading keywords...
                  </div>
                )}
                {keywordErrors[r.imdbId] && (
                  <span className={styles.keywordsError} role="alert">
                    {keywordErrors[r.imdbId]}
                  </span>
                )}
                {keywordResults[r.imdbId] !== undefined &&
                  (keywordResults[r.imdbId].length === 0 ? (
                    <p className={styles.keywordsEmpty}>No keywords found</p>
                  ) : (
                    <ul className={styles.keywordsList}>
                      {keywordResults[r.imdbId].map((keyword) => (
                        <li key={keyword} className={styles.keywordChip}>
                          {keyword}
                        </li>
                      ))}
                    </ul>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pendingAdd && (
        <AddSeriesForm
          onCancel={handleAddCancel}
          onSuccess={handleAddSuccess}
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

      <p className={styles.attribution}>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
      <p className={styles.attribution}>Streaming data via JustWatch.</p>
    </div>
  )
}
