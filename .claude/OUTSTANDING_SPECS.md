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
| 1 | [`frontend_spec_034_recommendation_add_form_fields.md`](specs/frontend_spec_034_recommendation_add_form_fields.md) | Entire spec | AC-01–AC-06 (6) | Low | No |
| 2 | [`frontend_spec_035_specific_series_picker.md`](specs/frontend_spec_035_specific_series_picker.md) | Entire spec | AC-01–AC-16 (16) | P3 | No |
| 3 | [`tooling_spec_004_external_api_client_shared_helpers.md`](specs/tooling_spec_004_external_api_client_shared_helpers.md) | Entire spec | AC-01–AC-07 (7) | Low | No |
| 4 | [`tooling_spec_006_series_view_shared_action_helpers.md`](specs/tooling_spec_006_series_view_shared_action_helpers.md) | Entire spec | AC-01–AC-06 (6) | Low | No |

`frontend_spec_039_sort_aware_rating_display.md` shipped on `feature/sort-aware-rating-display`
(2026-08-26) — its single AC checked, removed from this index.

No outstanding spec is blocked by another's *unimplemented* work. `tooling_spec_006` modifies
`SeriesDetail.tsx`/`SeriesList.tsx` — both files were also touched by `frontend_spec_013`'s and
`frontend_spec_039`'s already-shipped work, but in different, non-overlapping functions, so no
ongoing conflict risk.

---

## Suggested build order

1. **`frontend_spec_034`** — touches `SeriesFormFields.tsx` (post-`tooling_spec_005`) to
   conditionally hide four fields; now stable since `frontend_spec_013` already landed the
   Personal Rating `StarRating` swap in that same file. Low priority otherwise.
2. **`tooling_spec_006`** (shared rewatch-toggle/delete-submission helpers) — touches
   `SeriesDetail.tsx`/`SeriesList.tsx`, in functions unrelated to the already-shipped rating work.
   Low priority, weakest case of the three maintenance items per the original survey.
3. **`frontend_spec_035`** — the largest remaining product spec (16 ACs) and the only one with
   zero file overlap with anything else outstanding (`KeywordPicker.tsx`,
   `RecommendationControls.tsx`). P3 (quality-of-life, not urgent) and fully self-contained —
   best done last among the frontend work.
4. **`tooling_spec_004`** (shared `ExternalApiSupport` for `TmdbClient`/`OmdbClient`) — backend,
   completely independent of every frontend item above. Lowest priority of all four (the survey
   that flagged it called it a possibly-accepted tradeoff) — placed last because it delivers the
   least value relative to effort, not because anything blocks it; it could equally be done
   whenever a backend-only slot opens up.

This project's git workflow already restricts work to one spec pair in flight at a time, so this
order is about minimizing rebase friction and doing foundational work first, not resolving hard
blocking dependencies (there are none among these four).

---

## Detail

### 1. `frontend_spec_034_recommendation_add_form_fields.md`
Trims `AddSeriesForm` when opened from a recommendation card (`source="recommendation"`): hides
`Total Seasons`/`Total Episodes`/`IMDb Rating`/`Rotten Tomatoes Rating` (populated moments later by
the existing post-add refresh) and locks `Status` to read-only text.
- **Depends on**: Frontend Spec 003 ✅, Frontend Spec 010 ✅ — both implemented.
- **Amendment note (2026-08-26)**: the four fields this spec conditionally hides, and the Status
  field it locks to read-only text, now render via the shared `SeriesFormFields.tsx` component
  (`tooling_spec_005`), not directly in `AddSeriesForm.tsx`. `SeriesFormFields` will need a `source`
  (or equivalent) prop threaded through to it, not just added to `AddSeriesForm` itself.

### 2. `frontend_spec_035_specific_series_picker.md`
Generalizes `KeywordPicker` to support `{ id, label }` option objects (not just strings), then
reuses it for `RecommendationControls`' "Specific Series" mode — replacing today's
checkbox-per-series list with search, genre/status filtering, sort, and a "show all" modal.
- **Depends on**: Frontend Specs 011/029/032 ✅, Series Spec 002 ✅, `frontend_spec_013` (now
  fully shipped) — all implemented.

### 3. `tooling_spec_004_external_api_client_shared_helpers.md`
`TmdbClient`/`OmdbClient` duplicate JSON-scalar-coercion helpers (`toInteger`/`toBigDecimal`/`str`)
and the "guard blank api key, wrap transport failures" pattern. Extracts the genuinely-shared
logic into a new `ExternalApiSupport` class while preserving each client's distinct behavior
(`OmdbClient`'s `"N/A"`-as-absent rule stays local). Flagged low-priority in the originating
survey — real but small (~20-30 lines), previously called "deliberate mirroring."
- **Depends on**: none — pure internal refactor.

### 4. `tooling_spec_006_series_view_shared_action_helpers.md`
`SeriesDetail.tsx`/`SeriesList.tsx` duplicate their rewatch-toggle optimistic-update logic and
their delete-submission logic near-identically (differing only in singular-vs-per-id state
shape). Extracts both into small callback-based utility functions
(`toggleRewatchFlag`/`submitDelete`). Explicitly does **not** extract poster-error tracking or
the delete confirm/cancel open-state — both too small/differently-shaped to justify an
abstraction. Rated the weakest of the three maintenance items in the originating survey; refresh
logic (bulk job vs. single on-demand) was investigated and confirmed genuinely not shareable.
- **Depends on**: none — pure internal refactor.
