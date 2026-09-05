# Spec 051: Stats Status Scope Filter (Completed Only / All Series)

**Status**: Done
**Priority**: P3 (analysis/quality-of-life enhancement to an existing feature, not core CRUD)
**Depends on**: Series Spec 047 (`series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md`, the already-shipped `GET /series/keywords` contract this retrofits), Series Spec 048 (`series_spec_048_genre_stats.md`, `GET /series/genres/stats`), this session's `NameStatAggregator`/`NameStatsTable` extraction (a no-behavior-change refactor with no spec number of its own — see `backend/src/main/java/uk/co/stefirby/seriestracker/service/stats/NameStatAggregator.java`)
**Backend Task**

## Overview

Adds a status-scope filter — restrict aggregation to `SeriesStatus.COMPLETED` series only, or apply
no restriction at all (today's behavior, and the default) — to the shared `NameStatAggregator` that
backs both the Keyword (`series_spec_047`) and Genre (`series_spec_048`) stats endpoints. Because
both existing endpoints, and the not-yet-built Country-of-Origin endpoint (`series_spec_049`), all
funnel through this one shared aggregator, adding the filter there once means every stats endpoint
gets it — including `series_spec_049`'s `CountryStatsService`, which should be built directly
against this already-augmented aggregator rather than needing its own retrofit later.

**Design decisions**:
- **A simple binary toggle, not a full multi-status picker.** `SeriesStatus` has four values
  (`WATCHING`, `COMPLETED`, `DROPPED`, `BACKLOG`), but the only distinction that matters for this
  filter is "finished watching" vs. "everything" — confirmed with the user rather than assumed.
  `SeriesEntity.getStatus()` is never `null` (defaults to `BACKLOG`), so no null-handling edge case
  exists the way it does for `personalRating`/`imdbRating`/`tmdbRating`.
- **The filter is applied inside `NameStatAggregator.aggregate` itself, not at each service's call
  site.** The alternative — each of `KeywordStatsService`/`GenreStatsService`/the future
  `CountryStatsService` filtering `seriesRepository.findAll()` before calling `aggregate(...)` —
  would re-duplicate a filter across three call sites, which is exactly the kind of duplication
  `NameStatAggregator` itself exists to avoid (see its own class Javadoc). Filtering once, inside
  the aggregator, before the per-series grouping loop, keeps "every stat cross-cutting concern
  lives in one shared place" intact and means `series_spec_049` inherits this for free.
- **New parameter is appended last** (`Boolean onlyCompleted`, after `minAverageBlendedRating`) on
  both `NameStatAggregator.aggregate` and both services' `getStats` — minimizes signature churn
  against the existing TDD test call shapes (`getStats(null, null, null, null, null)` becomes
  `getStats(null, null, null, null, null, null)`), consistent with how `series_spec_047` itself
  appended new params rather than reordering existing ones.
- **`onlyCompleted` is a `Boolean` (nullable), not a primitive `boolean`.** Mirrors
  `minSeriesCount`/`minAveragePersonalRating`/`minAverageBlendedRating`'s existing "absent means no
  filter" posture — `null` and `false` are both treated as "no restriction," so omitting the query
  param is indistinguishable from explicitly passing `onlyCompleted=false`.
- **Backward compatibility is non-negotiable for `GET /series/keywords`, not just a nice-to-have** —
  that endpoint already shipped and is in production use (`series_spec_047`, merged). Omitting the
  new param must produce byte-identical responses to today.

---

## Requirements

### Requirement 1: `NameStatAggregator` Status Filtering

**User story**: As a developer, I want the status-scope filter implemented once in the shared
aggregator, so every current and future stats endpoint (Keywords, Genres, Country-of-Origin) gets
it automatically instead of needing its own copy.

#### Acceptance Criteria

- **SERIES-051-AC-01** [AUTO]: `NameStatAggregator.aggregate` shall accept a new parameter,
  `Boolean onlyCompleted`, appended after the existing `minAverageBlendedRating` parameter.
- **SERIES-051-AC-02** [AUTO]: When `onlyCompleted` is `Boolean.TRUE`, `aggregate` shall restrict
  the `allSeries` used for grouping/aggregation to only those series whose `getStatus() ==
  SeriesStatus.COMPLETED`, applied before the per-series name-extraction/grouping loop — series
  excluded this way contribute to no name's `seriesCount` or averages at all, the same as if they
  didn't exist in `allSeries` to begin with.
- **SERIES-051-AC-03** [AUTO]: When `onlyCompleted` is `null` or `Boolean.FALSE`, `aggregate` shall
  apply no status restriction — identical output to omitting the parameter today. This is the
  default and must not change any existing caller's behavior.

---

### Requirement 2: Service-Layer Pass-Through

**User story**: As a developer, I want `KeywordStatsService`/`GenreStatsService` to expose this
filter identically, so the two existing endpoints gain it with a mechanical, symmetric change.

#### Acceptance Criteria

- **SERIES-051-AC-04** [AUTO]: `KeywordStatsService.getStats` shall gain a sixth parameter,
  `Boolean onlyCompleted`, passed through unchanged as `NameStatAggregator.aggregate`'s final
  argument. The existing single-argument `getStats(String sortBy)` overload (kept for
  `series_spec_047` SERIES-047-AC-12's backward-compatibility test) continues delegating to the
  full-arity method, now passing `onlyCompleted=null`.
- **SERIES-051-AC-05** [AUTO]: `GenreStatsService.getStats` shall gain the identical sixth
  parameter with the identical pass-through behavior.

---

### Requirement 3: Endpoint Query Parameter

**User story**: As a user with a large tracked collection, I want to restrict Keyword/Genre stats
to shows I've actually finished, so in-progress or dropped series (which may carry an incomplete or
provisional rating) don't skew the patterns I'm looking for.

#### Acceptance Criteria

- **SERIES-051-AC-06** [AUTO]: `GET /api/v1/series/keywords` shall accept a new optional
  `onlyCompleted` (`Boolean`) query parameter, passed through unchanged to
  `KeywordStatsService.getStats`.
- **SERIES-051-AC-07** [AUTO]: `GET /api/v1/series/genres/stats` shall accept the identical new
  optional `onlyCompleted` query parameter, passed through unchanged to
  `GenreStatsService.getStats`.
- **SERIES-051-AC-08** [AUTO]: Omitting `onlyCompleted` from either endpoint shall produce a
  response byte-identical to today's — this is a hard backward-compatibility requirement for `GET
  /series/keywords`, which is already shipped and in use, not merely a preference.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `NameStatAggregator.aggregate`, `NameStat` shape this spec extends | `backend/src/main/java/uk/co/stefirby/seriestracker/service/stats/NameStatAggregator.java` (this session's extraction, no spec number) |
| `GET /series/keywords`, `KeywordStatsService`, existing `sortBy`/`sortDirection`/min-filter contract this spec adds alongside | `series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md` |
| `GET /series/genres/stats`, `GenreStatsService` | `series_spec_048_genre_stats.md` |
| `SeriesStatus` enum (`WATCHING`/`COMPLETED`/`DROPPED`/`BACKLOG`), `SeriesEntity.getStatus()` (never null, defaults `BACKLOG`) | `backend/src/main/java/uk/co/stefirby/seriestracker/model/SeriesStatus.java`, `SeriesEntity.java` |
| Frontend consumer (status filter control) | `frontend_spec_095_stats_status_scope_filter_toggle.md` |
| Not yet implemented — should build `CountryStatsService` directly against this already-augmented `NameStatAggregator`, inheriting `onlyCompleted` with no further work | `series_spec_049_country_of_origin_stats.md` |

---

## TDD Test Case Sketches

### `NameStatAggregatorSpec.groovy` (additions — Requirement 1)

```groovy
def "SERIES-051-AC-02: onlyCompleted=true restricts aggregation to COMPLETED series"() {
    given: "one COMPLETED series and one WATCHING series, both carrying the same name"
        def completed = new SeriesEntity(title: "A", status: SeriesStatus.COMPLETED, personalRating: 5)
        def watching = new SeriesEntity(title: "B", status: SeriesStatus.WATCHING, personalRating: 1)

    when: "aggregate is called with onlyCompleted=true"
        def stats = NameStatAggregator.aggregate(
            [completed, watching], { s -> ["drama"] }, null, null, null, null, null, true)

    then: "only the COMPLETED series is counted"
        stats[0].seriesCount() == 1
        stats[0].averagePersonalRating() == 5.0G
}

def "SERIES-051-AC-03: onlyCompleted null/false applies no restriction (unchanged default)"() {
    given: "one COMPLETED series and one WATCHING series"
        def completed = new SeriesEntity(title: "A", status: SeriesStatus.COMPLETED)
        def watching = new SeriesEntity(title: "B", status: SeriesStatus.WATCHING)

    expect: "both are counted whether onlyCompleted is omitted (null) or explicitly false"
        NameStatAggregator.aggregate([completed, watching], { s -> ["drama"] }, null, null, null, null, null, null)[0].seriesCount() == 2
        NameStatAggregator.aggregate([completed, watching], { s -> ["drama"] }, null, null, null, null, null, false)[0].seriesCount() == 2
}
```

### `KeywordStatsServiceSpec.groovy` / `GenreStatsServiceSpec.groovy` (additions — Requirement 2)

```groovy
def "SERIES-051-AC-04: onlyCompleted is passed through to the aggregator"() {
    given: "a COMPLETED and a BACKLOG series both carrying keyword 'spy'"
        def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
        seriesRepository.save(new SeriesEntity(title: "A", status: SeriesStatus.COMPLETED, keywords: [spy] as Set))
        seriesRepository.save(new SeriesEntity(title: "B", status: SeriesStatus.BACKLOG, keywords: [spy] as Set))

    when: "getStats is called with onlyCompleted=true"
        def spyStat = keywordStatsService.getStats(null, null, null, null, null, true).find { it.name() == "spy" }

    then: "only the completed series is counted"
        spyStat.seriesCount() == 1
}
```

### `SeriesControllerKeywordsSpec.groovy` / `SeriesGenreControllerSpec.groovy` (additions — Requirement 3)

```groovy
def "SERIES-051-AC-08: omitting onlyCompleted is unchanged from today's response"() {
    expect: "identical response with and without the new param explicitly false"
        def withoutParam = mockMvc.perform(get("/api/v1/series/keywords"))
        def explicitFalse = mockMvc.perform(get("/api/v1/series/keywords").param("onlyCompleted", "false"))
        withoutParam.andReturn().response.contentAsString == explicitFalse.andReturn().response.contentAsString
}

def "SERIES-051-AC-06/07: onlyCompleted=true is accepted and narrows results"() {
    when: "requested with onlyCompleted=true and nothing tracked is COMPLETED"
        def response = mockMvc.perform(get("/api/v1/series/genres/stats").param("onlyCompleted", "true"))

    then: "200 with an empty list -- not an error"
        response.andExpect(status().isOk())
        response.andExpect(jsonPath('$.data').isArray())
}
```

---

## Acceptance Criteria Summary

- [x] SERIES-051-AC-01: `NameStatAggregator.aggregate` gains `Boolean onlyCompleted` (last param)
- [x] SERIES-051-AC-02: `onlyCompleted=true` restricts aggregation to `SeriesStatus.COMPLETED`
- [x] SERIES-051-AC-03: `null`/`false` applies no restriction (unchanged default)
- [x] SERIES-051-AC-04: `KeywordStatsService.getStats` pass-through; single-arg overload unaffected
- [x] SERIES-051-AC-05: `GenreStatsService.getStats` pass-through
- [x] SERIES-051-AC-06: `GET /series/keywords` accepts `onlyCompleted`
- [x] SERIES-051-AC-07: `GET /series/genres/stats` accepts `onlyCompleted`
- [x] SERIES-051-AC-08: omitting the param is byte-identical to today (hard backward-compat)
