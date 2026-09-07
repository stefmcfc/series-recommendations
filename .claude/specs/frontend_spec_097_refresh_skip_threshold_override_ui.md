# Frontend Spec 097: Refresh Skip-Threshold Override UI & `SettingsSection`

**Status**: Done
**Priority**: P3
**Depends on**: `series_spec_052_refresh_skip_threshold_override.md` (the backend contract this surfaces — `RefreshAllOptions`, `RefreshJobStatus.skipThresholdMinutesUsed`), `frontend_spec_072_settings_export_and_refresh.md` (`SettingsPage.tsx`'s existing Refresh All section this extends)
**Area**: Frontend (`components/SettingsPage.tsx`, a new `components/SettingsSection.tsx`, `services/seriesApi.ts`, `types/series.ts`, and each affected file's tests)

## Overview

Surfaces `series_spec_052`'s backend per-run skip-threshold override on `SettingsPage.tsx`: an
optional override input next to "Refresh All", and the threshold that actually governed a run
(`skipThresholdMinutesUsed`) mentioned in the existing progress/last-refresh text whenever
`skippedCount > 0`.

Also introduces a small `SettingsSection` wrapper component, replacing `SettingsPage.tsx`'s three
existing bare `<div className={styles.section}>` blocks (Refresh All, Export, Import) — this is the
first of three specs landing new controls on `/settings` in the same batch
(`frontend_spec_098`/`099` follow), and today's unlabeled inline-flex row doesn't scale past one or
two always-visible buttons. Doing it once here, as this batch's first `SettingsPage.tsx` change,
means the later two specs both consume `<SettingsSection>` from day one instead of each improvising
their own section markup.

## Design Decisions

- **The override input is a plain number field next to the Refresh All button, not a modal or a
  separate confirm step.** This is an occasional admin action on a personal single-user app's
  settings page, not a destructive operation needing extra friction — matches this app's existing
  "Refresh All" button itself, which already has no confirmation step.
- **A blank override field sends no override at all** — `seriesApi.refreshAll()` omits
  `skipThresholdMinutesOverride` from the request body entirely rather than sending it as `null`/
  `0`/`undefined`, matching this app's established "absent means no filter" convention for every
  other optional numeric field (`SearchFilter`'s min ratings, `NameStatsTable`'s filters, etc.) —
  see `series_spec_052`'s AC-03 for the matching backend contract.
- **`SettingsSection` is intentionally minimal** — `{ title: string; children: ReactNode }`, no
  collapse/disclosure behavior (unlike `RecommendationFiltersBox`'s `.filtersSection`/
  `.filtersToggle` pattern). Every control landing on `/settings` in this batch is meant to be
  visible at a glance, not tucked behind a toggle — Settings is a low-traffic page a user visits
  deliberately, not a filter bar competing for vertical space above a results list.

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the frontend's refresh-all contract to mirror the backend's
new optional override/`skipThresholdMinutesUsed` shape.

#### Acceptance Criteria

- **FRONTEND-097-AC-01** [AUTO]: `RefreshJobStatus` (`types/series.ts`) shall gain
  `skipThresholdMinutesUsed: number`, alongside its existing `status, totalCount, completedCount,
  skippedCount, startedAt, finishedAt`.
- **FRONTEND-097-AC-02** [AUTO]: `seriesApi.refreshAll` shall accept an optional
  `skipThresholdMinutesOverride?: number` parameter, included in the POST body only when the caller
  passes a value — never sent as `null`/`undefined`/omitted-key-with-undefined-value.

---

### Requirement 2: `SettingsSection`

**User story**: As a user viewing a growing Settings page, I want each control grouped under a
clear label, so the page reads as organized categories rather than an undifferentiated stack of
buttons.

#### Acceptance Criteria

- **FRONTEND-097-AC-03** [AUTO]: A new `SettingsSection` component (`components/SettingsSection.tsx`)
  shall accept `title: string` and `children: ReactNode`, rendering the title as a heading followed
  by its children.
- **FRONTEND-097-AC-04** [AUTO]: `SettingsPage.tsx`'s three existing sections (Refresh All, Export,
  Import) shall each render via `<SettingsSection title="...">`, replacing the bare
  `<div className={styles.section}>` wrappers — with no change to any existing test's observable
  behavior (button labels, `data-testid`s, click handlers all unchanged).

---

### Requirement 3: Override input & threshold visibility

**User story**: As a user who clicked "Refresh All" and saw everything skipped, I want to see what
threshold caused that and optionally override it for one more try, instead of a silent no-op.

#### Acceptance Criteria

- **FRONTEND-097-AC-05** [AUTO]: The Refresh All `SettingsSection` shall render a labeled number
  input (`id="refresh-skip-threshold-override"`, associated `<label>` reading "Skip Threshold
  Override (minutes)"), alongside the existing "Refresh All" button.
- **FRONTEND-097-AC-06** [AUTO]: Clicking "Refresh All" while the override input holds a non-blank
  value shall call `seriesApi.refreshAll` with that value as `skipThresholdMinutesOverride`.
- **FRONTEND-097-AC-07** [AUTO]: Clicking "Refresh All" while the override input is blank shall call
  `seriesApi.refreshAll` with no override — identical to today's call shape.
- **FRONTEND-097-AC-08** [AUTO]: `buildRefreshProgressText`/`buildLastFullRefreshText` shall mention
  `status.skipThresholdMinutesUsed` whenever `status.skippedCount > 0` (e.g. "... (3 skipped,
  threshold: 10 min)"), so a skip is never reported without the threshold that produced it.
- **FRONTEND-097-AC-09** [AUTO]: The 409-conflict synthesized `RefreshJobStatus` in
  `handleRefreshAllClick`'s catch block shall include `skipThresholdMinutesUsed` (the most recently
  known value from `jobStatus`, falling back to `0` if none is known yet) rather than being missing
  the field entirely.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| Backend contract this surfaces (`RefreshAllOptions`, `RefreshJobStatus.skipThresholdMinutesUsed`) | `series_spec_052_refresh_skip_threshold_override.md` |
| `SettingsPage.tsx`'s existing Refresh All/Export/Import sections this extends | `frontend_spec_072_settings_export_and_refresh.md` |
| Settings shell/route this page lives under | `frontend_spec_070_settings_menu.md` |
| Established "absent means no filter" convention this spec's override input follows | `frontend_spec_086_keyword_stats_filtering_sort_and_blended_rating.md` (FRONTEND-086-AC-06), `SearchFilter.tsx` |
| Next two specs in this batch, both consuming `SettingsSection` from this spec | `frontend_spec_098` (Country/Language favourites), `frontend_spec_099` (light/dark toggle) |

---

## TDD Test Case Sketches

### `src/components/SettingsSection.test.tsx` (new file)

```typescript
describe('FRONTEND-097-AC-03: SettingsSection renders a title and its children', () => {
  it('renders the title as a heading and renders children', () => {
    render(
      <SettingsSection title="Example Section">
        <button type="button">Do a thing</button>
      </SettingsSection>,
    )
    expect(screen.getByRole('heading', { name: 'Example Section' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Do a thing' })).toBeInTheDocument()
  })
})
```

### `src/components/SettingsPage.test.tsx` (additions)

```typescript
describe('FRONTEND-097-AC-04: existing sections render via SettingsSection', () => {
  it('renders Refresh All, Export, and Import each under their own heading', () => {
    render(<SettingsPage />)
    expect(screen.getByRole('heading', { name: /refresh/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /export/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /import/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-097-AC-05/06/07: skip-threshold override input', () => {
  it('sends no override when the field is left blank', async () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByTestId('refresh-all-btn'))
    await waitFor(() =>
      expect(mockRefreshAll).toHaveBeenCalledWith(undefined),
    )
  })

  it('sends the override value when the field is filled in', async () => {
    render(<SettingsPage />)
    fireEvent.change(screen.getByLabelText(/skip threshold override/i), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByTestId('refresh-all-btn'))
    await waitFor(() =>
      expect(mockRefreshAll).toHaveBeenCalledWith(10),
    )
  })
})

describe('FRONTEND-097-AC-08: progress/last-refresh text mentions the threshold used', () => {
  it('includes the threshold when skippedCount > 0', () => {
    const text = buildLastFullRefreshText({
      status: 'COMPLETED',
      totalCount: 5,
      completedCount: 5,
      skippedCount: 3,
      startedAt: '2026-09-07T10:00:00',
      finishedAt: '2026-09-07T10:00:05',
      skipThresholdMinutesUsed: 10,
    })
    expect(text).toContain('threshold: 10')
  })
})
```

**Test Case (Green)**: implement `SettingsSection`, the override input, and the
`seriesApi`/`types` changes until the specs above pass.

---

## Acceptance Criteria Summary

- [x] FRONTEND-097-AC-01: `RefreshJobStatus` gains `skipThresholdMinutesUsed`
- [x] FRONTEND-097-AC-02: `seriesApi.refreshAll` accepts an optional override, omitted when absent
- [x] FRONTEND-097-AC-03: `SettingsSection` component renders title + children
- [x] FRONTEND-097-AC-04: existing three sections migrated to `SettingsSection`
- [x] FRONTEND-097-AC-05: labeled override input rendered next to Refresh All
- [x] FRONTEND-097-AC-06: non-blank override sent on click
- [x] FRONTEND-097-AC-07: blank override omitted on click
- [x] FRONTEND-097-AC-08: progress/last-refresh text mentions threshold when skipped > 0
- [x] FRONTEND-097-AC-09: 409-conflict synthesized status includes `skipThresholdMinutesUsed`
