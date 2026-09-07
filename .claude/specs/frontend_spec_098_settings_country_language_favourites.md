# Frontend Spec 098: Country/Language Favourites & Shared `useLocalStorage` Hook

**Status**: Done
**Priority**: P3
**Depends on**: `frontend_spec_097_refresh_skip_threshold_override_ui.md` (introduces `SettingsSection`, consumed here), `frontend_spec_054_series_list_compact_view.md` (the `localStorage` read/write/silent-degradation pattern this spec generalizes into a shared hook), `frontend_spec_047` (the original hardcoded `COUNTRY_PINNED_OPTIONS`/`LANGUAGE_PINNED_CODES` this spec makes user-editable)
**Area**: Frontend (`hooks/useLocalStorage.ts` (new), `components/SeriesList.tsx`, `components/RecommendationControls.tsx`, `components/CustomSearchPanel.tsx`, `components/RecommendationFiltersBox.tsx`, `components/SettingsPage.tsx`, `utils/countryOptions.ts`, and each affected file's tests)

## Overview

Makes Custom Search's pinned Country/Language chips user-editable from `/settings`, instead of the
hardcoded `COUNTRY_PINNED_OPTIONS = ['US', 'GB']` / `LANGUAGE_PINNED_CODES = ['en', 'es', 'fr',
'de', 'ja', 'ko']` constants in `RecommendationControls.tsx`. Confirmed via codebase research: this
app has zero backend settings/preference persistence anywhere, and a single-user local app with no
auth/multi-user concept has no real need for one — `localStorage` is sufficient, and this app
already has exactly one precedent for it: `SeriesList.tsx`'s view-mode toggle
(`frontend_spec_054`), implemented inline with no shared hook. This spec generalizes that pattern
into `useLocalStorage` (this app's first shared storage hook — past its own stated "extract on a
second consumer" bar, since this spec adds two new consumers, favourites being genuinely a third
and fourth pinned-list) and migrates `SeriesList.tsx` onto it in the same change, so the app doesn't
end up with two parallel `localStorage` implementations.

## Design Decisions

- **The favourites editor's option catalog must be decoupled from what's currently pinned — a
  real coupling bug in the current code that this spec has to fix, not just work around.**
  Confirmed by reading `RecommendationControls.tsx`: `LANGUAGE_OPTION_CODES` (backing the full
  `LANGUAGE_OPTIONS` list `KeywordPicker` searches) is built as `[...LANGUAGE_PINNED_CODES, 'it',
  'zh', 'pt', 'hi', 'sv', 'da', 'no', 'nl']` — a spread of the *pinned* list plus 8 more. Once
  `LANGUAGE_PINNED_CODES` becomes a runtime `useLocalStorage` value instead of a module-level
  constant, this spread can no longer happen at module scope, and even if it could, a user
  un-pinning a language would silently remove it from the *entire searchable list*, not just the
  pinned shortcut — a real behavior regression, not just a technical hurdle. Fix: `LANGUAGE_OPTION_CODES`
  becomes its own independent static array of all 14 codes (`['en', 'es', 'fr', 'de', 'ja', 'ko',
  'it', 'zh', 'pt', 'hi', 'sv', 'da', 'no', 'nl']` — identical membership to today's derived list,
  just no longer derived), and the favourites default (`['en', 'es', 'fr', 'de', 'ja', 'ko']`) is
  its own separate constant. Country doesn't have this coupling today (`COUNTRY_OPTIONS`,
  `utils/countryOptions.ts`, is already independent of `COUNTRY_PINNED_OPTIONS`, deliberately
  excluding US/GB) but needs its own fix for a different reason — see the next point.
- **The favourites editor needs a wider option catalog than either existing list on its own.**
  `COUNTRY_OPTIONS` (18 codes) deliberately excludes US/GB (they're only ever supplied via
  `pinnedOptions` today); if the Settings editor only offered those 18, a user could never re-add US
  or GB after removing them, or even see them as a starting point. New export `ALL_COUNTRY_OPTIONS`
  (`utils/countryOptions.ts`) — `COUNTRY_OPTIONS` plus `US`/`GB`, 20 total — used only by the
  favourites editor and its stored-value validator; `COUNTRY_OPTIONS` itself is untouched, still the
  disjoint "searchable rest" list `CustomSearchPanel`/`RecommendationFiltersBox` pass as `options`
  for the *live* Discover picker (unaffected by this spec — `KeywordPicker` already dedupes a
  `pinnedOptions` entry against `options` at render time, confirmed by reading
  `resolvePinnedOptions`/`visiblePinned` in `KeywordPicker.tsx`, so Country's existing
  disjoint-lists shape and Language's existing overlapping-lists shape both continue to render
  correctly with no `KeywordPicker` changes needed).
