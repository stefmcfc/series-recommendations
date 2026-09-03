# Frontend Spec 075: My Series Filter Sheet Grouped Into Sections

**Status**: Implemented — `components/SearchFilter.tsx`, `components/SearchFilter.module.css`, `components/SearchFilter.test.tsx`
**Priority**: P3
**Depends on**: Frontend Spec 073 (`frontend_spec_073_my_series_live_title_filter.md`, removes Title from the sheet) ✅ required, Frontend Spec 074 (`frontend_spec_074_my_series_rewatch_tab.md`, removes the rewatch checkbox from the sheet) ✅ required
**Area**: Frontend (`components/SearchFilter.tsx`, `components/SearchFilter.module.css`)

## Overview

Once Title (`frontend_spec_073`) and "Flagged for rewatch" (`frontend_spec_074`) move out of the sheet, six fields remain: Genres, Keywords, Min Personal Rating, Min IMDb Rating, Min TMDB Rating, Min Year, Max Year. Even reduced, they still read as one flat, undifferentiated list. This spec groups them into three visually-divided sections with headings: **Genres & Keywords**, **Ratings**, **Years**.

This is a pure layout/grouping change — no field is added, removed, or altered in behavior. Sequenced after `073`/`074` so the sections are designed against the final field set, not redone once fields are later removed from around them.

## Design Decisions

