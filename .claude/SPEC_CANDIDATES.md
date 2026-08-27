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

Last updated: 2026-08-27. (`.claude/OUTSTANDING_SPECS.md`, formerly this file's counterpart for
already-written specs, was retired on this date — its tracking role now lives in `ROADMAP.md`.)

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
