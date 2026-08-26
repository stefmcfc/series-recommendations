# Frontend Spec 038: Duplicate Series Error Display

**Status**: ✅ Done (AC-01) — confirmed the existing `submitError` path already covers this cleanly, exactly as predicted; zero new component code
**Priority**: P2 (mirrors Series Spec 028's priority)
**Depends on**: Series Spec 028 (`series_spec_028_prevent_duplicate_series.md`, `POST /api/v1/series` → `409 Conflict` on a duplicate `imdbId`) — **not yet implemented at the time this spec was authored; implement the backend first**, Frontend Spec 003 (`frontend_spec_003_add_series_form.md`, `AddSeriesForm`'s existing `submitError` handling)
**Frontend Stage**: 38 of N

## Overview

Series Spec 028 makes `POST /api/v1/series` reject a duplicate `imdbId` with `409 Conflict` and a message naming the conflicting title. This spec confirms that rejection surfaces clearly to the user — and, per the Design Decisions below, expects that to already be true with **no new UI code**, since `AddSeriesForm` already has a generic submit-failure path.

## Design Decisions

- **No new component code is expected.** `AddSeriesForm.handleSubmit`'s existing `catch` block already does:
  ```typescript
  if (err instanceof ApiError) {
    setSubmitError(err.message)
    if (err.details) setFieldErrors(err.details as FieldErrors)
  }
  ```
  and renders `submitError` via an existing `role="alert"` banner at the top of the form. A `409` `ApiError` with a clear message (`"A series with this IMDb ID is already tracked: Breaking Bad"`) flows through this exact path with zero changes. This spec exists to **pin that behavior with an explicit test**, not to add a feature — if the implementer finds the existing path does *not* already cover this cleanly (e.g. the message reads awkwardly, or `err.details` interferes), fix whatever gap is found and note the deviation in this spec's own Status line, but do not build new duplicate-specific UI (a special "already tracked" banner, a modal, a redirect-to-existing-series link) unless the plain existing error banner turns out to be genuinely unusable — it is the established pattern for every other create-time failure on this form (a blank title, an invalid rating), and a duplicate-`imdbId` rejection is not different enough to warrant a bespoke treatment.

---

## Requirement 1: Duplicate-Series Submission Error

**User story**: As a user who tries to add a series I'm already tracking, I want to see a clear message explaining why it didn't work, so I'm not left wondering if the click just silently failed.

### FRONTEND-038-AC-01 [AUTO]
**Statement**: When `seriesApi.create` rejects with a `409` `ApiError` (a duplicate `imdbId`), `AddSeriesForm` shall display that error's message via its existing `submitError` banner (`role="alert"`), and shall not call `onSuccess`.

**References**: `AddSeriesForm.tsx`'s existing `handleSubmit`/`submitError` (unchanged).

**Test Case (Red)**:
```typescript
describe('FRONTEND-038-AC-01: duplicate series submission error', () => {
  it('shows the backend message and does not call onSuccess', async () => {
    const onSuccess = vi.fn()
    vi.spyOn(seriesApi, 'create').mockRejectedValue(
      new ApiError(409, 'A series with this IMDb ID is already tracked: Breaking Bad'),
    )
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={onSuccess} />)
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Breaking Bad' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A series with this IMDb ID is already tracked: Breaking Bad',
    )
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
```

**Test Case (Green)**: expected to already pass unmodified against `AddSeriesForm`'s existing code, per this spec's Design Decisions — if it doesn't, fix the minimal gap found (see Design Decisions) rather than adding new UI.

---

## Cross-References

| This spec | Source |
|---|---|
| `POST /api/v1/series` → `409` on duplicate `imdbId` | `series_spec_028_prevent_duplicate_series.md` |
| `AddSeriesForm`'s existing `submitError`/`ApiError` handling this spec pins with a test | `frontend_spec_003_add_series_form.md` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-038-AC-01: a `409` duplicate-series error renders via the existing `submitError` banner
