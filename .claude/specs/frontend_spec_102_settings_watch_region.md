# Frontend Spec 102: Watch Region Setting

**Status**: Implemented
**Priority**: P3
**Depends on**: `series_spec_053_watch_region_override.md` (the backend `region` override contract this surfaces), `frontend_spec_098_settings_country_language_favourites.md` (`ALL_COUNTRY_OPTIONS`, `useLocalStorage`, reused here as-is), `frontend_spec_101_settings_units_and_card_styling.md` (the card/icon `SettingsSection` treatment this new section adopts)
**Area**: Frontend (`components/SettingsPage.tsx`, `services/seriesApi.ts`, `types/series.ts`, and each affected file's tests)

## Overview

Surfaces `series_spec_053`'s per-request `region` override as a persisted, editable Settings
value — confirmed with the user as a good candidate from the current `application.yml` inventory
(`app.tmdb.watch-region`, single value, genuinely user-relevant, same shape as the already-shipped
Country/Language favourites). A new `/settings` section lets a user pick their region once; every
subsequent streaming-availability lookup (recommendations candidates and a tracked series'
watch-providers check) sends it automatically.

## Design Decisions

- **`localStorage` via the existing `useLocalStorage` hook — no backend persistence.** Same
  reasoning as `series_spec_053`'s backend half: this app has zero backend settings persistence,
  and a per-request override plus a frontend-remembered value achieves the same outcome (the
  user's region "sticks") without inventing any.
- **Always sent, not omitted-when-default.** Unlike the skip-threshold override (which
  distinguishes "no override typed" from "typed something," `frontend_spec_097`), the watch-region
  hook always resolves to a definite value — either the user's choice or the default (`GB`, which
  happens to match the backend's own injected default). There's no meaningful "absent" state to
  preserve here, so both `seriesApi.getRecommendations`/`getWatchProviders` calls always include
  `region` once resolved from the hook.
- **Single-select, reusing the exact adapter pattern `RecommendationFiltersBox`'s Language field
  already established** — `KeywordPicker` is multi-select by shape (`selected: string[]`), so a
  single-value field wraps it: `selected={[watchRegion]}`, `onChange={(next) => setWatchRegion(
  next.at(-1) ?? DEFAULT_WATCH_REGION)}`. Not a new pattern, the same one already in production.
- **Reuses `ALL_COUNTRY_OPTIONS`** (`frontend_spec_098`, 20 entries — the 18-entry Discover-picker
  list plus `US`/`GB`) as the picker's option catalog and the stored-value validator's allow-list.
  Watch-region codes are the same ISO 3166-1 alpha-2 space Country favourites already use — no new
  taxonomy needed.

## Requirements

### Requirement 1: Persisted watch-region, sent on every relevant request

**User story**: As a user, I want to set my streaming region once and have it apply everywhere
streaming availability is shown, not just the request I happened to be on.

#### Acceptance Criteria

- **FRONTEND-102-AC-01** [AUTO]: A new `useLocalStorage('watchRegion', DEFAULT_WATCH_REGION,
  isWatchRegion)` shall back the setting, where `DEFAULT_WATCH_REGION = 'GB'` (matching the
  backend's own injected default) and `isWatchRegion` validates against `ALL_COUNTRY_OPTIONS`'
  known ids.
- **FRONTEND-102-AC-02** [AUTO]: `RecommendationQuery` (`types/series.ts`) shall gain
  `region?: string`; `seriesApi.getRecommendations` shall include it whenever the caller resolves
  and passes a value (the component call site, not this method, is responsible for always
  resolving one from the hook — see AC-04).
- **FRONTEND-102-AC-03** [AUTO]: `seriesApi.getWatchProviders` shall accept an additional
  `region?: string` parameter, included as a query param when provided.
- **FRONTEND-102-AC-04** [AUTO]: The component(s) that currently call `seriesApi.getRecommendations`/
  `getWatchProviders` (`RecommendationsList`/`SeriesDetail` or wherever each call site actually
  lives — confirm during implementation) shall resolve `watchRegion` via the hook and pass it on
  every call, not just when it differs from the default.

---

### Requirement 2: Settings UI

**User story**: As a user, I want to change my watch region from Settings the same way I already
manage my Country/Language favourites.

#### Acceptance Criteria

- **FRONTEND-102-AC-05** [AUTO]: `SettingsPage.tsx` shall render a new `<SettingsSection
  title="Watch Region" icon={...}>` (using `frontend_spec_101`'s card/icon treatment) containing a
  single-select `KeywordPicker` (`options={ALL_COUNTRY_OPTIONS}`, `selected={[watchRegion]}`,
  `onChange` resolving to a single value per the adapter pattern above).
- **FRONTEND-102-AC-06** [AUTO]: Changing the selection shall write through the `useLocalStorage`
  setter immediately — no Save button, matching every other Settings control in this batch.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Backend `region` override contract this surfaces | `series_spec_053_watch_region_override.md` |
| `useLocalStorage`, `ALL_COUNTRY_OPTIONS` reused as-is | `frontend_spec_098_settings_country_language_favourites.md` |
| Card/icon `SettingsSection` treatment this section adopts | `frontend_spec_101_settings_units_and_card_styling.md` |
| Single-select-via-`KeywordPicker` adapter pattern this spec reuses, not invents | `frontend/src/components/RecommendationFiltersBox.tsx` (the Language field) |

---

## TDD Test Case Sketches

### `src/hooks/useLocalStorage`-backed watch region — likely `src/components/SettingsPage.test.tsx` (additions)

```typescript
describe('FRONTEND-102-AC-01/05/06: Watch Region setting', () => {
  it('defaults to GB and writes through on selection', () => {
    render(<SettingsPage theme="system" setTheme={vi.fn()} />)
    expect(screen.getByLabelText(/watch region/i)).toHaveTextContent('United Kingdom')

    fireEvent.click(screen.getByRole('button', { name: /^france$/i }))

    expect(JSON.parse(localStorage.getItem('watchRegion')!)).toBe('FR')
  })

  it('falls back to the default when a stored value is unrecognized', () => {
    localStorage.setItem('watchRegion', JSON.stringify('XX'))
    render(<SettingsPage theme="system" setTheme={vi.fn()} />)
    expect(screen.getByLabelText(/watch region/i)).toHaveTextContent('United Kingdom')
  })
})
```

### `src/services/__tests__/seriesApi.test.ts` (additions)

```typescript
describe('FRONTEND-102-AC-02/03: region param on recommendations/watch-providers', () => {
  it('includes region on getRecommendations when passed', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })
    await seriesApi.getRecommendations({ region: 'FR' })
    expect(client.get).toHaveBeenCalledWith(
      '/series/recommendations',
      expect.objectContaining({ params: expect.objectContaining({ region: 'FR' }) }),
    )
  })

  it('includes region on getWatchProviders when passed', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })
    await seriesApi.getWatchProviders('abc', 'FR')
    expect(client.get).toHaveBeenCalledWith(
      '/series/abc/watch-providers',
      expect.objectContaining({ params: expect.objectContaining({ region: 'FR' }) }),
    )
  })
})
```

**Test Case (Green)**: implement the hook wiring, `seriesApi` param threading, and the Settings
section until the specs above pass.

---

## Acceptance Criteria Summary

- [x] FRONTEND-102-AC-01: `watchRegion` persisted via `useLocalStorage`, validated against `ALL_COUNTRY_OPTIONS`
- [x] FRONTEND-102-AC-02: `RecommendationQuery`/`getRecommendations` gain `region`
- [x] FRONTEND-102-AC-03: `getWatchProviders` gains `region`
- [x] FRONTEND-102-AC-04: call sites always resolve and pass the stored region
- [x] FRONTEND-102-AC-05: new "Watch Region" `SettingsSection` with single-select picker
- [x] FRONTEND-102-AC-06: selection writes through immediately, no Save button
