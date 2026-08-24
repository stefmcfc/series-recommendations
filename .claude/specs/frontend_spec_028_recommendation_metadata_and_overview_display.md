# Frontend Spec 028: Recommendation Metadata & Overview Display

**Status**: Implemented (2026-08-24). Files touched: `frontend/src/types/series.ts` (`Recommendation.originCountry`/`tmdbId`, `Series.overview`, `CreateSeriesRequest.overview?`, `SeriesLookupResult.overview?`), `frontend/src/services/seriesApi.ts` (`getRecommendationKeywords(tmdbId)`), `frontend/src/services/__tests__/seriesApi.test.ts`, `frontend/src/components/RecommendationsList.tsx`/`.module.css` (origin country span, per-card "Show keywords" button + scoped loading/error/result state, `overview` passed into `AddSeriesForm`'s `initialValues`), `frontend/src/components/RecommendationsList.test.tsx`, `frontend/src/components/AddSeriesForm.tsx` (hidden `overview` field: `FormState`, `applyLookupResult`, `buildPayload`, `buildInitialFormState`), `frontend/src/components/AddSeriesForm.test.tsx`, `frontend/src/components/SeriesDetail.tsx` (Overview field between Keywords and Status), `frontend/src/components/SeriesDetail.test.tsx`, plus fixture updates (`overview: null` added to the shared `makeSeries` shape) in `frontend/src/components/SeriesList.test.tsx`, `frontend/src/components/EditSeriesForm.test.tsx`, `frontend/src/components/RecommendationControls.test.tsx`. `npm test` (362/362 passed), `npm run lint` (clean), and `npm run build` (`tsc -b && vite build`, clean) all pass as of 2026-08-24.

One deliberate extension beyond the spec's literal AC wording: `buildInitialFormState` and `RecommendationsList`'s `initialValues` object also carry `overview` through directly from a `Recommendation` (not just via `applyLookupResult`/a resolved TMDB lookup), mirroring the exact precedent already established for `imdbId` (passed unconditionally from `pendingAdd.recommendation.imdbId` today) — otherwise a recommendation card's already-visible overview text would be silently dropped on "Mark as Watched"/"Add to List" whenever the user never triggers a fresh Look Up, undermining the "closes the loop" intent Design Decisions describes. Covered by an added test (`FRONTEND-028-AC-05: overview carried through initialValues (recommendation flow)`) beyond the spec's sketches.

**Real-browser verification**: completed. Both `gradlew.bat bootRun` (backend, restarted mid-session to pick up the just-merged `series_spec_023` backend changes — the previously running instance predated them and was still serving the old DTO shape) and `npm run dev` (frontend, restarted to pick up a temporary `frontend/.env.local` CORS workaround, removed again afterward) were run live. Verified via a headless Puppeteer (`puppeteer-core`, installed transiently with `--no-save` and removed from the install by not persisting it in `package.json`) driving the real dev server against the real backend and a live TMDB key: recommendation cards show origin country (e.g. "United Kingdom"/"United States") in both light and dark `prefers-color-scheme`; clicking "Show keywords" on a card (Sherlock, `tmdbId` 19885) fetched and rendered 25 real TMDB keyword chips with no fetch on initial list load; `SeriesDetail`'s Overview field was confirmed both as `—` (a pre-existing series with no `overview` yet) and, after using the existing Refresh action to backfill it from TMDB, showing real prose text ("Hotshot LA defense attorney Mickey Haller…") in both themes. `@axe-core/react` console output was captured and inspected: the only color-contrast violation present (`.country` span, `SeriesList`'s existing "(Year) | Country" badge from `frontend_spec_026`, dark mode, 4.09:1 vs the 4.5:1 threshold) is pre-existing and unrelated to this spec's changes — this spec's own new `.country` span on `RecommendationsList` (identical `color`/`opacity` CSS) was isolated and confirmed to raise zero axe violations of its own in either theme. No new accessibility violations were introduced.
**Depends on**: Frontend Spec 005 (`SeriesDetail`) ✅, Frontend Spec 010 (`RecommendationsList`, card layout owner) ✅, Frontend Spec 020 (`RecommendationsList`, TMDB rating display) ✅, Frontend Spec 022 (`AddSeriesForm`, hidden-field carry-through pattern) ✅, Frontend Spec 026 (`formatCountryName`, origin-country display precedent) ✅, Series Spec 023 (`series_spec_023_recommendation_metadata_and_overview.md`, backend companion)
**Frontend Stage**: 28 of N

## Overview

