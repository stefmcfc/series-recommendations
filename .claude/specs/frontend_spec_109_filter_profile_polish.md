# Frontend Spec 109: Filter Profile Polish

**Status**: Implemented
**Priority**: P3 (UX/visual polish on an already-shipped feature)
**Depends on**: `frontend_spec_107_filter_profile_ui.md` (`FilterProfileSelector.tsx`),
`frontend_spec_108_filter_profile_management_and_save_modal.md` (`FilterProfileAreaGroup.tsx`,
`SaveFilterProfileModal.tsx`) — all already implemented and merged
**Area**: Frontend (`components/FilterProfileSelector.tsx`, `components/
FilterProfileAreaGroup.tsx`, `components/SaveFilterProfileModal.tsx`, `components/SearchFilter.tsx`,
`components/UseMySeriesPanel.tsx`, `components/RecommendationFiltersBox.tsx`, and their `.module.css`
files)

## Overview

Five polish items from a live-app pass over the shipped filter-profiles feature:

1. Nothing labels the inline picker's profile list as saved presets.
2. The inline picker (`FilterProfileSelector.tsx`) can delete a profile — deletion should only be
   possible from the Settings management section.
3. The inline picker renders at the *top* of each filter view, above every field — it should be at
   the end, alongside the primary action button.
4. Renaming a profile in Settings shows the rename input *next to* the original name label instead
   of replacing it.
5. A look-and-feel review against this app's established conventions, found during this session:
   three concrete deviations, listed below.

A second live-review round (after items 1-5 were implemented, before this branch was ever pushed)
surfaced three more items, added as Requirement 6: the Save/Update CTAs' visual tiering didn't read
as intentional (both plain secondary buttons); reclicking an already-applied saved-filter chip
re-applied the same criteria instead of clearing it back to defaults (a toggle-button UX mismatch,
since the chip already carries `aria-pressed="true"` when applied); and `UseMySeriesPanel.tsx` had
no way to clear its own filter/sort fields at all, unlike `SearchFilter.tsx` ("Clear Filters") and
`RecommendationFiltersBox.tsx` ("Reset Filters").

## Design Decisions

- **"Saved Filters" uses a `<fieldset>`/`<legend>`**, not an ad-hoc heading — this is the exact
  pattern `UseMySeriesPanel.tsx`'s "Filter by Status" already uses, so this spec follows existing
  precedent rather than introducing a new labeling convention. Only rendered when at least one
  profile exists (matches the list's own existing `profiles.length > 0` gate) — a first-time user
  shouldn't see an empty "Saved Filters" heading before ever saving anything.
- **Delete is Settings-only, confirmed with the user.** `FilterProfileAreaGroup.tsx`'s own
  delete-with-confirm (`FRONTEND-108-AC-12`) is untouched and remains the only way to delete a
  profile. This spec's Requirement 2 **supersedes `FRONTEND-108-AC-08`** (which specified delete
  confirmation *inside* `FilterProfileSelector.tsx`) — that behavior is removed outright, not
  replaced with something else in this component.
- **Profile names restyle as chips**, matching `KeywordPicker.module.css`'s `.chip` class exactly —
  a saved filter name is conceptually a selectable chip, the same as the genre/keyword/country
  chips already used throughout this app, not a bespoke rectangular button.
- **The save modal's z-index must exceed the enclosing sheet's, not just match it** —
  `SaveFilterProfileModal` can open on top of `SearchFilter`'s own filters sheet, which is already
  at `z-index: 100` (the established overlay/dialog convention, per `SearchFilter.module.css`'s
  "Browse Keywords" modal). The save modal's current `z-index: 20` is a real, evidence-based
  regression risk — this spec raises it above `100`, not to `100`.
- **`FilterProfileAreaGroup`'s row composes the shared `surface.card` primitive**, matching
  `SeriesList.tsx`'s own row (`${styles.row} ${surface.card}`, from `frontend_spec_105`'s
  card-unification pass) instead of a bespoke border — this feature was built without picking up
  that convention; this spec brings it in line.
