import type { FilterProfileArea } from '../types/filterProfile'
import { FilterProfileAreaGroup } from './FilterProfileAreaGroup'
import styles from './FilterProfileManager.module.css'

// FRONTEND-108-AC-09: three independent sub-groups, one per
// FilterProfileArea -- each FilterProfileAreaGroup fetches its own area's
// profiles on mount independently (three separate effects, not one shared
// fetch). Mirrors the "Recommendation Favourites" section's existing
// two-sub-block grouping precedent in SettingsPage.tsx.
const AREAS: { area: FilterProfileArea; title: string }[] = [
  { area: 'MY_SERIES', title: 'My Series' },
  { area: 'USE_MY_SERIES', title: 'Use My Series' },
  { area: 'RECOMMENDATION_FILTERS', title: 'Recommendation Filters' },
]

export function FilterProfileManager() {
  return (
    <div className={styles.container}>
      {AREAS.map(({ area, title }) => (
        <FilterProfileAreaGroup key={area} area={area} title={title} />
      ))}
    </div>
  )
}