Frontend companion to `series_spec_023_recommendation_metadata_and_overview.md`. Adds three related pieces of TMDB metadata to the UI: (1) each recommendation card always shows its origin country, the same low-cost "comes free with the existing response" field the tracked-series side already displays (`frontend_spec_026`); (2) a card can reveal its TMDB keywords on demand — via an explicit per-card expand action, never automatically for the whole list, per the lazy-fetch strategy `series_spec_023` Requirement 3 exists to support; and (3) `SeriesDetail` displays a tracked series' persisted `overview`, closing the gap where a series' description — visible on the recommendation card that led to adding it — was otherwise lost the moment it joined the tracked list.

**Design decisions**:
- **A per-card "Show keywords" button, not hover, is the expand trigger.** Hover has no reliable keyboard or touch equivalent, and every other interactive affordance already on this card (Mark as Watched / Add to List / Ignore) is a clicked button — a fourth button matches the card's existing interaction model instead of introducing a second, less-accessible one.
- **The keyword fetch/loading/error state is scoped per-card, keyed by `imdbId`** (the same key `RecommendationsList` already uses for `ignoringIds`/`ignoreErrors`/`posterErrorIds`), not a single list-wide flag — consistent with how the existing Ignore action's in-flight/error state is already isolated per card rather than blocking the whole list.
- **No result caching across expand/collapse cycles is required.** This is a manual, one-click-per-card action, not the automatic N-calls-per-list-load problem the lazy strategy exists to avoid — a straightforward "fetch on click" implementation (refetching if a card happens to be expanded again) is acceptable and simplest; this is *not* a requirement that caching be added, just an explicit non-goal so it isn't over-built.
- **`AddSeriesForm` needs a hidden `overview` field to actually close the round-trip `series_spec_023` Requirement 6 depends on.** The backend spec's "populated at creation" promise only holds if the value reaches `SeriesDto.overview` in the create payload — mirroring the exact `imdbId`/`originCountry`/`tmdbId` hidden-field precedent already established (`frontend_spec_022`/`frontend_spec_026`): carried silently from a resolved lookup into form state, included in the payload when non-blank, never rendered as a visible `<input>`/`<textarea>`.
- **The "Overview" field on `SeriesDetail` is placed directly after "Genres"/"Tags"/"Keywords"**, before "Status" — grouping it with the other TMDB/user-supplied descriptive fields at the top of the `<dl>`, ahead of the season/episode/rating fields, since it's prose context for the whole entry rather than a data point.

---

## Requirements

### Requirement 1: Types

**User story**: As a developer, I want the shared types to carry every new field this spec's components need, so no component silently drops one when building a request or rendering a card.

#### Acceptance Criteria

- **FRONTEND-028-AC-01** [AUTO]: `src/types/series.ts`'s `Recommendation` interface shall gain `originCountry: string | null` and `tmdbId: number`.
- **FRONTEND-028-AC-02** [AUTO]: `Series` interface shall gain `overview: string | null`.
- **FRONTEND-028-AC-03** [AUTO]: `CreateSeriesRequest` and `SeriesLookupResult` shall each gain `overview?: string`, mirroring the existing `originCountry?`/`productionStatus?` optional-field precedent on both interfaces (`FRONTEND-026-AC-02`/`AC-03`).

### Requirement 2: Origin Country Always Shown on Recommendation Cards

**User story**: As a user browsing recommendations, I want to see each candidate's country of origin at a glance, the same way I can already tell my tracked series apart by country.

#### Acceptance Criteria

- **FRONTEND-028-AC-04** [AUTO]: Each recommendation card's header (`RecommendationsList.tsx`) shall display `formatCountryName(r.originCountry)` in a muted span alongside the existing year/genres display, rendered only when `originCountry` is non-null — reusing the existing `formatCountryName` util (`src/utils/countryName.ts`), not a new implementation.

### Requirement 3: `AddSeriesForm` Carries Overview Through Creation

**User story**: As a user, when I look up and add a series, I want its description actually saved at creation time, not left `null` until my next refresh.

#### Acceptance Criteria

- **FRONTEND-028-AC-05** [AUTO]: `AddSeriesForm`'s `FormState` shall gain a hidden `overview` field, following the exact `imdbId`/`originCountry`/`tmdbId` hidden-field precedent — never rendered as a visible `<input>`/`<textarea>`.
- **FRONTEND-028-AC-06** [AUTO]: `applyLookupResult` shall carry `result.overview` into form state whenever a resolved `SeriesLookupResult` has a non-null `overview`.
- **FRONTEND-028-AC-07** [AUTO]: `buildPayload` shall include `overview` in the create payload whenever the form state's `overview` is non-blank.

### Requirement 4: Lazy Keyword Fetch/Display on Card Expand

**User story**: As a user, I want to see a recommendation's keywords when I ask for them on a specific card, without every card in the list silently costing extra load time or TMDB calls I never asked for.

#### Acceptance Criteria

