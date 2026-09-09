import { useEffect, useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { FilterProfile, FilterProfileArea } from '../types/filterProfile'
import { describeFilterCriteria } from '../utils/describeFilterCriteria'
import { validateFilterProfileName } from '../utils/filterProfileValidation'
import styles from './FilterProfileAreaGroup.module.css'
import btn from '../styles/buttons.module.css'

interface FilterProfileAreaGroupProps {
  readonly area: FilterProfileArea
  readonly title: string
}

// FRONTEND-108-AC-09/10/11/12: one area's worth of Settings' "Filter
// Profiles" manager -- fetches its own profiles independently (three
// sibling instances in FilterProfileManager.tsx, one per FilterProfileArea,
// never a shared fetch). Management-only: no "currentCriteria" here, so
// there's no create action (this spec's Design Decisions) -- an empty area
// just shows "No saved profiles yet".
export function FilterProfileAreaGroup({
  area,
  title,
}: FilterProfileAreaGroupProps) {
  const [profiles, setProfiles] = useState<FilterProfile<unknown>[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    seriesApi
      .listFilterProfiles<unknown>(area)
      .then((result) => {
        if (!cancelled) setProfiles(result)
      })
      .catch(() => {
        if (!cancelled) setProfiles([])
      })
    return () => {
      cancelled = true
    }
  }, [area])

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  // FRONTEND-108-AC-12: starting rename on a row clears that same row's
  // in-progress delete confirmation -- mutual exclusion, not a hide/show of
  // the trigger button (the Rename trigger stays clickable even while this
  // row's delete is being confirmed, see FilterProfileAreaGroup.test.tsx).
  const handleRenameClick = (profile: FilterProfile<unknown>) => {
    setRenameValue(profile.name)
    setRenameError(null)
    setRenamingId(profile.id)
    setConfirmingDeleteId((prev) => (prev === profile.id ? null : prev))
  }

  const handleRenameCancel = () => {
    setRenamingId(null)
    setRenameError(null)
  }

  const handleRenameSave = async (profile: FilterProfile<unknown>) => {
    const trimmedName = renameValue.trim()
    const result = validateFilterProfileName(
      trimmedName,
      profiles.map((p) => p.name),
      profile.name,
    )
    if (!result.valid) {
      setRenameError(result.error)
      return
    }

    try {
      const updated = await seriesApi.updateFilterProfile<unknown>(profile.id, {
        name: trimmedName,
      })
      setProfiles((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      )
      setRenamingId(null)
      setRenameError(null)
    } catch {
      setRenameError('Failed to rename profile. Please try again.')
    }
  }

  // FRONTEND-108-AC-12: mirrors FilterProfileSelector.tsx's delete
  // confirmation exactly, tracked independently per area group.
  const handleDeleteClick = (profile: FilterProfile<unknown>) => {
    setDeleteError(null)
    setConfirmingDeleteId(profile.id)
    setRenamingId((prev) => (prev === profile.id ? null : prev))
  }

  const handleCancelDelete = () => {
    setConfirmingDeleteId(null)
    setDeleteError(null)
  }

  const handleConfirmDelete = async (id: string) => {
    setDeleteError(null)
    setDeleting(true)
    try {
      await seriesApi.deleteFilterProfile(id)
      setProfiles((prev) => prev.filter((p) => p.id !== id))
      setConfirmingDeleteId(null)
    } catch {
      setDeleteError('Failed to delete profile. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLLIElement>,
    id: string,
  ) => {
    if (event.key === 'Escape' && confirmingDeleteId === id) {
      handleCancelDelete()
    }
  }

  return (
    <div className={styles.group}>
      <h4 className={styles.groupTitle}>{title}</h4>

      {profiles.length === 0 ? (
        <p className={styles.emptyState}>No saved profiles yet</p>
      ) : (
        <ul className={styles.list}>
          {profiles.map((profile) => (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-cancels-delete-confirmation, mirroring SeriesList.tsx's identical pattern; relies on the keydown bubbling up from whichever Confirm/Cancel button currently has focus, the <li> itself is intentionally non-interactive (no role/tabIndex).
            <li
              key={profile.id}
              className={styles.row}
              onKeyDown={(event) => handleRowKeyDown(event, profile.id)}
            >
              <div className={styles.rowHeader}>
                <button
                  type="button"
                  className={styles.nameButton}
                  onClick={() => handleToggleExpand(profile.id)}
                >
                  {profile.name}
                </button>

                <div className={styles.rowActions}>
                  {renamingId === profile.id ? (
                    <div className={styles.renameGroup}>
                      <input
                        type="text"
                        aria-label={`New name for ${profile.name}`}
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                      />
                      <button
                        type="button"
                        className={btn.btnPrimary}
                        onClick={() => handleRenameSave(profile)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className={btn.btnSecondary}
                        onClick={handleRenameCancel}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={btn.btnSecondary}
                      aria-label={`Rename ${profile.name}`}
                      onClick={() => handleRenameClick(profile)}
                    >
                      Rename
                    </button>
                  )}

                  {confirmingDeleteId === profile.id ? (
                    <>
                      <button
                        type="button"
                        className={btn.btnDestructive}
                        data-testid="confirm-delete-btn"
                        disabled={deleting}
                        onClick={() => handleConfirmDelete(profile.id)}
                      >
                        {deleting ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        className={btn.btnSecondary}
                        data-testid="cancel-delete-btn"
                        disabled={deleting}
                        onClick={handleCancelDelete}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={btn.btnDestructive}
                      aria-label={`Delete ${profile.name}`}
                      onClick={() => handleDeleteClick(profile)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {renameError && renamingId === profile.id && (
                <span className={styles.error} role="alert">
                  {renameError}
                </span>
              )}
              {deleteError && confirmingDeleteId === profile.id && (
                <span className={styles.error} role="alert">
                  {deleteError}
                </span>
              )}

              {expandedId === profile.id && (
                <ul className={styles.summary}>
                  {describeFilterCriteria(area, profile.criteria).map(
                    (entry) => (
                      <li key={entry.label}>
                        <strong>{entry.label}:</strong> {entry.value}
                      </li>
                    ),
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
