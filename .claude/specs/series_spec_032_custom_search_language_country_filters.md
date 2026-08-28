# Series Spec 032: Custom Search Pre-Fetch Filters — Language & Country of Origin

**Status**: Implemented (2026-08-28) -- `backend/src/main/java/uk/co/stefirby/seriestracker/client/DiscoverFilters.java`,
`backend/src/main/java/uk/co/stefirby/seriestracker/client/TmdbClient.java`,
`backend/src/main/java/uk/co/stefirby/seriestracker/dto/RecommendationCriteria.java`,
`backend/src/main/java/uk/co/stefirby/seriestracker/service/RecommendationSourcingService.java`,
`backend/src/main/java/uk/co/stefirby/seriestracker/service/RecommendationOutputFilterService.java`,
`backend/src/main/java/uk/co/stefirby/seriestracker/controller/SeriesRecommendationController.java`
(`countries` query param wiring -- not explicitly called out in this spec's Area line, but needed
so the new `RecommendationCriteria.countries` field is actually reachable from the API, mirroring
every other list-shaped criteria field's existing wiring),
`backend/src/test/groovy/uk/co/stefirby/seriestracker/client/TmdbClientSpec.groovy`,
`backend/src/test/groovy/uk/co/stefirby/seriestracker/service/RecommendationSourcingServiceSpec.groovy`,
`backend/src/test/groovy/uk/co/stefirby/seriestracker/service/RecommendationOutputFilterServiceSpec.groovy`,
`backend/src/test/groovy/uk/co/stefirby/seriestracker/service/RecommendationServiceSpec.groovy`
(`DiscoverFilters` constructor call sites updated for the two new fields, no behavior change),
`backend/src/test/groovy/uk/co/stefirby/seriestracker/controller/SeriesControllerRecommendationsSpec.groovy`.
Frontend half (`frontend_spec_047`) not yet implemented -- see that spec/`ROADMAP.md`.
**Verification note (AC-02)**: TMDB's official live OpenAPI schema (fetched from
`developer.themoviedb.org/reference/discover-tv` during implementation) documents `with_genres`/
`with_keywords`/`with_companies`/`with_people`/`with_status` etc. as each explicitly "can be a
comma (`AND`) or pipe (`OR`) separated query" -- but `with_origin_country` and
`with_original_language` carry **no such description at all**, just a bare `{"type":"string"}`.
This is a real discrepancy from this spec's comma-joined-OR assumption, not merely "unverified" --
implemented as designed (comma-joined) per the spec's explicit decision. **Corrected (2026-08-28):** a first
live-verification pass (`countries=US,GB` returning a mix of `GB`/`US` candidates) was wrongly read as
confirming comma=OR -- US/GB happen to have enough genuine dual-produced shows (e.g. *Sherlock*, a BBC/
Masterpiece co-production) that AND-matching looks identical to OR-matching for that specific pair, since a
single candidate's `originCountry` only ever surfaces one of its several actual origin countries. A second,
more rigorous pass (countries with few or no real co-productions) exposed the truth:
`GET /recommendations?countries=JP` and `?countries=SE` each returned real results individually, but
`?countries=JP,SE` (comma) returned **0** -- comma is an **AND** for `with_origin_country`, same as
`with_original_language`'s single-value-only behavior, *not* the OR semantics `with_genres`/`with_keywords` get
from comma. Pipe (`|`) is the actual OR separator (`?countries=JP,SE` sent as `with_origin_country=JP|SE`
returns real results, confirmed by removing the popularity-sort bias enough to surface an actual Swedish title
in the union). `TmdbClient.discover()` now joins `countries` with `|`, URL-encoded as `%7C`. (The post-fetch
`matchesCountries` check in `RecommendationOutputFilterService` was always a correct OR/`anyMatch` regardless
of this bug -- so a comma-joined pre-fetch request under-fetched relative to what the post-fetch filter would
have allowed, rather than ever returning wrong results, but the practical effect was still severely narrowed
result sets whenever more than one country was selected.)
**Priority**: P3 (extends `series_spec_031`'s pre-fetch relocation to the two remaining fields from the original
consolidated discussion)
**Depends on**: Series Spec 031 (`series_spec_031_custom_search_prefetch_filters.md`, owns the `DiscoverFilters`
record this spec extends — **must ship first**, this spec's `TmdbClient.discover()` changes assume that record
already exists) ✅. Series Spec 024 (`series_spec_024_discover_filters_and_vote_threshold.md`, owns the existing
post-fetch `language` filter this spec partially relocates) ✅.
**Area**: Backend (`dto/RecommendationCriteria.java`, `client/TmdbClient.java`,
`service/RecommendationSourcingService.java`, `service/RecommendationOutputFilterService.java`) — paired with
Frontend Spec 047 (`frontend_spec_047_custom_search_language_country_filters_ui.md`) for the UI.

