# Frontend Spec 045: EditSeriesForm Gains "Look Up" (with Overwrite Confirmation)

**Status**: Not started
**Priority**: P3 (parity gap — `AddSeriesForm` can re-fetch TMDB data, `EditSeriesForm` cannot)
**Depends on**: Frontend Spec 043 (`frontend_spec_043_confirm_discard_unsaved_changes.md`, the `ConfirmDialog`
component this spec reuses) — **implement after 043 ships.** Frontend Spec 022
(`frontend_spec_022_tmdb_primary_lookup.md`, owns the `seriesApi.searchTmdb`/`resolveTmdbCandidate` flow this
spec extends to a second form) ✅.
**Area**: Frontend (`AddSeriesForm.tsx` refactor, `EditSeriesForm.tsx`, new `hooks/useTmdbLookup.ts`) — no backend
change needed (reuses existing `searchTmdb`/`resolveTmdbCandidate` endpoints unchanged).

## Overview

`AddSeriesForm` has a "Look Up" button beside Title that searches TMDB, shows a candidate picker if there's more
than one match, and fills the form from whichever result resolves. `EditSeriesForm` has never had this —
confirmed by grep, zero references to lookup/`handleLookup` anywhere in the file. The gap exists because editing
was originally treated as a pure correction flow (per the original design intent), not a "re-fetch from scratch"
one — but that leaves no way to pull fresh TMDB data into an existing record (e.g. TMDB corrected a season count,
or the series just got a poster it didn't have when first added).

This spec ports the same Look Up UI into `EditSeriesForm`, with one deliberate addition: because
`EditSeriesForm`'s fields may already carry the user's own manual corrections (unlike `AddSeriesForm`, which
starts blank), resolving a candidate here doesn't apply immediately — it opens `frontend_spec_043`'s
`ConfirmDialog` first, warning that the fields below will be overwritten.

## Design Decisions

- **Extract a shared `hooks/useTmdbLookup.ts`** from `AddSeriesForm`'s existing lookup state/handlers
  (`lookingUp`, `lookupError`, `tmdbCandidates`, `resolvingTmdbCandidate`, `handleLookup`,
  `handleSelectTmdbCandidate`, `handleCancelTmdbCandidates`) rather than duplicating ~60 lines a second time —
  this is exactly the trigger point `frontend_conventions.md`'s own hooks guidance describes ("extract when a
  second component needs the same fetch/state logic, not before"). The hook takes a `title: string` and an
  `onResolved: (result: SeriesLookupResult) => void` callback; `AddSeriesForm` and `EditSeriesForm` each supply
  their own `onResolved` (immediate apply for Add, opening the confirm dialog for Edit — see below).
  `AddSeriesForm`'s own rendered behavior must be provably unchanged by this extraction (Requirement 1).
- **Resolving a candidate in `EditSeriesForm` always opens the overwrite-confirm dialog first — never applies
  immediately**, regardless of whether the resolve came from a single unambiguous match or from picking one of
  several candidates. This is deliberately simpler than trying to distinguish "risky" vs "safe" resolves; every
  resolve in an edit context can overwrite manually-corrected data, so every resolve gets the same guard.
- **The confirm dialog reuses `frontend_spec_043`'s `ConfirmDialog` component** (`message`, `confirmLabel`,
  `cancelLabel`, `onConfirm`, `onCancel`) — no new dialog component. Message: something like "Looking this up will
  overwrite the fields below with fresh TMDB data. Continue?"; `confirmLabel="Overwrite"`,
  `cancelLabel="Keep Current Values"`.
- **Confirming applies the exact same full-overwrite merge `AddSeriesForm.applyLookupResult` already does** — no
  new "only fill blanks" merge mode. One overwrite behavior across both forms is easier to reason about and
  document than two, and the confirm step (not a smarter merge) is what actually protects the user's manual
  edits — they see it coming and can decline.
- **Canceling ("Keep Current Values") discards the resolved result entirely** — the form reverts to exactly
  whatever it held before Look Up was clicked, including if the candidate list was showing (it's cleared too).
- **The Title-row Look Up button/candidate-picker markup mirrors `AddSeriesForm`'s exactly** (same
  `data-testid`s: `lookup-btn`, `lookup-tmdb-candidates`, `lookup-tmdb-candidate`,
  `lookup-tmdb-candidates-cancel`) — one visual/interaction pattern for "look this up," not a second one that
  happens to work slightly differently.

