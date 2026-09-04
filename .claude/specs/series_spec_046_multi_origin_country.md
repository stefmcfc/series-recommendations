# Series Spec 046: Store and Surface All TMDB Origin Countries, Not Just the First

**Status**: Complete
**Priority**: P3 (data-correctness gap — a co-production's non-first origin country is silently
discarded everywhere, including the recommendations output filter it can cause incorrect exclusions
in)
**Depends on**: Series Spec 021 (`series_spec_021_origin_country.md`, owns the single-value
`originCountry` field and `TmdbClient.firstOriginCountry` this spec widens) ✅, Series Spec 032
(`series_spec_032_custom_search_language_country_filters.md`, owns `RecommendationOutputFilterService
.matchesCountries` and `TmdbCandidate.originCountry`, both fixed by this spec) ✅
**Area**: Backend (`client/tmdb/TmdbClient.java` and its 3 record types, `model/SeriesEntity.java`,
`dto/SeriesDto.java`/`SeriesLookupDto.java`/`TmdbLookupCandidateDto.java`/`RecommendationDto.java`,
`service/SeriesLookupService.java`, `service/refresh/SeriesRefreshService.java`,
`service/recommendation/RecommendationDtoAssembler.java`/`RecommendationOutputFilterService.java` —
no Flyway migration, see SERIES-046-AC-08) — paired with Frontend Spec 085
(`frontend_spec_085_multi_origin_country_display.md`) for display.

## Overview

TMDB's `origin_country` field is an array (e.g. `["GB", "US"]` for a UK/US co-production like
"MobLand"), but `TmdbClient.firstOriginCountry` — used by every TMDB-reading code path in this
app — takes only `list.getFirst()` and silently discards the rest. This was a deliberate scoping
decision in `series_spec_021` ("the overwhelming majority... has exactly one" origin country), which
also explicitly scoped the `recommendations`/`similar`/`discover` path (`TmdbCandidate`) *out* of that
spec entirely. `series_spec_032` later added its own single-value `originCountry` to `TmdbCandidate`
anyway (for the Custom Search country filter, `RecommendationOutputFilterService.matchesCountries`),
so the same first-entry-only limitation exists in the recommendations path today too, undocumented as
a shared gap until now.

This spec widens origin-country handling end-to-end to capture every entry TMDB reports, for both the
tracked-series path (`SeriesEntity`/lookup/export) and the recommendations path
(`TmdbCandidate`/`matchesCountries`). It follows this codebase's own existing precedent for
multi-value fields: `SeriesEntity.genres`/`.tags` are both comma-separated `String` columns, not join
tables — reserved for fields needing COUNT/AVG-style aggregation (keywords), which origin country
doesn't need. `originCountry` stays a comma-separated `String` at every DTO/entity boundary,
identical in shape to how `TmdbClient`'s `genre_ids` (a `List<Integer>` internally) is joined into a
comma-separated display-name string via `TmdbGenreTable.joinDisplayNames` before it ever reaches a
DTO — origin country needs no display-name resolution server-side (raw ISO codes are stored, per
`series_spec_021`'s own design decision, unchanged by this spec), just the equivalent join step.

## Design Decisions

- **`TmdbClient`'s three origin-country-bearing records (`TmdbSeriesDetail`, `TmdbSearchCandidate`,
  `TmdbCandidate`) gain a `List<String> originCountries` field, replacing their single `String
  originCountry` field.** A genuine list at this internal parsing layer, mirroring `genreIds`'
  existing `List<Integer>` shape on the same records — not a wire type, so there's no reason to force
  it into a joined string this early. `firstOriginCountry(Object value)` is replaced by
  `originCountries(Object value): List<String>`, returning every entry (empty list, not null, when
  the field is absent/empty — matching `toIntegerList`'s existing empty-list-not-null convention for
  the sibling `genre_ids` parser).
