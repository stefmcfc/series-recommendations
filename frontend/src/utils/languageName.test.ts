import { describe, it, expect } from 'vitest'
import { formatLanguageName } from './languageName'

describe('FRONTEND-117-AC-04: formatLanguageName', () => {
  it('resolves ISO 639-1 codes to display names', () => {
    expect(formatLanguageName('en')).toBe('English')
    expect(formatLanguageName('ko')).toBe('Korean')
  })

  it('returns null for a null code', () => {
    expect(formatLanguageName(null)).toBeNull()
  })

  it('falls back to the raw code for an unresolvable value', () => {
    expect(formatLanguageName('zz')).toBe('zz')
  })
})
