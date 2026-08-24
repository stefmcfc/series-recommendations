# Frontend Spec 010: Recommendations View

**Status**: Done (Requirements 1–7).

Original scope (Requirements 1–6) — all 19 acceptance criteria implemented and covered by Vitest (`npm test`: 190/190 passing across the suite), `npm run lint` clean, `npm run build` clean.

**Amendment (2026-08-23, Requirement 7, done)**: auto-triggers a single-series refresh (`series_spec_018_series_refresh.md`) immediately after a recommendation is saved via Mark as Watched/Add to List, so IMDb rating, season/episode counts, TMDB rating, and keywords are populated automatically instead of requiring a separate manual refresh afterward. Files touched: `frontend/src/components/RecommendationsList.tsx` (`handleAddSuccess` now receives the created `Series` from `AddSeriesForm`'s `onSuccess` and fires `seriesApi.refresh(series.id).catch(() => undefined)` after removing the card — fire-and-forget, no state tracking, no error surfaced on rejection) and `frontend/src/components/RecommendationsList.test.tsx` (three new tests under `FRONTEND-010-AC-21/22` and `FRONTEND-010-AC-23`, covering Mark as Watched, Add to List, and a rejected refresh staying silent). `npm test`: 336/336 passing; `npm run lint` clean. No other files needed changes — `RecommendationControls.tsx` (the query-filter panel touched by Frontend Spec 011's Requirement 5) is unrelated to this create-then-refresh flow, which lives entirely in `RecommendationsList.tsx`'s existing `handleAddSuccess`.

Files touched (Requirements 1–6): `frontend/src/types/series.ts` (`imdbId` added to `Series`/`CreateSeriesRequest`/`OmdbLookupResult`, new `Recommendation` type — `UpdateSeriesRequest` inherits `imdbId?` via `Partial<CreateSeriesRequest>`), `frontend/src/services/seriesApi.ts` + `frontend/src/services/__tests__/seriesApi.test.ts` (`getRecommendations`, `ignoreSeries`), `frontend/src/components/AddSeriesForm.tsx` + `.test.tsx` (new `initialValues` prop, plus a same-pattern `imdbId` form field — not a visible input, just carried through `buildPayload`/`applyLookupResult`/`buildInitialFormState` so a recommendation's `imdbId` survives into the create payload), `frontend/src/components/RecommendationsList.tsx` + `.test.tsx` + `.module.css` (new component), `frontend/src/components/SeriesList.tsx` (added `data-testid="series-list"` to the container, needed to distinguish it from `RecommendationsList` in `App.tsx`'s tests), `frontend/src/App.tsx` + `frontend/src/App.test.tsx` (nav toggle, `mainView` state), and `imdbId: null` added to the `makeSeries()` test helpers in `SeriesList.test.tsx`/`SeriesDetail.test.tsx`/`EditSeriesForm.test.tsx` (required once `Series.imdbId` became non-optional).

**Real-browser verification caveat**: `app.tmdb.api-key` is not configured in this environment, so `GET /api/v1/series/recommendations` correctly 502s once a `COMPLETED` series with an `imdbId` exists (verified directly via curl and through the UI — loading → error state → `role="alert"` → Retry re-fetches, confirmed with two 502s in the network log) and returns an empty list when there's no `imdbId`-bearing watched series to seed a TMDB lookup from (the empty-state path, also confirmed in-browser). The one thing that could **not** be verified against a live TMDB response is an actual populated recommendations list from the real API. To still verify the populated-list UI (card content, "Because you watched", poster fallback, Mark as Watched/Add to List prefill, Ignore) in a real browser rather than only under jsdom, the `GET /series/recommendations` network response was intercepted (Puppeteer's `page.setRequestInterception`, pointed at the same running Vite dev server + real backend) and stubbed with one `RecommendationDto`-shaped result; every subsequent interaction (nav toggle, card render, Mark as Watched → `AddSeriesForm` prefilled with `title`/`year`/`genres`/`status: COMPLETED`, Add to List → `status: BACKLOG`, Ignore → real `POST /series/ignored` call, confirmed 200 via curl afterward) ran against the real dev server and real backend, only the one upstream TMDB-dependent GET was faked. Nav toggle, `SearchFilter`/`ExportControls` criteria persistence across the view switch, and the error+Retry path were all verified with zero mocking, directly against the real backend.
**Priority**: P2 (quality-of-life discovery feature — not core CRUD)
**Depends on**: Frontend Spec 001 (Types & API Service Layer) ✅, Frontend Spec 003 (`AddSeriesForm`) ✅, Series Spec 006 (`GET /series/recommendations`, `POST /series/ignored`, `imdbId` field)
**Frontend Stage**: 10 of N

