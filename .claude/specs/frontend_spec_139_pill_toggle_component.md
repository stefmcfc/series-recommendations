# Frontend Spec 139: `PillToggle` Shared Component and Toggle Consolidation

**Status**: Complete
**Priority**: P3
**Depends on**: `frontend_spec_116_missing_ratings_filter_ui.md`/
`frontend_spec_118_missing_ratings_filter_section.md` (the original `.ratingToggleChip` pattern
this spec extracts and generalizes), `frontend_spec_124_card_tinting.md` (the card-tint checkbox),
`frontend_spec_136_keyword_favourites_indicator_and_detail_modal.md` (the Favourites Only
checkbox), `frontend_spec_138_recommendation_include_already_tracked_toggle.md` (the
"Show series I already have" checkbox) — this spec touches all four's existing markup but changes
no behavior any of them specified.
**Area**: Frontend only — no backend involvement. Pure UI/styling refactor and consolidation: no
new data, no new API calls, no `seriesApi` changes, no behavior change beyond the visual control
itself (every migrated toggle keeps identical click/keyboard semantics and the exact same
accessible name text it has today).

## Overview

This codebase has two independent implementations of the same binary on/off control: a pill-shaped
`<button type="button" aria-pressed={...}>` pattern (introduced ad hoc in `SearchFilter.tsx`'s four
Missing Ratings chips, styled via `SearchFilter.module.css`'s `.ratingToggleChip`), and a plain
`<input type="checkbox">` pattern used by three other, unrelated toggles (`NameStatsTable.tsx`'s
"Favourites Only", `SettingsPage.tsx`'s "Tint cards with the active accent color", and
`RecommendationFiltersBox.tsx`'s "Show series I already have", added by `frontend_spec_138`). This
spec extracts the pill-chip styling into a new, reusable `PillToggle` component and migrates all
five existing toggle call sites onto it, so the app has one toggle control implementation instead
of two, and one consistent visual treatment for "this is a binary switch" everywhere it appears.

## Design Decisions

- **Component name: `PillToggle`.** Matches this codebase's existing shared-primitive naming
  convention (`StarRating`, `NumberInput`, `KeywordPicker`, `CollapsibleSection`,
  `InfoDisclosure`) — a concrete noun phrase naming what the control *is*, not what it's used for.
- **One boolean per `PillToggle` instance, not a mutually-exclusive group.** All five current call
  sites (four Missing Ratings chips, plus Favourites Only/Tint Cards/Show-series-I-already-have)
  are independent booleans, each toggled on its own — never a radio-style "exactly one of N"
  choice. `PillToggle` is deliberately not designed as a group/variant component.
  **`SeriesList.tsx`'s Expanded/Compact/Poster view-mode switcher is explicitly out of scope** and
  not touched by this spec — it's a different, already-working 3-way *exclusive-choice* pattern
  (select one of three), not a binary on/off toggle, so it has no `PillToggle` equivalent to
  migrate onto. Noted here so a future reader doesn't wonder why it wasn't included.
- **Props kept minimal: `pressed`, `onChange`, `children`. No `disabled` or `id` prop.** Checked
  every one of the five current consumers directly (`SearchFilter.tsx`, `NameStatsTable.tsx`,
  `SettingsPage.tsx`, `RecommendationFiltersBox.tsx`) — none disable a toggle conditionally, and
  none need to target the control by a stable `id` (all existing/updated tests query by
  `getByRole('button', { name: <label text> })`, not by id or `getByLabelText`). Adding either
  prop now would be speculative; add one only when a real consumer actually needs it, following
  this project's established preference for resolving ambiguity toward the simpler reading rather
  than pre-building for a hypothetical future need.
- **`onChange(next: boolean)`, not a parameterless `onToggle()`.** Matches this codebase's existing
  `onChange(value)` convention for other small shared controls (`NumberInput`, `StarRating`), and
  lets every migrated consumer either compute the next value directly (`setCardTint`,
  `updateState({ includeAlreadyTracked: next })`) or simply ignore the argument and reuse an
  existing flip-in-place handler (`SearchFilter.tsx`'s `toggleMissingRatingField`) — both shapes
  were already present across the five consumers before this spec, so `onChange(next)` is the one
  signature that needs no consumer-side adapter for either shape.
- **Accessible name comes from `children` text content, not a separate `<label htmlFor>`.** A
  `<button>`'s accessible name is its own text content — this is a deliberate, required
  consequence of migrating a checkbox (which needs an associated `<label>`) to a button (which
  doesn't), not an oversight. Every migration in this spec preserves the exact same visible label
  text verbatim as `PillToggle`'s `children`, so the accessible name presented to assistive tech
  and to `getByRole('button', { name: ... })` queries is unchanged in wording — only the query
  shape changes (`getByRole('checkbox', ...)`/`getByLabelText(...)` to
  `getByRole('button', { name: ... })` + an `aria-pressed` assertion). See Requirement 6.
- **`SearchFilter.tsx`'s four Missing Ratings chips need no test-shape change.** Confirmed by direct
  read of `SearchFilter.test.tsx`: it already queries these as
  `getByRole('button', { name: 'Missing IMDb Rating' })` with `aria-pressed` assertions (the chips
  were already `<button>` elements before this spec, just not via a shared component) — so
  Requirement 2's migration there is a pure implementation swap verified by regression pins, not a
  query-shape change, unlike Requirements 3-5's checkbox-to-button migrations.
- **File/CSS cleanup is scoped to what this migration makes unused, nothing more.** Each migration
  AC removes exactly the CSS rule(s) its own consumer stops referencing once swapped onto
  `PillToggle` (`SearchFilter.module.css`'s `.ratingToggleChip`, `NameStatsTable.module.css`'s
  `.favouritesOnlyLabel`, `RecommendationControls.module.css`'s `.checkboxField`/
  `.checkboxField label` — confirmed via direct grep that `RecommendationFiltersBox.tsx`'s is their
  only remaining usage). `SearchFilter.module.css` also carries an unrelated, already-dead
  `.checkboxField label` rule (no corresponding JSX anywhere in `SearchFilter.tsx`) — pre-existing,
  unrelated to this spec's migration, and deliberately left untouched here to avoid scope creep;
  flagged for a future cleanup pass instead.
- **`GenreStatsView`/`KeywordsView`/`CountryStatsView` need no code change for Requirement 3.**
  Confirmed via direct read: `NameStatsTable.tsx` itself renders the "Favourites Only" control
  (gated on its existing `favouriteNames` prop) — `GenreStatsView`/`KeywordsView` only pass that
  prop through, they don't duplicate the checkbox markup. `GenreStatsView.test.tsx` does carry one
  inherited assertion against the old checkbox query shape (`getByRole('checkbox', { name:
  /Favourites Only/i })`), which needs the same query-shape update as `NameStatsTable.test.tsx`'s
  own — see Requirement 6. `CountryStatsView` never passes `favouriteNames` and is unaffected by
  construction, same as every prior spec that generalized this prop.

---

## Requirement 1: `PillToggle` component

**User story**: As a developer, I want one reusable pill-shaped toggle component, so every binary
on/off control in the app looks and behaves consistently instead of being hand-rolled per call
site.

### FRONTEND-139-AC-01 [AUTO]
**Statement**: The `PillToggle` component shall render a `<button type="button">` whose
`aria-pressed` attribute reflects its `pressed` prop, displaying `children` as the button's own
text content; it shall compose `buttons.module.css`'s `btnPrimary` tier class while `pressed` is
`true` and `btnSecondary` while `false`, with its own pill-shaped geometry (rounded, compact
padding, smaller font) — the same recipe `SearchFilter.module.css`'s `.ratingToggleChip` already
established, now owned by `PillToggle.module.css` instead.

**References**: new `components/PillToggle.tsx` + `components/PillToggle.module.css`;
`styles/buttons.module.css`'s `btnPrimary`/`btnSecondary` (composed, not duplicated);
`SearchFilter.module.css`'s existing `.ratingToggleChip` rule (the geometry this generalizes).

**Test Case (Red)**:
```tsx
import { render, screen } from '@testing-library/react'
import { PillToggle } from './PillToggle'
import btn from '../styles/buttons.module.css'

describe('FRONTEND-139-AC-01: PillToggle rendering', () => {
  it('renders pressed with btnPrimary composed and aria-pressed true', () => {
    render(<PillToggle pressed onChange={vi.fn()}>Example</PillToggle>)
    const button = screen.getByRole('button', { name: 'Example' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button.className).toContain(btn.btnPrimary)
  })

  it('renders unpressed with btnSecondary composed and aria-pressed false', () => {
    render(<PillToggle pressed={false} onChange={vi.fn()}>Example</PillToggle>)
    const button = screen.getByRole('button', { name: 'Example' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button.className).toContain(btn.btnSecondary)
  })
})
```
**Test Case (Green)**: create `PillToggle.tsx` (a thin presentational component) and
`PillToggle.module.css` (the pill geometry, ported from `.ratingToggleChip`).

---

### FRONTEND-139-AC-02 [AUTO]
**Statement**: When a `PillToggle` button is clicked, the component shall call its `onChange` prop
with the boolean negation of its current `pressed` prop.

**References**: `components/PillToggle.tsx`.

**Test Case (Red)**:
```tsx
it('FRONTEND-139-AC-02: clicking calls onChange with the negated pressed value', () => {
  const onChange = vi.fn()
  render(<PillToggle pressed={false} onChange={onChange}>Example</PillToggle>)
  fireEvent.click(screen.getByRole('button', { name: 'Example' }))
  expect(onChange).toHaveBeenCalledWith(true)

  onChange.mockClear()
  render(<PillToggle pressed onChange={onChange}>Example 2</PillToggle>)
  fireEvent.click(screen.getByRole('button', { name: 'Example 2' }))
  expect(onChange).toHaveBeenCalledWith(false)
})
```
**Test Case (Green)**: `onClick={() => onChange(!pressed)}` on the underlying button.

---

## Requirement 2: migrate `SearchFilter`'s Missing Ratings chips

**User story**: As a developer, I want the four already-pill-shaped Missing Ratings toggles to use
the new shared component, so there's one real implementation instead of a duplicated bespoke one.

### FRONTEND-139-AC-03 [AUTO]
**Statement**: `SearchFilter`'s four Missing Ratings `<button aria-pressed>` elements (IMDb, TMDB,
Rotten Tomatoes Rating, Rotten Tomatoes Popcornmeter) shall each render via `PillToggle` instead of
their own inline `<button>` markup, with identical click/keyboard behavior and the same visible
label text as before; `SearchFilter.module.css`'s `.ratingToggleChip` rule shall be removed once
nothing in the file references it.

**References**: `components/SearchFilter.tsx` (the `toggleMissingRatingField` handler and the four
`<button>` elements); `components/SearchFilter.module.css`'s `.ratingToggleChip` rule (removed);
`FRONTEND-139-AC-01`/`AC-02` (`PillToggle`, newly depended on).

**Test Case (Red)**: every assertion below already exists and already passes against the
pre-migration implementation (see `SearchFilter.test.tsx`'s `FRONTEND-116-AC-03`/`AC-04` and
`FRONTEND-118-AC-02` describe blocks) — these are regression pins, not new query shapes, since the
chips were already `<button aria-pressed>` elements before this spec:
```tsx
it('FRONTEND-139-AC-03: Missing Ratings chips keep working after the PillToggle swap', () => {
  renderFilter()
  fireEvent.click(screen.getByRole('button', { name: /missing ratings/i }))
  const imdbChip = screen.getByRole('button', { name: 'Missing IMDb Rating' })
  expect(imdbChip).toHaveAttribute('aria-pressed', 'false')

  fireEvent.click(imdbChip)
  expect(imdbChip).toHaveAttribute('aria-pressed', 'true')

  fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
  // existing onSearch assertion: expect.objectContaining({ missingImdbRating: true })
})
```
**Test Case (Green)**: replace each of the four `<button>` elements with a `<PillToggle
pressed={form.missingXxx} onChange={() => toggleMissingRatingField('missingXxx')()}>Label
</PillToggle>` (the existing flip-in-place handler is reused unchanged, ignoring `PillToggle`'s
`next` argument); delete `.ratingToggleChip` from `SearchFilter.module.css`.

---

## Requirement 3: migrate `NameStatsTable`'s Favourites Only toggle

**User story**: As a user, I want the Favourites Only control on the Analysis page's tables to look
like every other toggle in the app.

### FRONTEND-139-AC-04 [AUTO]
**Statement**: `NameStatsTable`'s "Favourites Only" control shall render via `PillToggle` instead
of a `<label><input type="checkbox"></label>` pair, preserving its existing gating (rendered only
when `favouriteNames` is provided) and its existing client-side filtering behavior against
`stats`; `NameStatsTable.module.css`'s `.favouritesOnlyLabel` rule shall be removed once nothing
references it; `GenreStatsView`/`KeywordsView`/`CountryStatsView` require no code change since they
only pass `favouriteNames` through and never duplicate this markup themselves.

**References**: `components/NameStatsTable.tsx` (the `favouritesOnly`/`setFavouritesOnly` state and
the conditional `<label>` block); `components/NameStatsTable.module.css`'s `.favouritesOnlyLabel`
rule (removed); `frontend_spec_136`'s original `favouriteNames`/"Favourites Only" generalization
(unchanged by this spec, only its rendering).

**Test Case (Red)**:
```tsx
describe('FRONTEND-139-AC-04: Favourites Only renders via PillToggle', () => {
  it('renders as a button with aria-pressed, not a checkbox', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<FavouritesAndDetailHarness fetchStats={fetchStats} favouriteNames={['Comedy']} />)
    expect(
      screen.getByRole('button', { name: 'Favourites Only' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.queryByRole('checkbox', { name: /Favourites Only/i }),
    ).not.toBeInTheDocument()
  })

  it('still narrows rows to favourites only when pressed, client-side', async () => {
    const stats = [
      { name: 'time travel', seriesCount: 2, averagePersonalRating: 8, averageBlendedRating: 7.5 },
      { name: 'heist', seriesCount: 5, averagePersonalRating: 6, averageBlendedRating: 6.2 },
    ]
    const fetchStats = vi.fn().mockResolvedValue(stats)
    render(
      <FavouritesAndDetailHarness fetchStats={fetchStats} favouriteNames={['time travel']} />,
    )
    expect(await screen.findByText('heist')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Favourites Only' }))
    expect(screen.queryByText('heist')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: replace the `<label className={styles.favouritesOnlyLabel}>` block with
`<PillToggle pressed={favouritesOnly} onChange={setFavouritesOnly}>Favourites Only</PillToggle>`;
delete `.favouritesOnlyLabel` from `NameStatsTable.module.css`.

---

## Requirement 4: migrate `SettingsPage`'s card-tint toggle

**User story**: As a user, I want the "Tint cards" setting to look like every other toggle in the
app.

### FRONTEND-139-AC-05 [AUTO]
**Statement**: `SettingsPage`'s "Tint cards with the active accent color" control shall render via
`PillToggle` instead of a `<label htmlFor>`/`<input id type="checkbox">` pair, calling `setCardTint`
directly as `PillToggle`'s `onChange` (no adapter needed, since both share the `(next: boolean) =>
void` shape already).

**References**: `components/SettingsPage.tsx` (the `card-tint-toggle` input/label pair, inside its
existing `.themeOption` wrapper div, which is retained unchanged since it's shared with the
Appearance radiogroups above it).

**Test Case (Red)**:
```tsx
it('FRONTEND-139-AC-05: Tint cards toggle renders via PillToggle', () => {
  const setCardTint = vi.fn()
  render(
    <SettingsPage
      theme="system" setTheme={vi.fn()}
      accentColor="purple" setAccentColor={vi.fn()}
      cardTint={false} setCardTint={setCardTint}
    />,
  )
  const toggle = screen.getByRole('button', { name: /tint cards/i })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')

  fireEvent.click(toggle)
  expect(setCardTint).toHaveBeenCalledWith(true)
})

it('FRONTEND-139-AC-05: renders pressed when cardTint is true', () => {
  render(
    <SettingsPage
      theme="system" setTheme={vi.fn()}
      accentColor="purple" setAccentColor={vi.fn()}
      cardTint setCardTint={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: /tint cards/i })).toHaveAttribute(
    'aria-pressed', 'true',
  )
})
```
**Test Case (Green)**: swap the `<input id="card-tint-toggle">`/`<label htmlFor="card-tint-toggle">`
pair for `<PillToggle pressed={cardTint} onChange={setCardTint}>Tint cards with the active accent
color</PillToggle>`, left inside the existing `.themeOption` div.

---

## Requirement 5: migrate `RecommendationFiltersBox`'s already-tracked toggle

**User story**: As a user, I want the "Show series I already have" filter to look like every other
toggle in the app.

### FRONTEND-139-AC-06 [AUTO]
**Statement**: `RecommendationFiltersBox`'s "Show series I already have" control shall render via
`PillToggle` instead of a `<label htmlFor>`/`<input id type="checkbox">` pair wrapped in
`.checkboxField`, calling `updateState({ includeAlreadyTracked: next })` as `PillToggle`'s
`onChange`; `RecommendationControls.module.css`'s `.checkboxField`/`.checkboxField label` rules
shall be removed, confirmed (by direct grep) to have no other consumer.

**References**: `components/RecommendationFiltersBox.tsx` (the
`recommendation-include-already-tracked` input/label pair); `components/
RecommendationControls.module.css`'s `.checkboxField`/`.checkboxField label` rules (removed —
`SeriesFormFields.module.css`/`AddSeriesForm.module.css`/`EditSeriesForm.module.css` each define
their own separate, unrelated `.checkboxField` class and are unaffected); `frontend_spec_138`'s
original checkbox (unchanged behavior, only its rendering).

**Test Case (Red)**:
```tsx
it('FRONTEND-139-AC-06: already-tracked toggle renders via PillToggle', () => {
  const { updateState } = renderBox()
  fireEvent.click(screen.getByRole('button', { name: /^recommendations filters$/i }))

  const toggle = screen.getByRole('button', { name: 'Show series I already have' })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')

  fireEvent.click(toggle)
  expect(updateState).toHaveBeenCalledWith({ includeAlreadyTracked: true })
})

it('FRONTEND-139-AC-06: renders pressed when includeAlreadyTracked is true', () => {
  renderBox({ state: makeState({ includeAlreadyTracked: true }) })
  fireEvent.click(screen.getByRole('button', { name: /^recommendations filters/i }))
  expect(
    screen.getByRole('button', { name: 'Show series I already have' }),
  ).toHaveAttribute('aria-pressed', 'true')
})
```
**Test Case (Green)**: replace the `<div className={styles.checkboxField}>` block with
`<PillToggle pressed={state.includeAlreadyTracked} onChange={(next) => updateState({
includeAlreadyTracked: next })}>Show series I already have</PillToggle>`; delete
`.checkboxField`/`.checkboxField label` from `RecommendationControls.module.css`.

---

## Requirement 6: accessibility and test-query parity across every migration

**User story**: As a developer, I want every migrated toggle's existing test coverage updated to
match its new control type, so no test is left silently asserting against markup that no longer
exists.

### FRONTEND-139-AC-07 [AUTO]
**Statement**: For each toggle migrated by Requirements 3-5 (Favourites Only, Tint Cards, Show
series I already have), its pre-migration visible label text shall be preserved verbatim as
`PillToggle`'s `children`, and every Vitest assertion that queried the prior
`<input type="checkbox">` via `getByRole('checkbox', { name: ... })` or `getByLabelText(...)` /
`toBeChecked()` shall be updated to `getByRole('button', { name: ... })` plus an `aria-pressed`
attribute assertion, in: `NameStatsTable.test.tsx` (`FRONTEND-136-AC-03` describe block, 2
assertions), `GenreStatsView.test.tsx` (1 inherited assertion), `SettingsPage.test.tsx` (2
assertions, the "renders checked..."/"toggles" tests), and `RecommendationFiltersBox.test.tsx`
(`FRONTEND-138-AC-01` describe block, 3 assertions). `SearchFilter.test.tsx` needs no query-shape
change (see Requirement 2's Design Decisions note — its existing assertions already query
`role=button`/`aria-pressed` and serve as Requirement 2's own regression pins).

**References**: the four test files named above; `FRONTEND-139-AC-03`/`AC-04`/`AC-05`/`AC-06` (the
migrations whose test coverage this AC updates).

**Test Case (Red)**: the pre-migration versions of these exact assertions (shown in each of
`AC-04`/`AC-05`/`AC-06`'s own Test Case (Red) sections above) fail once Requirements 3-5's Green
steps land, because the DOM no longer contains a `checkbox` role or a `<label htmlFor>`-associated
control — `getByRole('checkbox', { name: /Favourites Only/i })`,
`getByLabelText(/tint cards/i)`, and `getByLabelText('Show series I already have')` would each
throw `Unable to find an element...` once their respective migration lands without this AC's test
updates.

**Test Case (Green)**: update each of the four files' assertions to the `role=button` +
`aria-pressed` shape shown in `AC-04`/`AC-05`/`AC-06` above, in the same commit as each respective
migration (not as a separate follow-up pass).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Original pill-chip pattern this spec extracts and generalizes | `SearchFilter.tsx`/`SearchFilter.module.css`'s `.ratingToggleChip` (`frontend_spec_116`/`frontend_spec_118`) |
| `btnPrimary`/`btnSecondary` tier classes composed by `PillToggle`, unchanged | `styles/buttons.module.css` (`frontend_spec_103_button_styling_consistency.md`) |
| "Favourites Only" checkbox being migrated, behavior unchanged | `components/NameStatsTable.tsx` (`frontend_spec_136_keyword_favourites_indicator_and_detail_modal.md`) |
| "Tint cards" checkbox being migrated, behavior unchanged | `components/SettingsPage.tsx` (`frontend_spec_124`) |
| "Show series I already have" checkbox being migrated, behavior unchanged | `components/RecommendationFiltersBox.tsx` (`frontend_spec_138_recommendation_include_already_tracked_toggle.md`) |
| Explicitly out of scope — a different, already-fine exclusive-choice pattern | `components/SeriesList.tsx`'s Expanded/Compact/Poster view-mode switcher |

---

## Acceptance Criteria Summary

- [x] FRONTEND-139-AC-01: `PillToggle` renders a pill `<button aria-pressed>`, composing `btnPrimary`/`btnSecondary`
- [x] FRONTEND-139-AC-02: clicking a `PillToggle` calls `onChange` with the negated `pressed` value
- [x] FRONTEND-139-AC-03: `SearchFilter`'s 4 Missing Ratings chips migrated to `PillToggle`; `.ratingToggleChip` removed
- [x] FRONTEND-139-AC-04: `NameStatsTable`'s Favourites Only toggle migrated to `PillToggle`; `.favouritesOnlyLabel` removed
- [x] FRONTEND-139-AC-05: `SettingsPage`'s Tint Cards toggle migrated to `PillToggle`
- [x] FRONTEND-139-AC-06: `RecommendationFiltersBox`'s already-tracked toggle migrated to `PillToggle`; `.checkboxField` rules removed
- [x] FRONTEND-139-AC-07: test query-shape updated (`checkbox`/`getByLabelText` to `button`+`aria-pressed`) in `NameStatsTable.test.tsx`, `GenreStatsView.test.tsx`, `SettingsPage.test.tsx`, `RecommendationFiltersBox.test.tsx`
