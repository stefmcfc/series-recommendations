# Frontend Spec 108: Filter Profile Management & Save Modal

**Status**: Implemented
**Priority**: P3 (UX revision to an already-shipped feature, closing a real gap)
**Depends on**: `series_spec_056_filter_profile_name_validation.md` (the 255-char bound this spec's
client-side check mirrors — already implemented and merged), `frontend_spec_107_filter_profile_ui.md`
(`FilterProfileSelector.tsx`, the three criteria types, `seriesApi`'s filter-profile methods)
**Area**: Frontend (`components/FilterProfileSelector.tsx`, new `components/
SaveFilterProfileModal.tsx`, new `components/FilterProfileManager.tsx`, `components/
SettingsPage.tsx`, `components/SettingsIcons.tsx`, new `utils/describeFilterCriteria.ts`, new
`utils/filterProfileValidation.ts`)

## Overview

Three real gaps found after using the shipped filter-profiles feature live:

1. **No way to manage saved profiles** outside the inline picker embedded in each filter view — no
   way to see what a profile actually contains, no way to rename one.
2. **`FilterProfileSelector.tsx`'s delete button has no confirmation** — it calls
   `seriesApi.deleteFilterProfile(id)` immediately on click. A real bug, not a style choice.
3. **The inline picker's name field is a bare always-visible `<input>`** — replaced here with a
   "Save" button opening a modal, pre-filled with a suggested name generated from the active
   filters.

## Design Decisions

- **No character restriction here is for security.** `series_spec_056` already established (and
  this spec's own validation mirrors) that SQL injection is structurally impossible for this table
  — `FilterProfileRepository` has zero raw/native SQL. The client-side checks added here exist so a
  user gets instant feedback instead of waiting on a round-trip, and so the UI never lets through
  something the backend will reject anyway (a line break that would visually break a list row) —
  data hygiene, not a security allowlist.
- **One shared criteria-description utility backs both the suggested name and the Settings
  "what does this contain" preview** — not two parallel formatters. `describeFilterCriteria(area,
  criteria)` produces ordered `{label, value}` entries; `suggestFilterProfileName` calls it and
  joins the first few values.
- **One shared name-validation function backs both the save modal and the Settings rename
  control** — `validateFilterProfileName(name, existingNames, currentName?)`. The `currentName`
  param excludes a profile's own unchanged name from the duplicate check (renaming to yourself
  isn't a conflict).
- **Delete confirmation mirrors `SeriesList.tsx`'s established inline two-step pattern exactly** —
  a per-item `confirmingDeleteId` state, Delete → Confirm/Cancel row swap, Escape cancels. Not a
  modal, not `window.confirm()` — this app has one delete-confirmation idiom and this spec doesn't
  invent a second one. `seriesApi.deleteFilterProfile` is called directly with equivalent local
  start/success/error handling — `utils/deleteSeries.ts`'s `submitDelete` helper is typed around
  series deletion specifically and doesn't fit this domain, so the UX pattern is mirrored, not the
  helper function itself.
- **`SaveFilterProfileModal` is the first "single text input + confirm" modal in this app** — shell
  weight matches `SearchFilter.tsx`'s existing "Browse Keywords" modal (`.overlay` > `.dialog[role=
  dialog][aria-modal=true][aria-labelledby][onKeyDown={useEscapeToClose(...)}]`, an `<h2>` heading,
  a `.dialogActions` footer), not the much heavier `AddSeriesForm`/`EditSeriesForm`.
- **"Update" (overwrite the selected profile's criteria) stays a plain button, no modal** — it
  doesn't need a name, only "Save as new" does.
- **Settings section groups all three areas under one `SettingsSection`**, not three top-level
  sections — mirrors the existing "Recommendation Favourites" section, which already holds two
  `<KeywordPicker>` sub-blocks (Country + Language) side by side.
- **Settings is management-only, not a save entry point** — an empty-state area shows "No saved
  profiles yet" with no create action, since Settings has no `currentCriteria` to save against;
  saving only ever happens from a filter view via `SaveFilterProfileModal`.
- **Rename and delete are mutually exclusive per row** in the Settings manager — starting one
  clears the other's in-progress state.

---

## Requirement 1: Shared criteria-description utility

**User story**: As a user, I want to see a saved profile's actual contents, and have a save
suggestion that reflects what I'm about to save — both from the same underlying logic, not two
formatters that could drift apart.

### FRONTEND-108-AC-01 [AUTO]
**Statement**: `frontend/src/utils/describeFilterCriteria.ts` shall export `describeFilterCriteria
(area: FilterProfileArea, criteria: unknown): CriteriaDescriptionEntry[]` (where
`CriteriaDescriptionEntry = {label: string, value: string}`), dispatching per area to the correct
criteria shape (`MySeriesFilterCriteria`/`UseMySeriesFilterCriteria`/
`RecommendationFiltersCriteria` from `types/filterProfile.ts`) and producing one entry per
non-empty/non-default field only — an unset field produces no entry.

**References**: the three criteria interfaces (`types/filterProfile.ts`); `formatCountryNames`
(`utils/countryName.ts`) reused for Area C's `countriesSelected`; `LANGUAGE_OPTIONS` (exported from
`RecommendationControls.tsx`) reused via `.find(o => o.id === code)?.label` for Area C's
`language`. New local label maps in this file (no existing helpers cover these): status filter
labels (`{any: 'Any Status', completedOnly: 'Completed Only', completedOrWatching: 'Completed or
Watching'}`, matching `UseMySeriesPanel.tsx`'s existing radio-group text exactly) and sort-by/
sort-direction labels (new, no existing precedent — pick readable labels for each of
`dateAdded`/`personalRating`/`title`/`year`/`imdbRating`/`tmdbRating` and `asc`/`desc`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-108-AC-01: describeFilterCriteria', () => {
  it('produces one entry per non-empty field for Area A', () => {
    const entries = describeFilterCriteria('MY_SERIES', {
      genres: ['Comedy'], yearMin: 2020,
    } satisfies Partial<MySeriesFilterCriteria>)
    expect(entries).toEqual(expect.arrayContaining([
      { label: 'Genres', value: 'Comedy' },
      { label: 'Year (from)', value: '2020' },
    ]))
  })

  it('omits entries for unset fields', () => {
    const entries = describeFilterCriteria('MY_SERIES', {})
    expect(entries).toHaveLength(0)
  })

  it('resolves country codes to names for Area C', () => {
    const entries = describeFilterCriteria('RECOMMENDATION_FILTERS', {
      countriesSelected: ['US', 'GB'],
    } as RecommendationFiltersCriteria)
    expect(entries.find(e => e.label === 'Countries')?.value).toMatch(/United States/)
  })

  it('resolves the status filter label for Area B', () => {
    const entries = describeFilterCriteria('USE_MY_SERIES', {
      statusFilter: 'completedOnly',
    } as Partial<UseMySeriesFilterCriteria>)
    expect(entries.find(e => e.label === 'Status')?.value).toBe('Completed Only')
  })
})
```
**Test Case (Green)**: implement the three dispatched describers until the spec above passes.

---

### FRONTEND-108-AC-02 [AUTO]
**Superseded (2026-09-12) by `frontend_spec_125_filter_profile_name_labels.md`**: this AC's
"not `label: value` pairs" behavior turned out to produce meaningless names for all-numeric
criteria (e.g. "5, 4, 8" for an Analysis profile) — `frontend_spec_125` labels bare-numeric
entries (`"Series Count 5"`) while leaving self-describing string values exactly as described
below, unchanged.

**Statement**: The same file shall export `suggestFilterProfileName(area, criteria): string`,
calling `describeFilterCriteria` internally and joining the first few entries' `value`s (not
`label: value` pairs) with `", "`, truncated to a sensible length with a `…` suffix when truncated;
when `describeFilterCriteria` returns zero entries, it shall return `"New Profile"`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-108-AC-02: suggestFilterProfileName', () => {
  it('joins the first few values', () => {
    expect(suggestFilterProfileName('MY_SERIES', { genres: ['Comedy'], yearMin: 2020 }))
      .toBe('Comedy, 2020')
  })

  it('falls back to "New Profile" when criteria is empty', () => {
    expect(suggestFilterProfileName('MY_SERIES', {})).toBe('New Profile')
  })

  it('truncates a long suggestion', () => {
    const long = suggestFilterProfileName('USE_MY_SERIES', {
      genreFilter: ['Comedy', 'Drama', 'Thriller', 'Documentary', 'Action'],
    } as Partial<UseMySeriesFilterCriteria>)
    expect(long.length).toBeLessThanOrEqual(63) // 60 + '…'
  })
})
```
**Test Case (Green)**: implement `suggestFilterProfileName` until the spec above passes.