- **`useLocalStorage` is generic and JSON-serializing**, not `SeriesList`'s current bare-string
  `localStorage.setItem`. A `string[]` favourites value can't be represented as a bare string, so
  the shared hook has to serialize — this is *why* the hook is built here (spec 2) rather than
  spec 3 (the simpler, single-string-enum dark-mode toggle): this spec is the one under real design
  pressure to get the hook's generic shape right.
- **Migrating `SeriesList.tsx` changes `seriesListViewMode`'s on-disk format** from a bare string
  (`compact`) to JSON (`"compact"`). Any real user's currently-stored value fails `JSON.parse` on
  next load, silently falls back to `isValid`'s default, and resets to `expanded` once — a
  one-time, low-stakes reset, consistent with the existing code's own "nice-to-have, not a
  requirement" framing for this exact failure mode. `SeriesList.test.tsx`'s `FRONTEND-054-AC-03`
  block's literal `localStorage.setItem('seriesListViewMode', 'compact')`-style assertions need
  updating to `JSON.stringify('compact')` as part of this same spec, not left broken.
- **No cross-tab/live sync.** `CustomSearchPanel`/`RecommendationFiltersBox` already fully unmount
  and remount on Discover-mode switches — an edit made on `/settings` is picked up the next time the
  user switches into that panel, with no `storage`-event listener or React Context needed. This is a
  deliberate scope boundary, not an oversight: nothing in this app currently keeps two mounted
  components in sync with each other's `localStorage` writes, and this spec doesn't need to be the
  first.
- **The Settings editor instances pass no `pinnedOptions` prop.** They render the full catalog with
  the current favourites as `selected` — the editor *is* what produces the pinned list elsewhere, it
  isn't itself a pinned-shortcut consumer.

## Requirements

### Requirement 1: Shared `useLocalStorage` hook

**User story**: As a developer, I want one shared, tested `localStorage` read/write pattern, so this
spec's two new consumers (and any future one) don't each reimplement `SeriesList.tsx`'s bespoke
version.

#### Acceptance Criteria

- **FRONTEND-098-AC-01** [AUTO]: A new `useLocalStorage<T>(key: string, defaultValue: T, isValid:
  (value: unknown) => value is T): [T, (value: T) => void]` hook (`hooks/useLocalStorage.ts`) shall
  read the stored value once on mount (JSON-parsed), returning `defaultValue` if nothing is stored,
  if parsing throws, or if the parsed value fails `isValid`.
- **FRONTEND-098-AC-02** [AUTO]: The hook shall write the current value (JSON-serialized) to
  `localStorage` on every change, and shall silently swallow any read or write failure (private
  browsing, quota, storage disabled) rather than throwing — mirroring `SeriesList.tsx`'s existing
  try/catch-and-degrade contract exactly.

---

### Requirement 2: Migrate `SeriesList`'s view-mode toggle onto the shared hook

**User story**: As a developer, I don't want two parallel `localStorage` implementations coexisting
in this codebase once a shared one exists.

#### Acceptance Criteria

