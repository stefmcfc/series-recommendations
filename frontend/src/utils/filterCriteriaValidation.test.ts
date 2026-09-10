import { describe, it, expect } from 'vitest'
import { validateFilterCriteria } from './filterCriteriaValidation'
import { MIN_VALID_YEAR, MAX_VALID_YEAR } from './yearBounds'
import type {
  MySeriesFilterCriteria,
  UseMySeriesFilterCriteria,
  RecommendationFiltersCriteria,
  CustomSearchFilterCriteria,
  AnalysisFilterCriteria,
} from '../types/filterProfile'

describe('FRONTEND-109-AC-16: validateFilterCriteria -- MY_SERIES', () => {
  it('accepts boundary values (0/10) for Min IMDb/TMDB Rating', () => {
    const result = validateFilterCriteria('MY_SERIES', {
      minImdbRating: 0,
      minTmdbRating: 10,
    } satisfies Partial<MySeriesFilterCriteria>)
    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('rejects a Min IMDb Rating just under 0', () => {
    const result = validateFilterCriteria('MY_SERIES', {
      minImdbRating: -0.1,
    } satisfies Partial<MySeriesFilterCriteria>)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['Min IMDb Rating must be between 0 and 10.'])
  })

  it('rejects a Min TMDB Rating just over 10', () => {
    const result = validateFilterCriteria('MY_SERIES', {
      minTmdbRating: 10.1,
    } satisfies Partial<MySeriesFilterCriteria>)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['Min TMDB Rating must be between 0 and 10.'])
  })

  it('accepts boundary years and rejects one year outside either bound', () => {
    expect(
      validateFilterCriteria('MY_SERIES', {
        yearMin: MIN_VALID_YEAR,
        yearMax: MAX_VALID_YEAR,
      } satisfies Partial<MySeriesFilterCriteria>).valid,
    ).toBe(true)
    expect(
      validateFilterCriteria('MY_SERIES', {
        yearMin: MIN_VALID_YEAR - 1,
      } satisfies Partial<MySeriesFilterCriteria>).valid,
    ).toBe(false)
    expect(
      validateFilterCriteria('MY_SERIES', {
        yearMax: MAX_VALID_YEAR + 1,
      } satisfies Partial<MySeriesFilterCriteria>).valid,
    ).toBe(false)
  })

  it('rejects yearMin after yearMax', () => {
    const result = validateFilterCriteria('MY_SERIES', {
      yearMin: 2020,
      yearMax: 2010,
    } satisfies Partial<MySeriesFilterCriteria>)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Year (from) must be on or before Year (to).',
    )
  })

  it('never errors on a missing/blank field', () => {
    expect(validateFilterCriteria('MY_SERIES', {})).toEqual({
      valid: true,
      errors: [],
    })
  })
})

describe('FRONTEND-109-AC-16: validateFilterCriteria -- USE_MY_SERIES', () => {
  it('accepts boundary string values for Min IMDb/TMDB Rating', () => {
    const result = validateFilterCriteria('USE_MY_SERIES', {
      minImdbRating: '0',
      minTmdbRating: '10',
    } satisfies Partial<UseMySeriesFilterCriteria>)
    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('rejects an out-of-range Min IMDb Rating string', () => {
    const result = validateFilterCriteria('USE_MY_SERIES', {
      minImdbRating: '-1',
    } satisfies Partial<UseMySeriesFilterCriteria>)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['Min IMDb Rating must be between 0 and 10.'])
  })

  it('rejects an out-of-range Min TMDB Rating string', () => {
    const result = validateFilterCriteria('USE_MY_SERIES', {
      minTmdbRating: '11',
    } satisfies Partial<UseMySeriesFilterCriteria>)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['Min TMDB Rating must be between 0 and 10.'])
  })

  it('rejects yearMin after yearMax as strings', () => {
    const result = validateFilterCriteria('USE_MY_SERIES', {
      yearMin: '2020',
      yearMax: '2010',
    } satisfies Partial<UseMySeriesFilterCriteria>)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Year (from) must be on or before Year (to).',
    )
  })

  it('never errors on a missing/blank field', () => {
    expect(
      validateFilterCriteria('USE_MY_SERIES', {
        minImdbRating: '',
        minTmdbRating: '',
        yearMin: '',
        yearMax: '',
      } satisfies Partial<UseMySeriesFilterCriteria>),
    ).toEqual({ valid: true, errors: [] })
  })
})

