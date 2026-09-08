# Frontend Spec 103: Button Styling Consistency & Contrast Fix

**Status**: Not started
**Priority**: P2
**Depends on**: none functionally, but touches most existing component specs' CSS incidentally
(`frontend_spec_002` onward) since it migrates their button rules to a shared source; reads
`frontend_spec_099_settings_theme_toggle.md`'s four-block theme-variable pattern
(`:root`, `@media (prefers-color-scheme: dark)`, `:root[data-theme='dark']`,
`:root[data-theme='light']`) as the template for the new token this spec adds.
**Area**: Frontend (`src/index.css`, new `src/styles/buttons.module.css` + its test, and every
component `.module.css`/`.tsx` pair listed under Requirement 3's Affected Files table)

## Overview

The user asked whether the app's current button styling is modern and accessible, particularly in
dark mode. An audit of the actual CSS (not a redesign brief) found two real problems: (1) a
measurable WCAG contrast failure — the outline/secondary button tier's border relies entirely on
`--border`, a token deliberately tuned for subtle structural dividers, not interactive-control
boundaries, and it fails WCAG 2.1 SC 1.4.11's 3:1 non-text-contrast minimum in both themes (exact
arithmetic below); and (2) four distinct button "tiers" (primary, secondary/outline, destructive,
and a narrower bespoke genre-toggle tier) are each redeclared independently — copy-pasted rule sets
— across more than a dozen `.module.css` files instead of coming from one shared definition, so a
future palette or accessibility tweak has to be hunted down and repeated by hand every time.

This spec fixes the contrast failure with a new, purpose-built custom property and introduces this
codebase's first shared, centralized button-style module, migrating every existing tier-1/2/3
button to consume it. It does not redesign what's primary/secondary/destructive anywhere, and does
not touch tier 1's already-passing color values. Per this project's CLAUDE.md, a *pure*
no-behavior-change cleanup wouldn't need a spec — but this one does: introducing a new shared CSS
token (`--control-border`) and a new shared stylesheet is a real, if small, structural addition that
future button-related work will build on, not just a mechanical rule-for-rule rewrite.

## Background: the contrast problem, with arithmetic

WCAG contrast ratio: `(L1 + 0.05) / (L2 + 0.05)` where `L1 ≥ L2` are the two colors' relative
luminances (`0.2126·R + 0.7152·G + 0.0722·B` on linearized sRGB channels). SC 1.4.11 (Non-text
Contrast) requires **≥ 3:1** for UI component boundaries — it applies here because tier-2 buttons
have `background: transparent`, so their 1px border is the *only* visual signal that the element is
a clickable control.

**Current `--border` vs `--bg` (the failing case):**

| Theme | `--border` | `--bg` | Computed ratio | Passes 3:1? |
|---|---|---|---|---|
| Light | `#e5e4e7` (L≈0.7792) | `#fff` (L=1) | **1.27:1** | No |
| Dark | `#2e303a` (L≈0.0300) | `#16171d` (L≈0.0087) | **1.36:1** | No |

Both fail by a wide margin — this is why tier-2 buttons read as flat, barely-there rectangles,
worst in dark mode. `--border` itself is not being changed (see Design Decisions) — every card
outline/section divider using it today keeps its current, correctly-subtle appearance.

**Proposed new `--control-border` vs `--bg` (the fix):**

| Theme | `--control-border` | `--bg` | Computed ratio | Passes 3:1? |
|---|---|---|---|---|
| Light | `#86808f` (L≈0.2248) | `#fff` (L=1) | **3.82:1** | Yes |
| Dark | `#6b7280` (L≈0.1673) | `#16171d` (L≈0.0087) | **3.70:1** | Yes |

Both colors are neutral grays chosen to sit visually between the existing `--border` (too faint)
and `--text`/`--text-h` (full body-text weight) — a step darker/lighter than `--border` without
looking as heavy as running text. The dark-mode value additionally matches the cool blue-gray
undertone of dark-mode `--text` (`#9ca3af`), and the light-mode value matches the warm purple-gray
undertone of light-mode `--text` (`#6b6375`), since the two themes already use slightly different
hue families for that token.

**What's confirmed NOT broken (verified, not assumed — don't touch these):**

