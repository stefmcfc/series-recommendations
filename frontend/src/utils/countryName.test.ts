import { describe, it, expect } from 'vitest'
import { formatCountryName } from './countryName'

describe('FRONTEND-026-AC-05: formatCountryName', () => {
  it('resolves ISO codes to display names', () => {
    expect(formatCountryName('GB')).toBe('United Kingdom')
    expect(formatCountryName('US')).toBe('United States')
  })

  it('returns null for a null code', () => {
    expect(formatCountryName(null)).toBeNull()
  })

  it('falls back to the raw code for an unresolvable value', () => {
    expect(formatCountryName('ZZ')).toBe('ZZ')
  })
})
