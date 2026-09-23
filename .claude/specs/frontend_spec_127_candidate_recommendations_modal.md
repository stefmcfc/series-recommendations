# Frontend Spec 127: Candidate Recommendations Modal ("More Like This")

**Status**: Not started
**Priority**: P3 (extends an already-shipped discovery feature to one more entry point; not core CRUD, no data-correctness risk)
**Depends on**: `series_spec_064_recommendations_for_a_recommendation.md` (companion backend spec — new `sourceMode="candidate"`/`sourceTmdbId` on `GET /api/v1/series/recommendations`), `frontend_spec_052_series_detail_recommendations_modal.md` (`SeriesRecommendationsModal`, the fetch-on-mount + local mark-watched/add-to-list/ignore handler pattern this spec's new modal mirrors), `frontend_spec_053_recommendation_detail_modal.md` (`RecommendationDetailModal`, which this spec adds a button to, and the `RecommendationCard` → `RecommendationDetailModal` 2-level modal-stack precedent this spec extends to 3 levels)
**Area**: Frontend (`types/series.ts`, `services/seriesApi.ts`, new `components/CandidateRecommendationsModal.tsx` + `.module.css`, `components/RecommendationDetailModal.tsx`)

## Overview

Backs `series_spec_064`'s new `sourceMode="candidate"` with a UI entry point: a "More Like This" button inside `RecommendationDetailModal` (the candidate-detail modal already reachable from `RecommendationCard`'s "View Details" button) that opens a new `CandidateRecommendationsModal`, showing TMDB recommendations seeded by that specific, untracked candidate. This is a third modal layer on top of an existing two-layer stack (`SeriesRecommendationsModal`/`RecommendationsList` → `RecommendationDetailModal`), letting a user keep drilling from "here's a show you might like" into "show me shows like *that* show" without first adding the candidate to their list.

## Design Decisions

