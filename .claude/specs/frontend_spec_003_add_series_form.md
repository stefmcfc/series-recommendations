# Frontend Spec 003: Add Series Form

**Status**: ✅ Implemented. `src/components/AddSeriesForm.tsx` (+ `AddSeriesForm.module.css`, `AddSeriesForm.test.tsx`), `src/components/SeriesList.tsx`/`SeriesList.test.tsx` amended for `onAddClick`, `src/App.tsx` amended to own the modal's open state and refresh-via-remount, `src/App.test.tsx` (new) covers the App-level wiring. All 66 frontend tests pass (`npm test`), lint is clean (`npm run lint`), and a real-browser pass (light + dark theme, full create round-trip against the backend) confirmed rendering/contrast and behavior that Vitest/jsdom can't verify.
**Priority**: P1 (first write-path UI — unblocks the rest of CRUD)
**Depends on**: Frontend Spec 001 (Types & API Service Layer) ✅, Frontend Spec 002 (`SeriesList`) ✅, Backend Spec 002 (CRUD) ✅
**Frontend Stage**: 3 of N

---

## Overview

This spec covers `AddSeriesForm` — a modal dialog that lets the user create a new series — and the small change to `SeriesList` needed to open it. It's the first write-path UI in the app (everything built so far only reads).

**Deliverables**:
- `src/components/AddSeriesForm.tsx` — the modal form component
- `src/components/AddSeriesForm.module.css` — CSS Modules styling, following the pattern set by `SeriesList.module.css`
- `src/components/AddSeriesForm.test.tsx` — Vitest + React Testing Library tests
- A small amendment to `src/components/SeriesList.tsx`: add an optional `onAddClick` prop and wire it to the two existing (currently inert) `data-testid="add-series-btn"` buttons defined in Frontend Spec 002
- A small amendment to `src/App.tsx`: own the modal's open/closed state, render `AddSeriesForm` conditionally, and refresh `SeriesList` on success
- `src/App.test.tsx` (new) — covers the App-level wiring between the three pieces above

**Design decisions captured here**:
- **Field set matches `CreateSeriesRequest` exactly** (`src/types/series.ts`), not the full `Series` type — this deliberately excludes `currentSeason`/`currentEpisode`. Those aren't part of the create contract (progress tracking is a later feature, not something you set while adding a series to your backlog).
- **No React portal.** The dialog renders in the normal component tree with a fixed-position CSS overlay (CSS Modules, matching the `SeriesList` styling approach). Revisit with a portal only if a second concurrent modal (e.g. an eventual edit form) creates real stacking problems — not needed for one modal at a time.
- **Refresh-via-remount.** On successful creation, `App.tsx` doesn't try to splice the new series into `SeriesList`'s internal state (that state is private to the component). Instead it bumps a `key` prop on `<SeriesList>`, forcing a clean remount that re-fetches from `GET /api/v1/series` — reuses `SeriesList`'s existing, already-tested fetch logic unmodified rather than exposing a new imperative refresh API.
- **`status` defaults to `BACKLOG` in the form itself** (a real, pre-selected `<select>` value), rather than being left empty and relying on the backend's column default. Same effective result, clearer UI — the user always sees what will be saved.
- **Cancel is disabled while a submission is in flight** — prevents closing the dialog out from under a request that's still running.
- **Validation runs on submit, not on every keystroke** — matches the app's scale and existing patterns (`SeriesList` also does nothing more elaborate than a single-shot fetch/retry cycle). No live-as-you-type validation.
- **No "are you sure" prompt on Cancel** with unsaved input — out of scope; note it here so it isn't mistaken for a gap.

---

## Glossary

| Term | Definition |
|------|-----------|
| `AddSeriesForm` | The modal dialog component this spec delivers |
| `CreateSeriesRequest` | The request shape `seriesApi.create()` accepts (`src/types/series.ts`) |
| Field-level error | A validation message shown next to a specific input |
| Submit error | A top-level error shown when `seriesApi.create()` itself rejects (network/server), as opposed to a field-level validation failure caught client-side |
| Refresh-via-remount | Changing `SeriesList`'s `key` prop to force React to unmount/remount it, triggering its existing on-mount fetch |

