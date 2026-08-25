# Frontend Spec 036: On-Demand Streaming Availability Check on Series Detail

**Status**: Done. Implemented as written, no deviations from the design decisions above. Verification notes:
- `npm test` (449 tests, all files) and `npm run lint` both clean; `npm run build` (tsc -b && vite build) also clean.
- Real-backend verification: the backend process already running in this environment turned out to be a stale build predating this branch's `series_spec_026` controller route (confirmed via `curl` — `GET /series/{id}/watch-providers` 404'd with the generic `NoResourceFoundException` "Not found" body even for a series that existed, i.e. the route wasn't mapped at all). Restarted it via `gradlew.bat bootRun` from `backend/` (current branch's compiled classes), after which the same request returned real TMDB-sourced provider data (`Amazon Prime Video`, `Disney Plus`, `Sky Go`, `Amazon Prime Video with Ads` for a live-tracked series) with a 200. No backend source was modified.
- No browser-automation tool is available in this agent environment (no Playwright/Puppeteer/screenshot tool), so an actual visual/click-through pass in a rendered browser did not happen — this is a real gap, not a silent skip. What *was* verified: the Vitest/RTL test suite (jsdom, not real CSS rendering per this project's own steering note) exercises the full click → loading → success/error/reset flow end-to-end against the mocked `seriesApi`, the production `vite build` compiles the new component/JSX with no type errors, and the live backend confirmed the real endpoint contract (shape, unwrapping, 200 status) matches what `seriesApi.getWatchProviders` expects. A follow-up manual browser check (open `localhost:5173`, navigate to a series with a resolvable `imdbId`, click "Check Streaming Availability") is recommended before merging, per this project's own CLAUDE.md note that a green Vitest suite alone isn't sign-off for new UI styling/rendering.
**Priority**: P3 (informational, on-demand only — mirrors Series Spec 026's own priority)
**Depends on**: Series Spec 026 (`series_spec_026_series_watch_providers.md`, `GET /api/v1/series/{id}/watch-providers`) — **not yet implemented at the time this spec was authored; implement the backend first**, Frontend Spec 025 (`frontend_spec_025_watch_providers.md`, `StreamingProvider` type, the provider-name/logo display convention this spec factors into a shared component), Frontend Spec 005 (`frontend_spec_005_series_detail.md`, `SeriesDetail`'s field-row structure this inserts into)
**Frontend Stage**: 36 of N

## Overview

A live-review request: a button on `SeriesDetail`, positioned between the Overview and Keywords field groups, that checks — on demand, never automatically, never persisted — where the tracked series is currently streaming. The user's own framing: this only matters right before starting something in the backlog; once `WATCHING` you already know, once `COMPLETED` you don't care (unless rewatching) — so this is deliberately a manual action, not something that loads automatically with the rest of the page.

This also factors `RecommendationsList`'s existing streaming-provider display markup (Frontend Spec 025) out into a small shared presentational component, since `SeriesDetail` needs to render the exact same "logo + name, or a quiet not-available note" shape for its own check result.

## Design Decisions

- **New shared component `StreamingProviders`** (`frontend/src/components/StreamingProviders.tsx` + `.module.css`), props `{ providers: StreamingProvider[] }`, rendering exactly what `RecommendationsList` already inlines today: a provider list (logo when `logoUrl` is non-null, always the name as text) when non-empty, or "Not currently streaming in the UK" when empty. `RecommendationsList.tsx` is refactored to use it (its `.streamingProviders`/`.streamingProvider`/`.streamingProviderLogo`/`.streamingProvidersEmpty` CSS module classes move to the new component's own module CSS) — this is a pure extraction, not a behavior change, and `RecommendationsList`'s existing tests must keep passing unmodified (they query by text/role, not by CSS class).
- **Manual only, never auto-fetched.** No `useEffect` fires this on mount or on `id` change — only a button click does. This matches the user's explicit reasoning (only useful right before starting something) and mirrors the existing "Show keywords" per-card pattern's own on-demand posture (Frontend Spec 010/028).
- **Not persisted client-side either.** The result lives in local component state only, cleared on every new fetch (no stale-result flash) and reset whenever `id` changes (mirroring `SeriesDetail`'s existing `fetchedForId`-keyed reset-on-navigate block, which already resets every other action's transient state — this spec adds its three new state fields to that same block).
- **Every click re-fetches; no caching.** Consistent with the "streaming availability changes constantly" rationale — a second click while looking at the same series is a deliberate "check again," not a redundant call to short-circuit.
- **Placement: its own block between the Overview and Keywords `<dl>` field-groups**, not inside either one (it's an action + result, not a static field) and not down in the bottom actions bar (unlike Edit/Delete/Refresh, this isn't a persisted-data mutation or a page-level action — it belongs contextually next to the descriptive content it's answering a question about).
- **Errors are scoped to this block, not a page-level error** — mirroring `refreshError`/`rewatchError`'s existing scoped-`role="alert"` treatment elsewhere in this same component, not the top-level `!loading && !notFound && error` branch (which is for the initial series fetch failing entirely).

---

## Requirement 1: Shared `StreamingProviders` display component

**User story**: As a developer, I want the streaming-provider display markup in one place, so `RecommendationsList` and `SeriesDetail` can't drift apart on how they show the same data shape.

### FRONTEND-036-AC-01 [AUTO]
**Statement**: A new `StreamingProviders` component shall accept `providers: StreamingProvider[]` and render one entry per provider (logo `<img alt={provider.name}>` when `logoUrl` is non-null, always the name as text) when non-empty, or "Not currently streaming in the UK" when empty — identical output to `RecommendationsList`'s current inline markup (Frontend Spec 025, `FRONTEND-025-AC-03`/`AC-04`).

**References**: new `frontend/src/components/StreamingProviders.tsx`/`.module.css`.

**Test Case (Red)**:
```typescript
// src/components/StreamingProviders.test.tsx
describe('FRONTEND-036-AC-01: provider list rendering', () => {
  it('renders provider name and logo when present', () => {
    render(
      <StreamingProviders
        providers={[{ name: 'Netflix', logoUrl: 'https://image.tmdb.org/t/p/w92/abc.jpg' }]}
      />,
    )
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByAltText('Netflix')).toHaveAttribute(
      'src',
      'https://image.tmdb.org/t/p/w92/abc.jpg',
    )
  })

  it('renders the name alone when logoUrl is null', () => {
    render(<StreamingProviders providers={[{ name: 'BBC iPlayer', logoUrl: null }]} />)
    expect(screen.getByText('BBC iPlayer')).toBeInTheDocument()
    expect(screen.queryByAltText('BBC iPlayer')).not.toBeInTheDocument()
  })

  it('renders the not-streaming note when empty', () => {
    render(<StreamingProviders providers={[]} />)
    expect(screen.getByText('Not currently streaming in the UK')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: extract the component from `RecommendationsList.tsx`'s existing JSX, moving the four CSS classes to its own module.

---

### FRONTEND-036-AC-02 [AUTO]
**Statement**: `RecommendationsList.tsx` shall use `StreamingProviders` in place of its current inline markup. Its existing tests (Frontend Spec 025) shall pass unmodified.

**References**: `RecommendationsList.tsx`, `RecommendationsList.test.tsx`.

**Test Case (Red)**: none new — regression guard. **Test Case (Green)**: run `RecommendationsList.test.tsx` unmodified after the refactor; all existing tests must stay green.

---

## Requirement 2: On-demand streaming check on `SeriesDetail`

**User story**: As a user deciding whether to start a series in my backlog, I want to check where it's currently streaming without leaving the page, so I don't have to look it up myself elsewhere.

### FRONTEND-036-AC-03 [AUTO]
**Statement**: `seriesApi` shall gain `getWatchProviders: (id: string) => Promise<StreamingProvider[]>`, calling `GET /series/{id}/watch-providers` and unwrapping the `{ data: StreamingProvider[] }` envelope (mirroring `getRecommendationKeywords`'s existing shape).

**References**: `frontend/src/services/seriesApi.ts`, Series Spec 026 (`GET /api/v1/series/{id}/watch-providers`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-036-AC-03: getWatchProviders', () => {
  it('GETs /series/{id}/watch-providers and unwraps the provider list', async () => {
    client.get.mockResolvedValue({
      data: { data: [{ name: 'Netflix', logoUrl: null }], count: 1 },
    })
    const result = await seriesApi.getWatchProviders('abc-123')
    expect(client.get).toHaveBeenCalledWith('/series/abc-123/watch-providers')
    expect(result).toEqual([{ name: 'Netflix', logoUrl: null }])
  })
})
```

**Test Case (Green)**: add the method, matching `getRecommendationKeywords`'s existing implementation shape.

---

### FRONTEND-036-AC-04 [AUTO]
**Statement**: `SeriesDetail` shall render a "Check Streaming Availability" button in its own block between the Overview and Keywords field-groups. Clicking it shall call `seriesApi.getWatchProviders(id)`; while in flight, the button shall show a busy state ("Checking...") and be disabled.

**References**: `SeriesDetail.tsx`, the `fields` render block between the Overview and Keywords `<dl>`s.

**Test Case (Red)**:
```typescript
describe('FRONTEND-036-AC-04: streaming check button, busy state', () => {
  it('renders between Overview and Keywords, shows a busy state while in flight', async () => {
    mockGetById.mockResolvedValue(makeSeries({ overview: 'A show.' }))
    let resolveCheck: (v: StreamingProvider[]) => void
    mockGetWatchProviders.mockReturnValue(
      new Promise((resolve) => {
        resolveCheck = resolve
      }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText('A show.')

    const button = screen.getByRole('button', { name: /check streaming availability/i })
    fireEvent.click(button)

    expect(button).toBeDisabled()
    expect(screen.getByText(/checking/i)).toBeInTheDocument()

    resolveCheck!([])
    await waitFor(() => expect(button).not.toBeDisabled())
  })
})
```

**Test Case (Green)**: add `streamingCheckLoading`/`streamingCheckError`/`streamingCheckResult` state (reset alongside every other transient action state in the existing `fetchedForId !== id` block) and the button + handler.

---

### FRONTEND-036-AC-05 [AUTO]
**Statement**: On success, `SeriesDetail` shall render the result via the shared `StreamingProviders` component (Requirement 1), replacing any previous result or error.

**References**: `SeriesDetail.tsx`, `StreamingProviders` component.

**Test Case (Red)**:
```typescript
describe('FRONTEND-036-AC-05: successful check renders the result', () => {
  it('shows providers via the shared StreamingProviders component', async () => {
    mockGetById.mockResolvedValue(makeSeries({ overview: 'A show.' }))
    mockGetWatchProviders.mockResolvedValue([{ name: 'Netflix', logoUrl: null }])
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText('A show.')

    fireEvent.click(screen.getByRole('button', { name: /check streaming availability/i }))

    expect(await screen.findByText('Netflix')).toBeInTheDocument()
  })

  it('shows the not-streaming note when the result is empty', async () => {
    mockGetById.mockResolvedValue(makeSeries({ overview: 'A show.' }))
    mockGetWatchProviders.mockResolvedValue([])
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText('A show.')

    fireEvent.click(screen.getByRole('button', { name: /check streaming availability/i }))

    expect(
      await screen.findByText('Not currently streaming in the UK'),
    ).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: `setStreamingCheckResult(providers)` on success, rendered conditionally (`streamingCheckResult !== null`) via `<StreamingProviders providers={streamingCheckResult} />`.

---

### FRONTEND-036-AC-06 [AUTO]
**Statement**: If `seriesApi.getWatchProviders` rejects, `SeriesDetail` shall show a scoped inline error (`role="alert"`) in the same block, and shall not show a stale previous result.

**References**: `SeriesDetail.tsx`'s existing scoped-error convention (`refreshError`/`rewatchError`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-036-AC-06: check failure', () => {
  it('shows a scoped alert and clears any previous result', async () => {
    mockGetById.mockResolvedValue(makeSeries({ overview: 'A show.' }))
    mockGetWatchProviders
      .mockResolvedValueOnce([{ name: 'Netflix', logoUrl: null }])
      .mockRejectedValueOnce(new ApiError(502, 'Unable to reach the streaming lookup service. Please try again.'))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)
    await screen.findByText('A show.')
    const button = screen.getByRole('button', { name: /check streaming availability/i })

    fireEvent.click(button)
    expect(await screen.findByText('Netflix')).toBeInTheDocument()

    fireEvent.click(button)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByText('Netflix')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: clear `streamingCheckResult` at the start of every click (before the request resolves), set `streamingCheckError` on rejection.

---

### FRONTEND-036-AC-07 [AUTO]
**Statement**: Navigating to a different series (`id` change) shall reset `streamingCheckLoading`/`streamingCheckError`/`streamingCheckResult` to their initial states, same as every other transient per-series action state already reset in that block.

**References**: `SeriesDetail.tsx`'s existing `fetchedForId !== id` reset block.

**Test Case (Red)**:
```typescript
describe('FRONTEND-036-AC-07: resets on navigating to a different series', () => {
  it('clears a prior result when id changes', async () => {
    mockGetById.mockResolvedValue(makeSeries({ id: '1', overview: 'A show.' }))
    mockGetWatchProviders.mockResolvedValue([{ name: 'Netflix', logoUrl: null }])
    const { rerender } = render(
      <SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />,
    )
    await screen.findByText('A show.')
    fireEvent.click(screen.getByRole('button', { name: /check streaming availability/i }))
    expect(await screen.findByText('Netflix')).toBeInTheDocument()

    mockGetById.mockResolvedValue(makeSeries({ id: '2', overview: 'Another show.' }))
    rerender(<SeriesDetail id="2" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText('Another show.')
    expect(screen.queryByText('Netflix')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add the three new `set...` calls to the existing `fetchedForId !== id` block alongside `setRefreshSummary(null)` etc.

---

## Cross-References

| This spec | Source |
|---|---|
| `GET /api/v1/series/{id}/watch-providers` | `series_spec_026_series_watch_providers.md` |
| `StreamingProvider` type, provider-list/empty-state display convention being factored into a shared component | `frontend_spec_025_watch_providers.md` |
| `SeriesDetail`'s field-group structure (Overview/Keywords as separate `<dl>`s), `fetchedForId`-keyed reset block, existing scoped-error convention (`refreshError`/`rewatchError`) | `frontend_spec_005_series_detail.md`, this session's live-review amendments to `frontend_spec_012_series_lifecycle_controls.md` |
| "Show keywords" per-card on-demand fetch precedent | `frontend_spec_010_recommendations.md`, `frontend_spec_028_recommendation_metadata_and_overview_display.md` |

---

## Acceptance Criteria Summary

- [x] FRONTEND-036-AC-01: shared `StreamingProviders` component, matching Frontend Spec 025's existing display shape
- [x] FRONTEND-036-AC-02: `RecommendationsList` uses it, existing tests unmodified
- [x] FRONTEND-036-AC-03: `seriesApi.getWatchProviders`
- [x] FRONTEND-036-AC-04: button between Overview/Keywords, busy state while in flight
- [x] FRONTEND-036-AC-05: success renders via `StreamingProviders`
- [x] FRONTEND-036-AC-06: failure shows a scoped alert, clears stale results
- [x] FRONTEND-036-AC-07: resets on navigating to a different series