---

## Overview

Adds a `RecommendationsList` view: fetches `GET /api/v1/series/recommendations` (Series Spec 006) and renders each result as a card with a poster, title, year, genres, overview, TMDB rating, and (when present) "Because you watched {sourceTitle}". Each card offers three actions matching the triage workflow requested for this feature: **Mark as Watched** (opens `AddSeriesForm` pre-filled and defaulted to `COMPLETED`, so the user can add a personal rating/notes before saving), **Add to List** (same pre-fill, defaulted to `BACKLOG`), and **Ignore** (calls the new `POST /series/ignored`, removing the card so it never resurfaces).

**Design decisions**:
- **`AddSeriesForm` gains an optional `initialValues` prop** rather than building a second, parallel "add from recommendation" form. Recommendation pre-fill and the existing OMDb lookup-autofill (Frontend Spec 009) both end up flowing through the same field-mapping and payload-building logic this way — a recommendation card's "Mark as Watched"/"Add to List" is really just "open Add Series with some fields already known," and the user can still hit "Look Up" afterward to backfill IMDb/Metacritic/Rotten Tomatoes ratings TMDB doesn't provide.
- **Ignoring has no confirmation prompt**, unlike deleting an already-tracked series (Frontend Spec 004's inline-confirm pattern). These are titles the user never added — the stakes are lower, and the whole point of a fast triage list is not stopping to confirm every card.
- **The Recommendations view is a second top-level state toggle in `App.tsx`**, alongside the existing `SeriesList`/`SeriesDetail` toggle — a nav button, not a route (this app still has no router, per Frontend Spec 005's design decision).
- **A `Recommendation` always has a non-null `imdbId`** (Series Spec 006 excludes any candidate it can't resolve one for), so the Ignore action never needs a null-check branch for it.

---

## Requirements

### Requirement 1: Types & API Service Layer

**User story**: As a developer, I want the recommendations/ignore endpoints and the new `imdbId` field typed centrally, so every component that needs them shares one contract.

#### Acceptance Criteria

- **FRONTEND-010-AC-01** [AUTO]: `src/types/series.ts` shall gain `imdbId: string | null` on `Series`, `imdbId?: string` on `CreateSeriesRequest`/`UpdateSeriesRequest`, and `imdbId?: string` on `OmdbLookupResult` — mirroring `posterUrl`'s existing pattern (Series Spec 006 AC-02/AC-04).
- **FRONTEND-010-AC-02** [AUTO]: `src/types/series.ts` shall gain a new `Recommendation` interface: `title: string`, `year: number | null`, `genres: string | null`, `overview: string | null`, `posterUrl: string | null`, `tmdbRating: number | null`, `imdbId: string`, `sourceTitle: string | null` (mirroring `RecommendationDto`, Series Spec 006 AC-28).
- **FRONTEND-010-AC-03** [AUTO]: `seriesApi` shall gain `getRecommendations: (limit?: number) => Promise<Recommendation[]>`, calling `GET /series/recommendations` with an optional `limit` query param, unwrapping the `{ data: Recommendation[] }` envelope via the existing `request<T>()` helper.
- **FRONTEND-010-AC-04** [AUTO]: `seriesApi` shall gain `ignoreSeries: (imdbId: string, title: string, reason?: string) => Promise<void>`, calling `POST /series/ignored` with `{ imdbId, title, reason }` (omitting `reason` when not provided, same as other optional-field payload conventions).

---

### Requirement 2: `RecommendationsList` — Fetching & Display

**User story**: As a user, I want to see a list of series I might want to watch next, with enough information to decide.

#### Acceptance Criteria

- **FRONTEND-010-AC-05** [AUTO]: A new `RecommendationsList` component shall call `seriesApi.getRecommendations()` on mount and render one card per result.
- **FRONTEND-010-AC-06** [AUTO]: While the fetch is in flight, `RecommendationsList` shall display a loading indicator (`role="status"`, same pattern as `SeriesList`).
- **FRONTEND-010-AC-07** [AUTO]: If `seriesApi.getRecommendations` rejects, `RecommendationsList` shall display an error message (`role="alert"`) with a Retry button that re-triggers the fetch.
- **FRONTEND-010-AC-08** [AUTO]: If the result list is empty, `RecommendationsList` shall display an empty-state message (e.g. "No recommendations yet — mark a series as Completed to get suggestions.") rather than a blank area.
- **FRONTEND-010-AC-09** [AUTO]: Each card shall display the recommendation's title, poster (or a placeholder when `posterUrl` is null — same fixed-size-slot/`onError`-fallback pattern as `SeriesList`'s row thumbnail, Frontend Spec 009), year, genres, and overview.
- **FRONTEND-010-AC-10** [AUTO]: When `sourceTitle` is non-null, the card shall display it (e.g. "Because you watched {sourceTitle}"); when `null`, no such text is shown.

---

### Requirement 3: Mark as Watched / Add to List Actions

**User story**: As a user, I want to add a recommended series to my list — as something I've already watched, or as something to watch later — without retyping what's already known about it.

#### Acceptance Criteria

- **FRONTEND-010-AC-11** [AUTO]: `AddSeriesForm` shall accept an optional `initialValues?: Partial<CreateSeriesRequest>` prop, applied over `initialFormState` when the form's state is initialized.
- **FRONTEND-010-AC-12** [AUTO]: Each card shall render a "Mark as Watched" button that opens `AddSeriesForm` with `initialValues` built from that recommendation — `title`, and (only when non-null) `year`, `genres`, `posterUrl`, `imdbId` — plus `status: SeriesStatus.COMPLETED`.
- **FRONTEND-010-AC-13** [AUTO]: Each card shall render an "Add to List" button that opens `AddSeriesForm` with the same `initialValues` as AC-12 but `status: SeriesStatus.BACKLOG`.
- **FRONTEND-010-AC-14** [AUTO]: On a successful save from either action, `RecommendationsList` shall remove that recommendation's card from the displayed list (it's now a tracked series, not a pending suggestion).

---

### Requirement 4: Ignore Action

**User story**: As a user, I want to dismiss a recommendation I'm not interested in with one click, so it stops showing up.

#### Acceptance Criteria

- **FRONTEND-010-AC-15** [AUTO]: Each card shall render an "Ignore" button (`data-testid="ignore-btn"`) that calls `seriesApi.ignoreSeries(imdbId, title)` immediately on click, with no confirmation prompt (see design decisions).
- **FRONTEND-010-AC-16** [AUTO]: On success, `RecommendationsList` shall remove that card from the displayed list.
- **FRONTEND-010-AC-17** [AUTO]: If `seriesApi.ignoreSeries` rejects, `RecommendationsList` shall leave the card in place and display an inline error scoped to that card (`role="alert"`), not a page-level error.

---

### Requirement 5: Wiring into `App.tsx`

**User story**: As a user, I want a way to get from my series list to recommendations and back.

#### Acceptance Criteria

- **FRONTEND-010-AC-18** [AUTO]: `App.tsx` shall render a "Recommendations" nav button alongside the existing list view, toggling the main view between `SeriesList` and `RecommendationsList` (state-based, consistent with the existing `selectedSeriesId` toggle — no router).
- **FRONTEND-010-AC-19** [AUTO]: Switching to or from the Recommendations view shall not affect `SearchFilter`/`ExportControls`' active criteria state — they remain scoped to the `SeriesList` view only.

---

### Requirement 6: TMDB Attribution

**User story**: As the app's operator, I want the Recommendations view to credit TMDB as its data source, so the app honors the terms of TMDB's free API.

**Design decision**: TMDB's [attribution guidelines](https://www.themoviedb.org/about/logos-attribution) ask for their logo plus a standard attribution sentence on any screen displaying their data. This app is a personal, non-distributed project, but the requirement isn't scoped by audience size — a text-only notice is a low-cost way to honor it without pulling in an external logo asset (which would need its own image-hosting/licensing consideration). Shown unconditionally on the view (not only when results are present), since the view is TMDB-backed regardless of whether a given request happens to 502 or return zero results.

#### Acceptance Criteria

- **FRONTEND-010-AC-20** [AUTO]: `RecommendationsList` shall render a persistent, unobtrusive attribution notice reading "This product uses the TMDB API but is not endorsed or certified by TMDB." — visible regardless of loading/error/empty/populated state.

---

### Requirement 7: Auto-Refresh After Mark as Watched / Add to List

**User story**: As a user adding a series from Recommendations, I want its IMDb rating, season/episode counts, TMDB rating, and keywords to already be populated, so I don't have to remember to separately hit Refresh right after adding it.

**Design decision**: A `Recommendation` (`FRONTEND-010-AC-02`) only carries the fields TMDB's recommendation/discover endpoints return directly — `title`, `year`, `genres`, `overview`, `posterUrl`, `tmdbRating`, `imdbId`, etc. It never carries `totalSeasons`/`totalEpisodes`/`imdbRating`/`rottenTomatoesRating`/`keywords`, so a series created straight from `AddSeriesForm`'s recommendation-prefilled `initialValues` (Requirement 3) starts with those fields blank, exactly as the user observed — today, only a separate manual "Refresh" click on `SeriesDetail` (`frontend_spec_023_series_refresh.md`) populates them. Rather than adding a second, parallel "fetch these fields at creation time" code path, this requirement reuses the *existing* single-series refresh endpoint (`POST /series/{id}/refresh`, `series_spec_018_series_refresh.md`) by calling it automatically, in the background, right after `AddSeriesForm`'s `onSuccess` fires for a recommendation-sourced save — that endpoint already re-fetches every one of those fields in one call, including keywords (`series_spec_019_keyword_tracking.md`'s keyword sync is already wired into the refresh flow, not just creation). This applies to **both** Mark as Watched and Add to List — the user's own framing ("once a series is selected") isn't specific to the `COMPLETED` case, and a `BACKLOG` addition benefits from accurate season/episode counts just as much. The call is fire-and-forget from the user's perspective: it must never block card removal, and a failure here is no worse than the pre-existing status quo (the series was still saved; the user can still refresh manually), so it fails silently rather than surfacing a page-level error for a background convenience action.

