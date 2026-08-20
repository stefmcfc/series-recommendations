# Spec 014: User-Defined Tags

**Status**: Implemented
**Priority**: P2 (quality-of-life for organizing a collection — not core CRUD)
**Depends on**: `series_spec_001_entity.md`/`series_spec_002_crud.md` (CRUD contract this extends), `series_spec_004_export.md` (export contract this extends)
**Backend Task**

> **Scope note**: this is a backend-only spec. It adds the `tags` column, DTO passthrough, and export support only. It does **not** add a frontend consumer — no editable tags input in `AddSeriesForm`/`EditSeriesForm`, and no `SearchFilter` integration. Those are deferred to a later round (a future `frontend_spec_0NN`, and a future extension of `series_spec_003_search.md`'s `SeriesSearchCriteria` — see Cross-References). Until that frontend work lands, `tags` is only reachable via direct API calls or export, not through the UI.

## Overview

Adds a `tags` field to `Series`: a nullable, comma-separated, user-supplied string of arbitrary labels (e.g. "rewatch candidate," "watch with partner," "background watching") a user assigns to organize their own collection. Unlike `genres` — which is sourced from OMDb/TMDB's fixed vocabulary via the lookup endpoints (`series_spec_005_omdb_lookup.md`, `series_spec_012_tmdb_lookup_fallback.md`) — `tags` has no external source and no fixed vocabulary; it exists purely for the user's own organizational scheme. It complements the existing `personalNotes` field (free-text, unstructured, one blob per series) by offering something structured and multi-value instead, and is intended to eventually support filtering (a natural extension of `SearchFilter`, `series_spec_003_search.md`) once a frontend consumer exists.

This spec deliberately copies `genres`' existing storage shape exactly — same column type, same nullable/length convention, same "store the joined string as-is, no server-side parsing or validation of individual values" policy — since `tags` is functionally the same kind of thing (a free-text, comma-separated, user-editable list), just sourced from the user rather than an external API.

**Design decisions**:
- **Column mirrors `genres`' column exactly**: `@Column(nullable = true, length = 500)` on `SeriesEntity`, and in the Flyway migration a plain `TEXT` column (SQLite `TEXT`, matching how `genres` itself is declared in `V001__create_series_table.sql` despite the JPA `length = 500` hint being documentation for a future Postgres DDL, not enforced by SQLite — `genres`' own column already works this way, `tags` does too).
- **Migration version is `V006`.** Current highest is `V004__create_ignored_series_table.sql`; a separate, unrelated spec being written in parallel this same session (`series_spec_013_alternate_title.md`) claims `V005`. `tags` takes the next slot after that, `V006`, so there is no numbering collision between the two specs.
- **Add an index on `tags`, mirroring `genres`' existing `idx_series_genres` index** (`CREATE INDEX IF NOT EXISTS idx_series_genres ON series(genres);`, `V001__create_series_table.sql` line 25). Unlike `alternateTitle` (the parallel, unrelated `series_spec_013` spec, which explicitly does *not* index its column), `tags` is explicitly intended to become filterable later per this spec's own Overview — indexing it now, in the same migration that adds the column, is cheap and avoids a second migration purely to add an index retroactively once the filtering work happens.
- **No format validation or normalization of individual tag values.** No case-folding, no dedup, no trimming enforcement, no fixed vocabulary — the app stores whatever comma-separated string the client sends and returns it verbatim, exactly the same policy `genres` already has. Filtering/parsing logic, if and when it's built, belongs at read time in a future spec (mirroring how `series_spec_003_search.md`'s genre filter parses `genres` at query time, not at write time) — not in this one.
- **Export** (`SeriesExportService`) includes `tags` as an additional JSON/CSV field, with the same null-handling and comma-escaping-in-CSV rules `genres` already gets.

---

## Requirements

### Requirement 1: `tags` Column on `SeriesEntity`

**User story**: As a user, I want to attach my own free-form labels to a series, so that I can organize my collection along dimensions that matter to me (e.g. "rewatch candidate"), not just the fixed genre vocabulary OMDb/TMDB provide.

#### Acceptance Criteria

