# Future Ideas

Deferred features, gaps, and improvements noted along the way but not scheduled against a spec.
These were flagged deliberately in design decisions or "Out of Scope" sections rather than
forgotten — collected here so they're discoverable in one place instead of scattered across
individual spec files.

**Pipeline**: `future_ideas.md` (raw, unconfirmed) → `.claude/SPEC_CANDIDATES.md` (confirmed worth
building, not yet spec'd) → a real spec exists, tracked in `ROADMAP.md`'s "Specced, coming soon"
table → implemented, row moves to "Delivered" → `CHANGELOG.md` (shipped version entry). An idea
moves out of this file into `SPEC_CANDIDATES.md` once it's confirmed worth specifying — don't leave
it duplicated in both.

**Maintenance rule**: every item here carries a `**Status**` line. Before adding a new item or
touching this file, re-check existing items against the current codebase — code this file
references may have moved or changed shape since the note was written. This file tracks only ideas
still in flight, not delivery history — when an idea ships or gets spec'd, remove its entry entirely
(see below) rather than annotating it as done; `ROADMAP.md`/`CHANGELOG.md` are the source of truth
for what shipped and when.

- **Delivered** — the idea shipped. Remove the entry entirely — `ROADMAP.md`/`CHANGELOG.md` are
  the source of truth for what shipped and which spec(s) delivered it; this file is only for ideas
  still waiting on attention, not a historical record.
- **Specced, not yet built** — a real spec already exists for this idea. Remove the entry entirely
  — it's tracked in `ROADMAP.md`'s "Specced, coming soon" table now, and the detail lives in the
  spec itself; leaving it here would just be a stale duplicate.
- **Not specced** — retain full detail: what's actually required, why, and any relevant
  constraints or prior discussion. This is the only case where this file carries real content.

Last full review against the codebase: 2026-09-25.

---

## Recommendations & Lookup

### User-configurable (drag-and-drop) source-series ranking

`RecommendationSourcingService.resolveSourcePool`/`RecommendationDeduplicationService.orderSources`
both order a user's source series via `SourceOrderComparator` — used in two places:
`resolveSourcePool` sorts the pool *before* capping to `maxSourceSeries` (20), so for anyone with
more than 20 `COMPLETED` series, this order decides *which* 20 actually get queried against TMDB,
not just cosmetic tie-breaking; `orderSources` decides which source's rating wins scoring/tiebreaks
when a candidate has multiple contributing sources. `series_spec_068` made this a per-request choice
among 3 fixed strategies (personal rating + date completed, or either paired with a user-configurable
"Custom Rating Blend"), but none of them is a fully arbitrary, user-defined order. Idea: let the user
drag-and-drop their own ranking of source series instead of picking from fixed strategies.

**Scope, as best understood so far**: backend would need `SourceOrderComparator` to also accept an
explicit user-supplied order (e.g. a `rankedSeriesIds` list threaded through both `resolveSourcePool`
and `orderSources`, alongside the 3 existing strategies) rather than being limited to fixed formulas,
plus somewhere to persist that ranking — the existing `FilterProfile` persistence mechanism is the
likely home rather than a new entity, though this hasn't been designed. Frontend would need an
actual drag-and-drop reorderable list, which doesn't exist anywhere in this codebase yet (would
need a new library, e.g. `@dnd-kit`). Cross-reference:
`.claude/SPEC_CANDIDATES.md`'s "Customizable recommendation algorithm" candidate's item #8 covers
the same underlying gap from the "decouple query order from score-tiebreak winner" angle.

**Caveat to keep in view**: this would only affect "Use My Series" mode. The other three sourcing
modes (`sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword`) never link a candidate to a
source series at all, so a custom ranking would have zero effect on them — worth being explicit
about this scope limit whenever the idea is pitched, so it doesn't read as broader than it is.

**Status**: Not specced. Purely a future idea at this point — no design work done beyond the
scope/caveat above.

### "Use My Series" source-series picker — "Select Series" relabel

`UseMySeriesPanel.tsx`'s source-series picker heading is still plain "Series," not "Select Series" —
relabel it (two occurrences: the picker itself and its "Browse..." modal).

**Status**: Not specced. Narrow scope — a single label change, `UseMySeriesPanel.tsx`'s
`label="Series"` → `"Select Series"`.

---

## Search & Filter

### Pagination

