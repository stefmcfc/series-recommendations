# Frontend Spec 118: Missing-Ratings Filter Section

**Status**: Implemented
**Priority**: P3 (UX cleanup — no new capability, purely a visual regrouping)
**Depends on**: `frontend_spec_116_missing_ratings_filter_ui.md` (introduced the four checkboxes into the existing "Ratings" section; this spec relocates them), `frontend_spec_075_my_series_filter_sections.md` (established the section/heading/`surface.card` pattern this spec's new section follows), `frontend_spec_105_my_series_card_styling_and_modernization.md` (each filter section individually carded, no divider class — the pattern the new section must also follow)
**Area**: Frontend (`components/SearchFilter.tsx`, `components/SearchFilter.test.tsx`)

## Overview

`SearchFilter.tsx`'s "Ratings" section currently holds seven controls: three range/star fields (Min Personal Rating, Min IMDb Rating, Min TMDB Rating) followed by four missing-rating checkboxes (Missing IMDb Rating, Missing TMDB Rating, Missing Rotten Tomatoes Rating, Missing Rotten Tomatoes Popcornmeter), the latter added by `frontend_spec_116`. The user wants the four checkboxes visually separated into their own section, since they're a conceptually different kind of filter (presence/absence of a rating, not a rating threshold) from the three fields above them.

This is a pure JSX reorganization: a new `<section>` titled "Missing Ratings" is added immediately after the existing "Ratings" section (before "Years"), and the four checkbox blocks move into it unchanged — same ids, same `form` state keys, same `updateMissingRatingField` handler, same Clear/Search/saved-profile behavior. No new fields, no criteria/API/type changes.

## Design Decisions

- **New section placed directly after "Ratings", before "Years"** — keeps the "Ratings" and "Missing Ratings" sections adjacent, since they operate on the same underlying rating fields (IMDb/TMDB/Rotten Tomatoes) just in a different mode (threshold vs. presence).
- **Section follows the exact existing pattern**: `<section className={`${styles.filterSection} ${surface.card}`}><h3 className={styles.filterSectionHeading}>Missing Ratings</h3>...</section>`, matching every other section in this file (`frontend_spec_075`/`frontend_spec_105`). No new CSS classes needed.
- **Checkbox markup itself is untouched** — the four `<div className={styles.checkboxField}>` blocks (ids, labels, `checked`, `onChange`) move as-is. This is a cut/paste of existing JSX into a new wrapper, not a rewrite.
- **Correction found while grounding this spec against the real test file, not part of the original ask**: `SearchFilter.test.tsx` line 914 (`FRONTEND-105-AC-15/16` describe block) queries `screen.getByRole('heading', { name: /ratings/i })` — a case-insensitive *substring* match. Once a second heading containing the substring "ratings" ("Missing Ratings") exists, this query matches two headings and `getByRole` throws (it requires exactly one match). This spec must change that one query to an exact match, `{ name: 'Ratings' }`, consistent with how the same heading is already queried exactly elsewhere in the same file (line 873, `FRONTEND-075-AC-02`). No other existing query in the file uses a substring match against "ratings", so this is the only pre-existing test requiring a fix.
- **`FRONTEND-116-AC-03`'s existing describe-block title** ("renders all four checkboxes in the Ratings section") becomes inaccurate once the checkboxes move, but its assertions don't check section placement — only checked/unchecked state and submitted criteria — so it needs no behavioral change, just the title updated for accuracy (cosmetic, not a numbered AC here).
- **No change to `SearchFilterCriteria`, `SearchFilter`'s props, or any backend contract** — this spec is scoped entirely to `SearchFilter.tsx`'s internal JSX layout.

---

## Requirement 1: Missing-rating checkboxes live in their own section

**User story**: As a user filtering My Series, I want the four "missing rating" checkboxes grouped under their own heading, separate from the rating-threshold fields above them, so the two different kinds of rating filter are visually distinct.

### FRONTEND-118-AC-01 [AUTO]
**Statement**: `SearchFilter` shall render a new section with heading text "Missing Ratings", positioned after the "Ratings" section and before the "Years" section.

**References**: `components/SearchFilter.tsx` lines ~353-447 (current "Ratings" section) and ~449 (start of "Years" section).

**Test Case (Red)**:
```typescript
describe('FRONTEND-118-AC-01: Missing Ratings section exists and is positioned correctly', () => {
  it('renders a "Missing Ratings" heading between "Ratings" and "Years"', () => {
    renderFilter()
    const headings = screen.getAllByRole('heading').map((h) => h.textContent)
    const ratingsIndex = headings.indexOf('Ratings')
    const missingRatingsIndex = headings.indexOf('Missing Ratings')
    const yearsIndex = headings.indexOf('Years')
    expect(missingRatingsIndex).toBeGreaterThan(ratingsIndex)
    expect(missingRatingsIndex).toBeLessThan(yearsIndex)
  })
})
```
**Test Case (Green)**: add the new `<section>` with its heading, positioned between the two existing sections, until the spec above passes.

---

### FRONTEND-118-AC-02 [AUTO]
**Statement**: The "Missing Ratings" section shall contain all four missing-rating checkboxes (Missing IMDb Rating, Missing TMDB Rating, Missing Rotten Tomatoes Rating, Missing Rotten Tomatoes Popcornmeter), and the "Ratings" section shall no longer contain them.

**References**: `updateMissingRatingField` handler and the four `styles.checkboxField` blocks (current lines ~396-446).

**Test Case (Red)**:
```typescript
describe('FRONTEND-118-AC-02: checkboxes live in Missing Ratings, not Ratings', () => {
  it('groups all four missing-rating checkboxes under the new heading', () => {
    renderFilter()
    const heading = screen.getByRole('heading', { name: 'Missing Ratings' })
    const section = heading.closest('section')!
    expect(within(section).getByLabelText('Missing IMDb Rating')).toBeInTheDocument()
    expect(within(section).getByLabelText('Missing TMDB Rating')).toBeInTheDocument()
    expect(
      within(section).getByLabelText('Missing Rotten Tomatoes Rating'),
    ).toBeInTheDocument()
    expect(
      within(section).getByLabelText('Missing Rotten Tomatoes Popcornmeter'),
    ).toBeInTheDocument()
  })

  it('no longer renders the missing-rating checkboxes inside the Ratings section', () => {
    renderFilter()
    const ratingsHeading = screen.getByRole('heading', { name: 'Ratings' })
    const ratingsSection = ratingsHeading.closest('section')!
    expect(
      within(ratingsSection).queryByLabelText('Missing IMDb Rating'),
    ).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: move the four checkbox blocks into the new section until the spec above passes.

---

### FRONTEND-118-AC-03 [AUTO]
**Statement**: The "Missing Ratings" section shall be individually carded (`surface.card`) with no divider class, matching every other filter section (`frontend_spec_105`).

**References**: `FRONTEND-105-AC-15/16` (existing pattern), `components/SearchFilter.test.tsx` line ~903.

**Test Case (Red)**:
```typescript
describe('FRONTEND-118-AC-03: Missing Ratings section is individually carded', () => {
  it('composes surface.card and has no sectionDivider class', () => {
    renderFilter()
    const section = screen
      .getByRole('heading', { name: 'Missing Ratings' })
      .closest('section')!
    expect(section.className).toContain(surface.card)
    expect(section.className).not.toMatch(/sectionDivider/)
  })
})
```
**Test Case (Green)**: apply `${styles.filterSection} ${surface.card}` to the new section's className, matching every other section in the file.

---

### FRONTEND-118-AC-04 [AUTO] (regression fix, pre-existing test)
**Statement**: `SearchFilter.test.tsx`'s `FRONTEND-105-AC-15/16` describe block shall query the "Ratings" heading by exact name (`{ name: 'Ratings' }`), not the ambiguous substring regex `/ratings/i`, so it continues to resolve to exactly one heading once "Missing Ratings" exists.

**References**: `components/SearchFilter.test.tsx` line 914 (`const ratingsHeading = screen.getByRole('heading', { name: /ratings/i })`).

**Test Case (Red)**: this is the pre-existing `FRONTEND-105-AC-15/16` test itself — after Requirement 1 lands and before this fix, it fails with "Found multiple elements with the role 'heading' and name `/ratings/i`" because both "Ratings" and "Missing Ratings" match.

**Test Case (Green)**: change line 914 to `screen.getByRole('heading', { name: 'Ratings' })` (exact match), matching the existing exact-match style already used for the same heading at line 873.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Checkboxes being relocated (unchanged behavior/state) | `frontend_spec_116_missing_ratings_filter_ui.md` |
| Section/heading/`surface.card` pattern this spec's new section follows | `frontend_spec_075_my_series_filter_sections.md`, `frontend_spec_105_my_series_card_styling_and_modernization.md` |
| Pre-existing test requiring a fix as a direct consequence of this spec | `components/SearchFilter.test.tsx` line 914 (`FRONTEND-105-AC-15/16`) |

---

## Acceptance Criteria Summary

- [x] FRONTEND-118-AC-01: "Missing Ratings" section renders between "Ratings" and "Years"
- [x] FRONTEND-118-AC-02: all four checkboxes live in "Missing Ratings", none remain in "Ratings"
- [x] FRONTEND-118-AC-03: new section is individually carded, no divider class
- [x] FRONTEND-118-AC-04: pre-existing ambiguous heading query fixed to an exact match
