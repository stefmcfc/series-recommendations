# Frontend Spec 004: Edit & Delete Series

**Status**: Implemented. `src/types/series.ts` (`UpdateSeriesRequest` gains `currentSeason`/`currentEpisode`), `src/components/SeriesList.tsx` + `SeriesList.module.css` (Edit/Delete buttons, inline delete confirmation, `onEditClick` prop), `src/components/EditSeriesForm.tsx` + `EditSeriesForm.module.css` (new), `src/App.tsx` (edit-form wiring). Tests: `src/components/SeriesList.test.tsx`, `src/components/EditSeriesForm.test.tsx` (new), `src/App.test.tsx` — all amended/added following red/green TDD. `npm test` (102/102 passing), `npm run lint` (clean), `npm run build` (clean, confirms the `UpdateSeriesRequest` type change compiles) all verified on 2026-08-18. No real-browser pass done for this stage (not called out as required — see PR notes).
**Priority**: P1 (second write-path UI — completes basic CRUD)
**Depends on**: Frontend Spec 001 (Types & API Service Layer) ✅, Frontend Spec 002 (`SeriesList`) ✅, Frontend Spec 003 (`AddSeriesForm`) ✅, Backend Spec 002 (CRUD) ✅
**Frontend Stage**: 4 of N

---

## Overview

This spec covers editing and deleting an existing series from `SeriesList`, the two remaining CRUD write-paths (create is done; there is no detail view yet — Requirement 7 below deliberately keeps both actions reachable from the list row rather than depending on a not-yet-built `SeriesDetail`).

**Deliverables**:
- `src/components/EditSeriesForm.tsx` — a modal form, structurally parallel to `AddSeriesForm` but pre-populated from an existing `Series` and covering the full PATCH-editable field set (including `currentSeason`/`currentEpisode`, which `AddSeriesForm` deliberately excludes)
- `src/components/EditSeriesForm.module.css` — CSS Modules styling, following `AddSeriesForm.module.css`
- `src/components/EditSeriesForm.test.tsx`
- Amendments to `src/components/SeriesList.tsx`: an "Edit" and a "Delete" button per row, an inline delete-confirmation flow owned entirely by `SeriesList`, and a new optional `onEditClick?: (series: Series) => void` prop
- Amendment to `src/types/series.ts`: `UpdateSeriesRequest` gains optional `currentSeason`/`currentEpisode`
- A small amendment to `src/App.tsx`: own the edit-form's open/closed state (holding the `Series` being edited), render `EditSeriesForm` conditionally, refresh `SeriesList` on successful edit
- `src/App.test.tsx` amendments covering the new App-level wiring

