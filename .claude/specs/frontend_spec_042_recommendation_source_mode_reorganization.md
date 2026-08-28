# Frontend Spec 042: Recommendation Source Mode Reorganization — "Use My Series" / "Discover", Tab-Style Selector

**Status**: Implemented (2026-08-28) — changed files: `frontend/src/components/RecommendationControls.tsx`,
`frontend/src/components/RecommendationControls.module.css`, `frontend/src/components/RecommendationControls.test.tsx`,
`frontend/src/App.test.tsx`, `frontend/package.json`, `frontend/package-lock.json`,
`backend/build.gradle.kts` (version bump only, no backend behavior change). AC-17 verified 2026-08-28 via
a real Chrome browser pass (light + dark, both tab tiers, all five sub-modes, live recommendation results) —
no console errors, no axe violations, visually consistent with `frontend_spec_041`'s menu bar.
**Priority**: P3 (IA/naming improvement — no functional bug being fixed, no backend contract change)
**Depends on**: Frontend Spec 041 (`frontend_spec_041_global_navigation.md`, establishes the tab/menu-bar visual
language this spec's selector matches) — implement after 041 ships, not in parallel, per this project's one-spec-
pair-in-flight discipline. Frontend Spec 011 (`frontend_spec_011_recommendation_controls.md`, owns the
`ControlsState`/`updateState`/`onQueryChange` wiring this spec restructures, not replaces) ✅. Frontend Spec 040
(`frontend_spec_040_recommendation_controls_apply_and_lock.md`, the Apply-Filters-gating/in-flight-lock policy
this spec must preserve exactly) ✅. Frontend Spec 035 (`frontend_spec_035_specific_series_picker.md`, the
picker UI this spec makes always-visible under "Use My Series" rather than conditional on a separate mode) ✅.
**Area**: Frontend (`RecommendationControls.tsx`, `RecommendationControls.module.css`) — no backend change
needed. Every wire value this spec's UI produces (`seriesIds`, `genres`, `keywords`, `sourceMode: 'trending'`/
`'topRated'`) is byte-identical to today's; only the UI's labels, grouping, and selector mechanism change.

## Overview