| Tier | Check | Light | Dark |
|---|---|---|---|
| 1 (primary) | text (`#000`/`#000`) on fill (`--accent`) | 4.78:1 (AA pass) | 7.95:1 (AAA pass) |
| 1 (primary) | fill (`--accent`) vs page `--bg` (component boundary, SC 1.4.11) | 4.40:1 (pass) | 6.77:1 (pass) |
| 3 (destructive) | text (`#fff`) on fill (`#b91c1c`/`#dc2626`) | 6.47:1 (pass) | 4.83:1 (pass) |
| 3 (destructive) | fill vs page `--bg` (component boundary) | 6.47:1 (pass) | 3.70:1 (pass) |

Tier 1 and tier 3 need no color changes anywhere in this spec — their fills already provide enough
contrast against the page background to read as a distinct control even without a border, unlike
tier 2 which has no fill to rely on.

## Design Decisions

- **A new `--control-border` token, not a repurposed `--border`.** `--border` stays exactly as-is
  for its current structural-divider uses (card outlines, section rules) — changing its value would
  silently alter every one of those elsewhere in the app, which is out of scope and not what was
  reported.
- **`--control-border` is added to all four existing theme blocks in `frontend/src/index.css`**
  (`:root`, `@media (prefers-color-scheme: dark)`, `:root[data-theme='dark']`,
  `:root[data-theme='light']`), mirroring exactly how `--border`/`--accent`/every other themed token
  is already duplicated across those same four blocks (`frontend_spec_099`'s manual
  light/dark-override mechanism). No new mechanism is introduced for this token.
- **Composition mechanism confirmed by grepping the existing codebase, not assumed**: this project
  uses plain template-literal string joins to combine two CSS-module classes on one element —
  `` `${styles.filterSection} ${styles.sectionDivider}` `` (`SearchFilter.tsx`) and
  `` `${styles.rewatchToggle} ${s.flaggedForRewatch ? styles.rewatchToggleActive : ''}` ``
  (`SeriesList.tsx`). There is no `clsx`/`classnames` dependency installed
  (`frontend/package.json` confirmed clean of both) and `frontend_conventions.md`'s Styling section
  doesn't call for one. This spec's shared classes are consumed the same way — no new dependency.
- **Shared classes cover color/tier semantics only, not geometry.** `frontend/src/styles/
  buttons.module.css` exports `.btnPrimary` / `.btnSecondary` / `.btnDestructive`, each carrying only
  `background`, `color`, `border`/`border-color`, `cursor: pointer`, and `:hover` (and, where a
  disabled state exists today, `:disabled`) — i.e. exactly the properties that are copy-pasted
  identically across files today. Padding, font-size, border-radius, and min-width/min-height stay
  on each component's own existing class, since those already vary deliberately by context (e.g. a
  header CTA is larger than a row-action button) and this spec is an explicit no-redesign
  consolidation, not a spacing unification. A migrated element's `className` composes both:
  `` `${styles.addButton} ${btn.btnPrimary}` ``.
- **Tier 4 (genre include/exclude) stays bespoke.** `GenreIncludeExcludePicker.module.css`'s
  `.chipInclude`/`.chipExclude`/`.genreToggle[data-state='include'|'exclude']` (solid green
  `#15803d` / red `#b91c1c`) encode inclusion/exclusion semantics, not a generic primary/secondary/
  destructive tier — narrower scope, and conflating it with tier 3 (destructive) would be
  semantically wrong even though the exclude color happens to reuse the same red. Left untouched.
  That same file's *other* buttons — `.triggerButton` (tier 2), `.clearButton` (tier 2), and
  `.doneButton` (tier 1) — are ordinary tier buttons and do migrate like every other component's.
- **No visual redesign of what's primary/secondary/destructive anywhere.** Every existing button
  keeps its current tier. The only pixel-level change anywhere in the app from this spec is tier-2's
  border color (`var(--border)` → `var(--control-border)`).
- **Contrast is regression-tested with a pure-arithmetic Vitest test, not a rendered-DOM one.**
  jsdom doesn't render CSS, so it can't validate real computed contrast after paint
  (`frontend_conventions.md`'s Testing Strategy section and this project's own CLAUDE.md make this
  point explicitly) — but the WCAG luminance/contrast formula applied to the literal hex values
  written in `src/index.css` is plain arithmetic, not rendering, and *is* reliably automatable. A
  real-browser pass (AC-15) still covers what the math can't: how the border actually reads once
  painted, in both themes.

