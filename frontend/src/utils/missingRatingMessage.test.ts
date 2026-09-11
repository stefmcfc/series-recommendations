import { describe, it, expect } from 'vitest'
import { formatMissingRatingMessage } from './missingRatingMessage'

describe('FRONTEND-119-AC-02: formatMissingRatingMessage', () => {
  it('returns null when count is 0', () => {
    expect(formatMissingRatingMessage(0, 'rottenTomatoesRating')).toBeNull()
  })

  it('returns null for a non-droppable sortBy', () => {
    expect(formatMissingRatingMessage(3, 'personalRating')).toBeNull()
  })

  it('formats a plural message for the Tomatometer', () => {
    expect(formatMissingRatingMessage(3, 'rottenTomatoesRating')).toBe(
      '3 series meeting this criteria do not have Tomatometer ratings',
    )
  })

  it('formats a singular message with correct verb agreement', () => {
    expect(formatMissingRatingMessage(1, 'imdbRating')).toBe(
      '1 series meeting this criteria does not have IMDb ratings',
    )
  })

  it('uses the Popcornmeter label for rottenTomatoesPopcornmeter', () => {
    expect(formatMissingRatingMessage(2, 'rottenTomatoesPopcornmeter')).toBe(
      '2 series meeting this criteria do not have Popcornmeter ratings',
    )
  })

  it('formats the tmdbRating label', () => {
    expect(formatMissingRatingMessage(4, 'tmdbRating')).toBe(
      '4 series meeting this criteria do not have TMDB ratings',
    )
  })
})
