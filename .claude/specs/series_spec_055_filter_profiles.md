# Spec 055: Filter Profiles (Backend)

**Status**: Implemented
**Priority**: P3 (quality-of-life feature — saves users re-entering filter criteria every session)
**Depends on**: none — new standalone resource, not a revision of existing behavior
**Backend Task**

## Overview

Named, saved filter/criteria snapshots the frontend can create, list, update, and delete —
backend-persisted so they survive a cleared browser or a different machine, unlike every existing
settings item in this app (which are all `localStorage`-only, e.g. `frontend_spec_099`/`102`). This
is the backend half of the "saved filter profiles" initiative (`.claude/SPEC_CANDIDATES.md` item
11); `frontend_spec_106` (sticky Discover-mode tab) already shipped as an independent, smaller,
frontend-only piece of the same initiative. `frontend_spec_107` (not yet written) will consume
this spec's endpoints.

A profile belongs to one of three **areas** — `MY_SERIES`, `USE_MY_SERIES`,
`RECOMMENDATION_FILTERS` — corresponding to three unrelated frontend contexts (My Series' filter
sheet, Recommendations' "Use My Series" panel, Recommendations' shared "Filters" box) each with
their own, independently-evolving criteria shape. The backend never interprets or queries into a
profile's `criteria` — it's stored and returned as an opaque JSON blob, keyed for CRUD purposes
only by `(area, name)`. This is a deliberate departure from typed columns per field: Area B (Use My
Series filters) has already grown its field set twice on the frontend alone
(`frontend_spec_081`) with zero backend involvement, and a generic blob means that never has to
change here again.

## Design Decisions

- **One generic table, not three typed ones.** The backend's only job is CRUD keyed by
  `(area, name)` — it never filters, sorts, or joins on individual criteria fields. Three typed
  tables would require a new migration + entity + DTO change every time any one of the three
  areas' field sets grows, for a benefit (typed columns) the backend never uses.
- **`criteria` is `JsonNode`, mapped via a `JsonNodeConverter implements
  AttributeConverter<JsonNode, String>`** — not a raw `String` column (which would force the
  frontend to double-encode: `JSON.stringify()` before sending, `JSON.parse()` after receiving) and
  not Hibernate's native JSON column type (unproven/unsupported on this stack's SQLite dialect via
  `hibernate-community-dialects`, and the backend gets no benefit from it anyway since it never
  queries into the column). The converter instantiates `new ObjectMapper()` directly, matching
  `SeriesExportService`'s existing pattern exactly (confirmed: this codebase's real Jackson import
  is `tools.jackson.databind.ObjectMapper`, Jackson 3's package under Spring Boot 4.1 — not
  `com.fasterxml.jackson.databind`).
- **Uniqueness is `(area, name)`, not `name` alone** — the same profile name can exist once per
  area (e.g. a "Weeknight" profile in both `MY_SERIES` and `RECOMMENDATION_FILTERS`) without
  conflict. Enforced at the DB level via a unique index (`V011`'s real invariant) with a
  service-layer pre-check turning a would-be constraint violation into a clean `409` instead of a
  `500` — mirrors `V002__create_ignored_series_table.sql`'s existing unique-index-as-constraint
  pattern for `imdbId`.
- **`createdAt`/`updatedAt` set explicitly via injected `Clock`**, not relying solely on
  `@CreationTimestamp` — mirrors `IgnoredSeriesService.ignore()`'s `LocalDateTime.now(clock)`
  pattern (comment there: `@CreationTimestamp` alone isn't guaranteed reflected on the in-memory
  entity immediately after `save()`). No project-wide `ClockConfig` bean change needed — it already
  exists and is already injectable.
- **New top-level resource `/api/v1/filter-profiles`, not nested under `/series`** — a filter
  profile isn't series data, unlike everything else this app persists.
- **No rename-only endpoint distinction** — `PATCH` accepts an optional `name` and/or `criteria`;
  updating just one is a valid partial update (standard `PATCH` semantics, matching how `PATCH
  /api/v1/series/{id}` already works elsewhere in this app).

## Requirements

### Requirement 1: List a profile area's saved profiles

**User story**: As a user, I want to see every profile I've saved for one area (e.g. My Series
filters), sorted predictably.

