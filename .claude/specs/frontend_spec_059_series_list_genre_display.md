# Frontend Spec 059: Show Genres on `SeriesList`'s Expanded Row View

**Status**: Not started
**Priority**: P3 (small display addition, bundled into the `feature/search-filter-overhaul` branch
alongside `frontend_spec_055`'s amendments per direct instruction)
**Depends on**: Frontend Spec 002 (`frontend_spec_002.md`, owns `SeriesList.tsx`) ✅
**No backend spec or backend change is required.** `Series.genres` (`string | null`,
comma-separated) is already returned by `GET /api/v1/series` — this is a pure display addition.
**Area**: Frontend (`components/SeriesList.tsx`)

## Overview

Confirmed (2026-08-29): `SeriesList.tsx`'s expanded row view (`.rowSecondaryLeft`) shows only
`s.status` (plus the conditional New Content badge) — genres aren't displayed anywhere in the row
today (only in `SeriesDetail`). This spec adds them, positioned **before** the status text, per
direct instruction.

## Design Decisions

- **Rendered as plain text, not a chip/pill list** — `s.genres` is already a comma-separated
  string on the wire; splitting it into individual chips would be a bigger, unrequested UI change.
  This spec just displays the existing string as-is, matching the minimal scope asked for.
- **Omitted entirely when `s.genres` is `null` or blank** — no empty placeholder text, mirroring
  how the New Content badge is already conditionally rendered only when relevant.
- **Positioned first in `.rowSecondaryLeft`, before the existing status `<span>`** — per direct
  instruction ("before series status").

---

## Requirement 1: Genres in the expanded row

### FRONTEND-059-AC-01 [AUTO]
**Statement**: `SeriesList`'s `.rowSecondaryLeft` block shall render `s.genres` as a
`<span className={styles.genres}>` immediately before the existing status `<span>`, only when
`s.genres` is non-null and non-blank.

**References**: `SeriesList.tsx`'s existing `.rowSecondaryLeft` block (status text, New Content
badge).

**Test Case (Red)**:
```typescript
describe('FRONTEND-059-AC-01: genres shown before status', () => {
  it('renders genres before the status text when present', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ genres: 'Drama, Crime', status: 'WATCHING' })])
    render(<SeriesList {...defaultProps} />)

    const row = await screen.findByTestId('series-row')
    expect(within(row).getByText('Drama, Crime')).toBeInTheDocument()

    const rowSecondaryLeft = within(row).getByText('Drama, Crime').parentElement
    const children = Array.from(rowSecondaryLeft!.children).map((el) => el.textContent)
    expect(children.indexOf('Drama, Crime')).toBeLessThan(children.indexOf('WATCHING'))
  })

  it('renders nothing extra when genres is null', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ genres: null, status: 'WATCHING' })])
    render(<SeriesList {...defaultProps} />)
    const row = await screen.findByTestId('series-row')
    expect(within(row).getByText('WATCHING')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add `{s.genres != null && s.genres.trim() !== '' && (<span
className={styles.genres}>{s.genres}</span>)}` before the existing `<span
className={styles.status}>` in `.rowSecondaryLeft`, plus a `.genres` rule in
`SeriesList.module.css` (matching the existing `.status` text's styling weight/color, not a badge —
this is plain metadata text, not a status indicator).

---

## Cross-References

| This spec | Source |
|---|---|
| `Series.genres`, already returned by `GET /api/v1/series` | `series_spec_001_entity.md` |
| `.rowSecondaryLeft`, the block this spec adds to | `frontend_spec_002.md` |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-059-AC-01: genres render before status text when present, nothing extra when absent