`RecommendationControls`' "Recommendation Source" selector is currently five flat radio options: Automatic,
Specific Series, Genre & Keyword, Popular Right Now, Highest Rated. Two things about this were confirmed in
discussion: (1) "Automatic" is, and always has been, exactly "Specific Series" with nothing picked — confirmed in
`RecommendationSourcingService.resolveSourcePool`, which takes the same `automaticPool()` branch whenever
`seriesIds` is empty/null, which is exactly what an empty Specific Series selection produces — so there's no
reason for these to be two separate options; and (2) the remaining three modes are naturally a group: none of
them use your tracked series at all (`.claude/analysis/scoring_weight_recommendations.md` Section 3/4 confirms
none of "Genre & Keyword"/"Popular Right Now"/"Highest Rated" ever attach a source series or apply scoring — they
all just hand back TMDB's own ordering, untouched), so grouping them under one "Discover" parent mirrors how the
backend itself already splits behavior — personalized/scored (`sourceFromPool`) vs. TMDB-catalog browsing
(`sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword`).

This spec:
1. Merges "Automatic" and "Specific Series" into a single **"Use My Series"** option. The Specific Series picker
   (search/filter/sort/browse-all — `frontend_spec_035`) becomes an always-visible, explicitly optional narrowing
   section under it, rather than gating an entirely separate mode.
2. Groups "Genre & Keyword" (renamed **"Custom Search"**), "Popular Right Now", and "Highest Rated" under a new
   **"Discover"** parent, selected via a second-level tab row shown only while Discover is active.
3. Replaces the flat radio-button `<fieldset>` with a proper two-level **tab** widget (`role="tablist"`/
   `role="tab"`), matching `frontend_spec_041`'s menu-bar visual language and better fitting the actual semantics
   — this control switches which panel of the page is shown, which is what the WAI-ARIA Tabs pattern is for, not
   a radio-group form field.

**Explicitly not in scope** (per the user's own framing — "let's start with those, can get into functionality
later"): no change to sourcing/scoring/filtering behavior itself. "Custom Search" behaves exactly as "Genre &
Keyword" did — the algorithm-customization work tracked in `.claude/SPEC_CANDIDATES.md` ("Customizable
recommendation 'algorithm'...") is a separate, later spec.

## Design Decisions

- **Internal state gains a second dimension, not a sixth flat value.** `ControlsState.mode` narrows to
  `'useMySeries' | 'discover'`; a new `ControlsState.discoverMode: 'customSearch' | 'trending' | 'topRated'`
  field (relevant only while `mode === 'discover'`, mirroring how `trendingWindow` is already always-present in
  state but only relevant/read for one mode) tracks which Discover sub-tab is active. Every existing conditional
  currently keyed off the old flat `SourceMode` values must be rekeyed:
  - `state.mode === 'specific'` (picker visibility, `showMinSourceRating`) → `state.mode === 'useMySeries'`
  - `state.mode === 'genre'` (genre/keyword fields, hint text, discover-sort options) → `state.mode ===
    'discover' && state.discoverMode === 'customSearch'`
  - `state.mode === 'trending'` (Trending Window fieldset, Sort By hidden) → `state.mode === 'discover' &&
    state.discoverMode === 'trending'`
  - `state.mode === 'topRated'` (minVoteCount default-200 logic, discover-sort options/default) → `state.mode
    === 'discover' && state.discoverMode === 'topRated'`
  - `applySourceModeQuery`'s `state.mode === 'specific'`/`'genre'`/`'trending'`/`'topRated'` branches: rekeyed the
    same way. **The actual wire values sent (`query.seriesIds`, `query.genres`, `query.keywords`,
    `query.sourceMode`) do not change at all** — only what UI state maps to them.
- **The wire contract is completely unaffected.** `sourceMode: 'trending'`/`'topRated'` are still the only two
  literal strings ever sent for that field (unchanged from today); "Custom Search" sends `genres`/`keywords`
  exactly as "Genre & Keyword" did, with no `sourceMode` value of its own — there was never a backend concept
  named after the UI label, so renaming it is purely cosmetic. No `RecommendationCriteria`/backend change of any
  kind.
- **"Use My Series"' picker section is now always rendered, not conditional.** Today, `state.mode === 'specific'`
  gates the entire Specific Series picker block (genre/status filters, sort control, `KeywordPicker`, "Show all
  series" button) — "Automatic" showed none of it. After the merge there is no separate "automatic" mode to hide
  it under, so this section renders whenever `state.mode === 'useMySeries'`, regardless of whether any series are
  currently selected. An explanatory legend/hint (e.g. "Narrow to specific series (optional) — leave empty to use
  your top-rated completed shows automatically") replaces the affordance that used to live in having two visibly
  distinct mode names.
- **Tabs, not radios — real WAI-ARIA Tabs pattern, in two tiers.** The top-level selector becomes `role="tablist"`
  containing two `role="tab"` buttons ("Use My Series", "Discover"), each `aria-selected`/`aria-controls`-wired to
  a `role="tabpanel"`. While "Discover" is the active top-level tab, a second, nested `role="tablist"` (three
  tabs: "Custom Search", "Popular Right Now", "Highest Rated") renders inside its panel — a nested-tablist
  composite is a legitimate WAI-ARIA pattern (e.g. macOS System Preferences' own sidebar-then-tab-bar shape), not
  an invented one. This is a deliberately different choice from `frontend_spec_041`'s own top-level app nav, which
  correctly stays real `<NavLink>`s (`role="link"`) because those genuinely navigate to different URLs/pages —
  this selector doesn't navigate anywhere, it swaps which controls/panel are shown within the one Recommendations
  view, which is exactly what the Tabs pattern (not link navigation, not a radio group) is for.
- **Auto-fetch-on-mode-change is preserved exactly, at both tiers.** `frontend_spec_040`'s Design Decision that
  "Recommendation Source" is the one control exempt from Apply-Filters gating still applies — clicking either the
  top-level tab or a Discover sub-tab fires `onQueryChange` immediately (via the existing `handleModeChange`,
  adapted to the two-tier state), exactly as clicking any of today's five flat radios does. This spec changes how
  many widgets it takes to reach a given mode, not when a request fires.
- **Clicking the already-active tab (either tier) is a no-op.** Native radio inputs never fire `onChange` when
  clicking an already-checked option — today's flat radios get this for free. Tab `<button>`s don't have that
  built-in behavior, so `handleModeChange`'s two call sites (top-level, sub-level) must each explicitly skip
  re-firing `onQueryChange`/re-resetting state when the clicked tab is already the active one, to avoid a
  redundant duplicate request on every re-click of the current tab.
- **All tabs (both tiers) stay disabled while `loading`**, exactly matching today's `disabled={loading}` on every
  radio input (`frontend_spec_040`) — implemented as the native `disabled` attribute on each `role="tab"`
  `<button>`.
- **Visual language matches `frontend_spec_041`'s menu bar** (active-tab treatment, spacing, color tokens via
  this app's existing `--accent`/`--border`/`--text` custom properties) but is its own local implementation in
  `RecommendationControls.module.css` — not a shared extracted `<Tabs>` component. A reusable tabs component is a
  reasonable future extraction once a third consumer needs the same pattern, not before (`frontend_conventions.md`
  Key Principle: "Reusable Components: Build small, composable pieces" — extract when reused, not speculatively).
- **Existing test migration is substantial and must be done as part of this spec, not left broken.** A search of
  `RecommendationControls.test.tsx` found **70+ lines** across roughly nine requirement-ID groups
  (`FRONTEND-011`, `-027`, `-030`, `-033`, `-035`, `-040`) that select a mode via
  `screen.getByLabelText(/^automatic/i)`, `/specific series/i`, `/genre & keyword/i`, `/popular right now/i`, or
  `/highest rated/i`, and assert `.toBeChecked()`/`.not.toBeChecked()`. None of these queries or assertions
  survive the radio→tab change unmodified. The systematic replacement:
  - `getByLabelText(/^automatic/i)` and `getByLabelText(/specific series/i)` → both collapse to
    `screen.getByRole('tab', { name: /use my series/i })`
  - `getByLabelText(/genre & keyword/i)` → first ensure Discover is active, then
    `screen.getByRole('tab', { name: /custom search/i })`
  - `getByLabelText(/popular right now/i)` / `getByLabelText(/highest rated/i)` → same pattern, `{ name: /popular
    right now/i }` / `{ name: /highest rated/i }`, under the Discover sub-tablist
  - `.toBeChecked()` / `.not.toBeChecked()` → `.toHaveAttribute('aria-selected', 'true'/'false')`, or the RTL
    `getByRole('tab', { name: ..., selected: true })` shorthand
  This is a mechanical but real migration effort, not a footnote — budget for it explicitly rather than
  discovering the full scope mid-implementation.

---

## Requirement 1: Merge "Automatic" and "Specific Series" into "Use My Series"

**User story**: As a user, I want one clear option for "recommend based on my own tracked shows," with the
choice to optionally narrow which shows count, rather than two separately-named modes for what is really the same
thing with or without a selection.

### FRONTEND-042-AC-01 [AUTO]
**Statement**: The `RecommendationControls` mode selector shall offer a single "Use My Series" tab in place of
today's separate "Automatic" and "Specific Series" options.

**References**: `RecommendationControls.tsx`'s current `source-mode-automatic`/`source-mode-specific` radios.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-01: Automatic and Specific Series merge into Use My Series', () => {
  it('renders a single Use My Series tab, no separate Automatic/Specific Series options', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    expect(screen.getByRole('tab', { name: /use my series/i })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^automatic$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^specific series$/i })).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: replace the two radios with one `role="tab"` button; `state.mode` narrows to
`'useMySeries' | 'discover'`.

---

### FRONTEND-042-AC-02 [AUTO]
**Statement**: While "Use My Series" is the active tab, the Specific Series picker section (genre/status filters,
sort control, series `KeywordPicker`, "Show all series" button) shall always render, regardless of whether any
series are currently selected.

**References**: `frontend_spec_035_specific_series_picker.md` (the picker being made unconditional here).

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-02: the series picker is always visible under Use My Series', () => {
  it('renders the picker with nothing selected', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    expect(await screen.findByLabelText(/^series$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show all series/i })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: drop the `state.mode === 'specific'` guard around the picker block; render it whenever
`state.mode === 'useMySeries'`.

---

### FRONTEND-042-AC-03 [AUTO]
**Statement**: The "Use My Series" panel shall render explanatory copy clarifying that narrowing to specific
series is optional, and that leaving it empty uses the automatic (top-rated completed shows) pool.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-03: optional-narrowing hint text', () => {
  it('explains the picker is optional', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    expect(screen.getByText(/optional/i)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add a static hint/legend string to the panel.

---

### FRONTEND-042-AC-04 [AUTO]
**Statement**: When "Use My Series" is active and no series are selected, `onQueryChange` shall be called with a
query containing no `seriesIds` field — byte-identical to today's "Automatic" behavior.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-04: empty selection behaves exactly like today\'s Automatic', () => {
  it('omits seriesIds when nothing is selected', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    onQueryChange.mockClear()

    fireEvent.click(screen.getByRole('tab', { name: /use my series/i }))

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.not.objectContaining({ seriesIds: expect.anything() }),
    )
  })
})
```
**Test Case (Green)**: `applySourceModeQuery` sends `seriesIds` only when `state.selectedSeriesIds.length > 0`,
unchanged from today's logic, now under the `'useMySeries'` mode name.

---

### FRONTEND-042-AC-05 [AUTO]
**Statement**: When "Use My Series" is active and one or more series are selected, `onQueryChange` shall be
called with `seriesIds` set to those ids — byte-identical to today's "Specific Series" behavior.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-05: a selection behaves exactly like today\'s Specific Series', () => {
  it('sends seriesIds once a series is picked', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    await screen.findByLabelText(/^series$/i)

    fireEvent.change(screen.getByLabelText(/^series$/i), { target: { value: 'Show' } })
    fireEvent.click(await screen.findByText('Show'))
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ seriesIds: ['1'] }),
    )
  })
})
```
**Test Case (Green)**: no logic change beyond the rekeyed conditionals in Design Decisions — `seriesIds` is still
only ever populated from `state.selectedSeriesIds`.

---

## Requirement 2: Group Genre & Keyword / Popular Right Now / Highest Rated under "Discover"

**User story**: As a user, I want the three modes that don't use my tracked shows grouped together under one
clearly-labeled parent, since they're conceptually the same kind of thing (TMDB catalog browsing).

### FRONTEND-042-AC-06 [AUTO]
**Statement**: The `RecommendationControls` mode selector shall offer a second top-level tab, "Discover", in
place of today's three separate "Genre & Keyword"/"Popular Right Now"/"Highest Rated" options.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-06: Discover replaces the three flat options', () => {
  it('renders a Discover tab, no separate top-level options for the three sub-modes', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    expect(screen.getByRole('tab', { name: /^discover$/i })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /genre & keyword/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^popular right now$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^highest rated$/i })).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the "Discover" top-level tab; the three former modes move to a nested tablist.

---

### FRONTEND-042-AC-07 [AUTO]
**Statement**: While "Discover" is the active top-level tab, a second-level tablist shall render with three tabs:
"Custom Search", "Popular Right Now", "Highest Rated".

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-07: Discover reveals its three sub-tabs', () => {
  it('shows the sub-tablist only once Discover is active', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    expect(screen.queryByRole('tab', { name: /custom search/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))

    expect(screen.getByRole('tab', { name: /custom search/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /popular right now/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /highest rated/i })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: nested `role="tablist"` rendered conditionally on `state.mode === 'discover'`, defaulting
`state.discoverMode` to `'customSearch'` on first entry.

---

### FRONTEND-042-AC-08 [AUTO]
**Statement**: "Custom Search" shall be functionally identical to today's "Genre & Keyword" mode — the same
genre checkboxes, keyword picker, empty-selection hint text, and `genres`/`keywords` query fields — renamed only.

**References**: former `state.mode === 'genre'` behavior, unchanged.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-08: Custom Search behaves exactly like former Genre & Keyword', () => {
  it('renders genre checkboxes and a keyword picker, sends genres/keywords', async () => {
    mockGetGenreOptions.mockResolvedValue(['Comedy'])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)

    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /custom search/i }))
    await screen.findByLabelText(/comedy/i)

    fireEvent.click(screen.getByLabelText(/comedy/i))
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ genres: ['Comedy'] }),
    )
  })
})
```
**Test Case (Green)**: rekey the genre/keyword fields' visibility condition to `state.mode === 'discover' &&
state.discoverMode === 'customSearch'`; no change to `applySourceModeQuery`'s `genres`/`keywords` logic.

---

### FRONTEND-042-AC-09 [AUTO]
**Statement**: "Popular Right Now" shall be functionally identical to today's "Popular Right Now" mode — the
Trending Window (Day/Week) sub-fieldset, `sourceMode: 'trending'`, Sort By hidden — renamed and re-nested only.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-09: Popular Right Now behavior is unaffected by the re-nesting', () => {
  it('shows the Trending Window toggle and sends sourceMode=trending', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)

    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /popular right now/i }))

    expect(screen.getByLabelText(/^day$/i)).toBeInTheDocument()
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceMode: 'trending', trendingWindow: 'week' }),
    )
  })
})
```
**Test Case (Green)**: rekey the Trending Window fieldset's condition and `applySourceModeQuery`'s
`state.mode === 'trending'` branch to the two-tier check.

