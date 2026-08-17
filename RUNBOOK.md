# Runbook: TV Series Tracker

Operational guide for running and developing the Series Tracker locally.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Java | 25 (matches Gradle toolchain in `build.gradle.kts`) | [adoptium.net](https://adoptium.net/) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| npm | bundled with Node | --- |
| Git | any | [git-scm.com](https://git-scm.com/) |

No database installation needed -- SQLite is bundled as a JDBC driver.

---

## Running the Backend Locally

### 1. Start the Spring Boot server

```bash
cd backend
gradlew.bat bootRun
```

The server starts at **http://localhost:8080**.

> Only the Windows wrapper (`gradlew.bat`) is present in this repo. If you need to run on macOS/Linux, generate the Unix wrapper script with `gradle wrapper` (requires a local Gradle install) or install Gradle directly and run `gradle bootRun`.

### 2. Verify it is running

```
GET http://localhost:8080/api/v1/series
```

Expected response:

```json
{ "data": [], "count": 0 }
```

### 3. API docs

There is no Swagger/OpenAPI UI wired up yet -- `springdoc-openapi` is not currently a dependency in `build.gradle.kts`. Use the [API Overview table in README.md](./README.md#api-overview) as the source of truth, or add `springdoc-openapi-starter-webmvc-ui` if you want interactive docs.

---

## Running the Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server starts at **http://localhost:5173** and proxies `/api` calls to the backend at `localhost:8080` (see `vite.config.ts`).

---

## Environment Variables

### Backend

The backend is configured via `backend/src/main/resources/application.yml`. No environment variables are required for local development -- defaults work out of the box.

| Property | Default | Description |
|----------|---------|-------------|
| `spring.datasource.url` | `jdbc:sqlite:./data/series.db` | Path to the SQLite database file |
| `spring.datasource.driver-class-name` | `org.sqlite.JDBC` | JDBC driver (do not change) |
| `spring.jpa.show-sql` | `true` | Print SQL queries to console |
| `spring.jpa.hibernate.ddl-auto` | `validate` | Schema validation -- Flyway manages DDL |
| `spring.flyway.enabled` | `true` | Run Flyway migrations on startup |

Override any property with a `SPRING_` prefixed environment variable:

```bash
# Override the database path
SPRING_DATASOURCE_URL=jdbc:sqlite:/absolute/path/to/my.db gradlew.bat bootRun
```

Or create `backend/src/main/resources/application-local.yml` and activate it:

```bash
SPRING_PROFILES_ACTIVE=local gradlew.bat bootRun
```

### Frontend

Create `frontend/.env.local` (not committed) to override Vite defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE` | `http://localhost:8080/api/v1` | API base URL used by `src/services/seriesApi.ts` |

---

## Database

### Location

The SQLite file is created on first startup at:

```
backend/data/series.db
```

This path is relative to the working directory. Always run Gradle from the `backend/` directory.

### Migrations

Flyway runs migrations automatically on startup from:

```
backend/src/main/resources/db/migration/
```

Migration files follow `V{version}__{description}.sql` naming.

| File | Description |
|------|-------------|
| `V001__create_series_table.sql` | Initial schema -- `series` table with all columns and indexes |

### Resetting the database

Delete the file and restart -- Flyway recreates the schema from scratch:

```bash
# Windows
del backend\data\series.db
```

Then run `gradlew.bat bootRun` again.

---

## Git Hooks

A root-level `package.json` sets up Husky + lint-staged:

```bash
npm install    # from repo root, once — installs husky/lint-staged and wires up git hooks
```

- **pre-commit**: runs `lint-staged`, which ESLints (`--fix`) any staged `frontend/src/**/*.{ts,tsx}` files. Requires `frontend/node_modules` to exist (`npm install` in `frontend/`).
- **pre-push**: runs the full backend Spock suite (`gradlew.bat test`) and frontend tests + lint (`npm test && npm run lint`).

Both hooks block the commit/push if anything fails. Fix the issue rather than bypassing with `--no-verify`.

## Running Tests

### Backend (Spock)

```bash
cd backend
gradlew.bat test
```

Tests use a separate SQLite database (`ddl-auto: create-drop`, see `backend/src/test/resources/application.yml`), fully isolated from the dev database.

Run a specific spec:

```bash
gradlew.bat test --tests "com.example.seriestracker.service.SeriesServiceSpec"
gradlew.bat test --tests "com.example.seriestracker.controller.SeriesControllerSpec"
```

View the HTML report:

```
backend/build/reports/tests/test/index.html
```

### Frontend

```bash
cd frontend
npm test            # single run (Vitest)
```

---

## Build for Production

### Backend JAR

```bash
cd backend
gradlew.bat bootJar
```

Output: `backend/build/libs/series-tracker-0.0.1-SNAPSHOT.jar`

Run it:

```bash
java -jar backend/build/libs/series-tracker-0.0.1-SNAPSHOT.jar
```

### Frontend bundle

```bash
cd frontend
npm run build
```

Output: `frontend/dist/` -- static bundle ready to serve.

---

## Common Tasks

### Add a series

```bash
curl -X POST http://localhost:8080/api/v1/series \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"The Office\", \"year\": 2005, \"genres\": \"Comedy\", \"totalSeasons\": 9}"
```

### Update viewing progress

```bash
curl -X PATCH http://localhost:8080/api/v1/series/{id} \
  -H "Content-Type: application/json" \
  -d "{\"currentSeason\": 3, \"currentEpisode\": 7}"
```

### Search series

```bash
curl "http://localhost:8080/api/v1/series/search?title=office&status=WATCHING"
```

### Export as JSON

```bash
curl "http://localhost:8080/api/v1/series/export?format=json"
```

### Export as CSV

```bash
curl "http://localhost:8080/api/v1/series/export?format=csv"
```

---

## Troubleshooting

**Port 8080 already in use**

```bash
netstat -ano | findstr :8080
taskkill /PID <pid> /F
```

**`Unable to open JDBC Connection` on startup**

The `data/` directory does not exist. Create it first:

```bash
mkdir backend\data
```

Then start the server again.

**Flyway migration error on startup**

Schema is out of sync. Reset the database:

```bash
del backend\data\series.db
gradlew.bat bootRun
```

**Migrations never run at all (no Flyway log lines on startup, straight to a Hibernate `Schema-validation: missing table` error)**

Spring Boot 4 split Flyway's autoconfiguration out of `spring-boot-autoconfigure` into its own artifact, `org.springframework.boot:spring-boot-flyway`. Having `org.flywaydb:flyway-core` on the classpath is not enough by itself — without the Boot integration module, the `Flyway` bean is never created and migrations silently never run (no error, no log output, nothing). `build.gradle.kts` depends on both; if this resurfaces, check that `spring-boot-flyway` wasn't dropped.

**Tests fail with database errors**

```bash
cd backend
gradlew.bat clean
gradlew.bat test
```

---

## CI/CD

There is no CI pipeline configured in this repo yet. If you set one up, it should at minimum:

1. Build backend: `gradlew.bat build`
2. Run backend tests: `gradlew.bat test`
3. Build frontend: `npm run build`
4. Run frontend tests: `npm test`
