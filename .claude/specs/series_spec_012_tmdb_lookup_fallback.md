# Spec 012: TMDB Search Lookup Fallback (AKA-Matching Escape Hatch)

**Status**: Implemented. **Superseded by `series_spec_017_tmdb_primary_lookup.md`**: this spec's TMDB-fallback escape hatch (`search-tmdb`/`resolve-tmdb`) is promoted from a fallback to the sole/primary lookup path, and `resolveTmdbCandidate`'s "try OMDb first" priority inverts to "TMDB is the base, OMDb is best-effort enrichment only." The endpoints and their routes are unchanged; only the internal data-source priority changes. Kept for historical/traceability reference; no AC here is renumbered or deleted.
**Priority**: P2 (quality-of-life / correctness fix for adding series — not core CRUD)
**Depends on**: `series_spec_011_omdb_search_candidates.md` (✅ Implemented), `series_spec_010_genre_dropdown.md` (✅ Implemented, for the `TmdbGenreTable` Spring bean this spec injects into `SeriesLookupService`)
**Backend Task**

## Overview

`series_spec_011_omdb_search_candidates.md` fixed OMDb's `t=` ("best single guess") endpoint returning a confidently-wrong match by adding a `s=` search-based candidate picker. But OMDb's `s=` search has its own, different gap: it does no AKA/alternate-title matching, so a title catalogued under a different name in OMDb than the one the user knows it by returns zero *or several plausible-but-wrong* results, with the correct one never appearing at all. This was confirmed live during Spec 011's own verification: searching **"Spooks"** (the real UK MI5 drama, TMDB id `4046`, imdbID `tt0160904`) against OMDb's `s=` returns five real candidates ("Spooks: Code 9", "Frankelda's Book of Spooks", etc.) — none the correct show — because OMDb catalogues that title as **"MI-5"**, not "Spooks". TMDB's `/search/tv`, by contrast, explicitly searches original, translated, and "also known as" names, and finds it immediately.

This spec adds a manual escape hatch to the flow Spec 011 built: from the OMDb-search candidate picker, the user can trigger a TMDB-backed search instead, pick the correct show from TMDB's more reliable results, and the app resolves it to an `imdb_id` → full OMDb detail automatically — falling back to TMDB's own (thinner) detail when OMDb genuinely has no record for that title at all. The trigger is deliberately **user-initiated** ("none of these are right"), not auto-fired on "OMDb returned zero results" — the Spooks case above returned five *wrong* results, not zero, so an empty-results-only trigger would never have fired for the exact bug this spec exists to fix (see `frontend_spec_016_tmdb_lookup_fallback.md` for where the affordance is actually surfaced).

**Design decisions**:
- **`/search/tv` and `/tv/{id}` response shapes were verified live against the real TMDB API during this conversation** (not "documented but unverified" the way OMDb's shapes originally were, and the way `series_spec_011`'s own `s=`/`i=` shapes were flagged before their own live verification). A live `GET /search/tv?query=Spooks` call returned TMDB id `4046` for the correct "Spooks" (the UK MI5 drama), whose `external_ids` resolves to imdbID `tt0160904` — the same show OMDb catalogues as "MI-5", confirming both the root-cause premise above and the exact request/response shapes this spec's field-mapping tables document. A live `GET /tv/4046` call confirmed the detail shape, including that `genres` is an array of `{id, name}` objects — a materially different shape from the flat `genre_ids` integer array `/search/tv`, `/discover/tv`, and the recommendations endpoints already use, requiring its own extraction logic (Requirement 3).
- **Centralizes the TMDB poster-base-URL constant on `TmdbClient`, not `RecommendationService`.** `RecommendationService` currently holds a private `POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500"` constant it uses to build a candidate's poster URL from TMDB's `poster_path`. This spec's new `SeriesLookupService.searchTmdb` needs the exact same constant to do the exact same thing; rather than duplicate the literal a second time, it's promoted to a `public static final` on `TmdbClient` — the class that already owns every other piece of TMDB-shape knowledge in this codebase — and `RecommendationService` is updated to reference `TmdbClient.POSTER_BASE_URL` instead of its own copy.
- **`resolveTmdbCandidate`'s degraded-path fallback is the core new piece of logic, and is triggered by two distinct conditions, not one**: (1) `TmdbClient.externalIds` resolves no `imdb_id` at all for the given TMDB id (TMDB simply has no IMDb cross-reference for that show), or (2) an `imdb_id` *is* resolved, but `OmdbClient.lookupByImdbId` throws `EntityNotFoundException` for it — a real, if rare, possibility confirmed during this conversation's live verification (OMDb's own catalogue doesn't cover every title TMDB does, even when TMDB has successfully cross-referenced an IMDb id for it). Both conditions fall through to the same `TmdbClient.details` call so the user isn't left at a dead end just because OMDb's data is thinner than TMDB's — they get whatever TMDB itself knows (title/year/genres/poster/season-and-episode counts), with ratings fields simply absent (`null`), rather than an error.
- **A genuine upstream failure (`ExternalServiceException`) is never swallowed into the degraded path.** Only `EntityNotFoundException` from `OmdbClient.lookupByImdbId` triggers the fallback — an `ExternalServiceException` from either `OmdbClient` or `TmdbClient` (a real outage, timeout, or malformed response, as distinct from "this specific record doesn't exist") is allowed to propagate unchanged, mapping to the existing `502` `GlobalExceptionHandler` mapping. Silently downgrading a real failure to "here's TMDB's thinner data instead" would hide an actual problem from the caller.
- **The degraded path's `genres` field reuses `RecommendationService.joinGenres`'s exact pattern** — join each TMDB genre id through `TmdbGenreTable.displayNameFor`, filter unresolved ids, comma-join — rather than inventing a second way to render TMDB genre ids to display text. `TmdbGenreTable` is already a Spring `@Component` (`series_spec_010_genre_dropdown.md`), so it's constructor-injected into `SeriesLookupService` the same way it already is into `RecommendationService` and `SeriesController`.
- **No not-found exception on an empty `searchTmdb` result**, mirroring `OmdbClient.search`'s existing "empty list is a normal outcome" philosophy (`SERIES-011-AC-03`) — a title-based search naturally has zero results sometimes. Unlike OMDb's `s=`, which signals "no matches" via an explicit `"Response": "False"` sentinel requiring special-case handling, TMDB's `/search/tv` simply returns an empty `results` array on a normal `200` — the existing `listOfMaps` helper already returns `List.of()` for a missing/empty key, so no special no-match branch is needed at all.
- **Two endpoints, mirroring Spec 011's own `/lookup/search` + `/lookup?imdbId=` split**: `GET /lookup/search-tmdb?title=` for the lightweight candidate list (a genuinely different response shape, so it gets its own sub-path, same reasoning as `SERIES-011`'s design decisions), and `GET /lookup/resolve-tmdb?tmdbId=` for resolving one specific candidate to full detail. Kept as two new endpoints rather than folding into the existing `/lookup` endpoint's `title`/`imdbId` mutual-exclusivity switch, since a `tmdbId` is a different identifier space entirely (this candidate hasn't been resolved to an `imdb_id` yet — that's exactly what `resolveTmdbCandidate` does).
- **A non-numeric or missing `tmdbId` on `/lookup/resolve-tmdb` needs no new exception handling.** Spring's own `@RequestParam int tmdbId` binding already raises `MissingServletRequestParameterException` (missing) or `MethodArgumentTypeMismatchException` (non-numeric), both already mapped to `400` by the existing `GlobalExceptionHandler` (used today by `GET /recommendations`'s typed params, e.g. `SERIES-007-AC-31`) — no new code required.
- **The degraded-but-successful case is always a normal `200`, never an error status**, even though `imdbRating`/`metacriticRating`/`rottenTomatoesRating` come back `null` and `imdbId` may itself be `null` — the caller asked to resolve a TMDB candidate, and got back everything TMDB itself knows about it. That's success, not partial failure; `502` is reserved exclusively for a genuine upstream failure.

