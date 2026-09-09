import { useState } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { suggestFilterProfileName } from '../utils/describeFilterCriteria'
import { validateFilterProfileName } from '../utils/filterProfileValidation'
import type { FilterProfileArea } from '../types/filterProfile'
import styles from './SaveFilterProfileModal.module.css'
import btn from '../styles/buttons.module.css'

interface SaveFilterProfileModalProps {
  readonly area: FilterProfileArea
  readonly criteria: unknown
  readonly existingNames: readonly string[]
  readonly onSave: (name: string) => Promise<void>
  readonly onClose: () => void
}

function isConflictError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status?: unknown }).status === 409
  )
}

// FRONTEND-108-AC-04/05/06: shell matches SearchFilter.tsx's "Browse
// Keywords" modal exactly (.overlay > .dialog[role=dialog][aria-modal=true]
// [aria-labelledby][onKeyDown={useEscapeToClose(...)}], an <h2> heading, a
// .dialogActions footer) -- this spec's Design Decisions. Replaces
// FilterProfileSelector's old always-visible name <input> + "Save as new"
// button with a single "Save" action that opens this.
export function SaveFilterProfileModal({
  area,
  criteria,
  existingNames,
  onSave,
  onClose,
}: SaveFilterProfileModalProps) {
  const [name, setName] = useState(() =>
    suggestFilterProfileName(area, criteria),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleKeyDown = useEscapeToClose(onClose)

  const handleSave = async () => {
    const result = validateFilterProfileName(name, existingNames)
    if (!result.valid) {
      setError(result.error)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(name.trim())
    } catch (err) {
      // FRONTEND-108-AC-05: a rejected onSave (a server-side 409, e.g. a
      // race between two tabs that both passed the local duplicate check)
      // is shown as the same duplicate-name message as the local check,
      // not a generic failure.
      setSaving(false)
      if (isConflictError(err)) {
        setError(
          `A profile named '${name.trim()}' already exists for this area`,
        )
      } else {
        setError('Failed to save profile. Please try again.')
      }
    }
  }

  return (
    <div className={styles.overlay}>
      {/* A native <dialog> needs showModal()/close() lifecycle management (focus trap, native backdrop) to behave correctly, not just a tag swap -- matches the "Browse Keywords" modal precedent this shell is copied from. Deliberately not converted. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss matches SearchFilter.tsx's "Browse Keywords" modal convention; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
      <div // NOSONAR: typescript:S6819, see comment above
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-filter-profile-heading"
        onKeyDown={handleKeyDown}
      >
        <h2 id="save-filter-profile-heading" className={styles.dialogHeading}>
          Save Filter Profile
        </h2>

        <div className={styles.field}>
          <label htmlFor="save-filter-profile-name">Profile name</label>
          <input
            id="save-filter-profile-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {error && (
          <span className={styles.error} role="alert">
            {error}
          </span>
        )}

        <div className={styles.dialogActions}>
          <button type="button" className={btn.btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={btn.btnPrimary}
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
