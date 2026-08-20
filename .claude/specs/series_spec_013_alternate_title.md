# Spec 013: `alternateTitle` Field

**Status**: Implemented. **Superseded (removed) by `series_spec_017_tmdb_primary_lookup.md`**: with a single TMDB-primary search path, the searched-vs-resolved title ambiguity this field existed to capture mostly disappears; the field, column, and capture logic are deleted. Kept for historical/traceability reference; no AC here is renumbered or deleted.
**Priority**: P2 (quality-of-life — unblocks a future frontend fix, not core CRUD)
**Depends on**: `series_spec_001_entity.md` (the original `SeriesEntity`/`title` column this field is modeled on)
**Backend Task**

> **Scope note**: this is a **backend-only** spec, by explicit instruction for this round. It adds the column and wires it through the entity/DTO/CRUD/export layers exactly like any other optional field. No paired frontend spec exists yet — `SeriesList`/`SeriesDetail`'s rendering of this field (e.g. "MI-5 — aka Spooks") and the logic that decides what value `AddSeriesForm` populates it with are explicitly **not** covered here and are deferred to a later frontend spec. Do not build frontend consumers against this field until that spec exists.

## Overview

This session's OMDb/TMDB lookup chain (`series_spec_010`/`011`/`012`, all implemented) surfaced a gap: OMDb sometimes catalogues a show under a different name than the one a user searches for or recognizes. Confirmed live with the real UK show "Spooks" (2002, TMDB id `4046`) — OMDb catalogues it as "MI-5" (imdbID `tt0160904`). The TMDB-fallback picker (`series_spec_012`/`frontend_spec_016`) lets a user find "Spooks (2002)" on TMDB and resolve it via OMDb to a full record, but that record's `Title` field is "MI-5". `AddSeriesForm.tsx`'s `applyLookupResult` unconditionally overwrites the form's `title` with whatever the lookup returns, and `SeriesEntity.title` is a single string column with nowhere to preserve the name the user actually searched for. The practical result: search "Spooks," end up with a list row that just says "MI-5," with nothing indicating why or that these are the same show.

This spec adds a nullable `alternateTitle` field to `SeriesEntity`/`SeriesDto` — storage for the "other" name a show is known by — so a later frontend spec can render it as secondary text (e.g. "MI-5 — aka Spooks"). Deciding *what* value goes in this field (the TMDB-searched title, the OMDb title, or something else) is frontend logic and is explicitly out of scope here; this spec covers only the column existing and being a pure, unvalidated passthrough through the CRUD and export layers, exactly like `genres`/`personalNotes`/`posterUrl` already are — no validation, no computation, no business logic.

---

## Requirements

### Requirement 1: `alternateTitle` Field

**User story**: As a developer, I want a place to store the "other" name a series is known by, so that a future UI can show both names when a lookup source's canonical title differs from what the user searched for.

#### Acceptance Criteria