- **Every DTO/entity boundary keeps a single comma-separated `String originCountry` field, unchanged
  in type.** `SeriesEntity`, `SeriesDto`, `SeriesLookupDto`, `TmdbLookupCandidateDto`,
  `RecommendationDto` all keep their existing `String originCountry` — only the *value* they can now
  carry changes (e.g. `"GB,US"` instead of always being a single code). This is a deliberately
  minimal, additive change to every wire contract: no consumer that already handles `originCountry` as
  `string | null` needs a type change, only display logic needs to handle a possible multi-value
  string (Frontend Spec 085).
- **A new small join helper, colocated with the parsing logic it complements.** `TmdbClient` gains a
  public static `joinOriginCountries(List<String> originCountries): String` (returns `null` for a
  null/empty list, `String.join(",", ...)` otherwise) — the same shape as `TmdbGenreTable
  .joinDisplayNames`, but simpler (no id-to-name resolution needed, just a join), so it doesn't
  warrant a whole new service class. Every one of the 4 call sites that currently does
  `dto.setOriginCountry(candidate.originCountry())` / `entity.setOriginCountry(detail.originCountry())`
  (`SeriesLookupService`'s two `toDto` overloads, `SeriesRefreshService.refreshFromTmdb`'s branch, and
  `RecommendationDtoAssembler.toDto`) switches to `TmdbClient.joinOriginCountries(candidate
  .originCountries())` instead.
- **No delimiter other than a bare comma (`,`), not `", "` (comma-space).** Matches `SeriesEntity
  .genres`'s own storage convention exactly (comma, no space — display-time formatting adds the
  space, same split as Frontend Spec 085 does). Keeps `originCountry` consistent with the one other
  comma-delimited field already on this entity, rather than inventing a second delimiter convention.
- **`RecommendationOutputFilterService.matchesCountries` operates on `TmdbCandidate.originCountries`
  (the list) directly, before the join to `RecommendationDto` ever happens** — no parsing needed on
  that side, since it already runs pre-DTO-assembly. Widened from "does the candidate's one country
  match any selected filter country" to "does *any* of the candidate's countries match any selected
  filter country" — a true set-intersection check, replacing the single-value `equalsIgnoreCase`.
- **`SeriesEntity.originCountry`'s declared length widens from 2 to 50, entity-annotation only, no
  Flyway migration** — confirmed empirically (see SERIES-046-AC-08) that SQLite neither enforces
  column length at the storage layer nor checks it at Hibernate `validate` time for this dialect, and
  that a real `ALTER COLUMN` migration isn't expressible in SQLite at all (tested, not assumed — it
  fails with a syntax error). 50 is enough headroom for any realistic number of comma-joined
  2-character codes (TMDB co-productions rarely list more than a handful), well under `genres`' own
  `length = 500`, since origin-country lists are inherently short.
- **Refresh keeps its existing unconditional-overwrite behavior, now for the full joined value** —
  `SeriesRefreshService`'s TMDB branch already overwrites `originCountry` from a fresh
  `TmdbSeriesDetail` on every refresh regardless of the entity's current value (`series_spec_021`
  `SERIES-021-AC-09`; `originCountry` isn't one of `series_spec_040`'s TMDB-managed-locked fields, so
  this was never guarded either way). No change to that posture — just confirmed explicitly here as a
  regression guard, since the value it overwrites with can now be a joined multi-country string.
- **Export needs no code change.** `SeriesExportService`'s CSV/JSON export already serializes whatever
  `SeriesDto.originCountry` holds as a plain string column (`series_spec_021` `SERIES-021-AC-10`) — a
  comma-joined multi-country value flows through unchanged. Covered here as a regression-guard AC, not
  new implementation.

---

## Requirement 1: `TmdbClient` parses every `origin_country` entry, not just the first

**User story**: As a developer, I want every TMDB-reading code path to capture the full
`origin_country` array, so nothing downstream is missing data TMDB actually returned.

