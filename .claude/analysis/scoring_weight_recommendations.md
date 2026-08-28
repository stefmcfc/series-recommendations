# Analysis: Weighting Recommendation Scoring by Keyword Stats

**Purpose of this document**: a working-notes file to think through whether/how to feed keyword
popularity and average personal rating into recommendation scoring (see the "Weight recommendation
scoring and/or output filters by keyword popularity/average personal rating" candidate in
`.claude/SPEC_CANDIDATES.md`). This is **not a spec** and proposes nothing yet — it's groundwork,
written so the actual design conversation can start from a shared, accurate understanding of how
scoring works *today*, before anyone suggests changing it.

**Audience note**: this first section assumes no programming background at all. Code terms are
explained the first time they come up. If anything here doesn't make sense, that's a gap in the
explanation, not something you're missing — flag it.

---

## Section 0: How the Initial Candidate List Is Fetched From TMDB

*(Added after the sections below — placed first because it covers an earlier stage of the
pipeline: where candidates come from in the first place, before any scoring happens to them.
Numbered "0" rather than renumbering Sections 1/2, so nothing below shifts.)*

This section is only about the **"Automatic"** and **"Specific Series"** modes — the same two modes
Section 1 covers. The other three modes ("Popular Right Now," "Highest Rated," "Genre & Keyword")
fetch candidates differently (one single TMDB call each, not per-show) and aren't covered here.

### The short version

For Automatic/Specific Series mode, the app does **not** ask TMDB one broad "recommend me
something" question. Instead, it works from your own tracked shows: it picks a batch of your
completed, rated shows (the "source pool"), and asks TMDB one question **per show**: *"what's
recommended alongside this specific show?"* All of those per-show answers get poured into one big
combined list, which then gets trimmed, deduplicated, filtered, scored, sorted, and capped before
you ever see it. Scoring/sorting is Sections 1–2, already written above; this section covers
everything that happens *before* that — the sourcing stage.

### Step 1: which of your shows are eligible to be a "source"?

```java
private List<SeriesEntity> automaticPool() {
    return seriesRepository.findAll().stream()
        .filter(e -> e.getStatus() == SeriesStatus.COMPLETED
            && e.getImdbId() != null
            && !e.getImdbId().isBlank()
            && !e.isExcludeFromRecommendations())
        .toList();
}
```

In **Automatic** mode, this is "every series," but filtered down first: a show only qualifies as a
source if you've marked it **Completed**, it has an **IMDb ID** recorded (needed to look it up on
TMDB in the next step), and you haven't manually flagged it **"exclude from recommendations."**
A show that's still "Watching," has no IMDb ID, or is excluded doesn't get asked about at all.

In **Specific Series** mode, this step is skipped — you've explicitly picked which shows to use as
sources yourself, so *those* shows are the pool instead (any status, no Completed/exclude
filtering applied, since you chose them directly).

### Step 2: ordering the pool, and capping how many are actually used

```java
private List<SeriesEntity> resolveSourcePool(RecommendationCriteria c) {
    List<SeriesEntity> pool = (c.getSeriesIds() != null && !c.getSeriesIds().isEmpty())
        ? explicitPool(c.getSeriesIds())
        : automaticPool();
    return pool.stream()
        .filter(e -> c.getMinSourceRating() == null
            || (e.getPersonalRating() != null && e.getPersonalRating() >= c.getMinSourceRating()))
        .sorted(SourceOrderComparator.INSTANCE)
        .limit(maxSourceSeries)
        .toList();
}
```

This is the piece that answers **"how many series, every series?"** and **"what decides the order
series get called in?"**:

- If you set a **minimum source rating** filter, the pool is narrowed to only shows rated at least
  that high, first.
- The remaining pool is then sorted using the exact same `SourceOrderComparator` from Section 2 —
  your highest personally-rated shows first, ties broken by most-recently-completed.
- Then it's **capped** to the first `maxSourceSeries` shows (config default: **20**) via `.limit(...)`.

So it is *not* every eligible show, unconditionally — it's the **top 20** (by your rating, then
recency) of whatever survives the eligibility/rating filters. If you have, say, 35 Completed shows
with IMDb IDs, only the top 20 by that ordering are ever queried; the other 15 are silently never
asked about at all, no matter how good a source they might be. Raising `maxSourceSeries` (see the
config table at the end of this section) is the only way to include more.

### Step 3: one TMDB call per source show

```java
private void sourceTitleBased(SeriesEntity source, List<RawCandidate> raw) {
    if (source.getImdbId() == null || source.getImdbId().isBlank()) {
        return;
    }
    Optional<Integer> tmdbIdOpt = tmdbClient.findTvIdByImdbId(source.getImdbId());
    if (tmdbIdOpt.isEmpty()) {
        return;
    }
    int tmdbId = tmdbIdOpt.get();
    List<TmdbCandidate> candidates = tmdbClient.recommendations(tmdbId);
    if (candidates.isEmpty()) {
        candidates = tmdbClient.similar(tmdbId);
    }
    for (TmdbCandidate c : candidates) {
        raw.add(new RawCandidate(c, source));
    }
}
```

This method runs once for **each** show left in the capped, ordered pool from Step 2 — so yes,
it's genuinely per-series, in a plain loop (`for (SeriesEntity source : pool) { sourceTitleBased(source, raw); }`
in the calling method). For each one:

1. The show's IMDb ID is converted to TMDB's own internal ID (`findTvIdByImdbId`) — TMDB and IMDb
   use different ID schemes, so this lookup is needed first.
2. The app calls **`GET /tv/{tmdbId}/recommendations`** — this is *the* endpoint, TMDB's own
   "people who liked this also liked..." list for that specific show.
3. **Only if that comes back completely empty**, it falls back to **`GET /tv/{tmdbId}/similar`** —
   a different TMDB endpoint based on shared attributes (genre, keywords, etc.) rather than
   viewing/rating correlation. It's a fallback, not an addition — the app never calls both and
   merges them for the same source show.
