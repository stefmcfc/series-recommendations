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

---

## Recommendations & Lookup

### Recommendations for a recommendation — sourcing from an arbitrary candidate `tmdbId`, not just a tracked series

Raised 2026-08-29 alongside the now-specced "SeriesDetail gains a Recommendations button"/
"candidate detail view" ideas (`frontend_spec_052`/`series_spec_036`/`frontend_spec_053`) — this is
the third, deliberately deferred piece: letting a user get recommendations *for* a recommendation
candidate that isn't in their tracked series at all (e.g. from within the new candidate detail
modal).

Backend feasibility, confirmed by reading `RecommendationSourcingService.sourceTitleBased`: the
`imdbId` a tracked `SeriesEntity` carries is only ever used to *resolve* a `tmdbId` via
`tmdbClient.findTvIdByImdbId(...)` — every call after that (`tmdbClient.recommendations(tmdbId)`/
`similar(tmdbId)`) is already pure tmdbId-in, with no `SeriesEntity` dependency. Since a candidate's
`tmdbId` is already known (`Recommendation`/`RecommendationDto` both carry it, added originally for
the keywords endpoint), "recommendations for a recommendation" could skip the imdbId→tmdbId
resolution step entirely.

**What's required**: not what's hard, what's missing — a new `sourceFromTmdbId(int tmdbId)`-shaped
method (mirroring `sourceTrending`/`sourceTopRated`, flowing through as `RawCandidate(c, null)` —
the same untracked-source pattern those two and the genre supplement already use, no new type
needed), a new `RecommendationCriteria`/`sourceMode` path to request it (nothing today accepts a
bare `tmdbId` as a *source* — only `seriesIds`, tracked-series UUIDs), and the corresponding API
surface + frontend entry point (most naturally a "Get recommendations for this" action inside the
candidate detail modal once that ships).

**Status**: Not specced. Deliberately kept here rather than specced alongside its two siblings —
worth revisiting once the candidate detail modal (`frontend_spec_053`) actually ships and there's a
concrete UI home for the resulting action.

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

### Trim the Genres checkbox list (My Series + Recs) to only genres present in the user's tracked series — explicitly undecided

Raised 2026-09-01, flagged by the user themselves as unsure whether it's a good idea. Confirmed both
`SearchFilter` and every Recs genre-checkbox surface source their options from the same static,
full 18-alias TMDB taxonomy (`TmdbGenreTable`, exposed via `GET /api/v1/series/genres`) — not from
what the user actually has tracked.

**Tradeoff to weigh before deciding**: a shorter, more relevant list for filtering what you already
have, vs. losing the ability to pick a genre not yet present in your library (relevant for
genre-based recommendation sourcing, where you may want to explore a genre you don't own anything in
yet). **What's required** if pursued: in-memory parsing of the comma-separated `SeriesEntity.genres`
column across all series, the same pattern `KeywordStatsService` already uses for keywords (per this
file's own "Analysis" section note on why genres aren't normalized into a table).

**Status**: Not specced — explicitly undecided, not just unprioritized.

### "Use My Series" as a step-by-step wizard instead of a single scrolling page

Raised 2026-09-03 while planning the "Use My Series" page restructure (filter/select/post-filter/
sort/apply). The user asked whether the redesigned page's five sections — Filter & sort my series,
Select my series, Post TMDB filtering, Sort filtered recs, Apply/Get Recommendations — should be a
single scrolling page or built up step-by-step, checkout-style (fill in address, then payment).

Deliberately not pursued for the initial redesign: nothing in this flow has a genuine
server-side dependency gating the next step the way a checkout does (address round-trip before
shipping calc), every field stays in client-side `ControlsState` until one single "Apply
Filters"/"Get Recommendations" submit — and this app has no existing wizard precedent anywhere
(its two progressive-disclosure patterns, `RecommendationFiltersBox` and `SearchFilter`'s sheet,
both use inline collapse/expand, never forced linear steps). A wizard would also punish the likely
real workflow of filtering, glancing at picker results, then going back to loosen an earlier
filter — recommended a single page with the new "Filter & sort my series" section defaulting open
instead (see `frontend_spec_0XX`, the page-restructure spec, once written).

**Status**: Not specced — deliberately deferred by the user's own choice ("let's go with the
single-page option for now and add this as a future idea"), not rejected. Revisit if the
single-page version turns out to feel cluttered in practice once built.

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

### Redo cluttered filter panels as a collapsible left-hand panel or slide-out sheet — confirmed wanted for both `SearchFilter` and `RecommendationControls`

Originally raised 2026-08-24 for `SearchFilter`'s top-of-page filter panel, noting it was "the
same shape of layout question as `RecommendationControls`' own `Filters` disclosure, so a
consistent answer for both is probably better than solving it twice." Confirmed independently for
`RecommendationControls` on 2026-08-26 — this is now a real, cross-cutting layout idea covering
both filter panels, not just an anticipated one. Confirmed both panels are still today's original
always-expanded-top-bar / inline-disclosure shapes (2026-08-26 re-check).

