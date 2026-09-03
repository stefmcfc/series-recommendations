import { useState } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import styles from './GenreIncludeExcludePicker.module.css'

export type GenreIncludeExcludeMode = 'includeExclude' | 'excludeOnly'

type GenreToggleState = 'neutral' | 'include' | 'exclude'

interface GenreIncludeExcludeChange {
  readonly included: string[]
  readonly excluded: string[]
}

interface GenreIncludeExcludePickerProps {
  readonly idPrefix: string
  readonly label: string
  readonly genreOptions: string[]
  readonly included: string[]
  readonly excluded: string[]
  readonly onChange: (next: GenreIncludeExcludeChange) => void
  readonly mode?: GenreIncludeExcludeMode
}

// FRONTEND-067-AC-10: a genre present in both `included` and `excluded` (a
// caller bug -- the component's own toggle logic can never produce this)
// resolves to `exclude`, mirroring SERIES-042-AC-05's backend precedent.
function resolveGenreState(
  genre: string,
  included: string[],
  excluded: string[],
): GenreToggleState {
  if (excluded.includes(genre)) return 'exclude'
  if (included.includes(genre)) return 'include'
  return 'neutral'
}

function nextGenreLists(
  genre: string,
  included: string[],
  excluded: string[],
  mode: GenreIncludeExcludeMode,
): GenreIncludeExcludeChange {
  const current = resolveGenreState(genre, included, excluded)

  if (mode === 'excludeOnly') {
    return current === 'exclude'
      ? { included, excluded: excluded.filter((g) => g !== genre) }
      : { included, excluded: [...excluded, genre] }
  }

  if (current === 'neutral') {
    return { included: [...included, genre], excluded }
  }
  if (current === 'include') {
    return {
      included: included.filter((g) => g !== genre),
      excluded: [...excluded, genre],
    }
  }
  return { included, excluded: excluded.filter((g) => g !== genre) }
}

function buildTriggerSummary(
  label: string,
  included: string[],
  excluded: string[],
): string {
  const parts: string[] = []
  if (included.length > 0) parts.push(`${included.length} included`)
  if (excluded.length > 0) parts.push(`${excluded.length} excluded`)
  return parts.length === 0 ? label : `${label} — ${parts.join(', ')}`
}

// FRONTEND-067: shared trigger-button-plus-modal genre picker. One toggle
// control per genre cycles neutral -> include -> exclude -> neutral (or
// neutral -> exclude -> neutral in `excludeOnly` mode), making mutual
// exclusivity between `included`/`excluded` structural rather than a
// validation rule layered on two independent lists. Controlled component --
// `included`/`excluded` are props, `onChange` is the only way state changes.
export function GenreIncludeExcludePicker({
  idPrefix,
  label,
  genreOptions,
  included,
  excluded,
  onChange,
  mode = 'includeExclude',
}: GenreIncludeExcludePickerProps) {
  const [open, setOpen] = useState(false)

  const handleToggle = (genre: string) => {
    onChange(nextGenreLists(genre, included, excluded, mode))
  }

  const handleClear = () => {
    onChange({ included: [], excluded: [] })
  }

  const handleDone = () => {
    setOpen(false)
  }

  const handleDialogKeyDown = useEscapeToClose(() => setOpen(false))

  const headingId = `${idPrefix}-genre-picker-heading`

  return (
    <>
      <button
        type="button"
        className={styles.triggerButton}
        onClick={() => setOpen(true)}
      >
        {buildTriggerSummary(label, included, excluded)}
      </button>

      {open && (
        <div className={styles.overlay}>
          {/* A native <dialog> needs showModal()/close() lifecycle management (focus trap, native backdrop) to behave correctly, not just a tag swap -- deliberately not converted here, mirroring UseMySeriesPanel.tsx's "Browse Series" modal and SearchFilter.tsx's "Browse all keywords" modal (jsdom's <dialog> support has known gaps). */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss is standard dialog behavior, matching UseMySeriesPanel.tsx/SearchFilter.tsx's modals; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
          <div // NOSONAR: typescript:S6819, see comment above
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            onKeyDown={handleDialogKeyDown}
          >
            <h2 id={headingId} className={styles.dialogHeading}>
              {label}
            </h2>

            <div className={styles.genreGrid}>
              {genreOptions.map((genre) => {
                const state = resolveGenreState(genre, included, excluded)
                return (
                  <button
                    key={genre}
                    type="button"
                    className={styles.genreToggle}
                    data-state={state}
                    aria-label={`${genre}: ${state}`}
                    onClick={() => handleToggle(genre)}
                  >
                    <span aria-hidden="true">{genre}</span>
                  </button>
                )
              })}
            </div>

            <div className={styles.dialogActions}>
              <button
                type="button"
                data-testid={`${idPrefix}-genre-picker-clear-btn`}
                className={styles.clearButton}
                onClick={handleClear}
              >
                Clear
              </button>
              <button
                type="button"
                className={styles.doneButton}
                onClick={handleDone}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