### SERIES-046-AC-01 [AUTO]
**Statement**: `TmdbClient.details(tmdbId)` (`GET /tv/{id}`) shall parse every entry of the response's
`origin_country` array onto `TmdbSeriesDetail.originCountries` (`List<String>`) — an empty list, not
null, when the field is absent or empty.

**Test Case (Red)**:
```groovy
def "SERIES-046-AC-01: details maps every origin_country entry onto TmdbSeriesDetail"() {
    given: "a TMDB detail response with a multi-entry origin_country array"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/2996")))
            .andRespond(withSuccess('''
                {"name": "MobLand", "origin_country": ["GB", "US"], "genres": []}
            ''', MediaType.APPLICATION_JSON))

    when: "details(2996) is called"
        def detail = tmdbClient.details(2996)

    then: "originCountries carries both entries, in order"
        detail.originCountries() == ["GB", "US"]
}
```
**Test Case (Green)**: replace `firstOriginCountry` with `originCountries(Object value): List<String>`
returning every entry (`List.of()` when absent/empty), used at the `details()` call site.

---

### SERIES-046-AC-02 [AUTO]
**Statement**: `TmdbClient.search(query)` (`GET /search/tv`) shall parse every entry of each result's
`origin_country` array onto `TmdbSearchCandidate.originCountries` (`List<String>`) — an empty list
when absent or empty.

**Test Case (Red)**:
```groovy
def "SERIES-046-AC-02: search maps every origin_country entry onto TmdbSearchCandidate"() {
    given: "a TMDB search result with a multi-entry origin_country array"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("search/tv")))
            .andRespond(withSuccess('''
                {"results": [{"id": 2996, "name": "MobLand", "origin_country": ["GB", "US"]}]}
            ''', MediaType.APPLICATION_JSON))

    when: "search(\"MobLand\") is called"
        def results = tmdbClient.search("MobLand")

    then: "originCountries carries both entries"
        results[0].originCountries() == ["GB", "US"]
}
```
**Test Case (Green)**: same `originCountries` helper, used at `mapSearchResults`'s call site.

---

### SERIES-046-AC-03 [AUTO]
**Statement**: `TmdbClient`'s `recommendations`/`similar`/`discover` path (`mapResults`) shall parse
every entry of each result's `origin_country` array onto `TmdbCandidate.originCountries`
(`List<String>`) — an empty list when absent or empty.

**Test Case (Red)**:
```groovy
def "SERIES-046-AC-03: recommendations/similar/discover map every origin_country entry onto TmdbCandidate"() {
    given: "a TMDB discover/recommendations response with a multi-entry origin_country array"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("discover/tv")))
            .andRespond(withSuccess('''
                {"results": [{"id": 2996, "name": "MobLand", "origin_country": ["GB", "US"]}]}
            ''', MediaType.APPLICATION_JSON))

    when: "discover(...) is called"
        def results = tmdbClient.discover(new DiscoverFilters(null, null, null, null, null, null, null))

    then: "originCountries carries both entries"
        results[0].originCountries() == ["GB", "US"]
}
```
**Test Case (Green)**: same `originCountries` helper, used at `mapResults`'s call site.

---

## Requirement 2: A shared join helper produces the comma-separated wire value

**User story**: As a developer, I want one place that joins a parsed origin-country list into the
comma-separated string every DTO/entity actually stores, so the join logic isn't duplicated at each
of the 4 call sites that need it.

### SERIES-046-AC-04 [AUTO]
**Statement**: `TmdbClient.joinOriginCountries(List<String> originCountries)` shall return a
comma-joined `String` (e.g. `"GB,US"`) when the list is non-empty, and `null` when the list is null or
empty.

