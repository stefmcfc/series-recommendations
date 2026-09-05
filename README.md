# TV Series Tracker

A personal app for logging TV series you're watching, tracking your viewing progress, and storing ratings from multiple sources (IMDb, Metacritic, Rotten Tomatoes).

## What it does

- Add series with metadata (title, year, genre, episode count)
- Track viewing progress at season/episode level
- Store ratings from IMDb, Metacritic, and Rotten Tomatoes alongside personal ratings and notes
- Search and filter by genre, keyword, rating range, and completion status
- Export your data as JSON or CSV, and re-import it (or any file in the same shape) later
- Refresh a series' metadata from TMDB/OMDb on demand, or in bulk across your whole collection, with new-content detection
- Track normalized keywords per series, with keyword-based filtering
- Analyze your collection in an Analysis section — Keyword and Genre stats tables with series-count/rating aggregates, minimum-value filtering, and sortable columns
- See streaming (watch-provider) availability for a series or a recommendation candidate
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
