# Frontend Spec 077: `KeywordPicker` Gains a Pills-Only Mode

**Status**: Not started
**Priority**: P3
**Depends on**: none
**Area**: Frontend (`components/KeywordPicker.tsx`, `components/SearchFilter.tsx`, `components/UseMySeriesPanel.tsx`)

## Overview

`KeywordPicker` always renders a text input, a suggestions list, and selected pills together — there's no way to show just the pills. In two places, this duplicates a search box that already exists elsewhere on the same panel: `SearchFilter.tsx`'s inline Keywords field sits right next to a "Browse all keywords" button that opens a second `KeywordPicker` instance with its own full typing/search UI, and `UseMySeriesPanel.tsx`'s inline Series field pairs the same way with its own "Browse Series" modal. In both cases the inline field's own input is redundant — this spec adds a way to suppress it, keeping just the pills (with their existing per-pill removal) inline.

This does **not** apply to any of `KeywordPicker`'s other 7 usages (`CustomSearchPanel`'s Keywords/Countries/Language, `RecommendationFiltersBox`'s Countries/Language, or the two modal instances themselves) — none of those have a paired modal duplicating their own input, so removing it would remove the only way to add a new entry.

## Design Decisions

- **New optional prop `hideInput?: boolean`** (default `false`) on `KeywordPicker`. When `true`, the text `<input>` and its suggestions `<ul>` (`KeywordPicker.tsx:199-223`) are not rendered; the selected-pills `<ul>` (`KeywordPicker.tsx:225-246`) renders exactly as it does today, including per-pill removal.
- **A visible label is still required for accessibility** even with the input gone — when `hideInput` is `true`, render a plain `<span>{label}</span>` in place of the `<label htmlFor={id}>` (which has nothing to point `htmlFor` at once the input is gone), the same pattern `SearchFilter.tsx` already uses for its non-input Min Personal Rating field (`<span>Min Personal Rating</span>`).
- **Applied to exactly 2 call sites**: `SearchFilter.tsx`'s inline Keywords field (`id="search-keywords"`, paired with the "Browse all keywords" modal's own `id="browse-keywords"` instance) and `UseMySeriesPanel.tsx`'s inline Series field (`id="specific-series-picker"`, paired with the "Browse Series" modal's own `id="browse-series"` instance). Neither modal instance itself changes — they keep their full input, since they're the dedicated place to add new entries now.
- **Behavior change, recorded explicitly**: with `hideInput` set, a user can no longer add a *new* keyword/series from the inline field — only remove an already-selected one via its pill's "×". Adding requires opening the paired "Browse..." modal. This is the intended outcome, not a side effect to work around.

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

**Rationale**: Explicit regression guard — this spec's scope is exactly 2 of 9 usages.

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

## Cross-References

| Concept | Location |
|---|---|
| Component enhanced | `components/KeywordPicker.tsx` |
| Applied usages | `components/SearchFilter.tsx` (Keywords), `components/UseMySeriesPanel.tsx` (Series) |
| Unchanged usages | `components/CustomSearchPanel.tsx`, `components/RecommendationFiltersBox.tsx`, both "Browse..." modal instances |
| Non-input label precedent followed | `components/SearchFilter.tsx`'s Min Personal Rating field |

## Acceptance Criteria Summary

- [ ] FRONTEND-077-AC-01: `hideInput` suppresses the text input and suggestions
- [ ] FRONTEND-077-AC-02: pills still render and remain removable
- [ ] FRONTEND-077-AC-03: a visible label remains when the input is hidden
- [ ] FRONTEND-077-AC-04: `SearchFilter`'s inline Keywords field hides its input
- [ ] FRONTEND-077-AC-05: `UseMySeriesPanel`'s inline Series field hides its input
- [ ] FRONTEND-077-AC-06: no other usage is affected
