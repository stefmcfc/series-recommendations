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
- Follow red/green TDD: write the failing Spock spec first, then implement. Specs live in `backend/src/test/groovy/uk/co/stefirby/seriestracker/{controller,service,model}/`, one `*Spec.groovy` per class under test.
- Keep controllers thin — business logic belongs in the service layer, not the controller.
- Use `@Transactional` on service methods that mutate data.
- Known gaps worth being aware of: no controller-level (`MockMvc`) tests exist yet for `/search` or `/export` (see `series_spec_003_search.md` / `series_spec_004_export.md`); only the Windows Gradle wrapper (`gradlew.bat`) is checked in.
- After checking off ACs in a `series_spec_*.md`/`tooling_spec_*.md` file, update its entry in `.claude/OUTSTANDING_SPECS.md` to match (or remove the entry entirely if every AC in the spec is now checked).

## Static-analysis / Sonar cleanup patterns

Learned resolving a full SonarQube pass (2026-08-25, see `chore/sonar-findings-cleanup`) — reuse these rather than re-deriving them:

- **Cognitive-complexity on a flat/nested sequence of independent guard-clause checks** (e.g. a `validate(...)`/field-copy method with a dozen `if (x != null) ...`): extract each independent check into its own well-named private method; the calling method becomes a straight-line sequence of calls. If one check genuinely depends on another's side effect (e.g. a `currentSeason` bound-check reading a `totalSeasons` value another branch may have just set), keep that call order — don't parallelize/reorder blindly.
- **Self-invocation of a `@Transactional` method from a sibling public method in the same class bypasses Spring's proxy** (`java:S6809`) even when both carry the same annotation. Fix: extract the shared body into a private, non-`@Transactional` helper that both public entry points call — don't reach for self-injection (`@Lazy` self-reference) unless propagation/isolation genuinely differs between the two.
- **A wide constructor on a class that's deliberately "one thing backing many endpoints/operations"** (e.g. a controller for a whole resource) is often not a real design smell — inventing an artificial grouping object purely to shrink the parameter count is the over-engineering CLAUDE.md warns against. `@SuppressWarnings("java:S107")` plus a one-line comment explaining the architectural reason is the right call there.
- **`.collect(Collectors.toList())` → `.toList()`** is only safe when the result is never mutated afterward (`.toList()` is unmodifiable) — check every call site's downstream usage before a bulk replace, don't assume.
- **Root-cause over per-site patching**: if the same nullable-return concern is flagged at several call sites of one shared method (e.g. `RestClient.body(Map.class)` can return `null`), fix it once at the source (normalize to an empty/default value there) rather than adding a null-check at each flagged call site — it also closes the gap at unflagged call sites that share the same risk.

## Commands

```bash
cd backend
gradlew.bat bootRun                                    # dev server on :8080
gradlew.bat test                                        # full Spock suite
gradlew.bat test --tests "uk.co.stefirby.seriestracker.service.SeriesServiceSpec"   # one spec
gradlew.bat build                                        # full build
```

Always verify your change by running the relevant Spock spec(s), not just by reading the code.
