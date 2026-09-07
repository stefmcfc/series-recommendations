import { NavLink, Navigate, useParams } from 'react-router-dom'
import type { NavLinkRenderProps } from 'react-router-dom'
import { KeywordsView } from './KeywordsView'
import { GenreStatsView } from './GenreStatsView'
import { CountryStatsView } from './CountryStatsView'
import { useNameStatsFilters } from '../hooks/useNameStatsFilters'
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
      {tab === 'keywords' && <KeywordsView filters={filters} />}
      {tab === 'genres' && <GenreStatsView filters={filters} />}
      {tab === 'country-of-origin' && <CountryStatsView filters={filters} />}
    </>
  )
}