---

### FRONTEND-042-AC-10 [AUTO]
**Statement**: "Highest Rated" shall be functionally identical to today's "Highest Rated" mode — including the
existing "pre-fill Min Vote Count to 200 when entering, revert to empty when leaving (unless the user already
touched it)" behavior — renamed and re-nested only.

**References**: `handleModeChange`'s `minVoteCountTouched` logic, unchanged in behavior.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-10: Highest Rated\'s minVoteCount default survives the re-nesting', () => {
  it('pre-fills 200 entering Highest Rated, clears it leaving', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /highest rated/i }))
    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(200)

    fireEvent.click(screen.getByRole('tab', { name: /use my series/i }))
    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(null)
  })
})
```
**Test Case (Green)**: rekey `handleModeChange`'s `mode === 'topRated'`/`state.mode === 'topRated'` checks to the
two-tier equivalent (`discoverMode === 'topRated'` on entry; previous state was `discover`+`topRated` on exit).

---

### FRONTEND-042-AC-11 [AUTO]
**Statement**: Entering "Highest Rated" or "Custom Search" shall reset `discoverSortBy` to that sub-mode's own
default (`vote_average.desc` / `popularity.desc` respectively) exactly as today; "Popular Right Now" shall
continue to hide the Sort By section entirely.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-11: discoverSortBy defaults survive the re-nesting', () => {
  it('resets to popularity.desc entering Custom Search from a non-default Highest Rated selection', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /highest rated/i }))
    fireEvent.click(screen.getByLabelText(/most voted/i))

    fireEvent.click(screen.getByRole('tab', { name: /custom search/i }))

    expect(screen.getByLabelText(/most popular/i)).toBeChecked()
  })
})
```
**Test Case (Green)**: rekey `handleModeChange`'s `mode === 'topRated' || mode === 'genre'` check to
`discoverMode === 'topRated' || discoverMode === 'customSearch'`.

