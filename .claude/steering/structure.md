# Project Structure

## Current layout
```
series-recommendation/
├── .claude/
│   ├── agents/                 # Claude Code subagents
│   ├── skills/                  # Claude Code skills
│   ├── steering/                # AI assistant context (this directory)
│   └── specs/                   # Feature specs and requirements
├── backend/                    # Spring Boot application
├── frontend/                   # React + Vite application
├── CLAUDE.md                   # Root steering entrypoint
├── README.md
└── RUNBOOK.md
```

## Backend structure
```
backend/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/example/seriestracker/
│   │   │       ├── controller/        # REST endpoints (@RestController) — SeriesController
│   │   │       ├── service/           # Business logic (@Service) — SeriesService, SeriesSearchService, SeriesExportService
│   │   │       ├── repository/        # Spring Data JPA (@Repository) — SeriesRepository
│   │   │       ├── model/             # JPA entities (@Entity) — SeriesEntity, SeriesStatus, ValidSeries + SeriesValidator
│   │   │       ├── dto/               # API contracts — SeriesDto, ApiResponse, SeriesSearchCriteria, SeriesExportResponse
│   │   │       ├── exception/         # EntityNotFoundException, GlobalExceptionHandler
│   │   │       ├── config/            # CorsConfig (WebMvcConfigurer — /api/** CORS allow-list)
│   │   │       └── SeriesTrackerApplication.java  # Entry point
│   │   └── resources/
│   │       ├── application.yml        # Spring config (dev, SQLite)
│   │       └── db/
│   │           └── migration/         # SQL migration scripts (Flyway) — V001__create_series_table.sql
│   └── test/
│       ├── groovy/
│       │   └── com/example/seriestracker/
│       │       ├── controller/        # SeriesControllerSpec
│       │       ├── model/             # SeriesEntitySpec
│       │       ├── service/           # SeriesServiceSpec, SeriesSearchServiceSpec, SeriesExportServiceSpec
│       │       └── config/            # CorsConfigSpec
│       └── resources/
│           └── application.yml        # Test datasource config
├── gradle/
│   └── wrapper/                       # Gradle wrapper (checked in; Windows gradlew.bat only)
├── build.gradle.kts                   # Gradle build file
├── settings.gradle.kts                # Gradle project settings
└── .gitignore
```

A `config/` package now exists (`CorsConfig`, for CORS — see `tech.md`'s Notes section). `application-prod.yml` is still aspirational until a production deployment is actually set up.

## Frontend structure

What actually exists today:
```
frontend/
├── src/
│   ├── components/                    # 6 components, each a .tsx/.test.tsx/.module.css triplet
│   │   ├── SeriesList.tsx, AddSeriesForm.tsx, EditSeriesForm.tsx,
│   │   └── SeriesDetail.tsx, SearchFilter.tsx, ExportControls.tsx
│   ├── services/
│   │   ├── seriesApi.ts               # All backend API calls (axios)
│   │   └── __tests__/seriesApi.test.ts
│   ├── types/
│   │   ├── series.ts                  # Series, SeriesStatus, SearchCriteria, CreateSeriesRequest, UpdateSeriesRequest
│   │   └── api.ts                     # ApiResponse, ApiError, LoadingState, AsyncState
│   ├── App.tsx, App.test.tsx          # Orchestrator — wires every component above together
│   ├── index.css
│   ├── main.tsx                       # React entry point
│   └── test-setup.ts                  # Vitest + jest-dom setup
├── public/                            # favicon.svg, icons.svg
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
└── .gitignore
```

**Not yet created**: `src/pages/`, `src/hooks/`, `src/styles/`, `src/utils/` (all still deferred — no router, no need for a custom hook or util yet). See `.claude/steering/frontend_structure.md` for the per-component detail (which spec built what) and the target layout for what's still ahead.

## Naming conventions

### Backend (Java)
- **Packages**: `com.example.seriestracker.{feature}` (lowercase, reverse domain)
- **Classes**: `PascalCase` (e.g., `SeriesController`, `SeriesService`, `SeriesEntity`)
- **Files**: Match class name (e.g., `SeriesService.java`)
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Variables/Methods**: `camelCase`
- **DTOs**: Suffix with `Dto` or `Request`/`Response` (e.g., `SeriesDto`, `SeriesExportResponse`)
- **Specs**: `*Spec.groovy` (e.g., `SeriesServiceSpec.groovy`)

### Frontend (TypeScript/React)
- **Files**: `PascalCase.tsx` for components, `camelCase.ts` for utilities/services
- **Components**: `PascalCase` (e.g., `SeriesList.tsx`)
- **Functions/Variables**: `camelCase`
- **Types**: `PascalCase` (e.g., `Series`, `SearchCriteria`)
- **Test files**: `ComponentName.test.tsx` or `fileName.test.ts`, colocated with source (e.g. `services/__tests__/seriesApi.test.ts`)

## Where tests live

### Backend
- Colocated with source: `src/test/groovy/com/example/seriestracker/{controller,service,model}/ServiceNameSpec.groovy`
- Run with: `gradlew.bat test`

### Frontend
- Colocated with source: `src/services/__tests__/seriesApi.test.ts`, and (once built) `src/components/ComponentName.test.tsx`
- Run with: `npm test`

## Key directories

| Directory | Purpose |
|-----------|---------|
| `.claude/steering/` | AI assistant steering files (this file, `product.md`, `tech.md`, etc.) |
| `.claude/specs/` | Feature specifications and requirements |
| `.claude/agents/` | Claude Code subagents |
| `.claude/skills/` | Claude Code skills |
| `backend/src/main/java/` | Source code |
| `backend/src/test/groovy/` | Spock test specifications |
| `backend/src/main/resources/` | Config files, migrations |
| `frontend/src/` | React components, services, types |

## Database

- **SQLite** (local dev): file at `backend/data/series.db`, created on first run
- **Migrations**: `backend/src/main/resources/db/migration/V001__create_series_table.sql`
- **JPA Entities**: `backend/src/main/java/com/example/seriestracker/model/`

## Build artifacts

- **Backend JAR**: `backend/build/libs/series-tracker-*.jar`
- **Frontend build**: `frontend/dist/`

Both are git-ignored — see root `.gitignore` and `backend/.gitignore`.

## CI/CD

GitHub Actions runs on every push to `main` and every PR — see `.claude/steering/tech.md`'s CI/CD section for what it runs, and `RUNBOOK.md`'s Troubleshooting section for the dependency-version pitfalls that have broken it before.
