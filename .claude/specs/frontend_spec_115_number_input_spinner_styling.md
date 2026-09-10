# Frontend Spec 115: Number Input Spinner Styling

**Status**: Not started
**Priority**: P4 (cosmetic cross-browser inconsistency, no functional bug)
**Depends on**: `frontend_spec_103_button_styling_consistency.md` (owns `--control-border`, the
token this spec's custom control reuses for theme-consistent borders)
**Area**: Frontend (`index.css`, new `components/NumberInput.tsx`, and every file listed in
Requirement 2)

## Overview

No CSS anywhere in this codebase targets a `type="number"` input's spinner
(`::-webkit-inner-spin-button`/`::-webkit-outer-spin-button`, or Firefox's `-moz-appearance`) —
every one of the app's 27 numeric fields renders 100% native, unstyled browser UI for its up/down
control. Chrome hides its spinner until hover/focus and its appearance can be influenced by the
OS's own native-control theming, independent of this app's own light/dark toggle; Firefox always
shows its spinner, sized/colored differently than Chrome's. This is purely a native-UA rendering
gap, confirmed live in both browsers and both app themes — not an app bug or theme-token issue.

Affected fields span 8 components: `CustomSearchPanel.tsx` (Min TMDB Rating, Year Min/Max),
`EditSeriesForm.tsx` (Current Season, Current Episode), `NameStatsTable.tsx` (min series count, min
avg personal/blended rating), `RecommendationFiltersBox.tsx` (Min TMDB Rating, min vote count, Year
Min/Max), `SearchFilter.tsx` (Min IMDb/TMDB Rating, Min/Max Year), `SeriesFormFields.tsx` (Year,
Total Seasons/Episodes, IMDb Rating, Rotten Tomatoes Rating, and one further rating field),
`SettingsPage.tsx` (refresh-skip-threshold override), and `UseMySeriesPanel.tsx` (Min IMDb/TMDB
Rating, Year Min/Max) — 27 fields total, confirmed by grepping `type="number"` across
`frontend/src`.

## Design Decisions

- **Suppress the native spinner globally, once, in `index.css`** — `-moz-appearance: textfield` on
  `input[type="number"]`, plus `appearance: none; margin: 0;` on its
  `::-webkit-inner-spin-button`/`::-webkit-outer-spin-button` — rather than duplicating the rule
  across 8 separate CSS Modules. `index.css` is this app's one global (non-module) stylesheet
  already used for cross-cutting theme tokens, the natural home for a rule with no per-component
  variation. A side benefit: any future `<input type="number">` someone adds without also using the
  new component below degrades to a plain, spinner-less field (consistent across browsers) rather
  than reintroducing today's inconsistency.
- **One new shared `NumberInput` component** (`frontend/src/components/NumberInput.tsx` +
  `.module.css` + `.test.tsx`), following this app's existing flat shared-component convention
  (`ConfirmDialog.tsx`, `KeywordPicker.tsx`, `GenreIncludeExcludePicker.tsx` — no nested `common/`
  folder). It renders a native `<input type="number">` (spinner suppressed via the global rule
  above) plus two small custom increment/decrement buttons, styled with the existing
  `--control-border` token (and its sibling background/hover tokens already used for control
  borders elsewhere) so the control matches this app's existing bordered-control look in both
  light and dark themes.
- **`NumberInput` mirrors a plain `<input type="number">`'s prop surface** (`value`, `onChange`,
  `min`, `max`, `step`, `disabled`, an associated `label`/`id`) so each of the 27 call sites is a
  drop-in replacement — no rewiring of the surrounding component's state handling, validation, or
  debounce logic.
- **Migrate all 27 call sites uniformly, not a subset.** A mixed styled/native look across the app
  would read worse than today's uniformly-native state, and every existing field already carries a
  meaningful `step` (whole numbers for counts/years, `0.1` for ratings) — there's no field here
  where the increment/decrement affordance is meaningless.

## Requirements

### Requirement 1: Global native spinner suppression

**User Story**: As a user, I want numeric fields to look the same regardless of which browser I'm
using, instead of Chrome and Firefox rendering completely different native spinner styles.

#### FRONTEND-115-AC-01 [AUTO]: native spinner is suppressed on every `type="number"` input
**Statement**: `index.css` shall include a rule suppressing the native spinner on every
`input[type="number"]` in the app (`-moz-appearance: textfield`; `::-webkit-inner-spin-button`/
`::-webkit-outer-spin-button` set to `appearance: none; margin: 0;`).

**Rationale**: The single point-of-truth fix underlying every other requirement below.

**References**: `frontend/src/index.css`

**Test Case (Red)**:
```typescript
describe('FRONTEND-115-AC-01: global spinner suppression rule exists', () => {
  it('index.css defines the native spinner suppression rule', () => {
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toMatch(/input\[type=["']number["']\][\s\S]*-moz-appearance:\s*textfield/)
    expect(css).toMatch(/::-webkit-(inner|outer)-spin-button[\s\S]*appearance:\s*none/)
  })
})
```

**Test Case (Green)**: add the rule to `index.css`.

---

### Requirement 2: Shared `NumberInput` component with a themed custom spinner

**User Story**: As a user, I want a numeric field's up/down control to look like the rest of this
app's UI, not a bare unstyled browser default.

#### FRONTEND-115-AC-02 [AUTO]: `NumberInput` renders a themed increment/decrement control
**Statement**: `NumberInput` shall render a native `<input type="number">` alongside increment and
decrement buttons styled using the `--control-border` token family, rendering consistently in both
light and dark themes.

**Rationale**: This is the actual visual fix — a consistent, app-themed control replacing the bare
native one.

**References**: `frontend/src/components/NumberInput.tsx` (new), `frontend_spec_103` (`--control-border`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-115-AC-02: renders themed increment/decrement buttons', () => {
  it('renders an input and two spinner buttons', () => {
    render(<NumberInput label="Year" value={2020} onChange={() => {}} />)
    expect(screen.getByRole('spinbutton', { name: 'Year' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /increment|increase/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decrement|decrease/i })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: build `NumberInput.tsx` with the input + two `<button type="button">`
elements, styled via `NumberInput.module.css` using `var(--control-border)`.

---

#### FRONTEND-115-AC-03 [AUTO]: prop surface mirrors a plain number input
**Statement**: `NumberInput` shall accept `value`, `onChange`, `min`, `max`, `step`, `disabled`, and
`label`/`id`, behaving equivalently to a plain `<input type="number">` with the same props.

**Rationale**: Makes every migration in Requirement 3 a drop-in swap.

**Test Case (Red)**:
```typescript
describe('FRONTEND-115-AC-03: prop surface mirrors a plain number input', () => {
  it('calls onChange with the typed value', async () => {
    const onChange = vi.fn()
    render(<NumberInput label="Min Rating" value={5} onChange={onChange} min={0} max={10} step={0.1} />)
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Min Rating' }))
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Min Rating' }), '7.5')
    expect(onChange).toHaveBeenCalled()
  })
})
```

**Test Case (Green)**: `NumberInput` forwards typed-input changes via `onChange` exactly as a plain
`<input type="number">` would.

---

#### FRONTEND-115-AC-04 [AUTO]: increment/decrement respects `step` and clamps to `min`/`max`
**Statement**: Clicking `NumberInput`'s increment/decrement button shall adjust the current value
by `step` (defaulting to `1`), clamped to `min`/`max` when provided.

**Rationale**: Matches native spinner semantics so migrating a field changes its look, not its
behavior.

**Test Case (Red)**:
```typescript
describe('FRONTEND-115-AC-04: increment/decrement respects step and clamps to min/max', () => {
  it('increments by step and stops at max', async () => {
    const onChange = vi.fn()
    render(<NumberInput label="Rating" value={9.9} onChange={onChange} max={10} step={0.1} />)
    await userEvent.click(screen.getByRole('button', { name: /increment|increase/i }))
    expect(onChange).toHaveBeenCalledWith(10)
    await userEvent.click(screen.getByRole('button', { name: /increment|increase/i }))
    expect(onChange).not.toHaveBeenCalledWith(10.1)
  })
})
```

**Test Case (Green)**: increment/decrement handlers compute `clamp(value ± step, min, max)`.

---

### Requirement 3: Migrate every existing numeric field to `NumberInput`

**User Story**: As a user, I want every numeric field across the app — not just some — to look and
behave consistently.

#### FRONTEND-115-AC-05 [AUTO]: all 27 existing fields migrate to `NumberInput`
**Statement**: Every existing `type="number"` field in `CustomSearchPanel.tsx`, `EditSeriesForm.tsx`,
`NameStatsTable.tsx`, `RecommendationFiltersBox.tsx`, `SearchFilter.tsx`, `SeriesFormFields.tsx`,
`SettingsPage.tsx`, and `UseMySeriesPanel.tsx` shall be replaced with `NumberInput`, preserving each
field's existing validation, debounce, and bounds behavior unchanged.

**Rationale**: Uniform treatment per this spec's Design Decisions — partial migration would read as
a worse, mixed inconsistency than today's uniformly-native baseline.

**References**: see Overview for the full per-component field list.

**Test Case (Red)**: no new assertions — each field's *existing* test (e.g. `SeriesFormFields`'
year-bounds validation, `SearchFilter`'s live-filter debounce where applicable) continues to assert
the same outcome and must keep passing unmodified after the swap from `<input type="number">` to
`<NumberInput>`.

**Test Case (Green)**: in each file, replace the raw `<input type="number" ... />` with
`<NumberInput ... />`, passing through the same `value`/`onChange`/`min`/`max`/`step` already wired.

---

#### FRONTEND-115-AC-06 [MANUAL]: visual parity across browsers and themes
**Statement**: A manual visual check in both Chrome and Firefox, in both light and dark theme,
shall confirm every migrated field renders an identical custom spinner control, with no native
browser fallback visible anywhere.

**Rationale**: The concrete cross-browser/cross-theme inconsistency this spec exists to fix can
only be confirmed by looking at real rendered output — Vitest/jsdom doesn't render CSS (see
`CLAUDE.md`'s "Frontend: Vitest/jsdom can't validate real CSS rendering" note).

**How verified**: open the app in Chrome and Firefox, toggle light/dark theme, visit every page
listed in Requirement 3's field list, and visually confirm each numeric field's spinner matches the
new themed control with no native browser UI showing through.

## Cross-References

| Concept | Location |
|---|---|
| `--control-border` token this spec's custom control reuses | `frontend_spec_103_button_styling_consistency.md` |
| Existing flat shared-component convention this spec follows | `components/ConfirmDialog.tsx`, `components/KeywordPicker.tsx`, `components/GenreIncludeExcludePicker.tsx` |
| Full affected-field list | this spec's Overview |

## Acceptance Criteria Summary

- [ ] FRONTEND-115-AC-01: native spinner is suppressed on every `type="number"` input
- [ ] FRONTEND-115-AC-02: `NumberInput` renders a themed increment/decrement control
- [ ] FRONTEND-115-AC-03: prop surface mirrors a plain number input
- [ ] FRONTEND-115-AC-04: increment/decrement respects `step` and clamps to `min`/`max`
- [ ] FRONTEND-115-AC-05: all 27 existing fields migrate to `NumberInput`
- [ ] FRONTEND-115-AC-06: visual parity confirmed across Chrome/Firefox, light/dark theme
