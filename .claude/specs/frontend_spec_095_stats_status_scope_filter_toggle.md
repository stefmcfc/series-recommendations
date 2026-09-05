# Frontend Spec 095: Stats Status Scope Filter Toggle

**Status**: Done
**Depends on**: Series Spec 051 (`series_spec_051_stats_status_scope_filter.md`, the backend `onlyCompleted` contract this surfaces), Frontend Spec 086 (`frontend_spec_086_keyword_stats_filtering_sort_and_blended_rating.md`, the original `KeywordsView` filter UI), Frontend Spec 088 (`frontend_spec_088_genre_stats_view.md`, `GenreStatsView`), this session's `NameStatsTable` extraction (a no-behavior-change refactor with no spec number of its own — `frontend/src/components/NameStatsTable.tsx`)
**Frontend Stage**: 95 of N

## Overview

Surfaces `series_spec_051`'s backend `onlyCompleted` filter as a status-scope control — "All
Series" (default) vs. "Completed Only" — on the shared `NameStatsTable` component. Because both
`KeywordsView` and `GenreStatsView` are now thin wrappers rendering `NameStatsTable` with their own
config (`frontend_spec_086`/`088`, and this session's extraction), adding the control to
`NameStatsTable` once means both existing views — and the future Country-of-Origin view
(`frontend_spec_089`) — gain it with no changes of their own.

**Design decisions**:
- **Applied via the existing "Apply Filters" button, not live-as-you-type or immediate-on-select.**
  Consistent with `NameStatsTable`'s three existing min-value filters (`frontend_spec_086`
  FRONTEND-086-AC-05) — one Apply action commits every filter field at once, so this control
  doesn't need its own separate re-fetch trigger.