## Requirements

### Requirement 1: A dedicated, WCAG-passing token for interactive-control borders

**User story**: As a user in dark mode (or light mode), I want to be able to see that an outlined
button is a clickable control, not a flat rectangle, without changing how any other bordered element
in the app looks.

#### Acceptance Criteria

- **FRONTEND-103-AC-01** [AUTO]: The `:root` block in `frontend/src/index.css` shall define
  `--control-border: #86808f` (the light-mode value).
- **FRONTEND-103-AC-02** [AUTO]: The `@media (prefers-color-scheme: dark)` block and the
  `:root[data-theme='dark']` block in `frontend/src/index.css` shall each define
  `--control-border: #6b7280`; the `:root[data-theme='light']` block shall define
  `--control-border: #86808f` — matching the existing four-block repetition pattern used for every
  other themed token in that file.
- **FRONTEND-103-AC-03** [AUTO]: The WCAG contrast ratio of light-mode `--control-border`
  (`#86808f`) against light-mode `--bg` (`#fff`) shall be at least 3.0 (computed ≈3.82:1).
- **FRONTEND-103-AC-04** [AUTO]: The WCAG contrast ratio of dark-mode `--control-border`
  (`#6b7280`) against dark-mode `--bg` (`#16171d`) shall be at least 3.0 (computed ≈3.70:1).
- **FRONTEND-103-AC-05** [AUTO]: The existing `--border` custom property shall remain
  `#e5e4e7` (light) / `#2e303a` (dark) in every block — unchanged by this spec, confirming
  structural dividers elsewhere are unaffected.

---

### Requirement 2: A single shared source of truth for the three general-purpose button tiers

**User story**: As a developer changing how any tier of button looks or behaves, I want one place
to change it, not a dozen copy-pasted `.module.css` rule sets.

#### Acceptance Criteria

- **FRONTEND-103-AC-06** [AUTO]: A new `frontend/src/styles/buttons.module.css` shall export
  `.btnPrimary`, `.btnSecondary`, and `.btnDestructive` classes, each reproducing its tier's
  currently-most-common rule set verbatim (background, color, border/border-color, `:hover`, and
  `:disabled` where applicable) — primary from `SeriesList.module.css`'s `.addButton`
  (`background: var(--accent); color: #000; border: none;` / hover `filter: brightness(0.9)`),
  secondary from `SeriesList.module.css`'s `.filtersButton` (`background: transparent;
  color: var(--text);` / hover `background: var(--social-bg)`), and destructive from
  `SeriesList.module.css`'s `.retryButton`/`.deleteButton` (`#b91c1c` light / `#dc2626` dark fill,
  `#fff` text, darker-red hover) — so migrating a component produces byte-for-byte identical
  rendered colors except the one intentional change in AC-07.
- **FRONTEND-103-AC-07** [AUTO]: `.btnSecondary`'s `border-color` shall be
  `var(--control-border)`, not `var(--border)` — the one intentional visual change this spec makes
  anywhere.
- **FRONTEND-103-AC-08** [AUTO]: Components composing a migrated button's class list shall use
  the plain template-literal join pattern already established in this codebase (e.g.
  `` `${styles.addButton} ${btn.btnPrimary}` ``), matching `SearchFilter.tsx`/`SeriesList.tsx`'s
  existing usage — no `clsx`/`classnames` or other new dependency shall be introduced.

---

### Requirement 3: Migrate every existing tier-1/2/3 button, with no visual or behavioral change

**User story**: As a user, I want every button I already use to look and behave exactly as it does
today — tier 2's border aside — after this refactor, with no new dependency or redesign.

#### Affected Files (audited; tier 4 excluded per Design Decisions)

