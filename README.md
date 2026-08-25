# TV Series Tracker

A personal app for logging TV series you're watching, tracking your viewing progress, and storing ratings from multiple sources (IMDb, Metacritic, Rotten Tomatoes).

## What it does

- Add series with metadata (title, year, genre, episode count)
- Track viewing progress at season/episode level
- Store ratings from IMDb, Metacritic, and Rotten Tomatoes alongside personal ratings and notes
- Search and filter by genre, rating range, and completion status
- Export your data as JSON or CSV
- Get series recommendations sourced from TMDB, based on shows similar to what you've completed (or, with too little data yet, your most-watched genres), with a dismiss/ignore list so a rejected suggestion never resurfaces

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 25 toolchain, Spring Boot 4.1.0 |
| Frontend | TypeScript ~6.0, React 19.2, Vite 8.2 |
| Database | SQLite (local dev) → PostgreSQL (production) |
| ORM | Spring Data JPA + Hibernate |
| Migrations | Flyway |
| Build (backend) | Gradle (wrapper included) |
| Build (frontend) | Vite, npm |
| Tests (backend) | Spock Framework (Groovy) |
| Tests (frontend) | Vitest, React Testing Library |

## Project Structure

```
series-recommendation/
├── .claude/
│   ├── agents/            # Claude Code subagents (backend-dev, frontend-dev, spec-writer)
│   ├── skills/             # Claude Code skills (ears-spec)
│   ├── steering/           # AI assistant context files
│   └── specs/               # Feature specs and requirements
├── backend/               # Spring Boot application
│   ├── src/main/java/uk/co/stefirby/seriestracker/
│   │   ├── controller/    # REST endpoints
│   │   ├── service/       # Business logic
│   │   ├── repository/    # Spring Data JPA
│   │   ├── model/         # JPA entities + enums
│   │   ├── dto/           # API request/response types
│   │   └── exception/     # Custom exceptions + global handler
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── db/migration/  # Flyway SQL scripts
│   └── src/test/groovy/   # Spock specifications
├── frontend/              # React + Vite application
├── CLAUDE.md              # Claude Code steering entrypoint
└── README.md
```

## API Overview