- **A two-option `<select>`, not a checkbox.** "All Series" / "Completed Only" reads more clearly
  as a named choice than an unlabeled boolean checkbox, and matches this project's preference for
  explicit, self-describing controls (e.g. `SearchFilter`'s status dropdown) over bare checkboxes
  for scope-narrowing choices.
- **`KeywordsView`/`GenreStatsView` require zero code changes.** Both are already pure
  config-passing wrappers around `NameStatsTable` (this session's extraction) — the new control,
  its state, and its wiring into `fetchStats` live entirely inside `NameStatsTable` itself. This is
  called out as its own acceptance criterion specifically because it's the payoff of that earlier
  extraction: without it, this would have been two near-identical retrofits instead of one.

---

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the `onlyCompleted` filter typed and available the same way
the existing min-value filters already are.

#### Acceptance Criteria

- **FRONTEND-095-AC-01** [AUTO]: `NameStatsOptions` (`NameStatsTable.tsx`) shall gain
  `onlyCompleted?: boolean`.
- **FRONTEND-095-AC-02** [AUTO]: `KeywordStatsOptions` and `GenreStatsOptions`
  (`src/types/series.ts`) shall each gain `onlyCompleted?: boolean`, matching `NameStatsOptions`.
- **FRONTEND-095-AC-03** [AUTO]: `buildKeywordStatsParams`/`buildGenreStatsParams`
  (`seriesApi.ts`) shall include `onlyCompleted` in the request's query params only when it is
  explicitly `true` — an omitted or `false` value is never sent as `onlyCompleted=false`, matching
  this codebase's existing `addIfPresent` convention for optional params.

---

### Requirement 2: Status Scope Control

**User story**: As a user with a large tracked collection, I want to restrict a stats table to
shows I've actually finished, so in-progress or dropped series don't skew the patterns I'm looking
for — the same way I can already narrow by minimum series count or rating.

#### Acceptance Criteria

- **FRONTEND-095-AC-04** [AUTO]: `NameStatsTable` shall render a `<select id="{idPrefix}-status-
  filter">` with two options — "All Series" (default/initially selected) and "Completed Only" —
  alongside the three existing minimum-value filter inputs, with an associated `<label>`.
- **FRONTEND-095-AC-05** [AUTO]: Selecting "Completed Only" and clicking "Apply Filters" shall
  re-fetch with `onlyCompleted: true` included in the options passed to `fetchStats`.
- **FRONTEND-095-AC-06** [AUTO]: Selecting "All Series" (including reverting back to it) and
  clicking "Apply Filters" shall re-fetch with `onlyCompleted` omitted entirely from the options —
  never sent as `false`.
- **FRONTEND-095-AC-07** [AUTO]: `KeywordsView.tsx` and `GenreStatsView.tsx` require no source
  changes to support this control — verified by confirming both files are unmodified by this
  spec's implementation, since the control, its state, and its wiring live entirely inside
  `NameStatsTable`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `onlyCompleted` contract this control drives | `series_spec_051_stats_status_scope_filter.md` |
| `NameStatsTable`, `NameStatsOptions`, existing min-value filter/Apply-button pattern this extends | `frontend/src/components/NameStatsTable.tsx` (this session's extraction, no spec number) |
| `KeywordsView`/`GenreStatsView` thin-wrapper shape this spec leaves untouched | `frontend_spec_086_keyword_stats_filtering_sort_and_blended_rating.md`, `frontend_spec_088_genre_stats_view.md` |
| Not yet implemented — inherits this control automatically once built on `NameStatsTable` | `frontend_spec_089_country_of_origin_stats_view.md` |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (additions)

```typescript
describe('FRONTEND-095-AC-03: onlyCompleted only sent when true', () => {
  it('includes onlyCompleted when true', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })
    await seriesApi.getKeywordStats({ onlyCompleted: true })
    expect(client.get).toHaveBeenCalledWith('/series/keywords', {
      params: { onlyCompleted: true },
    })
  })

  it('omits onlyCompleted when false or absent', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })
    await seriesApi.getGenreStats({ onlyCompleted: false })
    expect(client.get).toHaveBeenCalledWith('/series/genres/stats', { params: {} })
  })
})
```

### `src/components/NameStatsTable.test.tsx` (new or existing file — additions)

```typescript
describe('FRONTEND-095-AC-04/05/06: status scope filter', () => {
  it('defaults to All Series and omits onlyCompleted on Apply', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<NameStatsTable testId="t" heading="T" idPrefix="t" nameColumnLabel="Name" loadingLabel="L" errorLabel="E" fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(fetchStats.mock.calls.at(-1)[0]).not.toHaveProperty('onlyCompleted'),
    )
  })

  it('sends onlyCompleted: true after selecting Completed Only and applying', async () => {
    const fetchStats = vi.fn().mockResolvedValue([])
    render(<NameStatsTable testId="t" heading="T" idPrefix="t" nameColumnLabel="Name" loadingLabel="L" errorLabel="E" fetchStats={fetchStats} />)
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'completed' } })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(fetchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ onlyCompleted: true }),
      ),
    )
  })
})
```

### `src/components/KeywordsView.test.tsx` / `GenreStatsView.test.tsx`

No new test cases required — FRONTEND-095-AC-07 is verified by these files (and `KeywordsView.tsx`/`GenreStatsView.tsx` themselves) requiring zero changes, not by new assertions.

---

## Acceptance Criteria Summary

- [x] FRONTEND-095-AC-01: `NameStatsOptions.onlyCompleted`
- [x] FRONTEND-095-AC-02: `KeywordStatsOptions`/`GenreStatsOptions` gain `onlyCompleted`
- [x] FRONTEND-095-AC-03: sent only when `true`, never as `false`
- [x] FRONTEND-095-AC-04: status-scope `<select>` rendered with a `<label>`
- [x] FRONTEND-095-AC-05: "Completed Only" + Apply sends `onlyCompleted: true`
- [x] FRONTEND-095-AC-06: "All Series" + Apply omits `onlyCompleted`
- [x] FRONTEND-095-AC-07: `KeywordsView`/`GenreStatsView` unmodified
