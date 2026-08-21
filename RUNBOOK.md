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

The backend is configured via `backend/src/main/resources/application.yml`. No environment variables are required to run the app itself -- defaults work out of the box. The exceptions are `app.omdb.api-key` and `app.tmdb.api-key`: without them, everything else still works, but any endpoint that needs to call out to that API fails with `502` once it actually does so:

- `app.omdb.api-key` gates only the best-effort `imdbRating`/`rottenTomatoesRating` enrichment step inside `GET /api/v1/series/lookup/resolve-tmdb` -- per `series_spec_017_tmdb_primary_lookup.md`, TMDB is now the sole search/detail source, so an unset or failing OMDb key never fails that request; it just leaves `imdbRating`/`rottenTomatoesRating` `null` on the result (no `502`). `GET /api/v1/series/lookup` and `GET /api/v1/series/lookup/search` (OMDb-primary search/lookup) no longer exist (`404`). It's also consulted (same best-effort, non-fatal posture) by `POST /api/v1/series/{id}/refresh` and the `POST`/`GET /api/v1/series/refresh-all` bulk job (`series_spec_018_series_refresh.md`) -- an unset/failing key there just leaves `imdbRating`/`rottenTomatoesRating` unchanged and `omdbRefreshed: false` on the result, never fails the refresh.
- `app.tmdb.api-key` gates `GET /api/v1/series/recommendations`, `GET /api/v1/series/lookup/search-tmdb`, and `GET /api/v1/series/lookup/resolve-tmdb` itself (`/recommendations` specifically only fails once there's at least one `COMPLETED` series with a resolvable `imdbId` to source from; with none yet, it returns `200` with an empty list regardless of whether the TMDB key is set). It's also consulted (same best-effort, non-fatal posture) by `POST /api/v1/series/{id}/refresh` and the bulk `POST`/`GET /api/v1/series/refresh-all` job (`series_spec_018_series_refresh.md`) -- an unset/failing key there just leaves `totalSeasons`/`totalEpisodes`/`tmdbRating`/`tmdbVoteCount`/`productionStatus`/`keywords` unchanged and `tmdbRefreshed: false` on the result, never fails the refresh (single or bulk) (`keywords` reconciliation added by `series_spec_019_keyword_tracking.md`). `GET /api/v1/series/keywords` never calls TMDB itself -- it only aggregates already-stored keyword data -- so it works the same whether or not the key is set.

| Property | Default | Description |
|----------|---------|-------------|
| `spring.datasource.url` | `jdbc:sqlite:./data/series.db` | Path to the SQLite database file |
| `spring.datasource.driver-class-name` | `org.sqlite.JDBC` | JDBC driver (do not change) |
| `spring.jpa.show-sql` | `true` | Print SQL queries to console |
| `spring.jpa.hibernate.ddl-auto` | `validate` | Schema validation -- Flyway manages DDL |
| `spring.flyway.enabled` | `true` | Run Flyway migrations on startup |
| `spring.http.clients.connect-timeout` | `5s` | Bounded connect timeout applied to outbound HTTP clients (OMDb and TMDB) |
| `spring.http.clients.read-timeout` | `10s` | Bounded read timeout applied to outbound HTTP clients (OMDb and TMDB) |
| `app.cors.allowed-origins` | `http://localhost:5173` | Origin(s) allowed to call `/api/**` cross-origin (never a wildcard) — see `uk.co.stefirby.seriestracker.config.CorsConfig` |
| `app.omdb.api-key` | *(none)* | API key for the [OMDb API](https://www.omdbapi.com/) (free tier, registration required) — see the endpoints it gates above. **No default** — must be supplied via the `APP_OMDB_API_KEY` env var. The rest of the app runs fine without it; only the gated endpoints fail with `502 Bad Gateway` until it's set. Never logged or included in any response body — see `uk.co.stefirby.seriestracker.client.OmdbClient`. |
| `app.omdb.base-url` | `https://www.omdbapi.com/` | Base URL for the OMDb API, overridable via `APP_OMDB_BASE_URL` (e.g. to point at a test double) |
| `app.tmdb.api-key` | *(none)* | API key for the [TMDB API](https://www.themoviedb.org/documentation/api) (free, non-commercial use, registration required) — see the endpoints it gates above. **No default** — must be supplied via the `APP_TMDB_API_KEY` env var. The rest of the app runs fine without it; the gated endpoints fail with `502 Bad Gateway` once they actually need to call out (`/recommendations` specifically only once it has a `COMPLETED` series with an `imdbId` to source from — an empty "watched" pool short-circuits with `200`/empty before any TMDB call is attempted). Never logged or included in any response body — see `uk.co.stefirby.seriestracker.client.TmdbClient`. |
| `app.tmdb.base-url` | `https://api.themoviedb.org/3/` | Base URL for the TMDB API, overridable via `APP_TMDB_BASE_URL` (e.g. to point at a test double) |
| `app.tmdb.refresh-delay-ms` | `250` | Fixed delay (milliseconds) between items during a bulk refresh (`POST /api/v1/series/refresh-all`), sized to stay well under TMDB's free-tier rate limit (~40 requests/10s) for a personal collection's realistic size -- see `series_spec_018_series_refresh.md`. Overridable via `APP_TMDB_REFRESH_DELAY_MS`. |

Override any property with a `SPRING_` prefixed environment variable (or, for the `app.*` properties above, the plain `APP_`-prefixed equivalent — Spring's relaxed env-var binding applies to any property, not just `spring.*`):

```bash
# Override the database path
SPRING_DATASOURCE_URL=jdbc:sqlite:/absolute/path/to/my.db gradlew.bat bootRun

# Enable imdbRating/rottenTomatoesRating enrichment on GET /api/v1/series/lookup/resolve-tmdb
# by supplying an OMDb API key
APP_OMDB_API_KEY=your-omdb-api-key gradlew.bat bootRun

# Enable GET /api/v1/series/recommendations by supplying a TMDB API key
APP_TMDB_API_KEY=your-tmdb-api-key gradlew.bat bootRun
```

Or, for a persistent local setup that doesn't need re-exporting every session: copy `backend/application-local.yml.example` to `backend/application-local.yml` (gitignored — never commit it) and fill in real values:

```yaml
app:
  omdb:
    api-key: your-omdb-api-key-here
  tmdb:
    api-key: your-tmdb-api-key-here
```

Loaded automatically on startup via `spring.config.import: optional:file:./application-local.yml` in `application.yml` — no profile flag needed, and no risk of it ending up in a build artifact since it lives outside `src/`, not in `src/main/resources`.

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
| `V002__add_poster_url_to_series.sql` | Adds `poster_url` to `series` |
| `V003__add_imdb_id_to_series.sql` | Adds `imdb_id` to `series` (nullable, indexed) |
| `V004__create_ignored_series_table.sql` | Creates the `ignored_series` table (dismissed recommendations) |

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
gradlew.bat test --tests "uk.co.stefirby.seriestracker.service.SeriesServiceSpec"
gradlew.bat test --tests "uk.co.stefirby.seriestracker.controller.SeriesControllerSpec"
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

### Get recommendations

```bash
curl "http://localhost:8080/api/v1/series/recommendations?limit=10"
```

### Ignore (dismiss) a recommendation

```bash
curl -X POST http://localhost:8080/api/v1/series/ignored \
  -H "Content-Type: application/json" \
  -d "{\"imdbId\": \"tt1234567\", \"title\": \"Some Show\", \"reason\": \"Not interested\"}"
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

**`NoSuchMethodError` in `SQLiteDialect` on startup (Hibernate `SessionFactory` fails to build)**

`hibernate-community-dialects` is binary-incompatible with the `hibernate-core` version actually in use. This happens if something in `build.gradle.kts` pins `hibernate-community-dialects` to an explicit version — an explicit version always wins over Spring Boot's own BOM recommendation (standard Maven/Spring dependency-management precedence), and Spring Boot pairs `hibernate-community-dialects` with a specific `hibernate-core` version internally; a manually-pinned version (e.g. from a Dependabot bump) can easily drift out of sync with whatever `hibernate-core` the BOM resolves. Fix: don't pin a version at all —

```kotlin
implementation("org.hibernate.orm:hibernate-community-dialects")
```

— and let Spring Boot's dependency management choose it. Verify with `gradlew.bat dependencies --configuration runtimeClasspath | grep hibernate-community` that the resolved version matches `hibernate-core`'s version exactly.

**Tests fail with database errors**

```bash
cd backend
gradlew.bat clean
gradlew.bat test
```

**Frontend showed "Failed to load series. Please try again." in a real browser (not Vitest) — fixed**

This was a real, currently-blocking CORS gap (confirmed both with and without VPN — not network-related), tracked as `TOOLING-001-AC-16` in `tooling_spec_001_code_quality_security.md`. It's now fixed: `uk.co.stefirby.seriestracker.config.CorsConfig` (a `WebMvcConfigurer` bean) allows cross-origin requests to `/api/**` from the origin(s) configured in `app.cors.allowed-origins` (default `http://localhost:5173`, see the Environment Variables section above), restricted to the `GET`/`POST`/`PATCH`/`DELETE` methods and `Content-Type` header the frontend actually uses — never a wildcard `*`.

No `frontend/.env.local` proxy workaround is needed anymore: `seriesApi.ts` can call `http://localhost:8080/api/v1` directly from a browser tab serving the frontend on `http://localhost:5173`, and the response will include a matching `Access-Control-Allow-Origin` header. If you deploy the frontend from a different origin, add it to `app.cors.allowed-origins` (comma-separated) or override via `APP_CORS_ALLOWED_ORIGINS` — don't loosen this to a wildcard.

---

## CI/CD

GitHub Actions runs on every push to `main` and every PR (`.github/workflows/ci.yml`, plus `codeql.yml` for security scanning):

- **backend**: `gradle check` (tests, JaCoCo coverage gate, SpotBugs), then `gradle build -x test`. Uses `gradle/actions/setup-gradle` with `gradle-version: wrapper` so CI always matches the Gradle version pinned in `gradle/wrapper/gradle-wrapper.properties` — don't let these drift apart, a prior mismatch (local 9.4.1 vs CI resolving to latest) caused CI-only failures from a stricter task-validation rule that only exists in newer Gradle.
- **frontend**: `npm ci`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm audit --audit-level=high`. Requires `frontend/.npmrc` (`legacy-peer-deps=true`) — `eslint-plugin-jsx-a11y`'s peer range doesn't yet cover the `eslint ^10` this project runs, so a clean `npm ci` fails without it.
- **secrets-scan**: gitleaks over the full checkout.
