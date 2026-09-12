# Frontend Spec 124: Accent-Tinted Cards

**Status**: Implemented
**Priority**: P4 (pure visual polish, off by default)
**Depends on**: `frontend_spec_099_settings_theme_toggle.md` (established the `data-theme`/`useLocalStorage` pattern this spec's new setting mirrors), `frontend_spec_110_appearance_color_schemes.md` (established `--accent`/`data-accent`, the value this spec's tint derives from), `frontend_spec_105_my_series_card_styling_and_modernization.md` (the shared `surface.card` primitive this spec extends)
**Area**: Frontend (`index.css`, `styles/surfaces.module.css`, `components/SeriesPosterGrid.module.css`, `App.tsx`, `components/SettingsPage.tsx`, `types/` — no new type file needed, see Design Decisions)

## Overview

Every "card" surface in this app gets its background from one of two places: the shared `surface.card` CSS Module primitive (`background: var(--bg)`), or `SeriesPosterGrid`'s own separate, non-shared `.card` class (`background: var(--social-bg)`). Neither varies with the currently-selected accent color — cards always look neutral regardless of which of the 5 accent palettes (purple/blue/green/orange/teal) or which theme (light/dark) is active. This spec adds an opt-in Settings toggle that tints every card surface a shade of the active accent color — a dark shade in dark mode, a light shade in light mode — derived automatically via CSS `color-mix()` rather than 10 hand-picked hex values (2 per accent × 5 accents).

## Design Decisions

