# Spec Candidates

**Pipeline**: `.claude/ideas/future_ideas.md` (raw, unconfirmed ideas) → **this file** (confirmed
worth a real spec eventually, not yet written) → a real spec exists and is tracked in
`ROADMAP.md` (delivered, or specced-and-coming-soon) → implemented → `CHANGELOG.md` (shipped
version entry).

A running backlog of ideas confirmed worth a real EARS spec eventually, but not yet written or
scheduled. Distinct from `ROADMAP.md`, which only tracks specs that already exist (written, with
real acceptance criteria) — this file is the layer *before* that: things worth specifying, once
prioritized.

**Maintenance rule**: when a candidate here actually gets spec'd (via the `ears-spec` skill), move
it out of this file and add a row to `ROADMAP.md`'s "Specced, coming soon" table as part of that
same change — don't leave it duplicated in both places. Before adding a new candidate or touching
this file, re-check existing entries against the current codebase — referenced classes/components
may have moved since the note was written (see `.claude/ideas/future_ideas.md`'s own maintenance
rule for why this matters in practice).

Last updated: 2026-08-28. (`.claude/OUTSTANDING_SPECS.md`, formerly this file's counterpart for
already-written specs, was retired on 2026-08-27 — its tracking role now lives in `ROADMAP.md`.)

---

## Candidates

### Country-of-origin and language recommendation filters, with chip UI
From a 2026-08-26 discussion. `RecommendationOutputFilterService` already has a working
`language` filter (`matchesLanguage`, direct case-insensitive match against TMDB's
`original_language` — confirmed via reading the code, not assumed) — it works exactly as
designed, but only accepts ISO 639-1 codes (`en`, `es`) with zero in-UI hint that full words
(`English`, `Spanish`) won't match. A `countries` filter doesn't exist yet at all, despite the
underlying data (`TmdbCandidate.originCountry`) already flowing through the pipeline since
`series_spec_021` — confirmed feasible by mirroring `language`'s exact existing shape
(`RecommendationCriteria` field → controller param → `RecommendationOutputFilterService` output
filter), not by touching `TmdbClient.discover()` (today's `language` filter is 100%
post-fetch/client-side, applied uniformly across every source mode — a `countries` filter should
match that, not introduce a new sourcing-level mechanism).

