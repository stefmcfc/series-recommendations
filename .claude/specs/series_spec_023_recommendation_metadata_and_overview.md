# Spec 023: Recommendation Origin Country/Keywords & Persisted Series Overview

**Status**: Not started
**Priority**: P2 (quality-of-life — richer recommendation cards, and closes a real data-loss gap: a tracked series' description is currently lost the moment it's added)
**Depends on**: Series Spec 006 (`series_spec_006_recommendations.md`, `RecommendationDto`/`TmdbCandidate` base shape), Series Spec 007 (`series_spec_007_recommendation_sourcing.md`, `RecommendationService.toDto`/`TmdbCandidate` field precedent), Series Spec 018 (`series_spec_018_series_refresh.md`, refresh mechanics), Series Spec 019 (`series_spec_019_keyword_tracking.md`, `TmdbClient.showKeywords`/`TmdbKeyword`), Series Spec 021 (`series_spec_021_origin_country.md`, the create+refresh population pattern this spec's overview work mirrors exactly)
**Backend Task**

## Overview

Grew out of `SCRATCH_NEW_IDEAS_2026-08-24.md` item 1. Three related additions, bundled into one spec because they're all small TMDB-metadata extensions to the same two features (recommendations, tracked-series persistence):

1. **Origin country on recommendation candidates** — cheap, since TMDB's list endpoints already return `origin_country` in the same response `RecommendationService` already consumes; no extra TMDB call.
2. **A lazy, per-candidate keyword lookup** — TMDB keywords are *not* included in any list-endpoint response, only via a per-show call (`GET /tv/{id}/keywords`). Showing them for every card in a 10-20-result recommendation list would mean 10-20 extra TMDB calls per fetch, a real cost against this app's rate-limit budget (`app.tmdb.refresh-delay-ms`). This spec exposes a new on-demand, single-candidate endpoint instead, so the frontend can fetch keywords only for a card the user actually expands (`frontend_spec_028`'s Requirement 4) — not the whole list up front.
3. **Persisted series `overview`** — confirmed via code inspection that `SeriesEntity`/`SeriesDto` have no description field at all today, even though `TmdbClient.details()` already calls `GET /tv/{id}` (for `tmdbRating`/`productionStatus`/`originCountry`) and TMDB's `overview` field is sitting unparsed in that same response. A recommendation card shows `overview` inline for free (already built), but once a recommendation is added to the tracked list, that text is gone — this closes that gap by parsing and persisting it the same way `originCountry` already is, at zero extra TMDB-call cost.

**Design decisions**:
- **Whether TMDB's list endpoints (`/discover/tv`, `/trending/tv/{window}`, `/tv/{id}/recommendations`, `/tv/{id}/similar`) genuinely include `origin_country` per-result should be verified against a live response before implementation** (curl per the `verify` skill), not assumed blindly — flagged here as an implementation-time check, following the same posture `series_spec_007`'s own Design Decisions took for its then-unverified `TmdbClient.discover`/`searchKeyword` assumptions.
- **One parsing change covers every list endpoint, not just the four named above.** `TmdbClient.mapResults(...)` is the single shared per-item mapper backing `recommendations`, `similar`, `discover`, `trending`, *and* `discoverTopRated` — adding `origin_country` parsing there (reusing the existing private `firstOriginCountry` helper already used for `TmdbSearchCandidate`/`TmdbSeriesDetail`, `series_spec_021_origin_country.md`) means `trending`/`discoverTopRated` results (`series_spec_022_trending_and_top_rated_recommendations.md`) get `originCountry` for free too, with no separate change.
- **`GET /api/v1/series/recommendations/{tmdbId}/keywords` returns a plain `List<String>` of keyword names, not a `KeywordStatDto`** (the shape `GET /series/keywords` uses). A recommendation candidate isn't a tracked series — there's no `seriesCount`/`averagePersonalRating` to compute for it, so reusing `KeywordStatDto`'s shape here would mean fabricating a fake `seriesCount: 1, averagePersonalRating: null` on every response instead of just returning the names TMDB actually reports.
- **An unresolvable `tmdbId` or a TMDB call failure both yield an empty list with `200 OK`, not a `404`/`502`.** There's no persisted entity here for a "leave it unchanged" non-fatal posture (`KeywordSyncService`'s pattern, `SERIES-019-AC-11`) to apply to — an ad hoc lookup for a candidate TMDB doesn't recognize, or a transient TMDB outage, is simply treated as "no keywords available right now," consistent with this app's never-leak-internals policy (`tooling_spec_001_code_quality_security.md` Requirement 1) and with how an empty/malformed `showKeywords` response is already a normal empty result, not an error (`SERIES-019-AC-06`).
- **`overview` is not added to CSV export in this spec.** `SeriesExportService.exportAsJson` serializes `SeriesDto` directly via Jackson with no field whitelist, so `overview` appears in JSON export automatically the moment `SeriesDto` gains the field — zero code change needed there. CSV export (`CSV_HEADERS`/`csvRow`) explicitly enumerates every column, and a long free-text paragraph is a poor fit for a single CSV cell next to already-terse fields like `originCountry` — left out of scope; revisit separately if wanted.
- **`overview` follows `originCountry`'s exact create+refresh population precedent** (`series_spec_021_origin_country.md`): parsed once from the already-made `GET /tv/{id}` call, round-tripped through `SeriesLookupDto` so the add-series form can carry it into the create payload (mirroring the existing `imdbId`/`originCountry`/`tmdbId` hidden-field pattern, `frontend_spec_022`/`frontend_spec_026`), and refreshed alongside every other TMDB-sourced field on `POST /series/{id}/refresh`. A manually-added series with no `tmdbId`, or one whose TMDB lookup never resolved a detail, has `overview` stay `null` — same posture as `originCountry`/`imdbId` today.
- **New Flyway migration is `V007`** — the next free slot after `V006__add_new_content_detected_at_to_series.sql`.

