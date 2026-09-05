# Frontend Spec 090: Series Detail Layout Adjustments

**Status**: Complete
**Priority**: P3
**Depends on**: `frontend_spec_078_series_detail_poster_lightbox_and_genres.md` (moved Genres/Status out of the "Details" grid and heading row, which is what left the gap this spec fills)
**Area**: Frontend (`components/SeriesDetailFields.tsx`, `components/SeriesDetail.tsx`, `components/SeriesDetailActionsPanel.tsx`, `components/SeriesDetail.module.css`)

## Overview

Three small, unrelated `SeriesDetail` layout polish items raised after using the page post-`frontend_spec_078`, bundled into one spec since all three touch the same handful of files. First: since Genres/Status moved out (`frontend_spec_078`), the "Details" section's field grid has an awkward gap — Production Status now sits alone in a 3-column row, with Total Seasons/Total Episodes occupying only 2 of 3 columns in the row below; this consolidates all three into one full row. Second: the "Back to series list" button only ever renders once, at the very top of the page, so a user who has scrolled down a long detail page has to scroll all the way back up to leave — this makes it persist in view. Third: the Recommendations button currently sits grouped with Edit/Delete/Refresh in the actions panel's left-hand group; this moves it to the right-hand group (already used for the rewatch toggle) to visually separate "get recommendations" (a navigation/exploration action) from the record-mutating actions on the series itself.

## Design Decisions

