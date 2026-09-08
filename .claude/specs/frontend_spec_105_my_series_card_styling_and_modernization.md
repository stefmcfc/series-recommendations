# Frontend Spec 105: My Series Card Styling & Page Modernization

**Status**: Delivered
**Priority**: P3
**Depends on**: `frontend_spec_101_settings_units_and_card_styling.md` (the bordered/shadowed card
pattern and hand-rolled-icon convention this spec extends beyond `/settings`), `frontend_spec_103_button_styling_consistency.md`
(the shared-`styles/`-primitive-via-template-literal-composition pattern this spec's new
`surfaces.module.css` follows), `frontend_spec_092_persistent_navigation_and_modal_dismissal.md`
(`App.module.css`'s existing `nav.navLinks` element-type-qualifier scoping this spec's status-tab
redesign reuses)
**Area**: Frontend (new `src/styles/surfaces.module.css`, new `src/components/StatusTabIcons.tsx`,
`components/SettingsSection.tsx`/`.module.css`, `components/SeriesList.tsx`/`.module.css`,
`components/SeriesCompactGrid.module.css`, `components/RecommendationCard.module.css`,
`components/SearchFilter.tsx`/`.module.css`, `App.tsx`/`App.module.css`, and each affected file's
tests)

## Overview

Raised 2026-09-08 after a user walkthrough of `/my-series` immediately following `frontend_spec_101`'s
Settings redesign — confirmed the two pages now read as visually inconsistent: Settings has
bordered, shadowed, icon-labeled cards; My Series is still the older flat-border, icon-free,
loosely-grouped look it always had. This spec brings My Series (and, since the same request covers
it, Recommendation cards) up to the same visual language, plus closes a few smaller gaps spotted
during the same review: unstructured toolbar controls, plain-text status tabs, and a divider-only
Filters sheet.

**Explicitly not a redesign of what any of these pages *do*** — every requirement here is styling
only (border/radius/shadow/background/icons), no layout restructuring, no new interaction, no
change to what data renders where. `SeriesPosterGrid` (the dense poster-wall view) is deliberately
excluded from the card treatment — see Design Decisions.

## Design Decisions