- **FRONTEND-028-AC-08** [AUTO]: Each recommendation card shall gain a "Show keywords" button (per Design Decisions) as an additional card action.
- **FRONTEND-028-AC-09** [AUTO]: When a card's "Show keywords" button is clicked, `RecommendationsList` shall call a new `seriesApi.getRecommendationKeywords(tmdbId: number): Promise<string[]>` method (mirroring `getKeywordStats`'s `GET /series/keywords` call shape) against `GET /api/v1/series/recommendations/{tmdbId}/keywords` (`series_spec_023` Requirement 3), passing that card's `r.tmdbId`.
- **FRONTEND-028-AC-10** [AUTO]: If a card has not had its "Show keywords" button clicked, `RecommendationsList` shall not call `seriesApi.getRecommendationKeywords` for it — neither on the list's initial mount/fetch nor on any subsequent list refresh; the call fires only in direct response to that specific card's own expand action.
- **FRONTEND-028-AC-11** [AUTO]: While a card's keyword fetch is in flight, that card (and only that card) shall show a scoped loading indicator — the list-wide `loading` state (`FRONTEND-010-AC-06`) is unaffected.
- **FRONTEND-028-AC-12** [AUTO]: If a card's keyword fetch rejects, that card shall show a scoped inline error message — mirroring the existing per-card `ignoreErrors` keyed-record pattern — without affecting any other card or the list-wide `error` state.
- **FRONTEND-028-AC-13** [AUTO]: Once a card's keyword fetch resolves, the card shall render each returned keyword as a chip/tag; an empty result shall render an explicit "No keywords found" message, distinguishing "loaded, nothing found" from "not yet expanded."

### Requirement 5: `SeriesDetail` Displays Persisted Overview

**User story**: As a user, I want to see a tracked series' description on its detail page, so it isn't lost the moment I add a show even though I saw it on the recommendation card.

#### Acceptance Criteria

- **FRONTEND-028-AC-14** [AUTO]: `SeriesDetail` shall display an "Overview" field showing `series.overview`, or `"—"` when `null` (the existing `formatValue` convention), placed per the layout described in Design Decisions.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationDto.originCountry`/`tmdbId`, `GET /api/v1/series/recommendations/{tmdbId}/keywords`, `SeriesDto.overview`/`SeriesLookupDto.overview` | `series_spec_023_recommendation_metadata_and_overview.md` (backend companion) |
| `RecommendationsList` card layout, `getRecommendations` fetch/loading/error state shape | `frontend_spec_010_recommendations.md` |
| `tmdbRating`/`voteCount` display precedent on the same cards | `frontend_spec_020_recommendation_rating_display.md` |
| `AddSeriesForm`'s `imdbId`/`tmdbId` hidden-field precedent, TMDB candidate picker | `frontend_spec_022_tmdb_primary_lookup.md` |
| `formatCountryName` utility, `originCountry`/`productionStatus` hidden-field precedent on `AddSeriesForm`, `SeriesDetail`'s field-display convention | `frontend_spec_026_origin_country_and_tmdb_metadata_display.md` |
| `SeriesDetail`'s `formatValue`/field layout this spec's Overview field extends | `frontend_spec_005_series_detail.md` |

---

## TDD Test Case Sketches

### `src/types/series.ts` (Requirement 1 -- compile-time, verified via `tsc`/build)

No dedicated runtime test; covered by the build passing and by the fixture updates below.

Note: `RecommendationsList.test.tsx`'s `makeRecommendation` fixture will need `originCountry`/`tmdbId` added to its default shape, and `SeriesDetail.test.tsx`/`EditSeriesForm.test.tsx`/`SeriesList.test.tsx`'s `makeSeries` fixtures will need `overview` added -- the same pattern `frontend_spec_026` used when `Series` last gained fields.

### `src/components/RecommendationsList.test.tsx` (Requirement 2)

```typescript
describe('FRONTEND-028-AC-04: origin country shown on every card', () => {
  it('displays the resolved country name when originCountry is set', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ originCountry: 'GB' }),
    ])
    render(<RecommendationsList />)

    expect(await screen.findByText(/united kingdom/i)).toBeInTheDocument()
  })

  it('renders nothing extra when originCountry is null', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ originCountry: null }),
    ])
    render(<RecommendationsList />)

    await screen.findByText('Ozark')
    expect(screen.queryByText(/united/i)).not.toBeInTheDocument()
  })
})
```

### `src/components/AddSeriesForm.test.tsx` (Requirement 3)

```typescript
describe('FRONTEND-028-AC-06/07: overview carried through to the create payload', () => {
  it('includes overview in the create payload after a resolved lookup', async () => {
    vi.mocked(seriesApi.searchTmdb).mockResolvedValue([
      { tmdbId: 2996, title: 'The Office', year: 2001 },
    ])
    vi.mocked(seriesApi.resolveTmdbCandidate).mockResolvedValue({
      title: 'The Office',
      overview: 'A mockumentary sitcom.',
    })
    render(<AddSeriesForm onCancel={vi.fn()} onSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'The Office' } })
    fireEvent.click(screen.getByRole('button', { name: /look up/i }))
    await screen.findByDisplayValue('The Office')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(seriesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ overview: 'A mockumentary sitcom.' }),
      ),
    )
  })
})
```

### `src/components/RecommendationsList.test.tsx` (Requirement 4)

```typescript
describe('FRONTEND-028-AC-09/10: keywords are fetched only on a card\'s own expand click', () => {
  it('does not call getRecommendationKeywords on initial render', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    render(<RecommendationsList />)

    await screen.findByText('Ozark')
    expect(seriesApi.getRecommendationKeywords).not.toHaveBeenCalled()
  })

  it('calls getRecommendationKeywords with the card\'s tmdbId when "Show keywords" is clicked', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ tmdbId: 4046 }),
    ])
    vi.mocked(seriesApi.getRecommendationKeywords).mockResolvedValue(['spy', 'mi5'])
    render(<RecommendationsList />)

    await screen.findByText('Ozark')
    fireEvent.click(screen.getByRole('button', { name: /show keywords/i }))

    await waitFor(() =>
      expect(seriesApi.getRecommendationKeywords).toHaveBeenCalledWith(4046),
    )
  })
})