**Test Case (Red)**:
```groovy
def "SERIES-046-AC-04: joinOriginCountries comma-joins a multi-entry list"() {
    expect: "a multi-entry list joins with a bare comma, no space"
        TmdbClient.joinOriginCountries(["GB", "US"]) == "GB,US"

    and: "a single-entry list returns that one value unchanged"
        TmdbClient.joinOriginCountries(["GB"]) == "GB"

    and: "an empty or null list returns null"
        TmdbClient.joinOriginCountries([]) == null
        TmdbClient.joinOriginCountries(null) == null
}
```
**Test Case (Green)**: `public static String joinOriginCountries(List<String> originCountries)` on
`TmdbClient`, mirroring `TmdbGenreTable.joinDisplayNames`'s null/empty-list handling.

---

## Requirement 3: Origin countries surfaced through lookup endpoints

**User story**: As a user, I want to see every one of a candidate's origin countries in the TMDB
search results, not just one, so I can tell a co-production apart from a single-country show before
picking it.

### SERIES-046-AC-05 [AUTO]
**Statement**: `TmdbLookupCandidateDto` (backing `GET /api/v1/series/lookup/search-tmdb`) shall carry
`originCountry` as the comma-joined value of the matching `TmdbSearchCandidate.originCountries`,
populated by `SeriesLookupService`'s `TmdbSearchCandidate → TmdbLookupCandidateDto` mapping via
`TmdbClient.joinOriginCountries`.

**Test Case (Red)**:
```groovy
def "SERIES-046-AC-05: TMDB search candidates carry every origin country through to the picker DTO"() {
    given: "TmdbClient.search returns a candidate with two origin countries"
        tmdbClient.search("MobLand") >> [
            new TmdbSearchCandidate(2996, "MobLand", null, 2025, "/poster.jpg", [], ["GB", "US"])
        ]

    when: "searchTmdb(\"MobLand\") is called"
        def results = lookupService.searchTmdb("MobLand")

    then: "the picker DTO carries both, comma-joined"
        results[0].originCountry == "GB,US"
}
```
**Test Case (Green)**: `toDto(TmdbSearchCandidate)` calls
`TmdbClient.joinOriginCountries(candidate.originCountries())` instead of `candidate.originCountry()`.

---

### SERIES-046-AC-06 [AUTO]
**Statement**: `SeriesLookupDto` (backing `GET /api/v1/series/lookup/resolve-tmdb`) shall carry
`originCountry` as the comma-joined value of the resolved `TmdbSeriesDetail.originCountries`,
populated by `SeriesLookupService`'s `TmdbSeriesDetail → SeriesLookupDto` mapping via the same helper.

**Test Case (Red)**:
```groovy
def "SERIES-046-AC-06: resolve carries every origin country through from TMDB detail"() {
    given: "TmdbClient.details resolves a detail with two origin countries"
        tmdbClient.details(2996) >> new TmdbSeriesDetail(
            "MobLand", 2025, [80], "/poster.jpg", 1, 10,
            new BigDecimal("7.5"), 200, ProductionStatus.RETURNING, ["GB", "US"], null, null)
        tmdbClient.externalIds(2996) >> Optional.empty()

    when: "resolveTmdbCandidate(2996) is called"
        def result = lookupService.resolveTmdbCandidate(2996)

    then: "originCountry is both entries, comma-joined"
        result.originCountry == "GB,US"
}
```
**Test Case (Green)**: `toDto(TmdbSeriesDetail)` calls
`TmdbClient.joinOriginCountries(detail.originCountries())` instead of `detail.originCountry()`.

---

## Requirement 4: Persistence carries every origin country

**User story**: As a user, I want my tracked series to remember every one of its origin countries,
not just the first, so a co-production I add is stored the way TMDB actually reports it.

### SERIES-046-AC-07 [AUTO]
**Statement**: `SeriesEntity` and `SeriesDto` shall each keep `originCountry` as a `String` (unchanged
type), now able to carry a comma-separated multi-country value; `SeriesService.create` shall persist
it from the incoming `SeriesDto` unchanged, exactly as `series_spec_021`'s `SERIES-021-AC-06` already
established for the single-value case — no code change to `SeriesService` itself, this is a
regression guard confirming multi-value data flows through the existing unchanged assignment.

