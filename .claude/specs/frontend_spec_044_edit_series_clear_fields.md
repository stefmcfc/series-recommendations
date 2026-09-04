# Frontend Spec 044: EditSeriesForm — Explicit Per-Field Clear Buttons

**Status**: Complete
**Priority**: P3 (pairs with the backend capability this depends on)
**Depends on**: Series Spec 030 (`series_spec_030_clear_optional_fields.md`, the `clearedFields` PATCH capability
this spec's UI produces) — **backend must ship first**, this spec's payload is meaningless without it. Frontend
Spec 013 (`frontend_spec_013_star_ratings.md`, owns `StarRating`'s existing click-the-active-star-to-clear
gesture this spec hooks into for Personal Rating specifically) ✅.
**Area**: Frontend (`EditSeriesForm.tsx`, `SeriesFormFields.tsx`) — `AddSeriesForm.tsx` is explicitly unaffected
(see Requirement 4).

## Overview

`series_spec_030` adds a `clearedFields: string[]` field to the `PATCH /api/v1/series/{id}` request, letting the
backend distinguish "explicitly remove this value" from "field not sent, leave unchanged." This spec is the UI
half: a small "×" Clear button next to each optional field `EditSeriesForm` renders, wired to that new payload
field.

**Personal Rating is a special case, not a thirteenth button.** `StarRating` (`frontend_spec_013`) already has a
built-in clear gesture — clicking the currently-selected star deselects it, calling `onPersonalRatingChange(null)`.
Rather than bolt on a redundant Clear button beside a control that already has its own clear affordance, this spec
hooks `EditSeriesForm`'s existing `handlePersonalRatingChange` directly into the same `clearedFields` tracking the
other 12 buttons use.

## Design Decisions

- **`SeriesFormFields` gains one new optional prop, `onClearField?: (field: SeriesFormFieldName) => void`.** Its
  mere presence is the signal to render Clear buttons at all — when provided (only `EditSeriesForm` ever provides
  it), a small "×" button renders beside each of: Year, Genres, Tags, Total Seasons, Total Episodes, IMDb Rating,
  Rotten Tomatoes Rating, Rotten Tomatoes Popcornmeter, Personal Notes, Poster URL (10 of the 13 backend-clearable
  fields — the other 3 handled separately, below). `AddSeriesForm` never passes this prop, so its render is
  untouched (Requirement 4).
- **`currentSeason`/`currentEpisode` get their own inline Clear buttons directly in `EditSeriesForm.tsx`**, not
  via `SeriesFormFields` — these two fields are rendered as `SeriesFormFields`' `children`
  (`tooling_spec_005`'s existing split: fields common to both forms live in `SeriesFormFields`, fields unique to
  one form stay local), so their Clear buttons follow the same placement, using the same `clearedFields`
  state/handler `EditSeriesForm` passes down for everything else.
- **Personal Rating clears via its existing `StarRating` gesture, not a new button.** `EditSeriesForm`'s
  `handlePersonalRatingChange(value)` — already the callback `SeriesFormFields` invokes when a star is
  clicked/deselected — additionally marks/unmarks `personalRating` in `clearedFields` based on whether `value` is
  `null`. No change to `SeriesFormFields`' own Personal Rating markup.
- **Clicking a Clear button blanks the field's displayed value immediately** (so the UI and the pending "this
  will be cleared" intent never disagree) **and adds the field name to `clearedFields`.** Typing any new value
  into a field afterward removes it from `clearedFields` again — the two are mutually exclusive by construction:
  a field is either carrying a value, or explicitly marked cleared, never conceptually both (mirrors
  `series_spec_030`'s own AC-04 contradiction rule, enforced here client-side before a contradictory request
  could ever be sent).
- **A Clear button is disabled when its field is already blank** — nothing to clear, avoids a pointless/confusing
  enabled-but-inert affordance.
- **`buildPayload` gains `clearedFields: [...]`** whenever the set is non-empty, alongside its existing field
  population — omitted entirely (not sent as `[]`) when nothing was cleared, matching this codebase's existing
  wire-minimization convention (e.g. `frontend_spec_033`'s `discoverSortBy` omit-at-default precedent) rather
  than always sending an empty array.

---

## Requirement 1: `SeriesFormFields` renders Clear buttons when asked

**User story**: As a developer, I want the Clear-button UI to live in the one place both forms' shared fields are
already defined, gated behind an explicit opt-in so `AddSeriesForm` is naturally unaffected.

### FRONTEND-044-AC-01 [AUTO]
**Statement**: When `onClearField` is provided, `SeriesFormFields` shall render a Clear button beside each of
Year, Genres, Tags, Total Seasons, Total Episodes, IMDb Rating, Rotten Tomatoes Rating, Rotten Tomatoes
Popcornmeter, Personal Notes, and Poster URL.

**Test Case (Red)**:
```typescript
describe('FRONTEND-044-AC-01: Clear buttons render when onClearField is provided', () => {
  it('renders a Clear button for each applicable field', () => {
    render(
      <SeriesFormFields
        form={{ ...baseForm, year: '2020' }}
        fieldErrors={{}}
        updateField={vi.fn()}
        onPersonalRatingChange={vi.fn()}
        onPosterUrlChange={vi.fn()}
        onPosterLoadError={vi.fn()}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={false}
        onClearField={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /clear year/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear genres/i })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `onClearField` prop; conditionally render a small `<button aria-label="Clear
{Label}">` beside each listed field.

---

### FRONTEND-044-AC-02 [AUTO]
**Statement**: Clicking a field's Clear button shall blank that field's value and call `onClearField(fieldName)`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-044-AC-02: clicking Clear blanks the field and reports it', () => {
  it('calls onClearField and blanks the input', () => {
    const onClearField = vi.fn()
    const updateField = vi.fn(() => vi.fn())
    render(
      <SeriesFormFields
        form={{ ...baseForm, year: '2020' }}
        fieldErrors={{}}
        updateField={updateField}
        onPersonalRatingChange={vi.fn()}
        onPosterUrlChange={vi.fn()}
        onPosterLoadError={vi.fn()}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={false}
        onClearField={onClearField}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /clear year/i }))

    expect(onClearField).toHaveBeenCalledWith('year')
  })
})
```
**Test Case (Green)**: the Clear button's `onClick` calls both `onClearField(field)` and the field's own blank-out
(via the same `updateField`/direct state update path `EditSeriesForm` already owns).

---

### FRONTEND-044-AC-03 [AUTO]
**Statement**: A field's Clear button shall be `disabled` when that field's current value is already blank.

**Test Case (Red)**:
```typescript
describe('FRONTEND-044-AC-03: Clear disabled when already blank', () => {
  it('disables Clear for an already-empty field', () => {
    render(
      <SeriesFormFields
        form={{ ...baseForm, year: '' }}
        fieldErrors={{}}
        updateField={vi.fn()}
        onPersonalRatingChange={vi.fn()}
        onPosterUrlChange={vi.fn()}
        onPosterLoadError={vi.fn()}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={false}
        onClearField={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /clear year/i })).toBeDisabled()
  })
})
```
**Test Case (Green)**: `disabled={form.year.trim() === ''}` per field.

---

## Requirement 2: `EditSeriesForm` tracks and sends `clearedFields`

**User story**: As a user editing a series, I want clicking Clear on a field to actually remove that value when I
save, not just blank the box on screen.

### FRONTEND-044-AC-04 [AUTO]
**Statement**: `EditSeriesForm`'s submitted payload shall include `clearedFields` listing every field explicitly
cleared via a Clear button (or, for Personal Rating, via deselecting its star).

**Test Case (Red)**:
```typescript
describe('FRONTEND-044-AC-04: clearedFields is sent on save', () => {
  it('includes clearedFields for an explicitly cleared field', async () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING', personalRating: 4 } as Series
    mockUpdate.mockResolvedValue(series)
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /clear personal rating/i }))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ clearedFields: ['personalRating'] }),
      ),
    )
  })
})
```
**Test Case (Green)**: `EditSeriesForm` holds a `clearedFields: Set<SeriesFormFieldName>` state; `buildPayload`
includes it (as an array) when non-empty.

---

### FRONTEND-044-AC-05 [AUTO]
**Statement**: Typing a new value into a previously-cleared field shall remove it from `clearedFields` — the
saved payload carries the new value instead, not both.

**Test Case (Red)**:
```typescript
describe('FRONTEND-044-AC-05: re-typing a value un-clears the field', () => {
  it('removes the field from clearedFields once a new value is typed', async () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING', year: 2020 } as Series
    mockUpdate.mockResolvedValue(series)
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /clear year/i }))
    fireEvent.change(screen.getByLabelText(/^year/i), { target: { value: '2021' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ year: 2021, clearedFields: expect.not.arrayContaining(['year']) }),
      ),
    )
  })
})
```
**Test Case (Green)**: `updateField`'s wrapper removes the field from `clearedFields` whenever the new value is
non-blank.

---

### FRONTEND-044-AC-06 [AUTO]
**Statement**: Deselecting the currently-selected star in Personal Rating (setting it to `null`) shall mark
`personalRating` as cleared, without a separate Clear button being rendered for that field.

**Test Case (Red)**:
```typescript
describe('FRONTEND-044-AC-06: Personal Rating clears via its own star gesture', () => {
  it('has no separate Clear button, but clears via deselecting the star', async () => {
    const series = { id: '1', title: 'Show', status: 'WATCHING', personalRating: 4 } as Series
    mockUpdate.mockResolvedValue(series)
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /clear personal rating/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /4 stars/i })) // deselect: click the active value again
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ clearedFields: ['personalRating'] }),
      ),
    )
  })
})
```
**Test Case (Green)**: `handlePersonalRatingChange` adds/removes `'personalRating'` from `clearedFields` based on
whether the new value is `null`; no `onClearField`-driven button renders for it (excluded from the AC-01 list).

---

### FRONTEND-044-AC-07 [AUTO]
**Statement**: `currentSeason` and `currentEpisode` shall each render their own Clear button directly in
`EditSeriesForm`, wired to the same `clearedFields` state as every other field.

**Test Case (Red)**:
```typescript
describe('FRONTEND-044-AC-07: currentSeason/currentEpisode have their own Clear buttons', () => {
  it('clears currentSeason via its own button', async () => {
    const series = {
      id: '1', title: 'Show', status: 'WATCHING', currentSeason: 3,
    } as Series
    mockUpdate.mockResolvedValue(series)
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /clear current season/i }))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ clearedFields: ['currentSeason'] }),
      ),
    )
  })
})
```
**Test Case (Green)**: add the two buttons directly in `EditSeriesForm.tsx`'s existing `currentSeason`/
`currentEpisode` field blocks (passed as `SeriesFormFields`' `children`).

---

## Requirement 4: `AddSeriesForm` is unaffected

**User story**: As a user adding a new series, I shouldn't see clear-field affordances that make no sense before
anything has been saved.

### FRONTEND-044-AC-08 [AUTO]
**Statement**: `AddSeriesForm`'s rendered fields and submitted payload shall be completely unaffected by this
spec — no Clear buttons render, and `clearedFields` is never part of its payload.

**Test Case (Red)**:
```typescript
describe('FRONTEND-044-AC-08: AddSeriesForm is unaffected', () => {
  it('renders no Clear buttons and never sends clearedFields', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /^clear /i })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Show' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({ clearedFields: expect.anything() }),
      ),
    )
  })
})
```
**Test Case (Green)**: no change needed — `AddSeriesForm` never passes `onClearField` to `SeriesFormFields`
(AC-01's gating already ensures this), and its own `buildPayload` is untouched by this spec.

---

## Implementation Notes

- `types/series.ts`'s `UpdateSeriesRequest` gains an optional `clearedFields?: string[]` field, matching
  `series_spec_030`'s backend contract.
- The 10 `SeriesFormFields`-rendered Clear buttons' `aria-label`s follow `"Clear " + <field label>"` (e.g. "Clear
  Year", "Clear Rotten Tomatoes Rating (Tomatometer)") for unambiguous accessible names.

