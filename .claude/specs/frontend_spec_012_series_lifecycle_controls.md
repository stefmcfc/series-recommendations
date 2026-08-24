# Frontend Spec 012: Exclude Flag, Production Status, Refresh & Rewatch Flag

**Status**: Done — Requirement 4 (Refresh Action) superseded by `frontend_spec_023_series_refresh.md`, already implemented there; Requirements 1–3 and 5 implemented on `feature/series-lifecycle-controls`. **Amendment (2026-08-24, live review)**: two layout-only follow-ups from a live review of `feature/series-lifecycle-controls`, no new acceptance criteria. (1) `SeriesDetail`: Year and Origin Country moved out of the `.fields` grid and up next to the `<h2>` title, in the same `{title} ({year})` + `| {country}` style `SeriesList` rows already use — the standalone Year/Origin Country `<dt>/<dd>` entries are gone so the data isn't duplicated. Overview is now the first entry in `.fields` and spans the full grid row (`grid-column: 1 / -1`, same pattern as the existing `.keywordsField`) instead of being squeezed into a single ~200px column where long text pushed every field below it down. (2) `SeriesList`: each row now renders as two stacked sub-rows (`.rowPrimary`/`.rowSecondary` inside the existing `.row`, which switched to `flex-direction: column`) instead of one increasingly packed flex line — thumbnail/title+year+country/rating/row-actions stay on the first line, status/new-content badge/rewatch toggle+its scoped error move to a second line indented to align under the title (`padding-left` = thumbnail width + gap, not under the thumbnail). Pure regrouping — every `data-testid`/`aria-label`/click handler is unchanged. Files touched: `frontend/src/components/SeriesDetail.tsx`, `frontend/src/components/SeriesDetail.module.css`, `frontend/src/components/SeriesDetail.test.tsx`, `frontend/src/components/SeriesList.tsx`, `frontend/src/components/SeriesList.module.css`. `SeriesList.test.tsx` needed no changes (all 68 existing tests query by role/label/testid and were unaffected by the regrouping); `SeriesDetail.test.tsx` needed several existing `getByText('The Office')`/`findByText('The Office')` calls loosened to `/^The Office/` since the heading text now includes the year suffix, plus new tests for the heading/overview changes. `npm test` (436/436) and `npm run lint` both clean. No browser automation tool was available in this session to do the real-browser visual pass called for by the working style doc — a human should still eyeball light/dark `prefers-color-scheme` before treating this as fully verified. **Amendment (2026-08-24, live review, part 2)**: two more layout-only follow-ups from a second live-review pass on `feature/series-detail-row-layout`, still no new acceptance criteria. (1) `SeriesDetail`'s `.fields` `<dl>` changed from one flat `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` auto-flowing every field in source order, to explicit row grouping: `.fields` is now `display: flex; flex-direction: column; gap: 1rem`, a vertical stack of `.fieldRow` groups (`display: grid; gap: 1rem 1.5rem`), each modified by `.threeColRow` (same `repeat(auto-fit, minmax(200px, 1fr))` formula as before, scoped to that row's fields) or `.twoColRow` (`repeat(2, 1fr)`, so 2-field rows fill the row edge-to-edge with no leftover gap, unlike the old flat grid's remainder-of-2 case) — full-width rows (Overview, Keywords) are each a single-field `.fieldRow` with no column modifier. Row order: Overview (full) → Keywords (full) → Genres/Production Status/Status (3-col) → Total Seasons/Total Episodes (2-col) → Current Season/Current Episode (2-col, conditional on `series.status !== SeriesStatus.COMPLETED`, unchanged condition) → IMDb/TMDB Rating/TMDB Vote Count (3-col) → Rotten Tomatoes Rating/Personal Rating (2-col) → Tags/Personal Notes (2-col) → Date Added/Date Completed (2-col). The now-unused `.overviewField`/`.keywordsField` grid-column-span classes were removed. (2) The rewatch flag toggle changed from a checkbox `<input>` in a `<label>` to a `<button type="button" aria-pressed={flaggedForRewatch}>` in both `SeriesDetail` (label text "Flag for rewatch" unchanged) and `SeriesList` (label text "Rewatch" unchanged) — unflagged state matches the existing outline secondary-button look (`.editButton`'s transparent/`1px solid var(--border)`/`var(--text)` treatment), flagged state matches `.addButton`'s filled/accent look (`var(--accent)` background, `#000` text), via a new `.rewatchToggleActive` modifier class applied alongside the base `.rewatchToggle` class (itself restyled from label-with-gap to an actual button shape) in both components' CSS modules. `aria-label="Flag for rewatch"` was kept on the button in both components (Testing Library's `getByLabelText` matches `aria-label` on any element, confirmed against `@testing-library/dom`'s `queryAllByAttribute('aria-label', ...)` implementation, not just labellable form elements) so most existing label-text queries kept working unchanged; the handful of checkbox-specific assertions (`.toBeChecked()`/`.not.toBeChecked()`) were converted to `toHaveAttribute('aria-pressed', 'true'/'false')` in both `SeriesDetail.test.tsx` and `SeriesList.test.tsx`. `handleRewatchToggle` in both components dropped its `React.ChangeEvent<HTMLInputElement>` parameter (no more `event.target.checked` to read) and now just flips the current value on click; the optimistic-update-with-revert-and-scoped-error logic itself is untouched. (2b) `SeriesList`'s `.rowSecondary` also gained `justify-content: space-between` plus two new wrapper divs, `.rowSecondaryLeft` (status, new-content badge — unchanged position) and `.rowSecondaryRight` (`margin-left: auto`, wrapping the rewatch button and its scoped error span together) so the rewatch control moved to the row's right edge instead of sitting left-aligned under the title with everything else. `SeriesDetail.test.tsx`'s two tests that asserted the now-removed `.overviewField`/`.keywordsField` classes were replaced with structural assertions instead (each field is the sole child of its own `.fieldRow`, and Overview's row is the `<dl>`'s first child). Files touched: `frontend/src/components/SeriesDetail.tsx`, `frontend/src/components/SeriesDetail.module.css`, `frontend/src/components/SeriesDetail.test.tsx`, `frontend/src/components/SeriesList.tsx`, `frontend/src/components/SeriesList.module.css`, `frontend/src/components/SeriesList.test.tsx`. `npm test` (436/436) and `npm run lint` both clean. No browser automation tool was available in this session either — a human should still eyeball both `prefers-color-scheme` themes and confirm the 2-col rows fill edge-to-edge and both rewatch buttons show a visually distinct filled-vs-outline state before treating this as fully verified. Notes/deviations (original Requirements 1–3/5):
- Requirement 3 (AC-06, production-status display) turned out to already be fully implemented in `SeriesDetail.tsx`'s existing `formatProductionStatus` helper (shipped earlier alongside the backend field via `series_spec_018`/`021`) — no component code changed for this requirement, only a dedicated `FRONTEND-012-AC-06` test was added to `SeriesDetail.test.tsx` to pin the RETURNING_SERIES-label/null-dash contract explicitly under this spec's own AC id.
- Requirement 5's rewatch toggle UI uses a visible `<label>` ("Rewatch" on `SeriesList` rows, "Flag for rewatch" on `SeriesDetail`) with `aria-label="Flag for rewatch"` on the `<input>` so `getByLabelText(/flag for rewatch/i)` resolves consistently in both components, per the sketches in this spec.
- **Found backend gap, not fixed here (frontend-only task)**: `SeriesController.search()` (`GET /series/search`) never binds a `flaggedForRewatch` query param into `SeriesSearchCriteria`, even though `SeriesSearchCriteria`/`SeriesSearchService.matchesFlaggedForRewatch` fully support it (`series_spec_008` Requirement 4, SERIES-008-AC-20/21). Verified live: `GET /series/search?flaggedForRewatch=true` returns all series unfiltered because the controller method has no matching `@RequestParam`. The frontend (`SearchFilter` → `seriesApi.search` → `buildSearchParams`) correctly sends `flaggedForRewatch=true` on the wire, matching `FRONTEND-012-AC-15`'s literal ask (criteria-building only) — this is purely a backend controller wiring gap and needs a small follow-up on the `series_spec_008`/backend side (add the missing `@RequestParam Boolean flaggedForRewatch` + `c.setFlaggedForRewatch(...)` in `SeriesController.search`). (Fixed the same day, alongside `series_spec_008`'s own PR — see that spec's history.)

**Amendment (2026-08-24, live review, part 3)**: a third live-review pass on `feature/series-detail-row-layout`, replacing part 2's `SeriesDetail` grid approach with one the user found less jarring, plus a new actions-row layout — still no new acceptance criteria. (1) The distinct `.threeColRow` (`repeat(auto-fit, minmax(200px, 1fr))`) / `.twoColRow` (`repeat(2, 1fr)`) split from part 2 is gone. Every non-full-width row now uses one fixed `.threeColRow` class (`grid-template-columns: repeat(3, minmax(200px, 1fr))`), whether it holds 2 or 3 fields — a 2-field row simply populates the left and middle track, leaving the third blank, rather than stretching to fill the row edge-to-edge. This was the fix for the actual complaint: under part 2's approach, a 2-column row's tracks (25%/75%) didn't line up with a 3-column row's tracks (~17%/50%/83%) directly above/below it, so column boundaries visibly shifted row to row; the fixed 3-track grid keeps every row's column boundaries aligned all the way down the page. (2) `.fields` changed from one `<dl>` to a plain `<div>` containing several small per-group `<dl>`s (one per themed section, or one per full-width row for Overview/Keywords), so an `<h3 className={styles.sectionHeader}>` can precede each group as a valid sibling — headings aren't valid `<dl>` children per the HTML content model, which ruled out keeping one giant enclosing `<dl>`. Four sections: "Details" (Genres/Production Status/Status, Total Seasons/Total Episodes, conditional Current Season/Current Episode), "Ratings" (IMDb/TMDB Rating/TMDB Vote Count, Rotten Tomatoes Rating/Personal Rating), "Personal" (Tags/Personal Notes), "Timeline" (Date Added/Date Completed) — Overview/Keywords stay header-less at the top. Headers are gated behind a temporary `SHOW_SECTION_HEADERS` flag (`import.meta.env.VITE_SERIES_DETAIL_SECTION_HEADERS !== 'false'`, defaults on) so the user can compare with/without via `.env.local` + a page reload while deciding; no test file needed changes since `dt.closest('dl')` still resolves to the (now smaller, per-group) `<dl>` correctly for the existing Overview-ordering test. (3) The bottom actions bar restructured from one flat `.actions` flex row (Edit/Delete/Refresh/"Last refreshed"/new-content badge+Dismiss/rewatch button all packed left-aligned) into `.actionsGroup` (flex column) containing `.actionsRow` (`justify-content: space-between`, `.actionsLeft` = Edit/Delete/Refresh, `.actionsRight` = the rewatch button when `COMPLETED`) and a second-line `.actionsInfo` row (Last refreshed text, new-content badge + Dismiss button) — separates clickable actions from plain status text, and pins the rewatch toggle to the right edge, mirroring `SeriesList`'s equivalent part-2 change. `confirmingDelete`'s Confirm/Cancel sub-state is untouched. Files touched: `frontend/src/components/SeriesDetail.tsx`, `frontend/src/components/SeriesDetail.module.css`. No test changes were needed for the actions-row restructure (all 51 `SeriesDetail.test.tsx` tests and the full 436-test suite pass unmodified — they query by role/label/testid, not DOM position). `npm test` (436/436) and `npm run lint` both clean. Verified live via Claude in Chrome (dark `prefers-color-scheme`): column boundaries now align consistently down the page, section headers render with the expected uppercase/bordered style, both rewatch button states (outline/filled) render as intended, and the actions-row split (left action group / right rewatch button / second-line info) matches the design. Light-theme wasn't separately re-verified in this pass (no new colors introduced — everything reuses existing `var(--text)`/`var(--border)`/`var(--accent)` custom properties already verified in earlier passes).
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

- [x] FRONTEND-012-AC-01: `excludeFromRecommendations`/`productionStatus` on `Series`/request types
- [ ] ~~FRONTEND-012-AC-02~~: superseded, not implementable — see FRONTEND-023-AC-02
- [ ] ~~FRONTEND-012-AC-03~~: superseded, not implementable — see FRONTEND-023-AC-03
- [x] FRONTEND-012-AC-04: `AddSeriesForm` exclude checkbox, omitted unless checked
- [x] FRONTEND-012-AC-05: `EditSeriesForm` exclude checkbox, always sent explicitly
- [x] FRONTEND-012-AC-06: `SeriesDetail` production-status label / dash
- [ ] ~~FRONTEND-012-AC-07~~: superseded, not implementable — see FRONTEND-023-AC-05
- [ ] ~~FRONTEND-012-AC-08~~: superseded, not implementable — see FRONTEND-023-AC-06
- [ ] ~~FRONTEND-012-AC-09~~: superseded, not implementable — see FRONTEND-023-AC-07
- [ ] ~~FRONTEND-012-AC-10~~: superseded, not implementable — see FRONTEND-023-AC-08
- [x] FRONTEND-012-AC-11: `flaggedForRewatch` on `Series`/`UpdateSeriesRequest`/`SearchCriteria`
- [x] FRONTEND-012-AC-12: `SeriesList` rewatch toggle, `COMPLETED` rows only
- [x] FRONTEND-012-AC-13: `SeriesDetail` rewatch toggle, `COMPLETED` only
- [x] FRONTEND-012-AC-14: toggle reverts + scoped error on failure
- [x] FRONTEND-012-AC-15: `SearchFilter` rewatch checkbox (builds the criteria correctly; see Status note above re: a backend controller gap in actually applying this filter server-side)
