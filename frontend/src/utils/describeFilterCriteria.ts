// FRONTEND-108-AC-01/AC-02: one shared criteria-description utility backing
// both the Save modal's suggested name and the Settings manager's "what does
// this profile contain" summary -- not two parallel formatters (this spec's
// Design Decisions). Dispatches per FilterProfileArea to the matching
// criteria shape from types/filterProfile.ts, producing one entry per
// non-empty/non-default field only.

import type {
  FilterProfileArea,
  MySeriesFilterCriteria,
  UseMySeriesFilterCriteria,
  RecommendationFiltersCriteria,
  CustomSearchFilterCriteria,
  AnalysisFilterCriteria,
} from '../types/filterProfile'
import type { NameStatsSortBy } from '../components/NameStatsTable'
import { formatCountryNames } from './countryName'
import { LANGUAGE_OPTIONS } from '../components/RecommendationControls'

export interface CriteriaDescriptionEntry {
  label: string
  value: string
}

// FRONTEND-108-AC-01: matches UseMySeriesPanel.tsx's existing status
// radio-group text exactly.
const STATUS_FILTER_LABELS: Record<
  UseMySeriesFilterCriteria['statusFilter'],
  string
> = {
  any: 'Any Status',
  completedOnly: 'Completed Only',
  completedOrWatching: 'Completed or Watching',
}

// No existing precedent for these -- new, readable labels picked for this
// spec (FRONTEND-108-AC-01's References).
const SORT_BY_LABELS: Record<UseMySeriesFilterCriteria['sortBy'], string> = {
  dateAdded: 'Date Added',
  personalRating: 'My Rating',
  title: 'Title',
  year: 'Year',
  imdbRating: 'IMDb Rating',
  tmdbRating: 'TMDB Rating',
  // FRONTEND-119-AC-07/SERIES-062. Label corrected to "Tomatometer"
  // (FRONTEND-119-AC-10, 2026-09-11) to disambiguate from Popcornmeter.
  rottenTomatoesRating: 'Tomatometer',
  rottenTomatoesPopcornmeter: 'Popcornmeter',
}

const SORT_DIRECTION_LABELS: Record<
  UseMySeriesFilterCriteria['sortDirection'],
  string
> = {
  asc: 'Ascending',
  desc: 'Descending',
}

function entry(label: string, value: string | null | undefined) {
  return value != null && value !== '' ? [{ label, value }] : []
}

function listEntry(label: string, values: readonly string[] | undefined) {
  return values != null && values.length > 0
    ? [{ label, value: values.join(', ') }]
    : []
}

function describeMySeriesCriteria(
  criteria: Partial<MySeriesFilterCriteria>,
): CriteriaDescriptionEntry[] {
  return [
    ...listEntry('Genres', criteria.genres),
    ...listEntry('Exclude Genres', criteria.excludeGenres),
    ...listEntry('Keywords', criteria.keywords),
    ...entry('Min Personal Rating', criteria.minPersonalRating?.toString()),
    ...entry('Min IMDb Rating', criteria.minImdbRating?.toString()),
    ...entry('Min TMDB Rating', criteria.minTmdbRating?.toString()),
    ...entry('Year (from)', criteria.yearMin?.toString()),
    ...entry('Year (to)', criteria.yearMax?.toString()),
  ]
}

