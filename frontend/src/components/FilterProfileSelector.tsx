import { useEffect, useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { FilterProfile, FilterProfileArea } from '../types/filterProfile'
import { SaveFilterProfileModal } from './SaveFilterProfileModal'
import { describeFilterCriteria } from '../utils/describeFilterCriteria'
import styles from './FilterProfileSelector.module.css'
import btn from '../styles/buttons.module.css'

interface FilterProfileSelectorProps<TCriteria> {
  readonly area: FilterProfileArea
  readonly currentCriteria: TCriteria
  readonly onApply: (criteria: TCriteria) => void
  // FRONTEND-109-AC-10: called instead of onApply when the already-applied
  // chip is clicked again (toggle-off), matching the aria-pressed="true"
  // semantics the chip already carries. Optional so a future consumer with
  // no natural "clear" concept can omit it -- reclicking then just no-ops
  // rather than crashing.
  readonly onClear?: () => void
  readonly disabled?: boolean
}

// FRONTEND-107: one reusable component, wired into three independent areas
// (SearchFilter/UseMySeriesPanel/RecommendationFiltersBox) via their own
// small currentCriteria/onApply adapters -- see frontend_spec_107's Design
// Decisions for the full rationale.
//
// FRONTEND-108-AC-07: the old always-visible name input + "Save as new"
// button is replaced by a single "Save" button that opens
// SaveFilterProfileModal.
//
// FRONTEND-109-AC-02: delete is removed entirely from this component --
// deletion is a Settings-only action, handled independently by
// FilterProfileAreaGroup.tsx's own confirm/cancel row-swap
// (FRONTEND-108-AC-12, unaffected by this change). This supersedes this
// component's former FRONTEND-108-AC-08 delete-with-confirmation behavior.
export function FilterProfileSelector<TCriteria>({
  area,
  currentCriteria,
  onApply,
  onClear,
  disabled = false,
}: FilterProfileSelectorProps<TCriteria>) {
  const [profiles, setProfiles] = useState<FilterProfile<TCriteria>[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

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
    // FRONTEND-109-AC-10: clicking the already-applied chip again toggles it
    // off -- clears back to defaults via the host's own onClear rather than
    // re-applying the same criteria a second time.
    if (selectedId === profile.id) {
      setSelectedId(null)
      onClear?.()
      return
    }

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

  // FRONTEND-109-AC-13: nothing meaningful to save when every field is at
  // its default -- reuses the same "is this criteria empty" check
  // suggestFilterProfileName already relies on (describeFilterCriteria
  // returning zero entries), rather than a second, possibly-diverging
  // empty-check.
  const hasActiveCriteria =
    describeFilterCriteria(area, currentCriteria).length > 0

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

  return (
    <div className={styles.container} data-testid="filter-profile-selector">
      {/* FRONTEND-109-AC-01: labeled as saved presets, matching
          UseMySeriesPanel.tsx's "Filter by Status" fieldset/legend pattern
          exactly. Only rendered once at least one profile exists -- a
          first-time user shouldn't see an empty "Saved Filters" heading. */}
      {profiles.length > 0 && (
        <fieldset className={styles.savedFiltersFieldset}>
          <legend>Saved Filters</legend>
          <ul className={styles.list}>
            {profiles.map((profile) => (
              <li key={profile.id} className={styles.listItem}>
                <button
                  type="button"
                  className={styles.nameButton}
                  aria-pressed={selectedId === profile.id}
                  onClick={() => handleSelect(profile)}
                >
                  {profile.name}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {/* FRONTEND-109-AC-11: Save is the prominent/primary CTA (it's the
          "create" action); Update stays secondary -- matches this app's
          existing primary/secondary tiering convention (e.g. Search vs
          Clear Filters) rather than two visually-identical buttons.
          FRONTEND-109-AC-13/14: disabled (with a title tooltip explaining
          why) when there's nothing to save; labeled "Save Filters" (not a
          bare "Save") to say what's being saved, matching this app's
          existing "Clear Filters"/"Reset Filters" naming. */}
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
        {selectedId != null && (
          <button
            type="button"
            className={`${styles.ctaButton} ${btn.btnSecondary}`}
            onClick={handleUpdate}
          >
            Update Filters
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