- **One new custom property, `--card-bg`, consumed via `var(--card-bg, <original-default>)` everywhere** — when the setting is off, `--card-bg` is simply undefined, so every consumer falls back to exactly what it renders today (`var(--bg)` for `surface.card` consumers, `var(--social-bg)` for `SeriesPosterGrid`). Zero visual change in the off state, by construction, not by testing — there's nothing to regress.
- **Every card surface in the app is covered by editing exactly 2 CSS rules** (verified by grep — no consumer of `surface.card` overrides `background` itself): `surfaces.module.css`'s single `.card` rule (covers `SeriesList.tsx`'s row/toolbar, `SeriesCompactGrid.tsx`, `RecommendationCard.tsx`, `FilterProfileAreaGroup.tsx`, all 4 `SearchFilter.tsx` sections, `SettingsSection.tsx`) and `SeriesPosterGrid.module.css`'s separate `.card` rule.
- **The tint itself is one shared CSS rule using `color-mix()`, not per-accent values**: `[data-card-tint='on'] { --card-bg: color-mix(in srgb, var(--accent) 12%, var(--bg)); }`. Because `--accent` and `--bg` already resolve correctly per the existing theme/accent cascade at the point this rule is evaluated, this single rule automatically produces a dark-shade tint in dark mode and a light-shade tint in light mode, across all 5 accent colors, with no per-accent/per-theme duplication — the "dark shade in dark mode, light shade in light mode" behavior falls out of blending into whichever `--bg` is currently active, not from any special-casing.
- **12% is a starting blend ratio, not a fixed requirement** — tune visually during implementation if it reads too subtle or too strong in either theme.
- **Settings wiring mirrors `theme`/`accentColor` exactly**: state owned in `App.tsx` (not `SettingsPage.tsx`), applied via a `useEffect` setting/deleting a `data-*` attribute, live-updating with no Save step, threaded to `SettingsPage` as props.
- **No new `types/*.ts` file** — `types/theme.ts`/`types/accentColor.ts` exist specifically because those settings are string-literal unions needing a hand-written type guard; a plain boolean doesn't need one (`useLocalStorage`'s validator param can just be an inline `(v): v is boolean => typeof v === 'boolean'`).
- **A plain checkbox, not a custom toggle-switch component** — no toggle-switch UI exists anywhere in this app today (the Appearance section's existing controls are `role="radiogroup"` radio buttons, a 3-way/5-way choice, not a true binary toggle); a `<input type="checkbox">` + `<label>` is the simplest correct match for "on/off switch" and doesn't justify building new UI infrastructure for one boolean.

---

## Requirement 1: Cards tint a shade of the active accent color when enabled

**User story**: As a user who's picked an accent color, I want my series cards, filter sections, and Settings panels to pick up a subtle tint of that color instead of always looking neutral, with an easy way to turn it off if I don't like it.

### FRONTEND-124-AC-01 [AUTO]
**Statement**: `index.css` shall define a `[data-card-tint='on']` rule setting `--card-bg: color-mix(in srgb, var(--accent) 12%, var(--bg))`; `surfaces.module.css`'s `.card` and `SeriesPosterGrid.module.css`'s `.card` shall read `background: var(--card-bg, var(--bg))` and `background: var(--card-bg, var(--social-bg))` respectively, instead of their current unconditional values.

**References**: `frontend/src/index.css` (insert after the Teal accent block, currently ending ~line 224, before `#root` at line 227), `frontend/src/styles/surfaces.module.css` (`.card`'s `background: var(--bg);`), `frontend/src/components/SeriesPosterGrid.module.css` (`.card`'s `background: var(--social-bg);`, lines 17-27).

**Test Case (Red)** — CSS-content assertions, following the established pattern from `frontend_spec_121`'s `.tablistNested` sticky-declaration test:
```typescript
describe('FRONTEND-124-AC-01: card tint CSS is correctly declared', () => {
  it('index.css declares the color-mix tint rule', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8')
    expect(css).toMatch(
      /\[data-card-tint=['"]on['"]\]\s*\{[^}]*--card-bg:\s*color-mix\(in srgb,\s*var\(--accent\)\s*12%,\s*var\(--bg\)\)/,
    )
  })

  it('surfaces.module.css falls back to --bg when the tint is unset', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../styles/surfaces.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/background:\s*var\(--card-bg,\s*var\(--bg\)\)/)
  })

  it('SeriesPosterGrid falls back to --social-bg when the tint is unset', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, './SeriesPosterGrid.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/background:\s*var\(--card-bg,\s*var\(--social-bg\)\)/)
  })
})
```
**Test Case (Green)**: make the three CSS edits described above.

**Manual verification** `[MANUAL]`: with the Settings toggle (AC-02) on, confirm cards visibly tint in both light and dark mode, across at least 2 accent colors, with text remaining legibly contrasted — jsdom can't verify real color rendering, per this project's established caveat.

---

### FRONTEND-124-AC-02 [AUTO]
**Statement**: `App.tsx` shall own a `cardTint: boolean` setting (`useLocalStorage('cardTint', false, ...)`, default `false`), applying `document.documentElement.dataset.cardTint = 'on'` when `true` and deleting the attribute when `false`, threaded to `SettingsPage` as `cardTint`/`setCardTint` props.

**References**: `frontend/src/App.tsx` lines 254-288 (the `theme`/`accentColor` state + effect pattern being mirrored), line 405 (`<SettingsPage>` prop-passing site).

**Test Case (Red)**:
```typescript
describe('FRONTEND-124-AC-02: cardTint state applies a data-card-tint attribute', () => {
  it('defaults to no data-card-tint attribute when nothing is stored', async () => {
    mockGetAll.mockResolvedValue({ series: [], excludedCount: 0 })
    render(<App />)
    await screen.findByTestId('series-list')
    expect(document.documentElement.dataset.cardTint).toBeUndefined()
  })

  it('applies data-card-tint="on" when the stored setting is true', async () => {
    localStorage.setItem('cardTint', JSON.stringify(true))
    mockGetAll.mockResolvedValue({ series: [], excludedCount: 0 })
    render(<App />)
    await screen.findByTestId('series-list')
    expect(document.documentElement.dataset.cardTint).toBe('on')
  })
})
```
**Test Case (Green)**: add the `useLocalStorage` state, the mirrored `useEffect`, and thread the two new props to `SettingsPage`.

---

### FRONTEND-124-AC-03 [AUTO]
**Statement**: `SettingsPage.tsx`'s "Appearance" section shall render a checkbox toggling `cardTint`, positioned after the accent-color picker.

**References**: `frontend/src/components/SettingsPage.tsx` lines 79-83 (`SettingsPageProps`), lines 241-348 (the "Appearance" `SettingsSection`, accent-color radiogroup ending at line 346-347).

**Test Case (Red)**:
```typescript
describe('FRONTEND-124-AC-03: card tint checkbox in Settings', () => {
  it('renders unchecked by default and calls setCardTint on click', () => {
    const setCardTint = vi.fn()
    render(<SettingsPage {...defaultProps} cardTint={false} setCardTint={setCardTint} />)
    const checkbox = screen.getByLabelText(/tint cards/i)
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(setCardTint).toHaveBeenCalledWith(true)
  })
})
```
**Test Case (Green)**: add `cardTint: boolean; setCardTint: (v: boolean) => void` to `SettingsPageProps`; render `<input type="checkbox" id="card-tint-toggle" checked={cardTint} onChange={(e) => setCardTint(e.target.checked)} /><label htmlFor="card-tint-toggle">Tint cards with the active accent color</label>` after the accent-color radiogroup's closing `</div>`, inside the same `SettingsSection`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `data-theme`/`useLocalStorage` pattern this spec's setting mirrors | `frontend_spec_099_settings_theme_toggle.md` |
| `--accent`/`data-accent`, the value this spec's tint derives from | `frontend_spec_110_appearance_color_schemes.md` |
| `surface.card` primitive this spec extends | `frontend_spec_105_my_series_card_styling_and_modernization.md` |
| CSS-content test pattern reused here | `frontend_spec_121_sticky_discover_subtabs.md` (`FRONTEND-121-AC-01`) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-124-AC-01: `--card-bg`/`color-mix()` rule and both consumer fallbacks correctly declared
- [x] FRONTEND-124-AC-02: `cardTint` state and `data-card-tint` attribute application wired correctly
- [x] FRONTEND-124-AC-03: Settings checkbox renders and toggles the setting