**Test Case (Red)**:
```groovy
def "SERIES-046-AC-07: create persists a multi-country originCountry unchanged"() {
    given: "a SeriesDto with a comma-joined multi-country originCountry"
        def dto = new SeriesDto(title: "MobLand", originCountry: "GB,US")

    when: "create(dto) is called"
        def created = seriesService.create(dto)

    then: "the full value is persisted unchanged"
        created.originCountry == "GB,US"
}
```
**Test Case (Green)**: no code change — `SeriesService.create`'s existing
`entity.setOriginCountry(dto.getOriginCountry())` already flows through any string value unchanged.

---

### SERIES-046-AC-08 [AUTO]
**Statement**: `SeriesEntity.originCountry`'s `@Column` annotation shall widen from `length = 2` to
`length = 50`, so a comma-joined multi-country value (e.g. `"GB,US,FR"`) round-trips through create
and reload without truncation.

**Resolved during spec review (2026-09-04), empirically — no Flyway migration needed**: tested
directly against this project's real dev database. (1) Widening only the entity's
`@Column(length = 50)` with *no* corresponding DDL change and restarting the app: Hibernate's
`ddl-auto: validate` (via the community `SQLiteDialect`) started cleanly against the still-`VARCHAR(2)`
column — this dialect doesn't check declared `VARCHAR` precision at validate time, and SQLite itself
has no storage-level length enforcement at all (type affinity, not enforced precision) — so there is
nothing to migrate for this app's actual runtime database. (2) A real migration attempting
`ALTER TABLE series ALTER COLUMN origin_country TYPE VARCHAR(50);` (valid PostgreSQL syntax, since
this app is documented to run on PostgreSQL in production eventually) fails outright against SQLite —
`[SQLITE_ERROR] SQL error or missing database (near "TYPE": syntax error)` — SQLite's `ALTER TABLE`
has no `ALTER COLUMN` support at all, confirmed by testing, not assumed. A portable migration valid on
both dialects doesn't exist for a true column-type change (unlike `V001`–`V010`, which are all
`ADD COLUMN` — syntax common to both, which is *why* none of them needed to solve this problem
before). **Decision: widen only the entity annotation, add no `V011` migration.** If/when this app
gets a real PostgreSQL deployment, that's the point to write a dialect-specific migration against the
dialect actually in use then — solving it now, untested against a database that doesn't exist yet,
would be false confidence, not a real fix.

