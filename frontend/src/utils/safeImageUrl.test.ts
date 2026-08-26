import { describe, it, expect } from 'vitest'
import { isSafeImageUrl } from './safeImageUrl'

describe('isSafeImageUrl', () => {
  it('allows http and https URLs', () => {
    expect(isSafeImageUrl('https://example.com/poster.jpg')).toBe(true)
    expect(isSafeImageUrl('http://example.com/poster.jpg')).toBe(true)
  })

  it('rejects javascript: and data: schemes', () => {
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeImageUrl('data:text/html,<script>alert(1)</script>')).toBe(
      false,
    )
  })

  it('rejects unparseable input', () => {
    expect(isSafeImageUrl('not a url')).toBe(false)
    expect(isSafeImageUrl('')).toBe(false)
  })
})