#### Acceptance Criteria

- **FRONTEND-010-AC-21** [AUTO]: `RecommendationsList`'s `AddSeriesForm` instance (Requirement 3) shall pass an `onSuccess` handler that receives the created `Series` and, after removing the recommendation's card (`FRONTEND-010-AC-14`, unchanged), calls `seriesApi.refresh(series.id)` — for a save from **either** Mark as Watched or Add to List.
- **FRONTEND-010-AC-22** [AUTO]: The `seriesApi.refresh` call from `FRONTEND-010-AC-21` shall not block or delay the card's removal from the displayed list, and its promise's resolution is not awaited by any UI state change on `RecommendationsList` itself.
- **FRONTEND-010-AC-23** [AUTO]: If the `seriesApi.refresh` call from `FRONTEND-010-AC-21` rejects, `RecommendationsList` shall not display any error to the user (no alert, no console logging of series data) — the series remains saved and trackable; a failed background refresh is not worse than today's pre-amendment behavior, where no auto-refresh was attempted at all.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `GET /api/v1/series/recommendations`, `RecommendationDto` shape, `limit` clamping | `series_spec_006_recommendations.md` Requirement 7 |
| `POST /series/{id}/refresh`, fields populated by a refresh (`totalSeasons`/`totalEpisodes`/`imdbRating`/`rottenTomatoesRating`/`tmdbRating`/`tmdbVoteCount`/`productionStatus`) | `series_spec_018_series_refresh.md` |
| `seriesApi.refresh(id)` | `frontend_spec_023_series_refresh.md` (`FRONTEND-023-AC-03`) |
| Keyword sync already wired into the refresh flow (not just creation), so `FRONTEND-010-AC-21`'s auto-refresh also populates keywords | `series_spec_019_keyword_tracking.md` (`SERIES-019-AC-08`, Implementation Note) |
| `POST /api/v1/series/ignored`, idempotency behavior | `series_spec_006_recommendations.md` Requirement 8 |
| `imdbId` on `Series`/CRUD | `series_spec_006_recommendations.md` Requirement 1 |
| `AddSeriesForm` field/payload conventions being extended with `initialValues` | `AddSeriesForm.tsx` (Frontend Spec 003), `frontend_spec_009_omdb_autofill.md` |
| Fixed-size thumbnail/placeholder + `onError` fallback pattern | Frontend Spec 009 design decisions |
| Inline (non-modal) delete confirmation precedent — contrasted with Requirement 4's no-confirmation choice | Frontend Spec 004 |
| No-router, state-based view toggling precedent | Frontend Spec 005 design decisions |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (additions)

