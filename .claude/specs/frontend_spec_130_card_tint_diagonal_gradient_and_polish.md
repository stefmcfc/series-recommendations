# Frontend Spec 130: Card Tint — Diagonal Gradient & Polish Pass

**Status**: Implemented (retrospective spec — written after live-review implementation on `experiment/card-header-tint-variants`, see Design Decisions)
**Priority**: P4 (pure visual polish, opt-in setting, off by default)
**Depends on**: `frontend_spec_124_card_tinting.md` (introduces the opt-in `cardTint` setting, the `[data-card-tint='on']` rule, and the `--card-bg` custom-property fallback plumbing this spec builds directly on top of), `frontend_spec_105_my_series_card_styling_and_modernization.md` (the shared `surface.card` primitive), `frontend_spec_103_button_styling_consistency.md` (`--control-border`, the WCAG-passing token reused twice in this spec), `frontend_spec_110_appearance_color_schemes.md` (`--accent-bg`, reused for the filter-section heading)
**Area**: Frontend (`index.css`, `styles/surfaces.module.css` — unchanged, referenced only —, `components/SeriesList.module.css`, `components/SearchFilter.module.css`, `components/FilterProfileAreaGroup.module.css`, `components/StarRating.module.css`, `styles/cardTint.test.ts`)

## Overview

`frontend_spec_124` shipped `cardTint` as a flat `color-mix(in srgb, var(--accent) 12%, var(--bg))` wash. This spec replaces that flat formula with a 135° diagonal linear-gradient, chosen after a live A/B/C/D comparison of four candidate treatments, and then fixes four visual problems the gradient's extra visual weight exposed once it was checked against every screen that composes the shared `surface.card` primitive (`frontend_spec_105`) rather than just the series-card grid it was originally designed against. A fifth, unplanned fix (star-rating glyph contrast) surfaced only once the first four made the tint's effect more visible.

This is retrospective documentation: every change below was implemented and manually verified live in-browser (via screenshot comparison and direct Chrome-driven inspection) before this spec was written, per the user's explicit request to spec the work after the fact rather than before. The one item that was genuinely outstanding at spec-writing time — `cardTint.test.ts` still asserting the old flat formula — is closed out as part of finishing this spec (`FRONTEND-130-AC-08`).

## Design Decisions

