# Frontend Spec 073: My Series Title Becomes a Real-Time Filter

**Status**: Not started
**Priority**: P3
**Depends on**: Frontend Spec 071 (`frontend_spec_071_my_series_filter_sheet.md`, owns the sheet this spec removes a field from) ✅ required
**Area**: Frontend (`components/SearchFilter.tsx`, `components/SeriesList.tsx`, `App.tsx`, new `hooks/useDebouncedValue.ts`)

## Overview

Title is the single most-used filter on My Series, but today it's buried inside the filter sheet (`frontend_spec_071`) — finding a series by name requires opening the sheet, typing, and clicking Search. This spec moves Title out of the sheet entirely and turns it into a live, always-visible search box on the My Series page itself: typing filters the list automatically (debounced), with no sheet to open and no Search button to click.

No debounce utility exists anywhere in this frontend today — this spec introduces one.

## Design Decisions

- **Title is removed from the sheet's `FormState`/`buildCriteria`/JSX entirely** (`SearchFilter.tsx:20-77`, the Title field at lines 220-229) — it is no longer a sheet-owned filter.
- **New live Title input lives on the My Series page itself**, in its own slot near the "My Series" heading (`SeriesList.tsx`'s header, `styles.header` at line 397) — not folded into the existing icon-toolbar row, which stays visually dense regardless of `frontend_spec_072`'s Refresh All removal. Exact placement is a CSS/layout decision for implementation; functionally it must be visible without opening any sheet or modal.
- **New `useDebouncedValue` hook** (`frontend/src/hooks/useDebouncedValue.ts`) — generic `useDebouncedValue<T>(value: T, delayMs: number): T`, returning `value` only after it's stayed unchanged for `delayMs`. No existing debounce/`setTimeout`-based pattern exists anywhere in `frontend/src` to reuse.
- **Debounce window: 350ms** — long enough to avoid firing a request per keystroke, short enough to still feel immediate.
- **Title state is lifted to `MySeriesView`** (`App.tsx`), alongside `criteria`/`isFiltersOpen`, and merged into `effectiveCriteria` the same way `status` already is (`effectiveCriteria = { ...criteria, status }` becomes `{ ...criteria, status, title: debouncedTitle || undefined }`, taking care not to let an empty string linger as `criteria.title`).
- **The live title box has its own clear ("×") affordance**, independent of the sheet's "Clear Filters" — clearing it doesn't require opening the sheet. Conversely, the sheet's "Clear Filters" (`SearchFilter.tsx`'s `handleClear`) no longer touches title at all, since title is no longer part of its `FormState`.
- **The funnel icon's `hasActiveFilters` indicator stays scoped to sheet-owned fields only** — a live title search does not light up the dot, since the dot exists to signal "there are hidden filters applied inside the sheet you can't currently see," and title is no longer hidden inside anything.
- **Server-side filtering is unchanged** — `title` is still sent as `SearchCriteria.title` and matched exactly as it is today (`SeriesSearchService`); this spec only changes *how* the value reaches that existing param, not the matching behavior itself.

## Requirements

### Requirement 1: `useDebouncedValue` hook

**User Story**: As a developer, I need a reusable way to debounce rapidly-changing input before it drives an API call, since none exists in this codebase yet.

#### FRONTEND-073-AC-01 [AUTO]: debounces a changing value
**Statement**: `useDebouncedValue(value, delayMs)` shall return the previous value until `value` has remained unchanged for `delayMs`, at which point it shall return the latest value.

**Rationale**: Core debounce contract.

**References**:
- New file: `frontend/src/hooks/useDebouncedValue.ts`

**Test Case (Red)**:
```typescript
describe('FRONTEND-073-AC-01: useDebouncedValue debounces', () => {
  it('only updates after the delay elapses with no further changes', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 350),
      { initialProps: { value: 'a' } },
    )
    rerender({ value: 'ab' })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('a')

    act(() => vi.advanceTimersByTime(150))
    expect(result.current).toBe('ab')
    vi.useRealTimers()
  })
})
```

**Test Case (Green)**: `useState` + `useEffect` with a `setTimeout(() => setDebounced(value), delayMs)`, cleared/reset on every `value` change.

### Requirement 2: Title moves out of the sheet onto the page

**User Story**: As a user, I want to search by title without opening the filter sheet.

#### FRONTEND-073-AC-02 [AUTO]: sheet no longer has a Title field
**Statement**: `SearchFilter`'s sheet shall no longer render a Title input, and `buildCriteria` shall no longer set `title` on the resulting `SearchCriteria`.

**Rationale**: Title is relocating, not duplicating.

**References**:
- Component: `components/SearchFilter.tsx` (`FormState.title`, the Title field JSX at lines 220-229, `buildCriteria` line 55)

