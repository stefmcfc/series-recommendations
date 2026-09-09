import { describe, it, expect } from 'vitest'
import { isAccentColor } from './accentColor'

describe('FRONTEND-110-AC-01: isAccentColor validator', () => {
  it('accepts each of the five known AccentColor values', () => {
    expect(isAccentColor('purple')).toBe(true)
    expect(isAccentColor('blue')).toBe(true)
    expect(isAccentColor('green')).toBe(true)
    expect(isAccentColor('orange')).toBe(true)
    expect(isAccentColor('teal')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isAccentColor('bogus')).toBe(false)
    expect(isAccentColor(null)).toBe(false)
    expect(isAccentColor(42)).toBe(false)
  })
})
