# Frontend Spec 012: Exclude Flag, Production Status, Refresh & Rewatch Flag

**Status**: Not started — Requirement 4 (Refresh Action) superseded by `frontend_spec_023_series_refresh.md`, now implemented there; Requirements 1–3 and 5 remain not started
**Depends on**: Frontend Spec 002 (`SeriesList`) ✅, Frontend Spec 003 (`AddSeriesForm`) ✅, Frontend Spec 004 (`EditSeriesForm`) ✅, Frontend Spec 005 (`SeriesDetail`) ✅, Frontend Spec 006 (`SearchFilter`) ✅, Series Spec 008 (`excludeFromRecommendations`, `productionStatus`, `flaggedForRewatch`)
**Frontend Stage**: 12 of N
**Note**: Requirement 4 (Refresh Action) below is **superseded in full by `frontend_spec_023_series_refresh.md`** — see that requirement's heading for details. Requirements 1–3 and 5 are unaffected and remain current.

## Overview

Surfaces Series Spec 008's additions in the UI: an "Exclude from recommendations" checkbox on `AddSeriesForm`/`EditSeriesForm`, a production-status badge on `SeriesDetail`, ~~a "Refresh" action on `SeriesDetail` that re-fetches OMDb/TMDB data and reports what changed~~ (superseded, see Requirement 4), and a rewatch-flag toggle plus filter so a user can mark completed series as rewatch candidates while browsing and filter down to just those later.

**Design decisions**:
- **The exclude checkbox lives in both `AddSeriesForm` and `EditSeriesForm`**, not only `EditSeriesForm` — a user may already know at add-time that a series shouldn't feed recommendations (e.g. adding a kids' show watched with family).
- **Production status is display-only**, matching the backend's read-only contract (`SERIES-008-AC-09`) — there is no form control for it anywhere.
- ~~Refresh feedback is a single inline message summarizing both outcomes...~~ — superseded, see Requirement 4 and `frontend_spec_023_series_refresh.md` (which also adds a bulk "Refresh All" on `SeriesList`, deliberately not ruled out here).
- **The rewatch toggle is the inverse placement of the exclude checkbox: `SeriesList` (inline, per row) and `SeriesDetail`, not `Add`/`EditSeriesForm`.** Flagging a series for rewatch only makes sense once it's `COMPLETED` — you can't know you want to rewatch something you haven't finished — and it's fundamentally a "scan through my finished list and flag a few" activity, not something decided while filling in a form. Requiring a modal open per flag would add real friction to that workflow; an inline row toggle doesn't.
- **The rewatch toggle is only rendered for `COMPLETED` rows/series**, even though the backend places no such restriction (`SERIES-008-AC-21`) — a UI-only choice to keep the control meaningful, not a data constraint. Nothing stops a future spec from relaxing this.

---

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the new fields and refresh action typed centrally, so every consuming component shares one contract.

#### Acceptance Criteria

- **FRONTEND-012-AC-01** [AUTO]: `src/types/series.ts` shall gain `excludeFromRecommendations: boolean` and `productionStatus: string | null` on `Series`, and `excludeFromRecommendations?: boolean` on `CreateSeriesRequest`/`UpdateSeriesRequest` (`productionStatus` is not added to either request type — it is output-only, `SERIES-008-AC-09`).
- ~~**FRONTEND-012-AC-02** [AUTO]~~ — superseded by `FRONTEND-023-AC-02`: `src/types/series.ts` shall gain a `RefreshResult` interface: `series: Series`, `omdbRefreshed: boolean`, `tmdbRefreshed: boolean` (mirroring `RefreshResult`, Series Spec 008 AC-16).
- ~~**FRONTEND-012-AC-03** [AUTO]~~ — superseded by `FRONTEND-023-AC-03`: `seriesApi` shall gain `refresh: (id: string) => Promise<RefreshResult>`, calling `POST /series/{id}/refresh` and unwrapping the `{ data: RefreshResult }` envelope.

---

### Requirement 2: Exclude-From-Recommendations Checkbox

**User story**: As a user, I want to mark a series as excluded from recommendations while adding or editing it, so it never has to be a separate follow-up step.

