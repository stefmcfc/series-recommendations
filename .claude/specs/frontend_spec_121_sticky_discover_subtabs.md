# Frontend Spec 121: Sticky Discover Sub-Tabs

**Status**: Implemented
**Priority**: P3 (visual polish — the same sticky mechanism already used elsewhere in this app, applied to one more tab row)
**Depends on**: `frontend_spec_092_persistent_navigation_and_modal_dismissal.md` (established `.tablist`'s `position: sticky` pattern, the one this spec extends to `.tablistNested`), `frontend_spec_104_sticky_action_bars.md` (this app's other sticky-position corrections, same CSS mechanism)
**Area**: Frontend (`components/RecommendationControls.module.css`)

## Overview

`RecommendationControls.tsx` has two stacked tab rows on the Recommendations page: the top-level "Use My Series"/"Discover" tabs (`.tablist`), and — while on Discover — a nested row of three sub-tabs, "Custom Search"/"Popular Right Now"/"Highest Rated" (`.tablistNested`). `.tablist` is already `position: sticky` (`frontend_spec_092`, `FRONTEND-092-AC-03`), pinned to the top of the viewport below the main header. `.tablistNested` is not — scrolling down a long Discover results list scrolls the sub-tab row away entirely, while the top-level tab row stays pinned above an otherwise-empty gap.

This is a real, previously-undelivered gap, not a duplicate of already-shipped work: `.claude/SPEC_CANDIDATES.md` has a note claiming this was "confirmed already fully delivered" via `frontend_spec_106_sticky_discover_mode.md` — but that spec is about something unrelated with the same word "sticky": it makes the app *remember* which Discover sub-tab was last used across page loads (`localStorage`), not CSS `position: sticky` (staying pinned while scrolling). Reading the actual CSS confirms `.tablistNested` has no `position: sticky` today. This spec corrects that stale tracking note as part of its own change (see Design Decisions).

## Design Decisions

