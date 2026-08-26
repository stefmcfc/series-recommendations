# Tooling Spec 005: Shared Field Validation & Rendering for `AddSeriesForm`/`EditSeriesForm`

**Status**: ✅ Done (AC-01–AC-07) — implemented as written, no deviations. Seven shared
validators extracted to `src/utils/seriesFormValidation.ts`; `SeriesFormFields` component extracted
to `src/components/SeriesFormFields.tsx` (+ `.module.css`); both `AddSeriesForm.tsx` and
`EditSeriesForm.tsx` wired to it, `EditSeriesForm.tsx` passing Current Season/Current Episode as
children. All existing `AddSeriesForm.test.tsx`/`EditSeriesForm.test.tsx` tests pass unmodified;
full frontend suite (468 tests), typecheck, and lint all green. **Follow-up fix (same PR,
2026-08-26)**: relocating the poster-preview `<img src={form.posterUrl}>` markup verbatim into the
new `SeriesFormFields.tsx` surfaced it as a "new" CodeQL `js/xss-through-dom` alert — the same
pattern already had two open alerts on `main` (`AddSeriesForm.tsx`/`EditSeriesForm.tsx`), just not
previously flagged in this file. Fixed by gating the preview on a new `isSafeImageUrl` helper
(`src/utils/safeImageUrl.ts`, http/https only) rather than leaving it unaddressed — out of this
spec's original acceptance criteria, but resolves a real (if pre-existing, low-severity) finding
CI surfaced during this PR rather than deferring it. Consolidates what were 2 open alert locations
into 1.
**Priority**: Medium — flagged as the strongest candidate in a 2026-08-26 codebase survey, and
touches the same code two other outstanding specs (`frontend_spec_013`, `frontend_spec_034`) will
also modify. **Build-order recommendation**: do this one first — see Design Decisions.
**Depends on**: none — pure internal refactor of already-implemented components
**Area**: Frontend (`AddSeriesForm.tsx`, `EditSeriesForm.tsx`)

## Overview

`AddSeriesForm.tsx` (790 lines) and `EditSeriesForm.tsx` (599 lines) are near-duplicate forms.
Confirmed by direct comparison (not assumed):

- **Seven validator functions are byte-identical** between the two files: `validateYear`,
  `validateTotalSeasons`, `validateTotalEpisodes`, `validateImdbRating`,
  `validateRottenTomatoesRating`, `validateRottenTomatoesPopcornmeter`, `validatePersonalRating`
  — same bounds, same error message text, same shape, in both files.
- **Thirteen JSX field blocks render identically** in both — same `id`s, `aria-describedby`
  wiring, and label text: Year, Genres, Tags, Total Seasons, Total Episodes, Status, IMDb Rating,
  Rotten Tomatoes Rating (Tomatometer), Rotten Tomatoes Rating (Popcornmeter), Personal Rating,
  Personal Notes, Poster URL (with live preview), Exclude from recommendations.
- **What genuinely differs and must stay separate**: `AddSeriesForm`'s Title field includes the
  TMDB "Look Up" button + candidate picker (`EditSeriesForm`'s Title field is plain);
  `EditSeriesForm` has two fields `AddSeriesForm` doesn't (Current Season, Current Episode,
  positioned between Total Episodes and Status) with their own two extra validators
  (`validateCurrentSeason`/`validateCurrentEpisode`); `AddSeriesForm` carries several hidden
  (never-rendered) state fields from the TMDB lookup flow (`tmdbId`, `tmdbRating`,
  `tmdbVoteCount`, `originCountry`, `productionStatus`, `overview`, `imdbId`) that
  `EditSeriesForm` has no equivalent of; `buildPayload`'s field-inclusion rules differ slightly
  per form (e.g. `EditSeriesForm` always sends `excludeFromRecommendations`, `AddSeriesForm` omits
  personal-notes-adjacent fields when empty the same way both already do — this spec does not
  change either form's payload-building logic).

This spec extracts only the confirmed-identical validators and field blocks — not the dialog
chrome, Title field, actions row, or either form's distinct state/payload logic — following the
same "extract exactly what's duplicated, don't invent a bigger abstraction" discipline as the
`RecommendationService`/`SeriesController` splits.

## Design Decisions

- **Build-order note**: `frontend_spec_013_star_ratings.md` (Requirements 1-3, not yet built)
  will replace both forms' Personal Rating `<input type="number">` with an interactive
  `<StarRating>`, and `frontend_spec_034_recommendation_add_form_fields.md` (not yet built) will
  conditionally hide four of `AddSeriesForm`'s field blocks (Total Seasons, Total Episodes, IMDb
  Rating, Rotten Tomatoes Rating) under a new `source` prop. Both future specs touch fields this
  spec extracts into `SeriesFormFields`. Doing this extraction **first** means both of those specs
  only need to change one shared component instead of two near-duplicate ones — recommended over
  doing it after, which would mean re-deduplicating code that had just diverged again.
- **A new `SeriesFormFields` component, not a shared hook.** The duplication is markup-heavy
  (JSX field blocks with consistent `id`/`aria-describedby` wiring), not primarily logic — a
  component that renders the shared fields is the more direct fix than a hook that returns JSX
  fragments piecemeal.
