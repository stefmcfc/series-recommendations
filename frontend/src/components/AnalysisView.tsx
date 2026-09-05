import { NavLink, Navigate, useParams } from 'react-router-dom'
import type { NavLinkRenderProps } from 'react-router-dom'
import { KeywordsView } from './KeywordsView'
import styles from './AnalysisView.module.css'

const navLinkClassName = ({ isActive }: NavLinkRenderProps) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink

// FRONTEND-087-AC-03/04: mirrors MySeriesView's :statusTab sub-nav pattern
// (App.tsx) one-for-one, with a `tab` route param instead of `statusTab`.
// Keywords is the only tab wired by frontend_spec_087 -- frontend_spec_088
// (Genres) and frontend_spec_089 (Country of Origin) add further NavLinks
// into this same <nav>, and further `tab === '...'` branches below, without
// otherwise changing this component's shape.
export function AnalysisView() {
  const { tab } = useParams<{ tab?: string }>()

  // FRONTEND-087-AC-04: mirrors App.tsx's top-level `path="*"` -> `/my-series`
  // soft-redirect convention -- an unrecognized tab redirects to the default
  // tab rather than rendering a blank or error state.
  if (tab !== 'keywords') {
    return <Navigate to="/analysis/keywords" replace />
  }

  return (
    <>
      <nav className={styles.navLinks} aria-label="Analysis">
        <NavLink to="/analysis/keywords" className={navLinkClassName}>
          Keywords
        </NavLink>
      </nav>
      <KeywordsView />
    </>
  )
}