- **SERIES-014-AC-01** [AUTO]: `SeriesEntity` shall gain a nullable `tags` column (`@Column(nullable = true, length = 500)`, same convention as `genres`), added via a new Flyway migration `V006__add_tags_to_series.sql` (`ALTER TABLE series ADD COLUMN tags TEXT;`).
- **SERIES-014-AC-02** [AUTO]: The `V006` migration shall also create `CREATE INDEX IF NOT EXISTS idx_series_tags ON series(tags);`, mirroring `idx_series_genres`.
- **SERIES-014-AC-03** [AUTO]: `SeriesEntity` shall expose plain `getTags()`/`setTags(String)` accessors (no Lombok, matching every other field on the entity).
- **SERIES-014-AC-04** [AUTO]: `SeriesEntity` shall accept a `null` `tags` value without raising a validation violation, exactly like `genres`/`personalNotes` do (no `@NotBlank`/`@NotNull` on the field).
- **SERIES-014-AC-05** [AUTO]: `SeriesEntity` shall store and return a `tags` value verbatim (no case-folding, deduplication, trimming, or parsing of the comma-separated content) — whatever string is set is exactly what is later returned by the getter.

---

### Requirement 2: `tags` in the CRUD Contract (`SeriesDto`)

**User story**: As a user, I want to set and read my tags through the same API I use for every other series field, so that tagging isn't a special case bolted on separately from the rest of the record.

#### Acceptance Criteria

- **SERIES-014-AC-06** [AUTO]: `SeriesDto` shall gain a `tags` field with plain `getTags()`/`setTags(String)` accessors (no Lombok, matching the rest of the DTO).
- **SERIES-014-AC-07** [AUTO]: `POST /api/v1/series` shall accept an optional `tags` value in the request body and return it in the created series' response.
- **SERIES-014-AC-08** [AUTO]: `GET /api/v1/series` and `GET /api/v1/series/{id}` shall include `tags` in every returned series, `null` if unset — following the same null-if-unset semantics `genres`/`personalNotes`/`posterUrl` already have.
- **SERIES-014-AC-09** [AUTO]: `PATCH /api/v1/series/{id}` shall accept and persist an updated `tags` value like any other optional field, including clearing it back to `null`.
- **SERIES-014-AC-10** [AUTO]: None of the create/read/update endpoints shall apply any format validation or parsing to the `tags` string's content — any string (including one with irregular spacing, casing, or duplicate entries) shall be accepted and stored as-is.

---

### Requirement 3: `tags` in Export

**User story**: As a user, I want my tags included when I export my collection, so that an exported CSV/JSON file is a complete record of my data, not a partial one missing my own organizational labels.

#### Acceptance Criteria

- **SERIES-014-AC-11** [AUTO]: `SeriesExportService.exportAsJson` shall include `tags` as a field on every exported series object, `null` if unset, following the same null-handling `series_spec_004_export.md` already establishes for other optional fields.
- **SERIES-014-AC-12** [AUTO]: `SeriesExportService.exportAsCsv` shall include a `tags` column in the header row and in every data row, in the same position convention as the other newer optional fields (appended after `posterUrl`/`imdbId`, before the date columns).
- **SERIES-014-AC-13** [AUTO]: A `tags` value containing a comma (e.g. `"rewatch candidate,watch with partner"`) shall be quoted in the CSV output, following the exact same comma-escaping rule `genres` already gets (`SeriesExportService#csv`).
- **SERIES-014-AC-14** [AUTO]: A `null` `tags` value shall render as an empty CSV cell (no quotes, no literal `"null"`), consistent with every other optional field's null handling in `exportAsCsv`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `tags` on `SeriesEntity`/`SeriesDto`, CRUD contract it extends | `series_spec_001_entity.md`, `series_spec_002_crud.md` |
| `genres` comma-separated string storage convention this spec copies exactly | `series_spec_001_entity.md`, `SeriesEntity.java` (`genres` field), `V001__create_series_table.sql` |
| Export format extension, null-handling and CSV comma-escaping rules | `series_spec_004_export.md`, `SeriesExportServiceSpec.groovy` (existing genre comma-escaping test) |
| Future filtering integration (not designed here) | `series_spec_003_search.md` — `SeriesSearchCriteria` would gain a `tags` filter analogous to its existing `genres` OR-logic filter, once a `SearchFilter` UI consumer exists |
| Migration numbering coordination (parallel spec, unrelated column) | `series_spec_013_alternate_title.md` (claims `V005`; this spec claims `V006`) |
| `V004` — highest migration that exists today, prior to this spec and `series_spec_013` | `V004__create_ignored_series_table.sql` |

