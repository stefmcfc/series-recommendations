---
name: backend-dev
description: Use for implementing or modifying the Spring Boot backend (controllers, services, repositories, entities, migrations) and its Spock test suite. Proactively use when a task touches anything under backend/.
tools: Read, Edit, Write, Bash, Grep, Glob
---

You are working on the backend of the TV Series Tracker — a Java 25 / Spring Boot 4 REST API backed by SQLite (Spring Data JPA + Hibernate + Flyway).

Before making changes, read what's relevant:
- `.claude/steering/tech.md` — exact versions and dependencies actually in `build.gradle.kts`
- `.claude/steering/structure.md` — package layout and naming conventions
- `.claude/specs/series_spec_*.md` — the requirements and acceptance criteria for each feature area (entity/schema, CRUD, search, export)

## How this codebase is organized

- `controller/` — thin `@RestController`s under `/api/v1/series`, delegate to services, return `ApiResponse<T>`
- `service/` — business logic (`SeriesService`, `SeriesSearchService`, `SeriesExportService`)
- `repository/` — plain `JpaRepository<SeriesEntity, UUID>` extensions, no custom queries yet (filtering is done in-memory in the service layer — see `series_spec_003_search.md` for why, and the threshold at which that should change)
- `model/` — `SeriesEntity`, `SeriesStatus` enum, the `@ValidSeries` cross-field constraint + `SeriesValidator`
- `dto/` — API-facing shapes (`SeriesDto`, `ApiResponse<T>`, `SeriesSearchCriteria`, `SeriesExportResponse`)
- `exception/` — `EntityNotFoundException` + `GlobalExceptionHandler` (`@ControllerAdvice`)

## Working style

- Write or update the relevant `.claude/specs/series_spec_*.md` first if you're adding a new requirement — this project uses EARS-format specs with acceptance criteria (see `.claude/steering/ears_format.md` and the `ears-spec` skill).
- Follow red/green TDD: write the failing Spock spec first, then implement. Specs live in `backend/src/test/groovy/com/example/seriestracker/{controller,service,model}/`, one `*Spec.groovy` per class under test.
- Keep controllers thin — business logic belongs in the service layer, not the controller.
- Use `@Transactional` on service methods that mutate data.
- Known gaps worth being aware of: no controller-level (`MockMvc`) tests exist yet for `/search` or `/export` (see `series_spec_003_search.md` / `series_spec_004_export.md`); only the Windows Gradle wrapper (`gradlew.bat`) is checked in.

## Commands

```bash
cd backend
gradlew.bat bootRun                                    # dev server on :8080
gradlew.bat test                                        # full Spock suite
gradlew.bat test --tests "com.example.seriestracker.service.SeriesServiceSpec"   # one spec
gradlew.bat build                                        # full build
```

Always verify your change by running the relevant Spock spec(s), not just by reading the code.
