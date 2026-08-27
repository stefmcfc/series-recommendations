# Frontend Spec 034: Trim AddSeriesForm Fields for Recommendation-Triggered Add

**Status**: Implemented (2026-08-27) — `frontend/src/components/AddSeriesForm.tsx` (added `source` prop,
threaded through to `SeriesFormFields`), `frontend/src/components/SeriesFormFields.tsx` (added `source` prop,
conditionally hides Total Seasons/Episodes/IMDb Rating/both Rotten Tomatoes rating fields and swaps the Status
`<select>` for read-only text under `source="recommendation"`), `frontend/src/components/RecommendationsList.tsx`
(passes `source="recommendation"`), plus new/updated coverage in `AddSeriesForm.test.tsx`,
`SeriesFormFields.test.tsx`, and `RecommendationsList.test.tsx`. `EditSeriesForm.tsx` is unchanged — it relies on
`SeriesFormFields`'s `source` default of `'manual'` and was not touched.
**Priority**: Low
**Depends on**: `frontend_spec_003_add_series_form.md`, `frontend_spec_010_recommendations.md`
**Area**: Frontend (`AddSeriesForm.tsx`, `RecommendationsList.tsx`)
**Amendment note (2026-08-26, `tooling_spec_005`)**: the four fields Requirement 2 hides (`Total
Seasons`/`Total Episodes`/`IMDb Rating`/`Rotten Tomatoes Rating`) and the `Status` field it locks
to read-only text now render via the shared `SeriesFormFields.tsx` component, not directly in
`AddSeriesForm.tsx`. Implementing this spec now means threading a `source` (or equivalent) prop
through to `SeriesFormFields` itself, not just adding it to `AddSeriesForm`.

## Overview

`AddSeriesForm` is shared by two call sites: `App.tsx`'s manual "Add Series" button (no `initialValues`), and
`RecommendationsList.tsx`'s "Mark as Watched"/"Add to List" CTAs (`initialValues` pre-filled from a
`Recommendation` — title/year/genres/status/posterUrl/imdbId/overview only). Both currently render the exact
same full field set, including `Status` as an editable dropdown and `Total Seasons`/`Total Episodes`/`IMDb
Rating`/`Rotten Tomatoes Rating` as blank, freely-editable inputs.

A live review on 2026-08-24 found this misleading specifically for the recommendation-triggered path:

- **`Status`** is already unambiguous the moment either CTA is clicked — "Mark as Watched" means `COMPLETED`,
  "Add to List" means `BACKLOG`. Showing it as an editable dropdown invites second-guessing a choice the user
  already made by clicking a specific button.
- **`Total Seasons`/`Total Episodes`/`IMDb Rating`/`Rotten Tomatoes Rating`** are never available from a
  `Recommendation` (confirmed: none of these are among the fields `RecommendationsList.tsx` currently threads
  into `initialValues`) — and critically, they don't need to be typed manually either:
  `RecommendationsList.handleAddSuccess` already fires `seriesApi.refresh(series.id)` immediately after a
  successful add specifically to populate these same fields (confirmed in that function's own comment,
  `frontend_spec_010`/`frontend_spec_018_series_refresh.md`). Showing them as blank manual-entry inputs in this
  flow is actively misleading, not just unnecessary — anything typed risks being silently overwritten by the
  background refresh moments later, and for "Add to List" specifically nothing has been watched yet to know
  these numbers with any confidence anyway.
- **`Personal Rating`, `Personal Notes`, and `Tags` are correctly left alone by this spec.** All three are
  purely user-owned data `SeriesRefreshService` never touches (confirmed by reading it directly — `tags` isn't
  referenced there at all, matching `series_spec_014_tags.md`'s own "sourced from the user, not an external
  API" framing; `personalRating`/`personalNotes` are the same class of field). They stay exactly as they are
  today in both flows.

## Design Decisions

- **A new explicit `source` prop, not inference from `initialValues`.** `AddSeriesForm` gains
  `source?: 'manual' | 'recommendation'` (default `'manual'`), rather than keying this behavior off whether
  `initialValues` was passed at all — a future caller might reasonably want to pass partial `initialValues`
  without wanting this spec's field-trimming behavior, so the two concerns (pre-filling vs. which fields are
  shown) stay independent and explicit rather than implicitly coupled.
- **`Title`, `Year`, `Genres`, `Poster URL`, and the hidden `overview`/`imdbId` fields are unaffected** — these
  already arrive reasonably well-populated from the recommendation, and a user correcting one (e.g. fixing a
  title) is a legitimate, unchanged use case this spec doesn't touch.
