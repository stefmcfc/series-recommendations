import type { ReactNode } from 'react'
import styles from './SettingsSection.module.css'
import surface from '../styles/surfaces.module.css'

interface SettingsSectionProps {
  readonly title: string
  readonly icon?: ReactNode
  readonly children: ReactNode
  // FRONTEND-131-AC-04: an optional InfoDisclosure (or any other node)
  // rendered as a sibling of <h3>, never nested inside it -- a button
  // placed inside <h3> would fold its own aria-label text into the
  // heading's accessible name, breaking exact-match heading queries like
  // getByRole('heading', { name: 'Watch Region' }).
  readonly info?: ReactNode
}

// FRONTEND-097-AC-03: minimal title + children wrapper -- intentionally no
// collapse/disclosure behavior (see this spec's Design Decisions). Every
// control landing on /settings is meant to be visible at a glance.
//
// FRONTEND-101-AC-05/06/08: optional decorative icon rendered before the
// title (aria-hidden -- the visible <h3> is already the section's
// accessible name, an icon label would double-announce it), and the
// wrapper itself is styled as a card in SettingsSection.module.css.
export function SettingsSection({
  title,
  icon,
  children,
  info,
}: SettingsSectionProps) {
  const heading = (
    <h3 className={styles.title}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {title}
    </h3>
  )

  return (
    <section className={`${styles.section} ${surface.card}`}>
      {/* FRONTEND-131-AC-04: info, when provided, is a sibling of <h3>
          inside this new row -- never a descendant of it. Omitted entirely
          (no new wrapping element) when info isn't passed, so every
          pre-existing caller's rendered output is unchanged. */}
      {info ? (
        <div className={styles.headingRow}>
          {heading}
          {info}
        </div>
      ) : (
        heading
      )}
      {children}
    </section>
  )
}
