# Spec 056: Filter Profile Name Validation Hardening

**Status**: Implemented
**Priority**: P3 (data-hygiene hardening on an already-shipped feature, not a new capability)
**Depends on**: `series_spec_055_filter_profiles.md` (the entity/service/converter this hardens)
**Backend Task**

## Overview

`FilterProfileEntity.name` currently has only `@NotBlank` — nothing bounds its length, nothing
rejects characters that would break a single-line list row, and `FilterProfileService.create`/
`update` never trim before checking uniqueness or storing. This spec closes those gaps and adds one
small, unrelated defensive fix found in the same area: `JsonNodeConverter.convertToEntityAttribute`
has no handling for malformed JSON on read.

This is the backend half of a UI revision (`frontend_spec_108`, not yet written) that replaces the
inline name `<input>` with a "Save" modal — that modal's client-side length check needs to match a
concrete backend-declared bound, which is why this spec lands first.

## Design Decisions

- **None of this is SQL-injection protection, and the spec is explicit about that rather than
  implying otherwise.** `FilterProfileRepository` contains exactly two methods
  (`findByAreaOrderByNameAsc`, `findByAreaAndName`), both plain Spring Data JPA derived-query
  methods — confirmed via a full-tree grep that there is no `@Query` annotation, no native SQL, no
  string-concatenated query anywhere in this backend touching this table. Every parameter is bound
  through Hibernate's parameterized-query machinery, which is immune to injection regardless of
  what characters a name contains. The validation added here is **data-hygiene/UX only**: a
  sensible length bound, and no line breaks/tabs that would visibly break a list row in the
  frontend — not a security allowlist.
- **Entity-level Bean Validation, not a controller `@Valid` DTO check** — mirrors
  `series_spec_041_year_validation_bounds.md`'s established pattern for exactly this class of rule
  (`SeriesEntity`'s `@Min`/`@Max` fields). A flush-time `ConstraintViolationException` (or its
  `TransactionSystemException`-wrapped form) is already unwrapped and mapped to `400` by
  `GlobalExceptionHandler.handleConstraintViolation`/`handleTransactionSystemException` — both
  already exist, confirmed present, no new handler code needed. Keeping validation on the entity
  (not the DTO) means `create` and `update` are both covered automatically by the same annotation,
  the same way `year`'s bounds cover both `POST`/`PATCH /api/v1/series` today.
- **Trim happens in the service, not via a Bean Validation annotation** — `@NotBlank`/`@Size`
  operate on the string as submitted; trimming is a normalization step (deciding what actually gets
  *stored* and *compared*), which belongs in `FilterProfileService`, consistent with how validation
  (declarative, entity-level) and normalization (imperative, service-level) are already split
  elsewhere in this codebase.
- **The `@Pattern` regex is deliberately narrow** (`^[^\r\n\t]*$`) — it rejects only the three
  characters that would visibly corrupt a single-line list item (carriage return, newline, tab).
  Quotes, semicolons, unicode, emoji, and everything else are left alone; there is no security
  reason to restrict them.
- **`JsonNodeConverter`'s defensive fix is a small, unrelated hardening item riding along**, not a
  new user-facing requirement of its own — found while working in this file this session, not
  something this spec's own scope caused. `convertToEntityAttribute` currently calls
  `objectMapper.readTree(dbData)` with no exception handling; a hand-corrupted `criteria` column
  (this app is the only writer, so this is a defensive measure against future drift/manual DB
  edits, not a realistic user-triggered scenario) would throw an unhandled `JacksonException`
  (`tools.jackson.core.JacksonException` — the exception type already used for this purpose
  elsewhere in this backend, see `ImportFileParser.java`) during entity loading. Wrapped into a
  clear, logged `IllegalStateException` instead — still a `500` via the existing catch-all handler
  (correct here: this is genuinely unexpected, unlike a validation failure), but with a legible
  message instead of a raw Jackson stack trace surfacing first.

## Requirements

### Requirement 1: Name length is bounded

**User story**: As a user, I want to be stopped with a clear error if I try to save a profile under
an unreasonably long name, not have it silently truncated or fail unpredictably.

#### Acceptance Criteria

- **SERIES-056-AC-01** [AUTO]: `FilterProfileEntity.name` shall carry a `@Size(max = 255)`
  constraint; a name of exactly 255 characters shall be accepted.
- **SERIES-056-AC-02** [AUTO]: A name of 256 characters shall be rejected; `POST`/`PATCH
  /api/v1/filter-profiles` shall return `400 Bad Request`, not `500`.

---

### Requirement 2: Name rejects line breaks and tabs

**User story**: As a user, I want a profile name that would break a single-line list row (e.g.
pasted multi-line text) to be rejected with a clear message, not silently accepted and later
displayed garbled.

#### Acceptance Criteria

