import { describe, it, expect } from 'vitest'
import {
  resolveKeywordSuggestionsLimit,
  resolveSpecificSeriesPickerLimit,
} from './keywordSuggestions'

describe('FRONTEND-032-AC-06: resolveKeywordSuggestionsLimit', () => {
  it('falls back to 10 when unset or non-numeric, otherwise parses the value', () => {
    expect(resolveKeywordSuggestionsLimit(undefined)).toBe(10)
    expect(resolveKeywordSuggestionsLimit('15')).toBe(15)
    expect(resolveKeywordSuggestionsLimit('not-a-number')).toBe(10)
  })
})

describe('FRONTEND-035-AC-08: resolveSpecificSeriesPickerLimit', () => {
  it('falls back to 15 when unset/invalid, otherwise parses the value', () => {
    expect(resolveSpecificSeriesPickerLimit(undefined)).toBe(15)
    expect(resolveSpecificSeriesPickerLimit('not-a-number')).toBe(15)
    expect(resolveSpecificSeriesPickerLimit('0')).toBe(15)
    expect(resolveSpecificSeriesPickerLimit('25')).toBe(25)
  })
})
