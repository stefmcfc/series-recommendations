# Frontend Spec 018: User-Defined Tags

**Status**: Implemented
**Priority**: P2 (quality-of-life for organizing a collection — not core CRUD, mirrors `series_spec_014_tags.md`'s own priority)
**Depends on**: Series Spec 014 (`tags` column, `SeriesDto.tags`, CRUD/export contract) ✅, Frontend Spec 003 (Add Series Form) ✅, Frontend Spec 004 (Edit/Delete Series) ✅, Frontend Spec 005 (Series Detail) ✅
**Frontend Stage**: 18 of N

---

## Overview

`series_spec_014_tags.md` added a nullable, comma-separated, free-text `tags` field to `SeriesEntity`/`SeriesDto` — user-supplied organizational labels (e.g. "rewatch candidate," "watch with partner," "background watching") with no fixed vocabulary, unlike `genres`, which comes from OMDb/TMDB's controlled vocabulary. That spec was deliberately scoped to storage/CRUD/export only and explicitly deferred the frontend consumer. This spec is that consumer: it makes `tags` editable in `AddSeriesForm`/`EditSeriesForm` and visible in `SeriesDetail`.

The field's editing shape mirrors `genres` exactly — a single free-text `<input>`, comma-separated, trimmed-and-sent-or-omitted-if-blank, with no client-side parsing, splitting, or per-value validation (matching `series_spec_014`'s own "no format validation of content" policy). This is not a tag-chip or multi-select UI; it's the same kind of control `genres` already is, just sourced from the user instead of an external API.

**Design decisions**:
- **Positioned directly after the Genres field in both forms.** `genres` and `tags` are both "labels for this show" concepts — one from a fixed external vocabulary, one user-defined — so keeping them adjacent in the form groups related fields together, consistent with how the rest of both forms are already ordered field-by-field.
- **`SeriesDetail` gets a new `Tags` `<dl>` entry, positioned near the existing `Genres` entry**, for the same grouping reason. Unlike `alternateTitle` (a title-level recognition aid shown near the heading, not yet implemented on the frontend as of this spec), `tags` is a normal supplementary field and belongs in the standard field list.
- **`SeriesList` does not get a tags display in this spec — deliberate scope boundary, not an oversight.** The list row is already dense (thumbnail, title, status, rating, actions), and there's no established pattern there for rendering an arbitrary-length, arbitrary-value label list the way there is for a single `alternateTitle` string. Surfacing `tags` in the list view (and any accompanying `SearchFilter`/`/series/search` filtering integration — also explicitly out of scope here, per `series_spec_014_tags.md`'s own Cross-References) is left as a future spec once there's real usage data to justify a design for it.
- **No new CSS.** The `tags` field reuses each form's existing `.field` styling unchanged (same as every other text input), and `SeriesDetail`'s entry reuses the existing `.field`/`dt`/`dd` structure inside `styles.fields`.
- **No clear-via-PATCH capability introduced for `tags` beyond what already exists for every other optional field.** `series_spec_014_tags.md`'s own Implementation Notes documents that `SeriesService.update()`'s null-if-unset pattern can't distinguish "explicitly cleared to null" from "omitted" for any optional string field (`genres`, `personalNotes`, `posterUrl`, and now `tags`) — this is a pre-existing, already-accepted limitation this spec doesn't change or need to work around. `EditSeriesForm`'s `buildPayload` follows the same "send trimmed value if non-blank, omit otherwise" rule every other optional text field already uses.

---

## Requirements

### Requirement 1: Type Definitions

**User story**: As a developer, I want `tags` typed consistently everywhere the rest of the record is typed, so the form and detail components below have a single source of truth to build against.

#### Acceptance Criteria

