import { useState, useEffect } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { KeywordStat } from '../types/series'
import styles from './KeywordsView.module.css'

type SortBy = 'seriesCount' | 'averagePersonalRating' | undefined

function formatAverage(value: number | null): string {
  return value === null ? '—' : String(value)
}

export function KeywordsView() {
  const [stats, setStats] = useState<KeywordStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>(undefined)

  useEffect(() => {
    let cancelled = false

    seriesApi
      .getKeywordStats(sortBy)
      .then((data) => {
        if (cancelled) return
        setStats(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load keyword stats. Please try again.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sortBy])

  const handleSortChange = (nextSortBy: SortBy) => {
    setLoading(true)
    setError(null)
    setSortBy(nextSortBy)
  }

  return (
    <div className={styles.container} data-testid="keywords-view">
      <h2 className={styles.heading}>Keywords</h2>

      {loading && (
        <div className={styles.loading} role="status" aria-label="Loading">
          <span>Loading keyword stats...</span>
        </div>
      )}

      {!loading && error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Keyword</th>
              <th
                scope="col"
                className={styles.sortableHeader}
                onClick={() => handleSortChange('seriesCount')}
              >
                Series Count
              </th>
              <th
                scope="col"
                className={styles.sortableHeader}
                onClick={() => handleSortChange('averagePersonalRating')}
              >
                Avg. Personal Rating
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.name}>
                <td>{stat.name}</td>
                <td>{stat.seriesCount}</td>
                <td>{formatAverage(stat.averagePersonalRating)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
