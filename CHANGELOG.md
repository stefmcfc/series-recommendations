# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning
follows [Semantic Versioning](https://semver.org/). Backend
(`backend/build.gradle.kts`) and frontend (`frontend/package.json`) are
versioned together as one app.

## [Unreleased]

## [3.10.1] - 2026-09-01

### Changed

- Docs: added `frontend_spec_072` through `077` (My Series settings migration, real-time title filter, rewatch tab, filter-sheet sectioning, and shared genre/keyword picker polish) and updated `ROADMAP.md`/`future_ideas.md` accordingly — no code changes.

## [3.10.0] - 2026-09-01

### Added

- Frontend: Settings nav item after Keywords, routing to a `/settings` page shell (placeholder only, no real settings yet) (`frontend_spec_070`).

## [3.9.1] - 2026-09-01

### Changed

- Chore: dependency updates (Gradle wrapper 9.7.0→9.7.1, `org.apache.groovy:groovy` 5.1.0→5.1.1, `org.xerial:sqlite-jdbc` 3.53.2.1→3.53.4.0, `actions/setup-java` 5→6, `axios` 1.18.1→1.20.0, `@types/node` 26.2.0→26.4.0, `vitest` 4.1.10→4.1.11, `lint-staged` 17.3.0→17.4.1, `jsdom` 29.1.1→30.0.1, `@testing-library/user-event` 14.6.1→14.6.6), applied as one sweep from the open dependabot PRs rather than merging each individually. Backend build, full frontend test suite, lint, and production build all verified green after the bump.

## [3.9.0] - 2026-09-01

### Added

- Frontend: "Select all" / "Clear all" buttons in the Specific Series picker, scoped to the currently-filtered candidate pool (`frontend_spec_051`).

### Changed

- Backend: Custom Search's Exclude Genres now also narrows results at the TMDB `discover/tv` API level (`without_genres`), not just via the existing post-fetch output filter (`series_spec_044`).
- Frontend: Recommendations' Exclude Genres is now the shared `GenreIncludeExcludePicker` instead of a free-text field — combined include/exclude in Custom Search, exclude-only elsewhere (`frontend_spec_068`).
- Frontend: "Use My Series" panel's "Filter by Genre" is now the shared `GenreIncludeExcludePicker`, gaining Exclude Genre(s) alongside the existing include filter — replaces the former include-only checkbox fieldset (`frontend_spec_069`).

## [3.8.0] - 2026-09-01

### Added

- Backend: `GET /api/v1/series/search` gains an `excludeGenre` query param (repeatable), excluding a series whose genres contain any of the given values — mirrors the existing `genre` include param's substring/case-insensitive matching (`series_spec_042`).
- Frontend: My Series list's Genres filter is now a single include/exclude picker (`GenreIncludeExcludePicker`) instead of an include-only checkbox list — a genre can be included or excluded, never both at once (`frontend_spec_063`).

### Fixed

- Frontend: `GenreIncludeExcludePicker`'s include/exclude toggle colours now meet WCAG AA contrast (4.5:1) against their white label text in both light and dark mode.

## [3.7.1] - 2026-09-01

### Fixed

- Backend: Recommendations' "Exclude Genres" output filter now correctly excludes a candidate when given an alias genre name (e.g. `"Action"`, the same vocabulary the "Genres" field itself shows) — it previously compared against TMDB's canonical display names (e.g. `"Action & Adventure"`) instead, so it silently excluded nothing (`series_spec_043`).

### Added

- Frontend: new shared `GenreIncludeExcludePicker` component — a modal listing every genre with a single toggle per genre cycling neutral/include/exclude, mutually exclusive by construction (`frontend_spec_067`). Not yet wired into any screen; lands in a future entry once `frontend_spec_063`/`068`/`069` adopt it.

## [3.7.0] - 2026-09-01

### Added

- Frontend: recommendation cards gain a "View Details" action (`frontend_spec_053`) opening a full detail view — everything already on the card (poster, overview, genres, streaming providers, rating) plus season/episode counts and IMDb rating (`series_spec_036`, shipped earlier) and keywords, each section fetched independently so one failing (e.g. OMDb down) never blanks the other.

### Changed

- Frontend: "Show keywords" is removed from `RecommendationCard`, replaced by "View Details" — keywords are now one section of the fuller detail view instead of a separate standalone expand. Applies everywhere `RecommendationCard` renders (the main Recommendations page and `SeriesDetail`'s Recommendations modal) with no extra wiring needed in either.

## [3.6.1] - 2026-09-01

### Fixed

- Frontend: a renewed/still-airing show whose aired episodes so far all fall within one calendar year (e.g. a freshman season) now displays as an open-ended year range (`"2025-"`) instead of a bare year (`"2025"`) that read as already finished. `formatSeriesYear` now checks `productionStatus` even when `lastAirYear` equals `year` (`frontend_spec_066`, supersedes `FRONTEND-058-AC-01`).

## [3.6.0] - 2026-09-01

### Added

- Frontend: `SeriesDetail` gains a "Recommendations" button (after Refresh) that opens a modal showing recommendations sourced from just that series — no more manually narrowing "Use My Series" to it on the Recommendations page (`frontend_spec_052`). Disabled, with an explanatory label, for a series marked "exclude from recommendations".
- Backend: new `GET /api/v1/series/recommendations/{tmdbId}/details?imdbId={imdbId}` endpoint resolving a candidate's season/episode counts (TMDB) and IMDb rating (OMDb) on demand — each field degrades independently to `null` on its own source's failure, never failing the whole request (`series_spec_036`). Not yet consumed by the frontend; that's `frontend_spec_053`.

### Changed

- Frontend: extracted the per-candidate recommendation card (title/year/genres/overview/rating/streaming providers/actions) out of `RecommendationsList` into a standalone `RecommendationCard` component, now shared by both `RecommendationsList` and the new `SeriesDetail` modal above. No behavior change to the existing Recommendations page (`frontend_spec_052`).
- Backend: `OmdbClient` now compiles its ratings-suffix regex once as a static `Pattern` instead of per-rating inside a loop; `SeriesRefreshService.refreshFromTmdb`'s flat sequence of TMDB field copies is now a separate `applyTmdbDetail` helper. No behavior change — SonarQube findings (`java:S9142`, `java:S3776`).
- Frontend: `SeriesFormFields` extracts its repeated "locked hint, else validation error, else none" logic into one `resolveDescribedBy` helper instead of a nested ternary at each locked-capable field. No behavior change — SonarQube findings (`typescript:S3358`, `typescript:S3776`).

## [3.5.1] - 2026-09-01

### Changed

- Backend: "Use My Series" recommendation sourcing now caches its TMDB-sourced candidate pool (TTL-bounded at 10 minutes by default, capacity-bounded at 50 entries, keyed on `seriesIds`/`minSourceRating`/`limit`) — changing Sort By, or any output-only filter (`excludeGenres`, `excludeKeywords`, `minTmdbRating`), on an otherwise-unchanged source pool is now a cache hit instead of re-running every TMDB call for the whole pool. No request/response contract change (`series_spec_035`).

## [3.5.0] - 2026-09-01

### Added

- Frontend: `EditSeriesForm` shows an inline "Managed by refresh — use Refresh to update" hint next to Title, Year, Genres, Total Seasons, Total Episodes, and IMDb Rating whenever that field already has a value, explaining why it's disabled (`frontend_spec_060`).

### Changed

- Backend: `PATCH /api/v1/series/{id}` now silently ignores an attempted change to `title`, `year`, `genres`, `totalSeasons`, `totalEpisodes`, or `imdbRating` once each already has a value — those fields are TMDB/OMDb-managed and can only be updated by refreshing the series afterward (`series_spec_040`). `title` is effectively always locked (a series always has a non-blank title once created).
- Backend: refreshing a series now also syncs `title`, `year`, and `genres` from TMDB (previously only `totalSeasons`/`totalEpisodes`/`tmdbRating`/etc were refreshed) — this is now the only way to correct those three fields once set, so refresh had to gain the ability to keep them current (`series_spec_040`, partially reverses `SERIES-018-AC-04`).
- Frontend: `EditSeriesForm`'s Title input is now always disabled — a series can no longer be renamed by hand, only by refreshing it against TMDB's current title (`frontend_spec_060`).

## [3.4.1] - 2026-09-01

### Fixed

- Backend: an out-of-range value for `year`, `totalSeasons`, `totalEpisodes`, `currentSeason`, `currentEpisode`, `imdbRating`, `rottenTomatoesRating`, or `rottenTomatoesPopcornmeter` on `POST`/`PATCH /api/v1/series` now returns `400 Bad Request` with a descriptive message instead of `500 Internal Server Error` (`series_spec_041`).
- Backend: `year`'s valid range is now `1900`–current year + 1 (previously `1`–a hardcoded `2026`, already wrong and going stale every year) — enforced on both create and update, matching the bound already used elsewhere (`RecommendationCriteriaValidator`, `frontend/src/utils/yearBounds.ts`) (`series_spec_041`).
- Frontend: `AddSeriesForm`/`EditSeriesForm`'s year field validation now matches the same `1900`–current year + 1 bound instead of the stale hardcoded `1`–`2026` range (`frontend_spec_061`).

## [3.4.0] - 2026-09-01

### Added

- Frontend: `SeriesList` now shows a read-only "Excluded from recommendations" badge on any row with `excludeFromRecommendations` set, so it's visible without opening that series' Edit form (`frontend_spec_050`).

### Changed

- Backend: `excludeFromRecommendations` now applies uniformly to every recommendation source pool — a series marked "exclude from recommendations" is silently dropped from an explicit `seriesIds` selection too, not just the automatic pool (`series_spec_034`, reverses `SERIES-008-AC-05`). An unknown `seriesIds` entry (one that doesn't match any series at all) is still rejected with `400`, unaffected by this change.
- Frontend: the "Use My Series" Specific Series picker (both the inline picker and the "Show all series" browse modal) no longer offers a series marked "exclude from recommendations" as a selectable option, matching the server-side enforcement above (`frontend_spec_050`).

## [3.3.1] - 2026-09-01

### Changed

- Frontend: navigating to Recommendations (or switching between "Use My Series"/"Discover" and any of Discover's sub-tabs) no longer fires a request on its own — a request is only ever sent after clicking "Apply Filters". Switching tabs now clears any previously-shown results back to a "set your filters and click Apply Filters" prompt, instead of leaving a different mode's stale results on screen (`frontend_spec_062`, reverses `FRONTEND-040-AC-02`).

## [3.3.0] - 2026-09-01

### Added

- Frontend: `SeriesList` gains two new opt-in display modes alongside today's expanded row list — "Compact" (poster, title/year, read-only personal rating, in a responsive card grid) and "Poster-only" (an even denser grid showing just the poster art) — toggled via three icon buttons and persisted to `localStorage` (`frontend_spec_054`).

## [3.2.4] - 2026-08-31

### Changed

- Frontend: `SeriesList`'s per-row status badge now only shows on the "All" status tab — every other tab already filters to a single status, making the badge redundant on every row (`frontend_spec_056`, `FRONTEND-056-AC-07`).
- Frontend: the "Use My Series"/Specific Series picker's trailing status text is now hidden unless its own "Filter by Status" is set to "Any Status" — a filtered pool no longer repeats the same status on every suggestion (`frontend_spec_035`, `FRONTEND-035-AC-17`).

## [3.2.3] - 2026-08-31

### Changed

- Backend: extracted the recommendation pipeline (`RecommendationService`, `RecommendationSourcingService`, `RecommendationDeduplicationService`, `RecommendationOutputFilterService`, `RecommendationRankingService`, `RecommendationDtoAssembler`, `RecommendationCriteriaValidator`, `RecommendationDefaults`, plus its internal `RawCandidate`/`DedupedCandidate`/`ScoredCandidate`/`SourceOrderComparator` types) out of the flat `service/` package into `service.recommendation` — 12 of 27 files in `service/` belonged to this one vertical slice and weren't used anywhere else. Narrowed several public methods to package-private in the process, since every real caller was already in the same package. No behavior change.
- Backend: split `client/` into `client/tmdb` and `client/omdb` — the two external API clients had no dependency on each other beyond a shared `ExternalApiSupport` helper, which stays at `client/`'s top level. No behavior change.
- Backend: extracted `BulkRefreshService`/`SeriesRefreshService`/`RefreshJobStatus`/`RefreshResult` into `service.refresh`, mirroring the recommendation pipeline's own dedicated-controller boundary. No behavior change.
- Backend/Frontend: resolved a handful of small IDE-flagged findings — a redundant object-spread fallback in `App.tsx`, a missing CSS generic font-family fallback in `index.css`, a simplified boolean return in `SeriesList.tsx`, unused `ApiResponse`/`LoadingState`/`AsyncState` type exports removed from `types/api.ts`, and IDE-suggested method extractions in `RecommendationService`/`RecommendationSourcingService`/`SeriesSortResolver`. No behavior change.

## [3.2.2] - 2026-08-29

### Changed

- Frontend: split `RecommendationControls.tsx` (1518 lines, flagged twice by SonarQube for Cognitive Complexity) into five sibling panel components — `UseMySeriesPanel`, `CustomSearchPanel`, `TrendingPanel`, `HighestRatedPanel`, `RecommendationFiltersBox` — each with its own colocated tests; `RecommendationControls` itself is now a thin coordinator. No user-visible behavior change; the existing 122-test `RecommendationControls.test.tsx` suite passes unmodified (`tooling_spec_008`).
- Frontend: split `applySourceModeQuery` into one small function per source mode (`applyUseMySeriesModeQuery`/`applyCustomSearchModeQuery`/`applyTrendingModeQuery`/`applyTopRatedModeQuery`/`applyDiscoverSortByModeQuery`), reducing its own flagged Cognitive Complexity — no change to the built `RecommendationQuery` for any mode (`tooling_spec_008`).

## [3.2.1] - 2026-08-29

### Changed

- Backend: extracted `TmdbClient.discover()`'s `DiscoverFilters`-derived query-param logic into a private `applyDiscoverFilters` helper, reducing Cognitive Complexity (no behavior change, `tooling_spec_007`).
- Backend: reworded `SeriesSearchService.matchesYearRange`'s doc comment to clear a SonarQube `S125` ("commented-out code") false positive triggered by an inline boolean expression in the prose — same documentation content, no code change.

## [3.2.0] - 2026-08-29

### Added

- Backend: series gain `lastAirYear`, the year of TMDB's `last_air_date` for a series' most recently aired episode — resolved at create time and re-resolved on every refresh, the same way `productionStatus`/`originCountry` already are (`series_spec_039`).
- Frontend: `SeriesList`'s row title and `SeriesDetail`'s header now display a year range (`"Ozark (2017-2022)"` for an ended/canceled show, `"The Simpsons (1989-)"` for one still running) instead of only the single stored `year`, via a new shared `formatSeriesYear` utility (`frontend_spec_058`).

### Changed

- Backend: `GET /api/v1/series/search`'s `yearMin`/`yearMax` now use true interval-overlap matching against a series' known airing span (`[year, lastAirYear ?? year]`) instead of matching only the stored `year` field — a running show that started before the requested range but is still airing through it now matches. No query-param contract change. Supersedes `series_spec_037`'s `SERIES-037-AC-03` stopgap (`series_spec_039`).

## [3.1.0] - 2026-08-29

### Added

- Frontend: a status tab bar (All/Watching/Completed/Backlog/Dropped) now sits above `SeriesList`, each tab its own bookmarkable URL (`/my-series`, `/my-series/watching`, `/my-series/completed`, `/my-series/backlog`, `/my-series/dropped`) — replaces the removed `SearchFilter` Status dropdown as the only way to filter by status, with a fifth Dropped tab added so no filtering capability was lost (`frontend_spec_056`).

## [3.0.0] - 2026-08-29

### Removed

- Backend: `GET /api/v1/series/search` (and `/export`) no longer accept `maxPersonalRating`, `maxImdbRating`, or `startedNotFinished` — confirmed genuinely unused, dropped outright rather than deprecated. **Breaking change** to this endpoint's query contract (`series_spec_037`).
- Frontend: `SearchFilter` no longer renders Max Personal Rating, Max IMDb Rating, or "Started, not finished" — mirrors the backend removal above (`frontend_spec_055`).
- Frontend: `SearchFilter` no longer renders a Status dropdown — pulled forward from the upcoming status-tabs work (`frontend_spec_056`); the backend `status` search param still works, only this UI control is gone for now (`frontend_spec_055`).

### Added

- Backend: `GET /api/v1/series/search` (and `/export`) gain `minTmdbRating` and `yearMin`/`yearMax` query params, mirroring `minImdbRating`'s null-handling shape. `yearMin`/`yearMax` match only the series' single stored first-aired `year` — a documented stopgap ahead of true episode-air-date range semantics (`series_spec_037`).
- Frontend: `SearchFilter` gains Min TMDB Rating and Min/Max Year number inputs, sending `minTmdbRating`/`yearMin`/`yearMax` to match the backend's new query params above (`frontend_spec_055`).
- Frontend: `SearchFilter`'s Genres field is now a checkbox list (one checkbox per genre from `seriesApi.getGenreOptions()`, the same pattern `RecommendationControls` already used) instead of a free-text input (`frontend_spec_055`).
- Frontend: `SearchFilter`'s fields now sit behind a collapsible "Hide Filters"/"Show Filters" panel, reusing `RecommendationControls`' disclosure pattern, including its `filtersOpen` default of closed so both panels behave consistently (`frontend_spec_055`).
- Frontend: `SearchFilter`'s Min IMDb Rating, Min TMDB Rating, Min Year, and Max Year inputs now carry the same `min`/`max`/`step` HTML validation bounds `RecommendationControls`' Custom Search fields already use, via a new shared `frontend/src/utils/yearBounds.ts` (also adopted by `RecommendationControls.tsx` in place of its own local constants) (`frontend_spec_055`).
- Frontend: `SearchFilter`'s Min Personal Rating field is now the interactive `StarRating` component (click-to-set/click-again-to-clear) instead of a plain number input, matching how personal ratings are set everywhere else in the app (`frontend_spec_055`).
- Frontend: `SeriesList`'s expanded row view now shows a series' genres immediately before its status, when present (`frontend_spec_059`).

### Fixed

- Backend: `RecommendationCriteriaValidator`'s year-range validation now takes the app's injected `Clock` bean (`Year.now(clock)`) instead of the JVM's implicit default time zone (SonarQube `java:S8688`), matching this codebase's existing `ClockConfig` convention used elsewhere.
- Frontend: `KeywordPicker`'s repeated `string[] | PickerOption[]` union type is replaced by a single exported `PickerOptions` type alias (SonarQube `typescript:S4323`), no behavior change.
- Dev tooling: Vite's dev server now binds to the IPv4 loopback (`127.0.0.1`) explicitly instead of the default `localhost`, which some VPN clients make unreachable (they disable/reroute IPv6 while connected, and Vite's default bind resolves to the IPv6 loopback) — no effect on the built/deployed app, local dev only.

## [2.23.0] - 2026-08-28

### Fixed

- Backend: `RecommendationService` no longer decides "Use My Series" (pool-based) sourcing by elimination — a request with only `minTmdbRating`/`yearMin`/`yearMax` set (no `genres`/`keywords`/`seriesIds`/`sourceMode`) was indistinguishable from a fully empty request and both silently fell back to pool-based sourcing, bypassing Custom Search's `discover/tv` call (and its pre-fetch filtering) entirely. `sourceMode` gains an explicit `useMySeries` value; Custom Search is now the default/fallback path reached whenever a request isn't explicitly `trending`/`topRated`/`useMySeries` (or carries a `seriesIds` selection) (`series_spec_033`).
- Frontend: `RecommendationControls` now sends `sourceMode: 'useMySeries'` on every request while that tab is active, regardless of whether a specific-series selection has been made — required so the backend fix above never falls back to Custom Search's unfiltered `discover/tv` call for the default "Use My Series" experience (`frontend_spec_049`).
- Backend: Custom Search's `discover/tv` sourcing call (`RecommendationSourcingService.sourceByGenreOrKeyword`) now sends `minTmdbRating`/`yearMin`/`yearMax` to TMDB itself (`vote_average.gte`/`air_date.gte`/`air_date.lte`), not just as a post-fetch filter — a restrictive rating/year combination could previously return few/zero results from TMDB's single ~20-result unpaginated page even when real matches existed on results this app never asked for, the same class of bug `series_spec_029` fixed for `minVoteCount` (`series_spec_031`).
- Frontend: `RecommendationControls` no longer renders "Max Per Source"/"Max Sources Shown" inputs — both were dead controls under every Discover mode (never applied to Discover sourcing/output), so removed entirely rather than mode-gated, pending a later "Use My Series" revamp that will redesign this concept; backend fields/behavior are unchanged, they simply fall back to existing config defaults now that the frontend never sends them (`frontend_spec_048`).
- Backend: `minTmdbRating`/`yearMin`/`yearMax` were previously unvalidated — a negative or absurd value silently matched nothing (post-fetch) or, since the Custom Search pre-fetch change above, produced a malformed TMDB request. `RecommendationCriteriaValidator` now rejects `minTmdbRating` outside 0–10, `yearMin`/`yearMax` outside 1900–(current year + 1), and `yearMin` exceeding `yearMax`, all with a 400 (`series_spec_031`).
- Frontend: the Min TMDB Rating and Year Min/Max inputs now carry `min`/`max`/`step` HTML attributes matching the backend's own bounds, so the spin arrows (and typed input, in browsers that enforce it) can no longer produce an out-of-range value in the first place — the backend validation above remains the actual enforcement (`frontend_spec_046`).
- Frontend: `RecommendationsList`'s empty-state message no longer unconditionally reads "mark a series as Completed to get suggestions" — that copy only makes sense for "Use My Series" pool-based sourcing (`query?.sourceMode === 'useMySeries'`); every other case (Trending, Highest Rated, Custom Search) now shows a generic "no shows match these filters" message instead.
- Frontend: `RecommendationControls` now establishes the real default query on mount (a new mount-only effect calling `onQueryChange(buildQuery(state))` once) — previously nothing ever called `onQueryChange` until a user action, so a fresh page load's first `/recommendations` request fired with zero query params at all and hit the backend's Custom Search unfiltered-discover fallback instead of "Use My Series" pool sourcing.

### Changed

- Backend: Custom Search's year filtering now matches on TMDB's _episode_ air date (`air_date.gte`/`.lte`) rather than a show's first-air year — a still-running older show (e.g. one airing continuously since 1989) can now match a recent year range instead of being excluded solely because its first episode predates it. This is scoped to Custom Search only; every other recommendation mode keeps matching on first-air year, unchanged (`series_spec_031`).
- Frontend: `RecommendationControls` moves Min TMDB Rating, Year Min, and Year Max out of the generic Filters disclosure box and into Discover > Custom Search's own panel (alongside Genres/Keywords) while that sub-mode is active, with a new hint explaining the year range now matches any year the show had an episode air — reflecting `series_spec_031`'s Custom-Search-specific pre-fetch semantics above. Every other mode keeps these fields inside Filters, unchanged. No wire-format change (`frontend_spec_046`).
- Frontend: the top nav is restyled from three unstyled `<button aria-pressed>` elements into a proper menu bar (new `App.module.css`) using real `<NavLink>`s with `aria-current="page"` for the active item, replacing the old `mainView` `useState` toggle (`frontend_spec_041`).
- Frontend: `RecommendationControls`' "Automatic" and "Specific Series" source options merge into a single "Use My Series" tab — the Specific Series picker (search/filter/sort/browse-all) is now always visible underneath it, with a hint that narrowing is optional (`frontend_spec_042`).
- Frontend: "Genre & Keyword" (renamed "Custom Search"), "Popular Right Now", and "Highest Rated" are grouped under a new "Discover" parent tab, selected via a nested second-level tab row shown only while Discover is active (`frontend_spec_042`).
- Frontend: the "Recommendation Source" selector is now a real two-tier WAI-ARIA Tabs widget (`role="tablist"`/`"tab"`/`"tabpanel"`, `aria-selected`/`aria-controls`) instead of a flat radio `<fieldset>`, matching `frontend_spec_041`'s menu-bar visual language (`frontend_spec_042`).
- Frontend: Custom Search's empty-genre/keyword hint no longer describes a "falls back to automatic recommendations" behavior that no longer happens — reworded to "Leave empty to browse the most popular shows overall", reflecting `series_spec_033`'s new unfiltered-discover behavior (`frontend_spec_049`).
- Backend: Custom Search's `discover/tv` sourcing call now additionally sends `language` to TMDB itself as `with_original_language`, not just as a post-fetch filter — the same pre-fetch relocation `series_spec_031` applied to `minTmdbRating`/`yearMin`/`yearMax`. `language`'s existing post-fetch check and single-value shape are unchanged (`series_spec_032`).

### Added

- Frontend: `App` gains real client-side routing via `react-router-dom` (`^7`, declarative mode) — the first router dependency this project has ever had — for the three top-level views: `/my-series`, `/recommendations`, `/keywords`. `/` and any unmatched path redirect to `/my-series` (`frontend_spec_041`).
- Frontend: a placeholder logo/wordmark now sits at the start of the top nav, linking to `/my-series` from anywhere in the app (`frontend_spec_041`).
- Backend: a new `countries` recommendation filter (comma-separated ISO 3166-1 alpha-2 codes) excludes a candidate whose origin country doesn't match any listed value — applied as a post-fetch output filter unconditionally across every sourcing mode, and additionally sent to TMDB itself as `with_origin_country` (pipe-joined — TMDB treats comma as AND for this specific param, unlike `with_genres`/`with_keywords`, confirmed via live testing) for Custom Search sourcing specifically. Unlike `language`, `countries` is multi-select/OR-matched (`series_spec_032`).
- Frontend: `KeywordPicker` gains an optional `pinnedOptions` prop — options that always appear first in the suggestion list regardless of the currently typed search text, deduped against the normal suggestion list by `id`. Purely additive; every existing consumer that doesn't pass it is unaffected (`frontend_spec_047`).
- Frontend: Discover > Custom Search (and the Filters box for every other mode) gains a new Country-of-origin filter — a `KeywordPicker` multi-select with United States/United Kingdom pinned as one-click shortcuts and a searchable list of other common TV-production countries (new `utils/countryOptions.ts`, deliberately hardcoded rather than derived from tracked series data), sending `countries` in the emitted `RecommendationQuery` (`frontend_spec_047`).
- Frontend: the Language filter's plain text input is replaced by a single-select picker in the same two locations (Custom Search's own panel / the generic Filters box) as the Country filter above — no wire-format change, `language` is still sent as the same single string (`frontend_spec_047`). Revised 2026-08-28 after live testing found the originally-shipped bespoke picker's pinned "English" button never reflected selection state and had no way to clear a selected language back to empty: Language now reuses the same `KeywordPicker` chip-with-"×" UX Country already uses (single-select enforced by a thin adapter, no `KeywordPicker` changes needed), and the pinned quick-select set expands from English-only to English/Spanish/French/German/Japanese/Korean.

## [2.19.2] - 2026-08-27

### Fixed

- Frontend: `RecommendationControls` no longer fires a new backend request on every single filter change (e.g. one per keystroke) — every control except "Recommendation Source" now only updates local (pending) state, sent only when the new "Apply Filters" button is clicked (`frontend_spec_040`).
- Frontend: `RecommendationsList`'s `loading` state now correctly resets to `true` on every subsequent fetch (previously only ever set on mount), so a slower request is now visible instead of silently appearing to "stop refreshing" (`frontend_spec_040`).
- Frontend: while a recommendations request is in flight (mode change or Apply Filters), `RecommendationControls` now shows a "Processing recommendations…" overlay and disables the "Recommendation Source" radios and "Apply Filters" button, preventing overlapping requests (`frontend_spec_040`).

## [2.19.1] - 2026-08-27

### Fixed

- Backend: "Genre & Keyword" mode's `discover` sourcing call (`RecommendationSourcingService.sourceByGenreOrKeyword`) now sends a `vote_count.gte` floor to TMDB, so sorting by "Vote Average" or "Newest" no longer surfaces obscure/brand-new shows that the app's own post-fetch `minVoteCount` filter then wiped out — this had been returning zero results for narrow single-genre queries. The floor's default is now a configurable `app.tmdb.default-min-vote-count` property (`APP_TMDB_DEFAULT_MIN_VOTE_COUNT`, default 200) rather than a hardcoded `20` constant, and — as a deliberate, explicit side effect — the same 200 default now also applies to the post-hoc output filter for Automatic/Specific Series/Genre modes, not just Genre & Keyword (`series_spec_029`).

## [2.19.0] - 2026-08-27

### Changed

- Frontend: `RecommendationControls`' "Specific Series" mode replaces its checkbox-per-series list with a searchable `KeywordPicker` (type-to-filter, removable chips, capped default suggestion list via a new `SPECIFIC_SERIES_PICKER_LIMIT`/`VITE_SPECIFIC_SERIES_PICKER_LIMIT`, default 15) plus a "Show all series" browse-all modal mirroring `SearchFilter`'s "Browse all keywords" dialog (`frontend_spec_035`).
- Frontend: the "Specific Series" picker gains client-side-only genre and status ("Any"/"Completed Only"/"Completed or Watching") filters and a sort control (reusing `SeriesList`'s sort field set/labels, defaulting to Title/ascending) that narrow and order its candidate pool; none of this is sent to the backend or affects the emitted `RecommendationQuery` (`frontend_spec_035`).
- Frontend: `KeywordPicker`'s `options` prop now also accepts `PickerOption[]` (`{ id, label }`) alongside its existing `string[]` support, selecting/deduping by `id` and displaying by `label`, enabling reuse by the "Specific Series" picker without a fork (`frontend_spec_035`).
- Frontend: `KeywordPicker` gains an optional `PickerOption.display` (rich `ReactNode` override for the suggestion button/chip, defaulting to plain `label`) — used by the "Specific Series" picker to render **bold title** | country - _italic status_, replacing the previous plain-text `title (year) — country (status)` format (cosmetic, no spec).
- Frontend: the "Specific Series" picker's Filter by Genre now shares a row with Filter by Status and Sort by (two-column layout) instead of stacking full-width, since the genre checkbox list left a lot of empty width beside it — temporary until this section gets a proper sheet/modal-based filter redesign (layout-only, no spec).
- Frontend: fixed `KeywordPicker`'s suggestion buttons and `RecommendationControls`' "Show all series" button rendering in the browser's default button font (Arial) instead of the app's system font — neither had ever set `font-family: inherit`, a pre-existing gap that only became visually obvious once bold/italic styling was added.

## [2.18.0] - 2026-08-27

### Changed

- Frontend: `AddSeriesForm` gains a `source?: 'manual' | 'recommendation'` prop; when opened from `RecommendationsList`'s "Mark as Watched"/"Add to List" CTAs it now hides Total Seasons, Total Episodes, IMDb Rating, and both Rotten Tomatoes rating fields (already destined to be overwritten by the post-add `seriesApi.refresh` call) and renders Status as read-only text instead of an editable dropdown (`frontend_spec_034`).

## [2.17.6] - 2026-08-27

### Changed

- Backend: reduced `SeriesService.create`'s cognitive complexity (SonarQube) by extracting its validation, entity-field-copy, create-time-defaults, and keyword-sync logic into their own methods, mirroring `update`'s existing split in the same file. No behavior change.
- Frontend: reduced `SeriesDetail`'s cognitive complexity (SonarQube) by extracting its field-display grid and actions bar into new `SeriesDetailFields`/`SeriesDetailActionsPanel` components, also bringing the file under this project's ~200-line component guideline. No behavior change — DOM output, `data-testid`s, and `aria-label`s are unchanged.

## [2.17.5] - 2026-08-27

### Changed

- Frontend: extracted `SeriesDetail.tsx`/`SeriesList.tsx`'s duplicated rewatch-toggle and delete-submission control flow into shared `utils/rewatchToggle.ts` (`toggleRewatchFlag`) and `utils/deleteSeries.ts` (`submitDelete`) helpers, with no behavior change (`tooling_spec_006`).
- Frontend: the rewatch toggle's label text and `aria-label` now reflect the current flagged/unflagged state instead of staying static, so the toggle no longer relies on color alone to signal state (`frontend_spec_012` amendment).

## [2.17.4] - 2026-08-27

### Changed

- Backend: extracted `TmdbClient`/`OmdbClient`'s duplicated JSON-scalar-coercion, api-key-guard, and transport-failure-wrapping logic into a new shared `client/ExternalApiSupport` helper class, with no behavior change (`tooling_spec_004`).

## [2.17.3] - 2026-08-27

### Changed

- Chore: dependency updates (Spring Boot 4.1.0→4.1.1, spotbugs plugin 6.5.10→6.5.11, Gradle wrapper 9.7.0→9.7.1, `@testing-library/jest-dom` 6.9.1→7.0.1, `@types/react` 19.2.17→19.2.18, `eslint` 10.6.0→10.8.1, `typescript-eslint` 8.62.0→8.67.0, `vite` 8.2.1→8.2.2), applied as one sweep from the open dependabot PRs rather than merging each individually. Backend build, full frontend test suite, lint, and production build all verified green after the bump.

## [2.17.2] - 2026-08-27

### Changed

- Docs: split `README.md`'s API Overview and Features Roadmap sections into dedicated `API.md` and `ROADMAP.md` files. `ROADMAP.md` pairs each feature with its backend/frontend spec(s), and an audit against `.claude/specs/` while building it corrected three stale "Not started" statuses and added nine shipped specs that were missing from the old table entirely.

### Removed

- Docs: retired `.claude/OUTSTANDING_SPECS.md` — its tracking role (specs written, not yet built) now lives in `ROADMAP.md`'s "Specced, coming soon" section.

## [2.17.1] - 2026-08-26

### Fixed

- Frontend: `RecommendationControls`' "Specific Series" picker now shows each series' year and origin country alongside title/status, so two tracked series sharing a title can be told apart.

## [2.17.0] - 2026-08-26

### Added

- Frontend: `SeriesList`'s rating column now shows TMDB rating (with a "TMDB" label) when the list is sorted by TMDB rating, IMDb rating (with an "IMDb" label) otherwise — previously always showed IMDb rating regardless of active sort field (`frontend_spec_039`).

## [2.16.0] - 2026-08-26

### Added

- Frontend: new `StarRating` component — a shared, accessible star-rating widget (read-only when no `onChange` is passed, interactive 5-button group when one is) replacing every raw numeric `personalRating` display/input across the app (`frontend_spec_013`).

### Changed

- Frontend: `SeriesDetail`'s Personal Rating field and `SeriesList`'s new `personalRating` column both render a read-only `StarRating` instead of the raw number.
- Frontend: `AddSeriesForm`/`EditSeriesForm`'s Personal Rating input (via the shared `SeriesFormFields`) is now an interactive `StarRating`; the now-unreachable 1–5 range validation was deleted rather than left as dead code.

## [2.15.6] - 2026-08-26

### Changed

- Frontend: extracted `AddSeriesForm`/`EditSeriesForm`'s seven byte-identical field validators into `src/utils/seriesFormValidation.ts`.
- Frontend: extracted `AddSeriesForm`/`EditSeriesForm`'s thirteen near-identical field blocks (Year through Exclude from recommendations) into a new shared `SeriesFormFields` component; both forms now render it, `EditSeriesForm` passing Current Season/Current Episode as children. No behavior change — every existing test passes unmodified (`tooling_spec_005`).

### Security

- Frontend: the poster URL preview (`AddSeriesForm`/`EditSeriesForm`, now `SeriesFormFields`) only renders an `<img>` for `http(s)://` URLs, via a new `sanitizeImageUrl` helper — resolves a CodeQL `js/xss-through-dom` finding on the unvalidated `<img src>`.

## [2.15.5] - 2026-08-26

### Changed

- Backend: resolved IDE-flagged Groovy spec warnings across 8 spec files — replaced inline fully-qualified type references (`org.hamcrest.Matchers`, `MockMvcResultMatchers`, `SeriesStatus`, `SeriesEntity`, `KeywordEntity`, `LocalDateTime`) with proper imports, and updated `SeriesExportServiceSpec`/`SeriesControllerSpec` to use Jackson 3.x's `JsonNode` accessors (`stringValue()`, `asString()`) instead of the deprecated Jackson 2.x-era names (`textValue()`, `asText()`). No behavior change.
- Docs: added a "Groovy spec conventions" section to `.claude/steering/structure.md` covering both patterns above, to prevent recurrence.

## [2.15.4] - 2026-08-26

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