---

## Requirement 3: Tab-style selector — WAI-ARIA Tabs pattern, in-flight locking preserved

**User story**: As a user, I want the source selector to look and behave like a proper tab control (matching the
rest of the app's new nav styling), while keeping the exact request-firing and locking behavior it has today.

### FRONTEND-042-AC-12 [AUTO]
**Statement**: The top-level selector shall use `role="tablist"` containing two `role="tab"` elements, each with
`aria-selected` reflecting the active tab and `aria-controls` referencing its `role="tabpanel"`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-12: top-level selector uses the Tabs ARIA pattern', () => {
  it('marks the active tab via aria-selected', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)

    expect(screen.getByRole('tab', { name: /use my series/i, selected: true })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^discover$/i, selected: false })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: implement the tablist/tab/tabpanel triad with `aria-selected`/`aria-controls`/`id`
wiring.

---

### FRONTEND-042-AC-13 [AUTO]
**Statement**: The Discover sub-selector shall likewise use a nested `role="tablist"`/`role="tab"` pair, wired
the same way as the top-level tablist.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-13: Discover sub-selector uses the Tabs ARIA pattern', () => {
  it('marks the active sub-tab via aria-selected', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))

    expect(screen.getByRole('tab', { name: /custom search/i, selected: true })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /popular right now/i, selected: false })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: same pattern as AC-12, nested one level.

