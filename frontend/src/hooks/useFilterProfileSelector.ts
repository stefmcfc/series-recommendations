import { useEffect, useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { FilterProfile, FilterProfileArea } from '../types/filterProfile'
import { describeFilterCriteria } from '../utils/describeFilterCriteria'
import { validateFilterCriteria } from '../utils/filterCriteriaValidation'

// FRONTEND-129-AC-01: extracted from FilterProfileSelector.tsx's own
// fetch/selection/modal state (frontend_spec_107/109) -- now shared by
// SavedFiltersList and FilterProfileActions via a single call per host, so
// the two rendered pieces agree on `profiles`/`selectedId` without a second
// fetch (this spec's Design Decisions).

interface UseFilterProfileSelectorArgs<TCriteria> {
  readonly area: FilterProfileArea
  readonly currentCriteria: TCriteria
  readonly onApply: (criteria: TCriteria) => void
  // FRONTEND-109-AC-10: called instead of onApply when the already-applied
  // chip is clicked again (toggle-off).
  readonly onClear?: () => void
  readonly disabled?: boolean
}

export interface UseFilterProfileSelectorResult<TCriteria> {
  profiles: FilterProfile<TCriteria>[]
  selectedId: string | null
  selectedProfile: FilterProfile<TCriteria> | null
  handleSelect: (profile: FilterProfile<TCriteria>) => void
  hasActiveCriteria: boolean
  actionError: string | null
  saveModalOpen: boolean
  setSaveModalOpen: (open: boolean) => void
  handleSaveFromModal: (name: string) => Promise<void>
  // FRONTEND-129-AC-05/06/07: Update Filters now opens a confirmation modal
  // instead of overwriting on a single click -- supersedes
  // FRONTEND-107-AC-06 (frontend_spec_107.md).
  updateModalOpen: boolean
  setUpdateModalOpen: (open: boolean) => void
  handleUpdateConfirm: (newName: string) => Promise<void>
}

export function useFilterProfileSelector<TCriteria>({
  area,
  currentCriteria,
  onApply,
  onClear,
  disabled = false,
}: UseFilterProfileSelectorArgs<TCriteria>): UseFilterProfileSelectorResult<TCriteria> {
  const [profiles, setProfiles] = useState<FilterProfile<TCriteria>[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // FRONTEND-107-AC-03/AC-08: fetches on mount and whenever `area` changes,
  // but only while enabled -- while `disabled` is true this never runs.
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

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedId) ?? null

  const handleSelect = (profile: FilterProfile<TCriteria>) => {
    // FRONTEND-109-AC-10: clicking the already-applied chip again toggles it
    // off -- clears back to defaults via the host's own onClear rather than
    // re-applying the same criteria a second time.
    if (selectedId === profile.id) {
      setSelectedId(null)
      onClear?.()
      return
    }

    // FRONTEND-109-AC-17: guards against a profile saved with an
    // out-of-range value from ever being applied unvalidated.
    const { valid } = validateFilterCriteria(area, profile.criteria)
    if (!valid) {
      setActionError(
        `"${profile.name}" has an invalid saved value and can't be applied. Delete it from Settings and re-save it.`,
      )
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
    // propagates back up to the modal itself, which shows the duplicate-name
    // message and stays open.
    const created = await seriesApi.createFilterProfile<TCriteria>(
      area,
      name,
      currentCriteria,
    )
    setProfiles((prev) => [...prev, created])
    setSaveModalOpen(false)
  }

  // FRONTEND-109-AC-13: nothing meaningful to save when every field is at
  // its default.
  const hasActiveCriteria =
    describeFilterCriteria(area, currentCriteria).length > 0

  // FRONTEND-129-AC-07: sends the (possibly renamed) name and the current
  // criteria together in one PATCH; on success the returned profile replaces
  // its prior entry and the modal closes. On failure this rejects rather
  // than swallowing the error, so UpdateFilterProfileModal's own try/catch
  // can show it in-modal (not the outer action-row error span) and keep the
  // modal open -- mirrors handleSaveFromModal's own "let the modal handle
  // rejection" contract.
  const handleUpdateConfirm = async (newName: string) => {
    if (selectedId == null) return
    const updated = await seriesApi.updateFilterProfile<TCriteria>(selectedId, {
      name: newName,
      criteria: currentCriteria,
    })
    setProfiles((prev) =>
      prev.map((profile) => (profile.id === updated.id ? updated : profile)),
    )
    setUpdateModalOpen(false)
  }

  return {
    profiles,
    selectedId,
    selectedProfile,
    handleSelect,
    hasActiveCriteria,
    actionError,
    saveModalOpen,
    setSaveModalOpen,
    handleSaveFromModal,
    updateModalOpen,
    setUpdateModalOpen,
    handleUpdateConfirm,
  }
}