- **A new shared `src/styles/surfaces.module.css` primitive, not six copies of the same four
  declarations.** Confirmed via reading the code: `SettingsSection.module.css`'s `.section`,
  `SeriesList.module.css`'s `.row`, `SeriesCompactGrid.module.css`'s `.card`, and
  `RecommendationCard.module.css`'s `.card` would all end up wanting the identical `border: 1px
  solid var(--border); border-radius: 0.75rem; box-shadow: var(--shadow); background: var(--bg);`
  block once this spec lands — plus two more new consumers (the toolbar wrapper, each Filters
  section). Six consumers of one identical declaration crosses the same "stop repeating this"
  threshold `frontend_spec_103` used to justify centralizing button-tier styling into
  `buttons.module.css`, so this spec applies the same fix: one shared primitive, composed via the
  same plain template-literal join pattern (`` `${styles.row} ${surface.card}` ``, mirroring
  `` `${styles.addButton} ${btn.btnPrimary}` ``) — no new dependency (confirmed clean of
  `clsx`/`classnames` in `frontend_spec_103`, still true).
- **The shared class covers only border/radius/shadow/background — never padding, margin, or
  layout.** Directly reusing `frontend_spec_103`'s own established principle ("shared classes
  cover color/tier semantics only, not geometry") for the same reason: every consumer here already
  has deliberately different padding/layout for its own content (a list row's padding differs from
  a poster-grid card's, which differs from a settings section's) — baking padding into the shared
  primitive would force every consumer to fight it. Each consumer keeps its own padding/layout
  declarations locally; only removes/replaces its own now-duplicated `border`/`border-radius`/
  `background`.
- **`SettingsSection` migrates to consume the new shared primitive too**, not just the five new
  consumers — leaving it on its own separately-maintained copy of the identical four declarations
  while everything else shares one primitive would immediately reintroduce the exact duplication
  this spec exists to stop. This is a pure visual-equivalence refactor: `SettingsSection.module.css`
  keeps its own `padding`/`margin-top` on `.section`, drops `border`/`border-radius`/`box-shadow`/
  `background`, and `SettingsSection.tsx` composes `` `${styles.section} ${surface.card}` `` —
  byte-for-byte identical rendered output, confirmed by the existing `SettingsSection.test.tsx`
  suite continuing to pass unmodified.
- **`SeriesPosterGrid` is explicitly excluded from the card treatment.** Confirmed via browser
  review: it renders a dense, tightly-packed wall of 8+ poster tiles per row with no gap for a
  shadow to read against — adding `box-shadow` there would look like visual noise, not polish,
  unlike the more generously-spaced list rows/compact cards this spec does target. Its existing
  plain `1px solid var(--border)` stays untouched.
- **Border-radius is unified to `0.75rem` everywhere the shared primitive applies**, superseding
  each consumer's previous individual value (`SeriesList`'s `.row` and `SeriesCompactGrid`'s `.card`
  were both `0.5rem`; `RecommendationCard`'s `.card` was `0.5rem`) — one consistent "rounded card"
  radius app-wide, matching what `SettingsSection`/this app's modal `.dialog`s already use, rather
  than three near-but-not-quite-matching values.
- **The status-tab bar (`All`/`Watching`/`Completed`/`Backlog`/`Dropped`/`Rewatch`) is restyled via
  the *existing* `nav.navLinks` element-type-qualifier pattern already established in
  `App.module.css` (`frontend_spec_092`'s `FRONTEND-092-AC-02` comment) — not a new class, and
  critically, not a change to the bare `.navLink`/`.navLinkActive` classes themselves.** Confirmed
  by reading `App.tsx`: the top header nav (`My Series`/`Recommendations`/`Analysis`/`Settings`, a
  `<div>`) and the status-tab bar (a `<nav>`, `aria-label="Status"`) both apply the exact same
  `.navLink`/`.navLinkActive` classes via the shared `navLinkClassName` helper. Restyling those bare
  classes would silently restyle the header too. This spec instead adds new compound selectors,
  `nav.navLinks .navLink`/`nav.navLinks .navLinkActive`, in `App.module.css` — scoped by the
  `<nav>` ancestor exactly the way `nav.navLinks` itself already is — so only the status-tab bar
  gets the new pill/segmented look; the header's own nav links, and the JSX/className calls in
  `App.tsx`, are completely untouched.
- **Each status tab gains a small decorative icon**, following `frontend_spec_101`'s exact
  precedent (hand-rolled inline SVG, `currentColor`-stroked, `aria-hidden="true"`, no new
  dependency) rather than inventing a new icon convention. New file `StatusTabIcons.tsx` (mirroring
  the existing `SettingsIcons.tsx`), six icons: All, Watching, Completed, Backlog, Dropped, Rewatch.
  Exact glyph choice is an implementation detail (not prescribed by the ACs below), same as
  `frontend_spec_101` didn't prescribe exact SVG paths for its five section icons either.
- **The toolbar row (`SeriesList`'s `.headerToolbar` — Sort by / view-mode toggle / Filters button)
  gets the same shared-surface treatment**, addressing the specific "controls just float, nothing
  visually groups them" gap from the review — same primitive, same reasoning as everywhere else in
  this spec, no separate visual language invented for it.
- **`SearchFilter`'s three filter groups (Genres & Keywords / Ratings / Years) become individually
  carded, replacing `.sectionDivider`'s current top-border-only separation.** `.sectionDivider`
  (applied to every section after the first) is removed; each `.filterSection` instead composes
  the shared surface primitive directly, consistent with how `SettingsSection` groups discrete
  settings — Filters' three groups are conceptually the same "several distinct groups on one
  sheet" shape Settings already solved.
- **This is `[MANUAL]` for how the shadow/pill/card treatment actually *looks* rendered, `[AUTO]`
  for everything else** — jsdom doesn't render CSS (this project's established, repeatedly-cited
  limitation — see `frontend_spec_090`/`091`/`092`/`103`, and root `CLAUDE.md`). Class composition,
  icon `aria-hidden`/accessible-name preservation, and the removed `.sectionDivider` are ordinary
  DOM/class assertions and stay `[AUTO]`; the actual box-shadow/pill-shape/spacing appearance in
  both themes needs a real browser pass.

## Requirements

### Requirement 1: A shared card/surface styling primitive

**User story**: As a developer applying this app's "bordered, shadowed card" look to a new
surface, I want one shared class to compose, not another copy-pasted `border`/`border-radius`/
`box-shadow`/`background` block.

#### Acceptance Criteria

- **FRONTEND-105-AC-01** [AUTO]: A new `frontend/src/styles/surfaces.module.css` shall export a
  `.card` class with exactly `border: 1px solid var(--border);`, `border-radius: 0.75rem;`,
  `box-shadow: var(--shadow);`, and `background: var(--bg);` — no padding, margin, or other
  layout properties.
- **FRONTEND-105-AC-02** [AUTO]: `SettingsSection.module.css`'s `.section` shall no longer declare
  `border`, `border-radius`, `box-shadow`, or `background` — `SettingsSection.tsx` shall instead
  compose `` `${styles.section} ${surface.card}` `` on the section wrapper, with `.section`
  retaining only its existing `padding`/`margin-top`.
- **FRONTEND-105-AC-03** [AUTO]: Every existing `SettingsSection` test (title/icon/children
  rendering, `aria-hidden` on the icon) shall continue to pass unmodified — this migration
  produces byte-for-byte identical rendered markup structure and computed styling.

---

### Requirement 2: My Series' list row and compact-grid card adopt the shared surface

**User story**: As a user browsing My Series in list or compact-grid view, I want each series to
sit on a distinct, gently-elevated card, matching how Settings already presents its sections.

#### Acceptance Criteria

- **FRONTEND-105-AC-04** [AUTO]: `SeriesList.module.css`'s `.row` shall no longer declare `border`
  or `border-radius`; `SeriesList.tsx` shall compose `` `${styles.row} ${surface.card}` `` on each
  row's wrapping element, retaining `.row`'s existing padding/layout and `:hover` background
  override unchanged.
- **FRONTEND-105-AC-05** [AUTO]: `SeriesCompactGrid.module.css`'s `.card` shall no longer declare
  `border`, `border-radius`, or `background: transparent`; `SeriesCompactGrid.tsx` shall compose
  `` `${styles.card} ${surface.card}` `` on each card, retaining `.card`'s existing padding/layout
  and `:hover`/`:focus-visible` background override unchanged.
- **FRONTEND-105-AC-06** [AUTO]: `SeriesPosterGrid.module.css`'s `.card` shall remain completely
  unchanged by this spec (no shared-surface composition, no radius/shadow change) — the dense
  poster-wall view is explicitly out of scope (see Design Decisions).

---

### Requirement 3: Recommendation cards adopt the shared surface

**User story**: As a user browsing recommendations (the main Recommendations page or a single
series' recommendations modal), I want each candidate's card to match the same elevated-card look
as My Series and Settings.

#### Acceptance Criteria

- **FRONTEND-105-AC-07** [AUTO]: `RecommendationCard.module.css`'s `.card` shall no longer declare
  `border` or `border-radius`; `RecommendationCard.tsx` shall compose
  `` `${styles.card} ${surface.card}` `` on the card's wrapping element, retaining `.card`'s
  existing padding/layout unchanged. This applies everywhere `RecommendationCard` renders
  (`RecommendationsList`, `SeriesRecommendationsModal`) with no per-caller change needed.

---

### Requirement 4: Status-tab bar becomes a segmented/pill control with icons

**User story**: As a user filtering My Series by status, I want the All/Watching/Completed/
Backlog/Dropped/Rewatch tabs to read as a deliberately designed control, not a row of plain links
— without changing how the main header navigation looks.

#### Acceptance Criteria

- **FRONTEND-105-AC-08** [AUTO]: `App.module.css` shall define new compound selectors
  `nav.navLinks .navLink` and `nav.navLinks .navLinkActive` giving the status-tab bar a
  pill/segmented visual treatment, distinct from the plain `.navLink`/`.navLinkActive` rules that
  continue to style the header's own nav — the header's own `<div className={styles.navLinks}>`
  link row shall be provably unaffected (see FRONTEND-105-AC-11).
- **FRONTEND-105-AC-09** [AUTO]: A new `frontend/src/components/StatusTabIcons.tsx` shall export
  six named decorative icon components (`AllIcon`, `WatchingIcon`, `CompletedIcon`,
  `BacklogIcon`, `DroppedIcon`, `RewatchIcon`), hand-rolled inline SVGs matching
  `SettingsIcons.tsx`'s existing `currentColor`-stroked style — no new dependency.
- **FRONTEND-105-AC-10** [AUTO]: Each of the six status-tab `NavLink`s in `App.tsx` (`MySeriesView`)
  shall render its matching icon immediately before its label text, wrapped with
  `aria-hidden="true"` — mirroring `SettingsSection`'s existing icon-wrapping pattern
  (`frontend_spec_101` `FRONTEND-101-AC-05`/`AC-08`).
- **FRONTEND-105-AC-11** [AUTO]: The header's own nav links (`My Series`/`Recommendations`/
  `Analysis`/`Settings`) shall render with no icon and no change to their existing accessible
  name/structure — an accessibility-tree query for each shall resolve exactly as it did before
  this spec.
- **FRONTEND-105-AC-12** [MANUAL]: A human reviewer shall visually confirm, in an actual browser,
  in both light and dark theme, that the status-tab bar reads as a distinct pill/segmented
  control (rounded active-state fill, clear separation between tabs) while the header nav above it
  is visually unchanged from before this spec.

---

### Requirement 5: My Series' toolbar controls are visually grouped

**User story**: As a user, I want the Sort/view-mode/Filters controls above my series list to read
as one deliberate toolbar, not a loose row of unrelated floating controls.

#### Acceptance Criteria

- **FRONTEND-105-AC-13** [AUTO]: `SeriesList.module.css`'s `.headerToolbar` shall compose the
  shared surface primitive (`` `${styles.headerToolbar} ${surface.card}` `` in `SeriesList.tsx`),
  gaining its own padding sized appropriately for a control bar (not copied from `.row`'s
  content-row padding).
- **FRONTEND-105-AC-14** [MANUAL]: A human reviewer shall visually confirm the toolbar reads as a
  distinct, self-contained bar in both themes, with no layout shift to the controls inside it
  (Sort by label/select, sort-direction button, view-mode toggle, Filters button).

---

### Requirement 6: Filters sheet groups become individually carded

**User story**: As a user opening the Filters sheet, I want its three groups (Genres & Keywords /
Ratings / Years) to read as distinct sections, matching how Settings presents its own sections.

#### Acceptance Criteria

- **FRONTEND-105-AC-15** [AUTO]: `SearchFilter.module.css`'s `.sectionDivider` class shall be
  removed, along with its application to the "Ratings"/"Years" sections in `SearchFilter.tsx`.
- **FRONTEND-105-AC-16** [AUTO]: Each of the three `.filterSection` groups ("Genres & Keywords",
  "Ratings", "Years") shall compose the shared surface primitive
  (`` `${styles.filterSection} ${surface.card}` ``), each gaining its own padding.
- **FRONTEND-105-AC-17** [MANUAL]: A human reviewer shall visually confirm, in both themes, that
  the three groups read as distinct cards inside the Filters sheet, with no field misalignment
  introduced.

---

## Cross-References

| This spec | Source |
|---|---|
| `border`/`border-radius`/`box-shadow`/`background` token values this spec's shared primitive centralizes | `frontend/src/components/SettingsSection.module.css` (`frontend_spec_101`, `FRONTEND-101-AC-06`) |
| Shared-class-via-template-literal-composition pattern, and "shared classes cover color/tier semantics only, not geometry" principle this spec reuses | `frontend_spec_103_button_styling_consistency.md` (`frontend/src/styles/buttons.module.css`) |
| `nav.navLinks` element-type-qualifier scoping precedent this spec's status-tab restyle extends | `frontend/src/App.module.css` (`FRONTEND-092-AC-02` comment), `frontend_spec_092_persistent_navigation_and_modal_dismissal.md` |
| Hand-rolled inline-SVG icon convention (`currentColor`, `aria-hidden`, no new dependency) this spec's `StatusTabIcons.tsx` follows | `frontend/src/components/SettingsIcons.tsx`, `frontend_spec_101_settings_units_and_card_styling.md` (`FRONTEND-101-AC-05/07/08`) |
| `SeriesList`'s three view modes (`.row`, `SeriesCompactGrid`, `SeriesPosterGrid`) this spec applies to two of and explicitly excludes the third from | `frontend_spec_054`/`079` (compact/poster grid views), `frontend/src/components/SeriesCompactGrid.tsx`, `SeriesPosterGrid.tsx` |
| `RecommendationCard`'s call sites this spec's change reaches with no per-caller edit needed | `frontend/src/components/RecommendationsList.tsx`, `SeriesRecommendationsModal.tsx` |
| jsdom/CSS rendering limitation — basis for every `[MANUAL]` AC above | `.claude/steering/frontend_conventions.md` (Testing Strategy section); root `CLAUDE.md` |

---

## TDD Test Case Sketches

### `frontend/src/components/SettingsSection.test.tsx` (additions)

```typescript
import surface from '../styles/surfaces.module.css'

