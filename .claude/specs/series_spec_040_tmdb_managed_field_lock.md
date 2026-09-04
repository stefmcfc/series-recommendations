# Series Spec 040: Lock TMDB-Managed Fields From Manual Edit (Refresh-Only Once Set)

**Status**: Implemented — `SeriesService.applyMetadataUpdates`/`applyRatingAndPersonalUpdates`
(the `PATCH` lock, `service/SeriesService.java`) and `SeriesRefreshService.refreshFromTmdb` (the
`title`/`year`/`genres` refresh sync, `service/refresh/SeriesRefreshService.java`), covered by
`SeriesServiceSpec.groovy` and `SeriesRefreshServiceSpec.groovy`.
**Priority**: P2 (data integrity — an unrestricted manual edit can silently drift a series' record
away from TMDB's own data for fields this app otherwise treats TMDB as the source of truth for)
**Depends on**: Series Spec 002 (`series_spec_002_crud.md`, owns `SeriesService.update`/
`applyMetadataUpdates`/`applyRatingAndPersonalUpdates`) ✅, Series Spec 017
(`series_spec_017_tmdb_primary_lookup.md`, establishes TMDB as the primary source for title/year/
genres at create time) ✅, Series Spec 018 (`series_spec_018_series_refresh.md`, owns
`SeriesRefreshService` and the `SERIES-018-AC-04` decision this spec partially reverses) ✅, Series
Spec 027 (`series_spec_027_rotten_tomatoes_popcornmeter_and_refresh_safety.md`, the null-preserving
"a missing TMDB field never blanks an existing value" refresh pattern this spec's extension
follows) ✅
**Area**: Backend (`service/SeriesService.java`, `service/SeriesRefreshService.java`) — paired with
Frontend Spec 060 (`frontend_spec_060_tmdb_managed_field_lock_ui.md`), which disables the
corresponding `EditSeriesForm` inputs once a value is set, so a user isn't shown an editable field
that the API will silently ignore.

## Overview

Today, `PATCH /api/v1/series/{id}` accepts a change to any field on `SeriesDto` unconditionally —
including `title`, `year`, `genres`, `totalSeasons`, `totalEpisodes`, and `imdbRating`, all fields
this app otherwise sources from TMDB (or OMDb, for `imdbRating`) at create/refresh time. A manual
edit to any of these can silently diverge from what TMDB actually reports, with no way to tell
the two apart later. This spec locks those six fields from manual `PATCH` edits once they carry a
value, while a single-series or bulk refresh (`SeriesRefreshService`) can always overwrite all six,
regardless of whether they're currently null or already set — refresh remains the one privileged
path that keeps a series' TMDB-sourced data current.

`totalSeasons`/`totalEpisodes`/`imdbRating` are already refreshed today (`SeriesRefreshService`
Requirement 2/`refreshFromTmdb`/`refreshFromOmdb`) — this spec only changes whether a manual edit
can touch them. `title`/`year`/`genres`, however, are never touched by a refresh today at all
(`SERIES-018-AC-04` explicitly lists `title`/`genres` as "never touched," and `year` was simply
never read from `TmdbSeriesDetail` in `refreshFromTmdb` despite the record already carrying it) —
locking those three from manual edit without also teaching refresh to maintain them would strand a
wrong value with no way to ever correct it. This spec extends `refreshFromTmdb` to also sync
`title`/`year`/`genres` from the same `TmdbClient.details(tmdbId)` call it already makes for every
other TMDB-sourced field, so all six locked fields have exactly one way to change after creation:
a refresh.

## Design Decisions

- **The lock applies only to `SeriesService.update` (the `PATCH` path), never to `create`.** A
  brand-new manually-added series (no TMDB match yet) must still be able to set every field freely
  at creation — there's no existing value to protect yet, and Series Spec 017's create flow is
  entirely unaffected.
- **Enforcement is "only apply when currently null," not a rejected/erroring request.** For exactly
  these six fields, `applyMetadataUpdates`/`applyRatingAndPersonalUpdates` only copy the incoming
  DTO value onto the entity when the entity's *current* value is `null`; if the current value is
  already set, the DTO's attempted change to that field is silently dropped and the existing value
  is kept — every other field on the DTO in the same request is applied normally. This mirrors
  `series_spec_034`'s established convention (disallowed input is silently dropped, not rejected as
  a `400`/`409`) rather than inventing a new error-response shape for this one case.