| Tier | File | Selector(s) |
|---|---|---|
| 1 Primary | `AddSeriesForm.module.css` | `.saveButton` |
| 1 Primary | `EditSeriesForm.module.css` | `.saveButton` |
| 1 Primary | `SeriesList.module.css` | `.addButton`, `.viewModeButton[aria-pressed='true']`, `.rewatchToggleActive` |
| 1 Primary | `SeriesDetail.module.css` | `.rewatchToggleActive` |
| 1 Primary | `SeriesRecommendationsModal.module.css` | `.doneButton` |
| 1 Primary | `RecommendationDetailModal.module.css` | `.doneButton` |
| 1 Primary | `SearchFilter.module.css` | `.doneButton`, `.searchButton` |
| 1 Primary | `RecommendationControls.module.css` | `.doneButton` (and other accent-fill buttons in that file — confirm exact selector names during implementation) |
| 1 Primary | `RecommendationCard.module.css` | `.markWatchedButton` |
| 1 Primary | `GenreIncludeExcludePicker.module.css` | `.doneButton` only (tier 4 chips/toggles excluded) |
| 2 Secondary | `SettingsPage.module.css` | `.refreshAllButton` |
| 2 Secondary | `ImportControls.module.css` / `ExportControls.module.css` | `.button` |
| 2 Secondary | `AddSeriesForm.module.css` / `EditSeriesForm.module.css` | `.cancelButton` |
| 2 Secondary | `SeriesDetail.module.css` | `.backButton`, `.editButton` |
| 2 Secondary | `SeriesList.module.css` | `.filtersButton`, `.viewModeButton` (default), `.sortDirectionButton`, `.editButton`, `.cancelDeleteButton` |
| 2 Secondary | `SearchFilter.module.css` | `.clearButton` |
| 2 Secondary | `GenreIncludeExcludePicker.module.css` | `.triggerButton`, `.clearButton` |
| 2 Secondary | `ConfirmDialog.module.css` | cancel-style button — confirm exact selector during implementation |
| 2 Secondary | `RecommendationControls.module.css`, `RecommendationDetailModal.module.css`, `SeriesRecommendationsModal.module.css`, `RecommendationsList.module.css` | outline-style buttons matching the same `transparent` + `1px solid var(--border)` rule — confirm exact selector names during implementation |
| 3 Destructive | `SeriesList.module.css` | `.retryButton`, `.deleteButton`, `.confirmDeleteButton` |
| 3 Destructive | `SeriesDetail.module.css` | `.retryButton`, `.confirmDeleteButton` |
| 3 Destructive | `RecommendationsList.module.css` | `.retryButton` |
| 3 Destructive | `ConfirmDialog.module.css` | `.confirmButton` |

Any further component found during implementation to redeclare the same tier's rule set verbatim
(the audit above is believed complete but not guaranteed exhaustive) shall also be migrated under
this same requirement — it is the pattern being fixed, not a fixed enumeration.

#### Acceptance Criteria

- **FRONTEND-103-AC-09** [AUTO]: Every tier-1 button listed above shall have its own
  `.module.css` rule's `background`/`color`/`border`/`:hover` declarations removed and replaced by
  composing `buttons.module.css`'s `.btnPrimary` in the component's `className`, with its existing
  geometry declarations (padding, font-size, border-radius, min-width/min-height) left in place on
  its own class.
- **FRONTEND-103-AC-10** [AUTO]: Every tier-2 button listed above shall migrate the same way to
  `.btnSecondary`.
- **FRONTEND-103-AC-11** [AUTO]: Every tier-3 button listed above shall migrate the same way to
  `.btnDestructive`.
- **FRONTEND-103-AC-12** [AUTO]: `GenreIncludeExcludePicker`'s `.chipInclude`, `.chipExclude`, and
  `.genreToggle[data-state='include'|'exclude']` rules shall remain unmigrated and visually
  unchanged (tier 4, out of scope per Design Decisions).
- **FRONTEND-103-AC-13** [AUTO]: For each migrated button, the rendered element shall carry both
  its pre-existing component-owned class and the corresponding shared tier class in its `className`
  (verified via RTL class-list assertions on a representative sample per tier, not an exhaustive
  per-file re-test of already-covered component behavior).

---

### Requirement 4: Verification

**User story**: As a maintainer, I want the contrast fix to be provable by a fast automated check,
not just eyeballed once and left to drift, and I want an explicit sign-off step for what automated
tests genuinely can't see.

#### Acceptance Criteria

- **FRONTEND-103-AC-14** [AUTO]: A new test shall compute the WCAG relative-luminance contrast
  ratio directly from the literal `--control-border`/`--bg` hex values present in
  `frontend/src/index.css`'s light and dark blocks, and shall fail if either computed ratio drops
  below 3.0 — a regression guard against a future edit silently reintroducing the AC-03/04 failure.