**Test Case (Red)**:
```typescript
describe('FRONTEND-073-AC-02: sheet no longer has a Title field', () => {
  it('does not render a Title input inside the sheet', () => {
    render(<SearchFilter isOpen={true} onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)
    expect(screen.queryByLabelText(/^title$/i)).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: remove `title` from `FormState`/`initialFormState`/`buildCriteria`, delete the Title field JSX.

#### FRONTEND-073-AC-03 [AUTO]: My Series renders a live Title search box
**Statement**: `SeriesList` shall render a Title search input (`data-testid="live-title-search"`) directly on the page, always visible regardless of the filter sheet's open/closed state.

**Rationale**: Core visibility requirement — no sheet interaction needed to search by title.

**References**:
- Component: `components/SeriesList.tsx`, header (`styles.header`, line 397)

**Test Case (Red)**:
```typescript
describe('FRONTEND-073-AC-03: live Title search box renders on the page', () => {
  it('renders a title search input outside any dialog', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList onSeriesClick={vi.fn()} onAddClick={vi.fn()} onEditClick={vi.fn()} />)
    await screen.findByTestId('series-list')

    expect(screen.getByTestId('live-title-search')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: new controlled text input in `SeriesList.tsx`'s header, with an `onChange` prop supplied by `MySeriesView` (see AC-04) and a visible clear button when non-empty.

#### FRONTEND-073-AC-04 [AUTO]: typing debounces into the fetch criteria
**Statement**: When the user types into the live Title search box, `MySeriesView` shall debounce the value (350ms) before merging it into `effectiveCriteria.title`, triggering `SeriesList`'s existing fetch effect only once the debounce settles.

**Rationale**: Prevents a request per keystroke while still feeling immediate.

**References**:
- Component: `App.tsx`, `MySeriesView`
- Hook: `hooks/useDebouncedValue.ts` (`FRONTEND-073-AC-01`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-073-AC-04: typing debounces into fetch criteria', () => {
  it('does not refetch until the debounce settles', async () => {
    vi.useFakeTimers()
    mockGetAll.mockResolvedValue([])
    mockSearch.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.change(screen.getByTestId('live-title-search'), {
      target: { value: 'office' },
    })
    expect(mockSearch).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(350))
    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'office' }),
        undefined,
      ),
    )
    vi.useRealTimers()
  })
})
```

**Test Case (Green)**: `MySeriesView` owns `[rawTitle, setRawTitle]`, `const debouncedTitle = useDebouncedValue(rawTitle, 350)`, merged into `effectiveCriteria`'s `useMemo` dependency array and object.

#### FRONTEND-073-AC-05 [AUTO]: clearing the live title box is independent of Clear Filters
**Statement**: The live Title search box shall have its own clear control that resets it without affecting any sheet-owned filter; conversely, the sheet's "Clear Filters" shall not alter the live Title search box's value.

**Rationale**: The two are now fully independent controls with independent state.

**References**:
- Component: `components/SeriesList.tsx` (live title box), `components/SearchFilter.tsx` (`handleClear`, unaffected)

**Test Case (Red)**:
```typescript
describe('FRONTEND-073-AC-05: live title clear is independent of Clear Filters', () => {
  it('Clear Filters in the sheet does not reset the live title box', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.change(screen.getByTestId('live-title-search'), { target: { value: 'office' } })
    fireEvent.click(screen.getByTestId('open-filters-btn'))
    fireEvent.click(await screen.findByTestId('clear-filters-btn'))

    expect(screen.getByTestId('live-title-search')).toHaveValue('office')
  })
})
```

**Test Case (Green)**: title state lives entirely in `MySeriesView`, untouched by `SearchFilter`'s `onClear` callback.

#### FRONTEND-073-AC-06 [AUTO]: the funnel icon's active-filter dot ignores live title
**Statement**: `hasActiveFilters` (driving the funnel icon's active-filter dot) shall be computed from sheet-owned criteria only, excluding the live title value.

**Rationale**: The dot signals filters hidden inside the sheet — title is no longer hidden anywhere.

**References**:
- Component: `App.tsx`, `MySeriesView` (`hasActiveFilters` calculation)

**Test Case (Red)**:
```typescript
describe('FRONTEND-073-AC-06: active-filter dot ignores live title', () => {
  it('does not show the active-filter dot from typing a title alone', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await screen.findByTestId('series-list')

    fireEvent.change(screen.getByTestId('live-title-search'), { target: { value: 'office' } })

    expect(screen.queryByTestId('filters-active-dot')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: `hasActiveFilters` continues to derive from the sheet's own `criteria` state (set only via `SearchFilter`'s `onSearch`), not from the separately-tracked live title state.

## Cross-References

| Concept | Location |
|---|---|
| Sheet this removes a field from | `frontend_spec_071_my_series_filter_sheet.md` |
| `SearchCriteria.title`, unchanged server-side matching | `frontend_spec_006`/`series_spec_003` |
| Debounce hook | new `hooks/useDebouncedValue.ts` |
| Composition point | `App.tsx`, `MySeriesView` |

## Acceptance Criteria Summary

- [ ] FRONTEND-073-AC-01: `useDebouncedValue` debounces a changing value
- [ ] FRONTEND-073-AC-02: sheet no longer has a Title field
- [ ] FRONTEND-073-AC-03: My Series renders a live Title search box
- [ ] FRONTEND-073-AC-04: typing debounces into the fetch criteria
- [ ] FRONTEND-073-AC-05: clearing the live title box is independent of Clear Filters
- [ ] FRONTEND-073-AC-06: the funnel icon's active-filter dot ignores live title
