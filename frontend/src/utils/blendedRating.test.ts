import { describe, it, expect } from 'vitest'
import { blendedRating } from './blendedRating'

// FRONTEND-136-AC-06: reimplements RatingBlendUtil.blendedRating's contract
// client-side -- see this file's own top comment for the pairing rationale.
describe('blendedRating', () => {
  it('averages imdbRating and tmdbRating, rounded to 1dp', () => {
    expect(blendedRating({ imdbRating: 8.8, tmdbRating: 8.4 })).toBe(8.6)
  })

  it('uses only imdbRating when tmdbRating is null', () => {
    expect(blendedRating({ imdbRating: 7.2, tmdbRating: null })).toBe(7.2)
  })

  it('uses only tmdbRating when imdbRating is null', () => {
    expect(blendedRating({ imdbRating: null, tmdbRating: 6.75 })).toBe(6.8)
  })

  it('returns null when both are null', () => {
    expect(blendedRating({ imdbRating: null, tmdbRating: null })).toBeNull()
  })
})