- **SERIES-056-AC-03** [AUTO]: `FilterProfileEntity.name` shall carry a `@Pattern(regexp =
  "^[^\r\n\t]*$")` constraint; a name containing `\n`, `\r`, or `\t` shall be rejected via `400 Bad
  Request`, not `500`.
- **SERIES-056-AC-04** [AUTO]: A name containing any other character (quotes, semicolons, unicode,
  emoji, punctuation) shall be accepted — this constraint is explicitly narrow, not a general
  character allowlist.

---

### Requirement 3: Name is trimmed before storage and before the uniqueness check

**User story**: As a user, I don't want `"Weeknight"` and `"Weeknight "` (trailing space) to be
treated as two different profiles I can accidentally create side by side.

#### Acceptance Criteria

- **SERIES-056-AC-05** [AUTO]: `FilterProfileService.create` shall trim `name` before the
  `(area, name)` uniqueness check and before storing it on the entity.
- **SERIES-056-AC-06** [AUTO]: `FilterProfileService.update` shall trim `name` (when provided)
  before the uniqueness check and before storing it, using the same trimmed value for the
  self-collision exclusion (renaming to its own current name, differing only in whitespace, is
  still a no-op, not a conflict).
- **SERIES-056-AC-07** [AUTO]: Creating a profile named `" Weeknight"` (leading whitespace) in an
  area that already has a profile literally named `"Weeknight"` shall be rejected as `409
  Conflict`, not silently created as a second distinct profile.

---

### Requirement 4: Malformed persisted criteria fails clearly, not with an unhandled crash

**User story**: As a developer maintaining this app, I want a corrupted `criteria` column (e.g.
from a manual DB edit) to fail with a legible error if it's ever read, not an opaque Jackson stack
trace.

#### Acceptance Criteria

- **SERIES-056-AC-08** [AUTO]: `JsonNodeConverter.convertToEntityAttribute` shall catch
  `tools.jackson.core.JacksonException` from `objectMapper.readTree` and rethrow it wrapped in an
  `IllegalStateException` with a message identifying the conversion failure; a well-formed
  `criteria` value shall continue to round-trip unchanged (regression guard).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Entity/service/converter this spec hardens | `series_spec_055_filter_profiles.md`, `FilterProfileEntity.java`, `FilterProfileService.java`, `JsonNodeConverter.java` |
| Entity-level Bean Validation pattern this spec mirrors (`@Min`/`@Max` → `ConstraintViolationException` → 400) | `series_spec_041_year_validation_bounds.md`, `SeriesEntity.java` |
| Existing exception-handling chain this spec relies on, unchanged | `GlobalExceptionHandler.java` (`handleConstraintViolation`, `handleTransactionSystemException`, `handleBadRequest`) |
| `JacksonException` precedent this spec's converter fix follows | `backend/src/main/java/uk/co/stefirby/seriestracker/service/io/ImportFileParser.java` |
| Entity-spec test structure this spec's new Spock file follows (no `FilterProfileEntitySpec.groovy` existed before this spec) | `backend/src/test/groovy/uk/co/stefirby/seriestracker/model/SeriesEntitySpec.groovy` |
| Frontend consumer of this spec's 255-char bound, to be written after this spec is implemented | `frontend_spec_108_filter_profile_management_and_save_modal.md` (not yet written) |

---

## TDD Test Case Sketches

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/model/FilterProfileEntitySpec.groovy` (new)

```groovy
package uk.co.stefirby.seriestracker.model

import spock.lang.Specification
import jakarta.validation.Validator
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import tools.jackson.databind.node.ObjectNode
import tools.jackson.databind.ObjectMapper

@SpringBootTest
class FilterProfileEntitySpec extends Specification {

    @Autowired
    Validator validator

    ObjectNode emptyCriteria() {
        new ObjectMapper().createObjectNode()
    }

    def "SERIES-056-AC-01: accepts a name of exactly 255 characters"() {
        given: "a profile with a 255-character name"
            def entity = new FilterProfileEntity(area: FilterProfileArea.MY_SERIES, name: "a" * 255, criteria: emptyCriteria())

        when: "the entity is validated"
            def violations = validator.validate(entity)

        then: "no violations are raised"
            violations.isEmpty()
    }

    def "SERIES-056-AC-02: rejects a name of 256 characters"() {
        given: "a profile with a 256-character name"
            def entity = new FilterProfileEntity(area: FilterProfileArea.MY_SERIES, name: "a" * 256, criteria: emptyCriteria())

        when: "the entity is validated"
            def violations = validator.validate(entity)

        then: "a violation is raised for the name field"
            violations.any { it.propertyPath.toString() == "name" }
    }

    def "SERIES-056-AC-03: rejects a name containing a newline, carriage return, or tab"() {
        given: "a profile with a name containing #character"
            def entity = new FilterProfileEntity(area: FilterProfileArea.MY_SERIES, name: "Bad${character}Name", criteria: emptyCriteria())

        when: "the entity is validated"
            def violations = validator.validate(entity)

        then: "a violation is raised for the name field"
            violations.any { it.propertyPath.toString() == "name" }

        where:
            character << ["\n", "\r", "\t"]
    }

