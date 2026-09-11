# Spec 061: Series Original Language

**Status**: Implemented
**Priority**: P3 (quality-of-life — surfaces data TMDB already returns but this app never captured)
**Depends on**: Series Spec 012 (`TmdbClient.search`/`details`, `TmdbSearchCandidate`/`TmdbSeriesDetail`), Series Spec 017 (TMDB-primary resolve, `SeriesLookupService.resolveTmdbCandidate`), Series Spec 018 (`SeriesRefreshService`), Series Spec 021 (`originCountry`, the closest-precedent spec this one mirrors field-for-field)
**Backend Task**

## Overview

A user asked whether a tracked series' language could be shown on its detail page. TMDB's `GET /tv/{id}` (and `GET /search/tv`) responses carry `original_language`, an ISO 639-1 code (e.g. `"en"`, `"ko"`, `"ja"`) — this app already reads that exact field for recommendation *candidates* (`TmdbCandidate.originalLanguage`, `series_spec_007`'s `RecommendationOutputFilterService`/Discover language filter), but never for a *tracked* series: `TmdbSeriesDetail`/`SeriesEntity` have no language field at all today. This spec captures it end-to-end for tracked series — TMDB parsing, the lookup-result DTO, the persisted entity, refresh, export, and CSV import — so `originalLanguage` reaches the frontend the same way `originCountry` already does. See the companion `frontend_spec_117_series_language_display.md` for where it's actually shown (immediately after the "Overview" field on `SeriesDetail`, per the user's own request).

**Design decisions**:
- **Named `originalLanguage`, matching this codebase's own existing precedent** — `TmdbCandidate`/`RecommendationCriteria` already use exactly this name for the same TMDB `original_language` field on the recommendations side (`series_spec_007`, `SERIES-007-AC-23`). Reusing the name keeps one concept named one way across the codebase, rather than introducing a second name (`language`) for the same underlying data.
- **A single raw ISO 639-1 code is stored, not a resolved language name.** Same reasoning as `originCountry`'s own Design Decisions: resolving `"en"` → `"English"` needs no lookup table — it's natively available via `Intl.DisplayNames({type: 'language'})` in every evergreen browser (and this app already has a private `formatLanguageName` helper doing exactly this for the Discover language filter — see the companion frontend spec's Requirement 2, which extracts it into a shared utility). Storing the raw code, not a resolved name, also keeps the door open for a future "filter my series by language" feature without re-deriving the code from a display string.
- **No multi-value widening needed, unlike `originCountry`.** TMDB's `original_language` is always a single code (never an array), so there's no `series_spec_046_multi_origin_country.md`-style comma-join concern here — a plain `VARCHAR(2)` column is sufficient and stays sufficient.
- **No format validation on the incoming code.** Same posture as `originCountry`/`imdbId` — trust the upstream API's own data rather than defensively regex-validating a value this app doesn't construct itself.
- **`TmdbSearchCandidate`/`TmdbLookupCandidateDto` (the pre-resolve candidate *picker* list) are out of scope.** Unlike `originCountry` (added there specifically to disambiguate same-titled remakes before picking one), nothing about this spec's purpose — showing a tracked series' own language on its detail page — needs the field earlier than the single already-resolved candidate (`TmdbSeriesDetail`/`SeriesLookupDto`). Only `TmdbClient.details(tmdbId)` (`GET /tv/{id}`) is touched, not `TmdbClient.search(query)` (`GET /search/tv`).
- **`recommendations`/`similar`/`discover` (`TmdbCandidate`) are unaffected and untouched.** That's a separate, already-shipped feature (`series_spec_007`'s Discover language filter) with its own independent data flow; this spec only adds the equivalent field to the *tracked-series* side, which never had it.

---

## Requirements

### Requirement 1: TMDB Client Parses Original Language

**User story**: As a developer, I want `original_language` parsed the same way every other TMDB-sourced field on a tracked series already is, so nothing downstream needs its own JSON-parsing logic.

#### Acceptance Criteria

- **SERIES-061-AC-01** [AUTO]: `TmdbClient.details(tmdbId)` (`GET /tv/{id}`) shall parse the response's `original_language` field and expose it as a new `originalLanguage` (`String`) field on `TmdbSeriesDetail` — `null` when the field is absent.

### Requirement 2: Original Language Surfaced Through the Resolve Endpoint

**User story**: As a user, I want a resolved TMDB candidate's language available to the app the moment it's looked up, the same way its origin country and production status already are.

#### Acceptance Criteria

- **SERIES-061-AC-02** [AUTO]: `SeriesLookupDto` (backing `GET /api/v1/series/lookup/resolve-tmdb`) shall gain `originalLanguage` (`String`), populated by `SeriesLookupService`'s `TmdbSeriesDetail → SeriesLookupDto` mapping (`toDto(TmdbSeriesDetail)`), alongside its existing `originCountry`/`productionStatus`/`overview` fields.

### Requirement 3: Original Language Persistence

**User story**: As a user, I want my tracked series to remember its original language, populated the moment I add it — not just after an explicit refresh.

#### Acceptance Criteria

- **SERIES-061-AC-03** [AUTO]: `SeriesEntity` and `SeriesDto` shall each gain `originalLanguage` (`String`, nullable, length 2).
- **SERIES-061-AC-04** [AUTO]: `SeriesMapper.toEntity(SeriesDto)` shall persist `originalLanguage` from the incoming `SeriesDto` unchanged, and `SeriesMapper.toDto(SeriesEntity)` shall round-trip it back out — the same direct flow-through precedent `originCountry`/`overview` already use in this class.

### Requirement 4: Keeping Original Language Fresh On Refresh

**User story**: As a user, if a TMDB record's language is ever corrected upstream, I want a refresh to pick that up like every other TMDB-sourced field does.

#### Acceptance Criteria

- **SERIES-061-AC-05** [AUTO]: `SeriesRefreshService.refresh`'s TMDB branch shall update `originalLanguage` from the fresh `TmdbSeriesDetail` whenever it's non-null — same branch, same non-fatal-on-failure posture, and the same "only overwrite when the fresh value is present" guard `overview`/`lastAirYear` already use (`SERIES-018-AC-02`/`AC-05`).

### Requirement 5: Export & Import

**User story**: As a user, I want an exported copy of my collection to include each series' original language, and a re-imported CSV to bring it back, so a round-trip through export/import doesn't silently drop it.

#### Acceptance Criteria

- **SERIES-061-AC-06** [AUTO]: `SeriesExportService`'s `CSV_HEADERS` shall include `originalLanguage`, appended immediately after `originCountry`; the CSV row-builder shall write `s.getOriginalLanguage()` in that column. JSON export needs no code change — `exportAsJson` serializes `List<SeriesDto>` directly via Jackson, so the field is included automatically once `SeriesDto` has it (`SERIES-061-AC-03`).
- **SERIES-061-AC-07** [AUTO]: `ImportFileParser`'s CSV row mapping shall read an `originalLanguage` column via `cell(csvRecord, "originalLanguage")`, the same pattern `originCountry` already uses. JSON import needs no code change — it deserializes directly into `SeriesDto` via Jackson.

### Requirement 6: Schema Migration

**User story**: As a developer, I want the `series` table to carry a column for this new field.

#### Acceptance Criteria

- **SERIES-061-AC-08** [AUTO]: A new Flyway migration `V012__add_original_language_to_series.sql` shall add a nullable `original_language VARCHAR(2)` column to the `series` table.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `TmdbClient.details`, `TmdbSeriesDetail`, `SeriesLookupService.toDto(TmdbSeriesDetail)` | `series_spec_012_tmdb_lookup_fallback.md`, `series_spec_017_tmdb_primary_lookup.md` |
| `SeriesRefreshService`'s TMDB refresh branch, its non-fatal-on-failure posture | `series_spec_018_series_refresh.md` |
| Field-for-field precedent this spec mirrors (`originCountry`'s parse → DTO → entity → refresh → export shape), and why no multi-value widening is needed here | `series_spec_021_origin_country.md` |
| `originalLanguage`'s existing name/shape on the *recommendations* side (a separate, unaffected data flow this spec's naming stays consistent with) | `series_spec_007_recommendation_sourcing.md` (`TmdbCandidate.originalLanguage`, `SERIES-007-AC-23`) |
| Frontend consumer: shared `formatLanguageName` utility (extracted from its current single, private use), `AddSeriesForm` carry-through, `SeriesDetail` display after Overview | `frontend_spec_117_series_language_display.md` (companion spec) |

---

## TDD Test Case Sketches

### `TmdbClientSpec.groovy`

```groovy
def "SERIES-061-AC-01: details maps original_language onto TmdbSeriesDetail"() {
    given: "a TMDB detail response with an original_language field"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/2996")))
            .andRespond(withSuccess('''
                {"name": "The Office", "original_language": "en", "genres": []}
            ''', MediaType.APPLICATION_JSON))

    when: "details(2996) is called"
        def detail = tmdbClient.details(2996)

    then: "originalLanguage is the parsed value"
        detail.originalLanguage() == "en"
}

def "SERIES-061-AC-01: an absent original_language maps to a null originalLanguage"() {
    given: "a TMDB detail response with no original_language field"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/1")))
            .andRespond(withSuccess('{"name": "Show", "genres": []}', MediaType.APPLICATION_JSON))

    when: "details(1) is called"
        def detail = tmdbClient.details(1)

    then: "originalLanguage is null"
        detail.originalLanguage() == null
}
```

### `SeriesLookupServiceSpec.groovy`

```groovy
def "SERIES-061-AC-02: resolve carries originalLanguage through from TMDB detail"() {
    given: "TmdbClient.details resolves a full detail with originalLanguage"
        tmdbClient.details(2996) >> new TmdbSeriesDetail(
            "The Office", 2001, [35], "/poster.jpg", 2, 14,
            new BigDecimal("7.7"), 450, ProductionStatus.ENDED, ["GB"], "An overview.", 2003, "en")
        tmdbClient.externalIds(2996) >> Optional.empty()

    when: "resolveTmdbCandidate(2996) is called"
        def result = lookupService.resolveTmdbCandidate(2996)

    then: "originalLanguage is present on the result"
        result.originalLanguage == "en"
}
```

### `SeriesMapperSpec.groovy` (or `SeriesServiceSpec.groovy`, wherever `SeriesMapper` is currently tested)

```groovy
def "SERIES-061-AC-04: toEntity/toDto round-trip originalLanguage unchanged"() {
    given: "a SeriesDto with originalLanguage set"
        def dto = new SeriesDto(title: "The Office", originalLanguage: "en")

    when: "toEntity(dto) then toDto(entity) round-trips it"
        def entity = SeriesMapper.toEntity(dto)
        def roundTripped = SeriesMapper.toDto(entity)

    then: "originalLanguage survives unchanged"
        entity.originalLanguage == "en"
        roundTripped.originalLanguage == "en"
}
```

### `SeriesRefreshServiceSpec.groovy`

```groovy
def "SERIES-061-AC-05: a successful TMDB refresh updates originalLanguage"() {
    given: "an existing series and a fresh TMDB detail with originalLanguage"
        tmdbClient.findTvIdByImdbId(_) >> Optional.of(2996)
        tmdbClient.details(2996) >> new TmdbSeriesDetail(
            "The Office", 2001, [35], "/poster.jpg", 2, 14,
            new BigDecimal("7.7"), 450, ProductionStatus.ENDED, ["GB"], "An overview.", 2003, "en")

    when: "refresh(id) is called"
        def result = refreshService.refresh(existing.id)

    then: "originalLanguage reflects the fresh TMDB value"
        result.series.originalLanguage == "en"
}
```

### `SeriesExportServiceSpec.groovy`

```groovy
def "SERIES-061-AC-06: CSV headers include originalLanguage"() {
    when: "a CSV export is generated"
        def csv = exportService.exportAsCsv([])

    then: "the header row includes originalLanguage, immediately after originCountry"
        def headers = csv.readLines().first().split(",")
        def countryIndex = headers.findIndexOf { it == "originCountry" }
        headers[countryIndex + 1] == "originalLanguage"
}
```

### `ImportFileParserSpec.groovy`

```groovy
def "SERIES-061-AC-07: CSV import reads the originalLanguage column"() {
    given: "a CSV row with an originalLanguage value"
        def csv = "title,originalLanguage\nThe Office,en\n"

    when: "the file is parsed"
        def dtos = parser.parseCsv(csv.bytes)

    then: "originalLanguage is carried onto the resulting SeriesDto"
        dtos[0].originalLanguage == "en"
}
```

### Flyway integration test

```groovy
def "SERIES-061-AC-08: fresh migrate() adds the original_language column"() {
    when: "flyway.migrate() runs including V012"
        // flyway.migrate()

    then: "the series table has an original_language column"
        // column introspection confirms original_language VARCHAR(2) exists
}
```

---

## Acceptance Criteria Summary

- [x] SERIES-061-AC-01: `TmdbClient.details` parses `original_language` onto `TmdbSeriesDetail`
- [x] SERIES-061-AC-02: `SeriesLookupDto` gains `originalLanguage`
- [x] SERIES-061-AC-03: `SeriesEntity`/`SeriesDto` gain `originalLanguage`
- [x] SERIES-061-AC-04: `SeriesMapper` persists/round-trips `originalLanguage`
- [x] SERIES-061-AC-05: `SeriesRefreshService.refresh` updates `originalLanguage`
- [x] SERIES-061-AC-06: export includes `originalLanguage`
- [x] SERIES-061-AC-07: CSV import reads `originalLanguage`
- [x] SERIES-061-AC-08: `V012__add_original_language_to_series.sql` migration
