# Frontend Spec 076: `GenreIncludeExcludePicker` Gains Removable Chips and a Rename

**Status**: Not started
**Priority**: P3
**Depends on**: Frontend Spec 067 (`frontend_spec_067_genre_include_exclude_picker.md`, owns the component this spec enhances) ✅ required
**Area**: Frontend (`components/GenreIncludeExcludePicker.tsx`)

## Overview

`GenreIncludeExcludePicker` (used on My Series' filter sheet, the "Use My Series" recommendations panel, and Custom Search) already shows a count summary on its closed trigger button (e.g. "Genres — 2 included, 1 excluded"), but a user who wants to remove one selection has to reopen the modal and find it again in the full genre grid. This spec adds removable chips below the trigger, showing each included and excluded genre by name, each removable with its own "×" — no modal reopen required. It also renames the button/dialog-heading text to "Include / Exclude Genres" everywhere the component is used in its default (include/exclude) mode.

This is a shared-component change: it applies everywhere `GenreIncludeExcludePicker` is used in `includeExclude` mode (`SearchFilter.tsx`, `UseMySeriesPanel.tsx`, `CustomSearchPanel.tsx`), not just My Series. `RecommendationFiltersBox.tsx`'s `excludeOnly` usage is out of scope for the rename (see Design Decisions) but still gains the chip display for its excluded genres.

## Design Decisions

- **Chips render below the trigger button, always, when either list is non-empty** — one row (or two, one per list) of chips, included genres visually distinguished from excluded ones (e.g. by color/prefix), each with an "×" button.
- **Removing a chip calls the same `onChange` the modal's own toggle uses** — `onChange({ included: included.filter(g => g !== genre), excluded })` (or the `excluded` equivalent) — no new state, no need to open `open`.
- **Rename applies to the `label` prop value at the 3 `includeExclude`-mode call sites**, since `label` already drives both the closed-button text and the modal's `<h2>` heading (`GenreIncludeExcludePicker.tsx:117,131`) — no new prop needed:
  - `SearchFilter.tsx:234`: `"Genres"` → `"Include / Exclude Genres"`
  - `UseMySeriesPanel.tsx:136`: `"Filter by Genre"` → `"Include / Exclude Genres"`
  - `CustomSearchPanel.tsx:54`: `"Genres"` → `"Include / Exclude Genres"`
- **`RecommendationFiltersBox.tsx:168`'s `excludeOnly` usage keeps its own label** ("Exclude Genres") — renaming to "Include / Exclude Genres" wouldn't fit a control with no include concept. It still gains the chip display (excluded-only chips) since that part of this spec isn't mode-specific.
- **`buildTriggerSummary`'s existing count-summary text stays as the button's own label** — the chips are a new, separate element below the button, not a replacement for the count summary.

## Requirements

### Requirement 1: removable chips below the closed trigger

**User Story**: As a user, I want to see and remove individual included/excluded genres without reopening the picker.

#### FRONTEND-076-AC-01 [AUTO]: included genres render as removable chips
**Statement**: While `included` is non-empty, `GenreIncludeExcludePicker` shall render one chip per included genre below the trigger button, each with a button labelled `Remove {genre} from included` that, when clicked, calls `onChange` with that genre removed from `included`.

**Rationale**: Core removable-chip behavior for included genres.

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx`

**Test Case (Red)**:
```typescript
describe('FRONTEND-076-AC-01: included genres render as removable chips', () => {
  it('renders a chip per included genre and removes it on click', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Include / Exclude Genres"
        genreOptions={['Comedy', 'Drama']} included={['Comedy']} excluded={[]}
        onChange={onChange}
      />,
    )
    expect(screen.getByText('Comedy')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Comedy from included' }))
    expect(onChange).toHaveBeenCalledWith({ included: [], excluded: [] })
  })
})
```

**Test Case (Green)**: render a `<ul>`/chip list below the trigger button, mapping `included`, each chip's remove button calling `onChange({ included: included.filter((g) => g !== genre), excluded })`.

#### FRONTEND-076-AC-02 [AUTO]: excluded genres render as removable chips
**Statement**: While `excluded` is non-empty, `GenreIncludeExcludePicker` shall render one chip per excluded genre below the trigger button, visually distinguished from included chips, each with a button labelled `Remove {genre} from excluded` that, when clicked, calls `onChange` with that genre removed from `excluded`.

**Rationale**: Core removable-chip behavior for excluded genres — applies in both `includeExclude` and `excludeOnly` modes.

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx`

**Test Case (Red)**:
```typescript
describe('FRONTEND-076-AC-02: excluded genres render as removable chips', () => {
  it('renders a chip per excluded genre and removes it on click', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Exclude Genres" mode="excludeOnly"
        genreOptions={['Comedy', 'Horror']} included={[]} excluded={['Horror']}
        onChange={onChange}
      />,
    )
    expect(screen.getByText('Horror')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Horror from excluded' }))
    expect(onChange).toHaveBeenCalledWith({ included: [], excluded: [] })
  })
})
```

