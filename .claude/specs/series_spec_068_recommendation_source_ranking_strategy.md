# Series Spec 068: Recommendation Source-Series Ranking Strategy

**Status**: Not started
**Priority**: P3
**Depends on**: none directly, but extends behavior established by `series_spec_006_recommendations.md`
(introduced pool-based sourcing), `series_spec_015_multi_source_recommendations.md` (introduced
`SourceOrderComparator` itself, SERIES-015-AC-05/06), and `TOOLING-003` (extracted the current
sourcing/dedup services from a monolithic `RecommendationService`). Related but not blocking:
`series_spec_047_keyword_genre_country_stats.md` (introduced the unrelated, fixed `RatingBlendUtil`
this spec's new blend is deliberately distinct from — see Design Decisions).
**Area**: Backend (`service/recommendation/SourceOrderComparator.java`,
`service/recommendation/RecommendationSourcingService.java`,
`service/recommendation/RecommendationDeduplicationService.java`, `dto/RecommendationCriteria.java`,
new `service/recommendation/SourceRatingBlend.java`) — paired with
`frontend_spec_132_source_ranking_strategy_and_custom_blend.md` for the UI.

## Overview

Today, whenever "Use My Series" mode ranks or caps a user's own tracked series to drive TMDB-based
recommendations, it always applies one fixed rule: `SourceOrderComparator.INSTANCE` sorts by
`personalRating` descending, then `dateCompleted` descending, with no way to choose anything else.
This spec makes that ranking a per-request choice between 3 strategies, two of which are powered by a
new, user-configurable "Custom Rating Blend" — an average of whichever rating sources
(IMDb/TMDB/Tomatometer/Popcornmeter) the user selects, distinct from the existing, unrelated, fixed
`RatingBlendUtil` blend that powers the Analysis page's "Blended Rating" column.

## Design Decisions

- **Only affects `sourceMode == "useMySeries"` in practice.** `SourceOrderComparator.INSTANCE` has 3
  call sites today: `RecommendationSourcingService.resolveSourcePool` (sorts+caps the source pool to
  `maxSourceSeries`), `RecommendationDeduplicationService.orderSources` (per-candidate contributing-
  source order, feeding scoring/`best-source` diversity-cap/`sourceTitles`), and
  `RecommendationSourcingService.mergeDedupedCandidates` (re-sorts after a cross-page merge). The
  latter two are no-ops for `sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword` — confirmed by
  reading `mergePage`, every one of those 3 modes' raw candidates is built as
  `new RawCandidate(candidate, null)`, so there is never a non-empty `sourceSeries` list for this
  strategy to reorder. This spec's new strategy field is therefore read only where it can matter —
  `resolveSourcePool` and `orderSources` — and is a harmless no-op elsewhere; call sites in the other 3
  modes keep using the unparameterized default so their behavior is byte-identical to today.
- **The new blend is a separate, new concept from `RatingBlendUtil.blendedRating`, not a reuse of it.**
  `RatingBlendUtil` (introduced by `series_spec_047`) is fixed — an unweighted mean of whichever of
  `imdbRating`/`tmdbRating` are non-null, deliberately excluding both Rotten Tomatoes fields (0-100
  scale vs the 0-10 scale `imdbRating`/`tmdbRating` share) — and feeds only `NameStatDto
  .averageBlendedRating` on the Analysis page. This spec's new blend is user-configurable (any subset
  of 4 sources, including the two RT fields) and serves a different job (ranking the user's own source
  series, not aggregating Analysis-page stats). To avoid the two colliding in the user's head, this
  spec's blend is named **"Custom Rating Blend"** everywhere it's surfaced (API field names, UI copy)
  — confirmed with the user directly, specifically because "Blended Rating" was already taken.
- **Normalize before averaging.** `rottenTomatoesRating`/`rottenTomatoesPopcornmeter` are both 0-100;
  `imdbRating`/`tmdbRating` are both 0-10. Any selected RT source is divided by 10 before being
  averaged with the others — the same normalize-before-blend principle
  `RecommendationRankingService.score()` already applies to `personalRating` (×2, scaling 1-5 up to a
  comparable 0-10 range) when blending it with a candidate's TMDB vote average.
- **Null handling mirrors `SourceOrderComparator`'s existing convention.** If none of the series'
  selected sources have a value, its Custom Rating Blend is `null` and sorts last (nulls-last,
  descending) — consistent with how `personalRating`/`dateCompleted` already sort today.
