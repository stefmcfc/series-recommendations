# Frontend Spec 140: Settings Clarity Pass — Keyword Suggestion Sort & Recommendation Favourites Scope

**Status**: Implemented
**Priority**: P3
**Depends on**: `frontend_spec_131_info_disclosure_boxes.md` (introduces the `InfoDisclosure` component and the `NumberInput.labelInfo`/`SettingsSection.info` sibling-of-label/heading hook-point pattern this spec reuses and extends to `KeywordPicker`), `frontend_spec_133_keyword_suggestions_and_analysis_recommendations_link.md` (introduces the "Keyword Suggestion Sort" radiogroup, "Minimum Series Count" field, and the `RecommendationControls.tsx` reactive-fetch pattern Requirement 6 extends to two more call sites), `tooling_spec_008_recommendation_controls_decomposition.md` (introduces `HighestRatedPanel.tsx`'s `fieldset`/`legend` "Sort By" pattern this spec's fieldset mirrors)
**Area**: Frontend (`components/SettingsPage.tsx`, `components/SettingsPage.module.css`, `components/KeywordPicker.tsx`, `components/KeywordPicker.module.css`, `components/CustomSearchPanel.tsx`, `components/SearchFilter.tsx` — plus each of those components' colocated `*.test.tsx`)

## Overview

`frontend_spec_131` added click-to-expand `InfoDisclosure` explainer boxes to seven non-obvious Settings controls, but missed an eighth: `SettingsPage.tsx`'s "Keyword Suggestion Sort" radiogroup has no visible heading at all today — only a screen-reader-only `aria-label`, so sighted users see two bare radio buttons under the Favourite Genres picker with no indication of what they control or that the effect reaches far beyond the "Recommendation Favourites" section they live in (they actually reorder keyword suggestions across every keyword field app-wide: Custom Search, Exclude Keywords fields, and the Favourite Keywords list immediately above them). A full audit of the rest of `SettingsPage.tsx` for the same "unexplained app-wide scope" problem found exactly one further gap: the "Recommendation Favourites" section's four pickers (Country/Language/Keyword/Genre Favourites) are themselves consumed well beyond recommendations — by My Series' own filter pickers and by the favourite-star badges on the Analysis page's Keywords/Genres tabs — which the section's name doesn't suggest. This spec fixes both gaps, purely presentationally: no backend change, and no change to `NameStatAggregator`'s actual sort/filter behavior.

As a related, explicitly-requested follow-on, this spec also gives `KeywordPicker` the same `labelInfo` "hook point" `NumberInput` already has (`frontend_spec_131`), and wires it onto Custom Search's "Browse Keywords" modal field — the one `KeywordPicker` instance in `CustomSearchPanel.tsx` with a visible, non-`hideInput` label — pointing back to where the sort/favourites settings this spec clarifies actually live.

**Requirement 6, added during live PR review of this spec's implementation (PR #279, not yet merged):** reviewing the shipped UI surfaced that the AC-02 `InfoDisclosure` copy's claim — that Keyword Suggestion Sort reorders suggestions "across every keyword field app-wide" — was not actually true. Two keyword-suggestion fetches never read `keywordSuggestionSortMode`/`keywordSuggestionMinSeriesCount` at all: `SettingsPage.tsx`'s own `keywordOptions` fetch (feeding the Favourite Keywords picker directly below the setting) and `SearchFilter.tsx`'s (feeding My Series' own "Keywords"/"Browse Keywords" fields) are both independent, mount-only, no-args calls to `seriesApi.getKeywordStats()`. `RecommendationFiltersBox.tsx` and `UseMySeriesPanel.tsx` were checked and are unaffected — both already share `RecommendationControls.tsx`'s reactive `keywordOptions` state, which does read the settings correctly. This is treated as completing `frontend_spec_133`'s already-stated intent (an app-wide setting) rather than a new feature, and is fixed in the same PR rather than a new spec, per explicit user direction during this review. A field reorder (Favourite Keywords moved beneath Favourite Genres, adjacent to the setting it affects) is bundled in for the same reason — it's what made the Favourite Keywords gap visible/obvious in the first place.

## Design Decisions

- **Fieldset/legend, not a heading-row `role="radiogroup"` div.** This codebase has two competing precedents for a labelled radio group with an adjacent `InfoDisclosure`: `HighestRatedPanel.tsx`'s plain `<fieldset><legend>Sort By</legend><InfoDisclosure/>...</fieldset>` (legend renders as its own block-level row, `InfoDisclosure` and the radio options wrap below it), and `UseMySeriesPanel.tsx`'s "Source Ranking Strategy" `role="radiogroup"`/`aria-labelledby` div with a `.fieldsetLegendRow` (adopted specifically so a heading span and `InfoDisclosure` could sit on the *same* visual row, which a real `<legend>` can never do). Keyword Suggestion Sort has no such same-row requirement — matching the Sort By precedent exactly (plain `fieldset`/`legend`, `InfoDisclosure` as its sibling, no `role="radiogroup"` wrapper) is the simpler, more consistent fix here. Confirmed safe: a repo-wide grep found no test anywhere queries `getByRole('radiogroup', { name: 'Keyword Suggestion Sort' })` or the `aria-label` text being removed — only `getByRole('radio', { name: ... })` queries exist against this control, which `fieldset`/`legend`'s native `name`-attribute grouping satisfies identically.
- **One InfoDisclosure per fieldset, not per-field** — mirrors `frontend_spec_131`'s own Sort By precedent (`FRONTEND-131-AC-08`, one disclosure covering both the Best Match/Most Recommended radios). The Minimum Series Count field, which only renders conditionally beneath the radios, is covered by the same fieldset-level disclosure and gets no `labelInfo` of its own.
- **`SettingsSection`'s existing `info` prop, not a new primitive**, for the Recommendation Favourites section-level gap — identical mechanism `frontend_spec_131` already built and wired onto Watch Region/Filter Profiles.
- **`KeywordPicker.labelInfo` mirrors `NumberInput.labelInfo` exactly**: optional, sibling-of-`<label>`, zero-diff when omitted — same rationale (a `<button>` nested inside a `<label>` would focus the associated input via the label's native click-through behavior).
- **Only the `browse-custom-search-keywords` instance is wired, not `recommendation-keywords`.** `CustomSearchPanel.tsx` has two `KeywordPicker` instances: the inline `recommendation-keywords` field uses `hideInput` and therefore renders no visible `<label>` at all (nothing for `labelInfo` to sit beside — `KeywordPicker.tsx`'s own `{!hideInput && <label>...}` gate already excludes it, confirmed by direct read); the "Browse Keywords" modal's `browse-custom-search-keywords` field has `hideInput` unset and a real visible label, so it's the only instance in this file `labelInfo` can attach to.
- **No scope creep beyond these two gaps.** Everything else audited in `SettingsPage.tsx` (Appearance/Theme, Accent Color, Card Tint, Refresh All, Export, Import, Watch Region, Filter Profiles) either already has an `InfoDisclosure` from `frontend_spec_131` or is self-explanatory — not revisited here.
- **No backend change of any kind.** `NameStatAggregator.java`'s sort/filter logic, and every endpoint it backs, are unchanged — this spec is purely explanatory/presentational UI.

---

## Requirement 1: Keyword Suggestion Sort gains a visible, explained heading

**User story**: As a user browsing Settings, I want to see a label on the "Most Common"/"Highest Rated" radio pair explaining what it controls and how far its effect reaches, so I don't mistake it for a sub-option of the Favourites pickers it happens to sit beside.

### FRONTEND-140-AC-01 [AUTO]
**Statement**: The `SettingsPage` component shall wrap its "Keyword Suggestion Sort" radio pair in `<fieldset className={styles.sortByFieldset}>` with a visible `<legend>Keyword Suggestion Sort</legend>`, replacing the current unlabelled `<div role="radiogroup" aria-label="Keyword Suggestion Sort">` wrapper; the two radio inputs (`keyword-suggestion-sort-most-common`/`keyword-suggestion-sort-highest-rated`, shared `name="keyword-suggestion-sort"`) and their `checked`/`onChange` bindings shall be otherwise unchanged.

**References**: `frontend/src/components/SettingsPage.tsx` lines 565-599 (current unlabelled radiogroup). Fieldset/legend shape mirrors `frontend/src/components/HighestRatedPanel.tsx` lines 40-41.

**Test Case (Red)**:
```tsx
describe('FRONTEND-140-AC-01: Keyword Suggestion Sort has a visible heading', () => {
  it('renders a "Keyword Suggestion Sort" group heading reachable by role', () => {
    render(<SettingsPage {...defaultProps} />)
    expect(
      screen.getByRole('group', { name: 'Keyword Suggestion Sort' }),
    ).toBeInTheDocument()
  })

  it('still renders both radios, checked/unchecked as before', () => {
    render(<SettingsPage {...defaultProps} />)
    expect(screen.getByRole('radio', { name: 'Most Common' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Highest Rated' })).not.toBeChecked()
  })
})
```
**Test Case (Green)**: replace the `role="radiogroup"` div with `<fieldset className={styles.sortByFieldset}><legend>Keyword Suggestion Sort</legend>...</fieldset>`.

---

### FRONTEND-140-AC-02 [AUTO]
**Statement**: The `SettingsPage` component shall render an `InfoDisclosure` as a sibling of the fieldset's `<legend>` (never nested inside it), labelled `About Keyword Suggestion Sort`, with a description explaining: (a) this setting reorders keyword suggestions across every keyword field app-wide — Custom Search's Keywords field, Exclude Keywords fields, and the Favourite Keywords list immediately above it — not only within "Recommendation Favourites"; and (b) Highest Rated sorts by each keyword's average rating across tracked series, subject to the Minimum Series Count floor below.

**References**: `frontend/src/components/SettingsPage.tsx` (fieldset from AC-01). Disclosure placement precedent: `frontend/src/components/HighestRatedPanel.tsx` lines 47-52 (`InfoDisclosure` immediately after `</legend>`, same `frontend_spec_131` `FRONTEND-131-AC-08` pattern).

**Test Case (Red)**:
```tsx
describe('FRONTEND-140-AC-02: Keyword Suggestion Sort has an info disclosure', () => {
  it('renders the disclosure button beside the fieldset legend', () => {
    render(<SettingsPage {...defaultProps} />)
    expect(
      screen.getByRole('button', { name: 'About Keyword Suggestion Sort' }),
    ).toBeInTheDocument()
  })

  it('explains the app-wide scope when opened', () => {
    render(<SettingsPage {...defaultProps} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'About Keyword Suggestion Sort' }),
    )
    expect(screen.getByText(/app-wide/i)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: render `<InfoDisclosure label="About Keyword Suggestion Sort" description="..." />` as a sibling of `</legend>`.

---

### FRONTEND-140-AC-03 [AUTO]
**Statement**: The "Minimum Series Count" `NumberInput` shall remain unchanged by this spec: it shall continue to render only while Highest Rated is selected, and shall not receive a `labelInfo` prop of its own — one fieldset-level `InfoDisclosure` (AC-02) covers both controls, mirroring the Sort By fieldset's single-disclosure-per-fieldset precedent.

**References**: `frontend/src/components/SettingsPage.tsx` lines 601-614 (current conditional `NumberInput`, unmodified).

**Test Case (Red)**:
```tsx
describe('FRONTEND-140-AC-03: Minimum Series Count has no field-level disclosure of its own', () => {
  it('renders the floor field with no "About Minimum Series Count" button', () => {
    render(<SettingsPage {...defaultProps} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Highest Rated' }))
    expect(screen.getByLabelText('Minimum Series Count')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /About Minimum Series Count/i }),
    ).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: no code change needed for this AC beyond AC-01/02 — it is a regression guard confirming the field itself is untouched.

---

### FRONTEND-140-AC-04 [MANUAL]
**Statement**: `SettingsPage.module.css` shall gain `.sortByFieldset` and `.sortByFieldset legend` rules resetting the fieldset's default browser border/padding/margin to `none`/`0`, and styling the legend as `font-size: 0.875rem; font-weight: 600; color: var(--text-h);` — matching the existing reset in `RecommendationControls.module.css` lines 163-178 exactly, so the new fieldset reads visually consistent with the established Sort By fieldset elsewhere in the app.

**References**: `frontend/src/components/RecommendationControls.module.css` lines 163-178 (`.sortByFieldset`/`.sortByFieldset legend`, the rules to copy).

**Verification**: visual check in browser (light and dark theme) confirming no default fieldset border/inset padding is visible around the Keyword Suggestion Sort group, and its legend's typography matches "Sort By"'s in Custom Search/Highest Rated panels. jsdom does not render CSS (see project convention), so this cannot be asserted via Vitest/RTL. Route to automating later: a visual-regression tool (not yet adopted in this project) could assert computed `border`/`padding` via a real browser engine.

---

## Requirement 2: Recommendation Favourites section explains its own app-wide scope

**User story**: As a user editing Country/Language/Keyword/Genre Favourites, I want to know these lists are used beyond recommendation scoring, so I'm not surprised when they also show up in My Series' filters or as star badges on the Analysis page.

### FRONTEND-140-AC-05 [AUTO]
**Statement**: The `SettingsPage` component shall pass an `info` prop to the "Recommendation Favourites" `SettingsSection`: an `InfoDisclosure` labelled `About Recommendation Favourites`, with a description explaining that Country/Language/Keyword/Genre Favourites are used throughout the app — not only for recommendation scoring — including as pinned suggestions in Custom Search's and My Series' filter pickers, and as the favourite-star badges shown on the Analysis page's Keywords and Genres tabs.

**References**: `frontend/src/components/SettingsPage.tsx` lines 501-504 (current `SettingsSection` with no `info` prop). `SettingsSection`'s `info` mechanism: `frontend/src/components/SettingsSection.tsx` (`frontend_spec_131` `FRONTEND-131-AC-04`). Confirmed consumers: `CustomSearchPanel.tsx`/`RecommendationFiltersBox.tsx` (`pinnedOptions`), `SearchFilter.tsx`/`UseMySeriesPanel.tsx` (My Series filter pickers), `KeywordsView.tsx`/`GenreStatsView.tsx`/`KeywordDetailModal.tsx`/`GenreDetailModal.tsx` (favourite-star badges).

**Test Case (Red)**:
```tsx
describe('FRONTEND-140-AC-05: Recommendation Favourites has an info disclosure', () => {
  it('renders the disclosure button beside the section heading', () => {
    render(<SettingsPage {...defaultProps} />)
    expect(
      screen.getByRole('button', { name: 'About Recommendation Favourites' }),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `info` prop at the referenced call site.

---

## Requirement 3: `KeywordPicker` gains a `labelInfo` hook point

**User story**: As a developer wiring `InfoDisclosure` onto a `KeywordPicker` field, I want a supported way to place it beside that field's visible label, the same way `NumberInput` already supports it.

### FRONTEND-140-AC-06 [AUTO]
**Statement**: `KeywordPickerProps` shall accept an optional `labelInfo?: ReactNode` prop. Where provided and `hideInput` is falsy, it shall render as a sibling of the existing `<label htmlFor={id}>{label}</label>` element (never as a descendant of it).

**References**: `frontend/src/components/KeywordPicker.tsx` line 269 (current label render: `{!hideInput && <label htmlFor={id}>{label}</label>}`). Prop shape mirrors `frontend/src/components/NumberInput.tsx` lines 34-39/124-135 (`labelInfo`, `frontend_spec_131` `FRONTEND-131-AC-03`).

**Test Case (Red)**:
```tsx
describe('FRONTEND-140-AC-06: KeywordPicker renders labelInfo beside, not inside, its label', () => {
  it('renders labelInfo as a sibling of the label, not a child', () => {
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        labelInfo={<InfoDisclosure label="About Keywords" description="..." />}
      />,
    )
    const label = screen.getByText('Keywords').closest('label')
    const infoButton = screen.getByRole('button', { name: 'About Keywords' })
    expect(label).not.toBeNull()
    expect(label?.contains(infoButton)).toBe(false)
  })
})
```
**Test Case (Green)**: add `labelInfo` to `KeywordPickerProps`; wrap `<label>` and `{labelInfo}` in a new sibling row (new `.labelRow` class in `KeywordPicker.module.css`, mirroring `NumberInput.module.css`'s own `.labelRow`).

---

### FRONTEND-140-AC-07 [AUTO]
**Statement**: Where `labelInfo` is omitted, or where `hideInput` is truthy, `KeywordPicker`'s rendered output shall be identical to today's — no new wrapping element, and no `InfoDisclosure` rendered, regardless of whether `labelInfo` was passed.

**References**: `frontend/src/components/KeywordPicker.tsx` line 269's existing `!hideInput` gate, unchanged by this spec.

**Test Case (Red)**:
```tsx
describe('FRONTEND-140-AC-07: KeywordPicker renders unchanged without labelInfo, or with hideInput set', () => {
  it('renders no extra button when labelInfo is omitted', () => {
    render(<KeywordPicker id="kw" label="Keywords" selected={[]} onChange={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('does not render labelInfo when hideInput is set, even if passed', () => {
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={vi.fn()}
        hideInput
        labelInfo={<InfoDisclosure label="About Keywords" description="..." />}
      />,
    )
    expect(
      screen.queryByRole('button', { name: 'About Keywords' }),
    ).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `labelInfo` renders inside the same `{!hideInput && ...}` conditional as `<label>` itself.

---

## Requirement 4: Wire `labelInfo` onto Custom Search's "Browse Keywords" modal field

**User story**: As a user browsing keywords in Custom Search's "Browse Keywords" modal, I want a pointer back to where keyword suggestion order and pinned favourites are configured, so I know where to change that behavior if I want to.

### FRONTEND-140-AC-08 [AUTO]
**Statement**: The `browse-custom-search-keywords` `KeywordPicker` instance in `CustomSearchPanel.tsx` (the "Browse Keywords" modal's keyword field) shall pass `labelInfo={<InfoDisclosure label="About Keywords" description="..." />}`, with a description pointing back to Settings → Recommendation Favourites as where keyword suggestion sort order and pinned Favourite Keywords are configured.

**References**: `frontend/src/components/CustomSearchPanel.tsx` lines 352-363 (the `browse-custom-search-keywords` instance, visible label, no `hideInput`).

**Test Case (Red)**:
```tsx
describe('FRONTEND-140-AC-08: Browse Keywords modal field has an info disclosure', () => {
  it('renders the disclosure button beside the modal keyword field', () => {
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={['heist']}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /browse all keywords/i }))
    expect(
      within(screen.getByRole('dialog', { name: /browse keywords/i })).getByRole(
        'button',
        { name: 'About Keywords' },
      ),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `labelInfo` prop at the referenced call site.

---

### FRONTEND-140-AC-09 [AUTO]
**Statement**: The `recommendation-keywords` `KeywordPicker` instance in `CustomSearchPanel.tsx` (the inline Keywords field, `hideInput`) shall not receive a `labelInfo` prop and shall render no `InfoDisclosure` of its own, since `hideInput` suppresses its visible label entirely (`FRONTEND-140-AC-07`).

**References**: `frontend/src/components/CustomSearchPanel.tsx` lines 191-200 (the `recommendation-keywords` instance, `hideInput`).

**Test Case (Red)**:
```tsx
describe('FRONTEND-140-AC-09: the inline hideInput Keywords field gains no disclosure', () => {
  it('renders no "About Keywords" button before the Browse Keywords modal is opened', () => {
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={['heist']}
      />,
    )
    expect(
      screen.queryByRole('button', { name: 'About Keywords' }),
    ).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: no code change at this call site — confirms it is deliberately left as-is.

---

## Requirement 5: No backend behavior regression

**User story**: As a maintainer, I want confirmation that this presentational-only pass doesn't alter keyword sort/filter behavior, so the spec's explanatory claims (AC-02) stay true.

### FRONTEND-140-AC-10 [AUTO]
**Statement**: `NameStatAggregator`'s sort/filter behavior, and every backend endpoint it backs (`GET /series/keywords`'s `sortBy`/`sortDirection`/`minSeriesCount` params), shall remain unchanged by this spec — no backend file is modified.

**References**: `backend/src/main/java/uk/co/stefirby/seriestracker/service/stats/NameStatAggregator.java`, `backend/src/test/groovy/uk/co/stefirby/seriestracker/service/stats/NameStatAggregatorSpec.groovy` (existing coverage, unmodified by this spec).

**Test Case (confirm, not red/green)**:
```groovy
// No new Spock spec is added for this AC. Running the existing suite unchanged
// (gradlew.bat test) and confirming NameStatAggregatorSpec's existing cases still
// pass is the verification — this spec touches zero backend files.
```
This AC passes by construction (no backend diff in this spec's changeset) — if a review of the final diff shows any file under `backend/src/main` touched, stop and re-verify this spec's scope before proceeding.

---

## Requirement 6: The setting applies everywhere its own copy claims it does

**User story**: As a user who just changed Keyword Suggestion Sort, I want every keyword-suggestion field in the app — including the Favourite Keywords picker right next to the setting, and My Series' own Keywords filter — to actually reflect my choice, not just the Custom Search fields that happened to already be wired.

### FRONTEND-140-AC-11 [AUTO]
**Statement**: In `SettingsPage.tsx`'s "Recommendation Favourites" section, the "Favourite Keywords" `KeywordPicker` (currently rendered before "Favourite Genres") shall be reordered to render immediately after "Favourite Genres" — i.e. Country Favourites, Language Favourites, Favourite Genres, Favourite Keywords, then the Keyword Suggestion Sort fieldset — so the picker whose suggestion order the setting controls sits adjacent to that setting. The existing `favouritesDivider` between each picker is preserved (moved along with its picker, not duplicated or dropped).

**References**: `frontend/src/components/SettingsPage.tsx` lines ~537-560 (current Favourite Keywords / Favourite Genres blocks and their dividers, to be reordered; no prop changes to either `KeywordPicker`).

**Test Case (Red)**:
```tsx
describe('FRONTEND-140-AC-11: Recommendation Favourites field order', () => {
  it('renders Favourite Genres before Favourite Keywords, immediately before the Sort fieldset', () => {
    render(<SettingsPage {...defaultProps} />)
    const labels = screen.getAllByText(/Favourites?$/).map((el) => el.textContent)
    const genresIndex = labels.indexOf('Favourite Genres')
    const keywordsIndex = labels.indexOf('Favourite Keywords')
    expect(genresIndex).toBeGreaterThan(-1)
    expect(keywordsIndex).toBeGreaterThan(genresIndex)
  })
})
```
**Test Case (Green)**: swap the two JSX blocks (and their dividers) in place.

---

### FRONTEND-140-AC-12 [AUTO]
**Statement**: `SettingsPage.tsx`'s own `keywordOptions` fetch (currently a mount-only, no-args `seriesApi.getKeywordStats()` call feeding the "Favourite Keywords" picker) shall become reactive to the same `keywordSuggestionSortMode`/`keywordSuggestionMinSeriesCount` state this component already reads for the Keyword Suggestion Sort fieldset — passing `{ sortBy: 'averageBlendedRating', sortDirection: 'desc', minSeriesCount }` when mode is `'highestRated'`, `undefined` otherwise — and re-fetching whenever either value changes, mirroring `RecommendationControls.tsx`'s existing identical effect (`FRONTEND-133-AC-04`) exactly.

**References**: `frontend/src/components/SettingsPage.tsx` lines 183-190 (current mount-only effect) and lines ~165-175 (existing `keywordSuggestionSortMode`/`keywordSuggestionMinSeriesCount` state, already in scope — no new `useLocalStorage` reads needed). Pattern to mirror: `frontend/src/components/RecommendationControls.tsx` lines 1105-1118.

**Test Case (Red)**:
```tsx
describe('FRONTEND-140-AC-12: Favourite Keywords options follow the sort setting', () => {
  it('re-fetches with sortBy/minSeriesCount params when Highest Rated is selected', async () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    localStorage.setItem('keywordSuggestionMinSeriesCount', JSON.stringify(3))
    const spy = vi.spyOn(seriesApi, 'getKeywordStats').mockResolvedValue([])
    render(<SettingsPage {...defaultProps} />)
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        sortBy: 'averageBlendedRating',
        sortDirection: 'desc',
        minSeriesCount: 3,
      }),
    )
  })

  it('fetches with no params when Most Common (default) is selected', async () => {
    const spy = vi.spyOn(seriesApi, 'getKeywordStats').mockResolvedValue([])
    render(<SettingsPage {...defaultProps} />)
    await waitFor(() => expect(spy).toHaveBeenCalledWith(undefined))
  })
})
```
**Test Case (Green)**: replace the `[]`-deps effect with one depending on `[keywordSuggestionSortMode, keywordSuggestionMinSeriesCount]`, building the same conditional options object `RecommendationControls.tsx` already builds.

---

### FRONTEND-140-AC-13 [AUTO]
**Statement**: `SearchFilter.tsx`'s `keywordOptions` fetch (feeding its "Keywords" field and "Browse Keywords" modal, currently a mount-only, no-args `seriesApi.getKeywordStats()` call) shall become reactive to `keywordSuggestionSortMode`/`keywordSuggestionMinSeriesCount` in the same way as AC-12, reading both via `useLocalStorage` (imported from `RecommendationControls.tsx`'s exported `isKeywordSuggestionSortMode`/`DEFAULT_KEYWORD_SUGGESTION_SORT_MODE`/`isKeywordSuggestionMinSeriesCount`/`DEFAULT_KEYWORD_SUGGESTION_MIN_SERIES_COUNT`, since `SearchFilter.tsx` has no prior local copies of these). The existing `.catch(() => setKeywordOptionsError(...))` error-handling behavior is preserved unchanged.

**References**: `frontend/src/components/SearchFilter.tsx` lines 274-317 (current independent state/effect, error handling to preserve). Pattern/exports to reuse: `frontend/src/components/RecommendationControls.tsx` lines 134-163 (types/constants/validators) and 1105-1118 (the effect shape).

**Test Case (Red)**:
```tsx
describe('FRONTEND-140-AC-13: My Series Keywords filter options follow the sort setting', () => {
  it('re-fetches with sortBy/minSeriesCount params when Highest Rated is selected', async () => {
    localStorage.setItem('keywordSuggestionSortMode', JSON.stringify('highestRated'))
    localStorage.setItem('keywordSuggestionMinSeriesCount', JSON.stringify(5))
    const spy = vi.spyOn(seriesApi, 'getKeywordStats').mockResolvedValue([])
    render(<SearchFilter {...defaultProps} />)
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        sortBy: 'averageBlendedRating',
        sortDirection: 'desc',
        minSeriesCount: 5,
      }),
    )
  })

  it('still sets the existing error message on fetch failure', async () => {
    vi.spyOn(seriesApi, 'getKeywordStats').mockRejectedValue(new Error('fail'))
    render(<SearchFilter {...defaultProps} />)
    expect(
      await screen.findByText('Failed to load keyword filter options. Please try again.'),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the two `useLocalStorage` reads and rebuild the effect/dependency array as in AC-12, keeping the existing `.catch()` body untouched.

---

### FRONTEND-140-AC-14 [AUTO]
**Statement**: The AC-02 `InfoDisclosure` description shall be updated to also name My Series' Keywords filter among the fields the setting affects, so the copy accurately reflects AC-13's fix (it already names Custom Search's Keywords field, Exclude Keywords fields, and the Favourite Keywords list).

**References**: `frontend/src/components/SettingsPage.tsx` (the AC-02 `InfoDisclosure` description string, introduced earlier in this spec).

**Test Case (Red)**:
```tsx
describe('FRONTEND-140-AC-14: Keyword Suggestion Sort disclosure names My Series too', () => {
  it('mentions My Series in the opened description', () => {
    render(<SettingsPage {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'About Keyword Suggestion Sort' }))
    expect(screen.getByText(/My Series/i)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: extend the description string with the My Series Keywords filter mention.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `InfoDisclosure` component, `NumberInput.labelInfo`/`SettingsSection.info` sibling-of-label pattern this spec reuses/extends | `frontend_spec_131_info_disclosure_boxes.md` |
| "Keyword Suggestion Sort"/"Minimum Series Count" controls this spec clarifies (introduced, unchanged in behavior) | `frontend_spec_133_keyword_suggestions_and_analysis_recommendations_link.md` |
| `HighestRatedPanel.tsx`'s `fieldset`/`legend` "Sort By" shape, mirrored by AC-01/02 | `tooling_spec_008_recommendation_controls_decomposition.md` |
| `role="radiogroup"`/`aria-labelledby` alternative, considered and rejected for this control (no same-row heading/disclosure requirement here) | `UseMySeriesPanel.tsx`'s "Source Ranking Strategy" fieldset (`frontend_spec_132`) |
| Country/Language/Keyword/Genre Favourites app-wide consumers named in AC-05 | `CustomSearchPanel.tsx`, `RecommendationFiltersBox.tsx`, `SearchFilter.tsx`, `UseMySeriesPanel.tsx`, `KeywordsView.tsx`, `GenreStatsView.tsx`, `KeywordDetailModal.tsx`, `GenreDetailModal.tsx` |
| Idea origin | `.claude/SPEC_CANDIDATES.md` ("Settings clarity pass" entry, removed once this spec was written) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-140-AC-01: Keyword Suggestion Sort wrapped in a `fieldset`/`legend`, radios unchanged
- [x] FRONTEND-140-AC-02: fieldset gains an `InfoDisclosure` explaining its app-wide scope and Highest Rated's meaning
- [x] FRONTEND-140-AC-03: Minimum Series Count field itself is unchanged, no field-level disclosure of its own
- [x] FRONTEND-140-AC-04: `.sortByFieldset`/`.sortByFieldset legend` CSS added to `SettingsPage.module.css`, matching the existing reset [MANUAL — CSS written and copied verbatim from the established `RecommendationControls.module.css` precedent; not yet visually confirmed in a real browser in this session (no browser-automation tool available) — still needs the quick light/dark-theme visual check called for in the Verification note]
- [x] FRONTEND-140-AC-05: "Recommendation Favourites" section gains an `info` disclosure explaining its app-wide scope
- [x] FRONTEND-140-AC-06: `KeywordPicker` gains an optional `labelInfo` prop, rendered as a sibling of `<label>`
- [x] FRONTEND-140-AC-07: `KeywordPicker` renders unchanged when `labelInfo` is omitted or `hideInput` is set
- [x] FRONTEND-140-AC-08: `browse-custom-search-keywords` instance gets a `labelInfo` disclosure pointing back to Settings
- [x] FRONTEND-140-AC-09: `recommendation-keywords` instance gains no disclosure (regression guard)
- [x] FRONTEND-140-AC-10: `NameStatAggregator`'s behavior is unchanged — no backend file modified
- [x] FRONTEND-140-AC-11: Favourite Keywords reordered beneath Favourite Genres, adjacent to the Sort fieldset
- [x] FRONTEND-140-AC-12: Settings' own Favourite Keywords options now follow the sort/filter setting
- [x] FRONTEND-140-AC-13: My Series' Keywords filter options now follow the sort/filter setting
- [x] FRONTEND-140-AC-14: Keyword Suggestion Sort disclosure copy updated to name My Series too
