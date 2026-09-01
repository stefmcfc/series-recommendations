# Frontend Spec 070: Settings Menu (Shell)

**Status**: Implemented — `App.tsx`, `components/SettingsPage.tsx`, `components/SettingsPage.module.css`, `components/SettingsPage.test.tsx`, `App.test.tsx`
**Priority**: P3
**Depends on**: none
**Area**: Frontend (`App.tsx`, new `components/SettingsPage.tsx`)

## Overview

There is currently no settings menu anywhere in the app — every tunable is an `application.yml`/
env-var value (`.claude/ideas/future_ideas.md`, Configuration section, "No settings menu"). Several
other deferred ideas (a dark/light mode toggle, relocating "Refresh All" into settings, country/
language favorites, a dropdown-placement idea) explicitly wait on a settings menu existing first.
This spec adds the entry point and an empty page shell only — a "Settings" nav item after
"Keywords", routing to a dedicated `/settings` page that currently has nothing to show. No real
setting is added here; that's separate future work once this shell exists.

## Design Decisions

- **Dedicated page/route, not a dropdown or sheet.** The existing top-level nav (`App.tsx`, lines
  160-179) is three full-page `NavLink`s (My Series, Recommendations, Keywords) — Settings joins
  that same pattern for consistency, rather than introducing a second, different interaction model
  (a dropdown panel or slide-out sheet) alongside it. This also scales better if the settings list
  grows long enough to need its own layout later.
- **Text-only nav label, no icon.** The three existing nav items are plain text links with no
  icons — Settings matches that (`"Settings"`, same `navLinkClassName` styling function), rather than
  introducing this app's first nav icon for one entry. If a settings-specific icon is wanted later,
  that's a non-breaking follow-up, not something this spec needs to decide now.
- **Shell only — no persistence mechanism decided.** `future_ideas.md`'s original entry flagged an
  open question ("where would it persist — a new `AppSettings` table? a `.env`-editing
  convenience?"). Since this spec adds no real setting, there is nothing to persist yet; that
  decision is deferred to whichever future spec adds the first real item (candidates already in
  `future_ideas.md`: a view-mode default, a theme toggle, "Refresh All" relocation, country/language
  favorites — each becomes its own spec against this shell).
- **Placeholder copy, not an empty `<div>`.** The page renders a heading and a short "nothing here
  yet" message so it's obviously intentional rather than looking broken, mirroring how a genuinely
  empty state is handled elsewhere in the app (e.g. `SeriesList`'s no-results state).

## Requirements

### Requirement 1: Settings nav entry

**User Story**: As a user, I want a way to reach a settings area from anywhere in the app, in the
same place I already find Keywords.

#### FRONTEND-070-AC-01 [AUTO]: Settings link renders after Keywords
**Statement**: When `App` renders its top nav, it shall render a `NavLink` labelled "Settings",
positioned immediately after "Keywords" in `div.navLinks`, pointing at `/settings`, styled via the
same `navLinkClassName` function the other three nav items already use.

**Rationale**: Gives users a consistent, discoverable entry point without introducing a new
interaction pattern (`FRONTEND-041-AC-01` already established that all top-level nav items are real
links, not buttons — Settings follows that same convention).

**References**:
- Component: `App.tsx`, `div.navLinks` (lines 168-178)
- Related: `FRONTEND-041-AC-01` (nav items are links, not buttons)

**Test Case (Red)**:
```typescript
describe('FRONTEND-070-AC-01: Settings nav link renders after Keywords', () => {
  it('renders a Settings link after Keywords in the nav', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('add-series-btn')

    const links = screen.getAllByRole('link').map((el) => el.textContent)
    const keywordsIndex = links.findIndex((text) => text === 'Keywords')
    const settingsIndex = links.findIndex((text) => text === 'Settings')

    expect(keywordsIndex).toBeGreaterThan(-1)
    expect(settingsIndex).toBe(keywordsIndex + 1)
  })
})
```

**Test Case (Green)**: add `<NavLink to="/settings" className={navLinkClassName}>Settings</NavLink>`
immediately after the existing Keywords `NavLink` in `App.tsx`'s `div.navLinks`.

### Requirement 2: `/settings` route renders the Settings page shell

**User Story**: As a user, when I click Settings, I want to land on a page that's clearly the
settings area, even though there's nothing configurable in it yet.

#### FRONTEND-070-AC-02 [AUTO]: `/settings` renders `SettingsPage`
**Statement**: When `/settings` is navigated to, `App`'s `Routes` shall render `SettingsPage`.

**Rationale**: Wires the nav entry through to real content, mirroring the existing
`/keywords` → `KeywordsView` route registration exactly.

**References**:
- Component: `App.tsx`, `Routes` (the `/keywords` route, line 226, is the pattern to mirror)
- Component: new `components/SettingsPage.tsx`

**Test Case (Red)**:
```typescript
describe('FRONTEND-070-AC-02: /settings renders the Settings page shell', () => {
  it('renders SettingsPage content at /settings', async () => {
    mockGetAll.mockResolvedValue([])
    window.history.pushState({}, '', '/settings')

    render(<App />)

    expect(await screen.findByTestId('settings-view')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `import { SettingsPage } from './components/SettingsPage'` and
`<Route path="/settings" element={<SettingsPage />} />` to `App.tsx`'s `Routes`, alongside the
existing `/keywords` route.

#### FRONTEND-070-AC-03 [AUTO]: `SettingsPage` shows placeholder content
**Statement**: The `SettingsPage` component shall render a `data-testid="settings-view"` container
with a heading "Settings" and placeholder copy stating that no settings are available yet.

**Rationale**: Makes the empty shell state obviously intentional, not broken — same reasoning as
other deliberate empty states in the app.

**References**:
- Component: new `components/SettingsPage.tsx`, `components/SettingsPage.module.css`,
  colocated `components/SettingsPage.test.tsx` (mirroring `KeywordsView.tsx`'s file layout)

**Test Case (Red)**:
```typescript
// SettingsPage.test.tsx
describe('FRONTEND-070-AC-03: SettingsPage renders placeholder content', () => {
  it('renders a heading and placeholder copy', () => {
    render(<SettingsPage />)

    expect(screen.getByTestId('settings-view')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText(/no settings/i)).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: new `SettingsPage.tsx` returning
`<div className={styles.container} data-testid="settings-view"><h2>Settings</h2><p>No settings are available yet — check back soon.</p></div>`.

## Cross-References

| Concept | Location |
|---|---|
| Nav item pattern mirrored | `App.tsx`, `div.navLinks`, `navLinkClassName` |
| Route registration pattern mirrored | `App.tsx`, `/keywords` route, `components/KeywordsView.tsx` |
| Nav-items-are-links convention | `frontend_spec_041_...md` (`FRONTEND-041-AC-01`) |
| Originating idea | `.claude/ideas/future_ideas.md`, Configuration section, "No settings menu — every tunable is an `application.yml`/env-var value" |
| Ideas unblocked by this shell (each needs its own future spec) | `.claude/ideas/future_ideas.md`: dark/light mode toggle, "Refresh All" relocation, country/language favorites, deferred dropdown-placement idea |

## Acceptance Criteria Summary

- [x] FRONTEND-070-AC-01: Settings nav link renders after Keywords
- [x] FRONTEND-070-AC-02: `/settings` renders `SettingsPage`
- [x] FRONTEND-070-AC-03: `SettingsPage` shows placeholder content