- **Hidden fields need no payload/validation changes.** `buildCreateRequest`'s existing "only include a field
  in the payload if its form-state string is non-empty" logic already omits an untouched field automatically;
  a field that's never rendered can never be edited away from its initial empty string. No change needed to
  `buildCreateRequest` or the validation functions themselves — this spec is purely about which inputs render,
  not about payload shape or validation rules.
- **The read-only `Status` display reuses this project's existing status-label formatting convention** — check
  how `SeriesList.tsx`/`SeriesDetail.tsx` already render a `SeriesStatus` value as human-readable text (e.g.
  Title Case, not the raw enum constant) and match that, rather than inventing a new formatting function.
  **Correction (2026-08-27)**: this assumption was re-checked during implementation and found inaccurate —
  neither `SeriesList.tsx` (`<span className={styles.status}>{s.status}</span>`) nor
  `SeriesDetailFields.tsx` (`<dd>{series.status}</dd>`) format the enum at all; both render the raw constant
  (e.g. literally `COMPLETED`, not `Completed`). There is no Title Case convention anywhere in this codebase for
  `SeriesStatus`. Implemented to match the real existing precedent instead: the read-only text under
  `source="recommendation"` renders `form.status` unformatted (`<span id="status">{form.status}</span>` in
  `SeriesFormFields.tsx`).

## Requirement 1: `AddSeriesForm` gains a `source` prop

**User story**: As a developer wiring up `AddSeriesForm`, I want to declare which flow opened it, so the form
can adapt which fields make sense to show.

### FRONTEND-034-AC-01 [AUTO]
**Statement**: `AddSeriesForm` shall accept an optional `source?: 'manual' | 'recommendation'` prop, defaulting
to `'manual'` when omitted.

**References**: `frontend/src/components/AddSeriesForm.tsx`, `AddSeriesFormProps`.

**Test Case (Red)**:
```typescript
it('FRONTEND-034-AC-01: defaults to manual (full field set) when source is omitted', () => {
  render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)
  expect(screen.getByLabelText(/total seasons/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/^status/i)).not.toHaveAttribute('disabled')
})
```

**Test Case (Green)**: add the prop with a default value.

### FRONTEND-034-AC-02 [AUTO]
**Statement**: `RecommendationsList.tsx` shall pass `source="recommendation"` on its `AddSeriesForm` instance
(both the "Mark as Watched" and "Add to List" paths, since both set `pendingAdd` and render the same instance).

**References**: `frontend/src/components/RecommendationsList.tsx`, the `<AddSeriesForm ... />` render.

**Test Case (Red)**:
```typescript
it('FRONTEND-034-AC-02: opens AddSeriesForm with source=recommendation', () => {
  render(<RecommendationsList />)
  // ... trigger "Add to List" on a rendered card ...
  expect(screen.queryByLabelText(/total seasons/i)).not.toBeInTheDocument()
})
```

**Test Case (Green)**: add `source="recommendation"` to the JSX.

## Requirement 2: Recommendation-triggered form hides refresh-populated fields, locks Status

**User story**: As a user adding a series from a recommendation, I don't want to see fields that either don't
apply yet or will be overwritten by the automatic post-add refresh moments later.

### FRONTEND-034-AC-03 [AUTO]
**Statement**: While `source` is `'recommendation'`, `Total Seasons`, `Total Episodes`, `IMDb Rating`, and
`Rotten Tomatoes Rating` shall not be rendered at all (not disabled — absent).

**References**: `AddSeriesForm.tsx`, the four corresponding field blocks (currently unconditional).

**Test Case (Red)**:
```typescript
it('FRONTEND-034-AC-03: hides refresh-populated fields under source=recommendation', () => {
  render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} source="recommendation" />)
  for (const label of [/total seasons/i, /total episodes/i, /^imdb rating/i, /rotten tomatoes rating/i]) {
    expect(screen.queryByLabelText(label)).not.toBeInTheDocument()
  }
})
```

**Test Case (Green)**: wrap each of the four field blocks in `{source !== 'recommendation' && (...)}`.

### FRONTEND-034-AC-04 [AUTO]
**Statement**: While `source` is `'recommendation'`, `Status` shall render as read-only text showing the
human-readable status (e.g. "Completed", "Backlog") rather than an editable `<select>`, reflecting whatever
value `initialValues.status` carried in.

**References**: `AddSeriesForm.tsx`, the `Status` field block (currently an unconditional `<select>`).