---

## Requirement 1: Extract `useTmdbLookup`, `AddSeriesForm` unaffected

**User story**: As a developer, I want the lookup logic in one shared place before a second form needs it, and I
need `AddSeriesForm`'s existing behavior to be provably unchanged by the extraction.

### FRONTEND-045-AC-01 [AUTO]
**Statement**: `AddSeriesForm`'s Look Up flow (single-match auto-resolve, multi-match candidate picker,
selecting a candidate, canceling the candidate list, lookup error display) shall behave identically after the
`useTmdbLookup` extraction.

**References**: `AddSeriesForm.test.tsx`'s existing lookup-flow tests — every one must still pass unmodified.

**Test Case (Red)**: no new test — this AC's verification *is* `AddSeriesForm.test.tsx`'s full existing suite
passing unchanged after the refactor. If any existing assertion needs to change to keep passing, the extraction
introduced a behavior change and needs revisiting.

**Test Case (Green)**: extract `useTmdbLookup(title, onResolved)` returning `{ lookingUp, lookupError,
tmdbCandidates, resolvingTmdbCandidate, handleLookup, handleSelectTmdbCandidate, handleCancelTmdbCandidates }`;
`AddSeriesForm` calls it with `onResolved: applyResolvedResult` (its existing immediate-apply function, unchanged).

---

## Requirement 2: `EditSeriesForm` renders the Look Up flow

**User story**: As a user correcting a series, I want to re-pull fresh TMDB data the same way I could when first
adding it.

### FRONTEND-045-AC-02 [AUTO]
**Statement**: `EditSeriesForm` shall render a "Look Up" button beside Title, disabled when the title is blank or
a lookup is already in progress — mirroring `AddSeriesForm`'s existing button exactly.

**Test Case (Red)**:
```typescript
describe('FRONTEND-045-AC-02: EditSeriesForm renders Look Up', () => {
  it('renders a Look Up button beside Title', () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING' } as Series
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    expect(screen.getByTestId('lookup-btn')).toBeInTheDocument()
    expect(screen.getByTestId('lookup-btn')).not.toBeDisabled()
  })
})
```
**Test Case (Green)**: render the same title-row markup `AddSeriesForm` has, backed by `useTmdbLookup`.

---

### FRONTEND-045-AC-03 [AUTO]
**Statement**: When Look Up resolves a single unambiguous match, the overwrite-confirm dialog shall open —
the form shall not be updated yet.

**Test Case (Red)**:
```typescript
describe('FRONTEND-045-AC-03: a single match opens the confirm dialog, not an immediate apply', () => {
  it('opens ConfirmDialog instead of applying immediately', async () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING', year: 2019 } as Series
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 42, title: 'Show', year: 2020 }])
    mockResolveTmdbCandidate.mockResolvedValue({ title: 'Show', year: 2020 })
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByTestId('lookup-btn'))

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/^year/i)).toHaveValue(2019) // unchanged until confirmed
  })
})
```
**Test Case (Green)**: `EditSeriesForm`'s `onResolved` callback stores the pending result and opens
`ConfirmDialog`, instead of applying it.

---

### FRONTEND-045-AC-04 [AUTO]
**Statement**: When multiple candidates are returned, the candidate list shall render exactly as
`AddSeriesForm`'s does; selecting one shall resolve it and then open the same overwrite-confirm dialog as AC-03.

