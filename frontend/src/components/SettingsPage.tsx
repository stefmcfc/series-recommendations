import styles from './SettingsPage.module.css'

export function SettingsPage() {
  return (
    <div className={styles.container} data-testid="settings-view">
      <h2 className={styles.heading}>Settings</h2>
      <p className={styles.placeholder}>
        No settings are available yet — check back soon.
      </p>
    </div>
  )
}
