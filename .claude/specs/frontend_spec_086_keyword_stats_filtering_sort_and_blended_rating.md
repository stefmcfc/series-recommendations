# Frontend Spec 086: Keyword Stats — Filtering, Sort Direction Toggle & Blended Rating

**Status**: Done
**Depends on**: Series Spec 047 (`series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md`), Frontend Spec 024 (`frontend_spec_024_keyword_tracking.md` Requirement 3, `KeywordsView`)
**Frontend Stage**: 86 of N

## Overview

Surfaces `series_spec_047`'s backend additions in `KeywordsView`: three minimum-value filter
inputs, a new "Name" sortable column, a new "Avg. Blended Rating" sortable column, and a
click-to-toggle asc/desc direction indicator on every sortable column (today's headers re-fetch
with a fixed direction per field and have no toggle at all). This is unit 1 of 4 in the
"Analysis/Trends" expansion — the UI pattern established here is reused as-is by
`frontend_spec_088` (Genre stats) and `frontend_spec_089` (Country-of-Origin stats).

**Design decisions**:
- **Filters apply via an explicit "Apply" action, not live-as-you-type.** Mirrors `SearchFilter`'s
  own explicit-submit convention (`frontend_spec_024` FRONTEND-024-AC-13, "included in the
  criteria object built on Search") rather than debounced live filtering — avoids a fetch per
  keystroke and keeps this view's fetch trigger consistent with the rest of the app.
- **`seriesApi.getKeywordStats`'s signature changes from a single positional `sortBy` argument to
  one options object.** Five independent, all-optional params (`sortBy`, `sortDirection`, three
  min-value filters) no longer fit cleanly as positional arguments. `KeywordsView` is the only
  call site today, so this is a contained, low-risk signature change.
- **Sort-direction indicator reuses plain text glyphs (▲/▼), not an icon library** — this project
  has no existing icon dependency for this kind of thing, and a plain glyph is sufficient here,
  same "keep it simple" posture as the rest of `KeywordsView`.

---

## Requirements

### Requirement 1: Types & API

**User story**: As a developer, I want the expanded stats contract typed centrally, so
`KeywordsView` and its tests share one shape.

#### Acceptance Criteria

- **FRONTEND-086-AC-01** [AUTO]: `KeywordStat` (`src/types/series.ts`) shall gain
  `averageBlendedRating: number | null`.
- **FRONTEND-086-AC-02** [AUTO]: `seriesApi.getKeywordStats` shall change from
  `(sortBy?: 'seriesCount' | 'averagePersonalRating') => Promise<KeywordStat[]>` to accepting a
  single optional options object: `{ sortBy?: 'seriesCount' | 'averagePersonalRating' |
  'averageBlendedRating' | 'name'; sortDirection?: 'asc' | 'desc'; minSeriesCount?: number;
  minAveragePersonalRating?: number; minAverageBlendedRating?: number }`.
- **FRONTEND-086-AC-03** [AUTO]: Only the options actually provided (non-`undefined`) shall be
  included in the request's query params — an empty/undefined options object sends no params at
  all, unchanged from today's no-argument call shape.

---

### Requirement 2: Minimum-Value Filter Inputs

**User story**: As a user with a large tracked collection, I want to filter the keyword table down
to keywords that clear a minimum series count or rating, so I can focus on patterns backed by
enough data to be meaningful.

#### Acceptance Criteria

- **FRONTEND-086-AC-04** [AUTO]: `KeywordsView` shall render three `<input type="number" min="0">`
  filter fields above the table — "Min Series Count", "Min Avg Personal Rating" (`max="5"`,
  matching `personalRating`'s 1–5 scale), "Min Avg Blended Rating" (`max="10"`, matching the
  IMDb/TMDB 0–10 scale) — each with an associated `<label>`, following `SearchFilter`'s existing
  min-rating `<input type="number">` pattern.
- **FRONTEND-086-AC-05** [AUTO]: An "Apply Filters" button shall re-fetch
  `seriesApi.getKeywordStats` with the current filter field values (parsed to numbers) merged into
  the options object alongside the current `sortBy`/`sortDirection`.
- **FRONTEND-086-AC-06** [AUTO]: A filter field left blank shall be omitted from the fetch options
  (not sent as `0`) — leaving all three blank and clicking Apply behaves identically to the
  unfiltered view.
- **FRONTEND-086-AC-07** [AUTO]: The existing loading (`role="status"`) and error (`role="alert"`)
  states (`frontend_spec_024` FRONTEND-024-AC-11) apply identically to a filtered fetch — no new
  state machine is introduced.

---

### Requirement 3: Name & Blended Rating Columns, Sort Direction Toggle

**User story**: As a user, I want to sort the keyword table alphabetically, see a blended
IMDb/TMDB rating per keyword, and reverse any column's sort direction, so I can browse the data
however is most useful in the moment.

#### Acceptance Criteria

- **FRONTEND-086-AC-08** [AUTO]: The table's leftmost header ("Keyword") shall become sortable
  (`sortBy: 'name'`), and a new sortable "Avg. Blended Rating" column shall be added after "Avg.
  Personal Rating", rendering `—` for a `null` value via the existing `formatAverage` helper.
- **FRONTEND-086-AC-09** [AUTO]: Clicking a sortable header not currently active shall re-fetch
  with that column's `sortBy` and no explicit `sortDirection` (adopting the backend's default
  direction for that field, `series_spec_047` SERIES-047-AC-07). Clicking the currently-active
  column's header again shall toggle `sortDirection` between `asc`/`desc` on each subsequent
  click, re-fetching each time.