- **Seasons/Episodes join Production Status's row, not the other way round.** Confirmed via reading `SeriesDetailFields.tsx`: the "Details" section currently renders two separate `.threeColRow` rows — one holding only `Production Status` (1 of 3 columns used), the next holding `Total Seasons` + `Total Episodes` (2 of 3 columns used). Merging the latter two fields into the former row fills it completely (3 of 3) and removes the now-redundant second row entirely. The conditional `Current Season`/`Current Episode` row (rendered only `while series.status !== COMPLETED`) is untouched — it's already its own complete-enough row and wasn't part of what the user flagged.
- **Persistent back-to-list access is a genuinely new UI pattern for this app.** Confirmed via grep (`position: sticky|position: fixed` across every `*.module.css`): nothing in this codebase uses `position: sticky` today, and the one `position: fixed` usage (`SeriesDetail.module.css`'s `.posterOverlay`, `z-index: 100`) is an unrelated full-screen modal backdrop, not a persistent-header pattern. The simplest fix reusing no new component: make the existing `.backButton` `position: sticky; top: 0` so it pins to the viewport once scrolled level with it, with `background: var(--bg)` (so scrolling content doesn't show through) and a low `z-index` (`10`, well below the poster overlay's `100`) so it never competes with any dialog. Confirmed via `App.module.css` that the app's top nav bar (`.nav`) is not itself sticky/fixed — it scrolls away normally, so there's no existing fixed header to coordinate offsets against; `top: 0` pins the button flush to the viewport's top edge once it would otherwise scroll out of view.
- **This is a CSS-only behavior Vitest/jsdom cannot verify** — jsdom does not run layout or honor `position: sticky` (it has no scrolling viewport to stick within), so the corresponding AC is `[MANUAL]`, verified by an actual browser scroll test, not a red/green Vitest cycle. This mirrors the project's own documented caveat that jsdom can't validate real CSS rendering (component styling, contrast, and — as here — positioning behavior all fall outside what Vitest can assert).
- **Recommendations moves into `.actionsRight`, unconditionally** — confirmed via reading `SeriesDetailActionsPanel.tsx`: `.actionsRow` already lays out `.actionsLeft`/`.actionsRight` with `justify-content: space-between`, and `.actionsRight` today only conditionally renders the rewatch toggle (`while series.status === COMPLETED`). This is a pure JSX relocation — no new CSS needed, the existing flex layout already supports it. Rendered before the rewatch toggle in JSX order, so on a `COMPLETED` series both appear right-aligned with Recommendations first (reading left-to-right within that group); on any other status, Recommendations is `.actionsRight`'s only content.
- **`data-testid="actions-left"`/`"actions-right"` added to the two group `div`s** — neither carries a testid today, and Requirement 3's regression guard (Recommendations must no longer be reachable via the left group) needs a reliable way to assert *which* group a button is in, not just that it exists somewhere in the panel. Mirrors `frontend_spec_078`'s `data-testid="heading-row"` addition for the same reason (a structural assertion needing a stable hook).

## Requirements

### Requirement 1: Total Seasons/Total Episodes join Production Status's row

**User Story**: As a user, I want the Details section's fields to fill each row fully, not leave an awkward mostly-empty row where Genres/Status used to sit.

#### FRONTEND-090-AC-01 [AUTO]: Production Status, Total Seasons, and Total Episodes render in one row
**Statement**: `SeriesDetailFields` shall render the "Production Status", "Total Seasons", and "Total Episodes" fields within the same three-column row.

**Rationale**: Fills the row Genres/Status vacated (`frontend_spec_078`) instead of leaving Production Status alone with Total Seasons/Episodes stranded in a separate, mostly-empty row below it.

**References**:
- Component: `components/SeriesDetailFields.tsx` (the "Details" section's first two `.threeColRow` `div`s, currently `Production Status` alone and `Total Seasons`/`Total Episodes` together — merges into one)
- CSS: `components/SeriesDetail.module.css`'s `.threeColRow` (`grid-template-columns: repeat(3, minmax(200px, 1fr))`) — unchanged, already supports a full 3-field row

**Test Case (Red)**:
```typescript
describe('FRONTEND-090-AC-01: Production Status, Total Seasons, Total Episodes share one row', () => {
  it('renders all three fields as siblings within the same row', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ productionStatus: 'RETURNING_SERIES', totalSeasons: 5, totalEpisodes: 100 }),
    )
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByRole('heading', { level: 2 })

    const prodStatusRow = screen.getByText('Production Status').closest('dl > div')
    const totalSeasonsRow = screen.getByText('Total Seasons').closest('dl > div')
    const totalEpisodesRow = screen.getByText('Total Episodes').closest('dl > div')

    expect(totalSeasonsRow).toBe(prodStatusRow)
    expect(totalEpisodesRow).toBe(prodStatusRow)
  })
})
```

**Test Case (Green)**: in `SeriesDetailFields.tsx`, move the `Total Seasons`/`Total Episodes` `field` divs out of their own `.threeColRow` and into the row currently holding only `Production Status`, then delete the now-empty row.

### Requirement 2: Persistent back-to-list access

**User Story**: As a user on a long series detail page, I want a way back to the list without scrolling all the way to the top.

#### FRONTEND-090-AC-02 [MANUAL]: Back-to-list control stays visible while scrolling
**Statement**: While the user has scrolled down a `SeriesDetail` page, the "Back to series list" control shall remain visible without requiring the user to scroll back to the top.

**Rationale**: The explicit request — today the button renders once, at the very top of `.container`, with no way back into view once scrolled past.

**Verification**: Manual check in browser — open a series with enough fields to make the page taller than the viewport (e.g. one with keywords, streaming results, and personal notes populated), scroll to the bottom, and confirm the back button is still visible on screen without scrolling up. Not automatable: jsdom (Vitest's test environment) does not run layout or provide a scrollable viewport, so `position: sticky` has no observable effect in a component test — this is a real gap the project's own steering notes already call out (Vitest/jsdom can't validate real CSS rendering).

**References**:
- Component: `components/SeriesDetail.tsx` (`backButton`, currently rendered once at the top of `.container`)
- CSS: `components/SeriesDetail.module.css`'s `.backButton` (`margin-bottom: 1.5rem`, no `position`)

**Test Case (Green)**: add `position: sticky; top: 0; z-index: 10; background: var(--bg);` to `.backButton` (or a thin wrapper around it, if padding/margin interactions make styling the button itself directly awkward) in `SeriesDetail.module.css`. No JSX/component-logic change — the same single `backButton` element, just pinned via CSS once it would otherwise scroll out of view.

### Requirement 3: Recommendations CTA moves to the right-hand action group

**User Story**: As a user, I want "Recommendations" visually separated from Edit/Delete/Refresh, since it's a different kind of action (exploring/navigating away) from mutating the series record itself.

#### FRONTEND-090-AC-03 [AUTO]: Recommendations renders in the right-hand actions group
**Statement**: `SeriesDetailActionsPanel` shall render the Recommendations button within the right-hand actions group.

**Rationale**: The explicit reposition request — separates a navigation action from the record-mutating actions (Edit/Delete/Refresh).

**References**:
- Component: `components/SeriesDetailActionsPanel.tsx` (`.actionsLeft`/`.actionsRight` divs inside `.actionsRow`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-090-AC-03: Recommendations renders in the right-hand actions group', () => {
  it('places the Recommendations button inside actions-right', async () => {
    mockGetById.mockResolvedValue(makeSeries({ excludeFromRecommendations: false }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    const recommendationsButton = await screen.findByTestId('recommendations-btn')

    expect(recommendationsButton.closest('[data-testid="actions-right"]')).not.toBeNull()
  })
})
```

**Test Case (Green)**: add `data-testid="actions-left"`/`data-testid="actions-right"` to the two group `div`s, move the Recommendations `<button>` from the `.actionsLeft` block into `.actionsRight`, rendered before the conditional rewatch-toggle button.

#### FRONTEND-090-AC-04 [AUTO]: Recommendations no longer renders in the left-hand actions group
**Statement**: `SeriesDetailActionsPanel` shall no longer render the Recommendations button within the left-hand actions group.

**Rationale**: It moved, not duplicated — regression guard against leaving a stale second copy behind (the same guard shape as `frontend_spec_078`'s AC-08/AC-10 for Genres/Status).

**Test Case (Red)**:
```typescript
describe('FRONTEND-090-AC-04: Recommendations no longer renders in actions-left', () => {
  it('does not place the Recommendations button inside actions-left', async () => {
    mockGetById.mockResolvedValue(makeSeries({ excludeFromRecommendations: false }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    const recommendationsButton = await screen.findByTestId('recommendations-btn')

    expect(recommendationsButton.closest('[data-testid="actions-left"]')).toBeNull()
  })
})
```

**Test Case (Green)**: covered by the same move as AC-03 — Recommendations exists in exactly one place, `.actionsRight`.

## Cross-References

| Concept | Location |
|---|---|
| `.threeColRow`'s "empty third track" convention, and why Genres/Status left this gap | `components/SeriesDetail.module.css` (`.threeColRow` comment); `frontend_spec_078_series_detail_poster_lightbox_and_genres.md` |
| `.actionsRow`'s existing `justify-content: space-between` / `.actionsLeft`/`.actionsRight` split | `components/SeriesDetail.module.css` (`.actionsRow`, `.actionsLeft`, `.actionsRight`) |
| Prior structural-assertion `data-testid` addition for the same reason (moved content needing a position check) | `frontend_spec_078_series_detail_poster_lightbox_and_genres.md` (`data-testid="heading-row"`) |
| jsdom/CSS rendering limitation | Root `CLAUDE.md` ("Frontend: Vitest/jsdom can't validate real CSS rendering") |

## Acceptance Criteria Summary

- [x] FRONTEND-090-AC-01: Production Status, Total Seasons, and Total Episodes render in one row
- [x] FRONTEND-090-AC-02: Back-to-list control stays visible while scrolling
- [x] FRONTEND-090-AC-03: Recommendations renders in the right-hand actions group
- [x] FRONTEND-090-AC-04: Recommendations no longer renders in the left-hand actions group
