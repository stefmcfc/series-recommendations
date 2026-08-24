# Frontend Spec 029: Searchable Keyword Picker (Shared Component)

**Status**: Not started
**Priority**: P2 (UX improvement — replaces an existing control's interaction shape, no new data capability)
**Depends on**: Frontend Spec 011 (`frontend_spec_011_recommendation_controls.md`, Requirement 5 — the checkbox field this spec replaces) ✅, Frontend Spec 024 (`frontend_spec_024_keyword_tracking.md`, Requirement 7 — the checkbox list this spec replaces, and `GET /series/keywords` consumption pattern) ✅, Series Spec 007 (`series_spec_007_recommendation_sourcing.md`, `SERIES-007-AC-12`–`AC-16` — free-text keyword resolution via `TmdbClient.searchKeyword`) ✅, Series Spec 019 (`series_spec_019_keyword_tracking.md`, `GET /series/keywords`, `SeriesSearchCriteria.keywords` exact-match semantics) ✅, Frontend Spec 008 (`frontend_spec_008_accessible_row_interactions.md` — the no-nested-interactive-controls convention this component follows) ✅
**Frontend Stage**: 29 of N

## Overview

Replaces the two existing keyword-selection controls — `RecommendationControls`' checkbox list under `Genre & Keyword` mode (`frontend_spec_011` Requirement 5) and `SearchFilter`'s collapsible checkbox list (`frontend_spec_024` Requirement 7) — with one new shared component, `KeywordPicker`: a type-to-filter text input with selected keywords rendered as removable chips. `SearchFilter`'s instance additionally gets a "Browse all keywords" modal for browsing/multi-selecting from its larger aggregated vocabulary without typing.

This is a pure frontend change. No backend work is needed: the Recommendations page already resolves arbitrary keyword text server-side via `TmdbClient.searchKeyword` (confirmed by reading `RecommendationService.resolveKeywordIds`, which maps each requested keyword string through `tmdbClient::searchKeyword`, skipping anything unresolvable — `SERIES-007-AC-14`), and `SeriesSearchService`'s keyword matching already does exact, case-insensitive matching against each series' own normalized `keywords` set (`SERIES-019-AC-19`) via the already-existing `GET /series/keywords` endpoint. No new `seriesApi` method is needed either: `RecommendationQuery.keywords` and `seriesApi.getRecommendations` already accept and forward free-text keyword strings unchanged (`frontend_spec_011` `FRONTEND-011-AC-01`/`AC-02`), and `seriesApi.getKeywordStats()` already fetches the tracked-vocabulary list both surfaces need (`frontend_spec_024` `FRONTEND-024-AC-04`). This spec only swaps the interaction shape presented to the user on top of those existing contracts.

**Design decisions**:
- **One component, two modes, driven by whether an `options` vocabulary is supplied.** `KeywordPicker` takes an optional `options: string[]` prop. When provided (`SearchFilter`, and its modal), typed input filters against that list and only a listed option can be added — the "vocabulary-constrained" case. When omitted (`RecommendationControls`), any non-empty typed text can be added directly as a chip — the "free-text" case. This mirrors the exact two-cases split already settled for these two surfaces (`SCRATCH_NEW_IDEAS_2026-08-24.md` item 2's Decision): Recommendations should be able to discover keywords for series not yet tracked, while the List-page filter intentionally stays constrained to keywords that already exist among tracked series (there is nothing else for it to match against — `SERIES-019-AC-19`'s exact-match semantics mean a keyword absent from `GET /series/keywords` could never match any tracked series anyway).
- **No ARIA combobox/listbox roving-tabindex machinery.** The constrained mode's filtered suggestions render as a plain list of `<button>` elements below the input, activated by click or (for the first visible match) Enter — not a full `role="combobox"`/`role="listbox"` pattern with arrow-key navigation. This keeps the component's scope in line with this project's established "small, self-contained first pass" sizing (the same posture `KeywordsView`'s plain-table-not-chart choice and `frontend_spec_024`'s Requirement 7 disclosure toggle both took) — a richer combobox pattern can be added later if it's ever actually missed.
- **`SearchFilter`'s inline picker no longer needs a collapsed-by-default disclosure toggle** (`frontend_spec_024` `FRONTEND-024-AC-20`–`AC-23`, superseded by this spec — see Requirement 3). An empty input renders no suggestion list at all, so the inline control's footprint is just the text input plus however many chips are already selected — it can never itself push page content down the way an always-rendered checkbox list could, without needing a separate open/closed toggle to manage that.
- **The "Browse all keywords" modal (Requirement 4) reuses `KeywordPicker` internally**, in a `role="dialog"` overlay following the exact existing modal pattern `AddSeriesForm`/`EditSeriesForm` already established (`frontend_spec_003_add_series_form.md` `FRONTEND-003-AC-05`–`AC-09`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus-on-mount, Escape-to-dismiss, no React portal) — not a new modal mechanism.
- **The modal and the inline control share one selection state** (`SearchFilter`'s `form.keywordsSelected`), not two independently-tracked lists — a keyword added or removed inside the modal is immediately reflected in the inline chips the moment the modal closes (or even while it's still open, since both read the same array), avoiding a confusing "did my modal selection actually apply?" moment.
- **Supersedes, not merely amends, the prior checkbox-list UI.** `frontend_spec_024_keyword_tracking.md` Requirement 7 (`FRONTEND-024-AC-20`–`AC-24`, the collapsed/scrollable checkbox list) and `frontend_spec_011_recommendation_controls.md` Requirement 5 (`FRONTEND-011-AC-14`–`AC-18`, the `Genre & Keyword` mode's keyword checkbox list) are both replaced outright by this spec's Requirements 2 and 3 respectively — those ACs describe UI that no longer exists once this spec ships. Neither of those spec files is being edited to reflect that (mirroring the precedent `frontend_spec_008` set when it superseded `frontend_spec_002` Requirement 7's `role="button"`-row approach without rewriting that spec in place) — this spec's own header and Requirements 2/3 are the current source of truth for both fields' contracts.

---

## Requirements

### Requirement 1: Shared `KeywordPicker` Component

**User story**: As a developer, I want one reusable keyword-selection control with a consistent search-and-chips interaction, so the Recommendations and List-page keyword fields don't each reinvent (and separately maintain) their own picker UI.

**Shape**:
```typescript
interface KeywordPickerProps {
  id: string
  label: string
  selected: string[]
  onChange: (next: string[]) => void
  options?: string[]        // present => vocabulary-constrained; absent => free text
  placeholder?: string
}
```

#### Acceptance Criteria

- **FRONTEND-029-AC-01** [AUTO]: A new `KeywordPicker` component (`src/components/KeywordPicker.tsx`) shall render a text `<input>` with an associated `<label htmlFor>` using the `label` prop's text, so the input is queryable via `getByLabelText`.
- **FRONTEND-029-AC-02** [AUTO]: When `options` is not provided (free-text mode), pressing `Enter` in the input while its trimmed value is non-empty shall call `onChange` with `[...selected, trimmedValue]` and clear the input.
- **FRONTEND-029-AC-03** [AUTO]: When `options` is provided (vocabulary-constrained mode), typing in the input shall render every entry of `options` whose value contains the typed text (case-insensitive substring match) as a clickable suggestion `<button>` in a list below the input; an empty input value shall render no suggestion list, and typed text matching no option shall likewise render no suggestions.
- **FRONTEND-029-AC-04** [AUTO]: In vocabulary-constrained mode, clicking a suggestion button, or pressing `Enter` while at least one suggestion is showing (the first-listed match), shall call `onChange` with that option appended to `selected` and clear the input; typed text that matches no option shall not be addable via `Enter` (no call to `onChange`).
- **FRONTEND-029-AC-05** [AUTO]: Attempting to add a keyword that case-insensitively already exists in `selected` (either mode) shall be a no-op — `onChange` is not called, and no duplicate chip is added.
- **FRONTEND-029-AC-06** [AUTO]: Each entry of `selected` shall render as a chip containing the keyword's text and an explicit remove `<button type="button" aria-label="Remove {keyword}">`; clicking it shall call `onChange` with that keyword excluded from the array (all other entries preserved in order).
- **FRONTEND-029-AC-07** [AUTO]: Pressing `Backspace` while the input's value is empty and `selected` is non-empty shall call `onChange` with the last entry of `selected` removed; pressing `Backspace` while the input's value is non-empty shall only edit the input text and shall not call `onChange`.
- **FRONTEND-029-AC-08** [AUTO]: The `<li>` wrapping each chip shall carry no `role` or `tabIndex` attribute — matching `frontend_spec_008_accessible_row_interactions.md`'s established pattern of keeping a list item non-interactive itself, with only the chip's own remove `<button>` (a sibling of the chip's text, not nested inside another interactive element) actually interactive.

---

### Requirement 2: Recommendations-Page Integration — Free Text

**User story**: As a user picking `Genre & Keyword` sourcing mode on the Recommendations page, I want to type any keyword — including one no tracked series of mine carries yet — so I can discover recommendations for shows I haven't watched anything similar to before.

#### Acceptance Criteria

- **FRONTEND-029-AC-09** [AUTO]: `RecommendationControls`' `Genre & Keyword` mode's Keywords field shall render `<KeywordPicker>` in free-text mode (no `options` prop), replacing the checkbox multi-select added by `frontend_spec_011_recommendation_controls.md` Requirement 5 — backed by `state.keywordsSelected`, with `onChange` calling `updateState({ keywordsSelected: next })`.
- **FRONTEND-029-AC-10** [AUTO]: Keyword strings added via the picker shall populate `RecommendationQuery.keywords` exactly as `keywordsSelected` already does today (`buildQuery`, unchanged) — resolved server-side on submit via the existing `TmdbClient.searchKeyword` flow (`series_spec_007_recommendation_sourcing.md`, `SERIES-007-AC-14`), with no client-side restriction to `GET /series/keywords`' tracked-only vocabulary.
- **FRONTEND-029-AC-11** [AUTO]: `RecommendationControls` shall no longer call `seriesApi.getKeywordStats()` — the fetch, its `keywordOptions`/`keywordOptionsError` state, and the scoped error rendering it fed (all added by `frontend_spec_011` Requirement 5, now dead code once the field is free text) shall be removed.
- **FRONTEND-029-AC-12** [AUTO]: Switching sourcing mode away from `Genre & Keyword` shall still clear `keywordsSelected` — the existing mode-switch-clearing behavior (`FRONTEND-011-AC-16`) is unaffected by this requirement.
- **FRONTEND-029-AC-13** [AUTO]: The existing "enter at least one genre or keyword" hint (`showGenreKeywordHint`, `FRONTEND-011-AC-05`/`AC-17`) shall continue to be computed from `keywordsSelected.length === 0`, unaffected by this requirement.

---

### Requirement 3: List-Page Inline Integration — Vocabulary-Constrained

**User story**: As a user filtering my tracked series list, I want to type to narrow a long keyword vocabulary down to what I'm looking for, instead of scrolling a checkbox list, while still only ever matching keywords that actually exist among my tracked series.

#### Acceptance Criteria

- **FRONTEND-029-AC-14** [AUTO]: `SearchFilter`'s keyword field shall render `<KeywordPicker>` in vocabulary-constrained mode, with `options` set to the `name` values from `seriesApi.getKeywordStats()` (fetched on mount, unchanged from today) and backed by `form.keywordsSelected` — replacing the collapsed-by-default checkbox list added by `frontend_spec_024_keyword_tracking.md` Requirement 7.
- **FRONTEND-029-AC-15** [AUTO]: While the picker's input is empty, no suggestion list shall render — per Design Decisions, this is the mechanism that keeps the inline control's default footprint bounded, replacing the prior disclosure toggle (`FRONTEND-024-AC-20`–`AC-23`); there is no separate open/closed state to test, since "nothing typed" and "collapsed" are the same state.
- **FRONTEND-029-AC-16** [AUTO]: Selected keyword names shall be included in the criteria object built on Search as `criteria.keywords: string[]`, omitted (not sent as an empty array) when nothing is selected — unchanged contract from `FRONTEND-024-AC-13`.
- **FRONTEND-029-AC-17** [AUTO]: If the `GET /series/keywords` fetch fails, the keyword field shall render a scoped inline error (unchanged from `FRONTEND-024-AC-14`'s degrade-gracefully posture) with `options` treated as empty — the picker still renders (so any already-selected chips remain visible/removable) but offers no suggestions, without blocking the rest of `SearchFilter` from rendering or functioning.

---

### Requirement 4: List-Page "Browse All Keywords" Modal

**User story**: As a user with a large tracked-keyword vocabulary, I want to browse the full list in a dedicated view rather than only ever narrowing it by typing, so I can find a keyword even if I don't remember exactly how it's spelled or worded.

#### Acceptance Criteria

- **FRONTEND-029-AC-18** [AUTO]: `SearchFilter` shall render a "Browse all keywords" button adjacent to the inline keyword field; clicking it shall open a modal dialog (`role="dialog"`, `aria-modal="true"`, `aria-labelledby` referencing a visible "Browse Keywords" heading), following the exact overlay/dialog structure `AddSeriesForm`/`EditSeriesForm` already use (`frontend_spec_003_add_series_form.md`, `FRONTEND-003-AC-05`) — no React portal.
- **FRONTEND-029-AC-19** [AUTO]: The modal shall render the same shared `<KeywordPicker>` in vocabulary-constrained mode, passed the identical `options`/`selected={form.keywordsSelected}`/`onChange` as the inline instance (Requirement 3) — not a second, independently-tracked selection — so a keyword added or removed inside the modal is reflected in the inline chips immediately.
- **FRONTEND-029-AC-20** [AUTO]: When the modal mounts, its `KeywordPicker` input shall receive focus, mirroring `AddSeriesForm`'s existing focus-on-mount convention (`FRONTEND-003-AC-06`).
- **FRONTEND-029-AC-21** [AUTO]: Pressing `Escape` while the modal is open shall close it (mirroring `FRONTEND-003-AC-08`/`FRONTEND-004-AC-19`'s Escape-to-dismiss convention) without clearing `form.keywordsSelected` — any selections made stay applied to the underlying `SearchFilter` form.
- **FRONTEND-029-AC-22** [AUTO]: The modal shall render a "Done" button that also closes it, equivalent to `Escape`.
- **FRONTEND-029-AC-23** [AUTO]: Opening the modal shall not trigger a new `seriesApi.getKeywordStats()` call — it reuses the `options` array `SearchFilter` already fetched for the inline picker (Requirement 3).

---

### Requirement 5: Accessibility

**User story**: As a user relying on assistive technology, I want the keyword picker — in all three places it appears — to be fully operable and correctly announced, so replacing the old checkbox lists doesn't regress accessibility.

#### Acceptance Criteria

- **FRONTEND-029-AC-24** [AUTO]: In every embedding (`RecommendationControls`, `SearchFilter`'s inline field, the browse-all modal), the `KeywordPicker` input shall be reachable via `getByLabelText` using that embedding's own `label` text (e.g. "Keywords") — confirming the label/input association from `FRONTEND-029-AC-01` holds through each integration, not just the component in isolation.
- **FRONTEND-029-AC-25** [AUTO]: Every interactive element `KeywordPicker` renders (suggestion buttons, chip-remove buttons) shall have a non-empty accessible name — suggestion buttons via their own visible text content, remove buttons via their `aria-label` (`FRONTEND-029-AC-06`) — confirmed via `getByRole('button', { name: ... })` queries rather than relying on visual position alone.
- **FRONTEND-029-AC-26** [MANUAL]: A real-browser `@axe-core/react` pass, in both light and dark `prefers-color-scheme`, over `RecommendationControls`' `Genre & Keyword` mode, `SearchFilter`'s inline keyword field, and the open "Browse all keywords" modal, shall report zero new violations attributable to `KeywordPicker` (in particular: no "nested-interactive", "list", or "aria-allowed-role" findings — the same classes `frontend_spec_008_accessible_row_interactions.md` fixed for `SeriesList` — and no color-contrast finding on the chip/suggestion styling). Verified by loading the app with tracked series and keywords present, driving each of the three embeddings, and inspecting the browser console per `.claude/skills/verify/SKILL.md`'s existing convention (no CI check exists for this, same precedent as `FRONTEND-008-AC-07`).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Checkbox-list UI this spec's Requirement 2 replaces (`ControlsState.keywordsSelected`, `getKeywordStats()` fetch, `Genre & Keyword` mode) — **superseded, not amended** | `frontend_spec_011_recommendation_controls.md`, Requirement 5 (`FRONTEND-011-AC-14`–`AC-18`) |
| Checkbox-list UI this spec's Requirement 3 replaces (collapsed-by-default disclosure, `max-height`/`overflow-y` bounded list) — **superseded, not amended** | `frontend_spec_024_keyword_tracking.md`, Requirement 7 (`FRONTEND-024-AC-20`–`AC-24`) |
| `seriesApi.getKeywordStats(sortBy?)`, `KeywordStat` type, `GET /series/keywords` `{ data, count }` envelope | `frontend_spec_024_keyword_tracking.md`, Requirement 1 (`FRONTEND-024-AC-04`); `series_spec_019_keyword_tracking.md`, Requirement 4 |
| `SeriesSearchCriteria.keywords` exact, case-insensitive match semantics against a series' normalized `keywords` set — the reason the List-page picker stays vocabulary-constrained | `series_spec_019_keyword_tracking.md`, `SERIES-019-AC-18`/`AC-19` |
| `TmdbClient.searchKeyword`-backed free-text keyword resolution on `GET /series/recommendations` — the reason the Recommendations picker allows free text | `series_spec_007_recommendation_sourcing.md`, `SERIES-007-AC-12`–`AC-16` |
| `RecommendationQuery.keywords`, `seriesApi.getRecommendations`, `buildQuery` | `frontend_spec_011_recommendation_controls.md`, Requirement 1 |
| `SearchCriteria.keywords`, `buildSearchParams`'s `params.keyword` handling | `frontend_spec_024_keyword_tracking.md`, `FRONTEND-024-AC-03`/`AC-05` |
| No-nested-interactive-controls convention (`<li>` carries no `role`/`tabIndex`; only a real `<button>` inside it is interactive) that `KeywordPicker`'s chip markup follows | `frontend_spec_008_accessible_row_interactions.md` |
| Modal dialog structure (`role="dialog"`, `aria-modal`, `aria-labelledby`, focus-on-mount, Escape-to-dismiss, no portal) the "Browse all keywords" modal reuses | `frontend_spec_003_add_series_form.md`, `FRONTEND-003-AC-05`–`AC-09`; `frontend_spec_004_edit_delete_series.md`, `FRONTEND-004-AC-19` |
| `@axe-core/react` dev-console verification convention, dark/light `prefers-color-scheme` gotcha | `frontend_spec_008_accessible_row_interactions.md`, `FRONTEND-008-AC-07`; `.claude/skills/verify/SKILL.md`; root `CLAUDE.md` |
| Decision to build one shared component (search + chips) reused on both surfaces, plus the List-page modal, rather than two separate fixes | `SCRATCH_NEW_IDEAS_2026-08-24.md`, items 2 and 6 |

---

## TDD Test Case Sketches

### `src/components/KeywordPicker.test.tsx` (new file)

```typescript
describe('FRONTEND-029-AC-01: labelled input', () => {
  it('renders an input reachable by its label text', () => {
    render(<KeywordPicker id="kw" label="Keywords" selected={[]} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Keywords')).toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-02: free-text mode adds on Enter', () => {
  it('adds the trimmed input value on Enter and clears the input', () => {
    const onChange = vi.fn()
    render(<KeywordPicker id="kw" label="Keywords" selected={[]} onChange={onChange} />)

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: '  spy  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['spy'])
    expect(input).toHaveValue('')
  })
})

describe('FRONTEND-029-AC-03/04: vocabulary-constrained mode filters and adds via click', () => {
  it('shows matching suggestions as the user types, and adds one on click', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker
        id="kw"
        label="Keywords"
        selected={[]}
        onChange={onChange}
        options={['spy', 'period drama', 'heist']}
      />,
    )

    const input = screen.getByLabelText('Keywords')
    expect(screen.queryByRole('button', { name: 'spy' })).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'sp' } })
    expect(screen.getByRole('button', { name: 'spy' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'heist' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'spy' }))
    expect(onChange).toHaveBeenCalledWith(['spy'])
    expect(input).toHaveValue('')
  })

  it('does not add anything on Enter when the typed text matches no option', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker id="kw" label="Keywords" selected={[]} onChange={onChange} options={['spy']} />,
    )

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'zzz' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-029-AC-05: duplicate add is a no-op', () => {
  it('does not call onChange when the keyword is already selected', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker id="kw" label="Keywords" selected={['spy']} onChange={onChange} />,
    )

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'spy' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-029-AC-06: chip remove button', () => {
  it('removes the keyword when its remove button is clicked', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker id="kw" label="Keywords" selected={['spy', 'heist']} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove spy' }))
    expect(onChange).toHaveBeenCalledWith(['heist'])
  })
})

describe('FRONTEND-029-AC-07: Backspace-on-empty removes the last chip', () => {
  it('removes the last selected keyword on Backspace when the input is empty', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker id="kw" label="Keywords" selected={['spy', 'heist']} onChange={onChange} />,
    )

    fireEvent.keyDown(screen.getByLabelText('Keywords'), { key: 'Backspace' })
    expect(onChange).toHaveBeenCalledWith(['spy'])
  })

  it('does not remove a chip on Backspace when the input has text', () => {
    const onChange = vi.fn()
    render(
      <KeywordPicker id="kw" label="Keywords" selected={['spy']} onChange={onChange} />,
    )

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'x' } })
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-029-AC-08: chip list item is not itself interactive', () => {
  it('the chip <li> has no role or tabIndex', () => {
    render(<KeywordPicker id="kw" label="Keywords" selected={['spy']} onChange={vi.fn()} />)
    const chip = screen.getByText('spy').closest('li')
    expect(chip).not.toHaveAttribute('role')
    expect(chip).not.toHaveAttribute('tabindex')
  })
})
```

### `src/components/RecommendationControls.test.tsx` (amendments)

```typescript
describe('FRONTEND-029-AC-09/10: free-text keyword picker replaces the checkbox list', () => {
  it('adds a typed keyword to the query without fetching keyword options', async () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'submarine' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ keywords: ['submarine'] }),
    )
  })
})

describe('FRONTEND-029-AC-11: no longer fetches seriesApi.getKeywordStats', () => {
  it('does not call getKeywordStats on mount', () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    expect(seriesApi.getKeywordStats).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-029-AC-12: mode switch still clears keywordsSelected', () => {
  it('clears typed keywords when switching away from Genre & Keyword', () => {
    const onQueryChange = vi.fn()
    render(<RecommendationControls onQueryChange={onQueryChange} />)

    fireEvent.click(screen.getByLabelText(/genre & keyword/i))
    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'submarine' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByLabelText(/specific series/i))

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ keywords: expect.anything() }),
    )
  })
})
```

### `src/components/SearchFilter.test.tsx` (amendments)

```typescript
describe('FRONTEND-029-AC-14/15/16: inline vocabulary-constrained picker', () => {
  it('shows no suggestions until text is typed, and includes a chosen keyword on Search', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    const onSearch = vi.fn()
    render(<SearchFilter onSearch={onSearch} onClear={vi.fn()} />)

    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'spy' })).not.toBeInTheDocument()

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.click(screen.getByRole('button', { name: 'spy' }))
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: ['spy'] }))
  })
})

describe('FRONTEND-029-AC-17: keyword fetch failure degrades gracefully', () => {
  it('renders a scoped error and still renders the rest of SearchFilter', async () => {
    mockGetKeywordStats.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-18/19/20/21/22: browse-all-keywords modal', () => {
  it('opens a labelled dialog, focuses its input, and shares selection state with the inline picker', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /browse all keywords/i }))
    const dialog = screen.getByRole('dialog', { name: /browse keywords/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByLabelText('Keywords')).toHaveFocus()

    fireEvent.change(within(dialog).getByLabelText('Keywords'), { target: { value: 'sp' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'spy' }))

    fireEvent.click(within(dialog).getByRole('button', { name: /^done$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove spy' })).toBeInTheDocument()
  })

  it('closes on Escape without clearing selections', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /browse all keywords/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Keywords'), { target: { value: 'sp' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'spy' }))

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove spy' })).toBeInTheDocument()
  })
})

describe('FRONTEND-029-AC-23: opening the modal does not re-fetch keyword options', () => {
  it('calls getKeywordStats exactly once across mount + modal open', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /browse all keywords/i }))
    expect(mockGetKeywordStats).toHaveBeenCalledTimes(1)
  })
})
```

### Accessibility (`FRONTEND-029-AC-24`/`AC-25`)

```typescript
describe('FRONTEND-029-AC-24/25: accessible names across embeddings', () => {
  it('RecommendationControls keyword field is reachable by label with named buttons', async () => {
    render(<RecommendationControls onQueryChange={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(/genre & keyword/i))

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'spy' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByRole('button', { name: 'Remove spy' })).toBeInTheDocument()
  })

  it('SearchFilter inline keyword field is reachable by label with named suggestion/remove buttons', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 4, averagePersonalRating: 4.2 },
    ])
    render(<SearchFilter onSearch={vi.fn()} onClear={vi.fn()} />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    const input = screen.getByLabelText('Keywords')
    fireEvent.change(input, { target: { value: 'sp' } })
    expect(screen.getByRole('button', { name: 'spy' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'spy' }))
    expect(screen.getByRole('button', { name: 'Remove spy' })).toBeInTheDocument()
  })
})
```

`FRONTEND-029-AC-26` is verified manually — see the AC statement above for the exact real-browser procedure.

---

## Acceptance Criteria Summary

- [ ] FRONTEND-029-AC-01: `KeywordPicker` renders a labelled text input
- [ ] FRONTEND-029-AC-02: free-text mode adds trimmed value on Enter, clears input
- [ ] FRONTEND-029-AC-03: constrained mode filters `options` as you type; empty/no-match input renders no suggestions
- [ ] FRONTEND-029-AC-04: constrained mode adds via suggestion click or Enter-on-first-match; unmatched text isn't addable
- [ ] FRONTEND-029-AC-05: adding an already-selected keyword (case-insensitive) is a no-op
- [ ] FRONTEND-029-AC-06: each chip has an explicit, accessibly-named remove button
- [ ] FRONTEND-029-AC-07: Backspace-on-empty-input removes the last chip; non-empty input Backspace does not
- [ ] FRONTEND-029-AC-08: chip `<li>` carries no `role`/`tabIndex`, matching `frontend_spec_008`'s pattern
- [ ] FRONTEND-029-AC-09: `RecommendationControls` Genre & Keyword field uses `KeywordPicker` in free-text mode, replacing the checkbox list
- [ ] FRONTEND-029-AC-10: added keywords populate `RecommendationQuery.keywords` unchanged, resolved server-side, unconstrained by tracked vocabulary
- [ ] FRONTEND-029-AC-11: `RecommendationControls` no longer calls `getKeywordStats()`
- [ ] FRONTEND-029-AC-12: mode-switch clearing of `keywordsSelected` unaffected
- [ ] FRONTEND-029-AC-13: at-least-one-genre-or-keyword hint unaffected
- [ ] FRONTEND-029-AC-14: `SearchFilter` keyword field uses `KeywordPicker` in constrained mode, options from `getKeywordStats()`, replacing the checkbox list
- [ ] FRONTEND-029-AC-15: empty input renders no suggestion list (replaces the disclosure toggle)
- [ ] FRONTEND-029-AC-16: selected keywords included in `criteria.keywords`, omitted when empty
- [ ] FRONTEND-029-AC-17: failed `getKeywordStats()` fetch degrades gracefully, scoped error, picker still usable
- [ ] FRONTEND-029-AC-18: "Browse all keywords" button opens a labelled `role="dialog"` modal
- [ ] FRONTEND-029-AC-19: modal's `KeywordPicker` shares `SearchFilter`'s own `form.keywordsSelected` state
- [ ] FRONTEND-029-AC-20: modal's input receives focus on mount
- [ ] FRONTEND-029-AC-21: Escape closes the modal without clearing selections
- [ ] FRONTEND-029-AC-22: a "Done" button also closes the modal
- [ ] FRONTEND-029-AC-23: opening the modal does not trigger a new `getKeywordStats()` fetch
- [ ] FRONTEND-029-AC-24: `KeywordPicker` input is reachable by label text in every embedding
- [ ] FRONTEND-029-AC-25: every `KeywordPicker`-rendered button has a non-empty accessible name
- [ ] FRONTEND-029-AC-26: real-browser `@axe-core/react` pass (light + dark) across all three embeddings reports zero new violations
