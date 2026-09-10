// FRONTEND-109-AC-16/17: shared value-bounds validator for saved filter-profile
// criteria -- mirrors describeFilterCriteria.ts's dispatch-per-area shape and its
// Partial<...>/unknown-narrowing convention exactly, so the two utilities read as
// obvious siblings. Exists because SaveFilterProfileModal previously only
// validated the profile *name* (validateFilterProfileName), never the criteria
// values themselves -- a profile could be saved with e.g. minTmdbRating: '-99',
// which the backend's RecommendationCriteriaValidator correctly 400s on every
// subsequent "Get Recommendations" request built from it, with nothing in the UI
// explaining why or resetting the bad field. Bounds below are taken from each
// field's own live NumberInput min/max props elsewhere in the app (SearchFilter.tsx,
// UseMySeriesPanel.tsx, RecommendationFiltersBox.tsx, CustomSearchPanel.tsx,
// NameStatsTable.tsx) rather than re-derived, so this can never drift from what a
// user could actually type through a NumberInput's spin arrows.

import type {
  FilterProfileArea,
  MySeriesFilterCriteria,
  UseMySeriesFilterCriteria,
  RecommendationFiltersCriteria,
  CustomSearchFilterCriteria,
  AnalysisFilterCriteria,
} from '../types/filterProfile'
import { MIN_VALID_YEAR, MAX_VALID_YEAR } from './yearBounds'
import { isMinVoteCountValid } from '../components/RecommendationControls'

export interface FilterCriteriaValidationResult {
  valid: boolean
  errors: string[]
}

// A missing/blank field is never an error -- same "unset means no constraint"
// convention describeFilterCriteria.ts's entry()/listEntry() helpers use, so an
// in-progress, partially-filled form (or an older profile saved before a field
// existed) never trips this validator on a field it never touched.
function checkRange(
  label: string,
  value: number | string | undefined,
  min: number,
  max: number,
): string[] {
  if (value === undefined || value === '') return []
  const numeric = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(numeric) || numeric < min || numeric > max) {
    return [`${label} must be between ${min} and ${max}.`]
  }
  return []
}

function checkNonNegativeInteger(
  label: string,
  value: string | undefined,
): string[] {
  if (value === undefined || value.trim() === '') return []
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric >= 0
    ? []
    : [`${label} must be a whole number of at least 0.`]
}

function checkYearRange(
  yearMin: number | string | undefined,
  yearMax: number | string | undefined,
): string[] {
  const errors = [
    ...checkRange('Year (from)', yearMin, MIN_VALID_YEAR, MAX_VALID_YEAR),
    ...checkRange('Year (to)', yearMax, MIN_VALID_YEAR, MAX_VALID_YEAR),
  ]
  if (
    yearMin !== undefined &&
    yearMin !== '' &&
    yearMax !== undefined &&
    yearMax !== '' &&
    Number(yearMin) > Number(yearMax)
  ) {
    errors.push('Year (from) must be on or before Year (to).')
  }
  return errors
}

// Deliberately no minPersonalRating check for MY_SERIES/USE_MY_SERIES -- that
// field is driven by a fixed StarRating picker (0-5 whole stars only), which
// can't be typed out of range the way a free-text NumberInput can.
function validateMySeriesCriteria(
  criteria: Partial<MySeriesFilterCriteria>,
): string[] {
  return [
    ...checkRange('Min IMDb Rating', criteria.minImdbRating, 0, 10),
    ...checkRange('Min TMDB Rating', criteria.minTmdbRating, 0, 10),
    ...checkYearRange(criteria.yearMin, criteria.yearMax),
  ]
}

function validateUseMySeriesCriteria(
  criteria: Partial<UseMySeriesFilterCriteria>,
): string[] {
  return [
    ...checkRange('Min IMDb Rating', criteria.minImdbRating, 0, 10),
    ...checkRange('Min TMDB Rating', criteria.minTmdbRating, 0, 10),
    ...checkYearRange(criteria.yearMin, criteria.yearMax),
  ]
}

function validateRecommendationFiltersCriteria(
  criteria: Partial<RecommendationFiltersCriteria>,
): string[] {
  return [
    ...checkRange('Min TMDB Rating', criteria.minTmdbRating, 0, 10),
    ...checkYearRange(criteria.yearMin, criteria.yearMax),
    // Reuses RecommendationControls.tsx's own isMinVoteCountValid rather than
    // re-implementing the "non-negative whole number" rule a second time.
    ...(criteria.minVoteCount !== undefined &&
    criteria.minVoteCount.trim() !== '' &&
    !isMinVoteCountValid(criteria.minVoteCount)
      ? ['Min Vote Count must be a whole number of at least 0.']
      : []),
  ]
}

function validateCustomSearchCriteria(
  criteria: Partial<CustomSearchFilterCriteria>,
): string[] {
  return [
    ...checkRange('Min TMDB Rating', criteria.minTmdbRating, 0, 10),
    ...checkYearRange(criteria.yearMin, criteria.yearMax),
  ]
}

function validateAnalysisFiltersCriteria(
  criteria: Partial<AnalysisFilterCriteria>,
): string[] {
  return [
    ...checkNonNegativeInteger('Min Series Count', criteria.minSeriesCount),
    ...checkRange(
      'Min Avg Personal Rating',
      criteria.minAveragePersonalRating,
      0,
      5,
    ),
    ...checkRange(
      'Min Avg Blended Rating',
      criteria.minAverageBlendedRating,
      0,
      10,
    ),
  ]
}

// FRONTEND-109-AC-16/17: `criteria` is `unknown` at both call sites (a
// not-yet-validated in-progress form about to be saved, or a previously-saved
// profile's JSON `criteria` column about to be applied) -- narrowed the same way
// describeFilterCriteria.ts narrows it, per area.
export function validateFilterCriteria(
  area: FilterProfileArea,
  criteria: unknown,
): FilterCriteriaValidationResult {
  if (typeof criteria !== 'object' || criteria === null) {
    return { valid: true, errors: [] }
  }

  let errors: string[]
  switch (area) {
    case 'MY_SERIES':
      errors = validateMySeriesCriteria(
        criteria as Partial<MySeriesFilterCriteria>,
      )
      break
    case 'USE_MY_SERIES':
      errors = validateUseMySeriesCriteria(
        criteria as Partial<UseMySeriesFilterCriteria>,
      )
      break
    case 'RECOMMENDATION_FILTERS':
      errors = validateRecommendationFiltersCriteria(
        criteria as Partial<RecommendationFiltersCriteria>,
      )
      break
    case 'CUSTOM_SEARCH':
      errors = validateCustomSearchCriteria(
        criteria as Partial<CustomSearchFilterCriteria>,
      )
      break
    case 'ANALYSIS_FILTERS':
      errors = validateAnalysisFiltersCriteria(
        criteria as Partial<AnalysisFilterCriteria>,
      )
      break
    default:
      errors = []
  }

  return { valid: errors.length === 0, errors }
}