**Design decisions captured here**:
- **Separate component, not a shared base with `AddSeriesForm`.** The field sets differ (`EditSeriesForm` adds `currentSeason`/`currentEpisode`; pre-population and the `seriesApi.update` vs. `seriesApi.create` call differ too). Three similar-but-not-identical forms' worth of JSX is not worth factoring into a shared abstraction yet — revisit if a third form-like component appears. `AddSeriesForm.module.css`'s classes are duplicated into a new `EditSeriesForm.module.css` rather than shared, consistent with this.
- **Edit and delete are reachable directly from `SeriesList` rows**, not from a detail view — there is no `SeriesDetail` component yet (that's a separate, later roadmap item). `onSeriesClick` (Frontend Spec 002) remains wired to a stub in `App.tsx`; this spec doesn't change that.
- **Delete confirmation is inline in the row**, not a second modal. Clicking "Delete" swaps that row's Edit/Delete buttons for Confirm/Cancel controls in place. This avoids stacking a confirmation modal on top of the list (or introducing a new modal abstraction) for what is fundamentally a two-button decision.
- **`SeriesList` owns the entire delete flow itself** (confirmation state, the `seriesApi.delete` call, and removing the item from its own `series` state on success) rather than bubbling a `onDeleteClick` callback up to `App.tsx`. `SeriesList` already owns fetch/loading/error state for its data (Frontend Spec 002); deleting doesn't need any UI outside the list, so there's nothing for `App.tsx` to coordinate. This differs from edit, which needs a full form and therefore follows the same lift-to-`App.tsx` pattern `AddSeriesForm` established.
- **Delete removes the item from local state directly on success**, not a re-fetch — simpler, and avoids an extra round trip for an operation that can't return stale data (the item is just gone).
- **Edit passes the full `Series` object to `onEditClick`**, not just the id (unlike `onSeriesClick(id)`). `SeriesList` already holds the full objects in state, and `EditSeriesForm` needs the whole record to pre-populate its fields — fetching it again via `seriesApi.getById` would be a redundant round trip.
- **Clearing a previously-set optional field to `null` via `EditSeriesForm` is out of scope.** Like `AddSeriesForm`, blank optional fields are simply omitted from the PATCH payload — for create that means "don't set", for edit it means "leave the existing value unchanged". There's no way to explicitly null out a field (e.g., remove a rating) from this form. Flagging this here so it isn't mistaken for a gap; revisit if the need comes up.
- **Client-side range checks mirror only the validation the backend actually performs.** `currentSeason` is cross-checked against `totalSeasons` client-side (mirroring `SeriesService.update`'s `IllegalArgumentException` — see `series_spec_002_crud.md`), but `currentEpisode` is **not** cross-checked against `totalEpisodes` — the backend doesn't do that check either, so adding one client-side would create a false rejection the server wouldn't agree with.
- **No "are you sure" prompt on Cancel** with unsaved edits — out of scope, same as `AddSeriesForm`.

---

## Glossary

| Term | Definition |
|------|-----------|
| `EditSeriesForm` | The modal dialog component this spec delivers for editing |
| Inline delete confirmation | The Confirm/Cancel controls a row switches to after "Delete" is clicked, replacing its Edit/Delete buttons |
| `UpdateSeriesRequest` | The request shape `seriesApi.update()` accepts (`src/types/series.ts`), amended by this spec |

---

## Requirements

### Requirement 1: Row Actions — Edit & Delete Buttons

**User Story:** As a user, I want Edit and Delete controls on each series row, so that I can manage an existing entry without leaving the list.

#### Acceptance Criteria

- **FRONTEND-004-AC-01** [AUTO]: `SeriesList` shall render an "Edit" button (`data-testid="edit-series-btn"`) and a "Delete" button (`data-testid="delete-series-btn"`) within each series row, each with an `aria-label` identifying the action and the row's series title (e.g. "Edit The Office", "Delete The Office").
- **FRONTEND-004-AC-02** [AUTO]: `SeriesList` shall accept an optional `onEditClick?: (series: Series) => void` prop.
- **FRONTEND-004-AC-03** [AUTO]: When a row's Edit button is clicked, if `onEditClick` is provided, `SeriesList` shall call it with that row's full `Series` object, and shall not call `onSeriesClick`.
- **FRONTEND-004-AC-04** [AUTO]: `SeriesList` shall not throw if a row's Edit button is clicked while `onEditClick` is not provided (same optional-callback safety pattern as `onAddClick`/`onSeriesClick`).
- **FRONTEND-004-AC-05** [AUTO]: Clicking a row's Delete button shall not call `onSeriesClick`, `onEditClick`, or `seriesApi.delete`.

---

### Requirement 2: Delete — Inline Confirmation

**User Story:** As a user, I want to confirm before a series is permanently removed, so that I don't lose data to a misclick.

#### Acceptance Criteria

- **FRONTEND-004-AC-06** [AUTO]: When a row's Delete button is clicked, `SeriesList` shall replace that row's Edit/Delete buttons with a confirmation prompt containing a "Confirm" button (`data-testid="confirm-delete-btn"`) and a "Cancel" button (`data-testid="cancel-delete-btn"`).
- **FRONTEND-004-AC-07** [AUTO]: When the confirmation prompt's "Cancel" is clicked, `SeriesList` shall restore that row's Edit/Delete buttons and shall not call `seriesApi.delete`.
- **FRONTEND-004-AC-08** [AUTO]: When the `Escape` key is pressed while a row's confirmation prompt is shown, `SeriesList` shall restore that row's Edit/Delete buttons without calling `seriesApi.delete`.
- **FRONTEND-004-AC-09** [AUTO]: While a row's confirmation prompt is shown, clicking elsewhere on that row shall not call `onSeriesClick`.

---

### Requirement 3: Delete — Submission Loading State

**User Story:** As a user, I want to see that a delete is in progress, so that I don't click it twice or think the app is frozen.

#### Acceptance Criteria

- **FRONTEND-004-AC-10** [AUTO]: When the confirmation prompt's "Confirm" is clicked, `SeriesList` shall call `seriesApi.delete` with that row's `id`.
- **FRONTEND-004-AC-11** [AUTO]: While the `seriesApi.delete` call is in flight, the Confirm button shall be disabled and its label changed to "Deleting...".
- **FRONTEND-004-AC-12** [AUTO]: While the `seriesApi.delete` call is in flight, that row's Cancel button shall be disabled.

---

### Requirement 4: Delete — Success

**User Story:** As a user, I want a deleted series to disappear from my list immediately, so that I get confirmation it worked.

#### Acceptance Criteria

- **FRONTEND-004-AC-13** [AUTO]: When `seriesApi.delete` resolves, `SeriesList` shall remove that series from its rendered list without calling `seriesApi.getAll` again.
- **FRONTEND-004-AC-14** [AUTO]: If removing the deleted series empties the list, `SeriesList` shall render its existing empty state (Frontend Spec 002, Requirement 4).

---

### Requirement 5: Delete — Error Handling

**User Story:** As a user, I want a clear message if a delete fails, so that I know it didn't work and can try again.

#### Acceptance Criteria

- **FRONTEND-004-AC-15** [AUTO]: If `seriesApi.delete` rejects, `SeriesList` shall display `ApiError.message` in a `role="alert"` region scoped to that row, keep the series in the list, and leave the Confirm/Cancel controls in place (re-enabled) so the user can retry without re-clicking Delete.

---

### Requirement 6: `EditSeriesForm` — Modal Structure & Lifecycle

**User Story:** As a user, I want the edit form to appear as a focused dialog I can dismiss, so that I can back out without saving unwanted changes.

#### Acceptance Criteria

- **FRONTEND-004-AC-16** [AUTO]: `EditSeriesForm` shall render its root element with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` referencing a visible heading reading "Edit Series".
- **FRONTEND-004-AC-17** [AUTO]: When `EditSeriesForm` mounts, the title input shall receive focus.
- **FRONTEND-004-AC-18** [AUTO]: When the "Cancel" button is clicked, `EditSeriesForm` shall call its required `onCancel` prop and shall not call `seriesApi.update`.
- **FRONTEND-004-AC-19** [AUTO]: When the `Escape` key is pressed while `EditSeriesForm` is mounted and no submission is in flight, `EditSeriesForm` shall call `onCancel` and shall not call `seriesApi.update`.

---

### Requirement 7: `EditSeriesForm` — Fields, Pre-Populated

**User Story:** As a user, I want the edit form to start filled in with the series' current values, so that I only have to change what I actually want to change.

#### Acceptance Criteria

- **FRONTEND-004-AC-20** [AUTO]: `EditSeriesForm` shall accept a required `series: Series` prop and render one labelled input per field: every `CreateSeriesRequest` field (Frontend Spec 003, Requirement 3), plus `currentSeason` (number) and `currentEpisode` (number).
- **FRONTEND-004-AC-21** [AUTO]: On mount, each field shall be pre-populated from the corresponding value on the `series` prop, with `null` mapped to an empty string (text/number inputs) or unset state, matching the pattern established for controlled inputs in `AddSeriesForm`.
- **FRONTEND-004-AC-22** [AUTO]: `UpdateSeriesRequest` (`src/types/series.ts`) shall additionally declare optional `currentSeason` and `currentEpisode` number fields (verified by TypeScript compilation via `npm run build`, since this is a type-only change with no runtime behavior of its own).

---

### Requirement 8: `EditSeriesForm` — Client-Side Validation

**User Story:** As a user, I want to be told immediately if an edit I entered is invalid, so that I don't have to wait for a round trip to the server to find out.

Ranges mirror the backend's actual constraints, same as `AddSeriesForm` (Frontend Spec 003, Requirement 4) — see that spec for the shared range table (`year`, `totalSeasons`, `totalEpisodes`, `imdbRating`, `metacriticRating`, `rottenTomatoesRating`, `personalRating`).

#### Acceptance Criteria

- **FRONTEND-004-AC-23** [AUTO]: If `title` is blank when the form is submitted, `EditSeriesForm` shall display "Title is required" next to the title field and shall not call `seriesApi.update`.
- **FRONTEND-004-AC-24** [AUTO]: If `year`, `totalSeasons`, `totalEpisodes`, `imdbRating`, `metacriticRating`, `rottenTomatoesRating`, or `personalRating` is provided and outside its range (Frontend Spec 003, Requirement 4 ranges), `EditSeriesForm` shall display an inline error next to the affected field and shall not call `seriesApi.update`.
- **FRONTEND-004-AC-25** [AUTO]: If `currentSeason` is provided and is less than `1`, `EditSeriesForm` shall display an inline error next to the field and shall not call `seriesApi.update`.
- **FRONTEND-004-AC-26** [AUTO]: If `currentEpisode` is provided and is less than `1`, `EditSeriesForm` shall display an inline error next to the field and shall not call `seriesApi.update`.
- **FRONTEND-004-AC-27** [AUTO]: If `currentSeason` and `totalSeasons` are both provided and `currentSeason` exceeds `totalSeasons`, `EditSeriesForm` shall display "Current season cannot exceed total seasons" next to the `currentSeason` field and shall not call `seriesApi.update`.

---

### Requirement 9: `EditSeriesForm` — Submission States

**User Story:** As a user, I want to see my edit is being saved and know clearly whether it succeeded, so that I trust the app reflects my changes.

#### Acceptance Criteria

- **FRONTEND-004-AC-28** [AUTO]: While the `seriesApi.update` call is in flight, `EditSeriesForm` shall disable the submit and Cancel buttons and change the submit button's label to "Saving...".
- **FRONTEND-004-AC-29** [AUTO]: When `seriesApi.update` resolves, `EditSeriesForm` shall call its required `onSuccess` prop with the updated `Series` exactly once.
- **FRONTEND-004-AC-30** [AUTO]: If `seriesApi.update` rejects with an `ApiError`, `EditSeriesForm` shall display `ApiError.message` in a `role="alert"` region and shall call neither `onSuccess` nor `onCancel`.
- **FRONTEND-004-AC-31** [AUTO]: If the rejected `ApiError` has a populated `details` map, `EditSeriesForm` shall render each entry as an inline error next to its corresponding field, in addition to the top-level alert.
- **FRONTEND-004-AC-32** [AUTO]: After a failed submission, the form shall retain the user's entered values (no reset to the original `series` values) and shall re-enable the submit and Cancel buttons.

---

### Requirement 10: `EditSeriesForm` — Submission Payload

**User Story:** As a developer, I want the edit form to send only what changed or is populated, so that the PATCH semantics stay correct and no out-of-contract data leaks.

#### Acceptance Criteria

- **FRONTEND-004-AC-33** [AUTO]: Submitting the form shall call `seriesApi.update` with `series.id` and an `UpdateSeriesRequest` containing every field currently non-blank in the form (same omit-if-blank rule as `AddSeriesForm`'s `CreateSeriesRequest` payload, extended to include `currentSeason`/`currentEpisode`), and the payload shall never contain `id`, `dateAdded`, or `dateCompleted` keys.

---

### Requirement 11: App Integration

**User Story:** As a user, I want an edited series to reflect its new values in my list without a manual page reload, so that editing feels complete.

#### Acceptance Criteria

- **FRONTEND-004-AC-34** [AUTO]: `App.tsx` shall render `EditSeriesForm` only while its editing-series state is non-`null` (conditional render, not CSS visibility), initialised to `null`.
- **FRONTEND-004-AC-35** [AUTO]: When `SeriesList`'s `onEditClick` fires, `App.tsx` shall set the editing-series state to the clicked `Series`.
- **FRONTEND-004-AC-36** [AUTO]: When `EditSeriesForm`'s `onCancel` fires, `App.tsx` shall set the editing-series state to `null` without changing `SeriesList`'s `key`.
- **FRONTEND-004-AC-37** [AUTO]: When `EditSeriesForm`'s `onSuccess` fires, `App.tsx` shall set the editing-series state to `null` and change `SeriesList`'s `key`, forcing a remount and re-fetch (same refresh-via-remount pattern as `AddSeriesForm`, Frontend Spec 003).

---

### Requirement 12: Shall Not — Data Handling

**User Story:** As a developer, I want to be sure editing and deleting don't leak user-entered content, so that the app stays safe and predictable.

#### Acceptance Criteria

- **FRONTEND-004-AC-38** [AUTO]: `EditSeriesForm` shall not log form field values (`title`, `personalNotes`, or any other entered value) to the console.
- **FRONTEND-004-AC-39** [AUTO]: `SeriesList` shall not log series data to the console as part of the delete flow.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `Series`, `UpdateSeriesRequest`, `CreateSeriesRequest` | `src/types/series.ts` (amended here — see AC-22) |
| `seriesApi.update()`, `seriesApi.delete()` | `src/services/seriesApi.ts` (Frontend Spec 001) |
| `ApiError` | `src/types/api.ts` (Frontend Spec 001) |
| `PATCH /api/v1/series/{id}` contract, `currentSeason`/`totalSeasons` validation, `dateCompleted` auto-set/clear | `series_spec_002_crud.md`, `SeriesService.update` |
| `DELETE /api/v1/series/{id}` contract, 404 response shape | `series_spec_002_crud.md`, `SeriesController`/`GlobalExceptionHandler` |
| `currentSeason > totalSeasons` → 400 via `IllegalArgumentException`, message-only (no `details` map) | `backend/src/main/java/com/example/seriestracker/service/SeriesService.java`, `exception/GlobalExceptionHandler.java` |
| Field range constraints | `backend/src/main/java/com/example/seriestracker/model/SeriesEntity.java` bean-validation annotations |
| Modal structure, field-set pattern, validation/payload conventions | `src/components/AddSeriesForm.tsx` (Frontend Spec 003) |
| Row structure, `data-testid="series-row"`, `onSeriesClick` | `src/components/SeriesList.tsx` (Frontend Spec 002) |
| Refresh-via-remount pattern | `frontend_spec_003_add_series_form.md` |

---

## TDD Test Case Sketches

### `src/components/SeriesList.test.tsx` (additions)

```typescript
describe('FRONTEND-004-AC-01/02/03/04: edit button wiring', () => {
  it('renders labelled Edit and Delete buttons per row', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'The Office' })])
    render(<SeriesList />)
    await waitFor(() => screen.getByText('The Office'))
    expect(screen.getByRole('button', { name: /edit the office/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete the office/i })).toBeInTheDocument()
  })

  it('calls onEditClick with the full series and not onSeriesClick', async () => {
    const onEditClick = vi.fn()
    const onSeriesClick = vi.fn()
    const series = makeSeries({ id: '1', title: 'The Office' })
    mockGetAll.mockResolvedValue([series])
    render(<SeriesList onEditClick={onEditClick} onSeriesClick={onSeriesClick} />)
    await waitFor(() => screen.getByText('The Office'))

    fireEvent.click(screen.getByTestId('edit-series-btn'))
    expect(onEditClick).toHaveBeenCalledWith(series)
    expect(onSeriesClick).not.toHaveBeenCalled()
  })

  it('does not throw when Edit is clicked without onEditClick', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByTestId('edit-series-btn'))
  })
})
```

```typescript
describe('FRONTEND-004-AC-06/07/08/09: delete confirmation', () => {
  it('shows Confirm/Cancel in place of Edit/Delete when Delete is clicked', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))

    fireEvent.click(screen.getByTestId('delete-series-btn'))
    expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument()
    expect(screen.getByTestId('cancel-delete-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('delete-series-btn')).not.toBeInTheDocument()
  })

  it('restores Edit/Delete when the confirmation Cancel is clicked, without deleting', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))

    fireEvent.click(screen.getByTestId('cancel-delete-btn'))
    expect(screen.getByTestId('delete-series-btn')).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('restores Edit/Delete on Escape without deleting', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))

    fireEvent.keyDown(screen.getByTestId('series-row'), { key: 'Escape' })
    expect(screen.getByTestId('delete-series-btn')).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('does not call onSeriesClick when the row is clicked while confirming', async () => {
    const onSeriesClick = vi.fn()
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Show' })])
    render(<SeriesList onSeriesClick={onSeriesClick} />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))

    fireEvent.click(screen.getByTestId('series-row'))
    expect(onSeriesClick).not.toHaveBeenCalled()
  })
})
```

```typescript
describe('FRONTEND-004-AC-10/11/12: delete loading state', () => {
  it('disables Confirm/Cancel and shows "Deleting..." while in flight', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Show' })])
    mockDelete.mockReturnValue(new Promise(() => undefined))
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    expect(mockDelete).toHaveBeenCalledWith('1')
    expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled()
    expect(screen.getByTestId('cancel-delete-btn')).toBeDisabled()
  })
})
```

```typescript
describe('FRONTEND-004-AC-13/14: delete success', () => {
  it('removes the row without re-fetching', async () => {
    mockGetAll.mockResolvedValue([
      makeSeries({ id: '1', title: 'Show A' }),
      makeSeries({ id: '2', title: 'Show B' }),
    ])
    mockDelete.mockResolvedValue(undefined)
    render(<SeriesList />)
    await waitFor(() => screen.getAllByTestId('delete-series-btn'))

    fireEvent.click(screen.getAllByTestId('delete-series-btn')[0])
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    await waitFor(() => expect(screen.queryByText('Show A')).not.toBeInTheDocument())
    expect(screen.getByText('Show B')).toBeInTheDocument()
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state after deleting the last series', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Only Show' })])
    mockDelete.mockResolvedValue(undefined)
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    await waitFor(() => expect(screen.getByText(/no series yet/i)).toBeInTheDocument())
  })
})
```

```typescript
describe('FRONTEND-004-AC-15: delete error handling', () => {
  it('shows an alert scoped to the row and keeps it deletable', async () => {
    mockGetAll.mockResolvedValue([makeSeries({ id: '1', title: 'Show' })])
    mockDelete.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('delete-series-btn'))
    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/internal server error/i))
    expect(screen.getByText('Show')).toBeInTheDocument()
    expect(screen.getByTestId('confirm-delete-btn')).not.toBeDisabled()
  })
})
```

### `src/components/EditSeriesForm.test.tsx`

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EditSeriesForm } from './EditSeriesForm'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'
import type { Series } from '../types/series'

vi.mock('../services/seriesApi')
const mockUpdate = vi.mocked(seriesApi.update)

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'test-id',
    title: 'Test Show',
    year: 2020,
    genres: 'Drama',
    totalSeasons: 5,
    totalEpisodes: 50,
    currentSeason: 2,
    currentEpisode: 10,
    status: SeriesStatus.WATCHING,
    imdbRating: 8.4,
    metacriticRating: null,
    rottenTomatoesRating: null,
    personalRating: null,
    personalNotes: null,
    dateAdded: '2026-01-01T00:00:00Z',
    dateCompleted: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

function renderForm(overrides: Partial<{ series: Series; onCancel: () => void; onSuccess: (s: Series) => void }> = {}) {
  const series = overrides.series ?? makeSeries()
  const onCancel = overrides.onCancel ?? vi.fn()
  const onSuccess = overrides.onSuccess ?? vi.fn()
  render(<EditSeriesForm series={series} onCancel={onCancel} onSuccess={onSuccess} />)
  return { series, onCancel, onSuccess }
}
```

