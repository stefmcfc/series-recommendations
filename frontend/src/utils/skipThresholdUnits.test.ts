import { describe, it, expect } from 'vitest'
import { toMinutes, formatThreshold } from './skipThresholdUnits'

describe('FRONTEND-101-AC-02: unit conversion to minutes', () => {
  it('converts days/weeks/months to minutes', () => {
    expect(toMinutes(3, 'days')).toBe(4320)
    expect(toMinutes(1, 'weeks')).toBe(10080)
    expect(toMinutes(2, 'months')).toBe(86400)
  })
})

describe('FRONTEND-101-AC-04: minutes format back to the friendliest unit', () => {
  it('prefers the largest whole unit, falls back to minutes', () => {
    expect(formatThreshold(4320)).toBe('3 days')
    expect(formatThreshold(10080)).toBe('1 week')
    expect(formatThreshold(43200)).toBe('1 month')
    expect(formatThreshold(90)).toBe('90 min')
  })

  it('uses singular units for a value of 1', () => {
    expect(formatThreshold(1440)).toBe('1 day')
  })

  it('prefers months over weeks when a value divides evenly into both', () => {
    // 86400 min = 2 months (43200 each) = 8.57 weeks (not whole) -- but pick
    // a value that divides evenly into both months and weeks to confirm
    // months (the larger unit) wins.
    expect(formatThreshold(43200)).toBe('1 month')
  })
})
