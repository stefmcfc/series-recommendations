# Tooling Spec 006: Shared Rewatch-Toggle & Delete-Submission Helpers for `SeriesDetail`/`SeriesList`

**Status**: Not started
**Priority**: Low — a 2026-08-26 codebase survey rated this the weakest of the three flagged
maintenance items ("a lot of concerns in one file" rather than clear duplication); grounded
review below confirms two genuinely-shared control-flow patterns exist, narrower in scope than
the survey's original "extract `useSeriesRefresh`/`useRewatchToggle` hooks" framing.
**Depends on**: none — pure internal refactor of already-implemented components
**Area**: Frontend (`SeriesDetail.tsx`, `SeriesList.tsx`)

## Overview

`SeriesDetail.tsx` (642 lines) and `SeriesList.tsx` (599 lines) each carry independent state for
several concerns (refresh, rewatch toggle, delete-confirm, watch-provider check, sort/filter).
Direct comparison of both files' actual handler code (not the survey's speculation) shows:

- **Refresh is genuinely NOT shareable**: `SeriesDetail`'s refresh is a single on-demand
  `seriesApi.refresh(id)` call producing a diff summary; `SeriesList`'s is a bulk background job
  polled via `jobStatus`. These are different features, not duplicated code — correctly excluded
  from this spec.