```typescript
describe('FRONTEND-010-AC-03: getRecommendations', () => {
  it('should unwrap { data: Recommendation[] } and pass limit through', async () => {
    const mockResults = [{ title: 'Ozark', imdbId: 'tt5071412' }]
    client.get.mockResolvedValue({ data: { data: mockResults } })

    const result = await seriesApi.getRecommendations(10)

    expect(client.get).toHaveBeenCalledWith('/series/recommendations', {
      params: { limit: 10 },
    })
    expect(result).toEqual(mockResults)
  })
})

describe('FRONTEND-010-AC-04: ignoreSeries', () => {
  it('should POST { imdbId, title } and omit reason when not given', async () => {
    client.post.mockResolvedValue({ data: { data: {} } })

    await seriesApi.ignoreSeries('tt5071412', 'Ozark')

    expect(client.post).toHaveBeenCalledWith('/series/ignored', {
      imdbId: 'tt5071412',
      title: 'Ozark',
    })
  })
})
```

### `src/components/RecommendationsList.test.tsx`

```typescript
vi.mock('../services/seriesApi')
const mockGetRecommendations = vi.mocked(seriesApi.getRecommendations)
const mockIgnoreSeries = vi.mocked(seriesApi.ignoreSeries)

describe('FRONTEND-010-AC-05/06/08/09/10: fetch, display, empty state', () => {
  it('renders a card per recommendation, with sourceTitle when present', async () => {
    mockGetRecommendations.mockResolvedValue([
      { title: 'Ozark', year: 2017, genres: 'Crime, Drama', overview: '...',
        posterUrl: null, tmdbRating: 8.4, imdbId: 'tt5071412', sourceTitle: 'Breaking Bad' },
    ])
    render(<RecommendationsList />)

    expect(await screen.findByText('Ozark')).toBeInTheDocument()
    expect(screen.getByText(/because you watched breaking bad/i)).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no results', async () => {
    mockGetRecommendations.mockResolvedValue([])
    render(<RecommendationsList />)

    expect(await screen.findByText(/no recommendations yet/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-010-AC-07: error and retry', () => {
  it('shows an alert with Retry on fetch failure, and retry re-fetches', async () => {
    mockGetRecommendations.mockRejectedValueOnce(new ApiError(502, 'Unable to reach the series lookup service. Please try again.'))
    mockGetRecommendations.mockResolvedValueOnce([])
    render(<RecommendationsList />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => expect(mockGetRecommendations).toHaveBeenCalledTimes(2))
  })
})

describe('FRONTEND-010-AC-12/13/14: mark as watched / add to list', () => {
  it('opens AddSeriesForm pre-filled with COMPLETED status, removes the card on save', async () => {
    mockGetRecommendations.mockResolvedValue([
      { title: 'Ozark', year: 2017, genres: 'Crime, Drama', overview: null,
        posterUrl: null, tmdbRating: 8.4, imdbId: 'tt5071412', sourceTitle: null },
    ])
    render(<RecommendationsList />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /mark as watched/i }))

    expect(screen.getByLabelText(/^title/i)).toHaveValue('Ozark')
    expect(screen.getByLabelText(/status/i)).toHaveValue(SeriesStatus.COMPLETED)
  })
})

describe('FRONTEND-010-AC-15/16/17: ignore', () => {
  it('removes the card immediately on successful ignore', async () => {
    mockGetRecommendations.mockResolvedValue([
      { title: 'Ozark', year: 2017, genres: null, overview: null,
        posterUrl: null, tmdbRating: null, imdbId: 'tt5071412', sourceTitle: null },
    ])
    mockIgnoreSeries.mockResolvedValue(undefined)
    render(<RecommendationsList />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByTestId('ignore-btn'))

    await waitFor(() => expect(mockIgnoreSeries).toHaveBeenCalledWith('tt5071412', 'Ozark'))
    expect(screen.queryByText('Ozark')).not.toBeInTheDocument()
  })

  it('keeps the card and shows a scoped alert if ignore fails', async () => {
    mockGetRecommendations.mockResolvedValue([
      { title: 'Ozark', year: 2017, genres: null, overview: null,
        posterUrl: null, tmdbRating: null, imdbId: 'tt5071412', sourceTitle: null },
    ])
    mockIgnoreSeries.mockRejectedValue(new ApiError(500, 'Internal server error'))
    render(<RecommendationsList />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByTestId('ignore-btn'))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Ozark')).toBeInTheDocument()
  })
})
```