- **FRONTEND-018-AC-01** [AUTO]: `Series` (`src/types/series.ts`) shall gain a `tags: string | null` field, following the exact `T | null` convention `genres` already uses on the same interface.
- **FRONTEND-018-AC-02** [AUTO]: `CreateSeriesRequest` (`src/types/series.ts`) shall gain an optional `tags?: string` field, following the exact convention `genres?: string` already uses on the same interface; `UpdateSeriesRequest` (`Partial<CreateSeriesRequest> & { currentSeason?: number; currentEpisode?: number }`) shall inherit `tags?: string` automatically via that `Partial<CreateSeriesRequest>` intersection, requiring no separate declaration.

---

### Requirement 2: `AddSeriesForm` — Editable Tags Field

**User story**: As a user adding a new series, I want to attach my own free-form labels to it while I'm filling out the rest of the record, so tagging isn't a separate step I have to come back and do later.

#### Acceptance Criteria

- **FRONTEND-018-AC-03** [AUTO]: `AddSeriesForm`'s `FormState` shall gain a `tags: string` field, defaulting to `''` in `initialFormState`, following the exact convention `genres` already uses on the same type.
- **FRONTEND-018-AC-04** [AUTO]: `AddSeriesForm` shall render a labelled text input (`<label htmlFor="tags">Tags</label>`, `<input id="tags" type="text" />`) positioned immediately after the existing Genres field and before the Total Seasons field.
- **FRONTEND-018-AC-05** [AUTO]: The Tags input's value shall be bound to `form.tags` and updated via the existing `updateField('tags')` handler on change, following the exact same wiring every other plain text field (e.g. `genres`) already uses.
- **FRONTEND-018-AC-06** [AUTO]: `buildPayload` shall set `payload.tags = form.tags.trim()` when `form.tags.trim() !== ''`, and shall omit `tags` from the payload entirely when it is blank — following `genres`' exact `buildPayload` pattern.
- **FRONTEND-018-AC-07** [AUTO]: `buildInitialFormState` shall set `next.tags = initialValues.tags` when `initialValues.tags != null`, following `genres`' exact `buildInitialFormState` pattern, so a pre-filled create flow (e.g. from a recommendation) can seed `tags` the same way it can seed `genres`.

---

### Requirement 3: `EditSeriesForm` — Editable Tags Field

**User story**: As a user editing an existing series, I want to add, change, or leave alone my tags the same way I can with genres, so tagging is available everywhere the rest of the record is editable.

#### Acceptance Criteria

- **FRONTEND-018-AC-08** [AUTO]: `EditSeriesForm`'s `FormState` shall gain a `tags: string` field, following the exact convention `genres` already uses on the same type (structurally identical to, but not shared code with, `AddSeriesForm`'s `FormState`).
- **FRONTEND-018-AC-09** [AUTO]: `toFormState` shall map `series.tags ?? ''` into `form.tags`, following `genres`' exact `toFormState` mapping (`series.genres ?? ''`).
- **FRONTEND-018-AC-10** [AUTO]: `EditSeriesForm` shall render a labelled text input (`<label htmlFor="tags">Tags</label>`, `<input id="tags" type="text" />`) positioned immediately after the existing Genres field and before the Total Seasons field — the same position `AddSeriesForm` uses.
- **FRONTEND-018-AC-11** [AUTO]: The Tags input's value shall be bound to `form.tags` and updated via the existing `updateField('tags')` handler on change, following the exact same wiring `genres` already uses.
- **FRONTEND-018-AC-12** [AUTO]: `buildPayload` shall set `payload.tags = form.tags.trim()` when `form.tags.trim() !== ''`, and shall omit `tags` from the payload entirely when it is blank — following `genres`' exact `buildPayload` pattern (and subject to the same pre-existing "can't distinguish omitted from explicitly-cleared" limitation documented in `series_spec_014_tags.md`'s Implementation Notes, not a new gap introduced here).

---

### Requirement 4: `SeriesDetail` — Tags Display

**User story**: As a user viewing a series' full record, I want to see the tags I've attached to it, so I can confirm my own organizational labels are actually stored.

#### Acceptance Criteria

