# Frontend Spec 094: Recommendations Page Polish — Disclosure Grouping, Keyword Pickers, Vote Count Validation

**Status**: Complete
**Priority**: P3
**Depends on**: none
**Area**: Frontend (`components/RecommendationControls.tsx`, `components/RecommendationControls.module.css`, `components/RecommendationFiltersBox.tsx`, `components/CustomSearchPanel.tsx`, `components/UseMySeriesPanel.tsx` (test helper only), `components/KeywordPicker.tsx` (no change, reused))

## Overview

Four unrelated Recommendations-page items raised together, bundled into one spec since all four touch the same handful of files. First: "Filter & sort my series" (`UseMySeriesPanel`) and "Recommendations Filters" (`RecommendationFiltersBox`) share a `.filtersBody` class for their expanded content, but nothing visually ties that content back to the toggle that opens/closes it — a left-hand line, the explicit request, groups them and signals "this collapses back together." Second: Custom Search's Keywords field is the one remaining inline-typeable Keywords field in this app — `UseMySeriesPanel`'s own Keywords field already moved to a `hideInput` + "Browse all keywords" CTA pattern (`frontend_spec_077`); this brings Custom Search in line, with one deliberate difference explained in Design Decisions. Third, closing an existing, already-confirmed `SPEC_CANDIDATES.md` item: `RecommendationFiltersBox`'s "Exclude Keywords" is still a plain comma-separated text input — every sibling exclude/include field in this app (Genres, Keywords elsewhere) already uses `KeywordPicker`/`GenreIncludeExcludePicker`. Fourth: "Min Vote Count" accepts negative numbers and decimals with no feedback at all today.

## Design Decisions

