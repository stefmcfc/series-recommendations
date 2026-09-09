# Frontend Spec 110: Appearance Accent Color Schemes

**Status**: Delivered
**Priority**: P3 (visual preference, no new capability)
**Depends on**: `frontend_spec_099_settings_theme_toggle.md` (the `useLocalStorage`-backed,
`App.tsx`-owned, `data-*`-attribute mechanism this spec reuses directly for a second, independent
axis)
**Area**: Frontend (`App.tsx`, `components/SettingsPage.tsx`,
`components/SettingsPage.module.css`, `types/accentColor.ts` (new), `index.css`, and each affected
file's tests)

**Bundled small fix (Requirement 4)**: also adds a visual divider between "Country Favourites" and
"Language Favourites" in the existing "Recommendation Favourites" section — an unrelated, much
smaller finding from the same 2026-09-09 live-app pass, folded into this spec rather than given its
own since both touch `SettingsPage.tsx`/`SettingsPage.module.css` in the same PR anyway.

## Overview

Adds a second, independent Appearance choice — accent color — alongside the existing
light/dark/match-system theme toggle, for users who don't like the app's current purple hue.
Confirmed via reading `index.css`: `--accent`/`--accent-bg`/`--accent-border` are the only tokens
that vary by *hue* (purple in both themes today, `#aa3bff` light / `#c084fc` dark) — every other
token (`--text`, `--text-h`, `--bg`, `--border`, `--control-border`, `--code-bg`, `--social-bg`,
`--shadow`) is a pure light/dark neutral, unaffected by this spec. This spec only ever changes the
three accent tokens; it never touches a component file, since every consumer already reads the
custom property indirectly (`buttons.module.css`'s `.btnPrimary`, `StarRating.module.css`,
`SeriesList.module.css`'s active-rewatch state, `RecommendationControls.module.css`'s active-tab
underline, `FilterProfileSelector.module.css`'s selected-chip state, `SeriesDetail.module.css`, and
`App.module.css`, confirmed via grep for `var(--accent`).

## Design Decisions

- **Accent color is a second, fully independent axis from `theme`** (`'light' | 'dark' | 'system'`
  × `'purple' | 'blue' | 'green' | 'orange' | 'teal'` = 15 total visual states), not folded into a
  combined enum. This
  reuses `frontend_spec_099`'s exact `useLocalStorage`/`App.tsx`-ownership/DOM-attribute pattern a
  second time rather than inventing a new mechanism — `const [accentColor, setAccentColor] =
  useLocalStorage<AccentColor>('accentColor', 'purple', isAccentColor)` in `App.tsx`, mirroring
  `theme`/`setTheme` line for line, including the same "must live above the page whose control sets
  it, or a fresh load elsewhere in the app won't apply it until Settings is visited once" reasoning
  `frontend_spec_099`'s Design Decisions already established for `theme`.
- **`'purple'` (today's only color) removes the `data-accent` attribute entirely**, exactly
  mirroring `theme === 'system'`'s "no attribute = today's unmodified behavior" pattern. Anyone who
  never opens the new control sees zero change — no new CSS branch is ever evaluated for them.
- **Every non-default preset needs four CSS rule blocks, not one, to avoid a specificity/
  source-order trap** — this is the one thing this spec has to get right. `--accent` already has
  independent light and dark values (not derived from one another), and the app already needs
  `frontend_spec_099-AC-04/05`'s four-block shape (base `:root`, the `@media (prefers-color-scheme:
  dark)` block, `:root[data-theme='dark']`, `:root[data-theme='light']`) just to express light/dark
  for the *existing* purple. A plain, single-attribute `:root[data-accent='blue']` selector has the
  **same specificity** as `:root[data-theme='dark']` — if both matched the same element (blue accent
  + explicit dark theme), which one wins would be decided by source order alone, a fragile trap that
  silently breaks the moment either file's rules get reordered. This spec avoids that risk entirely
  by requiring every accent override to be a **compound selector** naming both the theme condition
  and `[data-accent='...']` together, mirroring `frontend_spec_099`'s own four-block shape exactly
  (see `FRONTEND-110-AC-04`). No rule in this spec is ever a bare `[data-accent='...']` selector on
  its own.
- **Scope deliberately bounded to a fixed preset list (Blue, Green, Orange, Teal — five total
  including today's Purple), not a free color picker.** A free picker would make the contrast-audit
  surface (`FRONTEND-110-AC-06`) open-ended — every possible hue would need its own manual
  verification before a user could safely select it. A small, fixed preset list keeps that surface
  finite and auditable once, up front. Orange and Teal were added during implementation planning
  (Grey was considered and explicitly rejected — this app's `--text`/`--border`/`--control-border`
  tokens are already grey/neutral, so a grey "accent" would visually disappear into the rest of the
  UI rather than read as an accent, and lacks the light-shade-for-black-text-contrast escape hatch a
  true hue has). More presets remain a natural, additive follow-up once this ships (each new preset
  is just one more four-block CSS addition plus one more contrast check), not blocked by anything in
  this spec.
- **Suggested hex values below are a starting point, not a final decision.** They were chosen to be
  roughly as light/bright as the existing purple (`#aa3bff` light / `#c084fc` dark), since
  `buttons.module.css`'s `.btnPrimary` renders **black** text on `--accent` regardless of theme
  (`color: #000`, not itself theme-conditional) — a hue that's too dark would fail contrast for that
  button immediately. They have **not** been run through a real contrast-checking tool during spec
  writing; `FRONTEND-110-AC-06` requires that verification explicitly before this ships, and the
  hex values may need adjusting if they fail.
- **`accentColor`/`setAccentColor` render inside the existing "Appearance" `SettingsSection`**, as a
  second `role="radiogroup"` beneath the existing theme one — not a new section. This is the same
  section a user already associates with "how the app looks."

---

## Requirement 1: Accent color state & DOM application

**User story**: As a user, I want my chosen accent color to apply everywhere immediately and
survive a reload, regardless of which page I'm on when I change it — the same guarantee the
existing theme toggle already gives me.

### FRONTEND-110-AC-01 [AUTO]
**Statement**: `App.tsx` shall own `const [accentColor, setAccentColor] =
useLocalStorage<AccentColor>('accentColor', 'purple', isAccentColor)`, where `type AccentColor =
'purple' | 'blue' | 'green' | 'orange' | 'teal'`, defined in a new
`frontend/src/types/accentColor.ts` mirroring `types/theme.ts`'s exact shape (`isAccentColor` a
plain type-guard, same style as `isTheme`).

