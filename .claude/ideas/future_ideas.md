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
references may have moved or changed shape since the note was written (confirmed necessary in
practice: this file's 2026-08-26 review found one item already fully delivered without the file
being updated, and two others whose referenced classes had been renamed/split by later refactors).

- **Delivered** — the idea shipped. Remove the entry entirely — `ROADMAP.md`/`CHANGELOG.md` are
  the source of truth for what shipped and which spec(s) delivered it; this file is only for ideas
  still waiting on attention, not a historical record.
- **Specced, not yet built** — a real spec already exists for this idea. Remove the entry entirely
  — it's tracked in `ROADMAP.md`'s "Specced, coming soon" table now, and the detail lives in the
  spec itself; leaving it here would just be a stale duplicate.
- **Not specced** — retain full detail: what's actually required, why, and any relevant
  constraints or prior discussion. This is the only case where this file carries real content.

Last full review against the codebase: 2026-09-07 (this review found one item — "Use My Series"
filter/sort parity — almost entirely delivered by `frontend_spec_081` without this file being
updated; trimmed to its one remaining gap, the "Select Series" relabel. Every other item confirmed
still accurate against the current code, no other changes needed). Same-day follow-up: the
Configuration section's Settings-area items (skip-threshold surfacing, Country/Language
favourites, light/dark toggle) were specced (`series_spec_052`, `frontend_spec_097`/`098`/`099`) and
removed/trimmed here accordingly — only saved filter/algorithm profiles remains open in that
section now.

2026-09-10 update: "No shareable URL for a specific series (`SeriesDetail`)" (Navigation section)
and "CSV import" (Export section) were specced (`frontend_spec_113`, `series_spec_058`/
`frontend_spec_114`) and removed accordingly — see `ROADMAP.md`'s "Specced, coming soon" table.

2026-09-23 full review: four items updated against the current codebase. The Configuration
section's "saved filter/algorithm profiles" gap narrowed — filter profiles fully shipped
(`series_spec_055`/`056`/`057`, `frontend_spec_107`/`108`/`109`/`112`, all five filterable areas);
only saved *algorithm* profiles remain, unchanged blocking reason. "Recommendations for a
recommendation"'s blocking condition (candidate detail modal) shipped (`frontend_spec_053`) — no
longer gated on anything. "Filter My Series by Country of Origin / Language" was corrected —
`SeriesEntity.originalLanguage` now exists (`series_spec_061`), so Language is no longer a
materially bigger lift than Country. The export test-coverage gap narrowed to two of its original
three checks after `series_spec_063` incidentally added one MockMvc `/export` test. Every other
item confirmed still accurate, no changes needed.

2026-09-23 same-day follow-up: "Recommendations for a recommendation" and "Filter My Series by
Country of Origin / Language" (just reconfirmed above) were both specced —
`series_spec_064`/`frontend_spec_127` and `series_spec_065`/`frontend_spec_128` respectively — and
removed accordingly, per this file's own pipeline rule. See `ROADMAP.md`'s "Specced, coming soon"
table.

2026-09-25 update: two Recommendations & Lookup / Search & Filter items resolved in one session.
"'Use My Series' as a step-by-step wizard" was confirmed still worth keeping around, but as a
`.claude/SPEC_CANDIDATES.md` entry rather than a raw idea — moved there accordingly, no longer a
"not specced, deliberately deferred" item here. "Redo cluttered filter panels..." (Search & Filter
section) was committed to as a real spec (two slide-out sheets, no wizard) — removed here, tracked
in `ROADMAP.md`'s "Specced, coming soon" table.

---

## Recommendations & Lookup

### User-configurable (drag-and-drop) source-series ranking

Raised 2026-09-24 while discussing `RecommendationDeduplicationService`/`RecommendationSourcingService`'s
dedup and sourcing mechanics. Today, `SourceOrderComparator.INSTANCE` (personal rating desc, then
date completed desc) is the sole, fixed ordering for a user's source series, used in two places:
`RecommendationSourcingService.resolveSourcePool` sorts the pool *before* capping to
`maxSourceSeries` (20) — so for anyone with more than 20 `COMPLETED` series, this order decides
*which* 20 actually get queried against TMDB, not just cosmetic tie-breaking — and
`RecommendationDeduplicationService.orderSources` decides which source's rating wins
scoring/tiebreaks when a candidate has multiple contributing sources. Idea: let the user drag-and-
drop their own ranking of source series instead of relying solely on the fixed rating/date formula.

**Scope, as best understood so far**: backend would need `SourceOrderComparator` to become
parameterizable by an explicit user-supplied order (e.g. a `rankedSeriesIds` list threaded through
both `resolveSourcePool` and `orderSources`) rather than always applying the fixed formula, plus
somewhere to persist that ranking — the existing `FilterProfile` persistence mechanism is the
likely home rather than a new entity, though this hasn't been designed. Frontend would need an
actual drag-and-drop reorderable list, which doesn't exist anywhere in this codebase yet (would
need a new library, e.g. `@dnd-kit`).

