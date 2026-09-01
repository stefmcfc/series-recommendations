# API Overview

The backend exposes a REST API at `http://localhost:8080/api/v1`.

**Maintenance rule**: update this file in the same change that creates, amends, or removes an
endpoint — this is part of Definition of Done in `CLAUDE.md`, the same way `README.md`/`RUNBOOK.md`
updates are.

Full interactive docs are available at `http://localhost:8080/swagger-ui.html` when the backend is
running (requires springdoc-openapi to be added — not yet a dependency). Until then, this file is
the source of truth for request/response shape at the level of detail below; it intentionally
doesn't include full example bodies, since those would either duplicate or immediately go stale
against the generated docs once springdoc-openapi lands.

CORS is configured on `/api/**` to allow direct cross-origin calls from the frontend dev server
(`http://localhost:5173` by default, overridable via `app.cors.allowed-origins` in
`application.yml` or the `APP_CORS_ALLOWED_ORIGINS` env var — see `RUNBOOK.md`'s Environment
Variables section).

---

## Series CRUD

### `POST /api/v1/series`

Create a new series.

---

### `GET /api/v1/series`

List all series. Supports `sortBy`/`sortDirection` — see Sorting below.

---

### `GET /api/v1/series/{id}`

Get a series by ID.

---

### `PATCH /api/v1/series/{id}`

Update a series (partial).

**Behavior change (`series_spec_040_tmdb_managed_field_lock.md`)**: `title`, `year`, `genres`,
`totalSeasons`, `totalEpisodes`, and `imdbRating` are TMDB (or OMDb, for `imdbRating`)-managed
fields — once a series' value for one of these is non-null, an attempted change to it via this
endpoint is silently ignored (not rejected as `400`/`409`); every other field in the same request
still applies normally. A manually-added series with no value yet for one of these six can still
set it once, the first time. The only way to change one of these six after that point is
`POST /api/v1/series/{id}/refresh` (or a bulk refresh), which always overwrites all six from
TMDB/OMDb's current data regardless of this lock. `title` in particular is `@NotBlank` and so is
never null once a series exists — in practice this makes `title` permanently refresh-only
immediately after creation.

---

### `DELETE /api/v1/series/{id}`

Delete a series.

**Validation (`series_spec_041_year_validation_bounds.md`)**: `POST`/`PATCH` reject any bounded
numeric field outside its valid range with `400 Bad Request` and a descriptive message — this
includes `year`, `totalSeasons`, `totalEpisodes`, `currentSeason`, `currentEpisode`, `imdbRating`,
`rottenTomatoesRating`, and `rottenTomatoesPopcornmeter` (previously some of these returned `500
Internal Server Error` instead). `year` specifically must be between `1900` and the current year +
1 (resolved dynamically at request time, not a fixed upper bound) — the same convention already
used for `yearMin`/`yearMax` on Custom Search/Recommendations (see below).

## Search & Export

### `GET /api/v1/series/search`

Search and filter series (`title`, `genre`, `excludeGenre`, `keyword`, `status`,
`minPersonalRating`, `minImdbRating`, `minTmdbRating`, `yearMin`/`yearMax`, `flaggedForRewatch`).
Supports `sortBy`/`sortDirection` — see Sorting below. `yearMin`/`yearMax` use true interval-overlap
matching: a series' known airing span is `[year, lastAirYear ?? year]` (`lastAirYear` is the year
of the most recently aired episode TMDB reports, resolved at create/refresh time — `null` when
unresolved, in which case the span collapses to `year` alone), and it matches when that span
overlaps `[yearMin, yearMax]` — so a show that started before the requested range but is still
airing through it still matches. This upgrades `series_spec_037_search_filter_overhaul.md`'s
original stopgap (which matched only the stored `year` field) — see
`series_spec_039_last_air_year.md`.

`genre` and `excludeGenre` (`series_spec_042_exclude_genres_search.md`) are both singular,
repeatable query params (`?genre=Comedy&genre=Drama`) matched by case-insensitive substring against
the stored `genres` field, with OR semantics across multiple values. `excludeGenre` drops any
series whose `genres` string contains any of the requested values; a series with no genres at all
is never excluded by it. If a series matches both `genre` and `excludeGenre`, the exclusion wins.

**Breaking change (`series_spec_037`)**: `maxPersonalRating`, `maxImdbRating`, and
`startedNotFinished` are no longer accepted — a rating floor (`min...`) is the only supported
shape, and the started-not-finished filter has been dropped outright, not deprecated. Unrecognized
params are silently ignored (as with any other unknown query key on this endpoint), not rejected.

---

### `GET /api/v1/series/export`

