# Frontend Spec 125: Labeled Filter-Profile Auto-Names

**Status**: Not started
**Priority**: P4 (UX polish — the suggested name is always editable before saving, this just improves the default)
**Depends on**: `frontend_spec_108_filter_profile_management_and_save_modal.md` (introduced `suggestFilterProfileName`, whose `FRONTEND-108-AC-02` this spec explicitly supersedes)
**Area**: Frontend (`utils/describeFilterCriteria.ts`, `utils/describeFilterCriteria.test.ts`)

## Overview

`suggestFilterProfileName` (added by `frontend_spec_108`) generates a saved-filter-profile's suggested name by joining the first 3 criteria values with `", "` — deliberately dropping their labels (`FRONTEND-108-AC-02`: "joining the first few entries' `value`s, **not** `label: value` pairs"). This reads fine when the values are self-describing strings (a genre name, a keyword) but produces a meaningless name when they're bare numbers: reported case, saving an Analysis filter profile with `minSeriesCount=5, minAveragePersonalRating=4, minAverageBlendedRating=8` suggests the name `"5, 4, 8"`. This isn't Analysis-specific — every one of the 5 `FilterProfileArea`s has at least one all-numeric field combination that would trigger the identical problem (e.g. My Series' `minPersonalRating`/`minImdbRating`/`minTmdbRating`, or Custom Search's `minTmdbRating`/`yearMin`/`yearMax`) — Analysis just makes it maximally visible since all 3 of its fields are numeric thresholds.

This spec labels only the entries that actually need it — bare numeric values — leaving already-self-describing string values exactly as they render today.

## Design Decisions

- **Detect "needs a label" by testing the formatted value itself** (`/^-?\d+(\.\d+)?$/.test(entry.value)`), not by adding a new flag to `CriteriaDescriptionEntry` or touching any of the 5 `describeXCriteria` functions — every entry already arrives as a plain string by the time `suggestFilterProfileName` sees it, and a bare-number check is a reliable, generic signal that context is missing, without needing to know which specific field produced it.
- **Short labels, derived from the existing full label, not a new hand-maintained table.** Strip the leading `"Min "`/`"Max "`/`"Avg "` tokens (in any combination, e.g. "Min Avg Personal Rating" → "Personal Rating") from the label already produced by `describeFilterCriteria`. This generalizes correctly across all 5 areas' numeric fields (Personal/IMDb/TMDB/Rotten Tomatoes ratings, vote count, year bounds, series count) with one small string transform, not a per-field mapping that needs updating every time a new numeric filter is added (e.g. `series_spec_063`'s new RT min-rating fields need zero changes here to get this fix for free).
- **Non-numeric entries are completely unaffected** — `"Comedy, 2020"`-style names (genres, keywords, statuses, sort field names) keep rendering exactly as they do today. This is a targeted fix for the specific ambiguity numbers create, not a wholesale format change.
- **This supersedes `frontend_spec_108`'s `FRONTEND-108-AC-02`** — that AC's statement ("not `label: value` pairs") and its test fixtures (which only ever exercised self-describing values) predate this fix and no longer describe the function's full behavior. This spec's own AC amends it rather than silently diverging.
- **The 60-character truncation (`SUGGESTED_NAME_MAX_LENGTH`) and 3-entry cap (`SUGGESTED_NAME_MAX_ENTRIES`) are unchanged** — short, stripped labels (e.g. "Series Count 5", not "Min Series Count: 5") keep 3-entry names comfortably under 60 characters in the common case, avoiding the mid-word truncation a full-label version would commonly hit.

---

## Requirement 1: Numeric criteria values get a short label in the suggested name

**User story**: As a user saving a filter profile whose first few criteria happen to be numeric thresholds, I want the suggested name to say what each number means, instead of a bare, ambiguous list of digits.

### FRONTEND-125-AC-01 [AUTO]
**Statement**: `suggestFilterProfileName` shall prefix each bare-numeric entry's value with a short label (its `label` with leading `"Min "`/`"Max "`/`"Avg "` tokens stripped), joined as `"{shortLabel} {value}"`; non-numeric entries shall render as just their `value`, unchanged from today.