---

## Requirements

### Requirement 1: Centralize the TMDB Poster Base URL Constant

**User story**: As a developer, I want one owner of TMDB's poster-base-URL literal, so a second feature that needs it doesn't duplicate the string or risk drifting from the original.

#### Acceptance Criteria

- **SERIES-012-AC-01** [AUTO]: `TmdbClient` shall expose a `public static final String POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500"` constant.
- **SERIES-012-AC-02** [AUTO]: `RecommendationService` shall build a candidate's poster URL (`RecommendationDto.posterUrl`, currently `c.posterPath() != null ? POSTER_BASE_URL + c.posterPath() : null`) using `TmdbClient.POSTER_BASE_URL`, and its own previously private `POSTER_BASE_URL` constant shall be removed — with no observable change in the resulting URL for any existing candidate.

---

### Requirement 2: `TmdbClient.search` — Full-Catalog TV Title Search

**User story**: As a developer, I want a way to search TMDB's own catalog for a title — which, unlike OMDb, matches against original/translated/AKA names — so a title OMDb has filed under a different name can still be found.

#### Acceptance Criteria

- **SERIES-012-AC-03** [AUTO]: `TmdbClient` shall expose a new public method `search(String query)` returning `List<TmdbSearchCandidate>`, calling `GET {base-url}/search/tv?query={query}` (plus the existing `api_key` query param every `TmdbClient` call already sends).
- **SERIES-012-AC-04** [AUTO]: `TmdbClient.search` shall map each entry of the response's `results[]` array onto a `TmdbSearchCandidate(tmdbId, title, originalTitle, year, posterPath, genreIds)`, per the field-mapping table below, reusing the existing `extractYear`/`toIntegerList`/`str`/`toInteger` helpers `mapResults` already uses for `/discover/tv` and the recommendations endpoints — not duplicating that parsing logic. An entry with no `id` shall be skipped, mirroring `mapResults`'s existing behavior for the same case.
- **SERIES-012-AC-05** [AUTO]: `originalTitle` shall be `null` when the entry's `original_name` is absent, or is identical to the mapped `title` (`name`) — there's no point surfacing a redundant duplicate for an English-original show.
- **SERIES-012-AC-06** [AUTO]: When the response's `results[]` array is missing or empty, `TmdbClient.search` shall return an empty list, not throw an exception — TMDB signals "no matches" via a normal `200` with an empty array, unlike OMDb's explicit `"Response": "False"` sentinel, so no special no-match branch is needed (see design decisions above).
- **SERIES-012-AC-07** [AUTO]: If the search call fails for any other reason (network error, timeout, unexpected non-200, unparseable body) or `app.tmdb.api-key` is unset, `TmdbClient.search` shall throw `ExternalServiceException`, same semantics as every other `TmdbClient` method's `fetch` failure path.