Export as JSON or CSV.

## Keywords

### `GET /api/v1/series/keywords?sortBy=`

Aggregate per-keyword stats (`seriesCount`, `averagePersonalRating`) across your tracked series,
from normalized TMDB keyword data. `sortBy` is `seriesCount` (default) or
`averagePersonalRating`, both descending, null averages last; an unrecognized value falls back to
the default rather than `400`. Empty list, not an error, when nothing tracked has keywords.

## Lookup

### `GET /api/v1/series/lookup/search-tmdb?title=`

Search TMDB for a title — TMDB is this app's sole search source (matches original/translated/AKA
names, e.g. "Spooks", catalogued elsewhere as "MI-5"). Requires `app.tmdb.api-key`. An empty
result is a normal `200` with an empty list, not an error.

---

### `GET /api/v1/series/lookup/resolve-tmdb?tmdbId=`

Resolve a TMDB search candidate to full lookup detail, built exclusively from TMDB's own data
(title, year, genres, poster, season/episode counts, `tmdbRating`/`tmdbVoteCount`). If TMDB
resolves an `imdbId`, `imdbRating`/`rottenTomatoesRating` are additionally merged in from OMDb
(requires `app.omdb.api-key`) — any OMDb failure or absence just leaves those two fields `null`,
never fails the request. Always `200` on success; `502` only for a genuine TMDB upstream failure.

## Recommendations

### `GET /api/v1/series/recommendations?limit=`

Suggest series to watch next. `limit` defaults to 20, clamped to 1-50. Excludes anything already
added or ignored. Requires `app.tmdb.api-key` to be configured once there's data to source from —
see `RUNBOOK.md`'s Environment Variables section — otherwise returns `502`.

Sourcing mode is selected via `sourceMode` (`trending`|`topRated`|`useMySeries`) and/or
`seriesIds`/`genres`/`keywords`:

- **`sourceMode=useMySeries`** (or an explicit `seriesIds` selection, even without this flag)
  sources from TMDB based on your `COMPLETED` series (title-based), supplemented by your
  most-watched genres when there's too little title-based data yet. A series with
  `excludeFromRecommendations: true` is skipped entirely from this pool — set it via
  `POST`/`PATCH /api/v1/series` when a show is rated fine but isn't representative of your taste.
  **Behavior change (`series_spec_034`)**: this exclusion now applies uniformly to both the
  automatic pool and an explicit `seriesIds` selection — an excluded series named in `seriesIds`
  is silently dropped from the effective source pool rather than being honored (not an error; if
  every requested id turns out to be excluded, the pool is simply empty). This reverses the
  previous behavior, where naming a series explicitly always won over the standing preference.
  A `seriesIds` entry that doesn't match any existing series at all is still rejected with `400`,
  unaffected by this change. `sourceMode=useMySeries` is mutually exclusive with `genres`/
  `keywords` (`400` if combined) but **compatible** with `seriesIds` — narrowing "Use My Series" to
  a specific selection while keeping the pool-based ranking/diversity-cap behavior below.
- **`sourceMode=trending`** sources TMDB's globally trending shows (`trendingWindow=day|week`,
  default `week`).
- **`sourceMode=topRated`** sources TMDB's highest-rated shows overall using `minVoteCount`
  (default **200** for this mode specifically — every other mode defaults to 20) as the query's
  own vote-count floor.
- **Everything else — including a request with `sourceMode` omitted entirely and no `seriesIds`/
  `genres`/`keywords` set** — is Custom Search: an unfiltered or genre/keyword-filtered TMDB
  `discover/tv` call. **Behavior change**: previously, an entirely empty request (or one with only
  `minTmdbRating`/`yearMin`/`yearMax` set) silently fell back to the same automatic pool as
  `sourceMode=useMySeries` today; it now always reaches Custom Search's `discover/tv` call
  instead, so those filters are correctly applied pre-fetch rather than being silently bypassed
  (`series_spec_033`).

`trending`/`topRated`/`sourceMode=useMySeries` are mutually exclusive with `seriesIds`/`genres`/
`keywords` (`400` if combined, or if `sourceMode` isn't one of the three recognized values), with
the one deliberate exception of `sourceMode=useMySeries` + `seriesIds` described above.

`trending`, `topRated`, and Custom Search (`genres`/`keywords`, or neither) all keep TMDB's own
returned order rather than being re-ranked/diversity-capped by the app, since none of the three
ever link a candidate back to one of your own series. For `topRated` and Custom Search
specifically, `discoverSortBy` selects the TMDB-native `discover/tv` `sort_by` value driving that
order — one of TMDB's 12 documented values (e.g. `vote_average.desc`, `popularity.desc`,
`first_air_date.desc`; `400` if unrecognized), defaulting to `vote_average.desc` for `topRated` and
`popularity.desc` for Custom Search when omitted; ignored (not an error) under any other mode. All
directed modes still exclude anything already added or ignored.