---

## Requirements

### Requirement 1: Opening the Form from `SeriesList`

**User Story:** As a user, I want clicking either "Add Series" button to open the add-series form, so that I can start adding a series from wherever I am in the list.

#### Acceptance Criteria

- **FRONTEND-003-AC-01** [AUTO]: The `SeriesList` component shall accept an optional `onAddClick?: () => void` prop.
- **FRONTEND-003-AC-02** [AUTO]: When the header "Add Series" button (`data-testid="add-series-btn"`, visible in all states per Frontend Spec 002 Requirement 6) is clicked, if `onAddClick` is provided, `SeriesList` shall call it.
- **FRONTEND-003-AC-03** [AUTO]: When the empty-state "Add your first series" button (`data-testid="add-series-btn"`, per Frontend Spec 002 Requirement 4) is clicked, if `onAddClick` is provided, `SeriesList` shall call it.
- **FRONTEND-003-AC-04** [AUTO]: `SeriesList` shall not throw if either button is clicked while `onAddClick` is not provided (same optional-callback safety pattern as `onSeriesClick`).

---

### Requirement 2: Modal Structure & Lifecycle

**User Story:** As a user, I want the add-series form to appear as a focused dialog I can dismiss, so that I can add a series without losing my place or getting stuck.

#### Acceptance Criteria

