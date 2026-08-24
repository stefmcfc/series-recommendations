# Scratch: New Ideas (2026-08-24)

**Temporary working file** — not a spec, not committed to. Captures ideas dropped late on 2026-08-24 plus quick
analysis, so tomorrow's session can turn them into proper EARS specs (new ACs on existing specs where they fit) without
re-deriving context. Delete this file once every item below has either become a spec change or been explicitly deferred
to `FUTURE_IDEAS.md`.

---

## 1. Recommendation cards: show origin country + keywords when available

**Idea**: `Recommendation` cards (Recommendations tab) currently show title/year/genres/overview/rating/votes/source.
Add country of origin, and keywords "if immediately available."

**Quick analysis**:

- **Origin country is cheap.** TMDB's TV list endpoints (trending, discover, search — everything `RecommendationService`
  already calls) include `origin_country` in the base payload, no extra call needed. Same data shape already threaded
  through for tracked `Series.originCountry` (`series_spec_021_origin_country.md`). This is a straightforward add:
  `Recommendation` type gains `originCountry`, backend `RecommendationDto`/mapping threads it through, card renders it.
- **Keywords are NOT cheap — this is the one to think about.** TMDB does not include keywords in any list-endpoint
  response (trending/discover/search). Keywords only come from a per-show call, `GET /tv/{id}/keywords`. A
  recommendation list is typically 10-20 candidates, so showing keywords on every card means 10-20 extra TMDB calls per
  recommendation fetch — real rate-limit budget (this codebase is already careful about TMDB's ~40 req/10s limit, see
  `app.tmdb.refresh-delay-ms`). Options to weigh tomorrow:
  - (a) Don't show keywords on the recommendation card at all until it's added to the tracked list (where keyword
    population already happens via refresh, per today's item 4 work) — "if immediately available" reads as it might
    already be nudging toward this: cheap or nothing.
  - (b) Fetch keywords lazily only on hover/expand of a single card, not for the whole list up front.
  - (c) Cap it to the first N cards only.
- **Relevant specs to amend**: whichever spec currently defines the `Recommendation` card fields
  (`frontend_spec_010_recommendations.md` and/or `frontend_spec_020_recommendation_rating_display.md` — check which one
  actually owns card layout) + `series_spec_007_recommendation_sourcing.md`/
  `series_spec_022_trending_and_top_rated_recommendations.md` for the backend DTO/TMDB-client side.

**Decision (2026-08-24 follow-up)**: going with option **(b)**, lazy per-card keyword fetch.

That raised a real gap when reviewed against the running app: `RecommendationsList.tsx` cards have **no click-through
to a detail view** — only the three CTAs (Mark as Watched / Add to List / Ignore). Checked `SeriesList.tsx` for
comparison: tracked-series rows already *are* clickable through to `SeriesDetail` (the title is a
`<button onClick={handleRowClick}>`, wired since frontend_spec_005/008) — this gap is specific to
`RecommendationsList`, not the app generally.

However, it turns out not to block anything today: `RecommendationsList.tsx` (lines 208-210) already renders
`r.overview` inline on every card unconditionally — it comes free in the same TMDB call used to build the candidate
list, no extra request, no gating needed. So there's no missing "click to see more" for the *recommendation* overview
specifically.

The real, currently-unfilled gap is downstream of that: once a recommendation is added to the tracked list, its
description is lost. Confirmed by reading the code — `SeriesEntity`/`SeriesDto` have no `overview`/`description`
field at all, and `TmdbClient` never parses `overview` out of the `/tv/{id}` details response it already calls.

**Store-vs-fetch-on-demand, resolved**: store it in the DB. The backend already calls `GET /tv/{id}` at series
creation and on every refresh — that's how `tmdbRating`, `productionStatus`, and `originCountry` get populated
(`series_spec_021_origin_country.md`). `overview` is sitting unparsed in that same response, so persisting it costs
**zero extra TMDB calls** — same pattern as every other TMDB-derived field already in this codebase. Fetching it live
every time `SeriesDetail` opens would be strictly worse: an added network call + latency on every view, and it drains
the TMDB rate-limit budget (`app.tmdb.refresh-delay-ms`) on *read*, not just on write/refresh, for data that doesn't
even change often. No DB-storage-cost concern either — this is a single `TEXT` column, negligible next to
`personalNotes` (also `TEXT`) already on the entity.

**Also add to the spec list**: a `SeriesEntity.overview`/`SeriesDto.overview` field populated the same way
`originCountry` was (`series_spec_021`), surfaced on `SeriesDetail`. Whether `RecommendationsList` cards should also
gain a click-through to *some* detail view is a separate, smaller question — since the overview's already shown
inline there, that's about surfacing keywords/other detail, not about recovering a description that's already
visible.

---

## 2. Keyword filter: allow free-text search, not just checkboxes

**Idea**: Both the Recommendations keyword filter and the list-page `SearchFilter` keyword picker are fixed-vocabulary
checkboxes (built from `GET /series/keywords`, i.e. keywords seen on *already-tracked* series). You might want to search
recommendations by a keyword you don't have any tracked show for yet.

**Quick analysis — this splits into two genuinely different cases**:

- **Recommendations page**: backend already resolves arbitrary keyword strings via `TmdbClient.searchKeyword`
  (`series_spec_007_recommendation_sourcing.md`, `SERIES-007-AC-12`–`AC-16`) — the checkbox list is a *frontend*-imposed
  constraint on top of a backend that already accepts any keyword name. Free text here is a real, easy win: add a text
  input (autocomplete against TMDB's keyword search, or just freeform + resolve on submit) alongside/instead of the
  checkbox list. This directly fixes the "haven't watched it yet" case the idea calls out.
- **List page (`SearchFilter`)**: `SearchCriteria.keywords` matches literally against each tracked series' *own stored*
  `keywords` field — there's no TMDB resolution happening, so free text here can only ever match keywords that already
  exist among your tracked series (same universe as the checkboxes, just typed instead of clicked). Still removes the
  "scroll a big checkbox list" friction, but doesn't unlock discovering anything new the way it does on the
  Recommendations page. Worth deciding whether this one is worth doing for consistency, or whether the two controls
  should intentionally diverge (checkbox+search-to-filter for the list, free-text+TMDB-resolve for Recommendations).
- **Relevant specs**: `frontend_spec_011_recommendation_controls.md` (Recommendations keyword field, today's `AC-14`–
  `AC-18`), `frontend_spec_024_keyword_tracking.md` (list-page keyword picker, today's `AC-20`–`AC-24`).

**Decision (2026-08-24 follow-up)**: Recommendations-page-only free text is fine and logical — no change to the
List page's checkbox+search behavior. Matches the two-cases split above: the List page can't unlock discovering new
keywords the way Recommendations can (no TMDB resolution against tracked-only data), so diverging behavior between
the two controls is the intentional, correct outcome rather than a gap to reconcile.

---

## 3. "Popular Right Now" — more windows than day/week?

**Idea**: month, year, in addition to day/week.

**Quick analysis**: TMDB's actual `/trending/tv/{time_window}` endpoint **only accepts `day` or `week`** — this isn't a
gap in what we built, it's the real API's actual constraint (confirmed during today's live verification of
`series_spec_022`). There's no native "trending this month/year." A longer window would have to be *approximated*
differently, e.g. `discover/tv` sorted by `popularity.desc` filtered to a `first_air_date.gte`/`air_date.gte` range — a
different, custom-built mechanism, not an extension of the existing trending call. Worth deciding tomorrow whether that
approximation is worth building, or whether day/week is simply the honest scope of "trending" and a month/year option
should instead just be reframed as a different Highest-Rated-style discover query (recent + popular, not "trending" in
TMDB's sense).

**Relevant spec**: `series_spec_022_trending_and_top_rated_recommendations.md`.

**Decision (2026-08-24 follow-up)**: keep day/week as-is (honest scope of "trending"), no month/year approximation
being built. Instead, look at other `discover/tv` filtering this app doesn't already use for something useful —
noted alongside item 4 below, since both touch `TmdbClient.discover()`'s query params. Confirmed `discover()`
currently only ever sends `with_genres`/`with_keywords` (plus `discoverTopRated()`'s own
`sort_by`/`vote_count.gte`) — worth a joint pass over what else `discover/tv` exposes (e.g. `first_air_date.gte/lte`,
`with_original_language`, `without_genres`/`without_keywords` per item 4, `with_status`) before writing new specs,
rather than deciding params one idea at a time.

---

## 4. "Highest Rated" — default min vote count to 1,000

**Idea**: current default is 20 (confirmed — `series_spec_022`, reusing the existing shared `minVoteCount` param).

**Quick analysis**: simple value change, but `minVoteCount` is currently a single shared param/default across every
sourcing mode (Automatic/Specific/Genre/Highest Rated) — it isn't mode-scoped today. Need to decide: bump the global
default to 1,000 (affects other modes too, may over-filter Automatic/Genre results which don't need as high a bar), or
make the default mode-aware (Highest Rated defaults to 1,000, everything else keeps 20). The mode-aware version is a
slightly bigger change (frontend needs to swap the default when the mode radio changes, backend already accepts any
value so no backend change either way).

**Relevant specs**: `series_spec_022_trending_and_top_rated_recommendations.md` (backend default),
`frontend_spec_027_trending_and_top_rated_controls.md` / `frontend_spec_011_recommendation_controls.md` (frontend
default wiring).

**Decision (2026-08-24 follow-up)**: 20 confirmed too low (niche/low-signal results) — default to **200**, not
1,000. Also confirmed genre/keyword exclusion is real and cheap to add: `without_genres`/`without_keywords` are
real `discover/tv` params, and `TmdbClient.discover()` doesn't send either today — extending it is a straightforward
signature change (two more optional `List<Integer>` params alongside the existing `genreIds`/`keywordIds`), not a new
TMDB integration. Still open: mode-aware (200 for Highest Rated only) vs. global default — lean mode-aware given the
scratch note's own concern about over-filtering Automatic/Genre, but not fully decided; write the spec with both
options laid out for a final call.

---

## 5. Does "Sort By" (Best Match / Most Recommended) do anything for Trending / Highest Rated (or other modes)?

**Quick analysis**: Per today's actual implementation (`series_spec_022`) —

- **Trending mode explicitly skips ranking/diversity-cap entirely** and preserves TMDB's own order. So **Best Match /
  Most Recommended currently has zero effect under Trending** — the sort radio is shown but does nothing. This is a
  real, confirmed no-op, not a guess.
- **Highest Rated mode goes through the normal ranking/diversity-cap pipeline** like every other mode, so the sort
  control *does* do something there — but "Most Recommended" (`recommendationCount`, i.e. how many of your tracked
  series independently pointed at this candidate) is a concept that only makes sense when recommendations are being
  *sourced from* your tracked list (Automatic/Specific/Genre modes' "because you watched X" mechanism).
  Trending/Highest-Rated results aren't sourced from your list at all — there's no "recommended by N of your shows"
  signal for them, so "Most Recommended" sort likely produces a meaningless/flat ordering (probably everything tied at
  `totalSourceCount: 0`).
- **Worth checking tomorrow**: whether the same question applies to any of the pre-existing modes too (the idea says
  "same on other tabs") — e.g. does "Best Match" mean anything under plain "Automatic" the same way it does for
  "Specific Series"? That needs a read of `series_spec_006_recommendations.md`/
  `series_spec_007_recommendation_sourcing.md`'s scoring definition to confirm scope, not assumed here.
- **Likely fix shape**: hide/replace the Sort By control for Trending (nothing to sort by other than TMDB's own order —
  or offer TMDB-native alternatives like "Most Popular"/"Newest" if that data's on hand), and for Highest Rated consider
  whether "sort by vote average" (already the query's own `sort_by`) is a more honest default than "Best Match."

**Relevant specs**: `series_spec_022_trending_and_top_rated_recommendations.md`,
`frontend_spec_027_trending_and_top_rated_controls.md`, and possibly `series_spec_006_recommendations.md`/
`series_spec_007_recommendation_sourcing.md` if the "other tabs" question turns out to be real.

**Follow-up (2026-08-24) — read `RecommendationService.recommend()` directly (lines ~126-176) to settle the "other
tabs" question**:

- **Only Trending explicitly bypasses scoring** — `if (trendingMode) { ...return...}` short-circuits before the
  `score()` / `resolveSortComparator()` / diversity-cap pipeline ever runs. Confirmed true no-op.
- **Automatic, Specific, Genre, and Highest Rated all run through `score()` + sort + diversity-cap** — so Sort By
  is *not* a no-op on those tabs mechanically. "Best Match" means the same thing on all of them (the shared relevance
  score).
- **But Highest Rated has the same practical symptom as Trending anyway**, just for a different reason: "Most
  Recommended" sorts by `totalSourceCount` (how many tracked shows independently pointed at this candidate).
  Highest Rated's candidates come from `discover/tv?sort_by=vote_average.desc`, not from the tracked list — they were
  never "recommended by" anything — so `totalSourceCount` is `0` for every candidate there, meaning the sort
  *executes* but produces a flat, meaningless order in practice.
- Frontend confirms the control renders unconditionally across all 5 modes — `RecommendationControls.tsx`'s
  `sortByFieldset` has no mode gating today.

**Fix shape, resolved**: hide the Sort By control entirely for Trending (true no-op, nothing to offer instead —
TMDB's own popularity order is already the only ordering that exists). For Highest Rated, keep the control but swap
"Most Recommended" for something honest, e.g. **"Vote Average"** (which is literally the query's own
`sort_by=vote_average.desc` already) — "Best Match" stays meaningful there since it's the same relevance scoring as
Automatic. No gap found on Automatic/Specific/Genre — "Best Match" and "Most Recommended" both do real work there
since those modes' candidates genuinely come from the tracked list.

---

## 6. Series list keyword filter — still doesn't look great expanded, need better display options

**Context**: today's fix (`frontend_spec_024` Requirement 7) made it a collapsed-by-default, bounded
(`max-height: 10rem`, scrollable) checkbox list. Still not landing well visually per the user's live look.

**Quick options to consider tomorrow** (not decided, just laid out):

- **(a) Type-to-filter search box above the checkbox list** — narrows a long vocabulary without scrolling; doesn't
  change the underlying checkbox mechanism, just makes finding a keyword in it faster. Pairs naturally with idea #2
  above if that free-text work happens too — could plausibly become the *same* control.
- **(b) Chip/tag combobox** — selected keywords shown as removable chips, with a type-ahead dropdown for adding more
  (closer to a modern multi-select UX than a raw checkbox list). Bigger UI lift; would be a new shared component,
  possibly worth building once and reusing on both the list-page filter and the Recommendations keyword field.
- **(c) Just a smaller/denser checkbox layout** (multi-column instead of single-column list) — cheapest change, doesn't
  address "hard to find a specific one in a big list," only addresses raw vertical space.
- Given idea #2 already puts free-text search for keywords on the table for both surfaces, **(a) or (b) might end up
  being the actual resolution to both ideas at once** — worth explicitly deciding whether #2 and #6 should be spec'd as
  one combined change rather than two.

**Relevant spec**: `frontend_spec_024_keyword_tracking.md`.

**Decision (2026-08-24 follow-up)**: go with a combo of **(a) + (b)** — type-to-filter search *and* removable chips,
with keyword clicks opening a modal for the fuller browse/manage view rather than trying to fit a large vocabulary
into the existing inline area.

Checked whether TMDB itself has a "browse all keywords" concept to mirror: it doesn't. There's no `/keyword/list` or
curated taxonomy endpoint (unlike genres, which do have `/genre/tv/list` — a small fixed vocabulary). The only
TMDB-native mechanism is exactly `GET /search/keyword`, a type-ahead search — which is also what
themoviedb.org's own discover-filter UI uses. So (a)/(b) isn't just a good UX call here, it's the same pattern TMDB
uses for the same problem. The modal is a genuine addition beyond what TMDB itself needs, though — TMDB never has to
show keywords aggregated across a whole personal collection (that's this app's own `KeywordStatsService`/
`GET /series/keywords`), so there's no existing TMDB pattern to borrow for that specific part.

Confirms item 2 and item 6 should likely be **one combined spec**: a shared searchable-keyword-picker component
(search box + chips) reused on both the Recommendations keyword field and the List-page filter, with the List-page
version additionally getting the modal for its bigger aggregated vocabulary.

---

## Open questions to resolve before writing specs

Resolved in the 2026-08-24 follow-up review (see each item's own "Decision"/"Follow-up" note above):

1. ~~Item 1: which lazy/capped/skip strategy?~~ → **(b)**, lazy per-card fetch. Plus a new AC: persist TMDB
   `overview` on `SeriesEntity`/`SeriesDto` (populate at create/refresh, same call already made for
   `tmdbRating`/`productionStatus`/`originCountry` — zero extra TMDB calls), surfaced on `SeriesDetail`.
2. ~~Item 2 vs Item 6: one combined spec or two?~~ → **one combined spec** — shared searchable-keyword-picker
   (search + chips) on both surfaces, List-page variant also gets a modal for the bigger aggregated vocabulary.
3. ~~Item 3: build a month/year approximation, or leave trending scoped to day/week?~~ → **leave as day/week**;
   instead do a joint pass over other unused `discover/tv` params (ties into item 4's exclusion params).
4. ~~Item 4: global default bump or mode-aware default?~~ → default bumps to **200** (not 1,000); mode-aware
   vs. global still slightly open, lean mode-aware — write spec with both laid out. Genre/keyword exclusion via
   `without_genres`/`without_keywords` confirmed feasible, straightforward extension of `TmdbClient.discover()`.
5. ~~Item 5: confirm whether other tabs have a real Sort-By gap too~~ → confirmed via code: **only Trending is a
   true no-op**; Automatic/Specific/Genre/Highest-Rated all run real scoring, but Highest Rated's "Most Recommended"
   is practically meaningless (`totalSourceCount` always 0 there) even though it executes. Fix: hide Sort By for
   Trending, relabel "Most Recommended" → "Vote Average" for Highest Rated, no change needed for
   Automatic/Specific/Genre.

None outstanding — all six items are ready to become spec changes.
