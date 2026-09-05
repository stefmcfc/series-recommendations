# Frontend Spec 091: Series Form Validation Gaps + Persistent Save/Cancel & Error Visibility

**Status**: Complete
**Priority**: P3
**Depends on**: `series_spec_050_currentepisode_and_rotten_tomatoes_bounds.md` (Requirement 1 relies on the matching backend `currentEpisode`/`totalEpisodes` check landing first, so client and server agree — see Design Decisions)
**Area**: Frontend (`utils/seriesFormValidation.ts`, `components/EditSeriesForm.tsx`, `components/AddSeriesForm.tsx`, `components/SeriesFormFields.tsx`, their `.module.css` files)

## Overview

Two unrelated gaps found while investigating a user report of "invalid data getting through" on `EditSeriesForm`, both confirmed by reading the actual code and existing tests, plus a follow-up UX question about whether the forms' Save/Cancel controls and error messages need the same "persists in view" treatment `frontend_spec_090` gives `SeriesDetail`'s back button. First: none of the whole-number-only fields (`totalSeasons`, `totalEpisodes`, `rottenTomatoesRating`, `rottenTomatoesPopcornmeter`, and `EditSeriesForm`'s own `currentSeason`/`currentEpisode`) reject a decimal value — `"3.5"` passes every existing range check unchanged, since none of them test `Number.isInteger`. Second, `EditSeriesForm`'s `currentEpisode` isn't cross-checked against `totalEpisodes` at all — confirmed this was a **deliberate** decision in `frontend_spec_004` ("the backend doesn't do that check either"), now stale once `series_spec_050` adds the matching backend check. Third (the follow-up question): both `AddSeriesForm` and `EditSeriesForm` share an identical structural gap — the top-level error banner renders right after the heading, and Save/Cancel sit at the very bottom, with no `max-height`/`overflow` on the dialog itself (the `.overlay` around it scrolls as a whole) — so a long form can scroll both out of view at the same time, in opposite directions.

## Design Decisions

- **`currentEpisode` cross-validation depends on `series_spec_050` landing first.** `frontend_spec_004`'s original reasoning for *not* adding this check was explicit: a client-only check would reject something the server would still accept, a real client/server drift risk. Adding the frontend check without the matching backend fix would just move that same drift the other way round (frontend stricter than backend). This spec's Requirement 1 assumes `SERIES-050-AC-01`/`AC-02` are already implemented.
- **Integer enforcement applies to every whole-number field except `imdbRating`, deliberately.** `imdbRating` already renders with `step="0.1"` (`SeriesFormFields.tsx`) and is legitimately decimal (e.g. `8.7`) — no change there. `totalSeasons`/`totalEpisodes`/`rottenTomatoesRating`/`rottenTomatoesPopcornmeter` (shared, `seriesFormValidation.ts`, affecting both `AddSeriesForm` and `EditSeriesForm`) and `EditSeriesForm`'s own `currentSeason`/`currentEpisode` are all counts or percentages that are never fractional in reality.
- **`Number.isInteger` subsumes the existing `Number.isNaN` check** — `Number.isInteger(NaN)` is already `false`, so each fixed validator drops its separate `Number.isNaN(...)` clause rather than keeping a now-redundant one alongside the new `!Number.isInteger(...)` check.
- **Native `step`/`min` attributes are bundled into the same fix, not a separate requirement** — each AC below that touches a validator also adds the matching HTML attribute (`step="1"`, `min="1"` or `min="0"`) to that field's `<input>`. Both forms already render `noValidate` on their `<form>` (deliberately suppressing the browser's own validation-blocking UI — the JS `validate()` call is what actually blocks submission), so this is a pure UX nicety (correct spinner increments, sensible mobile numeric-keypad behavior) layered on top of the real enforcement, not a substitute for it.
- **`AddSeriesForm` gets the same Requirement 3/4 treatment as `EditSeriesForm`, not just the form the user named.** Confirmed via reading both files: `AddSeriesForm` has the exact same structure (`submitError` right after the heading, `.actions` at the very bottom, identical `.overlay`/`.dialog` CSS with no internal scroll region) — `frontend_spec_004`'s own precedent is to keep these two forms visually/behaviorally consistent even though they're separate, unshared components. Fixing only `EditSeriesForm` would leave `AddSeriesForm` with the identical, now-inconsistent gap.
- **Persistent Save/Cancel is a sticky *footer*, not a sticky *header* like `SeriesDetail`'s back button** — the footer already contains the natural place for feedback (you just clicked Save), so the top-level error banner moves down into the same sticky area instead of staying at the top, and a new field-validation summary joins it. This answers both of the follow-up question's parts (persistent CTA, and error-message visibility) with one consistent piece of UI rather than two separate mechanisms.
- **A field-error summary line is added for the client-validation-blocks-submit case, not scroll-to-first-error.** Today, when `validate(form)` fails, `fieldErrors` populates and each error renders inline next to its own field — but nothing indicates *that* happened if the invalid field is scrolled out of view; the user just sees Save silently do nothing. Scroll-to-first-invalid-field would need a ref per field (a materially bigger change); a plain summary text in the sticky footer (driven by the already-existing `fieldErrors` state — no new state needed) is the smaller, still-effective fix.
- **This introduces the same first-of-its-kind `position: sticky` pattern as `frontend_spec_090`** — confirmed there's still no other `position: sticky` usage anywhere in this codebase as of that spec. The visual "stays pinned while scrolling" behavior is therefore `[MANUAL]` for the same reason: jsdom (Vitest's test environment) doesn't run layout or provide a scrollable viewport.

