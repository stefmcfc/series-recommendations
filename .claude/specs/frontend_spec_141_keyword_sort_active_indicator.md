# Frontend Spec 141: Keyword Suggestion Sort — Active Indicator

**Status**: Not started
**Priority**: P3
**Depends on**: `frontend_spec_131_info_disclosure_boxes.md` (`InfoDisclosure` component and the
`NumberInput.labelInfo`/`KeywordPicker.labelInfo` sibling-of-label hook-point pattern this spec
composes alongside, not instead of), `frontend_spec_133_keyword_suggestions_and_analysis_recommendations_link.md`
(introduces `keywordSuggestionSortMode`/`keywordSuggestionMinSeriesCount`, the two localStorage-backed
values this spec's new component reads), `frontend_spec_139_pill_toggle_component.md` (`PillToggle`
— considered and rejected as this spec's visual base; see Design Decisions), `frontend_spec_140_settings_clarity_keyword_sort.md`
(gives `KeywordPicker` its `labelInfo` prop, which this spec's call-site wiring reuses; its own
Requirement 6 — making `SettingsPage.tsx`'s and `SearchFilter.tsx`'s own keyword fetches reactive to
the sort setting — is a **hard sequencing dependency** for two of this spec's nine call sites, see
Requirement 3 below)
**Area**: Frontend (`components/KeywordSortActiveIndicator.tsx` — new — plus its colocated
`.module.css`/`.test.tsx`; wiring changes to `components/CustomSearchPanel.tsx`,
`components/RecommendationFiltersBox.tsx`, `components/UseMySeriesPanel.tsx`,
`components/SettingsPage.tsx`, `components/SearchFilter.tsx` and each of those components' colocated
`*.test.tsx`)

## Overview

Every keyword-suggestion field in the app is supposed to honor Settings' "Keyword Suggestion Sort"
setting (`frontend_spec_133`, clarified as an explicitly app-wide setting by `frontend_spec_140`),
but nothing on screen currently tells a user *whether* it's actually doing so at the field they're
looking at — when "Highest Rated" is selected, a keyword-suggestion list is silently re-sorted by
rating and silently floor-filtered to a minimum series count, with zero visual difference from the
default "Most Common" list apart from the suggestions themselves changing order. This spec adds one
new, small, self-contained presentational component — `KeywordSortActiveIndicator` — that renders a
compact badge next to a keyword-suggestion field's label whenever (and only whenever)
`keywordSuggestionSortMode` is `'highestRated'`, stating both that suggestions are sorted by rating
and the actual configured Minimum Series Count floor. It is wired onto every confirmed
keyword-suggestion call site in the app. This is a pure UI affordance: no backend change, no change
to `NameStatAggregator`'s sort/filter behavior, and no change to the Settings control itself (already
explained by `frontend_spec_140`'s `InfoDisclosure`).

## Investigation findings (as of this spec's writing)

A direct grep/read of current source (not `frontend_spec_140`'s own prose, which was found to be
ahead of its own implementation in one place — see below) found exactly **8** `KeywordPicker`
instances across 5 files whose `options` prop traces back to a `seriesApi.getKeywordStats(...)` call:

| # | File | `KeywordPicker` `id` | Visible label? | Currently reactive to the setting? |
|---|------|----------------------|-----------------|--------------------------------------|
| 1 | `CustomSearchPanel.tsx` | `recommendation-keywords` | No (`hideInput`) | Yes — fed by `RecommendationControls.tsx`'s shared `keywordOptions` state (`FRONTEND-133-AC-04`) |
| 2 | `CustomSearchPanel.tsx` | `browse-custom-search-keywords` | Yes | Yes (same shared state) |
| 3 | `RecommendationFiltersBox.tsx` | `recommendation-exclude-keywords` | Yes | Yes (same shared state, threaded via its own `keywordOptions` prop) |
| 4 | `UseMySeriesPanel.tsx` | `specific-series-keywords` | No (`hideInput`) | Yes (same shared state) |
| 5 | `UseMySeriesPanel.tsx` | `browse-specific-series-keywords` | Yes | Yes (same shared state) |
| 6 | `SettingsPage.tsx` | `settings-keyword-favourites` | Yes | **No** — `SettingsPage.tsx`'s own `keywordOptions` fetch (lines ~183-190) is still a mount-only, no-args `seriesApi.getKeywordStats()` call with no dependency on `keywordSuggestionSortMode`/`keywordSuggestionMinSeriesCount` |
| 7 | `SearchFilter.tsx` | `search-keywords` | Yes | **No** — `SearchFilter.tsx` has no reference anywhere to `keywordSuggestionSortMode`/`keywordSuggestionMinSeriesCount`; its `keywordOptions` fetch (lines ~308-317) is likewise mount-only, no-args |
| 8 | `SearchFilter.tsx` | `browse-keywords` | Yes | **No** (same fetch as #7) |

**Correction to this task's own background framing, now itself superseded**: at the time this spec
was drafted, `frontend_spec_140`'s Requirement 6 (AC-11 through AC-14) was not yet implemented,
despite being described to this spec's author as already done — re-verified directly against source
rather than trusted from the commissioning conversation, per this project's own established practice.
That implementation has since landed (same session, concurrently): `frontend_spec_140`'s Acceptance
Criteria Summary now shows AC-11 through AC-14 all checked, `Status: Implemented`, and call sites 6-8
in the table above are now reactive to the setting like the other five. The table above is left as
written (it documents the gap as found); Requirement 3's "hard sequencing dependency" note is
satisfied as of this edit — nothing further blocks implementing this spec on sequencing grounds.

No keyword-suggestion field anywhere is *deliberately* exempt from the setting — every single one of
the 8 is intended to honor it (call sites 6-8 simply haven't been wired up yet, a tracked,
in-progress gap, not a design choice). This means the indicator's job is purely to signal **mode**
(is Highest Rated currently active, and what's its floor) — not to distinguish "this field is
affected" from "this field isn't," since that distinction doesn't exist by design.

No other keyword-adjacent `KeywordPicker` instance (Country, Language, Genre favourites, the
Series/specific-series pickers) reads this setting — there is no equivalent "suggestion sort" setting
for any of those, so none of them are in scope here.

## Design Decisions

- **A new, self-contained component (`KeywordSortActiveIndicator`), not a `KeywordPicker` prop.**
  `frontend_spec_140`'s `labelInfo` hook point was built for a *static, click-to-expand explainer*
  (`InfoDisclosure`) — a deliberately inert piece of content a `KeywordPicker` consumer chooses to
  supply once. This spec's badge is *live state* that needs to re-render when the setting changes,
  without `KeywordPicker` itself knowing anything about keyword-suggestion-sort semantics (it has no
  reason to — it's a generic picker used for Country/Language/Genre/Series too). Rather than adding a
  bespoke prop to `KeywordPicker.tsx` for this one concern, `KeywordSortActiveIndicator` is a fully
  self-contained, zero-prop component that reads `keywordSuggestionSortMode`/
  `keywordSuggestionMinSeriesCount` itself via `useLocalStorage` (mirroring how `SettingsPage.tsx`,
  `CustomSearchPanel.tsx`, and `RecommendationFiltersBox.tsx` each already independently read their
  own copies of `countryFavourites`/`languageFavourites` — "no cross-tab sync needed, each mounted
  consumer just reads its own copy", `frontend_spec_098`'s Design Decisions, extended here to
  same-tab-but-different-component consumers too). Each call site simply renders
  `<KeywordSortActiveIndicator />` — zero new props threaded through any intermediate component
  (`CustomSearchPanel`, `RecommendationFiltersBox`, `UseMySeriesPanel` gain no new prop at all).
  `useLocalStorage`'s existing same-tab `CustomEvent` sync (`frontend_spec_136`'s bugfix) means every
  mounted instance updates live the moment the Settings radio changes, with no prop drilling and no
  new shared context.
- **Composed into the existing `labelInfo` slot where one exists, not a replacement for it.** For the
  5 call sites with a visible label (#2, #3, #5, #6, #7, #8 above — 6 of them, not 5; #1 and #4 are
  `hideInput` and have no visible label at all), `<KeywordSortActiveIndicator />` is passed as (part
  of) `labelInfo`, rendering in the same sibling-of-`<label>` row `frontend_spec_140` already
  established. Where a `labelInfo` already exists (`browse-custom-search-keywords`, which already
  carries an `InfoDisclosure` from `FRONTEND-140-AC-08`), the two are composed together in a
  `Fragment` — badge first, then the disclosure button — rather than one replacing the other; they
  answer different questions ("what's active right now" vs. "where do I change this").
- **No `KeywordPicker.tsx` changes required.** Because `KeywordSortActiveIndicator` needs no props
  and `labelInfo` already accepts arbitrary `ReactNode`, every wiring change in this spec is confined
  to the five call-site files — `KeywordPicker.tsx` itself is untouched.
- **`hideInput` call sites (#1, #4) get the badge next to their "Browse all keywords" button instead
  of a label.** `KeywordPicker`'s own `!hideInput` gate means no `<label>` renders at all for these
  two — there is nothing for a `labelInfo`-style sibling to attach to, and `KeywordPicker.tsx` isn't
  being changed (see above). Each of these two fields already sits inside a `<div className={styles.field}>`
  wrapper the *consuming* component (`CustomSearchPanel.tsx`/`UseMySeriesPanel.tsx`) owns directly,
  immediately followed by a "Browse all keywords" `<button>` — `<KeywordSortActiveIndicator />` is
  rendered as a sibling of that button inside the same wrapper, so the badge is visible on the
  inline, always-rendered row rather than hidden inside a modal the user hasn't opened yet.
- **Visible text *is* the accessible name — no separate `aria-label`.** The badge is a `<span>` whose
  own text content is `Highest Rated (min {N})` (`{N}` = the actual configured
  `keywordSuggestionMinSeriesCount`). This conveys both facts the user asked for — suggestions are
  sorted by rating, and filtered to a minimum series count, with the real number — to sighted and
  screen-reader users identically, with no risk of the WCAG 2.5.3 "visible text doesn't match
  accessible name" mismatch a separate `aria-label` could introduce. Deliberately not wrapped in
  `role="status"`: that role is for announcing *changes*, and this badge's text is static once
  rendered (a user changing the Settings radio while looking at a different page won't be read this
  element's content changing live in front of them) — the plain-text treatment is simpler and
  sufficient.
- **No icon.** Checked `InfoDisclosure`'s hand-rolled inline-SVG icon convention and `NameStatsTable.tsx`'s
  `favouriteStar` (`aria-hidden`, icon-only, no independent accessible text) as the two existing
  small-indicator precedents in this codebase — neither fits directly: `InfoDisclosure`'s icon is
  purely decorative beside an interactive button's own `aria-label`; `favouriteStar`'s icon conveys
  no information to assistive tech on its own (relies on surrounding row context). Introducing a new
  SVG asset for a one-off badge would be speculative polish for a feature this spec's own visible
  text already fully conveys without one. A future pass can add a purely decorative icon beside the
  text if wanted — not blocking, not in scope here.
- **`PillToggle` rejected as the visual base.** `PillToggle` (`frontend_spec_139`) is an interactive
  `<button aria-pressed>` with click/`onChange` semantics — this badge is passive, non-interactive
  status text with no action to perform on click. Reusing `PillToggle` here would render a button
  that does nothing when clicked, which is worse than a plain `<span>`. `KeywordSortActiveIndicator`
  gets its own small `.module.css`, visually similar in weight to `RecommendationControls.module.css`'s
  existing `.filtersActiveBadge` pill (rounded, compact, small font) but using the softer
  `--accent-bg`/`--accent-border`/`--text-h` token combination `KeywordPicker.module.css`'s own chip
  style already uses, rather than `.filtersActiveBadge`'s higher-contrast `--accent`/`#000` (that pill
  is a numeric alert-style count; this one is calmer, informational status).
- **Requirement 3's two call sites (#6, #7, #8 grouped as "SettingsPage + SearchFilter") carry a hard
  build-sequencing dependency, not just a cross-reference.** Showing "Highest Rated (min N)" beside a
  field whose actual rendered suggestions are still Most-Common-ordered (because `frontend_spec_140`'s
  `FRONTEND-140-AC-12`/`AC-13` haven't landed yet) would be an outright false claim, not just an
  omission. This spec's ACs for those three instances (`FRONTEND-141-AC-10/11/12`) are written and
  testable today (the badge's own visibility logic is independent of whether the fetch it describes
  is correct), but **must not ship to `main` ahead of `FRONTEND-140-AC-12`/`AC-13` landing** — flagged
  explicitly here so a future implementer doesn't wire these three ahead of that prerequisite and
  ship a misleading badge.
- **Out of scope**: the Settings "Keyword Suggestion Sort" fieldset itself (already has its own
  `InfoDisclosure` from `frontend_spec_140`, `FRONTEND-140-AC-02` — not duplicated here); any backend
  change (`NameStatAggregator` and its endpoint are untouched); Country/Language/Genre/Series
  `KeywordPicker` instances (no suggestion-sort setting applies to them); any visual regression tool
  (none adopted in this project — the one `[MANUAL]` AC below states how it's verified instead).

---

## Requirement 1: `KeywordSortActiveIndicator` component

**User story**: As a user looking at a keyword-suggestion field, I want a quick, glanceable signal
when my suggestions are being sorted by rating and floor-filtered, so I'm not surprised by why the
list looks different from "Most Common," without having to remember a Settings page toggle I set
earlier.

### FRONTEND-141-AC-01 [AUTO]
**Statement**: While `keywordSuggestionSortMode` (read via `useLocalStorage`, default
`DEFAULT_KEYWORD_SUGGESTION_SORT_MODE` i.e. `'mostCommon'`) is `'mostCommon'`, the
`KeywordSortActiveIndicator` component shall render nothing (`null`).

**References**: new `components/KeywordSortActiveIndicator.tsx`. Reads
`DEFAULT_KEYWORD_SUGGESTION_SORT_MODE`/`isKeywordSuggestionSortMode` from
`frontend/src/components/RecommendationControls.tsx` (already exported, `FRONTEND-133-AC-01/02`).

**Test Case (Red)**:
```tsx
import { render, screen } from '@testing-library/react'
import { KeywordSortActiveIndicator } from './KeywordSortActiveIndicator'

describe('FRONTEND-141-AC-01: renders nothing in Most Common mode', () => {
  it('renders no badge when the setting is absent (defaults to mostCommon)', () => {
    render(<KeywordSortActiveIndicator />)
    expect(screen.queryByText(/Highest Rated/i)).not.toBeInTheDocument()
  })

  it('renders no badge when explicitly set to mostCommon', () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('mostCommon'))
    render(<KeywordSortActiveIndicator />)
    expect(screen.queryByText(/Highest Rated/i)).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `KeywordSortActiveIndicator` reads the mode via `useLocalStorage` and returns
`null` unless it equals `'highestRated'`.

---

### FRONTEND-141-AC-02 [AUTO]
**Statement**: While `keywordSuggestionSortMode` is `'highestRated'`, the
`KeywordSortActiveIndicator` component shall render a `<span>` whose visible text content
(serving as its own accessible name, with no separate `aria-label`) states both that suggestions are
sorted by rating and the actual configured `keywordSuggestionMinSeriesCount` value, in the form
`Highest Rated (min {N})`.

**References**: new `components/KeywordSortActiveIndicator.tsx`. Reads
`DEFAULT_KEYWORD_SUGGESTION_MIN_SERIES_COUNT`/`isKeywordSuggestionMinSeriesCount` from
`RecommendationControls.tsx` (`FRONTEND-133-AC-02`).

**Test Case (Red)**:
```tsx
describe('FRONTEND-141-AC-02: renders the badge in Highest Rated mode', () => {
  it('states the sort mode and the actual configured minimum', () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    localStorage.setItem('keywordSuggestionMinSeriesCount', JSON.stringify(5))
    render(<KeywordSortActiveIndicator />)
    expect(screen.getByText('Highest Rated (min 5)')).toBeInTheDocument()
  })

  it('falls back to the default minimum when none is stored', () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    render(<KeywordSortActiveIndicator />)
    expect(screen.getByText('Highest Rated (min 2)')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: render `<span className={styles.badge}>{`Highest Rated (min ${minSeriesCount})`}</span>`
when mode is `'highestRated'`.

---

### FRONTEND-141-AC-03 [AUTO]
**Statement**: When `keywordSuggestionSortMode` or `keywordSuggestionMinSeriesCount` changes in the
same browser tab (e.g. via another mounted `KeywordSortActiveIndicator` or `SettingsPage`'s own
radios, both routed through `useLocalStorage`'s existing same-tab sync event), every mounted
`KeywordSortActiveIndicator` instance shall re-render to reflect the new value without requiring a
remount.

**References**: `frontend/src/hooks/useLocalStorage.ts` (`SYNC_EVENT`/`CustomEvent` mechanism,
`frontend_spec_136`'s bugfix — reused here unmodified, not reimplemented).

**Test Case (Red)**:
```tsx
describe('FRONTEND-141-AC-03: live updates across mounted instances', () => {
  it('updates after another instance changes the setting', () => {
    const { rerender } = render(
      <>
        <KeywordSortActiveIndicator />
      </>,
    )
    expect(screen.queryByText(/Highest Rated/i)).not.toBeInTheDocument()

    act(() => {
      localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
      window.dispatchEvent(
        new CustomEvent('app:local-storage-sync', {
          detail: { key: 'keywordSuggestionSortMode' },
        }),
      )
    })
    rerender(
      <>
        <KeywordSortActiveIndicator />
      </>,
    )
    expect(screen.getByText(/Highest Rated/)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: no new code needed beyond `useLocalStorage` itself (already does this) — this
AC is a regression guard confirming `KeywordSortActiveIndicator` doesn't accidentally memoize/cache
its read in a way that defeats the hook's existing sync.

---

### FRONTEND-141-AC-04 [MANUAL]
**Statement**: `KeywordSortActiveIndicator.module.css` shall style `.badge` as a small rounded pill
(`border-radius: 9999px`, compact padding, `font-size: 0.75rem`, `font-weight: 600`) using
`var(--accent-bg)`/`var(--accent-border)`/`var(--text-h)`, visually consistent with
`KeywordPicker.module.css`'s existing chip tokens and legible against both light and dark themes.

**Verification**: visual check in browser (light and dark theme) confirming the badge reads as a
calm, informational pill (not an alert/count badge like `.filtersActiveBadge`) and that its text
doesn't clip or wrap awkwardly inside the narrowest `labelRow` call site (`Exclude Keywords`). jsdom
does not render CSS (project convention) so this cannot be asserted via Vitest/RTL. Route to
automating later: a visual-regression tool (not yet adopted in this project).

---

## Requirement 2: wire the indicator onto the 5 already-reactive call sites

**User story**: As a user browsing Custom Search, My Series' "Use My Series" filters, or the
Exclude Keywords field, I want to see the Highest Rated indicator wherever keyword suggestions are
actually affected by it today.

### FRONTEND-141-AC-05 [AUTO]
**Statement**: `CustomSearchPanel.tsx`'s inline `recommendation-keywords` field (`hideInput`, no
visible label) shall render `<KeywordSortActiveIndicator />` as a sibling of its "Browse all
keywords" button, inside the same `styles.field` wrapper.

**References**: `frontend/src/components/CustomSearchPanel.tsx` lines ~187-209 (the
`recommendation-keywords` field + "Browse all keywords" button, both inside one `styles.field` div).

**Test Case (Red)**:
```tsx
describe('FRONTEND-141-AC-05: inline Keywords field shows the indicator', () => {
  it('renders the badge beside Browse all keywords when Highest Rated is active', () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={['heist']}
      />,
    )
    expect(screen.getByText(/Highest Rated/)).toBeInTheDocument()
  })

  it('renders no badge in Most Common mode', () => {
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={['heist']}
      />,
    )
    expect(screen.queryByText(/Highest Rated/)).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add `<KeywordSortActiveIndicator />` next to the "Browse all keywords" button.

---

### FRONTEND-141-AC-06 [AUTO]
**Statement**: `CustomSearchPanel.tsx`'s `browse-custom-search-keywords` modal field shall pass
`labelInfo={<><KeywordSortActiveIndicator /><InfoDisclosure label="About Keywords" description="..." /></>}`
— composing the new badge alongside its existing `FRONTEND-140-AC-08` disclosure, badge first —
rather than either node replacing the other.

**References**: `frontend/src/components/CustomSearchPanel.tsx` lines ~353-374 (existing
`labelInfo` with `InfoDisclosure` from `frontend_spec_140`).

**Test Case (Red)**:
```tsx
describe('FRONTEND-141-AC-06: Browse Keywords modal shows both the indicator and the disclosure', () => {
  it('renders the badge and the existing About Keywords disclosure together', () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={['heist']}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /browse all keywords/i }))
    const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
    expect(within(dialog).getByText(/Highest Rated/)).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'About Keywords' }),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: wrap the existing `labelInfo` value in a `Fragment` with
`<KeywordSortActiveIndicator />` first.

---

### FRONTEND-141-AC-07 [AUTO]
**Statement**: `RecommendationFiltersBox.tsx`'s `recommendation-exclude-keywords` field shall gain a
new `labelInfo={<KeywordSortActiveIndicator />}` prop (its first use of `labelInfo`).

**References**: `frontend/src/components/RecommendationFiltersBox.tsx` lines ~443-454 (the
`recommendation-exclude-keywords` `KeywordPicker`, currently no `labelInfo`).

**Test Case (Red)**:
```tsx
describe('FRONTEND-141-AC-07: Exclude Keywords shows the indicator', () => {
  it('renders the badge beside the Exclude Keywords label when Highest Rated is active', () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    renderBox({ keywordOptions: ['spoilers'] })
    fireEvent.click(screen.getByRole('button', { name: /^recommendations filters$/i }))
    expect(screen.getByText(/Highest Rated/)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `labelInfo` prop at the referenced call site.

---

### FRONTEND-141-AC-08 [AUTO]
**Statement**: `UseMySeriesPanel.tsx`'s inline `specific-series-keywords` field (`hideInput`, no
visible label) shall render `<KeywordSortActiveIndicator />` as a sibling of its "Browse all
keywords" button, inside the same `styles.field` wrapper.

**References**: `frontend/src/components/UseMySeriesPanel.tsx` lines ~768-796 (the
`specific-series-keywords` field + "Browse all keywords" button, one `styles.field` div).

**Test Case (Red)**:
```tsx
describe('FRONTEND-141-AC-08: inline Keywords filter field shows the indicator', () => {
  it('renders the badge beside Browse all keywords when Highest Rated is active', () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    renderUseMySeriesPanel({ keywordOptions: ['heist'] })
    expect(screen.getByText(/Highest Rated/)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add `<KeywordSortActiveIndicator />` next to the "Browse all keywords" button.

---

### FRONTEND-141-AC-09 [AUTO]
**Statement**: `UseMySeriesPanel.tsx`'s `browse-specific-series-keywords` modal field shall gain a
new `labelInfo={<KeywordSortActiveIndicator />}` prop.

**References**: `frontend/src/components/UseMySeriesPanel.tsx` lines ~1396-1407 (the
`browse-specific-series-keywords` `KeywordPicker`, currently no `labelInfo`).

**Test Case (Red)**:
```tsx
describe('FRONTEND-141-AC-09: Browse Keywords modal (Use My Series) shows the indicator', () => {
  it('renders the badge inside the modal when Highest Rated is active', () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    renderUseMySeriesPanel({ keywordOptions: ['heist'] })
    fireEvent.click(screen.getByRole('button', { name: /browse all keywords/i }))
    expect(
      within(screen.getByRole('dialog', { name: /browse keywords/i })).getByText(
        /Highest Rated/,
      ),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `labelInfo` prop at the referenced call site.

---

## Requirement 3: wire the indicator onto the 2 remaining call sites (sequenced after `frontend_spec_140` Requirement 6)

**User story**: As a user editing Favourite Keywords in Settings, or filtering My Series by Keywords,
I want the same indicator once those fields actually honor the setting — not a badge that lies about
what the field is currently doing.

> **Build-sequencing note**: `FRONTEND-141-AC-10/11/12` below must not be implemented/merged ahead of
> `frontend_spec_140`'s `FRONTEND-140-AC-12` (for AC-10) and `FRONTEND-140-AC-13` (for AC-11/AC-12)
> landing — otherwise the badge would claim a sort/filter behavior the field doesn't actually apply
> yet. The ACs themselves are written and independently testable now (badge visibility depends only
> on the localStorage value, not on whether the fetch is correct), but ship-ordering matters here; see
> this spec's Design Decisions.

### FRONTEND-141-AC-10 [AUTO]
**Statement**: `SettingsPage.tsx`'s `settings-keyword-favourites` field shall gain a new
`labelInfo={<KeywordSortActiveIndicator />}` prop.

**References**: `frontend/src/components/SettingsPage.tsx` lines ~576-583 (the
`settings-keyword-favourites` `KeywordPicker`, currently no `labelInfo`). Depends on
`frontend_spec_140`'s `FRONTEND-140-AC-12` (not yet implemented as of this spec's writing — see
sequencing note above).

**Test Case (Red)**:
```tsx
describe('FRONTEND-141-AC-10: Favourite Keywords shows the indicator', () => {
  it('renders the badge beside Favourite Keywords when Highest Rated is active', () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    render(<SettingsPage {...defaultProps} />)
    expect(screen.getByText(/Highest Rated/)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `labelInfo` prop at the referenced call site.

---

### FRONTEND-141-AC-11 [AUTO]
**Statement**: `SearchFilter.tsx`'s inline `search-keywords` field shall gain a new
`labelInfo={<KeywordSortActiveIndicator />}` prop.

**References**: `frontend/src/components/SearchFilter.tsx` lines ~501-514 (the `search-keywords`
`KeywordPicker`, currently no `labelInfo`). Depends on `frontend_spec_140`'s `FRONTEND-140-AC-13`
(not yet implemented as of this spec's writing — see sequencing note above).

**Test Case (Red)**:
```tsx
describe('FRONTEND-141-AC-11: My Series Keywords filter shows the indicator', () => {
  it('renders the badge beside the Keywords field when Highest Rated is active', () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    render(<SearchFilter {...defaultProps} />)
    expect(screen.getByText(/Highest Rated/)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `labelInfo` prop at the referenced call site.

---

### FRONTEND-141-AC-12 [AUTO]
**Statement**: `SearchFilter.tsx`'s `browse-keywords` modal field shall gain a new
`labelInfo={<KeywordSortActiveIndicator />}` prop.

**References**: `frontend/src/components/SearchFilter.tsx` lines ~817-829 (the `browse-keywords`
`KeywordPicker`, currently no `labelInfo`). Depends on `frontend_spec_140`'s `FRONTEND-140-AC-13`
(same prerequisite as AC-11).

**Test Case (Red)**:
```tsx
describe('FRONTEND-141-AC-12: Browse Keywords modal (My Series) shows the indicator', () => {
  it('renders the badge inside the modal when Highest Rated is active', () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    render(<SearchFilter {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /browse all keywords/i }))
    expect(
      within(screen.getByRole('dialog')).getByText(/Highest Rated/),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `labelInfo` prop at the referenced call site.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `InfoDisclosure` component, `labelInfo` sibling-of-label hook point this spec composes alongside | `frontend_spec_131_info_disclosure_boxes.md`, `frontend_spec_140_settings_clarity_keyword_sort.md` (`FRONTEND-140-AC-06/07`) |
| `keywordSuggestionSortMode`/`keywordSuggestionMinSeriesCount`, their types/defaults/validators (`KeywordSuggestionSortMode`, `DEFAULT_KEYWORD_SUGGESTION_SORT_MODE`, `isKeywordSuggestionSortMode`, `DEFAULT_KEYWORD_SUGGESTION_MIN_SERIES_COUNT`, `isKeywordSuggestionMinSeriesCount`) | `frontend_spec_133_keyword_suggestions_and_analysis_recommendations_link.md`, exported from `components/RecommendationControls.tsx` |
| `useLocalStorage`'s same-tab `CustomEvent` sync, reused unmodified | `frontend/src/hooks/useLocalStorage.ts` (`frontend_spec_136_keyword_favourites_indicator_and_detail_modal.md`'s bugfix) |
| `PillToggle` — considered and rejected as this component's visual/interaction base (interactive, this badge is passive) | `frontend_spec_139_pill_toggle_component.md` |
| Hard build-sequencing prerequisite for `FRONTEND-141-AC-10/11/12` | `frontend_spec_140_settings_clarity_keyword_sort.md`'s `FRONTEND-140-AC-12`/`AC-13` (Requirement 6, not yet implemented as of this spec's writing) |
| Idea origin | direct user request during review of `frontend_spec_140`'s implementation, not yet recorded in `.claude/SPEC_CANDIDATES.md`/`.claude/ideas/future_ideas.md` (none found referencing it) |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-141-AC-01: `KeywordSortActiveIndicator` renders nothing in Most Common mode (default or explicit)
- [ ] FRONTEND-141-AC-02: renders a `Highest Rated (min {N})` badge, visible text as its own accessible name, in Highest Rated mode
- [ ] FRONTEND-141-AC-03: re-renders live across mounted instances when the setting changes in the same tab
- [ ] FRONTEND-141-AC-04: `.badge` CSS matches the established pill/token visual language [MANUAL — visual check in browser, light/dark theme]
- [ ] FRONTEND-141-AC-05: `CustomSearchPanel.tsx`'s inline `recommendation-keywords` field shows the indicator beside "Browse all keywords"
- [ ] FRONTEND-141-AC-06: `CustomSearchPanel.tsx`'s `browse-custom-search-keywords` modal field composes the indicator with its existing `InfoDisclosure`
- [ ] FRONTEND-141-AC-07: `RecommendationFiltersBox.tsx`'s `recommendation-exclude-keywords` field gains the indicator via `labelInfo`
- [ ] FRONTEND-141-AC-08: `UseMySeriesPanel.tsx`'s inline `specific-series-keywords` field shows the indicator beside "Browse all keywords"
- [ ] FRONTEND-141-AC-09: `UseMySeriesPanel.tsx`'s `browse-specific-series-keywords` modal field gains the indicator via `labelInfo`
- [ ] FRONTEND-141-AC-10: `SettingsPage.tsx`'s `settings-keyword-favourites` field gains the indicator via `labelInfo` (sequenced after `FRONTEND-140-AC-12`)
- [ ] FRONTEND-141-AC-11: `SearchFilter.tsx`'s `search-keywords` field gains the indicator via `labelInfo` (sequenced after `FRONTEND-140-AC-13`)
- [ ] FRONTEND-141-AC-12: `SearchFilter.tsx`'s `browse-keywords` modal field gains the indicator via `labelInfo` (sequenced after `FRONTEND-140-AC-13`)
