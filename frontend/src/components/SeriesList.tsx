import { useState, useEffect, useCallback } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { Series } from '../types/series'
import styles from './SeriesList.module.css'

interface SeriesListProps {
  onSeriesClick?: (id: string) => void
  onAddClick?: () => void
}

export function SeriesList({ onSeriesClick, onAddClick }: SeriesListProps) {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  useEffect(() => {
    let cancelled = false

    seriesApi
      .getAll()
      .then((data) => {
        if (cancelled) return
        setSeries(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load series. Please try again.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [refreshIndex])

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(null)
    setRefreshIndex((index) => index + 1)
  }, [])

  const handleRowClick = (id: string) => {
    onSeriesClick?.(id)
  }

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLLIElement>,
    id: string,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSeriesClick?.(id)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.heading}>My Series</h2>
        <button
          type="button"
          className={styles.addButton}
          data-testid="add-series-btn"
          aria-label="Add new series"
          onClick={() => onAddClick?.()}
        >
          Add Series
        </button>
      </div>

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
          <span>Loading series...</span>
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

      {!loading && !error && series.length === 0 && (
        <div className={styles.empty}>
          <p>No series yet.</p>
          <button
            type="button"
            className={styles.addButton}
            data-testid="add-series-btn"
            aria-label="Add new series"
            onClick={() => onAddClick?.()}
          >
            Add your first series
          </button>
        </div>
      )}

      {!loading && !error && series.length > 0 && (
        <ul className={styles.list}>
          {series.map((s) => (
            <li
              key={s.id}
              className={styles.row}
              data-testid="series-row"
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- spec (frontend_spec_002.md, Requirement 7) requires role="button" and data-testid="series-row" on the same <li>; keyboard/focus support (tabIndex, onKeyDown) makes it a valid interactive element despite the static check.
              role="button"
              tabIndex={0}
              onClick={() => handleRowClick(s.id)}
              onKeyDown={(e) => handleRowKeyDown(e, s.id)}
            >
              <span className={styles.title}>{s.title}</span>
              <span className={styles.status}>{s.status}</span>
              <span className={styles.rating}>
                {s.imdbRating !== null ? s.imdbRating : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