- **`SourceOrderComparator` becomes a small static factory, not one fixed `Comparator`.** Its current
  shape (package-private `final class`, single `static final Comparator<SeriesEntity> INSTANCE`) is
  replaced by a static factory method resolving the right `Comparator<SeriesEntity>` from
  `RecommendationCriteria`'s two new fields (below) — `resolveSourcePool` already receives `criteria`,
  so no new parameter is needed there; `RecommendationDeduplicationService.dedupeAndExclude`/
  `orderSources` do not currently receive `criteria` at all, so this spec adds a `Comparator
  <SeriesEntity>` parameter to `dedupeAndExclude`'s existing two-overload shape, resolved once by
  whichever caller has criteria in scope. The 3 discover-backfill call sites keep passing the
  unparameterized default explicitly (harmless, per the first Design Decision above) rather than
  threading `criteria` through code paths that can never use it.
- **New fields ride on `RecommendationCriteria` like every other per-request option** (`sortBy`,
  `discoverSortBy`, etc. are the existing precedent) — no new persistence entity. Saving a chosen
  strategy/blend-source combination for later reuse already works for free via the existing
  `FilterProfileEntity.criteria` opaque `JsonNode` blob (confirmed: keyed only by `(area, name)`, never
  interpreted backend-side) once the frontend includes the two new fields in what it saves under the
  `USE_MY_SERIES` area — no backend schema change needed for that either.

---

## Requirement 1: a per-request source-ranking strategy choice

**User story**: As a user relying on "Use My Series" mode, I want to choose how my own tracked series
are ranked/prioritized for sourcing, instead of always using personal-rating-then-date, so the
recommendations pipeline reflects the signal I actually care about.

### SERIES-068-AC-01 [AUTO]
**Statement**: The `RecommendationCriteria` DTO shall accept a new, optional `sourceRankingStrategy`
field with the values `"personalRatingThenDate"` (default when unset), `"personalRatingThenCustomBlend"`,
or `"customBlendThenPersonalRating"`.

**References**: `dto/RecommendationCriteria.java`; existing precedent `sortBy`/`discoverSortBy` fields
on the same DTO.

**Test Case (Red)**:
```groovy
def "SERIES-068-AC-01: sourceRankingStrategy defaults to personalRatingThenDate when unset"() {
    given: "a RecommendationCriteria with no sourceRankingStrategy set"
        def criteria = new RecommendationCriteria()

    expect: "the getter reports the default strategy"
        criteria.getSourceRankingStrategy() == null || criteria.getSourceRankingStrategy() == "personalRatingThenDate"
}
```
**Test Case (Green)**: add the field with getter/setter; resolve the default at the point of use (see AC-03), not on the DTO itself, matching how `sortBy`'s own default is resolved in `RecommendationRankingService.resolveSortComparator` rather than on the DTO.

---

### SERIES-068-AC-02 [AUTO]
**Statement**: If `sourceRankingStrategy` is set to any value other than the 3 recognized ones, then
`RecommendationCriteriaValidator` shall reject the request with a 400 response.

**References**: `service/recommendation/RecommendationCriteriaValidator.java` (existing enum-like
string validation precedent: `discoverSortBy` against `RecommendationDefaults.VALID_DISCOVER_SORT_BY`).

**Test Case (Red)**:
```groovy
def "SERIES-068-AC-02: an unrecognized sourceRankingStrategy is rejected"() {
    given: "criteria with an invalid strategy value"
        def criteria = new RecommendationCriteria()
        criteria.setSourceRankingStrategy("notARealStrategy")

    when: "the criteria is validated"
        validator.validate(criteria)

    then: "an IllegalArgumentException (mapped to 400) is thrown"
        thrown(IllegalArgumentException)
}
```
**Test Case (Green)**: add a `VALID_SOURCE_RANKING_STRATEGIES` constant set and a validation branch mirroring the existing `discoverSortBy` check.

---

### SERIES-068-AC-03 [AUTO]
**Statement**: When `sourceMode` is `"useMySeries"`, the `RecommendationSourcingService.resolveSourcePool`
method shall sort the source pool using the comparator resolved from `sourceRankingStrategy` (falling
back to the existing personal-rating/date-completed order when unset) before applying the
`maxSourceSeries` cap.

**References**: `RecommendationSourcingService.java:303-313` (`resolveSourcePool`); new
`SourceOrderComparator.forStrategy(RecommendationCriteria)` factory.

