import type { ReactNode } from 'react'
import styles from './SettingsSection.module.css'

interface SettingsSectionProps {
  readonly title: string
  readonly icon?: ReactNode
  readonly children: ReactNode
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
}: SettingsSectionProps) {
  return (
    <section className={styles.section}>
      <h3 className={styles.title}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        {title}
      </h3>
      {children}
    </section>
  )
}