- **FRONTEND-003-AC-05** [AUTO]: `AddSeriesForm` shall render its root element with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` referencing a visible heading reading "Add Series".
- **FRONTEND-003-AC-06** [AUTO]: When `AddSeriesForm` mounts, the title input shall receive focus.
- **FRONTEND-003-AC-07** [AUTO]: When the "Cancel" button is clicked, `AddSeriesForm` shall call its required `onCancel` prop.
- **FRONTEND-003-AC-08** [AUTO]: When the `Escape` key is pressed while `AddSeriesForm` is mounted and no submission is in flight, `AddSeriesForm` shall call `onCancel`.
- **FRONTEND-003-AC-09** [AUTO]: Neither dismissal path (Cancel click or `Escape`) shall call `seriesApi.create`.

---

### Requirement 3: Form Fields

**User Story:** As a user, I want to enter all the details I know about a series when adding it, so that I don't have to edit it again immediately after.

#### Acceptance Criteria

- **FRONTEND-003-AC-10** [AUTO]: `AddSeriesForm` shall render one labelled input per `CreateSeriesRequest` field, each with an associated `<label>`: `title` (text, required), `year` (number), `genres` (text), `totalSeasons` (number), `totalEpisodes` (number), `status` (select: WATCHING/COMPLETED/DROPPED/BACKLOG), `imdbRating` (number, step 0.1), `metacriticRating` (number), `rottenTomatoesRating` (number), `personalRating` (number), `personalNotes` (textarea).
- **FRONTEND-003-AC-11** [AUTO]: The title input shall be marked required (`required` attribute and a visible indicator, e.g. "Title *").
- **FRONTEND-003-AC-12** [AUTO]: The `status` select shall default to `BACKLOG` when the form is opened.

---

### Requirement 4: Client-Side Validation

**User Story:** As a user, I want to be told immediately if something I entered is invalid, so that I don't have to wait for a round trip to the server to find out.

Ranges below mirror the backend's actual bean-validation constraints (`backend/src/main/java/uk/co/stefirby/seriestracker/model/SeriesEntity.java`) so a client-valid submission is never rejected by the server for range reasons.

#### Acceptance Criteria

- **FRONTEND-003-AC-13** [AUTO]: If `title` is blank when the form is submitted, `AddSeriesForm` shall display "Title is required" next to the title field and shall not call `seriesApi.create`.
- **FRONTEND-003-AC-14** [AUTO]: If `year` is provided and is outside `1`–`2026`, `AddSeriesForm` shall display an inline error next to the year field and shall not call `seriesApi.create`.
- **FRONTEND-003-AC-15** [AUTO]: If `totalSeasons` or `totalEpisodes` is provided and is less than `1`, `AddSeriesForm` shall display an inline error next to the affected field and shall not call `seriesApi.create`.
- **FRONTEND-003-AC-16** [AUTO]: If `imdbRating` is provided and is outside `0`–`10`, `AddSeriesForm` shall display an inline error next to the field and shall not call `seriesApi.create`.
- **FRONTEND-003-AC-17** [AUTO]: If `metacriticRating` or `rottenTomatoesRating` is provided and is outside `0`–`100`, `AddSeriesForm` shall display an inline error next to the affected field and shall not call `seriesApi.create`.
- **FRONTEND-003-AC-18** [AUTO]: If `personalRating` is provided and is outside `1`–`5`, `AddSeriesForm` shall display an inline error next to the field and shall not call `seriesApi.create`.
- **FRONTEND-003-AC-19** [AUTO]: When `title` is non-blank and every provided optional field passes its range check, submitting the form shall call `seriesApi.create` with a `CreateSeriesRequest` containing `title`, `status`, and only the optional fields the user actually populated (blank optional fields omitted, not sent as empty strings or `0`).

---

### Requirement 5: Submission — Loading State

**User Story:** As a user, I want to see that my submission is in progress, so that I don't submit twice or think the app is frozen.

#### Acceptance Criteria

- **FRONTEND-003-AC-20** [AUTO]: While the `seriesApi.create` call is in flight, `AddSeriesForm` shall disable the submit button and change its label to "Saving...".
- **FRONTEND-003-AC-21** [AUTO]: While the `seriesApi.create` call is in flight, the Cancel button shall be disabled.

---

### Requirement 6: Submission — Success

**User Story:** As a user, I want the form to close and my new series to show up in my list once it's saved, so that I get confirmation it worked.

#### Acceptance Criteria

- **FRONTEND-003-AC-22** [AUTO]: When `seriesApi.create` resolves, `AddSeriesForm` shall call its required `onSuccess` prop with the created `Series`.
- **FRONTEND-003-AC-23** [AUTO]: `AddSeriesForm` itself shall not decide to unmount on success — closing the dialog is the caller's responsibility via `onSuccess` (see Requirement 8). `AddSeriesForm` shall call `onSuccess` exactly once per successful submission.

---

### Requirement 7: Submission — Server-Side Error Handling

**User Story:** As a user, I want a clear message if saving fails, so that I know what to fix or that I should try again.

#### Acceptance Criteria

- **FRONTEND-003-AC-24** [AUTO]: If `seriesApi.create` rejects with an `ApiError`, `AddSeriesForm` shall display `ApiError.message` in a `role="alert"` region and shall call neither `onSuccess` nor `onCancel`.
- **FRONTEND-003-AC-25** [AUTO]: If the rejected `ApiError` has a populated `details` map, `AddSeriesForm` shall render each entry as an inline error next to its corresponding field, in addition to the top-level alert.
- **FRONTEND-003-AC-26** [AUTO]: After a failed submission, the form shall retain the user's entered values (no reset) and shall re-enable the submit and Cancel buttons.

---

### Requirement 8: App Integration

**User Story:** As a user, I want my newly added series to actually appear in my list without a manual page reload, so that adding a series feels complete.

#### Acceptance Criteria

- **FRONTEND-003-AC-27** [AUTO]: `App.tsx` shall render `AddSeriesForm` only while its add-form-open state is `true` (conditional render, not CSS visibility), initialised to `false`.
- **FRONTEND-003-AC-28** [AUTO]: When `SeriesList`'s `onAddClick` fires, `App.tsx` shall set the add-form-open state to `true`.
- **FRONTEND-003-AC-29** [AUTO]: When `AddSeriesForm`'s `onCancel` fires, `App.tsx` shall set the add-form-open state to `false` without changing `SeriesList`'s `key`.
- **FRONTEND-003-AC-30** [AUTO]: When `AddSeriesForm`'s `onSuccess` fires, `App.tsx` shall set the add-form-open state to `false` and change `SeriesList`'s `key`, forcing a remount and re-fetch (see "Refresh-via-remount" design decision above).

---

### Requirement 9: Shall Not — Data Handling

**User Story:** As a developer, I want to be sure this form doesn't leak user-entered content or send fields outside its contract, so that the app stays safe and predictable.

#### Acceptance Criteria

- **FRONTEND-003-AC-31** [AUTO]: `AddSeriesForm` shall not log form field values (`title`, `personalNotes`, or any other entered value) to the console.
- **FRONTEND-003-AC-32** [AUTO]: The object passed to `seriesApi.create` shall never contain `currentSeason` or `currentEpisode` keys — those aren't part of `CreateSeriesRequest`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `CreateSeriesRequest`, `Series`, `SeriesStatus` | `src/types/series.ts` (Frontend Spec 001) |
| `seriesApi.create()` | `src/services/seriesApi.ts` (Frontend Spec 001) |
| `ApiError` | `src/types/api.ts` (Frontend Spec 001) |
| `POST /api/v1/series` contract, 400 validation response shape | `series_spec_002_crud.md`, `SeriesController`/`GlobalExceptionHandler` |
| Field range constraints (`year`, `totalSeasons`, `totalEpisodes`, `imdbRating`, `metacriticRating`, `rottenTomatoesRating`, `personalRating`) | `backend/src/main/java/uk/co/stefirby/seriestracker/model/SeriesEntity.java` bean-validation annotations |
| `data-testid="add-series-btn"` (header + empty-state buttons) | `frontend_spec_002.md` Requirements 4 and 6 |
| `SeriesList` component being amended | `src/components/SeriesList.tsx` (Frontend Spec 002) |

---

## TDD Test Case Sketches

### `src/components/SeriesList.test.tsx` (additions)

```typescript
describe('FRONTEND-003-AC-01/02/03: onAddClick wiring', () => {
  it('calls onAddClick when the header Add Series button is clicked', async () => {
    const onAddClick = vi.fn()
    mockGetAll.mockResolvedValue([makeSeries({ title: 'Show' })])
    render(<SeriesList onAddClick={onAddClick} />)
    await waitFor(() => screen.getByText('Show'))
    fireEvent.click(screen.getByTestId('add-series-btn'))
    expect(onAddClick).toHaveBeenCalledTimes(1)
  })

  it('calls onAddClick when the empty-state Add button is clicked', async () => {
    const onAddClick = vi.fn()
    mockGetAll.mockResolvedValue([])
    render(<SeriesList onAddClick={onAddClick} />)
    await waitFor(() => screen.getByTestId('add-series-btn'))
    fireEvent.click(screen.getByTestId('add-series-btn'))
    expect(onAddClick).toHaveBeenCalledTimes(1)
  })

  it('does not throw when clicked without onAddClick', async () => {
    mockGetAll.mockResolvedValue([])
    render(<SeriesList />)
    await waitFor(() => screen.getByTestId('add-series-btn'))
    fireEvent.click(screen.getByTestId('add-series-btn'))
  })
})
```

### `src/components/AddSeriesForm.test.tsx`

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AddSeriesForm } from './AddSeriesForm'
import { seriesApi } from '../services/seriesApi'
import { ApiError } from '../types/api'
import { SeriesStatus } from '../types/series'

vi.mock('../services/seriesApi')
const mockCreate = vi.mocked(seriesApi.create)

beforeEach(() => {
  vi.clearAllMocks()
})

function renderForm(overrides: Partial<{ onCancel: () => void; onSuccess: (s: unknown) => void }> = {}) {
  const onCancel = overrides.onCancel ?? vi.fn()
  const onSuccess = overrides.onSuccess ?? vi.fn()
  render(<AddSeriesForm onCancel={onCancel} onSuccess={onSuccess} />)
  return { onCancel, onSuccess }
}
```