The backend exposes a REST API at `http://localhost:8080/api/v1`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/series` | Create a new series |
| `GET` | `/api/v1/series` | List all series. `sortBy`/`sortDirection` — see below. |
| `GET` | `/api/v1/series/{id}` | Get a series by ID |
| `PATCH` | `/api/v1/series/{id}` | Update a series (partial) |
| `DELETE` | `/api/v1/series/{id}` | Delete a series |
| `GET` | `/api/v1/series/search` | Search and filter series (`title`, `genre`, `keyword`, `status`, rating ranges, `startedNotFinished`, `flaggedForRewatch`). `sortBy`/`sortDirection` — see below. |
| `GET` | `/api/v1/series/export` | Export as JSON or CSV |
| `GET` | `/api/v1/series/keywords?sortBy=` | Aggregate per-keyword stats (`seriesCount`, `averagePersonalRating`) across your tracked series, from normalized TMDB keyword data. `sortBy` is `seriesCount` (default) or `averagePersonalRating`, both descending, null averages last; an unrecognized value falls back to the default rather than `400`. Empty list, not an error, when nothing tracked has keywords. |
| `GET` | `/api/v1/series/lookup/search-tmdb?title=` | Search TMDB for a title — TMDB is this app's sole search source (matches original/translated/AKA names, e.g. "Spooks", catalogued elsewhere as "MI-5"). Requires `app.tmdb.api-key`. An empty result is a normal `200` with an empty list, not an error. |
| `GET` | `/api/v1/series/lookup/resolve-tmdb?tmdbId=` | Resolve a TMDB search candidate to full lookup detail, built exclusively from TMDB's own data (title, year, genres, poster, season/episode counts, `tmdbRating`/`tmdbVoteCount`). If TMDB resolves an `imdbId`, `imdbRating`/`rottenTomatoesRating` are additionally merged in from OMDb (requires `app.omdb.api-key`) — any OMDb failure or absence just leaves those two fields `null`, never fails the request. Always `200` on success; `502` only for a genuine TMDB upstream failure. |
| `GET` | `/api/v1/series/recommendations?limit=` | Suggest series to watch next, sourced from TMDB based on your `COMPLETED` series (title-based), supplemented by your most-watched genres when there's too little title-based data yet. A series with `excludeFromRecommendations: true` is skipped entirely from this automatic sourcing (both the title-based pool and the genre-frequency count derived from it) — set it via `POST`/`PATCH /api/v1/series` when a show is rated fine but isn't representative of your taste. This exclusion does **not** apply to an explicit `seriesIds` selection below, which always wins over the standing preference. Excludes anything already added or ignored. `limit` defaults to 20, clamped to 1-50. Requires `app.tmdb.api-key` to be configured once there's data to source from — see `RUNBOOK.md`'s Environment Variables section — otherwise returns `502`. Also accepts `sourceMode=trending\|topRated` for two additional directed-sourcing modes independent of your own watch history, mutually exclusive with `seriesIds`/`genres`/`keywords` (`400` if combined, or if `sourceMode` isn't one of the two recognized values): `trending` sources TMDB's globally trending shows (`trendingWindow=day\|week`, default `week`); `topRated` sources TMDB's highest-rated shows overall using `minVoteCount` (default **200** for this mode specifically — every other mode defaults to 20) as the query's own vote-count floor. `trending`, `topRated`, and genre/keyword-directed sourcing (`genres`/`keywords`) all keep TMDB's own returned order rather than being re-ranked/diversity-capped by the app, since none of the three ever link a candidate back to one of your own series. For `topRated` and genre/keyword-directed sourcing specifically, `discoverSortBy` selects the TMDB-native `discover/tv` `sort_by` value driving that order — one of TMDB's 12 documented values (e.g. `vote_average.desc`, `popularity.desc`, `first_air_date.desc`; `400` if unrecognized), defaulting to `vote_average.desc` for `topRated` and `popularity.desc` for genre/keyword-directed sourcing when omitted; ignored (not an error) under any other mode. All three directed modes still exclude anything already added or ignored. `excludeKeywords` (comma-separated names) excludes a candidate whose TMDB keywords case-insensitively match any entry, applied last (after every other output filter) across every sourcing mode; a per-candidate keyword lookup failure fails that one candidate open rather than the whole request. Each result also carries `streamingProviders` — the currently-available subscription-streaming (`flatrate`) services it's on in `app.tmdb.watch-region` (default `GB`), sourced live per request from TMDB/JustWatch (`GET /tv/{tmdbId}/watch/providers`), never persisted; a failed or empty lookup just yields an empty list for that one candidate, never a failed request. |
| `POST` | `/api/v1/series/ignored` | Dismiss a recommendation (`{ imdbId, title, reason? }`) so it never resurfaces. Idempotent — re-ignoring the same `imdbId` returns `200` instead of `201`. |
| `POST` | `/api/v1/series/{id}/refresh` | Re-fetch one series' external data: TMDB detail (`totalSeasons`/`totalEpisodes`/`tmdbRating`/`tmdbVoteCount`/`productionStatus`), its normalized `keywords` set, and a narrowed OMDb ratings call (`imdbRating`/`rottenTomatoesRating`). Either source failing is independently non-fatal — a partial success is saved, not rolled back. User-owned fields (`title`, `genres`, `personalRating`, etc.) are never touched. Always forces a real refresh, ignoring `app.tmdb.refresh-skip-threshold-minutes` (that threshold applies only to bulk refresh). If `totalSeasons`/`totalEpisodes` increased since before this refresh (and a prior value existed — a first-ever populated value doesn't count), `newContentDetectedAt` is set to now; if the series was `COMPLETED` at the time, it's also flipped to `BACKLOG` with `dateCompleted` cleared (`DROPPED`/`WATCHING`/`BACKLOG` are left alone). `404` for an unknown id; otherwise always `200` with `{ series, omdbRefreshed, tmdbRefreshed }`. |
| `POST` | `/api/v1/series/{id}/acknowledge-new-content` | Clear a series' `newContentDetectedAt` flag once you've seen it — never reverses a status change refresh already made. `404` for an unknown id; otherwise `200` with the updated series. |
| `POST` | `/api/v1/series/refresh-all` | Start an async job refreshing every tracked series sequentially (same logic as the single-series refresh above, including new-content detection/reactivation), with a fixed delay between items (`app.tmdb.refresh-delay-ms`) to stay within TMDB's rate limit. A series refreshed within `app.tmdb.refresh-skip-threshold-minutes` (default 60; `0` disables skipping) is skipped rather than re-fetched, but still counted toward `completedCount`. `202` with the job's initial state; `409` if a job is already running. |
| `GET` | `/api/v1/series/refresh-all/status` | Poll the current (or most recently finished) bulk refresh job's `{ status, totalCount, completedCount, skippedCount, startedAt, finishedAt }`. `status` is `IDLE` before any job has ever run, then `IN_PROGRESS`/`COMPLETED`/`FAILED` — a completed run's result stays visible here until a new job starts. |

`sortBy`/`sortDirection` on `GET /api/v1/series` and `GET /api/v1/series/search`: `sortBy` is one of `dateAdded` (default), `personalRating`, `title`, `year`, `imdbRating`, `tmdbRating`; `sortDirection` is `asc` or `desc` (default `desc`). An unrecognized value for either returns `400`, unlike `/keywords?sortBy=`'s fall-back-to-default behavior above. A `null` value for the chosen field always sorts last regardless of direction (`title` has no null case). Under `sortBy=tmdbRating`, `tmdbVoteCount` descending breaks ties (including both-`tmdbRating`-null ties) so a near-unrated show can't outrank a well-established one on a coincidental exact-rating match.

Full interactive docs are available at `http://localhost:8080/swagger-ui.html` when the backend is running (requires springdoc-openapi to be added — not yet a dependency).