**References**: `types/theme.ts` (`Theme`/`isTheme`, the pattern this mirrors), `App.tsx`'s existing
`const [theme, setTheme] = useLocalStorage<Theme>('theme', 'system', isTheme)`.

**Test Case (Red)**:
```typescript
// src/types/accentColor.test.ts
describe('FRONTEND-110-AC-01: isAccentColor validator', () => {
  it('accepts each of the five known AccentColor values', () => {
    expect(isAccentColor('purple')).toBe(true)
    expect(isAccentColor('blue')).toBe(true)
    expect(isAccentColor('green')).toBe(true)
    expect(isAccentColor('orange')).toBe(true)
    expect(isAccentColor('teal')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isAccentColor('bogus')).toBe(false)
    expect(isAccentColor(null)).toBe(false)
    expect(isAccentColor(42)).toBe(false)
  })
})
```
**Test Case (Green)**: implement `AccentColor`/`isAccentColor` until the spec above passes.

---

### FRONTEND-110-AC-02 [AUTO]
**Statement**: A `useEffect` in `App.tsx`, depending on `accentColor`, shall call
`document.documentElement.setAttribute('data-accent', accentColor)` when `accentColor` is `'blue'`
or `'green'`, and `document.documentElement.removeAttribute('data-accent')` when `accentColor` is
`'purple'`.