**Test Case (Red)**:
```groovy
def "SERIES-068-AC-03: resolveSourcePool honors sourceRankingStrategy when capping the pool"() {
    given: "more source series than maxSourceSeries, ranked differently under each strategy"
        // seed series whose personalRatingThenDate order differs from their
        // personalRatingThenCustomBlend order

    when: "sourceFromPool is called with sourceRankingStrategy=personalRatingThenCustomBlend"
        def raw = sourcingService.sourceFromPool(criteria, limit)

    then: "the series retained by the cap match the Custom Rating Blend order, not the default order"
        // assert on which source series' recommendations/similar calls were made
}
```
**Test Case (Green)**: thread the resolved comparator into `resolveSourcePool`'s existing `.sorted(...)` call.

---

## Requirement 2: a user-configurable "Custom Rating Blend"

**User story**: As a user choosing a rating-blend-based ranking strategy, I want to pick which rating
sources feed that blend, so it reflects the sources I actually trust.

### SERIES-068-AC-04 [AUTO]
**Statement**: The `RecommendationCriteria` DTO shall accept a new, optional `sourceRatingBlendSources`
field — a list of values from `{"imdb", "tmdb", "tomatometer", "popcornmeter"}`, defaulting to
`["imdb", "tmdb"]` when unset.

**References**: `dto/RecommendationCriteria.java`.

**Test Case (Red)**:
```groovy
def "SERIES-068-AC-04: sourceRatingBlendSources defaults to imdb+tmdb when unset"() {
    given: "a RecommendationCriteria with no sourceRatingBlendSources set"
        def criteria = new RecommendationCriteria()

    expect: "the resolved default matches RatingBlendUtil's own historical pair"
        // resolved via the same default-application point as AC-01
}
```
**Test Case (Green)**: add the field; default resolution lives in `SourceRatingBlend`, not on the DTO.

---

### SERIES-068-AC-05 [AUTO]
**Statement**: If `sourceRatingBlendSources` is empty or contains a value outside the 4 recognized
ones, then `RecommendationCriteriaValidator` shall reject the request with a 400 response.

**References**: `service/recommendation/RecommendationCriteriaValidator.java`.

**Test Case (Red)**:
```groovy
def "SERIES-068-AC-05: an invalid sourceRatingBlendSources entry is rejected"() {
    given: "criteria with an unrecognized blend source"
        def criteria = new RecommendationCriteria()
        criteria.setSourceRatingBlendSources(["imdb", "rottenTomatoesAverage"])

    when: "the criteria is validated"
        validator.validate(criteria)

    then: "an IllegalArgumentException (mapped to 400) is thrown"
        thrown(IllegalArgumentException)
}
```
**Test Case (Green)**: validate each entry against a `VALID_SOURCE_RATING_BLEND_SOURCES` constant set; also reject an explicitly-empty list.

---

### SERIES-068-AC-06 [AUTO]
**Statement**: A new `SourceRatingBlend.compute(SeriesEntity, Set<String> sources)` method shall
return the average of whichever selected sources are non-null on the given series — normalizing
`rottenTomatoesRating`/`rottenTomatoesPopcornmeter` from a 0-100 scale to a 0-10 scale (÷10) before
averaging with `imdbRating`/`tmdbRating` — or `null` if none of the selected sources have a value.

**References**: new `service/recommendation/SourceRatingBlend.java`; contrast with
`service/stats/RatingBlendUtil.java` (the existing, fixed, unrelated blend).

**Test Case (Red)**:
```groovy
def "SERIES-068-AC-06: blends only the selected sources, normalizing Rotten Tomatoes to a 0-10 scale"() {
    given: "a series with imdbRating=8.0, tmdbRating=7.0, rottenTomatoesPopcornmeter=90"
        def entity = new SeriesEntity(imdbRating: 8.0G, tmdbRating: 7.0G, rottenTomatoesPopcornmeter: 90)

    when: "computing the blend for imdb+popcornmeter only"
        def result = SourceRatingBlend.compute(entity, Set.of("imdb", "popcornmeter"))

    then: "the result averages 8.0 and 9.0 (90/10), ignoring tmdbRating entirely"
        result == 8.5G
}

def "SERIES-068-AC-06: returns null when none of the selected sources have a value"() {
    given: "a series with only tmdbRating set"
        def entity = new SeriesEntity(tmdbRating: 7.0G)

    when: "computing the blend for imdb+tomatometer only"
        def result = SourceRatingBlend.compute(entity, Set.of("imdb", "tomatometer"))

    then: "the result is null"
        result == null
}
```
**Test Case (Green)**: implement per the Design Decisions' normalize-then-average rule.