describe('FRONTEND-105-AC-02: SettingsSection composes the shared surface primitive', () => {
  it('applies surface.card alongside its own section class', () => {
    render(<SettingsSection title="Example">content</SettingsSection>)
    const section = screen.getByRole('heading', { name: 'Example' }).closest('section')
    expect(section?.className).toContain(surface.card)
  })
})
```

**Test Case (Red)**: fails today — `surfaces.module.css` doesn't exist, `SettingsSection` doesn't
compose it.

**Test Case (Green)**: create `surfaces.module.css` (AC-01), migrate `SettingsSection` (AC-02).

### `frontend/src/components/SeriesList.test.tsx` (additions)

```typescript
import surface from '../styles/surfaces.module.css'

describe('FRONTEND-105-AC-04: series rows compose the shared surface primitive', () => {
  it('applies surface.card to each row', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'The Wire' })])
    render(<SeriesList />)
    const row = (await screen.findByText('The Wire')).closest('li')
    expect(row?.className).toContain(surface.card)
  })
})

describe('FRONTEND-105-AC-13: the toolbar composes the shared surface primitive', () => {
  it('applies surface.card to the toolbar wrapper', () => {
    render(<SeriesList />)
    expect(screen.getByLabelText(/sort by/i).closest(`.${surface.card}`)).toBeTruthy()
  })
})
```

**Test Case (Green)**: compose `surface.card` on `.row` (AC-04) and `.headerToolbar` (AC-13).

### `frontend/src/components/SeriesCompactGrid.test.tsx` (new file)

```typescript
import surface from '../styles/surfaces.module.css'

