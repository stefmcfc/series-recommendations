import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'
import { formatRelativeTime } from '../utils/relativeTime'
import styles from './SeriesDetail.module.css'
import btn from '../styles/buttons.module.css'

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
  // FRONTEND-052-AC-03/07: opens the "Recommendations for {title}" modal
  // (owned by SeriesDetail.tsx). Disabled (with an explanatory aria-label)
  // when the series is excluded from recommendations -- inviting the user to
  // request recs for a series they've deliberately excluded is a confusing
  // affordance the flag already exists to prevent.
  readonly onRecommendationsClick: () => void
  readonly recommendationsDisabled: boolean
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
  onRecommendationsClick,
  recommendationsDisabled,
}: SeriesDetailActionsPanelProps) {
  if (confirmingDelete) {
    return (
      <div
        className={`${styles.actions} ${styles.actionsSticky}`}
        data-testid="sticky-actions-bar"
      >
        {deleteError && (
          <span className={styles.deleteError} role="alert">
            {deleteError}
          </span>
        )}
        <button
          type="button"
          className={`${styles.confirmDeleteButton} ${btn.btnDestructive}`}
          data-testid="confirm-delete-btn"
          disabled={deleting}
          onClick={onConfirmDelete}
        >
          {deleting ? 'Deleting...' : 'Confirm'}
        </button>
        <button
          type="button"
          className={`${styles.cancelDeleteButton} ${btn.btnSecondary}`}
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
        {/* FRONTEND-104-AC-02: rendered before actionsRow so the sticky bar
            below is the last flow child of actionsGroup -- see Design
            Decisions in frontend_spec_104_sticky_action_bars.md for why the
            reverse order would visually collide with the stuck bar once
            scrolled to the page's end. */}
        {(series.lastRefreshedAt !== null ||
          series.newContentDetectedAt !== null) && (
          <div className={styles.actionsInfo} data-testid="actions-info">
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
                  className={`${styles.dismissNewContentButton} ${btn.btnSecondary}`}
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

        <div
          className={`${styles.actionsRow} ${styles.actionsSticky}`}
          data-testid="sticky-actions-bar"
        >
          <div className={styles.actionsLeft} data-testid="actions-left">
            <button
              type="button"
              className={`${styles.editButton} ${btn.btnSecondary}`}
              data-testid="edit-series-btn"
              onClick={onEditClick}
            >
              Edit
            </button>
            <button
              type="button"
              className={`${styles.deleteButton} ${btn.btnDestructive}`}
              data-testid="delete-series-btn"
              onClick={onDeleteClick}
            >
              Delete
            </button>
            <button
              type="button"
              className={`${styles.refreshButton} ${btn.btnSecondary}`}
              data-testid="refresh-series-btn"
              disabled={refreshing}
              onClick={onRefreshClick}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className={styles.actionsRight} data-testid="actions-right">
            <button
              type="button"
              className={`${styles.recommendationsButton} ${btn.btnSecondary}`}
              data-testid="recommendations-btn"
              disabled={recommendationsDisabled}
              aria-label={
                recommendationsDisabled
                  ? 'This series is excluded from recommendations'
                  : undefined
              }
              onClick={onRecommendationsClick}
            >
              Recommendations
            </button>
            {series.status === SeriesStatus.COMPLETED && (
              <button
                type="button"
                className={`${styles.rewatchToggle} ${
                  series.flaggedForRewatch
                    ? `${styles.rewatchToggleActive} ${btn.btnPrimary}`
                    : ''
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
      </div>
    </div>
  )
}
