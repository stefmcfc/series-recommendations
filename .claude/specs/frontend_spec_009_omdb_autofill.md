# Frontend Spec 009: OMDb Autofill & Poster Display

**Status**: Implemented. `src/types/series.ts` (`OmdbLookupResult` interface; `posterUrl` added to `Series`/`CreateSeriesRequest`/`UpdateSeriesRequest`), `src/services/seriesApi.ts` (`lookupByTitle`), `src/services/__tests__/seriesApi.test.ts`, `src/components/AddSeriesForm.tsx` + `.module.css` (Look Up button, lookup loading/error state scoped near the Title field, autofill-only-non-null-fields logic, Poster URL field + preview with `onError` fallback), `src/components/EditSeriesForm.tsx` + `.module.css` (Poster URL field + preview, no Look Up button), `src/components/SeriesDetail.tsx` + `.module.css` (poster image when present, nothing when absent), `src/components/SeriesList.tsx` + `.module.css` (fixed-size `series-thumbnail` slot per row, placeholder box or poster image, `onError` falls back to the placeholder), and the corresponding `*.test.tsx` files (existing `makeSeries` test helpers updated to include `posterUrl`). `npm test` (171/171 passing), `npm run lint` (clean), `npm run build` (clean) all verified on 2026-08-18. No real-browser pass yet — the backend `GET /series/lookup` endpoint (Series Spec 005) isn't merged; that verification will happen once both branches land. **Superseded by `frontend_spec_022_tmdb_primary_lookup.md`**: the OMDb-first "Look Up" button behavior (`lookupByTitle`) is replaced by a TMDB-primary search flow; `metacriticRating` autofill is removed. Poster display/preview behavior described here is unaffected. Kept for historical/traceability reference; no AC here is renumbered or deleted.
**Priority**: P2 (quality-of-life for adding series — not core CRUD)
**Depends on**: Frontend Spec 001 (Types & API Service Layer) ✅, Frontend Spec 003 (`AddSeriesForm`) ✅, Frontend Spec 004 (`EditSeriesForm`) ✅, Frontend Spec 005 (`SeriesDetail`) ✅, Series Spec 005 (`posterUrl` field + `GET /series/lookup` endpoint)
**Frontend Stage**: 9 of N

---

## Overview

Lets a user type a series title into `AddSeriesForm`, hit a "Look Up" button, and have the backend's new `GET /api/v1/series/lookup` endpoint (Series Spec 005) fill in year, genres, season/episode counts, ratings, and a poster — reviewable and editable before saving, not auto-submitted. Also surfaces the new `posterUrl` field wherever a series is displayed: a thumbnail in `SeriesList`, a larger image in `SeriesDetail`, and an editable field in `EditSeriesForm`.