4. Neither call requests a specific page or result count — they take whatever TMDB hands back on
   its first (and only) page. The app never asks TMDB for page 2 of either endpoint, so however
   many results TMDB's own API returns per page is the effective "how many recs do we get for each
   series" answer — **this app applies no per-show cap of its own** at this step. (TMDB's
   documented default page size for these list endpoints is up to 20 results; this document
   doesn't independently re-verify that number against a live response, since it's TMDB's behavior,
   not this codebase's.)

Every candidate returned gets wrapped up with a reference back to which source show produced it
(`new RawCandidate(c, source)`) — this is the raw material the merging step in Section 2 later
groups together when the same candidate comes back from more than one source show.

### Step 4: the genre-based "top-up," only if title-based sourcing came up short

```java
long distinctTitleBased = raw.stream().map(r -> r.candidate().tmdbId()).distinct().count();
if (distinctTitleBased < limit) {
    raw.addAll(genreBasedSupplement(pool));
}
```

After every source show has been asked, the app checks: *"across all of that, how many genuinely
different candidates did we end up with?"* If that number is smaller than the number of
recommendations you actually asked for (the `limit` — see Step 6), the app pads the list out with
one **extra** TMDB call: it looks at the genres of shows in your source pool, finds whichever
genre(s) show up most often, and calls TMDB's `discover/tv` endpoint (sorted by popularity) for
that genre. This only fires as a top-up when needed — it isn't part of the normal per-show flow,
and it isn't per-series (it's one call, genre-based, covering the whole pool at once).

### Step 5: everything gets capped, deduped, filtered — then only *then* scored/sorted

This is the piece that answers **"at what point are recommendations deduped, sorted, and
filtered?"** — the full order, from `RecommendationService`:

```java
List<RawCandidate> raw = sourcingService.sourceFromPool(criteria, limit); // Steps 1-4 above

List<RawCandidate> capped = raw.size() > maxCandidates ? raw.subList(0, maxCandidates) : raw;
List<DedupedCandidate> deduped = deduplicationService.dedupeAndExclude(capped);
List<DedupedCandidate> filtered = outputFilterService.applyOutputFilters(deduped, criteria);

// Automatic/Specific Series modes only, from here on:
List<ScoredCandidate> ranked = filtered.stream()
    .map(dc -> rankingService.score(dc, effectiveMaxSourcesShown))
    .sorted(rankingService.resolveSortComparator(criteria))
    .toList();
List<ScoredCandidate> diversified = rankingService.applyDiversityCap(ranked, effectiveMaxPerSource);
return diversified.stream().map(ScoredCandidate::dto).limit(limit).toList();
```

In order:

1. **Cap** — everything gathered from every source show in Steps 1-4 (which, added together across
   up to 20 source shows, can be a lot of candidates) is truncated to the first `maxCandidates`
   (config default: **50**) *before* anything else happens to it. This is a raw truncation, not a
   "best 50" selection — whatever order the candidates happened to accumulate in survives.
2. **Dedupe** — this is Section 2's merging step: same show suggested by multiple sources gets
   combined into one entry with multiple source shows attached, and shows you're already
   tracking (or have ignored) get dropped entirely.
3. **Output filters** — your active filters (minimum TMDB rating, minimum vote count, year
   range, excluded genres, language, excluded keywords) are applied, removing anything that
   doesn't qualify.
4. **Score, then sort, then diversity-cap** — Sections 1 and 2, above — but only for
   Automatic/Specific Series mode. (The other three modes stop after step 3 and hand back TMDB's
   own ordering untouched.)
5. **Final limit** — Step 6, below.

### Step 6: the final list size

```java
int clampedLimit = Math.clamp(limit, 1, 50);
```

Separately from all of the above, the number of recommendations you actually see on screen is
controlled by a `limit` request parameter — the same `limit` referenced in Steps 4 and 5. It
defaults to **20** and is clamped between **1 and 50** at the API layer
(`SeriesRecommendationController`). This is applied as the very last `.limit(limit)` call after
scoring/sorting/diversity-capping — it does not reduce how much work happens upstream (sourcing,
capping at 50 candidates, deduping, filtering all still process the full set); it only trims the
*final, already-ordered* list down to however many you asked for.

### Answering "what's hardcoded vs. config vs. filter-based?"