`minTmdbRating`/`yearMin`/`yearMax` are applied as post-fetch output filters across every
sourcing mode. For Custom Search sourcing specifically, they're **additionally** sent to TMDB
itself as real `discover/tv` params (`vote_average.gte`/`air_date.gte`/`air_date.lte`) rather than
relying solely on the post-fetch check — TMDB only ever returns one ~20-result unpaginated page,
so a restrictive combination could otherwise silently return few/zero results even when TMDB had
real matches it was never asked for. **This also changes the year field's semantics for Custom
Search only**: `yearMin`/`yearMax` there filter on a candidate's *episode* air date (TMDB's
`air_date.gte`/`.lte`), not its first-air date, so a still-running older show (e.g. one airing
continuously since 1989) can match a recent year range. Every other mode (`trending`, `topRated`,
`useMySeries`/`seriesIds` sourcing) keeps matching on first-air year via the post-fetch filter only
— this asymmetry is deliberate, not a bug. `minTmdbRating` must be between `0` and `10` (`400`
otherwise); `yearMin`/`yearMax` must each be between `1900` and the current year + 1, and `yearMin`
cannot exceed `yearMax` (`400` otherwise) — these bounds are validated regardless of sourcing mode.

`language` (a single ISO 639-1 code) is applied as a post-fetch output filter across every
sourcing mode, matching a candidate's `originalLanguage` case-insensitively. For Custom Search
sourcing specifically, it's **additionally** sent to TMDB itself as `with_original_language` —
the same "don't rely solely on the post-fetch check against one ~20-result page" reason
`minTmdbRating`/`yearMin`/`yearMax` were moved pre-fetch for in `series_spec_031`. `language`
stays single-select (TMDB's `with_original_language` accepts one value only); a multi-value
equivalent would mean only the first of several selected languages ever reached TMDB pre-fetch.

`countries` (comma-separated ISO 3166-1 alpha-2 codes, e.g. `countries=US,GB`) excludes a
candidate whose `originCountry` doesn't case-insensitively match any entry — applied as a
post-fetch output filter **unconditionally, across every sourcing mode**, with no asymmetry
(unlike the year fields above): `origin_country` is present on every candidate TMDB already
returns regardless of endpoint, so there's no post-fetch data gap to guard against. For Custom
Search sourcing specifically, `countries` is **additionally** sent to TMDB itself as
`with_origin_country` (**pipe-joined**, e.g. `with_origin_country=US%7CGB`) for the same pre-fetch
reason as `language` above. Unlike `language`, `countries` is multi-select/OR-matched. TMDB's own
documented `discover/tv` params explicitly call out comma-(`AND`)/pipe-(`OR`)-separated support for
`with_genres`/`with_keywords`/`with_companies`/etc., but carry no such note for
`with_origin_country`/`with_original_language` specifically. **Verified live** against the real
TMDB API (2026-08-28, corrected): comma is actually an **AND** for `with_origin_country`
specifically — `countries=JP,SE` returned 0 results despite each individually returning results
(an initial pass using `countries=US,GB` wrongly read as confirming comma=OR, since enough genuine
US/GB co-productions exist — e.g. *Sherlock* — that AND-matching looks identical to OR-matching for
that specific pair). Pipe is the correct OR separator; `TmdbClient.discover()` sends it accordingly.

`excludeKeywords` (comma-separated names) excludes a candidate whose TMDB keywords
case-insensitively match any entry, applied last (after every other output filter) across every
sourcing mode; a per-candidate keyword lookup failure fails that one candidate open rather than
the whole request.

Each result also carries `streamingProviders` — the currently-available subscription-streaming
(`flatrate`) services it's on in `app.tmdb.watch-region` (default `GB`), sourced live per request
from TMDB/JustWatch (`GET /tv/{tmdbId}/watch/providers`), never persisted; a failed or empty
lookup just yields an empty list for that one candidate, never a failed request.

---

### `GET /api/v1/series/recommendations/{tmdbId}/details?imdbId=`

On-demand lookup for a single recommendation candidate's season/episode counts and IMDb rating —
mirrors `GET /api/v1/series/recommendations/{tmdbId}/keywords`'s on-demand, tmdbId-scoped shape:
not folded into the bulk `recommendations` response above, since fetching this for every card in a
10-20 result list would cost a TMDB + OMDb call per card the user never asked to expand.

`imdbId` (optional query param) — a candidate's IMDb id, already present on every
`RecommendationDto`/frontend `Recommendation` as `imdbId`.

Returns `200` with a single-object envelope (`{ "data": { "numberOfSeasons", "numberOfEpisodes",
"imdbRating" }, ... }` — matching `GET /api/v1/series/{id}`'s shape, not the list-plus-`count`
shape `recommendations`/`.../keywords` use). All three fields degrade **independently** to `null`
on their respective source's failure, never a `4xx`/`5xx` for this endpoint:

- `numberOfSeasons`/`numberOfEpisodes` come from TMDB's `GET /tv/{tmdbId}` (`app.tmdb.api-key`) —
  both `null` together if that call fails.
- `imdbRating` comes from OMDb (`app.omdb.api-key`) — `null` if `imdbId` is omitted/blank, or if
  that call fails (unresolvable id, key unset, network failure).

---

### `POST /api/v1/series/ignored`

Dismiss a recommendation (`{ imdbId, title, reason? }`) so it never resurfaces. Idempotent —
re-ignoring the same `imdbId` returns `200` instead of `201`.

## Refresh

### `POST /api/v1/series/{id}/refresh`

Re-fetch one series' external data: TMDB detail (`title`/`year`/`genres`/`totalSeasons`/
`totalEpisodes`/`tmdbRating`/`tmdbVoteCount`/`productionStatus`), its normalized `keywords` set,
and a narrowed OMDb ratings call (`imdbRating`/`rottenTomatoesRating`). Either source failing is
independently non-fatal — a partial success is saved, not rolled back. User-/system-owned fields
(`posterUrl`, `personalRating`, `personalNotes`, `status`, `currentSeason`, `currentEpisode`,
`imdbId`, `dateAdded`, `dateCompleted`) are never touched.
**Behavior change (`series_spec_040_tmdb_managed_field_lock.md`)**: `title`/`year`/`genres` are no
longer in that untouched list — a refresh now also overwrites them from TMDB's fresh result
(never blanking an existing value when TMDB's response omits one), the counterpart to `PATCH`
locking those same fields (plus `totalSeasons`/`totalEpisodes`/`imdbRating`) from manual edit once
set — see below. Always forces a real refresh, ignoring
`app.tmdb.refresh-skip-threshold-minutes` (that threshold applies only to bulk refresh). If
`totalSeasons`/`totalEpisodes` increased since before this refresh (and a prior value existed — a
first-ever populated value doesn't count), `newContentDetectedAt` is set to now; if the series was
`COMPLETED` at the time, it's also flipped to `BACKLOG` with `dateCompleted` cleared
(`DROPPED`/`WATCHING`/`BACKLOG` are left alone). `404` for an unknown id; otherwise always `200`
with `{ series, omdbRefreshed, tmdbRefreshed }`.

---

### `POST /api/v1/series/{id}/acknowledge-new-content`

Clear a series' `newContentDetectedAt` flag once you've seen it — never reverses a status change
refresh already made. `404` for an unknown id; otherwise `200` with the updated series.

---

### `POST /api/v1/series/refresh-all`

Start an async job refreshing every tracked series sequentially (same logic as the single-series
refresh above, including new-content detection/reactivation), with a fixed delay between items
(`app.tmdb.refresh-delay-ms`) to stay within TMDB's rate limit. A series refreshed within
`app.tmdb.refresh-skip-threshold-minutes` (default 60; `0` disables skipping) is skipped rather
than re-fetched, but still counted toward `completedCount`. `202` with the job's initial state;
`409` if a job is already running.

---

### `GET /api/v1/series/refresh-all/status`

Poll the current (or most recently finished) bulk refresh job's `{ status, totalCount,
completedCount, skippedCount, startedAt, finishedAt }`. `status` is `IDLE` before any job has ever
run, then `IN_PROGRESS`/`COMPLETED`/`FAILED` — a completed run's result stays visible here until a
new job starts.

## Sorting

`sortBy`/`sortDirection` on `GET /api/v1/series` and `GET /api/v1/series/search`: `sortBy` is one
of `dateAdded` (default), `personalRating`, `title`, `year`, `imdbRating`, `tmdbRating`;
`sortDirection` is `asc` or `desc` (default `desc`). An unrecognized value for either returns
`400`, unlike `/keywords?sortBy=`'s fall-back-to-default behavior above. A `null` value for the
chosen field always sorts last regardless of direction (`title` has no null case). Under
`sortBy=tmdbRating`, `tmdbVoteCount` descending breaks ties (including both-`tmdbRating`-null
ties) so a near-unrated show can't outrank a well-established one on a coincidental exact-rating
match.
