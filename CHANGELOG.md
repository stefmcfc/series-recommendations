# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning
follows [Semantic Versioning](https://semver.org/). Backend
(`backend/build.gradle.kts`) and frontend (`frontend/package.json`) are
versioned together as one app.

## [Unreleased]

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