```typescript
describe('FRONTEND-003-AC-05/06: dialog structure & focus', () => {
  it('renders as a labelled dialog', () => {
    renderForm()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: /add series/i })).toBeInTheDocument()
  })

  it('focuses the title input on mount', () => {
    renderForm()
    expect(screen.getByLabelText(/title/i)).toHaveFocus()
  })
})
```

```typescript
describe('FRONTEND-003-AC-07/08/09: dismissal', () => {
  it('calls onCancel when Cancel is clicked, without submitting', () => {
    const { onCancel } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('calls onCancel on Escape, without submitting', () => {
    const { onCancel } = renderForm()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
```

```typescript
describe('FRONTEND-003-AC-10/11/12: fields', () => {
  it('renders a labelled control for every CreateSeriesRequest field', () => {
    renderForm()
    for (const label of [
      /title/i, /year/i, /genres/i, /total seasons/i, /total episodes/i,
      /status/i, /imdb rating/i, /metacritic rating/i, /rotten tomatoes rating/i,
      /personal rating/i, /notes/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('marks title as required', () => {
    renderForm()
    expect(screen.getByLabelText(/title/i)).toBeRequired()
  })

  it('defaults status to BACKLOG', () => {
    renderForm()
    expect(screen.getByLabelText(/status/i)).toHaveValue(SeriesStatus.BACKLOG)
  })
})
```