---

### FRONTEND-042-AC-14 [AUTO]
**Statement**: Clicking a different top-level or sub-level tab shall call `onQueryChange` immediately — the
"Recommendation Source" exemption from Apply-Filters gating (`frontend_spec_040`) is preserved unchanged.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-14: mode changes still auto-fetch (frontend_spec_040 preserved)', () => {
  it('fires onQueryChange immediately on a top-level tab change', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    onQueryChange.mockClear()

    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))

    expect(onQueryChange).toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: `handleModeChange` (adapted for the two-tier state) remains the handler for both tiers,
unchanged in its immediate-fetch behavior.

---

### FRONTEND-042-AC-15 [AUTO]
**Statement**: Clicking the already-active top-level or sub-level tab shall not call `onQueryChange` again.

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-15: re-clicking the active tab is a no-op', () => {
  it('does not re-fire onQueryChange for the already-active tab', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    onQueryChange.mockClear()

    fireEvent.click(screen.getByRole('tab', { name: /use my series/i }))

    expect(onQueryChange).not.toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: `handleModeChange` returns early (no state update, no `onQueryChange` call) when the
clicked tab equals the current `mode`/`discoverMode`.

---

### FRONTEND-042-AC-16 [AUTO]
**Statement**: While `loading` is `true`, every tab at both tiers shall be `disabled`, exactly matching today's
`disabled={loading}` behavior on the five flat radios (`frontend_spec_040`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-042-AC-16: all tabs disabled while loading', () => {
  it('disables both tiers of tabs', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={true} />)

    expect(screen.getByRole('tab', { name: /use my series/i })).toBeDisabled()
    expect(screen.getByRole('tab', { name: /^discover$/i })).toBeDisabled()
  })
})
```
**Test Case (Green)**: `disabled={loading}` on every `role="tab"` `<button>`, both tiers.

---

## Requirement 4: Visual consistency with the global nav

**User story**: As a user, I want this selector to look like it belongs to the same app as the new menu bar, not
a visually unrelated control bolted on afterward.

### FRONTEND-042-AC-17 [MANUAL]
**Statement**: When viewed in a real browser in both light and dark `prefers-color-scheme`, the tab selector
(both tiers) shall visually read as consistent with `frontend_spec_041`'s menu bar — same active-state treatment,
comparable spacing, using this app's shared `--accent`/`--border`/`--text` custom properties rather than
one-off colors.

**Verification**: Manual browser check, both themes — jsdom cannot validate real CSS rendering (this project's
established convention, see `frontend_spec_041-AC-02` for the identical precedent).

---

## Implementation Notes

- **`ControlsState.mode` type change**: `'automatic' | 'specific' | 'genre' | 'trending' | 'topRated'` →
  `'useMySeries' | 'discover'`, plus new `discoverMode: 'customSearch' | 'trending' | 'topRated'`.
  `initialState.mode` becomes `'useMySeries'`; `initialState.discoverMode` defaults to `'customSearch'`.
- **`showMinSourceRating`** (`state.mode === 'automatic' || state.mode === 'specific'`) simplifies to
  `state.mode === 'useMySeries'`.
- **`showDiscoverSortByOptions`** (`state.mode === 'topRated' || state.mode === 'genre'`) becomes `state.mode ===
  'discover' && (state.discoverMode === 'topRated' || state.discoverMode === 'customSearch')`.
- **`DISCOVER_SORT_BY_DEFAULTS`**'s keys (`'topRated' | 'genre'`) become `'topRated' | 'customSearch'`.
- See Design Decisions for the full rekeying list and the ~70-line existing-test migration this spec requires in
  `RecommendationControls.test.tsx`.

## Cross-References

| This spec | Source |
|---|---|
| Tab/menu-bar visual language this spec's selector matches | `frontend_spec_041_global_navigation.md` |
| "Automatic is Specific Series with nothing picked" — confirmed sourcing behavior | `RecommendationSourcingService.resolveSourcePool`/`automaticPool`, `.claude/analysis/scoring_weight_recommendations.md` |
| The three Discover sub-modes never using tracked series/scoring — confirmed behavior this grouping is based on | `.claude/analysis/scoring_weight_recommendations.md` Sections 3-4 |
| `ControlsState`/`updateState`/`onQueryChange`/Apply-Filters-gating wiring this spec restructures but preserves | `frontend_spec_011_recommendation_controls.md`, `frontend_spec_040_recommendation_controls_apply_and_lock.md` |
| Specific Series picker made unconditional under "Use My Series" | `frontend_spec_035_specific_series_picker.md` |
| Trending Window / Highest Rated `minVoteCount` default / native discover sort options preserved unchanged | `frontend_spec_027_trending_and_top_rated_controls.md`, `frontend_spec_030_discover_filters_and_sort_controls.md`, `frontend_spec_033_discover_native_sort_controls.md` |
| Future functional expansion of "Custom Search" (min vote avg/count, more `discover/tv` params) — explicitly out of scope here | `.claude/SPEC_CANDIDATES.md`, "Customizable recommendation 'algorithm'..." |

---

## Acceptance Criteria Summary

- [x] FRONTEND-042-AC-01: single "Use My Series" tab replaces Automatic/Specific Series
- [x] FRONTEND-042-AC-02: the series picker is always visible under Use My Series
- [x] FRONTEND-042-AC-03: optional-narrowing hint text renders
- [x] FRONTEND-042-AC-04: empty selection behaves exactly like today's Automatic
- [x] FRONTEND-042-AC-05: a selection behaves exactly like today's Specific Series
- [x] FRONTEND-042-AC-06: "Discover" tab replaces the three flat options
- [x] FRONTEND-042-AC-07: Discover reveals its three sub-tabs
- [x] FRONTEND-042-AC-08: "Custom Search" behaves exactly like former Genre & Keyword
- [x] FRONTEND-042-AC-09: "Popular Right Now" behavior unaffected by re-nesting
- [x] FRONTEND-042-AC-10: "Highest Rated" minVoteCount default survives re-nesting
- [x] FRONTEND-042-AC-11: discoverSortBy defaults survive re-nesting
- [x] FRONTEND-042-AC-12: top-level selector uses the Tabs ARIA pattern
- [x] FRONTEND-042-AC-13: Discover sub-selector uses the Tabs ARIA pattern
- [x] FRONTEND-042-AC-14: mode changes still auto-fetch immediately
- [x] FRONTEND-042-AC-15: re-clicking the active tab is a no-op
- [x] FRONTEND-042-AC-16: all tabs disabled while loading
- [x] FRONTEND-042-AC-17: visual consistency with the global nav (manual check, both themes)
