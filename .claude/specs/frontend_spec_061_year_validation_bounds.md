# Frontend Spec 061: `AddSeriesForm`/`EditSeriesForm` Year Bounds Match `yearBounds.ts`

**Status**: Implemented — `frontend/src/utils/seriesFormValidation.ts` (`validateYear`)
**Priority**: P2 (correctness bug companion to the backend fix — the client-side hint is currently
wrong and will silently reject/accept the wrong values as years pass)
**Depends on**: Tooling Spec 005 (`tooling_spec_005_series_form_shared_fields.md`, owns
`seriesFormValidation.ts`, shared by `AddSeriesForm`/`EditSeriesForm`) ✅, Frontend Spec 055
(`frontend_spec_055_search_filter_overhaul.md`, introduces `yearBounds.ts`'s `MIN_VALID_YEAR`/
`MAX_VALID_YEAR`, already used by `SearchFilter`/`RecommendationControls`) ✅
**Area**: Frontend (`utils/seriesFormValidation.ts`) — paired with Series Spec 041
(`series_spec_041_year_validation_bounds.md`), which brings the backend's own `year` validation in
line with the same range.

## Overview

`seriesFormValidation.ts`'s `validateYear` — shared by both `AddSeriesForm` and `EditSeriesForm` via
`SeriesFormFields` — rejects a year outside `1`–`2026`, hardcoded. This is already wrong (`1` is not
a meaningful floor) and will silently start rejecting legitimate future years (e.g. a series
premiering in 2027) the moment the calendar turns, without any code change ever having been made.
This app already has the correct bound in `frontend/src/utils/yearBounds.ts`
(`MIN_VALID_YEAR = 1900`, `MAX_VALID_YEAR = new Date().getFullYear() + 1`), used today by
`SearchFilter` and `RecommendationControls` — `validateYear` is the one place in the frontend that
never adopted it. This spec makes `validateYear` import and use the same shared constants, so
`AddSeriesForm` and `EditSeriesForm` (both consumers of this one function) automatically match
`SearchFilter`/`RecommendationControls` and the backend's own bound (`series_spec_041`) without
maintaining a second, independent range anywhere.

## Design Decisions

- **No new constants.** `yearBounds.ts` already exists and is already the established
  single-source-of-truth for this exact range elsewhere in the codebase — `validateYear` imports
  `MIN_VALID_YEAR`/`MAX_VALID_YEAR` from it directly rather than duplicating the values.
- **Both `AddSeriesForm` and `EditSeriesForm` are fixed by the same one-function change** — neither
  form has its own copy of this validation; both call the shared `validateYear` from
  `seriesFormValidation.ts` (`tooling_spec_005`), so there is nothing else in either form to update.
- **The error message is updated to state the actual bound** (`"Year must be between ${MIN_VALID_YEAR}
  and ${MAX_VALID_YEAR}"`), rather than the current hardcoded `"Year must be between 1 and 2026"` —
  this now also reads correctly as years pass, with no hardcoded number left in the message.

---

## Requirement 1: `validateYear` uses the shared `1900`–current year + 1 bound

**User story**: As a user adding or editing a series, I want the year field to accept the same
sensible range the rest of this app already uses, and to keep working correctly next year without
anyone needing to update a hardcoded number.

### FRONTEND-061-AC-01 [AUTO]
**Statement**: `validateYear` shall reject a year outside `MIN_VALID_YEAR`–`MAX_VALID_YEAR`
(imported from `utils/yearBounds.ts`), setting `errors.year` to `"Year must be between
${MIN_VALID_YEAR} and ${MAX_VALID_YEAR}"`.

**References**: `utils/yearBounds.ts` (`MIN_VALID_YEAR`/`MAX_VALID_YEAR`); `utils/
seriesFormValidation.ts` (`validateYear`, shared by `AddSeriesForm`/`EditSeriesForm`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-061-AC-01: validateYear uses the shared 1900–current year + 1 bound', () => {
  it('rejects a year below 1900', () => {
    const form = { year: '1899' }
    const errors: { year?: string } = {}
    validateYear(form, errors)
    expect(errors.year).toBe(`Year must be between ${MIN_VALID_YEAR} and ${MAX_VALID_YEAR}`)
  })

  it('rejects a year beyond current year + 1', () => {
    const form = { year: String(MAX_VALID_YEAR + 1) }
    const errors: { year?: string } = {}
    validateYear(form, errors)
    expect(errors.year).toBe(`Year must be between ${MIN_VALID_YEAR} and ${MAX_VALID_YEAR}`)
  })

  it('accepts current year + 1 (the boundary)', () => {
    const form = { year: String(MAX_VALID_YEAR) }
    const errors: { year?: string } = {}
    validateYear(form, errors)
    expect(errors.year).toBeUndefined()
  })

  it('accepts 1900 (the boundary)', () => {
    const form = { year: '1900' }
    const errors: { year?: string } = {}
    validateYear(form, errors)
    expect(errors.year).toBeUndefined()
  })
})
```
**Test Case (Green)**: `validateYear` imports `MIN_VALID_YEAR`/`MAX_VALID_YEAR` from `../utils/
yearBounds` and replaces its hardcoded `year < 1 || year > 2026` condition and message with them.

---

### FRONTEND-061-AC-02 [AUTO] (regression guard)
**Statement**: `AddSeriesForm` and `EditSeriesForm` shall both continue to block submission on an
out-of-range year exactly as today, now against the corrected bound — no change to either form's
own code, since both consume `validateYear` indirectly via `SeriesFormFields`'/`validate`'s existing
call.

**Test Case (Green)**: no code change to either form — regression guard confirming
`AddSeriesForm.test.tsx`/`EditSeriesForm.test.tsx`'s existing "rejects an invalid year" style tests
(if present) still pass, now asserting against the corrected message/bound.

---

## Cross-References

| This spec | Source |
|---|---|
| `MIN_VALID_YEAR`/`MAX_VALID_YEAR`, reused unchanged | `frontend/src/utils/yearBounds.ts` |
| `validateYear`, the function this spec fixes | `utils/seriesFormValidation.ts` (`tooling_spec_005_series_form_shared_fields.md`, `TOOLING-005-AC-01`) |
| Paired backend change | `series_spec_041_year_validation_bounds.md` |
| Existing consumers of `yearBounds.ts` this spec brings `validateYear` in line with | `SearchFilter.tsx`, `RecommendationControls.tsx` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-061-AC-01: `validateYear` rejects outside `MIN_VALID_YEAR`–`MAX_VALID_YEAR`, accepts the boundaries
- [x] FRONTEND-061-AC-02: `AddSeriesForm`/`EditSeriesForm` still block submission on an invalid year (regression guard)