| Constraint | Value | How to change it |
|---|---|---|
| Max source shows queried per request | 20 | `app.tmdb.max-source-series` (env `APP_TMDB_MAX_SOURCE_SERIES`) |
| Max raw candidates kept before dedup/filtering | 50 | `app.tmdb.max-candidates` (env `APP_TMDB_MAX_CANDIDATES`) |
| Max recommendations per single source show, post-scoring (diversity cap) | 8 | `app.tmdb.max-per-source` (env `APP_TMDB_MAX_PER_SOURCE`), or overridden per-request by the "Max Per Source" UI control |
| Default minimum TMDB vote count (output filter) | 200 | `app.tmdb.default-min-vote-count` (env `APP_TMDB_DEFAULT_MIN_VOTE_COUNT`), or overridden per-request by a filter |
| Final list size shown | 20, clamped 1-50 | `limit` request parameter (no config-level default override; it's a per-request API param, normally driven by the UI) |
| Recs returned per source show by TMDB itself | Not capped by this app — whatever TMDB's `/recommendations` (or `/similar` fallback) endpoint returns on its one requested page | Not controllable from this codebase; would require requesting additional TMDB pages, which isn't implemented |
| Order source shows are queried in | Personal rating desc, then date completed desc | Not configurable — fixed logic in `SourceOrderComparator`, same ordering used for the "best source" scoring pick in Section 2 |
| Max "because you watched..." source titles displayed per card | 3 | Hardcoded `DEFAULT_MAX_SOURCES_SHOWN` constant in `RecommendationService` — display-only, doesn't affect sourcing/scoring, not currently exposed as config |
| Which TMDB endpoint is used for genre-based top-up | `discover/tv`, sorted by popularity | Not configurable — only triggers when title-based sourcing yields fewer distinct candidates than `limit` |

---

## Section 1: How Recommendation Scoring Currently Works

### The big picture, in plain terms

When the app suggests shows to watch next, it doesn't just pick candidates at random or show them
in whatever order it happens to find them. Each candidate show gets a **numeric score** — a single
number that represents "how good a recommendation is this?" — and the app then sorts candidates
from highest score to lowest, so the best-scoring ones appear first.

This only applies to the **"Automatic"** and **"Specific Series"** recommendation modes — the ones
where the app is comparing a new candidate show against shows you've already watched and rated. The
other modes ("Popular Right Now," "Highest Rated," and "Genre & Keyword") work differently: they
ask TMDB (the external database this app pulls show data from) to hand back an already-ordered
list and just display it as-is, with no scoring step of the app's own. This document is only about
the scoring step, so it only applies to those first two modes.

The score is built from exactly **two ingredients**, blended together in equal measure:

1. **TMDB's own rating for the candidate show** — a public, crowd-sourced rating (think of it like
   an IMDb-style average, but from TMDB's own users), on a 0–10 scale.
2. **Your personal rating of whichever show(s) you already watched that led the app to suggest this
   candidate** — a 1–5 star rating you gave, converted onto that same 0–10 scale so the two numbers
   are comparable.

The idea is: a candidate is considered a "good" recommendation both if it's objectively well-liked
by TMDB's wider audience, *and* if it's similar to something you personally rated highly. The
current code blends these two ingredients 50/50 — neither one counts for more than the other.

### Where this lives in the code

The calculation happens in one method (a *method* is just a named, reusable block of code — you can
think of it like a small self-contained recipe with a name) called `score`, inside a file called
`RecommendationRankingService.java`. Here it is, exactly as it exists in the codebase today:

```java
public ScoredCandidate score(DedupedCandidate dc, int effectiveMaxSourcesShown) {
    double tmdbRating = dc.candidate().voteAverage() != null ? dc.candidate().voteAverage().doubleValue() : 0.0;
    RecommendationDto dto = dtoAssembler.toDto(dc, effectiveMaxSourcesShown);

    double rankScore;
    if (!dc.sourceSeries().isEmpty()) {
        Integer maxPersonalRating = dc.sourceSeries().getFirst().getPersonalRating();
        double personalRatingTerm = maxPersonalRating != null ? maxPersonalRating * 2 : 0;
        rankScore = (tmdbRating * 0.5) + (personalRatingTerm * 0.5);
    } else {
        rankScore = tmdbRating;
    }

    List<String> allSourceTitles = dc.sourceSeries().stream()
        .map(SeriesEntity::getTitle)
        .toList();
    return new ScoredCandidate(dto, rankScore, allSourceTitles);
}
```

That's the entire calculation. It looks dense if you've never read code before, so let's go through
it piece by piece.

---

### Line-by-line walkthrough

```java
public ScoredCandidate score(DedupedCandidate dc, int effectiveMaxSourcesShown) {
```
This line is the "header" of the recipe — it names the method (`score`) and lists what information
it needs to be handed in order to run:
- `dc` — short for "deduped candidate." This represents one candidate show being considered for
  recommendation, already confirmed to not be a duplicate of one you're already tracking. It carries
  the candidate's own data (its TMDB rating, its title, etc.) *and* a list of which show(s) in your
  tracked collection caused this candidate to be suggested in the first place (its "source series").
- `effectiveMaxSourcesShown` — a limit on how many "because you watched X" source shows get
  displayed alongside the recommendation. It's not actually used in the scoring math itself; it's
  only passed along to a different piece of code (`dtoAssembler.toDto`, mentioned below) that
  builds the display data for the recommendation card. It's not relevant to this analysis.
- `public ScoredCandidate` at the very start means: this recipe is usable by other code elsewhere
  in the app (`public`), and when it finishes, it hands back a `ScoredCandidate` — a small bundle
  containing the candidate's display data plus its finished score.

```java
    double tmdbRating = dc.candidate().voteAverage() != null ? dc.candidate().voteAverage().doubleValue() : 0.0;
```
This line reads TMDB's own rating for the candidate show and stores it in a labelled box called
`tmdbRating` (a *variable* — just a named place to keep a value for use later in the recipe).
`double` just means "this box holds a number that can have decimal places," like `7.4`.

The `!= null ? ... : ...` part is a compact way of writing "if / otherwise" in one line. In plain
English, this whole line says: *"If TMDB actually provided a rating for this show, use it.
Otherwise (if TMDB has no rating for it, which does happen for very new or obscure shows), treat
it as 0."* This matters because a brand-new show with no ratings yet shouldn't accidentally get
treated as unrated-therefore-excluded — it just scores low on this half of the formula instead,
same as a legitimately poorly-rated show would.

```java
    RecommendationDto dto = dtoAssembler.toDto(dc, effectiveMaxSourcesShown);
```
This line builds the data structure that actually gets shown on a recommendation card in the app —
title, poster, overview, streaming providers, and so on. It's bookkeeping for the display, not part
of the scoring math, so it's not discussed further here.

```java
    double rankScore;
```
This line just declares a new empty box named `rankScore`, ready to be filled in below. This will
end up holding the final score for this candidate.

```java
    if (!dc.sourceSeries().isEmpty()) {
```
This starts a decision point: *"Does this candidate actually have any source shows — i.e. was it
suggested because it's similar to something specific you watched?"* This can be empty for a
handful of edge cases (e.g. a candidate that only survived because it matched your most-watched
genres in general, not because of one specific show) — the code below the `if` only runs when there
*is* at least one specific source show to compare against.

```java
        Integer maxPersonalRating = dc.sourceSeries().getFirst().getPersonalRating();
```
Here's where your own opinion enters the picture. If a candidate has more than one source show
behind it (e.g. it's similar to two different shows you watched), the app already keeps that list
sorted so the source show *you personally rated highest* comes first — so `.getFirst()` (take the
first item in the list) is a shorthand way of saying "grab the personal rating of whichever source
show you liked best." That rating (a whole number from 1 to 5 stars, or `null`/nothing if you never
rated it) is stored in a box called `maxPersonalRating`.

```java
        double personalRatingTerm = maxPersonalRating != null ? maxPersonalRating * 2 : 0;
```
Your personal rating is on a 1–5 scale, but TMDB's rating is on a 0–10 scale — so before the two
can be blended together, they need to be on the same footing. This line does that conversion: it
multiplies your rating by 2 (so 5 stars becomes 10, matching TMDB's maximum), unless you never
actually rated that source show, in which case it treats it as `0` rather than crashing or skipping
the candidate entirely.

```java
        rankScore = (tmdbRating * 0.5) + (personalRatingTerm * 0.5);
```
This is the actual blend — the heart of the whole calculation. It takes half of TMDB's rating and
half of your (rescaled) personal rating, and adds them together. Because both halves are multiplied
by exactly `0.5`, the two ingredients count equally: neither TMDB's opinion nor your own opinion is
allowed to dominate the final number. The result — a number that will typically land somewhere
between 0 and 10 — is stored in the `rankScore` box that was set up earlier.

```java
    } else {
        rankScore = tmdbRating;
    }
```
This is the fallback for the rare case (from the `if` check above) where a candidate has no source
shows to compare against at all. In that situation there's no personal rating available to blend
in, so the score is simply TMDB's rating on its own, with nothing else factored in.

```java
    List<String> allSourceTitles = dc.sourceSeries().stream()
        .map(SeriesEntity::getTitle)
        .toList();
```
This builds a simple list of the titles of every source show behind this candidate (used elsewhere,
e.g. for a later step that limits how many recommendations can trace back to the same source show,
and for display text like "Because you watched Breaking Bad"). It doesn't affect the score itself.

```java
    return new ScoredCandidate(dto, rankScore, allSourceTitles);
}
```
The last line packages everything up — the display data, the finished score, and the list of
source titles — into one bundle and hands it back to whichever part of the app asked for this
candidate to be scored. The closing `}` marks the end of the recipe.

---

### A worked example, with real numbers

Suppose the app is considering recommending **"Ozark"** because you completed and rated
**"Breaking Bad"** 5 stars.

1. TMDB's own rating for Ozark happens to be **8.4** out of 10. → `tmdbRating = 8.4`
2. Your personal rating for Breaking Bad (the source show) was **5 stars**. Rescaled to a 0–10
   scale: `5 × 2 = 10`. → `personalRatingTerm = 10`
3. Blend the two, each counting for half:
   `rankScore = (8.4 × 0.5) + (10 × 0.5) = 4.2 + 5.0 = 9.2`

Ozark ends up with a `rankScore` of **9.2**. That number gets compared against every other
candidate's own score, and the app shows you the highest-scoring ones first.

For contrast, imagine a second candidate, **"Some Obscure Show"**, suggested because you rated its
source show only **2 stars**, and TMDB itself rates the candidate at **6.0**:
`rankScore = (6.0 × 0.5) + (2 × 2 × 0.5) = 3.0 + 2.0 = 5.0` — noticeably lower, so it would appear
further down the list than Ozark.

### What happens after a score is calculated

Scoring is only the first of three steps the app runs before you see a final recommendation list:

1. **Score** every candidate (Section 1, above).
2. **Sort** all candidates — either by that score ("Best Match"), or by a different measure
   entirely ("Most Recommended"). Both are covered in Section 2, below.
3. **Apply a "diversity cap"** — a limit on how many recommendations are allowed to trace back to
   the same single source show, so one show you loved doesn't flood the whole list with lookalikes.
   Not detailed in this document yet — can be covered in a later section if useful.

---

## Section 2: Candidates from Multiple Shows, and the Two "Sort By" Options

This section answers two related questions: *"If a candidate is similar to more than one show I've
watched, how does that affect it?"* and *"What's the actual difference between the 'Best Match' and
'Most Recommended' options in the Sort By control?"*

### First: how a candidate ends up linked to more than one of your shows

Behind the scenes, the app doesn't ask TMDB one big question like "what should I watch next?" — it
asks TMDB something narrower, over and over, once per show you've completed and rated: *"what's
similar to this specific show?"* If you've completed and rated five shows, that's (up to) five
separate rounds of candidates coming back from TMDB.

It's common for the *same* candidate to come back more than once — e.g. TMDB might suggest "Ozark"
both because you rated "Breaking Bad" highly *and* because you rated "Better Call Saul" highly. The
app doesn't show you "Ozark" twice in that case. Instead, there's a merging step (in a file called
`RecommendationDeduplicationService.java`) that recognizes it's the same show (by comparing IMDb
IDs, a unique identifier every show has) and combines the two into one candidate that now has *two*
source shows attached to it, instead of creating two separate recommendation entries.

Here's the relevant piece of that merging code:

```java
if (candidateByImdbId.containsKey(imdbId)) {
    // SERIES-015-AC-02: a duplicate's source series is accumulated, not discarded.
    if (rc.sourceSeries() != null) {
        sourcesByImdbId.get(imdbId).add(rc.sourceSeries());
    }
    return;
}
```
In plain terms: *"Have we already seen a candidate with this exact IMDb ID before? If so, don't add
it again as a brand-new entry — instead, just add this new source show onto the list of source
shows already being tracked for it."* The `return` at the end means "stop here, nothing more to do
for this particular round" (this code runs once per candidate found per source show, so it needs to
either merge into an existing entry or continue on to create a new one below).

