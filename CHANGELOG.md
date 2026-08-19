# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning
follows [Semantic Versioning](https://semver.org/). Backend
(`backend/build.gradle.kts`) and frontend (`frontend/package.json`) are
versioned together as one app.

## [Unreleased]

### Added

- Directed recommendation sourcing: base suggestions on specific tracked series, or on a genre/keyword directly, independent of watch history (`series_spec_007`, `frontend_spec_011`).
- Recommendations are now weighted by personal rating (both which series get to source them and how candidates are ranked), with a per-source diversity cap so one favorite doesn't dominate the list.
- New recommendation output filters: minimum TMDB rating, minimum vote count, year range, genre exclude-list, and language.
- `app.tmdb.max-source-series`/`app.tmdb.max-candidates` are now configurable instead of hardcoded.

### Changed

- TMDB genre discovery now also supports keywords (e.g. "Spy"), supplementing TMDB's fixed 16-genre TV taxonomy.

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
