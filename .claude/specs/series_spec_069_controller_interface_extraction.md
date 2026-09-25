# Series Spec 069: Controller Interface Extraction for OpenAPI Annotations

**Status**: Implemented
**Priority**: P4 (internal code organization — no behavior change to any endpoint)
**Depends on**: `series_spec_067_openapi_annotation_pass.md` (the `@Operation`/`@Parameter` annotations this spec relocates must already exist)
**Area**: Backend (all 9 `@RestController` classes under `backend/src/main/java/uk/co/stefirby/seriestracker/controller/`, plus 9 new sibling `*Api` interfaces in the same package — no DTO/service/repository changes)

## Overview

`series_spec_067` ported `API.md`'s prose into `@Operation`/`@Parameter` annotations directly on
the 9 controller classes. That was the right first step, but it visibly bulked up the controllers —
`SeriesController.java` alone gained ~60 lines of pure annotation text with zero behavior change.
The user's next planned step (real example request/response bodies via `@ApiResponse`/`@Content`/
`@ExampleObject`) is the noisiest annotation surface springdoc offers — multi-line JSON example
blocks per status code, per endpoint. Landing that directly on the existing controllers would make
them substantially harder to read as *implementations* (constructor, delegation to the service
layer) buried under growing blocks of pure API-contract text.

This spec splits each controller into two files: a new `<ControllerName>Api` interface carrying the
Spring MVC mapping annotations (`@RequestMapping`/`@GetMapping`/etc) and every OpenAPI annotation
(`@Operation`/`@Parameter`, and later `@ApiResponse`/`@ExampleObject`), and the existing
`@RestController` class, now `implements` that interface with clean `@Override` methods containing
only the actual delegation-to-service logic. Spring MVC's handler mapping and springdoc's own
annotation scanning both resolve annotations through an implemented interface — this is a
well-established pattern for exactly this problem, not a novel technique — but it has not been used
anywhere in this codebase before (confirmed: no `interface`/`implements` anywhere under
`controller/` today, and `.claude/steering/structure.md` documents controllers as plain classes
only), so this spec proves it out on one controller before committing the pattern to all 9.

## Design Decisions

- **Naming: `<ControllerName>Api`, same package.** E.g. `SeriesKeywordController` →
  `SeriesKeywordControllerApi`. Colocated in `controller/` alongside its implementation, not a new
  subpackage — simplest, and this stays a flat, manageable 18 files (9 controllers + 9 interfaces)
  rather than introducing a second, unreviewed structural decision riding along with this one.
- **What moves to the interface**: the class-level `@RequestMapping(basePath)`, every method's
  `@GetMapping`/`@PostMapping`/etc mapping annotation, every `@Operation`/`@Parameter` (and, later,
  `@ApiResponse`/`@ExampleObject`) annotation, and the method signature itself — including Spring
  MVC parameter annotations (`@RequestParam`/`@PathVariable`/`@RequestBody`) and, where used, the
  Swagger-level `@io.swagger.v3.oas.annotations.parameters.RequestBody(description = ...)` on a
  body parameter (`SeriesRefreshController.refreshAll`, `FilterProfileController.create`, both from
  `series_spec_067`) — as abstract methods, no bodies.
- **What stays on the implementing class**: `@RestController`, `implements <Name>Api`, the
  constructor and its injected fields, `@Override` on every method with its actual body (unchanged
  delegation to the service layer), and any class-level Javadoc that documents *implementation*
  history/design decisions rather than the API contract itself (e.g. `SeriesKeywordController`'s
  current class comment citing `TOOLING-002-AC-13/14`/`series_spec_047`/`series_spec_051` — that's
  about why this controller exists and stays thin, not what the endpoint does, so it stays with the
  implementation, not the interface).
