# Frontend Spec 051: Specific Series Picker — Bulk "Select All" / "Clear All"

**Status**: Implemented — `frontend/src/components/UseMySeriesPanel.tsx`, tests in
`frontend/src/components/RecommendationControls.test.tsx`
**Priority**: P3 (quality-of-life — the picker is fully functional today; this addresses friction
selecting/clearing many series one at a time as the tracked collection grows)
**Depends on**: Frontend Spec 035 (`frontend_spec_035_specific_series_picker.md`, owns
`specificSeriesCandidatePool`/`RecommendationControls.tsx`'s Specific Series picker and "Show all
series" modal) ✅, Frontend Spec 040 (`frontend_spec_040_recommendation_controls_apply_and_lock.md`,
owns the "Apply Filters" gate every Specific-Series-picker interaction — including this spec's two
new buttons — stays behind) ✅
**No backend spec or backend change is required.** `RecommendationQuery.seriesIds` and
`ControlsState.selectedSeriesIds` are both completely unchanged — this spec only adds two ways to
bulk-populate/clear client-side selection state that already exists.
**Area**: Frontend (`components/RecommendationControls.tsx`)

## Overview

Confirmed (2026-08-29): the Specific Series picker (`KeywordPicker` instance driving
`state.selectedSeriesIds`) only supports adding or removing one series at a time via its chip UI —
there's no way to select every currently-filtered series at once, or to clear the whole selection
in one action. The only existing bulk clear is an incidental side effect of switching source-mode
tabs (`handleTopLevelModeChange`/`handleDiscoverSubModeChange` reset `selectedSeriesIds: []`), not
a deliberate action available while staying in Specific Series mode.

## Design Decisions

- **"Select all" is scoped to the currently-computed `specificSeriesCandidatePool`** — the same
  genre-filtered, status-filtered, excluded-filtered (`frontend_spec_050`), sorted array already
  computed once per render and passed to both the inline picker and the "Show all series" modal
  (`FRONTEND-035-AC-05/13`) — not literally every series in the database, and not limited by the
  inline picker's own `SPECIFIC_SERIES_PICKER_LIMIT` display cap (that cap only bounds the
  *suggestion dropdown*, not the underlying filtered pool). Selecting "all" while a genre filter is
  active selects all series matching that filter, which is the only reading of "select all" that
  doesn't silently ignore the filters the user just set.
- **One set of controls, not duplicated per-view.** `state.selectedSeriesIds` is shared between the
  inline picker and the browse-all modal already — placing "Select all"/"Clear all" once, in the
  Specific Series panel (visible regardless of whether the modal is open), is sufficient; both
  views reflect the resulting selection immediately since they read the same state.
- **Neither button calls `onQueryChange` directly.** Every other Specific-Series-picker interaction
  (picking or removing an individual series) only updates pending `ControlsState`, gated behind the
  existing "Apply Filters" button (`frontend_spec_040`) — these two new buttons follow the exact
  same rule, for consistency and so a mis-click is cheap to undo before it's actually sent.
- **Both buttons disable when they'd be a no-op** — "Select all" when the candidate pool is empty,
  "Clear all" when nothing is currently selected — rather than rendering an always-enabled button
  that does nothing on click.

---

## Requirement 1: Bulk select/clear for the Specific Series picker

**User story**: As a user with a large tracked collection, I want to select every series matching
my current genre/status filter in one click, or clear my whole selection at once, instead of
clicking each chip individually.

### FRONTEND-051-AC-01 [AUTO]
**Statement**: A "Select all" button shall render in the Specific Series panel (alongside the
existing genre/status filter and sort controls). Clicking it shall set `state.selectedSeriesIds` to
every `id` in the currently-computed `specificSeriesCandidatePool`.