- **`title`'s "unless null" carve-out is unreachable in practice, by design.** `SeriesEntity.title`
  is `@NotBlank` and can never be `null` once a series exists (`series_spec_001`). Combined with the
  rule above, this means `title` becomes permanently refresh-only immediately after creation — a
  user can never rename a tracked series by hand, only by refreshing it against TMDB's current
  title. Confirmed intentional in discussion, not an oversight this spec should work around.
- **Refresh always overwrites all six fields, regardless of their current null/non-null state** —
  refresh is the one path this lock doesn't apply to. For `totalSeasons`/`totalEpisodes`/
  `imdbRating`, this is already today's behavior (unchanged by this spec). For `title`/`year`/
  `genres`, this spec adds that behavior to `refreshFromTmdb`, following the exact same
  null-preserving pattern already used there for every other field (`series_spec_027`'s "a missing
  TMDB field leaves the existing value unchanged, never blanks it" posture, `SERIES-027-AC-07`) —
  a field is only overwritten when TMDB's fresh response actually supplies a non-null value for it.
- **`genres` is synced from `TmdbSeriesDetail.genreIds()` via `TmdbGenreTable.joinDisplayNames(...)`**
  — the same helper `RecommendationOutputFilterService` already uses to render a candidate's
  `genre_ids` back to display text, and the same `TmdbSeriesDetail` record `SeriesLookupService`
  already builds `SeriesEntity.genres` from at create time (`series_spec_017`). No new genre-name
  resolution logic — `SeriesRefreshService` gains a `TmdbGenreTable` constructor dependency (an
  existing `@Component`, already injected elsewhere) to call it.
- **This partially reverses `SERIES-018-AC-04`.** Per this project's ID-immutability convention,
  that AC's original statement is preserved verbatim in `series_spec_018.md`, marked superseded
  with a pointer to this spec's `SERIES-040-AC-04`, rather than reworded (see Implementation Notes)
  — `posterUrl`/`personalRating`/`personalNotes`/`status`/`currentSeason`/`currentEpisode`/`imdbId`/
  `dateAdded`/`dateCompleted` remain untouched by refresh exactly as `SERIES-018-AC-04` already
  established; only `title`/`genres` come out of that "never touched" list.
- **Interaction with the not-yet-built `series_spec_030` ("explicit clear-to-null for optional
  fields") noted, not designed here.** Once that spec ships, explicitly clearing one of these six
  fields to `null` would be a deliberate, real way for a user to "unlock" it for one more manual
  edit before it's refreshed again — a sensible emergent behavior of the two specs combined, but
  `series_spec_030`'s own null-vs-omitted sentinel mechanics are out of scope here.
  **Update (2026-09-04)**: `series_spec_030` has now shipped, confirming this is real, not just
  anticipated — `SeriesService.applyClearedFields` nulls any of its 13 clearable fields
  unconditionally, with no lock check at all, so a `clearedFields` entry for `year`/`genres`/
  `totalSeasons`/`totalEpisodes`/`imdbRating` (5 of this spec's 6 locked fields; `title` is never
  clearable — it's required, not in `series_spec_030`'s clearable set) does exactly this: nulls the
  field, and since `SERIES-040-AC-01`'s lock condition is simply "is the entity's current value
  non-null," the field is thereby reopened to one more manual `PATCH` value until either a
  subsequent refresh or another manual edit sets it non-null again. Deliberately kept this way after
  discussion (2026-09-04): the lock's actual purpose is preventing *silent* drift from a routine
  `PATCH` that happens to carry a stale value the user didn't mean to touch — not blocking a
  *deliberate* Clear-button click, which is a conscious override, not silent drift. Also closes a
  real dead end this spec's lock could otherwise cause on its own: a manually-entered value for a
  field the external source (TMDB/OMDb) never ends up populating (e.g. a genuinely obscure/new show,
  or a series with no `imdbId` yet, so refresh can't run at all) would otherwise be stuck forever —
  un-retypeable (locked) and un-fixable (refresh is null-preserving, `SERIES-027-AC-07`) — recreating
  the exact problem `series_spec_030` exists to solve, just narrowed to these five fields.

---

## Requirement 1: `PATCH /api/v1/series/{id}` locks TMDB-managed fields once set

**User story**: As a user, I want the fields TMDB (or OMDb) already maintains for my tracked series
to stay in sync with their real source once populated, rather than accidentally drifting from a
manual edit I typed into the wrong field.

### SERIES-040-AC-01 [AUTO]
**Statement**: When `SeriesService.update` is called and the entity's current `title`, `year`,
`genres`, `totalSeasons`, `totalEpisodes`, or `imdbRating` is non-null, the corresponding value on
the incoming `SeriesDto` (whether present, changed, or omitted) shall be ignored for that field —
the entity's existing value is kept, and every other field in the same request is still applied
normally.

**References**: `SeriesService.applyMetadataUpdates` (`title`/`year`/`genres`/`totalSeasons`/
`totalEpisodes`), `SeriesService.applyRatingAndPersonalUpdates` (`imdbRating`).

**Test Case (Red)**:
```groovy
def "SERIES-040-AC-01: update cannot change year once it is already set"() {
    given: "an existing series with year = 2019"
        def existing = seriesService.create(new SeriesDto(title: "Show", year: 2019))

    when: "update attempts to change year to 2020, alongside an unrelated field change"
        seriesService.update(existing.id, new SeriesDto(title: "Show", year: 2020, personalNotes: "great"))

    then: "year is unchanged, but the unrelated field still applied"
        def result = seriesService.getById(existing.id)
        result.year == 2019
        result.personalNotes == "great"
}
```
**Test Case (Green)**: in `applyMetadataUpdates`/`applyRatingAndPersonalUpdates`, change the guard
for these six fields from `if (dto.getX() != null)` to `if (dto.getX() != null && entity.getX() ==
null)`.

---

### SERIES-040-AC-02 [AUTO]
**Statement**: When `SeriesService.update` is called and the entity's current `title`, `year`,
`genres`, `totalSeasons`, `totalEpisodes`, or `imdbRating` is `null`, a non-null value for that
field on the incoming `SeriesDto` shall be applied — the lock only withholds a *change* to an
already-set value, never an initial value for a manually-added series that has none yet.

**Test Case (Red)**:
```groovy
def "SERIES-040-AC-02: update CAN set year when it is currently null"() {
    given: "an existing, manually-added series with no year"
        def existing = seriesService.create(new SeriesDto(title: "Show"))

    when: "update sets year for the first time"
        seriesService.update(existing.id, new SeriesDto(year: 2019))

    then: "year is set"
        seriesService.getById(existing.id).year == 2019
}
```
**Test Case (Green)**: falls out of AC-01's guard directly — `entity.getX() == null` is true, so
the incoming value is applied.

---

### SERIES-040-AC-03 [AUTO] (regression guard)
**Statement**: Every other `SeriesDto` field not listed in AC-01 (`tags`, `currentEpisode`,
`posterUrl`, `rottenTomatoesRating`, `rottenTomatoesPopcornmeter`, `personalRating`,
`personalNotes`, `excludeFromRecommendations`, `flaggedForRewatch`, `status`, `currentSeason`,
`imdbId`) shall remain freely editable via `update` regardless of their current value, exactly as
today — this spec narrows only the six named fields.

**Test Case (Green)**: no code change — regression guard mirroring the existing
`"SERIES-027-AC-03: update only overwrites rottenTomatoesPopcornmeter when explicitly provided"` and
similar tests already in `SeriesServiceSpec.groovy`, confirmed to still pass unmodified since this
spec's guard change is scoped to exactly the six named setters.

---

## Requirement 2: A refresh always overwrites all six locked fields

**User story**: As a user, I want refreshing a series to be the one reliable way to correct or
update its TMDB-sourced fields, even ones I could no longer edit by hand.

### SERIES-040-AC-04 [AUTO]
**Statement**: `SeriesRefreshService.refreshFromTmdb` shall update `title`, `year`, and `genres`
from a fresh `TmdbClient.details(tmdbId)` result whenever that result supplies a non-null value for
each — mirroring the existing null-preserving posture already applied to `totalSeasons`/
`totalEpisodes`/`tmdbRating`/`tmdbVoteCount`/`productionStatus`/`originCountry`/`overview`/
`lastAirYear` in the same method (`SERIES-027-AC-07`). This applies unconditionally, regardless of
whether the entity's current `title`/`year`/`genres` is already non-null — refresh is not subject to
the `SERIES-040-AC-01` lock.

**References**: `TmdbSeriesDetail.title()`/`.year()`/`.genreIds()`; `TmdbGenreTable.joinDisplayNames`.
Partially supersedes `SERIES-018-AC-04` (`series_spec_018_series_refresh.md`) — see Implementation
Notes.

**Test Case (Red)**:
```groovy
def "SERIES-040-AC-04: refresh overwrites title/year/genres from a fresh TMDB result"() {
    given: "an existing series with a stale title/year/genres"
        def entity = new SeriesEntity(title: "Old Title", year: 2018, genres: "Drama",
            imdbId: "tt1234567", status: SeriesStatus.WATCHING)
        entity.id = UUID.randomUUID()
        seriesRepository.findById(entity.id) >> Optional.of(entity)
        seriesRepository.save(_) >> { SeriesEntity e -> e }
        tmdbClient.findTvIdByImdbId("tt1234567") >> Optional.of(42)
        tmdbClient.details(42) >> new TmdbSeriesDetail("New Title", 2019, [18, 10765], null,
            null, null, null, null, null, null, null, null)

    when: "the series is refreshed"
        refreshService.refresh(entity.id)

    then: "title/year/genres are all overwritten from the fresh TMDB result"
        entity.title == "New Title"
        entity.year == 2019
        entity.genres == "Drama, Sci-Fi & Fantasy"
}
```
**Test Case (Green)**: add `if (detail.title() != null) entity.setTitle(detail.title());`,
`if (detail.year() != null) entity.setYear(detail.year());`, and
`if (detail.genreIds() != null && !detail.genreIds().isEmpty()) entity.setGenres(genreTable.joinDisplayNames(detail.genreIds()));`
to `refreshFromTmdb`, alongside the existing field updates in that method. `SeriesRefreshService`
gains a `TmdbGenreTable` constructor dependency.

---

### SERIES-040-AC-05 [AUTO] (regression guard)
**Statement**: If the fresh TMDB result's `title`, `year`, or `genreIds` is `null` (or, for
`genreIds`, empty), the entity's existing value for that field shall remain unchanged — a refresh
never blanks a previously-recorded value just because today's response happens to omit it, matching
`SERIES-027-AC-07`'s existing posture for every other refreshed field.

**Test Case (Green)**: falls out of AC-04's null-guarded assignment directly — the same pattern
already covered by existing `SeriesRefreshServiceSpec.groovy` tests for the other refreshed fields.

---

## Implementation Notes

- **`series_spec_018_series_refresh.md` needs a matching edit**, not just this new spec: mark
  `SERIES-018-AC-04` superseded (`~~**SERIES-018-AC-04** [AUTO]~~ — superseded by
  `SERIES-040-AC-04`: <original statement unchanged>`), update its Acceptance Criteria Summary line,
  and append a dated note to its own Design Decisions pointing here — per this project's
  ID-immutability convention, the original AC text is never reworded or deleted. Its javadoc on
  `SeriesRefreshService` (currently stating `title`, `genres`, ... are never touched) needs
  rewriting to drop `title`/`genres` from that list.
- **`API.md`** should note that `PATCH /api/v1/series/{id}` now silently ignores an attempted change
  to `title`/`year`/`genres`/`totalSeasons`/`totalEpisodes`/`imdbRating` once each is non-null —
  a behavior change worth documenting explicitly, the same way `series_spec_034`'s Implementation
  Notes flagged its own.
- **`RUNBOOK.md`**'s refresh-related troubleshooting/behavior notes should mention that a refresh
  now also updates `title`/`year`/`genres`, not just ratings/season-episode counts.

## Cross-References

| This spec | Source |
|---|---|
| `SeriesService.update`/`applyMetadataUpdates`/`applyRatingAndPersonalUpdates`, the methods this spec locks | `series_spec_002_crud.md` |
| TMDB as primary source for title/year/genres at create time | `series_spec_017_tmdb_primary_lookup.md` |
| `SeriesRefreshService`/`refreshFromTmdb`, the original `SERIES-018-AC-04` decision this spec partially reverses | `series_spec_018_series_refresh.md` Requirement 1 |
| Null-preserving refresh pattern this spec's extension follows | `series_spec_027_rotten_tomatoes_popcornmeter_and_refresh_safety.md` (`SERIES-027-AC-07`) |
| Paired frontend change — `EditSeriesForm` disables the corresponding inputs once set | `frontend_spec_060_tmdb_managed_field_lock_ui.md` |
| "Silently drop, don't error" precedent for disallowed input | `series_spec_034_exclude_from_recommendations_enforcement.md` |
| `TmdbGenreTable.joinDisplayNames`, reused unchanged | `service/TmdbGenreTable.java` (`series_spec_007_recommendation_sourcing.md`) |

---

## Acceptance Criteria Summary

- [x] SERIES-040-AC-01: `update` cannot change any of the six locked fields once non-null
- [x] SERIES-040-AC-02: `update` can still set any of the six when currently null
- [x] SERIES-040-AC-03: every other field remains freely editable via `update` (regression guard)
- [x] SERIES-040-AC-04: refresh always overwrites title/year/genres from a fresh TMDB result
- [x] SERIES-040-AC-05: a null/empty TMDB value for title/year/genres never blanks the existing value (regression guard)