**Test Case (Red)**:
```typescript
describe('FRONTEND-045-AC-04: multi-match candidates also gate through the confirm dialog', () => {
  it('opens the confirm dialog after picking a candidate', async () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING' } as Series
    mockSearchTmdb.mockResolvedValue([
      { tmdbId: 1, title: 'Show', year: 2019 },
      { tmdbId: 2, title: 'Show', year: 2020 },
    ])
    mockResolveTmdbCandidate.mockResolvedValue({ title: 'Show', year: 2020 })
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByTestId('lookup-btn'))
    fireEvent.click(await screen.findAllByTestId('lookup-tmdb-candidate').then((els) => els[1]))

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `handleSelectTmdbCandidate` (from the shared hook) still calls the same `onResolved`
callback AC-03 wires up.

---

### FRONTEND-045-AC-05 [AUTO]
**Statement**: Confirming ("Overwrite") shall apply the resolved result to the form fields exactly as
`AddSeriesForm.applyLookupResult` does.

**Test Case (Red)**:
```typescript
describe('FRONTEND-045-AC-05: confirming applies the resolved result', () => {
  it('overwrites fields on Overwrite', async () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING', year: 2019 } as Series
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 42, title: 'Show', year: 2020 }])
    mockResolveTmdbCandidate.mockResolvedValue({ title: 'Show', year: 2020 })
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByTestId('lookup-btn'))
    fireEvent.click(await screen.findByRole('button', { name: /^overwrite$/i }))

    expect(screen.getByLabelText(/^year/i)).toHaveValue(2020)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `ConfirmDialog`'s `onConfirm` applies the pending resolved result via the same merge
`applyLookupResult` uses (shared or duplicated — small enough either way, but sharing it is preferable).

---

### FRONTEND-045-AC-06 [AUTO]
**Statement**: Canceling ("Keep Current Values") shall discard the resolved result entirely — the form remains
exactly as it was before Look Up was clicked.

**Test Case (Red)**:
```typescript
describe('FRONTEND-045-AC-06: cancelling discards the resolved result', () => {
  it('leaves the form unchanged on Keep Current Values', async () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING', year: 2019 } as Series
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 42, title: 'Show', year: 2020 }])
    mockResolveTmdbCandidate.mockResolvedValue({ title: 'Show', year: 2020 })
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByTestId('lookup-btn'))
    fireEvent.click(await screen.findByRole('button', { name: /keep current values/i }))

    expect(screen.getByLabelText(/^year/i)).toHaveValue(2019)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `ConfirmDialog`'s `onCancel` discards the pending result and closes the dialog, no field
mutation.

---

### FRONTEND-045-AC-07 [AUTO]
**Statement**: The confirm dialog's message shall clearly state that proceeding will overwrite the form's current
values with fresh TMDB data.

**Test Case (Red)**:
```typescript
describe('FRONTEND-045-AC-07: confirm dialog explains the overwrite', () => {
  it('names the overwrite in the dialog message', async () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING' } as Series
    mockSearchTmdb.mockResolvedValue([{ tmdbId: 42, title: 'Show', year: 2020 }])
    mockResolveTmdbCandidate.mockResolvedValue({ title: 'Show', year: 2020 })
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByTestId('lookup-btn'))

    expect(await screen.findByText(/overwrite/i)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: static message string passed to `ConfirmDialog`.

---

## Implementation Notes

- `useTmdbLookup`'s extraction is a refactor of `AddSeriesForm`, not a new feature there — no new AC needed on
  `AddSeriesForm`'s own behavior beyond AC-01's regression guard.
- `EditSeriesForm` needs a new `pendingLookupResult: SeriesLookupResult | null` state and a
  `showOverwriteConfirm: boolean` state (or collapse the two — a non-null pending result implies the dialog is
  open).

## Cross-References

| This spec | Source |
|---|---|
| `ConfirmDialog` component reused here | `frontend_spec_043_confirm_discard_unsaved_changes.md` — **implement that spec first** |
| `searchTmdb`/`resolveTmdbCandidate` flow and `applyLookupResult` merge being ported | `frontend_spec_022_tmdb_primary_lookup.md`, `AddSeriesForm.tsx` |
| Why `EditSeriesForm` never had Look Up until now | `.claude/ideas/future_ideas.md`, "EditSeriesForm has no Look Up button" (this spec resolves it) |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-045-AC-01: `AddSeriesForm`'s Look Up flow is unchanged after the `useTmdbLookup` extraction
- [ ] FRONTEND-045-AC-02: `EditSeriesForm` renders the Look Up button
- [ ] FRONTEND-045-AC-03: a single match opens the confirm dialog, doesn't apply immediately
- [ ] FRONTEND-045-AC-04: multi-match candidates also gate through the confirm dialog
- [ ] FRONTEND-045-AC-05: confirming applies the resolved result
- [ ] FRONTEND-045-AC-06: cancelling discards the resolved result
- [ ] FRONTEND-045-AC-07: the confirm dialog names the overwrite
