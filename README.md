# TV Series Tracker

A personal app for logging TV series you're watching, tracking your viewing progress, and storing ratings from multiple sources (IMDb, Metacritic, Rotten Tomatoes).

## What it does

- Add series with metadata (title, year, genre, episode count)
- Track viewing progress at season/episode level
- Store ratings from IMDb, Metacritic, and Rotten Tomatoes alongside personal ratings and notes
- Search and filter by genre, rating range, and completion status
- Export your data as JSON or CSV

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
│   ├── src/main/java/com/example/seriestracker/
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
| `GET` | `/api/v1/series` | List all series |
| `GET` | `/api/v1/series/{id}` | Get a series by ID |
| `PATCH` | `/api/v1/series/{id}` | Update a series (partial) |
| `DELETE` | `/api/v1/series/{id}` | Delete a series |
| `GET` | `/api/v1/series/search` | Search and filter series |
| `GET` | `/api/v1/series/export` | Export as JSON or CSV |

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
| Frontend 006 | `SearchFilter` (search & filter UI) | ✅ Done |
