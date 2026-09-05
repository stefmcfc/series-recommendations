import { useEffect, useRef, useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { ImportJobStatus } from '../types/series'
import styles from './ImportControls.module.css'

interface ImportControlsProps {
  readonly onImported: () => void
}

// FRONTEND-057-AC-02: same poll cadence as SettingsPage's bulk-refresh
// polling (REFRESH_POLL_INTERVAL_MS) -- mirrors that pattern exactly.
const IMPORT_POLL_INTERVAL_MS = 2500

function buildSummaryText(status: ImportJobStatus): string {
  let errorSuffix = ''
  if (status.errorCount > 0) {
    const errorNoun = status.errorCount === 1 ? 'error' : 'errors'
    errorSuffix = `, ${status.errorCount} ${errorNoun}`
  }
  return `Imported ${status.importedCount}, skipped ${status.skippedCount}${errorSuffix}`
}

export function ImportControls({ onImported }: ImportControlsProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [jobStatus, setJobStatus] = useState<ImportJobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Tracked in a ref, not state -- this only guards against onImported
  // double-firing across polling ticks, it isn't itself rendered, so it
  // doesn't need to trigger a re-render (react-hooks/set-state-in-effect).
  const notifiedForCurrentJobRef = useRef(false)

  const importInProgress = jobStatus?.status === 'IN_PROGRESS'

  // FRONTEND-057-AC-02: poll while a job started by this click is in
  // progress, stopping itself (via effect cleanup) once jobStatus.status is
  // no longer IN_PROGRESS -- same shape as SettingsPage's refresh-all poll.
  useEffect(() => {
    if (!importInProgress) return

    const intervalId = setInterval(() => {
      seriesApi
        .getImportStatus()
        .then((status) => {
          setJobStatus(status)
        })
        .catch(() => {
          // Transient poll failure -- keep polling on the next tick rather
          // than surfacing an error for a background check.
        })
    }, IMPORT_POLL_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [importInProgress])

  // FRONTEND-057-AC-04: fire onImported exactly once per completed job, and
  // only when something was actually imported -- runs as a side effect of
  // jobStatus updates (whether set by handleImportClick's initial response
  // or a subsequent poll tick) rather than inline in either call site, so it
  // can't double-fire or be missed depending on which one first observes
  // COMPLETED.
  useEffect(() => {
    if (jobStatus?.status !== 'COMPLETED' || notifiedForCurrentJobRef.current)
      return
    notifiedForCurrentJobRef.current = true
    if (jobStatus.importedCount > 0) {
      onImported()
    }
  }, [jobStatus, onImported])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    setError(null)
    setJobStatus(null)
    notifiedForCurrentJobRef.current = false
  }

  const handleImportClick = () => {
    if (!selectedFile) return
    setError(null)
    notifiedForCurrentJobRef.current = false

    seriesApi
      .importSeries(selectedFile)
      .then((status) => {
        setJobStatus(status)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError('An unexpected error occurred. Please try again.')
        }
      })
  }

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      <div className={styles.controls}>
        <input
          type="file"
          accept=".json,application/json"
          data-testid="import-file-input"
          onChange={handleFileChange}
        />
        <button
          type="button"
          data-testid="import-btn"
          className={styles.button}
          disabled={!selectedFile || importInProgress}
          onClick={handleImportClick}
        >
          {importInProgress ? 'Importing...' : 'Import'}
        </button>
      </div>
      {jobStatus?.status === 'COMPLETED' && (
        <div className={styles.summary}>
          <p>{buildSummaryText(jobStatus)}</p>
          {jobStatus.errors.length > 0 && (
            <ul className={styles.errorList}>
              {jobStatus.errors.map((rowError) => (
                <li key={rowError.rowIndex}>
                  Row {rowError.rowIndex}: {rowError.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
