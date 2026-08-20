# Spec 016: `voteCount` on Recommendations

**Status**: ✅ Implemented
**Priority**: P3 (small display-data addition — not core CRUD)
**Depends on**: Series Spec 006 (Recommendations) ✅
**Backend Task**

## Overview

`RecommendationDto.tmdbRating` (TMDB's `vote_average`) is already exposed, but the vote count backing that average (`TmdbCandidate.voteCount`, TMDB's `vote_count` — already fetched and already used internally by `matchesMinVoteCount`'s output filter, `series_spec_007` Requirement 8) is never surfaced to the API response. Without it, a user has no way to tell a `7.7` rating from 5,000 votes apart from a `7.7` rating from 12 votes. This spec exposes it as a plain passthrough field, mirroring how `tmdbRating` itself is already handled — no new business logic.

## Requirements

### Requirement 1: `voteCount` Field

**User story**: As a user browsing recommendations, I want to see how many votes back a TMDB rating, so I can judge how much to trust it.

#### Acceptance Criteria

- **SERIES-016-AC-01** [AUTO]: `RecommendationDto` shall gain an `Integer voteCount` field, positioned after `tmdbRating`.
- **SERIES-016-AC-02** [AUTO]: `RecommendationService.toDto` shall populate `voteCount` from the candidate's `TmdbCandidate.voteCount()` verbatim (including `null`, if TMDB ever omits it) — no default substitution, no rounding, no clamping.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationDto`, `RecommendationService.toDto`, `tmdbRating`'s existing shape this field mirrors | `series_spec_006_recommendations.md` |
| `TmdbCandidate.voteCount`, already fetched for `matchesMinVoteCount` | `series_spec_007_recommendation_sourcing.md` Requirement 8 |
| Frontend consumer | `frontend_spec_020_recommendation_rating_display.md` |

---

## TDD Test Case Sketches

### `RecommendationServiceSpec.groovy`

```groovy
def "SERIES-016-AC-02: toDto populates voteCount from the TMDB candidate verbatim"() {
    given: "a candidate with voteCount 1500"
        // candidate(..., voteCount: 1500)

    when: "recommend(...) is called"
        def results = recommendationService.recommend(20)

    then: "voteCount is passed through unchanged"
        results[0].voteCount() == 1500
}
```

### `SeriesControllerRecommendationsSpec.groovy`

```groovy
def "SERIES-016-AC-01: GET /api/v1/series/recommendations includes voteCount"() {
    given: "RecommendationService.recommend(...) resolves a DTO with voteCount 1500"
        // ...

    when: "the recommendations endpoint is invoked"
        def result = mockMvc.perform(get("/api/v1/series/recommendations"))

    then: "voteCount is present in the response"
        result.andExpect(jsonPath('$.data[0].voteCount').value(1500))
}
```

---

## Acceptance Criteria Summary

- [x] SERIES-016-AC-01: `RecommendationDto.voteCount` field
- [x] SERIES-016-AC-02: `toDto` populates it verbatim from `TmdbCandidate.voteCount()`
