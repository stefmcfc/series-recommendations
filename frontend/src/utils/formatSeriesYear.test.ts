import { describe, it, expect } from 'vitest'
import { formatSeriesYear } from './formatSeriesYear'

describe('FRONTEND-066-AC-01: formatSeriesYear (supersedes FRONTEND-058-AC-01)', () => {
  it.each([
    [{ year: null, lastAirYear: null, productionStatus: null }, ''],
    [{ year: 2020, lastAirYear: null, productionStatus: null }, '2020'],
    [
      { year: 2020, lastAirYear: null, productionStatus: 'RETURNING_SERIES' },
      '2020',
    ],
    [{ year: 2020, lastAirYear: 2020, productionStatus: 'ENDED' }, '2020'],
    [{ year: 2020, lastAirYear: 2024, productionStatus: 'ENDED' }, '2020-2024'],
    [
      { year: 2020, lastAirYear: 2024, productionStatus: 'CANCELED' },
      '2020-2024',
    ],
    // FRONTEND-066: the case FRONTEND-058-AC-01 got wrong -- same year, but
    // confirmed still returning (e.g. a freshman season aired entirely
    // within one calendar year), must not collapse to a bare year.
    [
      { year: 2025, lastAirYear: 2025, productionStatus: 'RETURNING_SERIES' },
      '2025-',
    ],
    [{ year: 2025, lastAirYear: 2025, productionStatus: null }, '2025-'],
    [
      { year: 2020, lastAirYear: 2025, productionStatus: 'RETURNING_SERIES' },
      '2020-',
    ],
    [{ year: 2020, lastAirYear: 2025, productionStatus: null }, '2020-'],
  ] as const)('formats %j as %s', (series, expected) => {
    expect(formatSeriesYear(series)).toBe(expected)
  })
})