### `src/components/AddSeriesForm.test.tsx` (addition)

```typescript
describe('FRONTEND-010-AC-11: initialValues prefill', () => {
  it('pre-populates fields from initialValues, only for provided fields', () => {
    render(
      <AddSeriesForm
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
        initialValues={{ title: 'Ozark', genres: 'Crime, Drama', status: SeriesStatus.COMPLETED }}
      />,
    )

    expect(screen.getByLabelText(/^title/i)).toHaveValue('Ozark')
    expect(screen.getByLabelText(/genres/i)).toHaveValue('Crime, Drama')
    expect(screen.getByLabelText(/status/i)).toHaveValue(SeriesStatus.COMPLETED)
    expect(screen.getByLabelText(/year/i)).toHaveValue(null) // untouched, not in initialValues
  })
})
```

### `src/App.test.tsx` (addition)

```typescript
describe('FRONTEND-010-AC-18/19: Recommendations nav toggle', () => {
  it('switches the main view without disturbing active search criteria', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /recommendations/i }))
    expect(await screen.findByTestId('recommendations-list')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /series list|my series/i }))
    expect(await screen.findByTestId('series-list')).toBeInTheDocument()
  })
})
```

### `src/components/RecommendationsList.test.tsx` (additions, Requirement 7)

```typescript
describe('FRONTEND-010-AC-21/22: auto-refresh after a successful save', () => {
  it('calls seriesApi.refresh with the new series id after Mark as Watched succeeds, without blocking card removal', async () => {
    mockGetRecommendations.mockResolvedValue([
      { title: 'Ozark', year: 2017, genres: null, overview: null, posterUrl: null,
        tmdbRating: null, voteCount: null, imdbId: 'tt5071412', sourceTitles: [], totalSourceCount: 0 },
    ])
    vi.mocked(seriesApi.create).mockResolvedValue({ id: 'new-id', title: 'Ozark' } as Series)
    mockRefresh.mockResolvedValue({
      series: { id: 'new-id', title: 'Ozark' } as Series,
      omdbRefreshed: true,
      tmdbRefreshed: true,
    })
    render(<RecommendationsList />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /mark as watched/i }))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.queryByText('Ozark')).not.toBeInTheDocument())
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledWith('new-id'))
  })
})

describe('FRONTEND-010-AC-23: a failed auto-refresh is silent', () => {
  it('does not show an error when the background refresh call rejects', async () => {
    mockGetRecommendations.mockResolvedValue([
      { title: 'Ozark', year: 2017, genres: null, overview: null, posterUrl: null,
        tmdbRating: null, voteCount: null, imdbId: 'tt5071412', sourceTitles: [], totalSourceCount: 0 },
    ])
    vi.mocked(seriesApi.create).mockResolvedValue({ id: 'new-id', title: 'Ozark' } as Series)
    mockRefresh.mockRejectedValue(new ApiError(502, 'Unable to reach the series lookup service.'))
    render(<RecommendationsList />)
    await screen.findByText('Ozark')

    fireEvent.click(screen.getByRole('button', { name: /mark as watched/i }))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledWith('new-id'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-010-AC-01: `imdbId` on `Series`/`CreateSeriesRequest`/`UpdateSeriesRequest`/`OmdbLookupResult`
- [x] FRONTEND-010-AC-02: `Recommendation` type
- [x] FRONTEND-010-AC-03: `seriesApi.getRecommendations`
- [x] FRONTEND-010-AC-04: `seriesApi.ignoreSeries`
- [x] FRONTEND-010-AC-05: `RecommendationsList` fetches on mount, renders cards
- [x] FRONTEND-010-AC-06: loading indicator
- [x] FRONTEND-010-AC-07: error + Retry
- [x] FRONTEND-010-AC-08: empty-state message
- [x] FRONTEND-010-AC-09: card content (title/poster/year/genres/overview)
- [x] FRONTEND-010-AC-10: "Because you watched {sourceTitle}" when present
- [x] FRONTEND-010-AC-11: `AddSeriesForm.initialValues` prop
- [x] FRONTEND-010-AC-12: "Mark as Watched" pre-fills + defaults to `COMPLETED`
- [x] FRONTEND-010-AC-13: "Add to List" pre-fills + defaults to `BACKLOG`
- [x] FRONTEND-010-AC-14: card removed from list after a successful save
- [x] FRONTEND-010-AC-15: "Ignore" button calls `ignoreSeries`, no confirmation
- [x] FRONTEND-010-AC-16: card removed on successful ignore
- [x] FRONTEND-010-AC-17: card stays + scoped alert on ignore failure
- [x] FRONTEND-010-AC-18: "Recommendations" nav toggle in `App.tsx`
- [x] FRONTEND-010-AC-19: toggling views doesn't disturb `SearchFilter`/`ExportControls` state
- [x] FRONTEND-010-AC-20: persistent TMDB attribution notice
- [x] FRONTEND-010-AC-21: auto-calls `seriesApi.refresh(series.id)` after a successful save
- [x] FRONTEND-010-AC-22: auto-refresh doesn't block card removal
- [x] FRONTEND-010-AC-23: a failed auto-refresh is silent, no error shown
