# Spec 058: CSV Import

**Status**: Not started
**Priority**: P3 (`series_spec_038`'s own deferred scope, picked up as its own follow-up)
**Depends on**: `series_spec_038_import.md` (owns the async job/`BulkImportService`/
`ImportJobStatus` mechanism this spec plugs a second file format into, unchanged), `series_spec_004_export.md`
(owns `SeriesExportService.exportAsCsv`'s column order/quoting this spec's parser must exactly
reverse)
**Area**: Backend (`service/io/ImportFileParser.java`, `build.gradle.kts` (new dependency)) —
paired with Frontend Spec 114 (`frontend_spec_114_csv_import_ui.md`)

## Overview

`series_spec_038` shipped JSON-only import, explicitly deferring CSV: "correctly parsing
quoted/escaped CSV fields on read is materially riskier to hand-roll than writing them... a subtly
wrong parse could corrupt data on import in a way a JSON parse failure can't." This spec picks that
up, using a real CSV parsing library (per that same deferral's own suggestion) rather than a
hand-rolled reader.

`SeriesExportService.exportAsCsv` already defines the exact shape a CSV import must reverse: a
fixed 21-column header (`CSV_HEADERS`), one row per series in that column order, and RFC4180-style
quoting (a value containing `,`/`"`/newline is wrapped in `"..."` with internal `"` doubled). This
spec's parser is the literal inverse of that encoding — not a new, independently-designed CSV
shape.

## Design Decisions

- **Add `org.apache.commons:commons-csv` as a new direct Gradle dependency.** No CSV parsing
  library is on the backend classpath today (confirmed: no direct or transitive `commons-csv`/
  `opencsv`/similar in `build.gradle.kts`). Commons CSV is RFC4180-aware out of the box, avoiding a
  second hand-rolled parser alongside `SeriesExportService`'s existing hand-rolled *writer*.
- **Dispatch by file extension, not content sniffing.** `ImportFileParser.parse` inspects the
  uploaded filename: `.json` (case-insensitive) keeps today's existing JSON path unchanged; `.csv`
  (case-insensitive) takes the new CSV path. Any other extension is rejected with `400` before a
  job starts — extending `SERIES-038-AC-02`'s existing "structurally invalid file rejected before
  the job starts" posture to cover unrecognized file types too, not just malformed JSON.
- **Header row must match `CSV_HEADERS` exactly — same 21 columns, same order, case-sensitive.** A
  mismatch (missing, extra, reordered, or misspelled column) is rejected with `400` before the job
  starts, mirroring `SERIES-038-AC-02`'s precedent. This guarantees a re-uploaded, unmodified CSV
  export file works unchanged — the same guarantee JSON import already makes for its own format.
- **Row-to-`SeriesDto` mapping is the exact reverse of `SeriesExportService.csvRow`/`csv()`**:
  numeric columns (`year`, `totalSeasons`, `totalEpisodes`, `currentSeason`, `currentEpisode`,
  `rottenTomatoesPopcornmeter`, `tmdbVoteCount`, `personalRating`) parsed as integers; decimal
  columns (`imdbRating`, `rottenTomatoesRating`, `tmdbRating`) parsed as `BigDecimal`; date columns
  (`dateAdded`, `dateCompleted`) parsed with the same `ISO` formatter
  (`yyyy-MM-dd'T'HH:mm:ss'Z'`) export writes with; an empty cell maps to `null` for every column
  (mirroring export's `null` → `""`). `genres`/`tags`/`originCountry` are plain `String` fields on
  `SeriesDto` already (not lists at this layer) — Commons CSV's own RFC4180 unescaping already
  recovers the exact original comma-containing string from a quoted cell, so no extra multi-value
  parsing happens in this spec.
- **The `id` column is read but discarded.** `SeriesService.create` always generates a fresh id
  regardless of any incoming value (confirmed: `buildEntityFromDto` never consumes `dto.getId()`),
  and JSON import already behaves the same way — CSV import matches that existing behavior rather
  than introducing new id-preservation semantics.
- **An unparseable individual cell is a per-row error, not a file-level rejection.** A row with a
  non-numeric value in a numeric column, or an unparseable date, increments `errorCount` and
  appends a capped `ImportRowError` for that row — mirroring `SERIES-038-AC-03`'s existing per-row
  failure handling, so one bad cell in a large file doesn't block every other row.
- **Parsed CSV rows feed into the existing `BulkImportService.start(entries)` path unchanged.**
  Once `ImportFileParser` produces a `List<SeriesDto>`, everything downstream — the async job,
  duplicate-`imdbId` skip counting, per-row error tracking, `ImportJobStatus` polling — is identical
  to JSON import; this spec adds a second producer of that same list, not a second job mechanism.

## Requirements

### Requirement 1: `ImportFileParser` recognizes and validates CSV files

**User Story**: As a user, I want to import a previously exported CSV file the same way I can
already import a JSON export.

#### SERIES-058-AC-01 [AUTO]: `.csv` files are parsed via Commons CSV
**Statement**: When an uploaded import file's name ends in `.csv` (case-insensitive),
`ImportFileParser` shall parse it using Commons CSV rather than attempting JSON parsing.

**Rationale**: Core dispatch — this is what makes CSV import possible at all.

**References**: `service/io/ImportFileParser.java` (existing `parse(MultipartFile)`),
`build.gradle.kts` (new `commons-csv` dependency)

**Test Case (Red)**:
```groovy
def "SERIES-058-AC-01: a valid CSV export file is parsed into SeriesDto entries"() {
    given: "a valid CSV file matching SeriesExportService's own column order"
        def csv = "id,title,year,genres,totalSeasons,totalEpisodes,currentSeason,currentEpisode,status,imdbRating,rottenTomatoesRating,rottenTomatoesPopcornmeter,tmdbRating,tmdbVoteCount,personalRating,personalNotes,posterUrl,tags,originCountry,dateAdded,dateCompleted\n" +
            ",Show A,2020,Drama,3,24,,,WATCHING,8.5,,,,,,,,,,,\n"
        def file = new MockMultipartFile("file", "export.csv", "text/csv", csv.bytes)

    when: "parse is called"
        def entries = parser.parse(file)

    then: "one SeriesDto is returned with the expected fields"
        entries.size() == 1
        entries[0].title == "Show A"
        entries[0].year == 2020
}
```
**Test Case (Green)**: `ImportFileParser.parse` branches on filename extension; the CSV branch
reads the file via `CSVParser`/`CSVFormat.RFC4180().builder().setHeader().setSkipHeaderRecord(true).build()`
and maps each `CSVRecord` to a `SeriesDto`.

---

#### SERIES-058-AC-02 [AUTO]: a mismatched header row is rejected before the job starts
**Statement**: If a `.csv` file's header row does not exactly match `SeriesExportService.CSV_HEADERS`
(same columns, same order), then `ImportFileParser` shall reject the upload with `400` before any
import job starts.

**Rationale**: Guarantees a re-uploaded, unmodified CSV export round-trips exactly; catches a
malformed/hand-edited file up front rather than mid-job.

**Test Case (Red)**:
```groovy
def "SERIES-058-AC-02: a CSV with a missing column is rejected before starting a job"() {
    given: "a CSV missing the 'status' column"
        def csv = "id,title,year,genres\nabc,Show A,2020,Drama\n"
        def file = new MockMultipartFile("file", "bad.csv", "text/csv", csv.bytes)

    when: "POST /api/v1/series/import is called"
        def response = client.post().uri("/api/v1/series/import").multipart(file).exchange()

    then: "400, no job started"
        response.expectStatus().isBadRequest()
}
```
**Test Case (Green)**: header validation runs before any row is converted or `importService.start`
is called.

---

#### SERIES-058-AC-03 [AUTO]: an unrecognized file extension is rejected before the job starts
**Statement**: If an uploaded file's name ends in neither `.json` nor `.csv` (case-insensitive),
then the upload shall be rejected with `400` before any import job starts.

**Rationale**: Extends `SERIES-038-AC-02`'s "reject structurally invalid input up front" posture to
cover the new two-format dispatch.

**Test Case (Red)**:
```groovy
def "SERIES-058-AC-03: an unrecognized extension is rejected"() {
    given: "a .txt file"
        def file = new MockMultipartFile("file", "export.txt", "text/plain", "irrelevant".bytes)

    when: "POST /api/v1/series/import is called"
        def response = client.post().uri("/api/v1/series/import").multipart(file).exchange()

    then: "400, no job started"
        response.expectStatus().isBadRequest()
}
```
**Test Case (Green)**: extension check runs first, before either the JSON or CSV parsing branch.

---

### Requirement 2: Row parsing mirrors export's encoding, in reverse; malformed cells are per-row errors

**User Story**: As a user importing a large CSV, I want one bad cell in one row to be reported and
skipped, not to fail my entire import.

#### SERIES-058-AC-04 [AUTO]: row parsing matches `csvRow`'s column order/type formatting, reversed
**Statement**: Each CSV data row shall be converted to a `SeriesDto` using the exact reverse of
`SeriesExportService.csvRow`'s column order and per-field type formatting (integer/decimal/date
parsing, empty-cell-to-`null`), with the `id` column read but discarded.

**Rationale**: Core mapping correctness — a wrong column order or type mismatch would silently
corrupt imported data, exactly the risk `series_spec_038` originally deferred CSV to avoid.

**Test Case (Red)**:
```groovy
def "SERIES-058-AC-04: numeric, decimal, date, and empty cells map correctly"() {
    given: "a CSV row exercising every column type, including empty cells"
        def csv = "id,title,year,genres,totalSeasons,totalEpisodes,currentSeason,currentEpisode,status,imdbRating,rottenTomatoesRating,rottenTomatoesPopcornmeter,tmdbRating,tmdbVoteCount,personalRating,personalNotes,posterUrl,tags,originCountry,dateAdded,dateCompleted\n" +
            "ignored-id,Show A,2020,\"Drama,Comedy\",3,24,1,5,WATCHING,8.5,,,7.9,1200,4,,,,,2024-01-01T00:00:00Z,\n"
        def file = new MockMultipartFile("file", "export.csv", "text/csv", csv.bytes)

    when: "parse is called"
        def dto = parser.parse(file)[0]

    then: "fields are correctly typed, id is ignored, empty cells are null"
        dto.id == null
        dto.genres == "Drama,Comedy"
        dto.year == 2020
        dto.imdbRating == new BigDecimal("8.5")
        dto.rottenTomatoesRating == null
        dto.dateAdded == LocalDateTime.parse("2024-01-01T00:00:00")
        dto.dateCompleted == null
}
```
**Test Case (Green)**: field-by-field parsing in the CSV branch, mirroring `csvRow`'s field order.

---

#### SERIES-058-AC-05 [AUTO]: an unparseable cell is a per-row error, not a job failure
**Statement**: A CSV row containing an unparseable value in a numeric, decimal, or date column
shall increment `errorCount` and append a capped `ImportRowError` for that row, without failing the
rest of the job.

**Rationale**: Mirrors `SERIES-038-AC-03`'s existing per-row failure posture for JSON import.

**Test Case (Red)**:
```groovy
def "SERIES-058-AC-05: an unparseable cell is tracked as a row error, job still completes"() {
    given: "one valid row and one row with non-numeric year"
        def csv = validHeader() + "\n" +
            ",Show A,2020,Drama,,,,,,,,,,,,,,,,,\n" +
            ",Show B,not-a-year,Drama,,,,,,,,,,,,,,,,,\n"
        def file = new MockMultipartFile("file", "export.csv", "text/csv", csv.bytes)

    when: "the import job runs"
        importService.start(parser.parse(file))
        importService.awaitCompletionForTest()

    then: "one imported, one errored, job completes"
        def status = importService.status()
        status.status() == COMPLETED
        status.importedCount() == 1
        status.errorCount() == 1
}
```
**Test Case (Green)**: per-row parsing wraps type coercion in a try/catch, routing a failure into
the same `errorCount`/`errors` accumulation `BulkImportService` already uses for JSON rows.

---

#### SERIES-058-AC-06 [AUTO]: parsed CSV entries flow through the existing import job unchanged
**Statement**: Once converted, CSV-derived `SeriesDto` entries shall be processed by the existing
`BulkImportService.start(entries)` path exactly as JSON-derived entries are today — same
duplicate-`imdbId` skip counting, per-row error tracking, and `ImportJobStatus` shape.

**Rationale**: No second job/status mechanism should exist for a second file format.

**Test Case (Green)**: no new code path in `BulkImportService` — verified by
`SERIES-058-AC-05`'s test above reusing the exact same `ImportJobStatus` fields JSON import's own
tests already assert on.

## Implementation Notes

- **`API.md`** — `POST /api/v1/series/import`'s entry gains a note that `.csv` (matching
  `SeriesExportService`'s own export column order) is now accepted alongside `.json`.
- **`RUNBOOK.md`** — no new config property.
- **`build.gradle.kts`** — add `implementation("org.apache.commons:commons-csv:<latest>")`.

## Cross-References

| This spec | Source |
|---|---|
| Async job/status/dedup-skip mechanism this spec plugs into unchanged | `series_spec_038_import.md` |
| CSV column order/quoting this spec's parser reverses | `series_spec_004_export.md`, `service/io/SeriesExportService.java` (`CSV_HEADERS`, `csvRow`, `csv`) |
| Existing JSON parsing this spec's dispatch sits alongside | `service/io/ImportFileParser.java` |
| Frontend consumer | `frontend_spec_114_csv_import_ui.md` |

## Acceptance Criteria Summary

- [ ] SERIES-058-AC-01: `.csv` files are parsed via Commons CSV
- [ ] SERIES-058-AC-02: a mismatched header row is rejected before the job starts
- [ ] SERIES-058-AC-03: an unrecognized file extension is rejected before the job starts
- [ ] SERIES-058-AC-04: row parsing matches `csvRow`'s column order/type formatting, reversed
- [ ] SERIES-058-AC-05: an unparseable cell is a per-row error, not a job failure
- [ ] SERIES-058-AC-06: parsed CSV entries flow through the existing import job unchanged