---

## Requirements

### Requirement 1: Origin Country on Recommendation Candidates

**User story**: As a user browsing recommendations, I want to see each candidate's country of origin alongside its title/year/genres, so I can spot a foreign remake or original before deciding to add it — the same disambiguation `originCountry` already gives me for my tracked list.

#### Acceptance Criteria

- **SERIES-023-AC-01** [AUTO]: `TmdbClient`'s shared `mapResults(...)` helper (backing `recommendations`, `similar`, `discover`, `trending`, and `discoverTopRated`) shall parse each result's `origin_country` array and expose its first entry as a new `originCountry` (`String`) field on `TmdbCandidate` — `null` when the array is absent or empty, reusing the existing `firstOriginCountry` helper (`SERIES-021-AC-01/02`'s precedent).
- **SERIES-023-AC-02** [AUTO]: `RecommendationDto` shall gain `originCountry` (`String`), populated by `RecommendationService.toDto()` from the underlying `TmdbCandidate.originCountry()`.

### Requirement 2: TMDB ID Round-Trip on Recommendations

**User story**: As a developer, I want each recommendation to carry the TMDB id backing it, so the frontend can request that specific candidate's keywords (Requirement 3) without a separate title-based re-lookup.

#### Acceptance Criteria

- **SERIES-023-AC-03** [AUTO]: `RecommendationDto` shall gain `tmdbId` (`int`), populated by `RecommendationService.toDto()` from `TmdbCandidate.tmdbId()` (already resolved internally on every candidate, just not previously exposed on the DTO).

### Requirement 3: Lazy Per-Candidate Keyword Lookup

**User story**: As a user, I want to see a recommendation's keywords when I ask for them on a specific card, without every card in the list costing an extra TMDB call I never asked for.

#### Acceptance Criteria

- **SERIES-023-AC-04** [AUTO]: `SeriesController` shall expose `GET /api/v1/series/recommendations/{tmdbId}/keywords` (`tmdbId` an `int` path variable), a thin delegation to a new `RecommendationService.getKeywordsForCandidate(int tmdbId)` method — sibling to the existing `GET /api/v1/series/keywords` and `GET /api/v1/series/recommendations` mappings on the same controller.
- **SERIES-023-AC-05** [AUTO]: `RecommendationService.getKeywordsForCandidate(int tmdbId)` shall call `TmdbClient.showKeywords(tmdbId)` (`SERIES-019-AC-05`) and map each returned `TmdbKeyword` to its `name`, returning `List<String>`.
- **SERIES-023-AC-06** [AUTO]: If `TmdbClient.showKeywords` throws `ExternalServiceException`, or returns an empty list (an unresolvable/unknown `tmdbId`, or TMDB genuinely has no keywords for it), `getKeywordsForCandidate` shall return an empty list — never propagate an exception or a non-`200` status to the caller (see Design Decisions).
- **SERIES-023-AC-07** [AUTO]: On every call, the endpoint shall respond `200 OK` with `ApiResponse<List<String>>` (`{ data, count }` envelope, matching every other `SeriesController` list endpoint), `count` equal to `data.size()`.

### Requirement 4: TMDB Client Parses Overview

**User story**: As a developer, I want `overview` parsed alongside every other field this app's `GET /tv/{id}` call already reads, so persisting it (Requirement 6) costs zero extra TMDB traffic.

#### Acceptance Criteria

- **SERIES-023-AC-08** [AUTO]: `TmdbClient.details(tmdbId)` (`GET /tv/{id}`) shall parse the response's `overview` field and expose it as a new `overview` (`String`) field on `TmdbSeriesDetail` — `null` when absent/blank, using the same `str(...)` helper already applied to every other string field on this response.

### Requirement 5: Overview Surfaced Through Lookup

**User story**: As a user, I want a TMDB-resolved candidate's description available the moment I pick it in the add-series flow, so it can be carried into the create request (Requirement 6) without a second TMDB call.

#### Acceptance Criteria

- **SERIES-023-AC-09** [AUTO]: `SeriesLookupDto` (backing `GET /api/v1/series/lookup/resolve-tmdb`) shall gain `overview` (`String`), populated by `SeriesLookupService`'s `TmdbSeriesDetail → SeriesLookupDto` mapping — mirroring `SERIES-021-AC-04`'s precedent for `originCountry`.

### Requirement 6: Overview Persistence

**User story**: As a user, I want my tracked series to remember its description, so it isn't lost the moment I add a show even though it was visible on the recommendation card that led me to it.

#### Acceptance Criteria

- **SERIES-023-AC-10** [AUTO]: `SeriesEntity` and `SeriesDto` shall each gain `overview` (`String`, nullable) — on `SeriesEntity`, `@Column(nullable = true, columnDefinition = "TEXT")`, the same shape as the existing `personalNotes` field.
- **SERIES-023-AC-11** [AUTO]: `SeriesService.create` shall persist `overview` from the incoming `SeriesDto` unchanged — the same direct flow-through precedent `SERIES-021-AC-06`/`AC-08` established for `originCountry`/`productionStatus` at create time.
- **SERIES-023-AC-12** [AUTO]: A manually-added series with no `tmdbId` (or whose TMDB lookup never resolved a detail) shall have `overview` remain `null` at creation — same posture as `originCountry`/`imdbId` today, no fallback text and no format validation.

### Requirement 7: Keeping Overview Fresh On Refresh

**User story**: As a user, if a TMDB show's description is updated upstream, I want a refresh to pick that up like every other TMDB-sourced field already does.

#### Acceptance Criteria

- **SERIES-023-AC-13** [AUTO]: `SeriesRefreshService.refresh`'s TMDB branch (`refreshFromTmdb`) shall update `overview` from the fresh `TmdbSeriesDetail` alongside `totalSeasons`/`totalEpisodes`/`tmdbRating`/`tmdbVoteCount`/`productionStatus`/`originCountry` — same branch, same non-fatal-on-failure posture (`SERIES-018-AC-02`/`AC-05`, `SERIES-021-AC-09`).

### Requirement 8: Schema Migration

**User story**: As a developer, I want the `series` table to carry a column for this new field.

#### Acceptance Criteria

- **SERIES-023-AC-14** [AUTO]: A new Flyway migration `V007__add_overview_to_series.sql` shall add a nullable `overview TEXT` column to the `series` table.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationDto`/`TmdbCandidate` base shape, `RecommendationService.toDto` | `series_spec_006_recommendations.md` |
| `TmdbCandidate.voteCount`/`originalLanguage` precedent for adding a field to this record, `TmdbClient.discover`/`mapResults` shared-mapper shape | `series_spec_007_recommendation_sourcing.md` |
| `firstOriginCountry` parsing helper, `TmdbSearchCandidate`/`TmdbSeriesDetail.originCountry`, and the exact create+refresh population pattern this spec's `overview` work mirrors | `series_spec_021_origin_country.md` |
| `TmdbClient.showKeywords`, `TmdbKeyword` record, `KeywordSyncService`'s non-fatal-on-failure posture (`SERIES-019-AC-11`), empty-result-is-not-an-error posture (`SERIES-019-AC-06`) | `series_spec_019_keyword_tracking.md` |
| `SeriesRefreshService.refreshFromTmdb`, non-fatal-per-source refresh posture | `series_spec_018_series_refresh.md` |
| `imdbId`/`originCountry`/`tmdbId` hidden-field round-trip pattern in `AddSeriesForm` this spec's `overview` field needs the frontend companion to extend | `frontend_spec_022_tmdb_primary_lookup.md`, `frontend_spec_026_origin_country_and_tmdb_metadata_display.md` |
| Never-leak-internals policy for upstream failures | `tooling_spec_001_code_quality_security.md` Requirement 1 |
| Frontend consumer: origin-country card display, lazy per-card keyword expand, `SeriesDetail` overview display, `AddSeriesForm` overview carry-through | `frontend_spec_028_recommendation_metadata_and_overview_display.md` (companion spec) |

---

## TDD Test Case Sketches

### `TmdbClientSpec.groovy` (Requirement 1)

```groovy
def "SERIES-023-AC-01: recommendations() maps origin_country's first entry onto TmdbCandidate"() {
    given: "a TMDB recommendations response with an origin_country array"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/1399/recommendations")))
            .andRespond(withSuccess('''
                {"results": [{"id": 2, "name": "Show", "origin_country": ["US"]}]}
            ''', MediaType.APPLICATION_JSON))

    when: "recommendations(1399) is called"
        def results = tmdbClient.recommendations(1399)

    then: "originCountry is the array's first entry"
        results[0].originCountry() == "US"
}

def "SERIES-023-AC-01: an absent origin_country maps to a null originCountry"() {
    given: "a TMDB recommendations result with no origin_country field"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/1399/recommendations")))
            .andRespond(withSuccess('{"results": [{"id": 2, "name": "Show"}]}', MediaType.APPLICATION_JSON))

    when: "recommendations(1399) is called"
        def results = tmdbClient.recommendations(1399)

    then: "originCountry is null"
        results[0].originCountry() == null
}
```

### `RecommendationServiceSpec.groovy` (Requirements 1-2)

```groovy
def "SERIES-023-AC-02/03: toDto carries originCountry and tmdbId from the candidate"() {
    given: "one COMPLETED source series and a raw candidate with originCountry/tmdbId set"
        // ... existing scaffolding to route one candidate through sourcing
        tmdbClient.recommendations(_) >> [
            new TmdbCandidate(2, "Show", 2020, "overview", null, new BigDecimal("7.0"), [], 100, "en", "US")
        ]

    when: "recommend(20) is called"
        def results = recommendationService.recommend(20)

    then: "the result carries both new fields"
        results[0].originCountry == "US"
        results[0].tmdbId == 2
}
```

### `RecommendationServiceSpec.groovy` (Requirement 3)

```groovy
def "SERIES-023-AC-05: getKeywordsForCandidate maps TmdbKeyword names to plain strings"() {
    given: "TMDB returns two keywords for tmdbId 4046"
        tmdbClient.showKeywords(4046) >> [new TmdbKeyword(470, "spy"), new TmdbKeyword(190904, "mi5")]

    when: "getKeywordsForCandidate(4046) is called"
        def result = recommendationService.getKeywordsForCandidate(4046)

    then: "the plain names are returned, in TMDB's own order"
        result == ["spy", "mi5"]
}

def "SERIES-023-AC-06: a TMDB failure returns an empty list, not an exception"() {
    given: "TMDB fails for tmdbId 999"
        tmdbClient.showKeywords(999) >> { throw new ExternalServiceException("TMDB down") }

    when: "getKeywordsForCandidate(999) is called"
        def result = recommendationService.getKeywordsForCandidate(999)

    then: "an empty list is returned, no exception propagates"
        result == []
}
```

### `SeriesControllerRecommendationsSpec.groovy` (Requirement 3 -- endpoint)

```groovy
def "SERIES-023-AC-04/07: GET /api/v1/series/recommendations/{tmdbId}/keywords returns the envelope shape"() {
    given: "the service resolves two keywords for tmdbId 4046"
        recommendationService.getKeywordsForCandidate(4046) >> ["spy", "mi5"]

    when: "GET /api/v1/series/recommendations/4046/keywords is requested"
        def result = mockMvc.perform(get("/api/v1/series/recommendations/4046/keywords"))

    then: "the response is 200 with both keywords in data, count 2"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data', hasSize(2)))
        result.andExpect(jsonPath('$.count').value(2))
}

def "SERIES-023-AC-06: an unresolvable tmdbId still returns 200 with an empty list"() {
    given: "the service finds nothing for tmdbId 1"
        recommendationService.getKeywordsForCandidate(1) >> []

    when: "GET /api/v1/series/recommendations/1/keywords is requested"
        def result = mockMvc.perform(get("/api/v1/series/recommendations/1/keywords"))

    then: "the response is 200 with an empty list"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data').isArray())
        result.andExpect(jsonPath('$.count').value(0))
}
```

### `TmdbClientSpec.groovy` (Requirement 4)

```groovy
def "SERIES-023-AC-08: details maps overview onto TmdbSeriesDetail"() {
    given: "a TMDB detail response with an overview field"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/2996")))
            .andRespond(withSuccess('''
                {"name": "The Office", "overview": "A mockumentary sitcom.", "genres": []}
            ''', MediaType.APPLICATION_JSON))

    when: "details(2996) is called"
        def detail = tmdbClient.details(2996)

    then: "overview is parsed"
        detail.overview() == "A mockumentary sitcom."
}
```

### `SeriesLookupServiceSpec.groovy` (Requirement 5)

```groovy
def "SERIES-023-AC-09: resolve carries overview through from TMDB detail"() {
    given: "TmdbClient.details resolves a full detail including overview"
        tmdbClient.details(2996) >> new TmdbSeriesDetail(
            "The Office", 2001, [35], "/poster.jpg", 2, 14,
            new BigDecimal("7.7"), 450, ProductionStatus.ENDED, "GB", "A mockumentary sitcom.")
        tmdbClient.externalIds(2996) >> Optional.empty()

    when: "resolveTmdbCandidate(2996) is called"
        def result = lookupService.resolveTmdbCandidate(2996)

    then: "overview is present on the result"
        result.overview == "A mockumentary sitcom."
}
```

### `SeriesServiceSpec.groovy` (Requirement 6)

```groovy
def "SERIES-023-AC-11: create persists overview unchanged from the incoming dto"() {
    given: "a SeriesDto with overview set"
        def dto = new SeriesDto(title: "The Office", overview: "A mockumentary sitcom.")

    when: "create(dto) is called"
        def created = seriesService.create(dto)

    then: "overview is persisted unchanged"
        created.overview == "A mockumentary sitcom."
}

def "SERIES-023-AC-12: a manually-added series with no overview stays null"() {
    given: "a SeriesDto with no overview set"
        def dto = new SeriesDto(title: "Homemade Show")

    when: "create(dto) is called"
        def created = seriesService.create(dto)

    then: "overview is null"
        created.overview == null
}
```

### `SeriesRefreshServiceSpec.groovy` (Requirement 7)

```groovy
def "SERIES-023-AC-13: a successful TMDB refresh updates overview"() {
    given: "an existing series and a fresh TMDB detail with an updated overview"
        tmdbClient.findTvIdByImdbId(_) >> Optional.of(2996)
        tmdbClient.details(2996) >> new TmdbSeriesDetail(
            "The Office", 2001, [35], "/poster.jpg", 2, 14,
            new BigDecimal("7.7"), 450, ProductionStatus.ENDED, "GB", "Updated overview.")

    when: "refresh(id) is called"
        def result = refreshService.refresh(existing.id)

    then: "overview reflects the fresh TMDB value"
        result.series.overview == "Updated overview."
}
```

### Flyway integration test

```groovy
def "SERIES-023-AC-14: fresh migrate() adds the overview column"() {
    when: "flyway.migrate() runs including V007"
        // flyway.migrate()

    then: "the series table has an overview column"
        // column introspection confirms overview TEXT exists
}
```

---

## Acceptance Criteria Summary

- [ ] SERIES-023-AC-01: `TmdbClient.mapResults` parses `origin_country`'s first entry onto `TmdbCandidate`
- [ ] SERIES-023-AC-02: `RecommendationDto` gains `originCountry`
- [ ] SERIES-023-AC-03: `RecommendationDto` gains `tmdbId`
- [ ] SERIES-023-AC-04: `GET /api/v1/series/recommendations/{tmdbId}/keywords` endpoint
- [ ] SERIES-023-AC-05: `RecommendationService.getKeywordsForCandidate` maps `TmdbKeyword` names
- [ ] SERIES-023-AC-06: TMDB failure or empty result returns an empty list, not an error
- [ ] SERIES-023-AC-07: `200` + `{ data, count }` envelope
- [ ] SERIES-023-AC-08: `TmdbClient.details` parses `overview` onto `TmdbSeriesDetail`
- [ ] SERIES-023-AC-09: `SeriesLookupDto` gains `overview`
- [ ] SERIES-023-AC-10: `SeriesEntity`/`SeriesDto` gain `overview`
- [ ] SERIES-023-AC-11: `SeriesService.create` persists `overview`
- [ ] SERIES-023-AC-12: manually-added series' `overview` stays `null`
- [ ] SERIES-023-AC-13: `SeriesRefreshService.refresh` updates `overview`
- [ ] SERIES-023-AC-14: `V007__add_overview_to_series.sql` migration