**References**: `App.tsx`'s existing `theme`-application `useEffect` (`FRONTEND-099-AC-02`), the
exact pattern this mirrors for a second attribute.

**Test Case (Red)**:
```typescript
// src/App.test.tsx (additions)
describe('FRONTEND-110-AC-01/02: accentColor applies a data-accent attribute', () => {
  it('defaults to no data-accent attribute (purple) when nothing is stored', () => {
    render(<App />)
    expect(document.documentElement.getAttribute('data-accent')).toBeNull()
  })

  it('applies data-accent="blue" when a stored accentColor is blue', () => {
    localStorage.setItem('accentColor', JSON.stringify('blue'))
    render(<App />)
    expect(document.documentElement.getAttribute('data-accent')).toBe('blue')
  })

  it('removes the attribute when switching back to Purple', () => {
    localStorage.setItem('accentColor', JSON.stringify('green'))
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: /settings/i }))
    fireEvent.click(screen.getByRole('radio', { name: /^purple$/i }))
    expect(document.documentElement.getAttribute('data-accent')).toBeNull()
  })
})
```
**Test Case (Green)**: add the effect until the spec above passes.

---

### FRONTEND-110-AC-03 [AUTO]
**Statement**: `accentColor` and `setAccentColor` shall be passed to `SettingsPage` as props
through the `/settings` route element in `App.tsx`, the same way `theme`/`setTheme` already are.

**References**: `App.tsx`'s `element={<SettingsPage theme={theme} setTheme={setTheme} />}`.

**Test Case (Green)**: covered by `FRONTEND-110-AC-07`/`08`'s `SettingsPage` tests below, which
require the props to actually reach the component to pass.

---

## Requirement 2: CSS override mechanism

**User story**: As a user, I want "Blue" or "Green" to look right regardless of which theme I'm
also using — all six theme × accent combinations need to render correctly, not just the default
purple ones.

### FRONTEND-110-AC-04 [AUTO]
**Statement**: `index.css` shall gain four rule blocks for `data-accent="blue"`, each a compound
selector naming both the relevant theme condition and `[data-accent='blue']` together (never a bare
`[data-accent='blue']` selector alone), mirroring `FRONTEND-099-AC-04/05`'s exact four-block shape:

```css
:root[data-accent='blue'] {
  --accent: #3b9eff;
  --accent-bg: rgba(59, 158, 255, 0.1);
  --accent-border: rgba(59, 158, 255, 0.5);
}

@media (prefers-color-scheme: dark) {
  :root[data-accent='blue'] {
    --accent: #7dd3fc;
    --accent-bg: rgba(125, 211, 252, 0.15);
    --accent-border: rgba(125, 211, 252, 0.5);
  }
}

:root[data-theme='dark'][data-accent='blue'] {
  --accent: #7dd3fc;
  --accent-bg: rgba(125, 211, 252, 0.15);
  --accent-border: rgba(125, 211, 252, 0.5);
}

:root[data-theme='light'][data-accent='blue'] {
  --accent: #3b9eff;
  --accent-bg: rgba(59, 158, 255, 0.1);
  --accent-border: rgba(59, 158, 255, 0.5);
}
```

Only `--accent`/`--accent-bg`/`--accent-border` are set — no other custom property is touched by
any accent-color rule.

**References**: `index.css`'s existing `:root[data-theme='dark']`/`:root[data-theme='light']`
blocks (`FRONTEND-099-AC-04/05`), the structural precedent this must match exactly. Hex values are
a starting suggestion only — see this spec's Design Decisions and `FRONTEND-110-AC-06`.

**Test Case (Manual)**: visual check in browser — select "Blue" with each of Light/Dark/Match
System (OS light and OS dark) active; confirm the accent color (buttons, active tab underline,
selected chip borders, star rating fill) renders the correct blue value for all four theme
contexts, with no purple ever bleeding through.