**Test Case (Red)**:
```typescript
it('FRONTEND-034-AC-04: Status is read-only text under source=recommendation', () => {
  render(
    <AddSeriesForm
      onCancel={vi.fn()}
      onSuccess={vi.fn()}
      source="recommendation"
      initialValues={{ title: 'X', status: SeriesStatus.COMPLETED }}
    />,
  )
  expect(screen.queryByRole('combobox', { name: /^status/i })).not.toBeInTheDocument()
  expect(screen.getByText(/^completed$/i)).toBeInTheDocument()
})
```

**Test Case (Green)**: conditionally render either the existing `<select>` (manual) or a static label showing
the formatted status value (recommendation).

### FRONTEND-034-AC-05 [AUTO]
**Statement**: `Personal Rating`, `Personal Notes`, `Tags`, `Title`, `Year`, and `Genres` shall remain visible
and editable under `source="recommendation"`, unchanged from today.

**Rationale**: explicit regression check — this spec narrows the field set, it must not narrow it further than
intended.

**Test Case (Red)**:
```typescript
it('FRONTEND-034-AC-05: user-owned and pre-filled-but-editable fields are unaffected', () => {
  render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} source="recommendation" />)
  for (const label of [/personal rating/i, /personal notes/i, /^tags/i, /^title/i, /^year/i, /^genres/i]) {
    expect(screen.getByLabelText(label)).toBeInTheDocument()
    expect(screen.getByLabelText(label)).not.toHaveAttribute('disabled')
  }
})
```

**Test Case (Green)**: no change needed if AC-03/AC-04 only touch the four specified fields — included as an
explicit regression check.

### FRONTEND-034-AC-06 [AUTO]
**Statement**: Submitting the form under `source="recommendation"` shall send a `POST /series` payload
identical in shape to what today's full form would send if those hidden fields were simply left blank — no
`totalSeasons`/`totalEpisodes`/`imdbRating`/`rottenTomatoesRating` keys, `status` still included from
`initialValues`.

**Rationale**: confirms the Design Decisions' claim that no payload-building change is needed — this is a pure
regression check on `buildCreateRequest`'s existing behavior.

**Test Case (Red)**:
```typescript
it('FRONTEND-034-AC-06: submitted payload omits hidden fields, still includes status', async () => {
  const createSpy = vi.spyOn(seriesApi, 'create').mockResolvedValue(makeSeries())
  render(
    <AddSeriesForm
      onCancel={vi.fn()}
      onSuccess={vi.fn()}
      source="recommendation"
      initialValues={{ title: 'X', status: SeriesStatus.BACKLOG }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /^add series$/i }))
  await waitFor(() => expect(createSpy).toHaveBeenCalled())
  const payload = createSpy.mock.calls[0][0]
  expect(payload).not.toHaveProperty('totalSeasons')
  expect(payload).not.toHaveProperty('imdbRating')
  expect(payload.status).toBe(SeriesStatus.BACKLOG)
})
```

**Test Case (Green)**: none expected — confirms existing `buildCreateRequest` behavior needs no change.

## Cross-references

| Reference | Relationship |
|---|---|
| `frontend_spec_003_add_series_form.md` | Establishes `AddSeriesForm`'s original full field set this spec narrows for one call site |
| `frontend_spec_010_recommendations.md` | Establishes the "Mark as Watched"/"Add to List" CTAs and `handleAddSuccess`'s background refresh call |
| `frontend_spec_018_series_refresh.md`/`series_spec_018_series_refresh.md` | The refresh mechanism that populates `totalSeasons`/`totalEpisodes`/ratings shortly after add, making manual entry in this flow redundant |
| `series_spec_014_tags.md` | Establishes `tags` as purely user-sourced, the basis for leaving it untouched |

## Acceptance Criteria Summary

- [x] FRONTEND-034-AC-01: `source` prop added, defaults to `'manual'`
- [x] FRONTEND-034-AC-02: `RecommendationsList` passes `source="recommendation"`
- [x] FRONTEND-034-AC-03: Total Seasons/Episodes/IMDb Rating/Rotten Tomatoes Rating hidden under `recommendation`
- [x] FRONTEND-034-AC-04: Status renders as read-only text under `recommendation` (raw value, not Title Case —
  see Design Decisions correction note above)
- [x] FRONTEND-034-AC-05: Personal Rating/Notes/Tags/Title/Year/Genres unaffected
- [x] FRONTEND-034-AC-06: submitted payload shape unaffected (regression check)