**Caveat to keep in view**: this would only affect "Use My Series" mode. The other three sourcing
modes (`sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword`) never link a candidate to a
source series at all, so a custom ranking would have zero effect on them — worth being explicit
about this scope limit whenever the idea is pitched, so it doesn't read as broader than it is.

**Status**: Not specced. Purely a future idea at this point — no design work done beyond the
scope/caveat above.

### "Use My Series" source-series picker — "Select Series" relabel

Raised 2026-09-01 as a two-part idea: filter/sort parity for `UseMySeriesPanel.tsx`'s source-series
picker (include-Keywords, Min Personal/IMDb/TMDB Rating, Year Min/Max, all narrowing the *source
pool* of the user's own series, distinct from `RecommendationFiltersBox`'s own same-named fields
which filter the TMDB recommendation *output*), plus relabeling the area above the picker to
"Select Series."

**Update (2026-09-07 review)**: confirmed via reading the current code — the filter-parity half
shipped as `frontend_spec_081`'s "Filter & sort my series" section: `GenreIncludeExcludePicker`,
an include-only `KeywordPicker` (no free text — narrows to a tracked series' actual keywords),
Min Personal/IMDb/TMDB Rating, and Year Min/Max are all there, and the original "naming collision"
risk this idea flagged was resolved with a "(My Series)" label suffix disambiguating from
`RecommendationFiltersBox`'s own same-named fields. Only the relabel half remains: the picker
section's heading is still plain "Series" (`UseMySeriesPanel.tsx`), not "Select Series."

**Status**: Not specced. Narrow remaining scope — a single label change, `UseMySeriesPanel.tsx`'s
`label="Series"` → `"Select Series"` (two occurrences, the picker and its "Browse..." modal).

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

Raised 2026-08-28 alongside the global nav redesign (`frontend_spec_041`, shipped 2026-08-28 —
menu-bar style top nav, logo top-left linking home). That spec deliberately used only a plain
placeholder logo mark ("TV Series Tracker" as text); actual visual identity design (wordmark, icon,
color) was explicitly out of scope for it and deferred here.

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

Originally raised as a broader "every tunable is an `application.yml`/env-var value, not a live
in-app setting" observation; the settings shell and its content have since landed incrementally
(`frontend_spec_070` shipped the shell/nav entry; `frontend_spec_072` moved Export/Refresh All onto
it; `frontend_spec_097`/`098`/`099`, planned 2026-09-07, add skip-threshold override + visibility, a
`SettingsSection` wrapper component, Country/Language favourites, and a light/dark/match-system
theme toggle — the last two both built on a new shared `useLocalStorage` hook, confirmed sufficient
since this app has zero settings/preference persistence anywhere backend-side and no
auth/multi-user concept to need one).

**Update (2026-09-23 review)**: this entry originally also flagged *saved filter profiles* as
open — that half has since fully shipped. `series_spec_055`/`056`/`057` +
`frontend_spec_107`/`108`/`109`/`112` deliver named, saved, rename/delete-managed filter profiles
across all five filterable areas (My Series, Use My Series, Recommendation filters, Custom Search,
Analysis filters — confirmed in `ROADMAP.md`'s Delivered table). Only *algorithm* profiles — saving
a chosen combination of scoring weights/source settings, distinct from filter criteria — remain
unbuilt.

**The one item this entry originally flagged that's still unspecced: saved algorithm profiles** —
`.claude/SPEC_CANDIDATES.md`'s "Customizable recommendation algorithm" candidate's own item #11.
That candidate's own text is explicit this needs designing *together* with its 10 sibling
scoring-formula sub-items, not pulled out alone — still blocked on that larger candidate being
scoped, not on any settings-infrastructure question (that question is now answered twice over:
`localStorage` suffices for every flat preference in this app's settings surface, and the now-shipped
filter-profile persistence pattern shows structured multi-field saved data is also a solved
problem here — whether algorithm profiles specifically can reuse that same pattern or need
something else is part of what that candidate still needs to resolve).

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

Originally "no controller-level (`MockMvc`) test for `/export` at all" (confirmed 2026-08-26 —
grepped `SeriesControllerSpec.groovy` for `export`/`Content-Disposition`, zero matches). **Update
(2026-09-23 review)**: no longer fully true — `series_spec_063` incidentally added one MockMvc
`/export` test (`SERIES-063-AC-04`) while covering that spec's own Rotten-Tomatoes-filter query
param, which does exercise filter-before-export wiring at the HTTP layer now. Still untested at
the controller level: the `Content-Disposition` header, and the invalid-`format` → 400 response.
`SeriesExportServiceSpec.groovy` continues to cover the service layer thoroughly regardless.

**Status**: Not specced.
