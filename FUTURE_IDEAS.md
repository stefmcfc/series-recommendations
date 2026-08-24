# Future Ideas

Deferred features, gaps, and improvements noted along the way but not scheduled
against a spec. These were flagged deliberately in design decisions or "Out of
Scope" sections rather than forgotten — collected here so they're discoverable
in one place instead of scattered across individual spec files. None of these
are committed to; picking one up means writing a proper EARS spec first, per
`CLAUDE.md`'s "spec first" rule.

## Recommendations & Lookup

- ~~**TMDB-primary lookup for `AddSeriesForm`'s "Look Up" flow.**~~ **Scheduled — see `series_spec_017_tmdb_primary_lookup.md`/`frontend_spec_022_tmdb_primary_lookup.md`.** The original note below is kept for context; the actual spec goes further than it proposed (OMDb search is dropped entirely rather than kept as a fallback, since a live data check found OMDb's Metacritic/Rotten Tomatoes coverage for TV is effectively 0% anyway — OMDb's remaining role narrows to a single best-effort `imdbRating`/`rottenTomatoesRating` enrichment call). Original note: the design in Spec 011/012, Spec 015/016 searches OMDb first and falls back to a TMDB-backed search only when the user says none of OMDb's candidates are right. An alternative: always search TMDB first (it matches original/translated/"also known as" names, so it can't miss a title the way OMDb's own search can — confirmed live via the "Spooks" vs. "MI-5" case, see `series_spec_012_tmdb_lookup_fallback.md`), then resolve to full OMDb detail only after the user picks a candidate. This would also let the app source `totalSeasons`/`totalEpisodes` straight from TMDB's `/tv/{id}` (`number_of_seasons`/`number_of_episodes`) instead of OMDb's slower per-season aggregation loop.
- **`RecommendationService.matchesExcludeGenres` has the same free-text-vs-fixed-vocabulary bug the Genres sourcing field had.** (`series_spec_010_genre_dropdown.md`, Design Decisions.) The "Exclude Genres" output filter is compared against TMDB's *canonical* display names (e.g. `"Action & Adventure"`), a different vocabulary than the *alias* names (`"Action"`, `"Sci-Fi"`, ...) the "Genres" sourcing field now uses via its checkbox list (Spec 010/014) — so typing `"Action"` into Exclude Genres still won't match. Same root cause, same fix shape (expose the canonical-name list the same way `GET /api/v1/series/genres` exposes the alias list), just a different field. Not reported by a user yet, but it's the same bug class already fixed once.
- **Recommendation ranking's 50/50 personal-rating/TMDB-rating blend weighting is hardcoded.** (`series_spec_007_recommendation_sourcing.md`, Design Decisions.) `personalRating` (1–5) is normalized onto TMDB's 0–10 scale via a simple `× 2` and blended 50/50 — chosen for being easy to reason about, not because it's been tuned against anything. Worth revisiting once there's real usage data to tune the weighting against.
- **Weight recommendation scoring and/or output filters by keyword popularity/average personal rating.** (`series_spec_019_keyword_tracking.md`'s aggregate stats endpoint — e.g. a keyword with a consistently high average personal rating across tracked series could boost candidates carrying it.) Deferred: needs its own design for how much weight and how it interacts with the existing TMDB-rating/personal-rating blend noted above; revisit once there's real usage data from the stats view itself.
- **Recommendation cards have no fuller detail/expand view beyond keywords.** (`frontend_spec_028_recommendation_metadata_and_overview_display.md`, raised during 2026-08-24 live review.) The card's "Show keywords" button only reveals TMDB keywords; there's no way to see anything beyond what's already always visible (title/year/genres/overview/origin country/rating). Nice-to-haves floated: total season/episode counts and an IMDb rating (recommendations currently only carry `tmdbRating`, not `imdbRating` — a candidate has no confirmed IMDb match until it's actually added and refreshed). Needs its own design pass: what to show, how to fetch it cheaply (season/episode counts would need a `TmdbClient.details()` call per card, the same rate-limit tradeoff keywords already had before going lazy-on-demand), and whether it's an inline expand or a real detail view.

## Search & Filter

