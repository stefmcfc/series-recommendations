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

Last updated: 2026-09-05 ("Exclude Keywords" filter candidate closed — spec'd as part of
`frontend_spec_094_recommendations_page_polish.md`, see `ROADMAP.md`). (`.claude/OUTSTANDING_SPECS.md`, formerly this file's counterpart for
already-written specs, was retired on 2026-08-27 — its tracking role now lives in `ROADMAP.md`.)

Last full review against the codebase: 2026-09-07 — all 5 candidates below re-checked against the
current code (scoring service, recommendation controllers/services, `frontend/src/components/`);
none has been delivered or spec'd since the last update, no changes needed.

---

## Candidates

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
this candidate's own scope for those two fields narrowed to "Use My Series" mode only at the time.
**Update (2026-09-03)**: re-checked against the current code (post `frontend_spec_081`) — neither
field has any frontend UI control anywhere anymore, including "Use My Series" (grep for
`maxPerSource`/`maxSourcesShown` across `frontend/src/components/*.tsx` returns zero matches
outside test files; both remain live backend request params with defaults, just with nothing in
the UI to set them). This candidate's scope for those two fields is now moot — nothing left to
attach a disclosure box to. Only "Sort By" (the Best Match/Most Recommended radio pair) is still a
live candidate for this treatment.

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

**Status**: Spec candidate, not yet a real spec. Open questions before scoping one:
1. Audit-only (a findings report feeding follow-up fix specs, the way `tooling_spec_001`'s Sonar
   pass worked) vs. audit-and-fix-inline (one large spec doing both) — this project's own
   `sonar-cleanup` skill precedent favors the former for a review of this breadth.
2. Whether to formalize a WCAG conformance target (e.g. "AA") this app commits to going forward, or
   keep the current ad hoc "fix what's found" posture.
3. Whether the no-focus-trap dialog pattern above should be revisited as part of this audit or
   treated as an accepted, already-decided tradeoff each dialog's own spec already signed off on.

### Number input (`type="number"`) spinner styling — unstyled, inconsistent across browsers

Raised 2026-09-08, spotted during the manual browser verification pass for `frontend_spec_103`/
`104` (button styling consistency and sticky action bars) — not caused by either spec (confirmed:
no diff on any `type="number"` field on that branch), just noticed alongside it.

Confirmed via grep across `frontend/src`: no CSS anywhere in this codebase targets a number input's
spinner (`::-webkit-inner-spin-button`/`::-webkit-outer-spin-button`, or Firefox's
`-moz-appearance`) — every numeric field renders 100% native, unstyled browser UI for its up/down
control. Affected fields span `CustomSearchPanel.tsx`, `EditSeriesForm.tsx`, `NameStatsTable.tsx`,
`RecommendationFiltersBox.tsx`, `SearchFilter.tsx`, `SeriesFormFields.tsx`, `SettingsPage.tsx`, and
`UseMySeriesPanel.tsx` (e.g. Min IMDb/TMDB Rating, Year Min/Max, Skip Threshold Override).

Because it's unstyled, the two browsers render it very differently: Chrome hides the spinner
entirely until the field is hovered or focused, and even then its appearance can be influenced by
the OS's own native-control theming (Windows dark/light mode for form controls) independent of this
app's own light/dark theme toggle; Firefox always shows the spinner, with different sizing/coloring
than Chrome's. Confirmed live in both browsers, both app themes — purely a native-UA rendering gap,
not an app bug or theme-token issue.

**Open questions for whoever scopes this**:
1. Suppress the native spinner (`appearance: textfield` + the two `-webkit-*-spin-button`
   pseudo-elements) and build a custom up/down control themed consistently in both light/dark —
   real work, but the only way to get actual cross-browser visual parity.
2. Alternatively, leave the native control but decide whether it's worth even lightly influencing
   (there's limited styling surface for `-moz-appearance` spinners in Firefox), vs. accepting this
   as a low-severity cosmetic gap not worth the custom-control effort.
3. Whether every numeric field listed above needs this treatment uniformly, or only the ones where
   the spinner's increment/decrement is actually a meaningful interaction (rating/year fields with a
   real `step`) rather than a rarely-used affordance.

