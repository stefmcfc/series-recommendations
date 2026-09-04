# Spec 047: Keyword Stats — Filtering, Name Sort, Direction Toggle & Blended Rating

**Status**: Not started
**Priority**: P3 (analysis/quality-of-life enhancement to an existing feature, not core CRUD)
**Depends on**: Series Spec 019 (`series_spec_019_keyword_tracking.md` Requirement 4 — `GET /series/keywords`, `KeywordStatsService`, `KeywordStatDto`)
**Backend Task**

## Overview

This is unit 1 of 4 in the "Analysis/Trends" expansion (`.claude/ideas/future_ideas.md`, raised
2026-08-29): the existing Keyword stats feature becomes the pattern Genre stats
(`series_spec_048`) and Country-of-Origin stats (`series_spec_049`) will mirror. It adds
server-side minimum-value filtering (none exists today), an alphabetical `name` sort, an
`asc`/`desc` direction toggle (today's sort has a fixed direction per field with no toggle at
all), and a new blended-rating aggregate — `averageBlendedRating` — alongside the existing
`averagePersonalRating`.

**Design decisions**:
- **Blended rating combines `imdbRating` + `tmdbRating` only, as a simple unweighted average.**
  `SeriesEntity` also carries `rottenTomatoesRating`/`rottenTomatoesPopcornmeter` (0–100 scale,
  critics/audience respectively), but those are deliberately excluded here — including them would
  require normalizing a 0–100 scale against IMDb/TMDB's 0–10 scale, a materially larger decision
  than this pass is scoped for. `imdbRating` and `tmdbRating` are already the same 0–10 scale
  (`@DecimalMin/Max("0.0"/"10.0")`, `precision = 3, scale = 1`), so no normalization is needed —
  the average of whichever of the two are present, rounded `HALF_UP` to one decimal place, same
  as `KeywordStatsService.average`'s existing rounding for `averagePersonalRating`.
- **Computed on-the-fly, not persisted.** A per-series blended rating is fully derivable from two
  already-stored columns; persisting it on `SeriesEntity` would mean keeping it in sync on every
  rating edit for no benefit. It's computed the same way every time it's needed, mirroring how
  `averagePersonalRating` itself has never been a stored column.
- **A shared `RatingBlendUtil.blendedRating(SeriesEntity)` helper**, introduced here and reused
  unchanged by `series_spec_048`/`series_spec_049`, so the one-line average isn't re-derived three
  times across three stats services.
- **Null handling mirrors the existing `averagePersonalRating` convention exactly**: a series
  with neither `imdbRating` nor `tmdbRating` set contributes no blended rating (excluded from the
  average, not counted as `0`); a keyword with no series contributing a blended rating has
  `averageBlendedRating: null`, never `0`.
