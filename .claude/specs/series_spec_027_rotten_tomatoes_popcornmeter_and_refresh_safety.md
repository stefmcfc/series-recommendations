# Spec 027: Rotten Tomatoes Popcornmeter & Refresh Null-Safety

**Status**: Done. All 7 ACs implemented and covered by Spock specs (`gradlew.bat test` green). One judgment call: AC-02/03 didn't explicitly call out `SeriesService.entityToDto`, but `rottenTomatoesPopcornmeter` was added there too (mirroring every other field's read-path) -- without it, `GET`/create/update responses would never actually surface the value the DTO/entity otherwise support, which would silently fail the AC-03 round-trip in practice (e.g. `SeriesServiceSpec`'s "create sets rottenTomatoesPopcornmeter when provided" test reads it back via `entityToDto`).
**Priority**: P2 (Requirement 2 is a real data-loss bug — a manually-entered rating can be silently wiped by a routine refresh)
**Depends on**: Series Spec 005 (`series_spec_005_omdb_lookup.md`, `rottenTomatoesRating` field origin) ✅, Series Spec 018 (`series_spec_018_series_refresh.md`, `SeriesRefreshService.refreshFromTmdb`/`refreshFromOmdb`, both amended by Requirement 2 here) ✅, Series Spec 001 (`series_spec_001_entity.md`, `SeriesEntity`/migration conventions) ✅
**Backend Task**

## Overview

Live-review findings while checking Rotten Tomatoes data:

1. Rotten Tomatoes actually publishes two distinct scores — **Tomatometer** (critics' aggregate) and **Popcornmeter** (audience/viewer aggregate) — but this app's `rottenTomatoesRating` column only ever stores one. Investigation confirmed OMDb's `"Rotten Tomatoes"` rating source (the only one this app has ever consumed — see `OmdbRatings`' own doc comment) **is the Tomatometer**: a live refresh against "Breaking Bad" returned `96`, matching its known Tomatometer score. OMDb's API has no Popcornmeter field at all, so that score can only ever be manually entered by the user, and — critically — must never be touched by an automated refresh, since there's no data source to refresh it *from*.
2. **Bug**: `SeriesRefreshService.refreshFromOmdb` unconditionally calls `entity.setImdbRating(...)`/`entity.setRottenTomatoesRating(...)` with whatever OMDb returned, including `null`. OMDb's own `"Rotten Tomatoes"` rating is absent from the overwhelming majority of its TV records (already documented on `OmdbRatings`) — so refreshing a series with a manually-entered Rotten Tomatoes score, where OMDb doesn't report one, silently wipes it. The same unconditional-overwrite pattern exists in `refreshFromTmdb` for every TMDB-sourced field (`totalSeasons`/`totalEpisodes`/`tmdbRating`/`tmdbVoteCount`/`productionStatus`/`originCountry`/`overview`) — less likely to actually return `null` in practice (TMDB's detail response is usually complete), but the same class of bug, so this spec fixes both refresh paths identically rather than only the one that was actually observed failing.

**Existing field is not renamed.** `rottenTomatoesRating` keeps its current name/column/type (`Integer`, 0–100) and continues to mean the Tomatometer score, sourced from OMDb exactly as today — renaming it would touch a migration, every DTO/entity/export/frontend reference, and existing data, for a label-clarity problem the UI layer can solve on its own (Frontend Spec 037 relabels it "Rotten Tomatoes Rating (Tomatometer)"). A new, separate `rottenTomatoesPopcornmeter` column is added instead.

## Design Decisions

- **`rottenTomatoesPopcornmeter` is a plain user-owned field**, following the exact same create/update partial-update semantics `rottenTomatoesRating` already has (`SeriesService.create`: set if provided; `SeriesService.update`: set only if the DTO value is non-null) — see `series_spec_001_entity.md`'s conventions. It is **never read or written by `SeriesRefreshService`** — there's no requirement or AC anywhere in this spec that touches it from a refresh path, by design.
- **Same validation as `rottenTomatoesRating`**: `Integer`, `@Min(0)`/`@Max(100)`, nullable.
- **Refresh null-safety is a uniform rule applied to every field either refresh path sets**, not a special case for ratings: `entity.setX(fresh.x())` becomes `if (fresh.x() != null) entity.setX(fresh.x());` for `imdbRating`, `rottenTomatoesRating` (Requirement 2, `refreshFromOmdb`) and `totalSeasons`, `totalEpisodes`, `tmdbRating`, `tmdbVoteCount`, `productionStatus`, `originCountry`, `overview` (Requirement 2, `refreshFromTmdb`). An existing value is left exactly as it was when the fresh value is `null`; a fresh non-null value still overwrites (refresh remains "pull the latest data", just no longer "pull the latest data, or blank it out if today's answer happens to be empty").
- **This does not change `refreshFromTmdb`/`refreshFromOmdb`'s return value or `RefreshResult.omdbRefreshed`/`tmdbRefreshed` semantics** — those still mean "did the source respond successfully at all", not "did every individual field change". A refresh where OMDb responds with only an `imdbRating` and no `rottenTomatoesRating` is still `omdbRefreshed: true`.
- **Not exported/added to `SeriesExportService`'s field list in this spec's Requirement 1** — actually, it is: exports should stay a complete mirror of trackable data, so `rottenTomatoesPopcornmeter` is added to the CSV/JSON export field list alongside `rottenTomatoesRating`, matching how every other trackable field is already exported.

---

## Requirement 1: `rottenTomatoesPopcornmeter` Field

**User story**: As a user, I want to record Rotten Tomatoes' audience (Popcornmeter) score separately from its critics' (Tomatometer) score, so I'm not limited to only tracking one of the two.

### SERIES-027-AC-01 [AUTO]
**Statement**: `SeriesEntity` shall gain a nullable `rottenTomatoesPopcornmeter` column (`Integer`, `@Min(0)`/`@Max(100)`, same shape as `rottenTomatoesRating`), added via a new Flyway migration `V009__add_rotten_tomatoes_popcornmeter_to_series.sql`.

**References**: `SeriesEntity.java` (alongside `rottenTomatoesRating`), `db/migration/`.

**Test Case (Red)**:
```groovy
def "SERIES-027-AC-01: rottenTomatoesPopcornmeter defaults to null and accepts a valid value"() {
    given: "a new SeriesEntity"
        def entity = new SeriesEntity(title: "Some Show")

    expect: "it defaults to null"
        entity.rottenTomatoesPopcornmeter == null

    when: "a valid Popcornmeter value is set"
        entity.rottenTomatoesPopcornmeter = 88

    then: "it's retained"
        entity.rottenTomatoesPopcornmeter == 88
}
```

**Test Case (Green)**: add the column/field/getter/setter, migration.

---

### SERIES-027-AC-02 [AUTO]
**Statement**: `SeriesDto` shall gain a `rottenTomatoesPopcornmeter` field (`Integer`).

**References**: `SeriesDto.java`.

**Test Case (Green)**: add field + getter/setter, no red test needed beyond compilation — covered transitively by AC-03/04.

---

### SERIES-027-AC-03 [AUTO]
**Statement**: `SeriesService.create` shall set the entity's `rottenTomatoesPopcornmeter` from the DTO when provided (same as `rottenTomatoesRating`'s existing handling). `SeriesService.update` shall set it only when the DTO value is non-null, leaving the existing value unchanged otherwise.

**References**: `SeriesService.java` `create`/`update`, mirroring `rottenTomatoesRating`'s existing exact code shape.

**Test Case (Red)**:
```groovy
def "SERIES-027-AC-03: update only overwrites rottenTomatoesPopcornmeter when explicitly provided"() {
    given: "an existing series with rottenTomatoesPopcornmeter = 88"
        def existing = repository.save(new SeriesEntity(title: "Show", rottenTomatoesPopcornmeter: 88))

    when: "update is called with a DTO that omits rottenTomatoesPopcornmeter (null)"
        seriesService.update(existing.id, new SeriesDto(title: "Show (renamed)"))

    then: "the value is unchanged"
        repository.findById(existing.id).get().rottenTomatoesPopcornmeter == 88

    when: "update is called with rottenTomatoesPopcornmeter explicitly set to 92"
        seriesService.update(existing.id, new SeriesDto(rottenTomatoesPopcornmeter: 92))

    then: "the value is updated"
        repository.findById(existing.id).get().rottenTomatoesPopcornmeter == 92
}
```

**Test Case (Green)**: add the same `if (dto.getRottenTomatoesPopcornmeter() != null) { entity.setRottenTomatoesPopcornmeter(...); }` shape used for every other partial-update numeric field.

---

### SERIES-027-AC-04 [AUTO]
**Statement**: `SeriesRefreshService.refreshFromTmdb`/`refreshFromOmdb` shall never set `rottenTomatoesPopcornmeter` — it is absent from both methods entirely, since no external source populates it.

**References**: `SeriesRefreshService.java`.

**Test Case (Red)**:
```groovy
def "SERIES-027-AC-04: a refresh never touches rottenTomatoesPopcornmeter"() {
    given: "an existing series with a manually-entered Popcornmeter score"
        def existing = repository.save(new SeriesEntity(
            title: "Ozark", imdbId: "tt5071412", rottenTomatoesPopcornmeter: 91))
        tmdbClient.findTvIdByImdbId("tt5071412") >> Optional.of(69740)
        tmdbClient.details(69740) >> someFullDetail()
        omdbClient.ratingsForImdbId("tt5071412") >> new OmdbRatings(new BigDecimal("8.4"), 96)

    when: "the series is refreshed"
        refreshService.refresh(existing.id)

    then: "rottenTomatoesPopcornmeter is untouched"
        repository.findById(existing.id).get().rottenTomatoesPopcornmeter == 91
}
```

**Test Case (Green)**: confirmed by the absence of any `setRottenTomatoesPopcornmeter` call in either refresh method.

---

### SERIES-027-AC-05 [AUTO]
**Statement**: `SeriesExportService`'s CSV/JSON export field list shall include `rottenTomatoesPopcornmeter` alongside `rottenTomatoesRating`.

**References**: `SeriesExportService.java`.

**Test Case (Red)**:
```groovy
def "SERIES-027-AC-05: export includes rottenTomatoesPopcornmeter"() {
    given: "a series with a Popcornmeter score"
        def series = [new SeriesDto(title: "Show", rottenTomatoesPopcornmeter: 91)]

    expect: "the CSV header and JSON output both include it"
        exportService.exportAsCsv(series).readLines()[0].contains("rottenTomatoesPopcornmeter")
        exportService.exportAsJson(series, LocalDateTime.now()).contains('"rottenTomatoesPopcornmeter":91')
}
```

**Test Case (Green)**: add the field name to the export field-name array and its corresponding CSV row-building/JSON-serialization logic.

---

## Requirement 2: Refresh Shall Not Overwrite an Existing Value With `null`

**User story**: As a user, I don't want a routine refresh to silently erase a rating I entered manually just because today's external lookup happens not to report it.

### SERIES-027-AC-06 [AUTO]
**Statement**: `SeriesRefreshService.refreshFromOmdb` shall set `imdbRating`/`rottenTomatoesRating` only when the corresponding value from `OmdbRatings` is non-null. A `null` value from OMDb for either field shall leave the entity's existing value unchanged.

**References**: `SeriesRefreshService.refreshFromOmdb`.

**Test Case (Red)**:
```groovy
def "SERIES-027-AC-06: OMDb returning a null rottenTomatoesRating does not overwrite an existing value"() {
    given: "an existing series with a manually-entered Rotten Tomatoes rating"
        def existing = repository.save(new SeriesEntity(
            title: "Obscure Show", imdbId: "tt0000001", rottenTomatoesRating: 85))
        omdbClient.ratingsForImdbId("tt0000001") >> new OmdbRatings(new BigDecimal("7.2"), null)

    when: "the series is refreshed"
        def result = refreshService.refresh(existing.id)

    then: "imdbRating updates, but rottenTomatoesRating is untouched"
        def refreshed = repository.findById(existing.id).get()
        refreshed.imdbRating == new BigDecimal("7.2")
        refreshed.rottenTomatoesRating == 85

    and: "omdbRefreshed is still reported true -- OMDb did respond successfully"
        result.omdbRefreshed()
}
```

**Test Case (Green)**: wrap each of the two `entity.setX(...)` calls in `refreshFromOmdb` in a null check on the fresh value.

---

### SERIES-027-AC-07 [AUTO]
**Statement**: `SeriesRefreshService.refreshFromTmdb` shall apply the same rule to every field it sets (`totalSeasons`, `totalEpisodes`, `tmdbRating`, `tmdbVoteCount`, `productionStatus`, `originCountry`, `overview`) — each is set only when the fresh `TmdbSeriesDetail` value is non-null, otherwise the entity's existing value is left unchanged.

**References**: `SeriesRefreshService.refreshFromTmdb`.

**Test Case (Red)**:
```groovy
def "SERIES-027-AC-07: TMDB returning a null overview does not overwrite an existing value"() {
    given: "an existing series with a persisted overview"
        def existing = repository.save(new SeriesEntity(
            title: "Ozark", imdbId: "tt5071412", overview: "A drug-money-laundering saga."))
        tmdbClient.findTvIdByImdbId("tt5071412") >> Optional.of(69740)
        tmdbClient.details(69740) >> new TmdbSeriesDetail(
            "Ozark", 2017, [80], "/poster.jpg", 4, 44,
            new BigDecimal("8.4"), 1200, ProductionStatus.ENDED, "US", null) // overview: null

    when: "the series is refreshed"
        refreshService.refresh(existing.id)

    then: "overview is untouched, other fields still update"
        def refreshed = repository.findById(existing.id).get()
        refreshed.overview == "A drug-money-laundering saga."
        refreshed.totalSeasons == 4
}
```

**Test Case (Green)**: wrap each of the seven `entity.setX(...)` calls in `refreshFromTmdb` in a null check on the fresh value.

---

## Cross-References

| This spec | Source |
|---|---|
| `OmdbRatings`, its documented "Rotten Tomatoes absent from most OMDb TV records" precedent this spec's bug fix directly addresses | `series_spec_005_omdb_lookup.md` (superseded by `series_spec_017`), `client/OmdbRatings.java` |
| `SeriesRefreshService.refreshFromTmdb`/`refreshFromOmdb`, `RefreshResult.omdbRefreshed`/`tmdbRefreshed` semantics (unchanged by this spec) | `series_spec_018_series_refresh.md` |
| `SeriesEntity`/migration conventions, `rottenTomatoesRating`'s existing `@Min`/`@Max`/partial-update precedent this spec mirrors for the new field | `series_spec_001_entity.md` |
| Frontend consumer (new field's form/display, "%" formatting for both ratings) | `frontend_spec_037_rotten_tomatoes_popcornmeter.md` |

---

## Acceptance Criteria Summary

- [x] SERIES-027-AC-01: `rottenTomatoesPopcornmeter` column (`V009` migration)
- [x] SERIES-027-AC-02: `SeriesDto.rottenTomatoesPopcornmeter`
- [x] SERIES-027-AC-03: create/update partial-update semantics, mirroring `rottenTomatoesRating`
- [x] SERIES-027-AC-04: never touched by refresh (absent from both refresh methods)
- [x] SERIES-027-AC-05: included in CSV/JSON export
- [x] SERIES-027-AC-06: `refreshFromOmdb` — null OMDb values never overwrite an existing value
- [x] SERIES-027-AC-07: `refreshFromTmdb` — null TMDB detail values never overwrite an existing value
