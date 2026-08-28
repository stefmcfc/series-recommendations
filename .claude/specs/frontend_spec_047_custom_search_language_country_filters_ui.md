# Frontend Spec 047: Custom Search — Country-of-Origin Picker & Upgraded Language Picker

**Status**: Implemented (2026-08-28 revision: language picker rebuilt as a `KeywordPicker` instance with a
single-select adapter, replacing the original bespoke picker that had no way to clear a selection — AC-08/09
revised, AC-12 added; see Design Decisions and Requirement 3's revision note); paired with `series_spec_032`,
both on branch `feature/custom-search-language-country-filters`, not yet merged
**Priority**: P3 (paired UI half of `series_spec_032`)
**Depends on**: Series Spec 032 (`series_spec_032_custom_search_language_country_filters.md`, the backend
`countries` field and pre-fetch wiring this spec's UI produces) ✅. Frontend Spec 046
(`frontend_spec_046_custom_search_prefetch_filters_ui.md`, establishes the "relocate into Custom Search's panel
vs. stay in Filters" pattern this spec follows for a second pair of fields — build after 046, not in parallel,
to avoid two specs restructuring the same JSX region independently) ✅.
**Area**: Frontend (`KeywordPicker.tsx`, `RecommendationControls.tsx`, new `utils/countryOptions.ts`) — no new
component library dependency.

## Overview

`series_spec_032` moves `language`/`countries` filtering upward for Custom Search. This spec is the UI half,
covering two different interaction shapes for two different reasons (decided in discussion,
`.claude/SPEC_CANDIDATES.md`): **Country becomes a multi-select chip picker** (TMDB supports OR-matching several
origin countries), while **Language stays single-select** (TMDB's `with_original_language` only ever accepts
one value, so a multi-select UI would silently under-deliver on exactly the fields it's supposed to control).

Both fields follow `frontend_spec_046`'s established relocation pattern: rendered inside Custom Search's own
panel while that sub-mode is active, and inside the generic Filters box for every other mode (Country is a
genuinely new addition to the Filters box, since the filter didn't exist anywhere before this).

## Design Decisions

- **`KeywordPicker` gains an optional `pinnedOptions?: string[] | PickerOption[]` prop** — when provided, those
  options always appear first in the suggestion list, regardless of what's currently typed (bypassing the
  existing `typedMatches`/`emptyInputSuggestions` label-match filtering entirely for pinned entries), deduped
  against whatever the normal suggestion logic would already surface so a pinned option never appears twice.
  Already-selected pinned options are excluded, same as any other option. This is an additive change to an
  already-shared, actively-reused component (Specific Series picker, Custom Search's own Keywords field,
  `SearchFilter`'s keyword filter) — every existing consumer that doesn't pass `pinnedOptions` is unaffected.
- **Country reuses `KeywordPicker` as-is** (multi-select, chips, `pinnedOptions={['US', 'GB']}` for United
  States/United Kingdom, `PickerOption[]` shape so codes display as full names via the existing
  `formatCountryName` utility while the underlying selected value stays the ISO code TMDB expects). The
  "searchable rest" beyond the two pinned countries comes from a new small hardcoded list
  (`utils/countryOptions.ts`) of common TV-production countries — **not** sourced from the user's own tracked
  series' origin countries (unlike genres/keywords' vocabulary endpoints), since Discover modes deliberately
  don't touch tracked data at all (confirmed in `.claude/analysis/scoring_weight_recommendations.md` Section 3)
  — deriving Discover's own filter suggestions from personal data would cut against that.
- **Revised after live testing (2026-08-28): Language reuses `KeywordPicker` directly, single-select enforced by
  a thin adapter — not a bespoke picker.** The original design (a locally-scoped picker with a permanently-visible
  pinned "English" button and a plain text input showing the current selection) shipped, but live testing surfaced
  a real UX defect: once a language was selected there was no way to clear it back to "no filter" — the pinned
  "English" button never toggled off (it's unconditionally rendered, not selection-state-aware) and typing/
  clearing the input text didn't touch the underlying `language` value, only clicking a suggestion did. Users
  correctly read the always-visible pinned button as a persistent chip, when it was actually just a shortcut.
  Fix: render Language through the *same* `KeywordPicker` chip UI Country already uses (proven UX — a removable
  chip with an "×", already familiar from Country), with single-select enforced entirely in
  `RecommendationControls.tsx` via a thin adapter — no `KeywordPicker` prop changes needed:
  `selected={state.language ? [state.language] : []}` and `onChange={(next) => updateState({ language: next.at(-1) ?? '' })}`.
  Because `KeywordPicker.addOption` always appends (`[...selected, option.id]`) and `selected` is clamped to
  length ≤ 1 by this adapter, `next` is always length ≤ 2 and `.at(-1)` is always the newly-clicked option —
  picking a new language correctly replaces the old one, and clicking the resulting chip's "×" (removing the only
  entry) yields `next = []`, so `.at(-1) ?? ''` correctly clears `language` back to `''`. This is why the fix
  needed no `KeywordPicker` changes at all, just a different usage pattern already proven by Country.
- **Pinned language set expanded beyond English alone**, per the same live-testing feedback ("I feel there should
  be some other persistent languages"). Pinned: English, Spanish, French, German, Japanese, Korean (`en`/`es`/
  `fr`/`de`/`ja`/`ko`) — a reasonable judgment call on "most commonly wanted TV languages," not user-confirmed
  individually; open to adjustment. Unlike Country's pinned US/GB (deliberately excluded from `options` so they
  display as bare codes, see above), Language's pinned codes **are** included in `options` so `resolvePinnedOptions`
  resolves them to full names ("English", not "en") — there's no bare-code test contract for Language the way
  Country's AC-02/AC-06 have for `/^us$/i`.
- **No wire-format change for `language`** — still the same single `string` field, still sent the same way;
  only how the value gets set (picker vs. raw typing) changes.

---

## Requirement 1: `KeywordPicker` gains pinned-option support

**User story**: As a developer, I want one shared way to pin popular options at the top of a picker's
suggestions, rather than building this once for Country and reinventing it later for any other field.

### FRONTEND-047-AC-01 [AUTO]
**Statement**: When `pinnedOptions` is provided, those options shall always appear first in the suggestion
list, regardless of the currently typed search text (including when the typed text doesn't match them at all).

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-01: pinned options always appear first', () => {
  it('shows pinned options even when typed text does not match them', () => {
    render(
      <KeywordPicker
        id="test-picker" label="Countries" selected={[]} onChange={vi.fn()}
        options={['US', 'GB', 'JP', 'FR']}
        pinnedOptions={['US', 'GB']}
      />,
    )

    fireEvent.change(screen.getByLabelText(/countries/i), { target: { value: 'jp' } })

    const suggestions = screen.getAllByRole('button', { name: /^(us|gb|jp)$/i })
    expect(suggestions[0]).toHaveTextContent(/us/i)
    expect(suggestions[1]).toHaveTextContent(/gb/i)
  })
})
```
**Test Case (Green)**: compute `visiblePinned` (normalized, filtered against `selected`), prepend to whatever
`visibleSuggestions` already computes, deduping by `id`.

---

### FRONTEND-047-AC-02 [AUTO]
**Statement**: Selecting a pinned option shall behave identically to selecting any other suggestion — added as
a chip via the existing `addOption`/`onChange` path.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-02: selecting a pinned option adds a chip', () => {
  it('calls onChange with the pinned option selected', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="test-picker" label="Countries" selected={[]} onChange={onChange}
        options={['US', 'GB']} pinnedOptions={['US', 'GB']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^us$/i }))

    expect(onChange).toHaveBeenCalledWith(['US'])
  })
})
```
**Test Case (Green)**: pinned options render through the same suggestion `<button onClick={() =>
addOption(option)}>` markup as any other option — no separate click handler needed.

---

### FRONTEND-047-AC-03 [AUTO]
**Statement**: Every existing `KeywordPicker` consumer that doesn't pass `pinnedOptions` shall be unaffected.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-03: existing consumers are unaffected', () => {
  it('behaves exactly as before when pinnedOptions is omitted', () => {
    render(
      <KeywordPicker
        id="test-picker" label="Keywords" selected={[]} onChange={vi.fn()}
        options={['spy', 'thriller']}
      />,
    )

    expect(screen.getByRole('button', { name: /^spy$/i })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `pinnedOptions` defaults to `undefined`; `visiblePinned` is an empty array when absent,
so the merge is a no-op — regression guard, no existing `RecommendationControls.test.tsx`/
`SearchFilter.test.tsx` assertions should need updating.

---

## Requirement 2: Country-of-origin filter

**User story**: As a user running a Custom Search, I want to narrow results to specific countries of origin,
with the two I'll use most (US/UK) one click away.

### FRONTEND-047-AC-04 [AUTO]
**Statement**: While Discover > Custom Search is active, a Country picker (`KeywordPicker` with
`pinnedOptions={['US', 'GB']}`) shall render inside Custom Search's own panel.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-04: Country picker renders under Custom Search', () => {
  it('shows the Country field with pinned US/GB', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /^discover$/i }))
    fireEvent.click(screen.getByRole('tab', { name: /custom search/i }))

    const panel = screen.getByRole('tabpanel', { name: /custom search/i })
    expect(within(panel).getByLabelText(/countries/i)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the Country `KeywordPicker` instance to the Custom Search panel, backed by a new
`countriesSelected: string[]` state slot.

---

### FRONTEND-047-AC-05 [AUTO]
**Statement**: For every mode other than Custom Search, the Country picker shall render inside the Filters
disclosure box instead.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-05: Country picker relocates to Filters for other modes', () => {
  it('shows Country inside Filters under Use My Series', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    expect(screen.getByLabelText(/countries/i)).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: same relocation conditional `frontend_spec_046` established for Min TMDB Rating/Year —
mirrored for Country.

---

### FRONTEND-047-AC-06 [AUTO]
**Statement**: Selecting one or more countries shall send `countries` in the emitted `RecommendationQuery`,
regardless of which panel the picker was rendered in.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-06: countries sent in the query', () => {
  it('includes selected countries on Apply Filters', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^us$/i }))
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ countries: ['US'] }),
    )
  })
})
```
**Test Case (Green)**: `applyExcludeAndMiscFilters` (or a new small function alongside it) sends `countries`
when `state.countriesSelected.length > 0`.

---

### FRONTEND-047-AC-07 [AUTO]
**Statement**: The Country picker's searchable options beyond the two pinned entries shall come from a
hardcoded list of common TV-production countries, not from the user's tracked series data.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-07: country options are hardcoded, not tracked-data-derived', () => {
  it('offers a searchable country beyond the pinned two without fetching series data', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    fireEvent.change(screen.getByLabelText(/countries/i), { target: { value: 'japan' } })

    expect(screen.getByRole('button', { name: /japan/i })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `utils/countryOptions.ts` exports a static `PickerOption[]` (or `string[]`) list; no new
`useEffect`/`seriesApi` call is added for this field.

---

## Requirement 3: Language filter — single-select chip picker replaces the plain text input

**User story**: As a user, I want to pick a language without knowing its ISO 639-1 code by heart, with common
options one click away, a visible chip showing what's selected, and a clear way to remove it — but still only
ever choosing one value, since that's genuinely all TMDB can act on.

**Revision note (2026-08-28)**: AC-08/AC-09 below were revised after live testing found the originally-shipped
bespoke picker had no way to clear a selection (see Design Decisions). The current implementation renders
Language through `KeywordPicker` itself (single-select enforced by an adapter in `RecommendationControls.tsx`,
not a `KeywordPicker` change) — the same proven chip-with-"×" UX Country already uses.

### FRONTEND-047-AC-08 [AUTO]
**Statement**: The Language field shall render pinned quick-select options for English, Spanish, French, German,
Japanese, and Korean.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-08: Language picker has pinned quick-select options', () => {
  it('renders English and Spanish quick-selects', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    expect(screen.getByRole('button', { name: /^english$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^spanish$/i })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `KeywordPicker` instance for Language with `pinnedOptions={LANGUAGE_PINNED_CODES}`
(`['en','es','fr','de','ja','ko']`), resolved to full names via `LANGUAGE_OPTIONS` (which includes the pinned
codes, unlike Country's exclusion pattern — see Design Decisions).

---

### FRONTEND-047-AC-09 [AUTO]
**Statement**: Selecting a language option (pinned or searched) shall set the single `language` value, replacing
any previously selected value, rendered as a single removable chip.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-09: selecting replaces, does not accumulate', () => {
  it('replaces the previous language selection', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    fireEvent.click(screen.getByRole('button', { name: /^english$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^french$/i }))

    expect(screen.getByText('French')).toBeInTheDocument()
    expect(screen.queryByText('English')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: the adapter's `onChange={(next) => updateState({ language: next.at(-1) ?? '' })}` always
takes the most-recently-clicked option as the new (sole) value.

---

### FRONTEND-047-AC-12 [AUTO]
**Statement**: The selected language's chip shall include a control to clear the selection back to no language
filter.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-12: language selection can be cleared', () => {
  it('clears language back to empty via the chip\'s remove control', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))

    fireEvent.click(screen.getByRole('button', { name: /^english$/i }))
    fireEvent.click(screen.getByRole('button', { name: /remove english/i }))
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.not.objectContaining({ language: expect.anything() }),
    )
  })
})
```
**Test Case (Green)**: removing the chip calls `onChange([])`, and the adapter's `next.at(-1) ?? ''` yields `''`
for `language`; `applyExcludeAndMiscFilters` already omits `language` from the query when it's the empty string
(pre-existing `state.language.trim() !== ''` guard, unchanged).

