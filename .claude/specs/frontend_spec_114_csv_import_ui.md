# Frontend Spec 114: CSV Import UI

**Status**: Implemented — `frontend/src/components/ImportControls.tsx`, `frontend/src/components/ImportControls.test.tsx`
**Priority**: P3 (matches `series_spec_058`'s tier — small frontend companion to a backend format
addition)
**Depends on**: `series_spec_058_csv_import.md` (backend CSV parsing this spec's file picker
enables), `frontend_spec_057_import_ui.md` (owns `ImportControls.tsx`, the component this spec
extends)
**Area**: Frontend (`components/ImportControls.tsx`)

## Overview

`ImportControls.tsx` (`frontend_spec_057`) restricts its file input to `.json,application/json`.
Once `series_spec_058` adds backend CSV parsing, the file input must accept `.csv` too, or a user
picking a CSV export file would be blocked by the browser's own file-picker filter before the
request is ever sent. No other UI change is needed — the same upload button, progress state, and
`GET /series/import/status` polling already handle either format transparently, since the backend
response shape (`ImportJobStatus`) is identical regardless of which file type was uploaded.

## Design Decisions

- **`accept` attribute widens, nothing else changes.** `ImportControls` doesn't need to know or
  display which format was picked — it already just hands the raw `File` to
  `seriesApi.importSeries(file)`, which builds the same `multipart/form-data` request regardless of
  content.
- **No client-side CSV validation.** Structural validation (header row, column order) is the
  backend's job (`SERIES-058-AC-02`); the frontend's role is only to let the right file types
  through the picker and surface whatever error message the `400` response already carries via its
  existing error-display path.

## Requirements

### Requirement 1: File input accepts CSV alongside JSON

**User Story**: As a user, I want to pick a previously exported CSV file the same way I already
pick a JSON export, without the browser's file picker filtering it out.

#### FRONTEND-114-AC-01 [AUTO]: file input accepts `.csv`/`text/csv`
**Statement**: `ImportControls`'s file input shall accept `.csv` and `text/csv` in addition to its
existing `.json`/`application/json` types.

**Rationale**: Otherwise the browser's own file-picker dialog filters out CSV files before a user
can even select one.

**References**: `components/ImportControls.tsx` (file input, current `accept=".json,application/json"`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-114-AC-01: file input accepts CSV', () => {
  it('sets accept to include both json and csv types', () => {
    render(<ImportControls />)
    const input = screen.getByLabelText(/choose file/i) as HTMLInputElement
    expect(input.accept).toContain('.csv')
    expect(input.accept).toContain('text/csv')
    expect(input.accept).toContain('.json')
  })
})
```

**Test Case (Green)**: change `accept=".json,application/json"` to
`accept=".json,application/json,.csv,text/csv"`.

---

#### FRONTEND-114-AC-02 [AUTO]: selecting and submitting a CSV file drives the same upload flow
**Statement**: Selecting a `.csv` file and submitting shall call `seriesApi.importSeries` with that
file and drive the same progress/status-polling UI as a JSON upload, with no code path differences
visible to the user.

**Rationale**: Confirms the format-agnostic upload path actually works end-to-end for a CSV file,
not just that the picker allows selecting one.

**References**: `services/seriesApi.ts` (`importSeries`)

**Test Case (Red)**:
```typescript
describe('FRONTEND-114-AC-02: submitting a CSV file uses the existing upload flow', () => {
  it('calls importSeries with the selected CSV file and shows progress', async () => {
    const csvFile = new File(['id,title\n,Show A\n'], 'export.csv', { type: 'text/csv' })
    vi.mocked(seriesApi.importSeries).mockResolvedValue({ status: 'IN_PROGRESS', totalCount: 1 } as any)

    render(<ImportControls />)
    await userEvent.upload(screen.getByLabelText(/choose file/i), csvFile)
    await userEvent.click(screen.getByRole('button', { name: /import/i }))

    expect(seriesApi.importSeries).toHaveBeenCalledWith(csvFile)
    expect(await screen.findByText(/in progress/i)).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: no new logic — confirms the existing submit handler already works
format-agnostically once `AC-01`'s `accept` change lands.

## Cross-References

| Concept | Location |
|---|---|
| Backend CSV parsing this enables | `series_spec_058_csv_import.md` |
| Component this spec extends | `frontend_spec_057_import_ui.md`, `components/ImportControls.tsx` |
| Upload call, format-agnostic | `services/seriesApi.ts` (`importSeries`) |

## Acceptance Criteria Summary

- [x] FRONTEND-114-AC-01: file input accepts `.csv`/`text/csv`
- [x] FRONTEND-114-AC-02: selecting and submitting a CSV file drives the same upload flow as JSON
