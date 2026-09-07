// FRONTEND-099-AC-01: the three valid values a user can pick on /settings'
// Appearance control -- 'system' (the default) means "no manual override,
// keep behaving like the pure prefers-color-scheme app this was before this
// spec." Lives here (rather than inline in App.tsx, which owns the state)
// so App.tsx and SettingsPage.tsx can both import it without one importing
// from the other, matching this project's "types are centralized in
// src/types/" convention.
export type Theme = 'light' | 'dark' | 'system'

// FRONTEND-099-AC-01: the isValid type guard useLocalStorage requires --
// anything else stored under the 'theme' key (a stale/foreign value, manual
// localStorage tampering) falls back to the 'system' default instead of
// being trusted as-is.
export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}
