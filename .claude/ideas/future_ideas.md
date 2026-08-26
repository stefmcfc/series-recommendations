# Future Ideas

A running list of genuinely speculative or deferred ideas — distinct from
`.claude/SPEC_CANDIDATES.md` (things confirmed worth specifying once prioritized) and
`.claude/OUTSTANDING_SPECS.md` (specs that already exist). Items move out of this file once
they're concrete enough to become a real spec candidate.

Last updated: 2026-08-26.

---

## App-wide configuration system, with config-driven "favourite" chips
From a 2026-08-26 discussion about the country/language recommendation filters (see
`.claude/SPEC_CANDIDATES.md`). Once that filter exists with a hardcoded "popular" chip list
(UK/US for country, English for language), the longer-term idea is a real settings/config system
where those lists are user-configurable — e.g. "Favourite country of origin = {United Kingdom,
United States}", "Favourite languages = {English}" — surfaced via a dropdown in a config screen,
presumably backed by the same ISO 3166/639-1 country/language data the filter chips themselves
would use. No config system exists in this app today; this is a real prerequisite, not just a
missing setting.

## Redo the Recommendations Filters panel as an expandable side panel or sheet
From a 2026-08-26 discussion. Today's `RecommendationControls` "Filters" section is a single
collapsible inline block above the recommendation results (`frontend_spec_011`). The idea is
restructuring it into an expandable left-hand panel or a slide-out sheet instead — a layout/IA
change to the whole panel, distinct from (and larger than) the individual filter-control swaps
tracked in `.claude/SPEC_CANDIDATES.md` (those are "change what one field looks like"; this is
"change where and how the whole filter area lives"). No design decisions made yet — worth its own
dedicated thinking whenever it's prioritized.
