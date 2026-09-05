# Frontend Spec 092: Persistent Navigation While Scrolling + Recommendations Modal Dismissal

**Status**: In progress
**Priority**: P3
**Depends on**: `frontend_spec_090_series_detail_layout_adjustments.md` (established this app's `position: sticky` pattern — see Design Decisions), `frontend_spec_071_my_series_filter_sheet.md` / `frontend_spec_079` (the existing click-outside-to-close precedent this spec's Requirement 2 reuses)
**Area**: Frontend (`App.tsx`, `App.module.css`, `components/RecommendationControls.tsx`, `components/RecommendationControls.module.css`, `components/SeriesRecommendationsModal.tsx`, `components/SeriesRecommendationsModal.module.css`)

## Overview

Four navigation/dismissal controls that force scrolling to reach, raised together after using the app with longer lists. First: the main site header (logo + My Series/Recommendations/Keywords/Settings) scrolls away with the page on every route — there's no way back to top-level nav without scrolling up. Second: My Series' status-tab row (All/Watching/Completed/Backlog/Dropped/Rewatch) has the same problem. Third: Recommendations' top-level mode tabs (Use My Series/Discover) do too — on a series with many recommendations, or a filter panel expanded, switching modes means scrolling back up first. Fourth, a related but structurally different case: `SeriesRecommendationsModal`'s "Done" button sits at the very bottom of the dialog, below the full recommendations list — on a series with many recommendations (the user's example: "Ludwig"), closing the modal means scrolling all the way down first.

## Design Decisions

- **Requirements 1–3 reuse this app's now-established `position: sticky` pattern** (`frontend_spec_090`/`frontend_spec_091`) rather than introducing a new one. All three are pure CSS changes to an already-existing element — no new DOM structure, no new component.
- **The main header and My Series' status-tab row are true DOM siblings, confirmed by tracing the render output.** `App.tsx` renders `<nav className={styles.nav}>` (the header) immediately before `<Routes>`; React Router's `<Routes>`/`<Route>` render their matched element in place with no wrapper DOM node, and `MySeriesView`'s returned fragment starts with `<nav className={styles.navLinks} aria-label="Status">` (the status tabs). So for the `/my-series*` routes, the rendered DOM is `<nav class="nav">…</nav><nav class="navLinks">…</nav>`, true siblings — not a deeply-nested relationship requiring a wrapper element to coordinate.
- **Stacking two sticky bars needs an explicit height/offset — a new `--header-height` CSS custom property is added to `App.module.css`, set on `:root` (or `.nav` itself) and referenced by both `.nav`'s own height and the second bar's `top`.** Without this, both `top: 0` would overlap once both are in their "stuck" state. This is the standard technique for stacked sticky headers and avoids a disconnected magic-number offset that would silently go stale if the header's padding/font-size ever changes.
- **The same `--header-height` variable is reused for Recommendations' mode tablist** (`RecommendationControls.module.css`'s `.tablist`, currently `border-bottom` only, no positioning) — it needs the identical offset since it sits below the same main header, just inside a different route's content (`.container`, `max-width: 960px; margin: 0 auto`). Sticky retains the tablist's normal horizontal layout box when stuck (it doesn't go full-width) — a minor, expected visual nuance of sticky positioning, not a bug to design around.
- **`SeriesRecommendationsModal` gets both requested fixes, not just one** — they solve different things and aren't redundant: click-outside-to-close is immediate and scroll-independent (the user never needs to know where "Done" currently is), while the sticky "Done" button remains for anyone who doesn't know/use the outside-click gesture (or is using it via keyboard/switch access, where "click outside" has no equivalent). Confirmed via reading `SearchFilter.tsx` (`FRONTEND-079-AC-03/04`) that click-outside-to-close is already an established, precedented pattern in this codebase (its sheet overlay's `onClick`, closing only `if (e.target === e.currentTarget)` so a click on any descendant is excluded) — Requirement 2 reuses that exact pattern, not a new one.
- **The nested `AddSeriesForm` (`pendingAdd` state, shown when marking a recommendation watched/adding it) is unaffected.** It renders its own full-viewport `position: fixed` overlay on top of `SeriesRecommendationsModal`'s, so a click while it's open hits *its* overlay first — `SeriesRecommendationsModal`'s click-outside handler on its own overlay never sees that click at all. No special-casing needed.
- **Requirement 1 and Requirement 3 (sticky "Done") are `[MANUAL]`** — jsdom (Vitest's test environment) doesn't run layout or provide a scrollable viewport, so `position: sticky`'s actual "stays pinned" behavior can't be asserted by a component test, per this project's established caveat (`frontend_spec_090`/`091`). Requirement 2 (click-outside-to-close) *is* `[AUTO]` — it's a DOM event/handler behavior, not a layout/positioning one, and is directly testable the same way `frontend_spec_079` already tests the identical pattern on `SearchFilter`.

## Requirements

### Requirement 1: Main header, My Series status tabs, and Recommendations mode tabs stay visible while scrolling

**User Story**: As a user scrolled down My Series, Recommendations, or any other page, I want the main header and that page's own top-level tab row still reachable without scrolling to the top.

#### FRONTEND-092-AC-01 [MANUAL]: Main header stays visible while scrolling
**Statement**: While the user has scrolled down any page other than `SeriesDetail`, the main site header (logo + My Series/Recommendations/Keywords/Settings) shall remain visible without scrolling to the top.

**Rationale**: The explicit request — today `.nav` scrolls away like any other content, with no way back to top-level navigation short of scrolling up.

**Verification**: Manual check in browser — open My Series with enough rows to exceed one viewport, scroll down, confirm the header stays pinned at the top. Not automatable, per this spec's jsdom/CSS caveat (Design Decisions).

**References**:
- Component: `App.tsx` (`<nav className={styles.nav}>`)
- CSS: `App.module.css`'s `.nav` (currently `background: var(--code-bg); border-bottom: 1px solid var(--border)`, no `position`)

**Test Case (Green)**: add `--header-height` as a CSS custom property (e.g. on `.nav` itself, or `:root`), give `.nav` `position: sticky; top: 0; z-index: 20;` (above `SeriesDetail`'s own sticky back button, `z-index: 10`, from `frontend_spec_090` — the two never coexist since the header isn't rendered while `SeriesDetail` is shown, but keeping a consistent stacking order avoids surprises if that ever changes) and an explicit `height`/`min-height` matching `--header-height`.

#### FRONTEND-092-AC-02 [MANUAL]: My Series status-tab row stays visible while scrolling, correctly stacked below the header
**Statement**: While the user has scrolled down a My Series page, the status-tab row (All/Watching/Completed/Backlog/Dropped/Rewatch) shall remain visible immediately below the main header, without scrolling to the top.

**Rationale**: The explicit request, for the second bar specifically named ("first set of tabs" — the status filter, not to be confused with Recommendations' own mode tabs in AC-03 below).

**Verification**: Manual check in browser — same method as AC-01, confirming both bars are visible together (header, then status tabs, then scrolled list content), not overlapping.

**References**:
- Component: `App.tsx` (`MySeriesView`'s `<nav className={styles.navLinks} aria-label="Status">`)
- CSS: `App.module.css`'s `.navLinks` (reused class name for two different nav elements — see AC-01's `.nav` above; this AC's target is the one inside `MySeriesView`, not the header's)

**Test Case (Green)**: give this specific `.navLinks` instance `position: sticky; top: var(--header-height); z-index: 19;` plus a `background` (e.g. `var(--bg)`, since unlike the header it has no background set today and would otherwise let scrolled content show through once stuck).

#### FRONTEND-092-AC-03 [MANUAL]: Recommendations' mode tabs stay visible while scrolling, correctly stacked below the header
**Statement**: While the user has scrolled down the Recommendations page, the Use My Series/Discover mode tablist shall remain visible immediately below the main header, without scrolling to the top.

**Rationale**: The explicit request — switching source mode after scrolling past a long filter panel or results list otherwise means scrolling back up first.

**Verification**: Manual check in browser — expand Recommendation Filters and/or load enough results to exceed one viewport, scroll down, confirm the header and mode tabs both stay visible together.

**References**:
- Component: `components/RecommendationControls.tsx` (`<div role="tablist" aria-label="Recommendation Source" className={styles.tablist}>`, inside `.sourceSelector` → `.container`)
- CSS: `components/RecommendationControls.module.css`'s `.tablist` (currently `border-bottom` only, no `position`)

**Test Case (Green)**: give `.tablist` `position: sticky; top: var(--header-height); z-index: 19;` and a `background` (e.g. `var(--bg)`), reusing the same `--header-height` custom property `App.module.css` defines for AC-01/AC-02 (imported/referenced across files the same way this codebase's other shared CSS custom properties — `--accent-bg`, `--social-bg`, etc. — already are, via global `:root` scope, not a CSS Modules import).

### Requirement 2: Recommendations modal — click outside to close

**User Story**: As a user viewing many recommendations for a series, I want to dismiss the modal without scrolling down to find "Done".

#### FRONTEND-092-AC-04 [AUTO]: Clicking the overlay backdrop closes the modal
**Statement**: When the area outside `SeriesRecommendationsModal`'s dialog box is clicked, `SeriesDetail` shall close the recommendations modal.

**Rationale**: Immediate, scroll-independent dismissal — reuses this codebase's existing click-outside-to-close convention (`SearchFilter.tsx`, `FRONTEND-079-AC-03`) rather than inventing a new one.

**References**:
- Component: `components/SeriesRecommendationsModal.tsx` (`.overlay` div, currently no `onClick`)
- Precedent: `components/SearchFilter.tsx` (`onClick={(e) => { if (e.target === e.currentTarget) onClose() }}`, `FRONTEND-079-AC-03/04`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-092-AC-04: clicking the overlay backdrop closes the modal', () => {
  it('closes the recommendations modal when the backdrop is clicked', async () => {
    mockGetById.mockResolvedValue(makeSeries({ title: 'Ludwig' }))
    mockGetRecommendations.mockResolvedValue([])
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    fireEvent.click(await screen.findByTestId('recommendations-btn'))
    const dialog = await screen.findByRole('dialog', { name: /recommendations for ludwig/i })

    fireEvent.click(dialog.parentElement as HTMLElement)

    expect(
      screen.queryByRole('dialog', { name: /recommendations for ludwig/i }),
    ).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `onClick={(e) => { if (e.target === e.currentTarget) onClose() }}` to `.overlay` in `SeriesRecommendationsModal.tsx`, mirroring `SearchFilter.tsx`'s exact pattern.

#### FRONTEND-092-AC-05 [AUTO]: Clicking inside the dialog does not close the modal
**Statement**: When any element inside `SeriesRecommendationsModal`'s dialog box is clicked, `SeriesDetail` shall not close the recommendations modal.

**Rationale**: Regression guard — the `e.target === e.currentTarget` check must actually exclude clicks on descendants, the same guard `frontend_spec_079`'s equivalent test (`FRONTEND-079-AC-04`) verifies for `SearchFilter`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-092-AC-05: clicking inside the dialog does not close the modal', () => {
  it('keeps the modal open when its heading is clicked', async () => {
    mockGetById.mockResolvedValue(makeSeries({ title: 'Ludwig' }))
    mockGetRecommendations.mockResolvedValue([])
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    fireEvent.click(await screen.findByTestId('recommendations-btn'))
    await screen.findByRole('dialog', { name: /recommendations for ludwig/i })

    fireEvent.click(screen.getByText('Recommendations for Ludwig'))

    expect(
      screen.getByRole('dialog', { name: /recommendations for ludwig/i }),
    ).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: covered by the same `e.target === e.currentTarget` guard as AC-04 — a click on the heading (or any other descendant) reports that descendant as `e.target`, never the overlay itself.

### Requirement 3: Recommendations modal — persistent "Done" button

**User Story**: As a user viewing many recommendations for a series, I want "Done" reachable without scrolling to the bottom, for anyone not using (or not able to use) the click-outside gesture.

#### FRONTEND-092-AC-06 [MANUAL]: "Done" button stays visible while scrolling the recommendations list
**Statement**: While the user has scrolled down a long recommendations list inside `SeriesRecommendationsModal`, the "Done" button shall remain visible without scrolling to the bottom.

**Rationale**: A persistent, discoverable close affordance independent of the click-outside gesture (keyboard/switch-access users, or anyone who doesn't know the gesture exists).

**Verification**: Manual check in browser — open Recommendations for a series with many results (e.g. Ludwig, the user's own example), scroll partway down the list, confirm "Done" is still visible. Not automatable, per this spec's jsdom/CSS caveat.

**References**:
- Component: `components/SeriesRecommendationsModal.tsx` (`.dialogActions`, currently at the end of `.dialog`'s normal flow)
- CSS: `components/SeriesRecommendationsModal.module.css` (`.overlay` — the actual scrolling container, `overflow-y: auto`; `.dialog` has no `max-height`/`overflow` of its own — identical shape to `AddSeriesForm`/`EditSeriesForm` before `frontend_spec_091`)
- Precedent: `frontend_spec_091_series_form_validation_and_persistent_cta.md` (`FRONTEND-091-AC-10`/`AC-13`, the identical sticky-footer fix already applied to `EditSeriesForm`/`AddSeriesForm`)

**Test Case (Green)**: give `.dialogActions` `position: sticky; bottom: 0; background: var(--bg);` plus enough top padding/border to visually separate it from the scrolled list above, mirroring `EditSeriesForm.module.css`'s/`AddSeriesForm.module.css`'s `.actions` treatment exactly.

## Cross-References

| Concept | Location |
|---|---|
| Established `position: sticky` pattern this spec reuses (no prior usage before it) | `frontend_spec_090_series_detail_layout_adjustments.md` |
| Sticky-footer treatment being mirrored for `.dialogActions` | `frontend_spec_091_series_form_validation_and_persistent_cta.md` (`EditSeriesForm.module.css`/`AddSeriesForm.module.css` `.actions`) |
| Existing click-outside-to-close precedent being reused | `components/SearchFilter.tsx`, `frontend_spec_079` (or wherever `FRONTEND-079-AC-03/04` was introduced) |
| `SeriesDetail`'s own sticky back button (`z-index: 10`), for the stacking-order note in AC-01 | `frontend_spec_090_series_detail_layout_adjustments.md` (`FRONTEND-090-AC-02`) |
| jsdom/CSS rendering limitation | Root `CLAUDE.md` ("Frontend: Vitest/jsdom can't validate real CSS rendering") |

## Acceptance Criteria Summary

Implemented, awaiting manual browser verification (see each AC's `[MANUAL]` tag and this spec's Design Decisions): AC-01, AC-02, AC-03, AC-06. Leave these unchecked until that verification confirms the sticky positioning actually renders/stacks correctly in a real browser — jsdom can't validate this.

- [ ] FRONTEND-092-AC-01: Main header stays visible while scrolling
- [ ] FRONTEND-092-AC-02: My Series status-tab row stays visible while scrolling, correctly stacked below the header
- [ ] FRONTEND-092-AC-03: Recommendations' mode tabs stay visible while scrolling, correctly stacked below the header
- [x] FRONTEND-092-AC-04: Clicking the overlay backdrop closes the modal
- [x] FRONTEND-092-AC-05: Clicking inside the dialog does not close the modal
- [ ] FRONTEND-092-AC-06: "Done" button stays visible while scrolling the recommendations list
