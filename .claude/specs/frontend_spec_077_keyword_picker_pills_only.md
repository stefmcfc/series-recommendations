# Frontend Spec 077: `KeywordPicker` Gains a Pills-Only Mode

**Status**: Implemented — `components/KeywordPicker.tsx`, `components/KeywordPicker.test.tsx`, `components/SearchFilter.tsx`, `components/SearchFilter.test.tsx`, `components/UseMySeriesPanel.tsx`, `components/UseMySeriesPanel.test.tsx`, `components/RecommendationControls.test.tsx`
**Priority**: P3
**Depends on**: none
**Area**: Frontend (`components/KeywordPicker.tsx`, `components/SearchFilter.tsx`, `components/UseMySeriesPanel.tsx`)

## Overview

`KeywordPicker` always renders a text input, a suggestions list, and selected pills together — there's no way to show just the pills. In three places, this duplicates (or would duplicate) a search box that already exists (or is added by this spec) elsewhere on the same panel: `SearchFilter.tsx`'s inline Keywords field sits right next to a "Browse all keywords" button that opens a second `KeywordPicker` instance with its own full typing/search UI; `UseMySeriesPanel.tsx`'s inline Series field pairs the same way with its own "Browse Series" modal; and `UseMySeriesPanel.tsx`'s "Filter & sort my series" Keywords field (added by `frontend_spec_081`, after this spec was originally written) has no such pairing yet — this spec now also builds it one, following the identical pattern, then applies the same input-suppression. In all three cases the inline field's own typing input becomes redundant once a full-featured "Browse..." modal exists alongside it — this spec adds a way to suppress it, keeping just the pills (with their existing per-pill removal) inline.

**Amendment (2026-09-03, before this spec was started)**: originally scoped to 2 usages (`SearchFilter`'s Keywords, `UseMySeriesPanel`'s Series). Extended to 3 — adding `UseMySeriesPanel`'s newer Keywords filter field — per a live discussion tying this spec to the "Share filter/sort logic between `SeriesList`/`SearchFilter` and `RecommendationControls`' 'Use My Series' mode" candidate (`.claude/SPEC_CANDIDATES.md`): giving all three type-heavy inline fields the identical Browse-modal-plus-no-inline-typing treatment is a concrete, shippable slice of that larger "make the two features' filtering feel like one shared thing" goal, without needing the bigger predicate-sharing refactor that candidate also anticipates. Since this spec was never started, the amendment is folded directly into the requirements below rather than tracked as a separate spec.

This does **not** apply to any of `KeywordPicker`'s other 7 usages (`CustomSearchPanel`'s Keywords/Countries/Language, `RecommendationFiltersBox`'s Countries/Language, or the three modal instances themselves) — none of those have (or gain) a paired modal duplicating their own input, so removing it would remove the only way to add a new entry.

## Design Decisions