---

### FRONTEND-110-AC-05 [AUTO]
**Statement**: `index.css` shall gain the identical four-block shape for `data-accent="green"`,
using:

```css
:root[data-accent='green'] {
  --accent: #4ade80;
  --accent-bg: rgba(74, 222, 128, 0.1);
  --accent-border: rgba(74, 222, 128, 0.5);
}
/* ...dark media block, :root[data-theme='dark'][data-accent='green'],
   :root[data-theme='light'][data-accent='green'] using: */
--accent: #86efac;
--accent-bg: rgba(134, 239, 172, 0.15);
--accent-border: rgba(134, 239, 172, 0.5);
```

**References**: `FRONTEND-110-AC-04` (the exact shape this repeats for a second preset).

**Test Case (Manual)**: same visual check as `FRONTEND-110-AC-04`, for Green.

---

### FRONTEND-110-AC-10 [AUTO]
**Statement**: `index.css` shall gain the identical four-block shape for `data-accent="orange"`,
using:

```css
:root[data-accent='orange'] {
  --accent: #fb923c;
  --accent-bg: rgba(251, 146, 60, 0.1);
  --accent-border: rgba(124, 45, 18, 0.7);
}
/* ...dark media block, :root[data-theme='dark'][data-accent='orange'],
   :root[data-theme='light'][data-accent='orange'] using: */
--accent: #fdba74;
--accent-bg: rgba(253, 186, 116, 0.15);
--accent-border: rgba(253, 186, 116, 0.5);
```

**References**: `FRONTEND-110-AC-04` (the exact shape this repeats); light-theme `--accent-border`
is, like Blue/Green, a darker/more saturated shade rather than `--accent` at alpha — pre-verified
via the WCAG relative-luminance formula (see `FRONTEND-110-AC-06`) rather than left for
implementation to discover.

**Test Case (Manual)**: same visual check as `FRONTEND-110-AC-04`, for Orange.

---

### FRONTEND-110-AC-11 [AUTO]
**Statement**: `index.css` shall gain the identical four-block shape for `data-accent="teal"`,
using:

```css
:root[data-accent='teal'] {
  --accent: #2dd4bf;
  --accent-bg: rgba(45, 212, 191, 0.1);
  --accent-border: rgba(19, 78, 74, 0.65);
}
/* ...dark media block, :root[data-theme='dark'][data-accent='teal'],
   :root[data-theme='light'][data-accent='teal'] using: */
--accent: #5eead4;
--accent-bg: rgba(94, 234, 212, 0.15);
--accent-border: rgba(94, 234, 212, 0.5);
```

**References**: `FRONTEND-110-AC-04` (the exact shape this repeats); light-theme `--accent-border`
is likewise a darker/more saturated shade, same reasoning as `FRONTEND-110-AC-10`.

**Test Case (Manual)**: same visual check as `FRONTEND-110-AC-04`, for Teal.

---

### FRONTEND-110-AC-06 [MANUAL]
**Statement**: Before this spec ships, every accent × theme combination that renders **black** text
on an `--accent` background (`buttons.module.css`'s `.btnPrimary`, `color: #000` regardless of
theme) shall be verified — via the WCAG relative-luminance formula or a real contrast-checking tool
— to meet WCAG AA's 4.5:1 minimum for normal text. Any usage of `--accent-border` as a UI-component
boundary (e.g. selected-chip borders, active-tab underlines) shall be verified to meet WCAG
1.4.11's 3:1 non-text contrast minimum against the neutral `--bg` it sits on. This applies to all
four new presets (Blue, Green, Orange, Teal) — if a hex value from `FRONTEND-110-AC-04`/`05`/`10`/
`11` fails either check, it shall be adjusted before merging; the values given in those ACs are a
starting point verified analytically, not a substitute for a final live-browser sanity check.

