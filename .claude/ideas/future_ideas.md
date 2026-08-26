# Future Ideas

Deferred features, gaps, and improvements noted along the way but not scheduled against a spec.
These were flagged deliberately in design decisions or "Out of Scope" sections rather than
forgotten — collected here so they're discoverable in one place instead of scattered across
individual spec files.

**Pipeline**: `future_ideas.md` (raw, unconfirmed) → `.claude/SPEC_CANDIDATES.md` (confirmed worth
building, not yet spec'd) → a real spec exists → `.claude/OUTSTANDING_SPECS.md` (spec written, not
yet built) → implemented, entry removed → `CHANGELOG.md` (shipped). An idea moves out of this file
into `SPEC_CANDIDATES.md` once it's confirmed worth specifying — don't leave it duplicated in both.

**Maintenance rule**: every item here carries a `**Status**` line. Before adding a new item or
touching this file, re-check existing items against the current codebase — code this file
references may have moved or changed shape since the note was written (confirmed necessary in
practice: this file's 2026-08-26 review found one item already fully delivered without the file
being updated, and two others whose referenced classes had been renamed/split by later refactors).
- **Delivered** — the idea shipped. Keep only a one-line description + the spec(s) that delivered
  it, for traceability; drop the original speculative detail, since the spec is now the source of
  truth.
