import { describe, it, expect } from 'vitest'
import {
  resolveTieredStep,
  RATING_STEP_BREAKPOINTS,
  ROTTEN_TOMATOES_STEP_BREAKPOINTS,
  YEAR_STEP_BREAKPOINTS,
} from './tieredStep'
import { MIN_VALID_YEAR } from './yearBounds'

describe('FRONTEND-122-AC-05: resolveTieredStep', () => {
  const breakpoints = [
    { from: 0, step: 1 },
    { from: 6, step: 0.5 },
    { from: 8, step: 0.1 },
  ]
  const resolver = resolveTieredStep(breakpoints)

  it('returns the first tier below the first breakpoint boundary', () => {
    expect(resolver(3)).toBe(1)
  })

  it('returns the middle tier at and above its boundary', () => {
    expect(resolver(6)).toBe(0.5)
    expect(resolver(7.5)).toBe(0.5)
  })

  it('returns the finest tier at and above its boundary', () => {
    expect(resolver(8)).toBe(0.1)
    expect(resolver(10)).toBe(0.1)
  })

  it('falls back to the first breakpoint step below every boundary', () => {
    expect(resolver(-5)).toBe(1)
  })
})

describe('FRONTEND-122-AC-06: ready-made breakpoint arrays', () => {
  it('RATING_STEP_BREAKPOINTS covers the 0-10 IMDb/TMDB scale', () => {
    const resolver = resolveTieredStep(RATING_STEP_BREAKPOINTS)
    expect(resolver(0)).toBe(1)
    expect(resolver(5.9)).toBe(1)
    expect(resolver(6)).toBe(0.5)
    expect(resolver(7.9)).toBe(0.5)
    expect(resolver(8)).toBe(0.1)
    expect(resolver(10)).toBe(0.1)
  })

  it('ROTTEN_TOMATOES_STEP_BREAKPOINTS covers the 0-100 RT scale', () => {
    const resolver = resolveTieredStep(ROTTEN_TOMATOES_STEP_BREAKPOINTS)
    expect(resolver(0)).toBe(10)
    expect(resolver(59)).toBe(10)
    expect(resolver(60)).toBe(5)
    expect(resolver(79)).toBe(5)
    expect(resolver(80)).toBe(1)
    expect(resolver(100)).toBe(1)
  })

  it('YEAR_STEP_BREAKPOINTS switches to a step of 1 at 2010', () => {
    const resolver = resolveTieredStep(YEAR_STEP_BREAKPOINTS)
    expect(resolver(MIN_VALID_YEAR)).toBe(10)
    expect(resolver(2009)).toBe(10)
    expect(resolver(2010)).toBe(1)
    expect(resolver(2025)).toBe(1)
  })
})
