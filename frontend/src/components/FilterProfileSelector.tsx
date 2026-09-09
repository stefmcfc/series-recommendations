import { useEffect, useState } from 'react'
import { seriesApi } from '../services/seriesApi'
import type { FilterProfile, FilterProfileArea } from '../types/filterProfile'
import styles from './FilterProfileSelector.module.css'
import btn from '../styles/buttons.module.css'

interface FilterProfileSelectorProps<TCriteria> {
  readonly area: FilterProfileArea
  readonly currentCriteria: TCriteria
  readonly onApply: (criteria: TCriteria) => void
  readonly disabled?: boolean
}

function isConflictError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status?: unknown }).status === 409
  )
}

// FRONTEND-107: one reusable component, wired into three independent areas
// (SearchFilter/UseMySeriesPanel/RecommendationFiltersBox) via their own
// small currentCriteria/onApply adapters -- see frontend_spec_107's Design
// Decisions for the full rationale.
export function FilterProfileSelector<TCriteria>({
  area,
  currentCriteria,
  onApply,
  disabled = false,
}: FilterProfileSelectorProps<TCriteria>) {
  const [profiles, setProfiles] = useState<FilterProfile<TCriteria>[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

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

  const handleSaveAsNew = async () => {
    setSaveError(null)
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setSaveError('Enter a name for this profile.')
      return
    }
    try {
      const created = await seriesApi.createFilterProfile<TCriteria>(
        area,
        trimmedName,
        currentCriteria,
      )
      setProfiles((prev) => [...prev, created])
      setName('')
    } catch (err) {
      // FRONTEND-107-AC-05: inline error near the input on a 409 conflict --
      // not a toast/global notification, matching RecommendationFiltersBox's
      // existing minVoteCountError inline-error convention.
      if (isConflictError(err)) {
        setSaveError(
          `A profile named '${trimmedName}' already exists for this area`,
        )
      } else {
        setSaveError('Failed to save profile. Please try again.')
      }
    }
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
      setSaveError('Failed to update profile. Please try again.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await seriesApi.deleteFilterProfile(id)
      setProfiles((prev) => prev.filter((profile) => profile.id !== id))
      setSelectedId((prev) => (prev === id ? null : prev))
    } catch {
      setSaveError('Failed to delete profile. Please try again.')
    }
  }

  const nameInputId = `filter-profile-name-${area}`

  return (
    <div className={styles.container} data-testid="filter-profile-selector">
      {profiles.length > 0 && (
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
              <button
                type="button"
                className={styles.deleteButton}
                aria-label={`Delete ${profile.name}`}
                onClick={() => handleDelete(profile.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.saveRow}>
        <label htmlFor={nameInputId}>Profile name</label>
        <input
          id={nameInputId}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="button"
          className={btn.btnSecondary}
          onClick={handleSaveAsNew}
        >
          Save as new
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

      {saveError && (
        <span className={styles.error} role="alert">
          {saveError}
        </span>
      )}
    </div>
  )
}
