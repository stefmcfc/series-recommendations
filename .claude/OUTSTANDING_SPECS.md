# Outstanding Specs

A live index of every spec in `.claude/specs/` that is either **not started** or has **unchecked
acceptance criteria**. This file exists so "what's left to build" doesn't require re-reading all
70+ specs from scratch each session.

**Maintenance rule** (see `CLAUDE.md`'s Working Conventions): this file is updated, not
regenerated from scratch, whenever a spec changes:
- **New spec written** (`ears-spec` skill): add an entry here.
- **Spec altered** (status changes, an AC gets checked off, requirements are added/superseded):
  update that spec's entry to match.
- **Spec fully completed** (every AC in its Acceptance Criteria Summary is checked, `[x]`):
  remove its entry from this file entirely — the spec file itself remains the permanent record,
  this file only tracks what's *left*.
- A spec whose only unchecked boxes are marked superseded/not-implementable (redirected to a
  different, already-completed spec — e.g. `frontend_spec_012`, `series_spec_008`) does **not**
  belong here; those items are permanently resolved, not outstanding.

Last full audit: 2026-08-26.

---

## Summary

| # | Spec | What's left | Unchecked ACs | Priority | Blocked by another outstanding spec? |
|---|------|-------------|----------------|----------|----------------------------------------|
| 1 | [`frontend_spec_013_star_ratings.md`](specs/frontend_spec_013_star_ratings.md) | Requirements 1–3 (`StarRating` component, display integration, input integration). Requirements 4–5 (sort control) are already done. | AC-01–AC-09 (9) | Not specified | No |
| 2 | [`frontend_spec_034_recommendation_add_form_fields.md`](specs/frontend_spec_034_recommendation_add_form_fields.md) | Entire spec | AC-01–AC-06 (6) | Low | No |
| 3 | [`frontend_spec_035_specific_series_picker.md`](specs/frontend_spec_035_specific_series_picker.md) | Entire spec | AC-01–AC-16 (16) | P3 | No |
| 4 | [`frontend_spec_039_sort_aware_rating_display.md`](specs/frontend_spec_039_sort_aware_rating_display.md) | Entire spec | AC-01 (1) | P3 | No |

Every outstanding spec's *stated* dependencies are already fully implemented — none of the four
blocks on undelivered work from another. Where a spec cites `frontend_spec_013` as a dependency
(specs 035 and 039), it's explicitly scoped to that spec's already-done Requirements 4–5 (the sort
control), not the outstanding Requirements 1–3 — confirmed by reading each spec's own "Depends on"
line, not inferred.

---

## Suggested build order

1. **`frontend_spec_013`** (Requirements 1–3) — no blockers, and it's the most foundational of the
   four: it adds the shared `StarRating` component and touches `SeriesDetail.tsx`, `SeriesList.tsx`,
   `AddSeriesForm.tsx`, and `EditSeriesForm.tsx`. Building it first means specs 2 and 3 below (which
   touch two of the same files) land on top of a settled codebase instead of the reverse.
2. **`frontend_spec_039`** — single AC, touches `SeriesList.tsx`'s rating column directly adjacent
   to the work Spec 013 just did there (013 adds a `personalRating` column; 039 changes what the
   existing rating column shows). Sequencing it immediately after 013 means both passes over that
   component's rating-related JSX happen close together rather than reopening it later.
3. **`frontend_spec_034`** — touches `AddSeriesForm.tsx`, which 013 will have just changed (its
   Personal Rating field becomes a `StarRating`). Building 034 after 013 avoids rebasing 034's
   field-visibility changes across 013's input swap — the two touch different fields in the same
   file, so order avoids friction rather than resolving a hard conflict. Low priority otherwise.
4. **`frontend_spec_035`** — the largest of the four (16 ACs) and the only one with zero file
   overlap with the other three (`KeywordPicker.tsx`, `RecommendationControls.tsx`). P3
   (quality-of-life, not urgent) and fully self-contained — best done last.

This project's git workflow already restricts work to one spec pair in flight at a time, so this
order is about minimizing rebase friction and doing foundational work first, not resolving hard
blocking dependencies (there are none among these four).

---

## Detail

### 1. `frontend_spec_013_star_ratings.md` — Requirements 1–3
Replaces every numeric `personalRating` display/input with a shared `StarRating` component
(read-only in `SeriesDetail`/`SeriesList`, interactive in `AddSeriesForm`/`EditSeriesForm`).
Requirements 4–5 (the sort control, `SortOptions` type) are done and are what specs 3 and 4 below
lean on as precedent/reuse — only Requirements 1–3 are outstanding.
- **Depends on**: Frontend Specs 002/003/004/005 ✅, Series Spec 009 ✅ — all implemented.

### 2. `frontend_spec_034_recommendation_add_form_fields.md`
Trims `AddSeriesForm` when opened from a recommendation card (`source="recommendation"`): hides
`Total Seasons`/`Total Episodes`/`IMDb Rating`/`Rotten Tomatoes Rating` (populated moments later by
the existing post-add refresh) and locks `Status` to read-only text.
- **Depends on**: Frontend Spec 003 ✅, Frontend Spec 010 ✅ — both implemented.

### 3. `frontend_spec_035_specific_series_picker.md`
Generalizes `KeywordPicker` to support `{ id, label }` option objects (not just strings), then
reuses it for `RecommendationControls`' "Specific Series" mode — replacing today's
checkbox-per-series list with search, genre/status filtering, sort, and a "show all" modal.
- **Depends on**: Frontend Specs 011/029/032 ✅, Series Spec 002 ✅, and `frontend_spec_013`
  Requirements 4–5 only (the sort-control precedent, already done — **not** blocked by that spec's
  outstanding Requirements 1–3).

### 4. `frontend_spec_039_sort_aware_rating_display.md`
`SeriesList`'s rating column always shows `imdbRating` regardless of active sort field. This makes
it show `tmdbRating` (with a source label) when the list is sorted by TMDB rating, `imdbRating`
otherwise — unchanged from today.
- **Depends on**: `frontend_spec_013` Requirements 4–5 only (the existing sort control, already
  done), Series Spec 002 ✅, Series Spec 017 ✅.
