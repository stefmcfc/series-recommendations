# Frontend Spec 078: Series Detail Poster Lightbox, Genres Reposition & Status in Heading

**Status**: Not started
**Priority**: P3
**Depends on**: none
**Area**: Frontend (`components/SeriesDetail.tsx`, `components/SeriesDetailFields.tsx`, `components/SeriesDetail.module.css`)

## Overview

Three small, unrelated `SeriesDetail` polish items, bundled into one spec since all three touch the same two files. First: clicking the series poster currently does nothing — this adds a full-size lightbox overlay with a close icon and click-image-to-close, following this codebase's existing hand-rolled dialog convention (Escape-to-dismiss, no focus trap — see `SeriesRecommendationsModal`/`SearchFilter`'s "Browse Keywords" modal). Second: the `Genres` field already renders today, but buried inside the "Details" section's grid, several fields below where a user would expect it — this moves it to its own standalone field between "Check Streaming Availability" and "Keywords", both near the top of the page. Third: the series' Status (`WATCHING`/`COMPLETED`/`BACKLOG`/`DROPPED`) also currently sits buried in that same Details grid — this moves it up to the heading row, right-aligned alongside the title/year/country.

## Design Decisions

- **Poster lightbox reuses the existing dialog convention**, not a new pattern: an `overlay` div wrapping a `role="dialog"` element, `Escape` closes it via `onKeyDown` on the dialog root (matching `SeriesRecommendationsModal`/`SearchFilter`'s "Browse Keywords" modal), no focus trap, no `<dialog>` element (same jsdom/lifecycle-complexity rationale documented in those two components).
- **Both close affordances are real, independent `<button>` elements** — the close icon button, and the enlarged poster image itself wrapped in its own `<button type="button" aria-label="Close enlarged poster">`. This mirrors `SeriesCompactGrid`/`SeriesPosterGrid`'s existing pattern of wrapping a clickable image in a real `<button>` with a descriptive `aria-label` rather than attaching a click handler to a bare `<img>` (which `jsx-a11y` would flag, and which isn't keyboard-operable).
- **The poster thumbnail itself becomes a `<button>`** too (currently a bare `<img>`), so it's keyboard-operable (Enter/Space opens the lightbox) — `aria-label="View larger poster of {title}"`.
- **The lightbox trigger only renders when a poster is actually showing** — reuses the exact same `series.posterUrl !== null && !posterError` condition the thumbnail `<img>` already renders under, so there's never a lightbox trigger with nothing to enlarge.
- **Genres moves out of the "Details" section's 3-column grid entirely** — that row currently holds Genres/Production Status/Status. Removing Genres (this spec) and Status (Requirement 3, also this spec) leaves Production Status alone in a row that still has 3 tracks, which the existing `.threeColRow` CSS already supports (its own code comment: "a 2-field row simply leaves the third track's cell empty" — a 1-field row leaves the same two tracks empty, no CSS change needed for that row).
- **Genres becomes its own standalone `dl`/field block**, structurally identical to how `Keywords` is already rendered (a `fieldGroup` > `fieldRow` > single `field`), inserted between the `streamingCheck` block and the `Keywords` block in `SeriesDetailFields.tsx`.
- **Status moves into `SeriesDetail.tsx`'s `headingRow`, not `SeriesDetailFields.tsx`** — it's leaving the fields block entirely, joining the title/year/country group that already lives in `SeriesDetail.tsx` itself. Rendered as plain text (matching `SeriesList`'s own `.status` treatment — plain colored text, no pill/badge styling — this app has no existing status-badge convention to match, and none is being introduced here).
- **Right-alignment via `justify-content: space-between` on `headingRow`**, with the existing title/country group wrapped in a new inner container (`headingLeft`) so the flex row has exactly two items — the title/country group, and the status text — pushed to opposite ends. No change to the title/country group's own internal layout.

## Requirements

### Requirement 1: Poster lightbox

**User Story**: As a user, I want to click a series' poster to see it larger, and easily dismiss that view.

#### FRONTEND-078-AC-01 [AUTO]: Clicking the poster opens the lightbox
**Statement**: When the poster thumbnail button is clicked, `SeriesDetail` shall render a full-size overlay showing the poster image.

**Rationale**: Core feature request — no way to see the poster larger today.

**References**:
- Component: `components/SeriesDetail.tsx` (poster `<img>` at line ~310-317, becomes a `<button>` wrapping the `<img>`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-078-AC-01: clicking the poster opens the lightbox', () => {
  it('opens a full-size poster overlay on click', async () => {
    mockGetById.mockResolvedValue(makeSeries({ posterUrl: 'https://example.com/poster.jpg' }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByRole('heading', { level: 2 })

    await userEvent.click(screen.getByRole('button', { name: /view larger poster/i }))

    expect(screen.getByRole('dialog', { name: /poster/i })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: wrap the poster `<img>` in a `<button aria-label="View larger poster of {title}">`, add `posterLightboxOpen` state, render the overlay when true.

#### FRONTEND-078-AC-02 [AUTO]: Lightbox has a visible close icon
**Statement**: The poster overlay shall render a close icon button labelled "Close".

**Rationale**: Explicit, obvious way out, matching every other modal in this codebase.

**References**:
- Component: `SeriesRecommendationsModal.tsx`'s "Done" button (same actions-row convention)

**Test Case (Red)**:
```typescript
describe('FRONTEND-078-AC-02: lightbox has a close button', () => {
  it('renders a Close button inside the overlay', async () => {
    mockGetById.mockResolvedValue(makeSeries({ posterUrl: 'https://example.com/poster.jpg' }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: /view larger poster/i }))

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: render a `<button aria-label="Close">` (icon, e.g. an `×` SVG) inside the overlay's dialog.

#### FRONTEND-078-AC-03 [AUTO]: Close icon dismisses the lightbox
**Statement**: When the close icon button is clicked, `SeriesDetail` shall dismiss the poster overlay.

**Rationale**: The close icon must actually work.

**Test Case (Red)**:
```typescript
describe('FRONTEND-078-AC-03: close icon dismisses the lightbox', () => {
  it('closes the overlay when Close is clicked', async () => {
    mockGetById.mockResolvedValue(makeSeries({ posterUrl: 'https://example.com/poster.jpg' }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: /view larger poster/i }))

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog', { name: /poster/i })).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: `onClick={() => setPosterLightboxOpen(false)}` on the close button.

#### FRONTEND-078-AC-04 [AUTO]: Clicking the enlarged image also dismisses the lightbox
**Statement**: When the enlarged poster image within the overlay is clicked, `SeriesDetail` shall dismiss the poster overlay.

**Rationale**: Explicitly requested — clicking the big image itself should also return to the detail page, not just the close icon.

**Test Case (Red)**:
```typescript
describe('FRONTEND-078-AC-04: clicking the enlarged image dismisses the lightbox', () => {
  it('closes the overlay when the enlarged poster is clicked', async () => {
    mockGetById.mockResolvedValue(makeSeries({ posterUrl: 'https://example.com/poster.jpg' }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: /view larger poster/i }))

    await userEvent.click(screen.getByRole('button', { name: /close enlarged poster/i }))

    expect(screen.queryByRole('dialog', { name: /poster/i })).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: wrap the enlarged `<img>` in `<button type="button" aria-label="Close enlarged poster" onClick={() => setPosterLightboxOpen(false)}>`.

#### FRONTEND-078-AC-05 [AUTO]: Escape dismisses the lightbox
**Statement**: When Escape is pressed while the poster overlay is open, `SeriesDetail` shall dismiss the poster overlay.

**Rationale**: Matches the Escape-to-close convention every other dialog in this codebase already follows.

**Test Case (Red)**:
```typescript
describe('FRONTEND-078-AC-05: Escape dismisses the lightbox', () => {
  it('closes the overlay on Escape', async () => {
    mockGetById.mockResolvedValue(makeSeries({ posterUrl: 'https://example.com/poster.jpg' }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: /view larger poster/i }))

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: /poster/i })).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: `onKeyDown` on the dialog root, same `if (event.key === 'Escape') setPosterLightboxOpen(false)` pattern as `SeriesRecommendationsModal.handleModalKeyDown`.

#### FRONTEND-078-AC-06 [AUTO]: No lightbox trigger when there's no poster to enlarge
**Statement**: Where `series.posterUrl` is `null` or the thumbnail failed to load, `SeriesDetail` shall not render a poster lightbox trigger button.

**Rationale**: Nothing to enlarge — avoids a dead/confusing control.

**Test Case (Red)**:
```typescript
describe('FRONTEND-078-AC-06: no lightbox trigger without a poster', () => {
  it('does not render a poster button when posterUrl is null', async () => {
    mockGetById.mockResolvedValue(makeSeries({ posterUrl: null }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByRole('heading', { level: 2 })

    expect(screen.queryByRole('button', { name: /view larger poster/i })).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: gate the `<button>` wrapper behind the same `series.posterUrl !== null && !posterError` condition the thumbnail already uses.

### Requirement 2: Genres repositioned

**User Story**: As a user, I want to see a series' genres near the top of the detail page, close to the other at-a-glance context, not buried in the Details grid.

#### FRONTEND-078-AC-07 [AUTO]: Genres renders between streaming availability and Keywords
**Statement**: `SeriesDetailFields` shall render a standalone "Genres" field between the "Check Streaming Availability" block and the "Keywords" field.

**Rationale**: The explicit reposition request.

**References**:
- Component: `components/SeriesDetailFields.tsx` (`streamingCheck` div at lines 67-86, `Keywords` `dl` at lines 88-103)

**Test Case (Red)**:
```typescript
describe('FRONTEND-078-AC-07: Genres renders between streaming availability and Keywords', () => {
  it('places Genres after the streaming button and before Keywords in document order', async () => {
    mockGetById.mockResolvedValue(makeSeries({ genres: 'Drama, Crime' }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByRole('heading', { level: 2 })

    const streamingButton = screen.getByRole('button', { name: /check streaming availability/i })
    const genresTerm = screen.getByText('Genres')
    const keywordsTerm = screen.getByText('Keywords')

    expect(
      streamingButton.compareDocumentPosition(genresTerm) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      genresTerm.compareDocumentPosition(keywordsTerm) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
```

**Test Case (Green)**: move the `Genres` `<dt>`/`<dd>` pair out of the Details `threeColRow` into its own `dl.fieldGroup > fieldRow > field`, inserted between the `streamingCheck` div and the `Keywords` `dl`.

#### FRONTEND-078-AC-08 [AUTO]: Genres no longer appears in the Details grid
**Statement**: The "Details" section's field grid shall no longer include a Genres field.

**Rationale**: It moved, not duplicated — regression guard against leaving a stale second copy behind.

**Test Case (Red)**:
```typescript
describe('FRONTEND-078-AC-08: Genres removed from the Details grid', () => {
  it('renders Genres exactly once', async () => {
    mockGetById.mockResolvedValue(makeSeries({ genres: 'Drama, Crime' }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByRole('heading', { level: 2 })

    expect(screen.getAllByText('Genres')).toHaveLength(1)
  })
})
```

**Test Case (Green)**: delete the old `Genres` `field` div from the Details `threeColRow` (leaving Production Status and, until Requirement 3 also removes it, Status as that row's remaining fields).

### Requirement 3: Status moved to the heading row

**User Story**: As a user, I want to see a series' watch status at a glance alongside its title, not buried in the Details grid.

#### FRONTEND-078-AC-09 [AUTO]: Status renders in the heading row
**Statement**: `SeriesDetail` shall render the series' `status` value in the heading row, alongside the title/year/country group.

**Rationale**: The explicit reposition request — status is at-a-glance context, same as title and year.

**References**:
- Component: `components/SeriesDetail.tsx` (`headingRow` div, currently title `<h2>` + `country` span)

**Test Case (Red)**:
```typescript
describe('FRONTEND-078-AC-09: Status renders in the heading row', () => {
  it('renders the series status inside the heading row', async () => {
    mockGetById.mockResolvedValue(makeSeries({ status: SeriesStatus.WATCHING }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    const heading = await screen.findByRole('heading', { level: 2 })

    const headingRow = heading.closest('[data-testid="heading-row"]')
    expect(headingRow).not.toBeNull()
    expect(within(headingRow as HTMLElement).getByText('WATCHING')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `data-testid="heading-row"` to the existing `headingRow` div, wrap the title `<h2>` + `country` span in a new `headingLeft` div, and render `<span className={styles.statusHeading}>{series.status}</span>` as `headingRow`'s second child. CSS: `.headingRow { justify-content: space-between; }`.

#### FRONTEND-078-AC-10 [AUTO]: Status no longer appears in the Details grid
**Statement**: The "Details" section's field grid shall no longer include a Status field.

**Rationale**: It moved, not duplicated — regression guard against leaving a stale second copy behind.

**Test Case (Red)**:
```typescript
describe('FRONTEND-078-AC-10: Status removed from the Details grid', () => {
  it('renders the status value exactly once', async () => {
    mockGetById.mockResolvedValue(makeSeries({ status: SeriesStatus.WATCHING }))
    render(<SeriesDetail id="abc-123" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByRole('heading', { level: 2 })

    expect(screen.getAllByText('WATCHING')).toHaveLength(1)
  })
})
```

**Test Case (Green)**: delete the old `Status` `field` div from the Details `threeColRow` (leaving Production Status as that row's only field).

## Cross-References

| Concept | Location |
|---|---|
| Existing hand-rolled dialog convention (overlay + role="dialog" + Escape, no focus trap) | `components/SeriesRecommendationsModal.tsx`, `components/SearchFilter.tsx` ("Browse Keywords" modal) |
| Button-wrapping-image pattern for clickable images | `components/SeriesCompactGrid.tsx`, `components/SeriesPosterGrid.tsx` (`frontend_spec_054`) |
| `.threeColRow`'s "empty third track" convention | `components/SeriesDetail.module.css` (`.threeColRow` comment) |
| Plain-text (non-badge) status convention | `components/SeriesList.module.css` (`.status`) |

## Acceptance Criteria Summary

- [ ] FRONTEND-078-AC-01: Clicking the poster opens the lightbox
- [ ] FRONTEND-078-AC-02: Lightbox has a visible close icon
- [ ] FRONTEND-078-AC-03: Close icon dismisses the lightbox
- [ ] FRONTEND-078-AC-04: Clicking the enlarged image also dismisses the lightbox
- [ ] FRONTEND-078-AC-05: Escape dismisses the lightbox
- [ ] FRONTEND-078-AC-06: No lightbox trigger when there's no poster to enlarge
- [ ] FRONTEND-078-AC-07: Genres renders between streaming availability and Keywords
- [ ] FRONTEND-078-AC-08: Genres no longer appears in the Details grid
- [ ] FRONTEND-078-AC-09: Status renders in the heading row
- [ ] FRONTEND-078-AC-10: Status no longer appears in the Details grid