- **Chip toggle-off reuses each area's own existing "clear" concept rather than inventing a new
  generic one.** `FilterProfileSelector` doesn't know what an "empty" `TCriteria` looks like for
  a type it's generic over, so `onClear` is a plain callback each host supplies: `RecommendationFiltersBox.tsx` already had `handleResetFilters` (reused verbatim);
  `SearchFilter.tsx` needed a new `handleClearForm` that's deliberately a *subset* of the existing
  `handleClear` (form reset only, no `onClose`/parent notification — clicking a chip mid-edit
  shouldn't slam the sheet shut or clear the already-applied search); `UseMySeriesPanel.tsx` needed
  a wholly new `handleClearSpecificSeriesFilters`, which doubles as `FRONTEND-109-AC-12`'s new
  "Clear Filters" button handler — one function, not two independently-maintained resets.
- **Save/Update tiering matches this app's existing primary/secondary convention** (e.g. the
  Search/Clear Filters pairing) — Save is the "create" action and gets `btn.btnPrimary`; Update
  stays `btn.btnSecondary`.

---

## Requirement 1: Label the inline picker as saved presets

**User story**: As a user, I want it obvious that the row of names above "Save" is my saved filter
presets, not some other control.

### FRONTEND-109-AC-01 [AUTO]
**Statement**: When `profiles.length > 0`, `FilterProfileSelector` shall wrap its profile list in a
`<fieldset>` with a `<legend>Saved Filters</legend>`, matching the exact `<fieldset>`/`<legend>`
structure `UseMySeriesPanel.tsx`'s "Filter by Status" already uses. When `profiles.length === 0`,
neither the fieldset nor the legend shall render.

**References**: `UseMySeriesPanel.tsx`'s `Filter by Status` `<fieldset>`/`<legend>` (the pattern
this follows).

