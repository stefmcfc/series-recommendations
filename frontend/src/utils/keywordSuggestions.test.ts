import { describe, it, expect } from 'vitest'
import { resolveKeywordSuggestionsLimit } from './keywordSuggestions'

describe('FRONTEND-032-AC-06: resolveKeywordSuggestionsLimit', () => {
  it('falls back to 10 when unset or non-numeric, otherwise parses the value', () => {
    expect(resolveKeywordSuggestionsLimit(undefined)).toBe(10)
    expect(resolveKeywordSuggestionsLimit('15')).toBe(15)
    expect(resolveKeywordSuggestionsLimit('not-a-number')).toBe(10)
  })
})