## Overview

Second half of the "push Discover-mode output filters upward" work `series_spec_031` started. This spec covers
the two remaining fields: `language` (already exists as a post-fetch-only filter, `series_spec_024`) and a new
`countries` filter (doesn't exist in any form yet, despite the underlying data — `TmdbCandidate.originCountry()`
— already flowing through the pipeline since `series_spec_021`). Both become **pre-fetch, for Custom Search
only** — same scope decision as `series_spec_031`: Popular Right Now (`/trending/tv`) structurally can't accept
`discover/tv`-style params; Highest Rated and "Use My Series" keep post-fetch-only behavior by choice.

**Confirmed asymmetry, decided in discussion**: unlike `series_spec_031`'s year fields, `language`/`countries`
have no TMDB-response-data problem — both `original_language` and `origin_country` are present on every
candidate TMDB already returns (discover, trending, and topRated responses alike), so the existing/new post-fetch
checks can safely keep running unconditionally for every mode, exactly like `minTmdbRating`'s precedent. No
"skip for Custom Search" logic is needed here (contrast `series_spec_031`'s year-check skip, which was needed
specifically because TMDB's response carries no episode-level date data to correctly re-verify against).

**Language stays single-select; Country becomes multi-select — a deliberate, decided asymmetry, not an
oversight.** TMDB's `with_original_language` `discover/tv` param accepts one value only. `with_origin_country`
accepts multiple, **pipe (`|`) joined, OR-matched** — corrected 2026-08-28 after live testing found comma is an
**AND** for this specific param (unlike `with_genres`/`with_keywords`, where comma=AND and pipe=OR both exist as
documented options); see the Status header's Verification note for the full story. Making `language` multi-select
despite the single-value constraint would mean only the
first of several selected languages ever reaches TMDB pre-fetch, silently falling back to post-fetch-only for
the rest — reintroducing the exact sparse-page problem this effort exists to avoid. Decided: keep `language` as
the single `String` it already is on `RecommendationCriteria`; add `countries` as a new `List<String>`.

## Design Decisions

- **`RecommendationCriteria.language`'s type and existing semantics are unchanged** — still a single `String`,
  still ISO 639-1. This spec only changes *how* `sourceByGenreOrKeyword` uses it (also sends it to TMDB, in
  addition to the existing post-fetch check), not its shape.
- **New `RecommendationCriteria.countries: List<String>` field**, mirroring `excludeGenres`'s existing shape
  exactly (`null`/empty = no filter, non-empty = OR-match). ISO 3166-1 alpha-2 codes, matching
  `TmdbCandidate.originCountry()`'s existing format (already a plain code, e.g. `"US"` — confirmed via
  `TmdbClient.firstOriginCountry`).
- **`DiscoverFilters` (introduced in `series_spec_031`) gains two more fields**: `String language` and
  `List<String> countries`, alongside the existing `minVoteCount`/`minTmdbRating`/`yearMin`/`yearMax`.
  `DiscoverFilters.NONE` is updated to include `null`/`List.of()` for the two new fields — `genreBasedSupplement`
  ("Use My Series" genre top-up)'s existing call site keeps compiling and behaving identically without any
  changes of its own, since it already passes `DiscoverFilters.NONE` wholesale.
- **New post-fetch `matchesCountries` check, applied unconditionally for every mode** — same "always runs,
  regardless of sourcing mode" shape `matchesLanguage`/`matchesExcludeGenres` already use. This is the filter's
  actual baseline existence (it works everywhere); Custom Search additionally gets the pre-fetch optimization on
  top, exactly mirroring how `minTmdbRating` works in `series_spec_031`.
- **No skip condition needed for either field's post-fetch check** — see the Overview's confirmed-asymmetry note.
  Both checks simply keep running unconditionally after this spec, for every mode, no special-casing.

---

## Requirement 1: `TmdbClient.discover()` sends `with_original_language`/`with_origin_country`

**User story**: As a user running a Custom Search, I want TMDB itself to narrow by language and country of
origin, for the same reason `series_spec_031` already does this for rating and year.

### SERIES-032-AC-01 [AUTO]
**Statement**: When `DiscoverFilters.language` is non-blank, `TmdbClient.discover()` shall send
`with_original_language` set to that value; when blank/null, the parameter shall be omitted.

**References**: `DiscoverFilters` (extended from `series_spec_031`), `TmdbClient.discover()`'s existing
omit-when-unset pattern.