describe('FRONTEND-028-AC-11/12/13: per-card loading, error, and result states', () => {
  it('shows a scoped loading state while the fetch is in flight', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    vi.mocked(seriesApi.getRecommendationKeywords).mockReturnValue(new Promise(() => undefined))
    render(<RecommendationsList />)

    await screen.findByText('Ozark')
    fireEvent.click(screen.getByRole('button', { name: /show keywords/i }))

    expect(await screen.findByText(/loading keywords/i)).toBeInTheDocument()
  })

  it('shows a scoped error message when the fetch rejects', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    vi.mocked(seriesApi.getRecommendationKeywords).mockRejectedValue(
      new ApiError(500, 'Failed to load keywords'),
    )
    render(<RecommendationsList />)

    await screen.findByText('Ozark')
    fireEvent.click(screen.getByRole('button', { name: /show keywords/i }))

    expect(await screen.findByText('Failed to load keywords')).toBeInTheDocument()
  })

  it('renders each keyword and an explicit empty message when none are found', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation()])
    vi.mocked(seriesApi.getRecommendationKeywords).mockResolvedValue([])
    render(<RecommendationsList />)

    await screen.findByText('Ozark')
    fireEvent.click(screen.getByRole('button', { name: /show keywords/i }))

    expect(await screen.findByText(/no keywords found/i)).toBeInTheDocument()
  })
})
```

### `src/components/SeriesDetail.test.tsx` (Requirement 5)

```typescript
describe('FRONTEND-028-AC-14: overview field', () => {
  it('displays the series overview', async () => {
    mockGetById.mockResolvedValue(
      makeSeries({ overview: 'A mockumentary sitcom.' }),
    )
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    expect(await screen.findByText('A mockumentary sitcom.')).toBeInTheDocument()
  })

  it('shows "—" when overview is null', async () => {
    mockGetById.mockResolvedValue(makeSeries({ overview: null }))
    render(<SeriesDetail id="1" onBack={vi.fn()} onDeleted={vi.fn()} />)

    await screen.findByText('The Office')
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-028-AC-01: `Recommendation` gains `originCountry`/`tmdbId`
- [x] FRONTEND-028-AC-02: `Series` gains `overview`
- [x] FRONTEND-028-AC-03: `CreateSeriesRequest`/`SeriesLookupResult` gain `overview?`
- [x] FRONTEND-028-AC-04: recommendation cards always show origin country
- [x] FRONTEND-028-AC-05: `AddSeriesForm.FormState` gains hidden `overview`
- [x] FRONTEND-028-AC-06: `applyLookupResult` carries `overview` through
- [x] FRONTEND-028-AC-07: `buildPayload` includes `overview`
- [x] FRONTEND-028-AC-08: "Show keywords" button per card
- [x] FRONTEND-028-AC-09: click calls `seriesApi.getRecommendationKeywords(tmdbId)`
- [x] FRONTEND-028-AC-10: no keyword fetch on mount/refresh, only on expand
- [x] FRONTEND-028-AC-11: scoped per-card loading state
- [x] FRONTEND-028-AC-12: scoped per-card error state
- [x] FRONTEND-028-AC-13: keyword chips rendered; explicit empty message
- [x] FRONTEND-028-AC-14: `SeriesDetail` shows Overview field
