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

Last updated: 2026-08-29. (`.claude/OUTSTANDING_SPECS.md`, formerly this file's counterpart for
already-written specs, was retired on 2026-08-27 — its tracking role now lives in `ROADMAP.md`.)

---

## Candidates

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
- The only existing source-pool filter is `minSourceRating`; there's no genre/year/status filter
  on the source pool itself today, only on the resulting candidates (the output filters).
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

**Note (2026-08-29)**: Max Per Source/Max Sources Shown were confirmed dead under every Discover
mode and removed from the frontend entirely (`frontend_spec_048`, delivered) rather than hidden —
this candidate's own scope for those two fields now narrows to "Use My Series" mode only, where
they're still live.

### Share filter/sort logic between `SeriesList`/`SearchFilter` (My Series) and `RecommendationControls`' "Use My Series" mode

From a 2026-08-29 discussion. Both features filter/sort over the same underlying series data — My
Series shows the full tracked-series record, "Use My Series" returns a cut-down projection (title/
year/rating/etc, no personal notes) sourced _from_ that same tracked pool before TMDB
recommendations are layered on top. Right now `SearchFilter`'s criteria (title/genre/status/
rating-range/started-not-finished) and `RecommendationControls`' "Use My Series" filters
(`minSourceRating`, genre-narrowing via the Specific Series picker) are two separate, independently
maintained implementations of "filter my tracked series," with their own types, their own state
shape, and their own UI.

**Deliberately deferred, not spec'd yet** — per discussion, the user expects the two to grow more
alike (not less) as "Use My Series" filtering itself evolves, particularly once the "Customizable
recommendation 'algorithm'" candidate above lands and reshapes what "Use My Series"' own source-pool
filters look like. Spec'ing a shared abstraction _before_ that reshaping happens risks designing
around the wrong shape — some differences between the two are likely permanent (Recommendations
layers in TMDB-sourced fields My Series has no concept of; My Series has status transitions and
personal notes Recommendations never touches), but the genuinely common subset (title/genre/rating
filtering, sort direction) should become clearer once "Use My Series" itself stabilizes post-revamp.

**What to watch for, once "Use My Series" filtering changes land**: whether the two features'
filter criteria types could share a common base (e.g. a `SeriesFilterCriteria` both `SearchFilter`
and `RecommendationControls` extend/compose), and whether `SeriesList`'s existing client-side
filter/sort logic (or `series_spec_003`'s backend search/filter, if server-side filtering turns out
to matter more for "Use My Series" too) could be reused directly rather than reimplemented a second
time.

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
- Heading hierarchy and skip-link presence across full pages, not per-component.
- Touch/click target sizing (WCAG 2.5.8) app-wide, not just the one instance flagged during
  `frontend_spec_054`'s icon-button design.

**Status**: Spec candidate, not yet a real spec. Open questions before scoping one:
1. Audit-only (a findings report feeding follow-up fix specs, the way `tooling_spec_001`'s Sonar
   pass worked) vs. audit-and-fix-inline (one large spec doing both) — this project's own
   `sonar-cleanup` skill precedent favors the former for a review of this breadth.
2. Whether to formalize a WCAG conformance target (e.g. "AA") this app commits to going forward, or
   keep the current ad hoc "fix what's found" posture.
3. Whether the no-focus-trap dialog pattern above should be revisited as part of this audit or
   treated as an accepted, already-decided tradeoff each dialog's own spec already signed off on.