---

### SERIES-068-AC-07 [AUTO]
**Statement**: When `sourceRankingStrategy` is `"personalRatingThenCustomBlend"` or
`"customBlendThenPersonalRating"`, both `RecommendationSourcingService.resolveSourcePool` and
`RecommendationDeduplicationService.orderSources` shall use a comparator ordering by `personalRating`
and the `SourceRatingBlend` result (computed from `sourceRatingBlendSources`) in the stated
precedence, both descending with nulls last.

**References**: new `SourceOrderComparator.forStrategy(RecommendationCriteria)`;
`RecommendationDeduplicationService.dedupeAndExclude`/`orderSources` (new `Comparator<SeriesEntity>`
parameter).

**Test Case (Red)**:
```groovy
def "SERIES-068-AC-07: customBlendThenPersonalRating orders by blend first, personal rating as tiebreak"() {
    given: "two source series with the same personalRating but different Custom Rating Blend results"
        // series A: personalRating=4, blend sources -> higher blended value
        // series B: personalRating=4, blend sources -> lower blended value

    when: "orderSources is called with sourceRankingStrategy=customBlendThenPersonalRating"
        def ordered = deduplicationService.orderSources([seriesB, seriesA], comparator)

    then: "series A (higher blend) sorts first despite equal personalRating"
        ordered.first() == seriesA
}
```
**Test Case (Green)**: implement the factory's two blend-aware comparators; thread the resolved comparator into both call sites per the Design Decisions.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Fixed comparator this spec parameterizes | `service/recommendation/SourceOrderComparator.java` |
| Both call sites that gain a strategy-aware comparator | `RecommendationSourcingService.resolveSourcePool`, `RecommendationDeduplicationService.orderSources` |
| Call sites confirmed unaffected (always empty `sourceSeries`) | `RecommendationSourcingService.mergeDedupedCandidates`, `sourceWithBackfill`'s 3 discover modes |
| Existing, unrelated, fixed blend this spec's "Custom Rating Blend" is deliberately distinct from | `service/stats/RatingBlendUtil.java` (feeds `NameStatDto.averageBlendedRating`) |
| Rating fields consumed by the new blend | `SeriesEntity.imdbRating`/`tmdbRating`/`rottenTomatoesRating`/`rottenTomatoesPopcornmeter` |
| Existing per-request DTO precedent for new fields | `dto/RecommendationCriteria.java` (`sortBy`, `discoverSortBy`) |
| Existing string-enum validation precedent | `service/recommendation/RecommendationCriteriaValidator.java` |
| Persistence for a saved strategy/blend-source choice (no schema change needed) | `model/FilterProfileEntity.java` (`criteria` opaque `JsonNode`, `FilterProfileArea.USE_MY_SERIES`) |
| Paired frontend spec | `frontend_spec_132_source_ranking_strategy_and_custom_blend.md` |
| Related future idea (fuller, per-series custom ranking) | `.claude/ideas/future_ideas.md`, "User-configurable (drag-and-drop) source-series ranking" |

---

## Acceptance Criteria Summary

- [ ] SERIES-068-AC-01: `sourceRankingStrategy` field added to `RecommendationCriteria`, 3 recognized values, default `personalRatingThenDate`
- [ ] SERIES-068-AC-02: an unrecognized `sourceRankingStrategy` value is rejected with 400
- [ ] SERIES-068-AC-03: `resolveSourcePool` sorts by the resolved strategy before capping to `maxSourceSeries`
- [ ] SERIES-068-AC-04: `sourceRatingBlendSources` field added, 4 recognized values, default `["imdb","tmdb"]`
- [ ] SERIES-068-AC-05: an empty or unrecognized `sourceRatingBlendSources` entry is rejected with 400
- [ ] SERIES-068-AC-06: `SourceRatingBlend.compute` averages only selected, non-null sources, normalizing Rotten Tomatoes fields to a 0-10 scale, `null` when nothing is present
- [ ] SERIES-068-AC-07: both `resolveSourcePool` and `orderSources` use the blend-aware comparator when a Custom-Rating-Blend strategy is selected