**References**: `RecommendationControls.tsx`'s `specificSeriesCandidatePool`,
`state.selectedSeriesIds`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-051-AC-01: Select all', () => {
  it('selects every series in the current candidate pool', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'A', status: 'COMPLETED' }),
      makeSeries({ id: '2', title: 'B', status: 'COMPLETED' }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    // switch to Use My Series > Specific Series mode
    fireEvent.click(await screen.findByRole('button', { name: /select all/i }))
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(mockOnQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ seriesIds: expect.arrayContaining(['1', '2']) }),
    )
  })
})
```
**Test Case (Green)**: add a "Select all" `<button type="button">` calling `updateState({
selectedSeriesIds: specificSeriesCandidatePool.map((s) => s.id) })`.

---

### FRONTEND-051-AC-02 [AUTO]
**Statement**: A "Clear all" button shall render alongside "Select all." Clicking it shall set
`state.selectedSeriesIds` to `[]`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-051-AC-02: Clear all', () => {
  it('clears the entire selection', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'A', status: 'COMPLETED' })])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /select all/i }))
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(mockOnQueryChange).toHaveBeenCalledWith(
      expect.not.objectContaining({ seriesIds: expect.anything() }),
    )
  })
})
```
**Test Case (Green)**: add a "Clear all" `<button type="button">` calling `updateState({
selectedSeriesIds: [] })`.

---

### FRONTEND-051-AC-03 [AUTO]
**Statement**: "Select all" shall be `disabled` when `specificSeriesCandidatePool` is empty.
"Clear all" shall be `disabled` when `state.selectedSeriesIds` is already empty.

**Test Case (Red)**:
```typescript
describe('FRONTEND-051-AC-03: disabled states', () => {
  it('disables Clear all when nothing is selected', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'A', status: 'COMPLETED' })])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    expect(await screen.findByRole('button', { name: /clear all/i })).toBeDisabled()
  })

  it('disables Select all when the filtered pool is empty', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'A', status: 'COMPLETED' })])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    // narrow the status filter to something matching nothing
    fireEvent.click(await screen.findByLabelText(/completed or watching/i))
    fireEvent.click(screen.getByLabelText(/^any status/i))
    // (drive specificSeriesStatusFilter/genre filter to a combination with zero matches)
    expect(screen.getByRole('button', { name: /select all/i })).toBeDisabled()
  })
})
```
**Test Case (Green)**: `disabled={specificSeriesCandidatePool.length === 0}` /
`disabled={state.selectedSeriesIds.length === 0}` on the respective buttons.

---

### FRONTEND-051-AC-04 [AUTO] (regression guard)
**Statement**: Neither "Select all" nor "Clear all" shall call `onQueryChange` directly — both only
update pending `ControlsState`, consistent with `frontend_spec_040`'s "Apply Filters" gate covering
every Specific-Series-picker interaction.

**Test Case (Red)**:
```typescript
describe('FRONTEND-051-AC-04: gated behind Apply Filters', () => {
  it('does not call onQueryChange until Apply Filters is clicked', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'A', status: 'COMPLETED' })])
    render(<RecommendationControls onQueryChange={mockOnQueryChange} />)
    mockOnQueryChange.mockClear() // clear the mount-time initial call (Fix 3)

    fireEvent.click(await screen.findByRole('button', { name: /select all/i }))
    expect(mockOnQueryChange).not.toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: falls out of AC-01's implementation directly — `updateState` only updates
local `ControlsState`; `onQueryChange` is only invoked from the existing Apply Filters click
handler.

---

## Cross-References

| This spec | Source |
|---|---|
| `specificSeriesCandidatePool`, the Specific Series picker, "Show all series" modal | `frontend_spec_035_specific_series_picker.md` |
| "Apply Filters" gate these two buttons stay behind | `frontend_spec_040_recommendation_controls_apply_and_lock.md` |
| Excluded-series filtering already applied to `specificSeriesCandidatePool` before this spec runs on top of it | `frontend_spec_050_exclude_from_recommendations_ui.md` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-051-AC-01: "Select all" selects every series in the current candidate pool
- [x] FRONTEND-051-AC-02: "Clear all" clears the entire selection
- [x] FRONTEND-051-AC-03: both buttons disable when they'd be a no-op
- [x] FRONTEND-051-AC-04: neither button bypasses the "Apply Filters" gate