- **Four candidate tint treatments were compared live, not designed blind.** Flat (the `frontend_spec_124` baseline), a 135° diagonal gradient ("Variant A"), a radial glow ("Variant C"), and a top accent bar ("Variant B") were each screenshotted across List and Grid/Compact view. Variant B was abandoned outright: it also painted the shared toolbar row, since the toolbar composed the same `surface.card` primitive as content cards at the time — an unintended side effect discovered only by looking, not something inferable from the CSS alone. A and C both read as more depth/polish than the flat baseline in List view; A was carried forward into this spec's implementation.
- **Grid/Compact view's reduced visibility is an accepted tradeoff, not a defect.** Both A and C anchor their effect near the top-left corner, which is exactly where the poster thumbnail sits in `SeriesCompactGrid`/`SeriesPosterGrid` — so the tint is largely occluded there regardless of variant. This was evaluated explicitly (screenshotted side-by-side) and accepted rather than chased further, since fixing it would mean redesigning the tint's geometry around the poster's bounding box — disproportionate effort for a P4 opt-in polish setting.
- **Chrome (toolbar) and nested rows are flattened via a local `--card-bg: var(--bg)` override, not by removing `surface.card` from them.** Both `SeriesList.module.css`'s `.headerToolbar` and `FilterProfileAreaGroup.module.css`'s `.row` keep `surface.card` for its border/radius/shadow — that structural "bordered chrome" look is still correct for a toolbar and still correct for a nested settings row. Only the *background* needed to stop tinting. Shadowing the custom property one level down the cascade reuses the exact fallback mechanism `frontend_spec_124` already built (`background: var(--card-bg, var(--bg))`) instead of duplicating `.card`'s border/radius/shadow declarations locally or restructuring the class composition in the `.tsx` files — a one-line, zero-markup-change fix at each site.
- **The filter-section heading's clashing background was recolored, not removed.** `frontend_spec_123` added `.filterSectionHeading`'s `var(--social-bg)` chip specifically because a plain-text heading gave no visual hint of being interactive (`CollapsibleSection`'s toggle button). Deleting the background entirely would silently regress that discoverability fix. Swapping to `var(--accent-bg)` — the same low-alpha accent token `frontend_spec_110` already established — keeps the "this is a distinct, clickable header" affordance while making it read as an extension of the gradient tint instead of a competing neutral grey box.
- **Button tiers were evaluated and deliberately left unchanged.** `.btnPrimary`/`.btnDestructive` (`frontend_spec_103`) are already fully opaque and structurally cannot be affected by any card background. `.btnSecondary` is intentionally `background: transparent` with a WCAG-passing `--control-border` outline (`FRONTEND-103-AC-07`) — confirmed still clearly legible against the gradient by direct in-browser inspection of Settings' Export/Import controls. Making secondary CTAs solid to "stand out more" against the busier gradient was considered and rejected: it would blur the primary/secondary visual-weight distinction the button-tier system deliberately maintains, to fix a problem that direct observation showed didn't actually exist.
- **The star-rating fix reuses `--control-border` rather than a new hardcoded color.** The user's own suggestion was "maybe black for unselected" — rejected because a hardcoded black would simply vanish again against the dark theme's near-black `--bg`, reproducing the exact low-contrast bug in the other theme. `--control-border` is already the token this codebase established for precisely this "must stay visible against either a light or dark surface" requirement (`frontend_spec_103`, used by `.btnSecondary`'s border) — reusing it keeps one token responsible for that guarantee everywhere, rather than introducing a second, theme-unaware one-off value.
- **The star-rating fix is a single shared-component change, not five call-site patches.** `StarRating.module.css` backs one component (`StarRating.tsx`) consumed by `SeriesList`, `SeriesCompactGrid`, `SearchFilter`, `UseMySeriesPanel`, `EditSeriesForm`, `SeriesDetailFields`, and `SeriesFormFields` — editing the one shared stylesheet fixes contrast everywhere a personal rating renders, not just the Filters sheet where it was first noticed.
- **The codebase was swept for other `surface.card`-nesting before declaring the polish pass complete.** Every current consumer of `surface.card` was enumerated (`RecommendationCard`, `SeriesCompactGrid`, `SettingsSection`, `SearchFilter`'s five filter sections, `SeriesList`'s toolbar and rows, `FilterProfileAreaGroup`'s rows) — the Settings → Filter Profiles nesting was the only case found where one `.card` sits inside another.

---

## Requirement 1: The card-tint formula is a diagonal gradient, not a flat wash

**User story**: As a user with card tint enabled, I want the tinted background to read as subtle depth rather than a flat color wash, matching the treatment that won a live side-by-side comparison against the flat baseline and two other candidates.

### FRONTEND-130-AC-01 [AUTO]
**Statement**: `index.css`'s `[data-card-tint='on']` rule shall set `--card-bg` to a 135° `linear-gradient` running from `color-mix(in srgb, var(--accent) 20%, var(--bg))` at `0%` to `var(--bg)` at `60%`, superseding `FRONTEND-124-AC-01`'s flat `color-mix(in srgb, var(--accent) 12%, var(--bg))` formula (that AC's own statement is left unmodified as an immutable historical record per `.claude/steering/ears_format.md`; this AC documents the behavior that actually ships).

**References**: `frontend/src/index.css`, the `[data-card-tint='on']` rule (originally added by `FRONTEND-124-AC-01`).

**Test Case (Red)**: see `FRONTEND-130-AC-08` below — `cardTint.test.ts`'s existing `FRONTEND-124-AC-01` describe block asserts the old flat formula verbatim and fails against this new one; it is updated, not duplicated.

**Test Case (Green)**: the `linear-gradient(...)` formula shown above, in place.

---

## Requirement 2: Toolbar chrome does not tint alongside content cards

**User story**: As a user with card tint enabled, I want the My Series sort/view-mode/filter/Add-Series toolbar to stay visually distinct chrome, not compete with the series rows below it for the same tinted "content card" treatment.

### FRONTEND-130-AC-02 [AUTO]
**Statement**: `SeriesList.module.css`'s `.headerToolbar` shall declare `--card-bg: var(--bg)`, so the shared `.card` rule's `background: var(--card-bg, var(--bg))` always resolves to the untinted default for the toolbar, regardless of whether `[data-card-tint='on']` is set.

**References**: `frontend/src/components/SeriesList.module.css` (`.headerToolbar`); `frontend/src/components/SeriesList.tsx` line ~392 (`` `${styles.headerToolbar} ${surface.card}` `` — the toolbar wrapper) and line ~625 (`` `${styles.row} ${surface.card}` `` — the content rows it must no longer match).

**Test Case (Red)**:
```typescript
describe('FRONTEND-130-AC-02: toolbar does not inherit the card tint', () => {
  it('scopes --card-bg back to var(--bg) on .headerToolbar', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, './SeriesList.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/\.headerToolbar\s*\{[^}]*--card-bg:\s*var\(--bg\)/)
  })
})
```
**Test Case (Green)**: the `--card-bg: var(--bg);` declaration added to `.headerToolbar`.

**Manual verification** `[MANUAL]`: with card tint on, the My Series toolbar renders flat/neutral while the series rows immediately below it show the diagonal gradient — confirmed via Chrome screenshot during implementation.

---

## Requirement 3: The filter-section heading harmonizes with the tint instead of clashing

**User story**: As a user browsing the Filters sheet with card tint enabled, I want each collapsible section's heading chip (e.g. "Genres & Keywords", "Ratings") to read as part of the tinted card, not as a mismatched grey box sitting on top of it — and I want the surrounding padding tightened now that the heading carries more visual weight.

### FRONTEND-130-AC-03 [AUTO]
**Statement**: `SearchFilter.module.css`'s `.filterSectionHeading` shall set `background: var(--accent-bg)` (superseding `FRONTEND-123-AC-03`'s `var(--social-bg)`) with `padding: 0.5rem 0.625rem` (reduced from `0.625rem 0.875rem`).

**References**: `frontend/src/components/SearchFilter.module.css` (`.filterSectionHeading`, originally added by `frontend_spec_123`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-130-AC-03: filter section heading uses --accent-bg', () => {
  it('backgrounds .filterSectionHeading with var(--accent-bg)', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, './SearchFilter.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/\.filterSectionHeading\s*\{[^}]*background:\s*var\(--accent-bg\)/)
  })
})
```
**Test Case (Green)**: `background: var(--accent-bg);` in place of `var(--social-bg)`.

### FRONTEND-130-AC-04 [AUTO]
**Statement**: `SearchFilter.module.css` shall reduce `.filterSection`'s padding from `1.5rem` to `1rem`, `.filterSectionBody`'s `margin-top` from `1rem` to `0.75rem`, and `.filtersBody`'s `gap` from `1.5rem` to `1rem`.

**References**: `frontend/src/components/SearchFilter.module.css` (`.filterSection`, `.filterSectionBody`, `.filtersBody`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-130-AC-04: filter panel spacing tightened', () => {
  it('reduces .filterSection padding to 1rem', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, './SearchFilter.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/\.filterSection\s*\{\s*padding:\s*1rem;/)
  })

  it('reduces .filtersBody gap to 1rem', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, './SearchFilter.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/\.filtersBody\s*\{[^}]*gap:\s*1rem/)
  })
})
```
**Test Case (Green)**: the three padding/margin/gap values reduced as stated.

**Manual verification** `[MANUAL]`: Filters sheet screenshotted before/after — collapsed sections (e.g. "Origin") no longer show a disproportionate amount of empty card around the heading alone, and more sections fit above the fold.

---

## Requirement 4: Nested card surfaces do not double the gradient

**User story**: As a user viewing Settings → Filter Profiles with card tint enabled, I want each saved-profile row to read as content inside the tinted section, not as a second, competing gradient stacked on the first.

### FRONTEND-130-AC-05 [AUTO]
**Statement**: `FilterProfileAreaGroup.module.css`'s `.row` shall declare `--card-bg: var(--bg)`, matching `FRONTEND-130-AC-02`'s toolbar fix, so each saved-filter-profile row stays flat while the outer `SettingsSection` card around it keeps the tint.

**References**: `frontend/src/components/FilterProfileAreaGroup.module.css` (`.row`); `frontend/src/components/FilterProfileAreaGroup.tsx` line ~147 (`` `${styles.row} ${surface.card}` ``); `frontend/src/components/SettingsSection.tsx` line ~25 (`` `${styles.section} ${surface.card}` ``, the outer nesting card); `frontend/src/components/SettingsPage.tsx` lines ~489-491 (the "Filter Profiles" `SettingsSection` wrapping `FilterProfileManager`/`FilterProfileAreaGroup`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-130-AC-05: nested profile rows do not double-tint', () => {
  it('scopes --card-bg back to var(--bg) on .row', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, './FilterProfileAreaGroup.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/\.row\s*\{[^}]*--card-bg:\s*var\(--bg\)/)
  })
})
```
**Test Case (Green)**: the `--card-bg: var(--bg);` declaration added to `.row`.

**Manual verification** `[MANUAL]`: Settings → Filter Profiles screenshotted with card tint on — the outer section keeps its gradient, each profile row inside it (e.g. "Crime/Drama", "No animation") renders flat. The rest of the app's `surface.card` consumers (`RecommendationCard`, `SeriesCompactGrid`, `SettingsSection`, `SearchFilter`'s five sections) were checked for the same nesting pattern; none found.

---

## Requirement 5: Button tiers remain correct against the tint (no change)

**User story**: As a user with card tint enabled, I want CTAs like "Export JSON" and "Import" to stay clearly legible and correctly weighted against the busier gradient background, without the button system's primary/secondary distinction being blurred to compensate.

### FRONTEND-130-AC-06 [MANUAL]
**Statement**: While card tint is enabled, `.btnPrimary`/`.btnDestructive` (opaque fills, unaffected by any card background) and `.btnSecondary` (`background: transparent`, `border: 1px solid var(--control-border)`, `frontend_spec_103`) shall remain legibly distinguishable from the tinted card behind them, with no code change to `buttons.module.css`.

**References**: `frontend/src/styles/buttons.module.css`; consumers checked directly: `frontend/src/components/ExportControls.tsx` lines ~60/69, `frontend/src/components/ImportControls.tsx` lines ~139/149.

**Verification**: manual in-browser check (Chrome-driven navigation to Settings, screenshot of Export/Import sections with card tint on) — confirmed the transparent/`--control-border` outline stays clearly visible against the gradient card. No automated test is applicable since this AC's outcome is "no change was needed," not a new assertable rule; recorded here so the evaluation itself is traceable rather than silently absent from this spec.

---

## Requirement 6: Star-rating glyphs stay visible against tinted cards

**User story**: As a user viewing any personal-rating star control with card tint enabled, I want the unfilled/empty stars to stay visible against the tinted background, in both light and dark theme.

### FRONTEND-130-AC-07 [AUTO]
**Statement**: `StarRating.module.css`'s `.starEmpty`/`.starFilled` shared base rule shall set `color: var(--control-border)`, superseding the previous `var(--border)` (a near-background hairline token adequate for a 1px divider but too low-contrast for an icon glyph, and rendered nearly invisible against the tinted card's lighter gradient overlay).

**References**: `frontend/src/components/StarRating.module.css`; `frontend/src/components/StarRating.tsx` (the single shared component, consumed by `SeriesList.tsx`, `SeriesCompactGrid.tsx`, `SearchFilter.tsx`, `UseMySeriesPanel.tsx`, `EditSeriesForm.tsx`, `SeriesDetailFields.tsx`, `SeriesFormFields.tsx`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-130-AC-07: star glyphs use --control-border, not --border', () => {
  it('bases .starEmpty/.starFilled color on var(--control-border)', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, './StarRating.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/\.starEmpty,\s*\n\.starFilled\s*\{[^}]*color:\s*var\(--control-border\)/)
  })
})
```
**Test Case (Green)**: `color: var(--control-border);` in place of `var(--border)` on the shared base rule (`.starFilled`'s own override to `var(--accent)` is unchanged).

**Manual verification** `[MANUAL]`: Filters sheet's "Min Personal Rating" field screenshotted with card tint on — empty stars are now clearly visible against the gradient, in both themes.

---

## Requirement 7: Regression coverage matches the shipped formula

**User story**: As a developer working on this codebase later, I want the automated test suite to assert the gradient formula that actually ships, not the flat formula it replaced.

### FRONTEND-130-AC-08 [AUTO]
**Statement**: `styles/cardTint.test.ts`'s `FRONTEND-124-AC-01` describe block's first test (`'index.css declares the color-mix tint rule'`) shall assert the `linear-gradient` formula from `FRONTEND-130-AC-01`, replacing its assertion of the superseded flat formula. Its other two tests (`surfaces.module.css`/`SeriesPosterGrid.module.css` fallback assertions) are unaffected and unchanged, since neither consumer's fallback declaration changed.

**References**: `frontend/src/styles/cardTint.test.ts`.

**Test Case (Red)** (the state this spec found the test suite in, and the reason this AC exists):
```typescript
// Pre-existing test, asserting the now-superseded flat formula:
expect(css).toMatch(
  /\[data-card-tint=['"]on['"]\]\s*\{[^}]*--card-bg:\s*color-mix\(in srgb,\s*var\(--accent\)\s*12%,\s*var\(--bg\)\)/,
)
// FAILS against index.css's current linear-gradient rule.
```

**Test Case (Green)**:
```typescript
describe('FRONTEND-130-AC-01: card tint CSS declares the diagonal-gradient formula', () => {
  it('index.css declares the linear-gradient tint rule', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../index.css'),
      'utf-8',
    )
    expect(css).toMatch(
      /\[data-card-tint=['"]on['"]\]\s*\{[^}]*--card-bg:\s*linear-gradient\(\s*135deg,\s*color-mix\(in srgb,\s*var\(--accent\)\s*20%,\s*var\(--bg\)\)\s*0%,\s*var\(--bg\)\s*60%\s*\)/,
    )
  })
})
```

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `cardTint` setting, `[data-card-tint='on']`, `--card-bg` fallback plumbing this spec modifies | `frontend_spec_124_card_tinting.md` |
| `surface.card` primitive whose consumers this spec's fixes target | `frontend_spec_105_my_series_card_styling_and_modernization.md` |
| `--control-border` WCAG-passing token, reused for the star-rating fix | `frontend_spec_103_button_styling_consistency.md` (`FRONTEND-103-AC-07`) |
| `--accent-bg` token, reused for the filter-section heading | `frontend_spec_110_appearance_color_schemes.md` |
| `.filterSectionHeading`'s original `var(--social-bg)` background and interactive-toggle rationale | `frontend_spec_123` (referenced in `SearchFilter.module.css` comments; superseded by `FRONTEND-130-AC-03`) |
| `.filterSection`/`CollapsibleSection` structure this spec's spacing changes apply to | `frontend_spec_109_filter_profile_polish.md`, `frontend_spec_123` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-130-AC-01: `index.css` tint formula is the 135° diagonal gradient
- [x] FRONTEND-130-AC-02: `.headerToolbar` scopes `--card-bg` back to `var(--bg)`
- [x] FRONTEND-130-AC-03: `.filterSectionHeading` backgrounds with `var(--accent-bg)`, tighter padding
- [x] FRONTEND-130-AC-04: `.filterSection`/`.filterSectionBody`/`.filtersBody` spacing tightened
- [x] FRONTEND-130-AC-05: `.row` (Filter Profiles) scopes `--card-bg` back to `var(--bg)`
- [x] FRONTEND-130-AC-06: button tiers evaluated, confirmed correct against the tint, no change made
- [x] FRONTEND-130-AC-07: star-rating glyphs use `--control-border` instead of `--border`
- [x] FRONTEND-130-AC-08: `cardTint.test.ts` updated to assert the shipped gradient formula