```typescript
describe('FRONTEND-003-AC-13..18: client-side validation', () => {
  it('blocks submit and shows an error when title is blank', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText(/title is required/i)).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('blocks submit when year is out of range', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Show' } })
    fireEvent.change(screen.getByLabelText(/year/i), { target: { value: '1800' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText(/year/i)).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('blocks submit when imdbRating is out of range', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Show' } })
    fireEvent.change(screen.getByLabelText(/imdb rating/i), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('blocks submit when personalRating is out of range', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Show' } })
    fireEvent.change(screen.getByLabelText(/personal rating/i), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
```

```typescript
describe('FRONTEND-003-AC-19: valid submission payload', () => {
  it('calls seriesApi.create with only populated fields', async () => {
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as never)
    renderForm()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Show' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0][0]
    expect(payload.title).toBe('Show')
    expect(payload.status).toBe(SeriesStatus.BACKLOG)
    expect(payload).not.toHaveProperty('year')
    expect(payload).not.toHaveProperty('currentSeason')
    expect(payload).not.toHaveProperty('currentEpisode')
  })
})
```

```typescript
describe('FRONTEND-003-AC-20/21: loading state', () => {
  it('disables Save and Cancel and shows "Saving..." while in flight', async () => {
    mockCreate.mockReturnValue(new Promise(() => undefined))
    renderForm()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Show' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })
})
```

```typescript
describe('FRONTEND-003-AC-22/23: success', () => {
  it('calls onSuccess with the created series exactly once', async () => {
    const created = { id: '1', title: 'Show' }
    mockCreate.mockResolvedValue(created as never)
    const { onSuccess } = renderForm()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Show' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSuccess).toHaveBeenCalledWith(created)
  })
})
```

```typescript
describe('FRONTEND-003-AC-24/25/26: server-side error handling', () => {
  it('shows the ApiError message and does not call onSuccess/onCancel', async () => {
    mockCreate.mockRejectedValue(new ApiError(500, 'Internal server error'))
    const { onSuccess, onCancel } = renderForm()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Show' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/internal server error/i))
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('maps ApiError.details onto the matching fields', async () => {
    mockCreate.mockRejectedValue(
      new ApiError(400, 'Validation failed', { title: 'Title is required' }),
    )
    renderForm()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getAllByText(/title is required/i).length).toBeGreaterThan(0))
  })

  it('keeps entered values and re-enables buttons after a failed submission', async () => {
    mockCreate.mockRejectedValue(new ApiError(500, 'Internal server error'))
    renderForm()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Show' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByLabelText(/title/i)).toHaveValue('Show')
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).not.toBeDisabled()
  })
})
```

```typescript
describe('FRONTEND-003-AC-31/32: no leaked data, no out-of-contract fields', () => {
  it('never logs form values to the console', async () => {
    const logSpy = vi.spyOn(console, 'log')
    const errorSpy = vi.spyOn(console, 'error')
    mockCreate.mockResolvedValue({ id: '1', title: 'Show' } as never)
    renderForm()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Show' } })
    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'private note' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect(logSpy.mock.calls.flat()).not.toContain(expect.stringContaining('private note'))
    expect(errorSpy.mock.calls.flat()).not.toContain(expect.stringContaining('private note'))
  })
})
```

