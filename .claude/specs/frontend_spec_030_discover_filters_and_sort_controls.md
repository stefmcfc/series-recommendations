# Frontend Spec 030: Discover Filters (Exclude Keywords) & Mode-Aware Sort/Vote Controls

**Status**: Implemented (2026-08-24)
**Files touched**: `src/types/series.ts` (`RecommendationQuery.excludeKeywords`), `src/services/seriesApi.ts`
(`buildRecommendationParams` wires `excludeKeywords` comma-joined), `src/services/__tests__/seriesApi.test.ts` (new
`FRONTEND-030-AC-02` describe block), `src/components/RecommendationControls.tsx` (`ControlsState.excludeKeywordsText`/
`minVoteCountTouched`, "Exclude Keywords" input adjacent to "Exclude Genres", `handleModeChange`'s mode-aware
`minVoteCount` auto-fill/revert gated on `minVoteCountTouched`, a dedicated `handleMinVoteCountChange` that sets the
touched flag, `handleResetFilters` clearing both new fields, the `Sort By` fieldset hidden outright when
`state.mode === 'trending'` and its second radio's label switched to "Vote Average" when `state.mode === 'topRated'`),
`src/components/RecommendationControls.test.tsx` (new `FRONTEND-030-AC-03/04/05/07/08/09/10/11/12/13/14/15` describe
blocks, plus one pre-existing `FRONTEND-027` test updated to reflect the new `minVoteCount: 200` auto-fill it now
triggers when selecting Highest Rated).
**Verification**: `npm test` from `frontend/` — full suite green (358 tests, 13 files, including the new/updated
`RecommendationControls.test.tsx` and `seriesApi.test.ts` cases). `npm run lint` — clean. Real browser pass done: both
servers already running (`gradlew.bat bootRun` on :8080, `npm run dev` on :5173, restarted once to pick up a
CORS-workaround `.env.local` per `.claude/skills/verify/SKILL.md`, then reverted afterward), driven with a scripted
`puppeteer-core` pass (Chrome, headless) rather than manual clicking — confirmed: `Sort By` fieldset disappears when
switching into "Popular Right Now" and reappears switching back to "Automatic"; switching into "Highest Rated"
pre-fills `Min Vote Count` to `200` and relabels the second `Sort By` radio to "Vote Average" (with "Most Recommended"
absent), switching back out to "Automatic" reverts it to empty; typing into "Exclude Keywords" produced a live
`GET /api/v1/series/recommendations?excludeKeywords=Zombie,Heist` request (observed via intercepted network requests).
Checked both light and dark `prefers-color-scheme` (screenshots taken and reviewed) — no visual regressions in either.
Checked the browser console for `@axe-core/react` violations after driving through Automatic/Trending/Highest Rated: one
pre-existing `color-contrast` violation was flagged, traced via a captured-console-log script to `SeriesList.tsx`'s
`.sortLabel` ("Sort by" dropdown label on the My Series view) — unrelated to any file this spec touched, not a
regression introduced here. A `page-has-heading-one` moderate violation (pre-existing, app-wide, no `<h1>` anywhere in
`App.tsx`) was also observed in both themes, likewise unrelated to this change.
**Addendum (2026-08-24)**: this spec's `Sort By` UI change for `topRated` — relabeling the second radio to "Vote
Average" — was superseded by `frontend_spec_033_discover_native_sort_controls.md`, which replaces it with four
real, distinct TMDB-backed sort options for `topRated` (and `genre`, see `frontend_spec_031`). The relabel
described above is no longer present in the codebase; this entry is left as-is as a historical record.
**Priority**: P3 (mirrors the backend spec's own tier)
**Depends on**: Series Spec 024 (`excludeKeywords` param, mode-aware `minVoteCount` default of 200 for `topRated`) ✅, Frontend Spec 011 (`RecommendationControls`, `excludeGenresText` free-text pattern, `Filters` section, `handleResetFilters`) ✅, Frontend Spec 019 (`Sort By` fieldset, `Best Match`/`Most Recommended` radios, `sortBy` query wiring) ✅, Frontend Spec 027 (five-way mode selector including `topRated`/`trending`, mode-switch clearing behavior, mode-based visibility gating precedent) ✅
**Frontend Stage**: 30 of N

## Overview

Closes out scratch items 4 and 5 from `SCRATCH_NEW_IDEAS_2026-08-24.md` on the frontend side. Adds an "Exclude Keywords" filter input to `RecommendationControls`, mirroring the existing "Exclude Genres" free-text field exactly, and pre-fills `Min Vote Count` to 200 when the "Highest Rated" mode is selected (matching `series_spec_024`'s new mode-aware backend default) without ever overwriting a value the user has already typed. Also fixes the `Sort By` control per the confirmed backend analysis: hides it entirely under "Popular Right Now" (a true no-op there), and relabels its "Most Recommended" option to "Vote Average" under "Highest Rated" (where the underlying signal it originally described doesn't exist for that mode's candidates).

**Design decisions**:

- **Exclude Keywords reuses the exact "Exclude Genres" control shape** — a single comma-separated free-text `<input type="text">` in the collapsible Filters section, parsed with the existing `parseCommaList` helper. No new control style, and specifically no chip/type-ahead picker: that richer, TMDB-search-backed keyword UX is scoped to the separate, still-unbuilt combined spec for scratch items 2/6 (a shared searchable-keyword-picker component), not this one. Building two different keyword-input styles in the same component in the same change would be inconsistent; matching the sibling `excludeGenres` field it sits next to is the more honest scope for this spec.
- **The `minVoteCount` auto-fill is gated on a `minVoteCountTouched` flag, not just the field's current value.** An empty string alone can't distinguish "user cleared it deliberately" from "never touched" in a way that reliably avoids clobbering; an explicit touched flag, set the moment the user edits the field directly, is unambiguous and is checked before every mode-triggered auto-fill or revert in either direction.
- **`Reset Filters` clears `minVoteCount` to `''` and `minVoteCountTouched` to `false` uniformly, the same flat behavior it already applies to every other Filters-section field** — it does not re-trigger the `topRated` auto-fill even if the current mode is still `topRated` immediately after resetting. Keeping `handleResetFilters` mode-agnostic (as it already is for every other field) is simpler than adding one field-specific exception to it; the next explicit mode change (or a page reload) re-establishes the auto-fill normally.
- **The "Vote Average" relabel for `topRated` is a pure label change — `sortBy` still sends `'recommendationCount'`, no new `RecommendationQuery` value.** Reading `RecommendationService.resolveSortComparator` again confirms why this is sufficient: its `recommendationCount` branch ties every `topRated` candidate on `totalSourceCount` (always `0` there, since none are sourced from the tracked list), then falls through to its `rankScore`-descending tiebreaker — and for a `null`-`sourceTitle` candidate, `rankScore` is exactly `tmdbRating` (`SERIES-007-AC-21`), i.e. TMDB's own vote average. So selecting today's "Most Recommended" under `topRated` *already* produces vote-average-descending order; it's mislabeled, not miswired. Introducing a distinct wire value would be solving a problem that doesn't exist and would require a matching backend change this spec doesn't need.
- **The `Sort By` fieldset is hidden outright for `trending`, not relabeled or replaced with an alternative.** Unlike `topRated`, there is no meaningful ordering signal to reframe it around — `RecommendationService.recommend()` short-circuits before `score()`/`resolveSortComparator()` ever run for `trendingMode` (`series_spec_022`, `SERIES-022-AC-08`), so TMDB's own popularity order is the only ordering that exists. Offering a control that visibly does nothing would be actively misleading, per the scratch file's own conclusion.

---

## Requirements

### Requirement 1: Exclude Keywords Filter Control

**User story**: As a user filtering recommendations, I want to exclude candidates matching keywords I'm not interested in, directly from the same Filters panel as Exclude Genres, so I don't have to leave the Recommendations view to narrow results.

#### Acceptance Criteria

- **FRONTEND-030-AC-01** [AUTO]: `src/types/series.ts`'s `RecommendationQuery` interface shall gain `excludeKeywords?: string[]`.
- **FRONTEND-030-AC-02** [AUTO]: `seriesApi.ts`'s `buildRecommendationParams` shall include `excludeKeywords` (comma-joined) in its built params whenever `query.excludeKeywords` is non-empty, mirroring `excludeGenres`'s exact "include when present" handling.
- **FRONTEND-030-AC-03** [AUTO]: `ControlsState` shall gain `excludeKeywordsText: string` (initial `''`); `RecommendationControls`'s Filters section shall render an "Exclude Keywords" text input (`id="recommendation-exclude-keywords"`) immediately adjacent to the existing "Exclude Genres" input, using the identical comma-separated free-text markup/interaction pattern (`FRONTEND-011-AC-07`).
- **FRONTEND-030-AC-04** [AUTO]: `buildQuery` shall populate `RecommendationQuery.excludeKeywords` from `parseCommaList(state.excludeKeywordsText)` whenever the parsed list is non-empty, mirroring `excludeGenresText`'s exact handling — an empty field is omitted from the query entirely (`FRONTEND-011-AC-08`'s convention).
- **FRONTEND-030-AC-05** [AUTO]: `handleResetFilters` shall clear `excludeKeywordsText` to `''` along with every other Filters-section field it already resets.

---

### Requirement 2: Mode-Aware Min Vote Count Default (Highest Rated)

**User story**: As a user switching to "Highest Rated," I want the vote-count floor pre-filled to a meaningfully high value, so I don't have to know and type 200 myself every time — but I don't want that auto-fill to silently overwrite a value I've already deliberately chosen.

#### Acceptance Criteria

- **FRONTEND-030-AC-06** [AUTO]: `ControlsState` shall gain `minVoteCountTouched: boolean` (initial `false`), set to `true` whenever the user directly edits the `Min Vote Count` input.
- **FRONTEND-030-AC-07** [AUTO]: When `handleModeChange` transitions `state.mode` to `'topRated'` and `minVoteCountTouched` is `false`, `RecommendationControls` shall set `minVoteCount` to `'200'`.
- **FRONTEND-030-AC-08** [AUTO]: When `handleModeChange` transitions `state.mode` away from `'topRated'` (to any of the other four modes) and `minVoteCountTouched` is `false`, `RecommendationControls` shall reset `minVoteCount` to `''`.
- **FRONTEND-030-AC-09** [AUTO]: If `minVoteCountTouched` is `true` at the time of a mode change, `minVoteCount` shall be left unchanged by that mode change, regardless of direction (into or out of `'topRated'`).
- **FRONTEND-030-AC-10** [AUTO]: `handleResetFilters` shall clear `minVoteCount` to `''` and reset `minVoteCountTouched` to `false`, restoring the un-auto-filled state for the next mode change (see Design Decisions — `Reset Filters` does not itself re-trigger the `topRated` auto-fill even if the current mode is still `topRated` immediately afterward).

---

### Requirement 3: Sort By — Hidden for Popular Right Now

**User story**: As a user viewing "Popular Right Now" recommendations, I don't want to see a Sort By control that has no effect, so I'm not misled into thinking I can reorder results TMDB has already ranked for me.

#### Acceptance Criteria

- **FRONTEND-030-AC-11** [AUTO]: `RecommendationControls` shall not render the `Sort By` fieldset (`FRONTEND-019-AC-11`) at all when `state.mode === 'trending'` — a true no-op per `RecommendationService.recommend()`'s trending short-circuit (`series_spec_022`, `SERIES-022-AC-08`), so no sort selection is offered where none would have any effect.
- **FRONTEND-030-AC-12** [AUTO]: For every mode other than `'trending'`, the `Sort By` fieldset shall continue to render exactly as before (`FRONTEND-019-AC-11`/`AC-12`), unaffected by this AC.

---

### Requirement 4: Sort By — Relabel "Most Recommended" for Highest Rated

**User story**: As a user viewing "Highest Rated" recommendations, I want the "Most Recommended" option to describe what it actually orders by, so the choice isn't framed around a "recommended by N of your shows" signal that doesn't exist for this mode's candidates.

#### Acceptance Criteria

- **FRONTEND-030-AC-13** [AUTO]: When `state.mode === 'topRated'`, the `Sort By` fieldset's second radio option (`id="sort-by-recommendation-count"`) shall render its label as "Vote Average" instead of "Most Recommended".
- **FRONTEND-030-AC-14** [AUTO]: Selecting that relabeled option under `'topRated'` mode shall continue to set `query.sortBy = 'recommendationCount'` unchanged — no new `RecommendationQuery` value is introduced (see Design Decisions: this option is already functionally equivalent to "sort by vote average" for `topRated` candidates, with no backend change needed).
- **FRONTEND-030-AC-15** [AUTO]: For every mode other than `'topRated'` (where the fieldset is shown at all, i.e. every mode except `'trending'`), the `Sort By` fieldset's second option shall continue to render as "Most Recommended", unchanged.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `excludeKeywords` request param, mode-aware `minVoteCount` default of 200 for `topRated`, `resolveSortComparator`'s `totalSourceCount`/`rankScore` tie-break behavior this spec's label decision relies on | `series_spec_024_discover_filters_and_vote_threshold.md` |
| `excludeGenresText`/`parseCommaList` free-text pattern this spec mirrors, Filters section, `handleResetFilters`, `ControlsState` shape | `frontend_spec_011_recommendation_controls.md` |
| `Sort By` fieldset (`FRONTEND-019-AC-11`), `Best Match`/`Most Recommended` radios and their `sortBy` query wiring (`FRONTEND-019-AC-12`) | `frontend_spec_019_multi_source_recommendations.md` |
| Five-way mode selector including `'trending'`/`'topRated'`, `handleModeChange`'s existing mode-switch clearing behavior, mode-based visibility gating precedent (`minSourceRating` hidden per mode) | `frontend_spec_027_trending_and_top_rated_controls.md` |
| `sourceMode=trending`'s ranking-bypass (no ordering effect exists to sort by) | `series_spec_022_trending_and_top_rated_recommendations.md` |
| `RecommendationQuery` type, `buildRecommendationParams` | `src/types/series.ts`, `src/services/seriesApi.ts` |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (Requirement 1)

```typescript
describe('FRONTEND-030-AC-02: getRecommendations includes excludeKeywords', () => {
  it('joins excludeKeywords and passes it through to the query string', async () => {
    client.get.mockResolvedValue({ data: { data: [] } })

    await seriesApi.getRecommendations({ excludeKeywords: ['Zombie', 'Heist'] })

    expect(client.get).toHaveBeenCalledWith('/series/recommendations', {
      params: { excludeKeywords: 'Zombie,Heist' },
    })
  })
})
```

### `src/components/RecommendationControls.test.tsx` (Requirements 1–4)

```typescript
describe('FRONTEND-030-AC-03/04: Exclude Keywords filter field', () => {
  it('populates excludeKeywords from comma-separated free text', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    fireEvent.change(screen.getByLabelText(/exclude keywords/i), {
      target: { value: 'Zombie, Heist' },
    })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ excludeKeywords: ['Zombie', 'Heist'] }),
    )
  })
})

describe('FRONTEND-030-AC-05: Reset Filters clears Exclude Keywords', () => {
  it('clears the field and omits excludeKeywords from the next query', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    fireEvent.change(screen.getByLabelText(/exclude keywords/i), {
      target: { value: 'Zombie' },
    })
    fireEvent.click(screen.getByTestId('reset-filters-btn'))

    expect(screen.getByLabelText(/exclude keywords/i)).toHaveValue('')
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ excludeKeywords: expect.anything() }),
    )
  })
})

describe('FRONTEND-030-AC-07/08: mode-aware Min Vote Count auto-fill', () => {
  it('pre-fills 200 when switching to Highest Rated, reverts to empty when switching away', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    fireEvent.click(screen.getByLabelText(/highest rated/i))
    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(200)

    fireEvent.click(screen.getByLabelText(/^automatic/i))
    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(null)
  })
})

describe('FRONTEND-030-AC-09: a manually-edited Min Vote Count is never clobbered by a mode switch', () => {
  it('preserves a user-typed value across mode changes in either direction', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    fireEvent.click(screen.getByLabelText(/highest rated/i))
    fireEvent.change(screen.getByLabelText(/min vote count/i), {
      target: { value: '500' },
    })
    fireEvent.click(screen.getByLabelText(/^automatic/i))

    expect(screen.getByLabelText(/min vote count/i)).toHaveValue(500)
  })
})

describe('FRONTEND-030-AC-11: Sort By hidden under Popular Right Now', () => {
  it('renders Sort By under every mode except Popular Right Now', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)

    expect(screen.getByText(/^sort by$/i)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/popular right now/i))
    expect(screen.queryByText(/^sort by$/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-030-AC-13/14: "Vote Average" relabel under Highest Rated', () => {
  it('relabels the second Sort By option, keeping the same underlying value', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/highest rated/i))
    expect(screen.getByLabelText(/vote average/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/most recommended/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/vote average/i))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'recommendationCount' }),
    )
  })
})
```

**Test Case (Green)**: implement `excludeKeywordsText`/`minVoteCountTouched` state, the mode-change auto-fill/revert logic, and the `Sort By` fieldset's hide/relabel conditionals in `RecommendationControls.tsx`, plus `RecommendationQuery.excludeKeywords` and `buildRecommendationParams`'s wiring, until the tests above pass.

---

## Acceptance Criteria Summary

- [x] FRONTEND-030-AC-01: `RecommendationQuery.excludeKeywords`
- [x] FRONTEND-030-AC-02: `buildRecommendationParams` wires `excludeKeywords` (comma-joined)
- [x] FRONTEND-030-AC-03: "Exclude Keywords" text input, mirrors "Exclude Genres"
- [x] FRONTEND-030-AC-04: `buildQuery` populates `excludeKeywords` from parsed free text
- [x] FRONTEND-030-AC-05: `Reset Filters` clears `excludeKeywordsText`
- [x] FRONTEND-030-AC-06: `minVoteCountTouched` state, set on direct edit
- [x] FRONTEND-030-AC-07: switching to `topRated` pre-fills `minVoteCount` to `'200'` when untouched
- [x] FRONTEND-030-AC-08: switching away from `topRated` reverts `minVoteCount` to `''` when untouched
- [x] FRONTEND-030-AC-09: a touched `minVoteCount` is never overwritten by a mode change
- [x] FRONTEND-030-AC-10: `Reset Filters` clears `minVoteCount` and `minVoteCountTouched`
- [x] FRONTEND-030-AC-11: `Sort By` fieldset hidden under `'trending'`
- [x] FRONTEND-030-AC-12: `Sort By` fieldset unaffected for every other mode
- [x] FRONTEND-030-AC-13: "Vote Average" label under `'topRated'`
- [x] FRONTEND-030-AC-14: relabeled option still sends `sortBy: 'recommendationCount'`
- [x] FRONTEND-030-AC-15: "Most Recommended" label unchanged for every other mode