- **Rewatch toggle IS a real, near-identical duplication**: both `handleRewatchToggle` bodies
  clear any prior error, apply an optimistic `flaggedForRewatch` flip, call
  `seriesApi.update(id, { flaggedForRewatch })`, and on failure revert the flip and set an error
  message from `ApiError` (or a generic fallback string) — identical control flow, differing only
  in whether the surrounding state is singular (`SeriesDetail`'s one `series`/`rewatchError`) or
  keyed by id (`SeriesList`'s `series[]`/`rewatchErrors: Record<string, string>`).
- **Delete submission IS a real, near-identical duplication**: both `handleConfirmDelete` bodies
  clear any prior error, set a `deleting` flag, call `seriesApi.delete(id)`, and on
  success/failure follow the identical `ApiError`-message-or-generic-fallback pattern — differing
  only in what happens after success (`SeriesDetail` calls its `onDeleted()` prop;
  `SeriesList` filters the item out of its local `series[]`) and how the confirm/cancel *open*
  state is shaped (`SeriesDetail`'s boolean `confirmingDelete` vs. `SeriesList`'s nullable
  `confirmingDeleteId`).
- **Poster-load-error tracking is NOT extracted by this spec**: it's a 1-3 line concern in each
  file (`SeriesDetail`'s single `posterError` boolean vs. `SeriesList`'s `posterErrorIds: Set<string>`)
  — too small a duplication surface, and too different in shape (single vs. per-id), to justify
  an abstraction. Left as-is, matching CLAUDE.md's guidance against inventing abstractions beyond
  what a task actually needs.
- **The confirm/cancel open-state itself is NOT extracted** — only the delete *submission* that
  follows confirmation is shared; `confirmingDelete`/`confirmingDeleteId`'s boolean-vs-nullable-id
  shapes are different enough, and small enough, that sharing them would add more indirection
  than the ~6 lines each currently costs.

## Design Decisions

- **Plain utility functions, not custom hooks.** Neither pattern needs `useEffect`/dependency-array
  lifecycle management — both are event-handler control flow (call an API, react to
  success/failure). A hook would imply React-specific state/lifecycle ownership neither pattern
  actually needs; a plain function taking caller-supplied callbacks is the more honest, minimal
  fix, and avoids the extra indirection of `useCallback`-wrapping call sites just to satisfy a
  hook's rules.
- **Callback-based, not state-owning.** Each helper takes small callbacks (`applyOptimistic`,
  `revert`, `onError`, etc.) that close over each component's own differently-shaped state,
  rather than the helper owning any state itself — this is what makes one function work for both
  the singular (`SeriesDetail`) and per-id (`SeriesList`) cases without a shared state shape.

---

## Requirement 1: Shared rewatch-toggle optimistic-update helper

**User story**: As a developer maintaining both series views, I want one implementation of
"optimistically flip the rewatch flag, revert and report an error on failure," so the two
existing call sites can't silently drift apart.

### TOOLING-006-AC-01 [AUTO]
**Statement**: A new `src/utils/rewatchToggle.ts` module shall export `toggleRewatchFlag(id:
string, nextValue: boolean, callbacks: { clearError: () => void; applyOptimistic: () => void;
revert: () => void; setError: (message: string) => void })`, which calls `clearError()` and
`applyOptimistic()` synchronously, then calls `seriesApi.update(id, { flaggedForRewatch:
nextValue })`; on rejection, calls `revert()` and `setError(message)` with the `ApiError`
message or `'An unexpected error occurred. Please try again.'` otherwise (identical to both
existing implementations).

**References**: `SeriesDetail.tsx`'s `handleRewatchToggle` (lines 224-246), `SeriesList.tsx`'s
`handleRewatchToggle` (lines 273-300) — the two duplicated bodies being extracted.

**Test Case (Red)**:
```typescript
// src/utils/rewatchToggle.test.ts
describe('TOOLING-006-AC-01: toggleRewatchFlag', () => {
  it('applies the optimistic update immediately, reverts and reports on failure', async () => {
    const clearError = vi.fn()
    const applyOptimistic = vi.fn()
    const revert = vi.fn()
    const setError = vi.fn()
    vi.spyOn(seriesApi, 'update').mockRejectedValue(new ApiError('failed to update', 500))

    toggleRewatchFlag('abc', true, { clearError, applyOptimistic, revert, setError })

    expect(clearError).toHaveBeenCalled()
    expect(applyOptimistic).toHaveBeenCalled()
    await waitFor(() => expect(revert).toHaveBeenCalled())
    expect(setError).toHaveBeenCalledWith('failed to update')
  })

  it('does not call revert/setError on success', async () => {
    const revert = vi.fn()
    const setError = vi.fn()
    vi.spyOn(seriesApi, 'update').mockResolvedValue(makeSeries())

    toggleRewatchFlag('abc', true, {
      clearError: vi.fn(),
      applyOptimistic: vi.fn(),
      revert,
      setError,
    })

    await waitFor(() => expect(seriesApi.update).toHaveBeenCalled())
    expect(revert).not.toHaveBeenCalled()
    expect(setError).not.toHaveBeenCalled()
  })
})
```

**Test Case (Green)**: extract the function; its body is today's duplicated control flow with the
state reads/writes replaced by the callback parameters.

---

### TOOLING-006-AC-02 [AUTO]
**Statement**: `SeriesDetail.tsx`'s `handleRewatchToggle` shall call `toggleRewatchFlag`,
supplying closures over its own singular `series`/`rewatchError` state. Every existing
`SeriesDetail.test.tsx` rewatch-toggle test shall pass unmodified.

**References**: `SeriesDetail.tsx`.

**Test Case (Red)**: none new — regression guard.
**Test Case (Green)**: run the existing `SeriesDetail.test.tsx` rewatch tests unmodified; all
stay green.

---

### TOOLING-006-AC-03 [AUTO]
**Statement**: `SeriesList.tsx`'s `handleRewatchToggle` shall call `toggleRewatchFlag`, supplying
closures over its own per-id `series[]`/`rewatchErrors` state. Every existing `SeriesList.test.tsx`
rewatch-toggle test shall pass unmodified.

**References**: `SeriesList.tsx`.

**Test Case (Red)**: none new — regression guard.
**Test Case (Green)**: run the existing `SeriesList.test.tsx` rewatch tests unmodified; all stay
green.

---

## Requirement 2: Shared delete-submission helper

**User story**: As a developer maintaining both series views, I want one implementation of "submit
a confirmed delete and report success/failure," so the two existing call sites can't silently
drift apart.

### TOOLING-006-AC-04 [AUTO]
**Statement**: A new `src/utils/deleteSeries.ts` module shall export `submitDelete(id: string,
callbacks: { onStart: () => void; onSuccess: () => void; onError: (message: string) => void })`,
which calls `onStart()`, then `seriesApi.delete(id)`; on success calls `onSuccess()`; on rejection
calls `onError(message)` with the `ApiError` message or `'An unexpected error occurred. Please
try again.'` otherwise (identical to both existing implementations).

**References**: `SeriesDetail.tsx`'s `handleConfirmDelete` (lines 159-178), `SeriesList.tsx`'s
`handleConfirmDelete` (lines 308-331) — the two duplicated bodies being extracted.

**Test Case (Red)**:
```typescript
// src/utils/deleteSeries.test.ts
describe('TOOLING-006-AC-04: submitDelete', () => {
  it('calls onStart, then onSuccess when the delete resolves', async () => {
    const onStart = vi.fn()
    const onSuccess = vi.fn()
    vi.spyOn(seriesApi, 'delete').mockResolvedValue(undefined)

    submitDelete('abc', { onStart, onSuccess, onError: vi.fn() })

    expect(onStart).toHaveBeenCalled()
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('calls onError with the ApiError message when the delete rejects', async () => {
    const onError = vi.fn()
    vi.spyOn(seriesApi, 'delete').mockRejectedValue(new ApiError('cannot delete', 409))

    submitDelete('abc', { onStart: vi.fn(), onSuccess: vi.fn(), onError })

    await waitFor(() => expect(onError).toHaveBeenCalledWith('cannot delete'))
  })
})
```

**Test Case (Green)**: extract the function; its body is today's duplicated control flow with the
state reads/writes replaced by the callback parameters. The confirm/cancel open-state
(`confirmingDelete`/`confirmingDeleteId`) and each form's distinct post-success action
(`onDeleted()` vs. local-list filtering) stay in each component, passed in as `onSuccess`.

---

### TOOLING-006-AC-05 [AUTO]
**Statement**: `SeriesDetail.tsx`'s `handleConfirmDelete` shall call `submitDelete`, keeping its
own `confirmingDelete`/`deleting`/`deleteError` state and `onDeleted()` callback local. Every
existing `SeriesDetail.test.tsx` delete test shall pass unmodified.

**References**: `SeriesDetail.tsx`.

**Test Case (Red)**: none new — regression guard.
**Test Case (Green)**: run the existing `SeriesDetail.test.tsx` delete tests unmodified; all stay
green.

---

### TOOLING-006-AC-06 [AUTO]
**Statement**: `SeriesList.tsx`'s `handleConfirmDelete` shall call `submitDelete`, keeping its own
`confirmingDeleteId`/`deleting`/`deleteError` state and local-list-filtering success handler
local. Every existing `SeriesList.test.tsx` delete test shall pass unmodified.

**References**: `SeriesList.tsx`.

**Test Case (Red)**: none new — regression guard.
**Test Case (Green)**: run the existing `SeriesList.test.tsx` delete tests unmodified; all stay
green.

---

## Cross-References

| This spec | Source |
|---|---|
| `SeriesDetail.tsx`'s rewatch toggle, delete flow | `frontend_spec_005_series_detail.md`, `frontend_spec_012_series_lifecycle_controls.md` (rewatch toggle) |
| `SeriesList.tsx`'s rewatch toggle, delete flow | `frontend_spec_002.md`, `frontend_spec_012_series_lifecycle_controls.md` (rewatch toggle) |
| `seriesApi.update`/`seriesApi.delete`, `ApiError` | `frontend/src/services/seriesApi.ts`, `frontend/src/types/api.ts` |

---

## Acceptance Criteria Summary

- [ ] TOOLING-006-AC-01: `toggleRewatchFlag` helper extracted to `rewatchToggle.ts`
- [ ] TOOLING-006-AC-02: `SeriesDetail` uses `toggleRewatchFlag`, existing tests unmodified
- [ ] TOOLING-006-AC-03: `SeriesList` uses `toggleRewatchFlag`, existing tests unmodified
- [ ] TOOLING-006-AC-04: `submitDelete` helper extracted to `deleteSeries.ts`
- [ ] TOOLING-006-AC-05: `SeriesDetail` uses `submitDelete`, existing tests unmodified
- [ ] TOOLING-006-AC-06: `SeriesList` uses `submitDelete`, existing tests unmodified
