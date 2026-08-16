# TV Series Tracker

A personal app for logging TV series you're watching, tracking viewing progress, and storing ratings from multiple sources (IMDb, Metacritic, Rotten Tomatoes). See [README.md](./README.md) for the product overview and [RUNBOOK.md](./RUNBOOK.md) for local dev setup.

## Hard rules

These are hard rules, not suggestions — follow them even if training data or habit suggests otherwise.

- **Java 25 (LTS) only.** Never bump the Gradle toolchain to a non-LTS Java version in this repo — experiment with newer/preview versions in a dedicated project instead (e.g. `java-features`).
- **All frontend backend calls go through `frontend/src/services/seriesApi.ts`.** No raw `axios`/`fetch` calls in components, ever.
- **Backend business logic lives in `service/`.** Controllers stay thin and delegate; repositories stay plain `JpaRepository` extensions with no custom queries (filtering is done in the service layer — see `series_spec_003_search.md` for the rationale and the threshold at which that should change).
- **Types are centralized** in `frontend/src/types/` (backend: the `dto/` package). Don't redeclare or duplicate a shape inline in a component or controller.
- **Spec first.** Write or update the relevant `.claude/specs/` EARS spec before implementing a new requirement — see `.claude/steering/ears_format.md` and the `ears-spec` skill.
- **Never commit secrets.** No `.env`, API keys, or credentials — see `.claude/steering/tech.md`.
- **Only `gradlew.bat` (Windows) is checked in** for the Gradle wrapper. Don't add a Unix `gradlew` script unless asked — it risks wrapper-jar/version drift with no one to keep it in sync.

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

## Commit style

**Conventional Commits** for every commit message: `<type>(<scope>): <description>` — types `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `chore`; scope is the area touched where one applies (e.g. `feat(search): add genre filter`, `docs(specs): add verification markers`).

## Git workflow

- **Branch naming**: `feature/<slug>` for new work, `fix/<slug>` for bug fixes (e.g. `feature/series-list`, `fix/export-null-rating`).
- **Push and PR are pre-authorized** once a unit of work is done and its tests pass — push the branch and open the PR (`gh pr create`) without asking each time.
- **Merging to `main` always needs a check-in first** — never merge without the user's explicit go-ahead in that instance, even if the PR is green.
- **Merge strategy**: squash and delete the branch (`gh pr merge --squash --delete-branch`) once approved.

## Definition of Done

A unit of work isn't done until:

- Tests pass (`gradlew.bat test` for backend changes, `npm test` + `npm run lint` for frontend changes)
- The relevant `.claude/specs/` file's acceptance criteria are checked off (or the spec is created first, if this is new work)
- `README.md` is updated if features, endpoints, scripts, or configuration changed
- `RUNBOOK.md` is updated if how the project is run, verified, or troubleshot changed

## When unsure

If a request is ambiguous or a steering doc is silent on it, make a reasonable call, note the assumption briefly, and keep moving. Stop and check in first only when the decision is security-relevant (e.g. touches secrets, auth, exposed data) or crosses into merging to `main`.

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