`series_spec_002_crud.md` and `series_spec_003_search.md` both explicitly flagged this "Out of
Scope" for their initial pass. Every list-returning endpoint (`GET /series`, `/series/search`)
currently returns the full result set, no page params. Confirmed unchanged as of 2026-08-26.

**Status**: Not specced. Kept on the list (2026-08-26 review) despite this being a
single-user personal app, on the basis that the tracked collection could grow large enough to
matter eventually — not urgent, no immediate trigger.

### Full-text search over notes/overview

`series_spec_003_search.md`, "Out of Scope." Current search matches on exact/partial field
values, not a full-text index — searching for a word inside `personalNotes` or `overview` doesn't
work today. Confirmed unchanged as of 2026-08-26.

**Status**: Not specced. Kept on the list (2026-08-26 review) as a real, distinct gap from
field-based search — no immediate trigger, but a genuine one when it comes up.

---

## Navigation

### Real logo / visual branding design

The global nav (`frontend_spec_041`, menu-bar top nav, logo top-left linking home) deliberately uses
only a plain placeholder logo mark ("TV Series Tracker" as text) — actual visual identity design
(wordmark, icon, color) was explicitly out of scope for that spec and deferred here.

**Status**: Not specced. No design direction chosen yet — purely a placeholder-now,
design-properly-later split.

---

## Export

### `fields` param to select which columns to export

`series_spec_004_export.md`, "Future Enhancements." Choose a subset of columns rather than always
exporting every field.

**Status**: Not specced. Kept on the list (2026-08-26 review).

---

## Configuration

### Saved algorithm profiles — the one remaining Settings gap

Saving a chosen combination of recommendation-scoring weights/source settings (distinct from filter
criteria, which already have saved profiles across all five filterable areas) has no persistence
mechanism yet.

**Blocked on** `.claude/SPEC_CANDIDATES.md`'s "Customizable recommendation algorithm" candidate's
own item #11 — that candidate is explicit this needs designing *together* with its other
scoring-formula sub-items, not pulled out alone. Whoever picks it up should check whether the
existing `FilterProfile` entity/endpoint shape can be reused before designing a new one from
scratch — this app already has proven patterns for both flat preferences (`localStorage`) and
structured multi-field saved data (filter profiles).

**Status**: Not specced — blocked on `.claude/SPEC_CANDIDATES.md`'s "Customizable recommendation
algorithm" candidate.

### Auto-refresh "Refresh All" on a schedule

Raised 2026-09-07 during Settings-batch follow-up planning. Today, `POST /api/v1/series/refresh-all`
(`series_spec_018`/`series_spec_052`) only ever runs when a user clicks the button on `/settings` —
there's no background/scheduled trigger. Idea: let a user opt into periodic auto-refresh (e.g.
"every N days") without having to remember to click it themselves.

**Why this is a real architectural fork, not just another Settings control**: every Settings
feature shipped so far (skip-threshold override, Country/Language favourites, theme) got away with
either a per-request override or plain frontend `localStorage`, precisely because none of them
needed the *backend* to remember anything across restarts. A scheduled job does — "is auto-refresh
on, and how often" has to be read by a `@Scheduled` trigger running independently of any browser
tab being open, which means it has to live in the backend, persisted, which this app has never
needed before.

**What's required, not yet designed**: a `@Scheduled` trigger calling `BulkRefreshService.start()`
on its own; somewhere to persist the enabled/interval configuration (recommendation, when this gets
picked up: a small, purpose-built persistence just for this one feature — e.g. a single settings
row/table scoped to refresh scheduling — rather than a generic "app settings" table sized
speculatively for hypothetical future needs the rest of this batch never actually required); and a
Settings UI control for it once the persistence shape is decided.

**Status**: Not specced. Deliberately deferred rather than bundled into the current skip-threshold-
units/styling spec, which needs no new backend persistence at all — this one does, and that's a
big enough decision to warrant its own spec once picked up.

---

## Test Coverage Gaps

These aren't feature ideas, but debt flagged the same way — worth tracking alongside the above
rather than letting them stay buried in an old spec.

### `/export`'s `Content-Disposition` header and invalid-`format` → 400 response are still untested at the controller level

No controller-level (`MockMvc`) test covers the `Content-Disposition` header or the
invalid-`format` → 400 response — both are only exercised at the HTTP layer if a test specifically
checks them, and none does. `SeriesExportServiceSpec.groovy` covers the service layer thoroughly
regardless.

**Status**: Not specced.