Once every round of results has been processed this way, each surviving candidate has a *list* of
every one of your shows that contributed to it — one show, or several.

### How that list is put in order — and why only the top one affects the score

That list of source shows isn't left in whatever order TMDB happened to return things — it's sorted
using one consistent rule, in a small piece of code called `SourceOrderComparator`:

```java
static final Comparator<SeriesEntity> INSTANCE = Comparator
    .comparing(SeriesEntity::getPersonalRating, Comparator.nullsLast(Comparator.reverseOrder()))
    .thenComparing(SeriesEntity::getDateCompleted, Comparator.nullsLast(Comparator.reverseOrder()));
```
In plain terms: *"Sort the source shows by your personal star rating, highest first. If two source
shows have the exact same rating (or neither has one), break the tie by whichever you completed
most recently."* `Comparator.nullsLast` just means "if a show has no rating/completion date at all,
put it at the bottom rather than crashing or erroring."

This is the detail that answers the actual question — **"how does 'Best Match' work for a
recommendation that comes from multiple shows?"** Look back at Section 1's walkthrough of the
`score` method: the line

```java
Integer maxPersonalRating = dc.sourceSeries().getFirst().getPersonalRating();
```

takes `.getFirst()` — the *first* item in this now-sorted list, i.e. whichever source show you
personally rated the highest. **Only that one source show's rating feeds into the score.** If
"Ozark" is linked to both "Breaking Bad" (5 stars) and "Better Call Saul" (3 stars), the score
calculation behaves exactly as if Ozark had only ever been suggested because of Breaking Bad — the
3-star rating from Better Call Saul doesn't pull the score down, average it out, or add anything on
top. Having a second (or third, or tenth) source show attached doesn't make a candidate's "Best
Match" score any higher or lower on its own — it only matters for *which* source's rating gets
used, by picking the best one.

