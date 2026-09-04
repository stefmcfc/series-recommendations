# Frontend Spec 083: `useEscapeToClose` Hook

**Status**: Implemented — `hooks/useEscapeToClose.ts`, `hooks/useEscapeToClose.test.ts`, `components/AddSeriesForm.tsx`, `components/EditSeriesForm.tsx`, `components/GenreIncludeExcludePicker.tsx`, `components/RecommendationDetailModal.tsx`, `components/SearchFilter.tsx`, `components/SeriesRecommendationsModal.tsx`, `components/UseMySeriesPanel.tsx`
**Priority**: P4
**Depends on**: none
**Area**: Frontend (`hooks/useEscapeToClose.ts` (new), `components/AddSeriesForm.tsx`, `components/EditSeriesForm.tsx`, `components/GenreIncludeExcludePicker.tsx`, `components/RecommendationDetailModal.tsx`, `components/SearchFilter.tsx`, `components/SeriesRecommendationsModal.tsx`, `components/UseMySeriesPanel.tsx`)

## Overview

Nine hand-rolled dialogs across seven components each independently define the identical Escape-to-close handler:

```typescript
const handleXKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
  if (event.key === 'Escape') {
    <close action>
  }
}
```

wired via `onKeyDown={handleXKeyDown}` on the dialog root `<div role="dialog">`. This spec extracts the shared 4-line body into a `useEscapeToClose` hook (mirroring `hooks/useDebouncedValue.ts`'s existing location/shape/test convention — this app's only other hook), removing nine near-identical handler definitions in favor of one.

Found during a 2026-09-04 investigation into `.claude/SPEC_CANDIDATES.md`'s "Share filter/sort logic between `SeriesList`/`SearchFilter` and Use My Series" candidate — that candidate's original framing didn't hold up (no shareable surface exists across the Java/TypeScript boundary it described), but the investigation's broader sweep for other frontend duplication surfaced this as a genuine, low-risk extraction candidate worth its own spec.

## Design Decisions

- **`useEscapeToClose(onEscape: () => void)` returns a `(event: React.KeyboardEvent<HTMLDivElement>) => void` handler** — a direct drop-in replacement for each component's existing `handleXKeyDown`, requiring no change to the JSX (`onKeyDown={...}` still wires to whatever this returns).
- **Not a stateful hook** — no `useState`/`useEffect` inside; it exists as a hook (not a plain exported function) purely for consistent calling-convention with this app's other hook (`useDebouncedValue`), called unconditionally at the top of each component exactly like the handler definitions it replaces.
- **The `jsx-a11y/no-noninteractive-element-interactions` eslint-disable comment and `NOSONAR: typescript:S6819` comment stay at each JSX call site, unchanged.** These lint rules fire on the `<div onKeyDown={...}>` JSX itself, not on where the handler function is defined — extracting the handler body into a hook doesn't relocate or eliminate the need for these comments at each of the nine dialog roots. This spec removes the nine duplicated *handler function bodies*, not the nine lint-suppression comments.
- **The two guarded call sites (`AddSeriesForm`, `EditSeriesForm`) pass a guarded callback, not a second hook parameter.** Their existing handlers check `event.key === 'Escape' && !submitting` before closing — reproduced as `useEscapeToClose(() => { if (!submitting) onCancel() })` rather than adding an `enabled`/`disabled` option to the hook itself, keeping the hook's own API to one parameter for the seven unconditional call sites.
- **File location**: `frontend/src/hooks/useEscapeToClose.ts`, alongside `hooks/useDebouncedValue.ts` — same directory, same one-hook-per-file convention, same colocated `.test.ts` using `renderHook`/`act` from `@testing-library/react`.

## Requirements

### Requirement 1: `useEscapeToClose` hook

**User Story**: As a developer, I want one shared Escape-to-close handler instead of reimplementing the same four lines in every dialog.

#### FRONTEND-083-AC-01 [AUTO]: the returned handler calls `onEscape` when Escape is pressed
**Statement**: `useEscapeToClose(onEscape)` shall return a handler that calls `onEscape` when invoked with a `KeyboardEvent` whose `key` is `'Escape'`.

**Rationale**: Core behavior.

**References**:
- New file: `frontend/src/hooks/useEscapeToClose.ts`

**Test Case (Red)**:
```typescript
describe('FRONTEND-083-AC-01: calls onEscape when Escape is pressed', () => {
  it('invokes onEscape for an Escape keydown', () => {
    const onEscape = vi.fn()
    const { result } = renderHook(() => useEscapeToClose(onEscape))

    result.current({ key: 'Escape' } as React.KeyboardEvent<HTMLDivElement>)

    expect(onEscape).toHaveBeenCalledOnce()
  })
})
```

**Test Case (Green)**: `export function useEscapeToClose(onEscape: () => void) { return (event: React.KeyboardEvent<HTMLDivElement>) => { if (event.key === 'Escape') onEscape() } }`.

#### FRONTEND-083-AC-02 [AUTO]: the returned handler ignores every other key
**Statement**: `useEscapeToClose(onEscape)`'s returned handler shall not call `onEscape` for a `KeyboardEvent` whose `key` is anything other than `'Escape'`.

**Rationale**: Regression guard — every dialog's existing behavior only closes on Escape, never on another key.

**Test Case (Red)**:
```typescript
describe('FRONTEND-083-AC-02: ignores every other key', () => {
  it('does not invoke onEscape for a non-Escape keydown', () => {
    const onEscape = vi.fn()
    const { result } = renderHook(() => useEscapeToClose(onEscape))

    result.current({ key: 'Enter' } as React.KeyboardEvent<HTMLDivElement>)

    expect(onEscape).not.toHaveBeenCalled()
  })
})
```

