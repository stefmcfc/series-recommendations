# Spec 021: TMDB Origin Country

**Status**: Implemented
**Priority**: P2 (quality-of-life — disambiguates same-title remakes, e.g. "The Office" UK 2001 vs US 2005)
**Depends on**: Series Spec 012 (`TmdbClient.search`/`details`, `TmdbSearchCandidate`/`TmdbSeriesDetail`), Series Spec 017 (TMDB-primary resolve, `SeriesLookupService.resolveTmdbCandidate`), Series Spec 018 (`SeriesRefreshService`, `TmdbSeriesDetail.productionStatus`)
**Backend Task**

## Overview

TMDB's `GET /search/tv` and `GET /tv/{id}` responses both carry `origin_country`, an array of ISO 3166-1 alpha-2 codes (e.g. `["GB"]`, `["US"]`). This spec captures it end-to-end — TMDB parsing, the candidate-picker DTO, the lookup-result DTO, the persisted entity, refresh, and export — so a user adding "The Office" can tell the 2001 UK original from the 2005 US remake before picking one, and so their own tracked list can show which is which. The raw ISO code is stored as-is; resolving it to a display name ("United Kingdom") is a frontend concern (native `Intl.DisplayNames`, no backend lookup table needed) — see the companion `frontend_spec_026_origin_country_and_tmdb_metadata_display.md`.

While tracing `TmdbSeriesDetail`'s fields for this spec, two related gaps surfaced in `productionStatus` (`series_spec_018_series_refresh.md`'s own addition): `SeriesLookupService.resolveTmdbCandidate` already receives `TmdbSeriesDetail.productionStatus()` in the same `GET /tv/{id}` call it uses for everything else, but never copies it onto `SeriesLookupDto` — and even if it did, `SeriesService.create` never reads `dto.getProductionStatus()` when building a new entity. The net effect: a freshly added series' `productionStatus` is always `null` until its first explicit refresh, even though the data was available for free at creation time. This spec closes both gaps alongside `originCountry`, since it's the same code paths (`TmdbSeriesDetail` → `SeriesLookupService.toDto` → `SeriesService.create`) — see Requirement 3.

**Design decisions**:
- **Only the first `origin_country` entry is kept, not the full array.** A TV series occasionally lists more than one origin country (an international co-production), but the overwhelming majority — including every disambiguation case this spec exists for — has exactly one. This mirrors `TmdbClient.findTvIdByImdbId`'s own existing precedent of taking `tvResults.getFirst()` from a TMDB array response rather than modeling a list this app has no use for yet.
- **The raw ISO 3166-1 alpha-2 code is stored, not a resolved country name.** Resolving `"GB"` → `"United Kingdom"` needs no lookup table at all — it's natively available via the JS `Intl.DisplayNames` API in every evergreen browser — so doing it on the backend would mean maintaining a table for zero benefit. Storing the raw code also keeps the door open for a future "filter by country" feature without re-deriving it from a display string.
- **No format validation on the incoming code.** Same posture this app already takes for `imdbId`: trust the upstream API's own data rather than defensively regex-validating a value this app doesn't construct itself.
- **`recommendations`/`similar`/`discover` (`TmdbCandidate`) are out of scope.** This spec only touches the two endpoints (`search/tv`, `tv/{id}`) actually involved in adding/refreshing a *tracked* series — the disambiguation problem this spec solves doesn't apply to the recommendations list, which is a different feature with its own display (`frontend_spec_020_recommendation_rating_display.md`).
- **`productionStatus`-at-creation is a bug-fix addendum to this spec's own newly-introduced code paths, not new scope.** `series_spec_018` already specified `productionStatus` as a persisted, TMDB-sourced field; `SERIES-021-AC-07`/`AC-08` below just make its create-time behavior consistent with `tmdbRating`/`tmdbVoteCount`'s existing `SERIES-017-AC-12` precedent (persisted unchanged from the incoming `SeriesDto` at creation), rather than leaving it as a refresh-only field with no reason to be.

---

## Requirements

### Requirement 1: TMDB Client Parses Origin Country

**User story**: As a developer, I want `origin_country` parsed alongside every other TMDB field this app already reads, so nothing downstream needs its own JSON-parsing logic.

#### Acceptance Criteria

- **SERIES-021-AC-01** [AUTO]: `TmdbClient.search(query)` (`GET /search/tv`) shall parse each result's `origin_country` array and expose its first entry as a new `originCountry` (`String`) field on `TmdbSearchCandidate` — `null` when the array is absent or empty.
- **SERIES-021-AC-02** [AUTO]: `TmdbClient.details(tmdbId)` (`GET /tv/{id}`) shall parse `origin_country` the same way, exposing it as a new `originCountry` (`String`) field on `TmdbSeriesDetail` — `null` when absent or empty.

### Requirement 2: Origin Country Surfaced Through Lookup Endpoints

**User story**: As a user, I want to see each candidate's country of origin in the TMDB search results, so I can tell "The Office" (UK) apart from "The Office" (US) before picking one.

