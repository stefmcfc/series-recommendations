import { NavLink, Navigate, useParams } from 'react-router-dom'
import type { NavLinkRenderProps } from 'react-router-dom'
import { KeywordsView } from './KeywordsView'
import { GenreStatsView } from './GenreStatsView'
import { CountryStatsView } from './CountryStatsView'
import { FilterProfileSelector } from './FilterProfileSelector'
import { useNameStatsFilters } from '../hooks/useNameStatsFilters'
import type { AnalysisFilterCriteria } from '../types/filterProfile'
import styles from './AnalysisView.module.css'

const navLinkClassName = ({ isActive }: NavLinkRenderProps) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink

// FRONTEND-087-AC-03/04/FRONTEND-088-AC-05/FRONTEND-089-AC-06: mirrors
// MySeriesView's :statusTab sub-nav pattern (App.tsx) one-for-one, with a
// `tab` route param instead of `statusTab`. Keywords, Genres, and Country of
// Origin (the last of the four Analysis/Trends units) are all wired now.
//
// FRONTEND-096-AC-10: useNameStatsFilters() is called exactly once here and
// passed down as a single `filters` prop to whichever tab is active -- since
// this state now lives above the point where KeywordsView/GenreStatsView/
// CountryStatsView unmount/remount on tab switch, it survives the switch
// instead of being discarded (frontend_spec_096's Design Decisions).
export function AnalysisView() {
  const { tab } = useParams<{ tab?: string }>()
  const filters = useNameStatsFilters()

  // FRONTEND-087-AC-04/FRONTEND-088-AC-05/FRONTEND-089-AC-06: mirrors
  // App.tsx's top-level `path="*"` -> `/my-series` soft-redirect convention
  // -- an unrecognized tab redirects to the default tab rather than
  // rendering a blank or error state.
  if (tab !== 'keywords' && tab !== 'genres' && tab !== 'country-of-origin') {
    return <Navigate to="/analysis/keywords" replace />
  }

  // FRONTEND-112-AC-09: currentCriteria is the *pending* filterInputs plus
  // the live sortBy/sortDirection -- mirrors Area A (SearchFilter)'s own
  // precedent (this spec's Design Decisions). sortBy/sortDirection have no
  // separate "pending" state (column-header clicks apply immediately), so
  // they're read live either way.
  const currentAnalysisFiltersCriteria: AnalysisFilterCriteria = {
    ...filters.filterInputs,
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection,
  }

  return (
    <>
      <nav className={styles.navLinks} aria-label="Analysis">
        <NavLink to="/analysis/keywords" className={navLinkClassName}>
          Keywords
        </NavLink>
        <NavLink to="/analysis/genres" className={navLinkClassName}>
          Genres
        </NavLink>
        <NavLink to="/analysis/country-of-origin" className={navLinkClassName}>
          Country of Origin
        </NavLink>
      </nav>
      {/* FRONTEND-112-AC-09: renders once here, shared across all three tabs
        -- not inside NameStatsTable.tsx (instantiated three times, once per
        tab, which would triple-render a per-instance picker). See this
        spec's Overview/Design Decisions. */}
      <FilterProfileSelector<AnalysisFilterCriteria>
        area="ANALYSIS_FILTERS"
        currentCriteria={currentAnalysisFiltersCriteria}
        onApply={filters.applyFilterProfile}
        onClear={filters.clearFilterProfile}
      />
      {tab === 'keywords' && <KeywordsView filters={filters} />}
      {tab === 'genres' && <GenreStatsView filters={filters} />}
      {tab === 'country-of-origin' && <CountryStatsView filters={filters} />}
    </>
  )
}