## Cross-References

| This spec | Source |
|---|---|
| Backend `clearedFields` capability this spec's UI produces — **must ship first** | `series_spec_030_clear_optional_fields.md` |
| `StarRating`'s existing click-to-deselect gesture, reused for Personal Rating's clear path | `frontend_spec_013_star_ratings.md` |
| `SeriesFormFields`' shared-vs-local field split (`children` for form-specific fields like `currentSeason`) | `tooling_spec_005` |
| `AddSeriesForm`'s `source` prop precedent for conditionally rendering `SeriesFormFields` content | `frontend_spec_034_recommendation_add_form_fields.md` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-044-AC-01: `SeriesFormFields` renders Clear buttons when `onClearField` is provided
- [x] FRONTEND-044-AC-02: clicking Clear blanks the field and reports it
- [x] FRONTEND-044-AC-03: Clear is disabled when the field is already blank
- [x] FRONTEND-044-AC-04: `clearedFields` is sent on save
- [x] FRONTEND-044-AC-05: re-typing a value un-clears the field
- [x] FRONTEND-044-AC-06: Personal Rating clears via its own star gesture, no separate button
- [x] FRONTEND-044-AC-07: `currentSeason`/`currentEpisode` have their own Clear buttons
- [x] FRONTEND-044-AC-08: `AddSeriesForm` is completely unaffected
