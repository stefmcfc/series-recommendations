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
} from '../types/filterProfile'
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
  const sortByEntry =
    criteria.sortBy != null
      ? [{ label: 'Sort By', value: SORT_BY_LABELS[criteria.sortBy] }]
      : []
  const sortDirectionEntry =
    criteria.sortDirection != null
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