```typescript
describe('FRONTEND-004-AC-16/17: dialog structure & focus', () => {
  it('renders as a labelled dialog focused on the title input', () => {
    renderForm()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: /edit series/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/^title/i)).toHaveFocus()
  })
})
```

```typescript
describe('FRONTEND-004-AC-18/19: dismissal', () => {
  it('calls onCancel on Cancel click and Escape, without updating', () => {
    const { onCancel } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
```

```typescript
describe('FRONTEND-004-AC-20/21: fields pre-populated', () => {
  it('pre-fills every field from the series prop', () => {
    renderForm({ series: makeSeries({ title: 'The Office', currentSeason: 3, currentEpisode: 12 }) })
    expect(screen.getByLabelText(/^title/i)).toHaveValue('The Office')
    expect(screen.getByLabelText(/current season/i)).toHaveValue(3)
    expect(screen.getByLabelText(/current episode/i)).toHaveValue(12)
  })

  it('renders null fields as empty', () => {
    renderForm({ series: makeSeries({ metacriticRating: null }) })
    expect(screen.getByLabelText(/metacritic rating/i)).toHaveValue(null)
  })
})
```

```typescript
describe('FRONTEND-004-AC-25/26/27: currentSeason/currentEpisode validation', () => {
  it('blocks submit when currentSeason exceeds totalSeasons', () => {
    renderForm({ series: makeSeries({ totalSeasons: 3, currentSeason: 5 }) })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText(/current season cannot exceed total seasons/i)).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('blocks submit when currentEpisode is less than 1', () => {
    renderForm({ series: makeSeries({ currentEpisode: 0 }) })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
```

