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

Last full review against the codebase: 2026-08-29.

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

### "Use My Series" source-series picker gains filter/sort parity with My Series, plus a "Select Series" relabel

Raised 2026-09-01. Original state, confirmed by reading the code at the time: `UseMySeriesPanel.tsx`
only offered "Filter by Genre" (checkbox), "Filter by Status" (radio), and a local "Sort by" — all
narrowing which of the user's own series become recommendation-sourcing candidates. This is a
separate, independently-implemented filter set from `SearchFilter`'s (My Series list), not shared
logic.

**Update (2026-09-01, later same day)**: the Exclude Genre(s) piece of this idea — also originally
proposed here — was pulled out into its own real spec, `frontend_spec_069_use_my_series_exclude_genres.md`,
as part of a 2026-09-01 exclude-genres consolidation across the whole app, and has since shipped
(`ROADMAP.md`'s Delivered table). As part of that, the former "Filter by Genre" checkbox fieldset was
replaced entirely by the shared `GenreIncludeExcludePicker` (`frontend_spec_067`) — so the "existing
'Filter by Genre' checkbox is kept as-is content-wise" note two paragraphs below is now stale; it's a
picker, not a checkbox list, though the genre *vocabulary* it offers is unchanged (still the same
"Trim the Genres checkbox list" question below).

Remaining, still-unspecced scope: an include-Keywords filter (mirroring `SearchFilter`'s
`KeywordPicker`), Min Personal/IMDb/TMDB Rating, and Year Min/Max — all narrowing the *source pool*
of the user's own series — plus the "Select Series" relabel proposed below. These fields are
explicitly distinct from `RecommendationFiltersBox`'s existing Min TMDB Rating/Year Min-Max/Exclude
Genres/Exclude Keywords fields, which filter the TMDB recommendation *output* instead and would be
unaffected by this idea. **Naming collision risk to design around**: two different "Min Rating"/"Year
Range" concepts would exist in the same tab for two different purposes — labeling needs to make the
distinction obvious to avoid user confusion.

Also proposes relabeling the area above the series picker to "Select Series," styled differently
from My Series' own filter panel even while sharing underlying filter logic where practical. See the
separate, explicitly-undecided "Trim the Genres checkbox list" idea below for whether the genre
vocabulary itself should later change.

**What's required**: extending `UseMySeriesPanel.tsx`'s local filter state with the new fields above,
plus a UI relabel — see cross-reference below for the larger shared-logic question this touches.

**Status**: Not specced. **Cross-reference**: this is exactly the concrete detail
`.claude/SPEC_CANDIDATES.md`'s "Share filter/sort logic between `SeriesList`/`SearchFilter` ... and
`RecommendationControls`' 'Use My Series' mode" candidate said it was waiting for ("once 'Use My
Series' filtering itself stabilizes") — review this entry when that candidate is actually scoped.

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

## Series List

### Only the first `origin_country` is stored/shown, even when TMDB reports more than one (e.g. "MobLand": GB + US)

Confirmed (2026-08-29) this is a deliberate existing design decision, not an oversight:
`series_spec_021_origin_country.md` chose to store a single ISO 3166-1 alpha-2 code.
`TmdbClient.firstOriginCountry()` explicitly takes `list.getFirst()` from TMDB's `origin_country`
array and discards the rest, and every DTO along the path (`SeriesEntity.originCountry`,
`SeriesLookupDto`, `SeriesDto`, `TmdbLookupCandidateDto`, `RecommendationDto`) carries a single
`String`, not a list. TMDB itself does return multiple entries for co-productions.

**What's required**: widening `originCountry` to a list would touch `TmdbClient.firstOriginCountry`
(and its duplicated logic in `TmdbSearchCandidate`/`TmdbSeriesDetail`/`TmdbCandidate`), the entity
column (single string → comma-separated or a join table), every DTO listed above, and
`RecommendationOutputFilterService`'s country-match filter (currently a single-value
`equalsIgnoreCase` check), which would need to become a set-intersection check. A real schema
migration, not just a display change.

**Status**: Not specced. Revisit `series_spec_021_origin_country.md`'s original rationale for
choosing single-value before committing to this — the "first entry only" choice may have been a
deliberate simplification worth keeping unless multi-country display turns out to matter in
practice.

---

## Analysis

### Keywords tab becomes a broader "Analysis"/"Trends" section — Genres and Country of Origin get the same treatment, plus filtering, name sort, and a blended-rating column

Raised 2026-08-29. Confirmed current state:

- `GET /api/v1/series/keywords` (`KeywordStatsService`) already sorts server-side
  (`sortBy=seriesCount|averagePersonalRating`, fixed direction per field — no asc/desc toggle) but
  has **no server-side filtering at all**: it always returns every distinct keyword across the
  user's series, unfiltered. `KeywordStatDto` carries exactly three fields — `name`, `seriesCount`,
  `averagePersonalRating` — no TMDB/IMDb rating aggregate today.