function describeUseMySeriesCriteria(
  criteria: Partial<UseMySeriesFilterCriteria>,
): CriteriaDescriptionEntry[] {
  const statusEntry =
    criteria.statusFilter != null && criteria.statusFilter !== 'any'
      ? [
          {
            label: 'Status',
            value: STATUS_FILTER_LABELS[criteria.statusFilter],
          },
        ]
      : []
  // sortBy/sortDirection are never actually "unset" -- UseMySeriesPanel.tsx
  // always initializes them to 'title'/'asc'. Comparing against those exact
  // defaults (not just != null) is what makes "no active criteria" mean
  // anything for this area -- otherwise describeFilterCriteria could never
  // return zero entries here, and FRONTEND-109-AC-13's "disable Save when
  // empty" would never actually trigger.
  const sortByEntry =
    criteria.sortBy != null && criteria.sortBy !== 'title'
      ? [{ label: 'Sort By', value: SORT_BY_LABELS[criteria.sortBy] }]
      : []
  const sortDirectionEntry =
    criteria.sortDirection != null && criteria.sortDirection !== 'asc'
      ? [
          {
            label: 'Sort Direction',
            value: SORT_DIRECTION_LABELS[criteria.sortDirection],
          },
        ]
      : []

  return [
    ...listEntry('Genres', criteria.genreFilter),
    ...listEntry('Exclude Genres', criteria.excludeGenreFilter),
    ...statusEntry,
    ...listEntry('Keywords', criteria.keywordsFilter),
    ...entry('Min Personal Rating', criteria.minPersonalRating?.toString()),
    ...entry('Min IMDb Rating', criteria.minImdbRating),
    ...entry('Min TMDB Rating', criteria.minTmdbRating),
    ...entry('Year (from)', criteria.yearMin),
    ...entry('Year (to)', criteria.yearMax),
    ...sortByEntry,
    ...sortDirectionEntry,
  ]
}

function resolveLanguageLabel(code: string): string {
  return LANGUAGE_OPTIONS.find((option) => option.id === code)?.label ?? code
}

function describeRecommendationFiltersCriteria(
  criteria: Partial<RecommendationFiltersCriteria>,
): CriteriaDescriptionEntry[] {
  const languageEntry =
    criteria.language != null && criteria.language !== ''
      ? [{ label: 'Language', value: resolveLanguageLabel(criteria.language) }]
      : []
  const countriesEntry =
    criteria.countriesSelected != null && criteria.countriesSelected.length > 0
      ? [
          {
            label: 'Countries',
            value:
              formatCountryNames(criteria.countriesSelected.join(',')) ?? '',
          },
        ]
      : []

  return [
    ...entry('Min Vote Count', criteria.minVoteCount),
    ...listEntry('Exclude Genres', criteria.excludeGenresSelected),
    ...listEntry('Exclude Keywords', criteria.excludeKeywordsSelected),
    ...entry('Min TMDB Rating', criteria.minTmdbRating),
    ...entry('Year (from)', criteria.yearMin),
    ...entry('Year (to)', criteria.yearMax),
    ...languageEntry,
    ...countriesEntry,
  ]
}

// FRONTEND-112-AC-02: mirrors describeRecommendationFiltersCriteria's own
// Language/Countries resolution -- extended with the two Custom-Search-only
// fields (genresSelected/keywordsSelected as plain, non-exclude list
// entries), no new formatting logic.
function describeCustomSearchCriteria(
  criteria: Partial<CustomSearchFilterCriteria>,
): CriteriaDescriptionEntry[] {
  const languageEntry =
    criteria.language != null && criteria.language !== ''
      ? [{ label: 'Language', value: resolveLanguageLabel(criteria.language) }]
      : []
  const countriesEntry =
    criteria.countriesSelected != null && criteria.countriesSelected.length > 0
      ? [
          {
            label: 'Countries',
            value:
              formatCountryNames(criteria.countriesSelected.join(',')) ?? '',
          },
        ]
      : []

  return [
    ...listEntry('Genres', criteria.genresSelected),
    ...listEntry('Exclude Genres', criteria.excludeGenresSelected),
    ...listEntry('Keywords', criteria.keywordsSelected),
    ...entry('Min TMDB Rating', criteria.minTmdbRating),
    ...entry('Year (from)', criteria.yearMin),
    ...entry('Year (to)', criteria.yearMax),
    ...languageEntry,
    ...countriesEntry,
  ]
}

// FRONTEND-112-AC-07: new label maps, new to this area only.
const ANALYSIS_STATUS_SCOPE_LABELS: Record<'completed', string> = {
  completed: 'Completed Only',
}