- **No behavior change.** Same guarantee as `series_spec_067` — every existing Spock spec for these
  controllers (both the original behavior specs and `series_spec_067`'s new `*OpenApiSpec` ones)
  must continue passing unmodified, proving both that endpoints behave identically and that
  springdoc still resolves the relocated annotations correctly through the interface.
- **A pilot on one controller first, with an explicit stop-and-review checkpoint, per the user's own
  request.** Requirement 1 covers `SeriesKeywordController` only — a representative middle-sized
  controller (73 lines, one endpoint, `@Operation` + 5 `@Parameter`s, no request body) chosen because
  it's substantial enough to exercise the full pattern without the size/complexity of
  `SeriesController` (295 lines) or `SeriesRecommendationController` (152 lines, 19 parameters on
  one method) making a first attempt harder to review. **Whoever implements this spec must stop
  after Requirement 1 and get the user's explicit review and go-ahead before starting Requirement
  2** — this validates the mechanical pattern (does Spring MVC/springdoc actually resolve
  annotations through the interface cleanly in this app's specific Spring Boot 4.1 setup, not just
  in general documentation) and the naming/structure choices above, while the cost of getting
  something wrong is one file pair, not nine.

---

## Requirement 1: Pilot — extract `SeriesKeywordControllerApi`

**User story**: As a developer, I want to validate the controller-interface pattern on one
representative controller before committing to all 9, so a Spring MVC/springdoc incompatibility or
a naming/structure choice worth changing is caught on one file pair, not after nine are already
split.

### SERIES-069-AC-01 [AUTO]
**Statement**: A new interface `SeriesKeywordControllerApi` shall exist in
`uk.co.stefirby.seriestracker.controller`, declaring `@RequestMapping("/api/v1/series")` at the
interface level and an abstract `keywords(...)` method carrying `@GetMapping("/keywords")`,
`@Operation`, and all 5 `@Parameter` annotations relocated **verbatim** (same summary/description
text, not reworded) from the current `SeriesKeywordController`. `SeriesKeywordController` shall be
changed to `implements SeriesKeywordControllerApi`, keep its `@RestController` annotation, and have
its `keywords` method annotated `@Override` with every Spring MVC and Swagger annotation removed
from the implementation (inherited via the interface). The existing `SeriesKeywordControllerSpec`
(behavior) and `SeriesKeywordControllerOpenApiSpec` (`series_spec_067`'s OpenAPI-annotation spec)
shall both continue passing unmodified.

**Rationale**: Proves the split preserves both runtime behavior (existing behavior spec still
passes) and the generated OpenAPI documentation (existing annotation spec still passes) in one
concrete instance before committing the pattern more broadly.

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesKeywordController.java`
(current implementation, 73 lines, to be split); new
`backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesKeywordControllerApi.java`;
existing `backend/src/test/groovy/uk/co/stefirby/seriestracker/controller/SeriesKeywordControllerSpec.groovy`
and `SeriesKeywordControllerOpenApiSpec.groovy`, both unmodified.

**Test Case (Red)**: run the two existing spec files first, confirming they pass against the
current, pre-split `SeriesKeywordController` — this establishes the baseline the split must not
break. (There is no new test to write "red" for this AC — the existing specs already cover both
behavior and annotation presence; the split itself is what's being tested.)

**Test Case (Green)**: after the split, re-run both spec files unmodified — both still pass.
Additionally (this AC's real proof, not covered by MockMvc alone): with the app running, `GET
/api/v1/series/keywords` still returns the same shape it did before, and `/v3/api-docs`'s entry for
that path still carries the same `@Operation` summary/description and all 5 parameter descriptions,
confirming springdoc resolved them through the interface correctly.

---

### SERIES-069-AC-02 [MANUAL]
**Statement**: With the application running, a manual check shall confirm `GET
/api/v1/series/keywords` responds identically to its pre-split behavior, and `/v3/api-docs`'s
generated entry for it is unchanged (same `@Operation` summary/description, same 5 parameter
descriptions) — the concrete, live proof that Spring MVC's handler mapping and springdoc's
annotation scanning both correctly resolve annotations declared on an interface a controller
`implements`, in this app's actual Spring Boot 4.1 / Spring Framework combination, not just
according to general framework documentation.

**Rationale**: This mechanism is well-documented as a general Spring MVC/springdoc pattern, but has
never been exercised in this codebase — a compile-time-only check (the code compiles, tests pass
under MockMvc) doesn't fully rule out a subtler runtime dispatch issue. Worth the extra few minutes
before committing the pattern to 8 more controllers.

**References**: Live app instance (`gradlew.bat bootRun` from `backend/`); `/v3/api-docs`,
`/swagger-ui.html`.

**How verified**: start the backend, `curl http://localhost:8080/api/v1/series/keywords` (confirm
`200` and the expected `NameStatDto[]` shape), then `curl http://localhost:8080/v3/api-docs | grep`
for the `keywords` path's `@Operation` description and each of the 5 parameter names/descriptions,
comparing against what was present before the split (capture a before/after diff of just that path's
JSON fragment if there's any doubt).

---

## ⏸ CHECKPOINT — stop here

**Do not begin Requirement 2 in the same implementation pass as Requirement 1.** Once
`SERIES-069-AC-01`/`AC-02` are both green and verified, stop, commit/push the pilot on its own (or
present the diff for review before committing — whichever the user prefers in the moment), and wait
for the user's explicit review and go-ahead. They may want to adjust the interface naming, the
package placement, the Javadoc split between interface and implementation, or reject the pattern
entirely based on how the pilot actually reads — all of which are far cheaper to change on one file
pair than on nine. Only proceed to Requirement 2 once that go-ahead is given.

---

## Requirement 2: Roll out to the remaining 8 controllers (blocked on Requirement 1's review)

**User story**: As a developer, now that the pattern is proven and approved on one controller, I
want the same split applied consistently to every other controller, so the whole `controller/`
package follows one convention rather than a mix of split and unsplit files.

Each AC below applies the exact same treatment `SERIES-069-AC-01` established — relocate mapping +
`@Operation`/`@Parameter`/Swagger-`@RequestBody` annotations and method signatures verbatim to a new
`<Name>Api` interface, `implements` it from the existing class, `@Override` every method, keep
existing Spock specs (both behavior and `series_spec_067`'s `*OpenApiSpec` ones) passing unmodified
— applied per controller, not re-derived from scratch per AC.

### SERIES-069-AC-03 [AUTO]: `SeriesController` → `SeriesControllerApi`
**Statement**: Same treatment as `AC-01`, applied to `SeriesController` (10 methods: `create`,
`getAll`, `getById`, `update`, `delete`, `ignore`, `search`, `export`, `importSeries`,
`importStatus` — the largest controller, 295 lines, no request-body Swagger annotations to migrate
beyond the standard Spring `@RequestBody` on `create`/`update`/`ignore`).
**References**: `SeriesController.java`; `SeriesControllerSpec.groovy`, `SeriesControllerOpenApiSpec.groovy`.

### SERIES-069-AC-04 [AUTO]: `SeriesGenreController` → `SeriesGenreControllerApi`
**Statement**: Same treatment, applied to `SeriesGenreController` (`genres`, `genreStats`).
**References**: `SeriesGenreController.java`; `SeriesGenreControllerSpec.groovy`, `SeriesGenreControllerOpenApiSpec.groovy`.

### SERIES-069-AC-05 [AUTO]: `SeriesLookupController` → `SeriesLookupControllerApi`
**Statement**: Same treatment, applied to `SeriesLookupController` (`lookupSearchTmdb`,
`lookupResolveTmdb` — the smallest controller, 51 lines).
**References**: `SeriesLookupController.java`; `SeriesLookupControllerSpec.groovy`, `SeriesLookupControllerOpenApiSpec.groovy`.

### SERIES-069-AC-06 [AUTO]: `SeriesOriginCountryController` → `SeriesOriginCountryControllerApi`
**Statement**: Same treatment, applied to `SeriesOriginCountryController` (`originCountryStats`).
**References**: `SeriesOriginCountryController.java`; `SeriesOriginCountryControllerSpec.groovy`, `SeriesOriginCountryControllerOpenApiSpec.groovy`.

### SERIES-069-AC-07 [AUTO]: `SeriesRecommendationController` → `SeriesRecommendationControllerApi`
**Statement**: Same treatment, applied to `SeriesRecommendationController` (`recommendations` — 19
parameters, the single largest annotation surface in the codebase — plus
`recommendationKeywords`/`recommendationDetails`). Given the parameter count, take particular care
that every `@Parameter` is relocated to the exact same position in the interface method's parameter
list as the class method today, so no annotation silently attaches to the wrong parameter.
**References**: `SeriesRecommendationController.java`; `SeriesRecommendationControllerSpec.groovy` (and any sibling behavior specs), `SeriesRecommendationControllerOpenApiSpec.groovy`.

### SERIES-069-AC-08 [AUTO]: `SeriesRefreshController` → `SeriesRefreshControllerApi`
**Statement**: Same treatment, applied to `SeriesRefreshController` (`refresh`,
`acknowledgeNewContent`, `refreshAll`, `refreshAllStatus`) — including relocating `refreshAll`'s
Swagger-level `@io.swagger.v3.oas.annotations.parameters.RequestBody(description = ...)` on its
`RefreshAllOptions options` parameter to the interface.
**References**: `SeriesRefreshController.java`; `SeriesRefreshControllerSpec.groovy`, `SeriesWatchProviderRefreshOpenApiSpec.groovy`.

### SERIES-069-AC-09 [AUTO]: `SeriesWatchProviderController` → `SeriesWatchProviderControllerApi`
**Statement**: Same treatment, applied to `SeriesWatchProviderController` (`watchProviders`).
**References**: `SeriesWatchProviderController.java`; `SeriesWatchProviderControllerSpec.groovy`, `SeriesWatchProviderRefreshOpenApiSpec.groovy`.

### SERIES-069-AC-10 [AUTO]: `FilterProfileController` → `FilterProfileControllerApi`
**Statement**: Same treatment, applied to `FilterProfileController` (`list`, `create`, `update`,
`delete`) — including relocating `create`'s Swagger-level `@RequestBody(description = ...)` on its
`FilterProfileDto dto` parameter to the interface.
**References**: `FilterProfileController.java`; `FilterProfileControllerSpec.groovy`, `FilterProfileControllerOpenApiSpec.groovy`.

### SERIES-069-AC-11 [MANUAL]
**Statement**: With the application running, a final full-app manual check shall confirm
`/v3/api-docs` still contains every path/operation/parameter it did before this spec started (a
before/after diff of the full generated spec, not just spot-checked paths), and `/swagger-ui.html`
still renders and remains navigable end-to-end.

**References**: Live app instance; `/v3/api-docs`, `/swagger-ui.html`.

**How verified**: capture `/v3/api-docs` output before starting Requirement 2 and again once all 8
remaining controllers are split; diff the two (should be identical, modulo any incidental field
ordering springdoc doesn't guarantee — confirm any diff found is genuinely incidental, not a dropped
annotation, before treating this AC as satisfied).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| The annotations this spec relocates (not rewrites) | `series_spec_067_openapi_annotation_pass.md` |
| The dependency both specs need to have any visible effect | `series_spec_066_openapi_swagger_dependency.md` |
| Confirmed absence of any existing interface-per-controller precedent | `.claude/steering/structure.md` (documents controllers as plain classes) |
| The 9 controllers this spec splits | `.claude/steering/structure.md`'s backend controller listing |
| Motivating future work this spec is groundwork for (not itself in scope here) | Real example request/response bodies via `@ApiResponse`/`@Content`/`@ExampleObject` — raised in conversation, not yet its own spec |

---

## Acceptance Criteria Summary

- [x] SERIES-069-AC-01: `SeriesKeywordController` → `SeriesKeywordControllerApi` pilot split, existing specs pass unmodified
- [x] SERIES-069-AC-02 [MANUAL]: live verification the pilot's endpoint and its `/v3/api-docs` entry are unchanged

**⏸ Checkpoint: stop and get explicit user review/go-ahead before continuing below.**

- [x] SERIES-069-AC-03: `SeriesController` → `SeriesControllerApi`
- [x] SERIES-069-AC-04: `SeriesGenreController` → `SeriesGenreControllerApi`
- [x] SERIES-069-AC-05: `SeriesLookupController` → `SeriesLookupControllerApi`
- [x] SERIES-069-AC-06: `SeriesOriginCountryController` → `SeriesOriginCountryControllerApi`
- [x] SERIES-069-AC-07: `SeriesRecommendationController` → `SeriesRecommendationControllerApi`
- [x] SERIES-069-AC-08: `SeriesRefreshController` → `SeriesRefreshControllerApi`
- [x] SERIES-069-AC-09: `SeriesWatchProviderController` → `SeriesWatchProviderControllerApi`
- [x] SERIES-069-AC-10: `FilterProfileController` → `FilterProfileControllerApi`
- [x] SERIES-069-AC-11 [MANUAL]: full-app before/after `/v3/api-docs` diff, `/swagger-ui.html` end-to-end check