The other source shows aren't thrown away, though — they're kept for two other purposes:
- **Display**: the recommendation card shows "Because you watched X" text listing your source
  shows (capped at 3 by default, with "and N more" for the rest — a setting called
  `maxSourcesShown`, not covered further here).
- **The other sort option**, "Most Recommended" — covered next.

### "Best Match" vs. "Most Recommended" — what the Sort By control actually does

The Recommendations page has a "Sort By" control offering two options. Both are implemented in one
small piece of code:

```java
public Comparator<ScoredCandidate> resolveSortComparator(RecommendationCriteria c) {
    if ("recommendationCount".equals(c.getSortBy())) {
        return Comparator
            .comparingInt((ScoredCandidate sc) -> sc.dto().totalSourceCount())
            .thenComparingDouble(ScoredCandidate::rankScore)
            .reversed();
    }
    return Comparator.comparingDouble(ScoredCandidate::rankScore).reversed();
}
```

Walking through this:
- `if ("recommendationCount".equals(c.getSortBy()))` — this checks which sort option you picked.
  `"recommendationCount"` is the internal name for what the Sort By dropdown displays as **"Most
  Recommended."** Anything else falls through to the bottom line, which is **"Best Match"**
  (the default).
- **"Best Match"** (the `return` on the very last line) sorts candidates purely by `rankScore` —
  exactly the number Section 1 walked through — from highest to lowest (`.reversed()`, since the
  underlying comparison would otherwise put the *lowest* first). This is "how good a match is this,
  based on TMDB's rating blended with your personal rating of the single best source show."
- **"Most Recommended"** sorts by something completely different: `sc.dto().totalSourceCount()` —
  literally *how many* of your shows contributed to this candidate (the size of that source-show
  list from earlier), highest first. A show suggested because of 4 different things you loved beats
  a show suggested because of just 1, **regardless of how high either one's `rankScore` is.**
  `.thenComparingDouble(ScoredCandidate::rankScore)` means: *if two candidates were both suggested
  by the same number of shows*, fall back to comparing their `rankScore` to break the tie — so
  `rankScore` still plays a role here, but only as a tiebreaker, never as the primary ordering.

### A worked example showing the two sorts disagreeing

Take two candidates:
- **"Show A"**: suggested by *one* source show you rated 5 stars, TMDB rating 9.0.
  `rankScore = (9.0 × 0.5) + (5×2 × 0.5) = 4.5 + 5.0 = 9.5`. `totalSourceCount = 1`.
- **"Show B"**: suggested by *three* source shows (best-rated among them: 3 stars), TMDB rating 7.0.
  `rankScore = (7.0 × 0.5) + (3×2 × 0.5) = 3.5 + 3.0 = 6.5`. `totalSourceCount = 3`.

Under **"Best Match"**, Show A (9.5) outranks Show B (6.5) — it's simply the higher-scoring
candidate.

Under **"Most Recommended"**, Show B outranks Show A — 3 contributing shows beats 1, even though
Show B's own `rankScore` is lower. The tiebreaker (`rankScore`) never even gets consulted here,
since the two candidates don't have the same `totalSourceCount`.

So the two sort options can genuinely disagree about which candidate belongs first, and which one
"wins" depends entirely on what you're optimizing for when you look at the list: *best individual
match* vs. *broadest agreement across everything you've watched*.

---

---

## Section 3: How "Genre & Keyword" Mode Actually Works

*(Added to answer four specific questions: does this mode use your saved/tracked series at all;
does selecting multiple genres work the way you'd expect; does selecting multiple keywords work
the way you'd expect; and, at a high level, is filtering done by asking TMDB a narrower question,
or by fetching a broad list and then filtering it ourselves afterward.)*

### The short version

