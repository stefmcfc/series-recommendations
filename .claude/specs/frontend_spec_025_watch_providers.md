# Frontend Spec 025: Streaming/Network Watch Providers Display

**Status**: Not started
**Depends on**: Series Spec 020 (`RecommendationDto.streamingProviders`), Frontend Spec 010 (`RecommendationsList`, existing TMDB attribution notice) ✅, Frontend Spec 020 (`.cardHeader` rating display precedent) ✅

## Overview

Surfaces Series Spec 020's `streamingProviders` on each recommendation card in `RecommendationsList` — the name (and logo, where available) of any UK streaming service currently carrying the show — plus a required "Streaming data via JustWatch" attribution line, since this data is sourced from JustWatch's own licensed feed via TMDB and carries a separate attribution obligation from TMDB's own.

**Design decisions**:
- **Rendered as a new row beneath `.genres`, above `.overview`** — it's descriptive metadata about the show like genres, not an action, so it belongs with the other descriptive rows rather than inside `.cardActions`.
- **Logos are optional, name is the reliable fallback.** `StreamingProvider.logoUrl` may be `null` (Series Spec 020 AC-05 — TMDB's `logo_path` can be absent). When a logo is available it's shown alongside the name (`alt={provider.name}`, matching the existing poster `alt=""` decorative-image convention only for genuinely decorative images — a provider logo is meaningful content, so it gets real alt text); when it isn't, the name alone is still rendered. Never omit the row just because a logo is missing.
- **An empty `streamingProviders` list renders a quiet "Not currently streaming in the UK" note, not silence and not an error.** Distinguishing "we don't know" from "TMDB/JustWatch has no current match" isn't something the API surfaces (Series Spec 020 collapses both into an empty list), so this is treated as a normal, unremarkable outcome — consistent with how a missing `tmdbRating` renders nothing rather than an error (`frontend_spec_020_recommendation_rating_display.md`), just with a one-line note instead of fully omitting the row, since "not streaming anywhere I can see" is itself useful information here, unlike a missing rating.
- **The JustWatch attribution line is a second `<p className={styles.attribution}>`, immediately after the existing TMDB one** — not merged into a single sentence, so each source's attribution text stays independently editable/removable if either integration ever changes, and matches this app's existing one-line-per-source attribution convention.

---

## Requirements

### Requirement 1: Types

**User story**: As a developer, I want the streaming-provider shape typed centrally, so `RecommendationsList` and any future consumer share one contract.

#### Acceptance Criteria

- **FRONTEND-025-AC-01** [AUTO]: `src/types/series.ts` shall gain a `StreamingProvider` interface: `{ name: string, logoUrl: string | null }`.
- **FRONTEND-025-AC-02** [AUTO]: `Recommendation` shall gain `streamingProviders: StreamingProvider[]`, positioned after `voteCount`.

---

### Requirement 2: Display

**User story**: As a user browsing recommendations, I want to see at a glance whether a suggested show is on a service I already have, so I don't have to look it up myself before deciding to add it.

#### Acceptance Criteria

- **FRONTEND-025-AC-03** [AUTO]: When `r.streamingProviders` is non-empty, `RecommendationsList` shall render one entry per provider beneath `.genres` — each showing the provider's `logoUrl` (as an `<img>` with `alt={provider.name}`) when non-`null`, and always showing `provider.name` as text.
- **FRONTEND-025-AC-04** [AUTO]: When `r.streamingProviders` is empty, `RecommendationsList` shall render "Not currently streaming in the UK" in the same row position, in place of the provider list.
- **FRONTEND-025-AC-05** [AUTO]: `RecommendationsList` shall render a second attribution line, "Streaming data via JustWatch.", immediately after the existing "This product uses the TMDB API but is not endorsed or certified by TMDB." line.

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `RecommendationDto.streamingProviders`, `StreamingProvider` backend shape | `series_spec_020_watch_providers.md` |
| `RecommendationsList`'s card structure (`.cardHeader`, `.genres`, `.overview`, `.attribution`), existing TMDB attribution line | `frontend_spec_010_recommendations.md` |
| Poster `alt=""` decorative-vs-meaningful-image convention this spec departs from for provider logos | `frontend_spec_009_omdb_autofill.md` |
| "Render nothing alarming on an absent value" precedent (`tmdbRating`) this spec's empty-state note departs from (a one-line note instead of full omission) | `frontend_spec_020_recommendation_rating_display.md` |

---

## TDD Test Case Sketches

### `src/components/RecommendationsList.test.tsx`

```typescript
describe('FRONTEND-025-AC-03: streaming providers rendered', () => {
  it('renders provider name and logo when present', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({
        streamingProviders: [{ name: 'Netflix', logoUrl: 'https://image.tmdb.org/t/p/w92/abc.jpg' }],
      }),
    ])
    render(<RecommendationsList />)

    expect(await screen.findByText('Netflix')).toBeInTheDocument()
    expect(screen.getByAltText('Netflix')).toHaveAttribute(
      'src',
      'https://image.tmdb.org/t/p/w92/abc.jpg',
    )
  })

  it('renders the name alone when logoUrl is null', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ streamingProviders: [{ name: 'BBC iPlayer', logoUrl: null }] }),
    ])
    render(<RecommendationsList />)

    expect(await screen.findByText('BBC iPlayer')).toBeInTheDocument()
    expect(screen.queryByAltText('BBC iPlayer')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-025-AC-04: empty streamingProviders shows a quiet note', () => {
  it('renders the not-streaming note instead of a provider list', async () => {
    mockGetRecommendations.mockResolvedValue([
      makeRecommendation({ streamingProviders: [] }),
    ])
    render(<RecommendationsList />)

    expect(
      await screen.findByText('Not currently streaming in the UK'),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-025-AC-05: JustWatch attribution', () => {
  it('renders a JustWatch attribution line alongside the TMDB one', async () => {
    mockGetRecommendations.mockResolvedValue([makeRecommendation({})])
    render(<RecommendationsList />)

    await screen.findByText(/./)
    expect(screen.getByText('Streaming data via JustWatch.')).toBeInTheDocument()
    expect(
      screen.getByText(/uses the TMDB API but is not endorsed/),
    ).toBeInTheDocument()
  })
})
```

---

## Acceptance Criteria Summary

- [ ] FRONTEND-025-AC-01: `StreamingProvider` type
- [ ] FRONTEND-025-AC-02: `Recommendation.streamingProviders` field
- [ ] FRONTEND-025-AC-03: provider name/logo rendered per entry
- [ ] FRONTEND-025-AC-04: empty list → "Not currently streaming in the UK" note
- [ ] FRONTEND-025-AC-05: JustWatch attribution line alongside the existing TMDB one