CORS is configured on `/api/**` to allow direct cross-origin calls from the frontend dev server (`http://localhost:5173` by default, overridable via `app.cors.allowed-origins` in `application.yml` or the `APP_CORS_ALLOWED_ORIGINS` env var — see `RUNBOOK.md`'s Environment Variables section).

## Getting Started

See [RUNBOOK.md](./RUNBOOK.md) for detailed setup and local development instructions.

## Features Roadmap

| Spec | Feature | Status |
|------|---------|--------|
| Backend 001 | Series entity and schema | ✅ Done |
| Backend 002 | CRUD REST endpoints | ✅ Done |
| Backend 003 | Search and filter | ✅ Done |
| Backend 004 | Export (JSON/CSV) | ✅ Done |
| Frontend 001 | Types & API service layer | ✅ Done |
| Frontend 002 | `SeriesList` component | ✅ Done |
| Frontend 003 | `AddSeriesForm` (add-series modal) | ✅ Done |
| Frontend 004 | Edit/delete series (`EditSeriesForm`, inline delete confirmation) | ✅ Done |
| Frontend 005 | `SeriesDetail` (full-record view, navigation, edit/delete from detail) | ✅ Done |
| Frontend 006 | `SearchFilter` (search & filter UI) | ✅ Done |
| Frontend 007 | `ExportControls` (export trigger) | ✅ Done |
| Frontend 008 | Accessible row interactions (`SeriesList` nested-interactive fix) | ✅ Done |
| Frontend 009 | OMDb autofill & poster display (`AddSeriesForm` Look Up + poster preview, `EditSeriesForm`/`SeriesDetail`/`SeriesList` poster display) | ✅ Done — superseded, see Frontend 022 |
| Backend 005 | OMDb lookup & poster field | ✅ Done — largely superseded, see Backend 017 |
| Backend 006 | Series recommendations (TMDB-sourced, ignore list) | ✅ Done |
| Frontend 010 | Recommendations UI (`RecommendationsList`, `AddSeriesForm` `initialValues` prefill, nav toggle) | ✅ Done |
| Backend 007 | Directed recommendation sourcing, rating-weighted ranking, diversity cap, output filters | ✅ Done |
| Frontend 011 | `RecommendationControls` (sourcing mode, output filters) | ✅ Done |
| Backend 010 | `GET /series/genres` genre vocabulary endpoint | ✅ Done |
| Frontend 014 | Genre checkbox list (replaces free-text genre sourcing) | ✅ Done |
| Backend 011 | OMDb search candidates & disambiguated lookup | ✅ Done — superseded, see Backend 017 |
| Frontend 015 | Lookup candidate picker (`AddSeriesForm`) | ✅ Done — superseded, see Frontend 022 |
| Backend 012 | TMDB search fallback & resolve | ✅ Done — superseded, see Backend 017 |
| Frontend 016 | TMDB lookup fallback UI (`AddSeriesForm` "Search TMDB instead") | ✅ Done — superseded, see Frontend 022 |
| Backend 013 | `alternateTitle` field | ✅ Done — removed, see Backend 017 |
| Frontend 017 | Alternate title UI (`AddSeriesForm`/`EditSeriesForm` editable field, OMDb/TMDB lookup mismatch capture, `SeriesList`/`SeriesDetail` display) | ✅ Done — removed, see Frontend 022 |
| Backend 014 | `tags` field | ✅ Done |
| Frontend 018 | User-defined tags UI (`AddSeriesForm`/`EditSeriesForm` editable field, `SeriesDetail` display) | ✅ Done |
| Backend 015 | Multi-source recommendation attribution, `sortBy=recommendationCount` | ✅ Done |
| Frontend 019 | Multi-source recommendation display (`RecommendationsList` "and N more", `Sort By`/`Max Sources Shown` controls) | ✅ Done |
| Backend 016 | Recommendation TMDB rating & vote count | ✅ Done |
| Frontend 020 | Recommendation rating/vote-count display | ✅ Done |
| Frontend 021 | TMDB-primary title fix (TMDB search fallback keeps searched title as primary) | ✅ Done — folded into Frontend 022 |
| Backend 008 | Series lifecycle data (`excludeFromRecommendations`, `productionStatus`, `flaggedForRewatch`) | ✅ Done — Requirement 3 (Refresh) superseded, see Backend 018. Requirement 2's `ProductionStatus` enum/column/create-time resolution was pulled in early via Backend 018/021; `excludeFromRecommendations` (Requirement 1) and `flaggedForRewatch` (Requirement 4) closed the remaining gap: `POST`/`PATCH /api/v1/series` accept both, `GET /api/v1/series/search` filters on `flaggedForRewatch`, and `GET /api/v1/series/recommendations`'s automatic sourcing skips any `excludeFromRecommendations: true` series (not an explicit `seriesIds` selection) |
| Frontend 012 | Series lifecycle controls (exclude checkbox, production-status badge, rewatch toggle/filter) | ✅ Done — Requirement 4 (Refresh) superseded, see Frontend 023. `AddSeriesForm`/`EditSeriesForm` gain an "Exclude from recommendations" checkbox; `SeriesDetail` already displayed a production-status label; `SeriesList` rows and `SeriesDetail` (both `COMPLETED`-only) gain a "flag for rewatch" toggle with revert-on-failure, and `SearchFilter` gains a matching "Flagged for rewatch" checkbox. `GET /api/v1/series/search`'s `flaggedForRewatch` query param is now wired into `SeriesController.search()` (fixed alongside this work) |
| Backend 009 | Sort by personal rating, plus `title`/`year`/`imdbRating`/`tmdbRating` (`sortBy`/`sortDirection` on listing endpoints) | ✅ Done |
| Frontend 013 | Star ratings & sort (`StarRating` component, `SeriesList` sort control) | ⬜ Not started |
| Backend 017 | TMDB-primary lookup & rating sourcing (TMDB search/resolve as sole lookup path; OMDb narrowed to a single `imdbRating`/`rottenTomatoesRating` enrichment call; drops `metacriticRating`/`alternateTitle`; adds `tmdbRating`/`tmdbVoteCount`) | ✅ Done |
| Frontend 022 | TMDB-primary lookup UI (single TMDB search/candidate-picker flow, drops the OMDb picker, "Search TMDB instead" escape hatch, and alternate-title/Metacritic fields) | ⬜ Not started |
| Backend 018 | Series refresh — single (`POST /series/{id}/refresh`) + bulk (`POST`/`GET /series/refresh-all`) async job, rate-limited, `lastRefreshedAt` tracking, new-content detection/acknowledgment (`newContentDetectedAt`, `POST /series/{id}/acknowledge-new-content`), bulk skip threshold (`app.tmdb.refresh-skip-threshold-minutes`, `skippedCount`), `COMPLETED → BACKLOG` reactivation on new content | ✅ Done |
| Frontend 023 | Series refresh UI (`SeriesDetail` Refresh button, `SeriesList` "Refresh All" with progress polling/reload-safe state, relative-time display) | ✅ Done |
| Backend 019 | Keyword tracking (normalized `keyword`/`series_keyword` tables from TMDB, `GET /series/keywords` stats endpoint, keyword search filter) | ✅ Done |
| Frontend 024 | Keyword tracking UI (`SeriesDetail` keyword chips, sortable keyword stats view, `SearchFilter` keyword filter) | ✅ Done |
| Backend 020 | Watch providers (TMDB/JustWatch streaming availability, UK-region default, attached to recommendation candidates) | ✅ Done |
| Frontend 025 | Watch providers UI (`RecommendationsList` streaming badges, JustWatch attribution) | ✅ Done |
| Backend 021 | TMDB origin country (`originCountry` on lookup candidates/lookup result/persisted series, kept fresh on refresh, included in export; closes a `productionStatus` create-time gap from Backend 008/018) | ✅ Done |
| Frontend 026 | Origin country & TMDB metadata display (candidate-picker country badge, series-list "(Year) \| Country", `productionStatus`/`tmdbRating`/`tmdbVoteCount` surfaced) | ⬜ Not started |
| Backend 023 | Recommendation metadata & persisted overview (`originCountry`/`tmdbId` on recommendation candidates, lazy per-candidate keyword lookup `GET /series/recommendations/{tmdbId}/keywords`, persisted series `overview` sourced from TMDB, kept fresh on refresh) | ✅ Done |
| Frontend 028 | Recommendation metadata & overview display (recommendation-card origin country badge, lazy per-card keyword expand, `SeriesDetail` overview display, `AddSeriesForm` overview carry-through) | ✅ Done |
| Backend 026 | On-demand streaming availability for a tracked series (`GET /series/{id}/watch-providers`, reuses Backend 020's `TmdbClient.watchProviders`/region config, never persisted, graceful degradation to an empty list) | ✅ Done |
| Frontend 036 | "Check Streaming Availability" button on `SeriesDetail` (on-demand only, own scoped `role="alert"` error, resets on navigating to a different series); also factors the provider-list/empty-state display out of `RecommendationsList` into a shared `StreamingProviders` component reused by both | ✅ Done |
| Backend 027 | Rotten Tomatoes Popcornmeter field (user-entered audience score, distinct from the existing Tomatometer-sourced `rottenTomatoesRating`) + refresh null-safety fix (`SeriesRefreshService` no longer wipes an existing field when the fresh external value is `null`) | ✅ Done |
| Frontend 037 | Rotten Tomatoes Popcornmeter UI (`AddSeriesForm`/`EditSeriesForm` field, `SeriesDetail` percentage display, "(Tomatometer)"/"(Popcornmeter)" labeling) | ⬜ Not started |

## Future Ideas

Deferred features and known gaps, not yet scheduled against a spec, are tracked in [FUTURE_IDEAS.md](./FUTURE_IDEAS.md).

## Changelog

Release history and notable changes are tracked in [CHANGELOG.md](./CHANGELOG.md).