- **New optional prop `hideInput?: boolean`** (default `false`) on `KeywordPicker`. When `true`, the text `<input>` and its suggestions `<ul>` (`KeywordPicker.tsx:199-223`) are not rendered; the selected-pills `<ul>` (`KeywordPicker.tsx:225-246`) renders exactly as it does today, including per-pill removal.
- **A visible label is still required for accessibility** even with the input gone — when `hideInput` is `true`, render a plain `<span>{label}</span>` in place of the `<label htmlFor={id}>` (which has nothing to point `htmlFor` at once the input is gone), the same pattern `SearchFilter.tsx` already uses for its non-input Min Personal Rating field (`<span>Min Personal Rating</span>`).
- **Applied to exactly 3 call sites**: `SearchFilter.tsx`'s inline Keywords field (`id="search-keywords"`, paired with the "Browse all keywords" modal's own `id="browse-keywords"` instance), `UseMySeriesPanel.tsx`'s inline Series field (`id="specific-series-picker"`, paired with the "Browse Series" modal's own `id="browse-series"` instance), and `UseMySeriesPanel.tsx`'s inline "Filter & sort my series" Keywords field (`id="specific-series-keywords"`, paired with a **new** "Browse all keywords" modal this spec adds, `id="browse-specific-series-keywords"`). No modal instance itself gets `hideInput` — every modal (including the new one) keeps its full input, since each is the dedicated place to add a new entry now.
- **The third usage's modal is new UI, not just a prop wire-up** — unlike the first two (whose paired modals already exist), `UseMySeriesPanel`'s Keywords filter field has no "Browse..." modal today. This spec builds one, copying the existing "Browse Series" modal in the same file verbatim in shape (overlay, `role="dialog"`, `aria-modal`, Escape-to-dismiss via the same `handleSpecificSeriesModalKeyDown`-style handler, a heading, a full `KeywordPicker` with `focusOnMount` and no `maxSuggestionsWhenEmpty` cap, a "Done" button) — same convention `SearchFilter.tsx`'s own "Browse all keywords" modal and `UseMySeriesPanel`'s existing "Browse Series" modal both already follow. A new "Browse all keywords" button (mirroring the existing "Show all series" button's placement/style, directly below the Keywords field) triggers it.
- **Behavior change, recorded explicitly**: with `hideInput` set, a user can no longer add a *new* keyword/series from any of the three inline fields — only remove an already-selected one via its pill's "×". Adding requires opening the paired "Browse..." modal. This is the intended outcome, not a side effect to work around.

## Requirements

### Requirement 1: `hideInput` prop on `KeywordPicker`

**User Story**: As a developer, I need a way to show only the selected pills for a `KeywordPicker` that already has a paired modal providing full search/typing elsewhere.

#### FRONTEND-077-AC-01 [AUTO]: `hideInput` suppresses the text input and suggestions
**Statement**: While `hideInput` is `true`, `KeywordPicker` shall not render its text `<input>` or its suggestions list, regardless of `options`/`allowFreeText`.

**Rationale**: Core suppression behavior.

**References**:
- Component: `components/KeywordPicker.tsx`

**Test Case (Red)**:
```typescript
describe('FRONTEND-077-AC-01: hideInput suppresses input and suggestions', () => {
  it('renders no text input or suggestions when hideInput is true', () => {
    render(
      <KeywordPicker
        id="test" label="Keywords" selected={['drama']} onChange={vi.fn()}
        options={['drama', 'comedy']} hideInput
      />,
    )
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: /suggestions/i })).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: wrap the `<input>` (and its preceding `<label htmlFor={id}>`) and the suggestions `<ul>` in `{!hideInput && (...)}`.

#### FRONTEND-077-AC-02 [AUTO]: pills still render and remain removable
**Statement**: While `hideInput` is `true` and `selected` is non-empty, `KeywordPicker` shall still render the selected-pills list, and each pill's remove button shall still call `onChange` with that item removed.

**Rationale**: "Pills should stay as they are" — no regression to existing pill behavior.

**References**:
- Component: `components/KeywordPicker.tsx` (chips `<ul>`, lines 225-246, unchanged)

**Test Case (Red)**:
```typescript
describe('FRONTEND-077-AC-02: pills still render and remain removable', () => {
  it('renders pills and removes one on click, even with hideInput', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="test" label="Keywords" selected={['drama', 'comedy']} onChange={onChange}
        options={['drama', 'comedy']} hideInput
      />,
    )
    expect(screen.getByText('drama')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove drama' }))
    expect(onChange).toHaveBeenCalledWith(['comedy'])
  })
})
```

**Test Case (Green)**: no change needed — the chips list already only depends on `selected`/`onChange`, unaffected by `hideInput`.

#### FRONTEND-077-AC-03 [AUTO]: a visible label remains when the input is hidden
**Statement**: While `hideInput` is `true`, `KeywordPicker` shall still render `label` as visible text (a `<span>`, since there is no `<input>` for a `<label htmlFor>` to point at).

**Rationale**: Accessibility — the field group must still be named for a screen-reader user even without an input to label.

**References**:
- Component: `components/KeywordPicker.tsx`
- Pattern: `components/SearchFilter.tsx`'s Min Personal Rating field (`<span>Min Personal Rating</span>`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-077-AC-03: label remains visible without an input', () => {
  it('still shows the label text when hideInput is true', () => {
    render(
      <KeywordPicker
        id="test" label="Keywords" selected={[]} onChange={vi.fn()}
        options={['drama']} hideInput
      />,
    )
    expect(screen.getByText('Keywords')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: render `<span>{label}</span>` in place of `<label htmlFor={id}>{label}</label>` when `hideInput` is true.

### Requirement 2: applied to the two paired-with-modal inline usages

**User Story**: As a user, I don't want to see two ways to type the same search on one panel.

#### FRONTEND-077-AC-04 [AUTO]: `SearchFilter`'s inline Keywords field hides its input
**Statement**: `SearchFilter.tsx`'s inline Keywords `KeywordPicker` (`id="search-keywords"`) shall pass `hideInput`; its paired "Browse all keywords" modal instance (`id="browse-keywords"`) shall not.

**Rationale**: The modal is now the sole place to type/search; the inline field only shows what's already selected.

**References**:
- Component: `components/SearchFilter.tsx:243-256` (inline), `:373-385` (modal, unchanged)

**Test Case (Red)**:
```typescript
describe('FRONTEND-077-AC-04: SearchFilter inline Keywords hides its input', () => {
  it('shows no text input for the inline Keywords field, but the modal still has one', () => {
    render(<SearchFilter isOpen={true} onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)

    expect(screen.queryByPlaceholderText('Type to filter tracked keywords')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Browse all keywords' }))
    expect(screen.getByPlaceholderText('Type to filter tracked keywords')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `hideInput` to the inline `KeywordPicker` call at line 243; leave the modal's call at line 373 unchanged.

#### FRONTEND-077-AC-05 [AUTO]: `UseMySeriesPanel`'s inline Series field hides its input
**Statement**: `UseMySeriesPanel.tsx`'s inline Series `KeywordPicker` (`id="specific-series-picker"`) shall pass `hideInput`; its paired "Browse Series" modal instance (`id="browse-series"`) shall not.

**Rationale**: Same reasoning as AC-04, applied to the other paired usage.

**References**:
- Component: `components/UseMySeriesPanel.tsx:226-234` (inline), `:294-302` (modal, unchanged)

**Test Case (Red)**:
```typescript
describe('FRONTEND-077-AC-05: UseMySeriesPanel inline Series hides its input', () => {
  it('shows no text input for the inline Series field, but the modal still has one', () => {
    render(
      <UseMySeriesPanel
        state={initialState} updateState={vi.fn()}
        allSeries={[{ id: '1', title: 'Show' } as Series]} genreOptions={[]}
      />,
    )
    expect(screen.queryByPlaceholderText('Type to search your series')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show all series' }))
    expect(screen.getByPlaceholderText('Type to search your series')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `hideInput` to the inline `KeywordPicker` call at line 226; leave the modal's call at line 294 unchanged.

#### FRONTEND-077-AC-06 [AUTO]: no other usage is affected
**Statement**: `CustomSearchPanel`'s Keywords/Countries/Language `KeywordPicker` usages and `RecommendationFiltersBox`'s Countries/Language usages shall not pass `hideInput` and shall continue rendering their text input as today.

**Rationale**: Explicit regression guard — this spec's scope is exactly 3 of 10 usages (the new "Browse all keywords" modal added by Requirement 3 below becomes the 10th).

**References**:
- Component: `components/CustomSearchPanel.tsx:69,155,166`, `components/RecommendationFiltersBox.tsx:202,213`

**Test Case (Red)**:
```typescript
describe('FRONTEND-077-AC-06: other usages are unaffected', () => {
  it('CustomSearchPanel Keywords still renders its input', () => {
    render(<CustomSearchPanel /* ...required props... */ />)
    expect(screen.getByPlaceholderText(/keywords/i)).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: no changes to these call sites.

### Requirement 3: a third paired-with-modal usage — `UseMySeriesPanel`'s "Filter & sort my series" Keywords field

**User Story**: As a user, I want the same Browse-all-keywords experience on Use My Series that I already have on My Series, instead of only a type-to-search box with no way to see everything at once.

#### FRONTEND-077-AC-07 [AUTO]: `UseMySeriesPanel` gains a "Browse all keywords" modal paired with its Keywords filter field
**Statement**: `UseMySeriesPanel` shall render a "Browse all keywords" button below its Keywords filter field; clicking it shall open a modal (`role="dialog"`, `aria-modal="true"`, Escape-to-dismiss) titled "Browse Keywords" containing a `KeywordPicker` (`id="browse-specific-series-keywords"`) bound to the same `specificSeriesKeywordsFilter` state, showing every tracked keyword uncapped (no `maxSuggestionsWhenEmpty` limit), focused on open, with a "Done" button that closes it.

**Rationale**: New UI this spec adds — mirrors `SearchFilter.tsx`'s "Browse all keywords" modal and `UseMySeriesPanel`'s own existing "Browse Series" modal exactly, so a user gets the identical browsing experience on both pages.

**References**:
- Component: `components/UseMySeriesPanel.tsx` (new modal, alongside the existing "Browse Series" modal at lines 464-500; new button alongside "Show all series" at lines 452-458)
- Pattern: `components/SearchFilter.tsx`'s "Browse all keywords" modal (lines 339-388 as of this spec's writing); `UseMySeriesPanel.tsx`'s own "Browse Series" modal (same file, unchanged)

**Test Case (Red)**:
```typescript
describe('FRONTEND-077-AC-07: Browse all keywords modal for the Keywords filter field', () => {
  it('opens a Browse Keywords modal with the full keyword list on click', async () => {
    render(
      <UseMySeriesPanel
        state={initialState} updateState={vi.fn()}
        allSeries={[{ id: '1', title: 'Show' } as Series]} genreOptions={[]}
        keywordOptions={['drama', 'crime', 'lapd']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Browse all keywords' }))

    expect(screen.getByRole('dialog', { name: /browse keywords/i })).toBeInTheDocument()
    expect(screen.getByText('drama')).toBeInTheDocument()
    expect(screen.getByText('crime')).toBeInTheDocument()
    expect(screen.getByText('lapd')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `specificSeriesKeywordsBrowseModalOpen` local state, a "Browse all keywords" button setting it `true`, and a modal block copying the existing "Browse Series" modal's structure with a `KeywordPicker` bound to `specificSeriesKeywordsFilter`/`setSpecificSeriesKeywordsFilter` and the full `keywordOptions` list.

#### FRONTEND-077-AC-08 [AUTO]: `UseMySeriesPanel`'s inline Keywords filter field hides its input
**Statement**: `UseMySeriesPanel.tsx`'s inline Keywords filter `KeywordPicker` (`id="specific-series-keywords"`) shall pass `hideInput`; its new paired "Browse all keywords" modal instance (`id="browse-specific-series-keywords"`, added by AC-07) shall not.

**Rationale**: Same reasoning as AC-04/AC-05, applied to the third paired usage — once the modal exists, the inline field's own typing input is redundant.

**References**:
- Component: `components/UseMySeriesPanel.tsx` (inline Keywords field, `id="specific-series-keywords"`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-077-AC-08: UseMySeriesPanel inline Keywords field hides its input', () => {
  it('shows no text input for the inline Keywords field, but the modal still has one', () => {
    render(
      <UseMySeriesPanel
        state={initialState} updateState={vi.fn()}
        allSeries={[{ id: '1', title: 'Show' } as Series]} genreOptions={[]}
        keywordOptions={['drama']}
      />,
    )
    expect(screen.queryByPlaceholderText('Type to filter tracked keywords')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Browse all keywords' }))
    expect(screen.getByPlaceholderText('Type to filter tracked keywords')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `hideInput` to the inline `KeywordPicker` call at `id="specific-series-keywords"`; leave the new modal's call at `id="browse-specific-series-keywords"` unchanged.

## Cross-References

| Concept | Location |
|---|---|
| Component enhanced | `components/KeywordPicker.tsx` |
| Applied usages | `components/SearchFilter.tsx` (Keywords), `components/UseMySeriesPanel.tsx` (Series, and Filter & sort my series' Keywords) |
| Unchanged usages | `components/CustomSearchPanel.tsx`, `components/RecommendationFiltersBox.tsx`, all three "Browse..." modal instances |
| Non-input label precedent followed | `components/SearchFilter.tsx`'s Min Personal Rating field |
| New modal's existing siblings, copied verbatim in shape | `components/SearchFilter.tsx`'s "Browse all keywords" modal, `components/UseMySeriesPanel.tsx`'s "Browse Series" modal |
| Motivating candidate for extending this spec to a 3rd usage | `.claude/SPEC_CANDIDATES.md`, "Share filter/sort logic between `SeriesList`/`SearchFilter`..." |

## Acceptance Criteria Summary

- [x] FRONTEND-077-AC-01: `hideInput` suppresses the text input and suggestions
- [x] FRONTEND-077-AC-02: pills still render and remain removable
- [x] FRONTEND-077-AC-03: a visible label remains when the input is hidden
- [x] FRONTEND-077-AC-04: `SearchFilter`'s inline Keywords field hides its input
- [x] FRONTEND-077-AC-05: `UseMySeriesPanel`'s inline Series field hides its input
- [x] FRONTEND-077-AC-06: no other usage is affected
- [x] FRONTEND-077-AC-07: `UseMySeriesPanel` gains a "Browse all keywords" modal paired with its Keywords filter field
- [x] FRONTEND-077-AC-08: `UseMySeriesPanel`'s inline Keywords filter field hides its input
