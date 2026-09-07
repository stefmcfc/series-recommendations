# Frontend Spec 100: Reorderable Favourite Chips

**Status**: Done — all ACs verified. AC-06 confirmed via live browser pass (2026-09-07): a real mouse drag (Chrome DevTools Protocol synthetic drag, exercising the actual native HTML5 drag-and-drop path, not simulated jsdom events) moved "Korean" from the end to the front of Language Favourites, `localStorage` updated correctly (`["en","es","fr","de","ja","ko"]` → `["ko","en","es","fr","de","ja"]`), and the chip order re-rendered to match — plus the disabled-boundary state (leading chip's `‹` greyed out) confirmed visually.
**Priority**: P3
**Depends on**: `frontend_spec_098_settings_country_language_favourites.md` (the Country/Language Favourites editors this extends; `KeywordPicker` itself)
**Area**: Frontend (`components/KeywordPicker.tsx`, `KeywordPicker.module.css`, `components/SettingsPage.tsx`, and each affected file's tests)

## Overview

`frontend_spec_098` made Custom Search's pinned Country/Language chips user-editable from
`/settings`, but gave no way to change the *order* of an already-selected favourites list short of
removing and re-adding entries. Order matters here, not just membership: `KeywordPicker`'s
`pinnedOptions` renders pinned suggestions in the array's own order (confirmed by reading
`resolvePinnedOptions`/`visiblePinned` — no re-sorting happens), so a favourites list's order
directly controls which pinned chip a user sees first in the live Custom Search/Recommendations
Filters pickers. This spec adds reordering — drag-and-drop plus keyboard-accessible Move
earlier/later buttons — to `KeywordPicker`'s selected-chip list, as an opt-in feature only the
Settings favourites editors turn on.

## Design Decisions

- **Reordering is opt-in via a new `reorderable?: boolean` prop, not a default-on behavior
  change.** `KeywordPicker` is reused in roughly a dozen places (Genre/Keyword filters on My
  Series, Recommendations, Add/Edit Series) where selection order has no meaning at all — turning
  on drag handles and Move buttons everywhere would be visual noise with no payoff for those
  call sites. Only `SettingsPage.tsx`'s two favourites editors pass `reorderable`.
- **Drag-and-drop is paired with Move earlier/later buttons, not offered alone.** Native HTML5
  drag-and-drop (`draggable`, `dragstart`/`dragover`/`drop`) has no built-in keyboard equivalent —
  a keyboard-only or screen-reader user could select and remove a chip but never reorder one if
  drag were the only mechanism. This app has consistently rejected interaction patterns that shut
  out those users elsewhere (e.g. `.claude/SPEC_CANDIDATES.md`'s info-disclosure candidate
  explicitly rejecting hover-only tooltips for the same reason) — the two small arrow buttons are
  the accessible path, not a lesser fallback bolted on afterward.
- **No new dependency.** No drag-and-drop library exists in this project today (confirmed via
  `package.json`); native HTML5 drag-and-drop plus a manual array-splice on drop is sufficient for
  reordering a short list (2–20 items) and avoids adding one for a single, contained feature.
- **Reordering only ever changes order — never membership.** Both the button and drag paths call
  the same underlying reorder helper, which moves one entry from its current index to a new index
  within `selected` and nothing else; `selected.length` and its set of ids are invariant across any
  reorder operation.
- **The drag interaction itself is `[MANUAL]`; the underlying reorder logic is `[AUTO]`.** jsdom
  can simulate `dragstart`/`dragover`/`drop` events with a stub `DataTransfer`, so the array-splice
  logic those handlers drive is fully unit-testable — but whether dragging *feels* right (drag
  image, drop-target highlight, touch behavior) isn't something jsdom evaluates, matching this
  project's established precedent for CSS/interaction-feel-only checks (`frontend_spec_091`,
  `frontend_spec_096`, `frontend_spec_099`).
- **Button icons/labels**: "‹"/"›" glyphs (matching the existing chip-remove "×" glyph's minimal
  style), with `aria-label`s reading "Move {name} earlier"/"Move {name} later" — "earlier"/"later"
  rather than "left"/"right" since chips wrap onto multiple rows in a flex-wrap layout, where a
  spatial left/right label could point the wrong direction once a chip wraps to a new line.

## Requirements

### Requirement 1: `KeywordPicker` gains opt-in chip reordering

**User story**: As a developer, I want reordering available on any `KeywordPicker` instance that
needs it, without changing behavior for the many instances that don't.

#### Acceptance Criteria

- **FRONTEND-100-AC-01** [AUTO]: `KeywordPickerProps` shall gain `reorderable?: boolean` (default
  `false`/omitted) — every existing call site that doesn't pass it renders identically to today,
  with no drag attributes or Move buttons on its chips.