#### Acceptance Criteria

- **SERIES-055-AC-01** [AUTO]: `GET /api/v1/filter-profiles?area={area}` shall return `200` with
  `ApiResponse<List<FilterProfileDto>>`, containing every `FilterProfileEntity` whose `area`
  matches the requested value, sorted by `name` ascending.
- **SERIES-055-AC-02** [AUTO]: An `area` value that isn't one of `MY_SERIES`/`USE_MY_SERIES`/
  `RECOMMENDATION_FILTERS` shall return `400 Bad Request` (via the existing
  `MethodArgumentTypeMismatchException` handler — Spring's own enum `@RequestParam` binding
  rejects it before the controller method body runs, no new handler code needed).
- **SERIES-055-AC-03** [AUTO]: An area with no saved profiles shall return `200` with an empty
  list, not `404`.

---

### Requirement 2: Create a new profile

**User story**: As a user, I want to save my current filter selections under a name I choose, so I
can re-apply them later without re-entering every field.

#### Acceptance Criteria

- **SERIES-055-AC-04** [AUTO]: `POST /api/v1/filter-profiles` with `{area, name, criteria}` shall
  create a new `FilterProfileEntity` and return `201 Created` with `ApiResponse<FilterProfileDto>`,
  `criteria` round-tripping as the same nested JSON object submitted (not a string).
- **SERIES-055-AC-05** [AUTO]: A blank or missing `name` shall return `400 Bad Request` (via
  `IllegalArgumentException`, matching `IgnoredSeriesService`'s existing blank-field-check
  pattern).
- **SERIES-055-AC-06** [AUTO]: Creating a profile whose `(area, name)` already matches an existing
  profile shall return `409 Conflict` (via `ConflictException`) and shall not create a duplicate
  row.
- **SERIES-055-AC-07** [AUTO]: Creating a profile with the same `name` as an existing profile in a
  **different** area shall succeed — uniqueness is scoped to `(area, name)`, not `name` alone.
- **SERIES-055-AC-08** [AUTO]: `criteria` shall accept any well-formed JSON object (the backend
  performs no schema validation on its internal shape — that's the frontend's responsibility per
  area).

---

### Requirement 3: Update an existing profile

**User story**: As a user, I want to rename a saved profile or overwrite its saved criteria with my
current selections, without deleting and recreating it.

#### Acceptance Criteria

- **SERIES-055-AC-09** [AUTO]: `PATCH /api/v1/filter-profiles/{id}` with `{name?, criteria?}`
  shall update only the fields present in the request body, leaving the other unchanged, and
  return `200` with the updated `ApiResponse<FilterProfileDto>`.
- **SERIES-055-AC-10** [AUTO]: `PATCH` for a nonexistent `id` shall return `404 Not Found` (via
  `EntityNotFoundException`).
- **SERIES-055-AC-11** [AUTO]: Renaming a profile to a `name` that collides with another existing
  profile **in the same area** shall return `409 Conflict` and leave the original profile
  unmodified.
- **SERIES-055-AC-12** [AUTO]: Renaming a profile to its own current `name` (a no-op rename) shall
  succeed, not conflict with itself.
- **SERIES-055-AC-13** [AUTO]: A successful update shall set `updatedAt` to the current time (via
  the injected `Clock`), leaving `createdAt` unchanged.

---

### Requirement 4: Delete a profile

**User story**: As a user, I want to remove a saved profile I no longer need.

#### Acceptance Criteria

- **SERIES-055-AC-14** [AUTO]: `DELETE /api/v1/filter-profiles/{id}` shall remove the matching
  `FilterProfileEntity` and return `204 No Content`.
