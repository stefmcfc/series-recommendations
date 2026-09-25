import type { Series } from '../types/series'
import type { SourceRankingStrategy } from '../utils/sourceRanking'
import {
  computeCustomRatingBlend,
  MAX_SOURCE_SERIES,
} from '../utils/sourceRanking'
import styles from './SourceRankingPreview.module.css'

interface SourceRankingPreviewProps {
  // FRONTEND-135 Design Decision 6: this component performs no ranking of
  // its own -- it renders `series` in the order given, trusting the caller
  // (UseMySeriesPanel) to have already composed
  // resolveSourceRankingPool/rankSourceSeries.
  readonly series: Series[]
  readonly strategy: SourceRankingStrategy
  readonly blendSources?: string[]
}

const BLEND_STRATEGIES: readonly SourceRankingStrategy[] = [
  'personalRatingThenCustomBlend',
  'customBlendThenPersonalRating',
]

// Matches SeriesDetailFields.tsx's own formatDate exactly -- dateCompleted is
// shown as a raw ISO timestamp everywhere else in this codebase without this,
// which looked out of place next to the rest of this app's date formatting.
function formatDate(value: string | null): string {
  if (value === null) return 'No date'
  return new Date(value).toLocaleDateString()
}

// FRONTEND-135-AC-13 through AC-19: read-only ranked-list preview -- rank
// number, title, and personal rating on every row (Design Decision 3), plus
// the Custom Rating Blend value for the two blend strategies or
// dateCompleted for personalRatingThenDate (that strategy's own tiebreaker),
// a visual cutoff divider/muted styling past MAX_SOURCE_SERIES, and an
// empty-pool hint.
export function SourceRankingPreview({
  series,
  strategy,
  blendSources = [],
}: SourceRankingPreviewProps) {
  if (series.length === 0) {
    return <p className={styles.hint}>No series to preview.</p>
  }

  const isBlendStrategy = BLEND_STRATEGIES.includes(strategy)

  return (
    <ol className={styles.list}>
      {series.map((s, index) => {
        const rank = index + 1
        const isPastCutoff = rank > MAX_SOURCE_SERIES
        return (
          <li key={s.id}>
            {rank === MAX_SOURCE_SERIES + 1 && (
              <p className={styles.cutoffDivider}>
                Won&apos;t be queried (limit: {MAX_SOURCE_SERIES})
              </p>
            )}
            <div
              className={`${styles.row} ${isPastCutoff ? styles.mutedRow : ''}`}
              data-testid="source-ranking-row"
            >
              <span className={styles.rank}>{rank}.</span>
              <span className={styles.title}>{s.title}</span>
              <span className={styles.detail}>
                Personal rating: {s.personalRating ?? 'No rating'}
              </span>
              {isBlendStrategy && (
                <span className={styles.detail}>
                  Blend:{' '}
                  {computeCustomRatingBlend(s, blendSources) ??
                    'No blend value'}
                </span>
              )}
              {strategy === 'personalRatingThenDate' && (
                <span className={styles.detail}>
                  Date completed: {formatDate(s.dateCompleted)}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