---

## Requirement 2: Shared name validation

**User story**: As a user, I want instant feedback if I type an invalid or duplicate name, without
waiting on a network round-trip, and I want the same rule applied consistently everywhere I can
name or rename a profile.

### FRONTEND-108-AC-03 [AUTO]
**Statement**: `frontend/src/utils/filterProfileValidation.ts` shall export
`FILTER_PROFILE_NAME_MAX_LENGTH = 255` (mirroring `series_spec_056`'s bound) and
`validateFilterProfileName(name: string, existingNames: readonly string[], currentName?: string):
{valid: boolean, error: string | null}`, applying in order: (a) trim, then reject blank; (b) reject
length > 255; (c) reject if it contains `\r`/`\n`/`\t`; (d) reject an exact-match duplicate against
`existingNames`, excluding `currentName` when provided.

**References**: `series_spec_056`'s `@Size(max=255)`/`@Pattern(regexp="^[^\r\n\t]*$")` — this is
the client-side mirror of that exact bound.

**Test Case (Red)**:
```typescript
describe('FRONTEND-108-AC-03: validateFilterProfileName', () => {
  it('rejects blank (after trim)', () => {
    expect(validateFilterProfileName('   ', []).valid).toBe(false)
  })
  it('rejects over 255 characters', () => {
    expect(validateFilterProfileName('a'.repeat(256), []).valid).toBe(false)
  })
  it('accepts exactly 255 characters', () => {
    expect(validateFilterProfileName('a'.repeat(255), []).valid).toBe(true)
  })
  it('rejects a name containing a newline', () => {
    expect(validateFilterProfileName('Bad\nName', []).valid).toBe(false)
  })
  it('rejects a duplicate of an existing name', () => {
    expect(validateFilterProfileName('Weeknight', ['Weeknight']).valid).toBe(false)
  })
  it('does not reject renaming a profile to its own current name', () => {
    expect(validateFilterProfileName('Weeknight', ['Weeknight'], 'Weeknight').valid).toBe(true)
  })
})
```
**Test Case (Green)**: implement the four rules in order until the spec above passes.

---

## Requirement 3: `SaveFilterProfileModal`

**User story**: As a user, I want a clean "Save" action that opens a small modal, pre-filled with a
sensible suggested name, rather than a text box always sitting in the filter view.

### FRONTEND-108-AC-04 [AUTO]
**Statement**: A new `SaveFilterProfileModal` component (`frontend/src/components/
SaveFilterProfileModal.tsx`) shall accept `area`, `criteria: unknown`, `existingNames: readonly
string[]`, `onSave: (name: string) => Promise<void>`, `onClose: () => void`; on mount it shall
pre-fill its local name field via `suggestFilterProfileName(area, criteria)`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-108-AC-04: SaveFilterProfileModal pre-fills a suggested name', () => {
  it('shows the suggested name on open', () => {
    render(<SaveFilterProfileModal area="MY_SERIES" criteria={{ genres: ['Comedy'] }}
      existingNames={[]} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByLabelText(/profile name/i)).toHaveValue('Comedy')
  })
})
```
**Test Case (Green)**: wire the pre-fill until the spec above passes.

---

### FRONTEND-108-AC-05 [AUTO]
**Statement**: On submit, the modal shall run `validateFilterProfileName(name, existingNames)`
locally first; on failure it shall show the inline error and not call `onSave`. On success it shall
call `onSave(trimmedName)`; a rejected promise from `onSave` (a server-side `409`, e.g. a race
between two tabs) shall be caught and shown as the same duplicate-name message, not a generic
failure.

**Test Case (Red)**:
```typescript
describe('FRONTEND-108-AC-05: submit validates locally, handles a 409 from onSave', () => {
  it('does not call onSave when the name is a client-side duplicate', () => {
    const onSave = vi.fn()
    render(<SaveFilterProfileModal area="MY_SERIES" criteria={{}}
      existingNames={['Weeknight']} onSave={onSave} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Weeknight' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i)
  })

  it('shows a duplicate message when onSave rejects with a 409', async () => {
    const onSave = vi.fn().mockRejectedValue(Object.assign(new Error(), { status: 409 }))
    render(<SaveFilterProfileModal area="MY_SERIES" criteria={{}}
      existingNames={[]} onSave={onSave} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'New' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i)
  })
})
```
**Test Case (Green)**: implement the submit handler until the spec above passes.

---

### FRONTEND-108-AC-06 [AUTO]
**Statement**: The modal shall close without saving on Cancel or Escape (via `useEscapeToClose`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-108-AC-06: cancel/escape close without saving', () => {
  it('Cancel calls onClose, not onSave', () => {
    const onClose = vi.fn()
    const onSave = vi.fn()
    render(<SaveFilterProfileModal area="MY_SERIES" criteria={{}}
      existingNames={[]} onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: wire Cancel/Escape until the spec above passes.

---

## Requirement 4: `FilterProfileSelector` — Save modal + delete confirmation

**User story**: As a user, I want the inline picker's Save action to open the modal instead of
showing a bare input, and I want its Delete button to ask me to confirm first.

### FRONTEND-108-AC-07 [AUTO]
**Statement**: `FilterProfileSelector.tsx` shall remove the inline `name` `<input>` and "Save as
new" button, replacing them with a single "Save" button that opens `SaveFilterProfileModal`
(`existingNames={profiles.map(p => p.name)}`). On successful save, the returned profile shall be
appended to `profiles` and the modal closed. "Update" is unchanged.

**References**: current `FilterProfileSelector.tsx` (`name`/`saveError` state, `handleSaveAsNew`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-108-AC-07: Save opens the modal, not an inline input', () => {
  it('has no bare name input, and clicking Save opens the modal', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(<FilterProfileSelector area="MY_SERIES" currentCriteria={{}} onApply={vi.fn()} />)
    expect(screen.queryByLabelText(/profile name/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: implement the Save button/modal wiring until the spec above passes.

---

### FRONTEND-108-AC-08 [AUTO]
**Statement**: The delete button for each profile shall no longer delete immediately — clicking it
shall swap that row's actions to Confirm/Cancel (mirroring `SeriesList.tsx`'s
`confirmingDeleteId`/row-swap pattern exactly); only Confirm shall call
`seriesApi.deleteFilterProfile`. Cancel, or Escape while confirming, shall revert to the normal
row without deleting.

**References**: `SeriesList.tsx`'s `confirmingDeleteId`/`handleDeleteClick`/`handleConfirmDelete`/
`handleCancelDelete`/`handleRowKeyDown` pattern.

**Test Case (Red)**:
```typescript
describe('FRONTEND-108-AC-08: delete requires confirmation', () => {
  it('a single click on Delete does not delete', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      { id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: {}, createdAt: '', updatedAt: '' },
    ])
    const deleteSpy = vi.spyOn(seriesApi, 'deleteFilterProfile')
    render(<FilterProfileSelector area="MY_SERIES" currentCriteria={{}} onApply={vi.fn()} />)
    fireEvent.click(await screen.findByLabelText(/delete weeknight/i))
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument()
  })

  it('Confirm deletes, Cancel does not', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      { id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: {}, createdAt: '', updatedAt: '' },
    ])
    vi.spyOn(seriesApi, 'deleteFilterProfile').mockResolvedValue(undefined)
    render(<FilterProfileSelector area="MY_SERIES" currentCriteria={{}} onApply={vi.fn()} />)
    fireEvent.click(await screen.findByLabelText(/delete weeknight/i))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    await waitFor(() => expect(screen.queryByText('Weeknight')).not.toBeInTheDocument())
  })
})
```
**Test Case (Green)**: implement the two-step confirm/cancel until the spec above passes.

---

## Requirement 5: Settings "Filter Profiles" management section

**User story**: As a user, I want to see, expand, rename, and delete my saved profiles for each
area from one place in Settings, not just from inside each filter view.

### FRONTEND-108-AC-09 [AUTO]
**Statement**: `SettingsPage.tsx` shall render a new `<SettingsSection title="Filter Profiles" ...>`
containing a new `FilterProfileManager` component (`frontend/src/components/
FilterProfileManager.tsx`), which shall render three independent sub-groups, one per
`FilterProfileArea`, each fetching its own area's profiles via `seriesApi.listFilterProfiles` on
mount. An area with zero profiles shall show "No saved profiles yet" and no create action.

**References**: the "Recommendation Favourites" section's existing two-`KeywordPicker`
sub-grouping precedent; new icon in `SettingsIcons.tsx` matching `AppearanceIcon`/`RefreshIcon`'s
plain exported-function style.

**Test Case (Red)**:
```typescript
describe('FRONTEND-108-AC-09: three independent area groups', () => {
  it('renders all three areas and fetches each independently', () => {
    const listSpy = vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(<FilterProfileManager />)
    expect(listSpy).toHaveBeenCalledWith('MY_SERIES')
    expect(listSpy).toHaveBeenCalledWith('USE_MY_SERIES')
    expect(listSpy).toHaveBeenCalledWith('RECOMMENDATION_FILTERS')
  })

  it('shows an empty-state message for an area with no profiles', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([])
    render(<FilterProfileManager />)
    expect(await screen.findAllByText(/no saved profiles yet/i)).toHaveLength(3)
  })
})
```
**Test Case (Green)**: implement the three independent fetches + empty state until the spec above
passes.

---

### FRONTEND-108-AC-10 [AUTO]
**Statement**: Clicking a profile's name shall expand/collapse a readable summary of its criteria,
via `describeFilterCriteria(area, profile.criteria)`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-108-AC-10: expand reveals the criteria summary', () => {
  it('shows the readable criteria on expand', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockImplementation((area) =>
      Promise.resolve(area === 'MY_SERIES'
        ? [{ id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: { genres: ['Comedy'] }, createdAt: '', updatedAt: '' }]
        : []))
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByText('Weeknight'))
    expect(await screen.findByText(/Comedy/)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: implement expand/collapse + summary rendering until the spec above passes.

---

### FRONTEND-108-AC-11 [AUTO]
**Statement**: Each profile row shall have a rename control: clicking it swaps to a text input
(pre-filled with the current name) plus Save/Cancel; Save runs `validateFilterProfileName(newName,
areaProfileNames, profile.name)` and on success calls
`seriesApi.updateFilterProfile(profile.id, {name: trimmedName})`, updating the row in place; on
failure it shows the inline error and stays in rename mode.

**Test Case (Red)**:
```typescript
describe('FRONTEND-108-AC-11: rename validates and persists', () => {
  it('renames a profile via updateFilterProfile', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockImplementation((area) =>
      Promise.resolve(area === 'MY_SERIES'
        ? [{ id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: {}, createdAt: '', updatedAt: '' }]
        : []))
    const updateSpy = vi.spyOn(seriesApi, 'updateFilterProfile').mockResolvedValue({
      id: '1', area: 'MY_SERIES', name: 'Renamed', criteria: {}, createdAt: '', updatedAt: '',
    })
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByLabelText(/rename weeknight/i))
    fireEvent.change(screen.getByDisplayValue('Weeknight'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(updateSpy).toHaveBeenCalledWith('1', { name: 'Renamed' })
    expect(await screen.findByText('Renamed')).toBeInTheDocument()
  })

  it('renaming to itself is not rejected as a duplicate', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockImplementation((area) =>
      Promise.resolve(area === 'MY_SERIES'
        ? [{ id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: {}, createdAt: '', updatedAt: '' }]
        : []))
    const updateSpy = vi.spyOn(seriesApi, 'updateFilterProfile').mockResolvedValue({
      id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: {}, createdAt: '', updatedAt: '',
    })
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByLabelText(/rename weeknight/i))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(updateSpy).toHaveBeenCalledWith('1', { name: 'Weeknight' })
  })
})
```
**Test Case (Green)**: implement the rename control until the spec above passes.

---

### FRONTEND-108-AC-12 [AUTO]
**Statement**: Each profile row's delete control shall use the same two-step confirm/cancel pattern
as `FilterProfileSelector.tsx` (Requirement 4), tracked independently per area group. Starting a
rename on a row while its delete is being confirmed (or vice versa) shall cancel the other action.

**Test Case (Red)**:
```typescript
describe('FRONTEND-108-AC-12: delete confirm, and rename/delete are mutually exclusive', () => {
  it('starting rename cancels an in-progress delete confirmation on the same row', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockImplementation((area) =>
      Promise.resolve(area === 'MY_SERIES'
        ? [{ id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: {}, createdAt: '', updatedAt: '' }]
        : []))
    render(<FilterProfileManager />)
    fireEvent.click(await screen.findByLabelText(/delete weeknight/i))
    expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/rename weeknight/i))
    expect(screen.queryByTestId('confirm-delete-btn')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: implement the mutual-exclusion guard until the spec above passes.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| The 255-char bound this spec's client-side check mirrors | `series_spec_056_filter_profile_name_validation.md` |
| `FilterProfileSelector.tsx`, the three criteria types, `seriesApi`'s filter-profile methods this spec builds on | `frontend_spec_107_filter_profile_ui.md` |
| Modal shell precedent (`.overlay`/`.dialog`/`useEscapeToClose`) | `SearchFilter.tsx`'s "Browse Keywords" modal |
| Delete-confirmation pattern this spec mirrors exactly | `SeriesList.tsx` (`confirmingDeleteId`, row-swap, Escape-cancels) |
| "One section, multiple sub-groups" precedent for the new Settings section | `SettingsPage.tsx`'s "Recommendation Favourites" section |
| `formatCountryNames`/`LANGUAGE_OPTIONS` reused for readable criteria | `frontend/src/utils/countryName.ts`, `RecommendationControls.tsx` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-108-AC-01: `describeFilterCriteria` — one entry per non-empty field, per area
- [x] FRONTEND-108-AC-02: `suggestFilterProfileName` — joined/truncated, "New Profile" fallback
- [x] FRONTEND-108-AC-03: `validateFilterProfileName` — trim/blank, length, control chars, duplicate (with rename exclusion)
- [x] FRONTEND-108-AC-04: `SaveFilterProfileModal` pre-fills a suggested name
- [x] FRONTEND-108-AC-05: submit validates locally first; a 409 from `onSave` shown as duplicate
- [x] FRONTEND-108-AC-06: Cancel/Escape close without saving
- [x] FRONTEND-108-AC-07: `FilterProfileSelector`'s Save button opens the modal, no bare input
- [x] FRONTEND-108-AC-08: `FilterProfileSelector`'s delete requires Confirm; Cancel/Escape revert
- [x] FRONTEND-108-AC-09: Settings "Filter Profiles" section, three independent area groups, empty state
- [x] FRONTEND-108-AC-10: expand reveals the readable criteria summary
- [x] FRONTEND-108-AC-11: inline rename validates and persists via `updateFilterProfile`
- [x] FRONTEND-108-AC-12: Settings delete confirm; rename/delete mutually exclusive per row