- **FRONTEND-098-AC-03** [AUTO]: `SeriesList.tsx`'s `viewMode` state shall be sourced from
  `useLocalStorage('seriesListViewMode', DEFAULT_VIEW_MODE, isViewMode)`, replacing its own
  `readStoredViewMode`/write-`useEffect` pair; `isViewMode`'s signature changes from `(value: string
  | null): value is ViewMode` to `(value: unknown): value is ViewMode`, same body
  (`VIEW_MODES.includes(value)` guarded by a `typeof value === 'string'` check).
- **FRONTEND-098-AC-04** [AUTO]: Every existing `FRONTEND-054-AC-03` behavior (persists across
  reload, degrades silently on a read failure, falls back on an unrecognized stored value) continues
  to pass, with `SeriesList.test.tsx`'s literal `localStorage.setItem`/`getItem` assertions updated
  from bare strings to `JSON.stringify(...)`/`JSON.parse(...)` to match the new on-disk format.

---

### Requirement 3: Country/Language favourites storage & catalog

**User story**: As a user, I want my own choice of pinned countries/languages to persist, instead of
always seeing the same hardcoded US/GB and six languages.

#### Acceptance Criteria

- **FRONTEND-098-AC-05** [AUTO]: `utils/countryOptions.ts` shall export a new
  `ALL_COUNTRY_OPTIONS: PickerOption[]` — `COUNTRY_OPTIONS` plus `US`/`GB` (20 entries total) — used
  only by the favourites editor and its validator; `COUNTRY_OPTIONS` itself is unchanged.
- **FRONTEND-098-AC-06** [AUTO]: `RecommendationControls.tsx`'s `LANGUAGE_OPTION_CODES` (and
  therefore `LANGUAGE_OPTIONS`) shall become an independent static array of all 14 codes, no longer
  derived via spread from `LANGUAGE_PINNED_CODES` — identical membership to today's list.
- **FRONTEND-098-AC-07** [AUTO]: `COUNTRY_PINNED_OPTIONS`/`LANGUAGE_PINNED_CODES` shall no longer be
  module-level constants — `CustomSearchPanel.tsx` and `RecommendationFiltersBox.tsx` shall each
  call `useLocalStorage('countryFavourites', DEFAULT_COUNTRY_FAVOURITES, isCountryFavourites)` (and
  the language equivalent, `'languageFavourites'`) directly and pass the resulting value as
  `pinnedOptions`.
- **FRONTEND-098-AC-08** [AUTO]: `DEFAULT_COUNTRY_FAVOURITES`/`DEFAULT_LANGUAGE_FAVOURITES` shall be
  `['US', 'GB']`/`['en', 'es', 'fr', 'de', 'ja', 'ko']` — identical to today's hardcoded values, so a
  user who has never opened Settings sees unchanged behavior.
- **FRONTEND-098-AC-09** [AUTO]: A stored favourites value that isn't an array of strings, or
  contains any code not present in `ALL_COUNTRY_OPTIONS`/`LANGUAGE_OPTION_CODES`, shall be rejected
  by the validator and fall back to the default — a stale or corrupted stored value can never inject
  an unrecognized chip into either picker.

---

### Requirement 4: Settings editor UI

**User story**: As a user, I want to edit my Country/Language favourites from the Settings page,
the same way I'll be able to adjust other preferences there.

#### Acceptance Criteria

- **FRONTEND-098-AC-10** [AUTO]: `SettingsPage.tsx` shall render a `<SettingsSection
  title="Recommendation Favourites">` containing two `KeywordPicker` instances — Country Favourites
  (`options={ALL_COUNTRY_OPTIONS}`, `selected` = the current country favourites, `onChange` = the
  hook's setter) and Language Favourites (`options={LANGUAGE_OPTIONS}`, same shape) — neither
  passing a `pinnedOptions` prop.
- **FRONTEND-098-AC-11** [AUTO]: Changing a selection in either editor immediately updates
  `localStorage` (via the shared hook's write-on-change behavior, Requirement 1) — no separate Save
  button, matching this app's existing `KeywordPicker`-as-live-multi-select convention elsewhere
  (e.g. `SearchFilter`'s Keywords field).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `localStorage` pattern this spec generalizes into `useLocalStorage` | `frontend_spec_054_series_list_compact_view.md`, `frontend/src/components/SeriesList.tsx` |
| Original hardcoded pinned-chip feature this spec makes editable | `frontend_spec_047` (Custom Search Country/Language pickers) |
| `SettingsSection` this spec's editor UI renders through | `frontend_spec_097_refresh_skip_threshold_override_ui.md` |
| `KeywordPicker`'s existing pinned/options dedup logic this spec relies on, unchanged | `frontend/src/components/KeywordPicker.tsx` (`resolvePinnedOptions`, `visiblePinned`) |
| Confirms no backend settings persistence exists anywhere (why this stays `localStorage`-only) | `series_spec_052_refresh_skip_threshold_override.md`'s own Design Decisions, `backend/src/main/java/uk/co/stefirby/seriestracker/model/` |
| Next spec in this batch, consuming this spec's `useLocalStorage` hook as-is | `frontend_spec_099_settings_theme_toggle.md` |

---

## TDD Test Case Sketches

### `src/hooks/useLocalStorage.test.ts` (new file)

```typescript
describe('FRONTEND-098-AC-01/02: useLocalStorage read/write/degrade', () => {
  it('returns the default when nothing is stored', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', 'default', (v): v is string => typeof v === 'string'),
    )
    expect(result.current[0]).toBe('default')
  })

  it('reads a previously stored, JSON-serialized value', () => {
    localStorage.setItem('test-key', JSON.stringify('stored'))
    const { result } = renderHook(() =>
      useLocalStorage('test-key', 'default', (v): v is string => typeof v === 'string'),
    )
    expect(result.current[0]).toBe('stored')
  })

  it('writes JSON-serialized on every change', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', 'default', (v): v is string => typeof v === 'string'),
    )
    act(() => result.current[1]('changed'))
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('changed'))
  })

  it('falls back to the default on a read failure without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() =>
      useLocalStorage('test-key', 'default', (v): v is string => typeof v === 'string'),
    )
    expect(result.current[0]).toBe('default')
  })

  it('falls back to the default when the stored value fails isValid', () => {
    localStorage.setItem('test-key', JSON.stringify(42))
    const { result } = renderHook(() =>
      useLocalStorage('test-key', 'default', (v): v is string => typeof v === 'string'),
    )
    expect(result.current[0]).toBe('default')
  })
})
```

### `src/components/SeriesList.test.tsx` (`FRONTEND-054-AC-03` block, updated)

```typescript
describe('FRONTEND-054-AC-03/FRONTEND-098-AC-04: view mode persistence via useLocalStorage', () => {
  it('starts in the stored mode and persists a change in JSON format', () => {
    localStorage.setItem('seriesListViewMode', JSON.stringify('compact'))
    render(<SeriesList />)
    expect(screen.getByRole('button', { name: /compact/i })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /expanded/i }))
    expect(localStorage.getItem('seriesListViewMode')).toBe(JSON.stringify('expanded'))
  })
})
```

### `src/components/CustomSearchPanel.test.tsx` / `RecommendationFiltersBox.test.tsx` (additions)

```typescript
describe('FRONTEND-098-AC-07/08: favourites default and read from localStorage', () => {
  it('uses the default US/GB pinned countries when nothing is stored', () => {
    render(<CustomSearchPanel {...baseProps} />)
    // pinned chips render first in the Country picker's suggestion list
    expect(screen.getByText('US')).toBeInTheDocument()
    expect(screen.getByText('GB')).toBeInTheDocument()
  })

  it('uses a previously stored favourites list instead of the default', () => {
    localStorage.setItem('countryFavourites', JSON.stringify(['FR', 'DE']))
    render(<CustomSearchPanel {...baseProps} />)
    expect(screen.getByText('France')).toBeInTheDocument()
    expect(screen.queryByText('US')).not.toBeInTheDocument()
  })
})
```

### `src/components/SettingsPage.test.tsx` (additions)

```typescript
describe('FRONTEND-098-AC-10/11: favourites editor', () => {
  it('renders both favourites pickers and updates localStorage on selection', () => {
    render(<SettingsPage />)
    const countryPicker = screen.getByLabelText(/country favourites/i)
    fireEvent.click(countryPicker) // opens picker, select an option per KeywordPicker's own interaction pattern
    // ...select 'France'...
    expect(JSON.parse(localStorage.getItem('countryFavourites')!)).toContain('FR')
  })
})
```

**Test Case (Green)**: implement `useLocalStorage`, the `SeriesList` migration, the catalog fixes,
and the Settings editor until the specs above pass.

---

## Acceptance Criteria Summary

- [x] FRONTEND-098-AC-01: `useLocalStorage` reads/parses/validates on mount
- [x] FRONTEND-098-AC-02: `useLocalStorage` writes JSON on change, degrades silently
- [x] FRONTEND-098-AC-03: `SeriesList.tsx` migrated onto the shared hook
- [x] FRONTEND-098-AC-04: existing view-mode persistence behavior unchanged, tests updated to JSON
- [x] FRONTEND-098-AC-05: `ALL_COUNTRY_OPTIONS` exported (20 entries)
- [x] FRONTEND-098-AC-06: `LANGUAGE_OPTION_CODES` decoupled from `LANGUAGE_PINNED_CODES`
- [x] FRONTEND-098-AC-07: favourites read via `useLocalStorage` in both Discover consumers
- [x] FRONTEND-098-AC-08: defaults match today's hardcoded values exactly
- [x] FRONTEND-098-AC-09: invalid/unrecognized stored favourites fall back to defaults
- [x] FRONTEND-098-AC-10: Settings editor renders both favourites pickers
- [x] FRONTEND-098-AC-11: editing a favourite writes through immediately, no Save button