- **FRONTEND-018-AC-13** [AUTO]: `SeriesDetail` shall render a new `<div className={styles.field}><dt>Tags</dt><dd>...</dd></div>` entry within the existing `<dl className={styles.fields}>` list, positioned immediately after the existing Genres entry.
- **FRONTEND-018-AC-14** [AUTO]: The Tags entry's `<dd>` shall render `formatValue(series.tags)` — the existing helper already used by every other nullable field on this component — so a `null` value renders as `—` and a non-null value renders verbatim (the raw comma-separated string, unparsed and unsplit, consistent with this spec's "no client-side parsing" design decision).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `tags` column, `SeriesDto.tags`, CRUD contract (`POST`/`GET`/`PATCH`), null-if-unset semantics, no-format-validation policy this spec's UI must not violate | `series_spec_014_tags.md` |
| PATCH "omitted vs. explicitly cleared" limitation shared by every optional string field, `tags` included | `series_spec_014_tags.md` Implementation Notes |
| `genres` field convention this spec's `tags` field copies exactly (`FormState`, `initialFormState`, `updateField`, `buildPayload`, `buildInitialFormState`/`toFormState`) | `frontend_spec_003_add_series_form.md`, `frontend_spec_004_edit_delete_series.md`, `AddSeriesForm.tsx`/`EditSeriesForm.tsx` (`genres` field) |
| `<dl className={styles.fields}>` structure, `formatValue` null-rendering helper this spec's Tags entry reuses | `frontend_spec_005_series_detail.md`, `SeriesDetail.tsx` |
| Future filtering integration (not designed here or in `series_spec_014`) | `series_spec_003_search.md` — `SeriesSearchCriteria`/`SearchFilter` would gain a `tags` filter once this UI has real usage to justify one |
| `SeriesList` tags display — explicit scope boundary, not built here | Overview design decisions, above |

---

## TDD Test Case Sketches

### `src/components/AddSeriesForm.test.tsx` (additions)

```typescript
describe('FRONTEND-018-AC-04: Tags field rendered', () => {
  it('renders a labelled Tags control', () => {
    renderForm()
    expect(screen.getByLabelText(/^tags/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-018-AC-06: valid submission payload includes/omits tags', () => {
  it('omits tags from the payload when blank', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0][0]
    expect(payload).not.toHaveProperty('tags')
  })

  it('includes a trimmed tags value when populated', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as Series)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Show' },
    })
    fireEvent.change(screen.getByLabelText(/^tags/i), {
      target: { value: '  rewatch candidate,watch with partner  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0][0]
    expect(payload.tags).toBe('rewatch candidate,watch with partner')
  })
})

describe('FRONTEND-018-AC-07: initialValues prefill includes tags', () => {
  it('pre-populates tags from initialValues when provided', () => {
    render(
      <AddSeriesForm
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
        initialValues={{ title: 'Ozark', tags: 'background watching' }}
      />,
    )
    expect(screen.getByLabelText(/^tags/i)).toHaveValue('background watching')
  })
})
```

### `src/components/EditSeriesForm.test.tsx` (additions)

```typescript
describe('FRONTEND-018-AC-09/10: Tags field rendered and pre-filled', () => {
  it('renders a labelled Tags control pre-filled from the series prop', () => {
    renderForm({ series: makeSeries({ tags: 'rewatch candidate' }) })
    expect(screen.getByLabelText(/^tags/i)).toHaveValue('rewatch candidate')
  })

  it('renders a null tags value as empty', () => {
    renderForm({ series: makeSeries({ tags: null }) })
    expect(screen.getByLabelText(/^tags/i)).toHaveValue('')
  })
})

describe('FRONTEND-018-AC-12: submission payload includes/omits tags', () => {
  it('includes a trimmed tags value when changed', async () => {
    mockUpdate.mockResolvedValue({ id: 'test-id', title: 'Test Show' } as Series)
    renderForm({ series: makeSeries({ tags: null }) })
    fireEvent.change(screen.getByLabelText(/^tags/i), {
      target: { value: '  watch with partner  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const payload = mockUpdate.mock.calls[0][1]
    expect(payload.tags).toBe('watch with partner')
  })

  it('omits tags from the payload when blank', async () => {
    mockUpdate.mockResolvedValue({ id: 'test-id', title: 'Test Show' } as Series)
    renderForm({ series: makeSeries({ tags: null }) })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const payload = mockUpdate.mock.calls[0][1]
    expect(payload).not.toHaveProperty('tags')
  })
})
```