- **Filters are AND-combined, applied post-aggregation, in-memory** — consistent with
  `KeywordStatsService`'s own established "fine at this app's scale" precedent
  (`series_spec_019` SERIES-019-AC-14, itself following `SeriesSearchService`, `series_spec_003`
  Service Layer). A stat whose relevant field is `null` never satisfies a `minAverage*` filter
  (there's nothing to compare), so it's excluded whenever that filter is provided — this needs to
  be explicit, since "null fails every minimum" is not the same behavior as nulls-last *sorting*,
  which this spec keeps unchanged.
- **`sortDirection` is new and applies to every `sortBy` value, including the two that exist
  today.** When omitted, each field keeps its own established default direction (no behavior
  change for existing callers that never pass it): `seriesCount` → desc, `averagePersonalRating`
  → desc, `averageBlendedRating` → desc (new field, matches its sibling average), `name` → asc
  (new field; alphabetical ascending is the natural default). Nulls continue to sort last
  regardless of direction — `sortDirection=asc` on `averagePersonalRating` does not move
  null-average keywords to the front; this preserves `series_spec_019` SERIES-019-AC-16's existing
  guarantee rather than silently changing it once direction becomes user-controlled.
- **Unrecognized `sortBy`/`sortDirection` values soft-fall-back to defaults**, not a `400`,
  matching `series_spec_015` SERIES-015-AC-18/20's established convention and this endpoint's own
  existing `sortBy` posture (SERIES-019-AC-16).

---

## Requirements

### Requirement 1: Blended Rating

**User story**: As a user, I want to see a combined IMDb/TMDB rating alongside my personal
rating in the keyword stats, so I can spot keywords that track with widely-liked shows versus
ones that are more of a personal taste.

#### Acceptance Criteria

- **SERIES-047-AC-01** [AUTO]: A new `RatingBlendUtil` (`service` package, non-instantiable
  utility) shall expose `static BigDecimal blendedRating(SeriesEntity entity)`: the average of
  whichever of `entity.getImdbRating()`/`entity.getTmdbRating()` are non-null, rounded `HALF_UP`
  to 1 decimal place; `null` when both are `null`.
- **SERIES-047-AC-02** [AUTO]: `KeywordStatDto` shall gain a fourth field, `averageBlendedRating:
  BigDecimal` (nullable).
- **SERIES-047-AC-03** [AUTO]: `KeywordStatsService.toStat` shall compute `averageBlendedRating`
  as the mean of `RatingBlendUtil.blendedRating(series)` across the keyword's carrying series,
  excluding any series where that value is `null` — mirroring `averagePersonalRating`'s existing
  "unrated ≠ zero" exclusion (`series_spec_019` SERIES-019-AC-15). `null` when no carrying series
  has a blended rating.

---

### Requirement 2: Name Sort & Direction Toggle

**User story**: As a user, I want to sort the keyword table alphabetically and reverse any sort's
direction, so I can browse it either way instead of only ever seeing one fixed order per field.

#### Acceptance Criteria

- **SERIES-047-AC-04** [AUTO]: `sortBy` shall accept a new value, `name`: case-insensitive
  alphabetical comparison on `KeywordStatDto.name`.
- **SERIES-047-AC-05** [AUTO]: `sortBy` shall accept a new value, `averageBlendedRating`, using
  the same nulls-last comparator shape as `averagePersonalRating`.
- **SERIES-047-AC-06** [AUTO]: The endpoint shall accept a new optional `sortDirection` param
  (`asc` | `desc`). When present and valid, it reverses the base ordering of whichever `sortBy`
  field is active — including `seriesCount` and `averagePersonalRating`, which had no direction
  control before this spec. Null-average entries (`averagePersonalRating`,
  `averageBlendedRating`) remain sorted last under both `asc` and `desc`.
- **SERIES-047-AC-07** [AUTO]: When `sortDirection` is omitted, each field's existing/established
  default direction applies unchanged: `seriesCount` desc, `averagePersonalRating` desc,
  `averageBlendedRating` desc, `name` asc. This is a no-op for any existing caller that never
  passed `sortDirection`.
- **SERIES-047-AC-08** [AUTO]: An unrecognized `sortBy` value soft-falls-back to `seriesCount`; an
  unrecognized `sortDirection` value soft-falls-back to the active field's default direction —
  neither yields a `400`, matching SERIES-019-AC-16's existing posture.

---

### Requirement 3: Minimum-Value Filtering

**User story**: As a user with a large tracked collection, I want to filter the keyword table down
to keywords that clear a minimum series count or rating, so I can focus on patterns backed by
enough data to be meaningful.

#### Acceptance Criteria

- **SERIES-047-AC-09** [AUTO]: `GET /api/v1/series/keywords` shall accept three new optional query
  params: `minSeriesCount` (Integer), `minAveragePersonalRating` (BigDecimal),
  `minAverageBlendedRating` (BigDecimal).
- **SERIES-047-AC-10** [AUTO]: When provided, each filter excludes any `KeywordStatDto` whose
  corresponding field is `null` or strictly less than the threshold (`>=` passes). Multiple
  provided filters are AND-combined — a stat must satisfy all of them to be included.
- **SERIES-047-AC-11** [AUTO]: A `KeywordStatDto` with a `null` `averagePersonalRating` or
  `averageBlendedRating` never satisfies a provided `minAveragePersonalRating`/
  `minAverageBlendedRating` filter respectively (there is no value to compare), regardless of how
  low the threshold is — e.g. `minAveragePersonalRating=0` still excludes a keyword with no rated
  carrying series.
- **SERIES-047-AC-12** [AUTO]: When all three filter params are omitted, the response is identical
  to today's unfiltered behavior — fully backward-compatible for existing callers.
- **SERIES-047-AC-13** [AUTO]: The response envelope shape is unchanged (`ApiResponse<List
  <KeywordStatDto>>`, `{ data, count }`); `count` reflects the length of the list after filtering.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `GET /series/keywords`, `KeywordStatsService`, `KeywordStatDto`, existing `sortBy`/nulls-last/soft-fallback conventions this spec extends | `series_spec_019_keyword_tracking.md` Requirement 4 |
| In-memory aggregation "fine at this app's scale" precedent | `series_spec_003_search.md` Service Layer |
| Unrecognized-param soft-fallback convention | `series_spec_015_multi_source_recommendations.md` |
| `imdbRating`/`tmdbRating` scale (`0.0`–`10.0`, `precision 3, scale 1`) `RatingBlendUtil` averages | `SeriesEntity` (`model` package) |
| Reused unchanged by | `series_spec_048_genre_stats.md`, `series_spec_049_country_of_origin_stats.md` |
| Frontend consumer (filter UI, new columns, direction-toggle UI) | `frontend_spec_086_keyword_stats_filtering_sort_and_blended_rating.md` |

---

## TDD Test Case Sketches

### `RatingBlendUtilSpec.groovy` (Requirement 1)

```groovy
def "SERIES-047-AC-01: averages imdbRating and tmdbRating when both present"() {
    given: "a series with both ratings set"
        def series = new SeriesEntity(imdbRating: 8.0G, tmdbRating: 7.0G)

    expect: "the blended rating is their average"
        RatingBlendUtil.blendedRating(series) == 7.5G
}

def "SERIES-047-AC-01: falls back to whichever single rating is present"() {
    expect:
        RatingBlendUtil.blendedRating(new SeriesEntity(imdbRating: 8.0G)) == 8.0G
        RatingBlendUtil.blendedRating(new SeriesEntity(tmdbRating: 6.5G)) == 6.5G
}

def "SERIES-047-AC-01: null when neither rating is present"() {
    expect:
        RatingBlendUtil.blendedRating(new SeriesEntity()) == null
}
```

### `KeywordStatsServiceSpec.groovy` (Requirements 1–3)

```groovy
def "SERIES-047-AC-03: averageBlendedRating excludes series with no blended rating"() {
    given: "'spy' carried by a rated series and an unrated one"
        def spy = keywordRepository.save(new KeywordEntity(tmdbKeywordId: 470, name: "spy"))
        seriesRepository.save(new SeriesEntity(title: "A", imdbRating: 8.0G, tmdbRating: 6.0G, keywords: [spy] as Set))
        seriesRepository.save(new SeriesEntity(title: "B", keywords: [spy] as Set))

    when: "getStats is called"
        def spyStat = keywordStatsService.getStats(null, null, null, null, null).find { it.name() == "spy" }

    then: "the average reflects only the rated series"
        spyStat.averageBlendedRating() == 7.0G
}

def "SERIES-047-AC-04: sortBy=name sorts alphabetically, case-insensitively"() {
    given: "keywords 'spy' and 'Drama'"
        // ... two series each carrying one of these keywords

    when: "getStats('name', 'asc', null, null, null) is called"
        def stats = keywordStatsService.getStats('name', 'asc', null, null, null)

    then: "'Drama' sorts before 'spy'"
        stats*.name() == ['Drama', 'spy']
}

def "SERIES-047-AC-06/07: sortDirection reverses seriesCount, defaults to desc when omitted"() {
    given: "'spy' on 3 series, 'drama' on 1"
        // ...

    expect: "default (no sortDirection) is descending"
        keywordStatsService.getStats('seriesCount', null, null, null, null)*.name() == ['spy', 'drama']

    and: "sortDirection=asc reverses it"
        keywordStatsService.getStats('seriesCount', 'asc', null, null, null)*.name() == ['drama', 'spy']
}

def "SERIES-047-AC-10/11: minAveragePersonalRating excludes null averages even at threshold 0"() {
    given: "'spy' unrated, 'drama' rated 4.0"
        // ...

    when: "getStats(null, null, null, 0, null) is called"
        def stats = keywordStatsService.getStats(null, null, null, 0 as BigDecimal, null)

    then: "only 'drama' passes"
        stats*.name() == ['drama']
}

def "SERIES-047-AC-12: omitting all filters is unchanged from today's behavior"() {
    expect:
        keywordStatsService.getStats(null, null, null, null, null).size() == keywordStatsService.getStats(null).size()
}
```

### `SeriesKeywordControllerSpec.groovy` (Requirement 3 — endpoint)

```groovy
def "SERIES-047-AC-13: filtered response keeps the { data, count } envelope shape"() {
    when: "GET /api/v1/series/keywords?minSeriesCount=5 is requested with nothing meeting it"
        def response = mockMvc.perform(get("/api/v1/series/keywords").param("minSeriesCount", "5"))

    then: "200 with an empty list, count 0 -- not an error"
        response.andExpect(status().isOk())
        response.andExpect(jsonPath('$.data').isArray())
        response.andExpect(jsonPath('$.count').value(0))
}
```

---

## Acceptance Criteria Summary

- [ ] SERIES-047-AC-01: `RatingBlendUtil.blendedRating(SeriesEntity)`
- [ ] SERIES-047-AC-02: `KeywordStatDto.averageBlendedRating`
- [ ] SERIES-047-AC-03: computed correctly, nulls excluded from the average
- [ ] SERIES-047-AC-04: `sortBy=name`, case-insensitive alphabetical
- [ ] SERIES-047-AC-05: `sortBy=averageBlendedRating`, nulls-last
- [ ] SERIES-047-AC-06: `sortDirection` reverses ordering, nulls still sort last
- [ ] SERIES-047-AC-07: omitted `sortDirection` preserves each field's existing default
- [ ] SERIES-047-AC-08: unrecognized values soft-fall-back, not `400`
- [ ] SERIES-047-AC-09: `minSeriesCount`/`minAveragePersonalRating`/`minAverageBlendedRating` params
- [ ] SERIES-047-AC-10: `>=` threshold, AND-combined across provided filters
- [ ] SERIES-047-AC-11: `null` average never satisfies a `minAverage*` filter
- [ ] SERIES-047-AC-12: omitting all filters is fully backward-compatible
- [ ] SERIES-047-AC-13: `{ data, count }` envelope unchanged; `count` reflects post-filter length