**References**: `frontend_spec_103_button_styling_consistency.md` (the existing WCAG 1.4.11
`--control-border` fix — the precedent for this app already holding itself to this standard), the
"Full-codebase manual accessibility review" spec candidate (`.claude/SPEC_CANDIDATES.md`, flags
color contrast as still unaudited app-wide in both existing themes — this AC is a narrower,
scoped version of that same concern for the four new presets only).

**Test Case (Manual)**: run every new hex value (Blue/Green/Orange/Teal, light/dark) against the
WCAG relative-luminance formula or a real contrast-checking tool for both the black-on-`--accent`
and `--accent-border`-on-`--bg` cases; record the result; adjust and re-check any failing value
before this spec is marked done.

---

## Requirement 3: Settings control

**User story**: As a user, I want a simple choice of accent color on the Settings page, in the same
place I already go to change light/dark.

### FRONTEND-110-AC-07 [AUTO]
**Statement**: `SettingsPage.tsx`'s existing `<SettingsSection title="Appearance">` shall gain a
second `role="radiogroup"` (`aria-label="Accent Color"`), rendered immediately below the existing
theme radiogroup, with five options — Purple / Blue / Green / Orange / Teal — reflecting the
current `accentColor` prop.

**References**: `SettingsPage.tsx`'s existing theme `role="radiogroup"` (lines ~231-269), the exact
markup shape this mirrors (one `<div className={styles.themeOption}>` per option, a `<input
type="radio" name="accent-color">` + `<label>` pair each).

**Test Case (Red)**:
```typescript
// src/components/SettingsPage.test.tsx (additions)
describe('FRONTEND-110-AC-07/08: Accent Color section', () => {
  it('renders the three accent options with Purple selected by default', () => {
    render(
      <SettingsPage
        theme="system"
        setTheme={vi.fn()}
        accentColor="purple"
        setAccentColor={vi.fn()}
      />,
    )
    expect(screen.getByRole('radio', { name: /^purple$/i })).toBeChecked()
  })

  it('calls setAccentColor immediately when Blue is selected', () => {
    const setAccentColor = vi.fn()
    render(
      <SettingsPage
        theme="system"
        setTheme={vi.fn()}
        accentColor="purple"
        setAccentColor={setAccentColor}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /^blue$/i }))
    expect(setAccentColor).toHaveBeenCalledWith('blue')
  })
})
```
**Test Case (Green)**: add the second radiogroup and its `SettingsPageProps.accentColor`/
`setAccentColor` props until the spec above passes.

---

### FRONTEND-110-AC-08 [AUTO]
**Statement**: Selecting an accent option shall call `setAccentColor` with the corresponding value
immediately (no separate Save/Apply step), matching this app's other live-updating Settings
controls.

**Test Case (Green)**: covered by `FRONTEND-110-AC-07`'s second test case above.

---

## Requirement 4: Recommendation Favourites — divider between Country and Language

**User story**: As a user looking at Settings' "Recommendation Favourites" section, I want Country
Favourites and Language Favourites to read as two distinct fields, not one continuous list.

### FRONTEND-110-AC-09 [AUTO]
**Statement**: `SettingsPage.tsx`'s "Recommendation Favourites" `SettingsSection` shall render a
visual divider between its "Country Favourites" and "Language Favourites" `KeywordPicker`
instances — a `<div className={styles.favouritesDivider}>` (or equivalent) between the two,
styled with `border-top: 1px solid var(--control-border)` and vertical spacing on both sides,
mirroring `FilterProfileAreaGroup.module.css`'s existing `.summary` divider convention (same
token, same one-line-border shape) rather than inventing a new visual treatment.

**References**: `SettingsPage.tsx` (~lines 344-359, the two adjacent `KeywordPicker` instances with
no separation today — confirmed via reading the code, `SettingsSection`'s own `.section` wrapper
applies no `gap` between children at all); `FilterProfileAreaGroup.module.css`'s `.summary` class
(the `border-top: 1px solid var(--control-border)` divider precedent this reuses).