**Field mapping** (TMDB raw, per entry in `results[]` of `GET /search/tv` → `TmdbSearchCandidate`):

| TMDB field | Example raw value | Mapped field | Parsing notes |
|---|---|---|---|
| `id` | `4046` | `tmdbId` | via `toInteger`; entry skipped if absent |
| `name` | `"Spooks"` | `title` | via `str` |
| `original_name` | `"Spooks"` / `"La Casa de Papel"` | `originalTitle` | via `str`; `null` when absent or identical to `title` |
| `first_air_date` | `"2002-05-13"` | `year` | via `extractYear` (same helper `mapResults` already uses) |
| `poster_path` | `"/abc123.jpg"` | `posterPath` | via `str` |
| `genre_ids` | `[10759, 18]` | `genreIds` | via `toIntegerList` |

**New type**: `client/TmdbSearchCandidate.java` — a record `(int tmdbId, String title, String originalTitle, Integer year, String posterPath, List<Integer> genreIds)`, colocated with `TmdbCandidate` in the `client` package.

---

### Requirement 3: `TmdbClient.details` — Full Detail Lookup by TMDB Id

**User story**: As a developer, I want a way to fetch TMDB's own full detail for a specific TMDB id, so a resolved candidate can still be turned into a usable result even when OMDb has no record for it.

#### Acceptance Criteria

- **SERIES-012-AC-08** [AUTO]: `TmdbClient` shall expose a new public method `details(int tmdbId)` returning `TmdbSeriesDetail`, calling `GET {base-url}/tv/{tmdbId}` (plus the existing `api_key` query param).
- **SERIES-012-AC-09** [AUTO]: `TmdbClient.details` shall map the response onto a `TmdbSeriesDetail(title, year, genreIds, posterPath, numberOfSeasons, numberOfEpisodes)`, per the field-mapping table below — critically, `genres` on this endpoint is an array of `{id, name}` objects, **not** the flat `genre_ids` integer array `/search/tv`/`/discover/tv`/the recommendations endpoints use, so this mapping shall extract just the `id` value from each `genres[]` entry rather than reusing `toIntegerList` directly on the raw field.
- **SERIES-012-AC-10** [AUTO]: If the details call fails for any other reason, or `app.tmdb.api-key` is unset, `TmdbClient.details` shall throw `ExternalServiceException`, same semantics as every other `TmdbClient` method.

**Field mapping** (TMDB raw, `GET /tv/{id}` → `TmdbSeriesDetail`):

| TMDB field | Example raw value | Mapped field | Parsing notes |
|---|---|---|---|
| `name` | `"Spooks"` | `title` | via `str` |
| `first_air_date` | `"2002-05-13"` | `year` | via `extractYear` |
| `genres` | `[{"id":10759,"name":"Action & Adventure"},{"id":18,"name":"Drama"}]` | `genreIds` | extract each entry's `id` via `toInteger`, skipping entries with no `id` — distinct extraction from the flat `genre_ids` shape (see AC-09) |
| `poster_path` | `"/abc123.jpg"` | `posterPath` | via `str` |
| `number_of_seasons` | `10` | `numberOfSeasons` | via `toInteger` |
| `number_of_episodes` | `108` | `numberOfEpisodes` | via `toInteger` |

**New type**: `client/TmdbSeriesDetail.java` — a record `(String title, Integer year, List<Integer> genreIds, String posterPath, Integer numberOfSeasons, Integer numberOfEpisodes)`, colocated with `TmdbCandidate`/`TmdbSearchCandidate` in the `client` package.

---

### Requirement 4: `TmdbLookupCandidateDto`

**User story**: As a developer, I want the TMDB search-candidate shape isolated from `SeriesLookupCandidateDto`, so the two candidate spaces (OMDb-search candidates keyed by `imdbId`, TMDB-search candidates keyed by `tmdbId`) aren't conflated.

#### Acceptance Criteria