**Status**: Partially implemented. **Note (2026-08-29)**:
`frontend_spec_055_search_filter_overhaul.md` gives `SearchFilter` a basic show/hide disclosure
(reusing `RecommendationControls`' existing `filtersOpen` mechanism) — the immediately-actionable
"collapsible" want is covered there. **Note (2026-09-01)**: `frontend_spec_071_my_series_filter_sheet.md`
implements the bigger layout question for `SearchFilter` specifically — its inline disclosure is now
a slide-out sheet (not a left-hand panel), triggered by a new funnel icon next to `SeriesList`'s
view-mode icons, superseding the inline disclosure entirely. `RecommendationControls`' equivalent
panel remains open/unspecced and still uses its original inline disclosure — the same sheet
treatment for it is a separate future spec if wanted, not bundled into `frontend_spec_071`.

### Filter My Series by Country of Origin / Language

Raised 2026-09-01 while scoping `frontend_spec_073`–`075`'s filter-sheet rework. Distinct from the
Configuration section's "Favourite country of origin" idea below — that one is about Custom Search's
*TMDB-discovery* pinned-chip list; this one is about filtering the user's *own tracked series* by
these fields on My Series. Confirmed via a backend check: `SeriesEntity.originCountry` exists (a
single ISO 3166-1 alpha-2 code) but isn't wired into `SeriesSearchCriteria`/`SeriesSearchService` at
all today — adding a Country filter would be a small addition. **There is no language field
anywhere on `SeriesEntity`** — adding a Language filter would first need a new column, a migration,
and a change to the TMDB lookup/refresh path to actually capture `original_language`, before any
filter could be built on top of it. Confirmed no slider UI pattern exists anywhere in this codebase
either (checked while deciding Min IMDb/TMDB Rating should stay plain number inputs, not sliders, in
`frontend_spec_075`).

**Status**: Not specced. Deliberately deferred out of the `frontend_spec_072`–`077` batch — Country
is a small, self-contained addition (`series_spec_0XX` + a frontend field) worth picking up on its
own; Language is materially bigger (new DB field + TMDB-capture change) and should not be scoped
together with Country just because they were raised at the same time.

---

## Navigation

### Real logo / visual branding design

Raised 2026-08-28 alongside the global nav redesign (`frontend_spec_041`, shipped 2026-08-28 —
menu-bar style top nav, logo top-left linking home). That spec deliberately used only a plain
placeholder logo mark ("TV Series Tracker" as text); actual visual identity design (wordmark, icon,
color) was explicitly out of scope for it and deferred here.

**Status**: Not specced. No design direction chosen yet — purely a placeholder-now,
design-properly-later split.

### No shareable URL for a specific series (`SeriesDetail`)

Updated 2026-08-28: `frontend_spec_041` added `react-router-dom` app-wide and gave the three
top-level views (`/my-series`, `/recommendations`, `/keywords`) real URLs, so the old "no router
dependency at all" framing of this note is now stale. `SeriesDetail` itself, though, was explicitly
kept out of that spec's scope (Requirement 4) — it's still reachable only by clicking a row from
`SeriesList`, with "Back" as the only way out, no deep-linking, no browser history entry, and no
URL change while it's shown. The remaining gap is narrower now: routing exists, `SeriesDetail`
just isn't wired into it yet.

**Status**: Not specced. Would be a small addition on top of an already-installed router (e.g.
`/my-series/:id`) rather than a from-scratch architectural decision — deferred until something
actually needs a shareable link to a specific series.

---

## Export

### `fields` param to select which columns to export

`series_spec_004_export.md`, "Future Enhancements." Choose a subset of columns rather than always
exporting every field.

**Status**: Not specced. Kept on the list (2026-08-26 review).

### CSV import

`series_spec_038_import.md` (2026-08-29) specced JSON-only import — CSV was explicitly scoped out:
correctly parsing quoted/escaped CSV fields on read is materially riskier to hand-roll than writing
them (no CSV parsing library is a backend dependency today), and a subtly wrong parse could corrupt
data on import in a way a JSON parse failure can't. Worth picking up as its own follow-up (most
likely via a real CSV parsing library rather than a hand-rolled reader) if genuinely wanted.

**Status**: Not specced. Deliberately deferred, not overlooked — see `series_spec_038`'s own Design
Decisions for the full reasoning.

### Other export formats (Excel, XML)

`series_spec_004_export.md`, "Future Enhancements" — currently JSON/CSV only.

**Status**: Not specced. Kept on the list (2026-08-26 review).

---

## Configuration

### No settings menu — saved filter/algorithm profiles are the one remaining gap

Originally raised as a broader "every tunable is an `application.yml`/env-var value, not a live
in-app setting" observation; the settings shell and its content have since landed incrementally
(`frontend_spec_070` shipped the shell/nav entry; `frontend_spec_072` moved Export/Refresh All onto
it; `frontend_spec_097`/`098`/`099`, planned 2026-09-07, add skip-threshold override + visibility, a
`SettingsSection` wrapper component, Country/Language favourites, and a light/dark/match-system
theme toggle — the last two both built on a new shared `useLocalStorage` hook, confirmed sufficient
since this app has zero settings/preference persistence anywhere backend-side and no
auth/multi-user concept to need one).

**The one item this entry originally flagged that's still unspecced: saved filter/algorithm
profiles** — `.claude/SPEC_CANDIDATES.md`'s "Customizable recommendation algorithm" candidate's own
item #11. That candidate's own text is explicit this needs designing *together* with its 10 sibling
scoring-formula sub-items, not pulled out alone — still blocked on that larger candidate being
scoped, not on any settings-infrastructure question (that question is now answered: `localStorage`
suffices for everything else in this app's settings surface; whether saved *profiles* specifically
need something richer, given they're structured multi-field data rather than a flat preference, is
part of what that candidate still needs to resolve).

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

### No controller-level (`MockMvc`) test for the `/export` HTTP endpoint

Confirmed still true (2026-08-26 re-check — grepped `SeriesControllerSpec.groovy` for
`export`/`Content-Disposition`, zero matches). `SeriesExportServiceSpec.groovy` covers the service
layer thoroughly, but the controller test doesn't exercise the `Content-Disposition` header, the
invalid-`format` → 400 response, or filter-before-export wiring at the HTTP layer. Unaffected by
this session's `SeriesController` split (`tooling_spec_002`) — export stayed on the trimmed
`SeriesController`, and that split didn't add new tests, only preserved existing ones.

**Status**: Not specced.
