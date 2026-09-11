import { describe, it, expect } from 'vitest'
import { formatPercent } from './formatPercent'

describe('FRONTEND-119-AC-11: formatPercent', () => {
  it('formats a numeric value as a percent with the given emoji', () => {
    expect(formatPercent(88, '🍅')).toBe('88% 🍅')
  })

  it('formats a different emoji for a different rating field', () => {
    expect(formatPercent(75, '🍿')).toBe('75% 🍿')
  })

  it('renders a dash when the value is null', () => {
    expect(formatPercent(null, '🍅')).toBe('—')
  })
})
