# Frontend Spec 099: Light/Dark/Match-System Theme Toggle

**Status**: Done — all ACs verified. AC-06 confirmed via live browser pass (2026-09-07, OS/browser `prefers-color-scheme: dark`): "Match System" (default) rendered dark, matching the OS preference unchanged from before this spec; selecting "Light" switched the entire app to light instantly despite the dark OS setting (confirming the attribute-selector override genuinely outranks the `@media` block, not just visually similar by coincidence); a full page reload on a different route (`/my-series`, not `/settings`) with `light` already stored applied the theme immediately with no flash and no prior visit to Settings required — confirming the `App.tsx`-level state placement was the correct call.
**Priority**: P3
**Depends on**: `frontend_spec_098_settings_country_language_favourites.md` (the `useLocalStorage` hook this spec consumes as-is), `frontend_spec_097_refresh_skip_threshold_override_ui.md` (`SettingsSection`, this spec's control renders through it)
**Area**: Frontend (`App.tsx`, `components/SettingsPage.tsx`, `index.css`, and each affected file's tests)

## Overview

Adds a manual light/dark theme override to a `prefers-color-scheme`-only app (confirmed via
`index.css`: `:root` sets light custom properties, a `@media (prefers-color-scheme: dark)` block
overrides them for dark, zero `data-theme` usage or manual-override mechanism anywhere today). A new
three-way control on `/settings` — Light / Dark / Match System (default) — persists the user's
choice via `frontend_spec_098`'s `useLocalStorage` hook and applies it via a `data-theme` attribute
on `<html>`, styled to take precedence over the OS-driven media queries via plain CSS specificity
(an attribute-selector rule is more specific than the bare `:root` selector the media query wraps —
no `!important` needed, and both override directions — light OS + "Dark" chosen, dark OS + "Light"
chosen — work the same way).

## Design Decisions

- **Theme state lives in `App.tsx`, not `SettingsPage.tsx`.** This is the one point this spec
  actually has to get right, and it's the same principle `frontend_spec_096` already established for
  Analysis's filter state: state that must be *live and global* has to live above the point where
  the page that displays its control mounts/unmounts. If `SettingsPage.tsx` called
  `useLocalStorage('theme', ...)` itself, the `data-theme` attribute would only ever get (re-)applied
  while `SettingsPage` happens to be mounted — on a fresh app load landing on `/my-series`, a
  previously-chosen dark theme wouldn't apply until the user actually visits `/settings` once (a
  visible flash/wrong-theme window), and toggling the control wouldn't update the *already-rendered*
  rest of the app live, since a second independent `useLocalStorage('theme', ...)` call in `App.tsx`
  wouldn't re-render just because a *different* component instance using the same storage key
  changed its own local state. `App.tsx` owns `const [theme, setTheme] = useLocalStorage<Theme>(...)`
  and a `useEffect` applying the DOM attribute; `SettingsPage` receives `theme`/`setTheme` as props
  through the `/settings` route element, the same prop-threading shape `frontend_spec_096` used for
  `AnalysisView`'s shared filter state.
- **`data-theme` is set on `document.documentElement` (`<html>`), not `#root`.** `:root` in CSS
  matches the document root element (`<html>`) regardless of which DOM node the attribute is
  physically set on, as long as it's present *somewhere* the browser evaluates selectors against —
  setting it directly on `<html>` (via `document.documentElement`, a plain imperative DOM mutation,
  not a React-rendered prop) is the standard mechanism and matches the `:root[data-theme="..."]`
  selectors this spec adds.
- **`theme === 'system'` removes the attribute entirely** rather than setting a third CSS variant —
  this is what makes "Match System" behave identically to today's pure `prefers-color-scheme`-only
  app for anyone who never touches the control, with zero new CSS branches to keep in sync for that
  case.
- **A brief flash of the default (light) theme on first paint, before React mounts and the effect
  runs, is an accepted tradeoff, not solved by this spec.** This is a client-only Vite SPA with no
  server-rendered HTML to embed the choice into ahead of time; avoiding the flash would need an
  inline blocking `<script>` in `index.html` reading `localStorage` before any CSS paints — a
  reasonable follow-up if the flash proves noticeable in practice, but disproportionate to build
  speculatively now for what's normally a sub-100ms window.
- **`index.css`'s existing `#social .button-icon` dark-mode rule is left alone.** Confirmed via grep
  that no element with `id="social"` exists anywhere in this app's actual JSX — this is dead CSS
  from an earlier scaffold, unrelated to this spec, not worth touching here.

## Requirements

### Requirement 1: Theme state & DOM application

**User story**: As a user, I want my light/dark preference to apply everywhere immediately and
survive a reload, regardless of which page I'm on when I change it.

#### Acceptance Criteria

- **FRONTEND-099-AC-01** [AUTO]: `App.tsx` shall own `const [theme, setTheme] =
  useLocalStorage<Theme>('theme', 'system', isTheme)`, where `type Theme = 'light' | 'dark' |
  'system'`.
- **FRONTEND-099-AC-02** [AUTO]: A `useEffect` in `App.tsx`, depending on `theme`, shall call
  `document.documentElement.setAttribute('data-theme', theme)` when `theme` is `'light'` or
  `'dark'`, and `document.documentElement.removeAttribute('data-theme')` when `theme` is
  `'system'`.
- **FRONTEND-099-AC-03** [AUTO]: `theme` and `setTheme` shall be passed to `SettingsPage` as props
  through the `/settings` route element in `App.tsx`.

---

### Requirement 2: CSS override mechanism

**User story**: As a user, I want "Dark" to look dark even if my OS is set to light (and vice
versa), and "Match System" to behave exactly as the app does today.

#### Acceptance Criteria

- **FRONTEND-099-AC-04** [AUTO]: `index.css` shall gain a `:root[data-theme="dark"]` rule setting
  the identical custom-property values as the existing `@media (prefers-color-scheme: dark) {
  :root { ... } }` block (`--text`, `--text-h`, `--bg`, `--border`, `--code-bg`, `--accent`,
  `--accent-bg`, `--accent-border`, `--social-bg`, `--shadow`) — no drift between the two.
- **FRONTEND-099-AC-05** [AUTO]: `index.css` shall gain a `:root[data-theme="light"]` rule setting
  the identical custom-property values as the existing base `:root` block's light values —
  overriding the dark `@media` block via CSS specificity when the OS is dark but the user has
  explicitly chosen "Light."
- **FRONTEND-099-AC-06** [MANUAL]: While no `data-theme` attribute is present (`theme === 'system'`,
  including a first-ever visit before any choice is made), the app's appearance shall be pixel-
  identical to today's pure `prefers-color-scheme`-driven behavior — verified by visual check in
  browser (jsdom doesn't evaluate `prefers-color-scheme`/attribute-selector CSS specificity the way
  a real browser does, matching this project's established precedent for CSS-only visual checks,
  e.g. `frontend_spec_091`/`096`).

---

### Requirement 3: Settings control

**User story**: As a user, I want a simple three-way choice on the Settings page, not a plain
on/off toggle that can't express "just use my OS setting."

#### Acceptance Criteria

- **FRONTEND-099-AC-07** [AUTO]: `SettingsPage.tsx` shall render a new `<SettingsSection
  title="Appearance">` containing a three-option control (Light / Dark / Match System), with "Match
  System" reflecting the current `theme === 'system'` state.
- **FRONTEND-099-AC-08** [AUTO]: Selecting an option shall call `setTheme` with the corresponding
  value immediately (no separate Save/Apply step, matching this app's other live-updating Settings
  controls from this batch, e.g. `frontend_spec_098`'s favourites editors).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `useLocalStorage` hook this spec consumes as-is | `frontend_spec_098_settings_country_language_favourites.md` |
| `SettingsSection` this spec's control renders through | `frontend_spec_097_refresh_skip_threshold_override_ui.md` |
| Lifted-shared-state-above-the-consuming-page precedent this spec's `App.tsx`-ownership decision follows | `frontend_spec_096_analysis_filters_consistency_and_persistence.md` (`useNameStatsFilters` owned by `AnalysisView`, not each tab) |
| `prefers-color-scheme` custom-property values this spec's `data-theme` rules must exactly mirror | `frontend/src/index.css` |
| `[MANUAL]`/jsdom-can't-verify-real-CSS-layout precedent | `frontend_spec_091_series_form_validation_and_persistent_cta.md`, `frontend_spec_096` |

---

## TDD Test Case Sketches

### `src/App.test.tsx` (additions)

```typescript
describe('FRONTEND-099-AC-01/02: theme state applies a data-theme attribute', () => {
  it('defaults to no data-theme attribute (system) when nothing is stored', () => {
    render(<App />)
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  it('applies data-theme="dark" when a stored theme is dark', () => {
    localStorage.setItem('theme', JSON.stringify('dark'))
    render(<App />)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('removes the attribute when switching back to Match System', () => {
    localStorage.setItem('theme', JSON.stringify('dark'))
    render(<App />)
    // navigate to /settings, select "Match System"
    fireEvent.click(screen.getByRole('link', { name: /settings/i }))
    fireEvent.click(screen.getByRole('radio', { name: /match system/i }))
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })
})
```

### `src/components/SettingsPage.test.tsx` (additions)

```typescript
describe('FRONTEND-099-AC-07/08: Appearance section', () => {
  it('renders the three theme options with Match System selected by default', () => {
    render(<SettingsPage theme="system" setTheme={vi.fn()} />)
    expect(screen.getByRole('radio', { name: /match system/i })).toBeChecked()
  })

  it('calls setTheme immediately when Dark is selected', () => {
    const setTheme = vi.fn()
    render(<SettingsPage theme="system" setTheme={setTheme} />)
    fireEvent.click(screen.getByRole('radio', { name: /^dark$/i }))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })
})
```

**Test Case (Green)**: implement the `App.tsx` state/effect, the `index.css` rules, and the
Settings control until the specs above pass; AC-06 is verified manually in browser (light/dark OS ×
Light/Dark/Match System choice, 2×3 combinations).

---

## Acceptance Criteria Summary

- [x] FRONTEND-099-AC-01: `App.tsx` owns `theme`/`setTheme` via `useLocalStorage`
- [x] FRONTEND-099-AC-02: effect applies/removes the `data-theme` attribute on `<html>`
- [x] FRONTEND-099-AC-03: `theme`/`setTheme` threaded to `SettingsPage` via the route element
- [x] FRONTEND-099-AC-04: `:root[data-theme="dark"]` mirrors the existing dark media-query values
- [x] FRONTEND-099-AC-05: `:root[data-theme="light"]` mirrors the existing base light values
- [x] FRONTEND-099-AC-06 [MANUAL]: "Match System" is pixel-identical to today's behavior — verified 2026-09-07
- [x] FRONTEND-099-AC-07: `SettingsPage` renders the three-way Appearance control
- [x] FRONTEND-099-AC-08: selecting an option applies immediately, no Save step