### `src/App.test.tsx` (new)

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import App from './App'
import { seriesApi } from './services/seriesApi'

vi.mock('./services/seriesApi')
const mockGetAll = vi.mocked(seriesApi.getAll)
const mockCreate = vi.mocked(seriesApi.create)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FRONTEND-003-AC-27/28: opening the form', () => {
  it('does not render AddSeriesForm until Add Series is clicked', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await waitFor(() => screen.getByTestId('add-series-btn'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('add-series-btn'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('FRONTEND-003-AC-29: cancelling', () => {
  it('closes the dialog without re-fetching', async () => {
    mockGetAll.mockResolvedValue([])
    render(<App />)
    await waitFor(() => screen.getByTestId('add-series-btn'))
    fireEvent.click(screen.getByTestId('add-series-btn'))

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-003-AC-30: successful creation refreshes the list', () => {
  it('closes the dialog and re-fetches the series list', async () => {
    mockGetAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: '1', title: 'New Show' } as never])
    mockCreate.mockResolvedValue({ id: '1', title: 'New Show' } as never)

    render(<App />)
    await waitFor(() => screen.getByTestId('add-series-btn'))
    fireEvent.click(screen.getByTestId('add-series-btn'))

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'New Show' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('New Show')).toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-003-AC-01: `SeriesList` accepts optional `onAddClick` prop
- [x] FRONTEND-003-AC-02: header Add Series button calls `onAddClick`
- [x] FRONTEND-003-AC-03: empty-state Add button calls `onAddClick`
- [x] FRONTEND-003-AC-04: no crash when `onAddClick` not provided
- [x] FRONTEND-003-AC-05: dialog role/aria-modal/aria-labelledby
- [x] FRONTEND-003-AC-06: title input focused on mount
- [x] FRONTEND-003-AC-07: Cancel click calls `onCancel`
- [x] FRONTEND-003-AC-08: Escape calls `onCancel`
- [x] FRONTEND-003-AC-09: dismissal never calls `seriesApi.create`
- [x] FRONTEND-003-AC-10: labelled input per `CreateSeriesRequest` field
- [x] FRONTEND-003-AC-11: title marked required
- [x] FRONTEND-003-AC-12: status defaults to BACKLOG
- [x] FRONTEND-003-AC-13: blank title blocks submit with inline error
- [x] FRONTEND-003-AC-14: out-of-range year blocks submit
- [x] FRONTEND-003-AC-15: out-of-range totalSeasons/totalEpisodes blocks submit
- [x] FRONTEND-003-AC-16: out-of-range imdbRating blocks submit
- [x] FRONTEND-003-AC-17: out-of-range metacriticRating/rottenTomatoesRating blocks submit
- [x] FRONTEND-003-AC-18: out-of-range personalRating blocks submit
- [x] FRONTEND-003-AC-19: valid submit calls `seriesApi.create` with only populated fields
- [x] FRONTEND-003-AC-20: submit button disabled + "Saving..." while in flight
- [x] FRONTEND-003-AC-21: Cancel disabled while in flight
- [x] FRONTEND-003-AC-22: `onSuccess` called with created series
- [x] FRONTEND-003-AC-23: `onSuccess` called exactly once
- [x] FRONTEND-003-AC-24: `ApiError.message` shown in `role="alert"` on failure; no `onSuccess`/`onCancel`
- [x] FRONTEND-003-AC-25: `ApiError.details` mapped to field-level errors
- [x] FRONTEND-003-AC-26: values retained and buttons re-enabled after failure
- [x] FRONTEND-003-AC-27: `AddSeriesForm` conditionally rendered by `App.tsx`
- [x] FRONTEND-003-AC-28: `onAddClick` opens the form in `App.tsx`
- [x] FRONTEND-003-AC-29: `onCancel` closes the form without refetching
- [x] FRONTEND-003-AC-30: `onSuccess` closes the form and remounts `SeriesList` to refetch
- [x] FRONTEND-003-AC-31: no form values logged to console
- [x] FRONTEND-003-AC-32: `currentSeason`/`currentEpisode` never sent
