# Frontend Spec 037: Rotten Tomatoes Popcornmeter Display & Input

**Status**: Implemented
**Priority**: P2 (mirrors Series Spec 027's priority)
**Depends on**: Series Spec 027 (`series_spec_027_rotten_tomatoes_popcornmeter_and_refresh_safety.md`, `SeriesDto.rottenTomatoesPopcornmeter`) — **not yet implemented at the time this spec was authored; implement the backend first**, Frontend Spec 003 (`frontend_spec_003_add_series_form.md`, `AddSeriesForm`'s existing `rottenTomatoesRating` field/validation/payload shape this spec mirrors for the new field), Frontend Spec 004 (`frontend_spec_004_edit_delete_series.md`, `EditSeriesForm`), Frontend Spec 005 (`frontend_spec_005_series_detail.md`, `SeriesDetail`'s Ratings field-row)
**Frontend Stage**: 37 of N

## Overview

Surfaces Series Spec 027's new `rottenTomatoesPopcornmeter` field: a second Rotten Tomatoes input/display alongside the existing one, with both now clearly labeled by which of Rotten Tomatoes' two scores they represent, and both rendered as a percentage.

## Design Decisions

- **The existing field is relabeled, not renamed.** `rottenTomatoesRating`'s type/prop/payload name is unchanged everywhere in the frontend — only its visible label text changes, from "Rotten Tomatoes Rating" to "Rotten Tomatoes Rating (Tomatometer)", to disambiguate it from the new field's "Rotten Tomatoes Rating (Popcornmeter)" label.
- **`rottenTomatoesPopcornmeter` follows `rottenTomatoesRating`'s exact existing shape** in every location it appears: `Series`/`CreateSeriesRequest`/`UpdateSeriesRequest` types, `AddSeriesForm`/`EditSeriesForm` form state/validation (0–100 integer)/payload-building/`applyLookupResult`/`toFormState`, `SeriesDetail`'s display. It is **not** wired into `AddSeriesForm`'s TMDB-lookup `applyLookupResult` path (`rottenTomatoesRating` is present there only because it's a leftover from the old OMDb-primary lookup flow's field-copy list — actually check: confirm at implementation time whether `rottenTomatoesRating` is actually populated by `applyLookupResult` today; if it is, do the same for the new field for consistency, if it isn't, don't add it for the new field either — match existing behavior exactly either way, this spec does not change lookup-autofill behavior).
- **Layout**: `SeriesDetail`'s existing "Ratings" section has a 2-field row (`Rotten Tomatoes Rating | Personal Rating`) sitting inside the app's fixed 3-column field-row grid (established in this session's `frontend_spec_012` live-review amendments) — adding the new field turns this into a full 3-field row (`Rotten Tomatoes Rating (Tomatometer) | Rotten Tomatoes Rating (Popcornmeter) | Personal Rating`), which fits the existing grid with no layout changes needed.
- **"%" formatting applies to both RT fields only** — not `imdbRating` (out of 10) or `tmdbRating` (out of 10). A small formatting helper (e.g. `formatPercent(value: number | null): string`, returning `'—'` for `null` and `` `${value}%` `` otherwise) is added once and reused for both fields wherever they're displayed as read-only text (`SeriesDetail`). Form `<input type="number">` fields are unaffected by this — a numeric input showing "96" with a separate "%" affix (e.g. a suffix label or `aria-label` clarifying "percent") is sufficient; this spec does not require a custom percent-input widget.
- **Amendment (2026-08-25, cosmetic-only)**: `SeriesDetail`'s two RT percentage values are suffixed with a clarifying emoji — 🍅 for Tomatometer, 🍿 for Popcornmeter (e.g. `96% 🍅`). `null` still renders as a plain `—`, no emoji. `formatPercent` takes the emoji as a second argument. Scoped to `SeriesDetail`'s read-only display only — form labels/inputs on `AddSeriesForm`/`EditSeriesForm` are unchanged, since those are inputs being edited, not a "display" of the score.

---

## Requirement 1: Types & Form Fields

**User story**: As a user, I want to enter both Rotten Tomatoes scores when adding or editing a series, so I'm not limited to tracking just one.

### FRONTEND-037-AC-01 [AUTO]
**Statement**: `src/types/series.ts` shall gain `rottenTomatoesPopcornmeter: number | null` on `Series`, and `rottenTomatoesPopcornmeter?: number` on `CreateSeriesRequest`/`UpdateSeriesRequest` — the exact same shape as the existing `rottenTomatoesRating` fields on each type.

**References**: `frontend/src/types/series.ts`.

**Test Case (Green)**: type-only change, verified transitively by AC-02/03/04's tests compiling and passing.

---

### FRONTEND-037-AC-02 [AUTO]
**Statement**: `AddSeriesForm` shall render a "Rotten Tomatoes Rating (Popcornmeter)" numeric input, following the exact same validation (0–100 integer), payload-building (omitted from `CreateSeriesRequest` when empty), and `toFormState`/`buildInitialFormState` conventions as the existing `rottenTomatoesRating` field (now relabeled "Rotten Tomatoes Rating (Tomatometer)").

**References**: `AddSeriesForm.tsx`, its existing `rottenTomatoesRating` field block (validation function, `buildPayload`, `FormState`, `buildInitialFormState`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-037-AC-02: Popcornmeter field on AddSeriesForm', () => {
  it('validates 0-100, omits from payload when empty, includes when provided', async () => {
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Ozark' } })
    fireEvent.change(
      screen.getByLabelText(/rotten tomatoes rating \(popcornmeter\)/i),
      { target: { value: '150' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(
      await screen.findByText(/must be between 0 and 100/i),
    ).toBeInTheDocument()

    fireEvent.change(
      screen.getByLabelText(/rotten tomatoes rating \(popcornmeter\)/i),
      { target: { value: '91' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(seriesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ rottenTomatoesPopcornmeter: 91 }),
      ),
    )
  })

  it('relabels the existing field to clarify it is the Tomatometer', () => {
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)
    expect(
      screen.getByLabelText(/rotten tomatoes rating \(tomatometer\)/i),
    ).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add the field block, mirroring `rottenTomatoesRating`'s existing code exactly (new `FormState` key, validation branch, payload branch), and relabel the existing field's `<label>` text.

---

### FRONTEND-037-AC-03 [AUTO]
**Statement**: `EditSeriesForm` shall render the same Popcornmeter field, initialized from `series.rottenTomatoesPopcornmeter` and always sent explicitly in `UpdateSeriesRequest` (both a value and its absence are meaningful once a series exists — same convention as every other numeric rating field on this form).

**References**: `EditSeriesForm.tsx`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-037-AC-03: Popcornmeter field on EditSeriesForm', () => {
  it('initializes from series.rottenTomatoesPopcornmeter and sends updates explicitly', async () => {
    const series = makeSeries({ rottenTomatoesPopcornmeter: 91 })
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    expect(
      screen.getByLabelText(/rotten tomatoes rating \(popcornmeter\)/i),
    ).toHaveValue(91)

    fireEvent.change(
      screen.getByLabelText(/rotten tomatoes rating \(popcornmeter\)/i),
      { target: { value: '85' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(seriesApi.update).toHaveBeenCalledWith(
        series.id,
        expect.objectContaining({ rottenTomatoesPopcornmeter: 85 }),
      ),
    )
  })
})
```

**Test Case (Green)**: mirror `rottenTomatoesRating`'s existing `EditSeriesForm` field block.

---

## Requirement 2: Percentage Display

**User story**: As a user viewing a series' Rotten Tomatoes scores, I want to see them as percentages, so they read unambiguously (not confusable with an out-of-10 rating).

### FRONTEND-037-AC-04 [AUTO]
**Statement**: `SeriesDetail` shall display both Rotten Tomatoes fields as a percentage (e.g. `96%`), or `—` when `null`, and shall relabel them "Rotten Tomatoes Rating (Tomatometer)" and "Rotten Tomatoes Rating (Popcornmeter)" respectively, sitting as a 3-field row alongside Personal Rating in the existing "Ratings" section.

**References**: `SeriesDetail.tsx`, its `formatValue` helper (unaffected — a new `formatPercent` helper is added alongside it, used only for these two fields).

**Test Case (Red)**:
```typescript
describe('FRONTEND-037-AC-04: Rotten Tomatoes percentage display', () => {
  it('renders both scores as percentages with clarifying labels', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ rottenTomatoesRating: 96, rottenTomatoesPopcornmeter: 91 }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('96%')).toBeInTheDocument()
    expect(screen.getByText('91%')).toBeInTheDocument()
    expect(screen.getByText('Rotten Tomatoes Rating (Tomatometer)')).toBeInTheDocument()
    expect(screen.getByText('Rotten Tomatoes Rating (Popcornmeter)')).toBeInTheDocument()
  })

  it('renders a dash for a null Popcornmeter without affecting the Tomatometer value', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ rottenTomatoesRating: 96, rottenTomatoesPopcornmeter: null }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('96%')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `formatPercent`, use it for both fields' `<dd>`, add the third field to the existing row, update both `<dt>` labels.

---

## Cross-References

| This spec | Source |
|---|---|
| `SeriesDto.rottenTomatoesPopcornmeter` | `series_spec_027_rotten_tomatoes_popcornmeter_and_refresh_safety.md` |
| `AddSeriesForm`'s existing `rottenTomatoesRating` field/validation/payload shape being mirrored | `frontend_spec_003_add_series_form.md` |
| `EditSeriesForm`'s existing field conventions | `frontend_spec_004_edit_delete_series.md` |
| `SeriesDetail`'s fixed 3-column field-row grid (established this session) the new field slots into with no layout change | `frontend_spec_012_series_lifecycle_controls.md`'s live-review amendments |

---

## Acceptance Criteria Summary

- [x] FRONTEND-037-AC-01: `rottenTomatoesPopcornmeter` on `Series`/`CreateSeriesRequest`/`UpdateSeriesRequest`
- [x] FRONTEND-037-AC-02: `AddSeriesForm` gains the field, existing field relabeled "(Tomatometer)"
- [x] FRONTEND-037-AC-03: `EditSeriesForm` gains the field, initialized + always sent explicitly
- [x] FRONTEND-037-AC-04: `SeriesDetail` shows both as percentages with clarifying labels