**Test Case (Red)**:
```groovy
def "SERIES-032-AC-01: sends with_original_language when language is set"() {
    given: "a mocked TMDB response"
        mockServer.expect(requestTo(containsString("with_original_language=en")))
            .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

    when: "discover is called with language=en"
        client.discover([35], [], "popularity.desc",
            new DiscoverFilters(0, null, null, null, "en", List.of()))

    then: "the request included with_original_language=en"
        mockServer.verify()
}
```
**Test Case (Green)**: `discover()` conditionally appends `with_original_language` when
`filters.language() != null && !filters.language().isBlank()`.

---

### SERIES-032-AC-02 [AUTO]
**Statement**: When `DiscoverFilters.countries` is non-empty, `TmdbClient.discover()` shall send
`with_origin_country` as a **pipe-joined** list of the values (OR semantics); when empty/null, the parameter
shall be omitted.

**Correction (2026-08-28)**: originally specced/implemented as comma-joined, matching `with_genres`'s AND
convention by analogy. Live testing found comma is actually an **AND** for `with_origin_country` specifically
(`countries=JP,SE` returned 0 results despite each individually returning results) — pipe is the real OR
separator for this param. See the spec's Status header for the full verification story.

**Test Case (Red)**:
```groovy
def "SERIES-032-AC-02: sends with_origin_country as a pipe-joined list"() {
    given: "a mocked TMDB response"
        mockServer.expect(requestTo(containsString("with_origin_country=US%7CGB")))
            .andRespond(withSuccess('{"results": []}', MediaType.APPLICATION_JSON))

    when: "discover is called with countries=[US, GB]"
        client.discover([35], [], "popularity.desc",
            new DiscoverFilters(0, null, null, null, null, ["US", "GB"]))

    then: "the request included with_origin_country=US|GB (pipe-joined, OR semantics)"
        mockServer.verify()
}
```
**Test Case (Green)**: `discover()` conditionally appends `with_origin_country`, pipe-joined, when
`filters.countries()` is non-empty — verify TMDB's actual expected join character against live `discover/tv`
docs before implementing; this AC assumes comma pending that check.

---

### SERIES-032-AC-03 [AUTO]
**Statement**: `series_spec_031`'s existing `vote_average.gte`/`air_date.gte`/`air_date.lte`/`vote_count.gte`
behavior shall be unchanged by extending `DiscoverFilters` with two more fields.

**Test Case (Green)**: no behavior change — confirms the record extension didn't alter any existing field's
handling. Covered by `series_spec_031`'s own AC-01 through AC-04 continuing to pass unmodified.

---

## Requirement 2: Custom Search sourcing passes `language`/`countries`; every other path is unaffected

### SERIES-032-AC-04 [AUTO]
**Statement**: `RecommendationCriteria` shall gain a `countries: List<String>` field (getter/setter), following
the same `null`/empty-means-no-op convention as `excludeGenres`.

**Test Case (Green)**: add the field; no validation beyond what `RecommendationCriteriaValidator` already does
generically for list-shaped criteria fields (none needed here — any string is a syntactically valid, if
possibly-unmatched, country code).

---

### SERIES-032-AC-05 [AUTO]
**Statement**: `RecommendationSourcingService.sourceByGenreOrKeyword` shall pass the request's
`language`/`countries` into `TmdbClient.discover()`'s `DiscoverFilters`, alongside the existing fields.

**Test Case (Red)**:
```groovy
def "SERIES-032-AC-05: Custom Search sourcing passes language/countries to discover"() {
    given: "criteria directed by genre with language and countries set"
        def criteria = new RecommendationCriteria(genres: ["Comedy"], language: "en", countries: ["US", "GB"])

    when: "sourceByGenreOrKeyword runs"
        sourcingService.sourceByGenreOrKeyword(criteria)

    then: "TmdbClient.discover was called with a DiscoverFilters carrying the same values"
        1 * tmdbClient.discover(_, _, _, { DiscoverFilters f ->
            f.language() == "en" && f.countries() == ["US", "GB"]
        }) >> []
}
```
**Test Case (Green)**: `sourceByGenreOrKeyword` reads `criteria.getLanguage()`/`getCountries()` into the
`DiscoverFilters` it builds.

---

### SERIES-032-AC-06 [AUTO]
**Statement**: `genreBasedSupplement` ("Use My Series" genre-based top-up) shall continue passing no
language/country filter, regardless of the request's `language`/`countries` — unaffected by this spec.

**Test Case (Green)**: `DiscoverFilters.NONE` already carries `null`/`List.of()` for both new fields — no code
change needed at this call site, confirmed by `series_spec_031`'s AC-06 continuing to pass unmodified plus a
direct assertion that the two new fields are absent from that call's `DiscoverFilters`.

