# Frontend Spec 049: Always Send `sourceMode: 'useMySeries'` for "Use My Series"

**Status**: Implemented (2026-08-28) -- `frontend/src/components/RecommendationControls.tsx`,
`frontend/src/components/RecommendationControls.test.tsx`, `frontend/src/types/series.ts`.
**Priority**: P2 (paired frontend half of `series_spec_033` — **must ship in the same PR**, not sequentially;
see that spec's deployment note)
**Depends on**: Series Spec 033 (`series_spec_033_use_my_series_explicit_mode.md`, the backend routing change
this request-building change is required by) ✅. Frontend Spec 042
(`frontend_spec_042_recommendation_source_mode_reorganization.md`, owns `ControlsState.mode`/`applySourceModeQuery`
this spec extends) ✅.
**Area**: Frontend (`RecommendationControls.tsx`) — no new UI, request-building logic only.

## Overview

`series_spec_033` fixes a confirmed bug: a Custom Search request with only `minTmdbRating` set (no genre/
keyword) silently returned "Use My Series" pool-based candidates instead of a real Custom Search query, because
the backend had no explicit signal for "this is Use My Series" — it inferred that by elimination. The fix
requires the frontend to always send `sourceMode: 'useMySeries'` whenever that tab is active, regardless of
whether a specific-series narrowing selection has been made. Without this half shipping in the same PR as the
backend change, the "Use My Series" default view would silently start returning Custom Search's unfiltered
discover results instead of pool-based recommendations — see `series_spec_033`'s Design Decisions for why this
pair can't land sequentially like most others.

## Design Decisions

- **`applySourceModeQuery` sends `query.sourceMode = 'useMySeries'` unconditionally whenever `state.mode ===
  'useMySeries'`** — not only when `selectedSeriesIds` is empty. Today's existing `seriesIds` send (only when
  `selectedSeriesIds.length > 0`) is unchanged and sent alongside it when applicable; the two aren't mutually
  exclusive (`series_spec_033`'s validator explicitly allows the combination).
- **No client-side blocking for an empty Custom Search request.** Confirmed in discussion: an unfiltered Custom
  Search query is now a legitimate, backend-supported request (`series_spec_033`'s AC-09) — the existing
  "Enter at least one genre or keyword; otherwise this falls back to automatic recommendations" hint text
  becomes stale (it no longer falls back to automatic — it runs a real, if broad, Custom Search query) and needs
  rewording, but the request itself should still fire normally either way, same as today.
- **No change to Custom Search's own query-building** — `genres`/`keywords`/`minTmdbRating`/`yearMin`/`yearMax`
  continue being sent exactly as they already are; this spec only adds the new `sourceMode` value for the other
  tab.

---

## Requirement 1: "Use My Series" always sends an explicit `sourceMode`

**User story**: As a developer, I want "Use My Series" to unambiguously identify itself on every request, so
the backend never has to guess it from what's absent.

### FRONTEND-049-AC-01 [AUTO]
**Statement**: While "Use My Series" is active and no series are selected, the emitted `RecommendationQuery`
shall include `sourceMode: 'useMySeries'`.

**References**: `RecommendationControls.tsx`'s `applySourceModeQuery`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-049-AC-01: Use My Series sends sourceMode even with no selection', () => {
  it('includes sourceMode=useMySeries with nothing selected', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    onQueryChange.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ sourceMode: 'useMySeries' }),
    )
  })
})
```
**Test Case (Green)**: `applySourceModeQuery` sets `query.sourceMode = 'useMySeries'` whenever `state.mode ===
'useMySeries'`, unconditionally.

---

### FRONTEND-049-AC-02 [AUTO]
**Statement**: While "Use My Series" is active and one or more series are selected, the emitted
`RecommendationQuery` shall include **both** `sourceMode: 'useMySeries'` and `seriesIds`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-049-AC-02: sourceMode and seriesIds are both sent together', () => {
  it('includes both when a series is selected', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    await screen.findByLabelText(/^series$/i)

    fireEvent.change(screen.getByLabelText(/^series$/i), { target: { value: 'Show' } })
    fireEvent.click(await screen.findByText('Show'))
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ sourceMode: 'useMySeries', seriesIds: ['1'] }),
    )
  })
})
```
**Test Case (Green)**: `sourceMode`'s unconditional send (AC-01) and the existing `seriesIds` conditional both
apply — no `if`/`else` between them.

---

### FRONTEND-049-AC-03 [AUTO]
**Statement**: While any Discover sub-mode is active, the emitted `RecommendationQuery` shall never include
`sourceMode: 'useMySeries'`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-049-AC-03: Discover modes never send sourceMode=useMySeries', () => {
  it('omits sourceMode=useMySeries under Custom Search', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    onQueryChange.mockClear()

    expect(onQueryChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceMode: 'useMySeries' }),
    )
  })
})
```
**Test Case (Green)**: `applySourceModeQuery`'s `useMySeries` branch is gated on `state.mode === 'useMySeries'`
specifically, never firing under `state.mode === 'discover'`.

---

### FRONTEND-049-AC-04 [AUTO]
**Statement**: An empty Custom Search request (no genres, keywords, rating, or year set) shall still fire
normally on Apply Filters — no client-side blocking or validation error.

**References**: the existing "Enter at least one genre or keyword..." hint, whose copy needs updating to
reflect it's no longer a fallback warning (Implementation Notes) — this AC only covers the request still firing.

**Test Case (Red)**:
```typescript
describe('FRONTEND-049-AC-04: an empty Custom Search request still fires', () => {
  it('calls onQueryChange with no blocking', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /custom search/i }))
    onQueryChange.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(onQueryChange).toHaveBeenCalled()
  })
})
```
**Test Case (Green)**: no new blocking logic added — confirms the existing "always allow Apply Filters" behavior
already satisfies this, now that the backend supports an empty Custom Search query correctly.

---

## Implementation Notes

- **Update the stale hint text.** The existing empty-genre/keyword hint under Custom Search ("Enter at least
  one genre or keyword; otherwise this falls back to automatic recommendations") is no longer accurate —
  nothing falls back to automatic anymore. Reword to something like "Leave empty to browse the most popular
  shows overall" (or similar), reflecting the new unfiltered-discover behavior rather than describing a
  fallback that no longer happens.
- No change to `ControlsState`'s shape — `sourceMode` is already computed at query-build time from `state.mode`,
  not stored as its own state field.

## Cross-References

| This spec | Source |
|---|---|
| Backend routing fix this request-building change is required by — **ships in the same PR** | `series_spec_033_use_my_series_explicit_mode.md` |
| `ControlsState.mode`/`applySourceModeQuery` this spec extends | `frontend_spec_042_recommendation_source_mode_reorganization.md` |
| The stale hint text this spec updates | `frontend_spec_042_recommendation_source_mode_reorganization.md` (`showGenreKeywordHint`) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-049-AC-01: Use My Series sends `sourceMode` even with no selection
- [x] FRONTEND-049-AC-02: `sourceMode` and `seriesIds` are both sent together
- [x] FRONTEND-049-AC-03: Discover modes never send `sourceMode: 'useMySeries'`
- [x] FRONTEND-049-AC-04: an empty Custom Search request still fires