**References**: `utils/describeFilterCriteria.ts` lines 296-317 (`suggestFilterProfileName`, the function being amended).

**Test Case (Red)**:
```typescript
describe('FRONTEND-125-AC-01: suggestFilterProfileName labels numeric entries', () => {
  it('labels the reported all-numeric Analysis case', () => {
    expect(
      suggestFilterProfileName('ANALYSIS_FILTERS', {
        minSeriesCount: '5',
        minAveragePersonalRating: '4',
        minAverageBlendedRating: '8',
      }),
    ).toBe('Series Count 5, Personal Rating 4, Blended Rating 8')
  })

  it('labels a My Series all-numeric case', () => {
    expect(
      suggestFilterProfileName('MY_SERIES', {
        minPersonalRating: 5,
        minImdbRating: 4,
        minTmdbRating: 8,
      }),
    ).toBe('Personal Rating 5, IMDb Rating 4, TMDB Rating 8')
  })

  it('leaves self-describing string values unlabeled, unchanged from today', () => {
    expect(
      suggestFilterProfileName('MY_SERIES', { genres: ['Comedy'], yearMin: 2020 }),
    ).toBe('Comedy, 2020')
  })

  it('labels only the numeric entry in a mixed case', () => {
    expect(
      suggestFilterProfileName('MY_SERIES', {
        genres: ['Comedy'],
        minImdbRating: 7,
      }),
    ).toBe('Comedy, IMDb Rating 7')
  })

  it('still returns "New Profile" when there are no entries', () => {
    expect(suggestFilterProfileName('MY_SERIES', {})).toBe('New Profile')
  })

  it('still truncates with an ellipsis past the character limit', () => {
    const longName = suggestFilterProfileName('MY_SERIES', {
      minPersonalRating: 5,
      minImdbRating: 4,
      minTmdbRating: 8,
    })
    expect(longName.length).toBeLessThanOrEqual(60)
  })
})
```
**Test Case (Green)**: implement a small `shortLabel(label: string): string` helper stripping leading `"Min "`/`"Max "`/`"Avg "` tokens (e.g. via `label.replace(/^(Min|Max|Avg)\s+/, '').replace(/^(Min|Max|Avg)\s+/, '')` to catch double-prefixed labels like "Min Avg Personal Rating"); change the `.map((e) => e.value)` in `suggestFilterProfileName` to `.map((e) => (/^-?\d+(\.\d+)?$/.test(e.value) ? \`${shortLabel(e.label)} ${e.value}\` : e.value))`.

---

### FRONTEND-125-AC-02 [AUTO] (amends `frontend_spec_108`)
**Statement**: `frontend_spec_108_filter_profile_management_and_save_modal.md`'s `FRONTEND-108-AC-02` shall be annotated as superseded by this spec, noting that bare numeric values are now labeled (this spec's `FRONTEND-125-AC-01`) while its original "no `label: value` pairs" behavior is retained for non-numeric values.

**References**: `.claude/specs/frontend_spec_108_filter_profile_management_and_save_modal.md`, `FRONTEND-108-AC-02`.

**Test Case (Green)**: add a short superseding note to that AC in the spec file (not a test — a documentation update).

---

## Cross-References

| This spec | Source |
|-----------|--------|
| `suggestFilterProfileName`, the function this spec amends | `frontend_spec_108_filter_profile_management_and_save_modal.md` (`FRONTEND-108-AC-02`) |
| `describeFilterCriteria`/per-area describe functions this spec's fix requires zero changes to | same file, `describeMySeriesCriteria`/`describeUseMySeriesCriteria`/`describeRecommendationFiltersCriteria`/`describeCustomSearchCriteria`/`describeAnalysisFiltersCriteria` |
| Bug report that surfaced this gap | Analysis filter profile save producing "5, 4, 8" |

---

## Acceptance Criteria Summary

- [ ] FRONTEND-125-AC-01: bare numeric entries get a short label; non-numeric entries unchanged; truncation/empty-case behavior preserved
- [ ] FRONTEND-125-AC-02: `frontend_spec_108`'s `FRONTEND-108-AC-02` annotated as superseded
