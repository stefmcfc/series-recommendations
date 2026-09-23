# Frontend Spec 129: Filter Profile Selector Top Placement & Hover Tooltips

**Status**: Not started
**Priority**: P3
**Depends on**: `frontend_spec_107_filter_profile_ui.md` (introduces `FilterProfileSelector` itself and its first three wire-ups — `SearchFilter.tsx`/`UseMySeriesPanel.tsx`/`RecommendationFiltersBox.tsx`), `frontend_spec_108_filter_profile_management_and_save_modal.md` (introduces `describeFilterCriteria`, reused here for the tooltip, and the Save-button conditional-`title` idiom this spec's tooltip mirrors), `frontend_spec_109_filter_profile_polish.md` (established the current bottom-of-fields placement this spec moves away from — its `FRONTEND-109-AC-03`/`FRONTEND-109-AC-04` placement assertions are superseded by this spec's `FRONTEND-129-AC-01`, see Design Decisions), `frontend_spec_112_filter_profiles_custom_search_and_analysis.md` (adds the `CustomSearchPanel.tsx` wire-up and the Analysis-area `describeFilterCriteria` describer this spec's tooltip also covers for `ANALYSIS_FILTERS`; its `FRONTEND-112-AC-09` decision to hoist the selector to `AnalysisView.tsx` specifically to avoid a `NameStatsTable.tsx` instantiation is reversed by this spec's `FRONTEND-129-AC-02`, see Design Decisions)
**Area**: Frontend (`components/FilterProfileSelector.tsx`, `components/SearchFilter.tsx`, `components/UseMySeriesPanel.tsx`, `components/RecommendationFiltersBox.tsx`, `components/CustomSearchPanel.tsx`, `components/NameStatsTable.tsx`, `components/AnalysisView.tsx` — plus each of those seven files' colocated `*.test.tsx`)

## Overview

Two independent changes to the "Saved Filters" picker (`FilterProfileSelector`), bundled together because both touch the same component and its five call sites in one pass.

First, `FilterProfileSelector` moves from the **bottom** of every filters area (immediately before the Search/Clear/Reset action buttons — a deliberate convention set by `frontend_spec_109`) to the **top** (the first thing a user sees on opening a filters panel, before any individual field). This applies across all five current consumers: `SearchFilter.tsx`, `UseMySeriesPanel.tsx`, `RecommendationFiltersBox.tsx`, `CustomSearchPanel.tsx`, and — for the first time — `NameStatsTable.tsx`/`AnalysisView.tsx`. That last pair is the interesting case: today `AnalysisView.tsx` renders its own standalone `FilterProfileSelector` *outside* `NameStatsTable.tsx`'s collapsible "Analysis Filters" box entirely (a `frontend_spec_112` decision made specifically to avoid instantiating it three times, once per `NameStatsTable` per Analysis tab). A separate, not-yet-built spec (`frontend_spec_126`) had been written to fix that inconsistency by folding the selector into the box at the bottom, matching the other four areas' then-current convention. `frontend_spec_126` is being deleted as redundant now that the target convention itself has changed — this spec absorbs its concern directly, landing Analysis at its final top-of-box position in one move rather than shipping a bottom-placement fix first and repositioning again later.

Second, hovering a saved-filter button (e.g. "Crime/Drama") now shows a native tooltip listing what that preset actually contains — reusing `utils/describeFilterCriteria.ts`'s existing `describeFilterCriteria(area, criteria)`, already used by the Settings management view (`FilterProfileAreaGroup.tsx`) for its own click-to-expand criteria summary, flattened into a single `title` attribute string.

## Design Decisions

- **Top, not bottom, because Saved Filters is a shortcut past the fields below it, not a summary of them.** A user who already knows they want "Crime/Drama" shouldn't have to scroll past every individual field to find the one-click preset that sets them all at once. Bottom placement made sense when Saved Filters was framed as "save what I just configured"; the user has since decided the more common flow is "apply a preset first, then fine-tune" — which reads better top-down.
- **This supersedes `frontend_spec_109`'s placement ACs, not `frontend_spec_107`'s existence ACs.** `FRONTEND-109-AC-03` ("Save appears after the filter fields in SearchFilter") and `FRONTEND-109-AC-04` (same, for `UseMySeriesPanel`) are left in place in `frontend_spec_109.md` as an immutable historical record — reference IDs are never deleted or rewritten (`.claude/steering/ears_format.md`) — but the behavior they describe is superseded by `FRONTEND-129-AC-01` below, the same way `FRONTEND-119-AC-10` corrected `FRONTEND-119-AC-07`'s label without touching its ID. The two existing DOM-order tests backing `FRONTEND-109-AC-03`/`AC-04` (`SearchFilter.test.tsx` line ~1249-1266, `UseMySeriesPanel.test.tsx` line ~952-974 — both assert the selector is a `DOCUMENT_POSITION_FOLLOWING` sibling of the fields) assert the *opposite* of the new behavior and must be rewritten, not left alongside, as part of implementing `FRONTEND-129-AC-01`.
- **`NameStatsTable.tsx`'s case is one AC, not folded into the reposition AC, because it's a different kind of change.** The other four are a pure JSX move — same props, same component, new location. Analysis is simultaneously: (a) `FilterProfileSelector` rendering inside `NameStatsTable.tsx` for the first time ever; (b) `AnalysisView.tsx` losing its own standalone render *and* the `currentAnalysisFiltersCriteria` computation that existed only to feed it; (c) a reversal of `frontend_spec_112`'s explicit "one shared instance across all three tabs, not three separate ones" architecture; and (d) a visibility change — the selector was previously always visible regardless of the "Analysis Filters" toggle's collapsed/expanded state (the only one of the five areas with that property), and now, folded into `filtersBody`, it's gated behind the toggle like `RecommendationFiltersBox`'s and `UseMySeriesPanel`'s already are. That resolves Analysis's standing inconsistency as a side effect, rather than something requiring separate handling.
- **The "one shared instance" concern is accepted as a minor, known tradeoff, not re-solved.** Only one `NameStatsTable` is ever mounted at a time (`AnalysisView.tsx` renders `{tab === 'keywords' && <KeywordsView .../>}` etc. — mutually exclusive, not three simultaneous instances), so "triple-render" was never literally at stake; the real cost `frontend_spec_112` was avoiding is a fresh `FilterProfileSelector` instance (new `listFilterProfiles` fetch, `selectedId` reset to unselected) on every tab switch, since that state is local to the component instance, not the shared `useNameStatsFilters()` hook. This spec accepts that cost for the sake of consistent top-of-box placement across all five areas — the *filter values themselves* still persist correctly across tab switches (they live in the hook, applied via `filters.applyFilterProfile`), only the visual "which chip is highlighted as applied" resets. No new AC compensates for this; it's called out here so it isn't mistaken for a bug during review.
- **`sharedStyles.filterFullWidthRow` wrapper required for `NameStatsTable.tsx`.** Unlike `SearchFilter.module.css`'s `.filtersBody` (`display: flex; flex-direction: column` — any direct child is already full-width), `RecommendationControls.module.css`'s `.filtersBody` (shared by `RecommendationFiltersBox.tsx`, `UseMySeriesPanel.tsx`, and `NameStatsTable.tsx` via its `sharedStyles` import) is a CSS grid (`grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr))`). Without `.filterFullWidthRow` (`grid-column: 1 / -1`), the selector would render as a single cramped grid cell instead of spanning the full row — exactly why `UseMySeriesPanel.tsx`/`RecommendationFiltersBox.tsx` already wrap it that way today. `SearchFilter.tsx` and `CustomSearchPanel.tsx` need no such wrapper (flex column / plain block flow respectively), matching their current unwrapped renders.
- **Tooltip reuses `describeFilterCriteria` + native `title`, not a new component.** `FilterProfileAreaGroup.tsx` (Settings) already turns `describeFilterCriteria(area, profile.criteria)` into a rendered `<ul>` of `{label}: {value}` (`components/FilterProfileAreaGroup.tsx` lines ~247-257) for its click-to-expand summary; `FilterProfileSelector.tsx` itself already uses a conditional `title` attribute for hover-explanation text on its disabled Save button (lines ~182-186, `title={hasActiveCriteria ? undefined : 'Set at least one filter before saving'}`). The tooltip is the same describer feeding the same idiom onto a different element — no new formatting logic, no new tooltip primitive.
- **Empty description means no `title`, not an empty string.** `title=""` is technically present-but-blank and some assistive tech / browsers still announce an empty tooltip region; `undefined` omits the attribute entirely, matching the existing Save button's own `hasActiveCriteria ? undefined : '...'` pattern exactly.

---

## Requirement 1: Saved Filters renders at the top of every filter area

**User story**: As a user opening a filters panel, I want the Saved Filters picker to be the first thing I see, so I can jump straight to a preset instead of scrolling past every individual field first.

### FRONTEND-129-AC-01 [AUTO]
**Statement**: The `SearchFilter`, `UseMySeriesPanel`, `RecommendationFiltersBox`, and `CustomSearchPanel` components shall each render `FilterProfileSelector` as the first element of their filters area (immediately after the filters-body wrapper opens, before any individual filter field), and shall no longer render it immediately before their Search/Clear/Reset action buttons.

**Rationale**: Saved Filters is a shortcut past the individual fields, not a summary of them — it should be encountered first, not last.

**References**:
- `components/SearchFilter.tsx`: `<div className={styles.filtersBody} data-testid="filters-body">` opens at line 382, immediately followed today by the "Genres & Keywords" `<section>` (line 383) — `FilterProfileSelector<MySeriesFilterCriteria>` moves here from its current position at lines 633-638 (currently a sibling rendered *after* `filtersBody` closes, immediately before `<div className={styles.actions}>` at line 640). No wrapper needed — `.filtersBody` is `display: flex; flex-direction: column` (`SearchFilter.module.css` line 54-58).
- `components/UseMySeriesPanel.tsx`: `<div className={styles.filtersBody} data-testid="specific-series-filters-body">` opens at line 324-327, immediately followed today by the "Filter by Status" `<fieldset>` (line 333). `FilterProfileSelector<UseMySeriesFilterCriteria>` moves here from lines 641-648 (currently wrapped in `<div className={styles.filterFullWidthRow}>`, immediately before `<div className={styles.filtersActions}>` at line 654) — the same `filterFullWidthRow` wrapper is preserved at the new location, since `.filtersBody` here is the shared `RecommendationControls.module.css` grid.
- `components/RecommendationFiltersBox.tsx`: `<div className={styles.filtersBody} data-testid="filters-body">` opens at line 193, immediately followed today by the (conditionally-rendered, `!isCustomSearch`) Min TMDB Rating field (line 194). `FilterProfileSelector<RecommendationFiltersCriteria>` moves here from lines 336-344 (currently wrapped in `<div className={styles.filterFullWidthRow}>`, immediately before `<div className={styles.filtersActions}>` at line 346) — same wrapper preserved, and the existing `disabled={isCustomSearch}` prop carries over unchanged.
- `components/CustomSearchPanel.tsx`: has no collapsible toggle or `filtersBody` wrapper of its own — its filters area opens with `<p className={styles.hint}>` (lines 116-119) then `<div className={styles.genreKeywordFields}>` (line 121). `FilterProfileSelector<CustomSearchFilterCriteria>` moves here, rendered immediately after the hint paragraph and before `genreKeywordFields`, from lines 265-270 (currently immediately before `<div className={styles.filtersActions}>` at line 272). No wrapper needed, matching its current unwrapped render.
- Superseded placement ACs: `FRONTEND-109-AC-03` (`frontend_spec_109_filter_profile_polish.md`), `FRONTEND-109-AC-04` (same spec) — see this spec's Design Decisions.
- Tests to update (not just add to), since they assert the placement being reversed: `SearchFilter.test.tsx` `FRONTEND-109-AC-03` describe block (~line 1249-1266, currently asserts `DOCUMENT_POSITION_FOLLOWING`), `UseMySeriesPanel.test.tsx` `FRONTEND-109-AC-04` describe block (~line 952-974, same assertion shape). `CustomSearchPanel.test.tsx`'s `FRONTEND-112-AC-03` test (~line 412-439) describes the selector as "the last field" in its test name — the assertions themselves don't check DOM order, but the name should be corrected for accuracy.

**Test Case (Red)**:
```typescript
// SearchFilter.test.tsx
describe('FRONTEND-129-AC-01: Saved Filters renders at the top in SearchFilter', () => {
  it('renders the profile selector before the Genres & Keywords section, not after Years', async () => {
    render(
      <SearchFilter isOpen onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />,
    )
    const body = screen.getByTestId('filters-body')
    const selector = await screen.findByTestId('filter-profile-selector')
    const genresHeading = screen.getByText('Genres & Keywords')
    // selector must be inside filters-body, preceding its first section
    expect(body.contains(selector)).toBe(true)
    expect(
      selector.compareDocumentPosition(genresHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

// UseMySeriesPanel.test.tsx
describe('FRONTEND-129-AC-01: Saved Filters renders at the top in UseMySeriesPanel', () => {
  it('renders the profile selector before the Status fieldset, not after Year Max', async () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    const body = screen.getByTestId('specific-series-filters-body')
    const selector = await screen.findByTestId('filter-profile-selector')
    const statusLegend = screen.getByText('Filter by Status')
    expect(body.contains(selector)).toBe(true)
    expect(
      selector.compareDocumentPosition(statusLegend) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

// RecommendationFiltersBox.test.tsx
describe('FRONTEND-129-AC-01: Saved Filters renders at the top in RecommendationFiltersBox', () => {
  it('renders the profile selector before the Min TMDB Rating field', async () => {
    render(<RecommendationFiltersBox {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i })) // open the box
    const body = screen.getByTestId('filters-body')
    const selector = await screen.findByTestId('filter-profile-selector')
    const minTmdbField = screen.getByLabelText('Min TMDB Rating')
    expect(body.contains(selector)).toBe(true)
    expect(
      selector.compareDocumentPosition(minTmdbField) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

// CustomSearchPanel.test.tsx
describe('FRONTEND-129-AC-01: Saved Filters renders at the top in CustomSearchPanel', () => {
  it('renders the profile selector between the hint and the genre/keyword fields', async () => {
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    const hint = screen.getByText(/search tmdb directly/i)
    const selector = await screen.findByTestId('filter-profile-selector')
    expect(
      hint.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
```

**Test Case (Green)**: in each of the four files, delete the `FilterProfileSelector` JSX block (and its wrapping `filterFullWidthRow` div where one exists) from its current position, and re-add an equivalent block (same props, unchanged) at the top of the filters area per the References above. Rewrite `SearchFilter.test.tsx`'s and `UseMySeriesPanel.test.tsx`'s existing `FRONTEND-109-AC-03`/`AC-04` position assertions to match (`DOCUMENT_POSITION_PRECEDING` relative to the first field, or equivalent).

---

### FRONTEND-129-AC-02 [AUTO]
**Statement**: The `NameStatsTable` component shall render `FilterProfileSelector` (area `ANALYSIS_FILTERS`, wrapped in `sharedStyles.filterFullWidthRow`) as the first element of its `filtersBody`, with `currentCriteria={{ ...filters.filterInputs, sortBy: filters.sortBy, sortDirection: filters.sortDirection }}`, `onApply={filters.applyFilterProfile}`, and `onClear={filters.clearFilterProfile}`. The `AnalysisView` component shall no longer render its own `FilterProfileSelector`, nor compute a `currentAnalysisFiltersCriteria` value.

**Rationale**: Folds Analysis into the same top-of-box convention as the other four areas in one move, retiring `frontend_spec_126`'s now-superseded "fold in at the bottom" concern and resolving Analysis's standing inconsistency (previously the only area whose selector was visible regardless of the filters panel's collapsed state) as a side effect.

**References**:
- `components/NameStatsTable.tsx`: `<div className={sharedStyles.filtersBody} data-testid="filters-body">` opens at line 138, immediately followed today by the "Min Series Count" `<div className={sharedStyles.field}>` (line 139-151) — `FilterProfileSelector` is inserted before that field, as the new first child.
- `components/NameStatsTable.tsx`'s `NameStatsTableProps` (lines 49-61) already carries `readonly filters: NameStatsFiltersState`, exposing `filters.filterInputs`, `filters.sortBy`, `filters.sortDirection`, `filters.applyFilterProfile`, `filters.clearFilterProfile` (`hooks/useNameStatsFilters.ts` lines 93-119) — no new prop needed.
- `components/AnalysisView.tsx`: remove the `FilterProfileSelector` import (line 6), the `AnalysisFilterCriteria` type import (line 8, unused once `currentAnalysisFiltersCriteria` is gone), the `currentAnalysisFiltersCriteria` computation (lines 41-45), and the `<FilterProfileSelector<AnalysisFilterCriteria> .../>` render (lines 64-69).
- `NameStatsTable.test.tsx` does not currently `vi.mock('../services/seriesApi')` (its `Harness` wraps a real `useNameStatsFilters()` but has never needed the API mock before) — adding `FilterProfileSelector` means it now calls `seriesApi.listFilterProfiles` on mount, so the mock must be added, mirroring `RecommendationFiltersBox.test.tsx`'s own `FRONTEND-107-AC-11` comment (lines 7-11) for why.
- `AnalysisView.test.tsx`'s existing `FRONTEND-112-AC-09` describe block (lines 175-217) asserts exactly one `filter-profile-selector` exists and that applying a profile's criteria survives a tab switch — both assertions still hold after this move (only one `NameStatsTable` is ever mounted at a time, and the applied filter values live in the shared hook, not the selector instance — see this spec's Design Decisions), but the block's own comment/description should be updated to reflect that the instance is now per-tab-view rather than literally shared, and its `renderAnalysisView` helper needs to open the "Analysis Filters" toggle before the selector is queryable (it's now gated behind the collapse, unlike before).

**Test Case (Red)**:
```typescript
// NameStatsTable.test.tsx
describe('FRONTEND-129-AC-02: FilterProfileSelector renders at the top of NameStatsTable', () => {
  it('renders the selector before Min Series Count once expanded', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    vi.mocked(seriesApi.listFilterProfiles).mockResolvedValue([])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    const body = screen.getByTestId('filters-body')
    const selector = await screen.findByTestId('filter-profile-selector')
    const minSeriesCountField = screen.getByLabelText('Min Series Count')
    expect(body.contains(selector)).toBe(true)
    expect(
      selector.compareDocumentPosition(minSeriesCountField) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('applying a saved profile refetches stats with the profile\'s criteria', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    vi.mocked(seriesApi.listFilterProfiles).mockResolvedValue([
      {
        id: '1',
        area: 'ANALYSIS_FILTERS',
        name: 'Top rated only',
        criteria: { minAverageBlendedRating: '8', statusScope: 'completed' },
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(<Harness fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))

    fireEvent.click(await screen.findByText('Top rated only'))
    await waitFor(() =>
      expect(fetchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ minAverageBlendedRating: 8, onlyCompleted: true }),
      ),
    )
  })
})

// AnalysisView.test.tsx
describe('FRONTEND-129-AC-02: AnalysisView no longer renders its own selector', () => {
  it('renders no filter-profile-selector until the Analysis Filters panel is expanded', async () => {
    renderAnalysisView('/analysis/keywords')
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    expect(screen.queryByTestId('filter-profile-selector')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    expect(await screen.findByTestId('filter-profile-selector')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `vi.mock('../services/seriesApi')` (with a default `listFilterProfiles` resolving `[]` in `beforeEach`) to `NameStatsTable.test.tsx`; insert the wrapped `FilterProfileSelector` as the first child of `sharedStyles.filtersBody` in `NameStatsTable.tsx`, wired to the `filters` prop per the Statement above; delete `AnalysisView.tsx`'s own render, its `currentAnalysisFiltersCriteria` computation, and its now-unused `FilterProfileSelector`/`AnalysisFilterCriteria` imports; update `AnalysisView.test.tsx`'s `FRONTEND-112-AC-09` block to open the filters toggle before querying for the selector.

---

## Requirement 2: hover tooltip explains what a saved filter contains

**User story**: As a user looking at a list of saved-filter buttons by name only (e.g. "Crime/Drama"), I want to hover one and see what it actually filters by, without having to apply it first to find out.

### FRONTEND-129-AC-03 [AUTO]
**Statement**: Where a saved profile's `describeFilterCriteria(area, profile.criteria)` returns at least one entry, `FilterProfileSelector` shall set that profile's button `title` attribute to those entries joined as `"{label}: {value}"` per line; where it returns zero entries, the button's `title` attribute shall be omitted (`undefined`).

**Rationale**: Reuses the exact description data already shown in Settings, surfaced as a lightweight native hover tooltip right where the user picks a preset, so they don't have to guess or navigate away to check what a saved name means.

**References**:
- `components/FilterProfileSelector.tsx` lines 155-162 (the `<button>` per saved profile, currently no `title` attribute), line 5 (`describeFilterCriteria` already imported), lines 182-186 (the existing conditional-`title` idiom on the "Save Filters" button this AC mirrors).
- `utils/describeFilterCriteria.ts`'s `describeFilterCriteria(area, criteria): CriteriaDescriptionEntry[]` (`{ label, value }[]`).
- Precedent: `components/FilterProfileAreaGroup.tsx` lines 247-257, rendering the same describer's output as a `<ul><li><strong>{entry.label}:</strong> {entry.value}</li></ul>` expand-on-click summary — this AC flattens the same entries into one `title` string instead.

**Test Case (Red)**:
```typescript
describe('FRONTEND-129-AC-03: saved-filter buttons show a description tooltip on hover', () => {
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
    render(
      <FilterProfileSelector area="MY_SERIES" currentCriteria={{}} onApply={vi.fn()} />,
    )
    const button = await screen.findByText('Crime/Drama')
    expect(button).toHaveAttribute(
      'title',
      'Genres: Crime, Drama\nMin IMDb Rating: 7',
    )
  })

  it('omits the title attribute when the profile has no describable criteria', async () => {
    vi.spyOn(seriesApi, 'listFilterProfiles').mockResolvedValue([
      {
        id: '1',
        area: 'MY_SERIES',
        name: 'Empty',
        criteria: {},
        createdAt: '',
        updatedAt: '',
      },
    ])
    render(
      <FilterProfileSelector area="MY_SERIES" currentCriteria={{}} onApply={vi.fn()} />,
    )
    const button = await screen.findByText('Empty')
    expect(button).not.toHaveAttribute('title')
  })
})
```

**Test Case (Green)**: in `FilterProfileSelector.tsx`'s saved-profile `<button>` (lines 155-162), compute `const entries = describeFilterCriteria(area, profile.criteria)` per profile and add `title={entries.length > 0 ? entries.map((e) => \`${e.label}: ${e.value}\`).join('\\n') : undefined}`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `FilterProfileSelector` component this spec repositions and extends | `frontend_spec_107_filter_profile_ui.md` |
| `describeFilterCriteria` / conditional-`title` idioms this spec's tooltip reuses | `frontend_spec_108_filter_profile_management_and_save_modal.md` |
| Bottom-of-fields placement this spec supersedes (`FRONTEND-109-AC-03`/`AC-04`) | `frontend_spec_109_filter_profile_polish.md` |
| Custom Search wire-up, and the "one shared Analysis instance" architecture this spec reverses (`FRONTEND-112-AC-09`) | `frontend_spec_112_filter_profiles_custom_search_and_analysis.md` |
| Shared `useNameStatsFilters` hook (`filterInputs`/`sortBy`/`sortDirection`/`applyFilterProfile`/`clearFilterProfile`) this spec wires into `NameStatsTable.tsx` | `frontend_spec_096_analysis_filters_consistency_and_persistence.md` |
| Settings management view's own `describeFilterCriteria`-based summary, this spec's tooltip precedent | `FilterProfileAreaGroup.tsx` (introduced alongside `frontend_spec_108`) |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-129-AC-01: Saved Filters renders at the top of `SearchFilter`/`UseMySeriesPanel`/`RecommendationFiltersBox`/`CustomSearchPanel`, no longer at the bottom
- [ ] FRONTEND-129-AC-02: `NameStatsTable` gains `FilterProfileSelector` at the top of its filters box; `AnalysisView` loses its own standalone render and `currentAnalysisFiltersCriteria`
- [ ] FRONTEND-129-AC-03: saved-filter buttons carry a `describeFilterCriteria`-derived `title` tooltip, omitted when there's nothing to describe