**Test Case (Red)**:
```typescript
describe('FRONTEND-109-AC-01: "Saved Filters" label', () => {
  it('shows the Saved Filters legend when profiles exist', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      { id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: {}, createdAt: '', updatedAt: '' },
    ])
    render(<FilterProfileSelector area="MY_SERIES" currentCriteria={{}} onApply={vi.fn()} />)
    expect(await screen.findByText('Saved Filters')).toBeInTheDocument()
  })

  it('shows no legend when there are no saved profiles', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(<FilterProfileSelector area="MY_SERIES" currentCriteria={{}} onApply={vi.fn()} />)
    await waitFor(() => expect(seriesApi.listFilterProfiles).toHaveBeenCalled())
    expect(screen.queryByText('Saved Filters')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: wrap the list in the fieldset/legend, gated on `profiles.length > 0`, until
the spec above passes.

---

## Requirement 2: Delete is Settings-only

**User story**: As a user, I don't want to be able to accidentally delete a saved filter from the
middle of adjusting my search — deletion should be a deliberate Settings action.

### FRONTEND-109-AC-02 [AUTO]
**Statement**: `FilterProfileSelector.tsx` shall no longer render a delete control, and shall have
no delete-related state or handlers (`confirmingDeleteId`, `deleting`, `deleteError`,
`handleDeleteClick`, `handleConfirmDelete`, `handleCancelDelete`, `handleRowKeyDown`, and the
`.deleteButton` CSS rule are all removed). This supersedes `FRONTEND-108-AC-08` for this component
only — `FilterProfileAreaGroup.tsx`'s independent delete-with-confirm (`FRONTEND-108-AC-12`) is
unaffected and remains the only way to delete a saved profile.

**References**: `FRONTEND-108-AC-08` (superseded), `FRONTEND-108-AC-12` (unaffected, in
`FilterProfileAreaGroup.tsx`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-109-AC-02: no delete control in the inline picker', () => {
  it('renders no delete button anywhere in the profile list', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      { id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: {}, createdAt: '', updatedAt: '' },
    ])
    render(<FilterProfileSelector area="MY_SERIES" currentCriteria={{}} onApply={vi.fn()} />)
    await screen.findByText('Weeknight')
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: remove the delete control and its supporting code until the spec above
passes. Also remove the now-obsolete `FRONTEND-108-AC-08` `describe` block from
`FilterProfileSelector.test.tsx` (lines ~153-262 as of this spec's writing) — that behavior no
longer exists in this component.

---

## Requirement 3: Save moves to the end of each filter view

**User story**: As a user, I want "Saved Filters"/"Save" to appear after I've finished looking at
the filter fields, not before I've seen any of them.

### FRONTEND-109-AC-03 [AUTO]
**Statement**: In `SearchFilter.tsx`, `<FilterProfileSelector>` shall render as the last element
inside the form's field area, immediately before the `.actions` div (Clear Filters/Search buttons)
— not immediately after the sheet header as it does today.

**Test Case (Red)**:
```typescript
describe('FRONTEND-109-AC-03: Save appears after the filter fields in SearchFilter', () => {
  it('renders the profile selector after the Years section and before the action buttons', async () => {
    render(<SearchFilter isOpen onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)
    const body = screen.getByTestId('filters-body')
    const selector = await screen.findByTestId('filter-profile-selector')
    // selector should now be a sibling AFTER filters-body, not a child before it
    expect(body.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
```
**Test Case (Green)**: move the JSX until the spec above passes.

---

### FRONTEND-109-AC-04 [AUTO]
**Statement**: In `UseMySeriesPanel.tsx`, `<FilterProfileSelector>` shall render as the last child
of `filtersBody`, after the Year Min/Max (My Series) grid — not as the first child before the
Status fieldset as it does today.

**Test Case (Red)**:
```typescript
describe('FRONTEND-109-AC-04: Save appears after the filter fields in UseMySeriesPanel', () => {
  it('renders the profile selector after the year fields, not before Status', async () => {
    render(<UseMySeriesPanel {...defaultProps} />)
    const body = screen.getByTestId('specific-series-filters-body')
    const yearMax = screen.getByLabelText(/year max \(my series\)/i)
    const selector = await screen.findByTestId('filter-profile-selector')
    expect(
      yearMax.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(body.lastElementChild?.contains(selector) || body.contains(selector)).toBe(true)
  })
})
```
**Test Case (Green)**: move the JSX until the spec above passes.

---

### FRONTEND-109-AC-05 [MANUAL]
**Statement**: In `RecommendationFiltersBox.tsx`, `<FilterProfileSelector>` shall remain in its
current position (the last field-like element before `.filtersActions`' Reset Filters button) —
this is already correct, confirmed by reading the current file; no structural move is needed here,
only Requirement 1's fieldset/legend change applies in place.

**References**: existing placement, already correct (line ~320, immediately before
`.filtersActions`).

**Test Case (Manual)**: visual check in browser — Recommendations → any non-Custom-Search mode →
Filters box → confirm "Saved Filters" appears directly above Reset Filters, unchanged from before
this spec except for the new legend.

---

## Requirement 4: Rename replaces the name field, not alongside it

**User story**: As a user, when I click Rename, I want to see one editable field in the name's
place — not the old name still sitting there next to a new input.

### FRONTEND-109-AC-06 [AUTO]
**Statement**: In `FilterProfileAreaGroup.tsx`, while `renamingId === profile.id`, the `nameButton`
(the toggle-expand control showing `profile.name`) shall not render — the rename `<input>` shall
occupy that same position instead. The "Rename" trigger button shall also not render while that
row is being renamed (only the input, Save, and Cancel).

**References**: current `rowHeader` structure — `nameButton` renders unconditionally today, with
`renameGroup` appearing separately inside `rowActions`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-109-AC-06: rename replaces the name display', () => {
  it('hides the name button and Rename trigger while renaming', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockImplementation((area) =>
      Promise.resolve(area === 'MY_SERIES'
        ? [{ id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: {}, createdAt: '', updatedAt: '' }]
        : []))
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByLabelText(/rename weeknight/i))
    expect(screen.queryByRole('button', { name: 'Weeknight' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/rename weeknight/i)).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Weeknight')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: make `nameButton`/the Rename trigger conditional on `renamingId !==
profile.id` until the spec above passes. Existing `FRONTEND-108-AC-11` rename-persists coverage
must keep passing unmodified (rename still ends by calling `updateFilterProfile` and showing the
new name).

---

## Requirement 5: Look-and-feel alignment

**User story**: As a user, I want this feature to look like it belongs in the app, not bolted on.

### FRONTEND-109-AC-07 [AUTO]
**Statement**: `FilterProfileSelector.module.css`'s `.nameButton` shall match
`KeywordPicker.module.css`'s `.chip` class (`border-radius: 999px`, `background: var(--accent-bg)`,
`border: 1px solid var(--accent-border)`, `color: var(--text-h)`, matching padding/font-size
proportions), while keeping the `aria-pressed="true"` (selected) state visually distinguishable
from the unselected chip state.

**Test Case (Manual)**: visual check in browser — a saved-filter chip should look consistent with
genre/keyword/country chips elsewhere in the app (same pill shape, same accent colors), with the
currently-applied one visually distinct.

---

### FRONTEND-109-AC-08 [AUTO]
**Statement**: `SaveFilterProfileModal.module.css`'s `.dialog` shall use `border-radius: 0.75rem`
and `box-shadow: var(--shadow)`, and both `.overlay` and `.dialog` shall use a `z-index` greater
than `100` (e.g. `110`) — matching and exceeding `SearchFilter.module.css`'s established
`.overlay`/`.dialog` (Browse Keywords modal) convention, since this modal must be able to open on
top of an already-open sheet at `z-index: 100`.

**Test Case (Manual)**: visual check in browser — open the Save modal from within My Series' open
Filters sheet, confirm it renders fully on top with matching corner radius/shadow to the app's
other modals.

---

### FRONTEND-109-AC-09 [AUTO]
**Statement**: `FilterProfileAreaGroup.tsx`'s per-profile row shall compose the shared `surface.card`
primitive (`frontend/src/styles/surfaces.module.css`), matching `SeriesList.tsx`'s own row
(`${styles.row} ${surface.card}`); `.row`'s bespoke `border`/`border-radius` in
`FilterProfileAreaGroup.module.css` shall be removed (padding/layout rules stay).

**Test Case (Red)**:
```typescript
describe('FRONTEND-109-AC-09: row uses the shared card primitive', () => {
  it('applies the surface.card class to each profile row', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockImplementation((area) =>
      Promise.resolve(area === 'MY_SERIES'
        ? [{ id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: {}, createdAt: '', updatedAt: '' }]
        : []))
    const { container } = render(<FilterProfileManager />)
    await screen.findByText('Weeknight')
    const row = container.querySelector('li')
    expect(row?.className).toMatch(/card/)
  })
})
```
**Test Case (Green)**: import and compose `surface.card` until the spec above passes.

---

## Requirement 6: CTA tiering, chip toggle-off, and Use My Series' missing Clear button

**User story**: As a user, I want Save/Update to read as intentionally-tiered actions, I want
reclicking an already-applied preset to clear it (not just re-apply the same thing), and I want to
be able to clear Use My Series' own filters the same way I can on My Series and the Recommendation
Filters box.

### FRONTEND-109-AC-10 [AUTO]
**Statement**: `FilterProfileSelector` shall accept an optional `onClear?: () => void` prop.
Clicking the chip for the *currently-applied* profile (`selectedId === profile.id`) shall call
`onClear` (if provided) and clear `selectedId` back to `null`, instead of calling `onApply` again.
Clicking a *different* profile's chip is unaffected (still applies immediately, per
`FRONTEND-107-AC-04`).

**References**: `SearchFilter.tsx`'s new `handleClearForm` (resets the pending form only, no
`onClose`/parent notification — distinct from the existing `handleClear` behind the "Clear
Filters" button), `RecommendationFiltersBox.tsx`'s existing `handleResetFilters` (reused directly,
no new function needed), `UseMySeriesPanel.tsx`'s new `handleClearSpecificSeriesFilters` (shared
with `FRONTEND-109-AC-12` below — one function, two call sites, not duplicated).

**Test Case (Red)**:
```typescript
describe('FRONTEND-109-AC-10: reclicking an applied chip clears instead of re-applying', () => {
  it('calls onClear and deselects when the already-applied chip is clicked again', async () => {
    const onApply = vi.fn()
    const onClear = vi.fn()
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      { id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: { genres: ['Comedy'] }, createdAt: '', updatedAt: '' },
    ])
    render(<FilterProfileSelector area="MY_SERIES" currentCriteria={{}} onApply={onApply} onClear={onClear} />)
    const chip = await screen.findByText('Weeknight')
    fireEvent.click(chip)
    expect(onApply).toHaveBeenCalledTimes(1)
    fireEvent.click(chip)
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledTimes(1) // not called again
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })
})
```
**Test Case (Green)**: implement the toggle-off branch in `handleSelect` until the spec above
passes.

---

### FRONTEND-109-AC-11 [MANUAL]
**Statement**: In `FilterProfileSelector.tsx`, the "Save" button shall use `btn.btnPrimary` and the
"Update" button shall use `btn.btnSecondary` — matching this app's existing primary/secondary
tiering convention (e.g. Search vs. Clear Filters) rather than both looking like plain secondary
buttons.

**Test Case (Manual)**: visual check in browser — Save should read as the more prominent action;
Update (visible only once a profile is selected) should read as secondary.

---

### FRONTEND-109-AC-12 [AUTO]
**Statement**: `UseMySeriesPanel.tsx` shall gain a "Clear Filters" button (matching
`RecommendationFiltersBox.tsx`'s "Reset Filters" placement and styling — the shared
`.filtersActions`/`.resetButton` classes from `RecommendationControls.module.css`, positioned after
`FilterProfileSelector` within `filtersBody`) that resets all of the panel's own local filter/sort
fields (`specificSeriesGenreFilter`, `specificSeriesExcludeGenreFilter`,
`specificSeriesStatusFilter`, `specificSeriesKeywordsFilter`, `specificSeriesMinPersonalRating`,
`specificSeriesMinImdbRating`, `specificSeriesMinTmdbRating`, `specificSeriesYearMin`,
`specificSeriesYearMax`, `specificSeriesSortBy`, `specificSeriesSortDirection`) back to their
original defaults. The same function shall back both this button and `FRONTEND-109-AC-10`'s
`onClear` for this panel.

**Test Case (Red)**:
```typescript
describe('FRONTEND-109-AC-12: Use My Series gains a Clear Filters button', () => {
  it('resets all local filter/sort fields to defaults', () => {
    render(<UseMySeriesPanel {...defaultProps} />)
    fireEvent.change(screen.getByLabelText(/year min/i), { target: { value: '2020' } })
    fireEvent.click(screen.getByTestId('reset-specific-series-filters-btn'))
    expect(screen.getByLabelText(/year min/i)).toHaveValue(null)
  })
})
```
**Test Case (Green)**: implement `handleClearSpecificSeriesFilters` and wire the new button until
the spec above passes.

---

### FRONTEND-109-AC-13 [AUTO]
**Statement**: The "Save Filters" button shall be `disabled` (with a `title` tooltip explaining why)
whenever `describeFilterCriteria(area, currentCriteria)` returns zero entries — there's nothing
meaningful to save when every field is at its default. Reuses the same emptiness check
`suggestFilterProfileName` already relies on, rather than a second, possibly-diverging one.

**Test Case (Red)**:
```typescript
describe('FRONTEND-109-AC-13: Save is disabled when filters are empty', () => {
  it('disables Save Filters when currentCriteria has nothing set', () => {
    render(<FilterProfileSelector area="MY_SERIES" currentCriteria={{}} onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: /save filters/i })).toBeDisabled()
  })

  it('enables Save Filters once at least one field is set', () => {
    render(
      <FilterProfileSelector
        area="MY_SERIES"
        currentCriteria={{ genres: ['Comedy'] }}
        onApply={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /save filters/i })).toBeEnabled()
  })
})
```
**Test Case (Green)**: gate the button's `disabled` prop on `hasActiveCriteria` until the spec above
passes.

---

### FRONTEND-109-AC-14 [MANUAL]
**Statement**: The Save button shall be labeled "Save Filters" (not a bare "Save") and the Update
button "Update Filters", matching this app's existing "Clear Filters"/"Reset Filters" naming so
it's unambiguous what's being saved/updated. Both buttons shall use a new `.ctaButton` class in
`FilterProfileSelector.module.css` supplying `border-radius`/`padding`/`font-size` (missing
entirely until now — `buttons.module.css`'s tier classes deliberately carry only color/border/hover
per that file's own documented convention, and this component never paired them with a local
geometry class the way every other consumer in the app does, e.g. `.resetButton`). Confirmed via
live inspection this session (`getComputedStyle`): before this fix, Save rendered at `border-radius:
0px`, `padding: 1px 6px`, `height: 28px` versus the equivalent "Clear Filters" button's `border-
radius: 6.75px`, `padding: 9px 18px`, `height: 46px` — `.ctaButton` matches those reference values
exactly (`border-radius: 0.375rem`, `padding: 0.5rem 1rem`, `font-size: 0.9375rem`).

**Test Case (Manual)**: visual check in browser — Save/Update should now match the visual weight of
"Clear Filters"/"Reset Filters" elsewhere in the app (same rounding, padding, font size).

---

### FRONTEND-109-AC-15 [MANUAL]
**Statement**: `FilterProfileAreaGroup.tsx`'s six row-action buttons (rename's Save/Cancel, the
Rename trigger, delete's Confirm/Cancel, and the Delete trigger) shall use a new `.actionButton`
class in `FilterProfileAreaGroup.module.css` supplying `border-radius: 0.375rem`,
`padding: 0.375rem 0.75rem`, `font-size: 0.8125rem` — the same missing-geometry-class bug
`FRONTEND-109-AC-14` fixed in `FilterProfileSelector.tsx`, found on the Settings management side
of this feature by the same live-inspection method. `.actionButton` matches
`SeriesList.module.css`'s `.editButton`/`.deleteButton` exactly (the established "small in-row
action button" geometry), not `FilterProfileSelector.module.css`'s `.ctaButton` (a larger
standalone-CTA size) — these are row actions, not a primary form CTA.

**References**: `SeriesList.module.css`'s `.editButton`/`.deleteButton`/`.confirmDeleteButton`/
`.cancelDeleteButton` (the geometry this matches), `FRONTEND-109-AC-14` (the analogous fix in the
sibling component).

**Test Case (Manual)**: visual check in browser — Settings → Filter Profiles → confirm Rename and
Delete render as properly rounded, padded pill-ish buttons (not near-0-radius/near-0-padding), and
that Save/Cancel (rename) and Confirm/Cancel (delete) match the same geometry once triggered.
Confirmed via `getComputedStyle`: all buttons now report `border-radius: 6.75px`,
`padding: 6.75px 13.5px`, `font-size: 14.625px` (the 1.5x-DPI-scaled equivalent of the CSS values
above).

---

## Requirement 7: Criteria value validation

**User story**: As a user, I don't want to be able to save or apply a saved filter profile with an
out-of-range value (e.g. a negative Min TMDB Rating) — I want to be told what's wrong instead of
having every subsequent "Get Recommendations"/search request silently fail.

**Background**: added after this spec's original five/six requirements shipped, as a bug-fix
correction found via a live bug report — `SaveFilterProfileModal.tsx`'s `handleSave` only ever
validated the profile *name* (`validateFilterProfileName`), never the criteria values themselves.
A profile could be saved with e.g. `minTmdbRating: '-99'`, and `FilterProfileSelector.tsx`'s
`handleSelect` applied whatever criteria a saved profile carried unconditionally — writing a bad
value straight into the live filter state with no clamping (`NumberInput.tsx`'s `min`/`max` props
only gate its own +/- spinner buttons, not typed or programmatically-applied values). The backend's
`RecommendationCriteriaValidator` correctly rejects the resulting request with a 400, but nothing
told the user why or reset the bad field — the only fix a user found was leaving and re-entering
the page.

### FRONTEND-109-AC-16 [AUTO]
**Statement**: `SaveFilterProfileModal.tsx`'s `handleSave` shall, after the existing
`validateFilterProfileName` check passes, call the new `utils/filterCriteriaValidation.ts`'s
`validateFilterCriteria(area, criteria)`. On failure, it shall `setError` with the returned errors
joined by a space and return before calling `onSave` — the same early-return shape the name check
already uses.

**References**: `utils/filterCriteriaValidation.ts` (new shared validator, mirroring
`utils/describeFilterCriteria.ts`'s dispatch-per-area shape); `components/SaveFilterProfileModal.tsx`'s
existing `handleSave`/`validateFilterProfileName` early-return pattern.

**Test Case (Red)**:
```typescript
// src/components/SaveFilterProfileModal.test.tsx (addition)
it('does not call onSave and shows an error when criteria has an out-of-range value', () => {
  const onSave = vi.fn()
  render(
    <SaveFilterProfileModal
      area="RECOMMENDATION_FILTERS"
      criteria={{ minTmdbRating: '-99' }}
      existingNames={[]}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'New' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent(/min tmdb rating must be between 0 and 10/i)
})
```
**Test Case (Green)**: wire the `validateFilterCriteria` call into `handleSave` as described until
the spec above passes.

---

### FRONTEND-109-AC-17 [AUTO]
**Statement**: `FilterProfileSelector.tsx`'s `handleSelect` shall, before applying a newly-selected
profile (`setSelectedId(profile.id); onApply(profile.criteria)`), call
`validateFilterCriteria(area, profile.criteria)`. If invalid, it shall not call `onApply` or change
`selectedId`, and shall instead set the existing `actionError` state to a message naming the
profile and explaining it must be deleted and re-saved — guarding against a profile saved before
`FRONTEND-109-AC-16` existed (or otherwise already corrupted) from ever corrupting the live filter
state.

**References**: `components/FilterProfileSelector.tsx`'s existing `handleSelect`/`actionError`
state (already rendered via `{actionError && <span role="alert">...}`, reused rather than a new
error surface).

**Test Case (Red)**:
```typescript
// src/components/FilterProfileSelector.test.tsx (addition)
describe('FRONTEND-109-AC-17: an invalid saved profile is refused, not applied', () => {
  it('does not call onApply and shows an alert for an out-of-range saved value', async () => {
    const onApply = vi.fn()
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'RECOMMENDATION_FILTERS',
        name: 'Broken',
        criteria: { minTmdbRating: '-99' },
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(
      <FilterProfileSelector area="RECOMMENDATION_FILTERS" currentCriteria={{}} onApply={onApply} />,
    )
    fireEvent.click(await screen.findByText('Broken'))
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      /"Broken" has an invalid saved value and can't be applied/i,
    )
  })
})
```
**Test Case (Green)**: add the `validateFilterCriteria` guard to `handleSelect` as described until
the spec above passes.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `FRONTEND-108-AC-08`, superseded/removed by this spec's Requirement 2 | `frontend_spec_108_filter_profile_management_and_save_modal.md` |
| `FRONTEND-108-AC-12`, unaffected, remains the only delete path | `frontend_spec_108_filter_profile_management_and_save_modal.md`, `FilterProfileAreaGroup.tsx` |
| `<fieldset>`/`<legend>` pattern this spec's "Saved Filters" label follows | `UseMySeriesPanel.tsx`'s "Filter by Status" |
| `.chip` styling this spec's `.nameButton` fix matches | `KeywordPicker.module.css` |
| Modal `border-radius`/`box-shadow`/`z-index` convention this spec's save-modal fix matches | `SearchFilter.module.css`'s "Browse Keywords" modal, `.sheetOverlay` |
| `surface.card` primitive this spec's row fix composes | `frontend/src/styles/surfaces.module.css`, `SeriesList.tsx`, `frontend_spec_105` |
| `.filtersActions`/`.resetButton` classes this spec's new Use My Series "Clear Filters" button reuses | `RecommendationControls.module.css`, `RecommendationFiltersBox.tsx`'s "Reset Filters" |
| `.editButton`/`.deleteButton` geometry this spec's `.actionButton` fix matches | `SeriesList.module.css` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-109-AC-01: "Saved Filters" fieldset/legend, shown only when profiles exist
- [x] FRONTEND-109-AC-02: delete removed entirely from `FilterProfileSelector.tsx` (supersedes FRONTEND-108-AC-08)
- [x] FRONTEND-109-AC-03: Save moves to the end in `SearchFilter.tsx`
- [x] FRONTEND-109-AC-04: Save moves to the end in `UseMySeriesPanel.tsx`
- [x] FRONTEND-109-AC-05: Save position confirmed already correct in `RecommendationFiltersBox.tsx` [MANUAL — verified live in browser]
- [x] FRONTEND-109-AC-06: rename replaces the name display, doesn't sit alongside it
- [x] FRONTEND-109-AC-07: profile-name chips match `KeywordPicker`'s `.chip` styling [MANUAL — verified live in browser]
- [x] FRONTEND-109-AC-08: save modal matches the established radius/shadow/z-index convention [MANUAL — verified live in browser]
- [x] FRONTEND-109-AC-09: `FilterProfileAreaGroup` rows compose the shared `surface.card` primitive
- [x] FRONTEND-109-AC-10: reclicking an applied chip clears instead of re-applying [also verified live in browser]
- [x] FRONTEND-109-AC-11: Save is primary, Update is secondary [MANUAL — verified live in browser]
- [x] FRONTEND-109-AC-12: `UseMySeriesPanel` gains a "Clear Filters" button, shared with AC-10's onClear [also verified live in browser]
- [x] FRONTEND-109-AC-13: Save Filters disabled when criteria is empty [verified live in browser for both My Series and Use My Series, including the `describeFilterCriteria` sortBy/sortDirection default-comparison bug fix that was required to make this work for Use My Series]
- [x] FRONTEND-109-AC-14: "Save Filters"/"Update Filters" labels, `.ctaButton` geometry fix [MANUAL — root cause confirmed via getComputedStyle live inspection, fix verified live in browser: Save Filters now matches Clear Filters exactly (border-radius 6.75px, padding 9px 18px, font-size 16.875px) in both My Series and Use My Series]
- [x] FRONTEND-109-AC-15: `FilterProfileAreaGroup.tsx`'s Rename/Delete/Save/Cancel/Confirm buttons get the same `.actionButton` geometry fix as AC-14 [MANUAL — verified live in browser: all six buttons now match SeriesList's .editButton/.deleteButton geometry exactly (border-radius 6.75px, padding 6.75px 13.5px, font-size 14.625px)]
- [x] FRONTEND-109-AC-16: `SaveFilterProfileModal.tsx` blocks saving a profile whose criteria has an out-of-range value (bug-fix correction, `utils/filterCriteriaValidation.ts`)
- [x] FRONTEND-109-AC-17: `FilterProfileSelector.tsx` refuses to apply an already-saved out-of-range profile, surfacing an error instead of corrupting live filter state (bug-fix correction)
