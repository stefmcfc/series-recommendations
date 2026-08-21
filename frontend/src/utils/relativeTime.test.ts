import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from './relativeTime'

describe('FRONTEND-023-AC-04: formatRelativeTime', () => {
  it('formats seconds, minutes, hours, and days', () => {
    const now = Date.now()
    expect(formatRelativeTime(new Date(now - 5_000).toISOString())).toBe(
      'just now',
    )
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString())).toBe(
      '5 minutes ago',
    )
    expect(
      formatRelativeTime(new Date(now - 3 * 3_600_000).toISOString()),
    ).toBe('3 hours ago')
    expect(
      formatRelativeTime(new Date(now - 7 * 86_400_000).toISOString()),
    ).toBe('7 days ago')
  })

  it('uses singular units for a value of 1', () => {
    const now = Date.now()
    expect(formatRelativeTime(new Date(now - 1 * 60_000).toISOString())).toBe(
      '1 minute ago',
    )
    expect(
      formatRelativeTime(new Date(now - 1 * 3_600_000).toISOString()),
    ).toBe('1 hour ago')
    expect(
      formatRelativeTime(new Date(now - 1 * 86_400_000).toISOString()),
    ).toBe('1 day ago')
  })
})
