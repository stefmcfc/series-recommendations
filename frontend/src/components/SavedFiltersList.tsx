import type { FilterProfile, FilterProfileArea } from '../types/filterProfile'
import { describeFilterCriteria } from '../utils/describeFilterCriteria'
import styles from './FilterProfileSelector.module.css'

interface SavedFiltersListProps<TCriteria> {
  readonly area: FilterProfileArea
  readonly profiles: readonly FilterProfile<TCriteria>[]
  readonly selectedId: string | null
  readonly handleSelect: (profile: FilterProfile<TCriteria>) => void
  readonly disabled?: boolean
}

// FRONTEND-129-AC-02/AC-04: extracted from FilterProfileSelector.tsx's
// "Saved Filters" chip list (frontend_spec_107/109) -- now the top-of-area
// half of the split, sharing its state with FilterProfileActions via the
// `useFilterProfileSelector` hook rather than fetching independently.
// `data-testid="filter-profile-selector"` stays on this piece's root, since
// every existing host test locates the picker by finding the list first
// (this spec's Design Decisions).
export function SavedFiltersList<TCriteria>({
  area,
  profiles,
  selectedId,
  handleSelect,
  disabled = false,
}: SavedFiltersListProps<TCriteria>) {
  // FRONTEND-107-AC-08: disabled renders nothing.
  if (disabled) {
    return null
  }

  // FRONTEND-129-AC-02: the root (and its testid) render unconditionally --
  // every host locates the picker by this testid before asserting on chip
  // content, regardless of whether any profile exists yet. Only the
  // "Saved Filters" fieldset/legend inside it is conditional
  // (FRONTEND-109-AC-01: a first-time user shouldn't see an empty heading).
  return (
    <div className={styles.container} data-testid="filter-profile-selector">
      {profiles.length > 0 && (
        <fieldset className={styles.savedFiltersFieldset}>
          <legend>Saved Filters</legend>
          <ul className={styles.list}>
            {profiles.map((profile) => {
              // FRONTEND-129-AC-04: reuses the same describer Settings' own
              // FilterProfileAreaGroup.tsx already turns into a rendered
              // expand-on-click summary -- flattened into one `title` string
              // as a lightweight native hover tooltip instead. Omitted
              // (`undefined`, not `title=""`) when there's nothing to
              // describe, since an empty title is present-but-blank and some
              // assistive tech still announces it.
              const entries = describeFilterCriteria(area, profile.criteria)
              const title =
                entries.length > 0
                  ? entries
                      .map((entry) => `${entry.label}: ${entry.value}`)
                      .join('\n')
                  : undefined

              return (
                <li key={profile.id} className={styles.listItem}>
                  <button
                    type="button"
                    className={styles.nameButton}
                    aria-pressed={selectedId === profile.id}
                    title={title}
                    onClick={() => handleSelect(profile)}
                  >
                    {profile.name}
                  </button>
                </li>
              )
            })}
          </ul>
        </fieldset>
      )}
    </div>
  )
}
