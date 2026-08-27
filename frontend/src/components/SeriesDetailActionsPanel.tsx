import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'
import { formatRelativeTime } from '../utils/relativeTime'
import styles from './SeriesDetail.module.css'

interface SeriesDetailActionsPanelProps {
  readonly confirmingDelete: boolean
  readonly deleteError: string | null
  readonly deleting: boolean
  readonly onConfirmDelete: () => void
  readonly onCancelDelete: () => void
  readonly onEditClick: () => void
  readonly onDeleteClick: () => void
  readonly refreshing: boolean
  readonly onRefreshClick: () => void
  readonly series: Series
  readonly onRewatchToggle: () => void
  readonly acknowledging: boolean
  readonly onDismissNewContentClick: () => void
}

// Extracted alongside SeriesDetailFields to pull SeriesDetail's cognitive
// complexity down (typescript:S3776 -- the confirm/cancel branch plus the
// nested rewatch-toggle/last-refreshed/new-content conditionals were a large
// chunk of the original method's score).
export function SeriesDetailActionsPanel({
  confirmingDelete,
  deleteError,
  deleting,
  onConfirmDelete,
  onCancelDelete,
  onEditClick,
  onDeleteClick,
  refreshing,
  onRefreshClick,
  series,
  onRewatchToggle,
  acknowledging,
  onDismissNewContentClick,
}: SeriesDetailActionsPanelProps) {
  if (confirmingDelete) {
    return (
      <div className={styles.actions}>
        {deleteError && (
          <span className={styles.deleteError} role="alert">
            {deleteError}
          </span>
        )}
        <button
          type="button"
          className={styles.confirmDeleteButton}
          data-testid="confirm-delete-btn"
          disabled={deleting}
          onClick={onConfirmDelete}
        >
          {deleting ? 'Deleting...' : 'Confirm'}
        </button>
        <button
          type="button"
          className={styles.cancelDeleteButton}
          data-testid="cancel-delete-btn"
          disabled={deleting}
          onClick={onCancelDelete}
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className={styles.actions}>
      <div className={styles.actionsGroup}>
        <div className={styles.actionsRow}>
          <div className={styles.actionsLeft}>
            <button
              type="button"
              className={styles.editButton}
              data-testid="edit-series-btn"
              onClick={onEditClick}
            >
              Edit
            </button>
            <button
              type="button"
              className={styles.deleteButton}
              data-testid="delete-series-btn"
              onClick={onDeleteClick}
            >
              Delete
            </button>
            <button
              type="button"
              className={styles.refreshButton}
              data-testid="refresh-series-btn"
              disabled={refreshing}
              onClick={onRefreshClick}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className={styles.actionsRight}>
            {series.status === SeriesStatus.COMPLETED && (
              <button
                type="button"
                className={`${styles.rewatchToggle} ${
                  series.flaggedForRewatch ? styles.rewatchToggleActive : ''
                }`}
                aria-label={
                  series.flaggedForRewatch
                    ? 'Flagged for rewatch'
                    : 'Flag for rewatch'
                }
                aria-pressed={series.flaggedForRewatch}
                onClick={onRewatchToggle}
              >
                {series.flaggedForRewatch
                  ? 'Flagged for rewatch'
                  : 'Flag for rewatch'}
              </button>
            )}
          </div>
        </div>

        {(series.lastRefreshedAt !== null ||
          series.newContentDetectedAt !== null) && (
          <div className={styles.actionsInfo}>
            {series.lastRefreshedAt !== null && (
              <span className={styles.lastRefreshed}>
                Last refreshed {formatRelativeTime(series.lastRefreshedAt)}
              </span>
            )}
            {series.newContentDetectedAt !== null && (
              <>
                <span
                  className={styles.newContentBadge}
                  data-testid="new-content-badge"
                >
                  New content
                </span>
                <button
                  type="button"
                  className={styles.dismissNewContentButton}
                  data-testid="dismiss-new-content-btn"
                  disabled={acknowledging}
                  onClick={onDismissNewContentClick}
                >
                  {acknowledging ? 'Dismissing...' : 'Dismiss'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