    def "SERIES-056-AC-04: accepts a name containing quotes, punctuation, and unicode"() {
        given: "a profile with an unusual but non-control-character name"
            def entity = new FilterProfileEntity(area: FilterProfileArea.MY_SERIES, name: name, criteria: emptyCriteria())

        when: "the entity is validated"
            def violations = validator.validate(entity)

        then: "no violations are raised"
            violations.isEmpty()

        where:
            name << ["O'Brien's picks", "Comedy; Drama", "日本語プロファイル", "🎬 Weeknight"]
    }
}
```

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/service/FilterProfileServiceSpec.groovy` (additions)

```groovy
def "SERIES-056-AC-05: create trims the name before storing and before the uniqueness check"() {
    when: "a profile is created with leading/trailing whitespace in the name"
        def dto = service.create(FilterProfileArea.MY_SERIES, "  Weeknight  ", objectMapper.createObjectNode())

    then: "the stored name is trimmed"
        dto.name() == "Weeknight"
}

def "SERIES-056-AC-07: a whitespace-padded name conflicts with an existing trimmed one"() {
    given: "an existing profile"
        service.create(FilterProfileArea.MY_SERIES, "Weeknight", objectMapper.createObjectNode())

    when: "creating another with leading whitespace but the same trimmed name"
        service.create(FilterProfileArea.MY_SERIES, " Weeknight", objectMapper.createObjectNode())

    then: "a ConflictException is thrown, not a second profile created"
        thrown(ConflictException)
}

def "SERIES-056-AC-06: update trims the name before the uniqueness check, and a whitespace-only rename to itself is a no-op"() {
    given: "an existing profile"
        def created = service.create(FilterProfileArea.MY_SERIES, "Weeknight", objectMapper.createObjectNode())

    when: "renaming with only whitespace difference"
        def updated = service.update(created.id(), " Weeknight ", null)

    then: "no conflict, name stored trimmed"
        updated.name() == "Weeknight"
}
```

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/controller/FilterProfileControllerSpec.groovy` (additions)

```groovy
def "SERIES-056-AC-02: a 256-character name returns 400, not 500"() {
    when: "POST /api/v1/filter-profiles is requested with an over-length name"
        def response = client.post().uri("/api/v1/filter-profiles")
            .bodyValue([area: "MY_SERIES", name: "a" * 256, criteria: [:]])
            .exchange()

    then: "400 Bad Request"
        response.expectStatus().isBadRequest()
}

def "SERIES-056-AC-03: a name containing a newline returns 400, not 500"() {
    when: "POST /api/v1/filter-profiles is requested with a newline in the name"
        def response = client.post().uri("/api/v1/filter-profiles")
            .bodyValue([area: "MY_SERIES", name: "Bad\nName", criteria: [:]])
            .exchange()

    then: "400 Bad Request"
        response.expectStatus().isBadRequest()
}
```

### `backend/src/test/groovy/uk/co/stefirby/seriestracker/model/JsonNodeConverterSpec.groovy` (additions)

```groovy
def "SERIES-056-AC-08: malformed persisted JSON fails with a clear IllegalStateException, not an unhandled JacksonException"() {
    given: "a converter and a malformed JSON string"
        def converter = new JsonNodeConverter()

    when: "converting the malformed string back to a JsonNode"
        converter.convertToEntityAttribute("{not valid json")

    then: "an IllegalStateException is thrown, not a raw JacksonException"
        thrown(IllegalStateException)
}

def "SERIES-056-AC-08: well-formed JSON still round-trips unchanged"() {
    given: "a converter and a well-formed JSON string"
        def converter = new JsonNodeConverter()

    when: "converting it back to a JsonNode"
        def node = converter.convertToEntityAttribute('{"genres":["Comedy"]}')

    then: "it parses correctly"
        node.get("genres").get(0).asString() == "Comedy"
}
```

**Test Case (Green)**: implement the entity annotations, service trimming, and converter fix until
every spec above passes.

---

## Acceptance Criteria Summary

- [x] SERIES-056-AC-01: `@Size(max = 255)` accepts exactly 255 characters
- [x] SERIES-056-AC-02: 256 characters rejected as 400, not 500
- [x] SERIES-056-AC-03: `\n`/`\r`/`\t` rejected as 400, not 500
- [x] SERIES-056-AC-04: every other character (quotes, punctuation, unicode, emoji) accepted
- [x] SERIES-056-AC-05: `create` trims before storing and before the uniqueness check
- [x] SERIES-056-AC-06: `update` trims before the uniqueness check; whitespace-only rename is a no-op
- [x] SERIES-056-AC-07: a whitespace-padded name conflicts with an existing trimmed one (409)
- [x] SERIES-056-AC-08: malformed persisted `criteria` fails with a clear `IllegalStateException`, well-formed JSON still round-trips
