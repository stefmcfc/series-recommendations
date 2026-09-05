import { describe, it, expect } from 'vitest'
import {
  validateYear,
  validateTotalSeasons,
  validateTotalEpisodes,
  validateImdbRating,
  validateRottenTomatoesRating,
  validateRottenTomatoesPopcornmeter,
} from './seriesFormValidation'
import { MIN_VALID_YEAR, MAX_VALID_YEAR } from './yearBounds'

describe('TOOLING-005-AC-01: shared series form validators', () => {
  it('validateYear rejects out-of-range years, ignores blank', () => {
    const errors: { year?: string } = {}
    validateYear({ year: String(MAX_VALID_YEAR + 1) }, errors)
    expect(errors.year).toBe(
      `Year must be between ${MIN_VALID_YEAR} and ${MAX_VALID_YEAR}`,
    )

    const noError: { year?: string } = {}
    validateYear({ year: '' }, noError)
    expect(noError.year).toBeUndefined()
  })

  it('validateTotalSeasons rejects less than 1', () => {
    const errors: { totalSeasons?: string } = {}
    validateTotalSeasons({ totalSeasons: '0' }, errors)
    expect(errors.totalSeasons).toBe(
      'Total seasons must be a whole number of at least 1',
    )
  })

  it('validateTotalEpisodes rejects less than 1', () => {
    const errors: { totalEpisodes?: string } = {}
    validateTotalEpisodes({ totalEpisodes: '0' }, errors)
    expect(errors.totalEpisodes).toBe(
      'Total episodes must be a whole number of at least 1',
    )
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
      'Rotten Tomatoes rating must be a whole number between 0 and 100',
    )
  })

  it('validateRottenTomatoesPopcornmeter rejects out-of-range values', () => {
    const errors: { rottenTomatoesPopcornmeter?: string } = {}
    validateRottenTomatoesPopcornmeter(
      { rottenTomatoesPopcornmeter: '-1' },
      errors,
    )
    expect(errors.rottenTomatoesPopcornmeter).toBe(
      'Rotten Tomatoes rating must be a whole number between 0 and 100',
    )
  })
})

describe('FRONTEND-091-AC-02/03/04/05: whole-number fields reject a non-integer value', () => {
  it('FRONTEND-091-AC-02: validateTotalSeasons rejects a non-integer value', () => {
    const errors: { totalSeasons?: string } = {}
    validateTotalSeasons({ totalSeasons: '3.5' }, errors)
    expect(errors.totalSeasons).toBe(
      'Total seasons must be a whole number of at least 1',
    )
  })

  it('FRONTEND-091-AC-03: validateTotalEpisodes rejects a non-integer value', () => {
    const errors: { totalEpisodes?: string } = {}
    validateTotalEpisodes({ totalEpisodes: '12.5' }, errors)
    expect(errors.totalEpisodes).toBe(
      'Total episodes must be a whole number of at least 1',
    )
  })

  it('FRONTEND-091-AC-04: validateRottenTomatoesRating rejects a non-integer value', () => {
    const errors: { rottenTomatoesRating?: string } = {}
    validateRottenTomatoesRating({ rottenTomatoesRating: '55.5' }, errors)
    expect(errors.rottenTomatoesRating).toBe(
      'Rotten Tomatoes rating must be a whole number between 0 and 100',
    )
  })

  it('FRONTEND-091-AC-05: validateRottenTomatoesPopcornmeter rejects a non-integer value', () => {
    const errors: { rottenTomatoesPopcornmeter?: string } = {}
    validateRottenTomatoesPopcornmeter(
      { rottenTomatoesPopcornmeter: '87.2' },
      errors,
    )
    expect(errors.rottenTomatoesPopcornmeter).toBe(
      'Rotten Tomatoes rating must be a whole number between 0 and 100',
    )
  })
})

describe('FRONTEND-061-AC-01: validateYear uses the shared 1900–current year + 1 bound', () => {
  it('rejects a year below 1900', () => {
    const form = { year: '1899' }
    const errors: { year?: string } = {}
    validateYear(form, errors)
    expect(errors.year).toBe(
      `Year must be between ${MIN_VALID_YEAR} and ${MAX_VALID_YEAR}`,
    )
  })

  it('rejects a year beyond current year + 1', () => {
    const form = { year: String(MAX_VALID_YEAR + 1) }
    const errors: { year?: string } = {}
    validateYear(form, errors)
    expect(errors.year).toBe(
      `Year must be between ${MIN_VALID_YEAR} and ${MAX_VALID_YEAR}`,
    )
  })

  it('accepts current year + 1 (the boundary)', () => {
    const form = { year: String(MAX_VALID_YEAR) }
    const errors: { year?: string } = {}
    validateYear(form, errors)
    expect(errors.year).toBeUndefined()
  })

  it('accepts 1900 (the boundary)', () => {
    const form = { year: '1900' }
    const errors: { year?: string } = {}
    validateYear(form, errors)
    expect(errors.year).toBeUndefined()
  })
})
