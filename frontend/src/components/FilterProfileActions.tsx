import type { FilterProfile, FilterProfileArea } from '../types/filterProfile'
import { SaveFilterProfileModal } from './SaveFilterProfileModal'
import { UpdateFilterProfileModal } from './UpdateFilterProfileModal'
import styles from './FilterProfileSelector.module.css'
import btn from '../styles/buttons.module.css'

interface FilterProfileActionsProps<TCriteria> {
  readonly area: FilterProfileArea
  readonly currentCriteria: TCriteria
  readonly profiles: readonly FilterProfile<TCriteria>[]
  readonly selectedProfile: FilterProfile<TCriteria> | null
  readonly hasActiveCriteria: boolean
  readonly actionError: string | null
  readonly saveModalOpen: boolean
  readonly setSaveModalOpen: (open: boolean) => void
  readonly handleSaveFromModal: (name: string) => Promise<void>
  readonly updateModalOpen: boolean
  readonly setUpdateModalOpen: (open: boolean) => void
  readonly handleUpdateConfirm: (newName: string) => Promise<void>
  readonly disabled?: boolean
}

// FRONTEND-129-AC-02/AC-05/AC-06/AC-07: extracted from
// FilterProfileSelector.tsx's Save/Update Filters button row
// (frontend_spec_107/108/109) -- the bottom-of-area half of the split,
// sharing state with SavedFiltersList via `useFilterProfileSelector`.
// `data-testid="filter-profile-actions"` is this piece's own testid
// (SavedFiltersList keeps `filter-profile-selector`, this spec's Design
// Decisions). Update Filters now opens a confirmation modal instead of
// overwriting on a single click -- supersedes FRONTEND-107-AC-06.
export function FilterProfileActions<TCriteria>({
  area,
  currentCriteria,
  profiles,
  selectedProfile,
  hasActiveCriteria,
  actionError,
  saveModalOpen,
  setSaveModalOpen,
  handleSaveFromModal,
  updateModalOpen,
  setUpdateModalOpen,
  handleUpdateConfirm,
  disabled = false,
}: FilterProfileActionsProps<TCriteria>) {
  // FRONTEND-107-AC-08: disabled renders nothing.
  if (disabled) {
    return null
  }

  const existingNames = profiles.map((profile) => profile.name)

  return (
    <div className={styles.container} data-testid="filter-profile-actions">
      {/* FRONTEND-109-AC-11: Save is the prominent/primary CTA; Update stays
          secondary. FRONTEND-109-AC-13/14: Save is disabled (with a title
          tooltip explaining why) when there's nothing to save. */}
      <div className={styles.saveRow}>
        <button
          type="button"
          className={`${styles.ctaButton} ${btn.btnPrimary}`}
          disabled={!hasActiveCriteria}
          title={
            hasActiveCriteria
              ? undefined
              : 'Set at least one filter before saving'
          }
          onClick={() => setSaveModalOpen(true)}
        >
          Save Filters
        </button>
        {selectedProfile != null && (
          <button
            type="button"
            className={`${styles.ctaButton} ${btn.btnSecondary}`}
            onClick={() => setUpdateModalOpen(true)}
          >
            Update Saved Filter
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
          existingNames={existingNames}
          onSave={handleSaveFromModal}
          onClose={() => setSaveModalOpen(false)}
        />
      )}

      {updateModalOpen && selectedProfile != null && (
        <UpdateFilterProfileModal
          profile={selectedProfile}
          existingNames={existingNames}
          onUpdate={handleUpdateConfirm}
          onClose={() => setUpdateModalOpen(false)}
        />
      )}
    </div>
  )
}
