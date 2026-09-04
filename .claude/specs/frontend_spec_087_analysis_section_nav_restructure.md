# Frontend Spec 087: Analysis Section Nav Restructure

**Status**: Not started
**Depends on**: Frontend Spec 086 (`frontend_spec_086_keyword_stats_filtering_sort_and_blended_rating.md`, the enhanced `KeywordsView` this restructure hosts as its first tab)
**Frontend Stage**: 87 of N

## Overview

Unit 2 of 4 in the "Analysis/Trends" expansion. Replaces the flat top-level `Keywords` nav link
with an `Analysis` section that hosts a small tab set — Keywords is wired here; Genres
(`frontend_spec_088`) and Country of Origin (`frontend_spec_089`) add their own tabs into this
same container without changing its shape, once their specs land. This is deliberately done
*before* those two specs so they build directly into the shared container instead of standing up
temporary standalone routes that would need moving later.

**Design decision**: reuses the app's existing sub-tab pattern exactly, rather than inventing a
new one — `App.tsx` already has a top-level `<Route path="/my-series/:statusTab">` rendering
`MySeriesView`, which reads the `statusTab` param and renders its own internal `<nav>` of
`NavLink`s to `/my-series/watching`, `/my-series/completed`, etc. (`App.tsx`, `MySeriesView.tsx`).
`AnalysisView` mirrors this shape one-for-one: a single `<Route path="/analysis/:tab">` reading a
`tab` param, with its own internal sub-nav.

---

## Requirements

### Requirement 1: `Analysis` Route & Nav

**User story**: As a user, I want a single "Analysis" area in the main nav that can grow to hold
more than just Keywords, so related data-analysis views live together instead of each getting its
own top-level slot.

#### Acceptance Criteria

- **FRONTEND-087-AC-01** [AUTO]: `App.tsx`'s top-level nav shall replace the `Keywords` `NavLink`
  (`to="/keywords"`) with an `Analysis` `NavLink` (`to="/analysis"`), positioned in the same slot
  between `Recommendations` and `Settings`.
- **FRONTEND-087-AC-02** [AUTO]: `App.tsx` shall add `<Route path="/analysis" element={<Navigate
  to="/analysis/keywords" replace />} />` and `<Route path="/analysis/:tab" element=
  {<AnalysisView />} />`. The old `<Route path="/keywords">` shall become `<Navigate
  to="/analysis/keywords" replace />` rather than being removed outright, so no existing
  bookmark/link to `/keywords` breaks.
- **FRONTEND-087-AC-03** [AUTO]: A new `AnalysisView` component shall read the `tab` route param
  and render an internal sub-nav (`<nav aria-label="Analysis">`) with one `NavLink
  to="/analysis/keywords"` labelled "Keywords" — mirroring `MySeriesView`'s existing internal
  status sub-nav structure. This is the only tab wired by this spec; later specs add further
  `NavLink`s into the same `<nav>` without otherwise changing `AnalysisView`.
- **FRONTEND-087-AC-04** [AUTO]: When `tab` is `keywords`, `AnalysisView` shall render
  `KeywordsView` below the sub-nav. An unrecognized `tab` value shall redirect to
  `/analysis/keywords` via `<Navigate replace />`, matching the app's existing top-level `*` →
  `/my-series` soft-redirect convention rather than rendering a blank or error state.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `:statusTab` param + internal sub-nav pattern this spec's `AnalysisView` mirrors | `App.tsx`, `MySeriesView.tsx` |
| Top-level catch-all redirect convention (`path="*"` → `Navigate replace`) this spec's unrecognized-`tab` handling mirrors | `App.tsx` |
| `KeywordsView` hosted as the first tab | `frontend_spec_086_keyword_stats_filtering_sort_and_blended_rating.md` |
| Later tabs added into this container | `frontend_spec_088_genre_stats_view.md`, `frontend_spec_089_country_of_origin_stats_view.md` |

---

## TDD Test Case Sketches

### `src/App.test.tsx` (additions)

```typescript
describe('FRONTEND-087-AC-01/02: Analysis nav and routing', () => {
  it('shows an Analysis nav link instead of Keywords', () => {
    render(<App />)
    expect(screen.queryByRole('link', { name: /^keywords$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^analysis$/i })).toBeInTheDocument()
  })

  it('redirects the old /keywords path to /analysis/keywords', async () => {
    window.history.pushState({}, '', '/keywords')
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/analysis/keywords'))
  })

  it('redirects bare /analysis to /analysis/keywords', async () => {
    window.history.pushState({}, '', '/analysis')
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/analysis/keywords'))
  })
})
```

### `src/components/AnalysisView.test.tsx` (new file)

```typescript
describe('FRONTEND-087-AC-03/04: tab sub-nav and content', () => {
  it('renders the Keywords sub-nav tab and KeywordsView content', () => {
    render(<AnalysisView />, { route: '/analysis/keywords' })

    expect(screen.getByRole('link', { name: /^keywords$/i })).toBeInTheDocument()
    expect(screen.getByTestId('keywords-view')).toBeInTheDocument()
  })

  it('redirects an unrecognized tab to keywords', async () => {
    render(<AnalysisView />, { route: '/analysis/not-a-real-tab' })

    await waitFor(() => expect(window.location.pathname).toBe('/analysis/keywords'))
  })
})
```

---

## Acceptance Criteria Summary

- [ ] FRONTEND-087-AC-01: top-level `Keywords` nav link replaced with `Analysis`
- [ ] FRONTEND-087-AC-02: `/analysis` → redirect; `/analysis/:tab` → `AnalysisView`; old `/keywords` redirects
- [ ] FRONTEND-087-AC-03: `AnalysisView` internal sub-nav with a `Keywords` tab
- [ ] FRONTEND-087-AC-04: `keywords` tab renders `KeywordsView`; unrecognized tab redirects