const NAME_STATS_SORT_BY_LABELS: Record<NameStatsSortBy, string> = {
  seriesCount: 'Series Count',
  averagePersonalRating: 'Avg Personal Rating',
  averageBlendedRating: 'Avg Blended Rating',
  name: 'Name',
}

// FRONTEND-112-AC-07: unlike describeUseMySeriesCriteria's sortBy/
// sortDirection, this area's are genuinely `undefined` until a column header
// is clicked (useNameStatsFilters never initializes them) -- so a bare
// `!== undefined` check is correct here with no special-cased default-value
// comparison needed (this spec's Design Decisions -- verified, not the same
// bug class as frontend_spec_109-AC-13).
function describeAnalysisFiltersCriteria(
  criteria: Partial<AnalysisFilterCriteria>,
): CriteriaDescriptionEntry[] {
  const statusEntry =
    criteria.statusScope === 'completed'
      ? [
          {
            label: 'Status',
            value: ANALYSIS_STATUS_SCOPE_LABELS.completed,
          },
        ]
      : []
  const sortByEntry =
    criteria.sortBy !== undefined
      ? [
          {
            label: 'Sort By',
            value: NAME_STATS_SORT_BY_LABELS[criteria.sortBy],
          },
        ]
      : []
  const sortDirectionEntry =
    criteria.sortDirection !== undefined
      ? [
          {
            label: 'Sort Direction',
            value: SORT_DIRECTION_LABELS[criteria.sortDirection],
          },
        ]
      : []

  return [
    ...entry('Min Series Count', criteria.minSeriesCount),
    ...entry('Min Avg Personal Rating', criteria.minAveragePersonalRating),
    ...entry('Min Avg Blended Rating', criteria.minAverageBlendedRating),
    ...statusEntry,
    ...sortByEntry,
    ...sortDirectionEntry,
  ]
}

// FRONTEND-108-AC-01: `criteria` is `unknown` at the call boundary (it
// arrives from a JSON `criteria` column via seriesApi, or from an in-flight
// form's local state before it's ever validated against a concrete type) --
// each area's describer above narrows it to a `Partial<...>` of its own
// shape and treats every field as optional, which naturally covers both a
// fully-populated saved profile and a partially-filled in-progress form.
export function describeFilterCriteria(
  area: FilterProfileArea,
  criteria: unknown,
): CriteriaDescriptionEntry[] {
  if (typeof criteria !== 'object' || criteria === null) return []

  switch (area) {
    case 'MY_SERIES':
      return describeMySeriesCriteria(
        criteria as Partial<MySeriesFilterCriteria>,
      )
    case 'USE_MY_SERIES':
      return describeUseMySeriesCriteria(
        criteria as Partial<UseMySeriesFilterCriteria>,
      )
    case 'RECOMMENDATION_FILTERS':
      return describeRecommendationFiltersCriteria(
        criteria as Partial<RecommendationFiltersCriteria>,
      )
    case 'CUSTOM_SEARCH':
      return describeCustomSearchCriteria(
        criteria as Partial<CustomSearchFilterCriteria>,
      )
    case 'ANALYSIS_FILTERS':
      return describeAnalysisFiltersCriteria(
        criteria as Partial<AnalysisFilterCriteria>,
      )
    default:
      return []
  }
}

const SUGGESTED_NAME_MAX_ENTRIES = 3
const SUGGESTED_NAME_MAX_LENGTH = 60

// FRONTEND-108-AC-02: calls describeFilterCriteria internally so the
// suggested name and the Settings summary can never drift apart (this
// spec's Design Decisions).
export function suggestFilterProfileName(
  area: FilterProfileArea,
  criteria: unknown,
): string {
  const entries = describeFilterCriteria(area, criteria)
  if (entries.length === 0) return 'New Profile'

  const joined = entries
    .slice(0, SUGGESTED_NAME_MAX_ENTRIES)
    .map((e) => e.value)
    .join(', ')

  return joined.length > SUGGESTED_NAME_MAX_LENGTH
    ? `${joined.slice(0, SUGGESTED_NAME_MAX_LENGTH)}…`
    : joined
}
