import type { ReactNode } from 'react'
import styles from './SettingsSection.module.css'

interface SettingsSectionProps {
  readonly title: string
  readonly children: ReactNode
}

// FRONTEND-097-AC-03: minimal title + children wrapper -- intentionally no
// collapse/disclosure behavior (see this spec's Design Decisions). Every
// control landing on /settings is meant to be visible at a glance.
export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className={styles.section}>
      <h3 className={styles.title}>{title}</h3>
      {children}
    </section>
  )
}