- `KeywordsView.tsx` (routed at `/keywords`) renders those three columns with click-to-sort
  headers (a server re-fetch per click, not a client-side array sort) and has no minimum-value
  filter UI (series count or rating) anywhere.
- Genres and Country of Origin have **no equivalent aggregation today** — confirmed no
  `GenreStatsService`/`CountryStatsService` exists anywhere in the backend.
  `SeriesGenreController`'s `GET /api/v1/series/genres` is unrelated (a static TMDB genre-name
  taxonomy for a picker, not per-genre stats). `SeriesEntity.genres` is a plain comma-separated
  `String` (not normalized into a join table like keywords), and `originCountry` is a single raw
  ISO 3166-1 alpha-2 string. `SeriesEntity`'s own code comment on the `keywords` field explains
  directly why keywords *were* normalized and genres/tags weren't: keyword stats need COUNT/AVG-
  style aggregation, which "a delimited string column can't support without parsing every row on
  every query" — so a genre/country stats feature would need the same in-memory
  parse-and-aggregate approach `KeywordStatsService` already uses (explicitly "fine at this app's
  scale" per that service's own precedent), not a new normalized table, unless that stops holding
  up in practice.
- No existing field or DTO blends `imdbRating`+`tmdbRating` anywhere in the app. The closest
  relative — `RecommendationRankingService`'s scoring blend — mixes TMDB rating with *personal*
  rating as a transient ranking heuristic, not a stored/named "combined rating" concept. This would
  be a genuine first: needs a name, a weighting decision (simple average vs. something more
  considered), and null-handling (a series can have one, both, or neither rating set) — this
  project deliberately keeps `imdbRating`/`tmdbRating` unconflated elsewhere (different scales/
  methodologies, per `RecommendationDto`'s own javadoc), so a blended column is a new kind of field
  for this codebase, not an obvious extension of an existing one.
- Routing is straightforward to extend: `App.tsx`'s existing `react-router-dom` `Routes`/`NavLink`
  pattern (currently `/my-series`, `/recommendations`, `/keywords`, all declared inline in one
  block) already supports adding more routes the same way — no new routing mechanism needed for
  one URL per analyzed field (e.g. `/analysis/keywords`, `/analysis/genres`, `/analysis/country`).

**What's required** (large enough this would likely split into several specs, not one):
1. Generalize `KeywordStatsService`'s in-memory aggregation pattern into equivalent services for
   Genres and Country of Origin.
2. Add minimum-value filtering server-side to all three fields (min series count, min avg personal
   rating, and the new min avg blended-rating) — none exist today, not even for Keywords.
3. Decide and implement the blended `imdbRating`/`tmdbRating` column: name, weighting, and
   null-handling.
4. Add name-based (alphabetical) sort alongside the existing count/rating sorts, plus asc/desc
   direction toggling (today's sort has no direction toggle at all — just a fixed direction per
   field on click).
5. Restructure the single "Keywords" nav tab into a small tab set (Keywords / Genres / Country of
   Origin), each with its own URL, per the routing note above.

**Status**: Not specced. Substantial enough to likely need splitting into multiple backend+frontend
spec pairs (one per analyzed field, plus a shared filtering/sort-direction piece) rather than one
spec — worth an explicit scoping pass before writing the first one.

---

## Navigation

### Real logo / visual branding design

Raised 2026-08-28 alongside the global nav redesign (`frontend_spec_041`, shipped 2026-08-28 —
menu-bar style top nav, logo top-left linking home). That spec deliberately used only a plain
placeholder logo mark ("TV Series Tracker" as text); actual visual identity design (wordmark, icon,
color) was explicitly out of scope for it and deferred here.

**Status**: Not specced. No design direction chosen yet — purely a placeholder-now,
design-properly-later split.

### Light/dark mode toggle — currently OS-only, no manual override

Raised 2026-08-28, prompted by the new menu bar (`frontend_spec_041`) being a natural home for a
toggle control. Confirmed via reading `frontend/src/index.css`: theming is entirely
`prefers-color-scheme`-driven — `:root` sets `color-scheme: light dark` plus a base (light) set of
custom properties (`--text`/`--bg`/`--border`/`--accent`/etc.), and a `@media (prefers-color-scheme:
dark)` block overrides them for dark. Confirmed via grep (`theme`/`dark mode`/`light mode`/
`data-theme`, case-insensitive, across `frontend/src`) that there is no manual override mechanism
anywhere in the app today — no toggle UI, no `data-theme` attribute, no persisted preference. A user
whose OS is set to dark always sees dark, and vice versa, with no in-app way to differ from that.

**What's required**: a toggle (in the new menu bar is the obvious placement) that sets a
`data-theme="light"`/`"dark"` attribute on `<html>` or `:root`, with CSS rules overriding the
`prefers-color-scheme` media queries when that attribute is present (a plain CSS specificity
addition, no new dependency) — plus persisting the choice (`localStorage` is sufficient for a
single-user local app; no backend involvement needed). A third "Match System" option, reverting to
today's pure OS-driven behavior, is the obvious default state so nobody's forced to pick if they're
happy with the current behavior.

**Status**: Not specced. Cross-references the "No settings menu" idea (Configuration section)
loosely, not as a hard dependency — unlike settings that genuinely need persistence/config
infrastructure, a theme toggle is small enough to ship standalone (`localStorage`, no backend), but
if a real settings screen gets built later, this would naturally live there too rather than staying
a one-off menu-bar control. **Note (2026-08-29)**: `frontend_spec_054_series_list_compact_view.md`
became this app's actual first `localStorage`-persisted UI preference (a `SeriesList` view-mode
toggle) — whoever specs this theme toggle should follow that spec's read/write/silent-degradation
pattern rather than re-deriving one.

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

### Move Export JSON/CSV into a dropdown menu, once a site/user config UI exists

Raised 2026-08-29. Confirmed (2026-08-29): `ExportControls.tsx` renders "Export JSON" and "Export
CSV" as two always-visible, separate buttons (`data-testid="export-json-btn"`/`"export-csv-btn"`)
— idea is to consolidate them into a single "Export" dropdown/menu control, deferred specifically
until there's a real site/user config UI to place it in or pattern it after (rather than building a
one-off dropdown component just for this).

