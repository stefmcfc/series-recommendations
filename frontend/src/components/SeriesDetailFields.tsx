import { SeriesStatus } from '../types/series'
import type { Series, StreamingProvider } from '../types/series'
import { StreamingProviders } from './StreamingProviders'
import { StarRating } from './StarRating'
import styles from './SeriesDetail.module.css'

interface SeriesDetailFieldsProps {
  readonly series: Series
  readonly streamingCheckLoading: boolean
  readonly streamingCheckError: string | null
  readonly streamingCheckResult: StreamingProvider[] | null
  readonly onCheckStreamingClick: () => void
}

// Extracted alongside SeriesDetailActionsPanel to pull SeriesDetail's cognitive
// complexity down (typescript:S3776 -- the ~30 nested conditional-rendering
// decision points in this block were the bulk of the original method's score).
// These formatters only apply to this block's fields, so they moved here too.
function formatValue(value: string | number | null): string {
  return value === null ? '—' : String(value)
}

function formatPercent(value: number | null, emoji: string): string {
  return value === null ? '—' : `${value}% ${emoji}`
}

function formatDate(value: string | null): string {
  if (value === null) return '—'
  return new Date(value).toLocaleDateString()
}

function formatProductionStatus(value: string | null): string {
  if (value == null) return '—'
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Temporary toggle while deciding whether section headers ("Details",
// "Ratings", "Personal", "Timeline") read better than the plain grouped rows
// -- flip via VITE_SERIES_DETAIL_SECTION_HEADERS=false in .env.local (no
// rebuild needed for `npm run dev`, just a page reload). Defaults on.
const SHOW_SECTION_HEADERS =
  (import.meta.env.VITE_SERIES_DETAIL_SECTION_HEADERS as string | undefined) !==
  'false'

export function SeriesDetailFields({
  series,
  streamingCheckLoading,
  streamingCheckError,
  streamingCheckResult,
  onCheckStreamingClick,
}: SeriesDetailFieldsProps) {
  return (
    <div className={styles.fields}>
      <dl className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <dt>Overview</dt>
            <dd>{formatValue(series.overview)}</dd>
          </div>
        </div>
      </dl>

      <div className={styles.streamingCheck}>
        <button
          type="button"
          className={styles.streamingCheckButton}
          disabled={streamingCheckLoading}
          onClick={onCheckStreamingClick}
        >
          {streamingCheckLoading
            ? 'Checking...'
            : 'Check Streaming Availability'}
        </button>
        {streamingCheckError && (
          <span className={styles.streamingCheckError} role="alert">
            {streamingCheckError}
          </span>
        )}
        {streamingCheckResult !== null && (
          <StreamingProviders providers={streamingCheckResult} />
        )}
      </div>

      <dl className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <dt>Genres</dt>
            <dd>{formatValue(series.genres)}</dd>
          </div>
        </div>
      </dl>

      <dl className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <dt>Keywords</dt>
            <dd>
              {(series.keywords ?? []).length === 0
                ? '—'
                : series.keywords.map((keyword) => (
                    <span key={keyword} className={styles.keywordChip}>
                      {keyword}
                    </span>
                  ))}
            </dd>
          </div>
        </div>
      </dl>

      <div className={styles.fieldSection}>
        {SHOW_SECTION_HEADERS && (
          <h3 className={styles.sectionHeader}>Details</h3>
        )}
        <dl className={styles.fieldGroup}>
          <div className={`${styles.fieldRow} ${styles.threeColRow}`}>
            <div className={styles.field}>
              <dt>Production Status</dt>
              <dd>{formatProductionStatus(series.productionStatus)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Total Seasons</dt>
              <dd>{formatValue(series.totalSeasons)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Total Episodes</dt>
              <dd>{formatValue(series.totalEpisodes)}</dd>
            </div>
          </div>

          {series.status !== SeriesStatus.COMPLETED && (
            <div className={`${styles.fieldRow} ${styles.threeColRow}`}>
              <div className={styles.field}>
                <dt>Current Season</dt>
                <dd>{formatValue(series.currentSeason)}</dd>
              </div>
              <div className={styles.field}>
                <dt>Current Episode</dt>
                <dd>{formatValue(series.currentEpisode)}</dd>
              </div>
            </div>
          )}
        </dl>
      </div>

      <div className={styles.fieldSection}>
        {SHOW_SECTION_HEADERS && (
          <h3 className={styles.sectionHeader}>Ratings</h3>
        )}
        <dl className={styles.fieldGroup}>
          <div className={`${styles.fieldRow} ${styles.threeColRow}`}>
            <div className={styles.field}>
              <dt>IMDb Rating</dt>
              <dd>{formatValue(series.imdbRating)}</dd>
            </div>
            <div className={styles.field}>
              <dt>TMDB Rating</dt>
              <dd>{formatValue(series.tmdbRating)}</dd>
            </div>
            <div className={styles.field}>
              <dt>TMDB Vote Count</dt>
              <dd>{formatValue(series.tmdbVoteCount)}</dd>
            </div>
          </div>

          <div className={`${styles.fieldRow} ${styles.threeColRow}`}>
            <div className={styles.field}>
              <dt>Rotten Tomatoes Rating (Tomatometer)</dt>
              <dd>{formatPercent(series.rottenTomatoesRating, '🍅')}</dd>
            </div>
            <div className={styles.field}>
              <dt>Rotten Tomatoes Rating (Popcornmeter)</dt>
              <dd>{formatPercent(series.rottenTomatoesPopcornmeter, '🍿')}</dd>
            </div>
            <div className={styles.field}>
              <dt>Personal Rating</dt>
              <dd>
                <StarRating value={series.personalRating} />
              </dd>
            </div>
          </div>
        </dl>
      </div>

      <div className={styles.fieldSection}>
        {SHOW_SECTION_HEADERS && (
          <h3 className={styles.sectionHeader}>Personal</h3>
        )}
        <dl className={styles.fieldGroup}>
          <div className={`${styles.fieldRow} ${styles.threeColRow}`}>
            <div className={styles.field}>
              <dt>Tags</dt>
              <dd>{formatValue(series.tags)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Personal Notes</dt>
              <dd>{formatValue(series.personalNotes)}</dd>
            </div>
          </div>
        </dl>
      </div>

      <div className={styles.fieldSection}>
        {SHOW_SECTION_HEADERS && (
          <h3 className={styles.sectionHeader}>Timeline</h3>
        )}
        <dl className={styles.fieldGroup}>
          <div className={`${styles.fieldRow} ${styles.threeColRow}`}>
            <div className={styles.field}>
              <dt>Date Added</dt>
              <dd>{formatDate(series.dateAdded)}</dd>
            </div>
            <div className={styles.field}>
              <dt>Date Completed</dt>
              <dd>{formatDate(series.dateCompleted)}</dd>
            </div>
          </div>
        </dl>
      </div>
    </div>
  )
}