- **`.tablistNested` becomes `position: sticky` with `top: calc(var(--header-height) + var(--tablist-height))`** — stacking directly below the already-stuck `.tablist`, the standard two-tier sticky-header pattern. `--tablist-height: 56px` is a new custom property (local to `RecommendationControls.module.css`, not promoted to `App.module.css`'s global `:root` — `--header-height` is global because two different files already consume it; `--tablist-height` currently has exactly one consumer, so it stays local per this app's "extract on a real second consumer" convention). The value was measured directly in a running browser (`.tablist`'s real `getBoundingClientRect().height` ≈ 56px), not calculated from padding/font-size by hand, and kept in `px` rather than `rem` — this app's root font-size is 18px, not the 16px browser default, so a `rem` value here would need converting against that rather than the usual assumption (an early version of this fix got this wrong: `3.5rem` was chosen assuming a 16px root, which resolves to 63px at this app's real 18px root — 7px too tall, leaving a gap where content behind the tab bars peeked through). Kept consistent with how `--header-height: 3.25rem` itself is a fixed, chosen constant rather than a derived one — just expressed in `px` here to sidestep the root-font-size trap.
- **The small visual gap between the two tab rows in normal (unscrolled) flow disappears once both are stuck** — `.tablistNested` sticks flush against `.tablist`'s bottom edge rather than preserving its current ~1rem `gap` (from `.sourceSelector`'s flex `gap: 1rem`). This is the standard, widely-used two-tier sticky-header behavior (the two bars visually merge into one pinned block once stuck) and avoids a second, more fragile custom property just to preserve a gap that only matters in the unstuck state.
- **`z-index: 18`, one below `.tablist`'s existing `19`** — `.tablistNested` sits stacked *underneath* `.tablist` in the same corner of the screen once both are stuck (directly below it, slightly overlapping during the scroll transition before settling), so it needs a lower tier in the same stacking context, not an unrelated new number. Both stay well below the modal/dialog tier (`frontend_spec_092`'s `SeriesRecommendationsModal`, `frontend_spec_104`'s sticky footers) which are naturally higher since they're rendered later / in a portal-like overlay position.
- **`background: var(--bg)`**, matching `.tablist`'s own solid background — without it, page content scrolling underneath would show through `.tablistNested` while stuck, the same class of bug `frontend_spec_104` fixed elsewhere.
- **`[MANUAL]` for the actual "stays pinned, no gap/overlap" visual behavior** — jsdom doesn't run layout or provide a scrollable viewport, so `position: sticky`'s real effect can't be asserted by a component test, per this project's established caveat (`frontend_spec_090`/`091`/`092`/`104`; also noted in root `CLAUDE.md`). The one behavior that *is* mechanically assertable — that the CSS module actually declares `position: sticky` with the right `top`/`z-index`/`background` — is `[AUTO]`.
- **Corrects `.claude/SPEC_CANDIDATES.md`'s stale note** (see Overview) as part of this same change, per this repo's stated practice of fixing a tracking-doc inaccuracy the moment it's found rather than leaving it to compound.
- **Scope confirmed with the user during implementation**: both tab rows' sticky range is bounded by their containing block (`.sourceSelector`'s ancestor `.container`), which spans only the filter/control panel — not the "Recommendations" results list rendered below it as a sibling section. This means neither tab row stays pinned while scrolling through the results themselves, only while scrolling the controls above them. This is a **pre-existing limitation of `.tablist` itself** (unchanged by this spec — confirmed by testing that the top-level tabs already disappear at the same scroll point, with no code of this spec's touched), not a regression this spec introduces. Extending the sticky range to also cover the results list would require restructuring the container hierarchy (a materially larger, riskier change) — out of scope here; the user confirmed matching the existing tabs' range is sufficient.

---

## Requirement 1: Discover sub-tabs stay visible while scrolling

**User story**: As a user browsing a long list of Discover results, I want the "Custom Search"/"Popular Right Now"/"Highest Rated" sub-tabs to stay visible as I scroll, the same way the top-level "Use My Series"/"Discover" tabs already do, so I can switch sub-tabs without scrolling back up.

### FRONTEND-121-AC-01 [AUTO]
**Statement**: `RecommendationControls.module.css`'s `.tablistNested` shall declare `position: sticky`, `top: calc(var(--header-height) + var(--tablist-height))`, `z-index: 18`, and `background: var(--bg))`; a new `--tablist-height: 56px` custom property shall be defined in the same file.

**References**: `components/RecommendationControls.module.css` — `.tablist` (lines 75-85, the pattern being mirrored), `.tablistNested` (lines 87-92, current no-sticky state).

**Test Case (Red)**:
```typescript
import fs from 'node:fs'
import path from 'node:path'

describe('FRONTEND-121-AC-01: .tablistNested is sticky', () => {
  it('declares position: sticky with a top offset stacked below .tablist', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, 'RecommendationControls.module.css'),
      'utf-8',
    )
    const nestedBlock = css.match(/\.tablistNested\s*\{[^}]*\}/)?.[0] ?? ''
    expect(nestedBlock).toMatch(/position:\s*sticky/)
    expect(nestedBlock).toMatch(/top:\s*calc\(var\(--header-height\)\s*\+\s*var\(--tablist-height\)\)/)
    expect(nestedBlock).toMatch(/z-index:\s*18/)
    expect(nestedBlock).toMatch(/background:\s*var\(--bg\)/)
    expect(css).toMatch(/--tablist-height:\s*56px/)
  })
})
```
**Test Case (Green)**: add the four declarations to `.tablistNested` and the new custom property, until the spec above passes.

**Manual verification** `[MANUAL]`: open Discover (a mode with enough results to scroll, e.g. "Highest Rated"), scroll down, and confirm both tab rows stay pinned to the top of the viewport with no visible gap or content bleeding through underneath — the same check pattern already used for `frontend_spec_104`'s sticky bars.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `.tablist`'s existing sticky pattern, mirrored here | `frontend_spec_092_persistent_navigation_and_modal_dismissal.md` (`FRONTEND-092-AC-03`) |
| Other sticky-position CSS fixes in this app, same mechanism/caveats | `frontend_spec_104_sticky_action_bars.md` |
| Stale tracking note corrected by this spec | `.claude/SPEC_CANDIDATES.md` (2026-09-09 entry) |
| The *different* meaning of "sticky" that note actually refers to | `frontend_spec_106_sticky_discover_mode.md` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-121-AC-01: `.tablistNested` is sticky, stacked correctly below `.tablist`, with no content bleed-through
