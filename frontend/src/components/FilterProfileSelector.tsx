import { useEffect, useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { FilterProfile, FilterProfileArea } from '../types/filterProfile'
import { SaveFilterProfileModal } from './SaveFilterProfileModal'
import styles from './FilterProfileSelector.module.css'
import btn from '../styles/buttons.module.css'

interface FilterProfileSelectorProps<TCriteria> {
  readonly area: FilterProfileArea
  readonly currentCriteria: TCriteria
  readonly onApply: (criteria: TCriteria) => void
  readonly disabled?: boolean
}

// FRONTEND-107: one reusable component, wired into three independent areas
// (SearchFilter/UseMySeriesPanel/RecommendationFiltersBox) via their own
// small currentCriteria/onApply adapters -- see frontend_spec_107's Design
// Decisions for the full rationale.
//
// FRONTEND-108-AC-07/AC-08: the old always-visible name input + "Save as
// new" button is replaced by a single "Save" button that opens
// SaveFilterProfileModal, and Delete now requires a Confirm/Cancel
// row-swap (mirroring SeriesList.tsx's confirmingDeleteId pattern exactly)
// instead of deleting on a single click -- a real bug fix, not a style
// choice (this spec's Design Decisions).
export function FilterProfileSelector<TCriteria>({
  area,
  currentCriteria,
  onApply,
  disabled = false,
}: FilterProfileSelectorProps<TCriteria>) {
  const [profiles, setProfiles] = useState<FilterProfile<TCriteria>[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // FRONTEND-107-AC-03/AC-08: fetches on mount and whenever `area` changes,
  // but only while enabled -- while `disabled` is true this never runs, so
  // no fetch happens at all (guarded again by the early `return null` below).
  useEffect(() => {
    if (disabled) return undefined

    let cancelled = false
    seriesApi
      .listFilterProfiles<TCriteria>(area)
      .then((result) => {
        if (!cancelled) setProfiles(result)
      })
      .catch(() => {
        if (!cancelled) setProfiles([])
      })

    return () => {
      cancelled = true
    }
  }, [area, disabled])

  // FRONTEND-107-AC-08: disabled renders nothing (or an inert placeholder)
  // and never fetches -- the effect above already guards the fetch, this
  // guards the render.
  if (disabled) {
    return null
  }

  const handleSelect = (profile: FilterProfile<TCriteria>) => {
    // FRONTEND-107-AC-04: select-and-apply immediately, no separate "Load"
    // confirmation step.
    setSelectedId(profile.id)
    onApply(profile.criteria)
  }

  const handleSaveFromModal = async (name: string) => {
    // FRONTEND-108-AC-07: on success the returned profile is appended to
    // `profiles` and the modal is closed here -- a rejected promise
    // propagates back up to the modal itself, which is responsible for
    // showing the duplicate-name message and staying open.
    const created = await seriesApi.createFilterProfile<TCriteria>(
      area,
      name,
      currentCriteria,
    )
    setProfiles((prev) => [...prev, created])
    setSaveModalOpen(false)
  }

  const handleUpdate = async () => {
    if (selectedId == null) return
    try {
      const updated = await seriesApi.updateFilterProfile<TCriteria>(
        selectedId,
        { criteria: currentCriteria },
      )
      setProfiles((prev) =>
        prev.map((profile) => (profile.id === updated.id ? updated : profile)),
      )
    } catch {
      setActionError('Failed to update profile. Please try again.')
    }
  }

  // FRONTEND-108-AC-08: Delete no longer deletes on a single click --
  // clicking it swaps that row's actions to Confirm/Cancel, mirroring
  // SeriesList.tsx's confirmingDeleteId/row-swap pattern exactly.
  const handleDeleteClick = (id: string) => {
    setDeleteError(null)
    setConfirmingDeleteId(id)
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
      setProfiles((prev) => prev.filter((profile) => profile.id !== id))
      setSelectedId((prev) => (prev === id ? null : prev))
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
    <div className={styles.container} data-testid="filter-profile-selector">
      {profiles.length > 0 && (
        <ul className={styles.list}>
          {profiles.map((profile) => (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape-cancels-delete-confirmation, mirroring SeriesList.tsx's identical pattern; relies on the keydown bubbling up from whichever Confirm/Cancel button currently has focus, the <li> itself is intentionally non-interactive (no role/tabIndex).
            <li
              key={profile.id}
              className={styles.listItem}
              onKeyDown={(event) => handleRowKeyDown(event, profile.id)}
            >
              <button
                type="button"
                className={styles.nameButton}
                aria-pressed={selectedId === profile.id}
                onClick={() => handleSelect(profile)}
              >
                {profile.name}
              </button>

              {confirmingDeleteId === profile.id ? (
                <>
                  {deleteError && (
                    <span className={styles.error} role="alert">
                      {deleteError}
                    </span>
                  )}
                  <button
                    type="button"
                    className={`${styles.deleteButton} ${btn.btnDestructive}`}
                    data-testid="confirm-delete-btn"
                    disabled={deleting}
                    onClick={() => handleConfirmDelete(profile.id)}
                  >
                    {deleting ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
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
                  className={styles.deleteButton}
                  aria-label={`Delete ${profile.name}`}
                  onClick={() => handleDeleteClick(profile.id)}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.saveRow}>
        <button
          type="button"
          className={btn.btnSecondary}
          onClick={() => setSaveModalOpen(true)}
        >
          Save
        </button>
        {selectedId != null && (
          <button
            type="button"
            className={btn.btnSecondary}
            onClick={handleUpdate}
          >
            Update
          </button>
        )}
      </div>

      {actionError && (
        <span className={styles.error} role="alert">
          {actionError}
        </span>
      )}

      {saveModalOpen && (
        <SaveFilterProfileModal
          area={area}
          criteria={currentCriteria}
          existingNames={profiles.map((profile) => profile.name)}
          onSave={handleSaveFromModal}
          onClose={() => setSaveModalOpen(false)}
        />
      )}
    </div>
  )
}