describe('FRONTEND-105-AC-05: compact-grid cards compose the shared surface primitive', () => {
  it('applies surface.card to each card', () => {
    render(<SeriesCompactGrid series={[makeSeries({ title: 'Chernobyl' })]} posterErrorIds={new Set()} onPosterError={vi.fn()} onCardClick={vi.fn()} />)
    expect(screen.getByText('Chernobyl').closest('button')?.className).toContain(surface.card)
  })
})
```

**Test Case (Green)**: compose `surface.card` on `SeriesCompactGrid`'s `.card` (AC-05).

### `frontend/src/components/RecommendationCard.test.tsx` (additions)

```typescript
import surface from '../styles/surfaces.module.css'

describe('FRONTEND-105-AC-07: recommendation cards compose the shared surface primitive', () => {
  it('applies surface.card to the card wrapper', () => {
    render(<RecommendationCard recommendation={makeRecommendation({ title: 'Fargo' })} {...requiredHandlers} />)
    expect(screen.getByText('Fargo').closest(`.${surface.card}`)).toBeTruthy()
  })
})
```

**Test Case (Green)**: compose `surface.card` on `RecommendationCard`'s `.card` (AC-07).

### `frontend/src/App.test.tsx` (additions)

```typescript
describe('FRONTEND-105-AC-09/10: status tabs render decorative icons', () => {
  it('each status tab renders an aria-hidden icon before its label', () => {
    render(<App />)
    const watchingTab = screen.getByRole('link', { name: 'Watching' })
    expect(watchingTab.querySelector('[aria-hidden="true"] svg')).toBeTruthy()
  })
})

