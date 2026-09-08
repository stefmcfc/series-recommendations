# Frontend Spec 104: Sticky Action Bars — Recommendations Modal Footer Gap Fix & `SeriesDetail` Bottom Actions Bar

**Status**: Not started
**Priority**: P3
**Depends on**: `frontend_spec_090_series_detail_layout_adjustments.md` (established this app's `position: sticky` pattern and `SeriesDetail`'s existing sticky-top `.backButton`, which Requirement 3 mirrors), `frontend_spec_091_series_form_validation_and_persistent_cta.md` (the overlay-padding/dialog-margin sticky-footer-gap fix Requirement 1 restores parity with), `frontend_spec_092_persistent_navigation_and_modal_dismissal.md` (`SeriesRecommendationsModal`'s existing sticky `.dialogActions`, `FRONTEND-092-AC-06`, which Requirement 1 fixes; the main header's sticky-top `z-index`/`--header-height` tiering referenced for consistency in Requirement 3)
**Area**: Frontend (`components/SeriesRecommendationsModal.module.css`, `components/SeriesDetail.module.css`, `components/SeriesDetailActionsPanel.tsx`, and each affected file's tests)

## Overview

Two related but distinct sticky-footer/sticky-bar pieces of work, bundled into one spec because both concern the same CSS mechanism (`position: sticky`) and one directly informs the other. First, a real CSS bug: `SeriesRecommendationsModal`'s sticky "Done" footer leaves a visible ~2rem gap of dimmed backdrop between itself and the true bottom edge of the browser viewport, because its `.overlay`/`.dialog` never received the overlay-padding/dialog-margin correction that `frontend_spec_091` already applied to the structurally identical `EditSeriesForm`/`AddSeriesForm` sticky footers — this spec restores that parity. Second, a new feature: `SeriesDetail` already has a sticky **top** element (`.backButton`), but its main action row (Edit/Delete/Refresh/Recommendations, or Confirm/Cancel during delete confirmation) sits in normal document flow at the very bottom of a potentially long page. This spec adds a matching sticky **bottom** bar for that action row, mirroring the existing sticky-top convention, while deliberately keeping the adjacent last-refreshed/new-content informational text out of the sticky area (see Design Decisions).

## Design Decisions

- **Requirement 1 is a pure CSS restoration of an already-established pattern, not a new design.** `EditSeriesForm.module.css`/`AddSeriesForm.module.css`'s `.overlay` was corrected to `padding: 2rem 1rem 0;` (zero bottom padding) with `.dialog` gaining `margin-bottom: 2rem;`, documented as a "Correction (2026-09-07)" in `frontend_spec_091` (`FRONTEND-091-AC-10`/`AC-13`). Confirmed by reading the current files: `SeriesRecommendationsModal.module.css`'s `.overlay` still has the old, un-fixed `padding: 2rem 1rem;` (full bottom padding) and its `.dialog` has no `margin-bottom` at all — even though its own `.dialogActions` comment (added by `frontend_spec_092`, `FRONTEND-092-AC-06`) claims to mirror `EditSeriesForm`'s/`AddSeriesForm`'s treatment "exactly." Only the sticky-position/background half of that pattern was actually copied; the overlay-padding/dialog-margin half was missed, because `frontend_spec_092` was written referencing the *pre-correction* shape of `EditSeriesForm`/`AddSeriesForm`. Fixing it is a one-line-each CSS change with no JSX/behavior change.
- **`.actionsInfo` (last-refreshed text / new-content badge) is deliberately excluded from the sticky area.** Recommended default, stated explicitly per the open design question: only the button row becomes sticky, not the whole `.actions` block. This is the closest analogue to `.backButton` being a single sticky control, and keeps the sticky bar compact rather than permanently pinning secondary informational text to the screen.
- **`actionsInfo` must render *before* `actionsRow` in the DOM, not after (its current order).** This is the load-bearing consequence of the previous decision, and the reason Requirement 2 exists as its own requirement rather than being folded into Requirement 3. `position: sticky` still reserves an element's normal-flow box; anything that follows it in the DOM renders *below that flow position*, not below its stuck, on-screen position. If `actionsInfo` stayed after `actionsRow` (today's order), then once `actionsRow` becomes stuck to the viewport bottom, `actionsInfo` — the last element on the page — would render directly beneath `actionsRow`'s flow position, i.e. it would end up visually underneath/overlapped by the stuck bar once the page is scrolled to its true end, exactly the class of layout bug this spec is otherwise trying to avoid. Reordering so `actionsInfo` comes first makes `actionsRow` the last flow child of `actionsGroup` — the same shape every other sticky footer in this codebase already uses (`EditSeriesForm`'s/`AddSeriesForm`'s `.actions`, `SeriesRecommendationsModal`'s `.dialogActions` are each the final child of their scrolling container).
- **A single shared modifier class, `.actionsSticky`, is applied to whichever element is the actual sticky bar in each of `SeriesDetailActionsPanel`'s two render branches** — `actionsRow` in the normal (non-delete-confirmation) branch, and the outer `.actions` wrapper itself in the delete-confirmation branch (which has no `actionsRow`/`actionsInfo` split; it's just an error message plus Confirm/Cancel, the whole thing analogous to a button row). Both branches also carry a shared `data-testid="sticky-actions-bar"` on that same element — safe because the two branches are mutually exclusive (only one renders at a time), and it lets one test query work against either render path. This keeps the confirm-delete state visually consistent with the normal state (both keep their controls reachable while scrolled) without needing two independently-styled sticky treatments.
- **`z-index: 10`, reusing `.backButton`'s existing value**, rather than inventing a new tier. `.backButton` (top-sticky) and the new bar (bottom-sticky) never occupy the same screen region at any normal viewport height, so there is no real stacking conflict to resolve — reusing the value keeps this page's sticky elements on one consistent "this page's own controls" tier rather than introducing an arbitrary new number. This is unrelated to the main app header's `z-index: 20`/`19` tier (`App.module.css`), which never coexists with `SeriesDetail`'s own sticky elements anyway — the header isn't rendered while `SeriesDetail` is shown (confirmed by reading `App.tsx`: `.nav` renders only in the `!selectedSeriesId` branch).
- **No "overlay padding" analogue exists for Requirement 3**, unlike Requirement 1. `SeriesDetail` is a normal document-flow page, not a modal with an artificial `overflow-y: auto` container — the scrolling container is the real browser viewport/document, which has no equivalent padding to strip. `.actionsSticky` therefore only needs `position: sticky; bottom: 0;` plus a solid `background: var(--bg)` (so page content doesn't show through underneath it while scrolling — the same *class* of bug as Requirement 1, avoided here by construction rather than by a follow-up fix) and a `border-top: 1px solid var(--border)` for visual separation, mirroring the border treatment already used by every sticky-bottom element in this codebase (`.dialogActions`, `EditSeriesForm`'s/`AddSeriesForm`'s `.actions`) and the border-bottom equivalent already used by every sticky-top element (`App.module.css`'s `.nav`).
- **This is `[MANUAL]` for the actual visual "stays pinned"/"no gap" behavior, `[AUTO]` for everything else** — jsdom (Vitest's test environment) doesn't run layout or provide a scrollable viewport, so `position: sticky`'s real effect can't be asserted by a component test, per this project's established caveat (`frontend_spec_090`/`091`/`092`; also noted in root `CLAUDE.md`). The JSX reordering (Requirement 2) and which elements do/don't carry `.actionsSticky` (Requirement 3's AC-03/04/05) are ordinary DOM/class assertions and stay `[AUTO]`.

## Requirements

### Requirement 1: `SeriesRecommendationsModal`'s sticky "Done" footer reaches the true bottom of the viewport

**User Story**: As a user browsing recommendations for a series with many results, I want the sticky "Done" footer to sit flush against the bottom of my browser window, not leave a strip of dimmed backdrop visible beneath it.

#### FRONTEND-104-AC-01 [MANUAL]: No visible gap beneath the sticky "Done" footer
**Statement**: While the user has scrolled `SeriesRecommendationsModal`'s recommendations list to its end, the sticky "Done" footer (`.dialogActions`) shall reach the true bottom edge of the browser viewport, with no visible gap of dimmed backdrop beneath it.

**Rationale**: The user-reported symptom ("the background of the sticky area is black, but it's not quite at the bottom of the screen") — a straightforward drift from the already-established, already-fixed pattern in `frontend_spec_091`.

**Verification**: Manual check in browser — open Recommendations for a series with enough results to require scrolling (e.g. "Ludwig"), scroll the list to its end, and confirm via `getComputedStyle`/`getBoundingClientRect` that `.dialogActions`'s bottom edge coincides with `window.innerHeight` (zero gap), the same check already performed for `EditSeriesForm`/`AddSeriesForm` in `frontend_spec_091`'s Correction. Not automatable — jsdom doesn't run layout, per this project's established caveat.

**References**:
- CSS: `components/SeriesRecommendationsModal.module.css` — `.overlay` currently `padding: 2rem 1rem;`; `.dialog` currently has no `margin-bottom`
- Precedent: `frontend_spec_091_series_form_validation_and_persistent_cta.md`, Correction (2026-09-07) (`FRONTEND-091-AC-10`/`AC-13`) — the identical fix already applied to `EditSeriesForm.module.css`/`AddSeriesForm.module.css`

**Test Case (Green)**: change `SeriesRecommendationsModal.module.css`'s `.overlay` padding from `2rem 1rem;` to `2rem 1rem 0;` (zero bottom padding) and add `margin-bottom: 2rem;` to `.dialog`. No JSX/component-logic change — `.dialogActions`'s existing `position: sticky; bottom: 0; background: var(--bg);` is already correct and untouched.

### Requirement 2: Informational text renders before the button row

**User Story**: As a developer adding a sticky bottom bar in Requirement 3, I want `actionsInfo` to render before `actionsRow` in the DOM, so the sticky bar is the last flow child of its container and never visually collides with content that would otherwise render beneath it once stuck.

#### FRONTEND-104-AC-02 [AUTO]: `actionsInfo` precedes `actionsRow` in document order
**Statement**: Where `actionsInfo` content is present (`lastRefreshedAt` or `newContentDetectedAt` is non-null), the `SeriesDetailActionsPanel` shall render `actionsInfo` before `actionsRow` within `actionsGroup`.

**Rationale**: Load-bearing precondition for Requirement 3 — see Design Decisions for why the reverse order would cause `actionsInfo` to render underneath the stuck sticky bar once scrolled to the page's end.

**References**:
- Component: `components/SeriesDetailActionsPanel.tsx` (currently `actionsRow` then `actionsInfo`, in that order, inside `actionsGroup`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-104-AC-02: actionsInfo precedes actionsRow', () => {
  it('renders actionsInfo before actionsRow when last-refreshed info is present', () => {
    render(
      <SeriesDetailActionsPanel
        {...baseProps}
        series={makeSeries({ lastRefreshedAt: '2026-09-01T00:00:00Z' })}
      />,
    )
    const info = screen.getByTestId('actions-info')
    const row = screen.getByTestId('actions-row')
    expect(info.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
```

**Test Case (Green)**: swap the JSX order inside `actionsGroup` so the `actionsInfo` block renders first, `actionsRow` second. Add `data-testid="actions-info"` to the `actionsInfo` div and `data-testid="actions-row"` to the `actionsRow` div (neither currently has one — only their children `actions-left`/`actions-right` do).

### Requirement 3: Sticky bottom actions bar on `SeriesDetail`

**User Story**: As a user viewing a long `SeriesDetail` page, I want the Edit/Delete/Refresh/Recommendations controls (or Confirm/Cancel during delete confirmation) to stay reachable without scrolling to the page's end, mirroring the existing sticky "Back to series list" button at the top.

#### FRONTEND-104-AC-03 [AUTO]: `actionsRow` carries the sticky class in the normal render state
**Statement**: While rendering its normal (non-delete-confirmation) state, `SeriesDetailActionsPanel` shall apply the `actionsSticky` CSS class to `actionsRow`.

**Rationale**: Marks the element that becomes the visually pinned bar, per the Design Decisions scoping call.

**References**:
- Component: `components/SeriesDetailActionsPanel.tsx` (`actionsRow` div)
- CSS: `components/SeriesDetail.module.css` (new `.actionsSticky` class)

**Test Case (Red)**:
```typescript
describe('FRONTEND-104-AC-03: actionsRow carries the sticky class (normal state)', () => {
  it('applies actionsSticky to actionsRow when not confirming delete', () => {
    render(<SeriesDetailActionsPanel {...baseProps} confirmingDelete={false} />)
    expect(screen.getByTestId('sticky-actions-bar')).toHaveClass('actionsRow')
    expect(screen.getByTestId('sticky-actions-bar')).toHaveClass('actionsSticky')
  })
})
```

**Test Case (Green)**: apply `` `${styles.actionsRow} ${styles.actionsSticky}` `` and `data-testid="sticky-actions-bar"` to the `actionsRow` div in the normal-state branch.

#### FRONTEND-104-AC-04 [AUTO]: The outer `.actions` wrapper carries the sticky class during delete confirmation
**Statement**: While rendering its delete-confirmation state, `SeriesDetailActionsPanel` shall apply the `actionsSticky` CSS class to its outer `actions` wrapper.

**Rationale**: Keeps Confirm/Cancel reachable the same way, without introducing a second, differently-styled sticky treatment for this branch.

**References**:
- Component: `components/SeriesDetailActionsPanel.tsx` (the `confirmingDelete` branch's outer `<div className={styles.actions}>`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-104-AC-04: outer actions wrapper carries the sticky class (delete-confirmation state)', () => {
  it('applies actionsSticky to the outer wrapper when confirming delete', () => {
    render(<SeriesDetailActionsPanel {...baseProps} confirmingDelete={true} />)
    expect(screen.getByTestId('sticky-actions-bar')).toHaveClass('actions')
    expect(screen.getByTestId('sticky-actions-bar')).toHaveClass('actionsSticky')
  })
})
```

**Test Case (Green)**: apply `` `${styles.actions} ${styles.actionsSticky}` `` and `data-testid="sticky-actions-bar"` to the outer wrapper in the `confirmingDelete` branch.

#### FRONTEND-104-AC-05 [AUTO]: `actionsInfo` never carries the sticky class
**Statement**: The `SeriesDetailActionsPanel` shall not apply the `actionsSticky` CSS class to `actionsInfo`.

**Rationale**: Makes the Design Decisions scoping call (button row only, not the informational text) an explicit, checked obligation rather than an implicit side effect of AC-03/04.

**References**:
- Component: `components/SeriesDetailActionsPanel.tsx` (`actionsInfo` div)

**Test Case (Red)**:
```typescript
describe('FRONTEND-104-AC-05: actionsInfo is never sticky', () => {
  it('does not apply actionsSticky to actionsInfo', () => {
    render(
      <SeriesDetailActionsPanel
        {...baseProps}
        series={makeSeries({ lastRefreshedAt: '2026-09-01T00:00:00Z' })}
      />,
    )
    expect(screen.getByTestId('actions-info')).not.toHaveClass('actionsSticky')
  })
})
```

**Test Case (Green)**: leave `actionsInfo`'s className as `styles.actionsInfo` only — no modifier class added.

#### FRONTEND-104-AC-06 [MANUAL]: The normal-state actions row stays visible while scrolling
**Statement**: While the user has scrolled down a `SeriesDetail` page in its normal (non-delete-confirmation) state, the Edit/Delete/Refresh/Recommendations actions row shall remain visible without requiring the user to scroll to the page's end.

**Rationale**: The explicit feature request, reasoning by analogy from `.backButton`'s existing sticky-top behavior.

**Verification**: Manual check in browser — open a series detail page with enough content (long overview text, many keyword chips, etc.) to exceed one viewport, scroll down, and confirm the actions row stays pinned to the viewport bottom with a solid background (no page content visible through/beneath it), while `actionsInfo` (last-refreshed text / new-content badge) is not pinned and scrolls normally. Not automatable, per this project's established jsdom/CSS caveat.

**References**:
- CSS: `components/SeriesDetail.module.css` (`.backButton`, the existing sticky-top precedent this mirrors, `position: sticky; top: 0; z-index: 10;`)

**Test Case (Green)**: add to `SeriesDetail.module.css`:
```css
.actionsSticky {
  position: sticky;
  bottom: 0;
  z-index: 10;
  background: var(--bg);
  border-top: 1px solid var(--border);
  padding-top: 0.75rem;
}
```

#### FRONTEND-104-AC-07 [MANUAL]: The delete-confirmation actions row stays visible while scrolling
**Statement**: While the user has scrolled down a `SeriesDetail` page during delete confirmation, the Confirm/Cancel controls shall remain visible without requiring the user to scroll to the page's end.

**Rationale**: Keeps the delete-confirmation state consistent with the normal state's new sticky behavior (Design Decisions) — the user shouldn't lose reachable controls the moment they click Delete.

**Verification**: Manual check in browser, same method as AC-06, but triggered by clicking "Delete" first to enter the confirmation state before scrolling.

**Test Case (Green)**: no additional CSS — already covered by AC-06's `.actionsSticky` definition, applied via AC-04's className change.

## Cross-References

| Concept | Location |
|---|---|
| Sticky-footer overlay-padding/dialog-margin fix being restored | `frontend_spec_091_series_form_validation_and_persistent_cta.md`, Correction (2026-09-07) (`FRONTEND-091-AC-10`/`AC-13`) |
| `SeriesRecommendationsModal`'s existing sticky `.dialogActions`, and the claim ("mirrors ... exactly") this spec corrects | `frontend_spec_092_persistent_navigation_and_modal_dismissal.md` (`FRONTEND-092-AC-06`) |
| Established `position: sticky` pattern and `.backButton`'s sticky-top precedent | `frontend_spec_090_series_detail_layout_adjustments.md` (`FRONTEND-090-AC-02`) |
| Main header's sticky-top `z-index`/`--header-height` tiering (confirmed not to coexist with `SeriesDetail`'s own sticky elements) | `App.module.css`, `App.tsx`; `frontend_spec_092_persistent_navigation_and_modal_dismissal.md` (`FRONTEND-092-AC-01`) |
| jsdom/CSS rendering limitation | Root `CLAUDE.md` ("Frontend: Vitest/jsdom can't validate real CSS rendering") |

## Acceptance Criteria Summary

- [x] FRONTEND-104-AC-01: No visible gap beneath the sticky "Done" footer (`SeriesRecommendationsModal`) [MANUAL]
- [x] FRONTEND-104-AC-02: `actionsInfo` precedes `actionsRow` in document order
- [x] FRONTEND-104-AC-03: `actionsRow` carries the sticky class in the normal render state
- [x] FRONTEND-104-AC-04: The outer `.actions` wrapper carries the sticky class during delete confirmation
- [x] FRONTEND-104-AC-05: `actionsInfo` never carries the sticky class
- [x] FRONTEND-104-AC-06: The normal-state actions row stays visible while scrolling [MANUAL]
- [x] FRONTEND-104-AC-07: The delete-confirmation actions row stays visible while scrolling [MANUAL]