## Requirements

### Requirement 1: `currentEpisode` cross-validated against `totalEpisodes`

**User Story**: As a user, I want `EditSeriesForm` to catch an impossible `currentEpisode` before I submit, the same way it already does for `currentSeason`.

#### FRONTEND-091-AC-01 [AUTO]: Submit is blocked when `currentEpisode` exceeds `totalEpisodes`
**Statement**: If `currentEpisode` and `totalEpisodes` are both provided and `currentEpisode` exceeds `totalEpisodes`, then `EditSeriesForm` shall display "Current episode cannot exceed total episodes" next to the `currentEpisode` field and shall not call `seriesApi.update`.

**Rationale**: Closes the asymmetry with `currentSeason`'s existing, equivalent check — the explicit user-reported gap.

**References**:
- Component: `components/EditSeriesForm.tsx` (`validateCurrentEpisode`, mirrors `validateCurrentSeason`'s existing shape)
- Backend: `series_spec_050_currentepisode_and_rotten_tomatoes_bounds.md` (`SERIES-050-AC-01`) — the matching server-side check this depends on
- Supersedes: `frontend_spec_004_edit_delete_series.md` (Design Decisions, the original "backend doesn't check this either" rationale) and its existing test `'does not cross-validate currentEpisode against totalEpisodes'` (`EditSeriesForm.test.tsx`), which this spec's implementation flips

**Test Case (Red)**:
```typescript
describe('FRONTEND-091-AC-01: currentEpisode cross-validated against totalEpisodes', () => {
  it('blocks submit when currentEpisode exceeds totalEpisodes', () => {
    renderForm({ series: makeSeries({ totalEpisodes: 5, currentEpisode: 50 }) })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(
      screen.getByText(/current episode cannot exceed total episodes/i),
    ).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
```

**Test Case (Green)**: extend `validateCurrentEpisode` with the same `totalEpisodes` cross-check `validateCurrentSeason` already has for `totalSeasons`. Replace `EditSeriesForm.test.tsx`'s existing `'does not cross-validate currentEpisode against totalEpisodes'` test (which currently asserts the old, now-superseded behavior) with this one.

### Requirement 2: Whole-number fields reject non-integer values

**User Story**: As a user, I want fields that are always whole numbers (season/episode counts, Rotten Tomatoes percentages) to reject a decimal value, not silently accept one.

#### FRONTEND-091-AC-02 [AUTO]: `validateTotalSeasons` rejects a non-integer value
**Statement**: If `totalSeasons` is provided and is not a whole number, then `validateTotalSeasons` shall set an error on `totalSeasons`.

**Rationale**: `"3.5"` seasons is meaningless; today it passes silently.

**References**:
- Util: `utils/seriesFormValidation.ts` (`validateTotalSeasons`)
- Consumers: `components/SeriesFormFields.tsx` (`totalSeasons` `<input type="number">`, gains `step="1"`) — shared by both `AddSeriesForm` and `EditSeriesForm`

**Test Case (Red)**:
```typescript
it('FRONTEND-091-AC-02: validateTotalSeasons rejects a non-integer value', () => {
  const errors: { totalSeasons?: string } = {}
  validateTotalSeasons({ totalSeasons: '3.5' }, errors)
  expect(errors.totalSeasons).toBe('Total seasons must be a whole number of at least 1')
})
```

**Test Case (Green)**: `if (!Number.isInteger(totalSeasons) || totalSeasons < 1) { errors.totalSeasons = 'Total seasons must be a whole number of at least 1' }` (drops the now-redundant separate `Number.isNaN` clause). Add `step="1"` to the `totalSeasons` input in `SeriesFormFields.tsx`.

#### FRONTEND-091-AC-03 [AUTO]: `validateTotalEpisodes` rejects a non-integer value
**Statement**: If `totalEpisodes` is provided and is not a whole number, then `validateTotalEpisodes` shall set an error on `totalEpisodes`.

**Rationale**: Same fix as AC-02, for the paired field.

**Test Case (Red)**:
```typescript
it('FRONTEND-091-AC-03: validateTotalEpisodes rejects a non-integer value', () => {
  const errors: { totalEpisodes?: string } = {}
  validateTotalEpisodes({ totalEpisodes: '12.5' }, errors)
  expect(errors.totalEpisodes).toBe('Total episodes must be a whole number of at least 1')
})
```

**Test Case (Green)**: same shape as AC-02's fix, applied to `validateTotalEpisodes` and the `totalEpisodes` input's `step="1"`.

#### FRONTEND-091-AC-04 [AUTO]: `validateRottenTomatoesRating` rejects a non-integer value
**Statement**: If `rottenTomatoesRating` is provided and is not a whole number, then `validateRottenTomatoesRating` shall set an error on `rottenTomatoesRating`.

**Rationale**: A Tomatometer score is always a whole percentage; `"55.5"` passes today.

**Test Case (Red)**:
```typescript
it('FRONTEND-091-AC-04: validateRottenTomatoesRating rejects a non-integer value', () => {
  const errors: { rottenTomatoesRating?: string } = {}
  validateRottenTomatoesRating({ rottenTomatoesRating: '55.5' }, errors)
  expect(errors.rottenTomatoesRating).toBe(
    'Rotten Tomatoes rating must be a whole number between 0 and 100',
  )
})
```

**Test Case (Green)**: `if (!Number.isInteger(rottenTomatoesRating) || rottenTomatoesRating < 0 || rottenTomatoesRating > 100) { ... }`. Add `step="1"` to the `rottenTomatoesRating` input.

#### FRONTEND-091-AC-05 [AUTO]: `validateRottenTomatoesPopcornmeter` rejects a non-integer value
**Statement**: If `rottenTomatoesPopcornmeter` is provided and is not a whole number, then `validateRottenTomatoesPopcornmeter` shall set an error on `rottenTomatoesPopcornmeter`.

**Rationale**: Same fix as AC-04, for the Popcornmeter (audience) score.

**Test Case (Red)**:
```typescript
it('FRONTEND-091-AC-05: validateRottenTomatoesPopcornmeter rejects a non-integer value', () => {
  const errors: { rottenTomatoesPopcornmeter?: string } = {}
  validateRottenTomatoesPopcornmeter({ rottenTomatoesPopcornmeter: '87.2' }, errors)
  expect(errors.rottenTomatoesPopcornmeter).toBe(
    'Rotten Tomatoes rating must be a whole number between 0 and 100',
  )
})
```

**Test Case (Green)**: same shape as AC-04's fix, applied to `validateRottenTomatoesPopcornmeter` and its input's `step="1"`.

#### FRONTEND-091-AC-06 [AUTO]: `EditSeriesForm`'s `currentSeason` validation rejects a non-integer value
**Statement**: If `currentSeason` is provided and is not a whole number, then `EditSeriesForm` shall display an inline error next to `currentSeason` and shall not call `seriesApi.update`.

**Rationale**: Same class of gap, for the one field-specific validator not in the shared util.

**Test Case (Red)**:
```typescript
it('FRONTEND-091-AC-06: blocks submit when currentSeason is not a whole number', () => {
  renderForm({ series: makeSeries({ currentSeason: 2 }) })
  fireEvent.change(screen.getByLabelText('Current Season'), { target: { value: '2.5' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
  expect(
    screen.getByText(/current season must be a whole number of at least 1/i),
  ).toBeInTheDocument()
  expect(mockUpdate).not.toHaveBeenCalled()
})
```

**Test Case (Green)**: extend `validateCurrentSeason`'s existing `< 1` check to `!Number.isInteger(currentSeason) || currentSeason < 1`, updated message "Current season must be a whole number of at least 1". Add `step="1"` to the `currentSeason` input.

#### FRONTEND-091-AC-07 [AUTO]: `EditSeriesForm`'s `currentEpisode` validation rejects a non-integer value
**Statement**: If `currentEpisode` is provided and is not a whole number, then `EditSeriesForm` shall display an inline error next to `currentEpisode` and shall not call `seriesApi.update`.

**Rationale**: Same fix as AC-06, for the paired field.

**Test Case (Red)**:
```typescript
it('FRONTEND-091-AC-07: blocks submit when currentEpisode is not a whole number', () => {
  renderForm({ series: makeSeries({ currentEpisode: 4 }) })
  fireEvent.change(screen.getByLabelText('Current Episode'), { target: { value: '4.5' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
  expect(
    screen.getByText(/current episode must be a whole number of at least 1/i),
  ).toBeInTheDocument()
  expect(mockUpdate).not.toHaveBeenCalled()
})
```

**Test Case (Green)**: same shape as AC-06's fix, applied to `validateCurrentEpisode`'s `< 1` clause and the `currentEpisode` input's `step="1"`.

### Requirement 3: Persistent Save/Cancel and error visibility — `EditSeriesForm`

**User Story**: As a user filling in a long edit form, I want Save/Cancel reachable without scrolling to the bottom, and to know why nothing happened if my submit was blocked, even if the actual problem is scrolled out of view.

#### FRONTEND-091-AC-08 [AUTO]: Submit error renders adjacent to the actions row
**Statement**: `EditSeriesForm` shall render its top-level submit-error banner immediately adjacent to the Save/Cancel actions row, not near the heading.

**Rationale**: Positions the API-failure message where the user is actually looking right after clicking Save.

**References**:
- Component: `components/EditSeriesForm.tsx` (`submitError`, currently rendered right after the `<h2>` heading at the top; `.actions` div at the bottom)

**Test Case (Red)**:
```typescript
it('FRONTEND-091-AC-08: submit error renders next to the actions row', async () => {
  mockUpdate.mockRejectedValue(new ApiError('Server error', 500))
  renderForm({ series: makeSeries() })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  const error = await screen.findByText('Server error')
  const actions = screen.getByRole('button', { name: /^save$/i }).closest('div')
  expect(error.compareDocumentPosition(actions as Element) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBeFalsy()
})
```

**Test Case (Green)**: move the `{submitError && <div className={styles.submitError} role="alert">...}` block from right after the heading to immediately before (or inside) the `.actions` div.

#### FRONTEND-091-AC-09 [AUTO]: A summary message appears when validation blocks submit
**Statement**: While `EditSeriesForm`'s field-level validation errors are non-empty after a blocked submit, `EditSeriesForm` shall display a summary message adjacent to the actions row.

**Rationale**: Without this, a blocked submit is silent if the actual invalid field is scrolled out of view — the user sees nothing happen and no reason why.

**Test Case (Red)**:
```typescript
it('FRONTEND-091-AC-09: shows a summary message when validation blocks submit', () => {
  renderForm({ series: makeSeries({ currentSeason: 0 }) })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
  expect(screen.getByText(/please review the highlighted fields above/i)).toBeInTheDocument()
})
```

**Test Case (Green)**: render `{Object.keys(fieldErrors).length > 0 && <p className={styles.validationSummary} role="alert">Please review the highlighted fields above.</p>}` next to the actions row — driven entirely by the existing `fieldErrors` state, no new state needed.

#### FRONTEND-091-AC-10 [MANUAL]: Save/Cancel remain visible while scrolling
**Statement**: While the user has scrolled down a long `EditSeriesForm`, the Save/Cancel actions shall remain visible without requiring the user to scroll to the bottom.

**Verification**: Manual check in browser — open Edit on a series with enough populated fields to make the dialog taller than the viewport, scroll partway down, and confirm Save/Cancel (and, if present, the AC-08/AC-09 messages) are still visible. Not automatable — same jsdom/layout limitation as `frontend_spec_090`'s `FRONTEND-090-AC-02`.

**References**:
- CSS: `components/EditSeriesForm.module.css` (`.overlay` — the actual scrolling container, `overflow-y: auto`; `.dialog` has no `max-height`/`overflow` of its own)

**Test Case (Green)**: give the `.actions` div (now also containing the AC-08/AC-09 messages) `position: sticky; bottom: 0; background: var(--bg);` plus enough top padding/border to visually separate it from the scrolling content above.

### Requirement 4: Persistent Save/Cancel and error visibility — `AddSeriesForm`

**User Story**: As a user filling in a long add-series form, I want the same reachable Save/Cancel and error visibility `EditSeriesForm` gets, since both forms share the identical gap today.

#### FRONTEND-091-AC-11 [AUTO]: Submit error renders adjacent to the actions row
**Statement**: `AddSeriesForm` shall render its top-level submit-error banner immediately adjacent to the Save/Cancel actions row, not near the heading.

**Rationale**: Same fix as `AC-08`, mirrored into the sibling form.

**Test Case (Green)**: same change as `AC-08`, applied to `components/AddSeriesForm.tsx`.

#### FRONTEND-091-AC-12 [AUTO]: A summary message appears when validation blocks submit
**Statement**: While `AddSeriesForm`'s field-level validation errors are non-empty after a blocked submit, `AddSeriesForm` shall display a summary message adjacent to the actions row.

**Rationale**: Same fix as `AC-09`, mirrored into the sibling form.

**Test Case (Green)**: same change as `AC-09`, applied to `components/AddSeriesForm.tsx`.

#### FRONTEND-091-AC-13 [MANUAL]: Save/Cancel remain visible while scrolling
**Statement**: While the user has scrolled down a long `AddSeriesForm`, the Save/Cancel actions shall remain visible without requiring the user to scroll to the bottom.

**Verification**: Manual check in browser, same method as `AC-10`, against `AddSeriesForm`.

**Test Case (Green)**: same CSS change as `AC-10`, applied to `components/AddSeriesForm.module.css`.

## Cross-References

| Concept | Location |
|---|---|
| `currentSeason`/`totalSeasons` cross-check being mirrored | `components/EditSeriesForm.tsx` (`validateCurrentSeason`) |
| Original "backend doesn't check `currentEpisode` either" decision this spec supersedes | `frontend_spec_004_edit_delete_series.md` (Design Decisions) |
| Matching backend validation this spec's Requirement 1 depends on | `series_spec_050_currentepisode_and_rotten_tomatoes_bounds.md` |
| `imdbRating`'s existing `step="0.1"`, why it's excluded from the integer fix | `components/SeriesFormFields.tsx` |
| `AddSeriesForm`/`EditSeriesForm` deliberately-separate-components precedent | `frontend_spec_004_edit_delete_series.md` (Design Decisions) |
| `SeriesDetail`'s equivalent persistent-control request (same jsdom/CSS caveat) | `frontend_spec_090_series_detail_layout_adjustments.md` (`FRONTEND-090-AC-02`) |
| jsdom/CSS rendering limitation | Root `CLAUDE.md` ("Frontend: Vitest/jsdom can't validate real CSS rendering") |

## Acceptance Criteria Summary

- [x] FRONTEND-091-AC-01: Submit is blocked when `currentEpisode` exceeds `totalEpisodes`
- [x] FRONTEND-091-AC-02: `validateTotalSeasons` rejects a non-integer value
- [x] FRONTEND-091-AC-03: `validateTotalEpisodes` rejects a non-integer value
- [x] FRONTEND-091-AC-04: `validateRottenTomatoesRating` rejects a non-integer value
- [x] FRONTEND-091-AC-05: `validateRottenTomatoesPopcornmeter` rejects a non-integer value
- [x] FRONTEND-091-AC-06: `EditSeriesForm`'s `currentSeason` validation rejects a non-integer value
- [x] FRONTEND-091-AC-07: `EditSeriesForm`'s `currentEpisode` validation rejects a non-integer value
- [x] FRONTEND-091-AC-08: Submit error renders adjacent to the actions row (`EditSeriesForm`)
- [x] FRONTEND-091-AC-09: A summary message appears when validation blocks submit (`EditSeriesForm`)
- [x] FRONTEND-091-AC-10: Save/Cancel remain visible while scrolling (`EditSeriesForm`)
- [x] FRONTEND-091-AC-11: Submit error renders adjacent to the actions row (`AddSeriesForm`)
- [x] FRONTEND-091-AC-12: A summary message appears when validation blocks submit (`AddSeriesForm`)
- [x] FRONTEND-091-AC-13: Save/Cancel remain visible while scrolling (`AddSeriesForm`)
