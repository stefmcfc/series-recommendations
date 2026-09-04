# Frontend Spec 043: Confirm Before Discarding Unsaved Changes (AddSeriesForm / EditSeriesForm)

**Status**: Complete
**Priority**: P3 (data-loss prevention — no reported incident, but a real gap: closing either form currently
discards typed input with zero warning)
**Depends on**: Frontend Spec 003 (`frontend_spec_003_add_series_form.md`, owns `AddSeriesForm`'s existing
`onCancel`/Escape wiring this spec gates) ✅, Frontend Spec 004 (`frontend_spec_004_edit_delete_series.md`, same
for `EditSeriesForm`) ✅
**Area**: Frontend (`AddSeriesForm.tsx`, `EditSeriesForm.tsx`, new `ConfirmDialog.tsx`, new
`utils/formDirtyCheck.ts`) — no backend change needed.

## Overview

Both `AddSeriesForm` and `EditSeriesForm` currently close immediately and silently discard all typed input the
moment Cancel is clicked or Escape is pressed — confirmed via reading both files: `onClick={onCancel}` and
`handleKeyDown`'s `if (event.key === 'Escape' && !submitting) onCancel()` both fire with no check of whether
anything was actually entered. This spec adds a confirmation step, but only when it matters: if the form is
unchanged from how it opened, Cancel/Escape still close it immediately (today's behavior, unaffected) — the
confirmation only appears when there's something to actually lose.

This introduces a small reusable `ConfirmDialog` component, deliberately generic (not built as a
one-off inside either form), since a second spec already queued after this one
(`frontend_spec_045_edit_series_lookup.md`) needs the identical "are you sure, this will overwrite/discard
something" pattern for a different action (Look Up overwriting manually-corrected fields) — building it generic
now avoids either duplicating it or awkwardly retrofitting a one-off version later.

## Design Decisions

- **Dirty check is a plain shallow comparison against a snapshot taken at mount.** Both forms already compute
  their initial `FormState` once (`initialFormState`/`buildInitialFormState` for Add, `toFormState(series)` for
  Edit) — this spec keeps a second, never-updated copy of that same value (`useState(() => ...)`, called once,
  ignored setter) as the comparison baseline. A new shared `utils/formDirtyCheck.ts` exports `isFormDirty<T
  extends Record<string, unknown>>(current: T, initial: T): boolean`, a flat key-by-key `!==` comparison — both
  `FormState` shapes are flat (strings/booleans/one enum), so no deep-equality library is needed.
- **`ConfirmDialog` is a new, generic, reusable component** (`components/ConfirmDialog.tsx` +
  `ConfirmDialog.module.css`): props `message: string`, `confirmLabel?: string` (default `"Discard"`),
  `cancelLabel?: string` (default `"Keep Editing"`), `onConfirm: () => void`, `onCancel: () => void`. Rendered as
  `role="alertdialog"` (not plain `role="dialog"`) — the more precise WAI-ARIA pattern for exactly this shape: a
  dialog interrupting the user to confirm or abort a destructive action, distinct from the two forms' own
  `role="dialog"` (which just presents a form, nothing to confirm).
- **The confirm dialog nests inside the form's existing overlay**, rendered as a second layer on top of the
  (still-mounted, unchanged) form dialog underneath — mirroring the existing nested-overlay precedent
  `RecommendationControls`' "Browse Series" modal already establishes for this codebase, not inventing a new
  layering approach.
- **Escape while the confirm dialog is open must not cascade to the outer form dialog.** Both dialogs are plain
  `<div role="..." onKeyDown={...}>` (not native `<dialog>`, matching this codebase's established reason for
  avoiding native `<dialog>` — jsdom's known gaps), so a bubbling Escape keypress would otherwise fire *both*
  handlers in one event. `ConfirmDialog`'s own `onKeyDown` calls `event.stopPropagation()` before treating Escape
  as "Keep Editing," so the outer form's Escape handler never also runs in the same keystroke.
- **No prompt when the form is untouched.** Clicking Cancel/pressing Escape on a form with zero changes closes it
  immediately — same as today, no behavior change for the common "opened it, changed my mind immediately" case.
- **Only the two forms' own `onCancel`/Escape paths are gated — not other ways a form might unmount** (e.g. a
  successful save, which already has its own distinct code path via `onSuccess`, untouched by this spec).

---

## Requirement 1: A reusable `ConfirmDialog` component

**User story**: As a developer, I want one shared confirmation-dialog component rather than building this UX
twice (once here, once for `frontend_spec_045`'s Look Up overwrite warning).

### FRONTEND-043-AC-01 [AUTO]
**Statement**: `ConfirmDialog` shall render its `message`, and two buttons labeled by `confirmLabel`/`cancelLabel`
(defaulting to "Discard"/"Keep Editing"), as `role="alertdialog"` with `aria-modal="true"` and
`aria-describedby` pointing at the message text.

**Test Case (Red)**:
```typescript
describe('FRONTEND-043-AC-01: ConfirmDialog renders message and actions', () => {
  it('renders as an alertdialog with default labels', () => {
    render(
      <ConfirmDialog message="Discard changes?" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAccessibleDescription('Discard changes?')
    expect(screen.getByRole('button', { name: /^discard$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /keep editing/i })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: implement `ConfirmDialog` with the described markup/ARIA wiring.

---

### FRONTEND-043-AC-02 [AUTO]
**Statement**: Clicking the confirm button shall call `onConfirm`; clicking the cancel button, or pressing
Escape (which shall also stop the keydown event from propagating further), shall call `onCancel`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-043-AC-02: ConfirmDialog button and Escape wiring', () => {
  it('calls onConfirm/onCancel appropriately, and Escape stops propagation', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const outerKeyDown = vi.fn()
    render(
      <div onKeyDown={outerKeyDown}>
        <ConfirmDialog message="Discard changes?" onConfirm={onConfirm} onCancel={onCancel} />
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }))
    expect(onConfirm).toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
    expect(outerKeyDown).not.toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: wire `onClick` handlers and an `onKeyDown` calling `event.stopPropagation()` before
`onCancel()` on Escape.

---

## Requirement 2: `AddSeriesForm` gates Cancel/Escape behind the confirm dialog when dirty

**User story**: As a user who's started filling in a new series, I want a warning before an accidental Cancel
click or Escape press throws away what I've typed.

### FRONTEND-043-AC-03 [AUTO]
**Statement**: When `AddSeriesForm` is dirty (any field differs from its initial state) and Cancel is clicked,
the confirm dialog shall open instead of `onCancel` being called immediately.

**Test Case (Red)**:
```typescript
describe('FRONTEND-043-AC-03: AddSeriesForm gates Cancel when dirty', () => {
  it('opens the confirm dialog instead of cancelling immediately', () => {
    const onCancel = vi.fn()
    render(<AddSeriesForm onCancel={onCancel} onSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'The Wire' } })
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: `handleCancelClick` checks `isFormDirty(form, initialForm)`; opens `ConfirmDialog` instead
of calling `onCancel` directly when true.

---

### FRONTEND-043-AC-04 [AUTO]
**Statement**: When `AddSeriesForm` is unchanged from its initial state, clicking Cancel shall call `onCancel`
immediately, with no confirm dialog — unchanged from today.

**Test Case (Red)**:
```typescript
describe('FRONTEND-043-AC-04: no prompt when untouched', () => {
  it('cancels immediately when nothing changed', () => {
    const onCancel = vi.fn()
    render(<AddSeriesForm onCancel={onCancel} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(onCancel).toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: the same dirty-check branch as AC-03, `false` path.

---

### FRONTEND-043-AC-05 [AUTO]
**Statement**: Escape shall follow the identical dirty/clean gating as Cancel (AC-03/AC-04) — opening the confirm
dialog when dirty, calling `onCancel` immediately when clean.

**Test Case (Red)**:
```typescript
describe('FRONTEND-043-AC-05: Escape mirrors Cancel gating', () => {
  it('opens the confirm dialog on Escape when dirty', () => {
    const onCancel = vi.fn()
    render(<AddSeriesForm onCancel={onCancel} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'The Wire' } })

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: `handleKeyDown`'s existing `if (event.key === 'Escape' && !submitting)` branch calls the
same gated handler AC-03 introduces, instead of `onCancel` directly.

---

### FRONTEND-043-AC-06 [AUTO]
**Statement**: In the confirm dialog, choosing "Discard" shall call the form's original `onCancel`; choosing
"Keep Editing" shall close the confirm dialog only, leaving the form (and all typed values) open and unchanged.

**Test Case (Red)**:
```typescript
describe('FRONTEND-043-AC-06: confirm dialog outcomes', () => {
  it('Discard calls onCancel; Keep Editing preserves the form', () => {
    const onCancel = vi.fn()
    render(<AddSeriesForm onCancel={onCancel} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'The Wire' } })
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    fireEvent.click(screen.getByRole('button', { name: /keep editing/i }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^title/i)).toHaveValue('The Wire')
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: `ConfirmDialog`'s `onConfirm={onCancel}` (the form's own prop), `onCancel={() =>
setShowDiscardConfirm(false)}`.

---

## Requirement 3: `EditSeriesForm` gates Cancel/Escape behind the confirm dialog when dirty

**User story**: As a user correcting a series' details, I want the same protection against accidentally losing
my edits.

### FRONTEND-043-AC-07 [AUTO]
**Statement**: When `EditSeriesForm` is dirty (any field differs from `toFormState(series)`, its initial state)
and Cancel is clicked, the confirm dialog shall open instead of `onCancel` being called immediately.

**Test Case (Red)**:
```typescript
describe('FRONTEND-043-AC-07: EditSeriesForm gates Cancel when dirty', () => {
  it('opens the confirm dialog instead of cancelling immediately', () => {
    const onCancel = vi.fn()
    const series = { id: '1', title: 'Show', status: 'WATCHING' } as Series
    render(<EditSeriesForm series={series} onCancel={onCancel} onSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Show (Edited)' } })
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: mirrors AC-03, against `EditSeriesForm`'s own `form`/`initialForm`.

---

### FRONTEND-043-AC-08 [AUTO]
**Statement**: When `EditSeriesForm` is unchanged from `toFormState(series)`, clicking Cancel shall call
`onCancel` immediately, with no confirm dialog.

**Test Case (Green)**: mirrors AC-04 for `EditSeriesForm`.

---

### FRONTEND-043-AC-09 [AUTO]
**Statement**: Escape in `EditSeriesForm` shall follow the identical dirty/clean gating as its Cancel button.

**Test Case (Green)**: mirrors AC-05 for `EditSeriesForm`.

---

### FRONTEND-043-AC-10 [AUTO]
**Statement**: In `EditSeriesForm`'s confirm dialog, "Discard" calls the original `onCancel`; "Keep Editing"
closes only the confirm dialog, leaving edits intact.

**Test Case (Green)**: mirrors AC-06 for `EditSeriesForm`.

---

## Implementation Notes

- `utils/formDirtyCheck.ts`'s `isFormDirty` is generic over any flat `Record<string, unknown>` — usable
  unmodified by both forms despite their different `FormState` shapes.
- Both forms gain one new `useState<boolean>` (`showDiscardConfirm`) and one new `useState(() => ...)` snapshot
  (`initialForm`, set once, setter never called again).
- No change to either form's `handleSubmit`/`onSuccess` path — only the discard path is affected.

## Cross-References

| This spec | Source |
|---|---|
| `AddSeriesForm`'s existing `onCancel`/Escape wiring being gated | `frontend_spec_003_add_series_form.md` |
| `EditSeriesForm`'s existing `onCancel`/Escape wiring being gated | `frontend_spec_004_edit_delete_series.md` |
| `RecommendationControls`' nested-overlay precedent this spec's dialog layering mirrors | `frontend_spec_035_specific_series_picker.md` ("Browse Series" modal) |
| `ConfirmDialog` reused a second time, for a different confirmation | `frontend_spec_045_edit_series_lookup.md` (write after this spec) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-043-AC-01: `ConfirmDialog` renders message and actions as an alertdialog
- [x] FRONTEND-043-AC-02: confirm/cancel button and Escape wiring, with propagation stopped
- [x] FRONTEND-043-AC-03: AddSeriesForm opens the confirm dialog on Cancel when dirty
- [x] FRONTEND-043-AC-04: AddSeriesForm cancels immediately when untouched
- [x] FRONTEND-043-AC-05: AddSeriesForm's Escape mirrors its Cancel gating
- [x] FRONTEND-043-AC-06: AddSeriesForm's confirm dialog outcomes (Discard/Keep Editing)
- [x] FRONTEND-043-AC-07: EditSeriesForm opens the confirm dialog on Cancel when dirty
- [x] FRONTEND-043-AC-08: EditSeriesForm cancels immediately when untouched
- [x] FRONTEND-043-AC-09: EditSeriesForm's Escape mirrors its Cancel gating
- [x] FRONTEND-043-AC-10: EditSeriesForm's confirm dialog outcomes (Discard/Keep Editing)
