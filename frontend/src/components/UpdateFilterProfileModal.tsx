import { useState } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { validateFilterProfileName } from '../utils/filterProfileValidation'
import styles from './UpdateFilterProfileModal.module.css'
import btn from '../styles/buttons.module.css'

interface UpdateFilterProfileModalProps {
  // FRONTEND-129-AC-06: accepts any FilterProfile-shaped object (id + name +
  // whatever else, e.g. `criteria`) -- this modal only ever reads id/name
  // itself, but FilterProfileActions passes its full `selectedProfile`
  // straight through, and this spec's own test fixtures construct `profile`
  // literals that include `criteria` too.
  readonly profile: {
    readonly id: string
    readonly name: string
    readonly criteria?: unknown
  }
  readonly existingNames: readonly string[]
  readonly onUpdate: (name: string) => Promise<void>
  readonly onClose: () => void
}

// FRONTEND-129-AC-05/06/07: opens instead of FilterProfileActions calling
// seriesApi.updateFilterProfile directly on a single click -- supersedes
// FRONTEND-107-AC-06's silent-overwrite behavior (frontend_spec_107.md, see
// this spec's Design Decisions). Modeled directly on SaveFilterProfileModal's
// shell (.overlay > .dialog[role=dialog][aria-modal=true][aria-labelledby],
// useEscapeToClose, an <h2> heading, a .dialogActions footer) -- the two
// differ enough in behavior (create-vs-update, and the duplicate-name check
// excluding this profile's own current name) to stay two small parallel
// components rather than one parameterized by a `mode` prop.
export function UpdateFilterProfileModal({
  profile,
  existingNames,
  onUpdate,
  onClose,
}: UpdateFilterProfileModalProps) {
  const [name, setName] = useState(profile.name)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleKeyDown = useEscapeToClose(onClose)

  const handleUpdate = async () => {
    // FRONTEND-129-AC-06: excludes the profile's own current name from the
    // duplicate check -- reuses the same `currentName` parameter
    // FilterProfileAreaGroup.tsx's Settings-side rename flow already relies
    // on, rather than a second, possibly-diverging validation path.
    const result = validateFilterProfileName(name, existingNames, profile.name)
    if (!result.valid) {
      setError(result.error)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onUpdate(name.trim())
    } catch {
      // FRONTEND-129-AC-07: shown inside this still-open modal, not the
      // outer action-row error span.
      setSaving(false)
      setError('Failed to update profile. Please try again.')
    }
  }

  return (
    <div className={styles.overlay}>
      {/* A native <dialog> needs showModal()/close() lifecycle management (focus trap, native backdrop) to behave correctly, not just a tag swap -- matches SaveFilterProfileModal.tsx's own precedent. Deliberately not converted. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-to-dismiss matches SaveFilterProfileModal.tsx's convention; the listener lives on the dialog root per the spec's test contract (`screen.getByRole('dialog')`). */}
      <div // NOSONAR: typescript:S6819, see comment above
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-filter-profile-heading"
        onKeyDown={handleKeyDown}
      >
        <h2 id="update-filter-profile-heading" className={styles.dialogHeading}>
          Update Filter Profile
        </h2>

        <div className={styles.field}>
          <label htmlFor="update-filter-profile-name">Profile name</label>
          <input
            id="update-filter-profile-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <p className={styles.notice}>
          Updating will overwrite this profile&apos;s saved filters with your
          current selections.
        </p>

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
            onClick={handleUpdate}
          >
            {saving ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  )
}