**Status**: Spec candidate, not yet designed.

### Incremental dedup/output-filtering for `RecommendationSourcingService`'s backfill loop

Raised 2026-09-08, discovered while investigating why raising `app.tmdb.max-discover-pages`
(`series_spec_054_recommendation_discover_backfill_pagination.md`) didn't proportionally increase
recommendation counts under several active output filters — that turned out to be a real bug
(`maxCandidates` capping the raw pool *before* filtering, in TMDB page order), now fixed as a
Correction on `series_spec_054` itself (see that spec's Requirement 5 / SERIES-054-AC-14). This
candidate is the *separate*, larger issue the bug investigation surfaced along the way: the
backfill loop's own architecture is wasteful, independent of the now-fixed capping bug.

**Confirmed via live trace** (manual diagnostic logging, since reverted — not left in the
codebase): `RecommendationSourcingService.sourceWithBackfill`'s stopping check
(`countAfterDedupAndFilter`) re-runs `RecommendationDeduplicationService.dedupeAndExclude` and
`RecommendationOutputFilterService.applyOutputFilters` over the *entire accumulated raw pool*
on every single page fetched — not just the newly-fetched page — purely to get a `.size()` count
for the "have I found enough yet?" decision, then throws the computed result away. A 6-page
backfill (`max-discover-pages: 6`) means the accumulated pool is fully re-deduped/re-filtered 6
times (once at 20 candidates, again at 40, 60, 80, 100, 120), and `RecommendationDeduplication
Service.dedupeAndExclude` calls `TmdbClient.externalIds` once per raw candidate — so an early
page's candidates get their `external_ids` re-resolved via TMDB on every subsequent page's check.
`RecommendationService.doRecommend` then runs dedup/filtering a further, final time over
whatever raw list the loop returns. Net effect for a 6-page backfill: roughly 7 total
dedup/filter passes over overlapping data, several of them wholly redundant, for one API request.

**Ideas to design against** (not resolved here):
1. Dedupe/filter only each *newly-fetched* page's candidates once, folding the result into a
   running `List<DedupedCandidate>` accumulator, rather than re-deriving the whole pool from
   scratch every iteration — turns the loop's own cost from roughly O(pages²) dedup/filter work
   into O(pages).
2. Have `sourceTrending`/`sourceTopRated`/`sourceByGenreOrKeyword` return that already-filtered
   accumulator directly (a `List<DedupedCandidate>`, not `List<RawCandidate>`), eliminating
   `doRecommend`'s current third, fully-redundant dedup/filter pass entirely. This is a real
   interface change to `RecommendationSourcingService`'s three backfill-enabled methods (and
   likely `RawCandidate`'s role in this path), so needs care around what stays unchanged for
   `sourceFromPool` ("Use My Series", which this candidate doesn't touch — see `series_spec_054`'s
   own Design Decisions for why that mode was deliberately excluded from the backfill mechanism
   in the first place).
3. Whether `RecommendationDeduplicationService.dedupeAndExclude`'s `TmdbClient.externalIds`
   resolution should itself be memoized per request (a simple per-call cache keyed by `tmdbId`),
   independent of the incremental-accumulator redesign above — would remove the repeated-
   resolution cost even if the rest of the loop's shape stays as-is, and is a much smaller change
   if the bigger interface rework above turns out not to be worth it on its own.
4. This candidate explicitly **revises** `series_spec_054`'s own "deliberate simplicity-over-
   efficiency trade-off" Design Decision (dedup-resolving a candidate more than once was
   accepted there as "revisit only if this proves to actually matter in practice") — it just did,
   for a personal single-user app, at `max-discover-pages: 6` with several active output filters.
   Whoever scopes this should read that Design Decision's original reasoning first, since the
   trade-off wasn't wrong when made (single-page sourcing, no backfill) — it just didn't
   anticipate this spec's own later change to how large the pool could get.

**Status**: Spec candidate, not yet designed.