---

## TDD Test Case Sketches

### `SeriesEntitySpec.groovy`

```groovy
def "SERIES-014-AC-03/05: should create a series with tags set and return it verbatim"() {
    when: "a series is created with a comma-separated tags value"
        def series = new SeriesEntity(
            title: "Game of Thrones",
            tags: "rewatch candidate,watch with partner"
        )

    then: "the tags value is stored and returned exactly as given"
        series.tags == "rewatch candidate,watch with partner"
}

def "SERIES-014-AC-04: should allow a null tags value"() {
    given: "a series with tags explicitly set to null"
        def series = new SeriesEntity(title: "Show", tags: null)

    when: "the series is validated"
        def violations = validator.validate(series)

    then: "no validation violations are raised"
        violations.isEmpty()
}
```

### `SeriesControllerSpec.groovy`

```groovy
def "SERIES-014-AC-07: POST /api/v1/series should accept and return tags"() {
    given: "a series DTO with a tags value"
        def dto = new SeriesDto(title: "The Wire", tags: "rewatch candidate,background watching")
        def json = objectMapper.writeValueAsString(dto)

    when: "a POST request is made to create the series"
        def result = mockMvc.perform(
          post("/api/v1/series")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json)
        )

    then: "the series is created with the tags value included"
        result.andExpect(status().isCreated())
        result.andExpect(jsonPath('$.data.tags').value("rewatch candidate,background watching"))
}

def "SERIES-014-AC-09: PATCH /api/v1/series/{id} should update and clear tags"() {
    given: "an existing series with a tags value"
        def created = seriesService.create(new SeriesDto(title: "The Wire", tags: "rewatch candidate"))

    when: "a PATCH request clears the tags value"
        def dto = new SeriesDto(tags: null)
        def json = objectMapper.writeValueAsString(dto)
        def result = mockMvc.perform(
          patch("/api/v1/series/${created.id}")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json)
        )

    then: "the tags value is cleared to null"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data.tags').doesNotExist())
}
```

### `SeriesExportServiceSpec.groovy`

```groovy
def "SERIES-014-AC-11: exportAsJson includes tags"() {
    given: "a series with a tags value, among the retrieved series"
        seriesService.create(new SeriesDto(title: "The Office", tags: "background watching"))
        def series = seriesService.getAll()

    when: "the series are exported as JSON"
        def json = exportService.exportAsJson(series, java.time.LocalDateTime.now())
        def parsed = new ObjectMapper().readTree(json)
        def office = parsed.get('series').find { it.get('title').textValue() == 'The Office' }

    then: "the exported JSON includes the tags field"
        office.get('tags').textValue() == 'background watching'
}

def "SERIES-014-AC-12: exportAsCsv includes a tags column"() {
    given: "all series have been retrieved"
        def series = seriesService.getAll()

    when: "the series are exported as CSV"
        def csv = exportService.exportAsCsv(series)
        def lines = csv.trim().split("\n")

    then: "the header row contains the tags column"
        lines[0].contains("tags")
}

def "SERIES-014-AC-13: exportAsCsv quotes tags containing commas"() {
    given: "a series with a comma-separated tags value, among the retrieved series"
        seriesService.create(new SeriesDto(
            title: "Game of Thrones",
            tags: "rewatch candidate,watch with partner"
        ))
        def series = seriesService.getAll()

    when: "the series are exported as CSV"
        def csv = exportService.exportAsCsv(series)

    then: "the tags value containing commas is quoted"
        csv.contains('"rewatch candidate,watch with partner"')
}

def "SERIES-014-AC-14: exportAsCsv represents a null tags value as an empty string"() {
    given: "a series with no tags, among the retrieved series"
        seriesService.create(new SeriesDto(title: "No Tags Show"))
        def series = seriesService.getAll()

    when: "the series are exported as CSV"
        def csv = exportService.exportAsCsv(series)

    then: "the row does not contain the literal string null"
        !csv.contains("null")
}
```

