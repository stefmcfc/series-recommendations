import { describe, it, expect } from 'vitest'
import {
  validateYear,
  validateTotalSeasons,
  validateTotalEpisodes,
  validateImdbRating,
  validateRottenTomatoesRating,
  validateRottenTomatoesPopcornmeter,
  validatePersonalRating,
} from './seriesFormValidation'

describe('TOOLING-005-AC-01: shared series form validators', () => {
  it('validateYear rejects out-of-range years, ignores blank', () => {
    const errors: { year?: string } = {}
    validateYear({ year: '2030' }, errors)
    expect(errors.year).toBe('Year must be between 1 and 2026')

    const noError: { year?: string } = {}
    validateYear({ year: '' }, noError)
    expect(noError.year).toBeUndefined()
  })

  it('validateTotalSeasons rejects less than 1', () => {
    const errors: { totalSeasons?: string } = {}
    validateTotalSeasons({ totalSeasons: '0' }, errors)
    expect(errors.totalSeasons).toBe('Total seasons must be at least 1')
  })

  it('validateTotalEpisodes rejects less than 1', () => {
    const errors: { totalEpisodes?: string } = {}
    validateTotalEpisodes({ totalEpisodes: '0' }, errors)
    expect(errors.totalEpisodes).toBe('Total episodes must be at least 1')
  })

  it('validateImdbRating rejects out-of-range values', () => {
    const errors: { imdbRating?: string } = {}
    validateImdbRating({ imdbRating: '11' }, errors)
    expect(errors.imdbRating).toBe('IMDb rating must be between 0 and 10')
  })

  it('validateRottenTomatoesRating rejects out-of-range values', () => {
    const errors: { rottenTomatoesRating?: string } = {}
    validateRottenTomatoesRating({ rottenTomatoesRating: '101' }, errors)
    expect(errors.rottenTomatoesRating).toBe(
      'Rotten Tomatoes rating must be between 0 and 100',
    )
  })

  it('validateRottenTomatoesPopcornmeter rejects out-of-range values', () => {
    const errors: { rottenTomatoesPopcornmeter?: string } = {}
    validateRottenTomatoesPopcornmeter(
      { rottenTomatoesPopcornmeter: '-1' },
      errors,
    )
    expect(errors.rottenTomatoesPopcornmeter).toBe(
      'Rotten Tomatoes rating must be between 0 and 100',
    )
  })

  it('validatePersonalRating rejects out-of-range ratings', () => {
    const errors: { personalRating?: string } = {}
    validatePersonalRating({ personalRating: '9' }, errors)
    expect(errors.personalRating).toBe(
      'Personal rating must be between 1 and 5',
    )
  })
})