- **FRONTEND-103-AC-15** [MANUAL]: A human reviewer shall visually confirm, in an actual browser
  (not jsdom/Vitest — per `frontend_conventions.md`'s Testing Strategy section and this project's
  own CLAUDE.md note that jsdom can't validate real CSS rendering) in both light and dark theme
  (via the OS `prefers-color-scheme` and via the manual `data-theme` toggle from
  `frontend_spec_099`), that: (a) every migrated tier-2 button's border is now clearly visible
  against its background in both themes, (b) no tier-1 or tier-3 button's appearance visibly
  changed, and (c) no button's padding/spacing/layout shifted anywhere in the app. There is no
  automated route to (a)/(b)/(c) today given the jsdom limitation above; AC-14 is the automated
  guard for the underlying token values, this AC is the guard for how they actually render.

---

## Cross-References

| This spec | Source |
|---|---|
| Four-block theme-variable pattern (`:root` / `@media (prefers-color-scheme: dark)` / `:root[data-theme='dark']` / `:root[data-theme='light']`) this spec's new token follows | `frontend/src/index.css`; `.claude/specs/frontend_spec_099_settings_theme_toggle.md` |
| Existing template-literal class-composition pattern this spec reuses, not replaces | `frontend/src/components/SearchFilter.tsx`, `frontend/src/components/SeriesList.tsx` |
| CSS Modules convention (no Tailwind, no `clsx`) | `.claude/steering/frontend_conventions.md` (Styling section) |
| jsdom/Vitest cannot validate rendered CSS — basis for AC-15 being `[MANUAL]` | `.claude/steering/frontend_conventions.md` (Testing Strategy section); project root `CLAUDE.md` |
| WCAG 2.1 Success Criterion 1.4.11 (Non-Text Contrast) — the standard `--control-border` is fixed to satisfy | external: https://www.w3.org/TR/WCAG21/#non-text-contrast |
| `src/styles/` as the intended home for global/shared styling | `.claude/steering/frontend_structure.md` (`styles/` listed as "not yet created") |

---

## TDD Test Case Sketches

### `frontend/src/styles/contrast.test.ts` (new)

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [lr, lg, lb] = [r, g, b].map(linear)
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

function contrastRatio(hexA: string, hexB: string): number {
  const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a)
  return (l1 + 0.05) / (l2 + 0.05)
}

function extractVar(cssText: string, blockSelector: string, varName: string): string {
  const blockRe = new RegExp(`${blockSelector}\\s*\\{([^}]*)\\}`, 's')
  const block = blockRe.exec(cssText)?.[1] ?? ''
  return new RegExp(`${varName}:\\s*(#[0-9a-fA-F]{6})`).exec(block)?.[1] ?? ''
}

describe('FRONTEND-103-AC-03/04: --control-border passes 3:1 against --bg in both themes', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8')

  it('light mode: --control-border vs --bg is >= 3:1', () => {
    const border = extractVar(css, ':root', '--control-border')
    const bg = extractVar(css, ':root', '--bg')
    expect(contrastRatio(border, bg)).toBeGreaterThanOrEqual(3)
  })

  it('dark mode: --control-border vs --bg is >= 3:1', () => {
    const border = extractVar(css, ":root\\[data-theme='dark'\\]", '--control-border')
    const bg = extractVar(css, ":root\\[data-theme='dark'\\]", '--bg')
    expect(contrastRatio(border, bg)).toBeGreaterThanOrEqual(3)
  })
})

describe('FRONTEND-103-AC-05: --border is unchanged', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8')

  it('light --border stays #e5e4e7, dark stays #2e303a', () => {
    expect(extractVar(css, ':root', '--border')).toBe('#e5e4e7')
    expect(extractVar(css, ":root\\[data-theme='dark'\\]", '--border')).toBe('#2e303a')
  })
})
```

**Test Case (Red)**: fails today — `--control-border` doesn't exist yet, so `extractVar` returns
`''` and `contrastRatio('', bg)` throws/NaNs.

**Test Case (Green)**: add the four `--control-border` definitions from AC-01/02 to `index.css`.

### `frontend/src/components/SeriesList.test.tsx` (additions) — representative migration check

```typescript
import buttonStyles from '../styles/buttons.module.css'