**Test Case (Red)**:
```groovy
def "SERIES-046-AC-08: a multi-country value round-trips through create without truncation"() {
    given: "a SeriesDto with a comma-joined multi-country originCountry longer than 2 characters"
        def dto = new SeriesDto(title: "MobLand", originCountry: "GB,US,FR")

    when: "create(dto) is called and the entity is re-fetched from the real (non-mocked) repository"
        def created = seriesService.create(dto)
        def reloaded = seriesRepository.findById(created.id).get()

    then: "the full value persisted and reloaded without truncation"
        reloaded.originCountry == "GB,US,FR"
}
```
**Test Case (Green)**: `SeriesEntity.originCountry`'s `@Column(length = 2)` becomes
`@Column(length = 50)` — no migration file. This AC specifically needs an integration-style test (real
repository, real SQLite via the test profile's own database, not a mocked `SeriesRepository`), since
the whole point is confirming the actual persisted column accepts the wider value.

---

## Requirement 5: Recommendations carry and correctly filter on every origin country

**User story**: As a user filtering Custom Search recommendations by country, I want a co-production
candidate to match if *any* of its origin countries is one I selected, not just its first-listed one.

### SERIES-046-AC-09 [AUTO]
**Statement**: `RecommendationDto` shall keep `originCountry` as a `String` (unchanged type), now
carrying the comma-joined value of the source `TmdbCandidate.originCountries`, populated by
`RecommendationDtoAssembler.toDto` via `TmdbClient.joinOriginCountries`.

**Test Case (Red)**:
```groovy
def "SERIES-046-AC-09: assembled RecommendationDto carries every origin country, comma-joined"() {
    given: "a DedupedCandidate wrapping a TmdbCandidate with two origin countries"
        def candidate = new TmdbCandidate(2996, "MobLand", 2025, "overview", "/poster.jpg",
            new BigDecimal("7.5"), [80], 200, "en", ["GB", "US"])
        def dc = new DedupedCandidate(candidate, [], null)

    when: "toDto(dc, 5) is called"
        def dto = assembler.toDto(dc, 5)

    then: "originCountry is both entries, comma-joined"
        dto.originCountry == "GB,US"
}
```
**Test Case (Green)**: `RecommendationDtoAssembler.toDto` calls
`TmdbClient.joinOriginCountries(c.originCountries())` instead of `c.originCountry()`.

---

### SERIES-046-AC-10 [AUTO]
**Statement**: `RecommendationOutputFilterService.matchesCountries` shall include a candidate if *any*
entry of its `TmdbCandidate.originCountries` case-insensitively matches *any* entry of the requested
`countries` filter — widened from today's single-value check against only the candidate's first
country.

**Test Case (Red)**:
```groovy
def "SERIES-046-AC-10: a candidate matches on a non-first origin country"() {
    given: "a candidate whose second origin country matches the filter, but whose first doesn't"
        def candidate = candidateWith(originCountries: ["GB", "US"])

    when: "output filtering runs with countries: [\"US\"]"
        def result = filterService.filter([candidate], criteriaWith(countries: ["US"]))

    then: "the candidate is included, not wrongly excluded"
        result.contains(candidate)
}
```
**Test Case (Green)**: `matchesCountries` becomes
`c.originCountries() != null && c.originCountries().stream().anyMatch(candidateCountry ->
countries.stream().anyMatch(candidateCountry::equalsIgnoreCase))` (or equivalent set-intersection
form) instead of the single-value `c.originCountry() != null && countries.stream()
.anyMatch(country -> country.equalsIgnoreCase(c.originCountry()))`.

---

## Requirement 6: Refresh and export keep working unchanged

**User story**: As a user, I want refreshing a tracked series or exporting my collection to keep
working exactly as it does today, now with the full origin-country value.

### SERIES-046-AC-11 [AUTO] (regression guard)
**Statement**: `SeriesRefreshService.refresh`'s TMDB branch shall continue to update `originCountry`
unconditionally from a fresh `TmdbSeriesDetail` on every refresh, now as the comma-joined value of
`TmdbSeriesDetail.originCountries` — same non-fatal-on-failure posture as every other refreshed field
(`series_spec_018` `SERIES-018-AC-05`), unchanged.

**Test Case (Red)**:
```groovy
def "SERIES-046-AC-11: a refresh updates originCountry to the fresh multi-country value"() {
    given: "an existing series and a fresh TMDB detail with two origin countries"
        def entity = new SeriesEntity(title: "MobLand", originCountry: "GB",
            imdbId: "tt1234567", status: SeriesStatus.WATCHING)
        entity.id = UUID.randomUUID()
        seriesRepository.findById(entity.id) >> Optional.of(entity)
        seriesRepository.save(_) >> { SeriesEntity e -> e }
        tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(2996)
        tmdbClient.details(2996) >> new TmdbSeriesDetail(
            "MobLand", 2025, [80], "/poster.jpg", 1, 10,
            new BigDecimal("7.5"), 200, ProductionStatus.RETURNING, ["GB", "US"], null, null)

    when: "the series is refreshed"
        refreshService.refresh(entity.id)

    then: "originCountry reflects the fresh, joined multi-country value"
        entity.originCountry == "GB,US"
}
```
**Test Case (Green)**: `refreshFromTmdb`'s existing `if (detail.originCountry() != null)` branch
becomes `if (!detail.originCountries().isEmpty())
entity.setOriginCountry(TmdbClient.joinOriginCountries(detail.originCountries()));`.

---

### SERIES-046-AC-12 [AUTO] (regression guard)
**Statement**: `SeriesExportService`'s CSV and JSON export shall include a series' full,
comma-joined `originCountry` value unchanged — no code change, since export already serializes
whatever `SeriesDto.originCountry` holds as a plain string column (`series_spec_021`
`SERIES-021-AC-10`).

**Test Case (Red)**:
```groovy
def "SERIES-046-AC-12: CSV export includes a multi-country originCountry value unchanged"() {
    given: "a series with a comma-joined multi-country originCountry"
        def series = seriesDtoWith(originCountry: "GB,US")

    when: "a CSV export is generated"
        def csv = exportService.exportAsCsv([series])

    then: "the data row includes the full value, not truncated to one country"
        csv.readLines()[1].contains("GB,US")
}
```
**Test Case (Green)**: no code change — confirms the existing export path already handles this
correctly.

---

## Cross-References

| This spec | Source |
|---|---|
| Original single-value `originCountry` design decision, `TmdbClient.firstOriginCountry`, every entity/DTO field this spec widens the *value* of (not the type) | `series_spec_021_origin_country.md` |
| `TmdbCandidate.originCountry`, `RecommendationOutputFilterService.matchesCountries`, the Custom Search country filter (`RecommendationCriteria.countries`, unchanged by this spec) | `series_spec_032_custom_search_language_country_filters.md` |
| `TmdbGenreTable.joinDisplayNames`, the analogous join-a-parsed-list-into-a-DTO-string pattern this spec's `TmdbClient.joinOriginCountries` mirrors | `service/TmdbGenreTable.java` (`series_spec_007_recommendation_sourcing.md`) |
| `genres`/`tags`' existing comma-separated `String` column precedent this spec follows instead of a join table | `model/SeriesEntity.java` |
| `series_spec_040`'s TMDB-managed-field lock — confirmed `originCountry` is not one of the locked fields, so refresh's unconditional-overwrite posture (SERIES-046-AC-11) was already true before this spec and stays true after | `series_spec_040_tmdb_managed_field_lock.md` |
| Frontend display of the (now possibly multi-value) `originCountry` string | `frontend_spec_085_multi_origin_country_display.md` (companion spec) |
| Superseded idea entry, removed from `future_ideas.md` once this spec is written | `.claude/ideas/future_ideas.md`, "Series List" section |

---

## Acceptance Criteria Summary

- [x] SERIES-046-AC-01: `TmdbClient.details` parses every `origin_country` entry onto `TmdbSeriesDetail.originCountries`
- [x] SERIES-046-AC-02: `TmdbClient.search` parses every entry onto `TmdbSearchCandidate.originCountries`
- [x] SERIES-046-AC-03: recommendations/similar/discover map every entry onto `TmdbCandidate.originCountries`
- [x] SERIES-046-AC-04: `TmdbClient.joinOriginCountries` comma-joins a list, `null` for empty/null
- [x] SERIES-046-AC-05: `TmdbLookupCandidateDto.originCountry` carries every entry, comma-joined
- [x] SERIES-046-AC-06: `SeriesLookupDto.originCountry` carries every entry, comma-joined
- [x] SERIES-046-AC-07: `SeriesService.create` persists a multi-country value unchanged (regression guard)
- [x] SERIES-046-AC-08: a multi-country value round-trips through create without truncation (`@Column` length widened, no migration needed)
- [x] SERIES-046-AC-09: `RecommendationDto.originCountry` carries every entry, comma-joined
- [x] SERIES-046-AC-10: `matchesCountries` matches on any of a candidate's countries, not just the first
- [x] SERIES-046-AC-11: refresh updates `originCountry` to the fresh multi-country value (regression guard)
- [x] SERIES-046-AC-12: export includes the full multi-country value unchanged (regression guard)
