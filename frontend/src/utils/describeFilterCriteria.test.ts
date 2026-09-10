import { describe, it, expect } from 'vitest'
import {
  describeFilterCriteria,
  suggestFilterProfileName,
} from './describeFilterCriteria'
import type {
  MySeriesFilterCriteria,
  UseMySeriesFilterCriteria,
  RecommendationFiltersCriteria,
  CustomSearchFilterCriteria,
  AnalysisFilterCriteria,
} from '../types/filterProfile'

describe('FRONTEND-108-AC-01: describeFilterCriteria', () => {
  it('produces one entry per non-empty field for Area A', () => {
    const entries = describeFilterCriteria('MY_SERIES', {
      genres: ['Comedy'],
      yearMin: 2020,
    } satisfies Partial<MySeriesFilterCriteria>)
    expect(entries).toEqual(
      expect.arrayContaining([
        { label: 'Genres', value: 'Comedy' },
        { label: 'Year (from)', value: '2020' },
      ]),
    )
  })

  it('omits entries for unset fields', () => {
    const entries = describeFilterCriteria('MY_SERIES', {})
    expect(entries).toHaveLength(0)
  })

  it('resolves country codes to names for Area C', () => {
    const entries = describeFilterCriteria('RECOMMENDATION_FILTERS', {
      countriesSelected: ['US', 'GB'],
    } as Partial<RecommendationFiltersCriteria>)
    expect(entries.find((e) => e.label === 'Countries')?.value).toMatch(
      /United States/,
    )
  })

  it('resolves the status filter label for Area B', () => {
    const entries = describeFilterCriteria('USE_MY_SERIES', {
      statusFilter: 'completedOnly',
    } as Partial<UseMySeriesFilterCriteria>)
    expect(entries.find((e) => e.label === 'Status')?.value).toBe(
      'Completed Only',
    )
  })

  it('does not produce a Status entry for the default "any" status', () => {
    const entries = describeFilterCriteria('USE_MY_SERIES', {
      statusFilter: 'any',
    } as Partial<UseMySeriesFilterCriteria>)
    expect(entries.find((e) => e.label === 'Status')).toBeUndefined()
  })

  it('does not produce Sort By/Sort Direction entries at their defaults (title/asc)', () => {
    const entries = describeFilterCriteria('USE_MY_SERIES', {
      sortBy: 'title',
      sortDirection: 'asc',
    } as Partial<UseMySeriesFilterCriteria>)
    expect(entries).toHaveLength(0)
  })

  it('produces a Sort By entry once it differs from the default', () => {
    const entries = describeFilterCriteria('USE_MY_SERIES', {
      sortBy: 'imdbRating',
      sortDirection: 'asc',
    } as Partial<UseMySeriesFilterCriteria>)
    expect(entries.find((e) => e.label === 'Sort By')?.value).toBe(
      'IMDb Rating',
    )
  })

  it('resolves a language code to its readable name for Area C', () => {
    const entries = describeFilterCriteria('RECOMMENDATION_FILTERS', {
      language: 'en',
    } as Partial<RecommendationFiltersCriteria>)
    expect(entries.find((e) => e.label === 'Language')?.value).not.toBe('en')
  })

  it('returns an empty array for null/non-object criteria', () => {
    expect(describeFilterCriteria('MY_SERIES', null)).toEqual([])
    expect(describeFilterCriteria('MY_SERIES', undefined)).toEqual([])
  })
})

describe('FRONTEND-108-AC-02: suggestFilterProfileName', () => {
  it('joins the first few values', () => {
    expect(
      suggestFilterProfileName('MY_SERIES', {
        genres: ['Comedy'],
        yearMin: 2020,
      }),
    ).toBe('Comedy, 2020')
  })

  it('falls back to "New Profile" when criteria is empty', () => {
    expect(suggestFilterProfileName('MY_SERIES', {})).toBe('New Profile')
  })

  it('truncates a long suggestion', () => {
    const long = suggestFilterProfileName('USE_MY_SERIES', {
      genreFilter: ['Comedy', 'Drama', 'Thriller', 'Documentary', 'Action'],
    } as Partial<UseMySeriesFilterCriteria>)
    expect(long.length).toBeLessThanOrEqual(63) // 60 + '…'
  })
})

describe('FRONTEND-112-AC-02: describeFilterCriteria for CUSTOM_SEARCH', () => {
  it('produces one entry per non-empty field', () => {
    const entries = describeFilterCriteria('CUSTOM_SEARCH', {
      genresSelected: ['Comedy'],
      countriesSelected: ['US'],
    } as Partial<CustomSearchFilterCriteria>)
    expect(entries.find((e) => e.label === 'Genres')?.value).toBe('Comedy')
    expect(entries.find((e) => e.label === 'Countries')?.value).toMatch(
      /United States/,
    )
  })

  it('returns an empty array when every field is empty', () => {
    expect(describeFilterCriteria('CUSTOM_SEARCH', {})).toEqual([])
  })
})

describe('FRONTEND-112-AC-07: describeFilterCriteria for ANALYSIS_FILTERS', () => {
  it('produces one entry per non-default field', () => {
    const entries = describeFilterCriteria('ANALYSIS_FILTERS', {
      minSeriesCount: '3',
      statusScope: 'completed',
      sortBy: 'averagePersonalRating',
      sortDirection: 'desc',
    } as Partial<AnalysisFilterCriteria>)
    expect(entries.find((e) => e.label === 'Min Series Count')?.value).toBe('3')
    expect(entries.find((e) => e.label === 'Status')?.value).toBe(
      'Completed Only',
    )
    expect(entries.find((e) => e.label === 'Sort By')?.value).toBe(
      'Avg Personal Rating',
    )
  })

  it('returns an empty array at the true defaults (statusScope "all", sortBy/sortDirection undefined)', () => {
    const entries = describeFilterCriteria('ANALYSIS_FILTERS', {
      minSeriesCount: '',
      minAveragePersonalRating: '',
      minAverageBlendedRating: '',
      statusScope: 'all',
      sortBy: undefined,
      sortDirection: undefined,
    } as Partial<AnalysisFilterCriteria>)
    expect(entries).toEqual([])
  })
})