**Design decisions**:
- **Autofill only overwrites fields OMDb actually returned a value for.** If the user already typed something into a field and OMDb comes back with nothing for it (or the whole lookup only partially resolves, e.g. `totalEpisodes` per Series Spec 005's aggregation-failure design decision), that field is left alone rather than being blanked out. The one exception is `title` itself: a successful lookup overwrites it with OMDb's canonical title (e.g. user types "breaking bad", form ends up with "Breaking Bad") — that's the whole point of confirming a match.
- **Lookup is a distinct, separate action from form submission** — it has its own loading/error state, and a failed lookup never blocks the user from filling the form in manually and saving anyway (the "Save" flow is completely unaffected by whether a lookup was ever attempted).
- **`EditSeriesForm` gets an editable `posterUrl` field, but no "Look Up" button.** Editing an already-added series is a correction/update flow, not a "start from scratch with a title" flow — keeping it to a plain URL text field (same pattern as `genres`) avoids re-running a whole lookup UI a second time for a comparatively rare case. Revisit if that turns out to be a real gap.
- **Poster images use `alt=""` (decorative)** in all three display locations (`AddSeriesForm`'s preview, `SeriesDetail`, `SeriesList`'s thumbnail) — the series title is always rendered as visible text immediately next to or above the image, so a screen reader announcing the image again would be redundant. This follows the same accessibility-conscious pattern established in Frontend Spec 008.
- **Broken/missing images degrade gracefully.** A `posterUrl` that 404s or fails to load (stale OMDb link, network hiccup) hides itself via `onError` rather than showing the browser's broken-image icon; `SeriesList`'s thumbnail slot is a fixed size regardless of whether an image is present, so rows don't jump around as they load.

---

## Requirements

### Requirement 1: Types & API Service Layer

**User story**: As a developer, I want the lookup endpoint and the new `posterUrl` field typed centrally, so every component that needs them shares one contract.

#### Acceptance Criteria

- **FRONTEND-009-AC-01** [AUTO]: `src/types/series.ts` shall gain a new `OmdbLookupResult` interface: `title: string`, and optional `year`, `genres`, `totalSeasons`, `totalEpisodes`, `imdbRating`, `metacriticRating`, `rottenTomatoesRating`, `posterUrl` (mirroring `SeriesLookupDto`'s shape from `series_spec_005_omdb_lookup.md`).
- **FRONTEND-009-AC-02** [AUTO]: `Series`, `CreateSeriesRequest`, and `UpdateSeriesRequest` shall each gain an optional `posterUrl` field, following the same `string | null` (on `Series`) / `string` optional (on the request types) convention already used for `genres`.
- **FRONTEND-009-AC-03** [AUTO]: `seriesApi` shall gain `lookupByTitle: (title: string) => Promise<OmdbLookupResult>`, calling `GET /series/lookup` with a `title` query param and unwrapping the `{ data: SeriesLookupDto }` envelope via the existing `request<T>()` helper (a plain JSON GET — no `responseType: 'blob'` special-casing needed, unlike `export()`).

---

### Requirement 2: Triggering a Lookup

**User story**: As a user, I want a clearly-placed way to look up a series I'm adding, so that I don't have to type everything in by hand.

#### Acceptance Criteria

- **FRONTEND-009-AC-04** [AUTO]: `AddSeriesForm` shall render a "Look Up" button (`data-testid="lookup-btn"`) next to the Title field.
- **FRONTEND-009-AC-05** [AUTO]: The "Look Up" button shall be disabled while the Title field is blank.
- **FRONTEND-009-AC-06** [AUTO]: Clicking "Look Up" shall call `seriesApi.lookupByTitle` with the current (trimmed) Title field value, and shall not submit or validate the rest of the form.

---

### Requirement 3: Autofill Behavior

**User story**: As a user, I want a successful lookup to fill in what it found while leaving anything I already typed for fields it didn't find, so the result feels helpful, not destructive.

#### Acceptance Criteria

- **FRONTEND-009-AC-07** [AUTO]: On a successful lookup, `AddSeriesForm` shall overwrite `title` with the result's `title`.
- **FRONTEND-009-AC-08** [AUTO]: On a successful lookup, for each of `year`, `genres`, `totalSeasons`, `totalEpisodes`, `imdbRating`, `metacriticRating`, `rottenTomatoesRating`, `posterUrl`: if the result has a non-null value for that field, the form field shall be overwritten with it; if the result's value is null/absent, the form field shall be left unchanged.
- **FRONTEND-009-AC-09** [AUTO]: A lookup shall never modify `status`, `personalRating`, or `personalNotes` — fields OMDb has no bearing on.

---

### Requirement 4: Lookup Loading & Error States

**User story**: As a user, I want to see that a lookup is running and get a clear message if it fails, so I know whether to wait, retry, or just fill the form in myself.

#### Acceptance Criteria

- **FRONTEND-009-AC-10** [AUTO]: While a lookup is in flight, the "Look Up" button shall be disabled and read "Looking up...".
- **FRONTEND-009-AC-11** [AUTO]: If `seriesApi.lookupByTitle` rejects with an `ApiError`, `AddSeriesForm` shall display `ApiError.message` in a `role="alert"` region scoped near the Look Up button (distinct from the form's own `submitError` region used for `seriesApi.create` failures), and shall leave all form fields exactly as they were.
- **FRONTEND-009-AC-12** [AUTO]: A failed or never-attempted lookup shall not block manual entry or submission — `seriesApi.create` remains callable via the normal Save flow regardless of lookup state.

---

### Requirement 5: Poster Field in `AddSeriesForm`

**User story**: As a user, I want to see the poster a lookup found before I save, so I know the match is right.

#### Acceptance Criteria

- **FRONTEND-009-AC-13** [AUTO]: `AddSeriesForm` shall render a labelled "Poster URL" text input (editable, same convention as the `genres` field — populated by a successful lookup per AC-08, or typed/edited manually).
- **FRONTEND-009-AC-14** [AUTO]: When the Poster URL field is non-blank, `AddSeriesForm` shall render an `<img>` preview using that URL, with `alt=""` (decorative — see design decisions).
- **FRONTEND-009-AC-15** [AUTO]: If the preview image fails to load (`onError`), `AddSeriesForm` shall hide the broken image rather than showing the browser's default broken-image icon.

---

### Requirement 6: `posterUrl` in `EditSeriesForm`

**User story**: As a user, I want to fix or add a poster URL when editing a series, so a bad match or a missing poster isn't permanent.

#### Acceptance Criteria

- **FRONTEND-009-AC-16** [AUTO]: `EditSeriesForm` shall render a labelled "Poster URL" text input, pre-populated from `series.posterUrl`, following the same field-inclusion/payload convention as every other optional field (Frontend Spec 004).
- **FRONTEND-009-AC-17** [AUTO]: `EditSeriesForm` shall render the same preview-with-`onError`-fallback behavior as `AddSeriesForm` (AC-14/AC-15) for its Poster URL field.

---

### Requirement 7: Poster in `SeriesDetail`

**User story**: As a user, I want to see a series' poster on its detail page, so the view feels like a real reference, not just a data dump.

#### Acceptance Criteria

- **FRONTEND-009-AC-18** [AUTO]: When `series.posterUrl` is non-null, `SeriesDetail` shall render it as a prominent `<img>` (`alt=""`) near the top of the populated view, alongside/above the existing field list.
- **FRONTEND-009-AC-19** [AUTO]: When `series.posterUrl` is null, `SeriesDetail` shall render no image element (not a placeholder box — unlike `SeriesList`'s fixed-size row thumbnail, a single detail page has no row-alignment constraint to preserve).
- **FRONTEND-009-AC-20** [AUTO]: If the poster image fails to load, `SeriesDetail` shall hide it (same `onError` pattern as AC-15).

---

### Requirement 8: Thumbnail in `SeriesList`

**User story**: As a user, I want to visually recognize series in my list at a glance, not just read titles.

#### Acceptance Criteria

- **FRONTEND-009-AC-21** [AUTO]: Each series row in `SeriesList` shall render a fixed-size thumbnail slot before the title: the poster image (`alt=""`) when `posterUrl` is non-null, or a neutral placeholder (no `<img>` element — a styled empty box) when it's null — so row height/alignment stays consistent across rows regardless of poster availability.
- **FRONTEND-009-AC-22** [AUTO]: If a row's poster image fails to load, it shall fall back to the same placeholder used for a missing `posterUrl` (same `onError` pattern as AC-15).

---

### Requirement 9: Shall Not — Data Handling

**User story**: As a developer, I want to be sure lookups don't leak data through logging, so behavior stays predictable.

#### Acceptance Criteria

- **FRONTEND-009-AC-23** [AUTO]: `AddSeriesForm` shall not log the looked-up title or the lookup result to the console.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `GET /api/v1/series/lookup` contract, `SeriesLookupDto` shape, 404/502 semantics | `series_spec_005_omdb_lookup.md` |
| `posterUrl` on `Series`/CRUD | `series_spec_005_omdb_lookup.md` Requirement 1 |
| Omit-if-blank payload convention, field-level error display pattern | `AddSeriesForm.tsx` (Frontend Spec 003) |
| `EditSeriesForm` field/payload conventions | `EditSeriesForm.tsx` (Frontend Spec 004) |
| Decorative-image `alt=""` / graceful-degradation precedent | Frontend Spec 008 design decisions |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (addition)

```typescript
describe('SH-0XX: lookupByTitle', () => {
  it('should unwrap { data: SeriesLookupDto } and return it', async () => {
    const mockResult = { title: 'Breaking Bad', year: 2008, imdbRating: 9.5 }
    client.get.mockResolvedValue({ data: { data: mockResult } })

    const result = await seriesApi.lookupByTitle('Breaking Bad')

    expect(client.get).toHaveBeenCalledWith('/series/lookup', {
      params: { title: 'Breaking Bad' },
    })
    expect(result.title).toBe('Breaking Bad')
  })
})
```

### `src/components/AddSeriesForm.test.tsx` (additions)

```typescript
describe('FRONTEND-009-AC-04/05/06: triggering a lookup', () => {
  it('disables Look Up until a title is entered, then calls lookupByTitle', async () => {
    mockLookup.mockResolvedValue({ title: 'Show' })
    renderForm()

    expect(screen.getByTestId('lookup-btn')).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Show' } })
    expect(screen.getByTestId('lookup-btn')).not.toBeDisabled()

    fireEvent.click(screen.getByTestId('lookup-btn'))
    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('Show'))
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
```

```typescript
describe('FRONTEND-009-AC-07/08/09: autofill overwrite rules', () => {
  it('overwrites empty fields but leaves user-entered totalEpisodes alone when the result omits it', async () => {
    mockLookup.mockResolvedValue({
      title: 'Breaking Bad',
      year: 2008,
      genres: 'Crime, Drama',
      totalSeasons: 5,
      // totalEpisodes intentionally absent
      imdbRating: 9.5,
    })
    renderForm()

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'breaking bad' } })
    fireEvent.change(screen.getByLabelText(/total episodes/i), { target: { value: '62' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue('Breaking Bad'))
    expect(screen.getByLabelText(/year/i)).toHaveValue(2008)
    expect(screen.getByLabelText(/total seasons/i)).toHaveValue(5)
    expect(screen.getByLabelText(/total episodes/i)).toHaveValue(62) // untouched
    expect(screen.getByLabelText(/status/i)).toHaveValue(SeriesStatus.BACKLOG) // untouched
  })
})
```

```typescript
describe('FRONTEND-009-AC-10/11/12: lookup loading and error', () => {
  it('shows "Looking up..." while in flight and disables the button', async () => {
    mockLookup.mockReturnValue(new Promise(() => undefined))
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Show' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    expect(screen.getByTestId('lookup-btn')).toHaveTextContent(/looking up/i)
    expect(screen.getByTestId('lookup-btn')).toBeDisabled()
  })

  it('shows a scoped alert on failure without touching form fields, and Save still works', async () => {
    mockLookup.mockRejectedValue(new ApiError(404, 'No OMDb results for title: Xyzzy'))
    mockCreate.mockResolvedValue({ id: '1', title: 'Xyzzy' } as never)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Xyzzy' } })
    fireEvent.click(screen.getByTestId('lookup-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no omdb results/i),
    )
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Xyzzy')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
  })
})
```

```typescript
describe('FRONTEND-009-AC-13/14/15: poster field and preview', () => {
  it('renders a preview when Poster URL is populated, hides it on load failure', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/poster url/i), {
      target: { value: 'https://example.com/poster.jpg' },
    })

    const img = screen.getByRole('presentation', { hidden: true }) as HTMLImageElement
    expect(img).toHaveAttribute('src', 'https://example.com/poster.jpg')

    fireEvent.error(img)
    expect(screen.queryByRole('presentation', { hidden: true })).not.toBeInTheDocument()
  })
})
```

### `src/components/SeriesList.test.tsx` (addition)

```typescript
describe('FRONTEND-009-AC-21/22: row thumbnail', () => {
  it('renders a placeholder slot when posterUrl is null, an image when present', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'No Poster', posterUrl: null }),
      makeSeries({ id: '2', title: 'Has Poster', posterUrl: 'https://example.com/p.jpg' }),
    ])
    render(<SeriesList />)
    await waitFor(() => screen.getByText('No Poster'))

    expect(screen.getAllByTestId('series-thumbnail')).toHaveLength(2)
    expect(screen.queryByAltText('')).toBeInTheDocument() // the one <img>, decorative alt
  })
})
```

### `src/components/SeriesDetail.test.tsx` (addition)

```typescript
describe('FRONTEND-009-AC-18/19/20: poster on the detail view', () => {
  it('renders the poster when present, nothing when absent', async () => {
    mockGetById.mockResolvedValueOnce(makeSeries({ posterUrl: 'https://example.com/p.jpg' }))
    const { rerender } = render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await waitFor(() => screen.getByAltText(''))

    mockGetById.mockResolvedValueOnce(makeSeries({ posterUrl: null }))
    rerender(<SeriesDetail id="2" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await waitFor(() => expect(screen.queryByAltText('')).not.toBeInTheDocument())
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-009-AC-01: `OmdbLookupResult` type
- [x] FRONTEND-009-AC-02: `posterUrl` on `Series`/`CreateSeriesRequest`/`UpdateSeriesRequest`
- [x] FRONTEND-009-AC-03: `seriesApi.lookupByTitle`
- [x] FRONTEND-009-AC-04: "Look Up" button rendered
- [x] FRONTEND-009-AC-05: disabled while title is blank
- [x] FRONTEND-009-AC-06: click calls `lookupByTitle`, doesn't submit the form
- [x] FRONTEND-009-AC-07: title overwritten with canonical result
- [x] FRONTEND-009-AC-08: non-null result fields overwrite; null/absent fields left alone
- [x] FRONTEND-009-AC-09: status/personalRating/personalNotes never touched by lookup
- [x] FRONTEND-009-AC-10: "Looking up..." + disabled while in flight
- [x] FRONTEND-009-AC-11: scoped alert on failure, fields untouched
- [x] FRONTEND-009-AC-12: failed/no lookup doesn't block Save
- [x] FRONTEND-009-AC-13: Poster URL field in `AddSeriesForm`
- [x] FRONTEND-009-AC-14: preview image when populated
- [x] FRONTEND-009-AC-15: broken preview hides itself
- [x] FRONTEND-009-AC-16: Poster URL field in `EditSeriesForm`
- [x] FRONTEND-009-AC-17: same preview/fallback behavior in `EditSeriesForm`
- [x] FRONTEND-009-AC-18: poster shown in `SeriesDetail` when present
- [x] FRONTEND-009-AC-19: no image element when absent
- [x] FRONTEND-009-AC-20: broken poster hides itself in `SeriesDetail`
- [x] FRONTEND-009-AC-21: fixed-size thumbnail slot per row in `SeriesList`
- [x] FRONTEND-009-AC-22: broken row thumbnail falls back to placeholder
- [x] FRONTEND-009-AC-23: no console logging of lookup title/result