- **`children` slot for `EditSeriesForm`'s Current Season/Current Episode fields**, rendered
  between Total Episodes and Status (their existing position) — avoids inventing a generic
  "extra fields" prop API when React's own composition model (`children`) already fits.
- **Title, dialog chrome (the `role="dialog"` wrapper, heading, Escape-to-dismiss), and the
  Cancel/Save actions row are deliberately NOT extracted.** Title differs materially (TMDB lookup
  UI); the dialog chrome and actions row are only a handful of lines each, tightly coupled to
  each form's own `onCancel`/`submitting`/`handleSubmit` — extracting them would be scope creep
  past what's actually duplicated, the same "don't invent a bigger abstraction than the task
  needs" principle CLAUDE.md already states.
- **Shared validators live in `src/utils/seriesFormValidation.ts`**, each typed against the
  minimal structural shape it needs (e.g. `validateYear(form: { year: string }, errors: ...)`) so
  both forms' differently-shaped `FormState` interfaces satisfy it without a shared `FormState`
  type — TypeScript's structural typing means no interface change is needed on either form.
- **`EditSeriesForm`'s `validateCurrentSeason`/`validateCurrentEpisode` stay local** — `AddSeriesForm`
  has no such fields, so there's nothing to share.

---

## Requirement 1: Shared field validators

**User story**: As a developer maintaining both series forms, I want one implementation of each
shared validation rule, so a bound or message change doesn't need to be applied twice and risk
drifting.

### TOOLING-005-AC-01 [AUTO]
**Statement**: A new `src/utils/seriesFormValidation.ts` module shall export `validateYear`,
`validateTotalSeasons`, `validateTotalEpisodes`, `validateImdbRating`,
`validateRottenTomatoesRating`, `validateRottenTomatoesPopcornmeter`, and
`validatePersonalRating`, each with behavior identical to today's duplicated copies (same bounds,
same error message text).

**References**: `AddSeriesForm.tsx` lines 70-144, `EditSeriesForm.tsx` lines 62-157 (the
byte-identical functions being extracted).

**Test Case (Red)**:
```typescript
// src/utils/seriesFormValidation.test.ts
describe('TOOLING-005-AC-01: shared validators', () => {
  it('validateYear rejects out-of-range years with the existing message', () => {
    const errors: Record<string, string> = {}
    validateYear({ year: '1500' }, errors)
    expect(errors.year).toBe('Year must be between 1 and 2026')
  })

  it('validatePersonalRating rejects out-of-range ratings with the existing message', () => {
    const errors: Record<string, string> = {}
    validatePersonalRating({ personalRating: '9' }, errors)
    expect(errors.personalRating).toBe('Personal rating must be between 1 and 5')
  })
})
```

**Test Case (Green)**: move the seven functions into the new module, generalizing each
function's parameter type to the minimal field shape it reads.

---

### TOOLING-005-AC-02 [AUTO]
**Statement**: `AddSeriesForm.tsx`'s and `EditSeriesForm.tsx`'s `validate()` functions shall call
the shared module's functions in place of their own local copies. `EditSeriesForm.tsx` shall keep
its own `validateCurrentSeason`/`validateCurrentEpisode` local (unshared). Every existing
`AddSeriesForm.test.tsx`/`EditSeriesForm.test.tsx` validation test shall pass unmodified.

**References**: `AddSeriesForm.tsx`/`EditSeriesForm.tsx`'s `validate()` functions.

**Test Case (Red)**: none new — regression guard.
**Test Case (Green)**: run the existing `AddSeriesForm.test.tsx`/`EditSeriesForm.test.tsx`
validation-focused tests unmodified; all stay green.

---

## Requirement 2: Shared field-rendering component

**User story**: As a developer maintaining both series forms, I want the field blocks that are
identical across both to be rendered from one component, so a label, `id`, or accessibility fix
only needs to be made once.

### TOOLING-005-AC-03 [AUTO]
**Statement**: A new `SeriesFormFields` component shall render, in order: Year, Genres, Tags,
Total Seasons, Total Episodes, a `children` slot, Status, IMDb Rating, Rotten Tomatoes Rating
(Tomatometer), Rotten Tomatoes Rating (Popcornmeter), Personal Rating, Personal Notes, Poster URL
(with live preview), Exclude from recommendations — each field's `id`, label text,
`aria-describedby` wiring, and error-display behavior identical to today's duplicated markup.
Props: `form` (the field values), `fieldErrors`, `updateField`, `onPosterUrlChange`,
`onExcludeFromRecommendationsChange`, `posterPreviewError`, `children?`.

**References**: `AddSeriesForm.tsx` lines 557-767, `EditSeriesForm.tsx` lines 330-576 (the
duplicated JSX being extracted).

