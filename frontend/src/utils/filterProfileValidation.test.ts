import { describe, it, expect } from 'vitest'
import {
  validateFilterProfileName,
  FILTER_PROFILE_NAME_MAX_LENGTH,
} from './filterProfileValidation'

describe('FRONTEND-108-AC-03: validateFilterProfileName', () => {
  it('rejects blank (after trim)', () => {
    expect(validateFilterProfileName('   ', []).valid).toBe(false)
  })
  it('rejects over 255 characters', () => {
    expect(validateFilterProfileName('a'.repeat(256), []).valid).toBe(false)
  })
  it('accepts exactly 255 characters', () => {
    expect(validateFilterProfileName('a'.repeat(255), []).valid).toBe(true)
  })
  it('rejects a name containing a newline', () => {
    expect(validateFilterProfileName('Bad\nName', []).valid).toBe(false)
  })
  it('rejects a name containing a tab', () => {
    expect(validateFilterProfileName('Bad\tName', []).valid).toBe(false)
  })
  it('rejects a duplicate of an existing name', () => {
    expect(validateFilterProfileName('Weeknight', ['Weeknight']).valid).toBe(
      false,
    )
  })
  it('does not reject renaming a profile to its own current name', () => {
    expect(
      validateFilterProfileName('Weeknight', ['Weeknight'], 'Weeknight').valid,
    ).toBe(true)
  })
  it('exports the 255 max-length constant', () => {
    expect(FILTER_PROFILE_NAME_MAX_LENGTH).toBe(255)
  })
})
