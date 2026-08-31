import type { Series } from '../types/series'
import { formatSeriesYear } from '../utils/formatSeriesYear'
import { StarRating } from './StarRating'
import styles from './SeriesCompactGrid.module.css'

interface SeriesCompactGridProps {
  readonly series: readonly Series[]
  readonly posterErrorIds: ReadonlySet<string>
  readonly onPosterError: (id: string) => void
  readonly onCardClick: (id: string) => void
}

// FRONTEND-054-AC-04/05/06: a denser, opt-in alternative to SeriesList's
// expanded row view -- poster, title (year), and a read-only personal rating,
// nothing else (no status, badges, or Edit/Delete/rewatch actions). Each card
// is a real <button> (frontend_spec_008's nested-interactive-controls lesson)
// with an explicit aria-label so the accessible name doesn't depend on the
// nested StarRating's own "Personal rating" label.
export function SeriesCompactGrid({
  series,
  posterErrorIds,
  onPosterError,
  onCardClick,
}: SeriesCompactGridProps) {
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
              data-testid="compact-series-card"
              aria-label={`View details for ${titleYear}`}
              onClick={() => onCardClick(s.id)}
            >
              <div className={styles.thumbnail}>
                {s.posterUrl !== null && !posterErrorIds.has(s.id) && (
                  <img
                    src={s.posterUrl}
                    alt=""
                    className={styles.thumbnailImage}
                    onError={() => onPosterError(s.id)}
                  />
                )}
              </div>
              <span className={styles.title}>{titleYear}</span>
              <StarRating value={s.personalRating} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
