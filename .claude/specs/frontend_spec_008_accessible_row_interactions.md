# Frontend Spec 008: Accessible Row Interactions

**Status**: Implemented. `src/components/SeriesList.tsx` (row `<li>` no longer carries `role`/`tabIndex`/`onClick`; title rendered as a real `<button>`; `handleRowKeyDown` simplified to Escape-only), `src/components/SeriesList.module.css` (`.title` restyled as a reset button; `cursor`/`:focus-visible` moved off `.row` onto `.title`), `src/components/SeriesList.test.tsx` and `src/App.test.tsx` (row-click tests retargeted to the title button; new `FRONTEND-008-AC-02` test asserting no `role`/`tabindex` on the row). `npm test` (150/150 passing), `npm run lint` (clean — required an `eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions` on the `<li>`, mirroring the existing precedent in `AddSeriesForm.tsx` for the same Escape-bubbling pattern), `npm run build` (clean) all verified on 2026-08-18. FRONTEND-008-AC-07 verified in a real browser: `@axe-core/react`'s console output before the fix showed "serious"×2 + "moderate"×1 (nested-interactive, list, aria-allowed-role); after restarting the dev server with the fix, only the pre-existing, unrelated "page should contain a level-one heading" finding remains.
**Priority**: P2 (accessibility correction — no new user-facing behavior)
**Depends on**: Frontend Spec 002 (`SeriesList`) ✅, Frontend Spec 004 (Edit/Delete, delete confirmation) ✅
**Frontend Stage**: 8 of N

---

## Overview

Frontend Spec 002 made each series row a clickable unit by putting `role="button"` and `tabIndex={0}` directly on the row's `<li>` (with a manual `onKeyDown` handling Enter/Space). At the time, that `<li>` had no other interactive content, so this was a workable (if non-native) way to make the whole row activatable.

Frontend Spec 004 then added real `<button>` elements (Edit, Delete, and the Confirm/Cancel delete-confirmation pair) *inside* that same `<li>`. Its own implementation notes explicitly flagged this as a known accessibility tradeoff: nesting interactive controls inside another element carrying `role="button"` is invalid, but fixing it was deferred with the note "revisit if axe-core flags it."