describe('FRONTEND-109-AC-16: validateFilterCriteria -- RECOMMENDATION_FILTERS', () => {
  it('accepts boundary Min TMDB Rating and a valid Min Vote Count', () => {
    const result = validateFilterCriteria('RECOMMENDATION_FILTERS', {
      minTmdbRating: '0',
      minVoteCount: '0',
    } satisfies Partial<RecommendationFiltersCriteria>)
    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('rejects an out-of-range Min TMDB Rating', () => {
    const result = validateFilterCriteria('RECOMMENDATION_FILTERS', {
      minTmdbRating: '-99',
    } satisfies Partial<RecommendationFiltersCriteria>)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['Min TMDB Rating must be between 0 and 10.'])
  })

  it('rejects a negative Min Vote Count via isMinVoteCountValid', () => {
    const result = validateFilterCriteria('RECOMMENDATION_FILTERS', {
      minVoteCount: '-5',
    } satisfies Partial<RecommendationFiltersCriteria>)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      'Min Vote Count must be a whole number of at least 0.',
    ])
  })

  it('rejects a decimal Min Vote Count', () => {
    const result = validateFilterCriteria('RECOMMENDATION_FILTERS', {
      minVoteCount: '5.5',
    } satisfies Partial<RecommendationFiltersCriteria>)
    expect(result.valid).toBe(false)
  })

  it('rejects yearMin after yearMax', () => {
    const result = validateFilterCriteria('RECOMMENDATION_FILTERS', {
      yearMin: '2020',
      yearMax: '2010',
    } satisfies Partial<RecommendationFiltersCriteria>)
    expect(result.errors).toContain(
      'Year (from) must be on or before Year (to).',
    )
  })

  it('never errors on a missing/blank field', () => {
    expect(validateFilterCriteria('RECOMMENDATION_FILTERS', {})).toEqual({
      valid: true,
      errors: [],
    })
  })
})

describe('FRONTEND-109-AC-16: validateFilterCriteria -- CUSTOM_SEARCH', () => {
  it('accepts boundary Min TMDB Rating and years', () => {
    const result = validateFilterCriteria('CUSTOM_SEARCH', {
      minTmdbRating: '10',
      yearMin: String(MIN_VALID_YEAR),
      yearMax: String(MAX_VALID_YEAR),
    } satisfies Partial<CustomSearchFilterCriteria>)
    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('rejects an out-of-range Min TMDB Rating', () => {
    const result = validateFilterCriteria('CUSTOM_SEARCH', {
      minTmdbRating: '-99',
    } satisfies Partial<CustomSearchFilterCriteria>)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['Min TMDB Rating must be between 0 and 10.'])
  })

  it('rejects a year outside the valid bound', () => {
    const result = validateFilterCriteria('CUSTOM_SEARCH', {
      yearMax: String(MAX_VALID_YEAR + 1),
    } satisfies Partial<CustomSearchFilterCriteria>)
    expect(result.valid).toBe(false)
  })

  it('never errors on a missing/blank field', () => {
    expect(validateFilterCriteria('CUSTOM_SEARCH', {})).toEqual({
      valid: true,
      errors: [],
    })
  })
})

describe('FRONTEND-109-AC-16: validateFilterCriteria -- ANALYSIS_FILTERS', () => {
  it('accepts boundary values for every field', () => {
    const result = validateFilterCriteria('ANALYSIS_FILTERS', {
      minSeriesCount: '0',
      minAveragePersonalRating: '5',
      minAverageBlendedRating: '10',
    } satisfies Partial<AnalysisFilterCriteria>)
    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('rejects a negative Min Series Count', () => {
    const result = validateFilterCriteria('ANALYSIS_FILTERS', {
      minSeriesCount: '-1',
    } satisfies Partial<AnalysisFilterCriteria>)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      'Min Series Count must be a whole number of at least 0.',
    ])
  })

  it('rejects a Min Avg Personal Rating just over 5', () => {
    const result = validateFilterCriteria('ANALYSIS_FILTERS', {
      minAveragePersonalRating: '5.1',
    } satisfies Partial<AnalysisFilterCriteria>)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      'Min Avg Personal Rating must be between 0 and 5.',
    ])
  })

  it('rejects a Min Avg Blended Rating just over 10', () => {
    const result = validateFilterCriteria('ANALYSIS_FILTERS', {
      minAverageBlendedRating: '10.1',
    } satisfies Partial<AnalysisFilterCriteria>)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      'Min Avg Blended Rating must be between 0 and 10.',
    ])
  })

  it('never errors on a missing/blank field', () => {
    expect(
      validateFilterCriteria('ANALYSIS_FILTERS', {
        minSeriesCount: '',
        minAveragePersonalRating: '',
        minAverageBlendedRating: '',
      } satisfies Partial<AnalysisFilterCriteria>),
    ).toEqual({ valid: true, errors: [] })
  })
})