- **`SearchFilter`'s Genres field is free-text (comma-separated), not a tag/multi-select.** (`frontend_spec_006_search_filter.md`, Design Decisions — explicitly noted as out of scope for the MVP pass.) This is the same class of silent-mismatch risk the Recommendations page's Genres field had before Spec 010/014 fixed it, just against `SeriesSearchCriteria.genres` (matched literally against each series' stored `genres` string, not TMDB's vocabulary) rather than TMDB's fixed genre list — so the failure mode is different (a typo just matches nothing, not "silently falls back to something unrelated"), but the free-text UX gap is the same shape. Revisit if genre filtering sees real use and the typo/UX friction turns out to matter.
- **Pagination.** (`series_spec_002_crud.md` and `series_spec_003_search.md`, both "Out of Scope.") Every list-returning endpoint (`GET /series`, `/series/search`) currently returns the full result set.
- **Advanced sorting options.** (`series_spec_003_search.md`, "Out of Scope.")
- **Full-text search.** (`series_spec_003_search.md`, "Out of Scope" — current search matches on exact/partial field values, not a full-text index over notes/overview text.)

## Add/Edit Series Forms

- **No "are you sure" confirmation on Cancel with unsaved input**, on both `AddSeriesForm` and `EditSeriesForm`. (`frontend_spec_003_add_series_form.md` / `frontend_spec_004_edit_delete_series.md`, both Design Decisions — explicitly flagged so it isn't mistaken for an oversight.)
- **No way to explicitly clear an optional field to `null` via `EditSeriesForm`.** (`frontend_spec_004_edit_delete_series.md`, Design Decisions.) Blank optional fields are omitted from the `PATCH` payload, which means "leave unchanged" for edit — there's no way to explicitly remove a previously-set value (e.g. clear a rating) short of editing the database directly. Revisit if the need comes up.
- **`EditSeriesForm` has no "Look Up" button** (unlike `AddSeriesForm`). (`frontend_spec_009_omdb_autofill.md`, Design Decisions.) Editing is treated as a correction/update flow rather than a "start from scratch with a title" flow, so it only got a plain editable `posterUrl` text field. Revisit if that turns out to be a real gap in practice.

## Navigation

- **No router / no shareable URL for a specific series.** (`frontend_spec_005_series_detail.md`, Design Decisions.) `SeriesDetail` is reachable only by clicking a row from `SeriesList`, with "Back" as the only way out — no deep-linking, no browser history entry. Adding a router is a real architectural decision (history, code-splitting) deliberately deferred until something actually needs a shareable link.

## Export

- **`fields` param to select which columns to export.** (`series_spec_004_export.md`, "Future Enhancements.")
- **Import — the reverse of export.** (`series_spec_004_export.md`, "Future Enhancements.")
- **Other export formats (Excel, XML).** (`series_spec_004_export.md`, "Future Enhancements" — currently JSON/CSV only.)

## Configuration

- **No settings menu — every tunable is an `application.yml`/env-var value, not a live in-app setting.** Raised 2026-08-24 alongside parametrizing the keyword picker's "top N most common tags" (see `frontend_spec_029_searchable_keyword_picker.md` and its follow-up). Existing precedent (`app.tmdb.refresh-delay-ms`, `app.tmdb.refresh-skip-threshold-minutes`) is edited by a developer and requires a restart, not something a user changes from the UI. A real settings screen is its own feature with real design questions first — where would it persist (this is a single-user personal app, so per-user settings may be overkill; a new `AppSettings` table? a `.env`-editing convenience?) and which of the growing pile of env-var knobs are actually worth surfacing. Deferred until there's a concrete case for changing one of these without a redeploy.

## Test Coverage Gaps

These aren't feature ideas, but debt flagged the same way — worth tracking alongside the above rather than letting them stay buried in an old spec:

- **No controller-level (`MockMvc`) test for the `/export` HTTP endpoint.** (`series_spec_004_export.md`.) `SeriesExportServiceSpec.groovy` covers the service layer thoroughly, but `SeriesControllerSpec.groovy` doesn't exercise the `Content-Disposition` header, the invalid-`format` → 400 response, or filter-before-export wiring at the HTTP layer.