- **FRONTEND-086-AC-10** [AUTO]: The currently-active sort column's header shall display a
  direction indicator (▲ for `asc`, ▼ for `desc`) so the active sort and its direction are visible
  at a glance; inactive headers show no indicator.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `sortBy`/`sortDirection`/min-filter contract this spec's UI drives | `series_spec_047_keyword_stats_filtering_sort_and_blended_rating.md` |
| `KeywordsView`, `formatAverage`, existing loading/error states this spec extends | `frontend_spec_024_keyword_tracking.md` Requirement 3 |
| Explicit-submit (not live) filter convention | `frontend_spec_024_keyword_tracking.md` (`SearchFilter` behavior), `SearchFilter.tsx` |
| Min-rating `<input type="number">` pattern reused for the new filter fields | `SearchFilter.tsx` |
| UI pattern reused unchanged by | `frontend_spec_088_genre_stats_view.md`, `frontend_spec_089_country_of_origin_stats_view.md` |

---

## TDD Test Case Sketches

### `src/services/__tests__/seriesApi.test.ts` (additions)

```typescript
describe('FRONTEND-086-AC-02/03: getKeywordStats options object', () => {
  it('sends only the provided options as query params', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })

    await seriesApi.getKeywordStats({ sortBy: 'name', minSeriesCount: 2 })

    expect(client.get).toHaveBeenCalledWith('/series/keywords', {
      params: { sortBy: 'name', minSeriesCount: 2 },
    })
  })

  it('sends no params when called with no arguments', async () => {
    client.get.mockResolvedValue({ data: { data: [], count: 0 } })

    await seriesApi.getKeywordStats()

    expect(client.get).toHaveBeenCalledWith('/series/keywords', { params: {} })
  })
})
```

### `src/components/KeywordsView.test.tsx` (additions)

```typescript
describe('FRONTEND-086-AC-04/05/06: minimum-value filters', () => {
  it('applies only the filled-in filters on Apply, omitting blank ones', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/min series count/i), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ minSeriesCount: 3 }),
      ),
    )
    expect(mockGetKeywordStats.mock.calls.at(-1)[0]).not.toHaveProperty('minAveragePersonalRating')
  })
})

describe('FRONTEND-086-AC-08/09/10: name/blended-rating columns and direction toggle', () => {
  it('sorts by name on first click, toggles direction on repeated clicks', async () => {
    mockGetKeywordStats.mockResolvedValue([])
    render(<KeywordsView />)
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('columnheader', { name: /keyword/i }))
    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'name' }),
      ),
    )

    fireEvent.click(screen.getByRole('columnheader', { name: /keyword/i }))
    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'name', sortDirection: 'desc' }),
      ),
    )
    expect(screen.getByRole('columnheader', { name: /keyword/i })).toHaveTextContent('▼')
  })

  it('renders the Avg. Blended Rating column, dash for null', async () => {
    mockGetKeywordStats.mockResolvedValue([
      { name: 'spy', seriesCount: 2, averagePersonalRating: 4.0, averageBlendedRating: null },
    ])
    render(<KeywordsView />)

    expect(await screen.findByText('Avg. Blended Rating')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [x] FRONTEND-086-AC-01: `KeywordStat.averageBlendedRating`
- [x] FRONTEND-086-AC-02: `getKeywordStats` options-object signature
- [x] FRONTEND-086-AC-03: only provided options sent as query params
- [x] FRONTEND-086-AC-04: three numeric filter inputs rendered
- [x] FRONTEND-086-AC-05: "Apply Filters" re-fetches with current values
- [x] FRONTEND-086-AC-06: blank filter fields omitted, not sent as `0`
- [x] FRONTEND-086-AC-07: loading/error states unchanged under filtering
- [x] FRONTEND-086-AC-08: "Keyword" header sortable (`name`); new "Avg. Blended Rating" column
- [x] FRONTEND-086-AC-09: click sorts by column; repeated click toggles direction
- [x] FRONTEND-086-AC-10: active column shows a ▲/▼ direction indicator
