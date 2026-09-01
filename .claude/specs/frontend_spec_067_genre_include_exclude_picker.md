# Frontend Spec 067: Shared `GenreIncludeExcludePicker` Component

**Status**: Not started
**Priority**: P3
**Depends on**: none (net-new, self-contained component)
**Area**: Frontend (`components/GenreIncludeExcludePicker.tsx`, new)

## Overview

Three places in the app currently — or, per `frontend_spec_063`/`frontend_spec_068`/
`frontend_spec_069`, are about to — render a genre checkbox fieldset for "include" and a second,
separate one for "exclude": `SearchFilter` (My Series list), Recommendations' Custom Search panel
plus its shared Filters box, and "Use My Series"' specific-series picker. Building each as its own
hand-rolled pair of fieldsets would both duplicate the same JSX three times over and leave nothing
stopping a user from picking the same genre in both lists at once.

This spec extracts one shared component, `GenreIncludeExcludePicker`: a trigger button that opens a
modal listing every genre once, each with a single toggle control that cycles neutral → include →
exclude → neutral (or neutral → exclude → neutral in an exclude-only variant). Because each genre
has exactly one state, not two independent booleans, a genre can never be in both the included and
excluded lists at once — mutual exclusivity is a structural property of the component, not a
validation rule layered on top. This also collapses what would otherwise be two checkbox fieldsets
per consumer into one compact control (the user's own "reduce clutter" framing for this work).

`frontend_spec_063`, `frontend_spec_068`, and `frontend_spec_069` each wire this component into
their own consumer; none of them re-implement toggle/mutual-exclusivity logic themselves.

## Design Decisions

- **One button per genre, cycling state, not two checkboxes** — directly matches the shape the user
  asked for ("a button that can be toggled for each genre") and is the only shape that makes mutual
  exclusivity structural rather than enforced by extra logic reconciling two independent lists.
- **A modal, not an inline fieldset** — with up to 16 genres (`TmdbGenreTable.GENRES`) rendered
  twice as much visual text (state + label) as a plain checkbox, an always-visible fieldset would be
  more cluttered than today's two-fieldset baseline, not less. A modal keeps the collapsed state to
  one button with a summary, matching this spec's "reduce clutter" goal. Follows the same
  `role="dialog"`/`aria-modal="true"`/Escape-to-close pattern already used by `UseMySeriesPanel`'s
  "Browse Series" modal and `SearchFilter`'s "Browse all keywords" modal (`components/*.tsx`) —
  including the same "not a native `<dialog>`, deliberately" caveat those two already carry (jsdom's
  `<dialog>` support gaps).
- **Every toggle applies immediately via `onChange`; "Done" only closes the modal.** Matches every
  existing checkbox fieldset in this codebase (a click updates parent state immediately, there's no
  separate "Apply" step) — this component doesn't introduce a new interaction model, just a new
  control shape for the same immediate-apply behavior.
- **`mode: 'includeExclude' | 'excludeOnly'`, default `'includeExclude'`.** Recommendations' shared
  Filters box (`frontend_spec_068`) has no "include genres" concept outside Custom Search (trending/
  topRated/useMySeries source modes only ever had an exclude field) — `excludeOnly` renders the same
  toggle button but skips the `include` state in its cycle, so that consumer isn't forced to accept
  an `included` array it has nowhere to send.
- **Controlled component, no internal selection state.** `included`/`excluded` are props, `onChange`
  is the only way state changes — matches every other picker in this codebase (`KeywordPicker`,
  the existing checkbox fieldsets) and lets each consumer own persistence/reset (`Clear Filters`,
  `Reset Filters`) the same way it already does for its other fields.
- **`idPrefix` prop, required.** `SearchFilter`'s My Series page and Recommendations' Custom
  Search/Filters-box page never render two instances of this component on the same page
  simultaneously today, but a caller-supplied prefix (mirroring the existing
  `genre-checkbox-${genre}` id convention, just parameterized) removes any risk of DOM id collision
  if that ever changes, at zero cost to the three current call sites.
- **Defensive precedence if a caller's `included`/`excluded` props already overlap: exclude wins.**
  The component's own toggle logic can never produce this state, but a caller could still pass bad
  initial props. Mirrors `series_spec_042`'s SERIES-042-AC-05 backend precedent ("an excluded genre
  wins") so the one place this could theoretically happen resolves the same way the backend already
  does, rather than picking a new, undocumented tiebreak.

## Requirements

### Requirement 1: Renders a trigger button with a live selection summary

**User Story**: As a user of any consumer of this component, I want to see at a glance whether I
have any genre include/exclude filters active without opening the modal.

#### FRONTEND-067-AC-01 [AUTO]: renders a closed-by-default trigger button
**Statement**: The `GenreIncludeExcludePicker` component shall render a `<button>` labeled with its
`label` prop and no open modal, on initial render.

**Rationale**: Baseline collapsed state — the modal is opt-in, not always visible.

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx` (new)

**Test Case (Red)**:
```typescript
describe('FRONTEND-067-AC-01: closed by default', () => {
  it('renders the trigger button with no dialog present', () => {
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Genres" genreOptions={['Comedy', 'Drama']}
        included={[]} excluded={[]} onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Genres/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: render a trigger `<button>` plus conditional modal JSX gated on an
`open` `useState(false)`.

#### FRONTEND-067-AC-02 [AUTO]: trigger button summarizes the current selection
**Statement**: While `included` and/or `excluded` are non-empty, the `GenreIncludeExcludePicker`
component's trigger button shall include counts of both in its accessible text (e.g. "Genres — 2
included, 1 excluded"); while both are empty, the button shall show only `label`.

**Rationale**: Lets a user verify their active filters without opening the modal — the "make
verification clearer" half of the user's original ask.

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx`

**Test Case (Red)**:
```typescript
describe('FRONTEND-067-AC-02: trigger summary', () => {
  it('shows counts when a selection is active', () => {
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Genres" genreOptions={['Comedy', 'Drama', 'Horror']}
        included={['Comedy', 'Drama']} excluded={['Horror']} onChange={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Genres — 2 included, 1 excluded' }),
    ).toBeInTheDocument()
  })

  it('shows only the label when nothing is selected', () => {
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Genres" genreOptions={['Comedy']}
        included={[]} excluded={[]} onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Genres' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: derive the summary string from `included.length`/`excluded.length` in the
button's accessible name.

#### FRONTEND-067-AC-03 [AUTO]: clicking the trigger opens a modal listing every genre option
**Statement**: When the trigger button is clicked, the `GenreIncludeExcludePicker` component shall
open a `role="dialog"` modal containing one toggle control per entry in `genreOptions`.

**Rationale**: Core interaction — this is how a user reaches the actual toggles.

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx`
- Precedent: `components/UseMySeriesPanel.tsx` "Browse Series" modal (`role="dialog"`,
  `aria-modal="true"`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-067-AC-03: opens modal with one control per genre', () => {
  it('lists every genreOptions entry after clicking the trigger', () => {
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Genres" genreOptions={['Comedy', 'Drama']}
        included={[]} excluded={[]} onChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comedy: neutral' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drama: neutral' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: `open` state toggled by the trigger's `onClick`; modal renders a labeled
toggle button per `genreOptions` entry, `aria-label={`${genre}: ${state}`}`.

### Requirement 2: Toggling a genre's control cycles its state and keeps the two lists mutually exclusive

**User Story**: As a user, I want a single click per genre to move it between neutral, included, and
excluded, without ever being able to select the same genre in both lists.

#### FRONTEND-067-AC-04 [AUTO]: `includeExclude` mode — neutral click adds to `included`
**Statement**: When a neutral genre's toggle control is clicked and `mode` is `'includeExclude'`
(the default), the `GenreIncludeExcludePicker` component shall call `onChange` with that genre
appended to `included`, `excluded` unchanged.

**Rationale**: First step of the include/exclude/neutral cycle.

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx`

**Test Case (Red)**:
```typescript
describe('FRONTEND-067-AC-04: neutral -> include', () => {
  it('adds the genre to included on first click', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Genres" genreOptions={['Comedy']}
        included={[]} excluded={[]} onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: neutral' }))
    expect(onChange).toHaveBeenCalledWith({ included: ['Comedy'], excluded: [] })
  })
})
```

**Test Case (Green)**: click handler resolves current state from props, applies the
`includeExclude` cycle table, calls `onChange` with the derived next lists.

#### FRONTEND-067-AC-05 [AUTO]: include click moves the genre to `excluded`
**Statement**: When an included genre's toggle control is clicked, the `GenreIncludeExcludePicker`
component shall call `onChange` with that genre removed from `included` and appended to `excluded`
— never present in both simultaneously.

**Rationale**: Second step of the cycle; the mutual-exclusivity guarantee itself.

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx`
- Related: `FRONTEND-067-AC-04`

**Test Case (Red)**:
```typescript
describe('FRONTEND-067-AC-05: include -> exclude', () => {
  it('moves the genre from included to excluded, never both', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Genres" genreOptions={['Comedy']}
        included={['Comedy']} excluded={[]} onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres — 1 included' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: include' }))
    expect(onChange).toHaveBeenCalledWith({ included: [], excluded: ['Comedy'] })
  })
})
```

**Test Case (Green)**: same cycle table, `include` branch.

#### FRONTEND-067-AC-06 [AUTO]: exclude click returns the genre to neutral
**Statement**: When an excluded genre's toggle control is clicked, the `GenreIncludeExcludePicker`
component shall call `onChange` with that genre removed from `excluded` and not added to `included`.

**Rationale**: Closes the cycle back to its starting state.

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx`
- Related: `FRONTEND-067-AC-04`, `FRONTEND-067-AC-05`

**Test Case (Red)**:
```typescript
describe('FRONTEND-067-AC-06: exclude -> neutral', () => {
  it('removes the genre from excluded and adds it nowhere', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Genres" genreOptions={['Comedy']}
        included={[]} excluded={['Comedy']} onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres — 1 excluded' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: exclude' }))
    expect(onChange).toHaveBeenCalledWith({ included: [], excluded: [] })
  })
})
```

**Test Case (Green)**: same cycle table, `exclude` branch.

#### FRONTEND-067-AC-07 [AUTO]: `excludeOnly` mode skips the include state entirely
**Statement**: While `mode` is `'excludeOnly'`, the `GenreIncludeExcludePicker` component shall
cycle a genre's toggle control between only `neutral` and `exclude` — a neutral click calls
`onChange` with that genre appended to `excluded` directly, and `included` shall remain empty
regardless of clicks.

**Rationale**: Recommendations' Filters box has no include-genres concept outside Custom Search
(`frontend_spec_068`) — this mode lets that consumer reuse the same component without ever
producing an `included` value it has nowhere to send.

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx`
- Consumer: `frontend_spec_068_recommendations_exclude_genres_picker.md`

**Test Case (Red)**:
```typescript
describe('FRONTEND-067-AC-07: excludeOnly mode', () => {
  it('goes straight from neutral to excluded, skipping include', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Genres" genreOptions={['Comedy']} mode="excludeOnly"
        included={[]} excluded={[]} onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comedy: neutral' }))
    expect(onChange).toHaveBeenCalledWith({ included: [], excluded: ['Comedy'] })
  })
})
```

**Test Case (Green)**: cycle table branches on `mode`; `excludeOnly`'s neutral-click case sets
`excluded` directly instead of `included`.

### Requirement 3: Modal-level Clear/Done controls

**User Story**: As a user, I want a fast way to clear every genre filter at once, and a clear way to
close the modal when I'm done.

#### FRONTEND-067-AC-08 [AUTO]: "Clear" resets both lists to empty
**Statement**: When the modal's "Clear" button is clicked, the `GenreIncludeExcludePicker`
component shall call `onChange` with `{ included: [], excluded: [] }`.

**Rationale**: Fast reset without individually un-toggling each active genre.

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx`

**Test Case (Red)**:
```typescript
describe('FRONTEND-067-AC-08: Clear resets both lists', () => {
  it('calls onChange with both lists empty', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Genres" genreOptions={['Comedy', 'Drama']}
        included={['Comedy']} excluded={['Drama']} onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Genres/ }))
    fireEvent.click(screen.getByTestId('test-genre-picker-clear-btn'))
    expect(onChange).toHaveBeenCalledWith({ included: [], excluded: [] })
  })
})
```

**Test Case (Green)**: `handleClear` calls `onChange({ included: [], excluded: [] })`.

#### FRONTEND-067-AC-09 [AUTO]: "Done" and Escape close the modal without changing the selection
**Statement**: When the modal's "Done" button is clicked, or the Escape key is pressed while the
modal is open, the `GenreIncludeExcludePicker` component shall close the modal without calling
`onChange`.

**Rationale**: A pure dismiss action — every toggle already applies immediately (Design Decisions),
so closing has nothing left to "apply."

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx`
- Precedent: `components/UseMySeriesPanel.tsx` `handleSpecificSeriesModalKeyDown`

**Test Case (Red)**:
```typescript
describe('FRONTEND-067-AC-09: Done/Escape close without side effects', () => {
  it('closes on Done without calling onChange', () => {
    const onChange = vi.fn()
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Genres" genreOptions={['Comedy']}
        included={[]} excluded={[]} onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Genres' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

**Test Case (Green)**: `onKeyDown` on the dialog root checks `event.key === 'Escape'`, both it and
the Done button's `onClick` only flip the local `open` state.

### Requirement 4: Defensive precedence for pre-overlapping props

**User Story**: As a maintainer, I want a defined, tested behavior if a caller ever passes a genre
in both `included` and `excluded` (a caller bug), rather than undefined rendering.

#### FRONTEND-067-AC-10 [AUTO]: a genre present in both props renders as excluded
**Statement**: While a genre string appears in both the `included` and `excluded` props, the
`GenreIncludeExcludePicker` component shall render its toggle control in the `exclude` state.

**Rationale**: Mirrors `series_spec_042`'s SERIES-042-AC-05 backend precedent ("an excluded genre
wins") — the same tiebreak in the one caller-error case this component can't prevent by
construction (Design Decisions).

**References**:
- Component: `components/GenreIncludeExcludePicker.tsx`
- Backend precedent: `series_spec_042_exclude_genres_search.md`, SERIES-042-AC-05

**Test Case (Red)**:
```typescript
describe('FRONTEND-067-AC-10: overlapping props resolve to exclude', () => {
  it('renders exclude state when a genre is in both lists', () => {
    render(
      <GenreIncludeExcludePicker
        idPrefix="test" label="Genres" genreOptions={['Comedy']}
        included={['Comedy']} excluded={['Comedy']} onChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Genres/ }))
    expect(screen.getByRole('button', { name: 'Comedy: exclude' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: state resolution checks `excluded.includes(genre)` before
`included.includes(genre)`.

## Cross-References

| Concept | Location |
|---|---|
| New component | `frontend/src/components/GenreIncludeExcludePicker.tsx`, `GenreIncludeExcludePicker.module.css` |
| Existing modal precedent | `components/UseMySeriesPanel.tsx` ("Browse Series"), `components/SearchFilter.tsx` ("Browse all keywords") |
| Backend exclude-wins precedent | `series_spec_042_exclude_genres_search.md`, SERIES-042-AC-05 |
| Consumer: My Series list | `frontend_spec_063_exclude_genres_search_filter.md` |
| Consumer: Recommendations Custom Search / Filters box | `frontend_spec_068_recommendations_exclude_genres_picker.md` |
| Consumer: Use My Series panel | `frontend_spec_069_use_my_series_exclude_genres.md` |

## Acceptance Criteria Summary

- [ ] FRONTEND-067-AC-01: renders a closed-by-default trigger button
- [ ] FRONTEND-067-AC-02: trigger button summarizes the current selection
- [ ] FRONTEND-067-AC-03: clicking the trigger opens a modal listing every genre option
- [ ] FRONTEND-067-AC-04: `includeExclude` mode — neutral click adds to `included`
- [ ] FRONTEND-067-AC-05: include click moves the genre to `excluded`
- [ ] FRONTEND-067-AC-06: exclude click returns the genre to neutral
- [ ] FRONTEND-067-AC-07: `excludeOnly` mode skips the include state entirely
- [ ] FRONTEND-067-AC-08: "Clear" resets both lists to empty
- [ ] FRONTEND-067-AC-09: "Done" and Escape close the modal without changing the selection
- [ ] FRONTEND-067-AC-10: a genre present in both props renders as excluded