**Test Case (Green)**: same chip-list mechanism as AC-01, mapping `excluded`, visually distinguished styling (new CSS class).

#### FRONTEND-076-AC-03 [AUTO]: no chips render when both lists are empty
**Statement**: While both `included` and `excluded` are empty, `GenreIncludeExcludePicker` shall render no chip list at all.

**Rationale**: Avoid an empty, pointless chip container.

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx`

**Test Case (Red)**:
```typescript
describe('FRONTEND-076-AC-03: no chips when nothing is selected', () => {
  it('renders no chip list when included/excluded are both empty', () => {
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Include / Exclude Genres"
        genreOptions={['Comedy']} included={[]} excluded={[]} onChange={vi.fn()}
      />,
    )
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: conditionally render the chip container only when `included.length > 0 || excluded.length > 0`.

### Requirement 2: rename to "Include / Exclude Genres" at the three include/exclude call sites

**User Story**: As a user, I want the button that lets me both include and exclude genres to say so, rather than just "Genres" or "Filter by Genre".

#### FRONTEND-076-AC-04 [AUTO]: `SearchFilter` uses the new label
**Statement**: `SearchFilter.tsx`'s `GenreIncludeExcludePicker` usage shall pass `label="Include / Exclude Genres"`.

**Rationale**: Direct rename per Design Decisions.

**References**:
- Component: `components/SearchFilter.tsx:234`

**Test Case (Red)**:
```typescript
describe('FRONTEND-076-AC-04: SearchFilter genre picker is renamed', () => {
  it('renders the trigger as "Include / Exclude Genres"', () => {
    render(<SearchFilter isOpen={true} onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Include / Exclude Genres' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: change `label="Genres"` to `label="Include / Exclude Genres"` at the call site.

#### FRONTEND-076-AC-05 [AUTO]: `UseMySeriesPanel` and `CustomSearchPanel` use the new label
**Statement**: `UseMySeriesPanel.tsx`'s and `CustomSearchPanel.tsx`'s `GenreIncludeExcludePicker` usages shall each pass `label="Include / Exclude Genres"`.

**Rationale**: Consistency across every include/exclude usage.

**References**:
- Component: `components/UseMySeriesPanel.tsx:136`, `components/CustomSearchPanel.tsx:54`

**Test Case (Red)**:
```typescript
describe('FRONTEND-076-AC-05: other include/exclude usages are renamed', () => {
  it('renders "Include / Exclude Genres" in UseMySeriesPanel', () => {
    render(<UseMySeriesPanel state={initialState} updateState={vi.fn()} allSeries={[]} genreOptions={['Comedy']} />)
    expect(screen.getByRole('button', { name: 'Include / Exclude Genres' })).toBeInTheDocument()
  })

  it('renders "Include / Exclude Genres" in CustomSearchPanel', () => {
    render(<CustomSearchPanel /* ...required props... */ />)
    expect(screen.getByRole('button', { name: 'Include / Exclude Genres' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: change both call sites' `label` prop value.

#### FRONTEND-076-AC-06 [AUTO]: `RecommendationFiltersBox`'s exclude-only usage is unchanged
**Statement**: `RecommendationFiltersBox.tsx`'s `excludeOnly`-mode `GenreIncludeExcludePicker` usage shall keep `label="Exclude Genres"`, unrenamed.

**Rationale**: Explicit regression guard — the rename must not spread to a mode it doesn't fit.

**References**:
- Component: `components/RecommendationFiltersBox.tsx:168`

**Test Case (Red)**:
```typescript
describe('FRONTEND-076-AC-06: exclude-only usage keeps its own label', () => {
  it('still renders "Exclude Genres", not the renamed label', () => {
    render(<RecommendationFiltersBox /* ...required props... */ />)
    expect(screen.getByRole('button', { name: 'Exclude Genres' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Include / Exclude Genres' })).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: no change to this call site's `label` prop.

## Cross-References

| Concept | Location |
|---|---|
| Component enhanced | `frontend_spec_067_genre_include_exclude_picker.md`, `components/GenreIncludeExcludePicker.tsx` |
| Renamed call sites | `components/SearchFilter.tsx`, `components/UseMySeriesPanel.tsx`, `components/CustomSearchPanel.tsx` |
| Unchanged call site | `components/RecommendationFiltersBox.tsx` (`excludeOnly` mode) |

## Acceptance Criteria Summary

- [ ] FRONTEND-076-AC-01: included genres render as removable chips
- [ ] FRONTEND-076-AC-02: excluded genres render as removable chips
- [ ] FRONTEND-076-AC-03: no chips render when both lists are empty
- [ ] FRONTEND-076-AC-04: `SearchFilter` uses the new label
- [ ] FRONTEND-076-AC-05: `UseMySeriesPanel` and `CustomSearchPanel` use the new label
- [ ] FRONTEND-076-AC-06: `RecommendationFiltersBox`'s exclude-only usage is unchanged
