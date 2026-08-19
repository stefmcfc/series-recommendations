# Frontend Spec 010: Recommendations View

**Status**: Done — all 19 acceptance criteria implemented and covered by Vitest (`npm test`: 190/190 passing across the suite), `npm run lint` clean, `npm run build` clean.

Files touched: `frontend/src/types/series.ts` (`imdbId` added to `Series`/`CreateSeriesRequest`/`OmdbLookupResult`, new `Recommendation` type — `UpdateSeriesRequest` inherits `imdbId?` via `Partial<CreateSeriesRequest>`), `frontend/src/services/seriesApi.ts` + `frontend/src/services/__tests__/seriesApi.test.ts` (`getRecommendations`, `ignoreSeries`), `frontend/src/components/AddSeriesForm.tsx` + `.test.tsx` (new `initialValues` prop, plus a same-pattern `imdbId` form field — not a visible input, just carried through `buildPayload`/`applyLookupResult`/`buildInitialFormState` so a recommendation's `imdbId` survives into the create payload), `frontend/src/components/RecommendationsList.tsx` + `.test.tsx` + `.module.css` (new component), `frontend/src/components/SeriesList.tsx` (added `data-testid="series-list"` to the container, needed to distinguish it from `RecommendationsList` in `App.tsx`'s tests), `frontend/src/App.tsx` + `frontend/src/App.test.tsx` (nav toggle, `mainView` state), and `imdbId: null` added to the `makeSeries()` test helpers in `SeriesList.test.tsx`/`SeriesDetail.test.tsx`/`EditSeriesForm.test.tsx` (required once `Series.imdbId` became non-optional).

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

## Cross-References

| This spec | Source |
|-----------|--------|
| `GET /api/v1/series/recommendations`, `RecommendationDto` shape, `limit` clamping | `series_spec_006_recommendations.md` Requirement 7 |
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
