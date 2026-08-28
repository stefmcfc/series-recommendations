import { describe, it, expect } from 'vitest'
import { COUNTRY_OPTIONS } from './countryOptions'

describe('FRONTEND-047-AC-07: COUNTRY_OPTIONS is a static, hardcoded list', () => {
  it('is a non-empty PickerOption[] of ISO codes with human-readable labels', () => {
    expect(COUNTRY_OPTIONS.length).toBeGreaterThan(0)
    for (const option of COUNTRY_OPTIONS) {
      expect(option.id).toMatch(/^[A-Z]{2}$/)
      expect(option.label.length).toBeGreaterThan(0)
    }
  })

  it('includes Japan, resolved to its full display name', () => {
    const japan = COUNTRY_OPTIONS.find((option) => option.id === 'JP')
    expect(japan?.label).toBe('Japan')
  })

  it('excludes US/GB -- those are supplied via pinnedOptions instead, not this list', () => {
    expect(COUNTRY_OPTIONS.find((option) => option.id === 'US')).toBeUndefined()
    expect(COUNTRY_OPTIONS.find((option) => option.id === 'GB')).toBeUndefined()
  })
})