---

### FRONTEND-047-AC-10 [AUTO]
**Statement**: While Discover > Custom Search is active, the Language picker shall render inside Custom
Search's own panel; for every other mode, it shall render inside the Filters disclosure box.

**Test Case (Green)**: same relocation pattern as AC-04/AC-05 and `frontend_spec_046`'s fields, applied to
Language's new picker markup.

---

### FRONTEND-047-AC-11 [AUTO]
**Statement**: The emitted `RecommendationQuery`'s `language` value shall be unaffected by the picker upgrade
or by which panel it's rendered in — same single-string wire value as today.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-11: query output for language is unaffected', () => {
  it('sends the same language value regardless of panel location', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^english$/i }))
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
    )
  })
})
```
**Test Case (Green)**: no change to `applyExcludeAndMiscFilters`'s existing `language` handling — this AC
proves the picker swap didn't change the wire contract, not new logic.

---

## Implementation Notes

- New state: `countriesSelected: string[]` on `ControlsState` (mirrors `genresSelected`/`keywordsSelected`'s
  existing shape). `language` stays the existing single `string` field — no new state needed for it, only its
  input markup changes.
- `handleResetFilters` needs `countriesSelected: []` added to its reset patch, alongside its existing fields.
- Country `PickerOption[]` entries use `formatCountryName(code)` for `label`/`display`, `code` for `id` —
  mirrors the existing pattern in `seriesPickerLabel`/`seriesPickerDisplay`.

## Cross-References

| This spec | Source |
|---|---|
| Backend `countries`/pre-fetch wiring this spec's UI produces | `series_spec_032_custom_search_language_country_filters.md` |
| Relocation pattern (Filters box vs. Custom Search panel) this spec reuses for a second field pair | `frontend_spec_046_custom_search_prefetch_filters_ui.md` |
| `formatCountryName` utility reused for Country picker display labels | existing `utils/countryName.ts` |
| Language-single-select vs. Country-multi-select decision | `.claude/SPEC_CANDIDATES.md`, discussion 2026-08-28 |

---

## Acceptance Criteria Summary

- [x] FRONTEND-047-AC-01: pinned options always appear first in suggestions
- [x] FRONTEND-047-AC-02: selecting a pinned option adds a chip normally
- [x] FRONTEND-047-AC-03: existing `KeywordPicker` consumers unaffected
- [x] FRONTEND-047-AC-04: Country picker renders under Custom Search
- [x] FRONTEND-047-AC-05: Country picker relocates to Filters for other modes
- [x] FRONTEND-047-AC-06: `countries` sent in the query
- [x] FRONTEND-047-AC-07: country options are hardcoded, not tracked-data-derived
- [x] FRONTEND-047-AC-08: Language picker has pinned quick-select options (revised 2026-08-28 — was English-only)
- [x] FRONTEND-047-AC-09: selecting a language replaces, doesn't accumulate (revised 2026-08-28 — now via `KeywordPicker` chip)
- [x] FRONTEND-047-AC-10: Language picker relocates the same way as Country
- [x] FRONTEND-047-AC-11: emitted `language` value unaffected by the picker upgrade
- [x] FRONTEND-047-AC-12: language selection can be cleared via the chip's remove control (new, 2026-08-28)
