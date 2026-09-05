import { NavLink, Navigate, useParams } from 'react-router-dom'
import type { NavLinkRenderProps } from 'react-router-dom'
import { KeywordsView } from './KeywordsView'
import { GenreStatsView } from './GenreStatsView'
import styles from './AnalysisView.module.css'

const navLinkClassName = ({ isActive }: NavLinkRenderProps) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink

// FRONTEND-087-AC-03/04/FRONTEND-088-AC-05: mirrors MySeriesView's
// :statusTab sub-nav pattern (App.tsx) one-for-one, with a `tab` route param
// instead of `statusTab`. Keywords and Genres are wired now --
// frontend_spec_089 (Country of Origin) adds a further NavLink into this
// same <nav>, and a further `tab === '...'` branch below, without otherwise
// changing this component's shape.
export function AnalysisView() {
  const { tab } = useParams<{ tab?: string }>()

  // FRONTEND-087-AC-04/FRONTEND-088-AC-05: mirrors App.tsx's top-level
  // `path="*"` -> `/my-series` soft-redirect convention -- an unrecognized
  // tab redirects to the default tab rather than rendering a blank or error
  // state.
  if (tab !== 'keywords' && tab !== 'genres') {
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
      </nav>
      {tab === 'keywords' && <KeywordsView />}
      {tab === 'genres' && <GenreStatsView />}
    </>
  )
}
