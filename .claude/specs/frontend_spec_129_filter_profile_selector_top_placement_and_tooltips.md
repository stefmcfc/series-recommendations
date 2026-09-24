# Frontend Spec 129: Filter Profile Selector Split Placement, Tooltips & Update Confirmation

**Status**: Not started
**Priority**: P3
**Depends on**: `frontend_spec_107_filter_profile_ui.md` (introduces `FilterProfileSelector` itself, its five current call sites, and `FRONTEND-107-AC-06`'s single-click Update behavior — superseded by this spec, see Design Decisions), `frontend_spec_108_filter_profile_management_and_save_modal.md` (introduces `describeFilterCriteria` and `SaveFilterProfileModal`, both reused/mirrored here), `frontend_spec_109_filter_profile_polish.md` (established the current bottom-of-fields placement `FRONTEND-109-AC-03`/`AC-04` describe — superseded by this spec, see Design Decisions), `frontend_spec_112_filter_profiles_custom_search_and_analysis.md` (adds the `CustomSearchPanel.tsx` wire-up and the Analysis-area `describeFilterCriteria` describer this spec's tooltip also covers for `ANALYSIS_FILTERS`; its `FRONTEND-112-AC-09` decision to hoist the selector to `AnalysisView.tsx` specifically to avoid a `NameStatsTable.tsx` instantiation is reversed by this spec, see Design Decisions)
**Area**: Frontend (`components/FilterProfileSelector.tsx`, new `hooks/useFilterProfileSelector.ts`, new `components/SavedFiltersList.tsx`, new `components/FilterProfileActions.tsx`, new `components/UpdateFilterProfileModal.tsx`, `components/SearchFilter.tsx`, `components/UseMySeriesPanel.tsx`, `components/RecommendationFiltersBox.tsx`, `components/CustomSearchPanel.tsx`, `components/NameStatsTable.tsx`, `components/AnalysisView.tsx` — plus each of those components' colocated `*.test.tsx`)

## Overview

This spec revises an earlier, never-implemented version of itself (see history note at the bottom of this Overview) after live discussion changed the target layout. Three changes to the "Saved Filters" picker, bundled together because all three touch the same component and its five call sites in one pass:

1. **`FilterProfileSelector` splits into two pieces sharing one hook instance.** Today it's a single component rendering, top to bottom: a "Saved Filters" chip list, then a Save/Update Filters button row. Splitting it lets each of the five host areas place the chip list at the *top* of its filters (before any individual field) while the Save/Update buttons stay adjacent to that area's own submit/reset row at the *bottom* — "saved filters first, then the filters, then the CTAs," rather than moving the whole block to one end. A new `useFilterProfileSelector` hook holds the shared state (fetched profiles, which one's selected, modal open/closed) so the two rendered pieces — `SavedFiltersList` and `FilterProfileActions` — stay in sync without a second fetch or a second `selectedId`.
2. **The Analysis area gets both pieces inside its "Analysis Filters" box for the first time.** Today `AnalysisView.tsx` renders the whole (pre-split) `FilterProfileSelector` standalone, entirely outside `NameStatsTable.tsx`'s collapsible box — always visible regardless of the box's collapsed state, the only one of the five areas with that property. `SavedFiltersList` and `FilterProfileActions` move inside the box, bookending its existing fields, resolving that inconsistency as a side effect.
3. **"Update Filters" now confirms before overwriting, and lets the name be changed.** Today, clicking Update Filters immediately overwrites the selected profile's saved criteria with no confirmation, keeping its old name unchanged — so a profile named "Min 5 series" can silently become "Min 10 series" in meaning, with no prompt and no misclick protection. A new `UpdateFilterProfileModal` (mirroring the existing `SaveFilterProfileModal`'s shell) opens instead, showing the profile's current name pre-filled in an editable field plus a line noting the saved filters will be overwritten, with Cancel/Update actions.

**History**: an earlier version of this spec (implemented never, so safely rewritten rather than superseded — grep confirms no file besides this one ever referenced a `FRONTEND-129-AC-*` ID) planned to move the *whole* pre-split `FilterProfileSelector` block from the bottom of each area to the top, as one unit, plus the tooltip change in point 2 above (carried forward unchanged as Requirement 3 below). That plan is replaced by the split described above; the tooltip requirement is untouched by the split and kept as-is.

## Design Decisions

- **A hook, not two independently-fetching components.** `SavedFiltersList` and `FilterProfileActions` must agree on which profile is selected and share the same fetched `profiles` array — two separate `useEffect(() => seriesApi.listFilterProfiles(...))` calls would double the network request and risk the two halves disagreeing (e.g. a profile added via `FilterProfileActions`'s save modal not appearing in `SavedFiltersList`'s chips without a second round-trip). Extracting the existing state/handlers into `useFilterProfileSelector` and calling it exactly once per host, passing its return value into both pieces as props, keeps one source of truth — the same reasoning `frontend_spec_112`'s original "one shared instance" decision for Analysis already used, just applied one level down.
- **Chip-list placement moves; button-row placement mostly doesn't.** For `SearchFilter`/`UseMySeriesPanel`/`RecommendationFiltersBox`/`CustomSearchPanel`, `FilterProfileActions` stays exactly where the pre-split component already renders today (immediately before each area's own Search/Clear/Reset-equivalent row) — only `SavedFiltersList` is new at the top. This is deliberately a smaller change than the original spec's "move everything" plan: the Save/Update buttons already read naturally as the last thing before an area's other action buttons, and moving them too would have no stated benefit over leaving them.
- **Analysis is the one area where both halves are net-new inside the box**, because today neither half is inside `NameStatsTable.tsx`'s "Analysis Filters" box at all — the whole thing sits outside it, in `AnalysisView.tsx`. Placing `SavedFiltersList` first and `FilterProfileActions` last (immediately before the existing Reset Filters/Apply Filters row) gives Analysis the exact "saved filters, then filters, then CTAs" shape the other four areas get from combining "list moves, actions don't."
- **The "one shared Analysis instance" tradeoff, adapted from the original spec, still applies and is still accepted.** Only one `NameStatsTable` is ever mounted at a time (`AnalysisView.tsx` renders its three tabs mutually exclusively), so per-tab-switch state reset (a fresh `useFilterProfileSelector` instance — new fetch, `selectedId` reset) was never literally "three simultaneous instances," just a repeated one. This spec accepts that repeated cost for consistent placement across all five areas, same as the original — the filter *values* persist across tab switches via the shared `useNameStatsFilters()` hook regardless; only the "which chip reads as applied" visual resets.
- **`sharedStyles.filterFullWidthRow` wrapper still required for `NameStatsTable.tsx`, `UseMySeriesPanel.tsx`, and `RecommendationFiltersBox.tsx`.** Their `.filtersBody` (`RecommendationControls.module.css`, shared by all three) is a CSS grid (`grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr))`); without the wrapper (`grid-column: 1 / -1`) either piece would render as a single cramped grid cell. `SearchFilter.tsx` (flex column) and `CustomSearchPanel.tsx` (plain block flow) need no such wrapper, matching their current unwrapped renders.
- **`FilterProfileSelector.tsx` itself is retired, not kept as a third wrapper component.** Nothing needs "the whole block as one unit" anymore — every consumer wants the two pieces at two different DOM positions. Keeping the old component around as a thin composer of both pieces would be dead code the moment this spec ships; deleting it and its test file (superseding their content into `useFilterProfileSelector.test.ts`/`SavedFiltersList.test.tsx`/`FilterProfileActions.test.tsx`) avoids maintaining an unused path.
- **`data-testid="filter-profile-selector"` moves to `SavedFiltersList`'s root, not `FilterProfileActions`'s.** Existing tests across all five host `*.test.tsx` files locate the picker via this testid before asserting on chip content — that behavior (find the list, click a chip) is what `SavedFiltersList` now owns. `FilterProfileActions` gets its own new testid (`filter-profile-actions`) for tests that specifically target Save/Update.
- **Tooltip reuses `describeFilterCriteria` + native `title`, not a new component** (unchanged from the original spec). `FilterProfileAreaGroup.tsx` (Settings) already turns `describeFilterCriteria(area, profile.criteria)` into a rendered `<ul>` of `{label}: {value}` for its click-to-expand summary; the pre-split `FilterProfileSelector.tsx` already uses a conditional `title` attribute for hover-explanation text on its disabled Save button. The tooltip is the same describer feeding the same idiom onto the saved-profile chip, now inside `SavedFiltersList`.
- **Empty description means no `title`, not an empty string** (unchanged). `title=""` is present-but-blank and some assistive tech/browsers still announce an empty tooltip region; `undefined` omits the attribute entirely.
- **`UpdateFilterProfileModal` is a new, separate component, not a `mode` prop on `SaveFilterProfileModal`.** The two differ enough in behavior to make a shared parameterized component more confusing than two small parallel ones: `SaveFilterProfileModal` creates a new profile and must handle a 409 "name already exists" conflict from the *creation* race; `UpdateFilterProfileModal` updates an existing one and must exclude that same profile's own current name from its duplicate check (`validateFilterProfileName`'s existing `currentName` exclusion parameter, already used by `FilterProfileAreaGroup.tsx`'s Settings-side rename flow). This mirrors the codebase's existing precedent of small parallel modals with the same shell (e.g. `UseMySeriesPanel.tsx`'s "Browse Series"/"Browse Keywords" modals) rather than introducing the first parameterized one.
- **`FRONTEND-107-AC-06` (`frontend_spec_107`) is superseded, not deleted.** Its statement ("update overwrites the selected profile" on a single click) is left in `frontend_spec_107.md` as an immutable historical record, but the behavior it describes is replaced by `FRONTEND-129-AC-07`/`AC-08` below. `FilterProfileSelector.test.tsx`'s existing `FRONTEND-107-AC-06` test (asserts `updateFilterProfile` is called directly on a single click) asserts the *opposite* of the new behavior and must be rewritten as part of this spec, not left alongside it — same handling `frontend_spec_129`'s original version already applied to `FRONTEND-109-AC-03`/`AC-04`.
- **No backend change needed.** `seriesApi.updateFilterProfile<TCriteria>(id, patch: { name?: string; criteria?: TCriteria })` (`services/seriesApi.ts` lines 481-487) already accepts an optional `name` alongside `criteria` in one `PATCH /filter-profiles/{id}` call — `FilterProfileAreaGroup.tsx`'s existing Settings-side rename flow already sends `{ name }` alone today. This spec just sends both fields together from a different call site.

---

## Requirement 1: `FilterProfileSelector`'s state and logic move into a shared hook

**User story**: As a developer wiring the Saved Filters picker into a new area, I want one hook that owns fetching/selection/modal state, so the chip list and the action buttons can render in two different places without duplicating logic or drifting out of sync.

### FRONTEND-129-AC-01 [AUTO]
**Statement**: A new `useFilterProfileSelector<TCriteria>({ area, currentCriteria, onApply, onClear, disabled })` hook shall own: fetching `profiles` via `seriesApi.listFilterProfiles(area)` on mount and whenever `area`/`disabled` change (skipped entirely while `disabled`); `selectedId` and the `handleSelect`/toggle-off logic currently in `FilterProfileSelector.tsx`; `hasActiveCriteria` (via `describeFilterCriteria(area, currentCriteria).length > 0`); `saveModalOpen`/`handleSaveFromModal` (`seriesApi.createFilterProfile`, appends to `profiles`, closes the modal); and the new `updateModalOpen`/`handleUpdateConfirm` pair from Requirement 4 below. The hook shall return all of these plus `actionError` and the currently-selected profile object, for consumption by `SavedFiltersList` and `FilterProfileActions`.

**Rationale**: One fetch, one `selectedId`, one modal-open flag — shared by reference between two rendered pieces instead of duplicated.

**References**:
- `components/FilterProfileSelector.tsx` (current, to be retired): lines 44-68 (fetch effect), 77-104 (`handleSelect`), 106-118 (`handleSaveFromModal`), 120-126 (`hasActiveCriteria`), 128-141 (`handleUpdate`, to be replaced per Requirement 4).
- New file: `frontend/src/hooks/useFilterProfileSelector.ts`.

**Test Case (Red)**:
```typescript
// hooks/useFilterProfileSelector.test.ts
describe('FRONTEND-129-AC-01: useFilterProfileSelector shares one fetch/selection state', () => {
  it('fetches profiles once for the given area and exposes them', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      { id: '1', area: 'MY_SERIES', name: 'Weeknight', criteria: {}, createdAt: '', updatedAt: '' },
    ])
    const { result } = renderHook(() =>
      useFilterProfileSelector({
        area: 'MY_SERIES',
        currentCriteria: {},
        onApply: vi.fn(),
      }),
    )
    await waitFor(() => expect(result.current.profiles).toHaveLength(1))
    expect(seriesApi.listFilterProfiles).toHaveBeenCalledTimes(1)
  })

  it('does not fetch while disabled', () => {
    const listSpy = vi.spyOn(seriesApi, 'listFilterProfiles')
    renderHook(() =>
      useFilterProfileSelector({
        area: 'MY_SERIES',
        currentCriteria: {},
        onApply: vi.fn(),
        disabled: true,
      }),
    )
    expect(listSpy).not.toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: extract the referenced logic into the new hook file, typed identically to the current component's internals.

---

## Requirement 2: Saved Filters list renders at the top; Save/Update actions stay adjacent to each area's own action row

**User story**: As a user opening any filters panel, I want the Saved Filters picker to be the first thing I see (a shortcut past individual fields), and the Save/Update buttons to stay where the app's other filter actions already are, so applying a preset and fine-tuning/saving feel like two separate, clearly-ordered steps rather than one undifferentiated block.

### FRONTEND-129-AC-02 [AUTO]
**Statement**: The `SearchFilter`, `UseMySeriesPanel`, `RecommendationFiltersBox`, and `CustomSearchPanel` components shall each call `useFilterProfileSelector` once and render `SavedFiltersList` as the first element of their filters area (before any individual filter field), while continuing to render `FilterProfileActions` at the same position the pre-split `FilterProfileSelector` occupies today (immediately before that area's own Search/Clear/Reset-equivalent row).

**Rationale**: Splits "jump to a preset" (top) from "save/update what I've configured" (bottom, beside the area's other action buttons) instead of treating them as one block that has to live in one place.

**References**:
- `components/SearchFilter.tsx`: `filtersBody` opens at line 436, immediately followed by the "Genres & Keywords" `<section>` (line 437) — `SavedFiltersList` (area `MY_SERIES`) inserted here, as the new first child. `FilterProfileActions` replaces today's `FilterProfileSelector` call at lines 736-741 (immediately before `<div className={styles.actions}>` at line 743) — same position, same props (`currentCriteria={buildCriteria(form)}`, `onApply={handleApplyProfile}`, `onClear={handleClearForm}`).
- `components/UseMySeriesPanel.tsx`: `filtersBody` opens at lines 324-327, immediately followed by the "Filter by Status" `<fieldset>` (line 333) — `SavedFiltersList` (area `USE_MY_SERIES`) inserted here. `FilterProfileActions` replaces today's call at lines 641-648 (wrapped in `styles.filterFullWidthRow`, immediately before `<div className={styles.filtersActions}>` at line 654) — same wrapper, same position, same props (`currentCriteria={currentUseMySeriesCriteria}`, `onApply={applyUseMySeriesFilterCriteria}`, `onClear={handleClearSpecificSeriesFilters}`).
- `components/RecommendationFiltersBox.tsx`: `filtersBody` opens at line 193, immediately followed by the conditionally-rendered (`!isCustomSearch`) Min TMDB Rating field (line 194) — `SavedFiltersList` (area `RECOMMENDATION_FILTERS`, `disabled={isCustomSearch}`) inserted here, unconditionally (the existing `disabled` prop already handles the Custom Search case). `FilterProfileActions` replaces today's call at lines 336-344 (wrapped in `styles.filterFullWidthRow`, immediately before `<div className={styles.filtersActions}>` at line 346) — same wrapper, same position, same props including `disabled={isCustomSearch}`.
- `components/CustomSearchPanel.tsx`: filters area opens with a hint `<p>` (lines 116-119) then `<div className={styles.genreKeywordFields}>` (line 121) — `SavedFiltersList` (area `CUSTOM_SEARCH`) inserted between them. `FilterProfileActions` replaces today's call at lines 265-270 (immediately before `<div className={styles.filtersActions}>` at line 272) — same position, same props (`currentCriteria={currentCustomSearchCriteria}`, `onApply={(criteria) => updateState(criteria)}`, `onClear={handleClearCustomSearchFilters}`).
- Superseded placement ACs: `FRONTEND-109-AC-03` (`frontend_spec_109_filter_profile_polish.md`), `FRONTEND-109-AC-04` (same spec) — the bottom-of-fields placement they assert no longer describes where the chip list renders (it still describes where `FilterProfileActions` renders, which is unchanged).
- Tests to update (not just add to), since they assert placement now reversed for the chip list specifically: `SearchFilter.test.tsx`'s `FRONTEND-109-AC-03` describe block (currently asserts the whole picker follows the last field), `UseMySeriesPanel.test.tsx`'s `FRONTEND-109-AC-04` describe block (same shape) — both narrow to asserting `SavedFiltersList`'s position only; a new, separate assertion confirms `FilterProfileActions` still precedes the Search/Clear/Reset row.

**Test Case (Red)**:
```typescript
// SearchFilter.test.tsx
describe('FRONTEND-129-AC-02: Saved Filters list at top, actions stay at bottom, in SearchFilter', () => {
  it('renders SavedFiltersList before the Genres & Keywords section', async () => {
    render(<SearchFilter isOpen onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)
    const body = screen.getByTestId('filters-body')
    const list = await screen.findByTestId('filter-profile-selector')
    const genresHeading = screen.getByText('Genres & Keywords')
    expect(body.contains(list)).toBe(true)
    expect(
      list.compareDocumentPosition(genresHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('still renders FilterProfileActions immediately before the Search/Clear/Reset row', async () => {
    render(<SearchFilter isOpen onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)
    const actions = await screen.findByTestId('filter-profile-actions')
    const clearButton = screen.getByTestId('clear-filters-btn')
    expect(
      actions.compareDocumentPosition(clearButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
```
**Test Case (Green)**: in each of the four files, replace the single `FilterProfileSelector` call with one `useFilterProfileSelector(...)` call plus a `SavedFiltersList` render at the top and a `FilterProfileActions` render at the existing bottom position, both fed from the hook's return value.

---

### FRONTEND-129-AC-03 [AUTO]
**Statement**: The `NameStatsTable` component shall call `useFilterProfileSelector` once (area `ANALYSIS_FILTERS`, wrapped values `currentCriteria={{ ...filters.filterInputs, sortBy: filters.sortBy, sortDirection: filters.sortDirection }}`, `onApply={filters.applyFilterProfile}`, `onClear={filters.clearFilterProfile}`) and render `SavedFiltersList` (wrapped in `sharedStyles.filterFullWidthRow`) as the first child of its `filtersBody`, and `FilterProfileActions` (same wrapper) immediately before its existing Reset Filters/Apply Filters row. The `AnalysisView` component shall no longer render any part of the Saved Filters picker, nor compute a `currentAnalysisFiltersCriteria` value.

**Rationale**: Gives Analysis the same "list first, fields, actions last" shape the other four areas get, folding it into the collapsible box for the first time and resolving its standing inconsistency (previously the only area whose picker ignored the box's collapsed state) as a side effect.

**References**:
- `components/NameStatsTable.tsx`: `filtersBody` opens at line 138, immediately followed by the "Min Series Count" field (lines 139-151) — `SavedFiltersList` inserted here, as the new first child. The existing Reset Filters/Apply Filters row opens at line 197 — `FilterProfileActions` inserted immediately before it.
- `components/NameStatsTable.tsx`'s `NameStatsTableProps` already exposes `filters: NameStatsFiltersState`, carrying `filterInputs`/`sortBy`/`sortDirection`/`applyFilterProfile`/`clearFilterProfile` — no new prop needed.
- `components/AnalysisView.tsx`: remove the (pre-split) `FilterProfileSelector` import (line 6), the `AnalysisFilterCriteria` type import (line 8, unused once the computation below is gone), the `currentAnalysisFiltersCriteria` computation (lines 41-45), and the render (lines 64-69).
- `NameStatsTable.test.tsx` does not currently `vi.mock('../services/seriesApi')` — adding the hook means it now calls `seriesApi.listFilterProfiles` on mount, so the mock must be added (mirroring `RecommendationFiltersBox.test.tsx`'s existing `FRONTEND-107-AC-11` comment for why).
- `AnalysisView.test.tsx`'s existing `FRONTEND-112-AC-09` describe block asserts exactly one `filter-profile-selector` testid exists and that applying a profile's criteria survives a tab switch — both assertions still hold (only one `NameStatsTable` is ever mounted at a time, and applied filter values live in the shared hook, not the picker instance — see Design Decisions), but the block needs updating to open the "Analysis Filters" toggle before the testid is queryable (now gated behind the collapse, unlike today).

**Test Case (Red)**:
```typescript
// NameStatsTable.test.tsx
describe('FRONTEND-129-AC-03: Saved Filters list and actions bookend the fields in NameStatsTable', () => {
  it('renders the list before Min Series Count and actions before Reset Filters, once expanded', async () => {
    vi.mocked(seriesApi.listFilterProfiles).mockResolvedValue([])
    render(<Harness fetchStats={vi.fn().mockResolvedValue([])} />)
    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))

    const body = screen.getByTestId('filters-body')
    const list = await screen.findByTestId('filter-profile-selector')
    const actions = await screen.findByTestId('filter-profile-actions')
    const minSeriesCountField = screen.getByLabelText('Min Series Count')
    const resetButton = screen.getByTestId('reset-filters-btn')

    expect(body.contains(list)).toBe(true)
    expect(
      list.compareDocumentPosition(minSeriesCountField) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      minSeriesCountField.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      actions.compareDocumentPosition(resetButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

// AnalysisView.test.tsx
describe('FRONTEND-129-AC-03: AnalysisView no longer renders its own picker', () => {
  it('renders no filter-profile-selector until the Analysis Filters panel is expanded', async () => {
    renderAnalysisView('/analysis/keywords')
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    expect(screen.queryByTestId('filter-profile-selector')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    expect(await screen.findByTestId('filter-profile-selector')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add `vi.mock('../services/seriesApi')` to `NameStatsTable.test.tsx`; insert the wrapped `SavedFiltersList`/`FilterProfileActions` at the two positions above; delete `AnalysisView.tsx`'s own render/computation/now-unused imports; update `AnalysisView.test.tsx`'s `FRONTEND-112-AC-09` block to open the toggle first.

---

## Requirement 3: hover tooltip explains what a saved filter contains

**User story**: As a user looking at a list of saved-filter chips by name only (e.g. "Crime/Drama"), I want to hover one and see what it actually filters by, without applying it first to find out.

### FRONTEND-129-AC-04 [AUTO]
**Statement**: Where a saved profile's `describeFilterCriteria(area, profile.criteria)` returns at least one entry, `SavedFiltersList` shall set that profile's chip `title` attribute to those entries joined as `"{label}: {value}"` per line; where it returns zero entries, the chip's `title` attribute shall be omitted (`undefined`).

**Rationale**: Reuses the exact description data already shown in Settings, surfaced as a lightweight native hover tooltip right where the user picks a preset.

**References**:
- New `components/SavedFiltersList.tsx` (extracted from `FilterProfileSelector.tsx` lines 149-167, the saved-profile `<button>`s), plus the existing conditional-`title` idiom on the pre-split component's Save button (lines 182-186) this AC mirrors.
- `utils/describeFilterCriteria.ts`'s `describeFilterCriteria(area, criteria): CriteriaDescriptionEntry[]` (`{ label, value }[]`).
- Precedent: `components/FilterProfileAreaGroup.tsx` (Settings), rendering the same describer's output as a `<ul><li><strong>{entry.label}:</strong> {entry.value}</li></ul>` expand-on-click summary — this AC flattens the same entries into one `title` string instead.

**Test Case (Red)**:
```typescript
// SavedFiltersList.test.tsx
describe('FRONTEND-129-AC-04: saved-filter chips show a description tooltip on hover', () => {
  it('sets the title attribute from describeFilterCriteria entries', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Crime/Drama',
        criteria: { genres: ['Crime', 'Drama'], minImdbRating: '7' },
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(<SavedFiltersListHarness area="MY_SERIES" />)
    const chip = await screen.findByText('Crime/Drama')
    expect(chip).toHaveAttribute('title', 'Genres: Crime, Drama\nMin IMDb Rating: 7')
  })

  it('omits the title attribute when the profile has no describable criteria', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      { id: '1', area: 'MY_SERIES', name: 'Empty', criteria: {}, createdAt: '', updatedAt: '' },
    ])
    render(<SavedFiltersListHarness area="MY_SERIES" />)
    const chip = await screen.findByText('Empty')
    expect(chip).not.toHaveAttribute('title')
  })
})
```
**Test Case (Green)**: in `SavedFiltersList.tsx`'s per-profile chip, compute `const entries = describeFilterCriteria(area, profile.criteria)` and add `title={entries.length > 0 ? entries.map((e) => \`${e.label}: ${e.value}\`).join('\\n') : undefined}`.

---

## Requirement 4: Update Filters confirms before overwriting, with an editable name

**User story**: As a user who's changed a filter after applying a saved preset, I want clicking "Update Filters" to confirm what's about to happen and let me rename the preset if its old name no longer fits, instead of silently overwriting it on one click.

### FRONTEND-129-AC-05 [AUTO]
**Statement**: While a saved profile is selected/applied, clicking "Update Filters" (rendered by `FilterProfileActions`) shall open a new `UpdateFilterProfileModal` instead of calling `seriesApi.updateFilterProfile` directly.

**Rationale**: Guards against a misclick immediately overwriting a saved profile with no chance to reconsider.

**References**:
- `FilterProfileActions` (extracted from `FilterProfileSelector.tsx` lines 191-199, the Update Filters button) — `onClick` changes from directly invoking `handleUpdate` to `setUpdateModalOpen(true)` (state now owned by `useFilterProfileSelector`, per `FRONTEND-129-AC-01`).
- Supersedes `FRONTEND-107-AC-06`'s single-click-update statement (`frontend_spec_107_filter_profile_ui.md`) — see this spec's Design Decisions.
- Test to rewrite (asserts the behavior being reversed): `FilterProfileSelector.test.tsx`'s `FRONTEND-107-AC-06` describe block ("update overwrites the selected profile," currently asserts `updateFilterProfile` is called synchronously on click) — moves to `FilterProfileActions.test.tsx`, rewritten to assert the modal opens instead, with `FRONTEND-129-AC-07`/`AC-08` below covering the actual update call.

**Test Case (Red)**:
```typescript
// FilterProfileActions.test.tsx
describe('FRONTEND-129-AC-05: Update Filters opens a confirmation modal', () => {
  it('does not call updateFilterProfile until the modal is confirmed', async () => {
    const updateSpy = vi.spyOn(seriesApi, 'updateFilterProfile')
    render(<FilterProfileActionsHarness selectedProfile={{ id: '1', name: 'Weeknight', criteria: {} }} />)
    fireEvent.click(screen.getByRole('button', { name: /update filters/i }))
    expect(await screen.findByRole('dialog', { name: /update filter profile/i })).toBeInTheDocument()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: wire the button's `onClick` to open the modal; render `<UpdateFilterProfileModal>` conditionally on the hook's `updateModalOpen`.

---

### FRONTEND-129-AC-06 [AUTO]
**Statement**: `UpdateFilterProfileModal` shall render a heading ("Update Filter Profile"), a `name` field pre-filled with the selected profile's current name (editable), a line of body text noting the update will overwrite the profile's saved filters, and Cancel/Update actions — mirroring `SaveFilterProfileModal`'s existing shell (`.overlay > .dialog[role="dialog"][aria-modal="true"][aria-labelledby]`, `useEscapeToClose`, `<h2>` heading, `.dialogActions` footer). Before submitting, the entered name shall be validated via `validateFilterProfileName(name, existingNames, currentName)`, excluding the profile's own current name from the duplicate check.

**Rationale**: Mirrors the existing Save flow's shell for consistency, and reuses the exact duplicate-name exclusion logic `FilterProfileAreaGroup.tsx`'s Settings-side rename flow already relies on, rather than a second, possibly-diverging validation path.

**References**:
- New `components/UpdateFilterProfileModal.tsx`, modeled directly on `components/SaveFilterProfileModal.tsx` (full current content).
- `utils/filterProfileValidation.ts`'s `validateFilterProfileName(name, existingNames, currentName?)` — the `currentName` parameter already exists and is already used this way by `FilterProfileAreaGroup.tsx`'s `handleRenameSave`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-129-AC-06: UpdateFilterProfileModal pre-fills name and validates it', () => {
  it('pre-fills the name field with the profile\'s current name', () => {
    render(
      <UpdateFilterProfileModal
        profile={{ id: '1', name: 'Weeknight', criteria: {} }}
        existingNames={['Weeknight', 'Other']}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/name/i)).toHaveValue('Weeknight')
  })

  it('does not flag the unchanged name as a duplicate of itself', () => {
    render(
      <UpdateFilterProfileModal
        profile={{ id: '1', name: 'Weeknight', criteria: {} }}
        existingNames={['Weeknight', 'Other']}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^update$/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rejects renaming to a different existing profile\'s name', () => {
    render(
      <UpdateFilterProfileModal
        profile={{ id: '1', name: 'Weeknight', criteria: {} }}
        existingNames={['Weeknight', 'Other']}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Other' } })
    fireEvent.click(screen.getByRole('button', { name: /^update$/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i)
  })
})
```
**Test Case (Green)**: build the modal per the Statement above, calling `validateFilterProfileName(name, existingNames, profile.name)` before invoking `onUpdate`.

---

### FRONTEND-129-AC-07 [AUTO]
**Statement**: On confirming `UpdateFilterProfileModal`, the hook shall call `seriesApi.updateFilterProfile<TCriteria>(selectedId, { name: trimmedName, criteria: currentCriteria })`; on success, the returned profile shall replace its prior entry in `profiles` and the modal shall close; on failure, an error shall be shown inside the still-open modal (not the outer action-row error span).

**Rationale**: Sends the (possibly changed) name and the current criteria in one request, matching the existing PATCH contract; keeps the failure visible in context rather than behind a closed modal.

**References**:
- `services/seriesApi.ts` lines 481-487 (`updateFilterProfile`, already accepts `{ name?, criteria? }` together).
- Mirrors `SaveFilterProfileModal.tsx`'s existing `saving`/`setError`/try-catch shape (lines 44-83) for the in-flight/error states.

**Test Case (Red)**:
```typescript
describe('FRONTEND-129-AC-07: confirming Update sends name + criteria and updates the list', () => {
  it('calls updateFilterProfile with the trimmed name and current criteria', async () => {
    const updateSpy = vi.spyOn(seriesApi, 'updateFilterProfile').mockResolvedValue({
      id: '1', area: 'MY_SERIES', name: 'Weekend', criteria: { genres: ['Drama'] }, createdAt: '', updatedAt: '',
    })
    render(
      <FilterProfileActionsHarness
        selectedProfile={{ id: '1', name: 'Weeknight', criteria: {} }}
        currentCriteria={{ genres: ['Drama'] }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /update filters/i }))
    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: 'Weekend' } })
    fireEvent.click(screen.getByRole('button', { name: /^update$/i }))
    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith('1', { name: 'Weekend', criteria: { genres: ['Drama'] } }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an error inside the modal and keeps it open on failure', async () => {
    vi.spyOn(seriesApi, 'updateFilterProfile').mockRejectedValue(new Error('network'))
    render(<FilterProfileActionsHarness selectedProfile={{ id: '1', name: 'Weeknight', criteria: {} }} />)
    fireEvent.click(screen.getByRole('button', { name: /update filters/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^update$/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: implement `handleUpdateConfirm(newName)` in `useFilterProfileSelector`, called by `UpdateFilterProfileModal`'s Update button, per the Statement above.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `FilterProfileSelector` component this spec splits/retires | `frontend_spec_107_filter_profile_ui.md` |
| `describeFilterCriteria`/`SaveFilterProfileModal`/conditional-`title` idioms this spec reuses or mirrors | `frontend_spec_108_filter_profile_management_and_save_modal.md` |
| Bottom-of-fields placement this spec's `FRONTEND-129-AC-02` supersedes (`FRONTEND-109-AC-03`/`AC-04`) | `frontend_spec_109_filter_profile_polish.md` |
| Single-click Update behavior this spec's `FRONTEND-129-AC-05` supersedes (`FRONTEND-107-AC-06`) | `frontend_spec_107_filter_profile_ui.md` |
| Custom Search wire-up, and the "one shared Analysis instance" architecture this spec's `FRONTEND-129-AC-03` reverses (`FRONTEND-112-AC-09`) | `frontend_spec_112_filter_profiles_custom_search_and_analysis.md` |
| Shared `useNameStatsFilters` hook this spec wires into `NameStatsTable.tsx` | `frontend_spec_096_analysis_filters_consistency_and_persistence.md` |
| `validateFilterProfileName`'s `currentName` exclusion parameter, reused for the Update modal | `FilterProfileAreaGroup.tsx`'s rename flow (introduced alongside `frontend_spec_109`) |
| `updateFilterProfile(id, { name?, criteria? })` endpoint contract | `frontend/src/services/seriesApi.ts` |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-129-AC-01: `useFilterProfileSelector` hook extracts shared state (fetch, selection, modals)
- [ ] FRONTEND-129-AC-02: `SavedFiltersList` renders at the top, `FilterProfileActions` stays at the existing bottom position, in `SearchFilter`/`UseMySeriesPanel`/`RecommendationFiltersBox`/`CustomSearchPanel`
- [ ] FRONTEND-129-AC-03: `NameStatsTable` gets both halves bookending its fields; `AnalysisView` loses its own standalone render
- [ ] FRONTEND-129-AC-04: saved-filter chips carry a `describeFilterCriteria`-derived `title` tooltip, omitted when there's nothing to describe
- [ ] FRONTEND-129-AC-05: clicking Update Filters opens `UpdateFilterProfileModal` instead of updating directly
- [ ] FRONTEND-129-AC-06: the modal pre-fills the current name (editable) and validates it, excluding the profile's own current name from the duplicate check
- [ ] FRONTEND-129-AC-07: confirming sends `{ name, criteria }` together, updates `profiles` and closes on success, shows an in-modal error and stays open on failure
