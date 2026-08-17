# Tech Stack

This reflects what's actually declared in `backend/build.gradle.kts` and `frontend/package.json` — check those files directly if this drifts.

## Language / Runtime

### Backend
- **Java 25** toolchain (`build.gradle.kts` → `java.toolchain.languageVersion`)
- **Spring Boot 4.1.0**

### Frontend
- **TypeScript** ~6.0.2
- **React** 19.2.8
- **Vite** 8.2.1

## Framework

### Backend
- **Spring Boot 4**: REST API, dependency injection, data persistence
  - `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-starter-validation`
- **Spring Data JPA**: ORM layer for database operations
- **Hibernate Community Dialects** (`hibernate-community-dialects`): provides the SQLite dialect

### Frontend
- **React 19**: Component-based UI
- **axios**: HTTP client for backend calls (`frontend/src/services/seriesApi.ts`)
- No router or CSS framework is installed yet — add `react-router` / Tailwind if/when the UI spec calls for it.

## Database
**SQLite** (local development) — `org.xerial:sqlite-jdbc` + `hibernate-community-dialects` for the SQLite Hibernate dialect. PostgreSQL is the intended production target (no code changes expected, per Spring Data JPA), but not yet configured anywhere in this repo.

## Build Tools

### Backend
- **Gradle** via the wrapper. Only `gradlew.bat` (Windows) is checked in — there is no Unix `gradlew` script yet. Generate one with `gradle wrapper` if Unix/macOS support is needed.

### Frontend
- **Vite**: Dev server, production build, asset bundling
- **npm**: Package manager

## Testing

### Backend
- **Spock 2.4** (`spock-core`, `spock-spring`) on **Groovy 5.1**
- **JUnit Platform**: test runner (`useJUnitPlatform()` in `build.gradle.kts`)
- Specs live in `src/test/groovy/com/example/seriestracker/{controller,service,model}/`

### Frontend
- **Vitest 4.1** (Vite-native)
- **React Testing Library 16** + **@testing-library/user-event**
- **jsdom** as the test environment

## API Documentation
Not currently wired up. `springdoc-openapi` is **not** a dependency in `build.gradle.kts` — there is no `/swagger-ui.html` available today despite what older docs may say. Add `springdoc-openapi-starter-webmvc-ui` if interactive API docs are wanted.

## CI/CD
GitHub Actions (`.github/workflows/ci.yml`, `codeql.yml`) runs on every push to `main` and every PR — backend (`gradle check` + `gradle build -x test`), frontend (lint, format check, test, build, audit), and a gitleaks secrets scan. See `RUNBOOK.md`'s CI/CD and Troubleshooting sections for the specific commands and the dependency-version pitfalls that have broken it before (Gradle wrapper/CI version drift, `eslint-plugin-jsx-a11y` vs `eslint 10`, `hibernate-community-dialects` pinning).

## Common Commands

```bash
# Backend (run from backend/)
gradlew.bat clean build        # Build project
gradlew.bat test               # Run Spock tests
gradlew.bat bootRun            # Start Spring Boot dev server (localhost:8080)
gradlew.bat bootJar            # Package for production

# Frontend (run from frontend/)
npm install                    # Install dependencies
npm run dev                    # Vite dev server (localhost:5173)
npm run build                  # Production build
npm run preview                # Preview production build
npm test                       # Run Vitest (single run)
npm run test:watch             # Watch mode
npm run lint                   # ESLint
```

## Secrets

Nothing in this app requires a secret today (no external API calls, no auth — see `product.md`'s non-goals), but the rule is stated now so it's already in place if that changes (e.g. a future rating-source integration needing an API key):

- Never commit `.env`, API keys, or credentials. Both are already git-ignored (`.env` and `.env.local` in the root `.gitignore`).
- If a variable needs documenting for other developers, add it to a checked-in `.env.example` with a placeholder value, not the real one.
- Never override `.gitignore` with `git add -f` on anything matching `.env*`, build output, or `node_modules`.

## Notes

- **Frontend-Backend Communication**: Vite dev server proxies `/api` calls to `localhost:8080` (`frontend/vite.config.ts`); the axios client in `seriesApi.ts` also reads `VITE_API_BASE` directly and falls back to `http://localhost:8080/api/v1`.
- **CORS**: Not yet configured on the Spring Boot side — needed if the frontend calls the backend directly instead of through the Vite proxy (e.g. in production).
- **Environment Variables**: Backend uses `application.yml` + `SPRING_`-prefixed env var overrides; frontend uses `.env.local` (Vite `VITE_` prefix).
- **Database Migrations**: Flyway is enabled and required — see `backend/src/main/resources/db/migration/`.
