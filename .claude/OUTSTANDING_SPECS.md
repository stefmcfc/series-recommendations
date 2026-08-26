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
| 5 | [`tooling_spec_004_external_api_client_shared_helpers.md`](specs/tooling_spec_004_external_api_client_shared_helpers.md) | Entire spec | AC-01–AC-07 (7) | Low | No |
| 6 | [`tooling_spec_005_series_form_shared_fields.md`](specs/tooling_spec_005_series_form_shared_fields.md) | Entire spec | AC-01–AC-07 (7) | Medium | No |
| 7 | [`tooling_spec_006_series_view_shared_action_helpers.md`](specs/tooling_spec_006_series_view_shared_action_helpers.md) | Entire spec | AC-01–AC-06 (6) | Low | No |

No outstanding spec is blocked by another's *unimplemented* work. Two do have a real
**file-overlap** relationship worth sequencing around (not a hard dependency — see build order):
`tooling_spec_005` and `frontend_spec_013`/`frontend_spec_034` all modify
`AddSeriesForm.tsx`/`EditSeriesForm.tsx`; `frontend_spec_013` and `tooling_spec_006` both modify
`SeriesDetail.tsx`/`SeriesList.tsx` (different, non-overlapping functions within them, lower risk).
Where a spec cites `frontend_spec_013` as a dependency (specs 035 and 039), it's explicitly
scoped to that spec's already-done Requirements 4–5 (the sort control), not the outstanding
Requirements 1–3 — confirmed by reading each spec's own "Depends on" line, not inferred.

---

## Suggested build order

1. **`tooling_spec_005`** (shared `SeriesFormFields`/validators for `AddSeriesForm`/`EditSeriesForm`)
   — no blockers, and both specs 2 and 7 below modify the exact fields this one extracts.
   Landing it first means those two only touch one shared component afterward instead of two
   near-duplicate ones, and never need to re-deduplicate code that would otherwise diverge again
   mid-stream. See its own spec's "Build-order note" for the full reasoning.
2. **`frontend_spec_013`** (Requirements 1–3) — no blockers, and the next most foundational: adds
   the shared `StarRating` component and touches `SeriesDetail.tsx`, `SeriesList.tsx`, and (now
   post-#1) the already-deduplicated `AddSeriesForm.tsx`/`EditSeriesForm.tsx` fields.
3. **`frontend_spec_039`** — single AC, touches `SeriesList.tsx`'s rating column directly adjacent
   to the work #2 just did there (013 adds a `personalRating` column; 039 changes what the
   existing rating column shows). Sequencing it immediately after #2 means both passes over that
   component's rating-related JSX happen close together rather than reopening it later.
4. **`frontend_spec_034`** — touches `AddSeriesForm.tsx`, now stable post-#1/#2 (its Personal
   Rating field will already be a `StarRating` via the shared component). Low priority otherwise.
5. **`tooling_spec_006`** (shared rewatch-toggle/delete-submission helpers) — touches
   `SeriesDetail.tsx`/`SeriesList.tsx` again, but in functions unrelated to #2's rating work
   (delete confirmation, rewatch toggle) — low conflict risk either way, grouped here to keep
   all `SeriesDetail`/`SeriesList`-touching work adjacent. Low priority, weakest case of the
   three maintenance items per the original survey.
6. **`frontend_spec_035`** — the largest of the four product specs (16 ACs) and the only one with
   zero file overlap with anything else outstanding (`KeywordPicker.tsx`,
   `RecommendationControls.tsx`). P3 (quality-of-life, not urgent) and fully self-contained —
   best done last among the frontend work.
7. **`tooling_spec_004`** (shared `ExternalApiSupport` for `TmdbClient`/`OmdbClient`) — backend,
   completely independent of every frontend item above. Lowest priority of all seven (the survey
   that flagged it called it a possibly-accepted tradeoff) — placed last because it delivers the
   least value relative to effort, not because anything blocks it; it could equally be done
   whenever a backend-only slot opens up.

This project's git workflow already restricts work to one spec pair in flight at a time, so this
order is about minimizing rebase friction and doing foundational work first, not resolving hard
blocking dependencies (there are none among these seven).

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

### 5. `tooling_spec_004_external_api_client_shared_helpers.md`
`TmdbClient`/`OmdbClient` duplicate JSON-scalar-coercion helpers (`toInteger`/`toBigDecimal`/`str`)
and the "guard blank api key, wrap transport failures" pattern. Extracts the genuinely-shared
logic into a new `ExternalApiSupport` class while preserving each client's distinct behavior
(`OmdbClient`'s `"N/A"`-as-absent rule stays local). Flagged low-priority in the originating
survey — real but small (~20-30 lines), previously called "deliberate mirroring."
- **Depends on**: none — pure internal refactor.

### 6. `tooling_spec_005_series_form_shared_fields.md`
`AddSeriesForm.tsx`/`EditSeriesForm.tsx` duplicate seven validator functions byte-for-byte and
thirteen JSX field blocks near-identically. Extracts both into a shared
`seriesFormValidation.ts` module and a new `SeriesFormFields` component, leaving Title (TMDB
lookup UI), dialog chrome, actions row, and each form's distinct payload logic untouched. Rated
the strongest candidate in the originating survey.
- **Depends on**: none — pure internal refactor. **Note**: touches the same fields
  `frontend_spec_013` (Personal Rating → `StarRating`) and `frontend_spec_034` (conditional field
  hiding) will modify — see build order above for why this one goes first.

### 7. `tooling_spec_006_series_view_shared_action_helpers.md`
`SeriesDetail.tsx`/`SeriesList.tsx` duplicate their rewatch-toggle optimistic-update logic and
their delete-submission logic near-identically (differing only in singular-vs-per-id state
shape). Extracts both into small callback-based utility functions
(`toggleRewatchFlag`/`submitDelete`). Explicitly does **not** extract poster-error tracking or
the delete confirm/cancel open-state — both too small/differently-shaped to justify an
abstraction. Rated the weakest of the three maintenance items in the originating survey; refresh
logic (bulk job vs. single on-demand) was investigated and confirmed genuinely not shareable.
- **Depends on**: none — pure internal refactor.