**Test Case (Red)**:
```typescript
// src/components/SeriesFormFields.test.tsx
describe('TOOLING-005-AC-03: renders the shared field set', () => {
  it('renders every shared field with its existing id/label', () => {
    render(
      <SeriesFormFields
        form={makeFormState()}
        fieldErrors={{}}
        updateField={() => vi.fn()}
        onPosterUrlChange={vi.fn()}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={false}
      />,
    )
    for (const label of [/^year/i, /^genres/i, /^tags/i, /total seasons/i, /total episodes/i, /^status/i, /^imdb rating/i, /tomatometer/i, /popcornmeter/i, /personal rating/i, /personal notes/i, /poster url/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('renders children between Total Episodes and Status', () => {
    render(
      <SeriesFormFields
        form={makeFormState()}
        fieldErrors={{}}
        updateField={() => vi.fn()}
        onPosterUrlChange={vi.fn()}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={false}
      >
        <div data-testid="edit-only-fields">Current Season/Episode</div>
      </SeriesFormFields>,
    )
    expect(screen.getByTestId('edit-only-fields')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: build the component; existing field JSX moves in verbatim, `children`
rendered between the Total Episodes and Status blocks.

---

### TOOLING-005-AC-04 [AUTO]
**Statement**: `AddSeriesForm.tsx` shall render `<SeriesFormFields>` (no `children`) for its
shared field set, keeping its own Title field (with TMDB lookup UI), dialog chrome, and actions
row unchanged.

**References**: `AddSeriesForm.tsx`.

**Test Case (Red)**: none new — covered by `TOOLING-005-AC-06`'s regression assertion below.
**Test Case (Green)**: replace `AddSeriesForm`'s shared field JSX with `<SeriesFormFields ... />`.

---

### TOOLING-005-AC-05 [AUTO]
**Statement**: `EditSeriesForm.tsx` shall render `<SeriesFormFields>`, passing its Current
Season/Current Episode field blocks as `children` (unchanged markup, now rendered via the slot),
keeping its own Title field, dialog chrome, and actions row unchanged.

**References**: `EditSeriesForm.tsx`.

**Test Case (Red)**: none new — covered by `TOOLING-005-AC-06`'s regression assertion below.
**Test Case (Green)**: replace `EditSeriesForm`'s shared field JSX with `<SeriesFormFields>`,
Current Season/Episode passed as children.

---

### TOOLING-005-AC-06 [AUTO]
**Statement**: Every existing `data-testid`/`id`/`aria-describedby`/label text on every migrated
field shall be byte-identical to today. Every existing `AddSeriesForm.test.tsx`/
`EditSeriesForm.test.tsx` test that queries a migrated field by label, role, or testid shall pass
unmodified.

**References**: `AddSeriesForm.test.tsx`, `EditSeriesForm.test.tsx`.

**Test Case (Red)**: none new — regression guard.
**Test Case (Green)**: `npm test` — both existing suites pass unmodified.

---

## Requirement 3: Payload behavior is unaffected

**User story**: As a user submitting either form, I want the exact same data sent to the backend
as before this refactor, so a purely structural change never becomes a silent behavior change.

### TOOLING-005-AC-07 [AUTO]
**Statement**: Submitting either form shall send a payload identical in shape to today's —
`buildPayload`'s per-form field-inclusion logic (`CreateSeriesRequest`/`UpdateSeriesRequest`,
omit-when-empty vs. always-included rules) is unchanged by this spec; only which component
renders the shared `<input>`/`<select>`/`<textarea>` elements changes, not the state shape,
`FormState` interfaces, or payload-building logic.

**References**: `AddSeriesForm.tsx`'s `buildPayload`, `EditSeriesForm.tsx`'s `buildPayload`
(both untouched by this spec).

**Test Case (Red)**: none new — regression guard, covered by each form's existing submit tests.
**Test Case (Green)**: run the existing submit-payload tests in both test files unmodified.

---

## Cross-References

| This spec | Source |
|---|---|
| `AddSeriesForm.tsx`'s field set, validation, payload building | `frontend_spec_003_add_series_form.md` |
| `EditSeriesForm.tsx`'s field set, validation, payload building | `frontend_spec_004_edit_delete_series.md` |
| Personal Rating field, replaced with `<StarRating>` after this spec lands | `frontend_spec_013_star_ratings.md` (not yet built — see build-order note above) |
| Conditional hiding of four `AddSeriesForm` fields under `source="recommendation"` | `frontend_spec_034_recommendation_add_form_fields.md` (not yet built — see build-order note above) |

---

## Acceptance Criteria Summary

- [x] TOOLING-005-AC-01: seven shared validators extracted to `seriesFormValidation.ts`
- [x] TOOLING-005-AC-02: both forms call the shared validators, existing tests unmodified
- [x] TOOLING-005-AC-03: `SeriesFormFields` component renders the 13 shared field blocks + children slot
- [x] TOOLING-005-AC-04: `AddSeriesForm` renders `SeriesFormFields`, Title/chrome/actions unchanged
- [x] TOOLING-005-AC-05: `EditSeriesForm` renders `SeriesFormFields` with Current Season/Episode as children
- [x] TOOLING-005-AC-06: every migrated field's id/label/testid/aria wiring is byte-identical, existing tests unmodified
- [x] TOOLING-005-AC-07: payload-building behavior is unchanged in both forms
