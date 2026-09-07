# Frontend Spec 101: Skip-Threshold Time Units & Settings Card Styling

**Status**: Delivered
**Priority**: P3
**Depends on**: `frontend_spec_097_refresh_skip_threshold_override_ui.md` (`SettingsSection`, the skip-threshold override input this restyles), `frontend_spec_098`/`099` (the other three sections this same redesign applies to)
**Area**: Frontend (`components/SettingsPage.tsx`, `SettingsPage.module.css`, `components/SettingsSection.tsx`, `SettingsSection.module.css`, and each affected file's tests)

## Overview

Two independent improvements to `/settings`, bundled together since both land on the same files
in the same pass:

1. **Skip-threshold override gains Days/Weeks/Months units.** Today's override input
   (`frontend_spec_097`) is a bare number labeled "(minutes)" — entering a week's threshold means
   typing `10080`. Confirmed with the user: there's no legitimate case for a sub-day threshold
   (a single-series refresh already bypasses the threshold entirely, per `series_spec_018`'s own
   design), so the smallest unit offered is Days, not Hours or Minutes.
2. **`SettingsPage` adopts card-styled sections with icons** — a "modern but accessible" redesign
   confirmed with the user from three options (card sections, minimal-refinement/dividers-only,
   label-left/control-right rows). Reuses this app's *existing* modal-dialog visual language
   (border/radius/shadow tokens already used by `AddSeriesForm`/`EditSeriesForm`'s `.dialog`), not
   a new visual pattern — the one genuine first for this app is the icons themselves (nav/buttons
   are text-only everywhere else today).

## Design Decisions

- **Unit conversion is an approximation, not calendar-exact.** `1 day = 1440 minutes`, `1 week =
  10080 minutes`, `1 month = 43200 minutes` (a flat 30-day month). This is a skip *threshold*, not
  a scheduling deadline — "roughly a month" is what a user means by picking that unit, matching
  this app's existing pragmatic-approximation posture elsewhere (e.g. `RecommendationPoolCache`'s
  TTL is also a plain minutes count, no calendar-awareness).
- **The effective-threshold display converts back to the friendliest unit**, not just the raw
  minutes the backend reports. `skipThresholdMinutesUsed` (from `series_spec_052`) is always a
  plain `int` — displaying "threshold: 4320 min" after a user picked "3 days" would be a confusing
  round-trip. Convert back greedily (largest unit that divides evenly: months, then weeks, then
  days), falling back to plain minutes only when none divide evenly (e.g. a pre-existing odd value
  from before this spec, or a value picked via direct API use rather than this UI) — this never
  loses precision, it just prefers the readable form when one exists.
- **Icons are hand-rolled inline SVGs, not a new dependency.** Five icons are needed (Refresh,
  Export, Import, Favourites, Appearance) — small enough to hand-roll (`currentColor`-stroked, so
  they pick up `--text-h`/theme changes automatically in both light and dark with zero extra CSS),
  consistent with this app's general avoidance of new dependencies for small, self-contained UI
  needs (e.g. the custom `KeywordPicker` instead of a picker library, native drag-and-drop instead
  of a DnD library).
- **Icons are purely decorative — `aria-hidden="true"`, no `aria-label`.** Each `SettingsSection`
  already has a visible, non-redundant `<h3>` title; adding an icon's own accessible name would
  double-announce the same information to a screen reader. This matches "modern but *accessible*"
  literally, not just visually.
- **`SettingsSection`'s `icon` prop is optional**, not a required prop forcing every future
  consumer to supply one — this spec happens to populate it at all five current call sites, but a
  hypothetical future section without a natural icon shouldn't be forced to invent one.

## Requirements

### Requirement 1: Skip-threshold override gains Days/Weeks/Months units

**User story**: As a user setting a skip-threshold override, I want to express it in days/weeks/
months, not do mental arithmetic into minutes.

#### Acceptance Criteria

- **FRONTEND-101-AC-01** [AUTO]: The Refresh All section's override control shall be a number
  input plus a unit `<select>` (options: Days, Weeks, Months; default Days) — replacing
  `frontend_spec_097`'s bare "(minutes)"-labeled number-only field.
- **FRONTEND-101-AC-02** [AUTO]: Clicking "Refresh All" with a non-blank override value shall
  convert it to total minutes (`value * {1440 | 10080 | 43200}` per the selected unit) before
  calling `seriesApi.refreshAll` — e.g. `3` + `Days` → `4320`.
- **FRONTEND-101-AC-03** [AUTO]: Leaving the numeric field blank shall send no override at all,
  regardless of which unit is selected — unchanged from `frontend_spec_097`'s existing contract.
- **FRONTEND-101-AC-04** [AUTO]: `buildRefreshProgressText`/`buildLastFullRefreshText` shall
  format `skipThresholdMinutesUsed` in the largest whole unit that divides it evenly (months, then
  weeks, then days), falling back to plain minutes when none divide evenly — e.g. `4320` →
  `"3 days"`, `10080` → `"1 week"`, `90` → `"90 min"`.

---

### Requirement 2: `SettingsSection` gains an optional icon; sections become cards

**User story**: As a user, I want Settings to look like a deliberately designed page, not a stack
of unstyled controls.

#### Acceptance Criteria

- **FRONTEND-101-AC-05** [AUTO]: `SettingsSection` shall accept an optional `icon?: ReactNode`,
  rendered immediately before the title with `aria-hidden="true"`.
- **FRONTEND-101-AC-06** [AUTO]: `SettingsSection`'s wrapper shall render as a bordered, padded
  card — `border: 1px solid var(--border)`, `border-radius: 0.75rem`, `box-shadow: var(--shadow)`,
  `background: var(--bg)` — the same token values this app's modal `.dialog`s already use, applied
  here rather than introduced fresh.
- **FRONTEND-101-AC-07** [AUTO]: All five existing `SettingsPage` sections (Refresh All, Export,
  Import, Recommendation Favourites, Appearance) shall each pass a matching inline SVG icon, with
  no other change to any section's content, controls, or behavior.
- **FRONTEND-101-AC-08** [AUTO]: Every icon shall carry `aria-hidden="true"` — an accessibility
  tree query for each section's accessible name shall still resolve to only its visible title text,
  unchanged from before this spec.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Skip-threshold override this spec restyles with units | `frontend_spec_097_refresh_skip_threshold_override_ui.md` |
| `SettingsSection` and the other three sections this spec's card/icon treatment also applies to | `frontend_spec_097` (`SettingsSection` itself, Refresh/Export/Import), `frontend_spec_098` (Recommendation Favourites), `frontend_spec_099` (Appearance) |
| Existing modal-dialog `border`/`border-radius`/`box-shadow` token values this spec's card styling reuses | `frontend/src/components/AddSeriesForm.module.css`/`EditSeriesForm.module.css` (`.dialog`) |
| Single-series refresh bypassing the skip threshold entirely (why sub-day units aren't offered) | `series_spec_018_series_refresh.md` |

---

## TDD Test Case Sketches

### `src/utils/skipThresholdUnits.test.ts` (new file, or colocated with `SettingsPage.test.tsx` — implementer's call on whether this warrants its own util module)

```typescript
describe('FRONTEND-101-AC-02: unit conversion to minutes', () => {
  it('converts days/weeks/months to minutes', () => {
    expect(toMinutes(3, 'days')).toBe(4320)
    expect(toMinutes(1, 'weeks')).toBe(10080)
    expect(toMinutes(2, 'months')).toBe(86400)
  })
})

describe('FRONTEND-101-AC-04: minutes format back to the friendliest unit', () => {
  it('prefers the largest whole unit, falls back to minutes', () => {
    expect(formatThreshold(4320)).toBe('3 days')
    expect(formatThreshold(10080)).toBe('1 week')
    expect(formatThreshold(43200)).toBe('1 month')
    expect(formatThreshold(90)).toBe('90 min')
  })
})
```

### `src/components/SettingsPage.test.tsx` (additions)

```typescript
describe('FRONTEND-101-AC-01/02/03: Days/Weeks/Months override control', () => {
  it('converts a Days override to minutes on Refresh All', async () => {
    render(<SettingsPage theme="system" setTheme={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/skip threshold override/i), { target: { value: '3' } })
    fireEvent.change(screen.getByRole('combobox', { name: /unit/i }), { target: { value: 'weeks' } })
    fireEvent.click(screen.getByTestId('refresh-all-btn'))
    await waitFor(() => expect(mockRefreshAll).toHaveBeenCalledWith(30240))
  })

  it('sends no override when the numeric field is blank, regardless of unit', async () => {
    render(<SettingsPage theme="system" setTheme={vi.fn()} />)
    fireEvent.click(screen.getByTestId('refresh-all-btn'))
    await waitFor(() => expect(mockRefreshAll).toHaveBeenCalledWith(undefined))
  })
})
```

### `src/components/SettingsSection.test.tsx` (additions)

```typescript
describe('FRONTEND-101-AC-05/08: optional icon is decorative', () => {
  it('renders an icon with aria-hidden and keeps the accessible name as the title alone', () => {
    render(
      <SettingsSection title="Example" icon={<svg data-testid="icon" />}>
        <button type="button">Do a thing</button>
      </SettingsSection>,
    )
    expect(screen.getByTestId('icon').closest('[aria-hidden]')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Example' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: implement the unit picker, the conversion/format helpers, and the card/icon
styling until the specs above pass.

---

## Acceptance Criteria Summary

- [x] FRONTEND-101-AC-01: override control is number + Days/Weeks/Months unit select
- [x] FRONTEND-101-AC-02: conversion to minutes happens before the API call
- [x] FRONTEND-101-AC-03: blank field sends no override, any unit
- [x] FRONTEND-101-AC-04: threshold display formats back to the friendliest unit
- [x] FRONTEND-101-AC-05: `SettingsSection` accepts an optional decorative `icon`
- [x] FRONTEND-101-AC-06: sections render as bordered/shadowed cards reusing existing tokens
- [x] FRONTEND-101-AC-07: all five sections pass a matching icon, no other changes
- [x] FRONTEND-101-AC-08: icons are `aria-hidden`, accessible name is the title alone