Frontend: chips for popular values (especially UK/US for country, English for language) with the
rest searchable — **not** a direct reuse of `KeywordPicker` as it exists today (which does
"capped suggestions when empty + type-to-search," not "some options permanently pinned
regardless of what's typed"). The "always-pinned popular chips" behavior is a genuine, small new
interaction shape to design when this gets spec'd. Once a filter is picked, values are unique
strings (country/language names), so no `{id, label}` generalization is needed — reuse
`KeywordPicker`'s existing plain `string[]` mode as the base to extend.

**Note**: for now, the "popular" chip list (UK/US, English) would be hardcoded. Making that list
user-configurable is tracked separately in `.claude/ideas/future_ideas.md`, since it depends on a
config system this app doesn't have yet.

### "Min Source Rating" → "Minimum User Rating", using `StarRating`
Currently a `<select>` dropdown (`Any`/`1`–`5`) at `RecommendationControls.tsx:557-569`. Confirmed
a clean fit for `StarRating` (`frontend_spec_013`): "click star N sets the minimum to N, click the
already-selected star again clears back to Any" maps directly onto `StarRating`'s existing
click-to-clear semantics — no new interaction shape needed, low effort.

### "Exclude Genres" filter — checkbox list instead of free text
Currently a plain comma-separated text input (`excludeGenresText`, parsed via `parseCommaList`).
The existing "Genres" (include) field in Genre & Keyword mode already renders `genreOptions` (from
`seriesApi.getGenreOptions()`) as a checkbox list, a few hundred lines away in the same file —
direct precedent to reuse for the shape.

**Before implementing**: that existing include-Genres checkbox list is hand-rolled inline JSX, not
a shared component. Adding a second near-identical block for Exclude Genres would recreate the
exact duplication pattern `tooling_spec_002`/`003`/`005` already existed to clean up elsewhere in
this codebase — extract a small shared checkbox-list component first (e.g. a generic
`CheckboxOptionList` over a `string[]`), then use it for both include and exclude, rather than
copy-pasting the block a second time.

### "Exclude Keywords" filter — `KeywordPicker` instead of free text
Currently also a plain comma-separated text input (`excludeKeywordsText`). The include-Keywords
field already uses `KeywordPicker` (chips + type-to-search). Unlike Exclude Genres above, this
needs **no extraction work** — `KeywordPicker` is already fully generic and reusable; this is
just a second `<KeywordPicker>` instance pointed at a different state slot
(`excludeKeywordsSelected`) and a different `RecommendationQuery` field (`excludeKeywords`,
already exists on the backend).

### Weight recommendation scoring and/or output filters by keyword popularity/average personal rating
Moved from `.claude/ideas/future_ideas.md` on 2026-08-27, per the user's own request ahead of a planned analysis
pass — not yet designed, just confirmed still relevant and worth a spec eventually.

`series_spec_019_keyword_tracking.md`'s aggregate stats endpoint (`GET /api/v1/series/keywords`) already exists and
is delivered — for each keyword across your tracked series, it reports `seriesCount` and `averagePersonalRating`.
Confirmed via reading the current code (2026-08-27) that none of this feeds into recommendation scoring or
filtering: `RecommendationRankingService.score()` computes `rankScore` purely from `tmdbRating` (TMDB's own
`voteAverage`) and the best contributing source series' `personalRating`, blended 50/50
(`(tmdbRating * 0.5) + (personalRatingTerm * 0.5)`, `RecommendationRankingService.java`) — a candidate's own
keywords never enter that formula. Likewise, `RecommendationOutputFilterService.applyOutputFilters` has no keyword-
popularity or keyword-average-rating filter; `excludeKeywords` (`series_spec_024`) only *excludes* by keyword name,
it doesn't weight by one.

**Explicitly flagged as out of scope when `series_spec_019` was written**: "The idea of feeding this data into
`RecommendationService`'s scoring... is a natural next step but a materially larger design decision (how much
weight, interaction with the existing personal-rating/TMDB-rating blend) that deserves its own spec once there's
real usage data" — that's exactly the design work this candidate is waiting on.

**Real open questions for whoever writes this spec** (not resolved here, deliberately — this is a candidate note,
not a design doc):
- Does this become a third term in the existing scoring blend (currently 50% TMDB rating / 50% personal rating), or
  a separate multiplier/boost applied after that blend?
- A keyword's `averagePersonalRating` is only meaningful once enough tracked series carry it — does a low-
  `seriesCount` keyword get down-weighted or excluded from influencing the score at all, to avoid one or two
  high/low ratings skewing things?
- A candidate can carry many keywords (each with its own stats) — does the score use the single most-influential
  keyword, an average across all of the candidate's matched keywords, or something else?
- Interacts with the still-unresolved "recommendation ranking's personal-rating/TMDB-rating blend weight is
  hardcoded" idea (`.claude/ideas/future_ideas.md`) — both touch the same scoring formula, worth designing together
  rather than layering one on top of the other twice.

A plain-language walkthrough of the current scoring code (no design proposal yet) lives in
`.claude/analysis/scoring_weight_recommendations.md`, written 2026-08-27 ahead of picking this up.

### Customizable recommendation "algorithm" — source ratings, adjustable weights, source selection/ordering/filters, saved profiles
From a 2026-08-28 discussion, after the Genre & Keyword sourcing/filtering walkthrough
(`.claude/analysis/scoring_weight_recommendations.md`) prompted a look at what else in the
recommendation pipeline could be made user-tunable. **Deliberately queued behind other,
already-planned recommendation-area work** — not next up, just confirmed worth a spec eventually.
A broad, multi-part candidate touching `RecommendationRankingService`,
`RecommendationSourcingService`, `SourceOrderComparator`, and (new) some form of persisted user
preference — will very likely need to be split into several specs once actually scoped, not
implemented as one.

**Confirmed current behavior** (from reading the code — see
`.claude/analysis/scoring_weight_recommendations.md` Sections 1-2 for the full walkthrough):
- `RecommendationRankingService.score` blends exactly two terms, hardcoded 50/50: the candidate's
  own `tmdbRating`, and the *single best* contributing source series' `personalRating` (rescaled
  ×2). The source's own `imdbRating`/`tmdbRating` never enter the formula at all.