**Test Case (Green)**: for each sketch above, implement the corresponding piece (`V006` migration, `SeriesEntity.tags`, `SeriesDto.tags`, `SeriesExportService` header/row changes) until the spec passes.

---

## Implementation Notes

- Implemented in the same pass as `series_spec_013_alternate_title.md` (both are additive changes to the same classes: `SeriesEntity`, `SeriesDto`, `SeriesService`, `SeriesExportService`).
- **AC-09's "including clearing it back to null" sub-clause is not achievable as literally written**, and this is a pre-existing limitation shared by every other optional field (`genres`, `personalNotes`, `posterUrl`), not something specific to `tags`. `SeriesService.update()` uses the codebase's established `if (dto.getX() != null) { entity.setX(...) }` null-if-unset pattern: a request body with `"tags": null` and a request body that omits `tags` entirely deserialize to the exact same DTO state (`dto.getTags() == null`), so they're indistinguishable at the point `update()` runs — neither can trigger "clear the stored value." Implementing true clear-via-PATCH semantics would require a new mechanism (e.g. a `JsonNullable`/wrapper-type field, or a raw-JSON-node presence check) that no field in this codebase currently uses, and per this task's explicit instruction ("no new pattern to invent, just extend the existing mapping code") that wasn't introduced here. `SeriesControllerSpec.groovy`'s test for AC-09 was written to assert the actual, established behavior (PATCH can set `tags` to a new value; omitting it in a subsequent PATCH leaves it unchanged) rather than the clearing behavior the spec's own TDD sketch assumed. Clear-via-PATCH for `tags` (and, by extension, every other optional string field) is a candidate for a future spec if that capability is actually needed.
- CSV column position: `tags` was placed immediately after `posterUrl` and before the date columns, per AC-12's explicit instruction (`imdbId` is not currently a CSV column at all, a pre-existing gap unrelated to this spec, so "after posterUrl/imdbId" simplified to "after posterUrl").
- `SeriesExportServiceSpec.groovy`'s pre-existing `"exportAsCsv has correct number of columns per row"` test asserted `headerCols == 17`; updated to `19` (17 existing + `alternateTitle` + `tags`) since both specs landed together — see `series_spec_013_alternate_title.md`'s own Implementation Notes for the same detail.

## Acceptance Criteria Summary

- [x] SERIES-014-AC-01: `tags` column added via `V006__add_tags_to_series.sql`
- [x] SERIES-014-AC-02: `idx_series_tags` index added in the same migration
- [x] SERIES-014-AC-03: `SeriesEntity.getTags()`/`setTags(String)`
- [x] SERIES-014-AC-04: `tags` accepts `null` without a validation violation
- [x] SERIES-014-AC-05: `tags` stored/returned verbatim (no normalization)
- [x] SERIES-014-AC-06: `SeriesDto.tags` getter/setter
- [x] SERIES-014-AC-07: `POST /api/v1/series` accepts and returns `tags`
- [x] SERIES-014-AC-08: `GET /api/v1/series` and `GET /api/v1/series/{id}` include `tags`, null-if-unset
- [x] SERIES-014-AC-09: `PATCH /api/v1/series/{id}` updates `tags` like any other optional field (see Implementation Notes re: the clearing sub-clause)
- [x] SERIES-014-AC-10: no format validation/parsing applied to `tags` content on any endpoint
- [x] SERIES-014-AC-11: JSON export includes `tags`
- [x] SERIES-014-AC-12: CSV export includes a `tags` column
- [x] SERIES-014-AC-13: CSV export quotes a `tags` value containing commas
- [x] SERIES-014-AC-14: CSV export renders a null `tags` value as an empty cell, not `"null"`