**Test Case (Green)**: covered by the same `if (event.key === 'Escape')` guard as AC-01.

### Requirement 2: applied to the seven unconditional call sites

**User Story**: As a developer, I want every plain "Escape closes this dialog" instance using the same shared handler instead of its own copy.

#### FRONTEND-083-AC-03 [AUTO]: each unconditional dialog uses `useEscapeToClose` in place of its own handler
**Statement**: Each of the following shall replace its own `handleXKeyDown` definition with `useEscapeToClose(<equivalent close action>)`, with no change to the JSX `onKeyDown` binding or any other behavior:

| Component | Current handler (removed) | Close action passed to the hook |
|---|---|---|
| `GenreIncludeExcludePicker.tsx` | `handleDialogKeyDown` (line 102) | `() => setOpen(false)` |
| `RecommendationDetailModal.tsx` | `handleModalKeyDown` (line 84) | `onClose` |
| `SearchFilter.tsx` | `handleModalKeyDown` (line 162, "Browse all keywords" modal) | `() => setBrowseModalOpen(false)` |
| `SearchFilter.tsx` | `handleSheetKeyDown` (line 171, sheet root) | `onClose` |
| `SeriesRecommendationsModal.tsx` | `handleModalKeyDown` (line 64) | `onClose` |
| `UseMySeriesPanel.tsx` | `handleSpecificSeriesModalKeyDown` (line 116, "Browse Series" modal) | `() => setSpecificSeriesBrowseModalOpen(false)` |
| `UseMySeriesPanel.tsx` | `handleSpecificSeriesKeywordsModalKeyDown` (line 127, "Browse Keywords" modal) | `() => setSpecificSeriesKeywordsBrowseModalOpen(false)` |

**Rationale**: Core extraction — replaces seven duplicated handler bodies with one shared hook, one line each.

**References**: see table above for exact current line numbers per component.

**Test Case (Red)**: no new component-level tests needed — each component's *existing* Escape-to-close test (already covering this exact behavior per its own originating spec — `frontend_spec_063`/`frontend_spec_052`/`frontend_spec_071`/`frontend_spec_055`/`frontend_spec_035`/`frontend_spec_077` respectively) continues to assert the same outcome (pressing Escape closes the dialog) and must keep passing unmodified after the swap — this AC's test coverage is "the existing suite is still green," not new assertions.

**Test Case (Green)**: in each component, delete the local `handleXKeyDown` function and replace it with `const handleXKeyDown = useEscapeToClose(<action>)` (or inline the hook call directly into the `onKeyDown` prop if the component has no other reason to name the variable) — `React` import for the event type may become unnecessary in some files once the inline type annotation moves into the hook; check per file.

### Requirement 3: applied to the two guarded call sites

**User Story**: As a developer using `AddSeriesForm`/`EditSeriesForm`, I still want Escape to be ignored while a submission is in flight, now via the shared hook instead of a bespoke condition.

#### FRONTEND-083-AC-04 [AUTO]: `AddSeriesForm`/`EditSeriesForm` pass a guarded callback that respects `submitting`
**Statement**: `AddSeriesForm.tsx` and `EditSeriesForm.tsx` shall each replace their own `handleKeyDown` (which currently checks `event.key === 'Escape' && !submitting`) with `useEscapeToClose(() => { if (!submitting) onCancel() })`, preserving the existing "no close while submitting" behavior exactly.

**Rationale**: These two are the only call sites with an extra guard condition — confirming the hook's single-parameter API accommodates them via a guarded callback rather than needing its own `enabled` option.

**References**:
- `components/AddSeriesForm.tsx`, `handleKeyDown` (line 358), `frontend_spec_003.md` `FRONTEND-003-AC-08` (original Escape-to-dismiss behavior this must not regress)
- `components/EditSeriesForm.tsx`, `handleKeyDown` (line 206), `frontend_spec_004.md` `FRONTEND-004-AC-19` (same)

**Test Case (Red)**: no new tests needed — each form's existing "Escape does not close while submitting" test (from `frontend_spec_003`/`004` respectively) continues to assert the same outcome and must keep passing unmodified.

**Test Case (Green)**: `const handleKeyDown = useEscapeToClose(() => { if (!submitting) onCancel() })` in each file, replacing the existing handler definition.

## Cross-References

| Concept | Location |
|---|---|
| Existing hook this mirrors (location, shape, test convention) | `frontend/src/hooks/useDebouncedValue.ts`, `useDebouncedValue.test.ts` |
| Investigation that surfaced this extraction | `.claude/SPEC_CANDIDATES.md`, "Share filter/sort logic..." candidate, 2026-09-04 update |
| Lint comments staying in place, not removed | `jsx-a11y/no-noninteractive-element-interactions`, `NOSONAR: typescript:S6819`, at each of the nine JSX dialog roots |
| Guarded call sites' originating specs | `frontend_spec_003_add_series_form.md`, `frontend_spec_004_edit_delete_series.md` |

## Acceptance Criteria Summary

- [x] FRONTEND-083-AC-01: the returned handler calls `onEscape` when Escape is pressed
- [x] FRONTEND-083-AC-02: the returned handler ignores every other key
- [x] FRONTEND-083-AC-03: each unconditional dialog uses `useEscapeToClose` in place of its own handler
- [x] FRONTEND-083-AC-04: `AddSeriesForm`/`EditSeriesForm` pass a guarded callback that respects `submitting`
