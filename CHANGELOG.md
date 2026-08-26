# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning
follows [Semantic Versioning](https://semver.org/). Backend
(`backend/build.gradle.kts`) and frontend (`frontend/package.json`) are
versioned together as one app.

## [Unreleased]

### Fixed

- `POST /api/v1/series` now rejects a create with an `imdbId` that already matches a tracked series (`409 Conflict`, naming the conflicting title), instead of silently creating a duplicate row. A blank/absent `imdbId` (manual entry with no TMDB/OMDb lookup) is unaffected. `AddSeriesForm`'s existing generic submit-error banner already surfaces the new `409` message with no frontend code changes (`series_spec_028`, `frontend_spec_038`).

## [2.15.3] - 2026-08-26

### Changed

- Backend: split `RecommendationService` (898 lines, 11 collaborators) into one `@Service` per responsibility — `RecommendationCriteriaValidator`, `RecommendationSourcingService`, `RecommendationDeduplicationService`, `RecommendationOutputFilterService`, `RecommendationRankingService`, `RecommendationDtoAssembler`, and a new `WatchProviderService` (also now used directly by `SeriesWatchProviderController`, fixing a scope leak where a non-recommendation endpoint depended on `RecommendationService`) — leaving `RecommendationService` itself as a thin pipeline orchestrator. Shared candidate records (`RawCandidate`/`DedupedCandidate`/`ScoredCandidate`) and constants (`RecommendationDefaults`, `SourceOrderComparator`) were promoted to standalone types to cross the new class boundaries. `TmdbGenreTable` gains a small `joinDisplayNames` method, deduplicating genre-display-name logic previously private to `RecommendationService`. Pure internal refactor: `GET /api/v1/series/recommendations`, `GET /api/v1/series/recommendations/{tmdbId}/keywords`, and `GET /api/v1/series/{id}/watch-providers` are all unchanged, and the existing controller-level Spock specs pass without modification (`tooling_spec_003`).
- Backend: the pre-existing 1937-line `RecommendationServiceSpec.groovy` was split into one spec per new class (matching this project's "one spec per class under test" convention), with `RecommendationServiceSpec.groovy` itself kept for cross-cutting/orchestration-level cases only.

## [2.15.2] - 2026-08-26

### Changed

- Backend: split `SeriesController` (~20 endpoints, 11 injected services) into one resource-scoped `@RestController` per area — `SeriesRefreshController`, `SeriesLookupController`, `SeriesRecommendationController`, `SeriesWatchProviderController`, `SeriesGenreController`, `SeriesKeywordController` — leaving `SeriesController` itself with just CRUD/search/export/ignore-list and 5 dependencies (`java:S107` suppression no longer needed). A shared `UuidPathPattern` constant replaces the `{id}` regex previously duplicated across controllers. Pure internal refactor: every endpoint's path, request/response shape, and status codes are unchanged, and the existing controller-level Spock specs pass without modification (`tooling_spec_002`).

## [2.15.1] - 2026-08-25

### Changed

- Internal code-quality pass resolving a full SonarQube findings batch across both backend (18 files) and frontend (28 files) — cognitive-complexity refactors, mechanical Java/TypeScript modernizations (unnamed-pattern catches, `.toList()`, duplicated-literal constants, `readonly` props, `FormEvent`→`SubmitEvent`), a CSS alert-box contrast fix, `role="status"`→`<output>` semantic-element swaps, and test-quality improvements (missing assertions, a parameterized test). No user-facing behavior change.

## [2.15.0] - 2026-08-25

### Added

- Rotten Tomatoes Popcornmeter UI: `AddSeriesForm` and `EditSeriesForm` gain a "Rotten Tomatoes Rating (Popcornmeter)" numeric input (0–100, same validation/payload-omit-when-empty convention as the existing field, which is now labeled "Rotten Tomatoes Rating (Tomatometer)" to disambiguate); it's not wired into the TMDB-lookup autofill path since the backend lookup result doesn't return it either. `SeriesDetail`'s Ratings section now shows both Rotten Tomatoes scores as a `96%`-style percentage (`—` when unset) in a 3-field row alongside Personal Rating, each suffixed with a clarifying emoji (🍅 Tomatometer, 🍿 Popcornmeter) (`frontend_spec_037`).

## [2.14.0] - 2026-08-25

### Added

- "Check Streaming Availability" button on `SeriesDetail`: sits between the Overview and Keywords fields, calls `seriesApi.getWatchProviders(id)` (new method wrapping `GET /api/v1/series/{id}/watch-providers`) only on click — never automatically — showing "Checking..." while in flight, the result via a new shared `StreamingProviders` component on success, and a scoped inline `role="alert"` error (clearing any stale prior result immediately) on failure. Every click re-fetches fresh; nothing is cached or persisted client-side, and the check's transient state resets when navigating to a different series, mirroring `SeriesDetail`'s existing `refreshError`/`rewatchError` per-series reset pattern. `RecommendationsList`'s existing inline provider-list/empty-state markup (`frontend_spec_025`) is factored out into this same shared `StreamingProviders` component so the two can't drift apart, with no change to `RecommendationsList`'s own behavior or tests (`frontend_spec_036`).

## [2.13.0] - 2026-08-25

### Added

- On-demand streaming availability for a tracked series: a new `GET /api/v1/series/{id}/watch-providers` endpoint (`RecommendationService.getStreamingProvidersForSeries`) lets a user check where an already-tracked series is currently streaming, on demand — useful right before starting something in `BACKLOG`. Reuses `[2.10.0]`'s `TmdbClient.watchProviders`/`app.tmdb.watch-region` config and mapping helper unchanged; resolves the tracked series' `tmdbId` from its `imdbId` the same way `POST /{id}/refresh` already does (`TmdbClient.findTvIdByImdbId`). Never persisted — computed fresh on every call. A genuinely unknown series `id` is the only error case (`404`); a missing/unresolvable `imdbId` or a failed TMDB lookup all yield an empty list with `200 OK`. Backend-only; the frontend consumer is `[2.14.0]` (`series_spec_026`, `frontend_spec_036`).

## [2.12.0] - 2026-08-25

### Added

- Rotten Tomatoes Popcornmeter: `SeriesEntity`/`SeriesDto` gain a new, purely user-entered `rottenTomatoesPopcornmeter` field (`Integer`, 0–100, same nullable/partial-update semantics as the existing `rottenTomatoesRating`, which continues to mean the critics' Tomatometer score sourced from OMDb) — there's no external data source for the audience score, so it's never touched by `SeriesRefreshService`. Included in CSV/JSON export alongside `rottenTomatoesRating` (`series_spec_027`).

### Fixed

- Refresh no longer wipes a rating when the external source doesn't report one: `SeriesRefreshService.refreshFromOmdb`/`refreshFromTmdb` previously overwrote every field unconditionally, including with `null` — since OMDb's `"Rotten Tomatoes"` rating is absent from most of its TV records, a routine refresh could silently blank out a manually-entered Rotten Tomatoes score. Both refresh paths now only set a field when the fresh value is non-null, leaving an existing value untouched otherwise; `omdbRefreshed`/`tmdbRefreshed` still mean "did the source respond successfully", unrelated to whether any individual field actually changed (`series_spec_027`).

## [2.11.0] - 2026-08-25

### Added

- `RecommendationsList` now surfaces each recommendation's currently-available streaming providers (`[2.10.0]`'s backend data) on each card: one row per provider beneath genres, showing a logo (`<img alt={provider.name}>`) when TMDB has one and always the provider name as text, or a "Not currently streaming in the UK" note when the list is empty; a second "Streaming data via JustWatch." attribution line now sits alongside the existing TMDB one, since JustWatch's licensed feed carries its own separate attribution obligation (`frontend_spec_025`).

## [2.10.0] - 2026-08-25

### Added

- Watch providers on recommendations: `TmdbClient` gains `watchProviders(tmdbId, regionCode)` (`GET /tv/{tmdbId}/watch/providers`), surfacing only the `flatrate` (subscription-streaming) category — not `rent`/`buy`/`ads` — for a configured region (`app.tmdb.watch-region`, default `GB`, overridable via `APP_TMDB_WATCH_REGION`). Each `GET /api/v1/series/recommendations` result now carries `streamingProviders` (name + logo URL), resolved live per request and never persisted — a failed or empty lookup yields an empty list for that one candidate rather than failing the request, the same graceful-degradation posture as every other upstream call in `RecommendationService`. Backend-only; the frontend consumer is `[2.11.0]` (`series_spec_020`, `frontend_spec_025`).

## [2.9.1] - 2026-08-24

### Fixed

- `SeriesDetail` field-row layout refinements from two live-review passes: the fields grid is now explicitly grouped into rows (Overview and Keywords each full-width; Genres/Production Status/Status and IMDb/TMDB Rating/TMDB Vote Count as 3-column rows; Total Seasons/Total Episodes, Current Season/Current Episode, Rotten Tomatoes/Personal Rating, Tags/Personal Notes, and Date Added/Date Completed as edge-to-edge 2-column rows) instead of one flat auto-flowing grid that left a gap on any 2-item remainder; the rewatch toggle in both `SeriesDetail` and `SeriesList` changed from a checkbox to a `<button aria-pressed>` styled like the app's other secondary/accent buttons (outline when unflagged, filled accent when flagged), and `SeriesList`'s rewatch button moved to the right edge of its row instead of sitting left-aligned with status/new-content badge (no behavior or `aria-label` text changed for either toggle). A third pass then moved to one fixed 3-column grid track for every row regardless of field count (a 2-field row leaves the third column blank rather than stretching to fill it), grouped fields under section headers ("Details", "Ratings", "Personal", "Timeline", togglable via `VITE_SERIES_DETAIL_SECTION_HEADERS`, defaults on), and separated the bottom actions bar into Edit/Delete/Refresh (left) and the rewatch button (right) on one line, with "Last refreshed"/new-content status dropped to a second line below (`frontend_spec_012`).

## [2.9.0] - 2026-08-24

### Added

- Series lifecycle controls UI: `AddSeriesForm` and `EditSeriesForm` gain an "Exclude from recommendations" checkbox (omitted from the create payload unless checked; always sent explicitly, `true` or `false`, on update). `SeriesList` rows and `SeriesDetail` gain a "flag for rewatch" toggle, shown only for `COMPLETED` series, that calls `seriesApi.update` and reverts with a scoped inline error on failure (mirroring `RecommendationsList`'s per-card error pattern). `SearchFilter` gains a matching "Flagged for rewatch" checkbox alongside "Started, not finished". `SeriesDetail`'s existing production-status display (shipped earlier alongside the backend field) is unchanged (`frontend_spec_012`). `SeriesDetail` now shows Year and Origin Country next to the title heading (matching `SeriesList`'s row-title style) instead of as separate fields, and its Overview field spans the full row width as the grid's first entry instead of being squeezed into a single ~200px column; `SeriesList` rows split into two visual sub-rows (thumbnail/title/year/country/rating/actions on top, status/new-content badge/rewatch toggle indented underneath) to reduce clutter, with no change to any `data-testid`/`aria-label`/click behavior.

## [2.8.0] - 2026-08-24

### Changed

- `RecommendationService`'s per-source diversity cap (`SERIES-007-AC-22`, `maxPerSource`) default is now configurable via `app.tmdb.max-per-source` (constructor-injected `@Value`, overridable via `APP_TMDB_MAX_PER_SOURCE`) instead of a hardcoded constant, and its default was bumped from `3` to `8` — a live review found "Specific Series" mode was surfacing only a handful of results per selected source title (`series_spec_007`).

## [2.7.0] - 2026-08-24

### Added

- Series lifecycle flags: `SeriesEntity`/`SeriesDto` gain `excludeFromRecommendations` and `flaggedForRewatch` (both boxed `Boolean` on the DTO, same create-defaults-to-false / update-only-when-explicitly-set partial-update semantics as every other `PATCH`-able field). A series with `excludeFromRecommendations: true` is now skipped by `GET /api/v1/series/recommendations`'s automatic watched-pool sourcing (both the title-based pool and the genre-frequency count derived from it) — but not by an explicit `seriesIds` selection, which always wins over the standing preference. `GET /api/v1/series/search` gains a `flaggedForRewatch` filter (same nullable-boolean shape as the existing `startedNotFinished`), with no server-side status restriction on setting or filtering the flag. `TmdbClient` also gains a `showStatus(int tmdbId)` method (`GET /tv/{tmdbId}`, mapped to `ProductionStatus`) for parity with the rest of `series_spec_008_series_lifecycle_data.md`'s Requirement 2 — `productionStatus` itself, and its create-time resolution, had already shipped earlier via `series_spec_018`/`series_spec_021` (`series_spec_008`).

## [2.6.0] - 2026-08-24

### Added

- TMDB-native sort for Highest Rated and Genre & Keyword: `GET /api/v1/series/recommendations` gains a `discoverSortBy` param (validated against TMDB's full 12-value `sort_by` enum), consulted only under `sourceMode=topRated` or genre/keyword-directed sourcing — both modes now preserve TMDB's own returned order instead of silently re-ranking it, since the app's ranking pipeline was already a full no-op for candidates with no source series. This supersedes the earlier "Vote Average" relabel (`frontend_spec_030`/`frontend_spec_031`) from `[2.3.0]`: that relabel and the underlying "Best Match" option it sat alongside had turned out to produce byte-identical output for both modes. `RecommendationControls`'s `Sort By` fieldset now shows four real, TMDB-backed options for these two modes — "Vote Average" (`vote_average.desc`, default for Highest Rated), "Most Popular" (`popularity.desc`, default for Genre & Keyword), "Newest" (`first_air_date.desc`), and "Most Voted" (`vote_count.desc`) — sent only when they differ from the mode's own default, and never leaked into a request for any other mode. `Automatic`/`Specific Series` keep their existing "Best Match"/"Most Recommended" control unchanged (`series_spec_025`, `frontend_spec_033`).

## [2.5.0] - 2026-08-24

### Changed

- Hybrid keyword suggestions: `KeywordPicker` gains `allowFreeText` (Enter always adds the typed text, regardless of whether it matches a suggestion) and `maxSuggestionsWhenEmpty` (caps how many options are shown as default suggestions while the input is empty; omitting it shows every option). Both the Recommendations page's `Genre & Keyword` field and the List page's inline `Keywords` filter now use both props together — each shows up to `VITE_KEYWORD_SUGGESTIONS_LIMIT` (default 10) of your most-tracked keywords immediately, still accepts free text on top, and `RecommendationControls` now fetches `GET /api/v1/series/keywords` for that purpose (degrading silently, no error banner, if the fetch fails, since free text alone is already fully usable there). The List page's "Browse all keywords" modal also gains `allowFreeText` and drops the suggestions cap entirely, fixing a gap where it previously showed nothing until you typed something despite being named "browse all" (`frontend_spec_032`).

## [2.4.0] - 2026-08-24

### Changed

- Searchable keyword picker: a new shared `KeywordPicker` component (type-to-filter/type-to-add input with removable chips) replaces the keyword checkbox lists on both the Recommendations page (`RecommendationControls`' `Genre & Keyword` mode, free-text — any keyword can be typed and added, resolved server-side, not limited to already-tracked keywords) and the List page (`SearchFilter`, vocabulary-constrained to `GET /api/v1/series/keywords`' tracked keywords). The List page also gains a "Browse all keywords" modal, sharing selection state with the inline picker, for browsing the full tracked vocabulary without typing (`frontend_spec_029`).

## [2.3.0] - 2026-08-24

### Added

- Discover filters and mode-aware vote-count threshold: `GET /api/v1/series/recommendations` gains an `excludeKeywords` param (comma-separated, bound identically to the existing `excludeGenres`), excluding candidates whose TMDB keywords case-insensitively match, checked last in the output-filter chain (after every cheaper filter) with a per-candidate fail-open on a TMDB lookup error so one bad candidate doesn't fail the whole request. `sourceMode=topRated` ("Highest Rated") now defaults `minVoteCount` to 200 instead of the shared 20 default (still overridable), so its results have a meaningfully higher confidence bar without affecting Automatic/Specific/Genre/Trending. On the frontend, `RecommendationControls` gains an "Exclude Keywords" filter input (mirroring "Exclude Genres"), pre-fills `Min Vote Count` to 200 when switching into "Highest Rated" (reverting to empty when switching away, never overwriting a value the user typed themselves), hides the `Sort By` control entirely under "Popular Right Now" (a true no-op there), and relabels its "Most Recommended" option to "Vote Average" under "Highest Rated" (`series_spec_024`, `frontend_spec_030`). (This relabel was itself superseded before its own release by `[2.6.0]`'s TMDB-native sort.)

## [2.2.0] - 2026-08-24

### Added

- Recommendation cards now show origin country (e.g. "United Kingdom") and carry a `tmdbId`, and can reveal a candidate's TMDB keywords on demand via a per-card "Show keywords" button (loading/error/empty states scoped to that card only, no automatic fetch for the rest of the list) via a new `GET /api/v1/series/recommendations/{tmdbId}/keywords` endpoint. Tracked series now persist their TMDB `overview` (parsed from the same `GET /tv/{id}` call already used for `tmdbRating`/`productionStatus`/`originCountry`, at no extra TMDB-call cost), populated at creation via `AddSeriesForm`'s TMDB lookup, kept fresh on refresh, and displayed on `SeriesDetail` — closing a gap where a series' description, visible on the recommendation card that led to adding it, was previously lost the moment it was tracked (`series_spec_023`, `frontend_spec_028`).

## [2.1.0] - 2026-08-24

### Added

- Trending & top-rated recommendation sourcing: `GET /api/v1/series/recommendations` gains a `sourceMode` param (`trending` | `topRated`), a third directed-sourcing mode alongside `seriesIds`/`genres`/`keywords` (mutually exclusive with all three, `400` on any combination or an unrecognized `sourceMode`/`trendingWindow` value). `trending` sources TMDB's globally trending shows (`GET /trending/tv/{day|week}`, `trendingWindow` param, default `week`) and preserves TMDB's own returned order rather than re-ranking it — the existing ranking/diversity-cap step is skipped for this mode only, though the existing output filters (`minTmdbRating`/`minVoteCount`/`yearMin`/`yearMax`/`excludeGenres`/`language`) still apply. `topRated` sources TMDB's highest-rated shows overall (`GET /discover/tv?sort_by=vote_average.desc&vote_count.gte={minVoteCount}`, reusing the existing `minVoteCount` param, default 20, as the actual query parameter rather than just a post-hoc filter) and otherwise flows through ranking/diversity-cap normally. Both modes exclude anything already tracked or ignored via the same mechanism every other sourcing mode uses (`series_spec_022`).
- Sortable series listing: `GET /api/v1/series` and `GET /api/v1/series/search` now accept `sortBy` (`dateAdded` (default) | `personalRating` | `title` | `year` | `imdbRating` | `tmdbRating`) and `sortDirection` (`asc` | `desc`, default `desc`); an unrecognized value for either returns `400`. `GET /api/v1/series` previously had no defined order at all — it now defaults to `dateAdded` descending like `search` already did. A `null` value for the chosen sort field always sorts last regardless of direction; `sortBy=title` compares case-insensitively; `sortBy=tmdbRating` breaks ties on `tmdbVoteCount` descending, including both-null ties (`series_spec_009`).
- Keyword tracking: each tracked series' TMDB keywords (e.g. `spy`, `mi5`, `espionage`) are now stored in a normalized `keyword`/`series_keyword` schema rather than a delimited string, so they can be aggregated. `GET /api/v1/series/keywords` returns per-keyword `seriesCount` and `averagePersonalRating` (unrated series excluded from the average, not zeroed), sortable via `sortBy=seriesCount|averagePersonalRating` (descending, null averages last). `GET /api/v1/series/search` gains a repeatable `keyword` param, matched exactly (case-insensitively) against a series' keyword set. `POST /api/v1/series/{id}/refresh` now also reconciles a series' keyword set against TMDB's current data (best-effort, non-fatal on failure). `GET /api/v1/series/lookup/resolve-tmdb`'s result and `POST /api/v1/series` now also round-trip the resolved `tmdbId`, so a newly-added series already has its keywords populated at creation time rather than only after its first refresh (`series_spec_019`). `SeriesDto` also now serializes each series' own keyword names (`keywords: string[]`, alphabetically sorted, empty rather than omitted) so the frontend has real per-series keyword data to display.
- Keyword tracking UI: `SeriesDetail` shows a series' TMDB keywords as read-only chips (a new "Keywords" field after "Tags"). A new top-level "Keywords" view (alongside "My Series"/"Recommendations") lists every keyword in a sortable table of series count and average personal rating. `SearchFilter` gains a keyword checkbox filter sourced from `GET /api/v1/series/keywords` (fixed vocabulary, same rationale as the existing genre checkbox list), degrading gracefully to a scoped inline error if that fetch fails (`frontend_spec_024`).
- Series data refresh: `POST /api/v1/series/{id}/refresh` re-fetches one series' TMDB detail (`totalSeasons`/`totalEpisodes`/`tmdbRating`/`tmdbVoteCount`/`productionStatus`) and narrowed OMDb ratings (`imdbRating`/`rottenTomatoesRating`), with either source's failure being independently non-fatal and a partial success saved rather than rolled back. `POST /api/v1/series/refresh-all` starts an async job refreshing every tracked series sequentially (rate-limited via `app.tmdb.refresh-delay-ms`, default 250ms), polled via `GET /api/v1/series/refresh-all/status`; a second start while one is in progress returns `409`. `SeriesEntity`/`SeriesDto` gain `lastRefreshedAt`, set at create time and on every successful refresh (`series_spec_018`).
- Series refresh UI: `SeriesDetail` gains a "Refresh" button (busy state while in flight, an inline summary of what changed on success, an alert on failure, and a "Last refreshed X ago" display), and `SeriesList` gains a "Refresh All" button that starts the bulk job, polls its progress every 2.5s, disables itself and resumes polling on page reload if a job is already running (treating a `409` on click the same way rather than as an error), and shows "Last full refresh: X ago" once available. A new `src/utils/relativeTime.ts` provides the shared "X ago" formatting (`frontend_spec_023`).
- TMDB origin country: `GET /api/v1/series/lookup/search-tmdb` and `GET /api/v1/series/lookup/resolve-tmdb` now surface each candidate's `originCountry` (TMDB's `origin_country`, first entry only, e.g. `"GB"`), letting a user tell same-title remakes apart before picking one. `SeriesEntity`/`SeriesDto` gain a persisted `originCountry`, populated at create time and kept fresh by `POST /{id}/refresh`, and included in CSV/JSON export. Also fixes a related gap: `productionStatus` (added in `series_spec_018`) is now populated at series creation instead of staying `null` until the first explicit refresh (`series_spec_021`).
- Series refresh new-content detection: a refresh (single or bulk) that finds `totalSeasons`/`totalEpisodes` strictly increased over their pre-refresh values now sets a new `newContentDetectedAt` timestamp on the series (a `null`-to-populated transition, e.g. a manually-added series' first successful refresh, doesn't count as an increase). `POST /api/v1/series/{id}/acknowledge-new-content` clears the flag once seen. If the series was `COMPLETED` when new content was detected, it's automatically moved to `BACKLOG` with `dateCompleted` cleared, so it stops claiming to be finished (`WATCHING`/`BACKLOG`/`DROPPED` are left untouched). Bulk refresh (`POST /api/v1/series/refresh-all`) also gains a skip threshold, `app.tmdb.refresh-skip-threshold-minutes` (default 60, `0` disables it): a series refreshed more recently than the threshold is skipped rather than re-fetched, still counted toward `completedCount` and separately tracked via the job status's new `skippedCount`. Single-series refresh never applies this threshold (`series_spec_018` Requirements 4–6).

## [2.0.0] - 2026-08-21

### Changed

- TMDB is now the sole search/lookup source for adding a series: `GET /api/v1/series/lookup/resolve-tmdb?tmdbId=` builds its result exclusively from TMDB's own detail (title, year, genres, poster, season/episode counts, and new `tmdbRating`/`tmdbVoteCount`), then merges in `imdbRating`/`rottenTomatoesRating` from a narrowed, best-effort OMDb call keyed off whatever `imdbId` TMDB resolves — a failed or missing OMDb call no longer fails the request, it just leaves those two fields `null` (`series_spec_017`).
- `AddSeriesForm`'s "Look Up" now searches TMDB directly instead of OMDb, showing a TMDB candidate picker on multiple matches — the old OMDb-first candidate picker and the "Search TMDB instead" escape-hatch button are gone, since there's now only one search path (`frontend_spec_022`).

### Removed

- `GET /api/v1/series/lookup?title=`, `GET /api/v1/series/lookup/search?title=`, and `GET /api/v1/series/lookup?imdbId=` (OMDb-primary search/lookup) — TMDB's search already superset-matches everything OMDb's own search does. `metacriticRating` (essentially never populated by OMDb for TV) and `alternateTitle` (existed only to disambiguate the two-search-path era) are also removed from `SeriesEntity`/`SeriesDto`/CSV/JSON export, and from every frontend form/list/detail view (`series_spec_017`, `frontend_spec_022`).

## [1.4.0] - 2026-08-20

### Added

- Recommendation cards show the TMDB rating (one decimal place, right-justified) and vote count (`series_spec_016`, `frontend_spec_020`).

### Fixed

- Adding a series via the TMDB search fallback now keeps the TMDB-searched title (e.g. "Spooks") as the primary title, with OMDb's differently-cataloged title (e.g. "MI-5") captured as the alternate title — previously inverted (`frontend_spec_021`).

## [1.3.0] - 2026-08-20

### Changed

- Recommendations now attribute every one of a user's watched series that suggested a candidate, not just one: `RecommendationDto.sourceTitle` (a single string) is replaced by `sourceTitles` (a capped, best-first list) and `totalSourceCount` (the true uncapped count), scoring uses the best-rated contributing source, and the per-source diversity cap gains a configurable `app.recommendations.diversity-cap-mode` (`best-source`/`all-sources`). A new `sortBy=recommendationCount` request param orders results by how many watched series recommended them (`series_spec_015`).
- `RecommendationsList`'s "Because you watched X" line now shows every contributing source (plain comma-joined) plus an "and N more" suffix when more sources contributed than are shown, in place of a single title. `RecommendationControls` gains a `Max Sources Shown` field in its Filters section and a new top-level `Sort By` control (`Best Match` / `Most Recommended`), consuming the paired backend change above (`frontend_spec_019`).

## [1.2.0] - 2026-08-20

### Added

- Directed recommendation sourcing: base suggestions on specific tracked series, or on a genre/keyword directly, independent of watch history (`series_spec_007`, `frontend_spec_011`).
- Recommendations are now weighted by personal rating (both which series get to source them and how candidates are ranked), with a per-source diversity cap so one favorite doesn't dominate the list.
- New recommendation output filters: minimum TMDB rating, minimum vote count, year range, genre exclude-list, and language.
- `app.tmdb.max-source-series`/`app.tmdb.max-candidates` are now configurable instead of hardcoded.
- OMDb search candidates and disambiguated lookup: `GET /api/v1/series/lookup/search?title=` returns OMDb's full candidate list (not just its single best guess), and `GET /api/v1/series/lookup` now also accepts `imdbId` to resolve one specific candidate to full detail, so adding a series with an ambiguous title (e.g. "Spooks" vs. "Spooks: Code 9") no longer silently trusts OMDb's fuzzy match (`series_spec_011`).
- `AddSeriesForm`'s "Look Up" button now searches OMDb instead of trusting its single best guess: an unambiguous title still autofills in one click, but a title with multiple OMDb matches shows a candidate picker (poster, title, year) inside the existing dialog so the user picks the right match before anything is applied (`frontend_spec_015`).
- A TMDB-backed search fallback for adding a series: `GET /api/v1/series/lookup/search-tmdb?title=` searches TMDB directly (which, unlike OMDb, matches against original/translated/AKA names), and `GET /api/v1/series/lookup/resolve-tmdb?tmdbId=` resolves one chosen candidate to full detail — trying OMDb's richer data via the candidate's cross-referenced IMDb id first, and falling back to TMDB's own (thinner) detail when OMDb has no record for that title at all — so a title OMDb's own search misses entirely (e.g. "Spooks", catalogued in OMDb as "MI-5") can still be added (`series_spec_012`).
- `AddSeriesForm` gains a manual "Search TMDB instead" escape hatch, shown alongside a zero-result OMDb lookup or its 2+-result candidate picker: it searches TMDB directly and, on a single match, auto-resolves and autofills it, or on multiple matches, shows its own candidate picker (poster, title, year, original title) inside the same dialog — surfacing titles OMDb's own search misses entirely, like "Spooks" (`frontend_spec_016`).
- Backend-only `alternateTitle` field on `SeriesEntity`/`SeriesDto`, flowing through create/read/update and CSV/JSON export like any other optional field, storage for the "other" name a series is known by (e.g. OMDb's "MI-5" vs. the TMDB-searched "Spooks") — no frontend consumer yet (`series_spec_013`).
- Backend-only `tags` field on `SeriesEntity`/`SeriesDto`: a nullable, comma-separated, user-supplied string for organizing a collection (e.g. "rewatch candidate"), flowing through create/read/update and CSV/JSON export with the same storage/escaping conventions as `genres` — no frontend consumer or `SearchFilter` integration yet (`series_spec_014`).
- `alternateTitle` frontend consumer: `AddSeriesForm`'s OMDb/TMDB lookup now captures the name a user actually searched/selected by into an editable Alternate Title field whenever it differs from the resolved result's own title (e.g. searching "Spooks" resolves to "MI-5", with "Spooks" captured as the alternate title) — also editable in `EditSeriesForm`, and shown muted next to the title in `SeriesList`/`SeriesDetail` (`frontend_spec_017`).
- `tags` frontend consumer: a free-text, comma-separated Tags field, editable in `AddSeriesForm`/`EditSeriesForm` (positioned next to Genres) and displayed in `SeriesDetail`'s field list — `SeriesList` and `SearchFilter` integration deliberately out of scope (`frontend_spec_018`).

### Changed

- TMDB genre discovery now also supports keywords (e.g. "Spy"), supplementing TMDB's fixed 16-genre TV taxonomy.

### Fixed

- New `GET /api/v1/series/genres` endpoint exposes the exact 18-name genre vocabulary `RecommendationService.resolveGenreIds` matches against, fixing a silent failure where a typed genre that didn't exactly match TMDB's fixed alias list was dropped with no error, and recommendations could silently fall back to TMDB's generic "most popular" feed (`series_spec_010`).
- `RecommendationControls`'s Genre & Keyword sourcing mode now presents genres as a checkbox list populated from `GET /api/v1/series/genres`, replacing the free-text Genres input so a typed genre can no longer silently fail to resolve (`frontend_spec_014`).

## [1.1.0] - 2026-08-19

### Added

- Series recommendations sourced from [TMDB](https://www.themoviedb.org/documentation/api): title-based suggestions from the user's completed series, supplemented by genre-based discovery, filtered against series already added or ignored (`series_spec_006`, `frontend_spec_010`).
- `imdbId` persistence on series, enabling reliable cross-referencing against recommendation results.
- An ignore list (`POST /api/v1/series/ignored`) so a dismissed recommendation never resurfaces.
- A Recommendations view with Mark as Watched / Add to List / Ignore actions per card, reusing `AddSeriesForm` via a new `initialValues` prop.
- TMDB attribution notice on the Recommendations view, per TMDB's attribution guidelines.

## [1.0.0] - 2026-08-19

Initial complete release: full CRUD + browse UI backed by a Spring Boot API,
covering everything on the original features roadmap.

### Added

- Series entity/schema, CRUD REST endpoints, search & filter, and JSON/CSV
  export, all covered by Spock specs (`series_spec_001`–`004`).
- Frontend types & API service layer (`seriesApi.ts`), `SeriesList`,
  `AddSeriesForm`/`EditSeriesForm`, `SeriesDetail`, `SearchFilter`, and
  `ExportControls`, orchestrated in `App.tsx` (`frontend_spec_001`–`008`).
- OMDb lookup endpoint and `posterUrl` field, plus frontend autofill and
  poster display across the add form, edit form, detail view, and list
  (`series_spec_005`, `frontend_spec_009`).
- CI/CD pipeline, dependency update automation, and code quality/security
  hardening (`tooling_spec_001`).

### Fixed

- Local dev boot failure (Flyway not running, schema type mismatches).
- CORS not exposing `Content-Disposition`, breaking the export filename on
  download.
- Nested-interactive accessibility violations in `SeriesList` rows.
- Poster image proportions and detail-view layout.

### Changed

- Backend and frontend packages/namespaces renamed from the `com.example`
  placeholder to `uk.co.stefirby`.
