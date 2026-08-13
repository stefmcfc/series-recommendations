# TV Series Tracker

A personal app for logging TV series you're watching, tracking viewing progress, and storing ratings from multiple sources (IMDb, Metacritic, Rotten Tomatoes). See [README.md](./README.md) for the product overview and [RUNBOOK.md](./RUNBOOK.md) for local dev setup.

## Current status

- **Backend**: fully implemented. Entity/schema, CRUD endpoints, search & filter, and JSON/CSV export are all built and covered by Spock specs. See `.claude/specs/series_spec_*.md`.
- **Frontend**: only the types + API service layer exist (`frontend/src/types/`, `frontend/src/services/seriesApi.ts`). No UI components have been built yet — `SeriesList` (`.claude/specs/frontend_spec_002.md`) is the next piece of work, followed by the rest of the CRUD UI, search/filter UI, and export trigger.

## Tech stack (actual installed versions)

| Layer | Technology |
|-------|-----------|
| Backend | Java 25 toolchain, Spring Boot 4.0.0 |
| Frontend | TypeScript ~6.0, React 19.2, Vite 8.1 |
| Database | SQLite (local dev); PostgreSQL planned for production, no code changes needed (Spring Data JPA) |
| ORM | Spring Data JPA + Hibernate (community SQLite dialect) |
| Migrations | Flyway |
| Build (backend) | Gradle (wrapper included, Windows `gradlew.bat` only) |
| Build (frontend) | Vite 8, npm |
| Tests (backend) | Spock 2.4 (Groovy 5) |
| Tests (frontend) | Vitest 4, React Testing Library |

Full detail lives in `.claude/steering/tech.md`.

## Deep-dive references

Read these when working in the relevant area — don't duplicate their content here:

- `.claude/steering/product.md` — what the app does, who it's for, goals/non-goals
- `.claude/steering/tech.md` — full tech stack detail and rationale
- `.claude/steering/structure.md` — backend package layout, naming conventions, where tests live
- `.claude/steering/frontend_structure.md` — frontend directory layout and target component structure
- `.claude/steering/frontend_conventions.md` — frontend coding conventions (typing, API layer, styling, testing)
- `.claude/steering/ears_format.md` — the EARS requirement format all specs use
- `.claude/specs/` — feature specs (backend 001–004, frontend 001–002), each with acceptance criteria and TDD test cases

## Working conventions

- Specs are written in EARS format (`.claude/steering/ears_format.md`) with acceptance criteria and red/green TDD test cases. When adding a feature, write or update a spec in `.claude/specs/` first.
- Backend: business logic in `service/`, controllers stay thin, repositories are plain `JpaRepository` extensions. Tests are Spock specs colocated under `src/test/groovy/`, one `*Spec.groovy` per class under test.
- Frontend: all backend calls go through `frontend/src/services/seriesApi.ts` — no raw `axios`/`fetch` calls in components. Types live in `frontend/src/types/`. Components are typed function components; tests are colocated `*.test.tsx`/`*.test.ts` files run with Vitest.
- Use the `backend-dev` and `frontend-dev` subagents (`.claude/agents/`) for implementation work in their respective areas, and the `ears-spec` skill when drafting a new spec.

## Commands

```bash
# Backend (from backend/)
gradlew.bat bootRun        # start dev server on :8080
gradlew.bat test           # run Spock specs

# Frontend (from frontend/)
npm install
npm run dev                # dev server on :5173, proxies /api to :8080
npm test                   # Vitest, single run
```
