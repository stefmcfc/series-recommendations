import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { seriesApi } from '../services/seriesApi'
import type { Series } from '../types/series'
import { blendedRating } from '../utils/blendedRating'
import {
  DEFAULT_KEYWORD_FAVOURITES,
  isKeywordFavourites,
} from './RecommendationControls'
import { FavouritesIcon } from './SettingsIcons'
import styles from './KeywordDetailModal.module.css'
import btn from '../styles/buttons.module.css'

interface KeywordDetailModalProps {
  readonly keyword: string
  readonly onClose: () => void
}

type SortColumn = 'title' | 'status' | 'personalRating' | 'blendedRating'
type SortDirection = 'asc' | 'desc'

// FRONTEND-136-AC-07: mirrors useNameStatsFilters.ts's own
// DEFAULT_SORT_DIRECTION precedent -- text columns default ascending, rating
// columns default descending (highest first) on their first click.
const DEFAULT_DIRECTION: Record<SortColumn, SortDirection> = {
  title: 'asc',
  status: 'asc',
  personalRating: 'desc',
  blendedRating: 'desc',
}

interface Row {
  series: Series
  blended: number | null
}

function compareNullable(
  a: number | string | null,
  b: number | string | null,
): number {
  if (a === null && b === null) return 0
  if (a === null) return -1
  if (b === null) return 1
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b)
  return (a as number) - (b as number)
}

function sortIndicator(
  column: SortColumn,
  sortBy: SortColumn,
  direction: SortDirection,
): string {
  if (sortBy !== column) return ''
  return direction === 'asc' ? ' ▲' : ' ▼'
}

// FRONTEND-136-AC-06/07/08/09: per-keyword series detail modal, opened from
// KeywordsView's per-row name click (NameStatsTable's new optional
// onOpenDetail prop). Modeled on KeywordRecommendationsModal.tsx's exact
// fetch-on-mount/loading/error/Retry shape (frontend_spec_133), but seeded
// via seriesApi.search({ keywords: [keyword] }) -- no status filter, since
// the point is "every tracked series with this keyword, whatever its
// status" -- rather than seriesApi.getRecommendations. Columns are sorted
// entirely client-side (this dataset is already fully fetched, no
// re-fetch), and each row navigates to that series' existing detail route.
// A favourite toggle for the seeded keyword itself reads/writes the same
// keywordFavourites localStorage key frontend_spec_133 established.
export function KeywordDetailModal({
  keyword,
  onClose,
}: KeywordDetailModalProps) {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // FRONTEND-136-AC-06: bumped by the Retry button to re-run the fetch
  // effect below -- keyword itself is fixed for the lifetime of this
  // component, so it alone can't trigger a re-fetch on demand.
  const [retryToken, setRetryToken] = useState(0)
  const [sortBy, setSortBy] = useState<SortColumn>('title')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const navigate = useNavigate()

  const [keywordFavourites, setKeywordFavourites] = useLocalStorage(
    'keywordFavourites',
    DEFAULT_KEYWORD_FAVOURITES,
    isKeywordFavourites,
  )
  const isFavourited = keywordFavourites.includes(keyword)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same "fetch on dependency change" shape as KeywordRecommendationsModal.tsx's identical effect (see that file's own comment for the full rationale).
    setLoading(true)
    setError(null)

    seriesApi
      .search({ keywords: [keyword] })
      .then((result) => {
        if (cancelled) return
        setSeries(result.series)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load series for this keyword. Please try again.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // FRONTEND-136-AC-06: keyword is fixed for the lifetime of this modal
    // (KeywordsView only mounts it while open, for the clicked keyword) --
    // retryToken is the only thing meant to re-trigger this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken])

  const rows = useMemo<Row[]>(
    () => series.map((s) => ({ series: s, blended: blendedRating(s) })),
    [series],
  )

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'title':
          comparison = compareNullable(a.series.title, b.series.title)
          break
        case 'status':
          comparison = compareNullable(a.series.status, b.series.status)
          break
        case 'personalRating':
          comparison = compareNullable(
            a.series.personalRating,
            b.series.personalRating,
          )
          break
        case 'blendedRating':
          comparison = compareNullable(a.blended, b.blended)
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
    return sorted
    // FRONTEND-136-AC-07: client-side only -- re-sorts the already-fetched
    // rows, never re-fetches.
  }, [rows, sortBy, sortDirection])

  const handleModalKeyDown = useEscapeToClose(onClose)
  const handleRetry = () => setRetryToken((t) => t + 1)

  const handleSortChange = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDirection(DEFAULT_DIRECTION[column])
    }
  }

  const handleToggleFavourite = () => {
    setKeywordFavourites(
      isFavourited
        ? keywordFavourites.filter((k) => k !== keyword)
        : [...keywordFavourites, keyword],
    )
  }

  const handleRowClick = (id: string) => {
    navigate(`/my-series/view/${id}`)
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop click-to-close mirrors KeywordRecommendationsModal.tsx's identical pattern. This outer div is a non-interactive backdrop, not the dialog itself (that's the nested role="dialog" element below, which already handles Escape via onKeyDown) -- a keyboard-equivalent dismissal already exists via Escape and the "Done" button, so no keyboard handler is added here.
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* A native <dialog> needs showModal()/close() lifecycle management
          (focus trap, native backdrop) to behave correctly, not just a tag
          swap -- deliberately not converted here, mirroring
          KeywordRecommendationsModal.tsx's identical dialog. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior, matching KeywordRecommendationsModal.tsx; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
      <div // NOSONAR: typescript:S6819, see comment above
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyword-detail-heading"
        onKeyDown={handleModalKeyDown}
      >
        <div className={styles.dialogHeader}>
          <h2 id="keyword-detail-heading" className={styles.dialogHeading}>
            Series tagged &quot;{keyword}&quot;
          </h2>
          <button
            type="button"
            className={`${styles.favouriteButton} ${isFavourited ? styles.favourited : ''}`}
            aria-pressed={isFavourited}
            aria-label={
              isFavourited
                ? `Remove ${keyword} from favourites`
                : `Add ${keyword} to favourites`
            }
            onClick={handleToggleFavourite}
          >
            <FavouritesIcon />
          </button>
        </div>

        {loading && (
          <output className={styles.loading} aria-label="Loading">
            Loading series...
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

        {!loading && !error && series.length === 0 && (
          <p className={styles.empty}>No series found for this keyword</p>
        )}

        {!loading && !error && series.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th
                  scope="col"
                  className={styles.sortableHeader}
                  onClick={() => handleSortChange('title')}
                >
                  {`Name${sortIndicator('title', sortBy, sortDirection)}`}
                </th>
                <th
                  scope="col"
                  className={styles.sortableHeader}
                  onClick={() => handleSortChange('status')}
                >
                  {`Status${sortIndicator('status', sortBy, sortDirection)}`}
                </th>
                <th
                  scope="col"
                  className={styles.sortableHeader}
                  onClick={() => handleSortChange('personalRating')}
                >
                  {`Personal Rating${sortIndicator('personalRating', sortBy, sortDirection)}`}
                </th>
                <th
                  scope="col"
                  className={styles.sortableHeader}
                  onClick={() => handleSortChange('blendedRating')}
                >
                  {`Blended Rating${sortIndicator('blendedRating', sortBy, sortDirection)}`}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={row.series.id}
                  className={styles.row}
                  onClick={() => handleRowClick(row.series.id)}
                >
                  <td>{row.series.title}</td>
                  <td>{row.series.status}</td>
                  <td>{row.series.personalRating ?? '—'}</td>
                  <td>{row.blended ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
