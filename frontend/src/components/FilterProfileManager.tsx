import type { FilterProfileArea } from '../types/filterProfile'
import { FilterProfileAreaGroup } from './FilterProfileAreaGroup'
import styles from './FilterProfileManager.module.css'

// FRONTEND-108-AC-09/FRONTEND-112-AC-10: five independent sub-groups, one per
// FilterProfileArea -- each FilterProfileAreaGroup fetches its own area's
// profiles on mount independently (five separate effects, not one shared
// fetch). Mirrors the "Recommendation Favourites" section's existing
// two-sub-block grouping precedent in SettingsPage.tsx. Order matches
// types/filterProfile.ts's FilterProfileArea union order. CUSTOM_SEARCH/
// ANALYSIS_FILTERS were added by FRONTEND-112-AC-10 -- frontend_spec_112
// wired FilterProfileSelector into both areas but never added them here,
// leaving any profile saved for either invisible in Settings (no way to
// rename or delete one).
const AREAS: { area: FilterProfileArea; title: string }[] = [
  { area: 'MY_SERIES', title: 'My Series' },
  { area: 'USE_MY_SERIES', title: 'Use My Series' },
  { area: 'RECOMMENDATION_FILTERS', title: 'Recommendation Filters' },
  { area: 'CUSTOM_SEARCH', title: 'Custom Search' },
  { area: 'ANALYSIS_FILTERS', title: 'Analysis Filters' },
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
