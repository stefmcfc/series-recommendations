# Frontend Spec 012: Exclude Flag, Production Status & Refresh

**Status**: Not started
**Depends on**: Frontend Spec 003 (`AddSeriesForm`) ✅, Frontend Spec 004 (`EditSeriesForm`) ✅, Frontend Spec 005 (`SeriesDetail`) ✅, Series Spec 008 (`excludeFromRecommendations`, `productionStatus`, `POST /series/{id}/refresh`)
**Frontend Stage**: 12 of N

## Overview

Surfaces Series Spec 008's three additions in the UI: an "Exclude from recommendations" checkbox on `AddSeriesForm`/`EditSeriesForm`, a production-status badge on `SeriesDetail`, and a "Refresh" action on `SeriesDetail` that re-fetches OMDb/TMDB data and reports what changed.

**Design decisions**:
- **The exclude checkbox lives in both `AddSeriesForm` and `EditSeriesForm`**, not only `EditSeriesForm` — a user may already know at add-time that a series shouldn't feed recommendations (e.g. adding a kids' show watched with family).
- **Production status is display-only**, matching the backend's read-only contract (`SERIES-008-AC-09`) — there is no form control for it anywhere.
- **Refresh feedback is a single inline message summarizing both outcomes** (e.g. "Ratings updated. Production status unchanged."), built from `RefreshResult.omdbRefreshed`/`tmdbRefreshed`, rather than two separate indicators — a partial refresh is a normal outcome (`SERIES-008-AC-17`), not something that needs alarming treatment.
- **Refresh is only on `SeriesDetail`, not `SeriesList`'s row actions.** Refreshing is a deliberate, occasional action on one series at a time, not a bulk operation — `SeriesDetail` is already the "everything about one series" view, matching where Edit/Delete already live (Frontend Spec 005).

---

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the new fields and refresh action typed centrally, so every consuming component shares one contract.

#### Acceptance Criteria

- **FRONTEND-012-AC-01** [AUTO]: `src/types/series.ts` shall gain `excludeFromRecommendations: boolean` and `productionStatus: string | null` on `Series`, and `excludeFromRecommendations?: boolean` on `CreateSeriesRequest`/`UpdateSeriesRequest` (`productionStatus` is not added to either request type — it is output-only, `SERIES-008-AC-09`).
- **FRONTEND-012-AC-02** [AUTO]: `src/types/series.ts` shall gain a `RefreshResult` interface: `series: Series`, `omdbRefreshed: boolean`, `tmdbRefreshed: boolean` (mirroring `RefreshResult`, Series Spec 008 AC-16).
- **FRONTEND-012-AC-03** [AUTO]: `seriesApi` shall gain `refresh: (id: string) => Promise<RefreshResult>`, calling `POST /series/{id}/refresh` and unwrapping the `{ data: RefreshResult }` envelope.

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

### Requirement 4: Refresh Action

**User story**: As a user, I want to refresh a series' episode counts, ratings, and production status on demand, so stale data doesn't linger indefinitely.

#### Acceptance Criteria

- **FRONTEND-012-AC-07** [AUTO]: `SeriesDetail` shall render a "Refresh" button (alongside the existing Edit/Delete actions) that calls `seriesApi.refresh(id)`.
- **FRONTEND-012-AC-08** [AUTO]: While the refresh call is in flight, the button shall show a busy state ("Refreshing...") and be disabled, following the same pattern as the existing Delete-confirmation busy state.
- **FRONTEND-012-AC-09** [AUTO]: On success, `SeriesDetail` shall update its displayed data from `RefreshResult.series` and show an inline summary message built from `omdbRefreshed`/`tmdbRefreshed` (e.g. both true → "Ratings and production status updated."; one true → naming only that one; both false → "No new data available.").
- **FRONTEND-012-AC-10** [AUTO]: If `seriesApi.refresh` rejects, `SeriesDetail` shall display an error message (`role="alert"`) and leave the currently-displayed data unchanged.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `excludeFromRecommendations`, `productionStatus`, `ProductionStatus` enum values | `series_spec_008_series_lifecycle_data.md` Requirements 1–2 |
| `POST /series/{id}/refresh`, `RefreshResult` shape | `series_spec_008_series_lifecycle_data.md` Requirement 3 |
| `AddSeriesForm`/`EditSeriesForm` field/payload conventions being extended | `frontend_spec_003_add_series_form.md`, `frontend_spec_004_edit_delete_series.md` |
| `SeriesDetail`'s `formatValue` null-dash convention, existing Edit/Delete action placement | `frontend_spec_005_series_detail.md` |

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

---

## Acceptance Criteria Summary

- [ ] FRONTEND-012-AC-01: `excludeFromRecommendations`/`productionStatus` on `Series`/request types
- [ ] FRONTEND-012-AC-02: `RefreshResult` type
- [ ] FRONTEND-012-AC-03: `seriesApi.refresh`
- [ ] FRONTEND-012-AC-04: `AddSeriesForm` exclude checkbox, omitted unless checked
- [ ] FRONTEND-012-AC-05: `EditSeriesForm` exclude checkbox, always sent explicitly
- [ ] FRONTEND-012-AC-06: `SeriesDetail` production-status label / dash
- [ ] FRONTEND-012-AC-07: Refresh button on `SeriesDetail`
- [ ] FRONTEND-012-AC-08: busy state while refreshing
- [ ] FRONTEND-012-AC-09: success updates data + summary message
- [ ] FRONTEND-012-AC-10: failure shows alert, data unchanged
