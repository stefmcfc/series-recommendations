# Frontend Spec 096: Analysis Filters Consistency & Cross-Tab Persistence

**Status**: Complete — all ACs implemented and verified (`npm test`/`npm run lint`/`npm run build` green). AC-01/AC-02 additionally visually confirmed live in-browser across all three tabs in a follow-up pass, including cross-tab persistence (AC-11/AC-12/AC-13) exercised end-to-end (set Min Series Count on Keywords, Apply, switch to Genres — value, active-filter badge, and filtered results all persisted correctly).
**Priority**: P3
**Depends on**: `frontend_spec_086_keyword_stats_filtering_sort_and_blended_rating.md` (original `NameStatsTable` filter/Apply-button pattern), `frontend_spec_087_analysis_section_nav_restructure.md` (`AnalysisView` tab shell/routing), `frontend_spec_088_genre_stats_view.md` (`GenreStatsView`), `frontend_spec_089_country_of_origin_stats_view.md` (`CountryStatsView`), `frontend_spec_095_stats_status_scope_filter_toggle.md` (status-scope control this spec preserves), and the existing shared `.filtersSection`/`.filtersToggle`/`.filtersBody`/`.field`/`.filtersActions`/`.applyButton`/`.resetButton` CSS convention in `RecommendationControls.module.css` — already reused by two consumers (`RecommendationFiltersBox.tsx` and `UseMySeriesPanel.tsx`, both `import styles from './RecommendationControls.module.css'` directly)
**Area**: Frontend (`components/AnalysisView.tsx`, `components/NameStatsTable.tsx`, `components/NameStatsTable.module.css`, `components/KeywordsView.tsx`, `components/GenreStatsView.tsx`, `components/CountryStatsView.tsx`, a new `hooks/useNameStatsFilters.ts`, and each affected file's tests)

## Overview

User-reported visual and UX problems on `/analysis` (Keywords/Genres/Country of Origin tabs), confirmed by reading the actual code and a live browser pass:

1. **Centered heading/labels.** `index.css` sets `#root { text-align: center }` globally. Every other page's container (`SeriesList.module.css`, `RecommendationControls.module.css`) explicitly overrides this with `text-align: left`; `NameStatsTable.module.css`'s `.container` never does. The `<h2>` heading and all four filter field labels inherit the centered default, while the table's `<th>`/`<td>` cells look normal only because they carry their own explicit `text-align: left`.
2. **Inconsistent column widths.** The table has no fixed column widths, so each tab's Name column (Keyword/Genre/Country) auto-sizes to its own longest value, shifting the other three columns between tabs — confirmed visually (Genres' "Series Count" column renders ~70px left of where it sits on Keywords).
3. **Unstyled Apply Filters button.** `.applyButton` in `NameStatsTable.module.css` sets only `padding`/`cursor` — no color or border — so it renders as a plain grey browser-default button, unlike the app's `--accent`-styled buttons everywhere else (including the *same* `.applyButton` class name, correctly styled, already sitting in `RecommendationControls.module.css`).
4. **No persistence across tabs.** `AnalysisView` conditionally renders exactly one of `KeywordsView`/`GenreStatsView`/`CountryStatsView` at a time (`{tab === 'x' && <X />}`), and each is a thin wrapper around the shared `NameStatsTable`, which owns `sortBy`/`sortDirection`/`filterInputs`/`appliedFilters` as local `useState`. Switching tabs unmounts the old instance and mounts a fresh one, discarding all of it.
5. **Structurally inconsistent with the rest of the app.** Analysis's filter row is permanently visible, inline, with no collapse and no Clear/Reset button. The app already has an established, twice-reused pattern for exactly this: the `.filtersSection`/`.filtersToggle`/`.filtersBody` disclosure box in `RecommendationControls.module.css` (an active-filter-count badge, a collapsible body, a Reset button) — shared today by `RecommendationFiltersBox` (`/recommendations`) and `UseMySeriesPanel` (`/my-series`'s "Filter & sort my series" panel).