describe('FRONTEND-105-AC-11: header nav links are unaffected', () => {
  it('the header My Series/Recommendations/Analysis/Settings links carry no icon', () => {
    render(<App />)
    const headerLink = screen.getByTestId('app-logo').closest('nav')?.querySelector('a')
    // header's own nav row (a <div>, not <nav>) -- confirm no icon wrapper present
    const recsLink = screen.getByRole('link', { name: 'Recommendations' })
    expect(recsLink.querySelector('[aria-hidden="true"]')).toBeFalsy()
  })
})
```

**Test Case (Red)**: fails today — `StatusTabIcons.tsx` doesn't exist, no tab renders an icon.

**Test Case (Green)**: create `StatusTabIcons.tsx` (AC-09), render each icon in `MySeriesView`'s
status-tab `NavLink`s (AC-10), leave the header's own nav links untouched (AC-11).

### `frontend/src/components/SearchFilter.test.tsx` (additions)

```typescript
import surface from '../styles/surfaces.module.css'

describe('FRONTEND-105-AC-15/16: filter sections are individually carded, no divider class', () => {
  it('each filter section composes surface.card and sectionDivider is gone', () => {
    render(<SearchFilter isOpen onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)
    const ratingsHeading = screen.getByRole('heading', { name: /ratings/i })
    expect(ratingsHeading.closest(`.${surface.card}`)).toBeTruthy()
  })
})
```

**Test Case (Green)**: remove `.sectionDivider` (AC-15), compose `surface.card` on each
`.filterSection` (AC-16).

---

## Acceptance Criteria Summary

- [x] FRONTEND-105-AC-01: new `surfaces.module.css` exports `.card` (border/radius/shadow/background only)
- [x] FRONTEND-105-AC-02: `SettingsSection` migrates to compose the shared primitive
- [x] FRONTEND-105-AC-03: existing `SettingsSection` tests pass unmodified
- [x] FRONTEND-105-AC-04: `SeriesList`'s `.row` composes the shared primitive
- [x] FRONTEND-105-AC-05: `SeriesCompactGrid`'s `.card` composes the shared primitive
- [x] FRONTEND-105-AC-06: `SeriesPosterGrid` is unchanged (explicitly out of scope)
- [x] FRONTEND-105-AC-07: `RecommendationCard`'s `.card` composes the shared primitive
- [x] FRONTEND-105-AC-08: status-tab bar gets pill styling via `nav.navLinks` compound selectors, header nav untouched
- [x] FRONTEND-105-AC-09: new `StatusTabIcons.tsx` with six decorative icons
- [x] FRONTEND-105-AC-10: each status tab renders its icon, `aria-hidden`
- [x] FRONTEND-105-AC-11: header nav links unaffected (no icon, unchanged accessible name)
- [x] FRONTEND-105-AC-12: manual visual check — status-tab pill styling in both themes, header nav unchanged
- [x] FRONTEND-105-AC-13: `.headerToolbar` composes the shared primitive with its own padding
- [x] FRONTEND-105-AC-14: manual visual check — toolbar reads as a distinct bar, no control layout shift
- [x] FRONTEND-105-AC-15: `.sectionDivider` removed from `SearchFilter`
- [x] FRONTEND-105-AC-16: each `.filterSection` composes the shared primitive
- [x] FRONTEND-105-AC-17: manual visual check — Filters sheet groups read as distinct cards, no field misalignment