```typescript
describe('FRONTEND-004-AC-33: submission payload', () => {
  it('calls seriesApi.update with the series id and populated fields, no id/dateAdded/dateCompleted', async () => {
    const series = makeSeries({ id: 'abc-123', title: 'Show' })
    mockUpdate.mockResolvedValue(series)
    renderForm({ series })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const [id, payload] = mockUpdate.mock.calls[0]
    expect(id).toBe('abc-123')
    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('dateAdded')
    expect(payload).not.toHaveProperty('dateCompleted')
  })
})
```

```typescript
describe('FRONTEND-004-AC-28/29: loading & success', () => {
  it('disables buttons while saving and calls onSuccess once on resolve', async () => {
    const series = makeSeries()
    const updated = { ...series, title: 'Updated' }
    mockUpdate.mockResolvedValue(updated)
    const { onSuccess } = renderForm({ series })

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSuccess).toHaveBeenCalledWith(updated)
  })
})
```

```typescript
describe('FRONTEND-004-AC-30/31/32: server-side error handling', () => {
  it('shows the ApiError message and retains entered values', async () => {
    mockUpdate.mockRejectedValue(new ApiError(500, 'Internal server error'))
    const { onSuccess, onCancel } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/internal server error/i))
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled()
  })
})
```

```typescript
describe('FRONTEND-004-AC-38: no leaked data', () => {
  it('never logs form values to the console', async () => {
    const logSpy = vi.spyOn(console, 'log')
    mockUpdate.mockResolvedValue(makeSeries())
    renderForm()
    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'private note' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    expect(logSpy.mock.calls.flat()).not.toContain(expect.stringContaining('private note'))
  })
})
```