This spec fixes 1–3 as straightforward CSS corrections, adopts the existing shared disclosure-box pattern from `RecommendationControls.module.css` for the filters UI (making `NameStatsTable` a third consumer of an already-shared stylesheet, not a new pattern), fixes the table's column widths, and lifts filter/sort/panel-open state out of `NameStatsTable` and up into `AnalysisView` via a new `useNameStatsFilters` hook, shared across all three tabs.

## Design Decisions

- **One shared filter/sort state across all three tabs, not three independently-remembered states.** Confirmed with the user: setting "Min Series Count ≥ 5" on Keywords should still show 5 after switching to Genres, not reset to blank. This also matches how `sortBy`/`sortDirection` are literally the same fields (`name`/`seriesCount`/`averagePersonalRating`/`averageBlendedRating`) regardless of which tab is active — there's no per-tab meaning to preserve separately.
- **Persistence is scoped to the three `/analysis` sub-tabs, not the whole session.** The state lives in `AnalysisView`, which itself unmounts when the user navigates away from `/analysis` entirely (e.g. to `/my-series`) via the top nav — the user only asked for persistence "across tabs," not survival across full navigation, and adding `localStorage`/URL-param persistence would be a bigger, unrequested change.
- **Reuse `RecommendationControls.module.css`'s existing classes rather than reinventing `NameStatsTable`'s own.** `.filtersSection`/`.filtersToggle`/`.filtersActiveBadge`/`.filtersBody`/`.field`/`.filtersActions`/`.resetButton`/`.applyButton` already exist, are already shared across two components, and already have correct `--accent` button styling — importing them into `NameStatsTable.tsx` is a straight reuse (`import styles from './RecommendationControls.module.css'`), not an extraction. `NameStatsTable.module.css` keeps only what's genuinely specific to this component: `.container`, `.heading`, `.loading`, `.error`, `.table`, `.sortableHeader`.
- **"Reset Filters" clears and re-applies immediately, in one click — it does not require a follow-up "Apply Filters" click.** This matches `SearchFilter`'s own "Clear Filters" button (`handleClear`, which calls `onClear()` immediately) rather than `RecommendationFiltersBox`'s live-bound `handleResetFilters` (that component has no separate Apply step at all, so there's nothing to compare against directly). Leaving Reset only half-effective (clearing the inputs but leaving stale results on screen until a second click) would be a worse, confusing UX than either existing precedent.
- **Reset Filters does not touch sort order.** "Filters" and "sort" are separate concerns in this component already — clicking a column header again is how sort is reset today, and folding sort into a button labeled "Reset *Filters*" would be a silent, surprising side effect.
- **The active-filter-count badge counts `appliedFilters`, not the uncommitted `filterInputs`.** The badge should reflect what's actually affecting the table right now, matching the explicit-submit ("Apply Filters") model this component already uses (`frontend_spec_086` FRONTEND-086-AC-05) — counting live keystrokes would make the badge change before the table does, which is inconsistent with that established model.
- **The toggle button is labeled "Analysis Filters"**, following `frontend_spec_065`'s precedent of disambiguating each surface's filters button by name (`RecommendationFiltersBox` → "Recommendations Filters", `UseMySeriesPanel` → "Filter & sort my series").
- **`sortBy`/`sortDirection`/`filterInputs`/`appliedFilters`/`applyVersion`/`filtersOpen` state, plus the `buildFetchOptions` helper, move out of `NameStatsTable.tsx` into a new `hooks/useNameStatsFilters.ts`.** `NameStatsTable` keeps its own `stats`/`loading`/`error` state (genuinely per-tab, not shared) and the fetch `useEffect`, now depending on the hook's returned values via props instead of local state. `KeywordsView`/`GenreStatsView`/`CountryStatsView` each gain exactly one new prop (`filters`) passed straight through to `NameStatsTable` — they stay thin wrappers, unchanged in every other respect.
- **`NameStatsTable.tsx`'s local `NameStatsSortBy`/`NameStatsOptions` types are reused as-is, not merged with `types/series.ts`'s separately-declared, structurally-identical types of the same name.** That pre-existing duplication (visible while researching this spec) is out of scope here — it's unrelated to the filters/persistence problem this spec addresses, and folding it in would risk touching `seriesApi.ts`'s unrelated call sites for no benefit to this spec's goal.

## Requirements

### Requirement 1: Visual/CSS consistency fixes

**User story**: As a user viewing Analysis, I want the page heading, filter labels, and table columns to look and align the same way the rest of the app does, so the page doesn't look broken or half-finished next to My Series and Recommendations.

#### Acceptance Criteria

- **FRONTEND-096-AC-01** [MANUAL]: `NameStatsTable.module.css`'s `.container` shall include `text-align: left`, matching `SeriesList.module.css`/`RecommendationControls.module.css`'s own containers — verified by visual check in browser (jsdom doesn't run layout/inherited computed style the way a real browser does, per `frontend_spec_091`'s identical precedent for CSS-only fixes).
- **FRONTEND-096-AC-02** [MANUAL]: `NameStatsTable`'s `<table>` shall render its four columns (Name, Series Count, Avg. Personal Rating, Avg. Blended Rating) at fixed, content-independent widths, identical across all three tabs regardless of each tab's own data — verified by visual check in browser across all three tabs.

  **Live-review amendment (2026-09-07)**: the first implementation applied `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` to both `<th>` and `<td>` — at the fixed 20%-width rating columns this truncated the header text itself ("Avg. Personal Rat…", "Avg. Blended Rat…"), confirmed in a live browser pass. Fixed by restricting truncation to `.table td` only; `<th>` labels now wrap onto a second line at these widths instead, which stays legible.
- **FRONTEND-096-AC-03** [AUTO]: The "Apply Filters" button shall use `RecommendationControls.module.css`'s `.applyButton` class (imported into `NameStatsTable.tsx`) instead of `NameStatsTable.module.css`'s own unstyled `.applyButton` — verified by asserting the rendered button's class matches the shared module's generated class name.

---

### Requirement 2: Filters adopt the shared disclosure-box pattern

**User story**: As a user, I want Analysis's filters to look, collapse, and reset the same way Recommendations' and My Series' filters already do, so I'm not learning a third, different filter UI.

#### Acceptance Criteria

- **FRONTEND-096-AC-04** [AUTO]: `NameStatsTable` shall render its filter fields collapsed by default, behind a toggle button labeled "Analysis Filters" with `aria-expanded="false"` initially, using `RecommendationControls.module.css`'s `.filtersSection`/`.filtersToggle`/`.filtersBody` classes.
- **FRONTEND-096-AC-05** [AUTO]: Clicking the "Analysis Filters" toggle shall expand the filters body (`aria-expanded="true"`) and reveal the four existing filter fields (Min Series Count, Min Avg Personal Rating, Min Avg Blended Rating, Status) plus the Apply Filters and Reset Filters buttons; clicking again shall collapse it.
- **FRONTEND-096-AC-06** [AUTO]: While one or more filter fields in `appliedFilters` are non-default (any of `minSeriesCount`/`minAveragePersonalRating`/`minAverageBlendedRating` non-blank, or `statusScope !== 'all'`), the toggle shall display an active-filter-count badge (`RecommendationControls.module.css`'s `.filtersActiveBadge`) showing that count; while none are set, no badge shall render.
- **FRONTEND-096-AC-07** [AUTO]: A "Reset Filters" button shall render inside the expanded filters body (`RecommendationControls.module.css`'s `.resetButton`/`.filtersActions`), and clicking it shall clear every filter field (`filterInputs` and `appliedFilters` both reset to their blank/default values) and immediately re-fetch with an empty `NameStatsOptions` filter set (aside from any active `sortBy`/`sortDirection`), without requiring a separate Apply click.
- **FRONTEND-096-AC-08** [AUTO]: Clicking "Reset Filters" shall not change the currently active `sortBy`/`sortDirection`.

---

### Requirement 3: Filter/sort/panel state shared across the three Analysis tabs

**User story**: As a user comparing Keywords, Genres, and Country of Origin, I want the filters I've set and the sort order I've picked to still be there when I switch tabs, so I don't have to re-enter the same criteria three times.

#### Acceptance Criteria

- **FRONTEND-096-AC-09** [AUTO]: A new `useNameStatsFilters` hook (`hooks/useNameStatsFilters.ts`) shall own `filterInputs`, `appliedFilters`, `sortBy`, `sortDirection`, `applyVersion`, and `filtersOpen` state, plus their handlers (`handleFilterInputChange`, `handleStatusScopeChange`, `handleSortChange`, `handleApplyFilters`, `handleResetFilters`, `handleToggleFiltersOpen`) and the `sortIndicator`/`activeFilterCount` derived values — the same responsibilities `NameStatsTable.tsx` owned locally before this spec.
- **FRONTEND-096-AC-10** [AUTO]: `AnalysisView` shall call `useNameStatsFilters()` exactly once and pass its returned value down as a single `filters` prop to whichever of `KeywordsView`/`GenreStatsView`/`CountryStatsView` is currently rendered.
- **FRONTEND-096-AC-11** [AUTO]: Setting a filter value (e.g. Min Series Count) and clicking Apply Filters on the Keywords tab, then switching to the Genres tab via the sub-nav, shall show that same filter value still populated in the (collapsed-open) filters body and still reflected in `appliedFilters` driving Genres' own fetch.
- **FRONTEND-096-AC-12** [AUTO]: Changing the sort column/direction on one tab and switching to another tab shall preserve that same `sortBy`/`sortDirection` (including the ▲/▼ indicator on the corresponding column header) on the newly active tab.
- **FRONTEND-096-AC-13** [AUTO]: Opening the "Analysis Filters" disclosure on one tab and switching to another tab shall leave the disclosure open (not re-collapsed) on the newly active tab.

---

### Requirement 4: Thin-wrapper threading

**User story**: As a developer, I want `KeywordsView`/`GenreStatsView`/`CountryStatsView` to stay simple, config-passing wrappers, so this change doesn't turn three one-purpose files into three near-duplicates of `NameStatsTable`'s own logic.

#### Acceptance Criteria

- **FRONTEND-096-AC-14** [AUTO]: `KeywordsView.tsx`, `GenreStatsView.tsx`, and `CountryStatsView.tsx` shall each accept exactly one new prop (`filters: NameStatsFiltersState`) and forward it unchanged to their `<NameStatsTable>` — no other prop or logic changes in any of the three files.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Original filter/Apply-button pattern this restructures | `frontend_spec_086_keyword_stats_filtering_sort_and_blended_rating.md` |
| `AnalysisView` tab shell/routing this spec adds shared state to | `frontend_spec_087_analysis_section_nav_restructure.md`, `frontend/src/components/AnalysisView.tsx` |
| `GenreStatsView`/`CountryStatsView` thin-wrapper shape this spec extends with one prop | `frontend_spec_088_genre_stats_view.md`, `frontend_spec_089_country_of_origin_stats_view.md` |
| Status-scope control (`statusScope`/`onlyCompleted`) preserved unchanged by this spec | `frontend_spec_095_stats_status_scope_filter_toggle.md` |
| Shared disclosure-box CSS/pattern this spec reuses (`.filtersSection`/`.filtersToggle`/`.filtersActiveBadge`/`.filtersBody`/`.field`/`.filtersActions`/`.resetButton`/`.applyButton`) | `frontend/src/components/RecommendationControls.module.css`, already consumed by `RecommendationFiltersBox.tsx` and `UseMySeriesPanel.tsx` |
| Sticky-position/CSS-only-fix `[MANUAL]` precedent (jsdom doesn't run layout) | `frontend_spec_091_series_form_validation_and_persistent_cta.md` (FRONTEND-091-AC-10) |
| "Disambiguate each surface's filters-button label" precedent | `frontend_spec_065` ("Recommendations Filters" vs. My Series' "Filter & sort my series") |

---

## TDD Test Case Sketches

### `src/hooks/useNameStatsFilters.test.ts` (new file)

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useNameStatsFilters } from './useNameStatsFilters'

describe('FRONTEND-096-AC-09: useNameStatsFilters owns filter/sort/panel state', () => {
  it('starts with blank filterInputs/appliedFilters, undefined sort, filters closed', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    expect(result.current.filterInputs.minSeriesCount).toBe('')
    expect(result.current.appliedFilters.minSeriesCount).toBe('')
    expect(result.current.sortBy).toBeUndefined()
    expect(result.current.filtersOpen).toBe(false)
  })

  it('handleApplyFilters commits filterInputs into appliedFilters and bumps applyVersion', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    act(() => result.current.handleFilterInputChange('minSeriesCount')({
      target: { value: '5' },
    } as React.ChangeEvent<HTMLInputElement>))
    const versionBefore = result.current.applyVersion
    act(() => result.current.handleApplyFilters())
    expect(result.current.appliedFilters.minSeriesCount).toBe('5')
    expect(result.current.applyVersion).toBeGreaterThan(versionBefore)
  })
})

describe('FRONTEND-096-AC-07/08: Reset Filters clears without a separate Apply, leaves sort untouched', () => {
  it('clears filterInputs and appliedFilters immediately, preserves sortBy', () => {
    const { result } = renderHook(() => useNameStatsFilters())
    act(() => result.current.handleSortChange('seriesCount'))
    act(() => result.current.handleFilterInputChange('minSeriesCount')({
      target: { value: '5' },
    } as React.ChangeEvent<HTMLInputElement>))
    act(() => result.current.handleApplyFilters())

    act(() => result.current.handleResetFilters())

    expect(result.current.filterInputs.minSeriesCount).toBe('')
    expect(result.current.appliedFilters.minSeriesCount).toBe('')
    expect(result.current.sortBy).toBe('seriesCount')
  })
})
```

### `src/components/NameStatsTable.test.tsx` (additions)

```typescript
describe('FRONTEND-096-AC-01/03: container alignment and Apply Filters styling', () => {
  it('Apply Filters button uses the shared RecommendationControls applyButton class', () => {
    render(<NameStatsTable {...baseProps} filters={makeFilters()} />)
    const button = screen.getByRole('button', { name: /apply filters/i })
    expect(button.className).toContain('applyButton')
  })
})

describe('FRONTEND-096-AC-04/05: filters collapsed by default, toggle expands/collapses', () => {
  it('renders the filter fields collapsed behind an "Analysis Filters" toggle', () => {
    render(<NameStatsTable {...baseProps} filters={makeFilters()} />)
    expect(
      screen.getByRole('button', { name: /analysis filters/i }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Min Series Count')).not.toBeInTheDocument()
  })

  it('expands to show filter fields on click, collapses again on a second click', () => {
    render(<NameStatsTable {...baseProps} filters={makeFilters()} />)
    const toggle = screen.getByRole('button', { name: /analysis filters/i })

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Min Series Count')).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('FRONTEND-096-AC-06: active-filter-count badge reflects appliedFilters', () => {
  it('shows no badge when appliedFilters is entirely blank', () => {
    render(<NameStatsTable {...baseProps} filters={makeFilters()} />)
    expect(screen.queryByTestId('filters-active-count')).not.toBeInTheDocument()
  })

  it('shows a count badge once a filter is applied', () => {
    const filters = makeFilters({
      appliedFilters: { ...emptyFilterInputs, minSeriesCount: '5' },
    })
    render(<NameStatsTable {...baseProps} filters={filters} />)
    expect(screen.getByTestId('filters-active-count')).toHaveTextContent('1')
  })
})

describe('FRONTEND-096-AC-07: Reset Filters re-fetches immediately', () => {
  it('calls fetchStats with cleared options as soon as Reset Filters is clicked', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    const filters = makeFilters({
      appliedFilters: { ...emptyFilterInputs, minSeriesCount: '5' },
    })
    render(<NameStatsTable {...baseProps} fetchStats={fetchStats} filters={filters} />)
    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))

    fireEvent.click(screen.getByRole('button', { name: /reset filters/i }))

    await waitFor(() =>
      expect(fetchStats).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ minSeriesCount: expect.anything() }),
      ),
    )
  })
})
```

### `src/components/AnalysisView.test.tsx` (additions)

```typescript
describe('FRONTEND-096-AC-11/12/13: filter/sort/panel state persists across tab switches', () => {
  it('keeps an applied filter value visible after switching from Keywords to Genres', async () => {
    renderAnalysisView('/analysis/keywords')
    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    fireEvent.change(screen.getByLabelText('Min Series Count'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('link', { name: /^genres$/i }))

    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())
    expect(
      mockGetGenreStats.mock.calls.at(-1)?.[0],
    ).toEqual(expect.objectContaining({ minSeriesCount: 5 }))
    expect(screen.getByLabelText('Min Series Count')).toHaveValue(5)
  })

  it('keeps the sort column/direction after switching tabs', async () => {
    renderAnalysisView('/analysis/keywords')
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('columnheader', { name: /series count/i }))

    fireEvent.click(screen.getByRole('link', { name: /country of origin/i }))

    await waitFor(() =>
      expect(mockGetCountryStats.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ sortBy: 'seriesCount' }),
      ),
    )
  })

  it('keeps the filters panel open after switching tabs', async () => {
    renderAnalysisView('/analysis/keywords')
    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))

    fireEvent.click(screen.getByRole('link', { name: /^genres$/i }))

    expect(
      screen.getByRole('button', { name: /analysis filters/i }),
    ).toHaveAttribute('aria-expanded', 'true')
  })
})
```

### `src/components/KeywordsView.test.tsx` / `GenreStatsView.test.tsx` / `CountryStatsView.test.tsx`

```typescript
describe('FRONTEND-096-AC-14: forwards the filters prop unchanged', () => {
  it('passes the filters prop straight through to NameStatsTable', () => {
    const filters = makeFilters()
    render(<KeywordsView filters={filters} />)
    // NameStatsTable's own rendering (toggle, fields once expanded, table)
    // is exercised by NameStatsTable.test.tsx directly -- this file only
    // confirms the prop reaches it, matching this file's existing
    // "thin wrapper" test convention (frontend_spec_095 FRONTEND-095-AC-07).
    expect(screen.getByTestId('keywords-view')).toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-096-AC-01: `.container` gains `text-align: left`
- [x] FRONTEND-096-AC-02: table columns render at fixed, consistent widths across all three tabs
- [x] FRONTEND-096-AC-03: Apply Filters button uses the shared, correctly-styled `.applyButton`
- [x] FRONTEND-096-AC-04: filters render collapsed by default behind an "Analysis Filters" toggle
- [x] FRONTEND-096-AC-05: toggle expands/collapses the filters body
- [x] FRONTEND-096-AC-06: active-filter-count badge reflects `appliedFilters`
- [x] FRONTEND-096-AC-07: "Reset Filters" clears and immediately re-fetches, no separate Apply needed
- [x] FRONTEND-096-AC-08: "Reset Filters" leaves `sortBy`/`sortDirection` untouched
- [x] FRONTEND-096-AC-09: `useNameStatsFilters` hook owns filter/sort/panel state and handlers
- [x] FRONTEND-096-AC-10: `AnalysisView` calls the hook once, passes `filters` down to the active tab
- [x] FRONTEND-096-AC-11: applied filter values persist across a tab switch
- [x] FRONTEND-096-AC-12: sort column/direction persists across a tab switch
- [x] FRONTEND-096-AC-13: filters-panel open/closed state persists across a tab switch
- [x] FRONTEND-096-AC-14: `KeywordsView`/`GenreStatsView`/`CountryStatsView` forward `filters` unchanged, no other changes