- **FRONTEND-100-AC-02** [AUTO]: While `reorderable` is `true`, each selected chip shall render a
  "Move earlier" (`‹`) and "Move later" (`›`) button, each with an `aria-label` naming the chip
  (e.g. `aria-label="Move United Kingdom earlier"`) and the chip's own resolved display label
  (matching the existing remove button's `aria-label={`Remove ${keyword}`}` pattern).
- **FRONTEND-100-AC-03** [AUTO]: The first chip's "Move earlier" button, and the last chip's "Move
  later" button, shall be `disabled` — there is no valid earlier/later position to move into.
- **FRONTEND-100-AC-04** [AUTO]: Clicking a chip's "Move earlier"/"Move later" button shall swap
  it with its immediately preceding/following entry in `selected` and call `onChange` with the
  reordered array — `selected.length` and its set of ids are unchanged, only their order.
- **FRONTEND-100-AC-05** [AUTO]: While `reorderable` is `true`, each chip's list item shall be
  `draggable`; dropping a dragged chip onto another chip shall move the dragged entry to the drop
  target's position (entries between the two shift accordingly) and call `onChange` with the
  reordered array, verified by dispatching `dragstart`/`dragover`/`drop` events with a stub
  `DataTransfer`.
- **FRONTEND-100-AC-06** [MANUAL]: Dragging a chip in a real browser visually previews the drag
  and reorders on drop, with a sensible drop-target indicator — verified by manual check in
  browser (jsdom doesn't render an actual drag image or evaluate drop-target styling the way a
  real browser does).

---

### Requirement 2: Settings favourites editors adopt reordering

**User story**: As a user, I want to control which of my favourite countries/languages shows up
first in the pinned suggestions, not just which ones are favourited at all.

#### Acceptance Criteria

- **FRONTEND-100-AC-07** [AUTO]: `SettingsPage.tsx`'s Country Favourites and Language Favourites
  `KeywordPicker` instances shall both pass `reorderable`.
- **FRONTEND-100-AC-08** [AUTO]: Reordering a favourite (via either Move button) on `/settings`
  shall write the reordered array through the existing `useLocalStorage` setter — no new
  persistence path, reusing exactly what `frontend_spec_098` already built.
- **FRONTEND-100-AC-09** [AUTO]: After reordering favourites on `/settings`, mounting
  `CustomSearchPanel`/`RecommendationFiltersBox` (which read the same `useLocalStorage` key) shall
  render their pinned suggestion chips in the new, reordered order — confirming the order set in
  Settings is exactly what a user sees in the live Discover pickers, not just persisted inertly.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Favourites editors this spec adds reordering to, and the `useLocalStorage` persistence it reuses unchanged | `frontend_spec_098_settings_country_language_favourites.md` |
| `KeywordPicker`'s existing `pinnedOptions` order-preserving resolution this spec's reordering actually affects | `frontend/src/components/KeywordPicker.tsx` (`resolvePinnedOptions`, `visiblePinned`) |
| `[MANUAL]`/jsdom-can't-evaluate-real-interaction-feel precedent | `frontend_spec_091`, `frontend_spec_096`, `frontend_spec_099` |
| Precedent for rejecting a mouse/touch-only interaction without a keyboard-accessible equivalent | `.claude/SPEC_CANDIDATES.md`'s info/disclosure-box candidate (hover-only tooltip rejected for the same reason) |

---

## TDD Test Case Sketches

### `src/components/KeywordPicker.test.tsx` (additions)

```typescript
describe('FRONTEND-100-AC-01: reorderable is opt-in', () => {
  it('renders no Move buttons when reorderable is omitted', () => {
    render(
      <KeywordPicker id="t" label="T" selected={['a', 'b']} onChange={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: /move/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-100-AC-02/03: Move buttons render with correct disabled boundaries', () => {
  it('disables Move earlier on the first chip and Move later on the last', () => {
    render(
      <KeywordPicker
        id="t"
        label="T"
        selected={['a', 'b', 'c']}
        onChange={vi.fn()}
        reorderable
      />,
    )
    expect(screen.getByRole('button', { name: /move a earlier/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /move c later/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /move b earlier/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /move b later/i })).toBeEnabled()
  })
})

describe('FRONTEND-100-AC-04: Move buttons reorder without changing membership', () => {
  it('swaps a chip with its predecessor on Move earlier', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="t"
        label="T"
        selected={['a', 'b', 'c']}
        onChange={onChange}
        reorderable
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /move c earlier/i }))
    expect(onChange).toHaveBeenCalledWith(['a', 'c', 'b'])
  })
})

describe('FRONTEND-100-AC-05: drag-and-drop reorders on drop', () => {
  it('moves the dragged chip to the drop target position', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="t"
        label="T"
        selected={['a', 'b', 'c']}
        onChange={onChange}
        reorderable
      />,
    )
    const chipA = screen.getByText('a').closest('li')!
    const chipC = screen.getByText('c').closest('li')!
    const dataTransfer = { getData: vi.fn(), setData: vi.fn() }

    fireEvent.dragStart(chipA, { dataTransfer })
    fireEvent.dragOver(chipC, { dataTransfer })
    fireEvent.drop(chipC, { dataTransfer })

    expect(onChange).toHaveBeenCalledWith(['b', 'c', 'a'])
  })
})
```

### `src/components/SettingsPage.test.tsx` (additions)

```typescript
describe('FRONTEND-100-AC-07/08: favourites editors are reorderable', () => {
  it('writes the reordered favourites through useLocalStorage on Move later', () => {
    localStorage.setItem('countryFavourites', JSON.stringify(['US', 'GB']))
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: /move us later/i }))
    expect(JSON.parse(localStorage.getItem('countryFavourites')!)).toEqual(['GB', 'US'])
  })
})
```

### `src/components/CustomSearchPanel.test.tsx` (additions)

```typescript
describe('FRONTEND-100-AC-09: reordered favourites render in the new order', () => {
  it('shows pinned country chips in the stored order', () => {
    localStorage.setItem('countryFavourites', JSON.stringify(['GB', 'US']))
    render(<CustomSearchPanel {...baseProps} />)
    const suggestionLabels = screen
      .getAllByRole('button', { name: /^(United Kingdom|United States)$/ })
      .map((el) => el.textContent)
    expect(suggestionLabels).toEqual(['United Kingdom', 'United States'])
  })
})
```

**Test Case (Green)**: implement the `reorderable` prop, the Move buttons, and the drag handlers
until the specs above pass; AC-06 is verified manually in browser.

### Implementation notes / deviations from the sketches above

- **Move button `aria-label` resolves through `options` (matching chip text), not the raw stored
  id.** AC-02's own prose example (`aria-label="Move United Kingdom earlier"`) already implied
  this, but the `SettingsPage.test.tsx` sketch's button-name matcher (`/move us later/i`) assumed
  the raw code ("US") appeared in the label. With `ALL_COUNTRY_OPTIONS` resolving `'US'` to
  `"United States"` via `Intl.DisplayNames`, `"Move United States later"` doesn't contain `"us
  later"` as a substring, so that regex can never match real output. The actual test added
  (`FRONTEND-100-AC-07/08` in `SettingsPage.test.tsx`) asserts against the resolved name instead.
  Resolving through `options` was kept (not the raw id) because it's what AC-02 explicitly
  describes and matches the existing chip text's own resolution logic one line above.
- **`KeywordPicker.test.tsx`'s own AC-01 sketch (`{ name: /move/i }`) needed a word-boundary fix**
  (`/\bmove\b/i`) — a naive `/move/i` also matches the always-present "Remove a"/"Remove b"
  chip-delete buttons, since `"Remove"` contains `"move"` as a substring, making
  `queryByRole` throw on multiple matches rather than returning zero.
- **`CustomSearchPanel.test.tsx`'s AC-09 sketch expected resolved full names** (`"United
  Kingdom"`/`"United States"`), but `CustomSearchPanel`'s Countries picker passes
  `options={COUNTRY_OPTIONS}`, which deliberately excludes US/GB (see `countryOptions.ts`) — so
  `pinnedOptions` there falls back to each entry's own raw id/label (`"GB"`/`"US"` bare codes),
  matching this file's pre-existing default-pinned-countries tests. The added test asserts on
  order (`['GB', 'US']` vs `['US', 'GB']`), which is what AC-09 is actually about, using the bare
  codes actually rendered rather than the sketch's assumed resolved names.

---

## Acceptance Criteria Summary

- [x] FRONTEND-100-AC-01: `reorderable` prop is opt-in, no change when omitted
- [x] FRONTEND-100-AC-02: Move earlier/later buttons render with correct `aria-label`s
- [x] FRONTEND-100-AC-03: boundary buttons (first/last chip) are disabled
- [x] FRONTEND-100-AC-04: Move buttons reorder via swap, membership unchanged
- [x] FRONTEND-100-AC-05: drag-and-drop reorders on drop
- [x] FRONTEND-100-AC-06: real-browser drag interaction feels correct — verified 2026-09-07
- [x] FRONTEND-100-AC-07: both Settings favourites editors pass `reorderable`
- [x] FRONTEND-100-AC-08: reordering writes through the existing `useLocalStorage` setter
- [x] FRONTEND-100-AC-09: reordered favourites render in the new order in the live Discover pickers
