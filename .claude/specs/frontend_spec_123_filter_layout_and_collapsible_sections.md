# Frontend Spec 123: My Series Filter Row Layout & Collapsible Sections

**Status**: Not started
**Priority**: P3
**Depends on**: `frontend_spec_075_my_series_filter_sections.md` (established `SearchFilter.tsx`'s section structure this spec reorganizes), `frontend_spec_105_my_series_card_styling_and_modernization.md` (the `surface.card` styling each section keeps), `frontend_spec_122_rating_filter_and_step_refinements.md` (adds the 2 RT rating fields this spec's row reorg accounts for — should land first so the Ratings section is only restructured once, against its final 5-field shape), `frontend_spec_128_origin_country_language_filter.md` (adds the "Origin" section this spec's collapsible-sections requirement now also covers — should land first for the same reason as `frontend_spec_122`)
**Area**: Frontend (`components/SearchFilter.tsx`, `components/SearchFilter.module.css`, new `components/CollapsibleSection.tsx` + CSS module, optionally `components/RecommendationFiltersBox.tsx`/`components/UseMySeriesPanel.tsx`)

## Overview

Two related layout changes to `SearchFilter.tsx`'s filter sheet:

1. **Row grouping within the Ratings section**: today Min Personal Rating, Min IMDb Rating, and Min TMDB Rating (soon joined by the two new Rotten Tomatoes fields from `frontend_spec_122`) sit in one CSS grid with no explicit row structure — fields free-flow into columns based on viewport width. This spec groups them into three explicit rows: Min Personal Rating alone; Min IMDb + Min TMDB together; both Rotten Tomatoes ratings together.
2. **Collapsible sections**: all 5 of `SearchFilter.tsx`'s sections (Genres & Keywords, Origin, Ratings, Missing Ratings, Years) become expand/collapse disclosures, each showing a count of its own active filters. Genres & Keywords and Ratings default open; Origin, Missing Ratings, and Years default closed.

This app already has 2 independent hand-rolled implementations of exactly the "toggle button + active-count badge + conditional body" pattern this spec needs (`RecommendationFiltersBox.tsx`, `UseMySeriesPanel.tsx`) — this spec extracts a shared `CollapsibleSection` component rather than adding a third/fourth/fifth/sixth copy.

**Update (2026-09-23)**: `frontend_spec_128_origin_country_language_filter.md` shipped after this spec was originally written, inserting a new "Origin" (Country/Language) section between Genres & Keywords and Ratings. This spec's scope widens from 4 to 5 sections accordingly — Origin defaults closed, alongside Missing Ratings and Years, since it's a newer, less-core filter than Genres/Ratings. Every line reference below is refreshed against the post-`frontend_spec_128` file. (Note: an earlier discussion also considered moving `FilterProfileSelector` ("Saved Filters") to the top of this sheet as part of this spec — that's been split out into its own cross-cutting spec instead, since the same placement question applies to every filterable area in the app, not just My Series; see `frontend_spec_129_filter_profile_selector_top_placement_and_tooltips.md`.)

## Design Decisions

- **Row grouping via a full-width wrapper class, not a parent-grid rewrite.** `SearchFilter.module.css`'s `.filterSection` today does `display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr))` directly on the section (later split into `.filterSection`/`.filterSectionBody`, see below). Each "row" becomes its own `grid-column: 1 / -1` wrapper `<div>` with its own internal `auto-fit` grid — the exact same "full-width wrapper with its own internal grid" idiom `RecommendationControls.module.css`'s `.filterFullWidthRow`/`.filterFourColGrid` already use for `UseMySeriesPanel.tsx`, just ported into this file rather than invented fresh.
- **`CollapsibleSection` takes `toggleClassName`/`badgeClassName`/`bodyClassName` props rather than owning its own visual style.** `SearchFilter.tsx`'s sections use the `surface.card` bordered-card look; `RecommendationFiltersBox.tsx`/`UseMySeriesPanel.tsx` use a different border-top/border-left divider look. The shared component's job is the open/closed *behavior* (state, `aria-expanded`, badge rendering, conditional mount), not a single imposed visual language — each caller supplies its own classes, exactly as each does today independently.
- **`SearchFilter.tsx`'s 5 sections keep their `<h3>` heading** (wrapping the new toggle button in it), preserving today's document-outline semantics — `RecommendationFiltersBox.tsx`/`UseMySeriesPanel.tsx`'s own toggles were never `<h3>`-wrapped and don't need to become so.
- **No animation** — matches both existing implementations exactly (`{open && <div>...}`, instant mount/unmount, no CSS transition anywhere in this codebase for this pattern).
- **CSS split required**: `.filterSection` currently carries card chrome (via `surface.card`) *and* grid layout *and* padding on one rule. Once a toggle button sits inside the `<section>` above the (now-conditionally-rendered) fields, only the fields should be a grid — split into `.filterSection` (kept: composed with `surface.card`, padding) and a new `.filterSectionBody` (the grid rules + `align-items: end`, moved from the current `.filterSection`, applied to `CollapsibleSection`'s body wrapper).
- **Per-section active-count logic is new** — no per-section or even whole-form active-filter counter exists in `SearchFilter.tsx` today (confirmed: only `RecommendationFiltersBox.tsx` has a whole-box counter, `countActiveFilters`, and `SeriesList.tsx`'s funnel button has a single whole-sheet boolean, neither of which is reusable as-is for 5 independent per-section counts). Five small new functions, one per section (including `countOriginActive`, counting `originCountry`'s length plus 1 if `originalLanguage` is set), following `countActiveFilters`'s own style (group relevant fields into arrays, filter non-empty/checked, sum lengths).
- **Migrating `RecommendationFiltersBox.tsx`/`UseMySeriesPanel.tsx` to the new shared component is optional, recommended, and zero-visual-change** if done — each passes its own existing classes, no behavior changes. Include it in this spec if straightforward; if it turns out to be non-trivial (e.g. `UseMySeriesPanel`'s disclosure has any subtly different behavior on closer inspection during implementation), it's fine to leave as a documented follow-up rather than block this spec on it.

---

## Requirement 1: Ratings section fields are grouped into explicit rows

**User story**: As a user opening My Series filters, I want Min Personal Rating, the IMDb/TMDB ratings, and the Rotten Tomatoes ratings visually grouped into their own rows, so related fields read together regardless of viewport width.

### FRONTEND-123-AC-01 [AUTO]
**Statement**: The Ratings section shall render three full-width row wrappers, in order: (1) Min Personal Rating alone, (2) Min IMDb Rating + Min TMDB Rating, (3) Min Rotten Tomatoes Rating + Min Rotten Tomatoes Popcornmeter (from `frontend_spec_122`).

**References**: `components/SearchFilter.tsx` Ratings section (currently lines 353-395), `components/RecommendationControls.module.css`'s `.filterFullWidthRow`/`.filterFourColGrid` (the pattern being ported).

**Test Case (Red)**:
```typescript
describe('FRONTEND-123-AC-01: Ratings section row grouping', () => {
  it('groups Min Personal Rating alone in its own row', () => {
    renderFilter()
    const personalRatingField = screen.getByText('Min Personal Rating').closest('[class*=ratingRow]')
    expect(within(personalRatingField!).queryByLabelText(/min imdb rating/i)).not.toBeInTheDocument()
  })

  it('groups Min IMDb and Min TMDB Rating in the same row', () => {
    renderFilter()
    const imdbRow = screen.getByLabelText(/min imdb rating/i).closest('[class*=ratingRow]')
    expect(within(imdbRow!).getByLabelText(/min tmdb rating/i)).toBeInTheDocument()
  })

  it('groups both Rotten Tomatoes fields in the same row', () => {
    renderFilter()
    const rtRow = screen.getByLabelText('Min Rotten Tomatoes Rating').closest('[class*=ratingRow]')
    expect(
      within(rtRow!).getByLabelText('Min Rotten Tomatoes Popcornmeter'),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add `.ratingRow` (`grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 1rem;`) to `SearchFilter.module.css`; wrap the three field groups in the Ratings section JSX accordingly.

---

## Requirement 2: All 5 filter sections are collapsible

**User story**: As a user with several filter sections active, I want to collapse the ones I'm not using (especially Missing Ratings and Years, which I rarely touch) so the sheet is easier to scan.

### FRONTEND-123-AC-02 [AUTO]
**Statement**: A new `CollapsibleSection` component shall render a `<button aria-expanded>` toggle (showing its `title` and an optional count badge when `activeCount > 0`) and conditionally render its `children` only while open, defaulting to `defaultOpen`'s initial value.

**References**: new file `components/CollapsibleSection.tsx`; `components/RecommendationFiltersBox.tsx` lines 94, 165-184 (the pattern being extracted — `useState`, `aria-expanded`, conditional badge, conditional body).

**Test Case (Red)**:
```typescript
describe('FRONTEND-123-AC-02: CollapsibleSection', () => {
  it('renders children when defaultOpen is true', () => {
    render(
      <CollapsibleSection title="Test Section" defaultOpen={true} activeCount={0}>
        <p>Body content</p>
      </CollapsibleSection>,
    )
    expect(screen.getByText('Body content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Test Section' })).toHaveAttribute(
      'aria-expanded', 'true',
    )
  })

  it('hides children when defaultOpen is false, and shows them after a click', () => {
    render(
      <CollapsibleSection title="Test Section" defaultOpen={false} activeCount={0}>
        <p>Body content</p>
      </CollapsibleSection>,
    )
    expect(screen.queryByText('Body content')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Test Section' }))
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('shows the active-count badge only when activeCount > 0', () => {
    const { rerender } = render(
      <CollapsibleSection title="Test Section" defaultOpen={true} activeCount={0}>
        <p>Body</p>
      </CollapsibleSection>,
    )
    expect(screen.queryByText('2')).not.toBeInTheDocument()
    rerender(
      <CollapsibleSection title="Test Section" defaultOpen={true} activeCount={2}>
        <p>Body</p>
      </CollapsibleSection>,
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: implement `CollapsibleSection` per the statement above, accepting `title`, `defaultOpen`, `activeCount`, `children`, and optional `toggleClassName`/`badgeClassName`/`bodyClassName` props.

---

### FRONTEND-123-AC-03 [AUTO]
**Statement**: `SearchFilter.tsx`'s 5 sections shall each use `CollapsibleSection` (wrapped in `<h3>`, passing `surface.card`-compatible classes), with `defaultOpen` `true` for Genres & Keywords and Ratings, `false` for Origin, Missing Ratings, and Years, and each showing its own active-filter count.

**References**: `components/SearchFilter.tsx` — Genres & Keywords (line 383), Origin (line 435), Ratings (line 463), Missing Ratings (line 540), Years (line 596); `components/SearchFilter.module.css` — `.filterSection`/`.filterSectionHeading` (to be split into `.filterSection` + new `.filterSectionBody`). Re-verify these line numbers at implementation time — they will have shifted again once any spec ahead of this one in the build queue lands.

**Test Case (Red)**:
```typescript
describe('FRONTEND-123-AC-03: SearchFilter sections default open/closed correctly', () => {
  it('Genres & Keywords and Ratings default open', () => {
    renderFilter()
    expect(screen.getByRole('button', { name: /genres & keywords/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /^ratings/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('Origin, Missing Ratings, and Years default closed', () => {
    renderFilter()
    expect(screen.getByRole('button', { name: /^origin/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /missing ratings/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /^years/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(/min year/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Country')).not.toBeInTheDocument()
  })

  it('shows an active-count badge on Origin once a country is selected, even while collapsed', () => {
    renderFilter()
    fireEvent.click(screen.getByRole('button', { name: /^origin/i }))
    fireEvent.click(screen.getByLabelText('Country'))
    fireEvent.click(screen.getByText('GB'))
    fireEvent.click(screen.getByRole('button', { name: /^origin/i })) // collapse again
    expect(within(screen.getByRole('button', { name: /^origin/i })).getByText('1')).toBeInTheDocument()
  })

  it('shows an active-count badge on Years once a year bound is set, even while collapsed', () => {
    renderFilter()
    fireEvent.click(screen.getByRole('button', { name: /^years/i }))
    fireEvent.change(screen.getByLabelText(/min year/i), { target: { value: '2020' } })
    fireEvent.click(screen.getByRole('button', { name: /^years/i })) // collapse again
    expect(within(screen.getByRole('button', { name: /^years/i })).getByText('1')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: replace each section's static `<h3>` with `<h3><CollapsibleSection title="..." defaultOpen={...} activeCount={...} ...>` wrapping the section's existing fields; add the 5 count functions (`countGenresKeywordsActive`, `countOriginActive`, `countRatingsActive`, `countMissingRatingsActive`, `countYearsActive`) mirroring `RecommendationFiltersBox.tsx`'s `countActiveFilters` style; split `.filterSection`'s CSS into card/padding-only plus a new `.filterSectionBody` carrying the grid rules, applied via `CollapsibleSection`'s `bodyClassName`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `SearchFilter.tsx`'s original section structure this spec reorganizes | `frontend_spec_075_my_series_filter_sections.md` |
| `surface.card` styling each section keeps | `frontend_spec_105_my_series_card_styling_and_modernization.md` |
| Existing disclosure pattern being extracted | `RecommendationFiltersBox.tsx`, `UseMySeriesPanel.tsx` (no dedicated specs — both introduced inline; see `tooling_spec_008_recommendation_controls_decomposition.md` for `RecommendationFiltersBox`'s extraction history) |
| Full-width-row CSS idiom being ported | `RecommendationControls.module.css`'s `.filterFullWidthRow`/`.filterFourColGrid` |
| RT rating fields this spec's row 3 accounts for | `frontend_spec_122_rating_filter_and_step_refinements.md` |
| "Origin" section (Country/Language) this spec's widened scope (4→5 sections) accounts for | `frontend_spec_128_origin_country_language_filter.md` |
| `FilterProfileSelector` top-placement/hover-tooltip work split out of this spec into its own | `frontend_spec_129_filter_profile_selector_top_placement_and_tooltips.md` |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-123-AC-01: Ratings section fields grouped into 3 explicit rows
- [ ] FRONTEND-123-AC-02: `CollapsibleSection` component implemented correctly
- [ ] FRONTEND-123-AC-03: all 5 `SearchFilter` sections use it with correct defaults and active-count badges
