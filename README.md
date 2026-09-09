# TV Series Tracker

A personal app for logging TV series you're watching, tracking your viewing progress, and storing ratings from multiple sources (IMDb, TMDB, Rotten Tomatoes).

## What it does

- Add series with metadata (title, year, genre, episode count), looked up from TMDB
- Track viewing progress at season/episode level, with status (Backlog/Watching/Completed/Dropped) and a separate rewatch flag/tab
- Store ratings from IMDb, TMDB, and Rotten Tomatoes (Popcornmeter) alongside personal ratings and notes
- Filter and sort your list by genre, keyword, rating, and year, with live title search and status tabs
- Export your data as JSON or CSV, and re-import it (or any file in the same shape) later
- Refresh a series' metadata from TMDB/OMDb on demand, or in bulk across your whole collection, with new-content detection
- Track normalized keywords per series, with keyword-based filtering
- Analyze your collection in an Analysis section — Keyword, Genre, and Country of Origin stats tables with series-count/rating aggregates, minimum-value filtering, and sortable columns
- See streaming (watch-provider) availability for a series or a recommendation candidate
- Get recommendations two ways: "Use My Series" (sourced from shows similar to what you've completed) or "Discover" (Custom Search by your own genre/keyword/rating/year/country/language criteria, Popular Right Now trending, or Highest Rated overall) — with a dismiss/ignore list so a rejected suggestion never resurfaces
- Save named filter presets across My Series, Recommendations, and Analysis so you don't have to re-enter the same criteria every session
- Customize Settings — light/dark/match-system theme, default watch region, country/language favourites, and refresh-scheduling overrides

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 25 toolchain, Spring Boot 4.1.0 |
| Frontend | TypeScript ~6.0, React 19.2, Vite 8.2 |
| Database | SQLite (local dev); PostgreSQL planned for production, no code changes needed (Spring Data JPA) |
| ORM | Spring Data JPA + Hibernate |
| Migrations | Flyway |
| Build (backend) | Gradle (Windows `gradlew.bat` wrapper only) |
| Build (frontend) | Vite, npm |
| Tests (backend) | Spock Framework (Groovy) |
| Tests (frontend) | Vitest, React Testing Library |

## Project Structure

```
series-recommendation/
├── .claude/
│   ├── agents/            # Claude Code subagents (backend-dev, frontend-dev, spec-writer)
│   ├── skills/             # Claude Code skills (ears-spec, verify)
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
├── scripts/               # Dev-server start/stop/restart bash scripts
├── CLAUDE.md              # Claude Code steering entrypoint
├── README.md
├── API.md                 # API endpoint reference
├── ROADMAP.md             # Feature delivery status
└── RUNBOOK.md
```

## API Overview

The backend exposes a REST API at `http://localhost:8080/api/v1`. See [API.md](./API.md) for the
full endpoint list, query params, and behavior notes.

## Getting Started

See [RUNBOOK.md](./RUNBOOK.md) for detailed setup and local development instructions.

## Features Roadmap

See [ROADMAP.md](./ROADMAP.md) for delivered features and what's specced and coming soon.

## Future Ideas

Deferred features and known gaps, not yet scheduled against a spec, are tracked in [future_ideas.md](./.claude/ideas/future_ideas.md).

## Changelog

Release history and notable changes are tracked in [CHANGELOG.md](./CHANGELOG.md).