describe('FRONTEND-103-AC-09/10/11/13: buttons compose shared tier classes', () => {
  it('the Add button carries both its own class and btnPrimary', () => {
    render(<SeriesList />)
    const addButton = screen.getByRole('button', { name: /add series/i })
    expect(addButton.className).toContain(buttonStyles.btnPrimary)
  })

  it('the Filters trigger carries both its own class and btnSecondary', () => {
    render(<SeriesList />)
    const filtersButton = screen.getByRole('button', { name: /filters/i })
    expect(filtersButton.className).toContain(buttonStyles.btnSecondary)
  })

  it('the retry button (error state) carries both its own class and btnDestructive', async () => {
    mockGetAll.mockRejectedValue(new ApiError(500, 'boom'))
    render(<SeriesList />)
    const retryButton = await screen.findByRole('button', { name: /retry/i })
    expect(retryButton.className).toContain(buttonStyles.btnDestructive)
  })
})
```

**Test Case (Red)**: fails today — `buttons.module.css` doesn't exist, and none of `SeriesList.tsx`'s
buttons reference it yet.

**Test Case (Green)**: create `buttons.module.css` (AC-06/07) and migrate `SeriesList.tsx`'s three
button call sites (AC-09/10/11) until the assertions pass.

### `frontend/src/components/GenreIncludeExcludePicker.test.tsx` (additions) — tier-4 exclusion check

```typescript
import buttonStyles from '../styles/buttons.module.css'

describe('FRONTEND-103-AC-12: tier-4 include/exclude chips stay bespoke', () => {
  it('an excluded genre chip does NOT carry a shared btn* class', () => {
    render(<GenreIncludeExcludePicker /* ...with an excluded genre... */ />)
    const chip = screen.getByRole('listitem', { name: /excluded/i })
    expect(chip.className).not.toContain(buttonStyles.btnDestructive)
  })

  it('the Done button DOES carry btnPrimary (ordinary tier button in the same file)', () => {
    render(<GenreIncludeExcludePicker /* ... */ />)
    expect(screen.getByRole('button', { name: /^done$/i }).className).toContain(
      buttonStyles.btnPrimary,
    )
  })
})
```

**Test Case (Green)**: migrate only `.triggerButton`/`.clearButton`/`.doneButton`, leave
`.chipInclude`/`.chipExclude`/`.genreToggle[data-state]` untouched, until both assertions pass.

---

## Acceptance Criteria Summary

- [ ] FRONTEND-103-AC-01: `--control-border: #86808f` defined in `:root` (light default)
- [ ] FRONTEND-103-AC-02: `--control-border: #6b7280` in dark-mode blocks, `#86808f` in the light-override block
- [ ] FRONTEND-103-AC-03: light `--control-border` vs `--bg` contrast ≥ 3:1 (≈3.82:1)
- [ ] FRONTEND-103-AC-04: dark `--control-border` vs `--bg` contrast ≥ 3:1 (≈3.70:1)
- [ ] FRONTEND-103-AC-05: `--border` values unchanged (`#e5e4e7` / `#2e303a`)
- [ ] FRONTEND-103-AC-06: `buttons.module.css` exports `.btnPrimary`/`.btnSecondary`/`.btnDestructive` matching pre-migration colors verbatim
- [ ] FRONTEND-103-AC-07: `.btnSecondary`'s `border-color` is `var(--control-border)`
- [ ] FRONTEND-103-AC-08: consuming components use the existing template-literal join pattern, no new dependency
- [ ] FRONTEND-103-AC-09: every tier-1 button migrated to `.btnPrimary`
- [ ] FRONTEND-103-AC-10: every tier-2 button migrated to `.btnSecondary`
- [ ] FRONTEND-103-AC-11: every tier-3 button migrated to `.btnDestructive`
- [ ] FRONTEND-103-AC-12: tier-4 genre include/exclude styling stays bespoke and unmigrated
- [ ] FRONTEND-103-AC-13: migrated elements carry both their own class and the shared tier class
- [ ] FRONTEND-103-AC-14: automated contrast-ratio regression test against `index.css`'s literal values
- [ ] FRONTEND-103-AC-15: manual real-browser visual check in both themes (border visibility, no tier-1/3 change, no layout shift)