- **SERIES-055-AC-15** [AUTO]: `DELETE` for a nonexistent `id` shall return `404 Not Found`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Structural precedent this spec's entity/service/DTO follow throughout | `IgnoredSeriesEntity.java`, `IgnoredSeriesService.java`, `IgnoredSeriesRepository.java`, `IgnoredSeriesDto.java` |
| `ConflictException`/`EntityNotFoundException` → 409/404 mapping already wired | `GlobalExceptionHandler.java` |
| `Clock` injection pattern this spec's `createdAt`/`updatedAt` handling mirrors | `IgnoredSeriesService.ignore()`, `ClockConfig.java` |
| Unique-index-as-constraint migration pattern this spec's `V011` mirrors | `V002__create_ignored_series_table.sql` |
| `ObjectMapper` instantiation pattern this spec's `JsonNodeConverter` mirrors | `SeriesExportService.java` (line 37, `new ObjectMapper()`) |
| Package-private `UuidPathPattern` this spec's controller reuses for its `{id}` path variable | `controller/UuidPathPattern.java` |
| First, independent, frontend-only phase of the same initiative, already shipped | `frontend_spec_106_sticky_discover_mode.md` |
| Frontend consumer of this spec's endpoints, to be written after this spec is implemented | `frontend_spec_107_filter_profile_ui.md` (not yet written) |
| Three areas' exact criteria field sets this spec's `criteria` blob will carry (informational only — backend never validates against these shapes) | `frontend/src/components/SearchFilter.tsx` (Area A), `frontend/src/components/UseMySeriesPanel.tsx` (Area B), `frontend/src/components/RecommendationFiltersBox.tsx` (Area C) |

---

## TDD Test Case Sketches

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/service/FilterProfileServiceSpec.groovy`

```groovy
def "SERIES-055-AC-04: creates a new profile"() {
    given: "a well-formed create request"
        def criteria = objectMapper.readTree('{"genres":["Comedy"]}')

    when: "a profile is created"
        def dto = service.create(FilterProfileArea.MY_SERIES, "Weeknight", criteria)

    then: "it round-trips with the submitted criteria"
        dto.name() == "Weeknight"
        dto.criteria() == criteria
}

def "SERIES-055-AC-06: duplicate (area, name) conflicts"() {
    given: "an existing profile"
        service.create(FilterProfileArea.MY_SERIES, "Weeknight", objectMapper.createObjectNode())

    when: "creating another with the same area and name"
        service.create(FilterProfileArea.MY_SERIES, "Weeknight", objectMapper.createObjectNode())

    then: "a ConflictException is thrown"
        thrown(ConflictException)
}

def "SERIES-055-AC-07: same name in a different area does not conflict"() {
    given: "an existing profile in MY_SERIES"
        service.create(FilterProfileArea.MY_SERIES, "Weeknight", objectMapper.createObjectNode())

    when: "creating a profile with the same name in RECOMMENDATION_FILTERS"
        def dto = service.create(FilterProfileArea.RECOMMENDATION_FILTERS, "Weeknight", objectMapper.createObjectNode())

    then: "it succeeds"
        dto.name() == "Weeknight"
}

def "SERIES-055-AC-11: renaming to a colliding name in the same area conflicts"() {
    given: "two existing profiles in the same area"
        service.create(FilterProfileArea.MY_SERIES, "A", objectMapper.createObjectNode())
        def b = service.create(FilterProfileArea.MY_SERIES, "B", objectMapper.createObjectNode())

    when: "renaming B to A"
        service.update(b.id(), "A", null)

    then: "a ConflictException is thrown"
        thrown(ConflictException)
}