- Only the highest-personal-rated source counts toward the score when a candidate has multiple
  sources; the others currently only affect the separate "Most Recommended" sort (by
  contributing-source count), never the score itself.
- `SourceOrderComparator` (personal rating desc, then date completed desc) is hardcoded and does
  double duty: it decides both which of your shows get queried at all (before the
  `maxSourceSeries` cap) and, for multi-source candidates, whose rating wins for scoring.
- The only existing source-pool filter is `minSourceRating`; there's no genre/year/status filter
  on the source pool itself today, only on the resulting candidates (the output filters).
- Each source show's TMDB call (`/recommendations`, falling back to `/similar`) returns TMDB's
  first page only — up to TMDB's own page size (~20) per source, uncapped by this app, no
  pagination ever requested. **This is a separate number from `maxSourceSeries`** (default 20, how
  many of *your* shows get queried) — coincidentally the same value today, but not to be conflated
  when this gets designed; raising one doesn't affect the other.

**Ideas to design against** (not resolved here — open questions for the actual spec):
1. Add the source show's own `imdbRating`/`tmdbRating` as additional scoring terms, not just its
   `personalRating`.
2. Make blend weights user-adjustable rather than hardcoded (becomes a 3+-term weighted blend once
   #1 lands).
3. Confidence-weight a source's own rating by its vote count (Bayesian/IMDb-style), so a source
   with a handful of votes doesn't count as equally "objectively good" as one with thousands.
4. Use *all* contributing sources in the score (e.g. a weighted average), not just the single best
   one — an alternative mode to today's best-source-only behavior.
5. Normalize personal ratings against the user's own rating distribution (z-score) rather than the
   raw 1–5 value, so a "generous rater" and a "stingy rater" aren't scored identically for the same
   raw star count.
6. Genre-affinity as a first-class scoring input (aggregate "how much do I like this genre
   overall," not just today's genre-based top-up *fallback* mechanism), separate from any single
   source show.
7. Let the user include/exclude specific sources more granularly than today's persistent
   per-series `excludeFromRecommendations` flag — e.g. ad-hoc per-request selection.
8. Configurable source-query order (today hardcoded via `SourceOrderComparator`) — and whether
   reordering should also decouple "query order" from "which source wins the score tiebreak,"
   since one comparator currently does both jobs.
9. Additional filters on the *source* pool itself (genre, year, status), distinct from the
   existing output filters applied to candidates.
10. Restrict/expand how many raw candidates a single source can contribute — either an explicit
    app-side cap, or requesting additional TMDB pages (pagination) for heavily-weighted sources,
    rather than being silently bound by TMDB's own first-page size.
11. **Saved filter/algorithm profiles.** Confirmed during this discussion: the user wants some way
    to save a chosen combination of weights/filters/source settings rather than re-entering it
    every session. Once there are this many tunable knobs, that stops being optional. This app has
    no user-preference persistence precedent today at all — no settings entity, no "save this
    configuration" pattern anywhere in the codebase — so the save/load half of this is likely its
    own foundational piece of work (e.g. a new `recommendation_profile` entity/endpoint) that
    needs designing before or alongside the scoring changes themselves, not as an afterthought
    bolted onto them.

**Cross-reference**: overlaps significantly with the existing "Weight recommendation scoring...by
keyword popularity/average personal rating" candidate above — both touch
`RecommendationRankingService`'s scoring formula directly and should likely be designed together
rather than layered on separately, per that candidate's own note about the same risk.

### Info/disclosure boxes explaining Max Per Source, Max Sources Shown, and Sort By options
Confirmed via search: no tooltip/info/help component exists anywhere in this codebase today —
this is a first-of-its-kind UI primitive, not a reuse. **Recommended shape** (resolved
2026-08-26): a small disclosure button (`?`/`ⓘ` icon) next to the label, `aria-expanded`/
`aria-controls` toggling a short description directly beneath the field — not a hover tooltip
(fails outright on touch, unreliable for keyboard/screen-reader users) and not permanent
always-visible text (clutters the panel across four separate fields most of the time unasked-for).
This is the same click-to-toggle-visibility idiom already used by the "Filters" section's own
toggle button and `SearchFilter`'s "Browse all keywords" trigger — not a new pattern for this app,
just a smaller, field-scoped instance of one already in use.
