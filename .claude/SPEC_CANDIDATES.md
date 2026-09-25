# Spec Candidates

**Pipeline**: `.claude/ideas/future_ideas.md` (raw, unconfirmed ideas) → **this file** (confirmed
worth a real spec eventually, not yet written) → a real spec exists and is tracked in
`ROADMAP.md` (delivered, or specced-and-coming-soon) → implemented → `CHANGELOG.md` (shipped
version entry).

A running backlog of ideas confirmed worth a real EARS spec eventually, but not yet written or
scheduled. Distinct from `ROADMAP.md`, which only tracks specs that already exist (written, with
real acceptance criteria) — this file is the layer _before_ that: things worth specifying, once
prioritized.

**Maintenance rule**: when a candidate here actually gets spec'd (via the `ears-spec` skill), move
it out of this file and add a row to `ROADMAP.md`'s "Specced, coming soon" table as part of that
same change — don't leave it duplicated in both places. Before adding a new candidate or touching
this file, re-check existing entries against the current codebase — referenced classes/components
may have moved since the note was written (see `.claude/ideas/future_ideas.md`'s own maintenance
rule for why this matters in practice).

Last updated: 2026-09-25 (added a candidate for extending `RecommendationPoolCache`'s TMDB-sourcing
cache to Discover's three sourcing modes, and the "Use My Series" step-by-step wizard candidate,
moved here from `.claude/ideas/future_ideas.md` — see each candidate for context). Previous update: 2026-09-05
("Exclude Keywords" filter candidate closed — spec'd as part of
`frontend_spec_094_recommendations_page_polish.md`, see `ROADMAP.md`). (`.claude/OUTSTANDING_SPECS.md`, formerly this file's counterpart for
already-written specs, was retired on 2026-08-27 — its tracking role now lives in `ROADMAP.md`.)

Last full review against the codebase: 2026-09-07 — all 5 candidates below re-checked against the
current code (scoring service, recommendation controllers/services, `frontend/src/components/`);
none has been delivered or spec'd since the last update, no changes needed.

