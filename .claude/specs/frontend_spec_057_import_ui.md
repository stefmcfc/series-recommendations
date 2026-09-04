# Frontend Spec 057: Import UI

**Status**: Not started
**Priority**: P3 (paired UI half of `series_spec_038`)
**Depends on**: Series Spec 038 (`series_spec_038_import.md`, owns `POST /api/v1/series/import` +
`GET /api/v1/series/import/status`) ✅ required, Frontend Spec 007
(`frontend_spec_007_export_trigger.md`, owns `ExportControls`, the sibling component this spec's
`ImportControls` mirrors) ✅, Frontend Spec 023 (`frontend_spec_023_series_refresh.md`, owns
`SeriesList`'s existing bulk-refresh job-polling pattern this spec's status polling mirrors) ✅,
Frontend Spec 072 (`frontend_spec_072_settings_export_and_refresh.md`, moved `ExportControls`/Refresh
All onto `SettingsPage` — the concrete page this spec's `ImportControls` is placed on) ✅
**Area**: Frontend (new `components/ImportControls.tsx`, `services/seriesApi.ts`,
`types/series.ts`, `components/SettingsPage.tsx`)

## Overview

Adds a file-upload UI for `series_spec_038`'s import job — a new `ImportControls` component, with
a file picker (JSON only), an upload action, and status polling reusing the exact pattern
`SeriesList.tsx` already has for bulk refresh. Written before `frontend_spec_072` relocated Export/
Refresh All onto `SettingsPage`; now that they live there, `ImportControls` is placed on that same
page, alongside `ExportControls`, not wherever "alongside" might otherwise have meant.

## Design Decisions

- **`ImportControls` renders on `SettingsPage`, in its own `<div className={styles.section}>`
  block placed after the existing Export section** — mirroring the Refresh All / Export sections'
  existing structure on that same page (`SettingsPage.tsx`). This spec predates
  `frontend_spec_072`, which moved `ExportControls`/Refresh All onto `SettingsPage`; "placed
  alongside `ExportControls`" now concretely means there, not a new or different location.
- **`SettingsPage`'s stale placeholder paragraph — "No settings are available yet — check back
  soon." — is removed as part of this spec.** It was already inaccurate once Refresh All/Export
  landed there (`frontend_spec_072`) and is unambiguously wrong once Import does too; there is no
  remaining case where the page has literally nothing on it.
- **New `ImportControls` component, not folded into `ExportControls`.** Different concerns (upload
  vs. download) with different UI (file input + progress vs. two buttons) — sibling components,
  mirroring how `SeriesExportService`/a future `BulkImportService` are also separate backend
  classes.
- **File input accepts `.json` only** (`accept=".json,application/json"`), matching
  `series_spec_038`'s JSON-only scope.
- **Status polling mirrors `SeriesList.tsx`'s existing bulk-refresh pattern exactly** — poll
  `seriesApi.getImportStatus()` on an interval while `status === 'IN_PROGRESS'`, stop once
  `COMPLETED`/`FAILED`, same shape as the existing `jobStatus`/`refreshIndex` polling `useEffect`.
- **On completion, trigger the same `SeriesList` refresh (`key`-bump) `App.tsx` already uses after
  Add/Edit success** — newly imported series should appear without a manual page reload.
- **Import summary is a plain, readable message** ("Imported 8, skipped 2 (already tracked), 1
  error" or similar), with the capped `errors` list shown if non-empty — not a full data table, this
  is a one-off operation summary, not a persistent view.

---

## Requirement 1: `ImportControls`

**User story**: As a user, I want to re-import a previously exported JSON file and see a clear
summary of what happened.

### FRONTEND-057-AC-01 [AUTO]
**Statement**: `ImportControls` shall render a file input (`data-testid="import-file-input"`,
accepting `.json`) and an "Import" button (`data-testid="import-btn"`, disabled until a file is
selected).

**Test Case (Red)**:
```typescript
it('FRONTEND-057-AC-01: Import button is disabled until a file is selected', () => {
  render(<ImportControls onImported={vi.fn()} />)
  expect(screen.getByTestId('import-btn')).toBeDisabled()

  const file = new File(['{"series":[]}'], 'export.json', { type: 'application/json' })
  fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [file] } })
  expect(screen.getByTestId('import-btn')).not.toBeDisabled()
})
```
**Test Case (Green)**: `selectedFile` local state, gating the button's `disabled`.

---

### FRONTEND-057-AC-02 [AUTO]
**Statement**: Clicking "Import" shall call `seriesApi.importSeries(file)`, then poll
`seriesApi.getImportStatus()` (mirroring `SeriesList`'s existing bulk-refresh polling) until
`status` is `COMPLETED`/`FAILED`, rendering a progress indicator while `IN_PROGRESS`.

**Test Case (Red)**:
```typescript
it('FRONTEND-057-AC-02: uploads and polls until completion', async () => {
  mockImportSeries.mockResolvedValue({ status: 'IN_PROGRESS', importedCount: 0, skippedCount: 0, errorCount: 0, errors: [] })
  mockGetImportStatus.mockResolvedValue({ status: 'COMPLETED', totalCount: 3, importedCount: 2, skippedCount: 1, errorCount: 0, errors: [] })

  render(<ImportControls onImported={vi.fn()} />)
  const file = new File(['{"series":[]}'], 'export.json', { type: 'application/json' })
  fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [file] } })
  fireEvent.click(screen.getByTestId('import-btn'))

  expect(await screen.findByText(/imported 2, skipped 1/i)).toBeInTheDocument()
})
```
**Test Case (Green)**: `useEffect`-driven polling loop, same interval/stop-condition shape as
`SeriesList`'s existing `refreshAllInProgress` effect.

---

### FRONTEND-057-AC-03 [AUTO]
**Statement**: When the job completes with `errorCount > 0`, the capped `errors` list shall be
shown alongside the summary.

**Test Case (Red)**:
```typescript
it('FRONTEND-057-AC-03: shows per-row errors when present', async () => {
  mockImportSeries.mockResolvedValue({ status: 'IN_PROGRESS' })
  mockGetImportStatus.mockResolvedValue({
    status: 'COMPLETED', totalCount: 2, importedCount: 1, skippedCount: 0, errorCount: 1,
    errors: [{ rowIndex: 1, message: 'title is required' }],
  })
  render(<ImportControls onImported={vi.fn()} />)
  const file = new File(['{"series":[]}'], 'export.json', { type: 'application/json' })
  fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [file] } })
  fireEvent.click(screen.getByTestId('import-btn'))

  expect(await screen.findByText(/title is required/i)).toBeInTheDocument()
})
```
**Test Case (Green)**: conditional error list rendering, keyed off `status.errors`.

---

### FRONTEND-057-AC-04 [AUTO]
**Statement**: On completion with `importedCount > 0`, `ImportControls` shall call `onImported()`
(a callback prop), which `App.tsx` wires to the same `SeriesList` `key`-bump refresh used after
Add/Edit success.

**Test Case (Green)**: `onImported` called once inside the polling loop's completion branch, only
when `importedCount > 0` (no pointless refresh when nothing was actually imported).

---

### FRONTEND-057-AC-05 [AUTO]
**Statement**: `SettingsPage` shall render `ImportControls` in its own section, after the existing
`ExportControls` section, and shall no longer render the "No settings are available yet — check
back soon." placeholder paragraph.

**Test Case (Red)**:
```typescript
it('FRONTEND-057-AC-05: Settings renders Import after Export, no stale placeholder', () => {
  render(<SettingsPage />)

  expect(screen.getByTestId('import-file-input')).toBeInTheDocument()
  expect(
    screen.queryByText(/no settings are available yet/i),
  ).not.toBeInTheDocument()
})
```
**Test Case (Green)**: add `<ImportControls onImported={...} />` inside its own `styles.section`
div after the `ExportControls` section; delete the placeholder `<p>`.

---

## Cross-References

| This spec | Source |
|---|---|
| `POST /api/v1/series/import`, `GET .../import/status` | `series_spec_038_import.md` |
| `ExportControls`, the sibling component this mirrors | `frontend_spec_007_export_trigger.md` |
| Bulk-job polling pattern reused | `frontend_spec_023_series_refresh.md` |
| `SettingsPage`, the concrete page this renders on (moved `ExportControls`/Refresh All here) | `frontend_spec_072_settings_export_and_refresh.md` |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-057-AC-01: Import button disabled until a file is selected
- [ ] FRONTEND-057-AC-02: upload + poll until completion, showing progress
- [ ] FRONTEND-057-AC-03: per-row errors shown when present
- [ ] FRONTEND-057-AC-04: `onImported` triggers a `SeriesList` refresh
- [ ] FRONTEND-057-AC-05: `SettingsPage` renders Import after Export; stale placeholder removed