---

### SERIES-032-AC-07 [AUTO]
**Statement**: `sourceTrending` and `sourceTopRated` shall remain completely unaffected — neither sends
`language`/`countries` to TMDB.

**Test Case (Green)**: no change to either method — regression guard, mirrors `series_spec_031`'s AC-07.

---

## Requirement 3: New/existing post-fetch checks run unconditionally, for every mode

### SERIES-032-AC-08 [AUTO]
**Statement**: A new post-fetch `matchesCountries` check shall exclude a candidate whose
`TmdbCandidate.originCountry()` doesn't case-insensitively match any entry in `RecommendationCriteria.countries`
— applied unconditionally, for every source mode. A `null`/empty `countries` list is a no-op (every candidate
passes).

**References**: `RecommendationOutputFilterService.applyOutputFilters`'s existing filter chain, mirroring
`matchesExcludeGenres`'s shape (inverted: include-match, not exclude-match).

**Test Case (Red)**:
```groovy
def "SERIES-032-AC-08: matchesCountries excludes a non-matching candidate"() {
    given: "criteria filtering to US/GB, and a candidate originating from Japan"
        def criteria = new RecommendationCriteria(countries: ["US", "GB"])
        def candidate = candidateWithOriginCountry("JP")

    when: "output filters run"
        def result = outputFilterService.applyOutputFilters([candidate], criteria)

    then: "the candidate is excluded"
        result.isEmpty()
}

def "SERIES-032-AC-08: a null countries list is a no-op"() {
    given: "criteria with no countries filter"
        def criteria = new RecommendationCriteria()
        def candidate = candidateWithOriginCountry("JP")

    when: "output filters run"
        def result = outputFilterService.applyOutputFilters([candidate], criteria)

    then: "the candidate passes"
        result.size() == 1
}
```
**Test Case (Green)**: add `matchesCountries` to the filter chain, applied unconditionally (no mode gate).

---

### SERIES-032-AC-09 [AUTO]
**Statement**: The existing `matchesLanguage` post-fetch check shall continue running unconditionally for every
mode, unchanged by this spec.

**Test Case (Green)**: no code change — regression guard confirming `matchesLanguage` isn't accidentally
skipped for Custom Search the way `series_spec_031`'s year check needed to be (the Overview explains why that
skip doesn't apply here).

---

## Implementation Notes

- **Resolved (2026-08-28)**: `with_origin_country`'s join character was verified live and found to genuinely
  differ from `with_genres`/`with_keywords` — comma is AND, pipe is OR, for this param specifically. AC-02
  implements pipe-joined. See the Status header's Verification note for how the initial (wrong) comma-based
  verification passed a US/GB test by coincidence.
- **`API.md` needs updating** (Definition of Done) — document the new `countries` request param, its `null`/
  empty-means-no-filter convention, and the language/countries pre-fetch-vs-post-fetch asymmetry across modes
  (mirrors the note `series_spec_031` already flags for year semantics).

## Cross-References

| This spec | Source |
|---|---|
| `DiscoverFilters` record this spec extends — **must ship first** | `series_spec_031_custom_search_prefetch_filters.md` |
| Existing post-fetch `language` filter this spec partially relocates | `series_spec_024_discover_filters_and_vote_threshold.md` |
| `TmdbCandidate.originCountry()`, the data source both the new pre-fetch param and post-fetch check use | `series_spec_021_origin_country.md` |
| Frontend UI (pinned-chip country picker, single-select language picker) | `frontend_spec_047_custom_search_language_country_filters_ui.md` |
| Original consolidated discussion, including the language-single-select vs country-multi-select decision | `.claude/SPEC_CANDIDATES.md`, "Country-of-origin and language recommendation filters..." and "Push Discover-mode output filters upward..." |

---

## Acceptance Criteria Summary

- [x] SERIES-032-AC-01: `with_original_language` sent when `language` is set
- [x] SERIES-032-AC-02: `with_origin_country` sent as a pipe-joined list when `countries` is set (corrected 2026-08-28 — was comma)
- [x] SERIES-032-AC-03: `series_spec_031`'s existing params unaffected (regression guard)
- [x] SERIES-032-AC-04: `RecommendationCriteria` gains `countries`
- [x] SERIES-032-AC-05: Custom Search sourcing passes `language`/`countries`
- [x] SERIES-032-AC-06: genre-based top-up (Use My Series) unaffected
- [x] SERIES-032-AC-07: Popular Right Now / Highest Rated unaffected
- [x] SERIES-032-AC-08: new `matchesCountries` post-fetch check, unconditional
- [x] SERIES-032-AC-09: existing `matchesLanguage` check unaffected
