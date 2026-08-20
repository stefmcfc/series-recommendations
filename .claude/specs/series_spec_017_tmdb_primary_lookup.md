# Spec 017: TMDB-Primary Lookup & Narrowed OMDb Rating Enrichment

**Status**: Not started
**Priority**: P1 (OMDb search/candidate flow has a real, unfixable data gap — TMDB search already superset-matches everything OMDb's own search does, per the "Spooks"/"MI-5" case proven in `series_spec_012`)
**Depends on**: Series Spec 006 (`TmdbClient`), Series Spec 012 (`TmdbClient.search`/`details`/`externalIds`, the TMDB-fallback resolve logic this spec inverts into the primary path)
**Backend Task**

## Overview

Inverts this app's lookup architecture: TMDB search/detail becomes the **sole** source for adding a series (title, year, genres, poster, season/episode counts, and two new fields — `tmdbRating`/`tmdbVoteCount`), and OMDb is narrowed from "the whole lookup" down to a single best-effort enrichment call for `imdbRating`/`rottenTomatoesRating` only, keyed off the `imdbId` TMDB itself resolves. OMDb's own search (`s=`) and single-best-guess lookup (`t=`) are removed entirely — not kept as a fallback — because TMDB's search already finds everything OMDb's search does, and more (TMDB matches original/translated/AKA names; OMDb's own search is a strict subset of that). `metacriticRating` is dropped as a stored field (OMDb essentially never returns it for TV — 0/15 populated across the user's real tracked series, and TMDB has no equivalent). `alternateTitle` is dropped along with it: that field/UI existed specifically to capture "what the user searched vs. what OMDb/TMDB resolved to" ambiguity from the two-path search era; with a single TMDB-primary path, that ambiguity mostly disappears and what's left isn't worth a dedicated field.

This directly supersedes `series_spec_005_omdb_lookup.md`, `series_spec_011_omdb_search_candidates.md`, `series_spec_012_tmdb_lookup_fallback.md`, and `series_spec_013_alternate_title.md` — see each file's updated `Status` line. Those files are kept, unmodified apart from their status note, as historical implementation record; none of their acceptance criteria are renumbered or deleted per `ears_format.md`'s immutability rule.

**Design decisions**:
- **OMDb search is removed outright, not kept as a fallback.** Today's `frontend_spec_016`/`series_spec_012` already proved TMDB's search is a strict superset of OMDb's for this purpose (the "Spooks" catalogued as "MI-5" case) — there is no scenario where OMDb's search would succeed and TMDB's would not. Keeping a redundant, strictly-worse search path adds UI complexity (`frontend_spec_015`'s candidate picker duplicated by `frontend_spec_016`'s) for zero coverage benefit.
- **`resolveTmdbCandidate`'s existing endpoint (`GET /lookup/resolve-tmdb`) is reused rather than replaced**, keeping route churn minimal — only its *internal* data-source priority inverts (TMDB detail becomes the unconditional base; OMDb becomes optional enrichment merged on top), not its path or request shape.
- **A failed/absent OMDb enrichment call is never fatal to a resolve request**, including `ExternalServiceException` (a genuine upstream failure) — a deliberate posture change from `SERIES-012-AC-17`, where an `ExternalServiceException` from OMDb was allowed to propagate. That was correct when OMDb was a *required* fallback data source; it no longer is one now that TMDB supplies everything except two rating fields, so a flaky OMDb should degrade those two fields to `null`, not break adding a series at all.
- **`OmdbClient` is reduced to one method** (`ratingsForImdbId`) returning a small new `OmdbRatings(BigDecimal imdbRating, Integer rottenTomatoesRating)` record — `lookup(String title)`, the whole `t=`/`s=` query-param machinery, and `aggregateEpisodeCount` (TMDB's `/tv/{id}` already returns `number_of_seasons`/`number_of_episodes` directly, no per-season aggregation loop needed) are deleted as dead code rather than left unused.
- **Rotten Tomatoes stays a stored, user-overridable field**, sourced from this same narrowed OMDb call. Expect it to remain `null` for the overwhelming majority of TV series even after this change — confirmed via a live check of the user's actual tracked series (0/15 populated) and a long-standing, unresolved `omdbapi/OMDb-API` GitHub issue ("Rotten Tomatoes Data for TV Shows?"). This is expected upstream-data absence, not a regression to chase. No frontend change is needed for the override behavior itself — `rottenTomatoesRating` is already a plain editable input in both `AddSeriesForm`/`EditSeriesForm`, autofilled-but-overridable exactly like `imdbRating`.
- **Existing tracked series' data is wiped, not migrated**, per explicit user sign-off. A local dev database, no production data at stake.
- **Migration approach: squash the entire migration history into a single fresh baseline, not an incremental `V007` on top of `V001`–`V006`.** The user explicitly flagged that patching forward (`V001` creates `metacritic_rating`, `V005` creates `alternate_title`, a later migration drops both) is pure waste when nothing has shipped to production and the whole local database is being wiped anyway — every one of those columns' create-then-drop round-trips can simply never have happened. Concretely: `V001__create_series_table.sql` is rewritten to create the series table in its final shape directly (all fields from the original entity plus everything every subsequent implemented spec added — `posterUrl`/`imdbId`/`tags` — plus everything `series_spec_017`/`series_spec_018` add — `tmdbRating`/`tmdbVoteCount`/`lastRefreshedAt` — minus `metacriticRating`/`alternateTitle`, which never appear at all); `V002__add_poster_url_to_series.sql`, `V003__add_imdb_id_to_series.sql`, `V005__add_alternate_title_to_series.sql`, and `V006__add_tags_to_series.sql` are deleted outright (their effects are now part of the rewritten `V001`); `V004__create_ignored_series_table.sql` (unaffected content, just the ignore-list table) is renumbered to `V002`, since Flyway's applied-migration history table only exists in the local dev SQLite file that's being deleted anyway (`backend/data/series.db` — deleted as part of implementing this AC, so Flyway replays clean from the rewritten baseline with no checksum conflict). `idx_series_imdb_id` (originally added by old `V003`) is created directly in the new `V001`. `series_spec_018_series_refresh.md`'s `lastRefreshedAt` column is absorbed into this same rewritten `V001` rather than getting its own later migration (see that spec — nothing has shipped for it either, so there's no reason to spread one column across two migrations). Genuinely *new* schema — `series_spec_019_keyword_tracking.md`'s `keyword`/`series_keyword` tables — still gets its own fresh migration (`V003`) since nothing about those tables is being undone.
- **`tmdbRating`/`tmdbVoteCount` are new, separate fields from `imdbRating`/`rottenTomatoesRating`** — a tracked series now carries independent rating numbers from three sources (TMDB, IMDb, RT) plus the user's own `personalRating`, matching the naming/shape TMDB's own rating already has on `RecommendationDto` (`tmdbRating`/`voteCount`, `series_spec_016`) — named `tmdbRating`/`tmdbVoteCount` here (not bare `rating`/`voteCount`) to stay unambiguous alongside `imdbRating`/`rottenTomatoesRating` on the same entity.
- **Keeping `tmdbRating`/`tmdbVoteCount` fresh over time is out of scope for this spec** — that's `series_spec_018_series_refresh.md`'s job (single + bulk refresh). This spec only covers populating them at create time.

---

## Requirements

### Requirement 1: TMDB Becomes the Sole Search Path

**User story**: As a user, I want "Look Up" to always find my show on the first try, so I don't need to know in advance whether OMDb's search will miss it.

#### Acceptance Criteria

- **SERIES-017-AC-01** [AUTO]: `GET /api/v1/series/lookup/search-tmdb?title=` shall remain the only series-search endpoint (unchanged from `SERIES-012-AC-12`/`AC-13`); `GET /api/v1/series/lookup?title=` and `GET /api/v1/series/lookup/search?title=` (both OMDb-`s=`/`t=`-driven) shall no longer be mapped by `SeriesController` — a request to either returns `404`.
- **SERIES-017-AC-02** [AUTO]: `OmdbClient.search`, `OmdbClient.lookup(String title)`, `OmdbSearchCandidate`, `SeriesLookupCandidateDto`, and `SeriesLookupService.search(String)`/`lookup(String)` shall be deleted.
- **SERIES-017-AC-03** [AUTO]: An empty TMDB search result remains a normal `200` empty list, not an error (unchanged from `SERIES-012-AC-13`).

### Requirement 2: TMDB-Primary Resolve with Narrowed OMDb Enrichment

**User story**: As a user, I want the show I picked to autofill with accurate season/episode counts and a TMDB rating immediately, with IMDb/Rotten Tomatoes ratings filled in when available, so I get one consistent, complete result regardless of which service happens to have the richer record.

#### Acceptance Criteria

- **SERIES-017-AC-04** [AUTO]: `GET /api/v1/series/lookup/resolve-tmdb?tmdbId=` shall build its result exclusively from `TmdbClient.details(tmdbId)` — `title`, `year`, `genres` (via the existing `TmdbGenreTable` mapping), `posterUrl`, `totalSeasons`, `totalEpisodes`, `tmdbRating`, `tmdbVoteCount` — never attempting `OmdbClient` as a primary source (inverts `SERIES-012-AC-14`'s "try OMDb first" priority).
- **SERIES-017-AC-05** [AUTO]: `GET /api/v1/series/lookup?imdbId=` (OMDb-candidate resolve) shall no longer be mapped by `SeriesController` — a request returns `404`.
- **SERIES-017-AC-06** [AUTO]: After building the TMDB-sourced base, if `TmdbClient.externalIds(tmdbId)` resolves a non-blank `imdbId`, `SeriesLookupService` shall call the new `OmdbClient.ratingsForImdbId(imdbId)` and merge its `imdbRating`/`rottenTomatoesRating` onto the result.
- **SERIES-017-AC-07** [AUTO]: Any exception from `OmdbClient.ratingsForImdbId` — `EntityNotFoundException` (no OMDb record) or `ExternalServiceException` (upstream failure, unset API key) — shall be caught and logged, leaving `imdbRating`/`rottenTomatoesRating` `null` on the result; it shall never fail the overall resolve request (see Design Decisions — a deliberate posture change from `SERIES-012-AC-17`).
- **SERIES-017-AC-08** [AUTO]: When `externalIds` resolves no `imdbId` at all, `imdbRating`/`rottenTomatoesRating` on the result shall be `null` and no OMDb call attempted.
- **SERIES-017-AC-09** [AUTO]: `OmdbClient` shall be reduced to a single `ratingsForImdbId(String imdbId)` method returning a new `OmdbRatings(BigDecimal imdbRating, Integer rottenTomatoesRating)` record. `performLookup`, `aggregateEpisodeCount`, `OMDB_MAX_SEASONS_FOR_EPISODE_COUNT`, and all `Title`/`Year`/`Genre`/`Poster`/`totalSeasons` response parsing shall be deleted as dead code; `OmdbLookupResult` (the old 9-field record) shall be deleted and replaced by `OmdbRatings`.

### Requirement 3: TMDB Rating & Vote Count Persistence

**User story**: As a user, I want to see TMDB's own community rating and vote count alongside IMDb's, so I have a second, independently-sourced signal on a show's reception.

#### Acceptance Criteria

- **SERIES-017-AC-10** [AUTO]: `SeriesEntity`, `SeriesDto`, and `SeriesLookupDto` shall each gain `tmdbRating` (`BigDecimal`, `precision=3, scale=1`, bounds `0.0`–`10.0`, same style as `imdbRating`) and `tmdbVoteCount` (`Integer`, `>= 0`).
- **SERIES-017-AC-11** [AUTO]: `TmdbSeriesDetail` shall gain `voteAverage` (`BigDecimal`) and `voteCount` (`Integer`), parsed from `GET /tv/{id}`'s `vote_average`/`vote_count` fields via `TmdbClient`'s existing `toBigDecimal`/`toInteger` helpers (same field names/types `TmdbCandidate` already uses for the same TMDB concept elsewhere in this class).
- **SERIES-017-AC-12** [AUTO]: `SeriesService.create` shall persist `tmdbRating`/`tmdbVoteCount` from the incoming `SeriesDto` unchanged (same direct flow-through as every other lookup-sourced field at create time — no special-casing).
- **SERIES-017-AC-13** [AUTO]: `SeriesExportService`'s CSV headers and JSON export shall include `tmdbRating`/`tmdbVoteCount`.

### Requirement 4: Metacritic Removal

**User story**: As a user, I don't want to see a rating field that's never populated cluttering the add/edit forms and detail view.

#### Acceptance Criteria

- **SERIES-017-AC-14** [AUTO]: `metacriticRating` shall be removed from `SeriesEntity`, `SeriesDto`, `SeriesLookupDto`, and `SeriesExportService`'s CSV headers/JSON export.

### Requirement 5: Alternate Title Removal

**User story**: As a developer, I don't want a field whose entire reason for existing (disambiguating two divergent search paths) no longer applies, left behind as unused surface area.

#### Acceptance Criteria

- **SERIES-017-AC-15** [AUTO]: `alternateTitle` shall be removed from `SeriesEntity`, `SeriesDto`, and `SeriesExportService`'s CSV headers/JSON export; the alternate-title mismatch-capture logic (`SeriesLookupService`) shall be deleted.

### Requirement 6: Schema Migration

**User story**: As a developer, I want the `series` table's column set to exactly match the new model, with no orphaned columns or half-migrated data.

#### Acceptance Criteria

- **SERIES-017-AC-16** [AUTO]: The migration history shall be squashed into a single fresh baseline rather than appended to: `V001__create_series_table.sql` is rewritten to create the `series` table directly in its final shape (including `poster_url`, `imdb_id` + `idx_series_imdb_id`, `tags`, `tmdb_rating DECIMAL(3,1)`, `tmdb_vote_count INTEGER`, and `last_refreshed_at` per `series_spec_018_series_refresh.md` — never `metacritic_rating`/`alternate_title`); `V002__add_poster_url_to_series.sql`, `V003__add_imdb_id_to_series.sql`, `V005__add_alternate_title_to_series.sql`, and `V006__add_tags_to_series.sql` are deleted; `V004__create_ignored_series_table.sql` is renamed/renumbered to `V002__create_ignored_series_table.sql` with its content unchanged; `backend/data/series.db` is deleted so Flyway replays the new history from empty with no checksum conflict — see Design Decisions.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `TmdbClient.search`/`details`/`externalIds`, TMDB-fallback resolve logic being inverted into the primary path | `series_spec_012_tmdb_lookup_fallback.md` |
| OMDb search/candidate flow being removed | `series_spec_011_omdb_search_candidates.md` |
| Original OMDb lookup/`OmdbLookupResult`/episode-aggregation being narrowed | `series_spec_005_omdb_lookup.md` |
| `alternateTitle` field/capture logic being removed | `series_spec_013_alternate_title.md` |
| `RecommendationDto.tmdbRating`/`voteCount` naming precedent for the same TMDB concept | `series_spec_016_recommendation_vote_count.md` |
| `imdbId` indexed column (`idx_series_imdb_id`), carried into the rewritten `V001` baseline unchanged | `series_spec_001_entity.md` |
| Frontend consumer: consolidated `AddSeriesForm` "Look Up" flow, field/type removals | `frontend_spec_022_tmdb_primary_lookup.md` (companion spec) |
| Keeping `tmdbRating`/`tmdbVoteCount`/ratings fresh after initial add | `series_spec_018_series_refresh.md` (not yet written) |

---

## TDD Test Case Sketches

### `SeriesControllerSpec.groovy`

```groovy
def "SERIES-017-AC-01: removed OMDb search/lookup routes return 404"() {
    expect: "GET /lookup, /lookup/search, and /lookup?imdbId= are no longer mapped"
        client.get().uri("/api/v1/series/lookup?title=Ozark").exchange().expectStatus().isNotFound()
        client.get().uri("/api/v1/series/lookup/search?title=Ozark").exchange().expectStatus().isNotFound()
        client.get().uri("/api/v1/series/lookup?imdbId=tt5071412").exchange().expectStatus().isNotFound()
}
```

### `SeriesLookupServiceSpec.groovy`

```groovy
def "SERIES-017-AC-04/06: resolve builds from TMDB detail, merges OMDb ratings when available"() {
    given: "TMDB detail for tmdbId=4046 and a resolvable imdbId"
        tmdbClient.details(4046) >> new TmdbSeriesDetail("Spooks", 2002, [80], "/poster.jpg", 10, 81, 
            new BigDecimal("7.8"), 245)
        tmdbClient.externalIds(4046) >> Optional.of("tt0160904")
        omdbClient.ratingsForImdbId("tt0160904") >> new OmdbRatings(new BigDecimal("8.3"), null)

    when: "resolveTmdbCandidate(4046) is called"
        def result = lookupService.resolveTmdbCandidate(4046)

    then: "TMDB fields are the base, OMDb ratings are merged on top"
        result.title == "Spooks"
        result.tmdbRating == new BigDecimal("7.8")
        result.tmdbVoteCount == 245
        result.imdbRating == new BigDecimal("8.3")
        result.rottenTomatoesRating == null
}

def "SERIES-017-AC-07: OMDb enrichment failure never fails the resolve"() {
    given: "TMDB detail resolves fine, but OMDb throws ExternalServiceException"
        tmdbClient.details(4046) >> new TmdbSeriesDetail("Spooks", 2002, [80], "/poster.jpg", 10, 81,
            new BigDecimal("7.8"), 245)
        tmdbClient.externalIds(4046) >> Optional.of("tt0160904")
        omdbClient.ratingsForImdbId("tt0160904") >> { throw new ExternalServiceException("OMDb down") }

    when: "resolveTmdbCandidate(4046) is called"
        def result = lookupService.resolveTmdbCandidate(4046)

    then: "the call succeeds with null OMDb-sourced ratings, not an exception"
        result.title == "Spooks"
        result.imdbRating == null
        result.rottenTomatoesRating == null
}

def "SERIES-017-AC-08: no imdbId resolved means no OMDb call is attempted"() {
    given: "TMDB has no IMDb cross-reference for this title"
        tmdbClient.details(999) >> new TmdbSeriesDetail("Obscure Show", 2020, [], null, 1, 6,
            new BigDecimal("6.0"), 12)
        tmdbClient.externalIds(999) >> Optional.empty()

    when: "resolveTmdbCandidate(999) is called"
        def result = lookupService.resolveTmdbCandidate(999)

    then: "no OMDb call happens, and ratings are null"
        0 * omdbClient.ratingsForImdbId(_)
        result.imdbRating == null
}
```

### `OmdbClientSpec.groovy`

```groovy
def "SERIES-017-AC-09: ratingsForImdbId parses only imdbRating and rottenTomatoesRating"() {
    given: "OMDb returns a full response for tt0160904, including a Ratings array"
        mockServer.expect(requestTo(containsString("i=tt0160904")))
            .andRespond(withSuccess(OMDB_SPOOKS_JSON, MediaType.APPLICATION_JSON))

    when: "ratingsForImdbId(\"tt0160904\") is called"
        def result = omdbClient.ratingsForImdbId("tt0160904")

    then: "only the two rating fields are populated"
        result.imdbRating() == new BigDecimal("8.3")
        result.rottenTomatoesRating() == null
}
```

### `SeriesExportServiceSpec.groovy`

```groovy
def "SERIES-017-AC-13/14: CSV headers include tmdbRating/tmdbVoteCount, exclude metacriticRating"() {
    when: "a CSV export is generated"
        def csv = exportService.exportAsCsv([])

    then: "the header row reflects the new column set"
        def header = csv.readLines().first()
        header.contains("tmdbRating")
        header.contains("tmdbVoteCount")
        !header.contains("metacriticRating")
        !header.contains("alternateTitle")
}
```

### Squashed `V001__create_series_table.sql` (Flyway integration test)

```groovy
def "SERIES-017-AC-16: fresh migrate() produces the final series shape with no legacy columns"() {
    given: "an empty database (backend/data/series.db deleted)"
        // flyway.clean() / fresh file

    when: "flyway.migrate() runs the full (squashed) history"
        // flyway.migrate()

    then: "the series table has the final column set, no legacy columns, and is empty"
        jdbcTemplate.queryForObject("SELECT COUNT(*) FROM series", Integer) == 0
        // and: column introspection confirms tmdb_rating/tmdb_vote_count/last_refreshed_at/
        // poster_url/imdb_id/tags all exist, and alternate_title/metacritic_rating never did

    and: "idx_series_imdb_id and the ignored_series table (now V002) both exist"
        // index + table introspection
}
```

---

## Acceptance Criteria Summary

- [ ] SERIES-017-AC-01: OMDb search/lookup routes removed (`404`)
- [ ] SERIES-017-AC-02: `OmdbClient.search`/`lookup(String)`, `OmdbSearchCandidate`, `SeriesLookupCandidateDto`, `SeriesLookupService.search`/`lookup` deleted
- [ ] SERIES-017-AC-03: empty TMDB search result stays a normal empty `200`
- [ ] SERIES-017-AC-04: resolve builds exclusively from TMDB detail
- [ ] SERIES-017-AC-05: `GET /lookup?imdbId=` removed (`404`)
- [ ] SERIES-017-AC-06: OMDb ratings merged onto the TMDB-sourced result when `imdbId` resolves
- [ ] SERIES-017-AC-07: any OMDb enrichment failure is non-fatal, ratings left `null`
- [ ] SERIES-017-AC-08: no `imdbId` resolved → no OMDb call attempted
- [ ] SERIES-017-AC-09: `OmdbClient` reduced to `ratingsForImdbId`, dead code deleted
- [ ] SERIES-017-AC-10: `tmdbRating`/`tmdbVoteCount` on `SeriesEntity`/`SeriesDto`/`SeriesLookupDto`
- [ ] SERIES-017-AC-11: `TmdbSeriesDetail` gains `voteAverage`/`voteCount`
- [ ] SERIES-017-AC-12: `SeriesService.create` persists the two new fields
- [ ] SERIES-017-AC-13: export includes `tmdbRating`/`tmdbVoteCount`
- [ ] SERIES-017-AC-14: `metacriticRating` removed everywhere
- [ ] SERIES-017-AC-15: `alternateTitle` removed everywhere
- [ ] SERIES-017-AC-16: migration history squashed to a fresh `V001` baseline (final column set, no legacy columns, `V002` is `ignored_series`, local `series.db` deleted)
