import { useState, useEffect } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { RefreshJobStatus } from '../types/series'
import { formatRelativeTime } from '../utils/relativeTime'
import { ExportControls } from './ExportControls'
import styles from './SettingsPage.module.css'

// Within the 2-3s poll cadence called for by FRONTEND-023-AC-12 -- frequent
// enough that a short bulk job's progress feels live, infrequent enough not
// to hammer the status endpoint.
const REFRESH_POLL_INTERVAL_MS = 2500

function buildRefreshProgressText(status: RefreshJobStatus): string {
  const skippedSuffix =
    status.skippedCount > 0 ? ` (${status.skippedCount} skipped)` : ''
  return `Refreshing ${status.completedCount} of ${status.totalCount}${skippedSuffix}...`
}

function buildLastFullRefreshText(status: RefreshJobStatus): string {
  const finishedAt = status.finishedAt as string
  const skippedSuffix =
    status.skippedCount > 0
      ? ` (${status.skippedCount} skipped, already up to date)`
      : ''
  return `Last full refresh: ${formatRelativeTime(finishedAt)}${skippedSuffix}`
}

export function SettingsPage() {
  const [jobStatus, setJobStatus] = useState<RefreshJobStatus | null>(null)
  const [refreshAllError, setRefreshAllError] = useState<string | null>(null)

  const refreshAllInProgress = jobStatus?.status === 'IN_PROGRESS'

  // FRONTEND-072-AC-04 (originally FRONTEND-023-AC-11): check once on mount
  // so a page reload/navigation mid-batch resumes the disabled/polling state
  // instead of showing a stale enabled button.
  useEffect(() => {
    let cancelled = false

    seriesApi
      .getRefreshStatus()
      .then((status) => {
        if (cancelled) return
        setJobStatus(status)
      })
      .catch(() => {
        // Non-critical background check -- leave the button in its default
        // enabled state if the status endpoint itself is unreachable.
      })

    return () => {
      cancelled = true
    }
  }, [])

  // FRONTEND-023-AC-12/13: poll while a bulk job is in progress, whether
  // just started by this click or discovered on mount. Stops itself (via
  // effect cleanup) once jobStatus.status is no longer IN_PROGRESS.
  useEffect(() => {
    if (!refreshAllInProgress) return

    const intervalId = setInterval(() => {
      seriesApi
        .getRefreshStatus()
        .then((status) => {
          setJobStatus(status)
        })
        .catch(() => {
          // Transient poll failure -- keep polling on the next tick rather
          // than surfacing an error for a background check.
        })
    }, REFRESH_POLL_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [refreshAllInProgress])

  const handleRefreshAllClick = () => {
    setRefreshAllError(null)

    seriesApi
      .refreshAll()
      .then((status) => {
        setJobStatus(status)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 409) {
          // FRONTEND-023-AC-14: a job is already running server-side --
          // reflect that the same way a mount-time discovery would, rather
          // than surfacing it as a user-facing error.
          setJobStatus({
            status: 'IN_PROGRESS',
            totalCount: 0,
            completedCount: 0,
            skippedCount: 0,
            startedAt: null,
            finishedAt: null,
          })
          return
        }
        if (err instanceof ApiError) {
          setRefreshAllError(err.message)
        } else {
          setRefreshAllError('An unexpected error occurred. Please try again.')
        }
      })
  }

  return (
    <div className={styles.container} data-testid="settings-view">
      <h2 className={styles.heading}>Settings</h2>
      <p className={styles.placeholder}>
        No settings are available yet — check back soon.
      </p>

      <div className={styles.section}>
        <button
          type="button"
          className={styles.refreshAllButton}
          data-testid="refresh-all-btn"
          disabled={refreshAllInProgress}
          onClick={handleRefreshAllClick}
        >
          Refresh All
        </button>
        {refreshAllInProgress && jobStatus && (
          <span className={styles.refreshProgress}>
            {buildRefreshProgressText(jobStatus)}
          </span>
        )}
        {jobStatus?.finishedAt != null && (
          <span className={styles.lastFullRefresh}>
            {buildLastFullRefreshText(jobStatus)}
          </span>
        )}
      </div>

      {refreshAllError && (
        <div className={styles.error} role="alert">
          <p>{refreshAllError}</p>
        </div>
      )}

      <div className={styles.section}>
        <ExportControls />
      </div>
    </div>
  )
}