- **Specced, not yet built** — a real spec already exists for this idea. Reference the spec name
  only; no further commentary belongs here, since the detail should already live in that spec.
  (Move the entry to `.claude/OUTSTANDING_SPECS.md` instead, at that point — this case is
  documented for completeness but shouldn't actually occur in this file.)
- **Not specced** — retain full detail: what's actually required, why, and any relevant
  constraints or prior discussion. This is the only case where this file carries real content.

Last full review against the codebase: 2026-08-26.

---

## Recommendations & Lookup

### TMDB-primary lookup for `AddSeriesForm`'s "Look Up" flow
Always search TMDB first (matches original/translated/"also known as" names, so it can't miss a
title the way OMDb's own search can) rather than searching OMDb first and falling back to TMDB.

**Status**: Delivered — see `series_spec_017_tmdb_primary_lookup.md`,
`frontend_spec_022_tmdb_primary_lookup.md`. The shipped version goes further than this note
proposed: OMDb search is dropped entirely rather than kept as a fallback, since a live data check
found OMDb's Metacritic/Rotten Tomatoes coverage for TV is effectively 0% anyway.

### "Exclude Genres" output filter matches TMDB's canonical genre names, not the alias vocabulary the "Genres" sourcing field uses
Confirmed still live (2026-08-26, re-read the actual code — this bug's home moved during this
session's `RecommendationService` split, so the exact reference below is now accurate again). The
"Genres" sourcing field is populated from `TmdbGenreTable.allAliasNames()` — 18 alias names like
`"Action"`, `"Sci-Fi"`, `"Fantasy"`. The "Exclude Genres" filter
(`RecommendationOutputFilterService.matchesExcludeGenres`, `service/RecommendationOutputFilterService.java`)
compares against `TmdbGenreTable.joinDisplayNames(candidate.genreIds())`, which returns the 16
*canonical* TMDB display names instead (`"Action & Adventure"`, `"Sci-Fi & Fantasy"`). A user
typing `"Action"` into Exclude Genres (matching what the Genres field itself shows) will silently
exclude nothing, since no candidate's canonical genre string is ever literally `"Action"`.

**What's required**: either compare against the alias vocabulary instead (resolve each excluded
alias to its TMDB genre id via `TmdbGenreTable.idFor()`, then compare ids, the same way sourcing
already does) or expose the canonical-name list as the field's own vocabulary so what a user picks
is guaranteed to match. The former keeps one consistent vocabulary across both Genres fields; the
latter is a smaller code change but means Exclude Genres shows different option text than Genres.

**Status**: Not specced. **Note (2026-08-26)**: `.claude/SPEC_CANDIDATES.md` has a candidate for
turning "Exclude Genres" into a checkbox picker (mirroring "Genres") — if that's built, it forces
resolving this vocabulary question either way, since a checkbox list needs one canonical option
set. Worth doing together rather than fixing the matching logic first and re-doing it once the
picker lands.

### Recommendation ranking's personal-rating/TMDB-rating blend weight is hardcoded
Confirmed still live (2026-08-26 re-check; this logic's home moved to
`RecommendationRankingService.java` during this session's `RecommendationService` split —
`personalRatingTerm * 0.5 + tmdbRating * 0.5`, `service/RecommendationRankingService.java`
around line 50). `personalRating` (1–5) is normalized onto TMDB's 0–10 scale via a simple `× 2`
and blended 50/50 with `tmdbRating` — chosen for being easy to reason about, not tuned against
anything.

**Status**: Not specced. Worth revisiting once there's real usage data to tune the weighting
against, not before.

### Weight recommendation scoring and/or output filters by keyword popularity/average personal rating
`series_spec_019_keyword_tracking.md`'s aggregate stats endpoint (how many tracked series carry a
keyword, and their average `personalRating`) already exists and is delivered — but nothing feeds
that data into `RecommendationRankingService`'s scoring or `RecommendationOutputFilterService`'s
filters yet. E.g. a keyword with a consistently high average personal rating across tracked
series could boost candidates carrying it.

**Status**: Not specced. Needs its own design for how much weight and how it interacts with the
existing TMDB-rating/personal-rating blend (see above) — revisit once there's real usage data
from the stats view itself.

### Recommendation cards have no fuller detail/expand view beyond keywords
Confirmed still accurate (2026-08-26 re-check of `frontend/src/types/series.ts`'s `Recommendation`
interface): it carries `tmdbRating` but not `imdbRating` (a candidate has no confirmed IMDb match
until it's actually added and refreshed), and no `totalSeasons`/`totalEpisodes`. The card's "Show
keywords" button only reveals TMDB keywords — there's no way to see anything beyond what's already
always visible (title/year/genres/overview/origin country/rating).

**Status**: Not specced. Needs its own design pass: what to show, how to fetch it cheaply
(season/episode counts would need a `TmdbClient.details()` call per card, the same rate-limit
tradeoff keywords already had before going lazy-on-demand), and whether it's an inline expand or a
real detail view.

---

## Search & Filter

### `SearchFilter`'s Genres field is free-text (comma-separated), not a tag/multi-select
Confirmed still a plain text input as of 2026-08-26 (`SearchFilter.tsx`, `form.genres: string`).
This is the same class of silent-mismatch risk the Recommendations page's Genres field had before
it got a checkbox picker (`series_spec_010`/`frontend_spec_014`) — but against
`SeriesSearchCriteria.genres` (matched literally against each series' stored `genres` string, not
TMDB's vocabulary), so the failure mode differs (a typo just matches nothing, not "silently falls
back to something unrelated") though the free-text UX gap is the same shape.

**Status**: Not specced. Revisit if genre filtering sees real use and the typo/UX friction turns
out to matter.

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

**Status**: Not specced. No design decisions made yet (left-hand panel vs. slide-out sheet,
whether both panels need to look identical or just share the same underlying disclosure
mechanism) — worth its own dedicated thinking whenever it's prioritized.

---

## Add/Edit Series Forms

### No "are you sure" confirmation on Cancel with unsaved input
Confirmed still absent on both `AddSeriesForm` and `EditSeriesForm` (2026-08-26 re-check — neither
file has any cancel-confirmation logic; `AddSeriesForm`'s only "cancel"-adjacent handler dismisses
the TMDB candidate list, unrelated). Originally flagged explicitly in both forms' specs so it
isn't mistaken for an oversight.

**Status**: Not specced.

### No way to explicitly clear an optional field to `null` via `EditSeriesForm`
Confirmed still true (2026-08-26 re-check of `EditSeriesForm.tsx`'s `buildPayload` — every
optional field is still omitted from the `PATCH` payload when blank, meaning "leave unchanged,"
unaffected by this session's `SeriesFormFields`/`StarRating` extraction work). There's no way to
explicitly remove a previously-set value (e.g. clear a rating) short of editing the database
directly.

**Status**: Not specced. Revisit if the need comes up.

### `EditSeriesForm` has no "Look Up" button (unlike `AddSeriesForm`)
Confirmed still true (2026-08-26 re-check — no `Look Up`/lookup-btn/`handleLookup` anywhere in
`EditSeriesForm.tsx`). Editing is treated as a correction/update flow rather than a "start from
scratch with a title" flow, so it only got a plain editable `posterUrl` text field.

**Status**: Not specced. Revisit if that turns out to be a real gap in practice.

---

## Navigation

### No router / no shareable URL for a specific series
Confirmed still true (2026-08-26 re-check — no `react-router` dependency in
`frontend/package.json`). `SeriesDetail` is reachable only by clicking a row from `SeriesList`,
with "Back" as the only way out — no deep-linking, no browser history entry.

**Status**: Not specced. Adding a router is a real architectural decision (history,
code-splitting) deliberately deferred until something actually needs a shareable link.

---

## Export

### `fields` param to select which columns to export
`series_spec_004_export.md`, "Future Enhancements." Choose a subset of columns rather than always
exporting every field.

**Status**: Not specced. Kept on the list (2026-08-26 review).

### Import — the reverse of export
`series_spec_004_export.md`, "Future Enhancements." Bring previously-exported JSON/CSV data back
into the app.

**Status**: Not specced. Kept on the list (2026-08-26 review).

### Other export formats (Excel, XML)
`series_spec_004_export.md`, "Future Enhancements" — currently JSON/CSV only.

**Status**: Not specced. Kept on the list (2026-08-26 review).

---

## Configuration

### No settings menu — every tunable is an `application.yml`/env-var value, not a live in-app setting
Confirmed still true (2026-08-26 re-check — no settings/config UI exists anywhere in the
frontend). Existing precedent (`app.tmdb.refresh-delay-ms`,
`app.tmdb.refresh-skip-threshold-minutes`) is edited by a developer and requires a restart, not
something a user changes from the UI.

A concrete case has since come up (2026-08-26): the country-of-origin/language recommendation
filter chip UI (`.claude/SPEC_CANDIDATES.md`) wants a hardcoded "popular" chip list (UK/US for
country, English for language) that would ideally be user-configurable once a settings system
exists — e.g. "Favourite country of origin = {United Kingdom, United States}", "Favourite
languages = {English}" — surfaced via a dropdown backed by the same ISO 3166-1/639-1 data the
filter chips themselves would use.

**Status**: Not specced. A real settings screen is its own feature with real design questions
first — where would it persist (this is a single-user personal app, so per-user settings may be
overkill; a new `AppSettings` table? a `.env`-editing convenience?) and which of the growing pile
of env-var knobs are actually worth surfacing.

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
