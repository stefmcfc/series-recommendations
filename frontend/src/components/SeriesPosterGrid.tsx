import type { Series } from '../types/series'
import { formatSeriesYear } from '../utils/formatSeriesYear'
import styles from './SeriesPosterGrid.module.css'

interface SeriesPosterGridProps {
  readonly series: readonly Series[]
  readonly posterErrorIds: ReadonlySet<string>
  readonly onPosterError: (id: string) => void
  readonly onCardClick: (id: string) => void
}

// FRONTEND-054-AC-07/08/09: the densest opt-in view -- the poster image
// alone, no title/year/rating text visible in the card itself. Shares the
// same accessible-<button>-with-explicit-aria-label pattern as
// SeriesCompactGrid (FRONTEND-054-AC-05); a missing/failed poster (mirroring
// SeriesList's own posterErrorIds handling) omits the <img> but the button
// and its aria-label still render.
export function SeriesPosterGrid({
  series,
  posterErrorIds,
  onPosterError,
  onCardClick,
}: SeriesPosterGridProps) {
  return (
    <ul className={styles.grid}>
      {series.map((s) => {
        const yearLabel = formatSeriesYear(s)
        const titleYear =
          yearLabel === '' ? s.title : `${s.title} (${yearLabel})`

        return (
          <li key={s.id} className={styles.item}>
            <button
              type="button"
              className={styles.card}
              data-testid="poster-series-card"
              aria-label={`View details for ${titleYear}`}
              onClick={() => onCardClick(s.id)}
            >
              {s.posterUrl !== null && !posterErrorIds.has(s.id) && (
                <img
                  src={s.posterUrl}
                  alt=""
                  className={styles.thumbnailImage}
                  onError={() => onPosterError(s.id)}
                />
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