#### Acceptance Criteria

- **SERIES-021-AC-03** [AUTO]: `TmdbLookupCandidateDto` (backing `GET /api/v1/series/lookup/search-tmdb`) shall gain `originCountry` (`String`), populated by `SeriesLookupService`'s `TmdbSearchCandidate → TmdbLookupCandidateDto` mapping.
- **SERIES-021-AC-04** [AUTO]: `SeriesLookupDto` (backing `GET /api/v1/series/lookup/resolve-tmdb`) shall gain `originCountry` (`String`), populated by `SeriesLookupService`'s `TmdbSeriesDetail → SeriesLookupDto` mapping.

### Requirement 3: Origin Country & Production Status Persistence

**User story**: As a user, I want my tracked series to remember its country of origin (and have its production status populated immediately, not just after a refresh), so this data is there the moment I add a show.

#### Acceptance Criteria

- **SERIES-021-AC-05** [AUTO]: `SeriesEntity` and `SeriesDto` shall each gain `originCountry` (`String`, nullable, length 2).
- **SERIES-021-AC-06** [AUTO]: `SeriesService.create` shall persist `originCountry` from the incoming `SeriesDto` unchanged (same direct flow-through as every other lookup-sourced field at create time, per `SERIES-017-AC-12`'s precedent for `tmdbRating`/`tmdbVoteCount`).
- **SERIES-021-AC-07** [AUTO]: `SeriesLookupDto` shall gain `productionStatus` (`String`), populated by `SeriesLookupService`'s `TmdbSeriesDetail → SeriesLookupDto` mapping from `detail.productionStatus()` — closing the gap described in the Overview.
- **SERIES-021-AC-08** [AUTO]: `SeriesService.create` shall persist `productionStatus` from the incoming `SeriesDto` unchanged, the same as `SERIES-021-AC-06` does for `originCountry` — closing the second half of the same gap.

### Requirement 4: Keeping Origin Country Fresh On Refresh

**User story**: As a user, if a TMDB record's origin country data is ever corrected upstream, I want a refresh to pick that up like every other TMDB-sourced field does.

#### Acceptance Criteria

- **SERIES-021-AC-09** [AUTO]: `SeriesRefreshService.refresh`'s TMDB branch shall update `originCountry` from the fresh `TmdbSeriesDetail` alongside `totalSeasons`/`totalEpisodes`/`tmdbRating`/`tmdbVoteCount`/`productionStatus` — same branch, same non-fatal-on-failure posture (`SERIES-018-AC-02`/`AC-05`).

### Requirement 5: Export

**User story**: As a user, I want an exported copy of my collection to include each series' country of origin.

#### Acceptance Criteria

- **SERIES-021-AC-10** [AUTO]: `SeriesExportService`'s CSV headers and JSON export shall include `originCountry`.

### Requirement 6: Schema Migration

**User story**: As a developer, I want the `series` table to carry a column for this new field.

#### Acceptance Criteria

- **SERIES-021-AC-11** [AUTO]: A new Flyway migration `V004__add_origin_country_to_series.sql` shall add a nullable `origin_country VARCHAR(2)` column to the `series` table.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `TmdbClient.search`/`details`, `TmdbSearchCandidate`/`TmdbSeriesDetail` | `series_spec_012_tmdb_lookup_fallback.md` |
| `SeriesLookupService.resolveTmdbCandidate`, TMDB-primary resolve, `SERIES-017-AC-12` create-time flow-through precedent | `series_spec_017_tmdb_primary_lookup.md` |
| `SeriesRefreshService`, `TmdbSeriesDetail.productionStatus` (the field whose create-time gap this spec also closes) | `series_spec_018_series_refresh.md` |
| Frontend consumer: candidate-picker country badge, series-list "(Year) \| Country" display, `Intl.DisplayNames` resolution, and surfacing `productionStatus`/`tmdbRating`/`tmdbVoteCount` (a related frontend-only gap found while scoping this) | `frontend_spec_026_origin_country_and_tmdb_metadata_display.md` (companion spec) |

---

## TDD Test Case Sketches

### `TmdbClientSpec.groovy`

```groovy
def "SERIES-021-AC-01: search maps origin_country's first entry onto TmdbSearchCandidate"() {
    given: "TMDB search results include an origin_country array"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("search/tv")))
            .andRespond(withSuccess('''
                {"results": [{"id": 2996, "name": "The Office", "origin_country": ["GB"]}]}
            ''', MediaType.APPLICATION_JSON))

    when: "search(\"The Office\") is called"
        def results = tmdbClient.search("The Office")

    then: "originCountry is the array's first entry"
        results[0].originCountry() == "GB"
}

def "SERIES-021-AC-01: an absent origin_country maps to a null originCountry"() {
    given: "a TMDB search result with no origin_country field"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("search/tv")))
            .andRespond(withSuccess('{"results": [{"id": 1, "name": "Show"}]}', MediaType.APPLICATION_JSON))

    when: "search(\"Show\") is called"
        def results = tmdbClient.search("Show")

    then: "originCountry is null"
        results[0].originCountry() == null
}

def "SERIES-021-AC-02: details maps origin_country's first entry onto TmdbSeriesDetail"() {
    given: "a TMDB detail response with an origin_country array"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/2996")))
            .andRespond(withSuccess('''
                {"name": "The Office", "origin_country": ["GB"], "genres": []}
            ''', MediaType.APPLICATION_JSON))

    when: "details(2996) is called"
        def detail = tmdbClient.details(2996)

    then: "originCountry is the array's first entry"
        detail.originCountry() == "GB"
}
```

### `SeriesLookupServiceSpec.groovy`

```groovy
def "SERIES-021-AC-03: TMDB search candidates carry originCountry through to the picker DTO"() {
    given: "TmdbClient.search returns a candidate with originCountry"
        tmdbClient.search("The Office") >> [
            new TmdbSearchCandidate(2996, "The Office", null, 2001, "/poster.jpg", [], "GB")
        ]

    when: "searchTmdb(\"The Office\") is called"
        def results = lookupService.searchTmdb("The Office")

    then: "the picker DTO carries originCountry"
        results[0].originCountry == "GB"
}

def "SERIES-021-AC-04/07: resolve carries originCountry and productionStatus through from TMDB detail"() {
    given: "TmdbClient.details resolves a full detail with originCountry and productionStatus"
        tmdbClient.details(2996) >> new TmdbSeriesDetail(
            "The Office", 2001, [35], "/poster.jpg", 2, 14,
            new BigDecimal("7.7"), 450, ProductionStatus.ENDED, "GB")
        tmdbClient.externalIds(2996) >> Optional.empty()

    when: "resolveTmdbCandidate(2996) is called"
        def result = lookupService.resolveTmdbCandidate(2996)

    then: "both fields are present on the result"
        result.originCountry == "GB"
        result.productionStatus == "ENDED"
}
```

### `SeriesServiceSpec.groovy`

```groovy
def "SERIES-021-AC-06/08: create persists originCountry and productionStatus unchanged from the incoming dto"() {
    given: "a SeriesDto with originCountry and productionStatus set"
        def dto = new SeriesDto(title: "The Office", originCountry: "GB", productionStatus: "ENDED")

    when: "create(dto) is called"
        def created = seriesService.create(dto)

    then: "both fields are persisted unchanged"
        created.originCountry == "GB"
        created.productionStatus == "ENDED"
}
```

### `SeriesRefreshServiceSpec.groovy`

```groovy
def "SERIES-021-AC-09: a successful TMDB refresh updates originCountry"() {
    given: "an existing series and a fresh TMDB detail with a different originCountry"
        tmdbClient.findTvIdByImdbId(_) >> Optional.of(2996)
        tmdbClient.details(2996) >> new TmdbSeriesDetail(
            "The Office", 2001, [35], "/poster.jpg", 2, 14,
            new BigDecimal("7.7"), 450, ProductionStatus.ENDED, "GB")

    when: "refresh(id) is called"
        def result = refreshService.refresh(existing.id)

    then: "originCountry reflects the fresh TMDB value"
        result.series.originCountry == "GB"
}
```

### `SeriesExportServiceSpec.groovy`

```groovy
def "SERIES-021-AC-10: CSV headers include originCountry"() {
    when: "a CSV export is generated"
        def csv = exportService.exportAsCsv([])

    then: "the header row includes originCountry"
        csv.readLines().first().contains("originCountry")
}
```

### Flyway integration test

```groovy
def "SERIES-021-AC-11: fresh migrate() adds the origin_country column"() {
    when: "flyway.migrate() runs including V004"
        // flyway.migrate()

    then: "the series table has an origin_country column"
        // column introspection confirms origin_country VARCHAR(2) exists
}
```

---

## Acceptance Criteria Summary

- [x] SERIES-021-AC-01: `TmdbClient.search` parses `origin_country`'s first entry onto `TmdbSearchCandidate`
- [x] SERIES-021-AC-02: `TmdbClient.details` parses `origin_country`'s first entry onto `TmdbSeriesDetail`
- [x] SERIES-021-AC-03: `TmdbLookupCandidateDto` gains `originCountry`
- [x] SERIES-021-AC-04: `SeriesLookupDto` gains `originCountry`
- [x] SERIES-021-AC-05: `SeriesEntity`/`SeriesDto` gain `originCountry`
- [x] SERIES-021-AC-06: `SeriesService.create` persists `originCountry`
- [x] SERIES-021-AC-07: `SeriesLookupDto` gains `productionStatus` (closes create-time gap)
- [x] SERIES-021-AC-08: `SeriesService.create` persists `productionStatus` (closes create-time gap)
- [x] SERIES-021-AC-09: `SeriesRefreshService.refresh` updates `originCountry`
- [x] SERIES-021-AC-10: export includes `originCountry`
- [x] SERIES-021-AC-11: `V004__add_origin_country_to_series.sql` migration