**Test Case (Red)**:
```typescript
// src/components/SettingsPage.test.tsx (additions)
describe('FRONTEND-110-AC-09: divider between Country and Language Favourites', () => {
  it('renders a divider element between the two KeywordPicker instances', () => {
    render(<SettingsPage theme="system" setTheme={vi.fn()} accentColor="purple" setAccentColor={vi.fn()} />)
    const countryPicker = screen.getByLabelText(/country favourites/i)
    const divider = screen.getByTestId('favourites-divider')
    const languagePicker = screen.getByLabelText(/language favourites/i)
    expect(
      countryPicker.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      divider.compareDocumentPosition(languagePicker) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
```
**Test Case (Green)**: add the divider element and its CSS until the spec above passes.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `useLocalStorage`/`App.tsx`-ownership/`data-*`-attribute mechanism this spec reuses for a second axis | `frontend_spec_099_settings_theme_toggle.md` |
| `.summary` divider convention this spec's Requirement 4 reuses | `FilterProfileAreaGroup.module.css` |
| Four-block CSS override shape (`base` + `@media dark` + explicit `data-theme='dark'` + explicit `data-theme='light'`) this spec repeats per accent preset | `index.css`'s existing `:root[data-theme='dark']`/`:root[data-theme='light']` blocks (`FRONTEND-099-AC-04/05`) |
| `--accent`/`--accent-bg`/`--accent-border` token definitions this spec overrides | `frontend/src/index.css` |
| `.btnPrimary`'s theme-independent black text — the highest-stakes contrast dependency this spec must verify | `frontend/src/styles/buttons.module.css` |
| Existing WCAG 1.4.11 contrast precedent in this app | `frontend_spec_103_button_styling_consistency.md` |
| Broader, still-open app-wide contrast audit this AC's scope is a narrow slice of | `.claude/SPEC_CANDIDATES.md`'s "Full-codebase manual accessibility review" candidate |

---

## Acceptance Criteria Summary

- [x] FRONTEND-110-AC-01: `App.tsx` owns `accentColor`/`setAccentColor` via `useLocalStorage`; new `types/accentColor.ts` (`AccentColor`/`isAccentColor`)
- [x] FRONTEND-110-AC-02: effect applies/removes the `data-accent` attribute on `<html>`
- [x] FRONTEND-110-AC-03: `accentColor`/`setAccentColor` threaded to `SettingsPage` via the route element
- [x] FRONTEND-110-AC-04: four-block `data-accent="blue"` CSS override, `--accent`/`--accent-bg`/`--accent-border` only
- [x] FRONTEND-110-AC-05: four-block `data-accent="green"` CSS override
- [x] FRONTEND-110-AC-06 [MANUAL]: contrast-verify every accent × theme combination before shipping; adjust hex values if any fail — verified via the WCAG relative-luminance formula for all four presets (Blue/Green/Orange/Teal); both Blue and Green light-theme `--accent-border` values were adjusted from the suggested rgba-of-`--accent` shape to a darker, more saturated hex to pass 3:1, since no alpha of the lighter suggested hue could reach it against a white `--bg` — Orange/Teal's `--accent-border` values in AC-10/AC-11 were chosen with this same darker-shade approach pre-applied, verified passing before implementation rather than discovered failing afterward
- [x] FRONTEND-110-AC-07: `SettingsPage` renders the second "Accent Color" radiogroup (Purple/Blue/Green/Orange/Teal)
- [x] FRONTEND-110-AC-08: selecting an option applies immediately, no Save step
- [x] FRONTEND-110-AC-09: divider rendered between Country Favourites and Language Favourites
- [x] FRONTEND-110-AC-10: four-block `data-accent="orange"` CSS override
- [x] FRONTEND-110-AC-11: four-block `data-accent="teal"` CSS override
