# Frontend Spec 060: `EditSeriesForm` Disables TMDB-Managed Fields Once Set

**Status**: Not started
**Priority**: P2 (data integrity companion to the backend enforcement — without this, a user can
still type into a field the API will silently ignore, with no indication why their edit didn't
stick)
**Depends on**: Frontend Spec 002 (`frontend_spec_002.md`, owns `EditSeriesForm`'s original shape)
✅, Tooling Spec 005 (`tooling_spec_005_series_form_shared_fields.md`, owns the shared
`SeriesFormFields` component both `AddSeriesForm`/`EditSeriesForm` render) ✅
**Area**: Frontend (`components/EditSeriesForm.tsx`, `components/SeriesFormFields.tsx`) — paired
with Series Spec 040 (`series_spec_040_tmdb_managed_field_lock.md`), which enforces the same rule
server-side. This spec is the UI half: without it, a user can still edit a field the backend will
silently ignore, with no explanation why the change didn't stick after saving.

## Overview

`series_spec_040` locks `title`, `year`, `genres`, `totalSeasons`, `totalEpisodes`, and
`imdbRating` from manual `PATCH` edits once each is non-null — only a refresh can change them after
that. Today, `EditSeriesForm` renders all six as freely editable inputs regardless of whether
they're already set, with no indication that an edit to a populated one will be silently dropped by
the backend. This spec disables those six inputs in `EditSeriesForm` whenever the series being
edited already has a non-null value for that field, with a short inline hint explaining why, and
leaves them editable when the value is currently null — mirroring the backend rule exactly so the
UI never shows an editable control for something the API won't actually accept.

## Design Decisions

- **`AddSeriesForm` is entirely unaffected.** The lock only applies to editing an existing series
  (`EditSeriesForm`) — a brand-new series has no existing value to protect, and `series_spec_040`
  itself only restricts `SeriesService.update`, not `create`.
- **Disabled fields, not hidden fields.** Unlike `SeriesFormFields`' existing `source ===
  'recommendation'` branches (which omit a field from the DOM entirely), a locked field stays
  visible with its current value shown, just non-interactive (`disabled`) — the user should still
  be able to see the TMDB-sourced value, only not type over it. This also means locked fields need
  no special-casing in `buildPayload`: a disabled input's value is simply whatever the series
  already had, submitted back unchanged, a no-op the backend guard makes moot either way.
- **An inline hint below a locked field explains the lock**, rather than a hover tooltip — this
  project has no tooltip component anywhere and has explicitly rejected hover-only disclosure
  before (`.claude/SPEC_CANDIDATES.md`'s "Info/disclosure boxes..." candidate: "not a hover tooltip
  — fails outright on touch, unreliable for keyboard/screen-reader users"). The hint text is a
  plain, always-visible `<span>` associated via `aria-describedby`, the same idiom already used for
  `fieldErrors` in this exact form.
- **`SeriesFormFields` gains one new optional prop**, `lockedFields?: Partial<Record<
  SeriesFormFieldName, boolean>>` (covering `year`/`genres`/`totalSeasons`/`totalEpisodes`/
  `imdbRating` — `title` is out of scope for this shared component since it's rendered locally by
  each form, see below). `AddSeriesForm` passes nothing (`undefined`), so every field there stays
  fully interactive — no behavior change for that form.
- **`title`'s lock is handled locally in `EditSeriesForm`**, not through `SeriesFormFields` — the
  Title input already lives directly in `EditSeriesForm.tsx` (not the shared component), so it gets
  its own `disabled`/hint treatment there. Per `series_spec_040`'s Design Decisions, `title` is
  `@NotBlank` and therefore never null once a series exists — in practice this means the Title
  field is disabled unconditionally in `EditSeriesForm` (never has a null escape hatch), which this
  spec's AC below states explicitly rather than leaving as an implied consequence.
- **Locked-field state is derived directly from the `series` prop already passed into
  `EditSeriesForm`** (`series.year != null`, etc.) — no new fetch, no new state shape beyond a
  small derived object computed once from `series` and threaded through to `SeriesFormFields`.

---

## Requirement 1: Locked fields render disabled with an explanatory hint

**User story**: As a user editing a series, I want to see immediately which fields are managed by
TMDB refresh rather than typing into one and being confused later about why my change didn't save.

### FRONTEND-060-AC-01 [AUTO]
**Statement**: When `EditSeriesForm` renders for a series whose `year` is non-null, the Year input
shall be `disabled` and shall render a hint (`data-testid="year-locked-hint"`, text: "Managed by
refresh — use Refresh to update") associated via `aria-describedby`. The same applies independently
to `genres`, `totalSeasons`, `totalEpisodes`, and `imdbRating` (each with its own
`data-testid="{field}-locked-hint"`).

**References**: `SeriesFormFields.tsx` (Year/Genres/Total Seasons/Total Episodes/IMDb Rating
inputs); `series_spec_040_tmdb_managed_field_lock.md` (`SERIES-040-AC-01`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-060-AC-01: locked fields are disabled once set', () => {
  it('disables Year, Genres, Total Seasons, Total Episodes, and IMDb Rating when all are non-null', () => {
    const series = makeSeries({ year: 2019, genres: 'Drama', totalSeasons: 3, totalEpisodes: 24, imdbRating: 8.4 })
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    expect(screen.getByLabelText('Year')).toBeDisabled()
    expect(screen.getByLabelText('Genres')).toBeDisabled()
    expect(screen.getByLabelText('Total Seasons')).toBeDisabled()
    expect(screen.getByLabelText('Total Episodes')).toBeDisabled()
    expect(screen.getByLabelText('IMDb Rating')).toBeDisabled()
    expect(screen.getByTestId('year-locked-hint')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `EditSeriesForm` computes `lockedFields` from `series` (`{ year: series.year
!= null, genres: series.genres != null, totalSeasons: series.totalSeasons != null, totalEpisodes:
series.totalEpisodes != null, imdbRating: series.imdbRating != null }`) and passes it to
`SeriesFormFields`, which applies `disabled={lockedFields?.[field]}` and conditionally renders the
hint span per field.

---

### FRONTEND-060-AC-02 [AUTO]
**Statement**: When `EditSeriesForm` renders for a series whose `year` (or `genres`/`totalSeasons`/
`totalEpisodes`/`imdbRating`) is `null`, that field's input shall remain enabled with no locked
hint shown, and shall accept a new value exactly as it does today.

**Test Case (Red)**:
```typescript
it('FRONTEND-060-AC-02: a null field stays editable with no locked hint', () => {
  const series = makeSeries({ year: null })
  render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

  expect(screen.getByLabelText('Year')).not.toBeDisabled()
  expect(screen.queryByTestId('year-locked-hint')).not.toBeInTheDocument()
})
```
**Test Case (Green)**: `lockedFields.year` is `false` when `series.year == null`; `SeriesFormFields`
omits both `disabled` and the hint for a falsy entry.

---

### FRONTEND-060-AC-03 [AUTO]
**Statement**: The Title input, rendered locally by `EditSeriesForm` (not through
`SeriesFormFields`), shall always render `disabled` with the same locked-hint treatment
(`data-testid="title-locked-hint"`) — `title` has no null state to gate on, since a series always
has a non-blank title once it exists.

**Test Case (Red)**:
```typescript
it('FRONTEND-060-AC-03: Title is always disabled in EditSeriesForm', () => {
  render(<EditSeriesForm series={makeSeries({ title: 'Ozark' })} onCancel={vi.fn()} onSuccess={vi.fn()} />)
  expect(screen.getByLabelText('Title *')).toBeDisabled()
  expect(screen.getByTestId('title-locked-hint')).toBeInTheDocument()
})
```
**Test Case (Green)**: `EditSeriesForm`'s own Title `<input>` gains `disabled` unconditionally, plus
a hint span, mirroring the pattern used for the other five fields.

---

### FRONTEND-060-AC-04 [AUTO] (regression guard)
**Statement**: `AddSeriesForm` shall be entirely unaffected — every field it renders via
`SeriesFormFields` (including Year/Genres/Total Seasons/Total Episodes/IMDb Rating) stays fully
enabled regardless of any value already typed into the form, since `AddSeriesForm` never passes
`lockedFields`.

**Test Case (Green)**: no code change to `AddSeriesForm` — regression guard confirming its existing
`<SeriesFormFields ...>` call (no new prop passed) leaves `lockedFields` `undefined`, and
`SeriesFormFields` treats an `undefined`/missing entry as not locked.

---

## Cross-References

| This spec | Source |
|---|---|
| Backend enforcement this spec's UI mirrors | `series_spec_040_tmdb_managed_field_lock.md` (`SERIES-040-AC-01`/`AC-02`) |
| `SeriesFormFields`, the shared component this spec extends | `tooling_spec_005` (`TOOLING-005-AC-03`) |
| Existing `fieldErrors`/`aria-describedby` idiom this spec's hint reuses | `EditSeriesForm.tsx`/`SeriesFormFields.tsx` |
| Rejected hover-tooltip disclosure precedent | `.claude/SPEC_CANDIDATES.md` ("Info/disclosure boxes...") |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-060-AC-01: Year/Genres/Total Seasons/Total Episodes/IMDb Rating disable with a hint once non-null
- [ ] FRONTEND-060-AC-02: a null field of the same set stays editable with no hint
- [ ] FRONTEND-060-AC-03: Title is always disabled in `EditSeriesForm`, with its own hint
- [ ] FRONTEND-060-AC-04: `AddSeriesForm` is entirely unaffected (regression guard)