### `src/components/SeriesDetail.test.tsx` (additions)

```typescript
describe('FRONTEND-018-AC-13/14: Tags entry rendered', () => {
  it('renders a populated tags value verbatim', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ tags: 'rewatch candidate,watch with partner' }),
    )
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('The Office'))
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(
      screen.getByText('rewatch candidate,watch with partner'),
    ).toBeInTheDocument()
  })

  it('renders "—" for a null tags value', async () => {
    mockGetById.mockResolvedValue(makeSeries({ tags: null }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => screen.getByText('The Office'))
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
```

**Test Case (Green)** for every sketch above: add `tags` to `Series`/`CreateSeriesRequest`, add the `FormState`/`updateField`/`buildPayload`/`buildInitialFormState`/`toFormState` wiring to `AddSeriesForm`/`EditSeriesForm`, and add the `Tags` `<dl>` entry to `SeriesDetail`, until the tests above pass.

---

## Acceptance Criteria Summary

- [x] FRONTEND-018-AC-01: `Series.tags: string | null`
- [x] FRONTEND-018-AC-02: `CreateSeriesRequest.tags?: string`; `UpdateSeriesRequest` inherits it automatically
- [x] FRONTEND-018-AC-03: `AddSeriesForm.FormState.tags`, defaults to `''`
- [x] FRONTEND-018-AC-04: `AddSeriesForm` renders a labelled Tags input, positioned after Genres
- [x] FRONTEND-018-AC-05: Tags input bound to `form.tags` via `updateField('tags')`
- [x] FRONTEND-018-AC-06: `buildPayload` includes trimmed `tags` when non-blank, omits when blank
- [x] FRONTEND-018-AC-07: `buildInitialFormState` seeds `tags` from `initialValues.tags` when present
- [x] FRONTEND-018-AC-08: `EditSeriesForm.FormState.tags`
- [x] FRONTEND-018-AC-09: `toFormState` maps `series.tags ?? ''`
- [x] FRONTEND-018-AC-10: `EditSeriesForm` renders a labelled Tags input, positioned after Genres
- [x] FRONTEND-018-AC-11: Tags input bound to `form.tags` via `updateField('tags')`
- [x] FRONTEND-018-AC-12: `buildPayload` includes trimmed `tags` when non-blank, omits when blank
- [x] FRONTEND-018-AC-13: `SeriesDetail` renders a `Tags` `<dl>` entry, positioned after Genres
- [x] FRONTEND-018-AC-14: Tags entry uses `formatValue(series.tags)` (null renders as `—`, non-null renders verbatim)

---

## Implementation Notes

- Implemented exactly as specified: no new CSS was added for `tags` (it reuses each form's existing `.field` styling and `SeriesDetail`'s existing `.field`/`dt`/`dd` structure), and `SeriesList` was left untouched per the explicit scope boundary.
- Implemented in the same pass as `frontend_spec_017_alternate_title.md` since both touch `AddSeriesForm.tsx`/`EditSeriesForm.tsx`/`SeriesDetail.tsx`; the two features are otherwise independent (no shared logic beyond file location).
- All 14 acceptance criteria are covered by Vitest/RTL tests in `AddSeriesForm.test.tsx`, `EditSeriesForm.test.tsx`, and `SeriesDetail.test.tsx`; `npm test`, `npm run lint`, and `npm run build` all pass.
