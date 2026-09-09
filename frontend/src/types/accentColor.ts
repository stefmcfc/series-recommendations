// FRONTEND-110-AC-01: the five valid values a user can pick on /settings'
// Appearance control's second, independent axis -- 'purple' (the default)
// means "no manual override, keep the app's current unmodified accent hue."
// Mirrors types/theme.ts's exact shape (see Theme/isTheme) so App.tsx and
// SettingsPage.tsx can both import it without one importing from the other,
// matching this project's "types are centralized in src/types/" convention.
// Grey was considered and rejected (frontend_spec_110's Design Decisions) --
// this app's neutral tokens are already grey, so a grey "accent" wouldn't
// read as one.
export type AccentColor = 'purple' | 'blue' | 'green' | 'orange' | 'teal'

// FRONTEND-110-AC-01: the isValid type guard useLocalStorage requires --
// anything else stored under the 'accentColor' key (a stale/foreign value,
// manual localStorage tampering) falls back to the 'purple' default instead
// of being trusted as-is.
export function isAccentColor(value: unknown): value is AccentColor {
  return (
    value === 'purple' ||
    value === 'blue' ||
    value === 'green' ||
    value === 'orange' ||
    value === 'teal'
  )
}
