import { useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import type { SearchCriteria } from '../types/series'
import styles from './ExportControls.module.css'

interface ExportControlsProps {
  readonly criteria?: SearchCriteria
}

type ExportFormat = 'json' | 'csv'

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ExportControls({ criteria }: ExportControlsProps) {
  const [inFlightFormat, setInFlightFormat] = useState<ExportFormat | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const handleExport = async (format: ExportFormat) => {
    setError(null)
    setInFlightFormat(format)

    try {
      const { blob, filename } = await seriesApi.export(format, criteria)
      triggerDownload(blob, filename)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setInFlightFormat(null)
    }
  }

  const disabled = inFlightFormat !== null

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      <div className={styles.buttons}>
        <button
          type="button"
          data-testid="export-json-btn"
          className={styles.button}
          disabled={disabled}
          onClick={() => handleExport('json')}
        >
          {inFlightFormat === 'json' ? 'Exporting...' : 'Export JSON'}
        </button>
        <button
          type="button"
          data-testid="export-csv-btn"
          className={styles.button}
          disabled={disabled}
          onClick={() => handleExport('csv')}
        >
          {inFlightFormat === 'csv' ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>
    </div>
  )
}