- **Three sections, in this order**: "Genres & Keywords" (the `GenreIncludeExcludePicker` and `KeywordPicker` fields), "Ratings" (Min Personal Rating, Min IMDb Rating, Min TMDB Rating), "Years" (Min Year, Max Year) — matching the order the fields already appear in today.
- **Each section gets an `<h3>` heading and a divider line** (a top border on every section after the first, or an explicit `<hr>` — implementation's choice, consistent with how dividers are styled elsewhere in this app if a precedent exists) separating it from the one before.
- **No change to field behavior, validation, or the `FormState`/`buildCriteria` shape** — this spec only wraps existing JSX in new sectioning containers.
- **Search/Clear Filters actions stay outside and below all three sections**, unchanged in position relative to the sheet as a whole.

## Requirements

### Requirement 1: fields render inside three labelled, divided sections

**User Story**: As a user, I want the filter sheet's fields grouped by what they're for, so I can scan to the one I need instead of reading a flat list.

#### FRONTEND-075-AC-01 [AUTO]: "Genres & Keywords" section
**Statement**: The sheet shall render a section headed "Genres & Keywords" containing the Genres (`GenreIncludeExcludePicker`) and Keywords (`KeywordPicker` + "Browse all keywords") fields, and nothing else.

**Rationale**: Groups the two selection-based fields together.

**References**:
- Component: `components/SearchFilter.tsx` (Genres field, Keywords field)

**Test Case (Red)**:
```typescript
describe('FRONTEND-075-AC-01: Genres & Keywords section', () => {
  it('groups Genres and Keywords under one heading', () => {
    render(<SearchFilter isOpen={true} onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)

    const heading = screen.getByRole('heading', { name: 'Genres & Keywords' })
    const section = heading.closest('section') ?? heading.parentElement!
    expect(within(section).getByRole('button', { name: /Include \/ Exclude Genres/i })).toBeInTheDocument()
    expect(within(section).getByLabelText(/keywords/i)).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: wrap the Genres and Keywords field `div`s in a new `<section>`/`<div className={styles.filterSection}>` with an `<h3>Genres & Keywords</h3>` heading.

#### FRONTEND-075-AC-02 [AUTO]: "Ratings" section
**Statement**: The sheet shall render a section headed "Ratings" containing Min Personal Rating, Min IMDb Rating, and Min TMDB Rating, and nothing else.

**Rationale**: Groups the three rating fields together.

**References**:
- Component: `components/SearchFilter.tsx` (Min Personal/IMDb/TMDB Rating fields)

**Test Case (Red)**:
```typescript
describe('FRONTEND-075-AC-02: Ratings section', () => {
  it('groups the three rating fields under one heading', () => {
    render(<SearchFilter isOpen={true} onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)

    const heading = screen.getByRole('heading', { name: 'Ratings' })
    const section = heading.closest('section') ?? heading.parentElement!
    expect(within(section).getByText('Min Personal Rating')).toBeInTheDocument()
    expect(within(section).getByLabelText(/min imdb rating/i)).toBeInTheDocument()
    expect(within(section).getByLabelText(/min tmdb rating/i)).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: wrap the three rating field `div`s in a new sectioning container with an `<h3>Ratings</h3>` heading.

#### FRONTEND-075-AC-03 [AUTO]: "Years" section
**Statement**: The sheet shall render a section headed "Years" containing Min Year and Max Year, and nothing else.

**Rationale**: Groups the two year fields together.

**References**:
- Component: `components/SearchFilter.tsx` (Min Year/Max Year fields)

**Test Case (Red)**:
```typescript
describe('FRONTEND-075-AC-03: Years section', () => {
  it('groups Min Year and Max Year under one heading', () => {
    render(<SearchFilter isOpen={true} onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)

    const heading = screen.getByRole('heading', { name: 'Years' })
    const section = heading.closest('section') ?? heading.parentElement!
    expect(within(section).getByLabelText(/min year/i)).toBeInTheDocument()
    expect(within(section).getByLabelText(/max year/i)).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: wrap the two year field `div`s in a new sectioning container with an `<h3>Years</h3>` heading.

#### FRONTEND-075-AC-04 [AUTO]: sections other than the first are visually divided
**Statement**: The "Ratings" and "Years" sections shall each render with a divider (e.g. a top border) separating them from the section before, while "Genres & Keywords" (the first section) shall not.

**Rationale**: A leading divider above the very first section would be a stray line with nothing to separate.

**References**:
- Stylesheet: `components/SearchFilter.module.css`

**Test Case (Red)**:
```typescript
describe('FRONTEND-075-AC-04: dividers between sections', () => {
  it('applies a divider class to sections after the first', () => {
    render(<SearchFilter isOpen={true} onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)

    const ratingsSection = screen.getByRole('heading', { name: 'Ratings' }).closest('section')!
    const genresSection = screen.getByRole('heading', { name: 'Genres & Keywords' }).closest('section')!
    expect(ratingsSection.className).toMatch(/sectionDivider/)
    expect(genresSection.className).not.toMatch(/sectionDivider/)
  })
})
```

**Test Case (Green)**: apply a `styles.sectionDivider` class (top border) to the "Ratings" and "Years" section containers, omitted on "Genres & Keywords".

#### FRONTEND-075-AC-05 [AUTO]: no change to field behavior
**Statement**: Submitting the form after this reorganization shall build the identical `SearchCriteria` shape it did before, for the same field values.

**Rationale**: Regression guard — this spec is layout-only.

**References**:
- Function: `components/SearchFilter.tsx`, `buildCriteria` (unchanged)

**Test Case (Red)**:
```typescript
describe('FRONTEND-075-AC-05: no change to field behavior', () => {
  it('still builds the same criteria shape after sectioning', () => {
    const onSearch = vi.fn()
    render(<SearchFilter isOpen={true} onClose={vi.fn()} onSearch={onSearch} onClear={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/min imdb rating/i), { target: { value: '7.5' } })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ minImdbRating: 7.5 }))
  })
})
```

**Test Case (Green)**: no changes needed beyond the JSX restructuring already covered by AC-01 through AC-04.

## Cross-References

| Concept | Location |
|---|---|
| Fields regrouped (post-removal) | `frontend_spec_073` (Title removed), `frontend_spec_074` (rewatch checkbox removed) |
| Sheet this reorganizes | `frontend_spec_071_my_series_filter_sheet.md` |

## Acceptance Criteria Summary

- [x] FRONTEND-075-AC-01: "Genres & Keywords" section
- [x] FRONTEND-075-AC-02: "Ratings" section
- [x] FRONTEND-075-AC-03: "Years" section
- [x] FRONTEND-075-AC-04: sections other than the first are visually divided
- [x] FRONTEND-075-AC-05: no change to field behavior
