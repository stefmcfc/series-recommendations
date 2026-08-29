# Frontend Spec 050: `excludeFromRecommendations` — Picker Enforcement & List Indicator

**Status**: Not started
**Priority**: P2 (paired with Series Spec 034 — the UI half of making the exclude flag an absolute
rule, plus closing a separate, related display gap on the same field)
**Depends on**: Frontend Spec 035 (`frontend_spec_035_specific_series_picker.md`, owns
`buildSpecificSeriesCandidatePool`/`RecommendationControls.tsx`'s Specific Series picker and "Show
all series" modal) ✅, Frontend Spec 012 (`frontend_spec_012_series_lifecycle_controls.md`, owns
`Series.excludeFromRecommendations` on the frontend type and the `EditSeriesForm` checkbox) ✅,
Frontend Spec 023 (`frontend_spec_023_series_refresh.md`, owns the `newContentBadge`
conditional-badge pattern this spec's Requirement 2 mirrors) ✅, Series Spec 034
(`series_spec_034_exclude_from_recommendations_enforcement.md`, the paired backend change — this
spec's Requirement 1 is what keeps a normal UI user from ever sending an excluded id in the first
place, backed by that spec's server-side enforcement)
**Area**: Frontend (`components/RecommendationControls.tsx`, `components/SeriesList.tsx`)

## Overview

Two gaps against the same field (`Series.excludeFromRecommendations`), both confirmed 2026-08-29
and bundled into one spec since they touch the same field end-to-end:

1. **The "Use My Series" Specific Series picker offers excluded series as selectable options.**
   `buildSpecificSeriesCandidatePool` (shared by both the inline picker and the "Show all series"
   browse modal) filters `allSeries` by genre and status, but never by
   `excludeFromRecommendations` — a user can hand-pick a series they've explicitly marked
   "don't use this for recommendations." Paired with Series Spec 034 (which now also enforces this
   server-side), this spec stops the picker from ever offering the option in normal use.
2. **`SeriesList` has no visual indicator for the flag at all.** The flag is fully editable via
   `EditSeriesForm` (`FRONTEND-012-AC-05`), but nothing in `SeriesList.tsx` reads
   `s.excludeFromRecommendations` — there's no way to see which series are excluded without opening
   each one's Edit form individually.

## Design Decisions

- **Requirement 1 filters `allSeries` before genre/status filtering, not after.** A new step in
  `buildSpecificSeriesCandidatePool`: `const selectable = allSeries.filter(s =>
  !s.excludeFromRecommendations)`, feeding `filterSpecificSeriesByGenre`/`ByStatus` instead of raw
  `allSeries`. This applies identically to both consumers of the function (the inline picker and
  the browse-all modal), per the function's own existing "shared by both" contract
  (`FRONTEND-035-AC-13`).
- **The existing `missingSelected` union-back stays sourced from the *unfiltered* `allSeries`, not
  the new `selectable` list.** This is a deliberate reuse of the mechanism `FRONTEND-035-AC-07`
  already built for a different case (a genre/status filter narrowing away an already-selected
  series) — extended here to the same failure mode for exclusion: if a series was selected before
  being marked excluded (a stale client fetch, or another tab editing it mid-session), its chip
  still resolves a correct label instead of falling back to a raw id. This spec only prevents *new*
  selection of an excluded series — it does not retroactively deselect or hide an already-selected
  one, and does not need to, since Series Spec 034 silently drops it from the effective source pool
  server-side regardless.
- **Requirement 2 follows the existing `newContentBadge` pattern exactly** (`FRONTEND-023-AC-18`) —
  a conditional `<span>` in `SeriesList.tsx`'s `rowSecondaryLeft` block, alongside the existing
  status text and (when present) the "New content" badge. Read-only: no click handler, no toggle —
  the flag stays editable only via `EditSeriesForm`, matching how the "New content" badge is also
  purely informational in the list (its own dismiss action lives on `SeriesDetail`, not the row).
- **Badge copy and `data-testid`**: `"Excluded from recommendations"` /
  `data-testid="excluded-from-recommendations-badge"` — concrete enough to be testable; exact
  wording is a minor implementer call as long as the testid is stable.

---

## Requirement 1: Specific Series picker never offers an excluded series

**User story**: As a user, if I've marked a series "exclude from recommendations," I don't want to
be able to accidentally pick it anyway from the Specific Series picker — the flag should mean what
it says everywhere in the UI, not just automatically.

### FRONTEND-050-AC-01 [AUTO]
**Statement**: `buildSpecificSeriesCandidatePool` shall exclude any series with
`excludeFromRecommendations === true` from its returned pool before applying genre filtering,
status filtering, or sort — affecting both the inline "Specific Series" picker
(`id="specific-series-picker"`) and the "Show all series" browse modal, since both consume this
same function's output.

**References**: `RecommendationControls.tsx`'s `buildSpecificSeriesCandidatePool`,
`filterSpecificSeriesByGenre`, `filterSpecificSeriesByStatus`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-050-AC-01: excluded series are never offered in the Specific Series picker', () => {
  it('does not show an excluded series as a selectable suggestion', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Included Show', status: 'COMPLETED' }),
      makeSeries({ id: '2', title: 'Excluded Show', status: 'COMPLETED', excludeFromRecommendations: true }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    // switch to Use My Series > Specific Series mode, open the picker
    fireEvent.change(await screen.findByLabelText('Specific Series'), { target: { value: 'Show' } })

    expect(screen.getByRole('button', { name: /Included Show/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Excluded Show/ })).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `selectable = allSeries.filter(s =>
!s.excludeFromRecommendations)` step at the top of `buildSpecificSeriesCandidatePool`, and feed it
(not raw `allSeries`) into the existing genre/status filter chain.

---

### FRONTEND-050-AC-02 [AUTO]
**Statement**: The "Show all series" browse modal shall also never list an excluded series as
selectable — it consumes the same `buildSpecificSeriesCandidatePool` output as the inline picker,
so this is a regression guard confirming AC-01 covers both call sites, not separate logic.

**Test Case (Red)**:
```typescript
describe('FRONTEND-050-AC-02: excluded series are never offered in the browse-all modal', () => {
  it('omits an excluded series from the "Show all series" modal', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Included Show', status: 'COMPLETED' }),
      makeSeries({ id: '2', title: 'Excluded Show', status: 'COMPLETED', excludeFromRecommendations: true }),
    ])
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /show all series/i }))

    expect(screen.getByRole('button', { name: /Included Show/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Excluded Show/ })).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: no additional code beyond AC-01 — both call sites already pass through the
same shared function.

---

### FRONTEND-050-AC-03 [AUTO] (regression guard)
**Statement**: A series already present in `selectedSeriesIds` shall still render a correct chip
label even if it has `excludeFromRecommendations === true` (e.g. selected before being marked
excluded) — the existing `missingSelected` union-back mechanism (`FRONTEND-035-AC-07`) is
unaffected by this spec, since it's computed from the unfiltered `allSeries`, not the new
`selectable` list.

**Test Case (Red)**:
```typescript
describe('FRONTEND-050-AC-03: an already-selected-then-excluded series still resolves its chip label', () => {
  it('keeps the chip label instead of falling back to the raw id', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Now Excluded Show', status: 'COMPLETED', excludeFromRecommendations: true }),
    ])
    // render with selectedSeriesIds already containing '1' (e.g. via initial state/props)
    render(<RecommendationControls onQueryChange={vi.fn()} initialSelectedSeriesIds={['1']} />)

    expect(await screen.findByText('Now Excluded Show')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: no code change beyond AC-01 — `missingSelected`'s existing source
(`allSeries`, not `selectable`) already produces this.

---

## Requirement 2: `SeriesList` shows a visual indicator for `excludeFromRecommendations`

**User story**: As a user browsing my series list, I want to see at a glance which series I've
excluded from recommendations, without opening each one's Edit form to check.

### FRONTEND-050-AC-04 [AUTO]
**Statement**: `SeriesList`'s row `rowSecondaryLeft` block shall render a badge
(`data-testid="excluded-from-recommendations-badge"`, text "Excluded from recommendations") when
`s.excludeFromRecommendations === true`, alongside the existing status text and (when present) the
"New content" badge — following the same conditional-`<span>` pattern as
`newContentBadge`/`FRONTEND-023-AC-18`.

**References**: `SeriesList.tsx`'s `rowSecondaryLeft` block; `newContentBadge`
(`FRONTEND-023-AC-18`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-050-AC-04: excluded-from-recommendations badge', () => {
  it('shows the badge for a series with excludeFromRecommendations=true', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ excludeFromRecommendations: true })])
    render(<SeriesList {...defaultProps} />)
    expect(await screen.findByTestId('excluded-from-recommendations-badge')).toBeInTheDocument()
  })

  it('does not show the badge for a series with excludeFromRecommendations=false', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ excludeFromRecommendations: false })])
    render(<SeriesList {...defaultProps} />)
    await screen.findByTestId('series-row')
    expect(screen.queryByTestId('excluded-from-recommendations-badge')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add `{s.excludeFromRecommendations && <span
className={styles.excludedBadge} data-testid="excluded-from-recommendations-badge">Excluded from
recommendations</span>}` next to the existing `newContentBadge` conditional in `rowSecondaryLeft`,
plus a corresponding `.excludedBadge` rule in `SeriesList.module.css` (visually distinct from
`newContentBadge`, e.g. muted/neutral styling — this is a "don't use" marker, not an alert).

---

### FRONTEND-050-AC-05 [AUTO] (regression guard)
**Statement**: The badge shall be read-only — it shall not render a button, checkbox, or any click
handler that toggles `excludeFromRecommendations`. The flag remains editable only via
`EditSeriesForm`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-050-AC-05: badge is read-only', () => {
  it('renders the badge as a plain span with no interactive role', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ excludeFromRecommendations: true })])
    render(<SeriesList {...defaultProps} />)
    const badge = await screen.findByTestId('excluded-from-recommendations-badge')
    expect(badge.tagName).toBe('SPAN')
    expect(badge).not.toHaveAttribute('role', 'button')
  })
})
```
**Test Case (Green)**: falls out of AC-04's implementation directly — a plain `<span>`, no handler
attached.

---

## Cross-References

| This spec | Source |
|---|---|
| `buildSpecificSeriesCandidatePool`, the Specific Series picker, "Show all series" modal | `frontend_spec_035_specific_series_picker.md` |
| `Series.excludeFromRecommendations`, `EditSeriesForm` checkbox | `frontend_spec_012_series_lifecycle_controls.md` |
| `newContentBadge` conditional-badge pattern this spec's Requirement 2 mirrors | `frontend_spec_023_series_refresh.md` (`FRONTEND-023-AC-18`) |
| Paired backend enforcement — server-side filtering of excluded ids from `seriesIds` | `series_spec_034_exclude_from_recommendations_enforcement.md` |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-050-AC-01: excluded series are never offered in the inline Specific Series picker
- [ ] FRONTEND-050-AC-02: excluded series are never offered in the "Show all series" browse modal
- [ ] FRONTEND-050-AC-03: an already-selected-then-excluded series still resolves its chip label
- [ ] FRONTEND-050-AC-04: `SeriesList` renders an "Excluded from recommendations" badge
- [ ] FRONTEND-050-AC-05: the badge is read-only, not a toggle