**Genre & Keyword is a "directed sourcing" mode, exactly like "Popular Right Now" and "Highest
Rated"** (Section 0/1 both call these out as the other three modes that skip scoring entirely). It
does **not** touch your tracked series to build the candidate list — confirmed below. **Multiple
genres do get sent to TMDB together, but combined as "must match ALL of these," not "match ANY of
these"** — and keywords work the exact same way, through the exact same code, with the exact same
limitation. And the split between "TMDB does the filtering" vs. "this app does the filtering
afterward" is genuinely half-and-half: genre, keyword, and a minimum vote-count floor are sent
*to* TMDB as part of the request; everything else (minimum rating, year range, excluded
genres/keywords, language) is filtered locally, after TMDB's one response comes back.

### Question 1: does this use your saved series?

**No.** Here's the entire sourcing method, in `RecommendationSourcingService.java`:

```java
public List<RawCandidate> sourceByGenreOrKeyword(RecommendationCriteria c) {
    List<Integer> genreIds = resolveGenreIds(c.getGenres());
    List<Integer> keywordIds = resolveKeywordIds(c.getKeywords());
    String effectiveSortBy = resolveDiscoverSortBy(c, RecommendationDefaults.DEFAULT_GENRE_SORT_BY);
    int effectiveMinVoteCount = c.getMinVoteCount() != null ? c.getMinVoteCount() : defaultMinVoteCount;
    return tmdbClient.discover(genreIds, keywordIds, effectiveSortBy, effectiveMinVoteCount).stream()
        .map(candidate -> new RawCandidate(candidate, null))
        .toList();
}
```

Compare this to `sourceFromPool` (Section 0's Steps 1-4), which starts by calling
`resolveSourcePool(c)` — the method that reads `seriesRepository`, applies the Completed/IMDb-ID/
not-excluded filter, sorts by your rating, and caps at `maxSourceSeries`. None of that appears
here. `sourceByGenreOrKeyword` never calls `seriesRepository` at all, never reads
`SeriesEntity.getPersonalRating()`, and every `RawCandidate` it produces is built with `null` as
its source series (that second constructor argument) — meaning no tracked show is ever recorded
as "the reason" a candidate was suggested. This is also why, back in `RecommendationService`, this
mode's candidates skip the scoring step entirely (Section 1's `score` method needs a source
series' personal rating to do its 50/50 blend — with no source series, there's nothing to blend):

```java
if (trendingMode || topRatedMode || genreOrKeywordDirected) {
    // ...none of the three ever link a candidate to a source series...
    return filtered.stream()
        .map(dc -> dtoAssembler.toDto(dc, effectiveMaxSourcesShown))
        .limit(limit)
        .toList();
}
```

So candidates in this mode are shown in whatever order TMDB itself returned them (driven by
`sort_by`, defaulting to `popularity.desc` — see Question 4), never re-sorted by your ratings.

**One caveat, so this isn't overstated**: your tracked series *is* consulted once, but only to
*remove* candidates, not to help pick or rank them. That happens later, in
`RecommendationDeduplicationService.accumulateCandidate`:

```java
if (seriesRepository.existsByImdbId(imdbId) || ignoredSeriesRepository.existsByImdbId(imdbId)) {
    return;
}
```

In plain terms: *"if this candidate is a show you're already tracking, or one you've explicitly
ignored, drop it silently."* That's exclusion, not influence — it can only make a candidate
disappear, never make it rank higher or lower, and it has nothing to do with genres or keywords
specifically (every mode does this same check).

### Question 2: does selecting multiple genres work?

