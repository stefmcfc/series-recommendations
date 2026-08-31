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
import { StreamingProviders } from './StreamingProviders'
import { formatCountryName } from '../utils/countryName'
import styles from './RecommendationsList.module.css'

interface PendingAdd {
  recommendation: Recommendation
  status: SeriesStatus
}

interface RecommendationsListProps {
  query?: RecommendationQuery
  // FRONTEND-040-AC-05: read-only broadcast of this component's own existing
  // `loading` state upward -- RecommendationsList keeps owning the fetch and
  // loading/error/recommendations state exactly as before; this is not a new
  // source of truth, just lets App.tsx mirror it down to RecommendationControls
  // so that panel can lock itself while a request is in flight.
  onLoadingChange?: (loading: boolean) => void
}

export function RecommendationsList({
  query,
  onLoadingChange,
}: RecommendationsListProps = {}) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  // FRONTEND-062-AC-07: starts false, not true -- nothing fetches until a
  // real `query` exists (the fetch effect below early-returns when
  // `query == null`), so there is nothing loading at mount anymore.
  const [loading, setLoading] = useState(false)
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
    // FRONTEND-062-AC-06: no fetch (and no loading flip) until a real query
    // exists -- nothing has been "Applied" yet, so there is nothing to
    // fetch. The prompt rendered below (data-testid="recommendations-not-
    // searched") covers this state instead.
    if (query == null) return

    let cancelled = false

    // FRONTEND-040: fixes the reported symptom directly -- previously this
    // only started `true` via useState's initializer, so a subsequent fetch
    // (triggered by a new `query`/refreshIndex) never flipped `loading` back
    // to true, and neither this component's own "Loading recommendations..."
    // state nor (once wired up) the new onLoadingChange broadcast ever fired
    // again after the first load. Setting it here, on every effect run, is
    // what makes "every subsequent fetch" (AC-05) actually true. This is the
    // standard React "fetch on dependency change" shape (see
    // react.dev/learn/synchronizing-with-effects#fetching-data, which itself
    // sets state synchronously at the top of the effect) -- there's no
    // dependency-free way to mark "a new fetch has started" without a state
    // update, so the alternative would be a bigger refactor (e.g. a
    // reducer/fetch-token pattern) for no behavioral gain here.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setLoading(true)

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

  // FRONTEND-040-AC-05: fires on mount and every subsequent loading
  // transition (including the never-reset-before-this-spec transitions on a
  // `query` change -- see handleRetry below and the fetch effect's own
  // setLoading(false) calls).
  useEffect(() => {
    onLoadingChange?.(loading)
  }, [loading, onLoadingChange])

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

      {/* FRONTEND-062-AC-08: distinct from the empty-results messages below
          -- those presuppose a search actually ran and found nothing, which
          isn't true here. Checked ahead of the loading/error/empty-
          results/results branches, none of which change. */}
      {query == null && (
        <div
          className={styles.empty}
          data-testid="recommendations-not-searched"
        >
          <p>
            Set your filters above and click "Apply Filters" to see
            recommendations.
          </p>
        </div>
      )}

      {query != null && loading && (
        <output className={styles.loading} aria-label="Loading">
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
        </output>
      )}

      {query != null && !loading && error && (
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

      {query != null && !loading && !error && recommendations.length === 0 && (
        <div className={styles.empty}>
          {/* Fix 2 (2026-08-28, live testing -- pre-existing bug, not part
              of any open spec): this message only makes sense for "Use My
              Series" pool-based sourcing (query.sourceMode === 'useMySeries'
              -- series_spec_033/frontend_spec_049 made "Use My Series"
              always send sourceMode explicitly, so undefined can no longer
              mean anything else post-series_spec_033). It was previously
              shown unconditionally, including under Trending/Highest
              Rated/Custom Search, where "mark a series as Completed" is
              nonsensical advice since those modes don't source from tracked
              series at all. */}
          {query?.sourceMode === 'useMySeries' ? (
            <p>
              No recommendations yet — mark a series as Completed to get
              suggestions.
            </p>
          ) : (
            <p>No shows match these filters — try widening your search.</p>
          )}
        </div>
      )}

      {query != null && !loading && !error && recommendations.length > 0 && (
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
                {r.genres !== null && (
                  <span className={styles.genres}>{r.genres}</span>
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
                  <output
                    className={styles.keywordsLoading}
                    aria-label="Loading keywords"
                  >
                    Loading keywords...
                  </output>
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

      <p className={styles.attribution}>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
      <p className={styles.attribution}>Streaming data via JustWatch.</p>
    </div>
  )
}