2026-09-09 update: broadened the existing "Info/disclosure boxes" candidate to cover three
Settings fields (Skip Threshold Override, Filter Profiles, Watch Region), and added four new
candidates from a live-app pass — Recommendation Favourites divider gap, additional Appearance
color schemes, extending saved filter profiles to Custom Search + Analysis filters, and a
per-mode description line for each Discover sub-tab. A fifth item from the same pass ("Custom
Search/Popular Right Now/Highest Rated should also be sticky") was noted as "confirmed already
fully delivered" via `frontend_spec_106_sticky_discover_mode.md` — **this was wrong**, caught
2026-09-11 when the user asked for it directly and it turned out not to be built: `frontend_spec_106`
is about the app remembering the last-used Discover sub-tab across page loads (`localStorage`), a
different meaning of "sticky" than CSS `position: sticky` (staying pinned while scrolling), which
the actual CSS confirmed `.tablistNested` never had. Spec'd and delivered for real as
`frontend_spec_121_sticky_discover_subtabs.md`.

2026-09-09 update (same day, later): the Appearance color-schemes and Discover-description-line
candidates above were spec'd — `frontend_spec_110_appearance_color_schemes.md` and
`frontend_spec_111_discover_mode_description_lines.md`, both tracked in `ROADMAP.md`'s "Specced,
coming soon" table now — and removed from this file per this file's own maintenance rule.

2026-09-09 update (same day, later still): the Recommendation Favourites divider-gap candidate was
folded into `frontend_spec_110` as a small extra AC (Requirement 4) rather than getting its own
spec, since that spec already touches the same `SettingsPage.tsx`/`.module.css` files — also
removed from this file. The "extending saved filter profiles" candidate was spec'd as a pair —
`series_spec_057_filter_profile_new_areas.md` (backend, two new `FilterProfileArea` enum values)
and `frontend_spec_112_filter_profiles_custom_search_and_analysis.md` (frontend, wiring both new
areas) — both now tracked in `ROADMAP.md`, removed from here.

2026-09-10 update: the "Number input spinner styling" and "Incremental dedup/output-filtering for
`RecommendationSourcingService`'s backfill loop" candidates were spec'd
(`frontend_spec_115_number_input_spinner_styling.md`, `series_spec_059_incremental_backfill_dedup.md`)
and removed from this file — both now tracked in `ROADMAP.md`'s "Specced, coming soon" table. Only
the broadened Settings info/disclosure-box candidate remains open in this file.

---

## Candidates

### Weight recommendation scoring and/or output filters by keyword popularity/average personal rating

Moved from `.claude/ideas/future_ideas.md` on 2026-08-27, per the user's own request ahead of a planned analysis
pass — not yet designed, just confirmed still relevant and worth a spec eventually.

`series_spec_019_keyword_tracking.md`'s aggregate stats endpoint (`GET /api/v1/series/keywords`) already exists and
is delivered — for each keyword across your tracked series, it reports `seriesCount` and `averagePersonalRating`.
**Update (2026-09-24)**: `series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md` (delivered since this
candidate was written) added a third field, `averageBlendedRating` — the unweighted average of a keyword's carrying
series' IMDb/TMDB ratings — and the backing DTO was renamed from `KeywordStatDto` to a now-shared `NameStatDto`
(also backs `GET /api/v1/series/genres/stats` and `GET /api/v1/series/origin-country/stats`). Whoever designs this
should weigh `averageBlendedRating` alongside `averagePersonalRating` as a candidate signal — it didn't exist when
this candidate was first drafted. Re-confirmed via reading the current code (2026-09-24) that none of this feeds
into recommendation scoring or filtering — still true: `RecommendationRankingService.score()` computes `rankScore` purely from `tmdbRating` (TMDB's own
`voteAverage`) and the best contributing source series' `personalRating`, blended 50/50
(`(tmdbRating * 0.5) + (personalRatingTerm * 0.5)`, `RecommendationRankingService.java`) — a candidate's own
keywords never enter that formula. Likewise, `RecommendationOutputFilterService.applyOutputFilters` has no keyword-
popularity or keyword-average-rating filter; `excludeKeywords` (`series_spec_024`) only _excludes_ by keyword name,
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
  own `tmdbRating`, and the _single best_ contributing source series' `personalRating` (rescaled
  ×2). The source's own `imdbRating`/`tmdbRating` never enter the formula at all.
- Only the highest-personal-rated source counts toward the score when a candidate has multiple
  sources; the others currently only affect the separate "Most Recommended" sort (by
  contributing-source count), never the score itself.
- `SourceOrderComparator` (personal rating desc, then date completed desc) is hardcoded and does
  double duty: it decides both which of your shows get queried at all (before the
  `maxSourceSeries` cap) and, for multi-source candidates, whose rating wins for scoring.
- **Updated 2026-09-03**: there is no backend source-pool filter at all anymore — `minSourceRating`
  (the only one that ever existed) was retired entirely (`series_spec_045`), since it could
  silently drop an explicitly hand-picked series. `frontend_spec_081`'s "Filter & sort my series"
  section reintroduced a personal-rating (and genre/keyword/IMDb/TMDB-rating/year) filter, but
  deliberately as a **client-side-only picker-narrowing aid** — it never reaches the backend, so
  it doesn't satisfy this item's "filter the source pool server-side" framing. Item #9 below is
  still fully open.
- Each source show's TMDB call (`/recommendations`, falling back to `/similar`) returns TMDB's
  first page only — up to TMDB's own page size (~20) per source, uncapped by this app, no
  pagination ever requested. **This is a separate number from `maxSourceSeries`** (default 20, how
  many of _your_ shows get queried) — coincidentally the same value today, but not to be conflated
  when this gets designed; raising one doesn't affect the other.

