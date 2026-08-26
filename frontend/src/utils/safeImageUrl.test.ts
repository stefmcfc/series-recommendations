import { describe, it, expect } from 'vitest'
import { sanitizeImageUrl } from './safeImageUrl'

describe('sanitizeImageUrl', () => {
  it('returns the re-parsed href for http and https URLs', () => {
    expect(sanitizeImageUrl('https://example.com/poster.jpg')).toBe(
      'https://example.com/poster.jpg',
    )
    expect(sanitizeImageUrl('http://example.com/poster.jpg')).toBe(
      'http://example.com/poster.jpg',
    )
  })

  it('rejects javascript: and data: schemes', () => {
    expect(sanitizeImageUrl('javascript:alert(1)')).toBeNull()
    expect(
      sanitizeImageUrl('data:text/html,<script>alert(1)</script>'),
    ).toBeNull()
  })

  it('rejects unparseable input', () => {
    expect(sanitizeImageUrl('not a url')).toBeNull()
    expect(sanitizeImageUrl('')).toBeNull()
  })
})