### `src/App.test.tsx` (additions)

```typescript
describe('FRONTEND-004-AC-34/35: opening the edit form', () => {
  it('renders EditSeriesForm pre-filled when a row Edit button is clicked', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show', status: 'WATCHING' } as Series])
    render(<App />)
    await waitFor(() => screen.getByTestId('edit-series-btn'))

    fireEvent.click(screen.getByTestId('edit-series-btn'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Show')
  })
})

describe('FRONTEND-004-AC-36: cancelling an edit', () => {
  it('closes the dialog without re-fetching', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', title: 'Show' } as Series])
    render(<App />)
    await waitFor(() => screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByTestId('edit-series-btn'))

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-004-AC-37: successful edit refreshes the list', () => {
  it('closes the dialog and re-fetches the series list', async () => {
    mockGetAll
      .mockResolvedValueOnce([{ id: '1', title: 'Show' } as Series])
      .mockResolvedValueOnce([{ id: '1', title: 'Updated Show' } as Series])
    mockUpdate.mockResolvedValue({ id: '1', title: 'Updated Show' } as Series)

    render(<App />)
    await waitFor(() => screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByTestId('edit-series-btn'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Updated Show')).toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-004-AC-01: Edit/Delete buttons rendered per row with testids and aria-labels
- [x] FRONTEND-004-AC-02: `SeriesList` accepts optional `onEditClick`
- [x] FRONTEND-004-AC-03: Edit button calls `onEditClick(series)`, not `onSeriesClick`
- [x] FRONTEND-004-AC-04: no crash when `onEditClick` not provided
- [x] FRONTEND-004-AC-05: Delete button alone triggers no callback/API call
- [x] FRONTEND-004-AC-06: Delete click shows Confirm/Cancel in place of Edit/Delete
- [x] FRONTEND-004-AC-07: confirmation Cancel restores buttons, no delete call
- [x] FRONTEND-004-AC-08: Escape restores buttons, no delete call
- [x] FRONTEND-004-AC-09: row click during confirmation doesn't call `onSeriesClick`
- [x] FRONTEND-004-AC-10: Confirm calls `seriesApi.delete(id)`
- [x] FRONTEND-004-AC-11: Confirm disabled + "Deleting..." while in flight
- [x] FRONTEND-004-AC-12: Cancel disabled while in flight
- [x] FRONTEND-004-AC-13: successful delete removes row without re-fetch
- [x] FRONTEND-004-AC-14: empty state shown after deleting last series
- [x] FRONTEND-004-AC-15: delete failure shows scoped alert, keeps row, allows retry
- [x] FRONTEND-004-AC-16: `EditSeriesForm` dialog role/aria-modal/aria-labelledby
- [x] FRONTEND-004-AC-17: title input focused on mount
- [x] FRONTEND-004-AC-18: Cancel calls `onCancel`, no update call
- [x] FRONTEND-004-AC-19: Escape calls `onCancel`, no update call
- [x] FRONTEND-004-AC-20: labelled input per field incl. `currentSeason`/`currentEpisode`
- [x] FRONTEND-004-AC-21: fields pre-populated from `series` prop
- [x] FRONTEND-004-AC-22: `UpdateSeriesRequest` gains `currentSeason`/`currentEpisode`
- [x] FRONTEND-004-AC-23: blank title blocks submit
- [x] FRONTEND-004-AC-24: out-of-range shared fields block submit
- [x] FRONTEND-004-AC-25: `currentSeason` < 1 blocks submit
- [x] FRONTEND-004-AC-26: `currentEpisode` < 1 blocks submit
- [x] FRONTEND-004-AC-27: `currentSeason` > `totalSeasons` blocks submit
- [x] FRONTEND-004-AC-28: submit/Cancel disabled + "Saving..." while in flight
- [x] FRONTEND-004-AC-29: `onSuccess` called once with updated series
- [x] FRONTEND-004-AC-30: `ApiError.message` shown on failure, no `onSuccess`/`onCancel`
- [x] FRONTEND-004-AC-31: `ApiError.details` mapped to field errors
- [x] FRONTEND-004-AC-32: values retained, buttons re-enabled after failure
- [x] FRONTEND-004-AC-33: payload has `series.id` + populated fields only, never `id`/`dateAdded`/`dateCompleted`
- [x] FRONTEND-004-AC-34: `EditSeriesForm` conditionally rendered by `App.tsx`
- [x] FRONTEND-004-AC-35: `onEditClick` opens the form pre-filled in `App.tsx`
- [x] FRONTEND-004-AC-36: `onCancel` closes the form without refetching
- [x] FRONTEND-004-AC-37: `onSuccess` closes the form and remounts `SeriesList` to refetch
- [x] FRONTEND-004-AC-38: no form values logged to console (`EditSeriesForm`)
- [x] FRONTEND-004-AC-39: no series data logged to console (delete flow)