**Ideas to design against** (not resolved here — open questions for the actual spec):

1. Add the source show's own `imdbRating`/`tmdbRating` as additional scoring terms, not just its
   `personalRating`.
2. Make blend weights user-adjustable rather than hardcoded (becomes a 3+-term weighted blend once
   #1 lands).
3. Confidence-weight a source's own rating by its vote count (Bayesian/IMDb-style), so a source
   with a handful of votes doesn't count as equally "objectively good" as one with thousands.
4. Use _all_ contributing sources in the score (e.g. a weighted average), not just the single best
   one — an alternative mode to today's best-source-only behavior.
5. Normalize personal ratings against the user's own rating distribution (z-score) rather than the
   raw 1–5 value, so a "generous rater" and a "stingy rater" aren't scored identically for the same
   raw star count.
6. Genre-affinity as a first-class scoring input (aggregate "how much do I like this genre
   overall," not just today's genre-based top-up _fallback_ mechanism), separate from any single
   source show.
7. Let the user include/exclude specific sources more granularly than today's persistent
   per-series `excludeFromRecommendations` flag — e.g. ad-hoc per-request selection.
   **Note (2026-08-29)**: `series_spec_034_exclude_from_recommendations_enforcement.md` /
   `frontend_spec_050_exclude_from_recommendations_ui.md` just made the flag an *absolute* rule
   (an excluded series can no longer be used as a source even by explicit hand-picking, reversing
   the old `SERIES-008-AC-05` bypass this item's "ad-hoc per-request selection" idea depended on).
   Whoever scopes this item should treat "ad-hoc override" as a new, deliberate exception to that
   absolute rule if it's still wanted — not something that falls naturally out of the old, now-gone
   bypass.
8. Configurable source-query order (today hardcoded via `SourceOrderComparator`) — and whether
   reordering should also decouple "query order" from "which source wins the score tiebreak,"
   since one comparator currently does both jobs.
9. Additional filters on the _source_ pool itself (genre, year, status), distinct from the
   existing output filters applied to candidates.
10. Restrict/expand how many raw candidates a single source can contribute — either an explicit
    app-side cap, or requesting additional TMDB pages (pagination) for heavily-weighted sources,
    rather than being silently bound by TMDB's own first-page size.
    **Update (2026-09-08)**: `series_spec_054_recommendation_discover_backfill_pagination.md`
    (delivered) added this same kind of TMDB-page backfill, but only for the three direct-TMDB-
    discover sourcing modes (trending/topRated/Custom Search) — "Use My Series" (`sourceFromPool`,
    the mode this item #10 is actually about) is explicitly untouched by that spec, deferred here
    for the reasons already stated above. This item stays fully open.
    **Update (2026-09-08, continued)**: confirmed live (post-delivery) that `SeriesDetail`'s
    "Recommendations" button — the single-series recommendations modal reached by clicking a
    series and then "Recommendations" — is itself a `sourceFromPool` call
    (`sourceMode: 'useMySeries'`, `seriesIds: [series.id]`, `SeriesRecommendationsModal.tsx`),
    just with exactly one source series selected rather than the full pool. That makes it the
    narrowest, sharpest-edge instance of this item: a single-source `sourceFromPool` call has no
    other sources to dilute a shortfall across (the exact mitigation cited above for why
    `sourceFromPool` was deferred in the first place), so it's arguably the case most likely to
    visibly come up short from an unpaginated `/recommendations`+`/similar` call — and the one a
    user is most likely to notice, since it's reached from a prominent per-series button rather
    than a mode picker. Whoever eventually designs the `sourceFromPool` side of this item should
    treat "does a single-source call get backfilled the same way multi-source does, or does it
    need its own simpler path" as one of the first things to resolve, not an edge case to handle
    last.
11. **Saved filter/algorithm profiles.** Confirmed during this discussion: the user wants some way
    to save a chosen combination of weights/filters/source settings rather than re-entering it
    every session. Once there are this many tunable knobs, that stops being optional.
    **Update (2026-09-24)**: at the time this was written (2026-08-28), this app had no
    user-preference persistence precedent at all — that's no longer true. `series_spec_055`/`056`/
    `057` (delivered) shipped named, saved, rename/delete-managed *filter* profiles across all five
    filterable areas, backed by a real `FilterProfile` entity/endpoint
    (`FilterProfileController`) — a genuine "save this configuration" pattern now exists in this
    codebase. Whoever designs *this* item (algorithm/weight profiles, distinct from filter
    criteria) should start by checking whether that same entity/endpoint shape can be reused or
    extended, rather than assuming a new `recommendation_profile` entity must be designed from
    scratch — the foundational "is there a save/load precedent" question this item originally
    flagged as open is now answered; what's still open is only whether *this* data (weights, not
    filter criteria) fits the same shape. See `.claude/ideas/future_ideas.md`'s "Saved algorithm
    profiles" entry, which already tracks this same correction.

**Cross-reference**: overlaps significantly with the existing "Weight recommendation scoring...by
keyword popularity/average personal rating" candidate above — both touch
`RecommendationRankingService`'s scoring formula directly and should likely be designed together
rather than layered on separately, per that candidate's own note about the same risk.

### Extend `RecommendationPoolCache`'s TMDB-sourcing cache to the three Discover sourcing modes

Raised 2026-09-25 while explaining to the user, ahead of `frontend_spec_134`'s two-sheet redesign,
whether re-applying "Recommendations Filters" (a post-sourcing output filter) re-hits TMDB or reuses
a stored result. Confirmed via reading the code: it depends entirely on `sourceMode`.

**"Use My Series" (`sourceFromPool`) already has this solved.** `RecommendationPoolCache`
(`service/recommendation/RecommendationPoolCache.java`) is a small, dependency-free, TTL-bound
(`app.recommendations.pool-cache-ttl-minutes`, default 10) and capacity-bound (`app.recommendations
.pool-cache-max-entries`, default 50) `ConcurrentHashMap` wrapper around `RecommendationSourcingService
.sourceFromPool`'s TMDB calls. Its key, `PoolCacheKey(seriesIds, limit)`, deliberately excludes
`sortBy`/`excludeGenres`/`excludeKeywords`/`minTmdbRating`/etc — per that record's own doc comment,
because those are "applied strictly after sourcing" in `RecommendationService.doRecommend`'s
pipeline. Practical effect: changing only a "Recommendations Filters" field and re-clicking "Get
Recommendations" (same selected series, same limit) hits the cache — no new TMDB calls, just
re-filtering/re-ranking in memory, for up to 10 minutes.

**The other three sourcing modes have no equivalent cache at all.** `sourceTrending`/`sourceTopRated`/
`sourceByGenreOrKeyword` (Discover's three sub-tabs) all route through `RecommendationSourcingService
.sourceWithBackfill`, which dedupes and applies output filters to each TMDB page *inline* as it
paginates/backfills (confirmed no separate raw-pool step exists to cache, unlike `sourceFromPool`'s
two-stage raw-then-filter shape). Consequence: for these three modes, changing any output filter and
re-requesting always re-hits TMDB from scratch, even when nothing about the *source* query (genre/
keyword/trending window) changed — there's no 10-minute cache window softening that the way there is
for "Use My Series."

**Not a correctness gap, a performance/API-quota one.** Every mode already returns correct results
today; this is purely about redundant TMDB call volume when a user is iterating on output filters
within the Discover tabs. Worth being explicit that this is a nicety, not a bug, when scoping.

**Open questions for whoever designs this**:
- Can `sourceWithBackfill`'s inline dedupe/filter-per-page shape be restructured to cache a raw,
  pre-filter page set (mirroring `sourceFromPool`'s split), or does backfill's page-by-page early-stop
  logic (stopping once `limit` is reached) make a clean raw/filtered separation harder here than it
  was for `sourceFromPool`?
- Cache key equivalent to `PoolCacheKey` for these three modes — likely needs to include the
  mode-specific source query params (genre/keyword ids, trending window, `discoverSortBy`) alongside
  `limit`, since (unlike `sourceFromPool`'s `seriesIds`) there's no single natural key field.
- Whether the existing `RecommendationPoolCache` component can be generalized/reused (different value
  type, same TTL/capacity-eviction mechanics) or whether a second, mode-specific cache makes more
  sense given the different pagination shape.

**Status**: Not specced. Low priority — performance nicety, not a correctness or UX gap.

### Real-time (live) filtering for the rest of `SearchFilter`'s fields, matching Title's existing debounce

Raised 2026-09-03 alongside a browser walkthrough of `frontend_spec_074`. Confirmed via reading the
code: `SearchFilter` today only fires a backend `/search` call on explicit form submission (the
"Search" button) — every field (Genres, Keywords, ratings, years) is gathered into one
`SearchCriteria` and sent as a single request. The one exception is My Series' Title box
(`frontend_spec_073`), which already debounces 350ms and fires the same backend `/search` call live
as the user types — there is no client-side filtering of a full in-memory list anywhere in this app;
`SeriesSearchService` always filters server-side over every series in SQLite per request
(`series_spec_003`, "fine at this app's scale, revisit if it becomes a bottleneck"). Extending
real-time behavior to the rest of the sheet would follow that same debounced-call pattern, not a new
architecture — the backend load at this app's scale is not a real concern.

**Open question, deliberately left unresolved** (parked rather than designed, per 2026-09-03
discussion): whether every field should go fully live, or only some. The genuine tradeoff is that
click-to-select fields (Genre/Keyword pickers) produce a meaningful search on every change, but
free-typed numeric fields (Min IMDb/TMDB Rating, Year Min/Max) don't — going live on every keystroke
would fire a search against implausible partial values (e.g. "1" → "19" → "199" → "1999" while typing
a year), unlike Title where a partial substring match is still meaningful. Whoever scopes this should
decide, field by field, whether it goes live immediately, live-on-blur, or stays gated behind the
explicit Search button — not necessarily uniform treatment across the whole sheet.

**Status**: Spec candidate, not yet designed. No field-by-field behavior decided — see the open
question above.

### "Use My Series" / Recommendations page as a step-by-step wizard, for first-time-user guidance

Moved here from `.claude/ideas/future_ideas.md` on 2026-09-25, per the user's own request. Originally
raised 2026-09-03 while planning the "Use My Series" page restructure (filter/select/post-filter/
sort/apply): whether the page's several sections should be a single scrolling page or built up
step-by-step, checkout-style (fill in address, then payment). Deliberately not pursued at the time —
nothing in this flow has a genuine server-side dependency gating the next step the way a checkout
does, every field stays in client-side `ControlsState` until one single "Get Recommendations" submit,
and this app had (and still has) no wizard precedent anywhere. A wizard would also punish the likely
real workflow of filtering, glancing at picker results, then going back to loosen an earlier filter.
The single-page-with-collapsible-sections approach was chosen instead, with an explicit note to
revisit if it ever felt cluttered in practice.

**Why this is being kept as a live candidate now rather than dropped**: as of 2026-09-25, the page
has grown enough disclosures (Filter My Series / Source Ranking Strategy / Recommendations Filters,
soon two of those becoming their own slide-out sheets per the just-written
`frontend_spec_1XX_recommendation_filter_sheets.md`) that the user flagged it's "becoming busy" and
raised the concern that a first-time user might need guiding through it, not just an experienced user
who already knows which fields matter to them. The two-sheet redesign is the immediate answer to
"too much on screen at once"; a wizard would instead answer a different problem — "I don't know what
order to do these things in or what each one means" — which sheets alone don't solve.

**Deliberately queued behind the two-sheet redesign, not run in parallel with it**: revisit once
`frontend_spec_1XX_recommendation_filter_sheets.md` has shipped and there's a real, current page to
evaluate against — building a guided wizard on top of a panel layout that's about to be restructured
would mean redoing the wizard's own step boundaries once the sheets land anyway. When picked up, the
original blocking reasoning above (no server-side step-gating, no existing wizard precedent, the
filter/glance/adjust-again workflow) still needs weighing against the new first-time-user-guidance
motivation — this isn't a reversal of that reasoning, it's a different problem the original
reasoning didn't consider. Whoever scopes this should also decide whether "wizard" still means a
literal forced linear flow, or something lighter (e.g. an optional first-run guided tour/tooltip
sequence layered over the existing single-page sheet layout, touching fewer of the original
objections) — both readings are plausible and neither has been chosen yet.

**Status**: Spec candidate, not yet designed. Blocked on the two-sheet redesign shipping first.

### Full-codebase manual accessibility review

Raised 2026-08-29. Distinct from what's already in place: `eslint-plugin-jsx-a11y` (CI-gated,
`tooling_spec_001` `TOOLING-001-AC-11/12`) catches static JSX-level violations, and `@axe-core/react`
(gated on `import.meta.env.DEV`, per `RUNBOOK.md`) runtime-scans whatever's actually rendered during
manual dev-server testing — but neither is exhaustive. Static lint can't catch runtime-only issues
(computed contrast in a specific theme, focus order across a multi-step flow); axe's runtime scan
only covers states/pages someone actually visited while it was running, and neither tool evaluates
the *experience* of using the app with a screen reader or keyboard-only, only DOM-level correctness.
Individual specs have addressed specific gaps as found (`frontend_spec_008`'s nested-interactive-
controls fix; this session's icon-button `aria-label`/contrast/target-size additions to
`frontend_spec_054`) — this candidate is a deliberate, holistic pass rather than more one-off fixes
as they're individually noticed.

**Update (2026-09-08)**: `frontend_spec_103_button_styling_consistency.md` (specced, not yet built)
addresses one specific facet of the "color contrast across every component" bullet below — the
outline/secondary button tier's border failing WCAG 1.4.11's 3:1 non-text-contrast minimum in both
themes — with a new `--control-border` token. It does not touch any other component's contrast, and
doesn't cover keyboard nav, screen readers, or focus management below; this candidate's remaining
scope is unchanged.

**Confirmed scope this candidate would need to cover, not yet audited systematically**:
- Keyboard-only navigation through complete multi-step flows (not just individual components) —
  e.g. Add Series end-to-end, editing and saving a series, completing a recommendation's Add-to-List
  flow, all without a mouse.
- Screen reader testing (NVDA/VoiceOver at minimum) for the actual announced experience — DOM
  correctness (what `jsx-a11y`/axe check) doesn't guarantee a coherent spoken experience.
- Color contrast across every component in **both** light and dark themes (`prefers-color-scheme`)
  — axe's dev-mode scan only ever ran in whichever theme the developer's OS/browser happened to be
  in at the time, not both, for every page.
- Focus management around this app's dialogs — confirmed (2026-08-29, while researching `frontend_
  spec_052`) that every modal in this codebase (`SearchFilter`'s "Browse Keywords",
  `RecommendationControls`' "Browse Series", etc.) is a deliberately minimal hand-rolled `role=
  "dialog"` with Escape-to-dismiss only, **no focus trap and no focus-return-on-close** — a
  documented, deliberate choice in each spec's Design Decisions (avoiding `<dialog>`'s
  showModal()/close() lifecycle complexity), but never evaluated as a *pattern* across every dialog
  at once for whether that tradeoff still holds as more dialogs have accumulated.
  **Update (2026-09-04)**: live-reproduced the concrete failure mode this causes, while manually
  verifying `frontend_spec_043` (discard-unsaved-changes confirm dialog) in a real browser. The
  mechanism is broader than just "modal closes without returning focus": *any* click on a button
  that removes the currently-focused element from the DOM — while the dialog itself stays mounted —
  reverts `document.activeElement` to `document.body`. Since each dialog's Escape handler is a plain
  `onKeyDown` on the dialog's own root div (not a document-level listener), a keydown whose target is
  `body` never bubbles into it, so Escape silently does nothing until the user manually clicks or
  tabs back inside. Confirmed concretely: `AddSeriesForm`/`EditSeriesForm`'s new `ConfirmDialog`
  (spec 043) goes Escape-inert after clicking "Keep Editing"; the identical shape exists in
  `SearchFilter`'s "Browse Keywords" modal (`Done` button) and `UseMySeriesPanel`'s two "Browse..."
  modals (`Done`/close buttons) — not yet individually re-verified instance-by-instance beyond these,
  since the full audit above is this candidate's natural home for that. Always fails safe (Escape
  becomes inert, never closes/discards the wrong thing) — no data loss in any observed case. One
  precedent already exists in this codebase for the fix: `SearchFilter`'s own sheet-*open* transition
  (`FRONTEND-071-AC-05`) already solves the identical problem for its own case via a `useEffect` that
  programmatically `.focus()`s a ref'd element on the relevant open/close transition — a future fix
  spec should generalize that same pattern (e.g. a shared hook that refocuses a dialog's root/first
  element whenever a child it contains unmounts) rather than re-deriving a new approach.
- Heading hierarchy and skip-link presence across full pages, not per-component.
- Touch/click target sizing (WCAG 2.5.8) app-wide, not just the one instance flagged during
  `frontend_spec_054`'s icon-button design.
- **Update (2026-09-10)**: `frontend_spec_115_number_input_spinner_styling.md`'s new shared
  `NumberInput` component (delivered) gives every numeric field's increment/decrement buttons a
  deliberately generic `aria-label` ("Increase"/"Decrease", not "Increase {field name}") — see
  `components/NumberInput.tsx`'s own inline comment. Reason: embedding the field name would make
  the button match the same unanchored `getByLabelText(/field name/i)` regex this app's existing
  tests already use for the *input* itself across all 27 migrated call sites, which RTL treats as
  an ambiguous multi-match. The consequence: a screen-reader user tabbing through a page with
  several `NumberInput`s (e.g. `UseMySeriesPanel`'s Year Min/Max, or `RecommendationFiltersBox`'s
  four rating/year fields) hears an unnumbered, indistinguishable "Increase, button" / "Decrease,
  button" at every one of them, with no way to tell which field a given pair belongs to purely by
  ear — a real regression from the native spinner it replaced, which was always scoped to its own
  input. Not fixed as part of that spec (out of scope, no AC required it); a real fix needs
  disambiguating the buttons' accessible names *without* colliding with the existing test query
  pattern above — e.g. retargeting the affected tests to scope their queries (`within()`) or match
  by `role`+more specific text instead of a bare unanchored label regex — which is real,
  cross-cutting test-suite work, not a one-line component change. Natural fit for this audit's
  scope rather than a standalone fix.

**Status**: Spec candidate, not yet a real spec. Open questions before scoping one:
1. Audit-only (a findings report feeding follow-up fix specs, the way `tooling_spec_001`'s Sonar
   pass worked) vs. audit-and-fix-inline (one large spec doing both) — this project's own
   `sonar-cleanup` skill precedent favors the former for a review of this breadth.
2. Whether to formalize a WCAG conformance target (e.g. "AA") this app commits to going forward, or
   keep the current ad hoc "fix what's found" posture.
3. Whether the no-focus-trap dialog pattern above should be revisited as part of this audit or
   treated as an accepted, already-decided tradeoff each dialog's own spec already signed off on.

