import { useState, useEffect } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { RefreshJobStatus } from '../types/series'
import { formatRelativeTime } from '../utils/relativeTime'
import { ExportControls } from './ExportControls'
import { ImportControls } from './ImportControls'
import { SettingsSection } from './SettingsSection'
import styles from './SettingsPage.module.css'

// Within the 2-3s poll cadence called for by FRONTEND-023-AC-12 -- frequent
// enough that a short bulk job's progress feels live, infrequent enough not
// to hammer the status endpoint.
const REFRESH_POLL_INTERVAL_MS = 2500

// FRONTEND-097-AC-08: mention the threshold that actually governed the run
// whenever anything was skipped, so a skip is never reported without the
// context that produced it.
function buildThresholdSuffix(status: RefreshJobStatus): string {
  return status.skippedCount > 0
    ? `, threshold: ${status.skipThresholdMinutesUsed} min`
    : ''
}

// Exported for direct unit coverage of FRONTEND-097-AC-08 (see
// SettingsPage.test.tsx) -- not used outside this module otherwise.
// eslint-disable-next-line react-refresh/only-export-components -- see the eslint-disable comment on RecommendationControls.tsx's COUNTRY_PINNED_OPTIONS for rationale; Fast Refresh state loss on an edit here is an acceptable, deliberate tradeoff in exchange for these being directly unit-testable.
export function buildRefreshProgressText(status: RefreshJobStatus): string {
  const skippedSuffix =
    status.skippedCount > 0
      ? ` (${status.skippedCount} skipped${buildThresholdSuffix(status)})`
      : ''
  return `Refreshing ${status.completedCount} of ${status.totalCount}${skippedSuffix}...`
}

// eslint-disable-next-line react-refresh/only-export-components -- see the eslint-disable comment on buildRefreshProgressText above for rationale.
export function buildLastFullRefreshText(status: RefreshJobStatus): string {
  const finishedAt = status.finishedAt as string
  const skippedSuffix =
    status.skippedCount > 0
      ? ` (${status.skippedCount} skipped, already up to date${buildThresholdSuffix(status)})`
      : ''
  return `Last full refresh: ${formatRelativeTime(finishedAt)}${skippedSuffix}`
}

export function SettingsPage() {
  const [jobStatus, setJobStatus] = useState<RefreshJobStatus | null>(null)
  const [refreshAllError, setRefreshAllError] = useState<string | null>(null)
  // FRONTEND-097-AC-05/06/07: plain string state so a blank field is
  // unambiguous (vs. a number field defaulting to 0) -- parsed to a number
  // only at click time, and omitted from the call entirely when blank.
  const [skipThresholdOverride, setSkipThresholdOverride] = useState('')

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

    // FRONTEND-097-AC-06/07: a blank field sends no override at all --
    // seriesApi.refreshAll() omits skipThresholdMinutesOverride from the
    // request body entirely rather than sending null/0/undefined.
    const trimmedOverride = skipThresholdOverride.trim()
    const overrideValue =
      trimmedOverride === '' ? undefined : Number(trimmedOverride)

    seriesApi
      .refreshAll(overrideValue)
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
            // FRONTEND-097-AC-09: carry forward the most recently known
            // value rather than fabricating one -- 0 if none is known yet.
            skipThresholdMinutesUsed: jobStatus?.skipThresholdMinutesUsed ?? 0,
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

  // FRONTEND-057-AC-04: SettingsPage is mounted at a standalone route (see
  // App.tsx's <Route path="/settings" ...>) with no key-bump refresh
  // callback threaded down to it, unlike AddSeriesForm/EditSeriesForm --
  // and there's no existing precedent for one, since Refresh All's own
  // success above doesn't trigger a live SeriesList refresh either. Both
  // rely on SeriesList remounting (and re-fetching) naturally when the user
  // navigates back to /my-series, so this is intentionally a no-op rather
  // than new App.tsx-level plumbing built solely for this one callback.
  const handleImported = () => {}

  return (
    <div className={styles.container} data-testid="settings-view">
      <h2 className={styles.heading}>Settings</h2>

      <SettingsSection title="Refresh All">
        <div className={styles.refreshRow}>
          <button
            type="button"
            className={styles.refreshAllButton}
            data-testid="refresh-all-btn"
            disabled={refreshAllInProgress}
            onClick={handleRefreshAllClick}
          >
            Refresh All
          </button>
          <div className={styles.overrideField}>
            <label htmlFor="refresh-skip-threshold-override">
              Skip Threshold Override (minutes)
            </label>
            <input
              id="refresh-skip-threshold-override"
              type="number"
              min={0}
              value={skipThresholdOverride}
              onChange={(event) => setSkipThresholdOverride(event.target.value)}
            />
          </div>
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
      </SettingsSection>

      {refreshAllError && (
        <div className={styles.error} role="alert">
          <p>{refreshAllError}</p>
        </div>
      )}

      <SettingsSection title="Export">
        <ExportControls />
      </SettingsSection>

      <SettingsSection title="Import">
        <ImportControls onImported={handleImported} />
      </SettingsSection>
    </div>
  )
}