- **SERIES-013-AC-01** [AUTO]: `SeriesEntity` shall gain a nullable `alternateTitle` column (`@Column(nullable = true, length = 255)` — mirroring `title`'s own `@Column` definition exactly, minus the `@NotBlank`/`nullable = false` constraints, since an alternate title is a title and should carry the same shape as the primary one, just optional), added via a new Flyway migration `V005__add_alternate_title_to_series.sql` (`ALTER TABLE series ADD COLUMN alternate_title VARCHAR(255);`). No index is added — unlike `imdbId` (`idx_series_imdb_id`, added because it's queried for existence checks), nothing in this spec's scope filters or looks up by `alternateTitle`.
- **SERIES-013-AC-02** [AUTO]: `SeriesDto` shall gain an `alternateTitle` field (plain getter/setter), following the existing plain-getter/setter style already used for every other field on the class (no Lombok, per this repo's convention).
- **SERIES-013-AC-03** [AUTO]: `POST /api/v1/series`, `GET /api/v1/series`, `GET /api/v1/series/{id}`, and `PATCH /api/v1/series/{id}` shall accept and return `alternateTitle` like any other optional field — following the same null-if-unset semantics as `genres`/`personalNotes`/`posterUrl` (a `PATCH` with `alternateTitle` omitted leaves the stored value unchanged, matching every other optional field's update semantics in `SeriesService.update`), and applying no format validation to the value itself (same "no format validation" policy `series_spec_005_omdb_lookup.md` already established for `posterUrl`).
- **SERIES-013-AC-04** [AUTO]: CSV/JSON export (`series_spec_004_export.md`) shall include `alternateTitle` as an additional column/field, following the same null-handling rules already specified there (CSV: empty cell, not the literal string `"null"`; JSON: `null`).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `title` column definition this mirrors (`@Column(nullable = false, length = 255)` + `@NotBlank`) | `series_spec_001_entity.md`, `SeriesEntity.java` |
| CRUD contract (`POST`/`GET`/`GET {id}`/`PATCH`) this field extends | `series_spec_002_crud.md` |
| Export format (CSV/JSON, null-handling rules) this field extends | `series_spec_004_export.md` |
| Structural precedent for a single new nullable column wired through entity/DTO/export with no business logic (`posterUrl`) | `series_spec_005_omdb_lookup.md` Requirement 1 |
| `imdbId` precedent for "nullable column, no validation, indexed only because it's queried" — contrast: this field is *not* indexed | `series_spec_006_recommendations.md`, `V003__add_imdb_id_to_series.sql` |
| Background: OMDb/TMDB title-mismatch problem this field exists to eventually address (frontend rendering deferred) | `series_spec_010`, `series_spec_011`, `series_spec_012` (all implemented), `frontend_spec_016` |
| `V006` is reserved by a separate, parallel spec — not claimed here | `series_spec_014_tags.md` |

---

## TDD Test Case Sketches

### `SeriesEntitySpec.groovy` (addition)

```groovy
def "SERIES-013-AC-01: accepts a series with an alternateTitle set"() {
    given: "a series with title and alternateTitle both set"
        def series = new SeriesEntity(title: "MI-5", alternateTitle: "Spooks")

    expect: "the entity holds both values"
        series.title == "MI-5"
        series.alternateTitle == "Spooks"
}

def "SERIES-013-AC-01: leaves alternateTitle null when unset, like other optional fields"() {
    given: "a series with only a title"
        def series = new SeriesEntity(title: "Breaking Bad")

    expect: "alternateTitle defaults to null"
        series.alternateTitle == null
}
```

### `SeriesServiceSpec.groovy` (addition)

```groovy
def "SERIES-013-AC-02/03: alternateTitle flows through create and is persisted"() {
    given: "a SeriesDto with alternateTitle set"
        def dto = new SeriesDto(title: "MI-5", alternateTitle: "Spooks")

    when: "the series is created"
        def created = seriesService.create(dto)

    then: "alternateTitle round-trips"
        created.alternateTitle == "Spooks"

    and: "alternateTitle is persisted and retrievable"
        seriesService.getById(created.id).alternateTitle == "Spooks"
}

def "SERIES-013-AC-03: should create a series without an alternateTitle, leaving it null"() {
    given: "a series DTO with no alternateTitle"
        def dto = new SeriesDto(title: "No Alternate Title Show")

    when: "the series is created"
        def result = seriesService.create(dto)

    then: "alternateTitle is null, like other unset optional fields"
        result.alternateTitle == null
}

def "SERIES-013-AC-03: should update a series's alternateTitle"() {
    given: "a series has been created without an alternateTitle"
        def created = seriesService.create(new SeriesDto(title: "MI-5"))

    and: "an update DTO with an alternateTitle"
        def updateDto = new SeriesDto(alternateTitle: "Spooks")

    when: "the series is updated"
        def result = seriesService.update(created.id, updateDto)

    then: "alternateTitle is set, and other fields are unchanged"
        result.alternateTitle == "Spooks"
        result.title == "MI-5"
}

def "SERIES-013-AC-03: an update omitting alternateTitle leaves the stored value unchanged"() {
    given: "a series has been created with an alternateTitle"
        def created = seriesService.create(new SeriesDto(title: "MI-5", alternateTitle: "Spooks"))

    and: "an update DTO that omits alternateTitle but changes another field"
        def updateDto = new SeriesDto(personalRating: 5)

    when: "the series is updated"
        def result = seriesService.update(created.id, updateDto)

    then: "alternateTitle is unchanged, matching every other optional field's update semantics"
        result.alternateTitle == "Spooks"
        result.personalRating == 5
}
```

### `SeriesControllerSpec.groovy` (addition)

```groovy
def "SERIES-013-AC-03: POST /api/v1/series should accept and return alternateTitle"() {
    given: "a series DTO with an alternateTitle"
        def dto = new SeriesDto(title: "MI-5", alternateTitle: "Spooks")
        def json = objectMapper.writeValueAsString(dto)

    when: "a POST request is made to create the series"
        def result = mockMvc.perform(
          post("/api/v1/series")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json)
        )

    then: "the series is created with alternateTitle included"
        result.andExpect(status().isCreated())
        result.andExpect(jsonPath('$.data.alternateTitle').value("Spooks"))
}

def "SERIES-013-AC-03: GET /api/v1/series/{id} returns alternateTitle"() {
    given: "a series exists with an alternateTitle"
        def created = seriesService.create(new SeriesDto(title: "MI-5", alternateTitle: "Spooks"))

    when: "a GET request is made for that series"
        def result = mockMvc.perform(get("/api/v1/series/${created.id}"))

    then: "the response includes alternateTitle"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data.alternateTitle').value("Spooks"))
}
```

### `SeriesExportServiceSpec.groovy` (addition)

```groovy
def "SERIES-013-AC-04: exportAsJson includes alternateTitle"() {
    given: "a series with an alternateTitle, among the retrieved series"
        seriesService.create(new SeriesDto(title: "MI-5", alternateTitle: "Spooks"))
        def series = seriesService.getAll()

    when: "the series are exported as JSON"
        def json = exportService.exportAsJson(series, java.time.LocalDateTime.now())
        def parsed = new ObjectMapper().readTree(json)
        def mi5 = parsed.get('series').find { it.get('title').textValue() == 'MI-5' }

    then: "alternateTitle is present in the exported JSON"
        mi5 != null
        mi5.get('alternateTitle').textValue() == 'Spooks'
}

def "SERIES-013-AC-04: exportAsCsv includes alternateTitle values, header, and correct column count"() {
    given: "a series with an alternateTitle, among the retrieved series"
        seriesService.create(new SeriesDto(title: "MI-5", alternateTitle: "Spooks"))
        def series = seriesService.getAll()

    when: "the series are exported as CSV"
        def csv = exportService.exportAsCsv(series)
        def lines = csv.trim().split("\n")
        def headerCols = lines[0].split(",").size()

    then: "the header includes alternateTitle and the row includes its value"
        lines[0].contains("alternateTitle")
        csv.contains("Spooks")

    and: "the column count reflects the added field"
        headerCols == 18  // 17 existing fields + alternateTitle
}

def "SERIES-013-AC-04: exportAsCsv represents a null alternateTitle as an empty cell, not the literal 'null'"() {
    given: "a series with no alternateTitle, among the retrieved series"
        seriesService.create(new SeriesDto(title: "No Alternate Title Show"))
        def series = seriesService.getAll()

    when: "the series are exported as CSV"
        def csv = exportService.exportAsCsv(series)

    then: "the export succeeds without a literal 'null' anywhere"
        !csv.contains("null")
}
```

**Test Case (Green)** for all of the above: implement the migration, entity field, DTO field, `SeriesService#create`/`update`/`entityToDto` wiring, and `SeriesExportService`'s `CSV_HEADERS`/`csvRow` additions until every spec above passes.

---

## Implementation Notes

- Implemented in the same pass as `series_spec_014_tags.md` (both are additive changes to the same classes: `SeriesEntity`, `SeriesDto`, `SeriesService`, `SeriesExportService`).
- `SeriesExportServiceSpec.groovy`'s pre-existing `"exportAsCsv has correct number of columns per row"` test asserted `headerCols == 17`. Since this spec and `series_spec_014_tags.md` landed together, the actual final column count became **19** (17 existing fields + `alternateTitle` + `tags`), not the 18 either spec's own TDD sketch sketched in isolation. That test's assertion was updated to `19` with a comment explaining the count.
- CSV column position: `alternateTitle` was placed immediately after `title` (its closest semantic sibling), ahead of `year`. Neither spec mandated an exact position for `alternateTitle`, only that the header/column exist and the count be correct.

## Acceptance Criteria Summary

- [x] SERIES-013-AC-01: `alternateTitle` column added via `V005__add_alternate_title_to_series.sql`, nullable, `length = 255`, no index
- [x] SERIES-013-AC-02: `SeriesDto.alternateTitle` (plain getter/setter)
- [x] SERIES-013-AC-03: `alternateTitle` flows through create/get/update like other optional fields, null-if-unset, no format validation
- [x] SERIES-013-AC-04: CSV/JSON export includes `alternateTitle`, same null-handling as other optional fields
