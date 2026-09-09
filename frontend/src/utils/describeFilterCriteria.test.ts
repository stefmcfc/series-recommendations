import { describe, it, expect } from 'vitest'
import {
  describeFilterCriteria,
  suggestFilterProfileName,
} from './describeFilterCriteria'
import type {
  MySeriesFilterCriteria,
  UseMySeriesFilterCriteria,
  RecommendationFiltersCriteria,
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
