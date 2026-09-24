# Frontend Spec 131: Info Disclosure Boxes for Non-Obvious Controls

**Status**: Not started
**Priority**: P3
**Depends on**: `frontend_spec_115_number_input_spinner_styling.md` (introduces the shared `NumberInput` component this spec extends with a new `labelInfo` prop), `frontend_spec_097_refresh_skip_threshold_override_ui.md` (introduces `SettingsSection`, extended here with a new `info` prop — see `FRONTEND-097-AC-03`'s "intentionally no collapse/disclosure behavior" note, unaffected by this spec since `info` is a static reveal, not a section-level collapse), `frontend_spec_123_filter_layout_and_collapsible_sections.md` (introduces `CollapsibleSection`, the closest existing analog — this spec's component is a deliberate sibling, not a reuse, see Design Decisions), `tooling_spec_008_recommendation_controls_decomposition.md` (introduces `HighestRatedPanel.tsx`, one of this spec's call sites)
**Area**: Frontend (new `components/InfoDisclosure.tsx`, `components/NumberInput.tsx`, `components/SettingsSection.tsx`, `components/SettingsPage.tsx`, `components/HighestRatedPanel.tsx`, `components/RecommendationFiltersBox.tsx`, `components/NameStatsTable.tsx`, `components/SearchFilter.tsx`, `components/UseMySeriesPanel.tsx` — plus each of those components' colocated `*.test.tsx`)

## Overview

Seven controls across this app have a purpose that isn't obvious from their visible label alone, and none of them explain themselves today: "Skip Threshold Override," "Watch Region," and "Filter Profiles" in Settings; the "Best Match"/"Most Recommended" Sort By pair; "Min Vote Count"; "Min Avg Blended Rating"; and "Min Rotten Tomatoes Popcornmeter" (two call sites). `.claude/SPEC_CANDIDATES.md` already resolved the UI shape for fixing this back on 2026-08-26: a small click-to-toggle disclosure next to the label — not a hover tooltip, which fails outright on touch and is unreliable for keyboard/screen-reader users — closed by default, revealing a short description directly beneath the field on click. This spec builds that primitive once (`InfoDisclosure`) and wires it into all seven sites in one pass, per the candidate's own explicit direction that "the eventual disclosure-box primitive... should likely be a shared component from the start... rather than two independent implementations of the same idiom."

No tooltip/info/help component exists anywhere in this codebase today (confirmed by grep) — this is a first-of-its-kind primitive, not a refactor of something existing.

**Audited and explicitly excluded** (confirmed self-evident or already explained, not re-litigated by a future reader of this spec): Settings' Appearance section (theme/accent-color/card-tint toggle — each already a plain, self-descriptive control), Export/Import controls, Recommendation Favourites (Country/Language Favourites), `CustomSearchPanel.tsx` in its entirety (already has three existing hint paragraphs covering its non-obvious behavior — e.g. its year-range clarification and "leave empty to browse the most popular shows overall" — no gaps found), Min TMDB Rating, Year Min/Max fields, Min Personal/IMDb Rating fields, Status radio groups, and Analysis's own Min Avg Personal Rating field and Status dropdown.

## Design Decisions

- **A new sibling primitive, not a reuse or wrapper of `CollapsibleSection`.** `CollapsibleSection` (`frontend_spec_123`) is built for "toggle button + active-count badge + a body of many fields" and has no `aria-controls`/id-linking to its conditionally-rendered body at all (confirmed by reading it in full) — a genuine size/semantic mismatch for a one-line info blurb with no badge concept. `InfoDisclosure` pattern-matches its shape (internal `useState`, `type="button"`, `aria-expanded`, instant mount/unmount, no animation — this codebase's established disclosure idiom) but adds the `aria-controls`/id linking `CollapsibleSection` lacks, via `useId()` mirroring `NumberInput.tsx`'s own `const inputId = id ?? generatedId` idiom.
- **ⓘ info-circle glyph, not "?"** — resolved with the user directly: "?" conventionally reads as help/troubleshooting, ⓘ as "more information about this fact," which better matches what these boxes actually do (explain what a control means, not how to fix a problem). Implemented as a hand-rolled inline `<svg>` (circle + "i", `stroke="currentColor"`), matching `StatusTabIcons.tsx`/`SettingsIcons.tsx`'s established one-icon-per-function-component convention — not `frontend/public/icons.svg`, which is a `<symbol>` sprite scoped to social/footer branding with zero `<use href="#...">` references anywhere in `frontend/src` (confirmed by grep).
- **Explicitly not the `[data-tooltip]` CSS hover pattern** (`SeriesList.module.css`, used today for one-word labels on icon-only toolbar buttons, shown on `:hover`/`:focus-visible`). That mechanism is transient, non-persistent, and hover/focus-triggered — wrong for a multi-word description that must survive after the pointer/focus moves and be independently click-dismissible. Called out explicitly since it's the one existing "disclosure-adjacent" mechanism in this codebase someone might otherwise reach for by default.
- **Minimal local button chrome, not a `btn*` tier.** `frontend/src/styles/buttons.module.css`'s three tiers (`.btnPrimary`/`.btnSecondary`/`.btnDestructive`) are sized/weighted for toolbar actions. `InfoDisclosure`'s toggle is a tiny in-context affordance next to a label — `NumberInput.module.css`'s `.spinnerButton` (`background: transparent`, `color: var(--text)`, `border: none`, `:hover` shifts to `var(--social-bg)`) is the closer precedent and is what this spec's button styling mirrors.
- **The disclosure button is always a sibling of the label/heading it sits beside, never a child inside it — this is the single most important correctness constraint in this spec.** Two consumers need a "hook point" to place `InfoDisclosure` next to existing text that doesn't have a natural sibling slot today:
  - `NumberInput.tsx` renders `<label htmlFor={inputId}>{label}</label>` today. A `<button>` placed *inside* that `<label>` would, via the label's native click-through behavior, also focus the associated `<input>` on click — a real interaction bug, not a style nit. `NumberInput` gains an optional `labelInfo?: ReactNode` prop, rendered as a new sibling of `<label>` inside a new wrapping row, never nested inside it.
  - `SettingsSection.tsx` renders `<h3 className={styles.title}>{icon}{title}</h3>` today. A button placed *inside* that `<h3>` would fold its `aria-label` text into the heading's accessible name, breaking exact-match heading queries like `getByRole('heading', { name: 'Watch Region' })` — the same gotcha `CollapsibleSection.tsx`'s own `headingTag` design already documents and avoids (`FRONTEND-123-AC-03`), for the same underlying reason. `SettingsSection` gains an optional `info?: ReactNode` prop, rendered as a new sibling of `<h3>`, never nested inside it.
  - `HighestRatedPanel.tsx`'s `<fieldset>/<legend>` needs neither new prop — `InfoDisclosure` is rendered as plain JSX there, as a sibling immediately after `</legend>` closes, for the identical accessible-name reason.
- **Both new props are optional and unused by every pre-existing call site — zero visual/behavior change by construction for any consumer that doesn't pass them**, the same fallback-prop pattern already established in this codebase (e.g. `frontend_spec_124`'s `var(--card-bg, var(--bg))`).
- **`NameStatsTable.tsx`'s "Min Avg Blended Rating" site is one JSX change covering three Analysis tabs at runtime** (Keywords/Genres/Country of Origin all share this one component via `KeywordsView`/`GenreStatsView`/`CountryStatsView`) — not three separate edits.
- **The Sort By disclosure is gated to the specific branch it explains.** `HighestRatedPanel.tsx` renders one shared `<fieldset><legend>Sort By</legend>` with two mutually-exclusive branches: the TMDB-native options (Vote Average/Most Popular/Newest/Most Voted, self-explanatory, out of scope) and the Best Match/Most Recommended pair (in scope). The disclosure only renders in the latter branch (`!showDiscoverSortByOptions`), not unconditionally after the shared `<legend>`.
- **"Min Rotten Tomatoes Popcornmeter" gets the disclosure, not its sibling "Min Rotten Tomatoes Rating."** The app already disambiguates Tomatometer-vs-Popcornmeter once, but only in a *Sort By* dropdown's option label (`RecommendationControls.tsx`, corrected to say "Tomatometer" specifically to distinguish it from Popcornmeter) — never in either `NumberInput` filter field itself, which is the actual point of confusion for a user filtering rather than sorting. Attaching to the Popcornmeter field alone (not duplicating onto the Rating field too) keeps the fix scoped to the actually-jargony term.

---

## Requirement 1: A reusable `InfoDisclosure` component

**User story**: As a user looking at an unfamiliar control, I want to click a small info icon next to it and see a short explanation appear beneath it, without a hover-only tooltip that wouldn't work on my phone or via keyboard.

### FRONTEND-131-AC-01 [AUTO]
**Statement**: A new `InfoDisclosure` component (`props: { label: string; description: ReactNode }`) shall render a `<button type="button" aria-label={label}>` containing a decorative ⓘ icon (`aria-hidden="true"`), starting with `aria-expanded="false"` and no description in the DOM; clicking it shall toggle `aria-expanded` and mount/unmount a `<p>` containing `description`, with no transition/animation.

**References**: New `frontend/src/components/InfoDisclosure.tsx`/`.module.css`/`.test.tsx`. Icon convention: `frontend/src/components/StatusTabIcons.tsx`/`SettingsIcons.tsx` (one named function-component per icon, `aria-hidden="true"`, stroke-based `currentColor`). Button-chrome precedent: `frontend/src/components/NumberInput.module.css`'s `.spinnerButton` (transparent background, `color: var(--text)`, `:hover` → `var(--social-bg)`). No-animation precedent: `frontend/src/components/CollapsibleSection.tsx`'s explicit "instant mount/unmount" comment.

**Test Case (Red)**:
```typescript
describe('FRONTEND-131-AC-01: InfoDisclosure toggles its description', () => {
  it('starts closed, with the description absent from the DOM', () => {
    render(<InfoDisclosure label="About Watch Region" description="Explains streaming availability." />)
    const button = screen.getByRole('button', { name: 'About Watch Region' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Explains streaming availability.')).not.toBeInTheDocument()
  })

  it('opens on click, showing the description, and closes again on a second click', () => {
    render(<InfoDisclosure label="About Watch Region" description="Explains streaming availability." />)
    const button = screen.getByRole('button', { name: 'About Watch Region' })
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Explains streaming availability.')).toBeInTheDocument()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Explains streaming availability.')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: implement the component per the Statement above.

---

### FRONTEND-131-AC-02 [AUTO]
**Statement**: `InfoDisclosure`'s toggle button `aria-controls` attribute shall equal the `id` of the rendered description `<p>`, generated internally via `useId()`.

**References**: `frontend/src/components/NumberInput.tsx` lines 86-87 (`const generatedId = useId(); const inputId = id ?? generatedId`) — the id-generation style this AC's internal-only id mirrors (no external `id` prop is needed or accepted, since nothing outside the component ever references this id).

**Test Case (Red)**:
```typescript
describe('FRONTEND-131-AC-02: aria-controls links the button to its description', () => {
  it('sets aria-controls to the open description paragraph\'s id', () => {
    render(<InfoDisclosure label="About Watch Region" description="Explains streaming availability." />)
    const button = screen.getByRole('button', { name: 'About Watch Region' })
    fireEvent.click(button)
    const description = screen.getByText('Explains streaming availability.')
    expect(button).toHaveAttribute('aria-controls', description.id)
    expect(description.id).not.toBe('')
  })
})
```
**Test Case (Green)**: `useId()` generates the description's `id`; the button's `aria-controls` reads the same value.

---

## Requirement 2: `NumberInput` and `SettingsSection` gain a label-adjacent "hook point"

**User story**: As a developer wiring `InfoDisclosure` into an existing field, I want a supported way to place it next to that field's label or section heading without altering the label/heading's accessible name or breaking label-click-focuses-input behavior.

### FRONTEND-131-AC-03 [AUTO]
**Statement**: `NumberInput` shall accept an optional `labelInfo?: ReactNode` prop. When provided, it shall render as a sibling of the `<label>` element (never as a descendant of it) and the `<label htmlFor={inputId}>{label}</label>` markup itself shall be unchanged. When omitted, `NumberInput`'s rendered output shall be identical to today's (no new wrapping element visible in a diff for existing callers).

**References**: `frontend/src/components/NumberInput.tsx` lines 115-118 (current label render), `NumberInput.module.css` (new `.labelRow` flex wrapper class).

**Test Case (Red)**:
```typescript
describe('FRONTEND-131-AC-03: NumberInput renders labelInfo beside, not inside, its label', () => {
  it('renders labelInfo as a sibling of the label, not a child', () => {
    render(
      <NumberInput
        label="Skip Threshold Override"
        value="5"
        onChange={vi.fn()}
        labelInfo={<InfoDisclosure label="About Skip Threshold Override" description="..." />}
      />,
    )
    const label = screen.getByText('Skip Threshold Override').closest('label')
    const infoButton = screen.getByRole('button', { name: 'About Skip Threshold Override' })
    expect(label).not.toBeNull()
    expect(label?.contains(infoButton)).toBe(false)
  })

  it('renders unchanged when labelInfo is omitted (no regression for existing callers)', () => {
    const { container } = render(<NumberInput label="Year Min" value="" onChange={vi.fn()} />)
    expect(container.querySelectorAll('button')).toHaveLength(2) // increment/decrement only
  })
})
```
**Test Case (Green)**: add `labelInfo` to `NumberInputProps`; wrap `<label>` and `{labelInfo}` in a new `.labelRow` sibling row.

---

### FRONTEND-131-AC-04 [AUTO]
**Statement**: `SettingsSection` shall accept an optional `info?: ReactNode` prop. When provided, it shall render as a sibling of the `<h3>` element (never as a descendant of it), and the section's accessible heading name shall remain exactly `title` (unaffected by `info`'s content). When omitted, rendering shall be identical to today's.

**References**: `frontend/src/components/SettingsSection.tsx` lines 24-33 (current heading render), `SettingsSection.module.css` (new flex wrapper class). Precedent for the underlying constraint: `frontend/src/components/CollapsibleSection.tsx`'s `headingTag` design (`FRONTEND-123-AC-03`), which documents the identical "don't fold interactive content into a heading's accessible name" concern for a different reason.

**Test Case (Red)**:
```typescript
describe('FRONTEND-131-AC-04: SettingsSection renders info beside, not inside, its heading', () => {
  it("keeps the heading's accessible name exact when info is passed", () => {
    render(
      <SettingsSection
        title="Watch Region"
        info={<InfoDisclosure label="About Watch Region" description="..." />}
      >
        <p>content</p>
      </SettingsSection>,
    )
    expect(screen.getByRole('heading', { name: 'Watch Region' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'About Watch Region' })).toBeInTheDocument()
  })

  it('renders unchanged when info is omitted', () => {
    render(<SettingsSection title="Export"><p>content</p></SettingsSection>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add `info` to `SettingsSectionProps`; wrap `<h3>` and `{info}` in a new sibling row.

---

## Requirement 3: Wire `InfoDisclosure` into the seven confirmed sites

**User story**: As a user, I want an explanation available for every control in this app whose purpose isn't obvious from its label, without cluttering the panel for the many fields that already are.

### FRONTEND-131-AC-05 [AUTO]: Skip Threshold Override
**Statement**: `SettingsPage.tsx`'s Skip Threshold Override `NumberInput` (inside the "Refresh All" section) shall pass `labelInfo={<InfoDisclosure label="About Skip Threshold Override" description="Series untouched for longer than this are skipped during a refresh, so API calls aren't wasted on shows that clearly aren't airing new episodes. Lower it for more frequent re-checks; raise it to skip stale series for longer." />}`.

**References**: `frontend/src/components/SettingsPage.tsx` lines 373-379.

**Test Case (Red)**:
```typescript
describe('FRONTEND-131-AC-05: Skip Threshold Override has an info disclosure', () => {
  it('renders the disclosure button beside the field', () => {
    render(<SettingsPage {...defaultProps} />)
    expect(
      screen.getByRole('button', { name: 'About Skip Threshold Override' }),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `labelInfo` prop at the referenced call site.

---

### FRONTEND-131-AC-06 [AUTO]: Watch Region
**Statement**: `SettingsPage.tsx`'s "Watch Region" `SettingsSection` shall pass `info={<InfoDisclosure label="About Watch Region" description="Controls which country's streaming availability (e.g. Netflix, Disney+) is shown for your series and recommendations. It doesn't affect search results or ratings — only where-to-watch information." />}`.

**References**: `frontend/src/components/SettingsPage.tsx` lines 473-484.

**Test Case (Red)**:
```typescript
describe('FRONTEND-131-AC-06: Watch Region has an info disclosure', () => {
  it('renders the disclosure button beside the section heading', () => {
    render(<SettingsPage {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'About Watch Region' })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `info` prop at the referenced call site.

---

### FRONTEND-131-AC-07 [AUTO]: Filter Profiles
**Statement**: `SettingsPage.tsx`'s "Filter Profiles" `SettingsSection` shall pass `info={<InfoDisclosure label="About Filter Profiles" description="Named, reusable snapshots of a filter setup. Save your current filters from any filters panel, then reapply them later with one click instead of re-entering them each time." />}`.

**References**: `frontend/src/components/SettingsPage.tsx` lines 489-491.

**Test Case (Red)**:
```typescript
describe('FRONTEND-131-AC-07: Filter Profiles has an info disclosure', () => {
  it('renders the disclosure button beside the section heading', () => {
    render(<SettingsPage {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'About Filter Profiles' })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `info` prop at the referenced call site.

---

### FRONTEND-131-AC-08 [AUTO]: Sort By — Best Match / Most Recommended
**Statement**: `HighestRatedPanel.tsx` shall render `<InfoDisclosure label="About Sort By" description="Best Match ranks by how closely each series matches your own top-rated shows. Most Recommended ranks by how many of your tracked series recommended it, regardless of match quality." />` as a sibling immediately after `</legend>`, only when `!showDiscoverSortByOptions` (the branch rendering the Best Match/Most Recommended pair).

**References**: `frontend/src/components/HighestRatedPanel.tsx` lines 38-40 (fieldset/legend open), lines 26-28 (`showDiscoverSortByOptions`), lines 89-113 (the in-scope branch).

**Test Case (Red)**:
```typescript
describe('FRONTEND-131-AC-08: Sort By has an info disclosure only for Best Match/Most Recommended', () => {
  it('renders the disclosure when the Best Match/Most Recommended pair is shown', () => {
    render(<HighestRatedPanel state={makeState({ mode: 'useMySeries' })} updateState={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'About Sort By' })).toBeInTheDocument()
  })

  it('omits the disclosure when the TMDB-native options are shown instead', () => {
    render(
      <HighestRatedPanel
        state={makeState({ mode: 'discover', discoverMode: 'topRated' })}
        updateState={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'About Sort By' })).not.toBeInTheDocument()
  })
})
```
**Test Case (Green)**: `{!showDiscoverSortByOptions && <InfoDisclosure .../>}` after `</legend>`.

---

### FRONTEND-131-AC-09 [AUTO]: Min Vote Count
**Statement**: `RecommendationFiltersBox.tsx`'s "Min Vote Count" `NumberInput` shall pass `labelInfo={<InfoDisclosure label="About Min Vote Count" description="Filters out titles TMDB has very little voting data for, excluding obscure or newly-added shows whose rating might not be reliable yet." />}`.

**References**: `frontend/src/components/RecommendationFiltersBox.tsx` lines 238-254.

**Test Case (Red)**:
```typescript
describe('FRONTEND-131-AC-09: Min Vote Count has an info disclosure', () => {
  it('renders the disclosure button beside the field', () => {
    render(<RecommendationFiltersBox {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    expect(screen.getByRole('button', { name: 'About Min Vote Count' })).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `labelInfo` prop at the referenced call site.

---

### FRONTEND-131-AC-10 [AUTO]: Min Avg Blended Rating
**Statement**: `NameStatsTable.tsx`'s "Min Avg Blended Rating" `NumberInput` shall pass `labelInfo={<InfoDisclosure label="About Min Avg Blended Rating" description="The average of each series' IMDb and TMDB ratings blended together — distinct from Min Avg Personal Rating, which uses only your own star ratings." />}`.

**References**: `frontend/src/components/NameStatsTable.tsx` lines 202-216. One code change; renders on all three Analysis tabs (Keywords/Genres/Country of Origin) since `KeywordsView`/`GenreStatsView`/`CountryStatsView` all share this component.

**Test Case (Red)**:
```typescript
describe('FRONTEND-131-AC-10: Min Avg Blended Rating has an info disclosure', () => {
  it('renders the disclosure button beside the field, once expanded', async () => {
    vi.mocked(seriesApi.listFilterProfiles).mockResolvedValue([])
    render(<Harness fetchStats={vi.fn().mockResolvedValue([])} />)
    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    expect(
      await screen.findByRole('button', { name: 'About Min Avg Blended Rating' }),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `labelInfo` prop at the referenced call site.

---

### FRONTEND-131-AC-11 [AUTO]: Min Rotten Tomatoes Popcornmeter
**Statement**: Both `SearchFilter.tsx`'s and `UseMySeriesPanel.tsx`'s "Min Rotten Tomatoes Popcornmeter" `NumberInput` fields shall pass `labelInfo={<InfoDisclosure label="About Min Rotten Tomatoes Popcornmeter" description="Rotten Tomatoes' audience score (their own term is 'Popcornmeter') — distinct from the Tomatometer critics' score used by 'Min Rotten Tomatoes Rating' above." />}`; the sibling "Min Rotten Tomatoes Rating" field at each site shall not gain a disclosure.

**References**:
- `frontend/src/components/SearchFilter.tsx` lines 630-644 (Popcornmeter field; Rating field immediately above at lines 614-628, left unchanged).
- `frontend/src/components/UseMySeriesPanel.tsx` lines 624-639 (Popcornmeter field; Rating field immediately above at lines 606-621, left unchanged).

**Test Case (Red)**:
```typescript
// SearchFilter.test.tsx
describe('FRONTEND-131-AC-11: Min Rotten Tomatoes Popcornmeter has an info disclosure', () => {
  it('renders the disclosure only on the Popcornmeter field, not the Rating field', () => {
    render(<SearchFilter isOpen onClose={vi.fn()} onSearch={vi.fn()} onClear={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'About Min Rotten Tomatoes Popcornmeter' }),
    ).toBeInTheDocument()
  })
})

// UseMySeriesPanel.test.tsx
describe('FRONTEND-131-AC-11: Min Rotten Tomatoes Popcornmeter has an info disclosure', () => {
  it('renders the disclosure beside the field', () => {
    render(
      <UseMySeriesPanel
        state={makeState()}
        updateState={vi.fn()}
        allSeries={[makeSeries()]}
        genreOptions={[]}
        keywordOptions={[]}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'About Min Rotten Tomatoes Popcornmeter' }),
    ).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: add the `labelInfo` prop at both referenced call sites.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `NumberInput` component this spec extends with `labelInfo` | `frontend_spec_115_number_input_spinner_styling.md` |
| `SettingsSection` component this spec extends with `info` | `frontend_spec_097_refresh_skip_threshold_override_ui.md` |
| `CollapsibleSection`'s disclosure idiom (pattern-matched, not reused) and its `headingTag` accessible-name precedent | `frontend_spec_123_filter_layout_and_collapsible_sections.md` (`FRONTEND-123-AC-03`) |
| `HighestRatedPanel.tsx`, one of this spec's call sites | `tooling_spec_008_recommendation_controls_decomposition.md` |
| `[data-tooltip]` CSS hover pattern this spec explicitly does not reuse | `frontend/src/components/SeriesList.module.css` |
| Origin of the "Tomatometer"/"Popcornmeter" naming distinction | `frontend/src/components/RecommendationControls.tsx` (Sort By dropdown option label) |
| Resolved UI shape (click-to-toggle, not hover) and original 4-site scope | `.claude/SPEC_CANDIDATES.md` (Info/disclosure boxes entry) |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-131-AC-01: `InfoDisclosure` renders closed by default and toggles its description on click
- [ ] FRONTEND-131-AC-02: the toggle button's `aria-controls` matches the description's generated `id`
- [ ] FRONTEND-131-AC-03: `NumberInput` gains `labelInfo`, rendered as a sibling of `<label>`, zero change when omitted
- [ ] FRONTEND-131-AC-04: `SettingsSection` gains `info`, rendered as a sibling of `<h3>`, zero change when omitted
- [ ] FRONTEND-131-AC-05: Skip Threshold Override has an info disclosure
- [ ] FRONTEND-131-AC-06: Watch Region has an info disclosure
- [ ] FRONTEND-131-AC-07: Filter Profiles has an info disclosure
- [ ] FRONTEND-131-AC-08: Sort By has an info disclosure, only for the Best Match/Most Recommended branch
- [ ] FRONTEND-131-AC-09: Min Vote Count has an info disclosure
- [ ] FRONTEND-131-AC-10: Min Avg Blended Rating has an info disclosure
- [ ] FRONTEND-131-AC-11: Min Rotten Tomatoes Popcornmeter has an info disclosure at both call sites, not its sibling Rating field