Sort of — it sends all of them to TMDB in one request, but combined the "wrong" way for what a
filter checkbox list implies. TMDB's `with_genres` parameter (the
[`discover/tv` reference](https://developer.themoviedb.org/reference/discover-tv) you linked)
supports two different join styles in the *same* parameter: comma-separated means **"a show must
have ALL of these genres"** (logical AND), while pipe-separated (`|`) means **"a show must have
ANY of these genres"** (logical OR). This app's code only ever uses the comma form:

```java
private static String joinIds(List<Integer> ids) {
    return ids.stream().map(String::valueOf).collect(Collectors.joining(","));
}
```

That's a single shared helper — both `with_genres` and `with_keywords` are built by calling this
exact same method inside `TmdbClient.discover(...)`:

```java
if (genreIds != null && !genreIds.isEmpty()) {
    b = b.queryParam("with_genres", joinIds(genreIds));
}
if (keywordIds != null && !keywordIds.isEmpty()) {
    b = b.queryParam("with_keywords", joinIds(keywordIds));
}
```

So if you tick both **"Comedy"** and **"Horror"** in the Genre & Keyword filter UI
(`RecommendationControls.tsx`'s genre checkboxes, `state.genresSelected`), the request sent to
TMDB is `with_genres=35,27` — which TMDB reads as *"only shows that are both Comedy AND Horror"*
(a real but narrow genre combination — "horror comedy" — not "either genre"). That's very likely
not what a user checking two boxes in a filter list expects; the natural reading of a checkbox
list is "show me things in any of these categories," which would require the pipe form
(`with_genres=35|27`) instead. There's no code path anywhere in this app that ever produces a
pipe-joined value — `joinIds` has exactly one implementation, and nothing branches on OR-vs-AND
before calling it.

### Question 3: does selecting multiple keywords work?

Same answer, because it's the same code. `resolveKeywordIds` turns each typed/selected keyword
into a TMDB keyword id (one `search/keyword` lookup per keyword):

```java
private List<Integer> resolveKeywordIds(List<String> keywords) {
    if (keywords == null) {
        return List.of();
    }
    return keywords.stream()
        .map(tmdbClient::searchKeyword)
        .filter(Optional::isPresent)
        .map(Optional::get)
        .distinct()
        .toList();
}
```

— and that resulting `keywordIds` list is handed to the exact same `discover(...)` call as
`genreIds`, joined by the exact same `joinIds` helper, so `with_keywords` is comma-joined (AND)
just like `with_genres` is. There's no special-casing that makes keywords behave differently from
genres here; if it "seems to work," it's most likely because the keyword combinations tried so far
happened to co-occur often enough on real shows that AND still returned results — not because the
app is doing anything different under the hood. Selecting several niche/unrelated keywords
together would hit the exact same "too narrow, possibly zero results" failure mode multiple
genres can hit.

### Question 4: is this "ask TMDB a narrower question" or "fetch broad, then filter locally"?

**Both — split roughly down the middle.** Three things are sent *to* TMDB as part of the
`discover/tv` request itself, so TMDB narrows its own results before this app ever sees them:

- **Genre** (`with_genres`) and **keyword** (`with_keywords`) — Questions 2/3, above.
- **A minimum vote-count floor** (`vote_count.gte`) — `effectiveMinVoteCount` in
  `sourceByGenreOrKeyword`, defaulting to `app.tmdb.default-min-vote-count` (**200**) unless the
  request overrides it. This was added specifically so obscure/zero-vote shows don't need to be
  fetched at all just to be discarded a moment later (see the `SERIES-029` comments in the code).
- **Sort order** (`sort_by`) — defaults to `popularity.desc` (`DEFAULT_GENRE_SORT_BY`), or an
  explicit `discoverSortBy` if the request set one.

Everything else is genuinely "fetch, then filter locally," in `RecommendationOutputFilterService.
applyOutputFilters` — run entirely in this app's own code, against whatever TMDB already handed
back:

```java
return candidates.stream()
    .filter(dc -> matchesMinTmdbRating(dc.candidate(), c.getMinTmdbRating()))
    .filter(dc -> matchesMinVoteCount(dc.candidate(), effectiveMinVoteCount))
    .filter(dc -> matchesYearRange(dc.candidate(), c.getYearMin(), c.getYearMax()))
    .filter(dc -> matchesExcludeGenres(dc.candidate(), c.getExcludeGenres()))
    .filter(dc -> matchesLanguage(dc.candidate(), c.getLanguage()))
    .filter(dc -> matchesExcludeKeywords(dc.candidate(), c.getExcludeKeywords()))
    .toList();
```

That's: minimum TMDB rating, minimum vote count *again* (a second, redundant check — harmless,
since it's the same threshold TMDB was already asked to enforce), year range, excluded genres,
language, and excluded keywords. None of these six have a TMDB `discover/tv` query-parameter
equivalent this app uses, so they can only be applied after the fact, to the one page of results
TMDB already returned.

One knock-on effect worth naming: **TMDB's `discover/tv` returns one page per call, and this app
never requests a second page** (same "no pagination" behavior Section 0 already noted for
`recommendations`/`similar`). So the six locally-applied filters above are only ever narrowing
*that one page* — if an AND-joined multi-genre or multi-keyword combination (Questions 2/3) already
leaves TMDB with very few matches, the local filters have a small pool to work with and could
plausibly filter it down to nothing, with no fallback page to fall back on.

### Summary table

| Question | Answer |
|---|---|
| Uses your tracked series to source/rank candidates? | No — `sourceByGenreOrKeyword` never reads `seriesRepository`; every candidate's source series is `null`, so scoring is skipped entirely. Tracked/ignored series are only ever used to *exclude* a candidate afterward, in dedup, same as every other mode. |
| Multiple genres — AND or OR? | AND only. `with_genres` is always comma-joined (`joinIds`); TMDB's own OR syntax (pipe-separated) is never produced by this app. |
| Multiple keywords — AND or OR? | AND only — identical code path (`joinIds`) to genres, not a separate implementation. |
| Genre/keyword filtering: server-side or client-side? | Server-side (sent to TMDB as `with_genres`/`with_keywords` on the `discover/tv` call). |
| What *is* filtered client-side, after the fetch? | Minimum TMDB rating, minimum vote count (redundant 2nd check), year range, excluded genres, language, excluded keywords — all in `RecommendationOutputFilterService`. |
| Any scoring/ranking against your ratings? | No — this mode (like Trending/Top Rated) preserves TMDB's own `sort_by`-driven order untouched. |

---

---

## Section 4: How "Popular Right Now" and "Highest Rated" Work

*(Added to close out the "directed sourcing" trio Sections 0/1/3 kept referring back to but never
fully covered on their own. Both of these are simpler than Genre & Keyword — neither has a genre
or keyword concept at all — but they differ from each other in one important way: whether TMDB or
this app decides "good enough to include.")*

### The short version

**"Popular Right Now" is `sourceMode: "trending"`; "Highest Rated" is `sourceMode: "topRated"`.**
Both call `RecommendationSourcingService` methods that, like Genre & Keyword, never touch
`seriesRepository` and never attach a source series to a candidate — so both skip scoring too, and
both keep whichever order TMDB itself returns. Where they differ: **Trending asks TMDB for its own
curated "what's hot" list verbatim, with no filtering knobs of its own at all**, while **Top Rated
is really the same `discover/tv` machinery Genre & Keyword uses, just with the genre/keyword
params left off** — so it inherits that mode's server-side minimum-vote-count floor, just with a
different (currently identical-by-coincidence) default.

### "Popular Right Now" (`trending`)

```java
public List<RawCandidate> sourceTrending(RecommendationCriteria c) {
    String window = c.getTrendingWindow() != null && !c.getTrendingWindow().isBlank()
        ? c.getTrendingWindow() : "week";
    return tmdbClient.trending(window).stream()
        .map(candidate -> new RawCandidate(candidate, null))
        .toList();
}
```

This calls a completely different TMDB endpoint from every other mode: **`GET
/trending/tv/{day|week}`** — TMDB's own "what's actually being watched/searched right now" list,
based on real-time popularity signal, not a `discover/tv` query at all. The only input this mode
reads from your request is `trendingWindow` (`"day"` or `"week"`, defaulting to `"week"` — the UI
control's own default matches, per `initialState.trendingWindow = 'week'` in
`RecommendationControls.tsx`). **Genre, keyword, sort order, and minimum vote count are not readable
by this method at all** — there's no parameter for any of them on `tmdbClient.trending(...)`, and
`RecommendationCriteria.getGenres()`/`getKeywords()`/`getDiscoverSortBy()` are simply never called
here. If you had genre or keyword filters set from a previous mode and switched to "Popular Right
Now," they're silently ignored, not applied and not erroring — consistent with the "mutually
exclusive, ignored not rejected" behavior the DTO's own Javadoc documents for `sourceMode`.

TMDB's `sort_by`-equivalent here is implicit: `/trending/tv` has its own fixed popularity-ranking
algorithm, and Section 0 already notes elsewhere that this app never re-sorts trending results —
TMDB's order is preserved exactly.

**Important wrinkle**: even though *sourcing* applies zero filtering of its own, the later output-
filter step still runs — and its "which minVoteCount default applies" logic only special-cases
`topRated`:

```java
int modeDefaultMinVoteCount = RecommendationDefaults.SOURCE_MODE_TOP_RATED.equals(c.getSourceMode())
    ? RecommendationDefaults.DEFAULT_MIN_VOTE_COUNT_TOP_RATED : defaultMinVoteCount;
```

`c.getSourceMode()` is `"trending"` here, not `"topRated"`, so this falls into the `else` branch —
meaning **Trending candidates still get a 200-vote-count floor applied, just client-side, after the
fact**, unless the request overrides `minVoteCount`. So "Popular Right Now" isn't quite as
unfiltered as the sourcing method alone suggests: TMDB's trending list can and does include
low-vote-count new/obscure shows, and this app quietly drops them afterward at the same default
threshold Genre & Keyword and Highest Rated use.

### "Highest Rated" (`topRated`)

```java
public List<RawCandidate> sourceTopRated(RecommendationCriteria c) {
    int effectiveMinVoteCount = c.getMinVoteCount() != null ? c.getMinVoteCount() : RecommendationDefaults.DEFAULT_MIN_VOTE_COUNT_TOP_RATED;
    String effectiveSortBy = resolveDiscoverSortBy(c, RecommendationDefaults.DEFAULT_TOP_RATED_SORT_BY);
    return tmdbClient.discoverTopRated(effectiveMinVoteCount, effectiveSortBy).stream()
        .map(candidate -> new RawCandidate(candidate, null))
        .toList();
}
```

This is architecturally the closest sibling to Genre & Keyword: same `discover/tv` endpoint family,
same "resolve an effective `minVoteCount`, resolve an effective `sort_by`, call TMDB, wrap results
with a `null` source series" shape. The differences are narrow:

- **No genre/keyword params at all** — `discoverTopRated(int, String)` is a separate `TmdbClient`
  method from `discover(...)`, and it never accepts genre/keyword ids, so this is TMDB's "best of
  everything, no category narrowing" list.
- **A different default sort**: `vote_average.desc` (`DEFAULT_TOP_RATED_SORT_BY`) instead of Genre
  & Keyword's `popularity.desc` — "best-rated first" rather than "most-popular first," matching
  what "Highest Rated" implies. Still overridable per-request via `discoverSortBy`, from the same
  12-value TMDB `sort_by` enum (`RecommendationDefaults.VALID_DISCOVER_SORT_BY`) both modes share.
- **A separately-tracked (if currently equal) default minimum vote count**: `topRated` reads the
  hardcoded `DEFAULT_MIN_VOTE_COUNT_TOP_RATED = 200` constant, while Genre & Keyword reads the
  injected, config-overridable `app.tmdb.default-min-vote-count` property (also `200` today). The
  code comment on the constant is explicit that this is deliberate — "the two knobs happen to
  share a value today but remain independently configurable" — so changing one via config
  (`APP_TMDB_DEFAULT_MIN_VOTE_COUNT`) does **not** move the other; only a code change touches
  `topRated`'s floor.

Exactly like Genre & Keyword, this vote-count floor is sent to TMDB itself (`vote_count.gte` on
the `discover/tv` call, inside `discoverTopRated`) — genuinely server-side, not a post-hoc filter —
and the output-filter step's redundant second check (this time correctly hitting the `topRated`
branch of `modeDefaultMinVoteCount` above) just re-confirms the same threshold TMDB already
enforced.

### Summary table

| | Popular Right Now (`trending`) | Highest Rated (`topRated`) |
|---|---|---|
| TMDB endpoint | `GET /trending/tv/{day or week}` | `GET /discover/tv?sort_by=…&vote_count.gte=…` |
| Genre/keyword filterable? | No — not read by this mode at all | No — same as trending |
| Sort order | TMDB's fixed trending/popularity algorithm, always | `vote_average.desc` by default, or any of the 12 `discoverSortBy` values |
| Minimum vote count — where enforced | **Client-side only** (post-hoc output filter, 200 default) — sourcing sends none | **Server-side** (`vote_count.gte` on the sourcing call itself), 200 default, then re-checked client-side (redundant) |
| Minimum vote count — default's source | `app.tmdb.default-min-vote-count` (shared, config-overridable) — same knob Genre & Keyword's output-filter fallback uses | Hardcoded `DEFAULT_MIN_VOTE_COUNT_TOP_RATED` constant — independently configurable only via a code change |
| Uses your tracked series? | No (except dedup exclusion, same as every mode) | No (except dedup exclusion, same as every mode) |
| Scoring/ranking against your ratings? | No — TMDB's own order preserved | No — TMDB's own order preserved |

---

*End of Section 4. Next up (not yet written): how keyword popularity/average rating data could
plug into this, and the open questions listed in the `SPEC_CANDIDATES.md` entry.*
