import { describe, it, expect } from 'vitest'
import { formatCountryName, formatCountryNames } from './countryName'

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

describe('FRONTEND-085-AC-01: formatCountryNames resolves a multi-code value', () => {
  it('resolves and joins each code with a comma-space', () => {
    expect(formatCountryNames('GB,US')).toBe('United Kingdom, United States')
  })
})

describe('FRONTEND-085-AC-02: single-code and null inputs are unchanged', () => {
  it('matches formatCountryName exactly for one code', () => {
    expect(formatCountryNames('GB')).toBe(formatCountryName('GB'))
  })

  it('returns null for a null input', () => {
    expect(formatCountryNames(null)).toBeNull()
  })
})

describe('FRONTEND-085-AC-03: an unresolvable code within a multi-code value falls back per-code', () => {
  it('keeps a recognized code resolved and an unrecognized one raw', () => {
    expect(formatCountryNames('GB,ZZ')).toBe('United Kingdom, ZZ')
  })
})
