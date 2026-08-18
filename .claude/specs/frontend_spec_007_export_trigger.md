# Frontend Spec 007: Export Trigger

**Status**: Implemented. `src/services/seriesApi.ts` (`export()` now resolves `{ blob, filename }`, parses `Content-Disposition`, falls back to `series-export.{format}`, and handles blob-shaped error responses via a dedicated `parseErrorBlob`/`parseFilename` pair instead of the shared `request<T>()` helper), `src/services/__tests__/seriesApi.test.ts` (SH-007 amended for the new return shape, new IF-010 describe block for blob-error parsing), `src/components/ExportControls.tsx` + `ExportControls.module.css` (new — two buttons, loading/error states, browser-download trigger via `URL.createObjectURL`/anchor click/`URL.revokeObjectURL`), `src/components/ExportControls.test.tsx` (new), `src/App.tsx` (renders `<ExportControls />`, no `criteria` wired in yet per the spec's design decisions), `src/App.test.tsx` (new AC-13 rendering test). `npm test` (114/114 passing across 6 files), `npm run lint` (clean), `npm run build` (clean) all verified on 2026-08-18. No real-browser pass done for this stage (not required — see PR notes; a manual pass against a running backend is recommended before merge since this is exactly the kind of file-download behavior unit tests can only approximate via mocks).
**Priority**: P2 (surfaces the backend's existing export endpoint, unused by the frontend today)
**Depends on**: Frontend Spec 001 (Types & API Service Layer) ✅, Backend Spec 004 (Export) ✅
**Frontend Stage**: 7 of N

---

## Overview

This spec adds a UI trigger for the backend's export endpoint, which has been fully supported since `series_spec_004_export.md` but never exposed in the frontend — `seriesApi.export()` exists (Frontend Spec 001) but nothing calls it. It adds `ExportControls`, a small component with "Export JSON"/"Export CSV" buttons that download the result as a file, and — while building it — extends `seriesApi.export()`'s contract to actually support that (see Requirement 1: it currently discards the response headers a real download needs, and has a genuine correctness gap in how it would handle a failed request).

**Deliverables**:
- Extension to `src/services/seriesApi.ts`: `export()` now resolves to `{ blob: Blob; filename: string }` (reading the filename from the response's `Content-Disposition` header) instead of a bare `Blob`, and correctly parses JSON error bodies even though the request uses `responseType: 'blob'` (Requirement 1 — a correctness prerequisite, not new behavior for the parts that already worked)
- Fix to `src/services/__tests__/seriesApi.test.ts`: SH-007 updated for the new return shape, plus a new case for the blob-error-parsing fix
- `src/components/ExportControls.tsx` — two buttons that call `seriesApi.export` and trigger a browser download of the result
- `src/components/ExportControls.module.css`
- `src/components/ExportControls.test.tsx`
- Amendment to `src/App.tsx`: render `ExportControls`

**Design decisions captured here**:
- **`seriesApi.export()`'s current `Promise<Blob>` return type is insufficient for a real download**, not merely stylistically inconsistent with `getAll`/`search` (unlike the Frontend Spec 005 bug in `getById`/`create`/`update`, this one isn't "wrong," it's incomplete). A blob obtained via `URL.createObjectURL()` has no filename of its own — the browser doesn't read `Content-Disposition` for a client-constructed blob URL the way it would for a real navigation-triggered download. The backend already computes a well-formed, timestamped filename (`series-export-{yyyyMMdd_HHmmss}.{ext}`, `series_spec_004_export.md`) and sends it in that header, so the fix is to read it, not to reinvent one — falling back to a generic `series-export.{format}` only if the header is ever missing.
- **`export()` doesn't reuse the generic `request<T>()` helper** the other `seriesApi` methods share. `request<T>` assumes the response body is JSON (both on success and, implicitly, on error) and discards headers; `export()` needs the raw headers and has to handle a genuinely different error shape (see the next point). Duplicating ~15 lines of the existing axios-error → `ApiError` mapping into `export()` itself is simpler and clearer than parameterizing `request<T>` for a single caller with different needs.
- **A real, easy-to-miss correctness gap**: because the request uses `responseType: 'blob'`, axios applies that same `responseType` to *error* responses too — a failed export (e.g. a 500) arrives with `err.response.data` as a `Blob`, not the parsed `{ error, details }` JSON object every other endpoint's error handling assumes. Naively reusing `request()`'s existing error-mapping logic here would silently swallow the real backend error message and always show the generic "An error occurred" fallback. `export()` reads the blob's text and `JSON.parse`s it to recover the actual message, falling back to the generic message only if that parsing itself fails.
- **`ExportControls` lives in `App.tsx`, not inside `SeriesList`.** Export operates on "the whole (optionally filtered) collection," the same conceptual level as "Add Series" — not a per-row concern — and `SeriesList` is already sizeable (Frontend Spec 006 kept `SearchFilter` separate for the same reason).
- **This branch has no active-filter state to wire `ExportControls`'s `criteria` prop into.** `ExportControls` accepts an optional `criteria?: SearchCriteria` prop so it's ready to receive the currently-applied filters, but the `criteria` state this spec would connect to lives in `App.tsx` as of Frontend Spec 006, which may not be merged yet. `App.tsx` here just renders `<ExportControls />` with no `criteria` passed (equivalent to "export everything") — connecting the two, once both are on `main`, is a one-line follow-up, not a redesign.
- **`URL.createObjectURL`/`revokeObjectURL` aren't implemented by jsdom.** Tests mock them directly (`vi.stubGlobal` or assigning stubs onto the global `URL`), and assert the download mechanism by spying on the anchor element's `click()` and checking its `href`/`download` attributes — not by trying to observe an actual file save, which no test environment can do.

---

## Glossary

| Term | Definition |
|------|-----------|
| `ExportControls` | The component this spec delivers |
| `Content-Disposition` filename | The server-computed, timestamped filename this feature reuses rather than re-deriving client-side |

---

## Requirements

### Requirement 1: Extend `seriesApi.export()`

**User Story:** As a developer, I want `seriesApi.export()` to return everything a real download needs, and to report the real error when one occurs, so that `ExportControls` can be built correctly on top of it.

#### Acceptance Criteria

- **FRONTEND-007-AC-01** [AUTO]: `seriesApi.export()` shall resolve to `{ blob: Blob; filename: string }`, with `filename` parsed from the response's `Content-Disposition` header (`attachment; filename="..."`).
- **FRONTEND-007-AC-02** [AUTO]: If the `Content-Disposition` header is missing or its `filename` cannot be parsed, `filename` shall fall back to `series-export.{format}`.
- **FRONTEND-007-AC-03** [AUTO]: If the request rejects with an error response whose body is a `Blob` containing JSON error text (the shape axios produces under `responseType: 'blob'`), the thrown `ApiError`'s `message` (and `details`, if present) shall reflect the parsed backend error, not the generic fallback.
- **FRONTEND-007-AC-04** [AUTO]: If that error response body cannot be parsed as JSON, `seriesApi.export()` shall fall back to the same generic `ApiError(status, 'An error occurred')` handling every other `seriesApi` method uses on an unparseable error body.

---

### Requirement 2: Export Controls — Rendering

**User Story:** As a user, I want clearly labelled buttons to export my collection, so that I can get my data out in the format I want.

#### Acceptance Criteria

- **FRONTEND-007-AC-05** [AUTO]: `ExportControls` shall render an "Export JSON" button (`data-testid="export-json-btn"`) and an "Export CSV" button (`data-testid="export-csv-btn"`).

---

### Requirement 3: Triggering an Export

**User Story:** As a user, I want clicking an export button to export my current view, so that filters I've applied carry through to the download.

#### Acceptance Criteria

- **FRONTEND-007-AC-06** [AUTO]: `ExportControls` shall accept an optional `criteria?: SearchCriteria` prop.
- **FRONTEND-007-AC-07** [AUTO]: When "Export JSON" is clicked, `ExportControls` shall call `seriesApi.export('json', criteria)`.
- **FRONTEND-007-AC-08** [AUTO]: When "Export CSV" is clicked, `ExportControls` shall call `seriesApi.export('csv', criteria)`.

---

### Requirement 4: Loading State

**User Story:** As a user, I want to see that my export is being prepared, so that I don't click again or think the app is frozen.

#### Acceptance Criteria

- **FRONTEND-007-AC-09** [AUTO]: While an export request is in flight, both buttons shall be disabled, and the clicked button's label shall change to "Exporting...".

---

### Requirement 5: Successful Export — Browser Download

**User Story:** As a user, I want a successful export to immediately download as a file with a sensible name, so that I don't have to do anything extra to get my data.

#### Acceptance Criteria

- **FRONTEND-007-AC-10** [AUTO]: When `seriesApi.export` resolves, `ExportControls` shall trigger a browser download of the returned blob using the returned `filename` (via `URL.createObjectURL` and a programmatically-clicked anchor whose `download` attribute is set to `filename`).
- **FRONTEND-007-AC-11** [AUTO]: After triggering the download, `ExportControls` shall release the object URL via `URL.revokeObjectURL`.

---

### Requirement 6: Export Failure

**User Story:** As a user, I want a clear message if an export fails, so that I know it didn't work and can try again.

#### Acceptance Criteria

- **FRONTEND-007-AC-12** [AUTO]: If `seriesApi.export` rejects with an `ApiError`, `ExportControls` shall display `ApiError.message` in a `role="alert"` region and shall re-enable both buttons.

---

### Requirement 7: App Integration

**User Story:** As a user, I want export controls visible on the main page, so that I can find and use the feature.

#### Acceptance Criteria

- **FRONTEND-007-AC-13** [AUTO]: `App.tsx` shall render `ExportControls`.

---

### Requirement 8: Shall Not — Data Handling

**User Story:** As a developer, I want to be sure export doesn't leak data through logging, so that the feature behaves predictably.

#### Acceptance Criteria

- **FRONTEND-007-AC-14** [AUTO]: `ExportControls` shall not log the exported blob's contents or the entered filter criteria to the console.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `SearchCriteria`, `ApiError` | `src/types/series.ts`, `src/types/api.ts` (Frontend Spec 001) |
| `seriesApi.export()` (amended here) | `src/services/seriesApi.ts` (Frontend Spec 001) |
| `GET /api/v1/series/export` contract, `Content-Disposition` filename format, JSON/CSV bodies, 400 on invalid `format` | `series_spec_004_export.md` |
| `criteria` state this will eventually connect to | `frontend_spec_006_search_filter.md` (not assumed merged — see design decisions) |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (amendments)

```typescript
describe('SH-007: export', () => {
  it('should resolve { blob, filename } with filename parsed from Content-Disposition', async () => {
    const mockBlob = new Blob(['{"series":[]}'], { type: 'application/json' })
    client.get.mockResolvedValue({
      data: mockBlob,
      headers: { 'content-disposition': 'attachment; filename="series-export-20260101_120000.json"' },
    })

    const result = await seriesApi.export('json')

    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.filename).toBe('series-export-20260101_120000.json')
  })

  it('should fall back to a generic filename when the header is missing', async () => {
    client.get.mockResolvedValue({ data: new Blob(['a,b'], { type: 'text/csv' }), headers: {} })
    const result = await seriesApi.export('csv')
    expect(result.filename).toBe('series-export.csv')
  })
})

describe('IF-010: export error handling', () => {
  it('parses a JSON error message out of a Blob error response', async () => {
    const errorBlob = new Blob([JSON.stringify({ error: 'Invalid format' })], {
      type: 'application/json',
    })
    client.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: errorBlob },
    })

    await expect(seriesApi.export('json')).rejects.toMatchObject({
      status: 400,
      message: 'Invalid format',
    })
  })

  it('falls back to a generic message when the Blob body is not valid JSON', async () => {
    const errorBlob = new Blob(['not json'], { type: 'text/plain' })
    client.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: errorBlob },
    })

    await expect(seriesApi.export('json')).rejects.toMatchObject({
      status: 500,
      message: 'An error occurred',
    })
  })
})
```

### `src/components/ExportControls.test.tsx`

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ExportControls } from './ExportControls'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'

vi.mock('../services/seriesApi')
const mockExport = vi.mocked(seriesApi.export)

let createObjectURLSpy: ReturnType<typeof vi.fn>
let revokeObjectURLSpy: ReturnType<typeof vi.fn>
let clickSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  createObjectURLSpy = vi.fn(() => 'blob:mock-url')
  revokeObjectURLSpy = vi.fn()
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: createObjectURLSpy,
    revokeObjectURL: revokeObjectURLSpy,
  })
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  clickSpy.mockRestore()
})
```

```typescript
describe('FRONTEND-007-AC-05: rendering', () => {
  it('renders both export buttons', () => {
    render(<ExportControls />)
    expect(screen.getByTestId('export-json-btn')).toBeInTheDocument()
    expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument()
  })
})
```

```typescript
describe('FRONTEND-007-AC-06/07/08: triggering with criteria', () => {
  it('calls seriesApi.export with the format and criteria', async () => {
    mockExport.mockResolvedValue({ blob: new Blob(['{}']), filename: 'series-export.json' })
    render(<ExportControls criteria={{ title: 'office' }} />)

    fireEvent.click(screen.getByTestId('export-json-btn'))
    await waitFor(() => expect(mockExport).toHaveBeenCalledWith('json', { title: 'office' }))
  })

  it('calls seriesApi.export with csv format', async () => {
    mockExport.mockResolvedValue({ blob: new Blob(['a,b']), filename: 'series-export.csv' })
    render(<ExportControls />)

    fireEvent.click(screen.getByTestId('export-csv-btn'))
    await waitFor(() => expect(mockExport).toHaveBeenCalledWith('csv', undefined))
  })
})
```

```typescript
describe('FRONTEND-007-AC-09: loading state', () => {
  it('disables both buttons and shows "Exporting..." while in flight', async () => {
    mockExport.mockReturnValue(new Promise(() => undefined))
    render(<ExportControls />)

    fireEvent.click(screen.getByTestId('export-json-btn'))
    expect(screen.getByTestId('export-json-btn')).toBeDisabled()
    expect(screen.getByTestId('export-json-btn')).toHaveTextContent(/exporting/i)
    expect(screen.getByTestId('export-csv-btn')).toBeDisabled()
  })
})
```

```typescript
describe('FRONTEND-007-AC-10/11: successful download', () => {
  it('creates an object URL, clicks a download anchor, then revokes it', async () => {
    mockExport.mockResolvedValue({ blob: new Blob(['{}']), filename: 'series-export-20260101.json' })
    render(<ExportControls />)

    fireEvent.click(screen.getByTestId('export-json-btn'))

    await waitFor(() => expect(createObjectURLSpy).toHaveBeenCalledTimes(1))
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })
})
```

```typescript
describe('FRONTEND-007-AC-12: failure', () => {
  it('shows the ApiError message and re-enables both buttons', async () => {
    mockExport.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<ExportControls />)

    fireEvent.click(screen.getByTestId('export-json-btn'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/internal server error/i))
    expect(screen.getByTestId('export-json-btn')).not.toBeDisabled()
    expect(screen.getByTestId('export-csv-btn')).not.toBeDisabled()
  })
})
```

### `src/App.test.tsx` (addition)

```typescript
describe('FRONTEND-007-AC-13: export controls rendered', () => {
  it('renders ExportControls on the main page', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await waitFor(() => screen.getByTestId('export-json-btn'))
    expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-007-AC-01: `export()` resolves `{ blob, filename }`, filename from `Content-Disposition`
- [x] FRONTEND-007-AC-02: fallback filename when header missing/unparseable
- [x] FRONTEND-007-AC-03: blob-shaped error response parsed for the real message
- [x] FRONTEND-007-AC-04: falls back to generic message when blob error body isn't JSON
- [x] FRONTEND-007-AC-05: both export buttons rendered
- [x] FRONTEND-007-AC-06: optional `criteria` prop
- [x] FRONTEND-007-AC-07: JSON button calls `export('json', criteria)`
- [x] FRONTEND-007-AC-08: CSV button calls `export('csv', criteria)`
- [x] FRONTEND-007-AC-09: both buttons disabled + "Exporting..." while in flight
- [x] FRONTEND-007-AC-10: successful export triggers a browser download
- [x] FRONTEND-007-AC-11: object URL revoked after triggering download
- [x] FRONTEND-007-AC-12: failure shows alert, re-enables buttons
- [x] FRONTEND-007-AC-13: `App.tsx` renders `ExportControls`
- [x] FRONTEND-007-AC-14: no logging of blob contents or criteria