- **SERIES-012-AC-11** [AUTO]: A new `TmdbLookupCandidateDto` (`dto` package) shall expose `tmdbId`, `title`, `year`, `originalTitle` (nullable), `posterUrl` via plain getters/setters (no Lombok, per this repo's convention), following the existing `SeriesLookupCandidateDto` style — deliberately distinct from `SeriesLookupCandidateDto`: that one carries `imdbId`, this one carries `tmdbId`, since this candidate hasn't yet been resolved to an IMDb id.

---

### Requirement 5: `SeriesLookupService.searchTmdb`

**User story**: As a developer, I want the TMDB search-and-map flow available at the service layer in the same thin delegate-and-map style the existing lookup methods already use, so the controller stays equally thin for this third path.

#### Acceptance Criteria

- **SERIES-012-AC-12** [AUTO]: `SeriesLookupService` shall gain `searchTmdb(String title) -> List<TmdbLookupCandidateDto>`, delegating to `TmdbClient.search` and mapping each `TmdbSearchCandidate` onto a `TmdbLookupCandidateDto`, prepending `TmdbClient.POSTER_BASE_URL` to `posterPath` when present — mirroring exactly how `RecommendationService.toDto` already builds a poster URL from a raw path (`SERIES-012-AC-02`) — and leaving `posterUrl` `null` when `posterPath` is absent.
- **SERIES-012-AC-13** [AUTO]: When `TmdbClient.search` returns an empty list, `SeriesLookupService.searchTmdb` shall return an empty list — no not-found exception, same "empty list is a normal outcome" philosophy already established for `OmdbClient.search`/`SeriesLookupService.search` (`SERIES-011-AC-03`/`AC-10`).

---

### Requirement 6: `SeriesLookupService.resolveTmdbCandidate` — Resolve a TMDB Candidate, With OMDb-First Degraded Fallback

**User story**: As a user who picked a TMDB candidate because OMDb's own search couldn't find it, I want the app to still try for OMDb's richer detail (ratings, episode aggregation) via the candidate's resolved IMDb id, but never leave me at a dead end if OMDb genuinely has nothing — so I can add the series either way.

#### Acceptance Criteria

- **SERIES-012-AC-14** [AUTO]: `SeriesLookupService` shall gain `resolveTmdbCandidate(int tmdbId) -> SeriesLookupDto`, which shall first call `TmdbClient.externalIds(tmdbId)` to resolve an `Optional<String> imdbId` — reusing the same method `RecommendationService.dedupeAndExclude` already calls, not a new one.
- **SERIES-012-AC-15** [AUTO]: When `externalIds` resolves a present `imdbId`, `resolveTmdbCandidate` shall call `OmdbClient.lookupByImdbId(imdbId)` and, on success, map the result onto `SeriesLookupDto` using the exact same mapping `SeriesLookupService.lookupByImdbId` already applies (reused, not duplicated).
- **SERIES-012-AC-16** [AUTO]: If `OmdbClient.lookupByImdbId` throws `EntityNotFoundException` (OMDb has no record for that `imdbId`), `resolveTmdbCandidate` shall catch it and fall through to the degraded TMDB-detail path (`SERIES-012-AC-18`) instead of propagating a `404`.
- **SERIES-012-AC-17** [AUTO]: If `OmdbClient.lookupByImdbId` throws `ExternalServiceException` (a genuine OMDb outage/timeout/malformed response), `resolveTmdbCandidate` shall let it propagate unchanged — this is a real failure, not a routine "not found," and shall not be silently downgraded to the degraded path.
- **SERIES-012-AC-18** [AUTO]: When `externalIds` resolves no `imdbId` at all (empty `Optional`), **or** `OmdbClient.lookupByImdbId` throws `EntityNotFoundException` for a present one (`SERIES-012-AC-16`), `resolveTmdbCandidate` shall call `TmdbClient.details(tmdbId)` and build a `SeriesLookupDto` from it: `imdbId` set to whatever `externalIds` resolved (`null` if it resolved nothing at all); `genres` built by joining each of `TmdbSeriesDetail.genreIds` through `TmdbGenreTable.displayNameFor`, filtering unresolved ids, comma-joined — the exact pattern `RecommendationService.joinGenres` already uses (`series_spec_007_recommendation_sourcing.md`); `totalSeasons`/`totalEpisodes` copied directly from `numberOfSeasons`/`numberOfEpisodes` (no OMDb per-season aggregation for this path); `imdbRating`, `metacriticRating`, `rottenTomatoesRating` all `null` (no OMDb data available in this path).
- **SERIES-012-AC-19** [AUTO]: If `TmdbClient.externalIds` or `TmdbClient.details` throws `ExternalServiceException` (a genuine TMDB failure), `resolveTmdbCandidate` shall let it propagate unchanged.

---

### Requirement 7: `GET /api/v1/series/lookup/search-tmdb` Endpoint

**User story**: As a user, I want to search TMDB directly and see the candidates it actually has, so I can find a title OMDb's own search missed entirely.

#### Acceptance Criteria

- **SERIES-012-AC-20** [AUTO]: `SeriesController` shall expose `GET /api/v1/series/lookup/search-tmdb?title={title}` (required query param), delegating to `SeriesLookupService.searchTmdb(String title)`.
- **SERIES-012-AC-21** [AUTO]: A blank (present-but-whitespace-only) or missing `title` query param on this endpoint shall return `400 Bad Request` — missing is caught by Spring's own required-`@RequestParam` validation (`MissingServletRequestParameterException` → 400); blank-but-present is caught by an explicit `title.isBlank()` check throwing `IllegalArgumentException` — mirroring the existing `/lookup/search` endpoint's own blank-title handling (`SERIES-011-AC-13`).
- **SERIES-012-AC-22** [AUTO]: On success, including the zero-matches case, the endpoint shall return `200 OK` with `ApiResponse<List<TmdbLookupCandidateDto>>` — an empty array is a valid, non-error result, never a `404`.

---

### Requirement 8: `GET /api/v1/series/lookup/resolve-tmdb` Endpoint

**User story**: As a user, I want to confirm a specific TMDB candidate I picked and get its full resolved detail, so the form gets filled in from either OMDb's richer data or TMDB's own data — whichever is available.

#### Acceptance Criteria

- **SERIES-012-AC-23** [AUTO]: `SeriesController` shall expose `GET /api/v1/series/lookup/resolve-tmdb?tmdbId={tmdbId}` (required, typed `int`), delegating to `SeriesLookupService.resolveTmdbCandidate(int tmdbId)`.
- **SERIES-012-AC-24** [AUTO]: A missing `tmdbId` query param shall return `400 Bad Request` (`MissingServletRequestParameterException`, already mapped by `GlobalExceptionHandler`); a non-numeric `tmdbId` value shall likewise return `400 Bad Request` (`MethodArgumentTypeMismatchException`, already mapped by `GlobalExceptionHandler` — the same handler `GET /recommendations`'s typed params already exercise, e.g. `SERIES-007-AC-31`) — no new exception handling required for either case.
- **SERIES-012-AC-25** [AUTO]: On success — including the degraded case where `resolveTmdbCandidate` fell back to TMDB-only detail and some fields are `null` — the endpoint shall return `200 OK` with `ApiResponse<SeriesLookupDto>`. The degraded-but-successful case is never an error status (see design decisions above).
- **SERIES-012-AC-26** [AUTO]: If `resolveTmdbCandidate` throws `ExternalServiceException` (a genuine upstream failure from either OMDb or TMDB), the endpoint shall return `502 Bad Gateway`, using the existing `ExternalServiceException` → `502` `GlobalExceptionHandler` mapping unchanged.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `OmdbClient.lookupByImdbId`/`SeriesLookupService.lookupByImdbId` mapping, reused unchanged for the OMDb-success branch | `series_spec_011_omdb_search_candidates.md` |
| `TmdbClient.externalIds(tmdbId)`, already used by `RecommendationService.dedupeAndExclude` | `series_spec_006_recommendations.md` |
| `TmdbGenreTable` bean, `displayNameFor`/`idFor`, alias-vs-canonical vocabulary | `series_spec_010_genre_dropdown.md`, `series_spec_007_recommendation_sourcing.md` |
| `RecommendationService.joinGenres`/`RecommendationService.toDto` poster-URL pattern, reused for the degraded path and `searchTmdb` respectively | `RecommendationService.java`, `series_spec_007_recommendation_sourcing.md` |
| "Empty result is a normal `200`, not a `404`" precedent; `s=`-vs-`t=` two-endpoint split precedent this spec's `search-tmdb`/`resolve-tmdb` split mirrors | `series_spec_011_omdb_search_candidates.md`, `series_spec_003_search.md` |
| `ApiResponse<T>` envelope, `EntityNotFoundException`/`ExternalServiceException`/`IllegalArgumentException`/`MissingServletRequestParameterException`/`MethodArgumentTypeMismatchException` → status mappings, all reused unchanged | `series_spec_002_crud.md`, `series_spec_005_omdb_lookup.md`, `GlobalExceptionHandler.java` |
| Frontend consumer of both new endpoints, and where the "Search TMDB instead" affordance is actually surfaced | `frontend_spec_016_tmdb_lookup_fallback.md` |

---

## TDD Test Case Sketches

### `RecommendationServiceSpec.groovy` (addition)

```groovy
def "SERIES-012-AC-02: candidate poster URLs are built from TmdbClient.POSTER_BASE_URL"() {
    given: "a TMDB candidate with a poster_path"
        tmdbClient.discover(_, _) >> [
            new TmdbCandidate(99, "Discovered Show", 2020, "overview", "/poster.jpg",
                new BigDecimal("7.5"), [18], 100, "en")
        ]
        def criteria = new RecommendationCriteria(genres: ["Drama"])

    when: "recommendations are requested"
        def result = service.recommend(10, criteria)

    then: "the poster URL is built from TmdbClient's own constant, not a private duplicate"
        result[0].posterUrl() == TmdbClient.POSTER_BASE_URL + "/poster.jpg"
}
```

### `TmdbClientSpec.groovy` (additions)

```groovy
def "SERIES-012-AC-03/04/05: search maps every entry of results[] onto TmdbSearchCandidate, omitting a redundant originalTitle"() {
    given: "TMDB responds to a search with two results, one with a differing original_name"
        def body = '''
            {
              "results": [
                {"id": 4046, "name": "Spooks", "original_name": "Spooks",
                 "first_air_date": "2002-05-13", "poster_path": "/spooks.jpg",
                 "genre_ids": [10759, 18]},
                {"id": 65327, "name": "Money Heist", "original_name": "La Casa de Papel",
                 "first_air_date": "2017-05-02", "poster_path": null, "genre_ids": []}
              ]
            }
        '''
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("search/tv")))
            .andExpect(method(HttpMethod.GET))
            .andExpect(queryParam("query", "Spooks"))
            .andExpect(queryParam("api_key", API_KEY))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

    when: "TmdbClient.search('Spooks') is called"
        def result = client().search("Spooks")

    then: "both entries are mapped, originalTitle omitted only when identical to title"
        result.size() == 2
        result[0].tmdbId() == 4046
        result[0].title() == "Spooks"
        result[0].originalTitle() == null
        result[0].year() == 2002
        result[0].posterPath() == "/spooks.jpg"
        result[0].genreIds() == [10759, 18]
        result[1].tmdbId() == 65327
        result[1].title() == "Money Heist"
        result[1].originalTitle() == "La Casa de Papel"
        result[1].posterPath() == null
}

def "SERIES-012-AC-06: an absent or empty results array maps to an empty list, no exception"() {
    given: "TMDB responds with no matches"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("search/tv")))
            .andRespond(withSuccess('{"results":[]}', MediaType.APPLICATION_JSON))

    when: "TmdbClient.search(...) is called"
        def result = client().search("Nonexistent Show 12345")

    then: "the result is an empty list, no exception is thrown"
        result == []
}

def "SERIES-012-AC-07: a non-2xx response from TMDB raises ExternalServiceException"() {
    given: "TMDB responds with a server error"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("search/tv")))
            .andRespond(withServerError())

    when: "TmdbClient.search(...) is called"
        client().search("Any Show")

    then: "an ExternalServiceException is raised"
        thrown(ExternalServiceException)
}

def "SERIES-012-AC-08/09: details maps /tv/{id}, extracting genre ids from the {id,name} object array shape"() {
    given: "TMDB responds to /tv/4046 with the full detail shape"
        def body = '''
            {
              "name": "Spooks",
              "first_air_date": "2002-05-13",
              "genres": [{"id": 10759, "name": "Action & Adventure"}, {"id": 18, "name": "Drama"}],
              "poster_path": "/spooks.jpg",
              "number_of_seasons": 10,
              "number_of_episodes": 108
            }
        '''
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/4046")))
            .andExpect(method(HttpMethod.GET))
            .andExpect(queryParam("api_key", API_KEY))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))

    when: "TmdbClient.details(4046) is called"
        def result = client().details(4046)

    then: "every field is mapped, genreIds extracted from the genres[].id shape, not a flat array"
        result.title() == "Spooks"
        result.year() == 2002
        result.genreIds() == [10759, 18]
        result.posterPath() == "/spooks.jpg"
        result.numberOfSeasons() == 10
        result.numberOfEpisodes() == 108
}

def "SERIES-012-AC-10: a non-2xx response from TMDB raises ExternalServiceException"() {
    given: "TMDB responds with a server error"
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("tv/4046")))
            .andRespond(withServerError())

    when: "TmdbClient.details(...) is called"
        client().details(4046)

    then: "an ExternalServiceException is raised"
        thrown(ExternalServiceException)
}
```

### `SeriesLookupServiceSpec.groovy` (additions)

```groovy
class SeriesLookupServiceSpec extends Specification {

    OmdbClient omdbClient = Mock()
    TmdbClient tmdbClient = Mock()
    TmdbGenreTable genreTable = new TmdbGenreTable()
    SeriesLookupService lookupService = new SeriesLookupService(omdbClient, tmdbClient, genreTable)

    def "SERIES-012-AC-12: maps each TmdbSearchCandidate onto a TmdbLookupCandidateDto, prepending the poster base URL"() {
        given: "TmdbClient resolves one candidate for the requested title"
            tmdbClient.search("Spooks") >> [
                new TmdbSearchCandidate(4046, "Spooks", null, 2002, "/spooks.jpg", [10759, 18]),
            ]

        when: "the title is searched via TMDB"
            def dtos = lookupService.searchTmdb("Spooks")

        then: "the candidate is mapped, with the poster path resolved to a full URL"
            dtos.size() == 1
            dtos[0].tmdbId == 4046
            dtos[0].title == "Spooks"
            dtos[0].posterUrl == TmdbClient.POSTER_BASE_URL + "/spooks.jpg"
    }

    def "SERIES-012-AC-13: an empty TMDB candidate list maps to an empty DTO list"() {
        given: "TmdbClient resolves no candidates"
            tmdbClient.search("Nonexistent Show") >> []

        when: "the title is searched via TMDB"
            def dtos = lookupService.searchTmdb("Nonexistent Show")

        then: "the result is an empty list"
            dtos == []
    }

    def "SERIES-012-AC-14/15: an imdbId resolves and OMDb succeeds -- maps via the existing lookupByImdbId mapping"() {
        given: "TMDB resolves an imdbId, and OMDb has a record for it"
            tmdbClient.externalIds(4046) >> Optional.of("tt0160904")
            def omdbResult = new OmdbLookupResult(
                "Spooks", 2002, "Action, Drama, Thriller", 10, 108,
                new BigDecimal("7.9"), 71, 78, "https://example.com/spooks.jpg", "tt0160904"
            )
            omdbClient.lookupByImdbId("tt0160904") >> omdbResult

        when: "the candidate is resolved"
            def dto = lookupService.resolveTmdbCandidate(4046)

        then: "the OMDb result is mapped, and TMDB's own detail endpoint is never called"
            dto.title == "Spooks"
            dto.imdbId == "tt0160904"
            dto.imdbRating == new BigDecimal("7.9")
            0 * tmdbClient.details(_)
    }

    def "SERIES-012-AC-16/18: OMDb has no record for a resolved imdbId -- falls through to TMDB's own detail"() {
        given: "TMDB resolves an imdbId, but OMDb has no record for it"
            tmdbClient.externalIds(4046) >> Optional.of("tt0160904")
            omdbClient.lookupByImdbId("tt0160904") >> { throw new EntityNotFoundException("No OMDb results for imdbId: tt0160904") }
            tmdbClient.details(4046) >> new TmdbSeriesDetail("Spooks", 2002, [10759, 18], "/spooks.jpg", 10, 108)

        when: "the candidate is resolved"
            def dto = lookupService.resolveTmdbCandidate(4046)

        then: "a SeriesLookupDto is built from TMDB's own detail, ratings absent, imdbId still populated"
            dto.title == "Spooks"
            dto.imdbId == "tt0160904"
            dto.genres == "Action & Adventure, Drama"
            dto.totalSeasons == 10
            dto.totalEpisodes == 108
            dto.imdbRating == null
            dto.metacriticRating == null
            dto.rottenTomatoesRating == null
    }

    def "SERIES-012-AC-17: an OMDb ExternalServiceException propagates unchanged, without falling back to TMDB detail"() {
        given: "TMDB resolves an imdbId, but OMDb itself is unreachable"
            tmdbClient.externalIds(4046) >> Optional.of("tt0160904")
            omdbClient.lookupByImdbId("tt0160904") >> { throw new ExternalServiceException("OMDb request failed") }

        when: "the candidate is resolved"
            lookupService.resolveTmdbCandidate(4046)

        then: "the external-service exception propagates, and TMDB's detail endpoint is never called"
            thrown(ExternalServiceException)
            0 * tmdbClient.details(_)
    }

    def "SERIES-012-AC-18: no imdbId resolves at all -- falls straight to TMDB's own detail, OMDb never called"() {
        given: "TMDB has no IMDb cross-reference for this id"
            tmdbClient.externalIds(4046) >> Optional.empty()
            tmdbClient.details(4046) >> new TmdbSeriesDetail("Spooks", 2002, [10759, 18], "/spooks.jpg", 10, 108)

        when: "the candidate is resolved"
            def dto = lookupService.resolveTmdbCandidate(4046)

        then: "a SeriesLookupDto is built from TMDB's own detail, imdbId null, OMDb never consulted"
            dto.imdbId == null
            dto.title == "Spooks"
            0 * omdbClient.lookupByImdbId(_)
    }

    def "SERIES-012-AC-19: a TmdbClient.externalIds failure propagates unchanged"() {
        given: "TMDB itself is unreachable"
            tmdbClient.externalIds(4046) >> { throw new ExternalServiceException("TMDB request failed") }

        when: "the candidate is resolved"
            lookupService.resolveTmdbCandidate(4046)

        then: "the external-service exception propagates"
            thrown(ExternalServiceException)
    }

    def "SERIES-012-AC-19: a TmdbClient.details failure in the degraded path propagates unchanged"() {
        given: "no imdbId resolves, and TMDB's own detail endpoint then fails"
            tmdbClient.externalIds(4046) >> Optional.empty()
            tmdbClient.details(4046) >> { throw new ExternalServiceException("TMDB request failed") }

        when: "the candidate is resolved"
            lookupService.resolveTmdbCandidate(4046)

        then: "the external-service exception propagates"
            thrown(ExternalServiceException)
    }
}
```

### `SeriesControllerLookupSpec.groovy` (additions)

```groovy
def "SERIES-012-AC-20/22: GET /api/v1/series/lookup/search-tmdb returns 200 with a list of candidates"() {
    given: "the lookup service resolves one TMDB candidate for the requested title"
        def candidates = [
            new TmdbLookupCandidateDto(tmdbId: 4046, title: "Spooks", year: 2002, posterUrl: "https://image.tmdb.org/t/p/w500/spooks.jpg"),
        ]
        when(seriesLookupService.searchTmdb("Spooks")).thenReturn(candidates)

    when: "the search-tmdb endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search-tmdb").param("title", "Spooks"))

    then: "the candidates are returned under the data envelope"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data[0].tmdbId').value(4046))
        result.andExpect(jsonPath('$.data[0].title').value("Spooks"))
}

def "SERIES-012-AC-22: zero matches still returns 200 with an empty array"() {
    given: "the lookup service resolves no TMDB candidates"
        when(seriesLookupService.searchTmdb("Nonexistent")).thenReturn([])

    when: "the search-tmdb endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search-tmdb").param("title", "Nonexistent"))

    then: "the response is 200 with an empty data array, not a 404"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data').isArray())
        result.andExpect(jsonPath('$.data.length()').value(0))
}

def "SERIES-012-AC-21: a blank title on the search-tmdb endpoint returns 400 without calling the service"() {
    when: "the search-tmdb endpoint is invoked with a blank title"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search-tmdb").param("title", "  "))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())

    and: "the lookup service is never invoked"
        verifyNoInteractions(seriesLookupService)
}

def "SERIES-012-AC-21: a missing title on the search-tmdb endpoint returns 400"() {
    when: "the search-tmdb endpoint is invoked with no title param at all"
        def result = mockMvc.perform(get("/api/v1/series/lookup/search-tmdb"))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
}

def "SERIES-012-AC-23/25: GET /api/v1/series/lookup/resolve-tmdb delegates and returns 200, including a degraded result"() {
    given: "the lookup service resolves a degraded (TMDB-only) result for the requested tmdbId"
        def dto = new SeriesLookupDto(title: "Spooks", imdbId: "tt0160904", genres: "Action & Adventure, Drama")
        when(seriesLookupService.resolveTmdbCandidate(4046)).thenReturn(dto)

    when: "the resolve-tmdb endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/resolve-tmdb").param("tmdbId", "4046"))

    then: "the mapped fields are returned under the data envelope, with a normal 200 despite absent ratings"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data.title').value("Spooks"))
        result.andExpect(jsonPath('$.data.imdbRating').doesNotExist())
}

def "SERIES-012-AC-24: a missing tmdbId on the resolve-tmdb endpoint returns 400"() {
    when: "the resolve-tmdb endpoint is invoked with no tmdbId param at all"
        def result = mockMvc.perform(get("/api/v1/series/lookup/resolve-tmdb"))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
}

def "SERIES-012-AC-24: a non-numeric tmdbId on the resolve-tmdb endpoint returns 400"() {
    when: "the resolve-tmdb endpoint is invoked with a non-numeric tmdbId"
        def result = mockMvc.perform(get("/api/v1/series/lookup/resolve-tmdb").param("tmdbId", "not-a-number"))

    then: "the response is a 400 Bad Request"
        result.andExpect(status().isBadRequest())
}

def "SERIES-012-AC-26: an upstream failure resolving a TMDB candidate returns 502"() {
    given: "the lookup service reports a genuine upstream failure"
        when(seriesLookupService.resolveTmdbCandidate(4046)).thenThrow(new ExternalServiceException("TMDB request failed"))

    when: "the resolve-tmdb endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/lookup/resolve-tmdb").param("tmdbId", "4046"))

    then: "the response is a 502 Bad Gateway"
        result.andExpect(status().isBadGateway())
}
```

**Test Case (Green)** for every sketch above: implement `TmdbClient.POSTER_BASE_URL`/`search`/`details`, `TmdbSearchCandidate`, `TmdbSeriesDetail`, `TmdbLookupCandidateDto`, `SeriesLookupService.searchTmdb`/`resolveTmdbCandidate` (constructor-injecting `TmdbClient` and `TmdbGenreTable` alongside the existing `OmdbClient`), and the two `SeriesController` endpoints, until the specs above pass.

---

## Acceptance Criteria Summary

- [x] SERIES-012-AC-01: `TmdbClient.POSTER_BASE_URL` public static final constant
- [x] SERIES-012-AC-02: `RecommendationService` references `TmdbClient.POSTER_BASE_URL`, own private copy removed
- [x] SERIES-012-AC-03: `TmdbClient.search(query)` calls `GET /search/tv?query=`
- [x] SERIES-012-AC-04: maps `results[]` entries onto `TmdbSearchCandidate`, reusing existing parsing helpers
- [x] SERIES-012-AC-05: `originalTitle` null when absent or identical to `title`
- [x] SERIES-012-AC-06: empty/missing `results[]` → empty list, no exception
- [x] SERIES-012-AC-07: search upstream failure / unset key → `ExternalServiceException`
- [x] SERIES-012-AC-08: `TmdbClient.details(tmdbId)` calls `GET /tv/{tmdbId}`
- [x] SERIES-012-AC-09: maps detail response onto `TmdbSeriesDetail`, `genres[].id` extraction distinct from flat `genre_ids`
- [x] SERIES-012-AC-10: details upstream failure / unset key → `ExternalServiceException`
- [x] SERIES-012-AC-11: `TmdbLookupCandidateDto` shape
- [x] SERIES-012-AC-12: `SeriesLookupService.searchTmdb(title)` delegate-and-map, poster URL prepended
- [x] SERIES-012-AC-13: empty TMDB search result → empty DTO list
- [x] SERIES-012-AC-14: `resolveTmdbCandidate` calls `TmdbClient.externalIds` first
- [x] SERIES-012-AC-15: present `imdbId` + OMDb success → mapped via existing `lookupByImdbId` mapping
- [x] SERIES-012-AC-16: OMDb `EntityNotFoundException` for a present `imdbId` → falls through to degraded path
- [x] SERIES-012-AC-17: OMDb `ExternalServiceException` → propagates unchanged, no fallback
- [x] SERIES-012-AC-18: absent `imdbId`, or OMDb not-found → `TmdbClient.details`-based degraded `SeriesLookupDto`
- [x] SERIES-012-AC-19: TMDB `ExternalServiceException` (from `externalIds` or `details`) → propagates unchanged
- [x] SERIES-012-AC-20: `GET /api/v1/series/lookup/search-tmdb?title=` endpoint
- [x] SERIES-012-AC-21: blank/missing `title` on search-tmdb endpoint → 400
- [x] SERIES-012-AC-22: 200 + `ApiResponse<List<TmdbLookupCandidateDto>>`, empty array never 404
- [x] SERIES-012-AC-23: `GET /api/v1/series/lookup/resolve-tmdb?tmdbId=` endpoint
- [x] SERIES-012-AC-24: missing/non-numeric `tmdbId` → 400 (existing exception handlers, no new code)
- [x] SERIES-012-AC-25: 200 + `ApiResponse<SeriesLookupDto>`, including the degraded case with null fields
- [x] SERIES-012-AC-26: `ExternalServiceException` from `resolveTmdbCandidate` → 502

---

## Implementation Notes

- All 26 acceptance criteria are implemented exactly as specced, with one minor test-fixture
  correction: the `RecommendationServiceSpec.groovy` sketch for `SERIES-012-AC-02` didn't stub
  `tmdbClient.externalIds(99)`. Every other `RecommendationServiceSpec` test that reaches
  `dedupeAndExclude` stubs `externalIds` explicitly (an unstubbed `Optional`-returning `Mock()`
  call returns `null`, not `Optional.empty()`, which threw an NPE from `RecommendationService
  .dedupeAndExclude`), so the added test stubs `tmdbClient.externalIds(99) >>
  Optional.of("tt0000099")` to match the rest of the file's convention. No production code was
  affected by this.
- The degraded-path `SeriesLookupDto` built in `SeriesLookupService.resolveTmdbCandidate` also
  populates `posterUrl` from `TmdbSeriesDetail.posterPath()` (prepending `TmdbClient
  .POSTER_BASE_URL`) even though this wasn't explicitly called out as a separate acceptance
  criterion -- `SeriesLookupDto` already has a `posterUrl` field, and leaving it `null` in the
  degraded case when TMDB's own detail response does carry a poster path would be a needless
  regression versus the OMDb-success path.
- `SeriesLookupService`'s class-level Javadoc was updated to describe the widened exception-
  propagation contract (`resolveTmdbCandidate` now deliberately catches `EntityNotFoundException`
  but not `ExternalServiceException` from `OmdbClient.lookupByImdbId`), since the class had
  previously documented "propagates unchanged, never catches" as a blanket statement.