**Status**: Partially specced (2026-09-01). `frontend_spec_072_settings_export_and_refresh.md`
relocates `ExportControls` wholesale into the now-real Settings page (also making it an unfiltered,
whole-library export instead of respecting My Series' active filters) — but as the same two
always-visible buttons, not consolidated into a single dropdown/menu control. The dropdown-
consolidation idea itself is still open, now layered on top of Settings rather than waiting for it
to exist.

---

## Configuration

### No settings menu — every tunable is an `application.yml`/env-var value, not a live in-app setting

Confirmed still true (2026-08-26 re-check — no settings/config UI exists anywhere in the
frontend). Existing precedent (`app.tmdb.refresh-delay-ms`,
`app.tmdb.refresh-skip-threshold-minutes`) is edited by a developer and requires a restart, not
something a user changes from the UI.

A concrete case has since shipped (`frontend_spec_047`, delivered 2026-08-28): the Custom Search
Country/Language filter pickers pin a hardcoded "popular" chip list (US/GB for country; English/
Spanish/French/German/Japanese/Korean for language) exactly as this note anticipated — that list
would ideally be user-configurable once a settings system exists, e.g. "Favourite country of
origin = {United Kingdom, United States}", surfaced via a dropdown backed by the same ISO
3166-1/639-1 data the filter chips themselves already use. Still hardcoded today.

A second concrete case (2026-08-28): `.claude/SPEC_CANDIDATES.md`'s "Customizable recommendation
'algorithm'..." candidate wants **saved filter/algorithm profiles** (its item #11) — its own note
is explicit that "this app has no user-preference persistence precedent today at all... likely its
own foundational piece of work... before the scoring changes themselves." Two independent features
now want the same missing foundation.

A third concrete case (2026-08-29): confirmed live — `SeriesList`'s "Refresh All" button
(`data-testid="refresh-all-btn"`) is blocked from doing anything useful on a second click within
`app.tmdb.refresh-skip-threshold-minutes` (default 60) of the last bulk refresh, by design
(`series_spec_018`) — every series gets skipped, not re-fetched, since each one's `lastRefreshedAt`
is still within the threshold. Hit directly in practice: a user re-clicked "Refresh All" ~2 minutes
after the first run and got a no-op. There's no way today to see that threshold, override it for
one run, or even know *why* the second click did nothing — it just silently skips everything.
Idea: once a settings/config menu exists, move "Refresh All" itself into it (out of the main
`SeriesList` page, alongside surfacing the skip-threshold as an actual visible/adjustable setting
rather than an invisible env var) — it's a maintenance/admin action, not a core browsing action, so
it doesn't need to live on the primary list view at all.

**Status**: Shell implemented (2026-09-01), first real content specced the same day.
`frontend_spec_070_settings_menu.md` shipped the entry point and page shell — a "Settings" nav item
after "Keywords", routing to a `/settings` page. `frontend_spec_072_settings_export_and_refresh.md`
gives it its first real content: Export (now unfiltered/whole-library) and Refresh All, both
relocated off the My Series page verbatim. The skip-threshold-surfacing half of the third concrete
case above is **not** part of `frontend_spec_072`'s scope — only the button/progress UI moved, the
`app.tmdb.refresh-skip-threshold-minutes` value itself is still an invisible env var. The
Country/Language favourites list and saved filter/algorithm profiles still need their own future
specs against this shell, including whatever persistence decision each one actually needs (still
undecided — a new `AppSettings` table? `localStorage`?).

Loosely related (2026-08-28): the Navigation section's "Light/dark mode toggle" idea is small
enough to ship standalone (`localStorage`, no backend) rather than waiting on this, but would
naturally move into the real settings screen (`frontend_spec_070`'s shell) if it's built after that.

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