- **The left-border grouping line targets `.filtersBody` directly** — confirmed via reading both components that `UseMySeriesPanel` and `RecommendationFiltersBox` render their expanded content through the exact same CSS Modules class (`styles.filtersBody`, both importing `RecommendationControls.module.css`), so one CSS rule change covers both named areas at once, with no per-component change needed.
- **Custom Search's Keywords field keeps `allowFreeText` — but only inside the new "Browse all keywords" modal, not the inline field.** This is a deliberate, load-bearing difference from `UseMySeriesPanel`'s otherwise-identical pattern, not an oversight: confirmed via reading the code that `keywordOptions` (the suggestion list both panels' Keywords fields draw from) comes from the same source for both — `KeywordStatsService`'s aggregation of the *user's own tracked series'* keywords, not TMDB's global keyword vocabulary. For `UseMySeriesPanel`, that's exactly the right, complete vocabulary (it's filtering the user's own series, which can only ever carry keywords already in that list) — free text there is genuinely useless, per that spec's own reasoning. For Custom Search, the field drives TMDB discovery, where the reachable keyword space is far larger than anything the user has tracked — removing free-text entirely would be a real capability loss (no more discovering shows by a keyword you've never tagged yourself). Keeping `allowFreeText` on the modal's own `KeywordPicker` instance (mirroring the *inline* field's current `allowFreeText`, just relocated) preserves that capability while still decluttering the inline UI into a CTA, which is what the request is actually after.
- **The "Browse all keywords" modal for Custom Search is new, componentised the same way `UseMySeriesPanel`'s is** — a component-local `useState(false)` (never lifted into `ControlsState`, matching `UseMySeriesPanel`'s `specificSeriesKeywordsBrowseModalOpen` precedent exactly), same overlay/dialog/Escape-to-dismiss/Done-button shape.
- **Exclude Keywords becomes a second, independent `KeywordPicker` instance with `allowFreeText`** — not `hideInput`, for the same reason as Custom Search's modal above: this field excludes *candidates* from recommendation output by keyword, which is TMDB's keyword space, not the user's tracked-only vocabulary. No combined include/exclude widget is introduced (unlike Genres' `GenreIncludeExcludePicker`) — there's no corresponding "include" concept for this specific box's Exclude Keywords field (the app's *include*-keywords fields live in `CustomSearchPanel`/`UseMySeriesPanel`, functionally unrelated), so a plain exclude-only `KeywordPicker` is the minimal, correct shape, matching `SPEC_CANDIDATES.md`'s own note that this "needs no extraction work."
- **`ControlsState.excludeKeywordsText: string` becomes `excludeKeywordsSelected: string[]`** — a type change, not an addition, rippling through every place that reads or writes it: `RecommendationControls.tsx` (`ControlsState`, `initialState`, `applyExcludeAndMiscFilters`'s query-building — the `parseCommaList` call is replaced with a direct `.length > 0` check, and `parseCommaList` itself is deleted as dead code once this was its only caller), `RecommendationFiltersBox.tsx` (`countActiveFilters`, `handleResetFilters`, the field's own render), and — easy to miss — **every test file with its own local `makeState` helper** (`RecommendationControls.test.tsx`, `RecommendationFiltersBox.test.tsx`, `CustomSearchPanel.test.tsx`, `UseMySeriesPanel.test.tsx` all independently redeclare the full `ControlsState` shape rather than sharing one factory) needs its `excludeKeywordsText: ''` line updated to `excludeKeywordsSelected: []`, or those files won't type-check.
- **`countActiveFilters` (`frontend_spec_093`) needs updating for the new field shape** — it currently checks `state.excludeKeywordsText.trim() !== ''`; this becomes `state.excludeKeywordsSelected.length > 0`, joining the other array-typed fields it already checks that way (`excludeGenresSelected`, `countriesSelected`). Flagged explicitly since this is exactly the kind of easy-to-silently-break interaction between two specs landing back to back that's worth calling out rather than leaving implicit.
- **Min Vote Count validation is advisory (inline error message), not submission-blocking.** Confirmed via reading `RecommendationControls.tsx`: "Get Recommendations" is disabled only while `loading` — no field ever gates it today, in this component, unlike `Add`/`EditSeriesForm`'s real `validate()`-before-submit gate. Introducing a blocking gate here would be a materially bigger, first-of-its-kind change to this specific component's architecture, well beyond what "needs validation" calls for. An inline error (mirroring `EditSeriesForm.module.css`'s `.fieldError` style — color/font-size only, added fresh to `RecommendationControls.module.css` since no equivalent class exists there yet) gives real, visible feedback; the query-builder additionally omits an invalid value from the request rather than forwarding it, as a lightweight backstop.
- **`min="0" step="1"` HTML attributes are added alongside the JS validation, not instead of it** — matches `minTmdbRating`'s own existing `min`/`max`/`step` convention in this exact file, for spinner/keyboard-arrow correctness. Confirmed this alone would not be sufficient: this codebase has no `:invalid` CSS styling anywhere, so a native constraint violation from directly typing a bad value would be invisible without the JS-driven message.
- **The left-border grouping (Requirement 1) is `[MANUAL]`** — a pure CSS visual change, no new DOM structure or state, consistent with how every other CSS-only visual change in this project's recent specs (`frontend_spec_090`/`091`/`092`) has been marked, even where jsdom could in principle resolve a static (non-layout-dependent) property. Every other requirement here is `[AUTO]` — normal DOM/state/event behavior, fully testable.

## Requirements

### Requirement 1: Visual grouping line on expanded disclosures

**User Story**: As a user, I want a visual cue that everything inside an expanded "Filter & sort my series"/"Recommendations Filters" section belongs together and collapses back as one unit.

#### FRONTEND-094-AC-01 [MANUAL]: Expanded filter sections show a left-hand grouping line
**Statement**: While a `.filtersBody` disclosure is expanded, it shall render a visible line down its left-hand side.

**Rationale**: The explicit request, for both named areas at once (they share the same underlying CSS class).

**Verification**: Manual check in browser — expand "Filter & sort my series" on Recommendations' Use My Series tab, and "Recommendations Filters" on either tab; confirm both show a left border visually connecting the toggle to its content.

**References**:
- CSS: `components/RecommendationControls.module.css`'s `.filtersBody` (currently `display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 1rem; margin-top: 1rem;`, no border)

**Test Case (Green)**: add `border-left: 2px solid var(--border); padding-left: 1rem;` to `.filtersBody`.

### Requirement 2: Custom Search Keywords becomes a "Browse all keywords" CTA

**User Story**: As a user, I want Custom Search's Keywords field decluttered into a CTA like the rest of this app's keyword fields, without losing the ability to discover shows by a keyword I haven't tracked myself.

#### FRONTEND-094-AC-02 [AUTO]: Inline Keywords field no longer renders a text input
**Statement**: `CustomSearchPanel` shall render its Keywords field with `hideInput`, suppressing the inline typing box.

**Rationale**: The explicit request — matches `UseMySeriesPanel`'s existing Keywords field treatment.

**References**:
- Component: `components/CustomSearchPanel.tsx` (`<KeywordPicker id="recommendation-keywords" ... allowFreeText placeholder="Type a keyword and press Enter" />`)
- Precedent: `components/UseMySeriesPanel.tsx`'s own Keywords field (`hideInput`, `frontend_spec_077`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-094-AC-02: inline Keywords field has no text input', () => {
  it('does not render a typeable Keywords input', () => {
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    expect(screen.queryByRole('textbox', { name: 'Keywords' })).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `hideInput` to the inline `KeywordPicker` and drop its now-redundant `placeholder`/`allowFreeText` (those move to the modal's own instance, AC-04).

#### FRONTEND-094-AC-03 [AUTO]: A "Browse all keywords" button opens a modal
**Statement**: When the "Browse all keywords" button is clicked, `CustomSearchPanel` shall open a keywords browse dialog.

**Rationale**: The CTA the inline input is replaced with, mirroring `UseMySeriesPanel`'s equivalent button/modal pairing exactly.

**Test Case (Red)**:
```typescript
describe('FRONTEND-094-AC-03: Browse all keywords opens a modal', () => {
  it('opens a dialog when the browse button is clicked', () => {
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={vi.fn()}
        genreOptions={[]}
        keywordOptions={['heist']}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /browse all keywords/i }))
    expect(screen.getByRole('dialog', { name: /browse keywords/i })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add a component-local `const [keywordsBrowseModalOpen, setKeywordsBrowseModalOpen] = useState(false)` (never lifted into `ControlsState`, matching `UseMySeriesPanel`'s `specificSeriesKeywordsBrowseModalOpen`), a "Browse all keywords" button beneath the (now-hidden-input) field, and the modal itself copying `UseMySeriesPanel`'s "Browse Keywords" modal shape verbatim (overlay, `role="dialog"`, `aria-modal`, Escape-to-dismiss, heading, `KeywordPicker`, Done button).

#### FRONTEND-094-AC-04 [AUTO]: The modal's picker still accepts a free-typed keyword
**Statement**: Where a typed value has no match in `keywordOptions`, the "Browse all keywords" modal's `KeywordPicker` shall still accept it as a selection.

**Rationale**: The load-bearing difference from `UseMySeriesPanel`'s otherwise-identical modal (Design Decisions) — this is what preserves TMDB-wide keyword discovery once the inline free-text box is gone.

**Test Case (Red)**:
```typescript
describe('FRONTEND-094-AC-04: modal keyword picker accepts free text', () => {
  it('accepts a typed keyword with no match in keywordOptions', () => {
    const updateState = vi.fn()
    render(
      <CustomSearchPanel
        state={makeState()}
        updateState={updateState}
        genreOptions={[]}
        keywordOptions={['heist']}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /browse all keywords/i }))
    const input = screen.getByRole('textbox', { name: 'Keywords' })
    fireEvent.change(input, { target: { value: 'time travel' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(updateState).toHaveBeenCalledWith({ keywordsSelected: ['time travel'] })
  })
})
```

**Test Case (Green)**: the modal's `KeywordPicker` instance carries `allowFreeText` (moved from the old inline field, per AC-02's Green step).

### Requirement 3: Exclude Keywords becomes a `KeywordPicker`

**User Story**: As a user, I want to exclude keywords the same way I already exclude genres — picking/typing chips, not typing a comma-separated string.

#### FRONTEND-094-AC-05 [AUTO]: Exclude Keywords renders as a `KeywordPicker`
**Statement**: `RecommendationFiltersBox` shall render its Exclude Keywords field as a `KeywordPicker` instead of a plain text input.

**Rationale**: Closes `SPEC_CANDIDATES.md`'s "Exclude Keywords filter — KeywordPicker instead of free text" item — every sibling include/exclude field in this app already uses this pattern.

**References**:
- Component: `components/RecommendationFiltersBox.tsx` (`<input id="recommendation-exclude-keywords" type="text" value={state.excludeKeywordsText} onChange={updateField('excludeKeywordsText')} />`)
- Type: `ControlsState.excludeKeywordsText: string` → `excludeKeywordsSelected: string[]` (see Design Decisions for the full ripple)
- Backend: `dto/RecommendationCriteria.java`'s `excludeKeywords: List<String>` (already exists, already wired — no backend change)

**Test Case (Red)**:
```typescript
describe('FRONTEND-094-AC-05: Exclude Keywords renders as a KeywordPicker', () => {
  it('renders a Keywords chip picker, not a plain text input', () => {
    renderBox({ state: makeState({ excludeKeywordsSelected: ['spoilers'] }) })
    fireEvent.click(screen.getByRole('button', { name: /recommendations filters/i }))
    expect(screen.getByText('spoilers')).toBeInTheDocument()
    expect(screen.queryByLabelText('Exclude Keywords')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: replace the `<input>` with `<KeywordPicker id="recommendation-exclude-keywords" label="Exclude Keywords" selected={state.excludeKeywordsSelected} onChange={(next) => updateState({ excludeKeywordsSelected: next })} allowFreeText />`.

#### FRONTEND-094-AC-06 [AUTO]: Selecting an exclude keyword is sent in the recommendations query
**Statement**: While `excludeKeywordsSelected` is non-empty, `buildQuery` shall include those values in `RecommendationQuery.excludeKeywords`.

**Rationale**: Regression guard for the query-builder change (`parseCommaList` → direct array pass-through).

**Test Case (Red)**:
```typescript
describe('FRONTEND-094-AC-06: excludeKeywordsSelected reaches the query', () => {
  it('includes excludeKeywords in the built query', () => {
    const query = buildQuery(makeState({ excludeKeywordsSelected: ['spoilers', 'reality tv'] }))
    expect(query.excludeKeywords).toEqual(['spoilers', 'reality tv'])
  })
})
```

**Test Case (Green)**: in `applyExcludeAndMiscFilters`, replace `const excludeKeywords = parseCommaList(state.excludeKeywordsText); if (excludeKeywords.length > 0) query.excludeKeywords = excludeKeywords` with `if (state.excludeKeywordsSelected.length > 0) query.excludeKeywords = state.excludeKeywordsSelected`. Delete `parseCommaList` (dead code once this was its only caller).

#### FRONTEND-094-AC-07 [AUTO]: Reset Filters clears the selected exclude keywords
**Statement**: When "Reset Filters" is clicked, `RecommendationFiltersBox` shall clear `excludeKeywordsSelected` to an empty array.

**Rationale**: Regression guard — `handleResetFilters` currently resets the old `excludeKeywordsText` field; must reset the renamed one instead.

**Test Case (Red)**:
```typescript
describe('FRONTEND-094-AC-07: Reset Filters clears excludeKeywordsSelected', () => {
  it('calls updateState with excludeKeywordsSelected: []', () => {
    const updateState = vi.fn()
    renderBox({ state: makeState({ excludeKeywordsSelected: ['spoilers'] }), updateState })
    fireEvent.click(screen.getByRole('button', { name: /^recommendations filters/i }))
    fireEvent.click(screen.getByTestId('reset-filters-btn'))
    expect(updateState).toHaveBeenCalledWith(
      expect.objectContaining({ excludeKeywordsSelected: [] }),
    )
  })
})
```

**Test Case (Green)**: update `handleResetFilters`'s reset object to `excludeKeywordsSelected: []` in place of `excludeKeywordsText: ''`.

#### FRONTEND-094-AC-08 [AUTO]: Active-filter count still reflects Exclude Keywords correctly
**Statement**: While `excludeKeywordsSelected` is non-empty, `countActiveFilters` shall count it as one active filter.

**Rationale**: Regression guard for `frontend_spec_093`'s active-filter-count badge, which currently checks the old `excludeKeywordsText` field shape — this AC exists specifically because it's easy to silently break this interaction between two specs landing back to back.

**Test Case (Red)**:
```typescript
describe('FRONTEND-094-AC-08: active-filter count reflects excludeKeywordsSelected', () => {
  it('counts a non-empty excludeKeywordsSelected as one active filter', () => {
    renderBox({ state: makeState({ excludeKeywordsSelected: ['spoilers'] }) })
    expect(screen.getByTestId('filters-active-count')).toHaveTextContent('1')
  })
})
```

**Test Case (Green)**: in `countActiveFilters`, move `excludeKeywordsSelected` from the `stringFields` array (checked via `.trim() !== ''`) into the `arrayFields` array (checked via `.length > 0`), alongside `excludeGenresSelected`/`countriesSelected`.

### Requirement 4: Min Vote Count validation

**User Story**: As a user, I want Min Vote Count to reject negative numbers and decimals, since a vote count is always a non-negative whole number.

#### FRONTEND-094-AC-09 [AUTO]: Negative Min Vote Count shows an inline error
**Statement**: If Min Vote Count is provided and is negative, then `RecommendationFiltersBox` shall display an inline error next to the field.

**Rationale**: The explicit request — today a negative value is silently accepted and forwarded.

**References**:
- Component: `components/RecommendationFiltersBox.tsx` (`handleMinVoteCountChange`, the `<input id="recommendation-min-vote-count" type="number">`)
- CSS: new `.fieldError` class in `RecommendationControls.module.css` (no equivalent exists there yet), mirroring `EditSeriesForm.module.css`'s `.fieldError` (`color: #b91c1c; font-size: 0.8125rem;`, plus a dark-mode `#fca5a5` variant)

**Test Case (Red)**:
```typescript
describe('FRONTEND-094-AC-09: negative Min Vote Count shows an inline error', () => {
  it('shows an error for a negative value', () => {
    renderBox()
    fireEvent.click(screen.getByRole('button', { name: /^recommendations filters/i }))
    fireEvent.change(screen.getByLabelText('Min Vote Count'), { target: { value: '-5' } })
    expect(
      screen.getByText(/min vote count must be a whole number of at least 0/i),
    ).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add a derived `minVoteCountError` in `RecommendationFiltersBox` (`state.minVoteCount.trim() !== '' && (!Number.isInteger(Number(state.minVoteCount)) || Number(state.minVoteCount) < 0)` → `'Min vote count must be a whole number of at least 0'`), rendered as `<span className={styles.fieldError}>{minVoteCountError}</span>` beneath the field. Add `min="0" step="1"` to the input (matching `minTmdbRating`'s own `min`/`max`/`step` convention).

#### FRONTEND-094-AC-10 [AUTO]: Decimal Min Vote Count shows the same inline error
**Statement**: If Min Vote Count is provided and is not a whole number, then `RecommendationFiltersBox` shall display the same inline error next to the field.

**Rationale**: Same fix as AC-09, for the other invalid shape named in the request.

**Test Case (Red)**:
```typescript
describe('FRONTEND-094-AC-10: decimal Min Vote Count shows an inline error', () => {
  it('shows an error for a decimal value', () => {
    renderBox()
    fireEvent.click(screen.getByRole('button', { name: /^recommendations filters/i }))
    fireEvent.change(screen.getByLabelText('Min Vote Count'), { target: { value: '5.5' } })
    expect(
      screen.getByText(/min vote count must be a whole number of at least 0/i),
    ).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: covered by the same `!Number.isInteger(...)` clause as AC-09.

#### FRONTEND-094-AC-11 [AUTO]: A valid Min Vote Count shows no error and reaches the query
**Statement**: While Min Vote Count is empty or a non-negative whole number, `RecommendationFiltersBox` shall display no inline error, and `buildQuery` shall include it in `RecommendationQuery.minVoteCount`.

**Rationale**: Regression guard — valid input (including `0`, the boundary) must be unaffected, and the query-builder must still forward it exactly as before for any value that passes validation.

**Test Case (Red)**:
```typescript
describe('FRONTEND-094-AC-11: valid Min Vote Count has no error', () => {
  it('shows no error for a valid non-negative integer', () => {
    renderBox({ state: makeState({ minVoteCount: '200' }) })
    fireEvent.click(screen.getByRole('button', { name: /^recommendations filters/i }))
    expect(
      screen.queryByText(/min vote count must be a whole number/i),
    ).not.toBeInTheDocument()
  })

  it('includes a valid minVoteCount in the built query', () => {
    const query = buildQuery(makeState({ minVoteCount: '200' }))
    expect(query.minVoteCount).toBe(200)
  })
})
```

**Test Case (Green)**: the `minVoteCountError` guard from AC-09 naturally excludes valid/blank values. In `applyRatingAndRangeFilters`, guard the existing `query.minVoteCount = Number(state.minVoteCount)` line with the same validity check, so an invalid value (if one somehow reaches this function) is omitted from the request rather than forwarded — a lightweight backstop, not a behavior change for any value that already passes the new inline check.

## Cross-References

| Concept | Location |
|---|---|
| Existing `hideInput`/"Browse..." CTA pattern being extended to Custom Search | `components/UseMySeriesPanel.tsx` (`frontend_spec_077`) |
| `keywordOptions`' actual source (tracked-series keyword stats, not TMDB-global) — why free text can't just be dropped everywhere | `components/RecommendationControls.tsx` (`setKeywordOptions`, keyword-stats fetch) |
| The `SPEC_CANDIDATES.md` item this closes | `.claude/SPEC_CANDIDATES.md` ("Exclude Keywords" filter — `KeywordPicker` instead of free text) — removed from that file as part of this spec |
| `GenreIncludeExcludePicker`, the sibling pattern for Exclude Genres in the same box | `components/RecommendationFiltersBox.tsx` |
| `countActiveFilters`, updated for the new field shape | `components/RecommendationFiltersBox.tsx` (`frontend_spec_093`) |
| `.fieldError` styling being mirrored | `components/EditSeriesForm.module.css` |
| `minTmdbRating`'s existing `min`/`max`/`step` convention being mirrored | `components/RecommendationFiltersBox.tsx` |

## Acceptance Criteria Summary

AC-01's `[MANUAL]` verification is complete — confirmed via `getComputedStyle` on both `.filtersBody` instances (`border-left: 2px solid`, `padding-left: 18px`) plus a visual check on both "Filter & sort my series" and "Recommendations Filters".

- [x] FRONTEND-094-AC-01: Expanded filter sections show a left-hand grouping line
- [x] FRONTEND-094-AC-02: Inline Keywords field no longer renders a text input
- [x] FRONTEND-094-AC-03: A "Browse all keywords" button opens a modal
- [x] FRONTEND-094-AC-04: The modal's picker still accepts a free-typed keyword
- [x] FRONTEND-094-AC-05: Exclude Keywords renders as a `KeywordPicker`
- [x] FRONTEND-094-AC-06: Selecting an exclude keyword is sent in the recommendations query
- [x] FRONTEND-094-AC-07: Reset Filters clears the selected exclude keywords
- [x] FRONTEND-094-AC-08: Active-filter count still reflects Exclude Keywords correctly
- [x] FRONTEND-094-AC-09: Negative Min Vote Count shows an inline error
- [x] FRONTEND-094-AC-10: Decimal Min Vote Count shows the same inline error
- [x] FRONTEND-094-AC-11: A valid Min Vote Count shows no error and reaches the query
