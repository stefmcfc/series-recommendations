# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning
follows [Semantic Versioning](https://semver.org/). Backend
(`backend/build.gradle.kts`) and frontend (`frontend/package.json`) are
versioned together as one app.

## [Unreleased]

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