- **New component, not a `SeriesRecommendationsModal` variant.** `SeriesRecommendationsModal` is keyed to a tracked `Series` (`series.id`/`series.title` from a `SeriesEntity`); this modal is keyed to an untracked candidate (`tmdbId`/`title` only, no `Series` object exists). Rather than widening `SeriesRecommendationsModal`'s props to accept either shape, a new sibling component keeps each one's props simple and matches how this codebase already has multiple single-purpose recommendation-list renderers (`RecommendationsList`, `SeriesRecommendationsModal`) rather than one parameterized component.
- **Own local mark-watched/add-to-list/ignore handlers, not a shared hook.** `SeriesRecommendationsModal.tsx`'s own header comment (FRONTEND-052) explains this project's existing rationale: it "mirrors `RecommendationsList`'s own fetch-on-mount and mark-as-watched/add-to-list/ignore handling exactly ... rather than sharing a hook ... this is the only other place that sources recommendations, and duplicating a handful of handlers here is simpler than introducing shared state-management infrastructure for two call sites." This spec adds a third call site with the exact same shape, and duplicating the same handful of handlers a third time remains simpler than extracting a hook for three now-near-identical consumers — revisit extraction only if a fourth consumer appears.
- **Three-level modal stack is precedented, not novel.** `RecommendationCard`'s "View Details" button already opens `RecommendationDetailModal` on top of whichever list rendered the card (`RecommendationsList` or `SeriesRecommendationsModal`) — a two-level stack shipped by `frontend_spec_053`. This spec adds a third level (`CandidateRecommendationsModal` on top of `RecommendationDetailModal`), which is the same nested-`role="dialog"` pattern one layer deeper, not a new UX concept requiring fresh justification.
- **Empty state reads distinctly from `SeriesRecommendationsModal`'s.** `SeriesRecommendationsModal` shows "No recommendations found for this series" (a tracked series, always has a title in scope). This modal shows "No recommendations found for {title}" — the candidate's own title, threaded down from `RecommendationDetailModal` — so the message is unambiguous about which show's recommendations came back empty, especially useful once this is nested three levels deep.
- **No client-side self-exclusion filter.** `series_spec_064`'s `sourceFromCandidate` already excludes the requested `tmdbId` from its own results server-side (SERIES-064-AC-03). `CandidateRecommendationsModal` performs no equivalent client-side check — it renders exactly what `seriesApi.getRecommendations` returns, same as every other recommendation-rendering component in this app. FRONTEND-127-AC-02 below includes an integration-style assertion confirming the modal doesn't need one (the server-returned list already excludes the source candidate).
- **`region` resolved from the same `watchRegion` `useLocalStorage` hook `SeriesRecommendationsModal` already uses** (FRONTEND-102's pattern) — always resolved and sent, never omitted, matching every other `getRecommendations` call site in the app.

---

## Requirement 1: Type and API layer support `sourceMode="candidate"`

**User story**: As a developer wiring up the new modal, I need the existing typed API layer to carry the new source mode and its required id.

### FRONTEND-127-AC-01 [AUTO]
**Statement**: `RecommendationQuery` (`types/series.ts`) shall gain an optional `sourceTmdbId?: number` field, and its `sourceMode` union shall widen to include `'candidate'`. `seriesApi.ts`'s `buildRecommendationParams` shall include `sourceTmdbId` in its emitted query params when set.

**References**:
- `types/series.ts` lines 249-291 (`RecommendationQuery`, specifically line 275's `sourceMode?: 'trending' | 'topRated' | 'useMySeries'`, widened to add `'candidate'`; `sourceTmdbId` inserted near `seriesIds` at line 251)
- `services/seriesApi.ts` lines 96-125 (`buildRecommendationParams`, specifically line 117's `addIfPresent(params, 'sourceMode', query.sourceMode)`, alongside which `addIfPresent(params, 'sourceTmdbId', query.sourceTmdbId)` is added)

**Test Case (Red)**:
```typescript
describe('FRONTEND-127-AC-01: buildRecommendationParams includes sourceTmdbId', () => {
  it('includes sourceMode=candidate and sourceTmdbId when set', async () => {
    await seriesApi.getRecommendations({
      sourceMode: 'candidate',
      sourceTmdbId: 1396,
    })
    expect(mockAxios.history.get[0].params).toMatchObject({
      sourceMode: 'candidate',
      sourceTmdbId: 1396,
    })
  })

  it('omits sourceTmdbId when not set', async () => {
    await seriesApi.getRecommendations({ sourceMode: 'trending' })
    expect(mockAxios.history.get[0].params).not.toHaveProperty('sourceTmdbId')
  })
})
```
**Test Case (Green)**: widen `RecommendationQuery.sourceMode` to `'trending' | 'topRated' | 'useMySeries' | 'candidate'`, add `sourceTmdbId?: number`; add `addIfPresent(params, 'sourceTmdbId', query.sourceTmdbId)` to `buildRecommendationParams`.

---

## Requirement 2: `CandidateRecommendationsModal` fetches and renders candidate-seeded recommendations

**User story**: As a user viewing a recommendation candidate's details, I want to see shows similar to that specific candidate, with the same mark-watched/add-to-list/ignore actions I already have elsewhere.

### FRONTEND-127-AC-02 [AUTO]
**Statement**: A new `CandidateRecommendationsModal` component shall, on mount, call `seriesApi.getRecommendations({ sourceMode: 'candidate', sourceTmdbId, region: watchRegion })` (where `sourceTmdbId`/a `title` for the empty-state message are received as props) exactly once; while the request is in flight it shall show a loading state; on success with a non-empty result it shall render each recommendation via `RecommendationCard` inside a `<ul>`; on success with an empty result it shall show "No recommendations found for {title}"; on failure it shall show an error message. No recommendation card returned needs to be filtered client-side to exclude the source candidate — the fixture below includes candidates only, confirming the modal performs no such filtering of its own.

**References**:
- `components/SeriesRecommendationsModal.tsx` (the component being mirrored): lines 50-77 (fetch-on-mount `useEffect`, `cancelled` guard, `eslint-disable-next-line react-hooks/exhaustive-deps` for the deliberately-empty dependency array), lines 164-180 (loading/error/empty states), lines 182-196 (the `<ul>` of `RecommendationCard`), lines 44-48 (the `watchRegion` `useLocalStorage` hook usage)
- `hooks/useLocalStorage.ts`, `utils/countryOptions.ts` (`DEFAULT_WATCH_REGION`, `isWatchRegion`) — imported unchanged
- `components/RecommendationCard.tsx` (rendered unchanged, same props shape `SeriesRecommendationsModal` already passes)

**Test Case (Red)**:
```typescript
// CandidateRecommendationsModal.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CandidateRecommendationsModal } from './CandidateRecommendationsModal'
import { seriesApi } from '../services/seriesApi'

vi.mock('../services/seriesApi')
const mockGetRecommendations = vi.mocked(seriesApi.getRecommendations)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('FRONTEND-127-AC-02: fetch on mount and render', () => {
  it('calls getRecommendations with sourceMode=candidate/sourceTmdbId and renders results', async () => {
    mockGetRecommendations.mockResolvedValue([
      {
        title: 'Better Call Saul',
        year: 2015,
        genres: null,
        overview: null,
        posterUrl: null,
        tmdbRating: null,
        voteCount: null,
        streamingProviders: [],
        imdbId: 'tt3032476',
        sourceTitles: [],
        totalSourceCount: 0,
        originCountry: null,
        tmdbId: 1396,
      },
    ])

    render(
      <CandidateRecommendationsModal
        sourceTmdbId={1234}
        title="Breaking Bad"
        onClose={vi.fn()}
      />,
    )

    expect(await screen.findByText('Better Call Saul')).toBeInTheDocument()
    expect(mockGetRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({ sourceMode: 'candidate', sourceTmdbId: 1234 }),
    )
  })

  it('does not need to filter out the source candidate itself -- the server-returned list already excludes it', async () => {
    mockGetRecommendations.mockResolvedValue([
      {
        title: 'Only Other Show',
        year: null, genres: null, overview: null, posterUrl: null,
        tmdbRating: null, voteCount: null, streamingProviders: [],
        imdbId: 'tt9999999', sourceTitles: [], totalSourceCount: 0,
        originCountry: null, tmdbId: 5555,
      },
    ])

    render(
      <CandidateRecommendationsModal sourceTmdbId={1234} title="Breaking Bad" onClose={vi.fn()} />,
    )

    expect(await screen.findByText('Only Other Show')).toBeInTheDocument()
    expect(screen.getAllByTestId('recommendation-card')).toHaveLength(1)
  })

  it('shows a loading state, then an empty-state message naming the candidate', async () => {
    mockGetRecommendations.mockResolvedValue([])
    render(
      <CandidateRecommendationsModal sourceTmdbId={1234} title="Breaking Bad" onClose={vi.fn()} />,
    )
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(
      await screen.findByText('No recommendations found for Breaking Bad'),
    ).toBeInTheDocument()
  })

  it('shows an error message on fetch failure', async () => {
    mockGetRecommendations.mockRejectedValue(new Error('network error'))
    render(
      <CandidateRecommendationsModal sourceTmdbId={1234} title="Breaking Bad" onClose={vi.fn()} />,
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to load/i),
    )
  })
})
```
**Test Case (Green)**: create `CandidateRecommendationsModal.tsx`, copying `SeriesRecommendationsModal.tsx`'s structure with `series.id`/`series.title` replaced by the new `sourceTmdbId`/`title` props, `sourceMode: 'candidate'` and `sourceTmdbId` in place of `sourceMode: 'useMySeries'`/`seriesIds: [series.id]`, and the empty-state copy changed to interpolate `title`.

---

### FRONTEND-127-AC-03 [AUTO]
**Statement**: `CandidateRecommendationsModal` shall own its own `handleMarkAsWatched`/`handleAddToList`/`handleIgnore` handlers, each behaving identically to `SeriesRecommendationsModal`'s equivalents (opening `AddSeriesForm` with `source="recommendation"` and the recommendation's fields pre-filled; calling `seriesApi.ignoreSeries` and removing the card from the list on success, showing a scoped error on failure) and each removing the acted-on card from its own local `recommendations` state, independent of any other open modal's state.

**References**: `components/SeriesRecommendationsModal.tsx` lines 81-135 (`handleMarkAsWatched`/`handleAddToList`/`handleAddCancel`/`handleAddSuccess`/`handleIgnore`, mirrored verbatim except operating on this component's own state), lines 198-221 (conditional `AddSeriesForm` render)

**Test Case (Red)**:
```typescript
describe('FRONTEND-127-AC-03: mark-watched/add-to-list/ignore act on this modal's own list', () => {
  it('removes a card from the list after a successful ignore', async () => {
    mockGetRecommendations.mockResolvedValue([
      { title: 'Ozark', year: null, genres: null, overview: null, posterUrl: null,
        tmdbRating: null, voteCount: null, streamingProviders: [], imdbId: 'tt5071412',
        sourceTitles: [], totalSourceCount: 0, originCountry: null, tmdbId: 1234 },
    ])
    vi.mocked(seriesApi.ignoreSeries).mockResolvedValue(undefined as never)

    render(<CandidateRecommendationsModal sourceTmdbId={9999} title="Fargo" onClose={vi.fn()} />)
    await screen.findByText('Ozark')
    fireEvent.click(screen.getByTestId('ignore-btn'))

    await waitFor(() => expect(screen.queryByText('Ozark')).not.toBeInTheDocument())
    expect(seriesApi.ignoreSeries).toHaveBeenCalledWith('tt5071412', 'Ozark')
  })

  it('opens AddSeriesForm pre-filled with source="recommendation" on Mark as Watched', async () => {
    mockGetRecommendations.mockResolvedValue([
      { title: 'Ozark', year: 2017, genres: null, overview: null, posterUrl: null,
        tmdbRating: null, voteCount: null, streamingProviders: [], imdbId: 'tt5071412',
        sourceTitles: [], totalSourceCount: 0, originCountry: null, tmdbId: 1234 },
    ])

    render(<CandidateRecommendationsModal sourceTmdbId={9999} title="Fargo" onClose={vi.fn()} />)
    await screen.findByText('Ozark')
    fireEvent.click(screen.getByRole('button', { name: /mark as watched/i }))

    expect(await screen.findByDisplayValue('Ozark')).toBeInTheDocument()
  })
})
```
**Test Case (Green)**: copy `SeriesRecommendationsModal.tsx`'s five handlers unchanged (they already only reference the component's own local state), and the conditional `AddSeriesForm` block unchanged.

---

## Requirement 3: "More Like This" opens the new modal from the candidate-detail modal

**User story**: As a user viewing a candidate's full details, I want a clear way to ask for more shows like it, without leaving the detail view I'm already in.

### FRONTEND-127-AC-04 [AUTO]
**Statement**: `RecommendationDetailModal.tsx` shall render a "More Like This" button in its `.dialogActions` region alongside the existing "Done" button; clicking it shall open `CandidateRecommendationsModal`, passing `sourceTmdbId={r.tmdbId}` and `title={r.title}`; the new modal shall render on top of `RecommendationDetailModal` (both simultaneously present in the DOM, matching the existing `RecommendationCard` → `RecommendationDetailModal` stacking precedent), and closing it shall return focus to `RecommendationDetailModal` without closing that outer modal.

**References**: `components/RecommendationDetailModal.tsx` lines 192-200 (`.dialogActions`, the existing single-button region), line 22-25 (component props — `recommendation: Recommendation` already provides `tmdbId`/`title`); `components/RecommendationCard.tsx` lines 44-45, 117-124, 133-138 (`detailModalOpen` local state and conditional render — the precedented "second modal layer opened by a button in this component" pattern being extended one layer deeper)

**Test Case (Red)**:
```typescript
// Added to RecommendationCard.test.tsx, since that's where RecommendationDetailModal's
// dialog is already exercised (see this spec's Design Decisions on why there's no
// standalone RecommendationDetailModal.test.tsx to add to instead).
describe('FRONTEND-127-AC-04: More Like This opens CandidateRecommendationsModal', () => {
  it('opens a second nested dialog seeded by the current candidate', async () => {
    mockGetRecommendationDetails.mockResolvedValue({
      numberOfSeasons: null, numberOfEpisodes: null, imdbRating: null,
    })
    mockGetRecommendationKeywords.mockResolvedValue([])
    mockGetRecommendations.mockResolvedValue([])

    render(
      <RecommendationCard
        recommendation={makeRecommendation({ title: 'Ozark', tmdbId: 1234 })}
        onMarkWatched={vi.fn()}
        onAddToList={vi.fn()}
        onIgnore={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('view-details-btn'))
    await screen.findByRole('dialog', { name: /ozark/i })

    fireEvent.click(screen.getByRole('button', { name: /more like this/i }))

    expect(mockGetRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({ sourceMode: 'candidate', sourceTmdbId: 1234 }),
    )
    // both dialogs present at once -- the outer detail dialog is not closed
    expect(screen.getAllByRole('dialog').length).toBe(2)
  })
})
```
**Test Case (Green)**: add `detailModalOpen`-style local state (`candidateRecsModalOpen`) to `RecommendationDetailModal`; render a second "More Like This" `<button>` in `.dialogActions` next to "Done"; conditionally render `<CandidateRecommendationsModal sourceTmdbId={r.tmdbId} title={r.title} onClose={() => setCandidateRecsModalOpen(false)} />` when open. `RecommendationDetailModal.module.css`'s `.dialogActions` (currently `justify-content: flex-end` with one button) is adjusted to accommodate two buttons (e.g. `justify-content: space-between`, "More Like This" on the left / "Done" on the right, matching how other two-button action rows in this app are laid out).

---

### FRONTEND-127-AC-05 [AUTO]
**Statement**: `CandidateRecommendationsModal`'s empty state shall read "No recommendations found for {title}", using the exact `title` prop passed in — distinct from `SeriesRecommendationsModal`'s generic "No recommendations found for this series" copy — so the message is unambiguous about which candidate's recommendations came back empty when nested inside another modal.

**References**: `components/SeriesRecommendationsModal.tsx` lines 176-180 (the generic copy being deliberately not reused verbatim)

**Test Case (Red)**: covered by FRONTEND-127-AC-02's "shows a loading state, then an empty-state message naming the candidate" test above (`No recommendations found for Breaking Bad`). No separate test file needed — restated here as its own AC because the exact, candidate-specific wording is itself a distinct, independently-checkable requirement, not just an implementation detail of AC-02's fetch/render behavior.

**Test Case (Green)**: `<p className={styles.empty}>No recommendations found for {title}</p>`.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `sourceMode="candidate"`/`sourceTmdbId` this spec's modal consumes | `series_spec_064_recommendations_for_a_recommendation.md` (companion backend spec) |
| Fetch-on-mount + local mark-watched/add-to-list/ignore handler pattern mirrored | `frontend_spec_052_series_detail_recommendations_modal.md` (`SeriesRecommendationsModal`) |
| `RecommendationDetailModal`, and the `RecommendationCard` → `RecommendationDetailModal` 2-level modal-stack precedent extended to 3 levels here | `frontend_spec_053_recommendation_detail_modal.md` |
| `watchRegion` resolution pattern reused unchanged | `frontend_spec_102_settings_watch_region.md` |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-127-AC-01: `RecommendationQuery`/`buildRecommendationParams` carry `sourceMode: 'candidate'`/`sourceTmdbId`
- [ ] FRONTEND-127-AC-02: `CandidateRecommendationsModal` fetches on mount and renders loading/results/empty/error states; no client-side self-exclusion needed
- [ ] FRONTEND-127-AC-03: mark-watched/add-to-list/ignore handlers act on this modal's own local state
- [ ] FRONTEND-127-AC-04: "More Like This" in `RecommendationDetailModal` opens `CandidateRecommendationsModal` as a third modal layer
- [ ] FRONTEND-127-AC-05: empty state reads "No recommendations found for {title}"