#### Acceptance Criteria

- **FRONTEND-012-AC-04** [AUTO]: `AddSeriesForm` shall render an "Exclude from recommendations" checkbox, unchecked by default, included in `buildPayload`'s `CreateSeriesRequest` only when checked (omitted, not sent as `false`, matching every other optional field's omit-when-unset convention in this form).
- **FRONTEND-012-AC-05** [AUTO]: `EditSeriesForm` shall render the same checkbox, initialized from `series.excludeFromRecommendations`, and always included in `buildPayload`'s `UpdateSeriesRequest` (both `true` and `false` are meaningful, explicit states here — unlike `AddSeriesForm`, this isn't an "unset vs set" field once a series exists, so it's never omitted).

---

### Requirement 3: Production Status Display

**User story**: As a user, I want to see at a glance whether a show I'm tracking has ended or is still going, so "I've watched everything released" doesn't get confused with "the show is actually over."

#### Acceptance Criteria

- **FRONTEND-012-AC-06** [AUTO]: `SeriesDetail` shall display a "Production Status" field, rendering a human-readable label for each `ProductionStatus` value (`RETURNING_SERIES` → "Returning Series", `PLANNED` → "Planned", `IN_PRODUCTION` → "In Production", `ENDED` → "Ended", `CANCELED` → "Canceled", `PILOT` → "Pilot"), or `—` when `null` (matching `formatValue`'s existing null-dash convention).

---

### Requirement 4: Refresh Action — SUPERSEDED

**Superseded by `frontend_spec_023_series_refresh.md` in full.** That spec carries forward the same single-series Refresh button on `SeriesDetail` (re-scoped to the current backend contract) and additionally adds a bulk "Refresh All" on `SeriesList` with progress polling and "last refreshed" timestamps that were never in scope here. The ACs below are frozen for traceability only — do not implement against them.

**User story**: As a user, I want to refresh a series' episode counts, ratings, and production status on demand, so stale data doesn't linger indefinitely.

#### Acceptance Criteria

- ~~**FRONTEND-012-AC-07** [AUTO]~~ — superseded by `FRONTEND-023-AC-05`: `SeriesDetail` shall render a "Refresh" button (alongside the existing Edit/Delete actions) that calls `seriesApi.refresh(id)`.
- ~~**FRONTEND-012-AC-08** [AUTO]~~ — superseded by `FRONTEND-023-AC-06`: While the refresh call is in flight, the button shall show a busy state ("Refreshing...") and be disabled, following the same pattern as the existing Delete-confirmation busy state.
- ~~**FRONTEND-012-AC-09** [AUTO]~~ — superseded by `FRONTEND-023-AC-07`: On success, `SeriesDetail` shall update its displayed data from `RefreshResult.series` and show an inline summary message built from `omdbRefreshed`/`tmdbRefreshed` (e.g. both true → "Ratings and production status updated."; one true → naming only that one; both false → "No new data available.").
- ~~**FRONTEND-012-AC-10** [AUTO]~~ — superseded by `FRONTEND-023-AC-08`: If `seriesApi.refresh` rejects, `SeriesDetail` shall display an error message (`role="alert"`) and leave the currently-displayed data unchanged.

---

### Requirement 5: Rewatch Flag & Filter

**User story**: As a user, I want to flag a completed series as a rewatch candidate while browsing my list, and later filter down to just those, so I don't have to remember which ones I meant to revisit.

#### Acceptance Criteria

- **FRONTEND-012-AC-11** [AUTO]: `src/types/series.ts` shall gain `flaggedForRewatch: boolean` on `Series`, `flaggedForRewatch?: boolean` on `UpdateSeriesRequest`, and `flaggedForRewatch?: boolean` on `SearchCriteria`.
- **FRONTEND-012-AC-12** [AUTO]: `SeriesList` shall render a rewatch toggle (checkbox) on each row whose `status === SeriesStatus.COMPLETED`, initialized from `series.flaggedForRewatch`. Toggling it shall call `seriesApi.update(id, { flaggedForRewatch: <new value> })` and, on success, update that row's displayed state without refetching the whole list.
- **FRONTEND-012-AC-13** [AUTO]: `SeriesDetail` shall render the same toggle when `series.status === SeriesStatus.COMPLETED`, calling `seriesApi.update` the same way and updating its own displayed state on success.
- **FRONTEND-012-AC-14** [AUTO]: If the `update` call fails for either toggle (`SeriesList` row or `SeriesDetail`), the toggle shall revert to its prior state and show an inline error scoped to that control — following `RecommendationsList`'s existing per-card scoped-error pattern (`FRONTEND-010-AC-17`), not a page-level error.
- **FRONTEND-012-AC-15** [AUTO]: `SearchFilter` shall render a "Flagged for rewatch" checkbox, following the same shape as the existing "Started, not finished" checkbox (`FRONTEND-006`) — included in the built `SearchCriteria` only when checked, omitted otherwise.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `excludeFromRecommendations`, `productionStatus`, `ProductionStatus` enum values | `series_spec_008_series_lifecycle_data.md` Requirements 1–2 |
| Current refresh design (single + bulk, `lastRefreshedAt`) — superseded reference, Requirement 4 above is frozen | `frontend_spec_023_series_refresh.md`, `series_spec_018_series_refresh.md` |
| `flaggedForRewatch` field, `SeriesSearchCriteria` filter, no server-side status restriction | `series_spec_008_series_lifecycle_data.md` Requirement 4 |
| `AddSeriesForm`/`EditSeriesForm` field/payload conventions being extended | `frontend_spec_003_add_series_form.md`, `frontend_spec_004_edit_delete_series.md` |
| `SeriesDetail`'s `formatValue` null-dash convention, existing Edit/Delete action placement | `frontend_spec_005_series_detail.md` |
| `SearchFilter`'s existing `startedNotFinished` checkbox shape being mirrored for the new rewatch filter | `frontend_spec_006_search_filter.md` |
| `RecommendationsList`'s per-card scoped-error pattern being mirrored for the rewatch toggle's failure handling | `frontend_spec_010_recommendations.md` Requirement 4 |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (addition)

```typescript
describe('FRONTEND-012-AC-03: refresh', () => {
  it('POSTs to /series/{id}/refresh and unwraps RefreshResult', async () => {
    const mockResult = { series: { id: '1', title: 'Ozark' }, omdbRefreshed: true, tmdbRefreshed: false }
    client.post.mockResolvedValue({ data: { data: mockResult } })

    const result = await seriesApi.refresh('1')

    expect(client.post).toHaveBeenCalledWith('/series/1/refresh')
    expect(result).toEqual(mockResult)
  })
})
```

### `src/components/AddSeriesForm.test.tsx` (addition)

```typescript
describe('FRONTEND-012-AC-04: exclude checkbox omitted from payload unless checked', () => {
  it('omits excludeFromRecommendations when left unchecked', async () => {
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Ozark' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(seriesApi.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ excludeFromRecommendations: expect.anything() }),
      ),
    )
  })
})
```

### `src/components/EditSeriesForm.test.tsx` (addition)

```typescript
describe('FRONTEND-012-AC-05: exclude checkbox initialized from series, always sent', () => {
  it('sends excludeFromRecommendations: false explicitly when unchecked', async () => {
    const series = makeSeries({ excludeFromRecommendations: true })
    render(<EditSeriesForm series={series} onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/exclude from recommendations/i))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(seriesApi.update).toHaveBeenCalledWith(
        series.id,
        expect.objectContaining({ excludeFromRecommendations: false }),
      ),
    )
  })
})
```

### `src/components/SeriesDetail.test.tsx` (additions)

```typescript
describe('FRONTEND-012-AC-06: production status label', () => {
  it('renders a human-readable label', async () => {
    mockGetById.mockResolvedValue(makeSeries({ productionStatus: 'RETURNING_SERIES' }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('Returning Series')).toBeInTheDocument()
  })

  it('renders a dash when null', async () => {
    mockGetById.mockResolvedValue(makeSeries({ productionStatus: null }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('—')).toBeInTheDocument()
  })
})

describe('FRONTEND-012-AC-07/08/09: refresh action', () => {
  it('updates displayed data and shows a summary on success', async () => {
    mockGetById.mockResolvedValue(makeSeries({ totalSeasons: 5 }))
    mockRefresh.mockResolvedValue({
      series: makeSeries({ totalSeasons: 6 }),
      omdbRefreshed: true,
      tmdbRefreshed: false,
    })
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText(/season/i)

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    expect(await screen.findByText('6')).toBeInTheDocument()
    expect(screen.getByText(/ratings updated/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-012-AC-10: refresh failure', () => {
  it('shows an alert and leaves data unchanged', async () => {
    mockGetById.mockResolvedValue(makeSeries({ totalSeasons: 5 }))
    mockRefresh.mockRejectedValue(new ApiError(502, 'Unable to reach the series lookup service. Please try again.'))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText(/season/i)

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
```

### `src/components/SeriesList.test.tsx` (addition)

```typescript
describe('FRONTEND-012-AC-12: rewatch toggle on COMPLETED rows', () => {
  it('renders only for COMPLETED rows and updates on toggle', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', status: SeriesStatus.COMPLETED, flaggedForRewatch: false }),
      makeSeries({ id: '2', status: SeriesStatus.WATCHING, flaggedForRewatch: false }),
    ])
    mockUpdate.mockResolvedValue(makeSeries({ id: '1', status: SeriesStatus.COMPLETED, flaggedForRewatch: true }))
    render(<SeriesList />)
    await screen.findByText(/./)

    const toggles = screen.getAllByLabelText(/flag for rewatch/i)
    expect(toggles).toHaveLength(1) // only the COMPLETED row

    fireEvent.click(toggles[0])
    await waitFor(() =>
      expect(seriesApi.update).toHaveBeenCalledWith('1', { flaggedForRewatch: true }),
    )
  })

  it('reverts and shows a scoped error on failure', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', status: SeriesStatus.COMPLETED, flaggedForRewatch: false }),
    ])
    mockUpdate.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<SeriesList />)
    const toggle = await screen.findByLabelText(/flag for rewatch/i)

    fireEvent.click(toggle)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(toggle).not.toBeChecked()
  })
})
```

### `src/components/SearchFilter.test.tsx` (addition)

```typescript
describe('FRONTEND-012-AC-15: rewatch filter checkbox', () => {
  it('includes flaggedForRewatch in criteria only when checked', () => {
    const onSearch = vi.fn()
    render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/flagged for rewatch/i))
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ flaggedForRewatch: true }),
    )
  })
})
```

---

## Acceptance Criteria Summary

- [ ] FRONTEND-012-AC-01: `excludeFromRecommendations`/`productionStatus` on `Series`/request types
- [ ] ~~FRONTEND-012-AC-02~~: superseded, not implementable — see FRONTEND-023-AC-02
- [ ] ~~FRONTEND-012-AC-03~~: superseded, not implementable — see FRONTEND-023-AC-03
- [ ] FRONTEND-012-AC-04: `AddSeriesForm` exclude checkbox, omitted unless checked
- [ ] FRONTEND-012-AC-05: `EditSeriesForm` exclude checkbox, always sent explicitly
- [ ] FRONTEND-012-AC-06: `SeriesDetail` production-status label / dash
- [ ] ~~FRONTEND-012-AC-07~~: superseded, not implementable — see FRONTEND-023-AC-05
- [ ] ~~FRONTEND-012-AC-08~~: superseded, not implementable — see FRONTEND-023-AC-06
- [ ] ~~FRONTEND-012-AC-09~~: superseded, not implementable — see FRONTEND-023-AC-07
- [ ] ~~FRONTEND-012-AC-10~~: superseded, not implementable — see FRONTEND-023-AC-08
- [ ] FRONTEND-012-AC-11: `flaggedForRewatch` on `Series`/`UpdateSeriesRequest`/`SearchCriteria`
- [ ] FRONTEND-012-AC-12: `SeriesList` rewatch toggle, `COMPLETED` rows only
- [ ] FRONTEND-012-AC-13: `SeriesDetail` rewatch toggle, `COMPLETED` only
- [ ] FRONTEND-012-AC-14: toggle reverts + scoped error on failure
- [ ] FRONTEND-012-AC-15: `SearchFilter` rewatch checkbox