A real-browser verification pass (done while completing `frontend_spec_007_export_trigger.md`'s sweep) ran `@axe-core/react` (wired into `main.tsx` per Frontend Spec 002, Requirement 8.6) against a populated `SeriesList` and got three violations, all stemming from the same root cause:
- **serious** — "Interactive controls must not be nested" (the `<li role="button">` contains real `<button>`s)
- **serious** — "`<ul>`/`<ol>` must only directly contain `<li>`, `<script>`, or `<template>` elements" (`role="button"` overrides the `<li>`'s implicit `listitem` role, so from the accessibility tree's perspective the list's child is no longer a list item)
- **moderate** — "ARIA role should be appropriate for the element" (same root cause)

This spec fixes the root cause rather than the symptoms: the row's `<li>` stops being interactive itself, and the *title* becomes a real `<button>` instead. Edit/Delete/Confirm/Cancel are then siblings of an interactive element, not descendants of one, and the `<li>` keeps its implicit `listitem` role.

**Deliverables**:
- `src/components/SeriesList.tsx`: the row's `<li>` loses `role="button"`/`tabIndex`/its `onClick`; the title `<span>` becomes a `<button type="button">` that calls `onSeriesClick`; the row's `onKeyDown` is simplified to only handle `Escape` (native `<button>` semantics already give Enter/Space activation for free, so that branch is deleted, not replaced)
- `src/components/SeriesList.module.css`: `.title` restyled from a plain `<span>` to a reset, inline-styled `<button>`; `cursor: pointer`/`:focus-visible` move from `.row` (no longer focusable) to `.title` (now the actual focusable, clickable element)
- `src/components/SeriesList.test.tsx` and `src/App.test.tsx`: the handful of existing tests that clicked the row via `screen.getByTestId('series-row')` to trigger `onSeriesClick`/detail navigation are updated to click the title button instead — `data-testid="series-row"` stays on the `<li>` (nothing else depends on it moving), but the `<li>` itself no longer does anything on click

**Design decisions captured here**:
- **This supersedes Frontend Spec 002, Requirement 7's `role="button"`-on-the-row approach** (AC "The clickable element SHALL have `data-testid="series-row"` and `role="button"` (or be an `<a>` tag...)"). That old spec is not being rewritten in place (mirroring how Frontend Spec 005 documented its `seriesApi` fix as a superseding amendment rather than editing Frontend Spec 001 after the fact) — this spec's Requirement 1 is the current source of truth for the row's clickability contract.
- **No `<a>` tag either**, despite Frontend Spec 002's Requirement 7 floating that as an alternative "navigation target deferred to Stage 5." Now that Stage 5 (`SeriesDetail`, Frontend Spec 005) exists, the "navigation" is in-app state (`selectedSeriesId` in `App.tsx`), not a real URL — there's nothing to `href` to (no router, see Frontend Spec 005's own design decision on this). A `<button>` is the semantically correct control for "activates an action," which is what this actually is.
- **`data-testid="series-row"` stays on the `<li>`**, not the new title button. Nothing else about the row's identity changes — Edit/Delete/status/rating are still queried relative to the row in existing tests, and moving the testid would be churn with no benefit.
- **The row's whole-row hover highlight is kept** (`.row:hover` background change) even though only the title is actually clickable — this is a common, well-understood list-row affordance (e.g. table rows) and not misleading on its own. What's removed is `cursor: pointer` on the whole row (which *did* imply the whole row was clickable) and `:focus-visible` on the `<li>` (which can no longer receive focus directly).

---

## Requirements

### Requirement 1: Row Title as the Row's Interactive Element

**User Story:** As a user relying on assistive technology, I want the series list's structure to be valid (no nested interactive controls, no non-list-item children of a list), so that my screen reader announces it correctly.

**User Story:** As a user, I want clicking a series' title to still take me to its details, so that this correction doesn't change how the app behaves for me.

#### Acceptance Criteria

- **FRONTEND-008-AC-01** [AUTO]: Each series row's title shall be rendered as a `<button type="button">`, not a `<span>`.
- **FRONTEND-008-AC-02** [AUTO]: The `<li data-testid="series-row">` wrapping each row shall not carry a `role` or `tabIndex` attribute — it remains a plain list item, with the title button, status, rating, and action buttons as its contents. (Supersedes Frontend Spec 002, Requirement 7's AC putting `role="button"`/`data-testid="series-row"` together on the row wrapper.)
- **FRONTEND-008-AC-03** [AUTO]: Clicking the title button shall call the existing `onSeriesClick?: (id: string) => void` prop with the row's `id` (same external contract as before this spec).
- **FRONTEND-008-AC-04** [AUTO]: The title button shall not throw if `onSeriesClick` is not provided.
- **FRONTEND-008-AC-05** [AUTO]: Clicking the title button while that row's delete confirmation is showing shall not call `onSeriesClick` (same guard as before this spec, Frontend Spec 004).

---

### Requirement 2: Delete-Confirmation Keyboard Handling Unaffected

**User Story:** As a user, I want Escape to still cancel a pending delete confirmation, so that this correction doesn't remove an existing safety net.

#### Acceptance Criteria

- **FRONTEND-008-AC-06** [AUTO]: Pressing `Escape` while a row's delete confirmation is showing shall still cancel it, handled by the `<li>`'s `onKeyDown` via the native bubbling of the `keydown` event from whichever control (Confirm/Cancel button) currently has focus — no `tabIndex` on the `<li>` is required for this.

---

### Requirement 3: Accessibility Verification

**User Story:** As a developer, I want confirmation that this actually fixes the violations `axe-core` reported, so the fix isn't just theoretically correct.

#### Acceptance Criteria

- **FRONTEND-008-AC-07** [MANUAL]: A real-browser check with `@axe-core/react` shall report zero "nested-interactive", "list", or "aria-allowed-role" violations for a populated `SeriesList` (previously: two "serious" and one "moderate" violation, all with the same root cause — see Overview). Verified by loading the app with series present and inspecting the browser console; no CI check exists for this (same as the precedent set in Frontend Spec 002, Requirement 8.6 — a dev-console tool, not a lint rule).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `role="button"`/`tabIndex` row pattern being replaced | `src/components/SeriesList.tsx` (Frontend Spec 002, Requirement 7) |
| Edit/Delete/Confirm/Cancel buttons nested inside the row | `src/components/SeriesList.tsx` (Frontend Spec 004, Requirements 1–2) — its implementation notes flagged this tradeoff and the "revisit if axe-core flags it" condition this spec acts on |
| `@axe-core/react` dev-console verification precedent | Frontend Spec 002, Requirement 8, AC 8.6 |
| No router / no real URL to navigate to | Frontend Spec 005, design decisions |

---

## TDD Test Case Sketches

### `src/components/SeriesList.test.tsx` (amendments)

```typescript
describe('SH-007: Series row click', () => {
  it('should call onSeriesClick with series id when the title is clicked', async () => {
    const onSeriesClick = vi.fn()
    mockGetAll.mockResolvedValue([
      makeSeries({ id: 'abc-123', title: 'Clickable Show' }),
    ])
    render(<SeriesList onSeriesClick={onSeriesClick} />)

    const titleButton = await screen.findByRole('button', { name: 'Clickable Show' })
    fireEvent.click(titleButton)
    expect(onSeriesClick).toHaveBeenCalledWith('abc-123')
  })

  it('should not throw if onSeriesClick is not provided', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)

    const titleButton = await screen.findByRole('button', { name: 'Show' })
    fireEvent.click(titleButton)
  })
})
```

```typescript
describe('FRONTEND-008-AC-02: row is not itself interactive', () => {
  it('the row <li> has no role or tabIndex', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)
    const row = await screen.findByTestId('series-row')
    expect(row).not.toHaveAttribute('role')
    expect(row).not.toHaveAttribute('tabindex')
  })
})
```

```typescript
describe('FRONTEND-008-AC-05: title click guarded during delete confirmation', () => {
  it('does not call onSeriesClick when the title is clicked while confirming', async () => {
    const onSeriesClick = vi.fn()
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Show' })])
    render(<SeriesList onSeriesClick={onSeriesClick} />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))

    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(onSeriesClick).not.toHaveBeenCalled()
  })
})
```

Existing `FRONTEND-004-AC-06/07/08/09` Escape-cancels-confirmation test is unchanged — it dispatches `keyDown` on `screen.getByTestId('series-row')`, which still carries the testid and still has an `onKeyDown` handler.

### `src/App.test.tsx` (amendments)

```typescript
describe('FRONTEND-005-AC-25/26: navigating to detail', () => {
  it('renders SeriesDetail instead of SeriesList when the title is clicked', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    mockGetById.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    render(<App />)
    const titleButton = await screen.findByRole('button', { name: 'Show' })

    fireEvent.click(titleButton)
    await waitFor(() =>
      expect(screen.getByTestId('back-btn')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('series-row')).not.toBeInTheDocument()
  })
})
```

(The remaining two `FRONTEND-005-AC-27`/`AC-28/29` tests get the same `getByTestId('series-row')` → `getByRole('button', { name: ... })` substitution for their initial navigation-into-detail click.)

---

## Acceptance Criteria Summary

- [x] FRONTEND-008-AC-01: row title rendered as a real `<button>`
- [x] FRONTEND-008-AC-02: row `<li>` has no `role`/`tabIndex`
- [x] FRONTEND-008-AC-03: clicking title calls `onSeriesClick(id)`
- [x] FRONTEND-008-AC-04: no crash without `onSeriesClick`
- [x] FRONTEND-008-AC-05: title click guarded during delete confirmation
- [x] FRONTEND-008-AC-06: Escape still cancels delete confirmation
- [x] FRONTEND-008-AC-07: zero axe-core nested-interactive/list/aria-allowed-role violations, verified in a real browser