def "SERIES-055-AC-01: list is scoped to area and sorted by name"() {
    given: "profiles across two areas"
        service.create(FilterProfileArea.MY_SERIES, "Zebra", objectMapper.createObjectNode())
        service.create(FilterProfileArea.MY_SERIES, "Apple", objectMapper.createObjectNode())
        service.create(FilterProfileArea.USE_MY_SERIES, "Other", objectMapper.createObjectNode())

    when: "listing MY_SERIES"
        def result = service.list(FilterProfileArea.MY_SERIES)

    then: "only MY_SERIES profiles are returned, sorted by name"
        result*.name() == ["Apple", "Zebra"]
}
```

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/controller/FilterProfileControllerSpec.groovy`

```groovy
def "SERIES-055-AC-04: POST creates and returns 201"() {
    when: "POST /api/v1/filter-profiles is requested"
        def response = client.post().uri("/api/v1/filter-profiles")
            .bodyValue([area: "MY_SERIES", name: "Weeknight", criteria: [genres: ["Comedy"]]])
            .exchange()

    then: "201 with the created profile"
        response.expectStatus().isCreated()
        response.expectBody().jsonPath('$.data.name').isEqualTo("Weeknight")
}

def "SERIES-055-AC-02: an invalid area returns 400"() {
    when: "GET /api/v1/filter-profiles?area=NOT_REAL is requested"
        def response = client.get().uri("/api/v1/filter-profiles?area=NOT_REAL").exchange()

    then: "400 Bad Request"
        response.expectStatus().isBadRequest()
}

def "SERIES-055-AC-14/15: DELETE returns 204, then 404 on a second attempt"() {
    given: "an existing profile"
        def id = // ... created via the service or a prior POST

    expect: "first delete succeeds"
        client.delete().uri("/api/v1/filter-profiles/${id}").exchange()
            .expectStatus().isNoContent()

    and: "second delete 404s"
        client.delete().uri("/api/v1/filter-profiles/${id}").exchange()
            .expectStatus().isNotFound()
}
```

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/model/JsonNodeConverterSpec.groovy`

```groovy
def "nested JSON round-trips through save/reload unchanged"() {
    given: "an entity with nested criteria"
        def entity = new FilterProfileEntity()
        entity.setArea(FilterProfileArea.MY_SERIES)
        entity.setName("Test")
        entity.setCriteria(objectMapper.readTree('{"genres":["Comedy","Drama"],"yearMin":2020}'))

    when: "saved and reloaded"
        def saved = repository.save(entity)
        entityManager.flush()
        entityManager.clear()
        def reloaded = repository.findById(saved.id).get()

    then: "the criteria is unchanged"
        reloaded.criteria == objectMapper.readTree('{"genres":["Comedy","Drama"],"yearMin":2020}')
}
```

**Test Case (Green)**: implement the entity/converter/repository/service/controller until every
spec above passes.

---

## Acceptance Criteria Summary

- [x] SERIES-055-AC-01: `GET ?area=` returns that area's profiles, sorted by name
- [x] SERIES-055-AC-02: invalid `area` value returns 400
- [x] SERIES-055-AC-03: an area with no profiles returns an empty list, not 404
- [x] SERIES-055-AC-04: `POST` creates a profile, criteria round-trips as real JSON
- [x] SERIES-055-AC-05: blank/missing `name` returns 400
- [x] SERIES-055-AC-06: duplicate `(area, name)` returns 409, no duplicate row created
- [x] SERIES-055-AC-07: same `name` in a different area succeeds
- [x] SERIES-055-AC-08: `criteria` accepts any well-formed JSON object, no backend schema validation
- [x] SERIES-055-AC-09: `PATCH` updates only the fields present in the request
- [x] SERIES-055-AC-10: `PATCH` for a nonexistent id returns 404
- [x] SERIES-055-AC-11: renaming to a same-area collision returns 409, original unmodified
- [x] SERIES-055-AC-12: no-op rename (to its own current name) succeeds
- [x] SERIES-055-AC-13: a successful update sets `updatedAt`, leaves `createdAt` unchanged
- [x] SERIES-055-AC-14: `DELETE` removes the profile, returns 204
- [x] SERIES-055-AC-15: `DELETE` for a nonexistent id returns 404
